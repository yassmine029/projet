export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1a2b6d',
          dark: '#0f1f5c',
          medium: '#1e3a8a',
          light: '#e8edf8',
        },
        accent: {
          DEFAULT: '#e85d7a',
          dark: '#d44d6a',
          light: '#fff0f4',
        },
        surface: {
          page: '#f5f7ff',
          card: '#ffffff',
          border: '#e2e6f0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'DM Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '10px',
        lg: '14px',
        xl: '18px',
      },
      boxShadow: {
        card: '0 1px 4px rgba(26,43,109,0.06)',
        focus: '0 0 0 3px rgba(26,43,109,0.15)',
      },
    },
  },
  plugins: [],
}
