package com.example.musicnative

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.*
import androidx.compose.runtime.*
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.musicnative.components.PillButton
import com.example.musicnative.components.SearchField
import com.example.musicnative.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

/**
 * Turns a flat catalog entry into the TrackData the player and UI already understand.
 *
 * The catalog carries artist and album as plain names rather than ids, because the service has
 * no reason to leak the desktop's id space. Synthesising ids from the names is safe here: these
 * objects exist only to label a row and a notification, and are never written to the library,
 * so they cannot collide with the real synced entities.
 */
fun streamTrackToData(stream: StreamTrack): TrackData {
    val artistId = "stream-artist:${stream.artist}"
    val albumId = "stream-album:${stream.album}"

    val trackJson = JSONObject()
    trackJson.put("name", stream.name)
    trackJson.put("id", stream.id)
    trackJson.put("year", stream.year)
    trackJson.put("duration", stream.duration)
    trackJson.put("favorites", JSONArray())
    trackJson.put("artistIds", JSONArray().put(artistId))
    trackJson.put("albumIds", JSONArray().put(albumId))

    val trackIds = JSONArray().put(stream.id)
    val artistJson = JSONObject()
    artistJson.put("name", stream.artist)
    artistJson.put("id", artistId)
    artistJson.put("trackIds", trackIds)
    val albumJson = JSONObject()
    albumJson.put("name", stream.album)
    albumJson.put("id", albumId)
    albumJson.put("trackIds", trackIds)
    albumJson.put("artistIds", JSONArray().put(artistId))

    return TrackData(
        Track(trackJson),
        mapOf(artistId to Artist(artistJson)),
        mapOf(albumId to Album(albumJson)),
    )
}

/**
 * The streamable catalog.
 *
 * Only reachable while online — the caller hides the entry point otherwise — because listing
 * thousands of tracks that cannot possibly play is worse than not listing them at all. The
 * catalog also lists only what the desktop has confirmed uploaded, so everything here is
 * genuinely playable rather than merely known to the library.
 */
