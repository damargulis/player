package com.example.musicnative

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.*
import androidx.compose.runtime.*
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.musicnative.components.ImageBox
import com.example.musicnative.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Full-screen local player: art, live seek bar, transport, shuffle/repeat, up-next queue. */
@Composable
fun LocalPlayerScreen(onClose: () -> Unit = {}) {
    val track by PlaybackState.currentTrack.observeAsState(null)
    val queue by PlaybackState.queue.observeAsState(emptyList())
    val index by PlaybackState.currentIndex.observeAsState(-1)
    val playing by PlaybackState.isPlaying.observeAsState(false)
    val positionMs by PlaybackState.positionMs.observeAsState(0)
    val durationMs by PlaybackState.durationMs.observeAsState(0)
    val repeat by PlaybackState.repeatAll.observeAsState(false)
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val current = track
    if (current == null) {
        return CenteredMessage("Nothing playing")
    }

    val upcoming = if (index >= 0 && index + 1 <= queue.size) queue.drop(index + 1) else emptyList()

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp)
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            IconButton(
                onClick = onClose,
                modifier = Modifier.align(Alignment.CenterStart),
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_expand_more),
                    contentDescription = "back to library",
                    tint = TextSecondary,
                    modifier = Modifier.size(28.dp),
                )
            }
            Text(
                "NOW PLAYING",
                color = TextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 2.sp,
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(vertical = 14.dp),
            )
        }
        Spacer(modifier = Modifier.height(2.dp))
        Card(
            shape = RoundedCornerShape(14.dp),
            backgroundColor = com.example.musicnative.ui.theme.Surface,
            elevation = 12.dp,
        ) {
            ImageBox(
                filePath = current.albums.firstOrNull()?.artFile,
                size = 230.dp,
            )
        }
        Spacer(modifier = Modifier.height(18.dp))
        Text(
            current.track.name,
            color = TextPrimary,
            fontSize = 21.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
        )
        Text(
            combineNames(current.artists),
            color = TextSecondary,
            fontSize = 15.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 3.dp),
        )

        // seek bar: track locally while dragging; the seek is sent on release
        var dragging by remember { mutableStateOf(false) }
        var dragValue by remember { mutableStateOf(0f) }
        val duration = if (durationMs > 0) durationMs.toFloat() else 1f
        val position = if (dragging) dragValue else positionMs.toFloat()
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Text(
                toTime((position / 1000).toInt()),
                color = TextSecondary,
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.width(44.dp),
            )
            Slider(
                value = position.coerceIn(0f, duration),
                valueRange = 0f..duration,
                onValueChange = {
                    dragging = true
                    dragValue = it
                },
                onValueChangeFinished = {
                    playerCommand(context, SEEK_TO) {
                        putExtra(EXTRA_SEEK_MS, dragValue.toInt())
                    }
                    // hold the thumb briefly so a stale position doesn't snap it back
                    scope.launch {
                        delay(800)
                        dragging = false
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
                toTime(durationMs / 1000),
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
                .padding(vertical = 6.dp, horizontal = 4.dp),
        ) {
            IconButton(onClick = { playerCommand(context, SHUFFLE_UPCOMING) }) {
                Icon(
                    painter = painterResource(R.drawable.ic_shuffle),
                    contentDescription = "shuffle upcoming",
                    tint = TextSecondary,
                    modifier = Modifier.size(24.dp),
                )
            }
            IconButton(onClick = { playerCommand(context, PREVIOUS_TRACK) }) {
                Icon(
                    painter = painterResource(R.drawable.ic_skip_previous),
                    contentDescription = "previous",
                    tint = TextPrimary,
                    modifier = Modifier.size(34.dp),
                )
            }
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(64.dp)
                    .clip(CircleShape)
                    .background(Accent)
                    .clickable { playerCommand(context, PLAYPAUSE) },
            ) {
                Icon(
                    painter = painterResource(
                        if (playing) R.drawable.ic_baseline_pause_24 else R.drawable.ic_baseline_play_arrow_24),
                    contentDescription = "play-pause",
                    tint = Color.White,
                    modifier = Modifier.size(32.dp),
                )
            }
            IconButton(onClick = { playerCommand(context, NEXT_TRACK) }) {
                Icon(
                    painter = painterResource(R.drawable.ic_skip_next),
                    contentDescription = "next",
                    tint = TextPrimary,
                    modifier = Modifier.size(34.dp),
                )
            }
            IconButton(onClick = { PlaybackState.setRepeat(!repeat) }) {
                Icon(
                    painter = painterResource(R.drawable.ic_repeat),
                    contentDescription = "repeat all",
                    tint = if (repeat) Accent else TextSecondary,
                    modifier = Modifier.size(24.dp),
                )
            }
        }

        if (upcoming.isNotEmpty()) {
            Text(
                "UP NEXT",
                color = TextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 2.sp,
                modifier = Modifier
                    .align(Alignment.Start)
                    .padding(top = 8.dp, bottom = 4.dp),
            )
            LazyColumn(modifier = Modifier.weight(1f)) {
                items(upcoming.size) { i ->
                    val item = upcoming[i]
                    Column {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    playerCommand(context, SKIP_TO_INDEX) {
                                        putExtra(EXTRA_QUEUE_INDEX, index + 1 + i)
                                    }
                                }
                                .padding(vertical = 8.dp)
                        ) {
                            Text(
                                item.track.name,
                                color = TextPrimary,
                                fontSize = 15.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                combineNames(item.artists),
                                color = TextSecondary,
                                fontSize = 12.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        Divider(color = Border, thickness = 0.5.dp)
                    }
                }
            }
        } else {
            Spacer(modifier = Modifier.weight(1f))
        }
    }
}
