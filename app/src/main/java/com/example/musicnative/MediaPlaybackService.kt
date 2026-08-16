package com.example.musicnative

import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.BitmapFactory
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.AudioManager.OnAudioFocusChangeListener
import android.media.MediaPlayer
import android.net.Uri
import android.os.Handler
import android.os.IBinder
import android.os.PowerManager
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
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

    private val progressHandler = Handler()
    private val progressRunnable = object : Runnable {
        override fun run() {
            publishPosition()
            if (isPlaying()) {
                progressHandler.postDelayed(this, 500L)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        playCounter = PlayTracker(this)
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
        mMediaSession!!.isActive = true
        notificationHelper = NotificationHelper.createInstance(context = this, mMediaSession!!)
        startForegroundAndNotify()
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }

    private fun startForegroundAndNotify() {
        notificationHandler.removeCallbacksAndMessages(null)
        if (mCurrTrack != null) {
            notificationHandler.postDelayed({
                notificationHelper?.createPlayerNotification(
                    track = mCurrTrack!!, isPlaying = isPlaying()
                ) {
                    notificationHelper?.notify(NOTIFICATION_ID, it)
                    try {
                        startForeground(NOTIFICATION_ID, it, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
                    } catch (_: java.lang.IllegalStateException) {}
                }
            }, 200L)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        progressHandler.removeCallbacksAndMessages(null)
        mMediaSession?.isActive = false
        mMediaSession = null
    }

    override fun onStartCommand(intent: Intent, flags: Int, startId: Int): Int {
        when (intent.action) {
            PLAY_TRACK -> playTrack(intent)
            PLAY_PLAYLIST -> playPlaylist(intent)
            PREVIOUS_TRACK -> handlePreviousTrack()
            PLAYPAUSE -> handlePlayPause()
            NEXT_TRACK -> handleNextTrack()
            SEEK_TO -> seekTo(intent.getIntExtra(EXTRA_SEEK_MS, 0))
            SKIP_TO_INDEX -> setTrack(intent.getIntExtra(EXTRA_QUEUE_INDEX, 0))
            SHUFFLE_UPCOMING -> shuffleUpcoming()
        }
        MediaButtonReceiver.handleIntent(mMediaSession!!, intent)
        if (intent.action != DISMISS) {
            startForegroundAndNotify()
        }
        return START_NOT_STICKY
    }

    private fun playTrack(intent: Intent) {
        val trackId = intent.getSerializableExtra(TRACK_ID) as TrackData?
        if (trackId != null) {
            curPlaylist = arrayOf(trackId)
            setTrack(0)
        }
    }

    private fun playPlaylist(intent: Intent) {
        curPlaylist = intent.getSerializableExtra(PLAYLIST) as Array<TrackData>
        setTrack(0)
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
        initMediaPlayerIfNeeded()
        mPlayer?.reset() ?: return
        if (trackIndex < 0 || trackIndex >= curPlaylist.size) return
        val track = curPlaylist[trackIndex]
        mCurrTrack = track
        mCurrIndex = trackIndex

        try {
            val uri = Uri.parse(baseContext.getExternalFilesDir(null)?.absolutePath + "/tracks/" + track.track.id + ".mp3")
            mPlayer!!.setDataSource(applicationContext, uri)
            mPlayer!!.prepareAsync()
            trackChanged()
        } catch (err: Exception) {
            println("setTrack failed: $err")
        }
    }

    private fun trackChanged() {
        publishState()
        updateMediaSession()
        updateMediaSessionState()
        startForegroundAndNotify()
    }

    /** Pushes the full playback snapshot to the UI. */
    private fun publishState() {
        PlaybackState.queue.postValue(curPlaylist.toList())
        PlaybackState.currentIndex.postValue(mCurrIndex ?: -1)
        PlaybackState.currentTrack.postValue(mCurrTrack)
        PlaybackState.isPlaying.postValue(isPlaying())
        PlaybackState.durationMs.postValue(mCurrTrack?.track?.duration ?: 0)
        publishPosition()
    }

    private fun publishPosition() {
        val position = try {
            mPlayer?.currentPosition ?: 0
        } catch (e: Exception) {
            0
        }
        PlaybackState.positionMs.postValue(position)
    }

    private fun startProgressUpdates() {
        progressHandler.removeCallbacks(progressRunnable)
        progressHandler.post(progressRunnable)
    }

    private fun updateMediaSession() {
        val artPath = mCurrTrack?.albums?.firstOrNull()?.artFile
        val artBitmap = artPath?.let {
            BitmapFactory.decodeFile(getExternalFilesDir(null)?.absolutePath + it)
        }
        val metadata = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, mCurrTrack?.track?.name ?: "")
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, combineNames(mCurrTrack?.artists ?: listOf()))
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, combineNames(mCurrTrack?.albums ?: listOf()))
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, (mCurrTrack?.track?.duration ?: 0).toLong())
            .apply {
                if (artBitmap != null) {
                    putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artBitmap)
                }
            }
            .build()
        mMediaSession?.setMetadata(metadata)
    }

    /** Reports position and actions so the lockscreen/notification seek bar works. */
    private fun updateMediaSessionState() {
        val position = try {
            (mPlayer?.currentPosition ?: 0).toLong()
        } catch (e: Exception) {
            0L
        }
        val state = PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY or
                    PlaybackStateCompat.ACTION_PAUSE or
                    PlaybackStateCompat.ACTION_PLAY_PAUSE or
                    PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                    PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                    PlaybackStateCompat.ACTION_SEEK_TO
            )
            .setState(
                if (isPlaying()) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
                position,
                if (isPlaying()) 1f else 0f
            )
            .build()
        mMediaSession?.setPlaybackState(state)
    }

    fun handleMediaButton(mediaButtonEvent: Intent) {
        if (mediaButtonEvent.action == Intent.ACTION_MEDIA_BUTTON) {
            val event = mediaButtonEvent.getParcelableExtra<KeyEvent>(Intent.EXTRA_KEY_EVENT) ?: return
            if (event.action == KeyEvent.ACTION_UP) {
                when (event.keyCode) {
                    KeyEvent.KEYCODE_MEDIA_PLAY, KeyEvent.KEYCODE_MEDIA_PAUSE,
                    KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_HEADSETHOOK -> handlePlayPause()
                    KeyEvent.KEYCODE_MEDIA_NEXT -> handleNextTrack()
                    KeyEvent.KEYCODE_MEDIA_PREVIOUS -> handlePreviousTrack()
                }
            }
        }
    }

    fun resumeTrack() {
        initMediaPlayerIfNeeded()
        if (mCurrTrack != null) {
            mPlayer!!.start()
            requestAudioFocus()
            startProgressUpdates()
        }
        publishState()
        updateMediaSessionState()
        startForegroundAndNotify()
    }

    fun pauseTrack() {
        initMediaPlayerIfNeeded()
        try {
            mPlayer!!.pause()
        } catch (_: Exception) {
        }
        publishState()
        updateMediaSessionState()
        startForegroundAndNotify()
    }

    fun seekTo(positionMs: Int) {
        try {
            mPlayer?.seekTo(positionMs)
        } catch (_: Exception) {
        }
        publishPosition()
        updateMediaSessionState()
    }

    fun handleNextTrack() {
        val index = mCurrIndex ?: return
        when {
            index + 1 < curPlaylist.size -> setTrack(index + 1)
            PlaybackState.repeatEnabled && curPlaylist.isNotEmpty() -> setTrack(0)
        }
    }

    fun handlePreviousTrack() {
        val index = mCurrIndex ?: return
        val position = try {
            mPlayer?.currentPosition ?: 0
        } catch (e: Exception) {
            0
        }
        // restart the current track unless we're near its start
        if (position > 3000 || index == 0) {
            seekTo(0)
        } else {
            setTrack(index - 1)
        }
    }

    fun handlePlayPause() {
        if (isPlaying()) {
            pauseTrack()
        } else {
            resumeTrack()
        }
    }

    private fun shuffleUpcoming() {
        val index = mCurrIndex ?: return
        if (index + 1 >= curPlaylist.size) return
        val upcoming = curPlaylist.slice(index + 1 until curPlaylist.size).shuffled()
        curPlaylist = (curPlaylist.slice(0..index) + upcoming).toTypedArray()
        publishState()
    }

    fun handleDismiss() {
        pauseTrack()
    }

    override fun onAudioFocusChange(focusChange: Int) {
        when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS,
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                if (isPlaying()) {
                    pauseTrack()
                }
            }
        }
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

    override fun onPrepared(mp: MediaPlayer) {
        mp.start()
        requestAudioFocus()
        startProgressUpdates()
        publishState()
        updateMediaSessionState()
        startForegroundAndNotify()
    }

    override fun onError(mp: MediaPlayer?, what: Int, extra: Int): Boolean {
        println("MediaPlayer error what=$what extra=$extra")
        return false
    }

    override fun onCompletion(mp: MediaPlayer?) {
        mCurrTrack?.let { playCounter.addPlay(it) }
        val index = mCurrIndex ?: return
        when {
            index + 1 < curPlaylist.size -> setTrack(index + 1)
            PlaybackState.repeatEnabled && curPlaylist.isNotEmpty() -> setTrack(0)
            else -> {
                publishState()
                updateMediaSessionState()
                startForegroundAndNotify()
            }
        }
    }
}
