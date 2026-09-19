package com.example.webviewgenerator

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.annotation.BoolRes
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var refresh: SwipeRefreshLayout
    private var uploadCallback: ValueCallback<Array<Uri>>? = null

    private fun getBoolean(@BoolRes id: Int): Boolean = resources.getBoolean(id)

    private val startUrl: String
        get() = getString(R.string.start_url)

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        refresh = SwipeRefreshLayout(this)
        webView = WebView(this)

        refresh.addView(webView)
        refresh.isEnabled = getBoolean(R.bool.feature_pull_refresh)
        setContentView(refresh)

        configureWebView()

        if (savedInstanceState == null) {
            webView.loadUrl(startUrl)
        } else {
            webView.restoreState(savedInstanceState)
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        CookieManager.getInstance().setAcceptCookie(true)

        webView.settings.apply {
            javaScriptEnabled = getBoolean(R.bool.feature_javascript)
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = true
            builtInZoomControls = false
            displayZoomControls = false
            setSupportMultipleWindows(false)
            mediaPlaybackRequiresUserGesture = false
        }

        if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
            WebSettingsCompat.setForceDark(
                webView.settings,
                if (getBoolean(R.bool.feature_dark_mode)) {
                    WebSettingsCompat.FORCE_DARK_ON
                } else {
                    WebSettingsCompat.FORCE_DARK_OFF
                }
            )
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val uri = request.url
                val scheme = uri.scheme?.lowercase()

                if (scheme == "http" || scheme == "https") {
                    return false
                }

                if (!getBoolean(R.bool.feature_external_links)) {
                    return true
                }

                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    true
                } catch (_: ActivityNotFoundException) {
                    true
                }
            }

            override fun onPageFinished(view: WebView, url: String?) {
                refresh.isRefreshing = false
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: android.webkit.WebResourceError
            ) {
                if (request.isForMainFrame) {
                    refresh.isRefreshing = false
                }
            }
        }

        if (getBoolean(R.bool.feature_file_upload)) {
            webView.webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView,
                    filePathCallback: ValueCallback<Array<Uri>>,
                    fileChooserParams: FileChooserParams
                ): Boolean {
                    uploadCallback?.onReceiveValue(null)
                    uploadCallback = filePathCallback

                    return try {
                        startActivityForResult(
                            fileChooserParams.createIntent(),
                            FILE_CHOOSER_REQUEST
                        )
                        true
                    } catch (_: ActivityNotFoundException) {
                        uploadCallback = null
                        false
                    }
                }
            }
        }

        if (getBoolean(R.bool.feature_pull_refresh)) {
            refresh.setOnRefreshListener {
                webView.reload()
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    @Deprecated("Deprecated in Android API")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == FILE_CHOOSER_REQUEST) {
            uploadCallback?.onReceiveValue(
                if (resultCode == RESULT_OK) {
                    data?.data?.let { arrayOf(it) }
                } else {
                    null
                }
            )
            uploadCallback = null
        }
    }

    override fun onDestroy() {
        webView.apply {
            stopLoading()
            webChromeClient = null
            loadUrl("about:blank")
            clearHistory()
            removeAllViews()
            destroy()
        }
        super.onDestroy()
    }

    companion object {
        private const val FILE_CHOOSER_REQUEST = 1001
    }
}
