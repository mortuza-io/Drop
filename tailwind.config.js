/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        raised: v('raised'),
        line: v('line'),
        fg: v('fg'),
        muted: v('muted'),
        subtle: v('subtle'),
        accent: v('accent'),
        'accent-ink': v('accent-ink'),
        'accent-text': v('accent-text'),
        danger: v('danger'),
        warn: v('warn'),
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      spacing: {
        18: '4.5rem',
      },
      boxShadow: {
        card: '0 1px 0 0 rgb(var(--fg) / 0.03) inset, 0 8px 32px -12px rgb(0 0 0 / 0.35)',
        glow: '0 0 0 1px rgb(var(--accent) / 0.4), 0 0 32px -6px rgb(var(--accent) / 0.45)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};
