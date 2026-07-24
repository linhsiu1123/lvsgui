/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // Tailwind v4 ships its PostCSS plugin as a separate package.
    // Autoprefixer is no longer needed — v4 handles vendor prefixing itself.
    '@tailwindcss/postcss': {},
  },
};

export default config;
