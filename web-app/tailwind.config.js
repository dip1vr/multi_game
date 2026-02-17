import path from 'path';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                anime: {
                    bg: '#050507',
                    card: '#121218',
                    accent: '#6366f1',
                }
            },
            animation: {
                'glow': 'glow 2s ease-in-out infinite alternate',
            },
            keyframes: {
                glow: {
                    '0%': { opacity: 0.3, transform: 'scale(1)' },
                    '100%': { opacity: 0.6, transform: 'scale(1.05)' },
                }
            }
        },
    },
    plugins: [],
}
