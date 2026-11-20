package com.example.musicnative

import android.content.Context
import androidx.lifecycle.MutableLiveData
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import org.json.JSONObject
import kotlinx.coroutines.*
import kotlinx.coroutines.internal.synchronized
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicInteger

enum class Steps {
    READY,
    GETTING_MANIFEST,
    SYNCING_TRACKS,
    SYNCING_ALBUMS,
    SYNCING_ARTISTS,
    FAILED,
}

private const val CONNECT_TIMEOUT_MS = 10_000
private const val JSON_READ_TIMEOUT_MS = 30_000
// a read timeout bounds the silence between reads, not the whole download
private const val FILE_READ_TIMEOUT_MS = 60_000
const val PART_SUFFIX = ".part"

/** A non-200 answer, kept distinct so a 404 from an older desktop can be told apart. */
class HttpStatusException(val code: Int, url: String) : IOException("HTTP $code from $url")

/**
 * Sends the play log, and only once the answer has arrived and parsed clears what was sent.
 *
 * The old sync cleared before it looked at the response, so a desktop error, a timeout or a
 * garbled body threw the plays away. Any exception from [send] or [parse] propagates with
 * [clear] never called, and the same plays go again next sync; the desktop drops timed events
 * it has already logged, so a resend after a lost answer cannot double-count.
 */
fun <T> sendThenClear(send: () -> String, parse: (String) -> T, clear: () -> Unit): T {
    val parsed = parse(send())
    clear()
    return parsed
}

/** A body is complete when it is as long as the server said; with no length, reaching EOF is all there is. */
fun isCompleteDownload(bytesWritten: Long, contentLength: Long): Boolean =
    contentLength < 0 || bytesWritten == contentLength

enum class LengthCheck { MATCH, MISMATCH, UNKNOWN }

/**
 * Compares an existing file with the server's size. [remoteLength] is null when the HEAD failed
 * or was not a 200, negative when the server sent no length; both are UNKNOWN - keep the file,
 * but do not count it as verified, so the next sync asks again.
 */
fun lengthCheck(localLength: Long, remoteLength: Long?): LengthCheck = when {
    remoteLength == null || remoteLength < 0 -> LengthCheck.UNKNOWN
    remoteLength == localLength -> LengthCheck.MATCH
    else -> LengthCheck.MISMATCH
}

/**
 * Files known to be whole: downloaded through `.part`, or checked once against the server.
 *
 * Only files from before the `.part` rename can be truncated, and each needs checking once -
 * a HEAD per synced file on every sync is thousands of IPC round trips through the desktop's
 * renderer. Kept in memory during a sync and written every [FLUSH_EVERY] additions and at the
 * end, so an interrupted sync resumes the check rather than starting it over.
 */
class VerifiedFiles(context: Context) {
    private val prefs = context.getSharedPreferences("sync-verified-files", Context.MODE_PRIVATE)
    private val verified: MutableSet<String> = java.util.Collections.newSetFromMap(
        java.util.concurrent.ConcurrentHashMap<String, Boolean>()
    )
    private val unsaved = AtomicInteger(0)

    init {
        verified.addAll(prefs.getStringSet(KEY, emptySet()).orEmpty())
    }

    fun contains(name: String): Boolean = verified.contains(name)

    fun add(name: String) {
        if (verified.add(name) && unsaved.incrementAndGet() >= FLUSH_EVERY) {
            flush()
        }
    }

    fun flush() {
        unsaved.set(0)
        prefs.edit().putStringSet(KEY, HashSet(verified)).apply()
    }

    companion object {
        private const val KEY = "verified"
        private const val FLUSH_EVERY = 100
    }
}

/**
 * Owns the one running sync, for the life of the process rather than of an activity.
 *
 * It used to run in MainActivity's lifecycleScope, so a rotation or a back press cancelled it
 * half way; and its bare launch had no handler, so any failure crashed the app.
 */
