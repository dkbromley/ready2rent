import type { Config } from 'tailwindcss';

/**
 * Ready2Rent design tokens.
 * Coastal & beachy: a seafoam (brand) primary with lighter ocean-blue (sky)
 * support, warm sand neutrals, deep navy text/chrome, and a clear semantic
 * status palette used across job/reservation cards.
 */
const config: Config = {
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
          50: '#f3f6fb',
          100: '#e4eaf4',
          200: '#cfdbeb',
          300: '#adc3dd',
          400: '#85a3ca',
          500: '#6685bb',
          600: '#526dac',
          700: '#475c9d',
          800: '#3e4d81',
          900: '#1d2748',
          950: '#121831',
        },
        sand: {
          50: '#fbf9f4',
          100: '#f4efe2',
          200: '#e8dcc4',
          300: '#d9c39d',
        },
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
