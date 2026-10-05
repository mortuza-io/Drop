import { useRef, useState } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Download, Share2, Plus, Lock, Clock, Hash } from 'lucide-react';
import type { FileRecord } from '@/lib/types';
import { formatFileSize, formatTimeRemaining } from '@/lib/utils';
import { getFileIcon } from '@/lib/fileType';

interface ShareViewProps {
  file: FileRecord;
  onNew: () => void;
}

export default function ShareView({ file, onNew }: ShareViewProps) {
  const [copied, setCopied] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const shareUrl = `${window.location.origin}/?code=${file.download_code}`;
  const Icon = getFileIcon(file.filename);
  const canShare = typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link', shareUrl);
    }
  };

  const saveQR = () => {
    const canvas = exportRef.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `drop-${file.download_code}.png`;
    a.click();
  };

  const share = async () => {
    try {
      await navigator.share({ title: file.filename, url: shareUrl });
    } catch {
      /* dismissed */
    }
  };

  return (
    <div className="space-y-4 stagger">
      <div className="text-center pt-2 pb-2">
        <div className="w-12 h-12 mx-auto rounded-full bg-accent text-accent-ink flex items-center justify-center animate-pop">
          <Check className="w-6 h-6" strokeWidth={2.5} />
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-fg">Your file is live</h2>
        <p className="mt-1 text-sm text-muted">Scan the code or send the link</p>
      </div>

      <div className="card p-6">
        <div className="mx-auto w-fit p-4 rounded-2xl bg-white">
          <QRCodeSVG value={shareUrl} size={184} level="M" bgColor="#ffffff" fgColor="#0c0c0e" marginSize={0} />
        </div>
        <div ref={exportRef} className="hidden">
          <QRCodeCanvas value={shareUrl} size={1024} level="M" bgColor="#ffffff" fgColor="#0c0c0e" marginSize={4} />
        </div>

        <div className="mt-6 flex items-center gap-2 p-1.5 pl-4 rounded-2xl bg-raised border border-line">
          <span className="flex-1 min-w-0 truncate text-xs font-mono text-muted select-all">{shareUrl.replace(/^https?:\/\//, '')}</span>
          <button onClick={copy} className="btn-primary h-9 px-4 text-sm rounded-xl">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className={`mt-2 grid gap-2 ${canShare ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button onClick={saveQR} className="btn-ghost h-10 text-sm">
            <Download className="w-4 h-4" /> Save QR
          </button>
          {canShare && (
            <button onClick={share} className="btn-ghost h-10 text-sm">
              <Share2 className="w-4 h-4" /> Share
            </button>
          )}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-raised border border-line flex items-center justify-center">
            <Icon className="w-4 h-4 text-accent-text" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg truncate">{file.filename}</p>
            <p className="text-xs text-subtle font-mono">{formatFileSize(file.file_size)}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Tag icon={<Clock className="w-3 h-3" />}>
            {file.expires_at ? formatTimeRemaining(file.expires_at) : 'Never expires'}
          </Tag>
          <Tag icon={<Hash className="w-3 h-3" />}>
            {file.max_downloads ? `${file.max_downloads} download${file.max_downloads > 1 ? 's' : ''}` : 'Unlimited'}
          </Tag>
          {file.has_password && <Tag icon={<Lock className="w-3 h-3" />}>Password</Tag>}
        </div>
      </div>

      <button onClick={onNew} className="w-full h-11 flex items-center justify-center gap-2 text-sm text-muted hover:text-fg transition-colors">
        <Plus className="w-4 h-4" /> Send another file
      </button>
    </div>
  );
}

function Tag({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-raised border border-line text-2xs font-mono text-muted">
      <span className="text-accent-text">{icon}</span>
      {children}
    </span>
  );
}
