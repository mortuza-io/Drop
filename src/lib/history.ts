import type { SavedUpload } from '@/lib/types';

const KEY = 'drop-uploads-v2';
const LIMIT = 50;

export function getSavedUploads(): SavedUpload[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (u): u is SavedUpload => !!u && typeof u.code === 'string' && typeof u.ownerToken === 'string'
    );
  } catch {
    return [];
  }
}

export function setSavedUploads(list: SavedUpload[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, LIMIT)));
}

export function saveUpload(upload: SavedUpload) {
  setSavedUploads([upload, ...getSavedUploads().filter((u) => u.code !== upload.code)]);
}

export function forgetUpload(code: string) {
  setSavedUploads(getSavedUploads().filter((u) => u.code !== code));
}

export function findUpload(code: string) {
  return getSavedUploads().find((u) => u.code === code);
}
