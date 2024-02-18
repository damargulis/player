package com.example.musicnative

import android.content.Context
import com.google.gson.Gson
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileNotFoundException
import java.io.Serializable
import java.util.concurrent.locks.ReentrantLock

const val LIBRARY_FILE = "library.json"

class Playlist(data: JSONObject) : ListItem {
    override var name = ""
    val trackIds: Array<String>

    init {
        this.name = data.getString("name")
        val trackIdsObj = data.getJSONArray("trackIds")
        this.trackIds = Array(trackIdsObj.length()) {
            trackIdsObj.getString(it)
        }
    }
}

class Track(data: JSONObject) : ListItem, Serializable {
    override var name = ""
    var id = ""
    var albumIds: Array<String>
    var artistIds: Array<String>
    val year: Int
    val duration: Int
    val favorites: Array<Int>
    init {
        this.name = data.getString("name")
        this.id = data.getString("id")
        this.year = data.getInt("year")
        val albumIdsObj = data.getJSONArray("albumIds")
        this.albumIds = Array(albumIdsObj.length()) {
            albumIdsObj.getString(it)
        }
        val artistIdsObj = data.getJSONArray("artistIds")
        this.artistIds = Array(artistIdsObj.length()) {
            artistIdsObj.getString(it)
        }
        val duration = data.get("duration")
        this.duration = duration as? Int ?: 0
        val favorites = data.getJSONArray("favorites")
        this.favorites = Array(favorites.length()) {
            favorites.getInt(it)
        }
    }

}

class Album(data: JSONObject): ListItem, Serializable, NamedItem {
    override var name = ""
    var artFile = ""
    var id = ""
    var trackIds: Array<String>
    var artistIds: Array<String>
    init {
        this.name = data.getString("name")
        this.id = data.getString("id")
        val trackIdsObj = data.getJSONArray("trackIds")
        this.trackIds = Array(trackIdsObj.length()) {
            trackIdsObj.getString(it)
        }
        val artistIdsObj = data.getJSONArray("artistIds")
        this.artistIds = Array(artistIdsObj.length()) {
            artistIdsObj.getString(it)
        }
        this.artFile = "/albumArt/${this.id}.png"
    }
}

class Artist(data: JSONObject): ListItem, Serializable, NamedItem {
    override var name = ""
    private var artFile = ""
    var id = ""
    var trackIds: Array<String>
    init {
        this.name = data.getString("name")
        this.id = data.getString("id")
        val trackIdsObj = data.getJSONArray("trackIds")
        this.trackIds = Array(trackIdsObj.length()) {
            trackIdsObj.getString(it)
        }
        this.artFile = "/artistArt/${this.id}.png"
    }
}

class LibraryData {
    val playlists: MutableList<Playlist> = mutableListOf()
    val tracks: MutableMap<String, Track> = mutableMapOf()
    val albums: MutableMap<String, Album> = mutableMapOf()
    val artists: MutableMap<String, Artist> = mutableMapOf()
}

class Library(private val context: Context) {
    var library: LibraryData
    val saveLock = ReentrantLock()

    init {
        this.library = LibraryData()
        println("constructor")
        println(this.library.playlists.size)
    }

    fun setPlaylists (playlists: JSONArray) {
        this.library.playlists.clear()
        this.library.playlists.addAll(Array(playlists.length()) {
            Playlist(playlists.getJSONObject(it))
        })
    }

    fun addTrack (track: Track) {
        saveLock.lock()
        try {
            this.library.tracks[track.id] = track
        } catch (err: Error) {
            println("add track error?!??!")
            println(err)
        } finally {
            saveLock.unlock()
        }
    }

    fun addAlbum (album: Album) {
        saveLock.lock()
        try {
            this.library.albums[album.id] = album
        } catch (err: Error) {
            println("add album error")
            println(err)
        } finally {
            saveLock.unlock()
        }
    }

    fun addArtist(artist: Artist) {
        saveLock.lock()
        try {
            this.library.artists[artist.id] = artist
        } catch (err: Error) {
            println("caught add artist error???")
            println(err)
        } finally {
            saveLock.unlock()
        }
    }

    fun load(): LibraryData {
        println("LOADING LIBRARY")
        try {
            val gson = Gson()
            val bufferedReader = context.openFileInput(LIBRARY_FILE).bufferedReader()
            val inputString = bufferedReader.use {it.readText()}
            println("RETURNING FROM GSON")
            println(inputString)
            library = gson.fromJson(inputString, LibraryData::class.java)
            println("Returning library")
            println(library)
            println(library.playlists[0].name)
            return library
        } catch (e: Exception) {
            println("load failed")
            println(e)
        }
        println("RETURNING NULL")
        return LibraryData()
    }

    fun removeOldTrackIds(trackIds: Set<String>) {
        val removableIds = mutableListOf<String>()
        library.tracks.forEach { (trackId, _) ->
            if (!trackIds.contains(trackId)) {
                println("Deleting: $trackId")
                val file = File(context.getExternalFilesDir(null)?.absolutePath + "/tracks/" + "$trackId.mp3")
                println("got file")
                file.delete()
                println("deleting")
                removableIds.add(trackId)
            }
        }
        println("Doing delete for lib")
        library.tracks.minusAssign(removableIds.toSet())
    }

    fun removeOldAlbums(trackIds: Set<String>): Set<String?> {
        println("remove old albums:")
        val keepAlbums = trackIds.flatMap {
            println("Checking trackId:")
            println(it)
            println(this.library.tracks[it]?.albumIds)
            (library.tracks[it]?.albumIds?.toList() ?: listOf())
        }
        val keepAlbumsSet = keepAlbums.toSet()
        val deleteAlbums = library.albums.filter {
            albumId -> !keepAlbumsSet.contains(albumId.key)
        }
        deleteAlbums.forEach { albumId ->
            val file = File(context.getExternalFilesDir(null)?.absolutePath + "/albumArt/" + "${albumId.key}.png")
            println("deleting: " + file.path)
            file.delete()
        }
        library.albums.minusAssign(deleteAlbums.keys)
        println("Would delete:")
        println(deleteAlbums)
        println("keep:")
        println(keepAlbumsSet)
        return keepAlbumsSet
    }

    fun removeOldArtists(trackIds: Set<String>): Set<String> {
        println("remove old artists:")
        val keepArtists = trackIds.flatMap {
            (library.tracks[it]?.artistIds?.toList() ?: listOf())
        }
        val keepArtistsSet = keepArtists.toSet()
        val deleteArtists = library.artists.filter {
            artistId -> !keepArtistsSet.contains(artistId.key)
        }
        deleteArtists.forEach {artistId ->
            val file = File(context.getExternalFilesDir(null)?.absolutePath + "/artistArt/" + "${artistId.key}.png")
            println("deleting: " + file.path)
            file.delete()
        }
        library.artists.minusAssign(deleteArtists.keys)
        // TODO: delete art file
        return keepArtistsSet
    }

    fun save() {
        saveLock.lock()
        try {
            val fos = context.openFileOutput(LIBRARY_FILE, Context.MODE_PRIVATE)
            val gson = Gson()
            fos.write(gson.toJson(library).encodeToByteArray())
        } catch (e: FileNotFoundException) {
            println(e)
        } finally {
            saveLock.unlock()
        }
    }
}