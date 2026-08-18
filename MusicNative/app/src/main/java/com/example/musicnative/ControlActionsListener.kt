package com.example.musicnative

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

const val PATH = "com.example.musicnative.action."
const val PREVIOUS_TRACK = PATH + "PREVIOUS_TRACK"
const val PLAYPAUSE = PATH +"PLAYPAUSE"
const val NEXT_TRACK = PATH +"NEXT_TRACK"
const val FINISH = PATH +"FINISH"
const val DISMISS = PATH + "DISMISS"
const val NOTIFICATION_DISMISSED = PATH + "NOTIFICATION_DISMISSED"

fun Context.sendIntent(action: String) {
    println("send intent!!")
    println("action")
    Intent(this, MediaPlaybackService::class.java).apply {
        println("In apply, starting")
        this.action = action
        startForegroundService(this)
    }
}

class ControlActionsListener : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        println("GOT INTENT!!")
        println(intent.action)
        when (val action = intent.action) {
            PREVIOUS_TRACK, PLAYPAUSE, NEXT_TRACK, FINISH, DISMISS -> context.sendIntent(action) // {

//                Intent(context, MediaPlaybackService::class.java).apply {
//                    println("Starting foreground service")
//                    println(action)
//                    println(context)
//                    println(intent)
//                    this.action = action
//                    startForegroundService(context, intent)
                // }
            // }
        }
    }
}
