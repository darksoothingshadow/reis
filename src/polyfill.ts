// -----------------------------------------------------------------------------
// POLYFILL & ERROR HANDLER - MUST RUN BEFORE ANYTHING ELSE
// -----------------------------------------------------------------------------

// 1. Visual Injection Confirmation
try {
    if (document && document.body) {
        document.body.style.border = "5px solid red";
    }
} catch (e) {
    // Body might not be ready yet, ignore
}

// 2. Global Error Handler (Visual)
window.onerror = function (msg, url, line, col, error) {
    const errorHtml = `<div style="padding:20px; background:yellow; color:black; font-size:24px; z-index:999999; position:fixed; top:0; left:0; width:100%; height:100%; overflow:auto;">
        <h1>Global Error (Polyfill)</h1>
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

window.onunhandledrejection = function (event) {
    const errorHtml = `<div style="padding:20px; background:orange; color:black; font-size:24px; z-index:999999; position:fixed; top:0; left:0; width:100%; height:100%; overflow:auto;">
        <h1>Unhandled Rejection (Polyfill)</h1>
        <p>${event.reason}</p>
    </div>`;

    if (document.body) {
        document.body.insertAdjacentHTML('beforeend', errorHtml);
    } else {
        document.documentElement.innerHTML += errorHtml;
    }
    document.documentElement.style.visibility = 'visible';
};

// 3. Chrome API Polyfill
if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.storage) {
    console.log('[Capacitor] Polyfilling Chrome APIs');

    const mockStorage = {
        get: (keys: string | string[] | null) => {
            return new Promise((resolve) => {
                const result: Record<string, any> = {};
                if (typeof keys === 'string') {
                    try {
                        const val = localStorage.getItem(keys);
                        if (val) {
                            try {
                                result[keys] = JSON.parse(val);
                            } catch (e) {
                                result[keys] = val;
                            }
                        }
                    } catch (e) {
                        console.error('localStorage.getItem failed', e);
                    }
                }
                resolve(result);
            });
        },
        set: (items: Record<string, any>) => {
            return new Promise<void>((resolve) => {
                for (const [key, val] of Object.entries(items)) {
                    try {
                        localStorage.setItem(key, JSON.stringify(val));
                    } catch (e) {
                        console.error('localStorage.setItem failed', e);
                    }
                }
                resolve();
            });
        },
        remove: (keys: string | string[]) => {
            return new Promise<void>((resolve) => {
                if (typeof keys === 'string') {
                    try {
                        localStorage.removeItem(keys);
                    } catch (e) {
                        console.error('localStorage.removeItem failed', e);
                    }
                }
                resolve();
            });
        }
    };

    window.chrome = {
        runtime: {
            id: 'capacitor-app',
            getURL: (path: string) => path,
        },
        storage: {
            local: mockStorage,
            sync: mockStorage // Fallback sync to local
        }
    } as any;
}
