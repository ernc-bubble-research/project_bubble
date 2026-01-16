const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      colors: {
        primary: '#5654fc',      // Brand Blue
        secondary: '#ffdddb',    // Soft Pink
        danger: '#fe282a',       // Red
        surface: '#ffffff',      // White Cards
        background: '#f8f9fa',   // Light Gray App BG (slate-50)
        panel: '#f8fafc',        // Right Panel BG (lighter slate)
        sidebar: '#0f172a',      // Dark Sidebar (slate-900)
        border: {
          DEFAULT: '#e2e8f0',    // slate-200
          light: '#f1f5f9'       // slate-100
        },
        text: {
          DEFAULT: '#1a1a1a',
          muted: '#666666',
          light: '#94a3b8'       // slate-400
        },
        status: {
          success: '#10b981',    // green-500
          warning: '#f59e0b',    // amber-500
          error: '#ef4444',      // red-500
          info: '#3b82f6'        // blue-500
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
};
