import { createRoot } from 'react-dom/client';
import css from './index.css?inline';
import App from './App';

// ⚡ IMMEDIATELY hide the original page to prevent flash
document.documentElement.style.visibility = 'hidden';

// ✨ 1. Inject locally bundled Inter font
function injectInterFont() {
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    // Load from local extension bundle
    fontLink.href = chrome.runtime.getURL('fonts/inter.css');

    // Append the link to the document's head
    document.head.appendChild(fontLink);
}

// ✨ 3. Inject Favicon
function injectFavicon() {
    const link = document.createElement('link');
    link.type = 'image/png';
    link.rel = 'icon';
    link.href = chrome.runtime.getURL('mendelu_logo_128.png');
    document.head.appendChild(link);
}

// 🔍 DEBUG: Check if custom Tailwind utilities are in the CSS bundle
function debugCssUtilities(css: string) {
    const customUtilities = [
        // Custom shadows
        { name: 'shadow-popover-heavy', pattern: /25px\s+50px/ },
        { name: 'shadow-card', pattern: /shadow-card/ },
        { name: 'shadow-popup', pattern: /shadow-popup/ },
        // Custom colors
        { name: 'bg-surface-primary', pattern: /surface-primary/ },
        { name: 'bg-surface-secondary', pattern: /surface-secondary/ },
        { name: 'text-content-primary', pattern: /content-primary/ },
        // Note: Inter font is loaded via fonts/inter.css, not in this bundle
    ];

    console.group('[CSS Debug] Checking custom Tailwind utilities in Shadow DOM');
    console.log(`CSS bundle size: ${(css.length / 1024).toFixed(1)}KB`);

    const missing: string[] = [];
    const found: string[] = [];

    customUtilities.forEach(({ name, pattern }) => {
        if (pattern.test(css)) {
            found.push(name);
        } else {
            missing.push(name);
        }
    });

    if (found.length > 0) {
        console.log('✅ Found:', found.join(', '));
    }
    if (missing.length > 0) {
        console.warn('❌ Missing (may cause styling issues):', missing.join(', '));
    }
    console.groupEnd();
}

async function firstLoad() {
    //LOGIN CHECK
    const contains = document.body.innerHTML.includes("/system/login.pl");
    if (contains) {
        console.log("[INFO] Login detected.");
        document.documentElement.style.visibility = 'visible'; // Show original login page
        return;
    }

    // 404 CHECK
    if (document.title.includes("Page not found") || document.body.textContent?.includes("Page not found")) {
        console.log("[INFO] 404 Page not found detected. Redirecting to dashboard.");
        window.location.href = "https://is.mendelu.cz/auth/";
        return;
    }

    //
    // Remove all existing content (safer than innerHTML = '')
    document.body.replaceChildren();
    document.head.replaceChildren();

    // ✨ 2. Call the function to add the font link to the new, empty head.
    injectInterFont();
    injectFavicon();

    document.documentElement.style.fontFamily = '"Inter", system-ui, sans-serif';

    // Create container for shadow root
    const host = document.createElement('div');
    host.id = 'custom-extension-root';
    document.body.appendChild(host);

    // Attach Shadow DOM
    const shadow = host.attachShadow({ mode: 'open' });

    // Inject CSS inside the shadow root
    const style = document.createElement('style');
    style.textContent = css;
    shadow.appendChild(style);

    // 🔍 DEBUG: Check if custom Tailwind utilities are in the CSS bundle
    debugCssUtilities(css);

    // Create root element for React inside shadow DOM
    const app = document.createElement('div');
    app.id = 'app';
    shadow.appendChild(app);

    // Render React app into shadow DOM
    const reactRoot = createRoot(app);
    reactRoot.render(<App />);

    // ⚡ Show the page after React is rendered
    document.documentElement.style.visibility = 'visible';
}

// Run when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', firstLoad);
} else {
    firstLoad();
}

