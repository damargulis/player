package com.example.musicnative.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.Divider
import androidx.compose.material.Icon
import androidx.compose.material.IconButton
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.musicnative.NEXT_TRACK
import com.example.musicnative.PLAYPAUSE
import com.example.musicnative.PlaybackState
import com.example.musicnative.R
import com.example.musicnative.combineNames
import com.example.musicnative.playerCommand
import com.example.musicnative.ui.theme.Border
import com.example.musicnative.ui.theme.Surface
import com.example.musicnative.ui.theme.TextPrimary
import com.example.musicnative.ui.theme.TextSecondary

/**
 * Slim local-playback bar shown above the bottom navigation. Hidden while
 * nothing is playing; tapping the track info opens the full player.
 */
@Composable
fun NowPlayingBar(onOpen: () -> Unit) {
    val track by PlaybackState.currentTrack.observeAsState(null)
    val playing by PlaybackState.isPlaying.observeAsState(false)
    val context = LocalContext.current
    val current = track ?: return
    Column {
        Divider(color = Border, thickness = 0.5.dp)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .background(Surface)
                .padding(horizontal = 12.dp, vertical = 6.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .weight(1f)
                    .clickable { onOpen() }
            ) {
                ImageBox(filePath = current.albums.firstOrNull()?.artFile, size = 40.dp)
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        current.track.name,
                        color = TextPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        combineNames(current.artists),
                        color = TextSecondary,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            IconButton(onClick = { playerCommand(context, PLAYPAUSE) }) {
                Icon(
                    painter = painterResource(
                        if (playing) R.drawable.ic_baseline_pause_24 else R.drawable.ic_baseline_play_arrow_24),
                    contentDescription = "play-pause",
                    tint = TextPrimary,
                    modifier = Modifier.size(26.dp),
                )
            }
            IconButton(onClick = { playerCommand(context, NEXT_TRACK) }) {
                Icon(
                    painter = painterResource(R.drawable.ic_skip_next),
                    contentDescription = "next",
                    tint = TextPrimary,
                    modifier = Modifier.size(24.dp),
                )
            }
        }
    }
}
