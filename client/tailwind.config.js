/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pastel: {
          skyLight: '#DCEBFA',
          skyDark: '#BFD7F3',
          cream: '#FFF3C4',
          creamLight: '#FFFBF0',
          white: '#F8F8FB',
          pink: '#F7CADA',
          pinkLight: '#FDF0F5',
          periwinkle: '#8FA8E8',
          periwinkleLight: '#E5EDFD',
          yellow: '#FFD966',
          cocoa: '#7A5A50',
          cocoaLight: '#A88E86',
          slate: '#4E5868',
          mint: '#D2F1DF',
          lavender: '#E3DBF8',
        },
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2.25rem',
        'pill': '9999px',
      },
      boxShadow: {
        'kawaii': '0 10px 30px -5px rgba(122, 90, 80, 0.07), 0 4px 12px -2px rgba(143, 168, 232, 0.1)',
        'kawaii-hover': '0 16px 36px -4px rgba(122, 90, 80, 0.11), 0 8px 18px -2px rgba(143, 168, 232, 0.16)',
        'kawaii-pressed': '0 2px 6px 0 rgba(122, 90, 80, 0.08)',
        'inner-soft': 'inset 0 2px 6px rgba(122, 90, 80, 0.05)',
      },
      animation: {
        'twinkle-slow': 'twinkle 6s ease-in-out infinite',
        'float-gentle': 'float 5s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
      },
      keyframes: {
        twinkle: {
          '0%, 100%': { opacity: '0.3', transform: 'scale(0.85) rotate(0deg)' },
          '50%': { opacity: '0.85', transform: 'scale(1.15) rotate(180deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.75' },
        },
      },
    },
  },
  plugins: [],
}

