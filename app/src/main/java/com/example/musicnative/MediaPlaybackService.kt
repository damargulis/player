package com.example.musicnative

import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.AudioManager.OnAudioFocusChangeListener
import android.media.MediaPlayer
import android.net.Uri
import android.os.Handler
import android.os.IBinder
import android.os.PowerManager
import android.provider.MediaStore
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.view.KeyEvent
import androidx.media.session.MediaButtonReceiver

const val NOTIFICATION_ID = 1

class MediaPlaybackService : Service(), MediaPlayer.OnPreparedListener, MediaPlayer.OnErrorListener, MediaPlayer.OnCompletionListener, OnAudioFocusChangeListener {
    companion object {
        private var mMediaSession: MediaSessionCompat? = null
        var mPlayer: MediaPlayer? = null
        fun isPlaying(): Boolean {
            return try {
                mPlayer?.isPlaying == true
            } catch (e: Exception) {
                false
            }
        }
    }
    override fun onBind(intent: Intent?): IBinder? = null

    private var notificationHelper: NotificationHelper? = null
    private val notificationHandler = Handler()
    private var mCurrTrack: TrackData? = null
    private var mCurrIndex: Int? = null
    private var curPlaylist: Array<TrackData> = arrayOf()
    private lateinit var playCounter: PlayTracker
    override fun onCreate() {
        super.onCreate()
        playCounter = PlayTracker(this)
        println("Media Playback Service onCreate")
        mMediaSession = MediaSessionCompat(this, "MusicService")
        val mediaButtonIntent = Intent(Intent.ACTION_MEDIA_BUTTON)
        PendingIntent.getBroadcast(
            baseContext,
            0,
            mediaButtonIntent,
            PendingIntent.FLAG_IMMUTABLE
        )
        val mediaSessionCallback = MediaSessionCallback(this)
        mMediaSession!!.setCallback(mediaSessionCallback)
        println("Creating notification helper")
        notificationHelper = NotificationHelper.createInstance(context = this, mMediaSession!!)
        startForegroundAndNotify()
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }

