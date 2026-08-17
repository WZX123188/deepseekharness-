package com.dshclient;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** WebView 包壳：加载内置 PWA（连接电脑端 3191 远程服务）。语音识别走 Android 原生 SpeechRecognizer；文件下载并打开。 */
public class MainActivity extends Activity {
    private WebView webView;
    private SpeechRecognizer speechRecognizer;
    private final Map<Long, String> pendingDownloads = new HashMap<>();

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
        });

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                doDownloadAndOpen(url, nameFromUrl(url));
            }
        });

        // WebView 权限（摄像头 getUserMedia 等）授权
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            request.grant(request.getResources());
                        }
                    }
                });
            }
        });

        // JSBridge：语音识别 + 文件下载打开
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void startSpeech() {
                runOnUiThread(new Runnable() { @Override public void run() { startNativeSpeech(); } });
            }
            @JavascriptInterface
            public void stopSpeech() {
                runOnUiThread(new Runnable() { @Override public void run() { stopNativeSpeech(); } });
            }
            @JavascriptInterface
            public boolean hasSpeech() { return SpeechRecognizer.isRecognitionAvailable(MainActivity.this); }
            @JavascriptInterface
            public void downloadAndOpen(final String url, final String name) {
                runOnUiThread(new Runnable() { @Override public void run() { doDownloadAndOpen(url, name); } });
            }
        }, "AndroidBridge");

        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");

        // 下载完成广播 → 打开文件
        registerReceiver(new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                String name = pendingDownloads.remove(id);
                if (name != null) openDownloaded(name);
            }
        }, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));

        // 自动申请麦克风 + 摄像头权限（Android 6.0+ 运行时权限）
        if (Build.VERSION.SDK_INT >= 23) {
            ArrayList<String> need = new ArrayList<>();
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) need.add(Manifest.permission.RECORD_AUDIO);
            if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) need.add(Manifest.permission.CAMERA);
            if (!need.isEmpty()) {
                requestPermissions(need.toArray(new String[0]), 100);
            }
        }
    }

    private String nameFromUrl(String url) {
        try {
            String name = url.substring(url.lastIndexOf('/') + 1);
            int q = name.indexOf('?');
            if (q >= 0) name = name.substring(0, q);
            return name;
        } catch (Exception e) { return "file"; }
    }

    private void doDownloadAndOpen(String url, String name) {
        try {
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            try { r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name); }
            catch (Exception e) { r.setDestinationInExternalFilesDir(MainActivity.this, Environment.DIRECTORY_DOWNLOADS, name); }
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm != null) {
                long id = dm.enqueue(r);
                pendingDownloads.put(id, name);
            }
        } catch (Exception e) { toast("下载失败：" + e.getMessage()); }
    }

    private void openDownloaded(String name) {
        try {
            File f = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), name);
            if (!f.exists()) f = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), name);
            if (!f.exists()) { toast("文件未找到"); return; }
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", f);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, mimeType(name));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(intent, "打开文件"));
        } catch (Exception e) { toast("无法打开文件：" + e.getMessage()); }
    }

    private String mimeType(String name) {
        String l = name.toLowerCase();
        if (l.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (l.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        if (l.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        if (l.endsWith(".pdf")) return "application/pdf";
        if (l.endsWith(".txt") || l.endsWith(".md") || l.endsWith(".log")) return "text/plain";
        if (l.endsWith(".jpg") || l.endsWith(".jpeg")) return "image/jpeg";
        if (l.endsWith(".png")) return "image/png";
        if (l.endsWith(".apk")) return "application/vnd.android.package-archive";
        if (l.endsWith(".mp4")) return "video/mp4";
        if (l.endsWith(".mp3")) return "audio/mpeg";
        return "*/*";
    }

    private void toast(String msg) {
        try { Toast.makeText(this, msg, Toast.LENGTH_SHORT).show(); } catch (Exception e) {}
    }

    private void callJs(String fn, String arg) {
        if (webView == null) return;
        String js = fn + "(" + (arg == null ? "" : "'" + arg.replace("\\", "\\\\").replace("'", "\\'") + "'") + ")";
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                webView.evaluateJavascript(js, null);
            }
        });
    }

    private void startNativeSpeech() {
        stopNativeSpeech();
        try {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
            speechRecognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) { callJs("window.__onSpeechEvent", "ready"); }
                @Override public void onBeginningOfSpeech() {}
                @Override public void onRmsChanged(float rmsdB) {}
                @Override public void onBufferReceived(byte[] buffer) {}
                @Override public void onEndOfSpeech() {}
                @Override public void onError(int error) {
                    String msg = "语音识别失败";
                    if (error == SpeechRecognizer.ERROR_NO_MATCH) msg = "没有听清，请重试";
                    else if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) msg = "麦克风权限被拒绝，请在系统设置里开启";
                    callJs("window.__onSpeechEvent", "error:" + msg);
                    stopNativeSpeech();
                }
                @Override public void onResults(Bundle results) {
                    try {
                        ArrayList<String> r = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        String text = (r != null && !r.isEmpty()) ? r.get(0) : "";
                        callJs("window.__onSpeechEvent", "result:" + text);
                    } catch (Exception e) { callJs("window.__onSpeechEvent", "error:解析失败"); }
                    stopNativeSpeech();
                }
                @Override public void onPartialResults(Bundle partialResults) {}
                @Override public void onEvent(int eventType, Bundle params) {}
            });
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "zh-CN");
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
            speechRecognizer.startListening(intent);
        } catch (Exception e) {
            callJs("window.__onSpeechEvent", "error:" + e.getMessage());
        }
    }

    private void stopNativeSpeech() {
        if (speechRecognizer != null) {
            try { speechRecognizer.destroy(); } catch (Exception e) {}
            speechRecognizer = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        stopNativeSpeech();
        try { unregisterReceiver(null); } catch (Exception e) {}
        if (webView != null) { webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
