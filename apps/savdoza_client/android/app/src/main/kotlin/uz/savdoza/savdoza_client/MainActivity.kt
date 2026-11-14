package uz.savdoza.savdoza_client

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.print.PrintManager
import android.content.Context
import android.util.Base64
import android.webkit.WebView
import android.webkit.WebViewClient
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import org.json.JSONObject
import java.util.concurrent.Executors

class MainActivity : FlutterActivity() {
    private val io = Executors.newSingleThreadExecutor()
    private var saveResult: MethodChannel.Result? = null
    private var saveBytes: ByteArray? = null
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "savdoza/device").setMethodCallHandler { call, result ->
            when (call.method) {
                "readStore", "store" -> io.execute {
                    try {
                        val value = if (call.method == "readStore") DeviceStore.read(this).toString() else {
                            val data = JSONObject(call.arguments as Map<*, *>)
                            DeviceStore.mutate(this, data.getString("action"), data)
                            if (data.getString("action") == "enqueue" || data.getString("action") == "retry") SyncWorker.schedule(this)
                            "ok"
                        }
                        Handler(Looper.getMainLooper()).post { result.success(value) }
                    } catch (_: Exception) { Handler(Looper.getMainLooper()).post { result.error("STORE", "Telefon ma’lumotlarini saqlash yoki ochish bajarilmadi", null) } }
                }
                "sync" -> { SyncWorker.schedule(this, call.argument<Boolean>("force") == true); result.success(null) }
                "saveFile" -> {
                    if (saveResult != null) result.error("BUSY", "Fayl saqlash oynasi ochiq", null)
                    else {
                        saveBytes = call.argument<ByteArray>("bytes")
                        saveResult = result
                        startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                            addCategory(Intent.CATEGORY_OPENABLE)
                            type = call.argument<String>("mime") ?: "image/png"
                            putExtra(Intent.EXTRA_TITLE, call.argument<String>("filename") ?: "savdoza.png")
                        }, 7341)
                    }
                }
                "printPng" -> {
                    val bytes = call.argument<ByteArray>("bytes")
                    if (bytes == null) result.error("PRINT", "Chek rasmi olinmadi", null)
                    else {
                        val view = WebView(this)
                        view.settings.javaScriptEnabled = false
                        view.webViewClient = object : WebViewClient() {
                            override fun onPageFinished(web: WebView, url: String) {
                                val manager = getSystemService(Context.PRINT_SERVICE) as PrintManager
                                manager.print("Savdoza chek", web.createPrintDocumentAdapter("Savdoza chek"), null)
                                result.success(null)
                            }
                        }
                        view.loadDataWithBaseURL(null, "<html><head><style>@page{margin:0}body{margin:0}img{width:58mm;max-width:100%}</style></head><body><img src='data:image/png;base64,${Base64.encodeToString(bytes, Base64.NO_WRAP)}'></body></html>", "text/html", "UTF-8", null)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }
    @Deprecated("Android activity result compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != 7341) return
        val pending = saveResult ?: return
        saveResult = null
        val bytes = saveBytes
        saveBytes = null
        if (resultCode != Activity.RESULT_OK || data?.data == null || bytes == null) { pending.success(null); return }
        try { requireNotNull(contentResolver.openOutputStream(data.data!!)).use { it.write(bytes) }; pending.success(data.data.toString()) }
        catch (_: Exception) { pending.error("SAVE", "Fayl saqlanmadi", null) }
    }
}
