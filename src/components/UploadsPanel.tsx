import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Clock, Copy, FolderOpen, Hash, Inbox, Lock, QrCode, Trash2, X, CalendarDays } from 'lucide-react';
import type { FileRecord } from '@/lib/types';
import { formatFileSize, formatTimeRemaining } from '@/lib/utils';
import { getFileIcon } from '@/lib/fileType';
import { findUpload, forgetUpload, getSavedUploads, setSavedUploads } from '@/lib/history';
import { deleteUpload, listUploads } from '@/lib/api';

interface UploadsPanelProps {
  onOpen: (file: FileRecord) => void;
  onError: (message: string) => void;
}

function statusOf(f: FileRecord) {
  if (f.expires_at && new Date(f.expires_at) < new Date()) return { label: 'Expired', live: false };
  if (f.max_downloads !== null && f.download_count >= f.max_downloads) return { label: 'Limit reached', live: false };
  return { label: f.expires_at ? formatTimeRemaining(f.expires_at) : 'No expiry', live: true };
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function UploadsPanel({ onOpen, onError }: UploadsPanelProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<FileRecord[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const count = open && files ? files.length : getSavedUploads().length;

  const load = useCallback(async () => {
    const saved = getSavedUploads();
    if (saved.length === 0) return setFiles([]);
    try {
      const found = await listUploads(saved);
      const byCode = new Map(found.map((f) => [f.download_code, f]));
      const kept = saved.filter((s) => byCode.has(s.code));
      if (kept.length !== saved.length) setSavedUploads(kept);
      setFiles(kept.map((s) => byCode.get(s.code)!));
    } catch {
      setFiles([]);
      onError('Could not load your uploads.');
    }
  }, [onError]);

  useEffect(() => {
    if (!open) return;
    setFiles(null);
    load();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, load]);

  const close = () => {
    setOpen(false);
    setExpanded(null);
    setConfirming(null);
  };

  const copy = async (f: FileRecord) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?code=${f.download_code}`);
      setCopied(f.download_code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      onError('Could not copy the link.');
    }
  };

  const remove = async (f: FileRecord) => {
    setConfirming(null);
    const saved = findUpload(f.download_code);
    if (!saved) return;
    try {
      await deleteUpload(saved);
    } catch {
      return onError('Could not delete this file. Please try again.');
    }
    forgetUpload(f.download_code);
    setFiles((list) => list?.filter((x) => x.download_code !== f.download_code) ?? null);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative h-8 pl-3 pr-3.5 rounded-full bg-raised border border-line flex items-center gap-2 text-xs font-medium text-muted hover:text-fg hover:border-subtle/50 transition-colors"
      >
        <FolderOpen className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Your uploads</span>
        {count > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-ink text-2xs font-semibold font-mono flex items-center justify-center">
            {count}
          </span>
        )}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Your uploads">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={close} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-surface border-l border-line shadow-card flex flex-col animate-slide-in">
            <header className="flex items-center justify-between px-6 h-20 border-b border-line flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-fg">Your uploads</h2>
                <p className="text-2xs text-subtle font-mono">Remembered in this browser</p>
              </div>
              <button
                onClick={close}
                aria-label="Close"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-muted hover:text-fg hover:bg-raised transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
              {files === null && (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-16 rounded-2xl bg-raised animate-pulse" />
                  ))}
                </div>
              )}

              {files?.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-6">
                  <div className="w-14 h-14 rounded-2xl bg-raised border border-line flex items-center justify-center">
                    <Inbox className="w-6 h-6 text-subtle" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-fg">Nothing here yet</p>
                  <p className="mt-1 text-xs text-muted">Files you upload from this browser will show up here.</p>
                </div>
              )}

              {files && files.length > 0 && (
                <ul className="space-y-2">
                  {files.map((f) => {
                    const Icon = getFileIcon(f.filename);
                    const status = statusOf(f);
                    const isOpen = expanded === f.download_code;
                    return (
                      <li
                        key={f.download_code}
                        className={`rounded-2xl border transition-colors ${isOpen ? 'border-subtle/40 bg-raised/60' : 'border-line hover:bg-raised/40'}`}
                      >
                        <button
                          onClick={() => {
                            setExpanded(isOpen ? null : f.download_code);
                            setConfirming(null);
                          }}
                          aria-expanded={isOpen}
                          className="w-full flex items-center gap-3 p-3 text-left"
                        >
                          <span className={`w-10 h-10 flex-shrink-0 rounded-xl border border-line bg-raised flex items-center justify-center ${status.live ? '' : 'opacity-50'}`}>
                            <Icon className={`w-4 h-4 ${status.live ? 'text-accent-text' : 'text-subtle'}`} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`flex items-center gap-1.5 text-sm font-medium ${status.live ? 'text-fg' : 'text-muted'}`}>
                              <span className="truncate">{f.filename}</span>
                              {f.has_password && <Lock className="w-3 h-3 flex-shrink-0 text-subtle" />}
                            </span>
                            <span className="flex items-center gap-2 text-2xs font-mono text-subtle">
                              {formatFileSize(f.file_size)}
                              <span className="w-0.5 h-0.5 rounded-full bg-subtle" />
                              <span className={status.live ? '' : 'text-danger'}>{status.label}</span>
                            </span>
                          </span>
                          <ChevronDown className={`w-4 h-4 text-subtle transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isOpen && (
                          <div className="px-3 pb-3 animate-fade-up">
                            <dl className="grid grid-cols-2 gap-2 text-xs">
                              <Detail icon={<CalendarDays className="w-3 h-3" />} label="Uploaded" value={formatDate(f.created_at)} />
                              <Detail
                                icon={<Clock className="w-3 h-3" />}
                                label={status.live ? 'Deletes' : 'Status'}
                                value={status.live && f.expires_at ? formatDate(f.expires_at) : status.label}
                              />
                              <Detail
                                icon={<Hash className="w-3 h-3" />}
                                label="Downloads"
                                value={`${f.download_count}${f.max_downloads !== null ? ` of ${f.max_downloads}` : ''}`}
                              />
                              <Detail icon={<Lock className="w-3 h-3" />} label="Password" value={f.has_password ? 'On' : 'Off'} />
                            </dl>

                            {confirming === f.download_code ? (
                              <div className="mt-3 flex items-center gap-2 p-2 pl-3 rounded-xl border border-danger/30 bg-danger/5 animate-pop">
                                <p className="flex-1 text-xs text-fg">Delete this file for everyone?</p>
                                <button onClick={() => setConfirming(null)} className="h-8 px-3 rounded-lg text-xs text-muted hover:text-fg">
                                  Keep
                                </button>
                                <button onClick={() => remove(f)} className="h-8 px-3 rounded-lg bg-danger text-white text-xs font-medium hover:opacity-90">
                                  Delete
                                </button>
                              </div>
                            ) : (
                              <div className="mt-3 flex gap-2">
                                {status.live && (
                                  <>
                                    <button
                                      onClick={() => {
                                        close();
                                        onOpen(f);
                                      }}
                                      className="btn-primary flex-1 h-9 text-xs rounded-xl"
                                    >
                                      <QrCode className="w-3.5 h-3.5" /> Show QR
                                    </button>
                                    <button onClick={() => copy(f)} className="btn-ghost flex-1 h-9 text-xs rounded-xl">
                                      {copied === f.download_code ? <Check className="w-3.5 h-3.5 text-accent-text" /> : <Copy className="w-3.5 h-3.5" />}
                                      {copied === f.download_code ? 'Copied' : 'Copy link'}
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => setConfirming(f.download_code)}
                                  aria-label="Delete file"
                                  className={`h-9 rounded-xl border border-line flex items-center justify-center gap-1.5 text-xs text-muted hover:text-danger hover:border-danger/40 hover:bg-danger/5 transition-colors ${status.live ? 'w-9' : 'flex-1'}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  {!status.live && 'Delete'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-xl bg-surface border border-line">
      <dt className="flex items-center gap-1.5 text-2xs text-subtle font-mono uppercase tracking-wider">
        <span className="text-accent-text">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 text-fg font-medium truncate">{value}</dd>
    </div>
  );
}
