package com.example.musicnative

import android.content.Context
import android.content.Intent
import androidx.lifecycle.MutableLiveData

// player command actions handled by MediaPlaybackService.onStartCommand
const val SEEK_TO = PATH + "SEEK_TO"
const val SKIP_TO_INDEX = PATH + "SKIP_TO_INDEX"
const val SHUFFLE_UPCOMING = PATH + "SHUFFLE_UPCOMING"
const val EXTRA_SEEK_MS = "extra_seek_ms"
const val EXTRA_QUEUE_INDEX = "extra_queue_index"

/**
 * Local playback state published by MediaPlaybackService and observed by the
 * Compose UI (now-playing bar, player screen, track-row highlights).
 */
object PlaybackState {
    val currentTrack = MutableLiveData<TrackData?>(null)
    val queue = MutableLiveData<List<TrackData>>(emptyList())
    val currentIndex = MutableLiveData(-1)
    val isPlaying = MutableLiveData(false)
    val positionMs = MutableLiveData(0)
    val durationMs = MutableLiveData(0)
    val repeatAll = MutableLiveData(false)

    /** Mirror of repeatAll readable from the service's threads. */
    @Volatile
    var repeatEnabled = false
        private set

    fun setRepeat(enabled: Boolean) {
        repeatEnabled = enabled
        repeatAll.postValue(enabled)
    }
}

/** Sends a command intent to the playback service. */
fun playerCommand(context: Context, action: String, configure: Intent.() -> Unit = {}) {
    val intent = Intent(context, MediaPlaybackService::class.java)
    intent.action = action
    intent.configure()
    try {
        context.startService(intent)
    } catch (_: Exception) {
    }
}
