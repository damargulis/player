package com.example.musicnative

import android.content.Intent
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Share
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.*
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import com.example.musicnative.components.AlbumItem
import com.example.musicnative.ui.theme.MusicNativeTheme
import io.socket.client.IO
import io.socket.client.Socket
import io.socket.client.Socket.EVENT_CONNECT
import io.socket.emitter.Emitter
import kotlinx.coroutines.launch
import org.json.JSONObject
import kotlin.random.Random
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleObserver
import androidx.lifecycle.OnLifecycleEvent
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
    Tracks
}

// Intent keys
const val TRACK_ID = "track_id"
const val PLAYLIST = "playlist"

// Intent actions
const val PLAY_TRACK = "play_track"
const val PLAY_PLAYLIST = "play_playlist"

const val BASE_URL = "http://192.168.1.249:4443"
val mSocket: Socket = IO.socket(BASE_URL)

class MainActivity : AppCompatActivity(), LifecycleObserver {
    private var library: Library? = null
    private var syncHelper: SyncHelper2? = null
    override fun onCreate(savedInstanceState: Bundle?) {

        super.onCreate(/* savedInstanceState = */ savedInstanceState)
        lifecycle.addObserver(this)
        val connected = MutableLiveData(false)
        val remoteState = MutableLiveData(JSONObject())
        val syncState = MutableLiveData(Steps.READY)
        val percentageState = MutableLiveData(0.0)
        library = Library(baseContext)
        library!!.load()
        syncHelper = SyncHelper2(baseContext, library!!, syncState, percentageState, this)

        val intent = Intent(baseContext, MediaPlaybackService::class.java)
        startService(intent)

        mSocket.on(EVENT_CONNECT) {
            runOnUiThread {
                connected.value = true
            }
        }
        mSocket.on("state") {
            args ->
            val data = args[0] as JSONObject
            runOnUiThread {
                remoteState.value = data
            }
        }
        mSocket.connect()
        val emit = { type: String ->
            val data = JSONObject()
            data.put("type", type)
            mSocket.emit("action", data)
        }

        val onSync = {
            lifecycleScope.launch {
                println("kicking off")
                syncHelper!!.startSync()
            }
            println("done/started")
        }

        val playPlaylist = {
            playlist: List<TrackData> ->
            Intent(this, MediaPlaybackService::class.java).apply {
                // TODO: carry through track data to show data in notification (?)
                putExtra(PLAYLIST, playlist.toTypedArray())
                action = PLAY_PLAYLIST
                try {
                    startService(this)
                } catch (_: Exception) {
                }
            }
            Unit
        }

        setContent {
            MusicNativeTheme {
                // A surface container using the 'background' color from the theme
                Box {
                    Surface(
                        modifier = Modifier.fillMaxSize(),
                        color = MaterialTheme.colors.background
                    ) {
                        MainApp(
                            connected = connected,
                            emit = emit,
                            onSync = onSync,
                            playlistsMutable = library!!.library.playlists,
                            tracksMutable = library!!.library.tracks,
                            albumsMutable = library!!.library.albums,
                            artistsMutable = library!!.library.artists,
                            playPlaylist = playPlaylist,
                            syncStatusMutable = syncHelper!!.syncState,
                            syncPercentMutable = syncHelper!!.percent,
                            remoteState = remoteState
                        )
                    }
                }
            }

        }
    }

    @OnLifecycleEvent(Lifecycle.Event.ON_DESTROY)
    override fun onDestroy() {
        super.onDestroy()
        mSocket.disconnect()
        lifecycle.removeObserver(this)
    }
}

class TrackData(var track: Track, artists: Map<String, Artist>, albums: Map<String, Album>): java.io.Serializable {
    var artists: List<Artist>
    var albums: List<Album>

    init {
        this.artists = track.artistIds.map { artistId -> artists[artistId] as Artist }
        this.albums = track.albumIds.map { albumId -> albums[albumId] as Album}
    }
}

