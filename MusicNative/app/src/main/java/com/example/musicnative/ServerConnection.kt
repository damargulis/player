package com.example.musicnative

import android.content.Context
import android.content.SharedPreferences
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Handler
import android.os.Looper
import androidx.lifecycle.MutableLiveData
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

const val SERVER_PORT = 4443
const val SUPPORTED_PROTOCOL = 1
private const val SERVICE_TYPE = "_mymusic._tcp"
private const val SCAN_WINDOW_MS = 10000L
private const val PING_TIMEOUT_MS = 3000
private const val LAST_HOST_KEY = "last-host"

/**
 * Owns the connection to the desktop app: mDNS discovery of the "_mymusic._tcp"
 * service, /ping verification of discovered hosts, the socket.io remote-control
 * channel, and the last-known-host cache used for instant reconnects.
 */
object ServerConnection {
    val connected = MutableLiveData(false)
    val remoteState = MutableLiveData(JSONObject())

    /** Base url of the desktop, e.g. "http://192.168.1.20:4443". */
    @Volatile
    var baseUrl: String? = null
        private set

    private var socket: Socket? = null
    private var nsdManager: NsdManager? = null
    private var discoveryListener: NsdManager.DiscoveryListener? = null
    private var prefs: SharedPreferences? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private val stopScanRunnable = Runnable { stopDiscovery() }
    private var started = false

    fun start(context: Context) {
        if (started) {
            return
        }
        started = true
        prefs = context.getSharedPreferences("server", Context.MODE_PRIVATE)
        nsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
        // try the last known address immediately while discovery runs
        prefs?.getString(LAST_HOST_KEY, null)?.let { connectTo(it) }
        rescan()
    }

    /** Connects directly, used for the last known host and manual IP entry. */
    fun connectTo(url: String) {
        baseUrl = url
        setupSocket(url)
    }

    fun connectToIp(ip: String) {
        connectTo("http://$ip:$SERVER_PORT")
    }

    fun emit(type: String, data: Any? = null) {
        val payload = JSONObject()
        payload.put("type", type)
        if (data != null) {
            payload.put("data", data)
        }
        socket?.emit("action", payload)
    }

    fun rescan() {
        stopDiscovery()
        val manager = nsdManager ?: return
        val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(serviceType: String?) {}
            override fun onDiscoveryStopped(serviceType: String?) {}
            override fun onStartDiscoveryFailed(serviceType: String?, errorCode: Int) {}
            override fun onStopDiscoveryFailed(serviceType: String?, errorCode: Int) {}
            override fun onServiceLost(serviceInfo: NsdServiceInfo?) {}
            override fun onServiceFound(serviceInfo: NsdServiceInfo?) {
                serviceInfo ?: return
                manager.resolveService(serviceInfo, object : NsdManager.ResolveListener {
                    override fun onResolveFailed(info: NsdServiceInfo?, errorCode: Int) {}
                    override fun onServiceResolved(info: NsdServiceInfo?) {
                        val address = info?.host?.hostAddress ?: return
                        // ipv6 literals need brackets inside a url
                        val host = if (address.contains(":")) "[$address]" else address
                        onHostDiscovered("http://$host:${info.port}")
                    }
                })
            }
        }
        discoveryListener = listener
        try {
            manager.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
        } catch (e: Exception) {
            discoveryListener = null
            return
        }
        mainHandler.removeCallbacks(stopScanRunnable)
        mainHandler.postDelayed(stopScanRunnable, SCAN_WINDOW_MS)
    }

    private fun onHostDiscovered(url: String) {
        if (url == baseUrl && connected.value == true) {
            return
        }
        thread {
            if (verifyHost(url)) {
                mainHandler.post {
                    stopDiscovery()
                    connectTo(url)
                }
            }
        }
    }

    /**
     * Confirms a discovered address actually belongs to the desktop app before
     * trusting it. Old desktop builds have no /ping, so a 404 also passes.
     */
    private fun verifyHost(url: String): Boolean {
        return try {
            val connection = URL("$url/ping").openConnection() as HttpURLConnection
            connection.connectTimeout = PING_TIMEOUT_MS
            connection.readTimeout = PING_TIMEOUT_MS
            connection.requestMethod = "GET"
            connection.connect()
            val result = when (connection.responseCode) {
                HttpURLConnection.HTTP_NOT_FOUND -> true
                HttpURLConnection.HTTP_OK -> {
                    val body = connection.inputStream.bufferedReader().use { it.readText() }
                    val json = JSONObject(body)
                    // desktops older than /ping report no protocol; treat as compatible
                    json.optString("app") == "MyMusic" &&
                        (!json.has("protocol") || json.getInt("protocol") == SUPPORTED_PROTOCOL)
                }
                else -> false
            }
            connection.disconnect()
            result
        } catch (e: Exception) {
            false
        }
    }

    private fun setupSocket(url: String) {
        socket?.off()
        socket?.disconnect()
        val newSocket = try {
            IO.socket(url)
        } catch (e: Exception) {
            return
        }
        socket = newSocket
        newSocket.on(Socket.EVENT_CONNECT) {
            connected.postValue(true)
            prefs?.edit()?.putString(LAST_HOST_KEY, url)?.apply()
            mainHandler.post { stopDiscovery() }
        }
        newSocket.on(Socket.EVENT_DISCONNECT) {
            connected.postValue(false)
            // the desktop may have moved to a new address; look for it again
            mainHandler.post { rescan() }
        }
        newSocket.on("state") { args ->
            (args.getOrNull(0) as? JSONObject)?.let { remoteState.postValue(it) }
        }
        newSocket.on("dj-state") { args ->
            (args.getOrNull(0) as? JSONObject)?.let { DJChatState.update(it) }
        }
        newSocket.connect()
    }

    private fun stopDiscovery() {
        mainHandler.removeCallbacks(stopScanRunnable)
        val listener = discoveryListener ?: return
        discoveryListener = null
        try {
            nsdManager?.stopServiceDiscovery(listener)
        } catch (e: Exception) {
            // discovery may have already stopped
        }
    }
}
