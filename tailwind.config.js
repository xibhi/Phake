/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./popup.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: 'var(--bg-base)',
        surface: 'var(--bg-surface)',
        'surface-hover': 'var(--bg-surface-hover)',
        border: 'var(--border-color)',
        'border-subtle': 'var(--border-subtle)',
        'text-primary': 'var(--text-primary)',
        'text-muted': 'var(--text-muted)',
        'text-dim': 'var(--text-dim)',
        track: 'var(--toggle-track)',
        'track-on': 'var(--toggle-track-on)',
        knob: 'var(--toggle-knob)',
        'knob-on': 'var(--toggle-knob-on)',
        accent: 'var(--accent-color)',
        danger: 'var(--danger-color)',
        success: 'var(--success-color)'
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        'card': '14px',
        'popup': '20px',
        'pill': '9999px',
      },
      spacing: {
        'row-py': 'var(--row-padding-y)',
        'row-px': 'var(--row-padding-x)',
        'card-gap': 'var(--card-gap)',
        'card-p': 'var(--card-padding)',
      }
    },
  },
  plugins: [],
}