object SyncManager {
    val syncState = MutableLiveData(Steps.READY)
    val percent = MutableLiveData(0.0)
    /** Why the last sync failed, shown while syncState is FAILED. */
    val failure = MutableLiveData<String?>(null)

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var job: Job? = null

    @Synchronized
    fun start(context: Context, library: Library) {
        if (job?.isActive == true) {
            println("sync already running")
            return
        }
        job = scope.launch {
            SyncHelper2(context.applicationContext, library, syncState, percent, failure).run()
        }
    }
}

class SyncHelper2(
    private var context: Context,
    private var library: Library,
    private var syncState: MutableLiveData<Steps>,
    private var percent: MutableLiveData<Double>,
    private var failure: MutableLiveData<String?>,
) {
    private val maxConcurrentRequests = 10
    private val semaphore = Semaphore(maxConcurrentRequests)
    @Volatile
    private var stepTotal = 1.0
    private val stepAmt = AtomicInteger(0)
    private val itemFailures = AtomicInteger(0)
    @Volatile
    private var firstItemFailure: String? = null
    private val verifiedFiles = VerifiedFiles(context)

    suspend fun run() {
        try {
            failure.postValue(null)
            createFoldersIfNotThere()
            removePartFiles()
            setSyncState(Steps.GETTING_MANIFEST)
            getManifest()
            val failed = itemFailures.get()
            if (failed > 0) {
                fail("$failed item(s) did not download ($firstItemFailure)")
            } else {
                resetStep(1.0, Steps.READY)
            }
        } catch (err: CancellationException) {
            throw err
        } catch (err: Exception) {
            println("sync failed: $err")
            fail(err.message ?: err.javaClass.simpleName)
        } finally {
            verifiedFiles.flush()
        }
    }

    private fun fail(reason: String) {
        failure.postValue(reason)
        setSyncState(Steps.FAILED)
    }

    private fun createFoldersIfNotThere() {
        val externalFilesDir = context.getExternalFilesDir(null)
        File(externalFilesDir, "tracks").mkdirs()
        File(externalFilesDir, "albumArt").mkdirs()
        File(externalFilesDir, "artistArt").mkdirs()
    }

    /** Leftovers of downloads an earlier sync never finished. Only one sync runs at a time. */
    private fun removePartFiles() {
        val externalFilesDir = context.getExternalFilesDir(null)
        listOf("tracks", "albumArt", "artistArt").forEach { dir ->
            File(externalFilesDir, dir).listFiles()?.forEach { file ->
                if (file.name.endsWith(PART_SUFFIX)) {
                    file.delete()
                }
            }
        }
    }

    private fun setSyncState(state: Steps) {
        syncState.postValue(state)
    }

    private fun setPercent() {
        percent.postValue(stepAmt.get() / stepTotal)
    }

    private fun completeItem() {
        stepAmt.incrementAndGet()
        setPercent()
    }

    private fun resetStep(total: Double, step: Steps) {
        setSyncState(step)
        stepTotal = total
        stepAmt.set(0)
        setPercent()
    }

    private fun base(): String = ServerConnection.baseUrl ?: throw IOException("not connected to the desktop")

    private suspend fun getManifest() {
        val base = base()
        val tracker = PlayTracker(context)
        // Take a snapshot, send it, then clear exactly that - and only once the answer is in.
        val pending = tracker.pending()
        val playlistsObj = sendThenClear(
            send = { startSyncRequest(base, tracker, pending) },
            parse = { response -> JSONObject(response).getJSONArray("playlists") },
            clear = { tracker.clearSent(pending) },
        )
        val trackIds = mutableSetOf<String>()
        for (i in 0 until playlistsObj.length()) {
            val playlist: JSONObject = playlistsObj.getJSONObject(i)
            val playlistTracks = playlist.getJSONArray("trackIds")
            for (j in 0 until playlistTracks.length()){
                trackIds.add(playlistTracks.getString(j))
            }
        }

        library.removeOldTrackIds(trackIds)
        library.setPlaylists(playlistsObj)
        resetStep(trackIds.size.toDouble(), Steps.SYNCING_TRACKS)
        syncTrackIds(trackIds)
        val newAlbums = library.removeOldAlbums(trackIds)
        resetStep(newAlbums.size.toDouble(), Steps.SYNCING_ALBUMS)
        syncAlbumIds(newAlbums)
        val newArtists = library.removeOldArtists(trackIds)
        resetStep(newArtists.size.toDouble(), Steps.SYNCING_ARTISTS)
        syncArtistIds(newArtists)
    }

    /**
     * The play log goes in a POST body. In the query string it outgrew the desktop's ~16KB
     * header limit after a few hundred plays. A 404 means a desktop from before the POST route,
     * which still takes the old GET.
     */
    private fun startSyncRequest(base: String, tracker: PlayTracker, pending: PlayTracker.Pending): String {
        return try {
            fetchText("$base/start-sync", body = syncPayload(pending))
        } catch (err: HttpStatusException) {
            if (err.code != HttpURLConnection.HTTP_NOT_FOUND) {
                throw err
            }
            println("desktop has no POST /start-sync; falling back to GET")
            fetchText("$base/start-sync?${tracker.getQueryString(pending)}")
        }
    }

    /** One item's sync: a failure is counted and reported at the end rather than ending the sync. */
    private suspend fun syncItem(label: String, work: suspend () -> Unit) {
        semaphore.withPermit {
            try {
                work()
            } catch (err: CancellationException) {
                throw err
            } catch (err: Exception) {
                println("sync of $label failed: $err")
                if (itemFailures.getAndIncrement() == 0) {
                    firstItemFailure = "$label: ${err.message ?: err.javaClass.simpleName}"
                }
            } finally {
                completeItem()
            }
        }
    }

    private suspend fun syncArtistIds(artistIds: Set<String>) {
        coroutineScope {
            artistIds.map { artistId -> launch { syncItem("artist $artistId") { syncArtistId(artistId) } } }.joinAll()
        }
    }

    private suspend fun syncAlbumIds(albumIds: Set<String?>) {
        coroutineScope {
            albumIds.filterNotNull()
                .map { albumId -> launch { syncItem("album $albumId") { syncAlbumId(albumId) } } }
                .joinAll()
        }
    }

    private suspend fun syncTrackIds(trackIds: MutableSet<String>) {
        coroutineScope {
            trackIds.map { trackId -> launch { syncItem("track $trackId") { syncTrack(trackId) } } }.joinAll()
        }
    }

    @OptIn(InternalCoroutinesApi::class)
    private suspend fun syncTrack(trackId: String) {
        val base = base()
        val data = JSONObject(withContext(Dispatchers.IO) { fetchText("$base/get-track-data/$trackId") })
        synchronized(library.saveLock) {
            library.addTrack(Track(data))
            library.save()
        }
        val destinationPath = "${context.getExternalFilesDir(null)?.absolutePath}/tracks/$trackId.mp3"
        downloadDataFile("$base/get-track/$trackId", destinationPath)
    }

    @OptIn(InternalCoroutinesApi::class)
    private suspend fun syncAlbumId(albumId: String) {
        val base = base()
        val data = JSONObject(withContext(Dispatchers.IO) { fetchText("$base/get-album-data/$albumId") })
        synchronized(library.saveLock) {
            library.addAlbum(Album(data))
            library.save()
        }
        if (data.has("albumArtFile")) {
            val destinationPath = "${context.getExternalFilesDir(null)?.absolutePath}/albumArt/$albumId.png"
            downloadDataFile("$base/get-album-art/$albumId", destinationPath)
        }
    }

    @OptIn(InternalCoroutinesApi::class)
    private suspend fun syncArtistId(artistId: String) {
        val base = base()
        val data = JSONObject(withContext(Dispatchers.IO) { fetchText("$base/get-artist-data/$artistId") })
        synchronized(library.saveLock) {
            library.addArtist(Artist(data))
            library.save()
        }
        if (data.has("artFile")) {
            val destinationPath = "${context.getExternalFilesDir(null)?.absolutePath}/artistArt/$artistId.png"
            downloadDataFile("$base/get-artist-pic/$artistId", destinationPath)
        }
    }

    private fun open(urlString: String, method: String, readTimeoutMs: Int): HttpURLConnection {
        val connection = URL(urlString).openConnection() as HttpURLConnection
        connection.requestMethod = method
        connection.connectTimeout = CONNECT_TIMEOUT_MS
        connection.readTimeout = readTimeoutMs
        return connection
    }

    /**
     * Downloads to `<name>.part` and renames only once the whole body is in.
     *
     * Writing straight to the final path meant an interrupted download left a truncated mp3
     * that `exists()` then skipped on every later sync. An existing file not yet in
     * [VerifiedFiles] - one from before this - is checked once against the server's
     * Content-Length (a HEAD, no body), which catches the truncated copies left behind.
     */
    private suspend fun downloadDataFile(urlString: String, destinationPath: String) {
        withContext(Dispatchers.IO) {
            val destination = File(destinationPath)
            val name = "${destination.parentFile?.name}/${destination.name}"
            if (destination.exists()) {
                if (verifiedFiles.contains(name)) {
                    return@withContext
                }
                when (lengthCheck(destination.length(), remoteLength(urlString))) {
                    LengthCheck.MATCH -> {
                        verifiedFiles.add(name)
                        return@withContext
                    }
                    // kept, unverified: asked again next sync
                    LengthCheck.UNKNOWN -> return@withContext
                    LengthCheck.MISMATCH -> println("$name is truncated; re-fetching")
                }
            }
            val part = File(destinationPath + PART_SUFFIX)
            val connection = open(urlString, "GET", FILE_READ_TIMEOUT_MS)
            try {
                val responseCode = connection.responseCode
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    // as before: a file the desktop cannot serve is skipped, not a failed sync
                    println("download $urlString answered $responseCode; skipping")
                    return@withContext
                }
                val expected = connection.contentLengthLong
                var written = 0L
                BufferedInputStream(connection.inputStream).use { input ->
                    FileOutputStream(part).use { output ->
                        val buffer = ByteArray(16 * 1024)
                        var bytesRead: Int
                        while (input.read(buffer).also { bytesRead = it } != -1) {
                            output.write(buffer, 0, bytesRead)
                            written += bytesRead
                        }
                    }
                }
                if (!isCompleteDownload(written, expected)) {
                    throw IOException("incomplete download: $written of $expected bytes")
                }
                if (!part.renameTo(destination)) {
                    throw IOException("could not move ${part.name} into place")
                }
                verifiedFiles.add(name)
            } finally {
                part.delete()
                connection.disconnect()
            }
        }
    }

    /** The server's Content-Length for a file, via HEAD; null if the HEAD failed or was not a 200. */
    private fun remoteLength(urlString: String): Long? {
        val connection = open(urlString, "HEAD", JSON_READ_TIMEOUT_MS)
        return try {
            if (connection.responseCode == HttpURLConnection.HTTP_OK) connection.contentLengthLong else null
        } catch (err: Exception) {
            null
        } finally {
            connection.disconnect()
        }
    }

    /** GETs, or POSTs [body] as JSON; throws on a non-200 instead of returning "". */
    private fun fetchText(urlString: String, body: String? = null): String {
        val connection = open(urlString, if (body == null) "GET" else "POST", JSON_READ_TIMEOUT_MS)
        try {
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val responseCode = connection.responseCode
            if (responseCode != HttpURLConnection.HTTP_OK) {
                throw HttpStatusException(responseCode, urlString.substringBefore('?'))
            }
            return BufferedInputStream(connection.inputStream).bufferedReader().use { it.readText() }
        } finally {
            connection.disconnect()
        }
    }
}
