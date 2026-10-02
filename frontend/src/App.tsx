import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

type Page = 'users' | 'roles' | 'positions' | 'statuses' | 'tasks';
type LookupItem = { id: string; name: string };
type CurrentUser = { id: string; name: string; role: string; roleId: string; active: boolean };
type Comment = { userId: string; userName: string; text: string; createdAt: string };
type UserRow = {
  id: string;
  name: string;
  mobile: string;
  roleId: string | null;
  positionId: string | null;
  address: string;
  active: boolean;
};
type TaskRow = {
  id: string;
  title: string;
  description: string;
  assigneeId: string | null;
  createdBy: string;
  statusId: string;
  due: string;
  comments: Comment[];
};
type CatalogRow = LookupItem;
type Row = UserRow | TaskRow | CatalogRow;
type Lookups = { roles: LookupItem[]; positions: LookupItem[]; statuses: LookupItem[]; users: LookupItem[] };
type PageConfig = { title: string; search: string[]; filter?: 'roleId' | 'statusId'; columns: string[] };
type Field = {
  name: string;
  label: string;
  kind?: 'select' | 'textarea' | 'password' | 'date' | 'checkbox';
  options?: keyof Lookups;
  required?: boolean;
};
type ModalState = { id: string | null };

const PAGE_CONFIG: Record<Page, PageConfig> = {
  users: { title: 'Users', search: ['name', 'mobile'], filter: 'roleId', columns: ['name', 'mobile', 'roleId', 'positionId', 'address', 'active'] },
  roles: { title: 'Roles', search: ['name'], columns: ['name'] },
  positions: { title: 'Positions', search: ['name'], columns: ['name'] },
  statuses: { title: 'Status', search: ['name'], columns: ['name'] },
  tasks: { title: 'Tasks', search: ['title'], filter: 'statusId', columns: ['title', 'description', 'assigneeId', 'createdBy', 'statusId', 'due', 'comments'] },
};

const LABELS: Record<string, string> = {
  name: 'Name',
  mobile: 'Mobile',
  roleId: 'Role',
  positionId: 'Position',
  address: 'Address',
  active: 'Status',
  title: 'Task',
  description: 'Description',
  assigneeId: 'Assigned to',
  createdBy: 'Assigned by',
  statusId: 'Status',
  due: 'Due',
  comments: 'Comments',
};

const PAGE_FIELDS: Record<Page, Field[]> = {
  users: [
    { name: 'name', label: 'Name', required: true },
    { name: 'mobile', label: 'Mobile', required: true },
    { name: 'roleId', label: 'Role', kind: 'select', options: 'roles', required: true },
    { name: 'positionId', label: 'Position', kind: 'select', options: 'positions', required: true },
    { name: 'address', label: 'Address', kind: 'textarea' },
    { name: 'password', label: 'Password', kind: 'password', required: true },
    { name: 'active', label: 'Active', kind: 'checkbox' },
  ],
  roles: [{ name: 'name', label: 'Role name', required: true }],
  positions: [{ name: 'name', label: 'Position name', required: true }],
  statuses: [{ name: 'name', label: 'Status name', required: true }],
  tasks: [
    { name: 'title', label: 'Task name', required: true },
    { name: 'description', label: 'Description', kind: 'textarea' },
    { name: 'assigneeId', label: 'Assign to', kind: 'select', options: 'users', required: true },
    { name: 'statusId', label: 'Status', kind: 'select', options: 'statuses', required: true },
    { name: 'due', label: 'Due date', kind: 'date' },
  ],
};

function isTask(row: Row): row is TaskRow {
  return 'title' in row;
}

function isUser(row: Row): row is UserRow {
  return 'mobile' in row;
}

