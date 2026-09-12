/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── CyberPulse "Obsidian" theme ──────────────────────────────────
        // Deep slate base (#090A0F family), obsidian cards, neon amber
        // (#F59E0B) + emerald (#10B981) security accents. Deliberately
        // NOT the generic AI blue/purple look.
        obsidian: {
          950: '#06070B',  // deepest bg
          900: '#090A0F',  // page bg (spec)
          850: '#0C0E14',  // raised section
          800: '#111319',  // card bg
          700: '#1A1D26',  // elevated card / input
          600: '#262A36',  // borders
          500: '#343947',  // strong borders / dividers
        },
        // Neon amber — primary action + attention accent (spec)
        amber: {
          400: '#FBBF24',
          500: '#F59E0B',  // spec accent
          600: '#D97706',
        },
        // Emerald — "secure/healthy" state accent (spec)
        emerald: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10B981',  // spec accent
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        severity: {
          critical: '#DC2626',
          high:     '#F59E0B', // amber = high attention
          medium:   '#EAB308',
          low:      '#10B981', // emerald = low risk
          info:     '#38BDF8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'glow-amber': 'glowAmber 2s ease-in-out infinite alternate',
        'shimmer': 'shimmer 1.6s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glowAmber: {
          '0%': { boxShadow: '0 0 5px rgba(245,158,11,0.25)' },
          '100%': { boxShadow: '0 0 20px rgba(245,158,11,0.5)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(245,158,11,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.025) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};
