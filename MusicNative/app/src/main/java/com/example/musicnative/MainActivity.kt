package com.example.musicnative

import android.content.Intent
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.*
import androidx.compose.runtime.*
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.lifecycleScope
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import com.example.musicnative.components.ImageBox
import com.example.musicnative.components.NowPlayingBar
import com.example.musicnative.components.PillButton
import com.example.musicnative.components.SearchField
import com.example.musicnative.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.roundToInt


sealed class Screen(val route: String) {
    object Downloads : Screen("downloads")
    object Remote : Screen("remote")
}

enum class DownloadScreens {
    Playlists,
    PlaylistDetail,
    Albums,
    AlbumDetail,
    ArtistDetail,
    Main,
    Artists,
    Tracks,
    StreamingSettings
}

/** Menu label. Enum names are route keys, so they cannot carry a space. */
fun DownloadScreens.label(): String = when (this) {
    DownloadScreens.StreamingSettings -> "Cloud Library settings"
    else -> name
}

// Intent keys
const val TRACK_ID = "track_id"

// Intent actions
const val PLAY_TRACK = "play_track"
const val PLAY_PLAYLIST = "play_playlist"

class MainActivity : AppCompatActivity() {
    private var library: Library? = null
    private var syncHelper: SyncHelper2? = null
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val syncState = MutableLiveData(Steps.READY)
        val percentageState = MutableLiveData(0.0)
        library = Library(baseContext)
        library!!.load()
        syncHelper = SyncHelper2(baseContext, library!!, syncState, percentageState, this)

        val intent = Intent(baseContext, MediaPlaybackService::class.java)
        startService(intent)

        ServerConnection.start(applicationContext)
        // streaming is gated on real internet, not on the desktop being reachable
        Connectivity.start(applicationContext)
        StreamingClient.loadCached(applicationContext)

        val emit = { type: String, data: Any? ->
            ServerConnection.emit(type, data)
        }

        val onSync = {
            lifecycleScope.launch {
                syncHelper!!.startSync()
            }
            Unit
        }

        val playPlaylist = {
            playlist: List<TrackData> ->
            // the queue is handed over in memory; the intent only carries the action. Passing
            // it as an extra overflowed the Binder buffer for any large selection.
            PendingQueue.offer(playlist.toTypedArray())
            Intent(this, MediaPlaybackService::class.java).apply {
                action = PLAY_PLAYLIST
                try {
                    startService(this)
                } catch (err: Exception) {
                    // never silently: this used to hide every failed start
                    println("could not start playback: $err")
                }
            }
            Unit
        }

        setContent {
            MusicNativeTheme {
                Box {
                    Surface(
                        modifier = Modifier.fillMaxSize(),
                        color = MaterialTheme.colors.background
                    ) {
                        MainApp(
                            connected = ServerConnection.connected,
                            emit = emit,
                            onSync = onSync,
                            playlistsMutable = library!!.library.playlists,
                            tracksMutable = library!!.library.tracks,
                            albumsMutable = library!!.library.albums,
                            artistsMutable = library!!.library.artists,
                            playPlaylist = playPlaylist,
                            syncStatusMutable = syncHelper!!.syncState,
                            syncPercentMutable = syncHelper!!.percent,
                            remoteState = ServerConnection.remoteState
                        )
                    }
                }
            }
        }
    }
}

class TrackData(var track: Track, artists: Map<String, Artist>, albums: Map<String, Album>): java.io.Serializable {
    var artists: List<Artist>
    var albums: List<Album>

    init {
        this.artists = track.artistIds.mapNotNull { artistId -> artists[artistId] }
        this.albums = track.albumIds.mapNotNull { albumId -> albums[albumId] }
    }
}

