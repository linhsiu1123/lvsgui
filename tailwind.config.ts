import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  // NOTE: Preflight used to be disabled here via `corePlugins`, which Tailwind v4
  // removed. It is now disabled by not importing `tailwindcss/preflight.css` in
  // app/globals.css — same intent: keep Tailwind's reset off Ant Design.
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
