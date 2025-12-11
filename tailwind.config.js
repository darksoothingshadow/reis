/** @type {import('tailwindcss').Config} */
import daisyui from 'daisyui';

export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    // Safelist DaisyUI components that use complex internal selectors
    // These won't be detected by Tailwind's JIT scanner
    safelist: [
        'toggle', 'toggle-xs', 'toggle-sm', 'toggle-md', 'toggle-lg',
        'toggle-primary', 'toggle-secondary', 'toggle-accent',
        'toggle-success', 'toggle-warning', 'toggle-error', 'toggle-info',
    ],
    theme: {
        // ========================================
        // CRITICAL: Override ALL rem-based defaults to px
        // This ensures consistency inside Shadow DOM
        // regardless of host page's root font-size
        // ========================================

        // Override default font sizes (rem → px)
        fontSize: {
            'xs': ['12px', { lineHeight: '16px' }],
            'sm': ['14px', { lineHeight: '20px' }],
            'base': ['16px', { lineHeight: '24px' }],
            'lg': ['18px', { lineHeight: '28px' }],
            'xl': ['20px', { lineHeight: '28px' }],
            '2xl': ['24px', { lineHeight: '32px' }],
            '3xl': ['30px', { lineHeight: '36px' }],
            '4xl': ['36px', { lineHeight: '40px' }],
            '5xl': ['48px', { lineHeight: '48px' }],
            '6xl': ['60px', { lineHeight: '60px' }],
            '7xl': ['72px', { lineHeight: '72px' }],
            '8xl': ['96px', { lineHeight: '96px' }],
            '9xl': ['128px', { lineHeight: '128px' }],
            '2xs': ['10px', { lineHeight: '14px' }], // Custom
        },

        // Override default spacing scale (rem → px)
        spacing: {
            'px': '1px',
            '0': '0px',
            '0.5': '2px',
            '1': '4px',
            '1.5': '6px',
            '2': '8px',
            '2.5': '10px',
            '3': '12px',
            '3.5': '14px',
            '4': '16px',
            '5': '20px',
            '6': '24px',
            '7': '28px',
            '8': '32px',
            '9': '36px',
            '10': '40px',
            '11': '44px',
            '12': '48px',
            '14': '56px',
            '16': '64px',
            '18': '72px',      // Custom
            '20': '80px',
            '24': '96px',
            '28': '112px',
            '32': '128px',
            '36': '144px',
            '40': '160px',
            '44': '176px',
            '48': '192px',
            '52': '208px',
            '56': '224px',
            '60': '240px',
            '64': '256px',
            '72': '288px',
            '80': '320px',
            '88': '352px',     // Custom
            '96': '384px',
            '100': '400px',    // Custom
            '120': '480px',    // Custom
            '150': '600px',    // Custom
            '180': '720px',    // Custom
        },

        // Override border radius (rem → px)
        borderRadius: {
            'none': '0px',
            'sm': '2px',
            'DEFAULT': '4px',
            'md': '6px',
            'lg': '8px',
            'xl': '12px',
            '2xl': '16px',
            '3xl': '24px',
            'full': '9999px',
            'card': '12px',    // Custom
            'button': '8px',   // Custom
        },

        extend: {
            colors: {
                // === Brand Colors ===
                brand: {
                    primary: '#79be15',      // Main green (Mendelu)
                    'primary-hover': '#6aab12',
                    accent: '#8DC843',       // Lighter green accent
                    'accent-hover': '#7db83a',
                    dark: '#444444',
                },

                // === Legacy Mendelu Colors (backwards compat) ===
                mendelu: {
                    green: '#79be15',
                    light: '#A0D25A',
                    dark: '#444444',
                },

                // === Event Type Colors ===
                exam: {
                    border: '#dc2626',
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

                // === UI State Colors ===
                state: {
                    success: '#22c55e',
                    'success-bg': '#f0fdf4',
                    warning: '#f59e0b',
                    'warning-bg': '#fffbeb',
                    error: '#ef4444',
                    'error-bg': '#fef2f2',
                    info: '#3b82f6',
                    'info-bg': '#eff6ff',
                },

                // === Surface Colors ===
                surface: {
                    primary: '#ffffff',
                    secondary: '#f9fafb',    // gray-50
                    tertiary: '#f3f4f6',     // gray-100
                    muted: '#e5e7eb',        // gray-200
                },

                // === Text Colors ===
                content: {
                    primary: '#111827',      // gray-900
                    secondary: '#4b5563',    // gray-600
                    muted: '#9ca3af',        // gray-400
                    inverse: '#ffffff',
                },

                // Convenience alias
                primary: '#79be15',
            },

            // === Shadows ===
            boxShadow: {
                'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
                'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                'popup': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                'drawer': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
            },

            // === Typography ===
            fontFamily: {
                inter: ['Inter', 'sans-serif'],
            },

            // === Transitions ===
            transitionDuration: {
                '250': '250ms',
            },
        },
    },
    plugins: [daisyui],
    daisyui: {
        themes: [
            {
                mendelu: {
                    "primary": "#79be15",
                    "primary-content": "#ffffff",
                    "secondary": "#8DC843",
                    "secondary-content": "#ffffff",
                    "accent": "#00548f",
                    "accent-content": "#ffffff",
                    "neutral": "#444444",
                    "neutral-content": "#ffffff",
                    "base-100": "#ffffff",
                    "base-200": "#f9fafb",
                    "base-300": "#f3f4f6",
                    "base-content": "#111827",
                    "info": "#3b82f6",
                    "info-content": "#ffffff",
                    "success": "#22c55e",
                    "success-content": "#ffffff",
                    "warning": "#f59e0b",
                    "warning-content": "#ffffff",
                    "error": "#ef4444",
                    "error-content": "#ffffff",
                },
            },
            {
                "mendelu-dark": {
                    "primary": "#79be15",
                    "primary-content": "#ffffff",
                    "secondary": "#8DC843",
                    "secondary-content": "#ffffff",
                    "accent": "#3b82f6",
                    "accent-content": "#ffffff",
                    "neutral": "#1f2937",
                    "neutral-content": "#d1d5db",
                    "base-100": "#1f2937",
                    "base-200": "#111827",
                    "base-300": "#0f172a",
                    "base-content": "#f3f4f6",
                    "info": "#3b82f6",
                    "info-content": "#ffffff",
                    "success": "#22c55e",
                    "success-content": "#ffffff",
                    "warning": "#f59e0b",
                    "warning-content": "#ffffff",
                    "error": "#ef4444",
                    "error-content": "#ffffff",
                },
            },
        ],
        base: true,      // Include base component styles
        styled: true,    // Include component styles
        utils: true,     // Include utility classes
        logs: false,     // Disable console logs
    },
}