@Composable
fun MainApp(modifier: Modifier = Modifier,
            connected: LiveData<Boolean>,
            emit: (type: String, data: Any?) -> Unit,
            onSync: () -> Unit,
            playlistsMutable: MutableList<Playlist>,
            tracksMutable: MutableMap<String, Track>,
            albumsMutable: MutableMap<String, Album>,
            artistsMutable: MutableMap<String, Artist>,
            playPlaylist: (tracks: List<TrackData>) -> Unit,
            syncStatusMutable: LiveData<Steps>,
            syncPercentMutable: LiveData<Double>,
            remoteState: LiveData<org.json.JSONObject>) {
    val navController = rememberNavController()
    val isConnected by connected.observeAsState(initial = false)
    val isOnline by Connectivity.isOnline.observeAsState(initial = false)
    val mRemoteState by remoteState.observeAsState(initial = org.json.JSONObject())
    val playlists = remember { playlistsMutable }
    val tracks = remember {tracksMutable}
    val albums = remember {albumsMutable}
    val artists = remember {artistsMutable}
    val syncStatus by syncStatusMutable.observeAsState(initial = Steps.READY)
    val percentage by syncPercentMutable.observeAsState(initial = 0.0)

    val onNavigate = { screen: DownloadScreens ->
        navController.navigate(screen.name)
    }
    val goToPlaylist: (playlist: Playlist) -> Unit = {
        playlist ->
        navController.navigate(DownloadScreens.PlaylistDetail.name + "/${playlists.indexOf(playlist)}")
    }
    val goToAlbum: (album: Album) -> Unit = {
        album -> navController.navigate(DownloadScreens.AlbumDetail.name + "/${album.id}")
    }
    val goToArtist: (artist: Artist) -> Unit = {
        artist -> navController.navigate(DownloadScreens.ArtistDetail.name + "/${artist.id}")
    }
    // One library over both sources. Rebuilt when connectivity flips or a new catalog lands;
    // offline it collapses to exactly the synced library the app has always shown.
    val context = LocalContext.current
    val catalogVersion by StreamingClient.version.observeAsState(0)
    val merged = remember(isOnline, catalogVersion, tracks.size, albums.size) {
        MergedLibrary(context, tracks, albums, artists, isOnline)
    }

    // The catalog refresh used to sit on the separate browse screen. With cloud tracks folded
    // into the normal lists there is no such screen to open, so it has to happen when the app
    // has internet - otherwise the merged library would only ever show the synced half.
    LaunchedEffect(isOnline) {
        if (isOnline && StreamingClient.isConfigured(context)) {
            withContext(Dispatchers.IO) { StreamingClient.refreshCatalog(context) }
        }
    }
    val getTrackData: (trackIds: Array<String>) -> List<TrackData> = { trackIds ->
        merged.tracksForIds(trackIds)
    }
    val items = listOf(Screen.Downloads, Screen.Remote)
    val labels = listOf("Library", "Remote")
    val icons = listOf(R.drawable.ic_baseline_album_24, R.drawable.ic_baseline_headset_24)
    Scaffold(bottomBar = {
        Column {
            val navBackStackEntry by navController.currentBackStackEntryAsState()
            // the full player has its own controls; hide the mini bar there
            val barRoute = navBackStackEntry?.destination?.route
            if (barRoute != "player" && barRoute != "dj") {
                NowPlayingBar(onOpen = { navController.navigate("player") })
            }
        BottomNavigation(backgroundColor = com.example.musicnative.ui.theme.Surface) {
            val navBackStackEntry by navController.currentBackStackEntryAsState()
            val currentDestination = navBackStackEntry?.destination
            items.forEachIndexed { index, screen ->
                BottomNavigationItem(
                    selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true,
                    onClick = {
                        navController.navigate(screen.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    icon = {
                        Icon(
                            painterResource(icons[index]),
                            contentDescription = labels[index],
                            modifier = Modifier.size(24.dp),
                        )
                    },
                    label = { Text(labels[index], fontSize = 12.sp) },
                    selectedContentColor = Accent,
                    unselectedContentColor = TextSecondary,
                )
            }
        }
        }
    }) {
        innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Downloads.route,
            modifier = modifier.padding(innerPadding)
        ) {
            composable(route = Screen.Remote.route) {
                RemoteScreen(
                    connected = isConnected,
                    emit = emit,
                    remoteState = mRemoteState,
                    onOpenDj = { navController.navigate("dj") },
                )
            }
            composable(route = "dj") {
                DJChatScreen(onClose = { navController.popBackStack() })
            }
            composable(route = "player") {
                LocalPlayerScreen(onClose = { navController.popBackStack() })
            }
            navigation(
                route = Screen.Downloads.route,
                startDestination = DownloadScreens.Main.name
            ) {
                composable(DownloadScreens.Main.name) {
                    MainOptions(
                        onNavigate = onNavigate,
                        connected = isConnected,
                        online = isOnline,
                        onSync = onSync,
                        syncStatus = syncStatus,
                        percent = percentage
                    )
                }
                composable(route = DownloadScreens.Playlists.name) {
                    ListScreen(
                        title = "Playlists",
                        listItems = playlists,
                        onClick = goToPlaylist,
                        subtitle = { playlist -> "${playlist.trackIds.size} tracks" },
                    )
                }
                composable(route = DownloadScreens.PlaylistDetail.name + "/{playlistId}") {
                    val playlistId = it.arguments?.getString("playlistId")?.toInt() ?: 0
                    val playlist = playlists[playlistId]
                    TrackPicker(
                        tracks = getTrackData(playlist.trackIds),
                        title = playlist.name,
                        playPlaylist = playPlaylist
                    )
                }
                composable(route = DownloadScreens.Albums.name) {
                    ListScreen(
                        title = "Albums",
                        listItems = merged.albums(),
                        onClick = goToAlbum,
                        thumb = { album -> ImageBox(filePath = album.artFile) },
                        subtitle = { album ->
                            combineNames(album.artistIds.mapNotNull { id -> merged.artist(id) })
                        },
                        action = { visible ->
                            RandomAlbumButton(visible, { id -> merged.tracksForAlbum(id) }, playPlaylist)
                        },
                    )
                }
                composable(route = DownloadScreens.AlbumDetail.name + "/{albumId}") {
                    val albumId = it.arguments?.getString("albumId") as String
                    val album = merged.album(albumId)
                    if (album != null) {
                        TrackPicker(
                            tracks = merged.tracksForAlbum(albumId),
                            isCloud = { data -> merged.isCloudOnly(data.track.id) },
                            title = album.name,
                            playPlaylist = playPlaylist
                        )
                    }
                }
                composable(route = DownloadScreens.Artists.name) {
                    ListScreen(
                        title = "Artists",
                        listItems = merged.artists(),
                        onClick = goToArtist,
                        thumb = { artist ->
                            ImageBox(
                                filePath = "/artistArt/${artist.id}.png",
                                round = true,
                                placeholder = R.drawable.missing_artist,
                            )
                        },
                        // count what can actually be played now - synced, plus cloud while online
                        subtitle = { artist -> "${merged.playableTrackCountForArtist(artist.id)} tracks" },
                    )
                }
                composable(route = DownloadScreens.ArtistDetail.name + "/{artistId}") {
                    val artistId = it.arguments?.getString("artistId") as String
                    val artist = artists[artistId]
                    if (artist != null) {
                        TrackPicker(
                            tracks = merged.tracksForArtist(artist.id),
                        isCloud = { data -> merged.isCloudOnly(data.track.id) },
                            title = artist.name,
                            playPlaylist = playPlaylist
                        )
                    }
                }
                composable(route = DownloadScreens.StreamingSettings.name) {
                    StreamingSettingsScreen()
                }
                composable(route = DownloadScreens.Tracks.name) {
                    TrackPicker(
                        tracks = merged.allTracks().sortedBy { it.track.name.lowercase() },
                        title = "All Tracks",
                        playPlaylist = playPlaylist,
                        isCloud = { data -> merged.isCloudOnly(data.track.id) },
                    )
                }
            }
        }
    }
}

private fun stepLabel(step: Steps): String {
    return when (step) {
        Steps.READY -> "Ready"
        Steps.GETTING_MANIFEST -> "Fetching manifest"
        Steps.SYNCING_TRACKS -> "Syncing tracks"
        Steps.SYNCING_ALBUMS -> "Syncing albums"
        Steps.SYNCING_ARTISTS -> "Syncing artists"
    }
}

@Composable
fun MainOptions(
    onNavigate: (screen: DownloadScreens) -> Unit, connected: Boolean, online: Boolean,
    onSync: () -> Unit,
    syncStatus: Steps,
    percent: Double
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp)
    ) {
        Card(shape = RoundedCornerShape(14.dp), backgroundColor = com.example.musicnative.ui.theme.Surface, elevation = 0.dp) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(16.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .clip(CircleShape)
                        .background(if (connected) Success else Warning)
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    if (connected) "Connected to desktop" else "Not connected — searching…",
                    color = TextPrimary,
                    fontSize = 15.sp,
                    modifier = Modifier.weight(1f),
                )
                if (!connected) {
                    PillButton("Rescan", filled = false) { ServerConnection.rescan() }
                }
            }
        }
        Spacer(modifier = Modifier.height(24.dp))
        Text(
            "LIBRARY",
            color = TextSecondary,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 2.sp,
            modifier = Modifier.padding(start = 4.dp, bottom = 8.dp),
        )
        Card(shape = RoundedCornerShape(14.dp), backgroundColor = com.example.musicnative.ui.theme.Surface, elevation = 0.dp) {
            Column {
                val sections = listOf(
                    DownloadScreens.Playlists,
                    DownloadScreens.Albums,
                    DownloadScreens.Artists,
                    DownloadScreens.Tracks,
                )
                sections.forEachIndexed { index, screen ->
                    if (index > 0) {
                        Divider(color = Border, thickness = 0.5.dp, startIndent = 20.dp)
                    }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onNavigate(screen) }
                            .padding(horizontal = 20.dp, vertical = 14.dp)
                    ) {
                        Text(
                            screen.label(),
                            color = TextPrimary,
                            fontSize = 17.sp,
                            modifier = Modifier.weight(1f),
                        )
                        Text("›", color = TextSecondary, fontSize = 22.sp)
                    }
                }
            }
        }
        Spacer(modifier = Modifier.height(24.dp))
        Card(shape = RoundedCornerShape(14.dp), backgroundColor = com.example.musicnative.ui.theme.Surface, elevation = 0.dp) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onNavigate(DownloadScreens.StreamingSettings) }
                    .padding(horizontal = 20.dp, vertical = 14.dp)
            ) {
                Text(
                    "Cloud Library settings",
                    color = TextPrimary,
                    fontSize = 17.sp,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    if (online) "online" else "offline",
                    color = if (online) Success else Warning,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(end = 8.dp),
                )
                Text("›", color = TextSecondary, fontSize = 22.sp)
            }
        }
        Spacer(modifier = Modifier.height(24.dp))
        if (connected) {
            if (syncStatus != Steps.READY) {
                Card(shape = RoundedCornerShape(14.dp), backgroundColor = com.example.musicnative.ui.theme.Surface, elevation = 0.dp) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            "${stepLabel(syncStatus)} — ${(percent * 100).roundToInt()}%",
                            color = TextPrimary,
                            fontSize = 14.sp,
                        )
                        LinearProgressIndicator(
                            progress = percent.toFloat(),
                            color = Accent,
                            backgroundColor = Border,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 12.dp)
                                .clip(RoundedCornerShape(3.dp)),
                        )
                    }
                }
            } else {
                PillButton("Sync Library", filled = true, modifier = Modifier.fillMaxWidth()) {
                    onSync()
                }
            }
        } else {
            var ipText by remember { mutableStateOf("") }
            Card(shape = RoundedCornerShape(14.dp), backgroundColor = com.example.musicnative.ui.theme.Surface, elevation = 0.dp) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        "Enter the desktop's IP address to connect manually",
                        color = TextSecondary,
                        fontSize = 13.sp,
                    )
                    TextField(
                        value = ipText,
                        onValueChange = { ipText = it },
                        placeholder = { Text("192.168.1.42", color = TextSecondary) },
                        singleLine = true,
                        shape = RoundedCornerShape(10.dp),
                        colors = TextFieldDefaults.textFieldColors(
                            backgroundColor = Background,
                            textColor = TextPrimary,
                            cursorColor = Accent,
                            focusedIndicatorColor = Color.Transparent,
                            unfocusedIndicatorColor = Color.Transparent,
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 10.dp),
                    )
                    PillButton("Connect", filled = false, modifier = Modifier.fillMaxWidth()) {
                        if (ipText.isNotBlank()) {
                            ServerConnection.connectToIp(ipText.trim())
                        }
                    }
                }
            }
        }
    }
}