function getEntity(page: Page): string {
  return page;
}

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('tms') || '');
  const tokenRef = useRef(token);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState<Page>('tasks');
  const [lookups, setLookups] = useState<Lookups>({ roles: [], positions: [], statuses: [], users: [] });
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [pendingRequests, setPendingRequests] = useState(0);
  const pendingRef = useRef(0);
  const initialAuthStarted = useRef(false);
  const [notice, setNotice] = useState('');
  const [loginError, setLoginError] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [commentTaskId, setCommentTaskId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const searchTimer = useRef<number | undefined>(undefined);

  const api = useCallback(async <T,>(path: string, method = 'GET', body?: unknown, authToken = tokenRef.current): Promise<T> => {
    pendingRef.current += 1;
    setPendingRequests(pendingRef.current);
    try {
      const response = await fetch(`/api/${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (response.status === 401 && authToken) logout();
      if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
      return result as T;
    } finally {
      pendingRef.current = Math.max(0, pendingRef.current - 1);
      setPendingRequests(pendingRef.current);
    }
  }, []);

  const logout = useCallback(() => {
    tokenRef.current = '';
    sessionStorage.removeItem('tms');
    setToken('');
    setMe(null);
    setReady(false);
    setRows([]);
    setLookups({ roles: [], positions: [], statuses: [], users: [] });
    setModal(null);
    setCommentTaskId(null);
  }, []);

  const initialize = useCallback(async (authToken: string) => {
    try {
      const currentUser = await api<CurrentUser>('me', 'GET', undefined, authToken);
      const [roles, positions, statuses, users] = await Promise.all([
        api<LookupItem[]>('roles', 'GET', undefined, authToken),
        api<LookupItem[]>('positions', 'GET', undefined, authToken),
        api<LookupItem[]>('statuses', 'GET', undefined, authToken),
        api<LookupItem[]>('lookup/users', 'GET', undefined, authToken),
      ]);
      setMe(currentUser);
      setLookups({ roles, positions, statuses, users });
      setPage(currentUser.role.toLowerCase() === 'admin' ? 'users' : 'tasks');
      setReady(true);
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to load the application');
      logout();
    }
  }, [api, logout]);

  useEffect(() => {
    if (token && !initialAuthStarted.current) {
      initialAuthStarted.current = true;
      void initialize(token);
    }
  }, []);

  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  useEffect(() => {
    if (!ready || !token) return;
    window.clearTimeout(searchTimer.current);
    let cancelled = false;
    searchTimer.current = window.setTimeout(() => {
      const config = PAGE_CONFIG[page];
      const query = new URLSearchParams({ q: search });
      if (filter && config.filter) query.set(config.filter, filter);
      void api<Row[]>(`${getEntity(page)}?${query.toString()}`)
        .then(result => {
          if (!cancelled) setRows(result);
        })
        .catch(error => {
          if (!cancelled) setNotice(error instanceof Error ? error.message : 'Unable to load records');
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(searchTimer.current);
    };
  }, [api, filter, page, ready, reloadKey, search, token]);

  const refreshLookups = async () => {
    const [roles, positions, statuses, users] = await Promise.all([
      api<LookupItem[]>('roles'),
      api<LookupItem[]>('positions'),
      api<LookupItem[]>('statuses'),
      api<LookupItem[]>('lookup/users'),
    ]);
    setLookups({ roles, positions, statuses, users });
  };

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setLoginError('');
    try {
      const result = await api<{ token: string }>('login', 'POST', {
        mobile: String(data.get('mobile') || ''),
        password: String(data.get('password') || ''),
      }, '');
      tokenRef.current = result.token;
      sessionStorage.setItem('tms', result.token);
      setToken(result.token);
      await initialize(result.token);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Unable to sign in');
    }
  }

  function navigate(nextPage: Page) {
    setPage(nextPage);
    setSearch('');
    setFilter('');
    setRows([]);
    setNotice('');
  }

  function openModal(id: string | null = null) {
    setNotice('');
    setModal({ id });
  }

  async function submitRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const values: Record<string, unknown> = {};
    const fields = PAGE_FIELDS[page].filter(field => !(page === 'tasks' && field.name === 'assigneeId' && !isAdmin && !isManager));
    for (const field of fields) {
      if (field.kind === 'checkbox') values[field.name] = formData.has(field.name);
      else if (formData.has(field.name)) values[field.name] = String(formData.get(field.name) || '').trim();
    }

    try {
      const path = modal.id ? `${page}/${modal.id}` : page;
      await api(path, modal.id ? 'PUT' : 'POST', values);
      setModal(null);
      setNotice('');
      if (page !== 'tasks') await refreshLookups();
      setReloadKey(value => value + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to save');
    }
  }

  async function deleteRecord(id: string) {
    if (!window.confirm('Delete this record?')) return;
    try {
      await api(`${page}/${id}`, 'DELETE');
      setNotice('');
      if (page !== 'tasks') await refreshLookups();
      setReloadKey(value => value + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to delete');
    }
  }

  async function updateStatus(id: string, statusId: string) {
    try {
      await api(`tasks/${id}/status`, 'PATCH', { statusId });
      setRows(current => current.map(row => isTask(row) && row.id === id ? { ...row, statusId } : row));
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to update task status');
    }
  }

  async function addComment(event: FormEvent<HTMLFormElement>, taskId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const text = String(formData.get('comment') || '').trim();
    if (!text) return;
    try {
      await api(`tasks/${taskId}/comments`, 'POST', { comment: text });
      setReloadKey(value => value + 1);
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to add comment');
    }
  }

  const isAdmin = me?.role.toLowerCase() === 'admin';
  const isManager = me?.role.toLowerCase() === 'manager';
  const navPages: Page[] = isAdmin ? ['users', 'roles', 'positions', 'tasks', 'statuses'] : ['tasks'];
  const config = PAGE_CONFIG[page];
  const currentModalRow = modal?.id ? rows.find(row => row.id === modal.id) : undefined;
  const commentTask = commentTaskId ? rows.find(row => isTask(row) && row.id === commentTaskId) as TaskRow | undefined : undefined;
  const canEdit = page !== 'tasks' || isAdmin || isManager;

  function lookupName(kind: keyof Lookups, id: string | null | undefined) {
    return lookups[kind].find(item => item.id === id)?.name || '—';
  }

  function renderCell(row: Row, column: string) {
    if (column === 'active' && isUser(row)) {
      return <span className={`badge ${row.active ? '' : 'off'}`}>{row.active ? 'Active' : 'Inactive'}</span>;
    }
    if (column === 'roleId' && isUser(row)) return lookupName('roles', row.roleId);
    if (column === 'positionId' && isUser(row)) return lookupName('positions', row.positionId);
    if (column === 'assigneeId' && isTask(row)) return lookupName('users', row.assigneeId);
    if (column === 'createdBy' && isTask(row)) return lookupName('users', row.createdBy);
    if (column === 'statusId' && isTask(row)) {
      return <select aria-label="Task status" value={row.statusId} onChange={event => void updateStatus(row.id, event.target.value)}>
        {lookups.statuses.map(status => <option key={status.id} value={status.id}>{status.name}</option>)}
      </select>;
    }
    if (column === 'comments' && isTask(row)) {
      return <button type="button" onClick={() => setCommentTaskId(row.id)}>View comments ({row.comments?.length || 0})</button>;
    }
    if (column === 'name' && !isTask(row) && !isUser(row)) return row.name;
    if (column === 'name' && isUser(row)) return row.name;
    if (column === 'mobile' && isUser(row)) return row.mobile;
    if (column === 'address' && isUser(row)) return row.address || '—';
    if (column === 'title' && isTask(row)) return row.title;
    if (column === 'description' && isTask(row)) return row.description || '—';
    if (column === 'due' && isTask(row)) return row.due || '—';
    return '—';
  }

  function renderField(field: Field) {
    const row = currentModalRow;
    const value = row && field.name in row ? String((row as unknown as Record<string, unknown>)[field.name] ?? '') : '';
    if (field.kind === 'checkbox') {
      const active = row && isUser(row) ? row.active : !modal?.id;
      return <label className="checkbox-field" key={field.name}><input name={field.name} type="checkbox" defaultChecked={active} /> {field.label}</label>;
    }
    if (field.kind === 'select') {
      const options = field.options ? lookups[field.options] : [];
      const initial = value || (field.name === 'statusId' ? lookups.statuses[0]?.id : field.name === 'assigneeId' ? me?.id : '');
      return <div className="form-field" key={field.name}>
        <label htmlFor={`field-${field.name}`}>{field.label}</label>
        <select id={`field-${field.name}`} name={field.name} defaultValue={initial} required={field.required}>
          <option value="" disabled>Select {field.label.toLowerCase()}</option>
          {options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </div>;
    }
    if (field.kind === 'textarea') {
      return <div className="form-field" key={field.name}><label htmlFor={`field-${field.name}`}>{field.label}</label><textarea id={`field-${field.name}`} name={field.name} rows={3} defaultValue={value} /></div>;
    }
    const inputType = field.kind === 'password' ? 'password' : field.kind === 'date' ? 'date' : 'text';
    return <div className="form-field" key={field.name}>
      <label htmlFor={`field-${field.name}`}>{field.label}{field.kind === 'password' && modal?.id ? ' (leave blank to keep)' : ''}</label>
      <input id={`field-${field.name}`} name={field.name} type={inputType} defaultValue={field.kind === 'password' ? '' : value} required={field.required && !(field.kind === 'password' && modal?.id)} />
    </div>;
  }

  if (!me) {
    return <div className="login-page">
      {pendingRequests > 0 && <LoadingIndicator />}
      <form className="login" onSubmit={submitLogin}>
        <img className="login-logo" src="/Bhima.png" alt="Bhima logo" />
        <h2>Task Manager</h2>
        <label htmlFor="login-mobile">Mobile</label>
        <input id="login-mobile" name="mobile" required autoComplete="username" />
        <label htmlFor="login-password">Password</label>
        <input id="login-password" name="password" type="password" required autoComplete="current-password" />
        {loginError && <div className="error-message" role="alert">{loginError}</div>}
        <button className="primary login-submit" disabled={pendingRequests > 0}>Sign in</button>
      </form>
    </div>;
  }

  const modalTitle = `${modal?.id ? 'Edit' : 'Add'} ${config.title.replace(/s$/, '')}`;
  const fields = PAGE_FIELDS[page].filter(field => !(page === 'tasks' && field.name === 'assigneeId' && !isAdmin && !isManager));

  return <div className="app">
    {pendingRequests > 0 && <LoadingIndicator />}
    <nav className="sidebar">
      <img className="menu-logo" src="/Bhima.png" alt="Bhima logo" />
      <h3>Task Manager</h3>
      {navPages.map(item => <button key={item} className={`nav-button ${item === page ? 'active' : ''}`} onClick={() => navigate(item)}>{PAGE_CONFIG[item].title}</button>)}
    </nav>
    <main>
      <div className="top"><div><b>{me.name}</b> <span className="badge">{me.role}</span></div><button onClick={logout}>Logout</button></div>
      <div className="top"><h2>{config.title}</h2>{(page !== 'tasks' || isAdmin || isManager) && <button className="primary" onClick={() => openModal()}>+ {page === 'users' ? 'Add User' : `New ${config.title.replace(/s$/, '')}`}</button>}</div>
      {notice && <div className="notice" role="alert"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}
      <div className="toolbar">
        <input aria-label={`Search ${config.search.join(' or ')}`} placeholder={`Search ${config.search.join(' / ')}`} value={search} onChange={event => setSearch(event.target.value)} />
        {config.filter && <select aria-label={`Filter by ${config.filter === 'roleId' ? 'role' : 'status'}`} value={filter} onChange={event => setFilter(event.target.value)}>
          <option value="">All {config.filter === 'roleId' ? 'roles' : 'statuses'}</option>
          {(config.filter === 'roleId' ? lookups.roles : lookups.statuses).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>}
      </div>
      <div className="table-wrap"><table><thead><tr>{config.columns.map(column => <th key={column}>{LABELS[column]}</th>)}<th /></tr></thead>
        <tbody>
          {rows.map(row => <tr key={row.id}>
            {config.columns.map(column => <td key={column} className={page === 'tasks' && column === 'description' ? 'task-description-cell' : undefined}>{renderCell(row, column)}</td>)}
            <td className="row-actions">
              {canEdit && <button onClick={() => openModal(row.id)}>Edit</button>}
              {(page !== 'tasks' || isAdmin) && <button className="danger" onClick={() => void deleteRecord(row.id)}>Delete</button>}
            </td>
          </tr>)}
          {rows.length === 0 && <tr><td className="empty-cell" colSpan={config.columns.length + 1}>{pendingRequests > 0 ? 'Loading…' : 'No records found'}</td></tr>}
        </tbody>
      </table></div>

    {modal && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null); }}>
      <form className="modal-form" onSubmit={submitRecord}>
        <h3>{modalTitle}</h3>
        {fields.map(renderField)}
        <div className="form-actions"><button type="button" onClick={() => setModal(null)}>Cancel</button><button className="primary" disabled={pendingRequests > 0}>Save</button></div>
      </form>
    </div>}

    {commentTask && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setCommentTaskId(null); }}>
      <div className="modal-form comments-modal">
        <div className="modal-heading"><h3>Comments: {commentTask.title}</h3><button type="button" onClick={() => setCommentTaskId(null)}>Close</button></div>
        <div className="comment-list">
          {(commentTask.comments || []).map((comment, index) => <div className="comment-item" key={`${comment.userId}-${comment.createdAt}-${index}`}>
            <div className="comment-meta"><b>{comment.userName}</b> · {new Date(comment.createdAt).toLocaleString()}</div>
            {comment.text}
          </div>)}
          {commentTask.comments.length === 0 && <div className="empty-cell">No comments yet</div>}
        </div>
        {(isAdmin || isManager || commentTask.assigneeId === me.id) && <form onSubmit={event => void addComment(event, commentTask.id)}>
          <label htmlFor="task-comment">Add comment</label>
          <div className="comment-form"><input id="task-comment" name="comment" placeholder="Write a comment" required /><button className="primary" disabled={pendingRequests > 0}>Send</button></div>
        </form>}
      </div>
    </div>}
  </main>
  </div>;
}

function LoadingIndicator() {
  return <div className="loading-indicator" role="status" aria-live="polite"><span className="loading-spinner" />Loading…</div>;
}

export default App;
