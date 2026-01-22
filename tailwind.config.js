/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'selector', // Enable dark mode via class/selector strategy
    theme: {
        extend: {},
    },
    plugins: [],
}
