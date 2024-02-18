package com.example.musicnative

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.Button
import androidx.compose.material.ButtonDefaults
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.annotation.ExperimentalCoilApi
import com.example.musicnative.components.ImageBox
import org.json.JSONArray
import org.json.JSONObject

fun createAlbum(name: String, trackIds: JSONArray): Album {
    val albumData = JSONObject()
    albumData.put("name", name)
    albumData.put("id", name)
    albumData.put("trackIds", trackIds)
    return Album(albumData)
}

fun createArtist(name: String, trackIds: JSONArray) : Artist {
    val artistData = JSONObject()
    artistData.put("name", name)
    artistData.put("id", name)
    artistData.put("trackIds", trackIds)
    return Artist(artistData)
}

fun createTrack(name: String): TrackData {
    val trackData = JSONObject()
    trackData.put("name", name)
    trackData.put("id", name)
    trackData.put("year", 2012)
    trackData.put("duration", 201560)
    val artistIds = JSONArray()
    artistIds.put(0, "artist1")
    val albumIds = JSONArray()
    albumIds.put(0, "album1")
    trackData.put("artistIds", artistIds)
    trackData.put("albumIds", albumIds)
    val artists = mutableMapOf<String, Artist>()
    val trackIds = JSONArray()
    trackIds.put(0, name)
    artists["artist1"] = createArtist("Artist 1", trackIds)
    val albums = mutableMapOf<String, Album>()
    albums["album1"] = createAlbum("Album 1", trackIds)
    return TrackData(Track(trackData), artists, albums)
}

@Preview
@Composable
fun TestTrackPicker() {
    val tracks = mutableListOf<TrackData>()
    tracks.add(createTrack("track 1"))
    tracks.add(createTrack("track 2"))
    TrackPicker(tracks = tracks, title = "Test Title") {
        println("play stuff")
    }
}

@Composable
fun TrackPicker(tracks: List<TrackData>, title: String, playPlaylist: (tracks: List<TrackData>) -> Unit) {
    Column {
        Row(horizontalArrangement = Arrangement.Center, modifier = Modifier.fillMaxWidth()) {
            Text(title, fontSize = 32.sp)
        }
        Row(
            modifier = Modifier
                .padding(vertical = 2.dp)
                .fillMaxWidth()
        ) {
            Button(onClick = {
                val asList = tracks.toMutableList()
                asList.shuffle()
                playPlaylist(asList)
                             }, modifier = Modifier.fillMaxWidth(.5f)) {
                Text("Shuffle")
            }
            Button(onClick = { playPlaylist(tracks) }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(backgroundColor = Color.Transparent)) {
                Text("Play All")
            }
        }

        LazyColumn {
            items(tracks.size) {
            item -> Button(onClick = {playPlaylist(listOf(tracks[item])) },
                colors = ButtonDefaults.buttonColors(backgroundColor = Color.Transparent),
                modifier = Modifier.padding(vertical = 0.dp)
            ) { TrackRowItem(track = tracks[item])}}
        }
    }
}

interface NamedItem {
    val name: String
}

fun combineNames(items: List<NamedItem>): String {
    return items.joinToString(separator = " & ") { item -> item.name }
}

@OptIn(ExperimentalCoilApi::class)
@Composable
fun TrackRowItem(track: TrackData) {
    val artistText = combineNames(track.artists)
    val album = track.albums[0]
    // TODO: rotate images
    Row {
        ImageBox("/albumArt/${album.id}.png")
        Column(Modifier.fillMaxWidth(1f)) {
            Text(track.track.name, fontSize = 24.sp)
            Text(text = artistText, fontSize = 16.sp)
        }
    }

}
