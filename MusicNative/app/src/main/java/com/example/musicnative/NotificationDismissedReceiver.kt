package com.example.musicnative

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat.startForegroundService

class NotificationDismissedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        println("on receive dismiss")
        Intent(context, MediaPlaybackService::class.java).apply {
            this.action = DISMISS
            println("Sending dismiss intent")
            startForegroundService(context!!, this)
        }
        //context.sendIntent(DISMISS)
    }
}
