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
                items(entries, key = { it.id }) { entry -> ChatBubble(entry) }
                if (busy) {
                    item {
                        Text(
                            "DJ is digging through the crates…",
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

@Composable
private fun ChatBubble(entry: ChatEntry) {
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
                .background(if (isUser) Accent else SurfaceLight)
                .padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
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
