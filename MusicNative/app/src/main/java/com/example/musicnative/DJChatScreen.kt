package com.example.musicnative

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.Divider
import androidx.compose.material.Icon
import androidx.compose.material.Text
import androidx.compose.material.TextField
import androidx.compose.material.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.musicnative.components.PillButton
import com.example.musicnative.ui.theme.Accent
import com.example.musicnative.ui.theme.Background
import com.example.musicnative.ui.theme.Border
import com.example.musicnative.ui.theme.SurfaceLight
import com.example.musicnative.ui.theme.TextPrimary
import com.example.musicnative.ui.theme.TextSecondary
import com.example.musicnative.ui.theme.Warning
import org.json.JSONArray
import org.json.JSONObject

/**
 * Chat with the desktop DJ. Messages go out as the "dj-message" remote action and the
 * transcript comes back on "dj-state"; sending with no conversation in progress simply
 * starts one, so this doubles as the way to start playback from a cold app.
 */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun DJChatScreen(onClose: () -> Unit) {
    val entries by DJChatState.entries.observeAsState(emptyList())
    val busy by DJChatState.busy.observeAsState(false)
    val note by DJChatState.note.observeAsState(null)
    val queue by DJChatState.queue.observeAsState(null)
    var queueOpen by remember { mutableStateOf(false) }
    val configured by DJChatState.configured.observeAsState(true)
    val connected by ServerConnection.connected.observeAsState(false)
    var draft by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    val keyboard = LocalSoftwareKeyboardController.current

    // Pull the current transcript when the screen opens.
    LaunchedEffect(connected) {
        if (connected) {
            ServerConnection.emit("dj-sync")
        }
    }
    LaunchedEffect(entries.size, busy) {
        val rows = entries.size + if (busy) 1 else 0
        if (rows > 0) {
            listState.animateScrollToItem(rows - 1)
        }
    }

    val send = {
        val text = draft.trim()
        if (text.isNotEmpty()) {
            ServerConnection.emit("dj-message", text)
            draft = ""
            keyboard?.hide()
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp)
        ) {
            Icon(
                painter = painterResource(R.drawable.ic_baseline_keyboard_arrow_left_24),
                contentDescription = "back",
                tint = TextPrimary,
                modifier = Modifier
                    .align(Alignment.CenterStart)
                    .clip(RoundedCornerShape(14.dp))
                    .clickable(onClick = onClose)
                    .padding(2.dp),
            )
            Text(
                "DJ",
                color = TextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 2.sp,
                modifier = Modifier.align(Alignment.Center),
            )
            Text(
                "New set",
                color = Accent,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .clip(RoundedCornerShape(12.dp))
                    .clickable { ServerConnection.emit("dj-new-session") }
                    .padding(horizontal = 8.dp, vertical = 4.dp),
            )
        }
        Divider(color = Border, thickness = 0.5.dp)

        val upcoming = queue?.upcoming ?: emptyList()
        if (connected && queue?.active == true && queue?.current != null) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SurfaceLight)
                    .padding(horizontal = 14.dp, vertical = 8.dp),
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        queue?.current?.name ?: "",
                        color = TextPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        (queue?.current?.artist ?: "") + if (queue?.isPlaying == false) " · paused" else "",
                        color = TextSecondary,
                        fontSize = 12.5.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Text(
                    if (queueOpen) "Hide" else "Up next (${upcoming.size})",
                    color = Accent,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .clickable { queueOpen = !queueOpen }
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                )
            }
            Divider(color = Border, thickness = 0.5.dp)
            if (queueOpen) {
                QueueList(upcoming, modifier = Modifier.heightIn(max = 260.dp))
                Divider(color = Border, thickness = 0.5.dp)
            }
        }

        if (!connected) {
            CenteredMessage("Not connected to the desktop")
        } else if (!configured) {
            CenteredMessage("The desktop has no Anthropic API key configured")
        } else {
            LazyColumn(
                state = listState,
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 12.dp),
            ) {
                if (entries.isEmpty()) {
                    item {
                        Text(
                            "Tell the DJ what you're doing or how you feel — \"rainy Sunday morning\", " +
                                "\"focus music, no vocals\", \"full albums while I work\". Keep chatting to " +
                                "steer it; the current song keeps playing while the queue changes.",
                            color = TextSecondary,
                            fontSize = 14.sp,
                            modifier = Modifier.padding(vertical = 24.dp),
                        )
                    }
                }
                // names appear only once a second person has joined the conversation
                val multipleSpeakers = entries.mapNotNull { it.speaker }.distinct().size > 1
                items(entries, key = { it.id }) { entry -> ChatBubble(entry, multipleSpeakers) }
                if (busy) {
                    item {
                        Text(
                            "${note ?: "Digging through the crates"}…",
                            color = TextSecondary,
                            fontSize = 13.sp,
                            fontStyle = FontStyle.Italic,
                        )
                    }
                }
            }
            Divider(color = Border, thickness = 0.5.dp)
            Row(
                verticalAlignment = Alignment.Bottom,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            ) {
                TextField(
                    value = draft,
                    onValueChange = { draft = it },
                    placeholder = { Text("What should we listen to?", color = TextSecondary, fontSize = 15.sp) },
                    maxLines = 4,
                    shape = RoundedCornerShape(10.dp),
                    colors = TextFieldDefaults.textFieldColors(
                        backgroundColor = SurfaceLight,
                        textColor = TextPrimary,
                        cursorColor = Accent,
                        focusedIndicatorColor = Color.Transparent,
                        unfocusedIndicatorColor = Color.Transparent,
                    ),
                    modifier = Modifier.weight(1f),
                )
                Spacer(modifier = Modifier.width(8.dp))
                PillButton(text = "Send", filled = true, onClick = send)
            }
        }
    }
}

