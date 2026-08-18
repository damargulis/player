package com.example.musicnative

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.Divider
import androidx.compose.material.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.musicnative.components.ImageBox
import com.example.musicnative.components.PillButton
import com.example.musicnative.components.SearchField
import com.example.musicnative.ui.theme.Accent
import com.example.musicnative.ui.theme.Border
import com.example.musicnative.ui.theme.TextPrimary
import com.example.musicnative.ui.theme.TextSecondary
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
    trackData.put("favorites", JSONArray())
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

interface NamedItem {
    val name: String
}

fun combineNames(items: List<NamedItem>): String {
    return items.joinToString(separator = ", ") { item -> item.name }
}

@Composable
fun TrackPicker(tracks: List<TrackData>, title: String, playPlaylist: (tracks: List<TrackData>) -> Unit) {
    var query by remember { mutableStateOf("") }
    val playingTrack by PlaybackState.currentTrack.observeAsState(null)
    val visible = if (query.isBlank()) {
        tracks
    } else {
        tracks.filter { it.track.name.contains(query.trim(), ignoreCase = true) }
    }
    Column(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 16.dp)) {
            Text(
                title,
                color = TextPrimary,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                "${visible.size} tracks",
                color = TextSecondary,
                fontSize = 13.sp,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 10.dp)
        ) {
            PillButton("Shuffle", filled = true, modifier = Modifier.weight(1f)) {
                playPlaylist(visible.shuffled())
            }
            Spacer(modifier = Modifier.width(12.dp))
            PillButton("Play All", filled = false, modifier = Modifier.weight(1f)) {
                playPlaylist(visible)
            }
        }
        SearchField(query, "Search tracks") { query = it }
        LazyColumn {
            items(visible.size) { i ->
                val trackData = visible[i]
                Column {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            // play the visible list from this track onward
                            .clickable { playPlaylist(visible.drop(i)) }
                            .padding(horizontal = 20.dp, vertical = 8.dp)
                    ) {
                        ImageBox(filePath = trackData.albums.firstOrNull()?.artFile)
                        Spacer(modifier = Modifier.width(12.dp))
                        val isCurrent = playingTrack?.track?.id == trackData.track.id
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                trackData.track.name,
                                color = if (isCurrent) Accent else TextPrimary,
                                fontSize = 16.sp,
                                fontWeight = if (isCurrent) FontWeight.SemiBold else FontWeight.Normal,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                combineNames(trackData.artists),
                                color = TextSecondary,
                                fontSize = 13.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                    Divider(color = Border, thickness = 0.5.dp, startIndent = 20.dp)
                }
            }
        }
    }
}
