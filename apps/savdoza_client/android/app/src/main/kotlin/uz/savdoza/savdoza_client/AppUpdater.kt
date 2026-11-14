package uz.savdoza.savdoza_client

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File
import java.net.URL
import java.security.MessageDigest
import javax.net.ssl.HttpsURLConnection

class AppUpdater(private val activity: Activity) {
    private val directory get() = File(activity.filesDir, "updates").apply { mkdirs() }
    private val apk get() = File(directory, "savdoza-update.apk")
    private val manager get() = activity.packageManager

    @Suppress("DEPRECATION")
    private fun flags() = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES

    @Suppress("DEPRECATION")
    private fun installed() = manager.getPackageInfo(activity.packageName, flags())

    @Suppress("DEPRECATION")
    private fun code(info: PackageInfo) = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()

    @Suppress("DEPRECATION")
    private fun signers(info: PackageInfo): Set<String> {
        val signatures = if (Build.VERSION.SDK_INT >= 28) info.signingInfo?.apkContentsSigners else info.signatures
        return signatures.orEmpty().map { signature -> digest(signature.toByteArray()) }.toSet()
    }

    private fun digest(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    fun version(): Map<String, Any> = installed().let { mapOf("version" to (it.versionName ?: ""), "build" to code(it)) }

    @Suppress("DEPRECATION")
    private fun validate(file: File, build: Long) {
        val archive = manager.getPackageArchiveInfo(file.absolutePath, flags()) ?: error("APK fayli ochilmadi")
        val current = installed()
        require(archive.packageName == activity.packageName && code(archive) == build && code(archive) > code(current)) { "APK versiyasi mos kelmadi" }
        require(signers(current).isNotEmpty() && signers(archive) == signers(current)) { "Yangilanish imzosi mos kelmadi. Ilovani o‘chirmang, yordam xizmatiga murojaat qiling" }
    }

    fun download(url: String, sha256: String, expectedBytes: Long, build: Long) {
        val initial = URL(url)
        require(initial.protocol == "https" && initial.host == "github.com" && initial.userInfo == null && initial.path == "/Rasulbek917/Shop_uz-/releases/download/android-latest/savdoza-android.apk") { "Yangilanish manzili noto‘g‘ri" }
        require(sha256.matches(Regex("[a-fA-F0-9]{64}")) && expectedBytes in 1..209715200) { "Yangilanish ma’lumotlari noto‘g‘ri" }
        val temporary = File(directory, "download.part.apk")
        temporary.delete()
        var current = initial
        try {
            for (redirect in 0..5) {
                require(current.protocol == "https" && current.userInfo == null && current.host in setOf("github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com")) { "Yuklab olish manzili tasdiqlanmadi" }
                val connection = current.openConnection() as HttpsURLConnection
                try {
                    connection.instanceFollowRedirects = false
                    connection.connectTimeout = 15000
                    connection.readTimeout = 45000
                    connection.setRequestProperty("Accept", "application/octet-stream")
                    val status = connection.responseCode
                    if (status in setOf(301, 302, 303, 307, 308)) {
                        current = URL(current, connection.getHeaderField("Location") ?: error("Yuklab olish havolasi olinmadi"))
                        continue
                    }
                    require(status == 200) { "Yuklab olish bajarilmadi. Qayta urinib ko‘ring" }
                    val hash = MessageDigest.getInstance("SHA-256")
                    var total = 0L
                    val deadline = System.nanoTime() + 15L * 60 * 1000000000
                    connection.inputStream.use { input ->
                        temporary.outputStream().use { output ->
                            val buffer = ByteArray(65536)
                            while (true) {
                                val count = input.read(buffer)
                                if (count < 0) break
                                total += count
                                require(total <= expectedBytes && System.nanoTime() < deadline) { "Yuklab olish hajmi yoki vaqti chegaradan oshdi" }
                                hash.update(buffer, 0, count)
                                output.write(buffer, 0, count)
                            }
                        }
                    }
                    require(total == expectedBytes && hash.digest().joinToString("") { "%02x".format(it) }.equals(sha256, true)) { "APK fayli to‘liq yuklanmadi. Qayta urinib ko‘ring" }
                    validate(temporary, build)
                    apk.delete()
                    require(temporary.renameTo(apk)) { "Yangilanish saqlanmadi" }
                    return
                } finally { connection.disconnect() }
            }
            error("Yuklab olish havolalari chegaradan oshdi")
        } finally { temporary.delete() }
    }

    fun install(build: Long): String {
        require(apk.exists()) { "Avval yangilanishni yuklab oling" }
        validate(apk, build)
        if (Build.VERSION.SDK_INT >= 26 && !manager.canRequestPackageInstalls()) {
            activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}")))
            return "permission"
        }
        val uri = FileProvider.getUriForFile(activity, activity.packageName + ".updates", apk)
        activity.startActivity(Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        })
        return "installer"
    }
}
