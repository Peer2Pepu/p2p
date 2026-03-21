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
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
      },
      keyframes: {
        'notfound-glow': {
          '0%, 100%': {
            opacity: '1',
            filter: 'drop-shadow(0 0 14px rgba(57, 255, 20, 0.35))',
          },
          '50%': {
            opacity: '0.9',
            filter: 'drop-shadow(0 0 28px rgba(57, 255, 20, 0.55))',
          },
        },
        'notfound-float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'notfound-glow': 'notfound-glow 3.5s ease-in-out infinite',
        'notfound-float': 'notfound-float 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
