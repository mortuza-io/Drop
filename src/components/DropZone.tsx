import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, X, ClipboardPaste } from 'lucide-react';
import { formatFileSize, MAX_FILE_SIZE } from '@/lib/utils';
import { getExtension, getFileIcon } from '@/lib/fileType';

interface DropZoneProps {
  file: File | null;
  onChange: (file: File | null) => void;
  onReject: (message: string) => void;
}

export default function DropZone({ file, onChange, onReject }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);

  const accept = useCallback(
    (f: File | undefined) => {
      if (!f) return;
      if (f.size === 0) return onReject('That file is empty.');
      if (f.size > MAX_FILE_SIZE) return onReject(`That file is ${formatFileSize(f.size)}. The limit is 100 MB.`);
      onChange(f);
    },
    [onChange, onReject]
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const pasted = e.clipboardData?.files?.[0];
      if (pasted) accept(pasted);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [accept]);

  const prevent = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const clear = () => {
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const Icon = file ? getFileIcon(file.name) : ArrowUp;
  const ext = file ? getExtension(file.name) : '';
  const sizePct = file ? Math.max(2, (file.size / MAX_FILE_SIZE) * 100) : 0;

  return (
    <div
      onDragEnter={(e) => {
        prevent(e);
        depth.current++;
        setDragging(true);
      }}
      onDragLeave={(e) => {
        prevent(e);
        depth.current--;
        if (depth.current <= 0) setDragging(false);
      }}
      onDragOver={prevent}
      onDrop={(e) => {
        prevent(e);
        depth.current = 0;
        setDragging(false);
        accept(e.dataTransfer.files?.[0]);
      }}
      className={`relative overflow-hidden rounded-3xl border transition-all duration-300 ease-smooth
        ${dragging ? 'border-accent shadow-glow scale-[1.01] bg-accent/5' : 'border-line bg-surface hover:border-subtle/40'}`}
    >
      <input ref={inputRef} type="file" className="hidden" onChange={(e) => accept(e.target.files?.[0])} />

      {file ? (
        <div className="p-5 animate-fade-up">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0 w-12 h-12 rounded-2xl bg-raised border border-line flex items-center justify-center">
              <Icon className="w-5 h-5 text-accent-text" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-fg truncate">{file.name}</p>
              <p className="text-xs text-subtle mt-0.5 font-mono">
                {formatFileSize(file.size)}
                {ext && <span className="uppercase"> &middot; {ext}</span>}
              </p>
            </div>
            <button
              onClick={clear}
              aria-label="Remove file"
              className="w-8 h-8 rounded-full flex items-center justify-center text-subtle hover:text-fg hover:bg-raised transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4 h-1 rounded-full bg-raised overflow-hidden" title="Share of the 100 MB limit">
            <div className="h-full bg-accent/70 rounded-full transition-all duration-700 ease-smooth" style={{ width: `${sizePct}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-2xs text-subtle font-mono">
            <span>{Math.round(sizePct)}% of limit</span>
            <button onClick={() => inputRef.current?.click()} className="hover:text-fg transition-colors">
              Replace
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="group w-full flex flex-col items-center justify-center px-8 py-14 sm:py-16 text-center"
        >
          <div className="relative mb-6">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ease-spring
                ${dragging ? 'bg-accent text-accent-ink scale-110' : 'bg-raised border border-line text-fg group-hover:bg-accent group-hover:text-accent-ink group-hover:border-transparent group-hover:-translate-y-1'}`}
            >
              <ArrowUp className="w-6 h-6" strokeWidth={2.25} />
            </div>
            {dragging && <div className="absolute inset-0 rounded-2xl border-2 border-accent animate-ring" />}
          </div>
          <p className="text-base font-medium text-fg">{dragging ? 'Release to drop' : 'Drop a file here'}</p>
          <p className="text-sm text-muted mt-1">
            or <span className="text-accent-text font-medium">browse</span> from your device
          </p>
          <div className="mt-6 flex items-center gap-3 text-2xs text-subtle font-mono">
            <span>Up to 100 MB</span>
            <span className="w-1 h-1 rounded-full bg-line" />
            <span className="hidden sm:inline-flex items-center gap-1">
              <ClipboardPaste className="w-3 h-3" /> Paste works too
            </span>
            <span className="sm:hidden">Any file type</span>
          </div>
        </button>
      )}
    </div>
  );
}