interface ListItem {
    val name: String
}

@Composable
fun <T> ListScreen(
    title: String,
    listItems: List<T>,
    onClick: (item: T) -> Unit,
    thumb: (@Composable (item: T) -> Unit)? = null,
    subtitle: ((item: T) -> String)? = null,
    /**
     * Optional control beside the title. Handed the *filtered* list rather than everything, so
     * an action stays consistent with what the user can currently see - searching "Radiohead"
     * and picking at random should pick a Radiohead album.
     */
    action: (@Composable (visible: List<T>) -> Unit)? = null,
) where T : ListItem {
    var query by remember { mutableStateOf("") }
    val filtered = if (query.isBlank()) {
        listItems
    } else {
        listItems.filter { it.name.contains(query.trim(), ignoreCase = true) }
    }
    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 6.dp),
        ) {
            Text(
                title,
                color = TextPrimary,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            if (action != null) {
                action(filtered)
            }
        }
        SearchField(query, "Search ${title.lowercase()}") { query = it }
        LazyColumn {
            items(filtered.size) { i ->
                val item = filtered[i]
                Column {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onClick(item) }
                            .padding(horizontal = 20.dp, vertical = 10.dp)
                    ) {
                        if (thumb != null) {
                            thumb(item)
                            Spacer(modifier = Modifier.width(14.dp))
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                item.name,
                                color = TextPrimary,
                                fontSize = 17.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            if (subtitle != null) {
                                val sub = subtitle(item)
                                if (sub.isNotEmpty()) {
                                    Text(
                                        sub,
                                        color = TextSecondary,
                                        fontSize = 13.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                            }
                        }
                        Text("›", color = TextSecondary, fontSize = 22.sp)
                    }
                    Divider(color = Border, thickness = 0.5.dp, startIndent = 20.dp)
                }
            }
        }
    }
}

/**
 * Picks an album at random and plays it start to finish.
 *
 * Deliberately plays rather than navigating: the whole appeal is not deciding, and bouncing to
 * the album page would mean a trip back before you could roll again. The now-playing bar names
 * what came up, which is all the feedback the gesture needs.
 *
 * Tracks are queued in `album.trackIds` order - the order the desktop stored, which is the
 * album's own running order. Shuffling here would defeat the point of picking an album at all.
 */
@Composable
fun RandomAlbumButton(
    albums: List<Album>,
    tracksForAlbum: (albumId: String) -> List<TrackData>,
    playPlaylist: (tracks: List<TrackData>) -> Unit,
) {
    if (albums.isEmpty()) {
        return
    }
    PillButton("Random", filled = false) {
        // an album whose tracks never synced would queue nothing and look like a dead button,
        // so keep drawing until one actually has something to play
        val candidates = albums.shuffled()
        val playable = candidates.firstNotNullOfOrNull { album ->
            val tracks = tracksForAlbum(album.id)
            if (tracks.isEmpty()) null else tracks
        }
        if (playable != null) {
            playPlaylist(playable)
        }
    }
}
