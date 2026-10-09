package com.example.musicnative

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.annotation.ExperimentalCoilApi
import coil.compose.rememberImagePainter
import com.example.musicnative.components.PillButton
import com.example.musicnative.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

fun getArtists(artistsData: JSONArray): Array<Artist> {
    return Array(artistsData.length()) { i -> Artist(artistsData.get(i) as JSONObject)}
}

fun getAlbums(albumData: JSONArray): Array<Album> {
    return Array(albumData.length()) { i -> Album(albumData.get(i) as JSONObject)}
}

fun toTime(totalSeconds: Int): String {
    val mins = totalSeconds / 60
    val secs = totalSeconds % 60
    return "%d:%02d".format(mins, secs)
}

@Composable
fun CenteredMessage(text: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier.fillMaxSize()
    ) {
        Text(text, color = TextSecondary, fontSize = 16.sp)
    }
}

@OptIn(ExperimentalCoilApi::class)
@Composable
fun RemoteScreen(
    connected: Boolean,
    emit: (action: String, data: Any?) -> Unit,
    remoteState: JSONObject,
    onOpenDj: () -> Unit,
) {
    if (!connected) {
        return CenteredMessage("Not connected to the desktop")
    }
    if (!remoteState.has("track") || remoteState.isNull("track")) {
        // Nothing queued yet — asking the DJ for something is how you start from cold.
        return Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp),
        ) {
            Text("Nothing playing", color = TextSecondary, fontSize = 16.sp)
            Spacer(modifier = Modifier.height(16.dp))
            PillButton(text = "Ask the DJ", filled = true, onClick = onOpenDj)
        }
    }
    val remoteTrack = Track(remoteState.get("track") as JSONObject)
    val remoteArtists = getArtists(remoteState.get("artists") as JSONArray)
    val artistName = combineNames(remoteArtists.toList())
    val remoteAlbums = getAlbums(remoteState.get("albums") as JSONArray)
    val albumName = combineNames(remoteAlbums.toList())
    val mediaState = remoteState.get("mediaState") as JSONObject
    val paused = mediaState.optBoolean("paused", true)
    val volume = mediaState.optDouble("volume", 0.0)
    val currentTime = remoteState.optDouble("currentTime", 0.0)
    val durationSec = remoteTrack.duration / 1000f
    val artFile = if (remoteAlbums.isNotEmpty()) {
        "${ServerConnection.baseUrl}/get-album-art/${remoteAlbums[0].id}"
    } else {
        null
    }
    val curYear = Calendar.getInstance().get(Calendar.YEAR)
    val isFavorite = remoteTrack.favorites.any { fav -> fav == curYear }
    val albumLine = listOf(albumName, remoteTrack.year.toString())
        .filter { it.isNotEmpty() && it != "0" }
        .joinToString(" · ")

    val scope = rememberCoroutineScope()

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp)
    ) {
        Spacer(modifier = Modifier.height(16.dp))
        Box(modifier = Modifier.fillMaxWidth()) {
            Text(
                "NOW PLAYING",
                color = TextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 2.sp,
                modifier = Modifier.align(Alignment.Center),
            )
            Text(
                "DJ",
                color = Accent,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .clip(RoundedCornerShape(12.dp))
                    .clickable(onClick = onOpenDj)
                    .padding(horizontal = 10.dp, vertical = 4.dp),
            )
        }
        Spacer(modifier = Modifier.weight(1f))
        Card(
            shape = RoundedCornerShape(16.dp),
            backgroundColor = Surface,
            elevation = 14.dp,
        ) {
            Image(
                painter = rememberImagePainter(artFile, builder = {
                    placeholder(R.drawable.missing_album)
                    error(R.drawable.missing_album)
                }),
                contentDescription = "Album Art",
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(280.dp)
                    .clip(RoundedCornerShape(16.dp)),
            )
        }
        Spacer(modifier = Modifier.weight(1f))

        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    remoteTrack.name,
                    color = TextPrimary,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    artistName,
                    color = TextSecondary,
                    fontSize = 16.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 4.dp),
                )
                Text(
                    albumLine,
                    color = TextSecondary,
                    fontSize = 13.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            IconButton(onClick = { emit("favoriteTrack", null) }) {
                Icon(
                    painter = painterResource(if (isFavorite) R.drawable.ic_star else R.drawable.ic_star_border),
                    contentDescription = "favorite",
                    tint = if (isFavorite) Accent else TextSecondary,
                    modifier = Modifier.size(26.dp),
                )
            }
        }

        // seek bar: track locally while dragging; the seek is sent on release
        var seekDragging by remember { mutableStateOf(false) }
        var seekValue by remember { mutableStateOf(0f) }
        val position = if (seekDragging) seekValue else currentTime.toFloat()
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Text(
                toTime(position.toInt()),
                color = TextSecondary,
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.width(44.dp),
            )
            Slider(
                value = position.coerceIn(0f, if (durationSec > 0) durationSec else 1f),
                valueRange = 0f..(if (durationSec > 0) durationSec else 1f),
                onValueChange = {
                    seekDragging = true
                    seekValue = it
                },
                onValueChangeFinished = {
                    emit("setTime", seekValue.toDouble())
                    // hold the thumb briefly so a stale broadcast doesn't snap it back
                    scope.launch {
                        delay(800)
                        seekDragging = false
                    }
                },
                colors = SliderDefaults.colors(
                    thumbColor = TextPrimary,
                    activeTrackColor = Accent,
                    inactiveTrackColor = Border,
                ),
                modifier = Modifier.weight(1f),
            )
            Text(
                toTime((remoteTrack.duration / 1000)),
                color = TextSecondary,
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.width(44.dp),
            )
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 10.dp, horizontal = 4.dp),
        ) {
            IconButton(onClick = { emit("prevAlbum", null) }) {
                Icon(
                    painter = painterResource(R.drawable.ic_fast_rewind),
                    contentDescription = "previous album",
                    tint = TextSecondary,
                    modifier = Modifier.size(28.dp),
                )
            }
            IconButton(onClick = { emit("prevTrack", null) }) {
                Icon(
                    painter = painterResource(R.drawable.ic_skip_previous),
                    contentDescription = "previous track",
                    tint = TextPrimary,
                    modifier = Modifier.size(34.dp),
                )
            }
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(68.dp)
                    .clip(CircleShape)
                    .background(Accent)
                    .clickable { emit("playTrack", null) },
            ) {
                Icon(
                    painter = painterResource(if (paused) R.drawable.ic_baseline_play_arrow_24 else R.drawable.ic_baseline_pause_24),
                    contentDescription = "play-pause",
                    tint = Color.White,
                    modifier = Modifier.size(34.dp),
                )
            }
            IconButton(onClick = { emit("nextTrack", null) }) {
                Icon(
                    painter = painterResource(R.drawable.ic_skip_next),
                    contentDescription = "next track",
                    tint = TextPrimary,
                    modifier = Modifier.size(34.dp),
                )
            }
            IconButton(onClick = { emit("nextAlbum", null) }) {
                Icon(
                    painter = painterResource(R.drawable.ic_fast_forward),
                    contentDescription = "next album",
                    tint = TextSecondary,
                    modifier = Modifier.size(28.dp),
                )
            }
        }

        // volume: throttled live updates so the desktop volume follows the drag
        var volumeDragging by remember { mutableStateOf(false) }
        var volumeValue by remember { mutableStateOf(0f) }
        var lastVolumeSent by remember { mutableStateOf(0L) }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 10.dp),
        ) {
            Icon(
                painter = painterResource(R.drawable.ic_volume_down),
                contentDescription = "volume down",
                tint = TextSecondary,
                modifier = Modifier.size(18.dp),
            )
            Slider(
                value = if (volumeDragging) volumeValue else volume.toFloat(),
                valueRange = 0f..1f,
                onValueChange = {
                    volumeDragging = true
                    volumeValue = it
                    val now = System.currentTimeMillis()
                    if (now - lastVolumeSent > 150) {
                        lastVolumeSent = now
                        emit("setVolume", it.toDouble())
                    }
                },
                onValueChangeFinished = {
                    emit("setVolume", volumeValue.toDouble())
                    scope.launch {
                        delay(800)
                        volumeDragging = false
                    }
                },
                colors = SliderDefaults.colors(
                    thumbColor = TextPrimary,
                    activeTrackColor = Accent,
                    inactiveTrackColor = Border,
                ),
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 8.dp),
            )
            Icon(
                painter = painterResource(R.drawable.ic_volume_up),
                contentDescription = "volume up",
                tint = TextSecondary,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}
