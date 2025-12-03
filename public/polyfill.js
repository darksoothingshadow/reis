// THE "CHROME POLYFILL"
// Injects a fake 'chrome' object so the extension thinks it's home.

window.chrome = window.chrome || {};

if (!window.chrome.runtime) {
    window.chrome.runtime = {
        id: 'android_app',
        getManifest: function () { return { version: '1.0' }; },
        getURL: function (path) { return path; } // Return dummy paths
    };
}

if (!window.chrome.storage) {
    window.chrome.storage = {
        local: {
            get: function (keys, callback) {
                // 1. Read from localStorage
                let result = {};
                if (typeof keys === 'string') keys = [keys];

                if (Array.isArray(keys)) {
                    keys.forEach(key => {
                        try {
                            const val = localStorage.getItem(key);
                            if (val) result[key] = JSON.parse(val);
                        } catch (e) { console.error("Polyfill Read Error", e); }
                    });
                } else {
                    // If keys is null/object, return everything (simplified)
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        try { result[k] = JSON.parse(localStorage.getItem(k)); } catch (e) { }
                    }
                }

                // 2. Return via Callback (Async simulation)
                if (callback) setTimeout(() => callback(result), 0);
                return new Promise(resolve => resolve(result)); // Support Promises too
            },
            set: function (items, callback) {
                // Write to localStorage
                for (let key in items) {
                    localStorage.setItem(key, JSON.stringify(items[key]));
                }
                if (callback) setTimeout(() => callback(), 0);
            }
        }
    };
}

// DEBUG: Visual injection confirmation
try {
    if (document && document.body) {
        document.body.style.border = "5px solid blue"; // Blue border for native polyfill
    }
} catch (e) { }

// DEBUG: Global error handler
window.onerror = function (msg, url, line, col, error) {
    const errorHtml = `<div style="padding:20px; background:yellow; color:black; font-size:24px; z-index:999999; position:fixed; top:0; left:0; width:100%; height:100%; overflow:auto;">
        <h1>Global Error (Native Polyfill)</h1>
        <p><strong>Message:</strong> ${msg}</p>
        <p><strong>Location:</strong> ${url}:${line}:${col}</p>
        <p><strong>Error:</strong> ${error}</p>
    </div>`;

    if (document.body) {
        document.body.insertAdjacentHTML('beforeend', errorHtml);
    } else {
        document.documentElement.innerHTML += errorHtml;
    }
    document.documentElement.style.visibility = 'visible';
    return false;
};
