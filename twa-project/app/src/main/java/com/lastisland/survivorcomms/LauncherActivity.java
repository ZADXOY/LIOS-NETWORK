package com.lastisland.survivorcomms;

import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * Full-screen WebView that loads the Last Island web app.
 * Uses WebView instead of TWA so no assetlinks.json verification is needed.
 * Supports notifications, vibration, and file uploads.
 */
public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private static final String WEB_APP_URL = "https://lios-network.vercel.app/";
    private static final String CHANNEL_ID = "last_island_notifications";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Create notification channel (Android 8+)
        createNotificationChannel();

        // Set up the WebView
        webView = new WebView(this);
        setContentView(webView);

        // Configure WebSettings
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " LastIslandApp/1.0");

        // Handle URL loading inside the WebView (don't open external browser for app URLs)
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // Keep app URLs inside the WebView
                if (url.contains("lios-network.vercel.app") || url.contains("vercel.app")) {
                    return false; // load in WebView
                }
                // Open external URLs (like Google OAuth) in the browser
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(intent);
                return true;
            }
        });

        // Enable Chrome client for notifications, file uploads, and other permissions
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                // Grant all requested permissions (notifications, camera, mic, etc.)
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });

        // Handle back button — navigate WebView history instead of closing the app
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });

        // Load the web app
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(WEB_APP_URL);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Keep JavaScript running in background for push notifications
    }

    @Override
    protected void onResume() {
        super.onResume();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Last Island Alerts",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Raid alarms and legion notifications");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{400, 200, 400, 200, 400});
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
