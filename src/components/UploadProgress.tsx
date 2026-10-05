import { Check } from 'lucide-react';
import { formatDuration, formatFileSize } from '@/lib/utils';
import type { UploadProgressInfo } from '@/lib/upload';

interface UploadProgressProps {
  filename: string;
  info: UploadProgressInfo;
  stage: 'uploading' | 'finishing' | 'done';
  onCancel: () => void;
}

export default function UploadProgress({ filename, info, stage, onCancel }: UploadProgressProps) {
  const pct = stage === 'done' ? 100 : info.total ? Math.min(99, (info.loaded / info.total) * 100) : 0;
  const eta = info.speed > 0 ? (info.total - info.loaded) / info.speed : Infinity;
  const r = 52;
  const circ = 2 * Math.PI * r;

  return (
    <div className="card p-8 text-center animate-fade-up">
      <div className="relative w-36 h-36 mx-auto">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" strokeWidth="6" className="stroke-raised" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            className="stroke-accent transition-[stroke-dashoffset] duration-500 ease-smooth"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct / 100)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {stage === 'done' ? (
            <div className="w-14 h-14 rounded-full bg-accent text-accent-ink flex items-center justify-center animate-pop">
              <Check className="w-7 h-7" strokeWidth={2.5} />
            </div>
          ) : (
            <span className="text-3xl font-semibold tabular-nums text-fg">
              {Math.floor(pct)}
              <span className="text-base text-subtle">%</span>
            </span>
          )}
        </div>
      </div>

      <p className="mt-6 text-base font-medium text-fg">
        {stage === 'uploading' ? 'Uploading' : stage === 'finishing' ? 'Creating your link' : 'Done'}
      </p>
      <p className="mt-1 text-xs text-subtle font-mono truncate max-w-[260px] mx-auto">{filename}</p>

      <div className="mt-6 grid grid-cols-3 gap-2 text-left">
        {[
          ['Sent', `${formatFileSize(info.loaded)}`],
          ['Speed', info.speed ? `${formatFileSize(info.speed)}/s` : '--'],
          ['Left', stage === 'uploading' ? formatDuration(eta) : '0s'],
        ].map(([label, val]) => (
          <div key={label} className="rounded-2xl bg-raised border border-line px-3 py-2.5">
            <p className="text-2xs text-subtle">{label}</p>
            <p className="text-xs font-mono text-fg mt-0.5 truncate">{val}</p>
          </div>
        ))}
      </div>

      {stage === 'uploading' && (
        <button onClick={onCancel} className="mt-6 text-xs text-muted hover:text-danger transition-colors">
          Cancel upload
        </button>
      )}
    </div>
  );
}
