package com.example.musicnative

import android.content.Context
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

private fun JSONObject.stringList(key: String): List<String> {
    val array = optJSONArray(key) ?: return emptyList()
    return (0 until array.length()).map { array.getString(it) }
}

/**
 * One track the service can serve.
 *
 * Carries the desktop's own album and artist ids, which is what lets these fold into the
 * synced library rather than sitting in a separate list: a part-synced album merges into one
 * album instead of appearing twice.
 */
class StreamTrack(data: JSONObject) {
    val id: String = data.getString("id")
    val name: String = data.optString("name")
    val artist: String = data.optString("artist")
    val album: String = data.optString("album")
    val year: Int = data.optInt("year")
    val duration: Int = data.optInt("duration")
    val albumIds: List<String> = data.stringList("albumIds")
    val artistIds: List<String> = data.stringList("artistIds")
}

/** An album in the cloud. `trackIds` is the full running order, uploaded or not. */
class StreamAlbum(data: JSONObject) {
    val id: String = data.getString("id")
    val name: String = data.optString("name")
    val artistIds: List<String> = data.stringList("artistIds")
    val trackIds: List<String> = data.stringList("trackIds")
}

class StreamArtist(data: JSONObject) {
    val id: String = data.getString("id")
    val name: String = data.optString("name")
}

/**
 * Client for the Cloud Run streaming service.
 *
 * Lets the phone play tracks it never synced, with the desktop asleep: the service is told a
 * track id and answers with a short-lived signed URL that MediaPlayer streams straight from
 * Cloud Storage. Nothing here ever carries audio - only the catalog and the URLs.
 *
 * Everything is gated on [Connectivity]: with no internet the catalog is not shown and no
 * request is attempted, so the app behaves exactly as it did before streaming existed.
 */
object StreamingClient {
    private const val PREFS = "streaming"
    private const val KEY_URL = "base_url"
    private const val KEY_TOKEN = "device_token"
    private const val CACHE_FILE = "stream-catalog.json"

    private val catalogState = MutableLiveData<List<StreamTrack>>(emptyList())

    /** The streamable catalog. Empty until a successful fetch; never shown while offline. */
    val catalog: LiveData<List<StreamTrack>> = catalogState

    private val statusState = MutableLiveData("")

    /** Human-readable result of the last catalog fetch, for the settings screen. */
    val status: LiveData<String> = statusState

    private var byId: Map<String, StreamTrack> = emptyMap()
    private var albumsById: Map<String, StreamAlbum> = emptyMap()
    private var artistsById: Map<String, StreamArtist> = emptyMap()
    private var trackIdsByArtist: Map<String, List<String>> = emptyMap()

    fun trackById(id: String): StreamTrack? = byId[id]

    fun album(id: String): StreamAlbum? = albumsById[id]

    fun albums(): Collection<StreamAlbum> = albumsById.values

    fun artist(id: String): StreamArtist? = artistsById[id]

    fun artists(): Collection<StreamArtist> = artistsById.values

    /** Derived from the tracks, since the catalog does not ship artist track lists. */
    fun trackIdsForArtist(id: String): List<String> = trackIdsByArtist[id].orEmpty()

    /** Bumped on every successful parse, so Compose can key off a changed catalog. */
    private val versionState = MutableLiveData(0)

    val version: LiveData<Int> = versionState

    /**
     * Where the service lives, and how we prove who we are.
     *
     * Both default to values baked in at build time (see `streaming.url` / `streaming.token` in
     * local.properties), so a fresh install is already configured. The stored values are an
     * override, used only if someone has actually typed something in settings - which is what
     * makes it possible to point one build at a different service, or re-token a device,
     * without a rebuild.
     */
    fun baseUrl(context: Context): String {
        val stored = prefs(context).getString(KEY_URL, "").orEmpty().trim()
        return (if (stored.isNotEmpty()) stored else BuildConfig.STREAMING_URL).trimEnd('/')
    }

    fun deviceToken(context: Context): String {
        val stored = prefs(context).getString(KEY_TOKEN, "").orEmpty().trim()
        return if (stored.isNotEmpty()) stored else BuildConfig.STREAMING_TOKEN
    }

    /** True when the current values came from the build rather than from settings. */
    fun isUsingBuiltInConfig(context: Context): Boolean =
        prefs(context).getString(KEY_URL, "").orEmpty().isBlank()

    fun isConfigured(context: Context): Boolean =
        baseUrl(context).isNotEmpty() && deviceToken(context).isNotEmpty()

