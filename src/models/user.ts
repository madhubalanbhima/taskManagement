import { model, Schema, Types } from 'mongoose';

export interface UserRecord {
  name: string;
  mobile: string;
  roleId: Types.ObjectId;
  positionId: Types.ObjectId;
  address: string;
  password: string;
  active: boolean;
}

const schema = new Schema<UserRecord>({
  name: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, unique: true, trim: true },
  roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
  positionId: { type: Schema.Types.ObjectId, ref: 'Position', required: true },
  address: { type: String, default: '' },
  password: { type: String, required: true, select: false },
  active: { type: Boolean, default: true },
});

export const User = model<UserRecord>('User', schema);
