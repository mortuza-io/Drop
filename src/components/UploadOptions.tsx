import { useState } from 'react';
import { ChevronDown, Eye, EyeOff } from 'lucide-react';

export interface Options {
  expiration: string;
  customValue: number;
  customUnit: 'hours' | 'days';
  maxDownloads: number | null;
  password: string;
}

interface UploadOptionsProps {
  value: Options;
  onChange: (next: Options) => void;
}

const EXPIRATIONS = [
  { value: '1h', label: '1h' },
  { value: '1d', label: '1d' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'custom', label: 'Custom' },
];

const MAX_DAYS = 90;
const maxFor = (unit: 'hours' | 'days') => (unit === 'hours' ? MAX_DAYS * 24 : MAX_DAYS);

const LIMITS: (number | null)[] = [null, 1, 5, 10, 50];

function Segmented<T>({
  items,
  active,
  onSelect,
}: {
  items: { value: T; label: string }[];
  active: T;
  onSelect: (v: T) => void;
}) {
  return (
    <div className="flex p-1 rounded-2xl bg-raised border border-line">
      {items.map((it) => {
        const on = it.value === active;
        return (
          <button
            key={String(it.value)}
            onClick={() => onSelect(it.value)}
            className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all duration-200
              ${on ? 'bg-accent text-accent-ink shadow-sm' : 'text-muted hover:text-fg'}`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export default function UploadOptions({ value, onChange }: UploadOptionsProps) {
  const [open, setOpen] = useState(false);
  const [reveal, setReveal] = useState(false);
  const set = <K extends keyof Options>(k: K, v: Options[K]) => onChange({ ...value, [k]: v });

  const activeCount = (value.maxDownloads !== null ? 1 : 0) + (value.password ? 1 : 0);

  return (
    <div className="card p-5 space-y-5">
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <label className="text-sm font-medium text-fg">Auto-delete</label>
          <span className="text-2xs text-subtle font-mono">file is erased after this</span>
        </div>
        <Segmented items={EXPIRATIONS} active={value.expiration} onSelect={(v) => set('expiration', v)} />

        {value.expiration === 'custom' && (
          <div className="mt-3 flex items-center gap-2 animate-fade-up">
            <input
              type="number"
              min={1}
              max={maxFor(value.customUnit)}
              value={value.customValue}
              onChange={(e) =>
                set('customValue', Math.max(1, Math.min(maxFor(value.customUnit), parseInt(e.target.value) || 1)))
              }
              className="field w-20 text-center font-mono"
            />
            <div className="w-40">
              <Segmented
                items={[
                  { value: 'hours' as const, label: 'Hours' },
                  { value: 'days' as const, label: 'Days' },
                ]}
                active={value.customUnit}
                onSelect={(v) =>
                  onChange({ ...value, customUnit: v, customValue: Math.min(value.customValue, maxFor(v)) })
                }
              />
            </div>
            <span className="ml-auto text-2xs text-subtle font-mono">max {MAX_DAYS} days</span>
          </div>
        )}
      </div>

      <div className="border-t border-line pt-4">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between text-sm text-muted hover:text-fg transition-colors"
        >
          <span className="flex items-center gap-2">
            More options
            {activeCount > 0 && (
              <span className="px-1.5 rounded-md bg-accent/15 text-accent-text text-2xs font-mono">{activeCount}</span>
            )}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
        </button>

        <div className={`grid transition-all duration-300 ease-smooth ${open ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden space-y-5">
            <div>
              <label className="block text-sm font-medium text-fg mb-3">Download limit</label>
              <Segmented
                items={LIMITS.map((l) => ({ value: l, label: l === null ? 'No limit' : String(l) }))}
                active={value.maxDownloads}
                onSelect={(v) => set('maxDownloads', v)}
              />
            </div>
            <div className="pb-1">
              <label className="block text-sm font-medium text-fg mb-3">Password</label>
              <div className="relative">
                <input
                  type={reveal ? 'text' : 'password'}
                  value={value.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="Optional"
                  autoComplete="new-password"
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
          </div>
        </div>
      </div>
    </div>
  );
}