    private fun startForegroundAndNotify() {
        println("Starting foreground and notify")
        notificationHandler.removeCallbacksAndMessages(null)
        if (mCurrTrack != null) {
            println("Post deplayed")
            notificationHandler.postDelayed({
                println("inner post deplayed")
                notificationHelper?.createPlayerNotification(
                    track = mCurrTrack!!, isPlaying = isPlaying()
                ) {
                    println("Calling notify")
                    notificationHelper?.notify(NOTIFICATION_ID, it)
                    try {
                        println("starting foreground")
                        startForeground(NOTIFICATION_ID, it, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
                    } catch (_: java.lang.IllegalStateException) {}
                }
            }, 200L)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        // destroyPlayer()
        mMediaSession?.isActive = false
        mMediaSession = null
    }

    override fun onStartCommand(intent: Intent, flags: Int, startId: Int): Int {
        println("GOT START COMMAND")
        println(intent.action)
        when (intent.action) {
            PLAY_TRACK -> playTrack(intent)
            PLAY_PLAYLIST -> playPlaylist(intent)
            PREVIOUS_TRACK -> handlePreviousTrack()
            PLAYPAUSE -> handlePlayPause()
            NEXT_TRACK -> handleNextTrack()
        }
        MediaButtonReceiver.handleIntent(mMediaSession!!, intent)
        if (intent.action != DISMISS) {
            startForegroundAndNotify()
        }
        println("after when")
        return START_NOT_STICKY
    }

    private fun playTrack(intent: Intent) {
        val trackId = intent.getSerializableExtra(TRACK_ID) as TrackData?
        if (trackId != null) {
            curPlaylist = arrayOf(trackId)
            setTrack(0)
            broadcastTrackChange()
        }
    }

    private fun playPlaylist(intent: Intent) {
        println("Play playlist")
        curPlaylist = intent.getSerializableExtra(PLAYLIST) as Array<TrackData>
        setTrack(0)
    }

    private fun broadcastTrackChange() {
        println("BROADCAST TRACK CHANGE")
    }

    private fun initMediaPlayerIfNeeded() {
        if (mPlayer != null) {
            return
        }
        mPlayer = MediaPlayer().apply {
            setWakeMode(applicationContext, PowerManager.PARTIAL_WAKE_LOCK)
            setOnPreparedListener(this@MediaPlaybackService)
            setOnCompletionListener(this@MediaPlaybackService)
            setOnErrorListener(this@MediaPlaybackService)
        }
    }

    private fun setTrack(trackIndex: Int) {
        println("setting track:")
        println(trackIndex)
        initMediaPlayerIfNeeded()
        println(MediaStore.Downloads.EXTERNAL_CONTENT_URI)
        println(MediaStore.Downloads.INTERNAL_CONTENT_URI)

        mPlayer?.reset() ?: return
        if (trackIndex >= curPlaylist.size) return
        val track = curPlaylist[trackIndex]
        println(track)
        mCurrTrack = track
        mCurrIndex = trackIndex

        try {
            println("try")
            val uri = Uri.parse(baseContext.getExternalFilesDir(null)?.absolutePath + "/tracks/" + track.track.id + ".mp3")
            println(uri)
            mPlayer!!.setDataSource(applicationContext, uri)
            mPlayer!!.prepareAsync()
            trackChanged()
            println("try succeeded")
        } catch (ignored: Exception) {
            println("GOT EXCEPTIOPN?????!?!")
            println(ignored)
        }
    }

    private fun trackChanged() {
        broadcastTrackChange()
        updateMediaSession()
        updateMediaSessionState()
        startForegroundAndNotify()
    }

    private fun updateMediaSession() {
        val metadata = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, mCurrTrack?.track?.name ?: "")
            .build()
        mMediaSession?.setMetadata(metadata)
    }

    private fun updateMediaSessionState() {
        println("Should update session state")
    }

    fun handleMediaButton(mediaButtonEvent: Intent) {
        println("GOT MEDIA BUTTON EVENT")
        if (mediaButtonEvent.action == Intent.ACTION_MEDIA_BUTTON) {
            val event = mediaButtonEvent.getParcelableExtra<KeyEvent>(Intent.EXTRA_KEY_EVENT) ?: return
            if (event.action == KeyEvent.ACTION_UP) {
                println("GOT KEY EVENT!!!")
                println(event.keyCode)
            }
        }
    }

    fun resumeTrack() {
        println("RESUME TRACK!")
        initMediaPlayerIfNeeded()
        if (mCurrTrack == null) {
            // TODO:
            // setupNextTrack()
        } else {
            mPlayer!!.start()
            requestAudioFocus()
        }
        //setupEqualizer()
        // trackStateChanged(true)
        // setPlaybackSpeed()
    }

    fun pauseTrack() {
        println("PAUSE TRACK!!")
        initMediaPlayerIfNeeded()
        mPlayer!!.pause()
        // TODO:??
        // trackStateChange(false, notify = notify)
        updateMediaSessionState()
        // saveTrackProgress()
    }

    fun handleNextTrack() {
        setTrack(mCurrIndex?.plus(1) ?: 0)
        println("handle next")
    }

    fun handlePreviousTrack() {
        setTrack(mCurrIndex?.minus(1) ?: 0)
    }

    fun handlePlayPause() {
        if (isPlaying()) {
            pauseTrack()
        } else {
            resumeTrack()
        }
    }

    fun updateProgress(pos: Int) {
        println("update progress")
        println(pos)
    }

    fun handleDismiss() {
        println("Dismiss")
    }

    override fun onAudioFocusChange(focusChange: Int) {
        println("ON FOCUS CHANGE!!!")
        println(focusChange)
    }

    private var audioFocusRequest: AudioFocusRequest? = null
    private var audioManager: AudioManager? = null
    private fun requestAudioFocus() {
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()
        audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setOnAudioFocusChangeListener(this)
            .setAudioAttributes(audioAttributes)
            .build()
        audioManager?.requestAudioFocus(audioFocusRequest!!)
    }
//
    override fun onPrepared(mp: MediaPlayer) {
        println("On prepared")
        mp.start()
        requestAudioFocus()
    }

    override fun onError(mp: MediaPlayer?, what: Int, extra: Int): Boolean {
        println("ON ERROR???")
        return false
    }

    override fun onCompletion(mp: MediaPlayer?) {
        println("COMPLETE!!")
        mCurrTrack?.let { playCounter.addPlay(it) }
        setTrack(mCurrIndex?.plus(1) ?: 0)
    }

}