@Composable
fun MainApp(modifier: Modifier = Modifier,
            connected: LiveData<Boolean>,
            emit: (str: String) -> Emitter,
            onSync: () -> Unit,
            playlistsMutable: MutableList<Playlist>,
            tracksMutable: MutableMap<String, Track>,
            albumsMutable: MutableMap<String, Album>,
            artistsMutable: MutableMap<String, Artist>,
            playPlaylist: (tracks: List<TrackData>) -> Unit,
            syncStatusMutable: LiveData<Steps>,
            syncPercentMutable: LiveData<Double>,
            remoteState: LiveData<JSONObject>) {
    val navController = rememberNavController()
    val isConnected by connected.observeAsState(initial = false)
    val mRemoteState by remoteState.observeAsState(initial = JSONObject())
    val playlists = remember { playlistsMutable }
    val tracks = remember {tracksMutable}
    val albums = remember {albumsMutable}
    val artists = remember {artistsMutable}
    val syncStatus by syncStatusMutable.observeAsState(initial = Steps.READY)
    val percentage by syncPercentMutable.observeAsState(initial = 0.0)

    val onNavigate = { screen: DownloadScreens ->

        navController.navigate(screen.name)
    }
    val goToPlaylist: (pos: Int, playlist: Playlist) -> Unit = {
        pos, _ ->
        println("go to playlist is running")
        navController.navigate(DownloadScreens.PlaylistDetail.name + "/${pos}")
    }
    val goToAlbum: (index: Int, album: Album) -> Unit = {
        _, album -> navController.navigate(DownloadScreens.AlbumDetail.name + "/${album.id}")
    }
    val goToArtist: (index: Int, artist: Artist) -> Unit = {
        _, artist -> navController.navigate(DownloadScreens.ArtistDetail.name + "/${artist.id}")
    }
    val goBack: () -> Unit = {
        navController.popBackStack()
    }
    val getTrackData: (trackIds: Array<String>) -> List<TrackData> = {
        trackIds -> trackIds.mapNotNull { track ->
        if (tracks[track] != null) {
            return@mapNotNull TrackData(tracks[track] as Track, artists, albums)
        }
        return@mapNotNull null
    }
    }
    val items = listOf(Screen.Downloads, Screen.Remote)
    val icons = listOf(Icons.Filled.Home, Icons.Filled.Share)
    Scaffold(bottomBar = {
        BottomNavigation {
            val navBackStackEntry by navController.currentBackStackEntryAsState()
            val currentDestination = navBackStackEntry?.destination
            items.forEachIndexed { index, screen ->
                BottomNavigationItem(selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true, onClick = {
                    navController.navigate(screen.route) {
                        popUpTo(navController.graph.findStartDestination().id) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                }, icon = {
                    Icon(icons[index], contentDescription = null)
                })
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
                RemoteScreen(connected = isConnected, emit = emit, remoteState = mRemoteState)
            }
            navigation(
                route = Screen.Downloads.route,
                startDestination = DownloadScreens.Main.name
            ) {
                composable(DownloadScreens.Main.name) {
                    MainOptions(
                        onNavigate = onNavigate,
                        connected = isConnected,
                        onSync = onSync,
                        syncStatus = syncStatus,
                        percent = percentage
                    )
                }
                composable(route = DownloadScreens.Playlists.name) {
                    ListScreen("Playlists", goBack, listItems = playlists, renderer = null, onClick = goToPlaylist, onShuffle = null)
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
                    ListScreen("Albums", goBack, listItems = albums.values.toList().sortedBy { album -> album.name }, renderer = { album -> AlbumItem(album, artists) }, goToAlbum, onShuffle = {
                        album ->
                        playPlaylist(getTrackData(album.trackIds))
                    })
                }
                composable(route = DownloadScreens.AlbumDetail.name + "/{albumId}") {
                    val albumId = it.arguments?.getString("albumId") as String
                    val album = albums[albumId]
                    if (album != null) {
                        TrackPicker(
                            tracks = getTrackData(album.trackIds),
                            title = album.name,
                            playPlaylist = playPlaylist
                        )
                    }
                }
                composable(route = DownloadScreens.Artists.name) {
                    ListScreen("Artists", goBack, listItems = artists.values.toList().sortedBy { artist -> artist.name}, renderer = null, onShuffle = null,
                        onClick = goToArtist
                    )
                }
                composable(route = DownloadScreens.ArtistDetail.name + "/{artistId}") {
                    val artistId = it.arguments?.getString("artistId") as String
                    val artist = artists[artistId]
                    if (artist != null) {
                        TrackPicker(
                            tracks = getTrackData(artist.trackIds),
                            title = artist.name,
                            playPlaylist = playPlaylist
                        )
                    }
                }
                composable(route = DownloadScreens.Tracks.name) {
                    TrackPicker(tracks = getTrackData(tracks.values.map { track -> track.id }
                        .toTypedArray()).sortedBy { track -> track.track.name }, title = "All Tracks", playPlaylist = playPlaylist)
                }
            }
        }
    }
}

@Composable
fun MainOptions(
    onNavigate: (screen: DownloadScreens) -> Unit, connected: Boolean, onSync: () -> Unit,
    syncStatus: Steps,
    percent: Double
) {
    Box {
        Column(modifier = Modifier.padding(all = 8.dp)) {
            RouteButton(screen = DownloadScreens.Playlists, onNavigate = onNavigate)
            RouteButton(screen = DownloadScreens.Albums, onNavigate = onNavigate)
            RouteButton(screen = DownloadScreens.Artists, onNavigate = onNavigate)
            RouteButton(screen = DownloadScreens.Tracks, onNavigate = onNavigate)
            Spacer(modifier = Modifier.height(200.dp))
            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    onSync()
                }
            ) {
                if(connected) {
                    if (syncStatus !== Steps.READY) {
                        Text(syncStatus.name + " " + (percent * 100).roundToInt() + "%")
                    } else {
                        Text("Ready")
                    }
                } else {
                    Text("Waiting...")
                }
            }
        }
    }
}

@Composable
fun RouteButton(screen: DownloadScreens, onNavigate: (screen: DownloadScreens) -> Unit) {
    Box {
        Button(
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                onNavigate(screen)
            }
        ) {
            Text(text = screen.name)
        }
    }
}

interface ListItem {
    val name: String
}

@Composable
fun <T> ListScreen(title: String, goBack: () -> Unit, listItems: List<T>, renderer: (@Composable (item: T) -> Unit)?, onClick: (pos: Int, item: T) -> Unit,
onShuffle: ((item: T) -> Unit)?) where T : ListItem {
    Column {
        Row {
            Button(onClick = goBack) {
                Text("Back")
            }
            Spacer(modifier = Modifier.weight(1.0f))
            if (onShuffle != null) {
                Button(onClick = {onShuffle(listItems[Random.nextInt(listItems.size)])}) {
                    Text("Play Random")
                }
            }
        }

        Text(title, fontSize = 24.sp)
        LazyColumn(horizontalAlignment = Alignment.Start) {
            items(listItems.size) {
                item -> Button(onClick = { onClick(item, listItems[item])}, modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp)) {
                    Row (modifier = Modifier.fillMaxWidth()){
                        if (renderer != null) {
                            renderer(listItems[item])
                        } else {
                            Text(listItems[item].name, textAlign = TextAlign.Left)
                        }
                    }
                }
            }
        }
    }
}