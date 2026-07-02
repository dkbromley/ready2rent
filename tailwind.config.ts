import type { Config } from 'tailwindcss';

/**
 * Ready2Rent design tokens.
 * Coastal & beachy: a seafoam (brand) primary with lighter ocean-blue (sky)
 * support, warm sand neutrals, deep navy text/chrome, and a clear semantic
 * status palette used across job/reservation cards.
 *
 * Dark mode: `navy`, `sand`, and `surface` resolve to CSS variables defined in
 * globals.css and flipped under `.dark`, so the whole app retheme happens at
 * the token layer — pages keep using text-navy-600 / bg-sand-50 / bg-surface
 * and get a correct dark rendering for free. Accent scales (brand/coral/
 * status) are constant across modes.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Seafoam — the primary action color (buttons, links, active nav, focus).
        brand: {
          50: '#effcf9',
          100: '#cffaf0',
          200: '#a3f0e3',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e57',
          900: '#134e4a',
          950: '#042f2c',
        },
        navy: {
          50: 'rgb(var(--navy-50) / <alpha-value>)',
          100: 'rgb(var(--navy-100) / <alpha-value>)',
          200: 'rgb(var(--navy-200) / <alpha-value>)',
          300: 'rgb(var(--navy-300) / <alpha-value>)',
          400: 'rgb(var(--navy-400) / <alpha-value>)',
          500: 'rgb(var(--navy-500) / <alpha-value>)',
          600: 'rgb(var(--navy-600) / <alpha-value>)',
          700: 'rgb(var(--navy-700) / <alpha-value>)',
          800: 'rgb(var(--navy-800) / <alpha-value>)',
          900: 'rgb(var(--navy-900) / <alpha-value>)',
          950: 'rgb(var(--navy-950) / <alpha-value>)',
        },
        sand: {
          50: 'rgb(var(--sand-50) / <alpha-value>)',
          100: 'rgb(var(--sand-100) / <alpha-value>)',
          200: 'rgb(var(--sand-200) / <alpha-value>)',
          300: 'rgb(var(--sand-300) / <alpha-value>)',
        },
        // Card / input / chrome background. White in light mode, elevated deep
        // ocean in dark. Use instead of bg-white for app surfaces.
        surface: 'rgb(var(--surface) / <alpha-value>)',
        // Coral — reserved for urgency: same-day turnovers, problems, alerts.
        coral: {
          50: '#fbeee9',
          100: '#f6d2c4',
          200: '#efb39d',
          300: '#e68a68',
          400: '#dd6a40',
          500: '#cf5430',
          600: '#b2421f',
          700: '#8f3419',
          800: '#6f2914',
          900: '#4a1b0c',
        },
        // Semantic status palette (job + reservation states)
        status: {
          available: '#15803d',
          scheduled: '#0ea5e9',
          progress: '#7c3aed',
          completed: '#0f766e',
          problem: '#cf5430',
          sameday: '#cf5430',
          canceled: '#6b7280',
          pending: '#b45309',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Soft, teal-tinted card elevation for the coastal look.
        card: '0 1px 2px rgba(6, 48, 47, 0.05), 0 10px 26px rgba(6, 48, 47, 0.08)',
        'card-hover': '0 2px 6px rgba(6, 48, 47, 0.10), 0 18px 42px rgba(6, 48, 47, 0.14)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
    },
  },
  plugins: [],
};

export default config;
