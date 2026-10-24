package com.example.musicnative

import android.content.Context
import java.io.File
import org.json.JSONArray
import org.json.JSONObject

/**
 * One library made of two sources: what is synced to the phone, and what the cloud can stream.
 *
 * The point is that browsing should not care. An album half-synced and half in the cloud is one
 * album with its tracks in running order, and playing it through works because
 * [MediaPlaybackService] already resolves each track independently - local file if there is
 * one, signed URL if not.
 *
 * Everything cloud-side is conditional on [online]. Offline this collapses to exactly the
 * synced library, which is what the app has always shown: no greyed-out rows that cannot play,
 * no albums that turn out to be empty when opened.
 */
class MergedLibrary(
    private val context: Context,
    private val localTracks: Map<String, Track>,
    private val localAlbums: Map<String, Album>,
    private val localArtists: Map<String, Artist>,
    private val online: Boolean,
) {
    /**
     * Ids of tracks whose audio is actually on disk.
     *
     * One directory listing rather than a File.exists() per track: the All Tracks screen asks
     * about every id in the library, and twenty thousand stat calls during composition would
     * visibly stall the UI. Computed once per instance, which Compose remembers.
     */
    private val localFileIds: Set<String> by lazy {
        File(context.getExternalFilesDir(null), "tracks")
            .list()
            .orEmpty()
            .mapNotNull { if (it.endsWith(".mp3")) it.removeSuffix(".mp3") else null }
            .toSet()
    }

    private fun hasLocalFile(trackId: String): Boolean = localFileIds.contains(trackId)

    /**
     * Whether a track can actually be played right now.
     *
     * A synced track counts even offline. A cloud track counts only while online - and a track
     * the library knows about but which is neither synced nor uploaded counts for nothing, so
     * it is never listed rather than listed and dead.
     */
    fun isPlayable(trackId: String): Boolean {
        if (localTracks.containsKey(trackId) && hasLocalFile(trackId)) {
            return true
        }
        return online && StreamingClient.trackById(trackId) != null
    }

    /** True for a track that will come over the network, for the small cloud marker in lists. */
    fun isCloudOnly(trackId: String): Boolean =
        !hasLocalFile(trackId) && online && StreamingClient.trackById(trackId) != null

    fun albums(): List<Album> {
        val merged = localAlbums.toMutableMap()
        if (online) {
            StreamingClient.albums().forEach { cloud ->
                // a synced album wins: it has real art on disk, which the cloud entry has no
                // way to provide
                if (!merged.containsKey(cloud.id)) {
                    merged[cloud.id] = albumFrom(cloud)
                }
            }
        }
        return merged.values.sortedBy { it.name.lowercase() }
    }

    fun artists(): List<Artist> {
        val merged = localArtists.toMutableMap()
        if (online) {
            StreamingClient.artists().forEach { cloud ->
                if (!merged.containsKey(cloud.id)) {
                    merged[cloud.id] = artistFrom(cloud)
                }
            }
        }
        return merged.values.sortedBy { it.name.lowercase() }
    }

    fun album(id: String): Album? = localAlbums[id]
        ?: (if (online) StreamingClient.album(id)?.let { albumFrom(it) } else null)

    fun artist(id: String): Artist? = localArtists[id]
        ?: (if (online) StreamingClient.artist(id)?.let { artistFrom(it) } else null)

    /**
     * An album's tracks, in running order, limited to what can be played.
     *
     * The cloud entry carries the album's full running order including tracks that were never
     * uploaded, which is the only way to order a part-synced album correctly - the local copy
     * only knows about the tracks it has. Unplayable entries are then dropped rather than shown
     * as dead rows.
     */
    fun tracksForAlbum(id: String): List<TrackData> {
        val cloudOrder = if (online) StreamingClient.album(id)?.trackIds else null
        val order = cloudOrder ?: localAlbums[id]?.trackIds?.toList() ?: emptyList()
        return order.filter { isPlayable(it) }.mapNotNull { resolve(it) }
    }

    fun tracksForArtist(id: String): List<TrackData> =
        playableTrackIdsForArtist(id).mapNotNull { resolve(it) }

    /**
     * How many of an artist's tracks can actually be played.
     *
     * Counts ids without building TrackData for each: the artist list asks this for every row,
     * and resolving a thousand artists' worth of tracks to render subtitles would be wasteful.
     */
    fun playableTrackCountForArtist(id: String): Int = playableTrackIdsForArtist(id).size

    private fun playableTrackIdsForArtist(id: String): List<String> {
        val ids = LinkedHashSet<String>()
        localArtists[id]?.trackIds?.forEach { ids.add(it) }
        if (online) {
            StreamingClient.trackIdsForArtist(id).forEach { ids.add(it) }
        }
        return ids.filter { isPlayable(it) }
    }

    /** Everything playable, for the All Tracks screen. */
    fun allTracks(): List<TrackData> {
        val ids = LinkedHashSet<String>()
        localTracks.keys.forEach { ids.add(it) }
        if (online) {
            StreamingClient.catalog.value?.forEach { ids.add(it.id) }
        }
        return ids.filter { isPlayable(it) }.mapNotNull { resolve(it) }
    }

    /** Playlists stay local-only: they are a synced concept and the catalog has no notion. */
    fun tracksForIds(trackIds: Array<String>): List<TrackData> =
        trackIds.filter { isPlayable(it) }.mapNotNull { resolve(it) }

    /**
     * Builds the TrackData the player and lists use, from whichever source has the track.
     *
     * Synced first so real album art and the library's own metadata win; the cloud entry is the
     * fallback and resolves its names through the merged maps so a cloud track on a synced
     * album still shows that album.
     */
    fun resolve(trackId: String): TrackData? {
        localTracks[trackId]?.let { track ->
            return TrackData(track, localArtists, localAlbums)
        }
        if (!online) {
            return null
        }
        val cloud = StreamingClient.trackById(trackId) ?: return null
        val artists = mutableMapOf<String, Artist>()
        val albums = mutableMapOf<String, Album>()
        cloud.artistIds.forEach { id -> artist(id)?.let { artists[id] = it } }
        cloud.albumIds.forEach { id -> album(id)?.let { albums[id] = it } }
        return TrackData(trackFrom(cloud), artists, albums)
    }

    private fun trackFrom(cloud: StreamTrack): Track {
        val json = JSONObject()
        json.put("name", cloud.name)
        json.put("id", cloud.id)
        json.put("year", cloud.year)
        json.put("duration", cloud.duration)
        json.put("favorites", JSONArray())
        json.put("artistIds", JSONArray(cloud.artistIds))
        json.put("albumIds", JSONArray(cloud.albumIds))
        return Track(json)
    }

    private fun albumFrom(cloud: StreamAlbum): Album {
        val json = JSONObject()
        json.put("name", cloud.name)
        json.put("id", cloud.id)
        json.put("trackIds", JSONArray(cloud.trackIds))
        json.put("artistIds", JSONArray(cloud.artistIds))
        return Album(json)
    }

    private fun artistFrom(cloud: StreamArtist): Artist {
        val json = JSONObject()
        json.put("name", cloud.name)
        json.put("id", cloud.id)
        json.put("trackIds", JSONArray())
        return Artist(json)
    }
}
