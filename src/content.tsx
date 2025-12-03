import { createRoot } from 'react-dom/client';
import css from './index.css?inline';
import App from './App';

// ⚡ IMMEDIATELY hide the original page to prevent flash
document.documentElement.style.visibility = 'hidden';

// ✨ 1. Inject locally bundled DM Sans font
function injectDmSansFont() {
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    // Load from local extension bundle instead of Google CDN
    fontLink.href = chrome.runtime.getURL('fonts/dm-sans.css');

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
    injectDmSansFont();
    injectFavicon();

    document.documentElement.style.fontFamily = '"DM Sans", sans-serif';

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