    /**
     * Stores an override. Clearing a field removes the override rather than persisting an
     * empty string, so blanking the form falls back to the built-in values instead of
     * silently breaking streaming with no way back short of reinstalling.
     */
    fun save(context: Context, url: String, token: String) {
        val editor = prefs(context).edit()
        if (url.isBlank()) editor.remove(KEY_URL) else editor.putString(KEY_URL, url.trim().trimEnd('/'))
        if (token.isBlank()) editor.remove(KEY_TOKEN) else editor.putString(KEY_TOKEN, token.trim())
        editor.apply()
    }

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /**
     * Loads the catalog cached on disk.
     *
     * Only so a launch with working internet has something to show before the network round
     * trip lands. It is never surfaced while offline - being able to browse tracks that cannot
     * possibly play is worse than not listing them.
     */
    fun loadCached(context: Context) {
        try {
            val file = File(context.filesDir, CACHE_FILE)
            if (!file.exists()) {
                return
            }
            val parsed = parse(JSONObject(file.readText()))
            publish(parsed)
            statusState.postValue(
                "cached: ${parsed.tracks.size} tracks, ${parsed.albums.size} albums"
            )
        } catch (err: Exception) {
            println("stream catalog cache unreadable: $err")
        }
    }

    /** Fetches the catalog. Caller must be off the main thread. */
    fun refreshCatalog(context: Context): Boolean {
        if (!isConfigured(context)) {
            statusState.postValue("Not configured")
            return false
        }
        if (!Connectivity.isOnlineNow()) {
            statusState.postValue("Offline")
            return false
        }
        return try {
            val body = get(context, "/catalog")
            val parsed = parse(JSONObject(body))
            publish(parsed)
            try {
                File(context.filesDir, CACHE_FILE).writeText(body)
            } catch (err: Exception) {
                // a cache miss next launch is not worth failing the refresh over
            }
            statusState.postValue(
                "${parsed.tracks.size} tracks, ${parsed.albums.size} albums, " +
                    "${parsed.artists.size} artists"
            )
            true
        } catch (err: Exception) {
            statusState.postValue("Failed: ${err.message}")
            println("catalog refresh failed: $err")
            false
        }
    }

    /**
     * A playable URL for one track, or null.
     *
     * Short-lived by design (the service mints roughly an hour), so this is called at the
     * moment of playback rather than cached. Caller must be off the main thread.
     */
    fun trackUrl(context: Context, trackId: String): String? {
        if (!isConfigured(context) || !Connectivity.isOnlineNow()) {
            return null
        }
        return try {
            JSONObject(get(context, "/track/$trackId")).getString("url")
        } catch (err: Exception) {
            println("could not get stream url for $trackId: $err")
            null
        }
    }

    fun isStreamable(trackId: String): Boolean = byId.containsKey(trackId)

    private fun publish(parsed: ParsedCatalog) {
        byId = parsed.tracks.associateBy { it.id }
        albumsById = parsed.albums.associateBy { it.id }
        artistsById = parsed.artists.associateBy { it.id }
        trackIdsByArtist = parsed.tracks
            .flatMap { track -> track.artistIds.map { it to track.id } }
            .groupBy({ it.first }, { it.second })
        catalogState.postValue(parsed.tracks)
        versionState.postValue((versionState.value ?: 0) + 1)
    }

    private class ParsedCatalog(
        val tracks: List<StreamTrack>,
        val albums: List<StreamAlbum>,
        val artists: List<StreamArtist>,
    )

    private fun parse(body: JSONObject): ParsedCatalog {
        val trackArray: JSONArray = body.optJSONArray("tracks") ?: JSONArray()
        val albumArray: JSONArray = body.optJSONArray("albums") ?: JSONArray()
        val artistArray: JSONArray = body.optJSONArray("artists") ?: JSONArray()
        return ParsedCatalog(
            (0 until trackArray.length()).map { StreamTrack(trackArray.getJSONObject(it)) },
            (0 until albumArray.length()).map { StreamAlbum(albumArray.getJSONObject(it)) },
            (0 until artistArray.length()).map { StreamArtist(artistArray.getJSONObject(it)) },
        )
    }

    private fun get(context: Context, path: String): String {
        val connection = URL(baseUrl(context) + path).openConnection() as HttpURLConnection
        connection.requestMethod = "GET"
        connection.setRequestProperty("Authorization", "Bearer ${deviceToken(context)}")
        connection.connectTimeout = 10000
        connection.readTimeout = 20000
        try {
            val code = connection.responseCode
            if (code == HttpURLConnection.HTTP_UNAUTHORIZED) {
                throw Exception("device not authorised (401)")
            }
            if (code != HttpURLConnection.HTTP_OK) {
                throw Exception("HTTP $code")
            }
            return connection.inputStream.bufferedReader().use { it.readText() }
        } finally {
            connection.disconnect()
        }
    }
}
