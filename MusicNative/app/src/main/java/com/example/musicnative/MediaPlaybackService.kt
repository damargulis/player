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
import android.os.SystemClock
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.view.KeyEvent
import androidx.media.session.MediaButtonReceiver
import java.io.File
import kotlin.concurrent.thread

const val NOTIFICATION_ID = 1
/** How often the playing position is saved; track changes and pauses save immediately. */
private const val POSITION_SAVE_INTERVAL_MS = 10_000L

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

    /**
     * Set while a queue restored from QueueStore sits unprepared: the player holds nothing until
     * play is pressed, so launching never plays and never fetches a stream URL that could
     * expire before it is used. Doubles as the position to start from.
     */
    private var restoredPositionMs: Int? = null
    /** Where the next prepared track should start; 0 for its beginning. */
    private var pendingSeekMs = 0
    private var restoring = false
    private var playWhenRestored = false
    /** The queue array last written to QueueStore, so the big write only follows a real change. */
    private var savedQueue: Array<TrackData>? = null
    private var lastPositionSaveAt = 0L

    private val progressHandler = Handler()
    private val progressRunnable = object : Runnable {
        override fun run() {
            publishPosition()
            if (isPlaying()) {
                if (SystemClock.elapsedRealtime() - lastPositionSaveAt >= POSITION_SAVE_INTERVAL_MS) {
                    persistPosition()
                }
                progressHandler.postDelayed(this, 500L)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        playCounter = PlayTracker(this)
        mMediaSession = MediaSessionCompat(this, "MusicService")
        // Explicit, so a media button pressed after the process has died (a Bluetooth play
        // press) reaches the manifest's MediaButtonReceiver, which restarts this service; the
        // restored queue then answers it.
        val mediaButtonIntent = Intent(Intent.ACTION_MEDIA_BUTTON)
            .setClass(this, MediaButtonReceiver::class.java)
        val mediaButtonPendingIntent = PendingIntent.getBroadcast(
            baseContext,
            0,
            mediaButtonIntent,
            PendingIntent.FLAG_IMMUTABLE
        )
        val mediaSessionCallback = MediaSessionCallback(this)
        mMediaSession!!.setCallback(mediaSessionCallback)
        mMediaSession!!.setMediaButtonReceiver(mediaButtonPendingIntent)
        mMediaSession!!.isActive = true
        notificationHelper = NotificationHelper.createInstance(context = this, mMediaSession!!)
        startForegroundAndNotify()
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        restoreSavedQueue()
    }

    /**
     * Brings back the queue saved by the last run, paused.
     *
     * Loading the library and catalog is file I/O, so it runs off the main thread. A queue the
     * user starts in the meantime wins; a play pressed in the meantime (the media button that
     * cold-started us) is held and applied once the queue is back.
     */
    private fun restoreSavedQueue() {
        restoring = true
        thread {
            val restored = try {
                loadSavedQueue()
            } catch (err: Exception) {
                println("queue restore failed: $err")
                null
            }
            progressHandler.post { applyRestoredQueue(restored) }
        }
    }

    private fun loadSavedQueue(): Pair<RestoredQueue<TrackData>, Boolean>? {
        val saved = QueueStore.load(applicationContext) ?: return null
        // the library field, not load()'s return: load() reports failure for a library with no
        // playlists even after parsing it
        val data = Library.shared(applicationContext).library
        if (StreamingClient.albums().isEmpty()) {
            StreamingClient.loadCached(applicationContext)
        }
        // online = true keeps a cloud track whatever the connection is right now; setTrack
        // re-resolves it by id when played, and skips it if there is still no internet
        val merged = MergedLibrary(applicationContext, data.tracks, data.albums, data.artists, true)
        val restored = restoreQueue(saved.ids, saved.position) { id ->
            if (merged.isPlayable(id)) merged.resolve(id) else null
        } ?: return null
        return Pair(restored, saved.repeat)
    }

    private fun applyRestoredQueue(restored: Pair<RestoredQueue<TrackData>, Boolean>?) {
        restoring = false
        val resume = playWhenRestored
        playWhenRestored = false
        if (restored == null || mCurrIndex != null) {
            return
        }
        val (queue, repeat) = restored
        curPlaylist = queue.tracks.toTypedArray()
        mCurrIndex = queue.index
        mCurrTrack = curPlaylist[queue.index]
        restoredPositionMs = queue.positionMs
        PlaybackState.setRepeat(repeat)
        // rewritten so tracks pruned as missing stay gone
        persistState()
        publishState()
        updateMediaSession()
        updateMediaSessionState()
        if (resume) {
            resumeTrack()
        }
    }

    /** Saves the queue if it has changed since it was last saved, and always the position. */
    private fun persistState() {
        if (curPlaylist !== savedQueue) {
            QueueStore.saveQueue(applicationContext, curPlaylist.map { it.track.id })
            savedQueue = curPlaylist
        }
        persistPosition()
    }

    private fun persistPosition() {
        lastPositionSaveAt = SystemClock.elapsedRealtime()
        QueueStore.savePosition(
            applicationContext,
            mCurrIndex ?: 0,
            mCurrTrack?.track?.id,
            currentPositionMs(),
            PlaybackState.repeatEnabled,
        )
    }

    private fun currentPositionMs(): Int {
        restoredPositionMs?.let { return it }
        if (pendingSeekMs > 0) {
            return pendingSeekMs
        }
        return try {
            mPlayer?.currentPosition ?: 0
        } catch (e: Exception) {
            0
        }
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
        if (mCurrIndex != null) {
            persistState()
        }
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
        // the queue comes via PendingQueue rather than the intent: an Array<TrackData> for the
        // whole library overflows the Binder transaction buffer and the start is dropped
        val queue = PendingQueue.take()
        if (queue.isEmpty()) {
            println("play-playlist with an empty queue; ignoring")
            return
        }
        curPlaylist = queue
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

    private fun localFileFor(trackId: String): File =
        File(baseContext.getExternalFilesDir(null)?.absolutePath + "/tracks/" + trackId + ".mp3")

    /**
     * Starts a track, preferring the synced copy and falling back to streaming.
     *
     * Local first always: it is faster, works offline, and costs no egress. Streaming is only
     * reached for a track that was never synced - or whose file has gone missing, which this
     * now recovers from rather than failing silently as it used to.
     *
     * The signed URL has to be fetched over the network, so that path hops to a background
     * thread and comes back to the player. A track started that way is a few hundred ms slower
     * to begin, which is the cost of not having synced it.
     */
    private fun setTrack(trackIndex: Int, startAtMs: Int = 0) {
        initMediaPlayerIfNeeded()
        mPlayer?.reset() ?: return
        if (trackIndex < 0 || trackIndex >= curPlaylist.size) return
        restoredPositionMs = null
        pendingSeekMs = startAtMs
        val track = curPlaylist[trackIndex]
        mCurrTrack = track
        mCurrIndex = trackIndex

        val local = localFileFor(track.track.id)
        if (local.exists()) {
            try {
                mPlayer!!.setDataSource(applicationContext, Uri.fromFile(local))
                mPlayer!!.prepareAsync()
                trackChanged()
            } catch (err: Exception) {
                println("setTrack failed for local ${track.track.id}: $err")
            }
            return
        }

        if (!Connectivity.isOnlineNow()) {
            // no copy and no way to get one; skipping beats sitting on a track that cannot play
            println("no local copy of ${track.track.id} and offline; skipping")
            onTrackUnplayable(trackIndex)
            return
        }

        val requestedIndex = trackIndex
        thread {
            val url = StreamingClient.trackUrl(applicationContext, track.track.id)
            progressHandler.post {
                // the user may have skipped on while the URL was in flight
                if (mCurrIndex != requestedIndex) {
                    return@post
                }
                if (url == null) {
                    println("no stream url for ${track.track.id}")
                    onTrackUnplayable(requestedIndex)
                    return@post
                }
                try {
                    mPlayer?.reset()
                    mPlayer?.setDataSource(url)
                    mPlayer?.prepareAsync()
                    trackChanged()
                } catch (err: Exception) {
                    println("streaming ${track.track.id} failed: $err")
                    onTrackUnplayable(requestedIndex)
                }
            }
        }
    }

    /** Moves past a track that cannot be played, without running off the end of the queue. */
    private fun onTrackUnplayable(trackIndex: Int) {
        if (trackIndex + 1 < curPlaylist.size) {
            setTrack(trackIndex + 1)
        } else {
            trackChanged()
        }
    }

    private fun trackChanged() {
        persistState()
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
        PlaybackState.positionMs.postValue(currentPositionMs())
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
        val position = currentPositionMs().toLong()
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
        if (restoring) {
            playWhenRestored = true
            return
        }
        val restoredAt = restoredPositionMs
        val index = mCurrIndex
        if (restoredAt != null && index != null) {
            // a restored queue is only prepared now; onPrepared starts it at the saved spot
            setTrack(index, restoredAt)
            return
        }
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
        if (restoredPositionMs == null) {
            try {
                mPlayer!!.pause()
            } catch (_: Exception) {
            }
        }
        if (mCurrIndex != null) {
            persistPosition()
        }
        publishState()
        updateMediaSessionState()
        startForegroundAndNotify()
    }

    fun seekTo(positionMs: Int) {
        if (restoredPositionMs != null) {
            restoredPositionMs = positionMs
        } else {
            try {
                mPlayer?.seekTo(positionMs)
            } catch (_: Exception) {
            }
        }
        if (mCurrIndex != null) {
            persistPosition()
        }
        publishPosition()
        updateMediaSessionState()
    }

    fun handleNextTrack() {
        val index = mCurrIndex ?: return
        // Advancing before the track ends is a skip, however little of it was heard.
        // onCompletion is the only natural finish and advances through setTrack directly, so
        // every way through here counts — the same rule the desktop applies.
        mCurrTrack?.let { playCounter.addSkip(it) }
        when {
            index + 1 < curPlaylist.size -> setTrack(index + 1)
            PlaybackState.repeatEnabled && curPlaylist.isNotEmpty() -> setTrack(0)
        }
    }

    /**
     * Every route into "previous" - the in-app button, the notification, the lock screen and
     * MediaSession, Bluetooth and headset buttons - ends here.
     *
     * Neither branch touches PlayTracker: a restart is not a skip and not a play, and only
     * handleNextTrack records skips.
     */
    fun handlePreviousTrack() {
        val index = mCurrIndex ?: return
        if (shouldRestartOnPrevious(currentPositionMs(), index)) {
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
        persistState()
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
        if (pendingSeekMs > 0) {
            mp.seekTo(pendingSeekMs)
            pendingSeekMs = 0
        }
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
                persistPosition()
                publishState()
                updateMediaSessionState()
                startForegroundAndNotify()
            }
        }
    }
}
