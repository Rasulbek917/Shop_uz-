package uz.savdoza.savdoza_client

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import org.json.JSONObject
import org.json.JSONArray
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

object DeviceStore {
    private const val ALIAS = "savdoza_offline_store_v1"
    private val lock = Any()
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    private fun file(context: Context) = AtomicFile(File(context.filesDir, "savdoza-offline.enc"))
    private fun readUnlocked(context: Context): JSONObject {
        val file = file(context)
        val bytes = try { file.openRead().use { it.readBytes() } }
        catch (error: java.io.FileNotFoundException) {
            if (file.baseFile.exists()) throw error
            return JSONObject().put("caches", JSONObject()).put("outbox", JSONArray())
        }
        require(bytes.size > 28) { "Saqlangan ma’lumot buzilgan" }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
        return JSONObject(String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8))
    }
    private fun writeUnlocked(context: Context, data: JSONObject) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val bytes = cipher.iv + cipher.doFinal(data.toString().toByteArray(Charsets.UTF_8))
        val target = file(context)
        val stream = target.startWrite()
        try { stream.write(bytes); target.finishWrite(stream) }
        catch (error: Exception) { target.failWrite(stream); throw error }
    }
    fun read(context: Context): JSONObject = synchronized(lock) { readUnlocked(context) }
    fun update(context: Context, operation: (JSONObject) -> Unit) = synchronized(lock) {
        val root = readUnlocked(context)
        operation(root)
        writeUnlocked(context, root)
    }
    fun mutate(context: Context, action: String, data: JSONObject) = update(context) { root ->
        val outbox = root.optJSONArray("outbox") ?: JSONArray().also { root.put("outbox", it) }
        when (action) {
            "session" -> root.put("session", data.opt("session") ?: JSONObject.NULL)
            "cache" -> {
                val caches = root.optJSONObject("caches") ?: JSONObject().also { root.put("caches", it) }
                caches.put(data.getString("scope"), data.getJSONObject("cache"))
            }
            "enqueue" -> {
                val order = data.getJSONObject("order")
                require(Regex("MOB-[a-f0-9]{64}").matches(order.getString("key")))
                require(order.getJSONObject("payload").getString("idempotencyKey") == order.getString("key"))
                val session = root.getJSONObject("session")
                require(order.getString("scope") == session.getString("scope"))
                require(order.getString("server") == session.getString("server"))
                if ((0 until outbox.length()).none { outbox.getJSONObject(it).getString("key") == order.getString("key") }) outbox.put(order)
            }
            "retry" -> for (i in 0 until outbox.length()) {
                val order = outbox.getJSONObject(i)
                if (order.optString("key") == data.optString("key") && order.optString("status") != "synced"
                    && order.optString("scope") == root.optJSONObject("session")?.optString("scope")) {
                    order.put("status", "pending").remove("error")
                }
            }
            else -> error("Noma’lum saqlash amali")
        }
    }
}
