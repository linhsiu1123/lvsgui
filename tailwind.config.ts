import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  // Preflight is disabled so Tailwind's base reset does not fight Ant Design's
  // CSS-in-JS styles or the design's own inline styling. Utilities still work.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          "'Segoe UI'",
          'Roboto',
          "'Helvetica Neue'",
          'Arial',
          "'Noto Sans TC'",
          "'Noto Sans'",
          'sans-serif',
        ],
        mono: ["'SFMono-Regular'", 'Consolas', "'Liberation Mono'", 'Menlo', 'Courier', 'monospace'],
      },
      colors: {
        'on-accent': 'var(--on-accent)',
        // Bridge the design's CSS variables into Tailwind utilities,
        // e.g. `text-ink`, `bg-surface`, `border-line`.
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        ink: 'var(--ink)',
        sub: 'var(--sub)',
        line: 'var(--line)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        green: 'var(--green)',
        'green-soft': 'var(--green-soft)',
        red: 'var(--red)',
        'red-soft': 'var(--red-soft)',
        amber: 'var(--amber)',
        'amber-soft': 'var(--amber-soft)',
      },
    },
  },
  plugins: [],
};

export default config;
