import type { FileRecord, SavedUpload } from '@/lib/types';

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/files`;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new ApiError(0, 'Network error. Check your connection and try again.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || typeof body !== 'object') {
    const message = body && typeof body.error === 'string' ? body.error : 'Something went wrong. Please try again.';
    throw new ApiError(res.status, message);
  }
  return body as T;
}

function isFileRecord(v: unknown): v is FileRecord {
  const f = v as FileRecord;
  return !!f && typeof f.download_code === 'string' && typeof f.filename === 'string' && typeof f.file_size === 'number';
}

function expectFile(v: unknown): FileRecord {
  if (!isFileRecord(v)) throw new ApiError(500, 'Something went wrong. Please try again.');
  return v;
}

export interface CreateInput {
  filename: string;
  size: number;
  mimeType: string;
  expiresInHours: number;
  maxDownloads: number | null;
  password: string;
}

export async function createUpload(input: CreateInput) {
  const res = await call<{ code: string; ownerToken: string; uploadUrl: string }>('create', { ...input });
  if (!res.code || !res.ownerToken || !res.uploadUrl) throw new ApiError(500, 'Could not start the upload.');
  return res;
}

export async function finalizeUpload(saved: SavedUpload) {
  return expectFile(await call('finalize', { ...saved }));
}

export async function getFileInfo(code: string) {
  return expectFile(await call('info', { code }));
}

export async function requestDownload(code: string, password: string) {
  const res = await call<{ url: string; download_count: number }>('download', { code, password });
  if (typeof res.url !== 'string' || typeof res.download_count !== 'number') throw new ApiError(500, 'The download failed.');
  return res;
}

export async function listUploads(items: SavedUpload[]) {
  const res = await call<{ files: unknown[] }>('list', { items });
  return Array.isArray(res.files) ? res.files.filter(isFileRecord) : [];
}

export async function deleteUpload(saved: SavedUpload) {
  await call('delete', { ...saved });
}
