package com.example.musicnative

import android.content.Context
import androidx.lifecycle.MutableLiveData
import kotlinx.coroutines.sync.Semaphore
import org.json.JSONObject
import kotlinx.coroutines.*
import kotlinx.coroutines.internal.synchronized
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

// TODO: save and send plays
const val SYNC_START_URL = "$BASE_URL/start-sync"

enum class Steps {
    READY,
    GETTING_MANIFEST,
    SYNCING_TRACKS,
    SYNCING_ALBUMS,
    SYNCING_ARTISTS,
}

class SyncHelper2(private var context: Context, private var library: Library, var syncState: MutableLiveData<Steps>, var percent: MutableLiveData<Double>, private var activity: MainActivity) {
    private val maxConcurrentRequests = 10
    private val semaphore = Semaphore(maxConcurrentRequests)
    private var stepTotal = 1.0
    private var stepAmt = 0.0

    suspend fun startSync() {
        println("inner")
        if (syncState.value != Steps.READY) {
            println("not ready")
            return
        }
        createFoldersIfNotThere()
        setSyncState(Steps.GETTING_MANIFEST)
        withContext(Dispatchers.IO) {
            println("here3")
            getManifest()
        }
    }

    private fun createFoldersIfNotThere() {

        val externalFilesDir = context.getExternalFilesDir(null)

        val tracksDir = File(externalFilesDir, "tracks")
        val albumArtDir = File(externalFilesDir, "albumArt")
        val artistArtDir = File(externalFilesDir, "artistArt")

        tracksDir.mkdirs()
        albumArtDir.mkdirs()
        artistArtDir.mkdirs()

    }

    private fun setSyncState(state: Steps) {
        activity.runOnUiThread {
            syncState.value = state
        }
    }

    private fun setPercent() {
        activity.runOnUiThread {
            percent.value = stepAmt / stepTotal
        }
    }

    private fun completeItem() {
        stepAmt++
        setPercent()
        semaphore.release()
    }

    private fun resetStep(total: Double, step: Steps) {
        setSyncState(step)
        stepTotal = total
        stepAmt = 0.0
        setPercent()
    }

    private suspend fun getManifest() {
        val tracker = PlayTracker(context)
        val plays = tracker.getQueryString()
        val response = downloadJson("$SYNC_START_URL?$plays")
        tracker.clearPlays()
        val res = JSONObject(response)
        val playlistsObj = res.getJSONArray("playlists")
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
        resetStep(1.0, Steps.READY)
    }

    private suspend fun syncArtistIds(artistIds: Set<String>) {
        coroutineScope {
            val downloadJobs = artistIds.map { artistId ->
                launch { syncArtistId(artistId) }
            }
            downloadJobs.joinAll()
        }
    }

    private suspend fun syncAlbumIds(albumIds: Set<String?>) {
        coroutineScope {
            val downloadJobs = albumIds.map { albumId ->
                launch { syncAlbumId(albumId) }
            }
            downloadJobs.joinAll()
        }
    }

    private suspend fun syncTrackIds(trackIds: MutableSet<String>) {
        coroutineScope {
            val downloadJobs = trackIds.map { trackId ->
                launch { syncTrack(trackId) }
            }
            downloadJobs.joinAll()
        }
    }

    @OptIn(InternalCoroutinesApi::class)
    suspend fun syncTrack(trackId: String) {
        semaphore.acquire()
        val dataUrl = "$BASE_URL/get-track-data/$trackId"
        val response = downloadJson(dataUrl)
        val data = JSONObject(response)
        synchronized(library.saveLock) {
            library.addTrack(Track(data))
            library.save()
        }
        val fileUrl = "$BASE_URL/get-track/$trackId"
        val destinationPath = "${context.getExternalFilesDir(null)?.absolutePath}/tracks/$trackId.mp3"
        downloadDataFile(fileUrl, destinationPath)
    }

    @OptIn(InternalCoroutinesApi::class)
    suspend fun syncAlbumId(albumId: String?) {
        if (albumId == null) {
            return
        }
        semaphore.acquire()
        val dataUrl = "$BASE_URL/get-album-data/$albumId"
        val response = downloadJson(dataUrl)
        val data = JSONObject(response)
        synchronized(library.saveLock) {
            library.addAlbum(Album(data))
            library.save()
        }
        if (data.has("albumArtFile")) {
            val artUrl = "$BASE_URL/get-album-art/$albumId"
            val destinationPath = "${context.getExternalFilesDir(null)?.absolutePath}/albumArt/$albumId.png"
            downloadDataFile(artUrl, destinationPath)
        } else {
            completeItem()
        }
    }

    @OptIn(InternalCoroutinesApi::class)
    suspend fun syncArtistId(artistId: String) {
        semaphore.acquire()
        val dataUrl = "$BASE_URL/get-artist-data/$artistId"
        val response = downloadJson(dataUrl)
        val data = JSONObject(response)
        synchronized(library.saveLock) {
            library.addArtist(Artist(data))
            library.save()
        }
        if (data.has("filePath")) {
            val artUrl = "$BASE_URL/get-artist-pic/$artistId"
            val destinationPath = "${context.getExternalFilesDir(null)?.absolutePath}/artistArt/$artistId.png"
            downloadDataFile(artUrl, destinationPath)
        } else {
            completeItem()
        }
    }

    private suspend fun downloadDataFile(urlString: String, destinationPath: String) {
        // TODO: if exists, skip
        if (File(destinationPath).exists()) {
            completeItem()
            return
        }
        withContext(Dispatchers.IO) {
            try {

                val url = URL(urlString)
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "GET"
                connection.connect()

                val responseCode = connection.responseCode
                if (responseCode == HttpURLConnection.HTTP_OK) {
                    val inputStream = BufferedInputStream(connection.inputStream)
                    val outputStream = FileOutputStream(destinationPath)
                    val buffer = ByteArray(4 * 1024)
                    var bytesRead: Int
                    while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                        outputStream.write(buffer, 0, bytesRead)
                    }
                    outputStream.close()
                    inputStream.close()
                }
                connection.disconnect()
            } finally {
                completeItem()
            }
        }
    }

    private fun downloadJson(jsonUrl: String): String {
        val url = URL(jsonUrl)
        val connection = url.openConnection() as HttpURLConnection
        connection.requestMethod = "GET"
        connection.connect()

        val responseCode = connection.responseCode
        val jsonResponse = if (responseCode == HttpURLConnection.HTTP_OK) {
            val inputStream = BufferedInputStream(connection.inputStream)
            inputStream.bufferedReader().use { it.readText() }
            } else {
            println("Not ok json response??!")
            ""
        }
        connection.disconnect()
        return jsonResponse
    }
}