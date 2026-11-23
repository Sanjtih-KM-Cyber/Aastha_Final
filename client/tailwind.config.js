/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Self-hosted (src/index.tsx imports @fontsource-variable/*): no Google Fonts requests, works offline in the app
        // --app-font / --app-font-display = the user's choice, set on <html> only inside the Sanctuary (src/design/fonts.ts)
        sans: ['var(--app-font, "Plus Jakarta Sans Variable")', '"Plus Jakarta Sans Variable"', '"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['var(--app-font-display, "Fraunces Variable")', '"Fraunces Variable"', 'Fraunces', 'Georgia', 'serif'],   // soft display serif for headings
        display: ['var(--app-font-display, "Fraunces Variable")', '"Fraunces Variable"', 'Fraunces', 'Georgia', 'serif'],
      },
      colors: {
        // Material You tokens (src/design/materialTheme.ts) — e.g. bg-md-surface-container-high, text-md-on-surface, bg-md-primary/20
        md: {
          'primary': 'rgb(var(--md-primary) / <alpha-value>)',
          'on-primary': 'rgb(var(--md-on-primary) / <alpha-value>)',
          'primary-container': 'rgb(var(--md-primary-container) / <alpha-value>)',
          'on-primary-container': 'rgb(var(--md-on-primary-container) / <alpha-value>)',
          'secondary': 'rgb(var(--md-secondary) / <alpha-value>)',
          'secondary-container': 'rgb(var(--md-secondary-container) / <alpha-value>)',
          'on-secondary-container': 'rgb(var(--md-on-secondary-container) / <alpha-value>)',
          'tertiary': 'rgb(var(--md-tertiary) / <alpha-value>)',
          'tertiary-container': 'rgb(var(--md-tertiary-container) / <alpha-value>)',
          'on-tertiary-container': 'rgb(var(--md-on-tertiary-container) / <alpha-value>)',
          'surface': 'rgb(var(--md-surface) / <alpha-value>)',
          'surface-dim': 'rgb(var(--md-surface-dim) / <alpha-value>)',
          'surface-bright': 'rgb(var(--md-surface-bright) / <alpha-value>)',
          'surface-container-lowest': 'rgb(var(--md-surface-container-lowest) / <alpha-value>)',
          'surface-container-low': 'rgb(var(--md-surface-container-low) / <alpha-value>)',
          'surface-container': 'rgb(var(--md-surface-container) / <alpha-value>)',
          'surface-container-high': 'rgb(var(--md-surface-container-high) / <alpha-value>)',
          'surface-container-highest': 'rgb(var(--md-surface-container-highest) / <alpha-value>)',
          'on-surface': 'rgb(var(--md-on-surface) / <alpha-value>)',
          'on-surface-variant': 'rgb(var(--md-on-surface-variant) / <alpha-value>)',
          'outline': 'rgb(var(--md-outline) / <alpha-value>)',
          'outline-variant': 'rgb(var(--md-outline-variant) / <alpha-value>)',
          'error': 'rgb(var(--md-error) / <alpha-value>)',
          'on-error': 'rgb(var(--md-on-error) / <alpha-value>)',
          'error-container': 'rgb(var(--md-error-container) / <alpha-value>)',
          'on-error-container': 'rgb(var(--md-on-error-container) / <alpha-value>)',
          'on-secondary': 'rgb(var(--md-on-secondary) / <alpha-value>)',
          'on-tertiary': 'rgb(var(--md-on-tertiary) / <alpha-value>)',
        },
        // Existing app colors
        midnight: '#0a0e17',
        charcoal: '#121620',
        glass: 'rgba(255, 255, 255, 0.05)',
        glassBorder: 'rgba(255, 255, 255, 0.1)',

        // New Landing Page overrides/additions
        violet: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
      },
      borderRadius: {
        // Material 3 shape scale
        'md-sm': '12px',
        'md-md': '16px',
        'md-lg': '28px',
      },
      transitionTimingFunction: {
        // Material 3 "emphasized" easing
        'md-emphasized': 'cubic-bezier(0.2, 0, 0, 1)',
      },
      animation: {
        // Existing
        'blob': 'blob 10s infinite',
        'gradient-xy': 'gradient-xy 15s ease infinite',

        // New & Shared
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 3s infinite',
        'wiggle': 'wiggle 0.3s ease-in-out infinite',
      },
      keyframes: {
        wiggle: {
            '0%, 100%': { transform: 'rotate(-3deg)' },
            '50%': { transform: 'rotate(3deg)' },
        },
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'gradient-xy': {
          '0%, 100%': {
            'background-size': '400% 400%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '400% 400%',
            'background-position': 'right center'
          }
        },
        'pulse-glow': {
          '0%, 100%': { opacity: 0.6, transform: 'scale(1)' },
          '50%': { opacity: 1, transform: 'scale(1.05)' },
        }
      }
    },
  },
  plugins: [],
}
