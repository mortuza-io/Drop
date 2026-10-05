export interface FileRecord {
  download_code: string;
  filename: string;
  file_size: number;
  mime_type: string | null;
  expires_at: string | null;
  max_downloads: number | null;
  download_count: number;
  has_password: boolean;
  created_at: string;
}

export interface SavedUpload {
  code: string;
  ownerToken: string;
}
