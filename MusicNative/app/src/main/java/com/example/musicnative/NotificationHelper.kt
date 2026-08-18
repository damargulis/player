package com.example.musicnative

import android.app.Notification
import android.app.NotificationChannel
import android.content.Context
import android.support.v4.media.session.MediaSessionCompat
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat.getSystemService

class NotificationHelper(private val context: Context, private val mediaSessionToken: MediaSessionCompat.Token) {
    private var notificationManager: NotificationManager = getSystemService(context, NotificationManager::class.java) as NotificationManager

    fun createPlayerNotification(track: TrackData, isPlaying: Boolean, callback: (Notification) -> Unit) {
//        val notificationDismissedIntent = Intent(context, NotificationDismissedReceiver::class.java).apply {
//            action = NOTIFICATION_DISMISSED
//        }
        //val flags = PendingIntent.FLAG_CANCEL_CURRENT or PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        // val notificationDismissedPendingIntent = PendingIntent.getActivity(context, 0, notificationDismissedIntent, flags)
        //val notificationDismissedPendingIntent = PendingIntent.getBroadcast(context, 0, notificationDismissedIntent, flags)
/*        val dismissAction = NotificationCompat.Action.Builder(
            R.drawable.ic_headset_small_background,
            DISMISS,
            getIntent(DISMISS)
        ).build()*/

        val previousAction = NotificationCompat.Action.Builder(
            R.drawable.ic_baseline_keyboard_arrow_left_24,
            context.getString(R.string.previous),
            getIntent(PREVIOUS_TRACK)
        ).build()

        val playPauseIcon = if (isPlaying) R.drawable.ic_baseline_pause_24 else R.drawable.ic_baseline_play_arrow_24
        val playPauseAction = NotificationCompat.Action.Builder(
            playPauseIcon,
            context.getString(R.string.playpause),
            getIntent(PLAYPAUSE)
        ).build()

        val nextAction = NotificationCompat.Action.Builder(
            R.drawable.ic_baseline_keyboard_arrow_right_24,
            "next",
            getIntent(NEXT_TRACK)
        ).build()

        val artistName = combineNames(track.artists)
        val builder = NotificationCompat.Builder(context, NOTIFICATION_CHANNEL)
            .setContentTitle(track.track.name)
            .setContentText(artistName)
            .setSmallIcon(R.drawable.ic_baseline_headset_24)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setChannelId(NOTIFICATION_CHANNEL)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setStyle(androidx.media.app.NotificationCompat.MediaStyle()
                .setShowActionsInCompactView(0, 1, 2)
                .setMediaSession(mediaSessionToken)
            )
            //.setDeleteIntent(notificationDismissedPendingIntent)
            //.addAction(dismissAction)
            .addAction(previousAction)
            .addAction(playPauseAction)
            .addAction(nextAction)
        callback(builder.build())
    }

    fun notify(id: Int, notification: Notification) = notificationManager.notify(id, notification)

    companion object {
        private const val NOTIFICATION_CHANNEL = "music_player_channel"
        private fun createNotificationChannel(
            context: Context,
            notificationManager: NotificationManager
        ) {
            var notificationChannel: NotificationChannel? =
                notificationManager.getNotificationChannel(NOTIFICATION_CHANNEL)
            if (notificationChannel == null) {
                notificationChannel = NotificationChannel(
                    NOTIFICATION_CHANNEL,
                    context.getString(R.string.app_name),
                    NotificationManager.IMPORTANCE_LOW
                )
                notificationChannel.enableLights(false)
                notificationChannel.enableVibration(false)
                notificationChannel.setShowBadge(false)
                notificationManager.createNotificationChannel(notificationChannel)
            }
        }

        fun createInstance(context: Context, mediaSession: MediaSessionCompat): NotificationHelper {
            createNotificationChannel(context, getSystemService(context, NotificationManager::class.java) as NotificationManager)
            return NotificationHelper(context, mediaSession.sessionToken)
        }
    }

    private fun getIntent(action: String): PendingIntent {
        val intent = Intent(context, ControlActionsListener::class.java)
        intent.action = action
        return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

}
