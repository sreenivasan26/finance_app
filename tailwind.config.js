/** @type {import('tailwindcss').Config} */
// Design tokens (Midnight pine + --color-fin-*), defined in src/index.css.
const fin = (n) => ({ DEFAULT: `var(--color-fin-${n})`, bg: `var(--color-fin-${n}-bg)` })
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: 'var(--color-primary)', soft: 'var(--color-primary-soft)', fg: 'var(--color-primary-fg)', text: 'var(--color-primary-text)' },
        canvas: 'var(--color-canvas)',
        surface: { DEFAULT: 'var(--color-surface)', alt: 'var(--color-surface-alt)' },
        line: { DEFAULT: 'var(--color-border)', strong: 'var(--color-border-strong)', control: 'var(--color-border-control)' },
        ink: { DEFAULT: 'var(--color-text)', muted: 'var(--color-text-muted)', subtle: 'var(--color-text-subtle)' },
        success: { DEFAULT: 'var(--color-success)', bg: 'var(--color-success-bg)' },
        warning: { DEFAULT: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
        danger: { DEFAULT: 'var(--color-danger)', bg: 'var(--color-danger-bg)' },
        fin: { 1: fin(1), 2: fin(2), 3: fin(3), 4: fin(4), 5: fin(5), 6: fin(6) },
      },
      fontFamily: { sans: 'var(--font-sans)', heading: 'var(--font-heading)' },
      minHeight: { tap: 'var(--tap-min)' },
      minWidth: { tap: 'var(--tap-min)' },
    },
  },
}
