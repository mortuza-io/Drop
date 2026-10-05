import { useState } from 'react';
import { Download, Lock, Clock, Hash, Check, AlertCircle, Eye, EyeOff, Plus } from 'lucide-react';
import type { FileRecord } from '@/lib/types';
import { formatFileSize, formatTimeRemaining } from '@/lib/utils';
import { requestDownload, ApiError } from '@/lib/api';
import { getExtension, getFileIcon } from '@/lib/fileType';

interface DownloadViewProps {
  file: FileRecord;
  onNew: () => void;
}

export default function DownloadView({ file, onNew }: DownloadViewProps) {
  const [count, setCount] = useState(file.download_count);
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [unlocked, setUnlocked] = useState(!file.has_password);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState('');

  const expired = !!file.expires_at && new Date(file.expires_at) < new Date();
  const limitReached = gone || (file.max_downloads !== null && count >= file.max_downloads);
  const available = !expired && !limitReached;
  const Icon = getFileIcon(file.filename);
  const ext = getExtension(file.filename);

  const handleDownload = async () => {
    setError('');
    if (!unlocked && !password) return setError('Enter the password to continue.');

    setBusy(true);
    try {
      const { url, download_count } = await requestDownload(file.download_code, password);
      setUnlocked(true);
      setCount(download_count);
      const a = document.createElement('a');
      a.href = url;
      a.rel = 'noopener';
      a.click();
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 410 || e.status === 404)) setGone(true);
      setError(e instanceof ApiError ? e.message : 'The download failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 stagger">
      <p className="text-center text-xs font-mono text-subtle uppercase tracking-widest pt-2">Someone sent you a file</p>

      <div className="card p-6 sm:p-8 text-center">
        <div className="relative w-20 h-20 mx-auto rounded-3xl bg-raised border border-line flex items-center justify-center">
          <Icon className="w-8 h-8 text-accent-text" strokeWidth={1.75} />
          {ext && ext.length <= 4 && (
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-accent text-accent-ink text-2xs font-semibold uppercase font-mono">
              {ext}
            </span>
          )}
        </div>
        <h2 className="mt-6 text-lg font-semibold text-fg break-words leading-snug">{file.filename}</h2>
        <p className="mt-1 text-sm text-subtle font-mono">{formatFileSize(file.file_size)}</p>

        {available && (
          <div className="mt-5 flex flex-wrap justify-center gap-2 text-2xs font-mono text-muted">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-raised border border-line">
              <Clock className="w-3 h-3 text-accent-text" />
              {file.expires_at ? formatTimeRemaining(file.expires_at) : 'No expiry'}
            </span>
            {file.max_downloads !== null && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-raised border border-line">
                <Hash className="w-3 h-3 text-accent-text" />
                {file.max_downloads - count} left
              </span>
            )}
          </div>
        )}

        {!available && (
          <div className="mt-6 flex items-start gap-3 text-left p-4 rounded-2xl border border-danger/30 bg-danger/5">
            <AlertCircle className="w-4 h-4 mt-0.5 text-danger flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-fg">{expired ? 'This file has expired' : 'Download limit reached'}</p>
              <p className="text-xs text-muted mt-0.5">
                {expired ? 'It was automatically removed.' : `It could only be downloaded ${file.max_downloads} time${file.max_downloads === 1 ? '' : 's'}.`}{' '}
                Ask the sender for a new link.
              </p>
            </div>
          </div>
        )}

        {available && !unlocked && (
          <div className="mt-6 text-left">
            <label className="flex items-center gap-2 text-sm font-medium text-fg mb-2">
              <Lock className="w-3.5 h-3.5 text-accent-text" /> Password protected
            </label>
            <div className="relative">
              <input
                type={reveal ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
                placeholder="Enter password"
                autoFocus
                className="field pr-10"
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                aria-label={reveal ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-fg transition-colors"
              >
                {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-danger text-left">{error}</p>}

        {available && (
          <button onClick={handleDownload} disabled={busy} className="btn-primary w-full h-12 mt-6 text-sm">
            {busy ? (
              <span className="w-4 h-4 rounded-full border-2 border-accent-ink/30 border-t-accent-ink animate-spin" />
            ) : done ? (
              <Check className="w-4 h-4" strokeWidth={2.5} />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {busy ? 'Preparing...' : done ? 'Downloaded. Get it again' : 'Download'}
          </button>
        )}
      </div>

      <button onClick={onNew} className="w-full h-11 flex items-center justify-center gap-2 text-sm text-muted hover:text-fg transition-colors">
        <Plus className="w-4 h-4" /> Send your own file
      </button>
    </div>
  );
}
