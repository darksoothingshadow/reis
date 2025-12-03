package com.reis.app;

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        WebView webView = this.getBridge().getWebView();

        // 1. Enable Critical Settings (LocalStorage)
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setDatabaseEnabled(true);
        webView.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        webView.setWebViewClient(new BridgeWebViewClient(this.getBridge()) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // 2. Whitelist Auth Providers & Main Domain
                if (url.contains("mendelu.cz") ||
                        url.contains("microsoft") ||
                        url.contains("login") ||
                        url.contains("oauth")) {
                    return false; // Let WebView load it
                }
                return super.shouldOverrideUrlLoading(view, url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // 3. Atomic Injection (Polyfill + Bundle)
                injectPolyfillAndScript(view, "public/polyfill.js", "public/content.js");
                injectCss(view, "public/content.css");
            }
        });
    }

    private void injectPolyfillAndScript(WebView view, String polyfillFile, String scriptFile) {
        try {
            // Read Polyfill
            String polyfill = readFileFromAssets(polyfillFile);
            // Read Extension Bundle
            String bundle = readFileFromAssets(scriptFile);

            // Combine: Polyfill FIRST
            String finalScript = polyfill + "\n" + bundle;

            view.evaluateJavascript(finalScript, null);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private String readFileFromAssets(String fileName) throws IOException {
        InputStream inputStream = getAssets().open(fileName);
        BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream));
        StringBuilder stringBuilder = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            stringBuilder.append(line).append("\n");
        }
        return stringBuilder.toString();
    }

    private void injectCss(WebView view, String cssFile) {
        try {
            String css = readFileFromAssets(cssFile);
            // Escape single quotes and newlines for the JS string wrapper
            css = css.replace("'", "\\'").replace("\n", " ");
            String js = "var style = document.createElement('style'); style.innerHTML = '" + css
                    + "'; document.head.appendChild(style);";
            view.evaluateJavascript(js, null);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
