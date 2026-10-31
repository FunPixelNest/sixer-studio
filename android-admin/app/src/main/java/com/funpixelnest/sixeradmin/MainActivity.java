package com.funpixelnest.sixeradmin;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Sixer Admin: a full-screen wrapper around the store's admin panel.
 * Everything (orders, products, settings) lives on the website, so the app
 * always shows the latest version without needing an update.
 */
public class MainActivity extends Activity {

    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final String ADMIN_URL = BuildConfig.ADMIN_URL;
    private static final String SITE_HOST = Uri.parse(ADMIN_URL).getHost();
    private static final String SITE_PATH = Uri.parse(ADMIN_URL).getPath().replace("admin.html", "");

    private WebView web;
    private ProgressBar progress;
    private ValueCallback<Uri[]> fileCallback;
    private boolean showingError = false;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#0A1F44"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0A1F44"));
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#C6FF1A")));
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(4), Gravity.TOP);
        root.addView(progress, lp);
        setContentView(root);

        // Keep content clear of the status bar, navigation bar and keyboard (Android 15 draws edge-to-edge).
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);           // keeps you logged in
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportMultipleWindows(false);     // links that would open a new tab come through shouldOverrideUrlLoading
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setUserAgentString(s.getUserAgentString() + " SixerAdminApp/" + BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Bridge(), "SixerApp");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(ADMIN_URL);
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    @Override
    protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        // Pull in any orders that arrived while the app was in the background.
        web.evaluateJavascript("(function(){var b=document.getElementById('oRefresh');if(b&&document.querySelector('#aTabs [data-t=orders].active')&&!document.querySelector('.order-card.dirty'))b.click();})()", null);
    }

    @Override
    protected void onPause() { web.onPause(); CookieManager.getInstance().flush(); super.onPause(); }

    @Override
    public void onBackPressed() {
        if (showingError) { finish(); return; }
        // Close an open pop-up (e.g. the product form) first, then go back, then exit.
        web.evaluateJavascript("(function(){var m=document.querySelector('.modal.open');if(m){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));return true;}return false;})()", value -> {
            if ("true".equals(value)) return;
            if (web.canGoBack()) web.goBack();
            else finish();
        });
    }

    /* ---------------- navigation ---------------- */
    private boolean isAdminPage(Uri u) {
        return "https".equals(u.getScheme()) && SITE_HOST.equalsIgnoreCase(u.getHost())
                && u.getPath() != null && u.getPath().startsWith(SITE_PATH) && u.getPath().endsWith("admin.html");
    }

    private void openExternally(Uri uri) {
        try {
            Intent i;
            if ("tel".equals(uri.getScheme())) i = new Intent(Intent.ACTION_DIAL, uri);
            else i = new Intent(Intent.ACTION_VIEW, uri);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            String msg = uri.toString().contains("wa.me") || "whatsapp".equals(uri.getScheme())
                    ? "WhatsApp is not installed on this phone" : "No app found to open this link";
            Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
        }
    }

    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (isAdminPage(u)) return false;            // stay inside the app
            openExternally(u);                           // WhatsApp, calls, the store, anything else
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) { progress.setVisibility(View.VISIBLE); }

        @Override
        public void onPageFinished(WebView view, String url) { progress.setVisibility(View.GONE); }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
            if (!req.isForMainFrame()) return;
            showingError = true;
            String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>"
                    + "<body style='margin:0;font-family:sans-serif;background:#0A1F44;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center'>"
                    + "<div style='padding:24px'><div style='font-size:56px'>📶</div><h2>No internet connection</h2>"
                    + "<p style='color:#c5cee3'>Check your Wi-Fi or mobile data, then try again.</p>"
                    + "<button onclick='SixerApp.retry()' style='margin-top:16px;background:#C6FF1A;color:#0A1F44;border:0;border-radius:999px;padding:14px 28px;font-size:16px;font-weight:bold'>Try again</button></div></body></html>";
            view.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
        }
    }

    private class Chrome extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView view, int p) { progress.setProgress(p); }

        // Product photo upload: opens the phone's gallery / file picker.
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
            pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.setType("image/*");
            pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
            try {
                startActivityForResult(Intent.createChooser(pick, "Choose photos"), FILE_CHOOSER_REQUEST);
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                Toast.makeText(MainActivity.this, "No gallery app found", Toast.LENGTH_SHORT).show();
                return false;
            }
            return true;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int n = data.getClipData().getItemCount();
                result = new Uri[n];
                for (int i = 0; i < n; i++) result[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) {
                result = new Uri[]{data.getData()};
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    /* ---------------- bridge used by the admin page ---------------- */
    private class Bridge {
        /** Saves an exported file (e.g. orders CSV) to the phone's Downloads folder. */
        @JavascriptInterface
        public void saveFile(String name, String mime, String text) {
            String safe = name.replaceAll("[^A-Za-z0-9._-]", "_");
            try {
                byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Downloads.DISPLAY_NAME, safe);
                    cv.put(MediaStore.Downloads.MIME_TYPE, mime);
                    cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (uri == null) throw new Exception("Could not create file");
                    try (OutputStream os = getContentResolver().openOutputStream(uri)) { os.write(bytes); }
                } else {
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    File f = new File(dir, safe);
                    try (FileOutputStream os = new FileOutputStream(f)) { os.write(bytes); }
                }
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Saved to Downloads: " + safe, Toast.LENGTH_LONG).show());
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Could not save file", Toast.LENGTH_SHORT).show());
            }
        }

        @JavascriptInterface
        public void retry() {
            runOnUiThread(() -> { showingError = false; web.loadUrl(ADMIN_URL); });
        }

        @JavascriptInterface
        public boolean isOnline() {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
            NetworkInfo ni = cm == null ? null : cm.getActiveNetworkInfo();
            return ni != null && ni.isConnected();
        }
    }
}
