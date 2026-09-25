/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
       
        primary: {
          50: '#fff5f2',
          100: '#ffe8e2',
          200: '#ffd2c6',
          300: '#ffb09b',
          400: '#ff8460',
          500: '#f75c35',
          600: '#e63e22',
          700: '#c02d14',
          800: '#9c2714',
          900: '#802317',
        },

    
        ink: {
          50: '#f7f7f6',
          100: '#eeedeb',
          200: '#dcdad6',
          300: '#bfbcb5',
          400: '#9c988f',
          500: '#7e7a71',
          600: '#65625b',
          700: '#514e49',
          800: '#302e2b',
          900: '#141312',
        },

        accent: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },

        gray: {
          50: '#f7f7f6',
          100: '#eeedeb',
          200: '#dcdad6',
          300: '#bfbcb5',
          400: '#9c988f',
          500: '#7e7a71',
          600: '#65625b',
          700: '#514e49',
          800: '#302e2b',
          900: '#141312',
        },

        paper: '#fdfcfb',
        bone: '#f4f2ef',
      },

      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'ui-serif', 'Georgia', 'serif'],
      },

      letterSpacing: {
        eyebrow: '0.18em',
      },

      borderRadius: {
        card: '10px',
      },

      boxShadow: {
        float: '0 18px 40px -24px rgba(20, 19, 18, 0.35)',
        // Transient hover elevation. Deliberately softer than `float` so an
        // interactive card lifts without turning into a shadowed surface --
        // the design is built on hairline borders, not drop shadows.
        lift: '0 14px 30px -20px rgba(20, 19, 18, 0.28)',
        nav: '0 10px 30px -26px rgba(20, 19, 18, 0.5)',
      },

      maxWidth: {
        shell: '78rem',
      },

      transitionTimingFunction: {
        // The single easing the whole UI moves on: quick out, long settle.
        soft: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },

      /**
       * Motion vocabulary.
       *
       * Kept as CSS keyframes rather than a JS animation library on purpose:
       * the landing page and the course card are server components, and
       * animating them from a client wrapper would drag the whole catalogue
       * grid into the client bundle.
       */
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up-sm': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96) translateY(-6px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'scale-out': {
          from: { opacity: '1', transform: 'scale(1) translateY(0)' },
          to: { opacity: '0', transform: 'scale(0.97) translateY(-4px)' },
        },
        pop: {
          '0%': { transform: 'scale(0.4)', opacity: '0' },
          '60%': { transform: 'scale(1.15)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        // Ring that expands off a live badge. Drawn as an outline rather than a
        // fill so it never tints the badge it sits on.
        'ping-soft': {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '70%, 100%': { transform: 'scale(2.1)', opacity: '0' },
        },
        // Fills a progress track from empty to its real value.
        'bar-grow': {
          from: { width: '0%' },
          to: { width: 'var(--bar-width, 100%)' },
        },
        // Very small idle drift for the hero's floating cards.
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        // Slow drift on the hero photograph so the page is never fully static.
        kenburns: {
          from: { transform: 'scale(1)' },
          to: { transform: 'scale(1.045)' },
        },
        // Sweep for skeleton placeholders.
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
        // Horizontal rule that draws itself in, used beside eyebrow labels.
        'draw-x': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
      },

      /**
       * Entrances fill `backwards`, not `both`.
       *
       * Every entrance here ends on the element's natural state, so holding the
       * final frame afterwards buys nothing and costs something: a retained
       * `translateY(0)` still counts as a transform, which turns the element into
       * a containing block for fixed-position descendants and a new stacking
       * context, permanently. `backwards` covers the delay before the animation
       * starts -- which is what staggering needs -- and then gets out of the way.
       * Exits keep `both`, since their whole job is to hold the end frame until
       * the element unmounts.
       */
      animation: {
        'fade-in': 'fade-in 500ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'fade-up': 'fade-up 700ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'fade-up-sm': 'fade-up-sm 400ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'scale-in': 'scale-in 180ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'scale-out': 'scale-out 140ms ease-in both',
        pop: 'pop 320ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        // Two pulses and done. An unread badge should announce itself when it
        // changes, not throb for as long as the tab is open.
        'ping-twice': 'ping-soft 1.5s cubic-bezier(0, 0, 0.2, 1) 2 both',
        'bar-grow': 'bar-grow 1s cubic-bezier(0.22, 1, 0.36, 1) backwards',
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        kenburns: 'kenburns 20s ease-in-out infinite alternate',
        shimmer: 'shimmer 1.6s linear infinite',
        'draw-x': 'draw-x 600ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
      },
    },
  },
  plugins: [],
};
