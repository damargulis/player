package com.example.musicnative

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.AccountBox
import androidx.compose.material.icons.outlined.AddCircle
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.annotation.ExperimentalCoilApi
import coil.compose.rememberImagePainter
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

fun getArtists(artistsData: JSONArray): Array<Artist> {
    return Array(artistsData.length()) { i -> Artist(artistsData.get(i) as JSONObject)}
}

fun getAlbums(albumData: JSONArray): Array<Album> {
    return Array(albumData.length()) { i -> Album(albumData.get(i) as JSONObject)}
}

@OptIn(ExperimentalCoilApi::class)
@Composable
fun RemoteScreen(connected: Boolean, emit: (action: String) -> Any, remoteState: JSONObject) {
    if (!connected) {
        return Text("Not Connected")
    }
    if (!remoteState.has("track")) {
        // TODO: should have start at least...
        return Text("No State")
    }
    println(remoteState)
    val remoteTrack = Track(remoteState.get("track") as JSONObject)
    val remoteArtists = getArtists(remoteState.get("artists") as JSONArray)
    val artistName = combineNames(remoteArtists.toList())
    val remoteAlbums = getAlbums(remoteState.get("albums") as JSONArray)
    val albumName = combineNames(remoteAlbums.toList())
    val mediaState = remoteState.get("mediaState") as JSONObject
    val paused = mediaState.get("paused") as Boolean
    val time = remoteState.getInt("currentTime")
    val progress = (time * 1000) / remoteTrack.duration.toFloat()
    // TODO: rotate if multiple
    val artFile = "$BASE_URL/get-album-art/${remoteAlbums[0].id}"
    val curYear = Calendar.getInstance().get(Calendar.YEAR)
    val isFavorite = remoteTrack.favorites.any { fav -> fav == curYear }
    println(remoteTrack.favorites)
    println(isFavorite)
    println(curYear)
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(modifier = Modifier.height(40.dp))
        Box(
            Modifier
                .height(80.dp)
                .width(80.dp)
        ){
            Image(painter = rememberImagePainter(artFile, builder = {
                placeholder(R.drawable.ic_baseline_album_24)
            }), contentDescription = "Album Art",)
        }
        Spacer(modifier = Modifier.height(20.dp))
        Text(remoteTrack.name, fontSize = 32.sp)
        Text(albumName, fontSize = 24.sp)
        Text(artistName, fontSize = 24.sp)
        Text(remoteTrack.year.toString(), fontSize = 24.sp)
        Spacer(modifier = Modifier.height(20.dp))
        LinearProgressIndicator(
            modifier = Modifier
                .fillMaxWidth()
                .height(20.dp),
            backgroundColor = Color.LightGray,
            color = Color.Red,
            progress = progress
        )
        Spacer(modifier = Modifier.height(20.dp))
        val modifier = Modifier.width(120.dp).height(120.dp)
        Column {
            Row {
                IconButton(onClick = { emit("prevAlbum") }, modifier = modifier) {
                    Icon(imageVector = Icons.Filled.ArrowBack, "previous album", modifier = modifier)
                }
                IconButton(onClick = { emit("nextAlbum") }, modifier = modifier) {
                    Icon(Icons.Filled.ArrowForward, "next album", modifier = modifier)
                }
            }
            Row {
                IconButton(onClick = { emit("prevTrack") }, modifier = modifier) {
                    Icon(imageVector = Icons.Filled.KeyboardArrowLeft, "previous track", modifier = modifier)
                }
                IconButton(onClick = { emit("nextTrack") }, modifier = modifier) {
                    Icon(Icons.Filled.KeyboardArrowRight,"next track", modifier = modifier)
                }
            }
            Row {
                IconButton(onClick = { emit("playTrack") }, modifier = modifier) {
                    Icon(painter = painterResource(id = if (paused) R.drawable.ic_baseline_play_arrow_24 else R.drawable.ic_baseline_pause_24), "play-pause", modifier = modifier)
                }
                IconButton(onClick = { emit("favoriteTrack") }, modifier = modifier) {
                    Icon(if (isFavorite) Icons.Filled.Favorite else Icons.Outlined.AddCircle, "favorite", modifier = modifier)
                }
            }
        }
    }
}

@Preview
@Composable
fun RemoteScreenPreview() {
    val state = JSONObject()
    state.put("track", JSONObject("{\"id\": \"1234\", \"duration\": 201560, \"name\": \"Track Name\", \"albumIds\": [], \"artistIds\": [], \"year\": 2014, \"favorites\": []}"))
    state.put("artists", JSONArray("[{\"id\": 2345, \"name\": \"Artist Name\", \"trackIds\": []}]"))
    state.put("albums", JSONArray("[{\"id\": 3456, \"name\": \"Album Name\", \"trackIds\": [], \"artistIds\": []}]"))
    state.put("mediaState", JSONObject("{\"paused\": true, \"volume\": 0}"))
    state.put("currentTime", 60.0)
    RemoteScreen(connected = true, emit = {action -> println(action) }, state)
}