/**
 * Stable colour per speaker, matching src/dj/speakerColor.tsx and the web app so the same
 * person looks the same on every client. Kotlin Int overflow matches JS's |0, so the hashes agree.
 */
private val SPEAKER_COLORS = listOf(
    Color(0xFF8B7CF6), // violet (the app accent)
    Color(0xFF12A594), // teal
    Color(0xFFE0557A), // rose
    Color(0xFFB9740F), // amber
    Color(0xFF3FA45C), // green
    Color(0xFF4A86F0), // blue
)

private fun speakerColor(name: String?): Color {
    if (name == null) {
        return SPEAKER_COLORS[0]
    }
    var hash = 0
    for (c in name.trim().lowercase()) {
        hash = hash * 31 + c.code
    }
    val size = SPEAKER_COLORS.size
    return SPEAKER_COLORS[((hash % size) + size) % size]
}

/** Up next, with whole albums folded into one row so they can be dropped together. */
@Composable
private fun QueueList(upcoming: List<QueueTrack>, modifier: Modifier = Modifier) {
    if (upcoming.isEmpty()) {
        Text(
            "Queue is empty.",
            color = TextSecondary,
            fontSize = 13.sp,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
        )
        return
    }
    // consecutive tracks from the same album share one header
    val rows = mutableListOf<Pair<QueueTrack?, QueueTrack>>()
    val headers = mutableMapOf<String, Int>()
    upcoming.forEach { track ->
        if (track.group != null) {
            headers[track.group] = (headers[track.group] ?: 0) + 1
        }
    }
    val seen = mutableSetOf<String>()
    upcoming.forEach { track ->
        val isFirstOfAlbum = track.group != null && seen.add(track.group)
        rows.add(Pair(if (isFirstOfAlbum) track else null, track))
    }

    LazyColumn(modifier = modifier.fillMaxWidth()) {
        items(rows.size) { i ->
            val (header, track) = rows[i]
            if (header?.group != null) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(SurfaceLight)
                        .padding(start = 14.dp, end = 8.dp, top = 7.dp, bottom = 5.dp),
                ) {
                    Text(
                        header.groupName ?: "Album",
                        color = TextPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        "${headers[header.group]} tracks",
                        color = TextSecondary,
                        fontSize = 11.sp,
                    )
                    DropButton("Remove this album") {
                        ServerConnection.emit("dj-remove", JSONObject().put("albumId", header.group))
                    }
                }
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(
                        start = if (track.group != null) 26.dp else 14.dp,
                        top = 5.dp,
                        end = 8.dp,
                        bottom = 5.dp,
                    ),
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(track.name, color = TextPrimary, fontSize = 13.5.sp, maxLines = 1,
                        overflow = TextOverflow.Ellipsis)
                    Text(track.artist, color = TextSecondary, fontSize = 12.sp, maxLines = 1,
                        overflow = TextOverflow.Ellipsis)
                }
                DropButton("Remove this track") {
                    ServerConnection.emit(
                        "dj-remove",
                        JSONObject().put("trackIds", JSONArray().put(track.id)),
                    )
                }
            }
            Divider(color = Border, thickness = 0.5.dp)
        }
    }
}

@Composable
private fun DropButton(description: String, onClick: () -> Unit) {
    Text(
        "✕",
        color = TextSecondary,
        fontSize = 14.sp,
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        textAlign = TextAlign.Center,
    )
}

@Composable
private fun ChatBubble(entry: ChatEntry, showSpeaker: Boolean = false) {
    val isUser = entry.role == "user"
    val isNote = entry.role == "status"
    val isError = entry.role == "error"
    if (isNote) {
        Box(modifier = Modifier.fillMaxWidth()) {
            Text(
                entry.text,
                color = TextSecondary,
                fontSize = 12.sp,
                fontStyle = FontStyle.Italic,
                modifier = Modifier.align(Alignment.Center),
            )
        }
        return
    }
    Box(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .align(if (isUser) Alignment.CenterEnd else Alignment.CenterStart)
                .clip(RoundedCornerShape(14.dp))
                .background(if (isUser) speakerColor(entry.speaker) else SurfaceLight)
                .padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            if (showSpeaker && entry.speaker != null) {
                Text(
                    entry.speaker.uppercase(),
                    color = if (isUser) Color.White.copy(alpha = 0.75f) else TextSecondary,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.5.sp,
                )
            }
            Text(
                entry.text,
                color = when {
                    isUser -> Color.White
                    isError -> Warning
                    else -> TextPrimary
                },
                fontSize = 14.sp,
            )
        }
    }
}
