package com.example.musicnative

import android.content.Intent
import android.os.Bundle
import android.support.v4.media.session.MediaSessionCompat


class MediaSessionCallback(private val service: MediaPlaybackService) : MediaSessionCompat.Callback() {
    override fun onMediaButtonEvent(mediaButtonEvent: Intent): Boolean {
        println("ON MEDIA BUTTON EVENT SESSION CALLBACK")
        println("!!!!!!!")
        println(mediaButtonEvent)
        service.handleMediaButton(mediaButtonEvent)
        return true
    }

    override fun onPlay() {
        service.resumeTrack()
    }

    override fun onPause() {
        service.pauseTrack()
    }

    override fun onStop() {
        service.pauseTrack()
    }

    override fun onSkipToNext() {
        println("!!!!!!!")
        println("ON SKIP TO NEXT MEDIA SESSION CALLBACK!!!!")
        service.handleNextTrack()
    }

    override fun onSkipToPrevious() {
        println("ON SKIP TO PREVIOUS")
        service.handlePreviousTrack()
    }

    override fun onSeekTo(pos: Long) {
        service.updateProgress((pos / 1000).toInt())
    }

    override fun onCustomAction(action: String?, extras: Bundle?) {
        when (action) {
            DISMISS -> service.handleDismiss()
        }
    }
}