@Composable
fun StreamingScreen(playPlaylist: (tracks: List<TrackData>) -> Unit) {
    val context = LocalContext.current
    val catalog by StreamingClient.catalog.observeAsState(emptyList())
    val status by StreamingClient.status.observeAsState("")
    val online by Connectivity.isOnline.observeAsState(false)
    var query by remember { mutableStateOf("") }
    var refreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    val refresh = {
        refreshing = true
        scope.launch {
            withContext(Dispatchers.IO) { StreamingClient.refreshCatalog(context) }
            refreshing = false
        }
        Unit
    }

    // fetch once on entry if we have nothing yet, so the screen is not empty on first open
    LaunchedEffect(online) {
        if (online && catalog.isEmpty() && StreamingClient.isConfigured(context)) {
            refresh()
        }
    }

    if (!StreamingClient.isConfigured(context)) {
        return CenteredMessage(
            "Streaming is not set up.\nBuild with streaming.url and streaming.token in " +
                "local.properties, or enter them in Streaming settings."
        )
    }

    val filtered = remember(query, catalog) {
        if (query.isBlank()) {
            catalog
        } else {
            val needle = query.trim().lowercase()
            catalog.filter {
                it.name.lowercase().contains(needle) ||
                    it.artist.lowercase().contains(needle) ||
                    it.album.lowercase().contains(needle)
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        ) {
            Text(
                "Streaming",
                color = TextPrimary,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            PillButton(if (refreshing) "…" else "Refresh", filled = false) { refresh() }
        }
        Text(
            status.ifEmpty { "${catalog.size} tracks" },
            color = TextSecondary,
            fontSize = 12.sp,
            modifier = Modifier.padding(horizontal = 16.dp),
        )
        Spacer(modifier = Modifier.height(8.dp))
        SearchField(query = query, placeholder = "Search streaming", onQueryChange = { query = it })
        Spacer(modifier = Modifier.height(4.dp))

        if (filtered.isEmpty()) {
            return@Column CenteredMessage(
                if (catalog.isEmpty()) "Nothing in the catalog yet" else "No matches"
            )
        }

        LazyColumn(modifier = Modifier.fillMaxSize()) {
            items(filtered.size) { index ->
                val stream = filtered[index]
                if (index > 0) {
                    Divider(color = Border, thickness = 0.5.dp, startIndent = 16.dp)
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            // play from here, so the rest of the filtered list queues up
                            playPlaylist(filtered.drop(index).map { streamTrackToData(it) })
                        }
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            stream.name,
                            color = TextPrimary,
                            fontSize = 15.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            listOf(stream.artist, stream.album).filter { it.isNotBlank() }
                                .joinToString(" — "),
                            color = TextSecondary,
                            fontSize = 12.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }
    }
}

/** Service URL and device token. Entered by hand once; both come from the desktop setup. */
@Composable
fun StreamingSettingsScreen() {
    val context = LocalContext.current
    // show the override if there is one, otherwise leave the fields blank so the built-in
    // values are visibly the source rather than looking like something that was typed
    val builtIn = StreamingClient.isUsingBuiltInConfig(context)
    var url by remember { mutableStateOf(if (builtIn) "" else StreamingClient.baseUrl(context)) }
    var token by remember { mutableStateOf(if (builtIn) "" else StreamingClient.deviceToken(context)) }
    var saved by remember { mutableStateOf(false) }
    val status by StreamingClient.status.observeAsState("")
    val online by Connectivity.isOnline.observeAsState(false)
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp)
    ) {
        Text("Streaming", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            if (online) "Online" else "Offline — streaming is hidden",
            color = if (online) Success else Warning,
            fontSize = 13.sp,
        )
        Spacer(modifier = Modifier.height(12.dp))
        if (builtIn && StreamingClient.isConfigured(context)) {
            Card(
                shape = RoundedCornerShape(10.dp),
                backgroundColor = com.example.musicnative.ui.theme.Surface,
                elevation = 0.dp,
            ) {
                Text(
                    "Using the configuration built into this APK. Nothing to enter — leave " +
                        "these blank unless you want to point this device somewhere else.",
                    color = TextSecondary,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(14.dp),
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = url,
            onValueChange = { url = it; saved = false },
            label = { Text(if (builtIn) "Service URL (override)" else "Service URL") },
            placeholder = { Text("https://…run.app") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(modifier = Modifier.height(12.dp))
        OutlinedTextField(
            value = token,
            onValueChange = { token = it; saved = false },
            label = { Text(if (builtIn) "Device token (override)" else "Device token") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(modifier = Modifier.height(16.dp))
        Row {
            PillButton(if (saved) "Saved" else "Save", filled = true) {
                StreamingClient.save(context, url, token)
                saved = true
            }
            Spacer(modifier = Modifier.width(10.dp))
            PillButton("Test", filled = false) {
                StreamingClient.save(context, url, token)
                saved = true
                scope.launch {
                    withContext(Dispatchers.IO) { StreamingClient.refreshCatalog(context) }
                }
            }
        }
        if (status.isNotEmpty()) {
            Spacer(modifier = Modifier.height(14.dp))
            Card(
                shape = RoundedCornerShape(10.dp),
                backgroundColor = com.example.musicnative.ui.theme.Surface,
                elevation = 0.dp,
            ) {
                Text(
                    status,
                    color = TextSecondary,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(14.dp),
                )
            }
        }
        Spacer(modifier = Modifier.height(20.dp))
        Text(
            "Synced tracks always play from the phone. Streaming is only used for tracks you " +
                "have not synced, and only while online. Clearing a field above removes the " +
                "override and goes back to the built-in values.",
            color = TextSecondary,
            fontSize = 12.sp,
        )
    }
}
