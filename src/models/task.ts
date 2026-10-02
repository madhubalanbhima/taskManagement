import { model, Schema, Types } from 'mongoose';

export interface TaskRecord {
  title: string;
  description: string;
  assigneeId: Types.ObjectId | null;
  statusId: Types.ObjectId;
  due: string;
  createdBy: Types.ObjectId;
  comments: TaskComment[];
}

export interface TaskComment {
  userId: Types.ObjectId;
  userName: string;
  text: string;
  createdAt: Date;
}

const commentSchema = new Schema<TaskComment>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  text: { type: String, required: true, trim: true },
  createdAt: { type: Date, required: true, default: Date.now },
}, { _id: false });

const schema = new Schema<TaskRecord>({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  statusId: { type: Schema.Types.ObjectId, ref: 'Status', required: true },
  due: { type: String, default: '' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  comments: { type: [commentSchema], default: [] },
});

export const Task = model<TaskRecord>('Task', schema);
