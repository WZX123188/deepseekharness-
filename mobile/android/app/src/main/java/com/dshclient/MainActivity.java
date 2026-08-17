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
import android.database.Cursor;
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

import java.util.ArrayList;
import java.util.Locale;

/** WebView 包壳：加载内置 PWA（连接电脑端 3191 远程服务）。语音识别走 Android 原生 SpeechRecognizer；文件下载后打开。 */
public class MainActivity extends Activity {
    private WebView webView;
    private SpeechRecognizer speechRecognizer;

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

        // 下载完成广播 → 用 DownloadManager 的 content URI 直接打开
        BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (id >= 0) openDownloaded(id);
            }
        };
        IntentFilter downloadFilter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(downloadReceiver, downloadFilter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(downloadReceiver, downloadFilter);
        }

        if (Build.VERSION.SDK_INT >= 23) {
            ArrayList<String> need = new ArrayList<>();
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) need.add(Manifest.permission.RECORD_AUDIO);
            if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) need.add(Manifest.permission.CAMERA);
            if (!need.isEmpty()) requestPermissions(need.toArray(new String[0]), 100);
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
            if (dm != null) dm.enqueue(r);
        } catch (Exception e) { toast("下载失败：" + e.getMessage()); }
    }

    private void openDownloaded(long downloadId) {
        try {
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            DownloadManager.Query q = new DownloadManager.Query();
            q.setFilterById(downloadId);
            Cursor c = dm.query(q);
            if (c != null && c.moveToFirst()) {
                String uriStr = c.getString(c.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI));
                String mime = c.getString(c.getColumnIndex(DownloadManager.COLUMN_MEDIA_TYPE));
                c.close();
                if (uriStr != null) {
                    Intent intent = new Intent(Intent.ACTION_VIEW);
                    intent.setDataAndType(Uri.parse(uriStr), (mime != null && !mime.isEmpty()) ? mime : "*/*");
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(intent, "打开文件"));
                    return;
                }
            }
            if (c != null) c.close();
            toast("文件已下载到 Download 目录");
        } catch (Exception e) { toast("无法打开文件：" + e.getMessage()); }
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
        if (webView != null) { webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
