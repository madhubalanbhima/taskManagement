import { model, Schema } from 'mongoose';

export interface CatalogRecord {
  name: string;
}

const schema = new Schema<CatalogRecord>({
  name: { type: String, required: true, unique: true, trim: true },
});

export const Role = model<CatalogRecord>('Role', schema);
export const Position = model<CatalogRecord>('Position', schema);
export const Status = model<CatalogRecord>('Status', schema);
