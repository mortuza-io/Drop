import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, AlertCircle, X, SearchX, Heart, Github } from 'lucide-react';
import type { FileRecord } from '@/lib/types';
import { getExpirationHours } from '@/lib/utils';
import { uploadToUrl, type UploadProgressInfo } from '@/lib/upload';
import { createUpload, deleteUpload, finalizeUpload, getFileInfo } from '@/lib/api';
import DropZone from '@/components/DropZone';
import UploadOptions, { type Options } from '@/components/UploadOptions';
import UploadProgress from '@/components/UploadProgress';
import ShareView from '@/components/ShareView';
import DownloadView from '@/components/DownloadView';
import ThemeToggle from '@/components/ThemeToggle';
import UploadsPanel from '@/components/UploadsPanel';
import { saveUpload } from '@/lib/history';

type View = 'loading' | 'upload' | 'uploading' | 'share' | 'download' | 'missing';

const DEFAULT_OPTIONS: Options = {
  expiration: '7d',
  customValue: 3,
  customUnit: 'days',
  maxDownloads: null,
  password: '',
};

const EMPTY_PROGRESS: UploadProgressInfo = { loaded: 0, total: 0, speed: 0 };

export default function App() {
  const initialCode = new URLSearchParams(window.location.search).get('code');
  const [view, setView] = useState<View>(initialCode ? 'loading' : 'upload');
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);
  const [record, setRecord] = useState<FileRecord | null>(null);
  const [progress, setProgress] = useState<UploadProgressInfo>(EMPTY_PROGRESS);
  const [stage, setStage] = useState<'uploading' | 'finishing' | 'done'>('uploading');
  const [error, setError] = useState('');
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!initialCode) return;
    (async () => {
      try {
        setRecord(await getFileInfo(initialCode));
        setView('download');
      } catch {
        setView('missing');
      }
    })();
  }, [initialCode]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(t);
  }, [error]);

  const reset = () => {
    setView('upload');
    setFile(null);
    setRecord(null);
    setOptions(DEFAULT_OPTIONS);
    setProgress(EMPTY_PROGRESS);
    setError('');
    window.history.pushState({}, '', window.location.pathname);
  };

  const openRecent = (f: FileRecord) => {
    setRecord(f);
    setView('share');
    window.history.pushState({}, '', `?code=${f.download_code}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setError('');
    setStage('uploading');
    setProgress({ loaded: 0, total: file.size, speed: 0 });
    setView('uploading');

    let saved: { code: string; ownerToken: string } | null = null;

    try {
      const created = await createUpload({
        filename: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        expiresInHours: getExpirationHours(options.expiration, options.customValue, options.customUnit),
        maxDownloads: options.maxDownloads,
        password: options.password,
      });
      saved = { code: created.code, ownerToken: created.ownerToken };

      const handle = uploadToUrl(created.uploadUrl, file, setProgress);
      cancelRef.current = handle.cancel;
      await handle.promise;
      setStage('finishing');

      const data = await finalizeUpload(saved);
      setStage('done');
      saveUpload(saved);
      setRecord(data);
      window.history.pushState({}, '', `?code=${saved.code}`);
      setTimeout(() => setView('share'), 700);
    } catch (e) {
      if (saved) deleteUpload(saved).catch(() => {});
      const msg = e instanceof Error ? e.message : '';
      setView('upload');
      if (msg !== 'cancelled') setError(msg || 'Something went wrong. Please try again.');
    } finally {
      cancelRef.current = null;
    }
  }, [file, options]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[720px] h-[420px] rounded-full bg-accent/[0.07] blur-3xl animate-drift" />
        <div className="absolute inset-0 bg-[linear-gradient(rgb(var(--line)/0.35)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--line)/0.35)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
      </div>

      <header className="relative z-10 max-w-5xl mx-auto px-5 sm:px-8 h-20 flex items-center justify-between">
        <button onClick={reset} className="flex items-center gap-2.5 group" aria-label="Drop home">
          <span className="w-8 h-8 rounded-[10px] bg-accent text-accent-ink flex items-center justify-center transition-transform duration-300 ease-spring group-hover:-translate-y-0.5">
            <ArrowUp className="w-4 h-4" strokeWidth={2.75} />
          </span>
          <span className="text-base font-semibold tracking-tight text-fg">drop</span>
        </button>
        <div className="flex items-center gap-2">
          <UploadsPanel onOpen={openRecent} onError={setError} />
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 max-w-[440px] mx-auto px-5 pt-6 pb-16 sm:pt-10">
        {view === 'loading' && (
          <div className="card p-8 flex flex-col items-center gap-4 animate-fade-up">
            <div className="w-16 h-16 rounded-3xl bg-raised animate-pulse" />
            <div className="h-4 w-40 rounded bg-raised animate-pulse" />
            <div className="h-3 w-20 rounded bg-raised animate-pulse" />
            <div className="h-12 w-full rounded-2xl bg-raised animate-pulse mt-4" />
          </div>
        )}

        {view === 'missing' && (
          <div className="card p-8 text-center animate-fade-up">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-raised border border-line flex items-center justify-center">
              <SearchX className="w-6 h-6 text-muted" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-fg">Link not found</h2>
            <p className="mt-1 text-sm text-muted">This file may have been removed, or the link is incomplete.</p>
            <button onClick={reset} className="btn-primary w-full h-11 mt-6 text-sm">Send a file instead</button>
          </div>
        )}

        {view === 'upload' && (
          <div className="stagger space-y-4">
            <div className="text-center pb-4">
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-fg leading-[1.1]">
                Send files.
                <br />
                <span className="text-accent-text">Leave no trace.</span>
              </h1>
              <p className="mt-4 text-sm text-muted max-w-[300px] mx-auto">
                Drop anything up to 100 MB. Get a link and QR code. It deletes itself when you say so.
              </p>
            </div>

            <DropZone file={file} onChange={setFile} onReject={setError} />
            <UploadOptions value={options} onChange={setOptions} />

            <button onClick={handleUpload} disabled={!file} className="btn-primary w-full h-14 text-[15px]">
              <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
              {file ? 'Upload and get link' : 'Choose a file to start'}
            </button>
          </div>
        )}

        {view === 'uploading' && file && (
          <UploadProgress filename={file.name} info={progress} stage={stage} onCancel={() => cancelRef.current?.()} />
        )}

        {view === 'share' && record && <ShareView file={record} onNew={reset} />}
        {view === 'download' && record && <DownloadView file={record} onNew={reset} />}
      </main>

      <footer className="relative z-10 pb-8 flex flex-col items-center gap-3 text-2xs font-mono text-subtle">
        <span>Files auto-delete on schedule &middot; No account needed</span>
        <a
          href="https://github.com/mortuza-io"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line bg-surface/60 text-muted hover:text-fg hover:border-subtle/50 transition-colors"
        >
          Built with
          <Heart className="w-3 h-3 fill-danger text-danger transition-transform duration-300 group-hover:scale-125" />
          by
          <span className="inline-flex items-center gap-1 text-fg">
            <Github className="w-3 h-3" />
            mortuza-io
          </span>
        </a>
      </footer>

      {error && (
        <div
          role="alert"
          className="fixed z-50 bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-sm card px-4 py-3 flex items-center gap-3 animate-fade-up"
        >
          <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
          <p className="flex-1 text-sm text-fg">{error}</p>
          <button onClick={() => setError('')} aria-label="Dismiss" className="text-subtle hover:text-fg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
