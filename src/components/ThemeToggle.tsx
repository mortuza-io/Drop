import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#080809' : '#fafaf9');
    try {
      localStorage.setItem('drop-theme', dark ? 'dark' : 'light');
    } catch {
      /* storage unavailable */
    }
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="relative w-14 h-8 rounded-full bg-raised border border-line transition-colors hover:border-subtle/50"
    >
      <span
        className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-accent text-accent-ink flex items-center justify-center
          transition-transform duration-300 ease-spring ${dark ? 'translate-x-0' : 'translate-x-6'}`}
      >
        {dark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
      </span>
    </button>
  );
}
