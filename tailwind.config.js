/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                mendelu: {
                    green: '#79be15',
                    light: '#A0D25A',
                    dark: '#444444',
                },
                exam: {
                    red: '#dc2626',
                    bg: '#FEF2F2',
                    text: '#991b1b',
                },
                lecture: {
                    border: '#00548f',
                    bg: '#F0F7FF',
                    text: '#1e3a8a',
                },
                seminar: {
                    border: '#79be15',
                    bg: '#F3FAEA',
                    text: '#365314',
                },
                primary: '#79be15', // Alias for convenience
            },
            fontFamily: {
                dm: ['DM Sans', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
