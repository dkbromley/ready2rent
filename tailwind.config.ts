import type { Config } from 'tailwindcss';

/**
 * TurnReady design tokens.
 * Coastal-but-professional: deep navy chrome, teal/seafoam accent, sand neutrals,
 * and a clear semantic status palette used across job/reservation cards.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefcfb',
          100: '#d4f6f4',
          200: '#aeece9',
          300: '#76dcd8',
          400: '#38c2bf',
          500: '#1ba6a4',
          600: '#138585',
          700: '#146a6b',
          800: '#155456',
          900: '#164648',
          950: '#06282b',
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
          scheduled: '#2563eb',
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
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 4px 16px rgba(16, 24, 40, 0.06)',
        'card-hover': '0 2px 4px rgba(16, 24, 40, 0.06), 0 8px 28px rgba(16, 24, 40, 0.10)',
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
