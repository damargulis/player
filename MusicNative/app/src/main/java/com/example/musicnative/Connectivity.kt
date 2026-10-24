package com.example.musicnative

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData

/**
 * Whether the phone can actually reach the internet.
 *
 * Deliberately checks NET_CAPABILITY_VALIDATED rather than just "a network is attached": a wifi
 * network you are joined to but which has no route out - a captive portal, a router with the
 * uplink down - would otherwise read as online, and every streamed track would hang until it
 * timed out. Validated means Android has confirmed real connectivity.
 *
 * This is separate from [ServerConnection.connected], which tracks the desktop app on the LAN.
 * The two are independent: at home with the laptop asleep you are online but not connected; on
 * a train you may be neither.
 */
object Connectivity {
    private val online = MutableLiveData(false)

    /** True when the internet is reachable. Observed by the UI to decide what to show. */
    val isOnline: LiveData<Boolean> = online

    /** Synchronous read, for the playback service, which is not a lifecycle owner. */
    fun isOnlineNow(): Boolean = online.value == true

    private var registered = false

    fun start(context: Context) {
        if (registered) {
            return
        }
        registered = true
        val manager = context.applicationContext
            .getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

        // seed from the current network, so the first frame is not wrongly "offline"
        online.postValue(hasInternet(manager))

        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        manager.registerNetworkCallback(request, object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                online.postValue(hasInternet(manager))
            }

            override fun onLost(network: Network) {
                online.postValue(hasInternet(manager))
            }

            override fun onCapabilitiesChanged(
                network: Network,
                capabilities: NetworkCapabilities,
            ) {
                // the transition that matters most: joining a captive-portal wifi fires this
                // with VALIDATED false, then again with true once you have signed in
                online.postValue(hasInternet(manager))
            }
        })
    }

    private fun hasInternet(manager: ConnectivityManager): Boolean {
        val active = manager.activeNetwork ?: return false
        val capabilities = manager.getNetworkCapabilities(active) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }
}
