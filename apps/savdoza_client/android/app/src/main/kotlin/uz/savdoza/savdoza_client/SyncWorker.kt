package uz.savdoza.savdoza_client

import android.content.Context
import androidx.work.*
import org.json.JSONObject
import java.net.URL
import javax.net.ssl.HttpsURLConnection
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

class SyncWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        try {
            val root = DeviceStore.read(applicationContext)
            val session = root.optJSONObject("session") ?: return Result.success()
            val cookie = session.optString("cookie")
            if (!cookie.startsWith("savdoza_auth_token=")) return Result.success()
            val outbox = root.optJSONArray("outbox") ?: return Result.success()
            for (i in 0 until outbox.length()) {
                if (isStopped) return Result.retry()
                val order = outbox.getJSONObject(i)
                if (order.optString("status") != "pending" || order.optString("scope") != session.optString("scope")) continue
                // Recheck the current session before each request, including after logout/account switches.
                val current = DeviceStore.read(applicationContext).optJSONObject("session") ?: return Result.success()
                if (current.optString("scope") != session.optString("scope") || current.optString("cookie") != cookie) return Result.success()
                val server = URL(session.getString("server"))
                require(server.protocol == "https" && server.userInfo == null)
                require(order.getString("server") == session.getString("server"))
                val path = order.getString("path")
                require(path == "/api/sales" || path == "/api/debts/sale")
                val connection = URL(server.toString().trimEnd('/') + path).openConnection() as HttpsURLConnection
                try {
                    connection.instanceFollowRedirects = false
                    connection.requestMethod = "POST"
                    connection.connectTimeout = 15000
                    connection.readTimeout = 25000
                    connection.doOutput = true
                    connection.setRequestProperty("Cookie", cookie)
                    connection.setRequestProperty("Content-Type", "application/json")
                    connection.outputStream.use { it.write(order.getJSONObject("payload").toString().toByteArray(Charsets.UTF_8)) }
                    val status = connection.responseCode
                    val raw = (if (status in 200..299) connection.inputStream else connection.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
                    val body = runCatching { JSONObject(raw) }.getOrDefault(JSONObject())
                    val success = status in 200..299 && body.optBoolean("success")
                    DeviceStore.update(applicationContext) { latest ->
                        val entries = latest.getJSONArray("outbox")
                        for (j in 0 until entries.length()) {
                            val entry = entries.getJSONObject(j)
                            if (entry.optString("key") != order.getString("key") || entry.optString("status") == "synced") continue
                            if (success) {
                                val data = body.getJSONObject("data")
                                val receipt = if (path.endsWith("/sale")) data.getJSONObject("receipt") else data
                                entry.put("status", "synced").put("syncedAt", SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date())).put("receipt", receipt).remove("error")
                            } else {
                                val failure = body.opt("error")
                                val message = if (failure is JSONObject) failure.optString("message", "Sinxronlash bajarilmadi") else failure?.toString() ?: "Server javobi olinmadi"
                                entry.put("status", if (status == 400 || status == 409 || status == 404 || status == 422) "conflict" else "pending").put("error", message)
                            }
                        }
                    }
                    if (!success && (status == 401 || status == 403 || status >= 500 || status in 300..399)) return Result.retry()
                } finally { connection.disconnect() }
            }
            return Result.success()
        } catch (_: Exception) { return Result.retry() }
    }
    companion object {
        private fun constraints() = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        fun schedule(context: Context) {
            val manager = WorkManager.getInstance(context)
            manager.enqueueUniqueWork("savdoza-sync-now", ExistingWorkPolicy.KEEP,
                OneTimeWorkRequestBuilder<SyncWorker>().setConstraints(constraints()).setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build())
            manager.enqueueUniquePeriodicWork("savdoza-sync-periodic", ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES).setConstraints(constraints()).build())
        }
    }
}
