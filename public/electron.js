const {
  app,
  clipboard,
  dialog,
  globalShortcut,
  BrowserWindow,
  Menu,
  MenuItem,
  ipcMain,
  session,
  shell,
  protocol,
} = require("electron");

// TODO: shouldn't need package for this ... figure out better way
const isDev = require("electron-is-dev");
const path = require("path");
const defaultMenu = require("electron-default-menu");
const fs = require("fs");
const os = require("os");
const {externalEffectsAllowed} = require("./devSafety");
const {fileUrlToPath} = require("./filePaths");
const lanGuard = require("./lanGuard");
const systemVolumeControl = require("./systemVolume");
const watchdog = require("./watchdog");
const windowSize = require("./windowSize");

app.whenReady().then(() => {
  // This app only ever loads its own content (localhost in dev, file:// when packaged), so
  // there is no third-party page to guard against. Without a handler Electron denies
  // geolocation outright, which is what the concerts tab asks for.
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });
  protocol.registerFileProtocol("file", (req, callback) => {
    const pathname = req.url.replace("file:///", "");
    callback(pathname);
  });
});

class ExtensionMonitor {
  constructor(extensionId) {
    this.extensionId = extensionId;
    this.extensionWindow_ = new BrowserWindow({
      // taller than it was: a grouped run stacks a summary per extension
      height: 420,
      webPreferences: {
        nodeIntegration: true,
        nodeIntegrationInWorker: true,
        contextIsolation: false,
        webSecurity: false,
      },
      width: 560,
    });
    this.extensionWindow_.loadURL(
      `file://${path.join(__dirname,
          `./extension_monitor.html?extensionId=${extensionId}`)}`);

    this.extensionWindow_.on("closed", () => this.extensionWindow_ = null);
    this.messageQueue_ = [];

    this.event_ = null;
  }

  send(msg) {
    this.messageQueue_.push(msg);
    this.forwardMessages_();
  }

  setEvent(evt) {
    this.event_ = evt;
    this.forwardMessages_();
  }

  close() {
    this.extensionWindow_.close();
  }

  forwardMessages_() {
    while (this.messageQueue_.length && this.event_) {
      if (!this.extensionWindow_) {
        extEvt.reply("cancel", {extensionId: this.extensionId});
        this.event_ = null;
        break;
      }
      const msg = this.messageQueue_.shift();
      this.event_.reply(msg.type, msg);
    }
  }
}

let mainWindow = null;
// TODO: change name to be playerEvt or something since its used for more than
// just extensions
let extEvt = null;

ipcMain.on("goToArtist", (evt, data) => {
  maximize();
  evt.reply("toArtist", data);
});

ipcMain.on("goToTrack", (evt, data) => {
  maximize();
  evt.reply("toTrack", data);
});

ipcMain.on("goToAlbum", (evt, data) => {
  maximize();
  evt.reply("toAlbum", data);
});

ipcMain.on("minimize", (evt) => {
  windowSize.toMini(mainWindow);
  evt.reply("minimize-reply");
});

ipcMain.on("maximize", (evt) => {
  maximize();
  evt.reply("maximize-reply");
});

/** Back to the full browser, at whatever size it was last given. See public/windowSize.js. */
function maximize() {
  windowSize.toMax(mainWindow);
}
ipcMain.on("extension-ready", (evt) => {
  extEvt = evt;
});

ipcMain.on("extension-monitor-ready", (evt, arg) => {
  let extension = extensionsRunning[arg.extensionId];
  extension.setEvent(evt);
});

const messageQueue = [];
const extensionsRunning = {};

ipcMain.on("extension-update", (evt, arg) => {
  let extension = extensionsRunning[arg.extensionId];
  if (!extension) {
    extension = new ExtensionMonitor(arg.extensionId);
    extensionsRunning[arg.extensionId] = extension;
  }
  extension.send(arg);
});

ipcMain.on("extension-close", (evt, arg) => {
  let extension = extensionsRunning[arg.extensionId];
  extension.close();
  extensionsRunning[arg.extensionId] = null;
});

/**
 * Asks, then forwards the reset to the App. It replaces the whole library with a fresh iTunes
 * import — every play count, skip, favourite and extension result since — so one stray click on a
 * menu item must not be enough. The App snapshots the current library into backups/ first.
 */
function resetLibrary() {
  dialog.showMessageBox(mainWindow, {
    buttons: ["Cancel", "Reset Library"],
    cancelId: 0,
    defaultId: 0,
    detail: "This replaces the library with a fresh import from an iTunes export. Play counts, " +
      "skips, favourites and everything the extensions have found since will be lost. A copy of " +
      "the current library is saved in the backups folder first.",
    message: "Reset the library from iTunes?",
    type: "warning",
  }).then(({response}) => {
    if (response === 1 && extEvt) {
      extEvt.reply("reset-library");
    }
  });
}

/**
 * The game windows, keyed by id.
 *
 * A registry rather than one variable per game: the id is what names the html file, the saved
 * scores file and the menu entry, so adding a game is one entry here plus one page in public/.
 * Only ids in this map are ever accepted from a game window, which is what keeps a crafted
 * id out of the scores and lyrics paths below.
 */
const GAMES = {
  album_art_zoom: {file: "album_art_zoom.html", height: 700, label: "Album Art Zoom", width: 520},
  artist_tracks: {file: "artist_tracks.html", height: 760, label: "Name Every Track", width: 760},
  dj_clues: {file: "dj_clues.html", height: 660, label: "Guess the Artist (DJ)", width: 560},
  finish_the_lyric: {file: "finish_the_lyric.html", height: 680, label: "Finish the Lyric", width: 560},
  lyric_fill: {file: "lyric_fill.html", height: 760, label: "Name All the Lyrics", width: 760},
  name_that_tune: {file: "name_that_tune.html", height: 640, label: "Name That Tune", width: 520},
};

const gameWindows = {};

/**
 * Opens a game window, or focuses it if it is already up.
 * @param {string} gameId A key of GAMES.
 */
function openGame(gameId) {
  const game = GAMES[gameId];
  if (!game) {
    return;
  }
  if (gameWindows[gameId]) {
    gameWindows[gameId].focus();
    return;
  }
  const win = new BrowserWindow({
    height: game.height,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      webSecurity: false,
    },
    width: game.width,
  });
  gameWindows[gameId] = win;
  win.loadURL(`file://${path.join(__dirname, `./${game.file}`)}`);
  win.on("closed", () => gameWindows[gameId] = null);
}

/**
 * Game windows waiting on the library.
 *
 * The renderer answers on one channel, so a second window asking while a request is in flight
 * joins the queue and shares the answer rather than waiting for a reply that never comes.
 */
let trackRequests = [];

// The game windows ask for playable tracks; proxy through the renderer,
// which owns the library, like the mobile API endpoints do.
ipcMain.on("game-get-tracks", (evt) => {
  trackRequests.push(evt.sender);
  if (trackRequests.length === 1) {
    extEvt.reply("get-game-tracks");
  }
});

ipcMain.on("game-tracks", (evt, data) => {
  const waiting = trackRequests;
  trackRequests = [];
  waiting.forEach((sender) => {
    if (!sender.isDestroyed()) {
      sender.send("game-tracks", data);
    }
  });
});

// mirrors DATA_DIR in src/constants.tsx
function dataDir() {
  return isDev ? path.resolve("data") : path.join(app.getPath("userData"), "data");
}

/**
 * Where a game's scores live.
 * @param {string} gameId A key of GAMES.
 * @return {?string} The file path, or null for an unknown game.
 */
function gameScoresFile(gameId) {
  if (!GAMES[gameId]) {
    return null;
  }
  // Name That Tune shipped before games had ids; keep its file name so its bests survive.
  const name = gameId === "name_that_tune" ? "tune_scores.json" : `scores_${gameId}.json`;
  return path.join(dataDir(), name);
}

ipcMain.on("game-get-scores", (evt, gameId) => {
  let scores = {};
  const file = gameScoresFile(gameId);
  try {
    scores = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    // no scores saved yet
  }
  evt.reply("game-scores", scores);
});

ipcMain.on("game-save-scores", (evt, arg) => {
  const file = gameScoresFile(arg && arg.gameId);
  if (!file) {
    return;
  }
  try {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, JSON.stringify(arg.scores));
  } catch (err) {
    // scores are best-effort; losing one save is fine
  }
});

/**
 * The stored lyrics for a track, read here rather than in the renderer.
 *
 * `src/extensions/lyrics/store.tsx` owns the same layout; main can read a file off disk
 * without a round trip, so a game asking for one line of a song doesn't wake the renderer.
 * `path.basename` is what stops a crafted track id walking out of the lyrics directory.
 */
ipcMain.on("game-get-lyrics", (evt, trackId) => {
  let text = null;
  try {
    const file = path.join(dataDir(), "lyrics", `${path.basename(String(trackId))}.lrc`);
    text = fs.readFileSync(file, "utf8");
  } catch (err) {
    // nothing fetched for this track
  }
  evt.reply(`game-lyrics-${trackId}`, text);
});

/**
 * Asks the DJ to describe a track without naming it.
 *
 * The API key is the renderer's, so this proxies the same way the library does. Keyed by a
 * request id because a game may have several rounds in flight while it pre-fetches clues.
 */
ipcMain.on("game-dj-clue", (evt, arg) => {
  const channel = `game-dj-clue-${arg.requestId}`;
  ipcMain.once(channel, (replyEvt, result) => {
    if (!evt.sender.isDestroyed()) {
      evt.sender.send(channel, result);
    }
  });
  extEvt.reply("get-dj-clue", arg);
});

/**
 * Start running an extension.
 * @param {string} type The type of extension to run.
 */
function runExtension(type) {
  extEvt.reply("run-extension", type);
}

/** Creates the main window. */
function createWindow() {
  mainWindow = new BrowserWindow({
    frame: false,
    height: windowSize.DEFAULT_MAX.height,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
    },
    width: windowSize.DEFAULT_MAX.width,
  });
  mainWindow.loadURL(isDev
    ? "http://localhost:3000"
    : `file://${path.join(__dirname, "./index.html")}`);
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  mainWindow.on("closed", () => mainWindow = null);

  // After the watchdog kills a wedged renderer, bring it straight back. Without this the
  // window is left blank, which is a worse place to be than frozen.
  mainWindow.webContents.on("render-process-gone", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload();
    }
  });

  // Watches the renderer from out here, because a renderer that has deadlocked cannot watch
  // itself. See public/watchdog.js for what happened that made this worth having.
  watchdog.start(
    () => mainWindow && mainWindow.webContents,
    (seconds) => reportWedgedRenderer(seconds),
  );
  const menu = defaultMenu(app, shell);
  menu.push(new MenuItem({
    label: "Library",
    submenu: [{label: "Reset from itunes", click: () => resetLibrary()}],
  }));
  menu.push(new MenuItem({
    label: "DJ",
    submenu: [{label: "Copy link for phone", click: () => copyPhoneLink()}],
  }));
  menu.push(new MenuItem({
    label: "Extensions",
    submenu: [
      {label: "Wikipedia", click: () => runExtension("wikipedia")},
      {label: "Genius", click: () => runExtension("genius")},
      {label: "Lyrics", click: () => runExtension("lyrics")},
      {label: "Cover Art", click: () => runExtension("coverart")},
      {label: "MusicBrainz", click: () => runExtension("musicbrainz")},
    ],
  }));
  menu.push(new MenuItem({
    label: "Games",
    submenu: Object.keys(GAMES).sort((id1, id2) => {
      return GAMES[id1].label.localeCompare(GAMES[id2].label);
    }).map((gameId) => {
      return {label: GAMES[gameId].label, click: () => openGame(gameId)};
    }),
  }));
  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
}

/**
 * LAN addresses this machine can be reached on. A phone needs a real address rather than
 * localhost, so internal interfaces are skipped; private ranges are preferred because a VPN
 * interface can otherwise sort first and hand out an address the phone can't reach.
 */
function lanAddresses() {
  const addresses = [];
  const interfaces = os.networkInterfaces();
  Object.keys(interfaces).forEach((name) => {
    (interfaces[name] || []).forEach((entry) => {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push({address: entry.address, name});
      }
    });
  });
  const isPrivate = (a) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address);
  return addresses.sort((a, b) => Number(isPrivate(b)) - Number(isPrivate(a)));
}

/** Copies the address a phone uses to reach the DJ, and shows what was copied. */
function copyPhoneLink() {
  const addresses = lanAddresses();
  if (!addresses.length) {
    dialog.showMessageBox({
      buttons: ["OK"],
      detail: "This machine has no network address a phone could reach. Check that wifi is on.",
      message: "No network connection",
      type: "warning",
    });
    return;
  }
  const url = `http://${addresses[0].address}:${expressPort}/dj`;
  clipboard.writeText(url);
  const others = addresses.slice(1)
    .map((a) => `\n\nAlso reachable at http://${a.address}:${expressPort}/dj (${a.name})`).join("");
  dialog.showMessageBox({
    buttons: ["OK"],
    detail: `${url}\n\nOpen it in Safari on the phone, then Share -> Add to Home Screen. ` +
      `Add ?who=Name to the end to skip being asked who is listening.${others}`,
    message: "Copied the DJ link",
    type: "info",
  });
}

app.on("ready", () => {
  createWindow();
  // a dev copy would take these from the installed app while it ran (see devSafety.js)
  if (!externalEffectsAllowed("shortcuts", isDev)) {
    return;
  }
  // TODO: media keys dont work ... :(
  globalShortcut.register("CommandOrControl+0", () => {
    extEvt.reply("nextTrack");
  });
  globalShortcut.register("CommandOrControl+9", () => {
    extEvt.reply("playTrack");
  });
  globalShortcut.register("CommandOrControl+8", () => {
    extEvt.reply("prevTrack");
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

const expressPort = isDev ? 4444 : 4443;
const express = require("express");
const expressApp = express();
const http = require("http").createServer(expressApp);
// The origin check replaces socket.io's default, which accepts any site, and refuses JSONP
// polling. See lanGuard.js.
const io = require("socket.io")(http, {allowRequest: lanGuard.allowSocketRequest});

let lastState = null;
let lastDjState = null;

// Keeps the cached level honest when the volume is changed at the laptop rather than the
// phone. Only polls while something is actually listening, so an unattended app spawns nothing.
systemVolumeControl.readSystemVolume();
setInterval(() => {
  if (io.engine.clientsCount > 0 && !systemVolumeControl.hasPending()) {
    systemVolumeControl.readSystemVolume();
  }
}, 5000);

io.on("connection", (socket) => {
  systemVolumeControl.readSystemVolume();
  socket.emit("dj-build", djBuildId());
  if (lastState) {
    socket.emit("state", lastState);
  }
  if (lastDjState) {
    socket.emit("dj-state", lastDjState);
  }

  socket.on("action", (action) => {
    // Only what the clients actually send: the renderer also listens for "reset-library",
    // "run-extension", "dj-run-tool" and more, none of which a LAN device should reach. Dropped
    // silently, so a new client action that is missing from the allowlist simply does nothing.
    if (!lanGuard.isRemoteAction(action)) {
      return;
    }
    if (action.type === "set-system-volume") {
      // The clients send the level as a bare number, matching the existing setVolume action.
      systemVolumeControl.setSystemVolume(action.data);
      return;
    }
    if (action.type === "set-system-muted") {
      systemVolumeControl.setSystemMuted(action.data);
      return;
    }
    if (extEvt) {
      extEvt.reply(action.type, action.data);
    }
  });
});

ipcMain.on("watchdog-pong", () => watchdog.pong());

/**
 * Tells the listener the player has stopped responding, and offers the only thing that fixes it.
 *
 * Reloading is destructive enough to ask about: it drops the DJ's in-memory conversation, which
 * is the one piece of state that does not live on disk. Everything else is safe — the library
 * reducer saves on every mutating action and the event log is appended synchronously, so the
 * files were complete and valid when this was diagnosed.
 *
 * `forcefullyCrashRenderer` rather than `reload`, because a reload is itself a task for the
 * blocked thread to run. Killing the process and letting `render-process-gone` reload it is
 * what works on a renderer that is genuinely stuck.
 */
function reportWedgedRenderer(seconds) {
  if (!mainWindow) {
    return;
  }
  dialog.showMessageBox(mainWindow, {
    buttons: ["Reload player", "Leave it"],
    cancelId: 1,
    defaultId: 0,
    detail: `The player has not answered for ${Math.round(seconds)} seconds, so the window and `
      + "playback are frozen. Your library is safe — it is saved after every change.\n\n"
      + "Reloading fixes it. The current DJ conversation will be lost; nothing else will.",
    message: "MyMusic has stopped responding",
    type: "warning",
  }).then((result) => {
    if (result.response === 0 && mainWindow) {
      mainWindow.webContents.forcefullyCrashRenderer();
    }
  }).catch(() => undefined);
}

ipcMain.on("controller-state", (evt, state) => {
  // Merged from this process's cache rather than read per update: controller-state fires on
  // every timeupdate, and a 150ms osascript call on each would be absurd.
  const merged = Object.assign({}, state, { systemVolume: systemVolumeControl.current() });
  io.emit("state", merged);
  lastState = merged;
});

// DJ chat transcript, pushed to the mobile app whenever the session changes.
ipcMain.on("dj-state", (evt, state) => {
  io.emit("dj-state", state);
  lastDjState = state;
});

// --- DJ bridge: lets dj-mcp/server.js (run by Claude Code over MCP) drive the queue.
// Tools are defined and executed in the renderer (src/dj/tools.tsx); this just proxies.
let djRequestId = 0;

expressApp.get("/dj/tools", (req, res) => {
  if (!extEvt) {
    return res.status(503).json({error: "app not ready"});
  }
  ipcMain.once("dj-tools", (evt, tools) => {
    res.json(tools);
  });
  extEvt.reply("dj-get-tools");
});

expressApp.post("/dj/tool", express.json(), (req, res) => {
  if (!extEvt) {
    return res.status(503).json({error: "app not ready"});
  }
  const id = ++djRequestId;
  ipcMain.once("dj-tool-result-" + id, (evt, outcome) => {
    res.json(outcome);
  });
  extEvt.reply("dj-run-tool", {id, name: req.body.name, input: req.body.input || {}});
});

/**
 * Applies a phone's plays and answers with the playlists it should hold. Parses before listening:
 * a malformed request used to leave its listener registered, and the next good sync's reply then
 * went to that stale response — which threw, and the good request was never answered.
 */
function startSync(res, plays) {
  if (!extEvt) {
    res.status(503).end();
    return;
  }
  ipcMain.once("synced-playlists", (evt, data) => {
    res.send(JSON.stringify(data));
  });
  extEvt.reply("get-synced-playlists", plays);
}

// The play log in the body: in the query string it outgrows the server's 16KB header limit after a
// few hundred plays, and every sync after that fails. The desktop drops events it has already
// logged, so a phone resending what was never acknowledged cannot double-count.
expressApp.post("/start-sync", express.json({limit: "10mb"}), (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    res.status(400).end();
    return;
  }
  startSync(res, req.body);
});

// What phone builds before the POST send.
expressApp.get("/start-sync", (req, res) => {
  let plays;
  try {
    plays = JSON.parse(decodeURIComponent(req.query.plays || "{}"));
  } catch (err) {
    res.status(400).end();
    return;
  }
  startSync(res, plays);
});

expressApp.get("/get-artist-data/:artistId", (req, res) => {
  ipcMain.once("get-artist-" + req.params.artistId, (evt, data) => {
    res.send(JSON.stringify(data));
  });
  extEvt.reply("get-artist", req.params.artistId);
});

expressApp.get("/get-album-data/:albumId", (req, res) => {
  ipcMain.once("get-album-" + req.params.albumId, (evt, data) => {
    res.send(JSON.stringify(data));
  });
  extEvt.reply("get-album", req.params.albumId);
});

expressApp.get("/get-track-data/:trackId", (req, res) => {
  ipcMain.once("get-track-" + req.params.trackId, (evt, data) => {
    res.send(JSON.stringify(data));
  });
  extEvt.reply("get-track", req.params.trackId);
});

expressApp.get("/get-track/:trackId", (req, res) => {
  ipcMain.once("get-track-" + req.params.trackId, (evt, data) => {
    // an id the library no longer has (deleted on the desktop since the phone synced) answers
    // undefined; reading a field off that threw in the main process and left the phone waiting
    if (!data || !data.filePath) {
      res.status(404).end();
      return;
    }
    res.sendFile(fileUrlToPath(data.filePath));
  });
  extEvt.reply("get-track", req.params.trackId);
});

expressApp.get("/get-artist-pic/:artistId", (req, res) => {
  ipcMain.once("get-artist-" + req.params.artistId, (evt, data) => {
    const fileName = data && data.artFile;
    if (fileName) {
      // artist art is stored as a plain absolute path, but strip a
      // file:// prefix in case old library entries carry one
      const pathName = fileName.startsWith("file://")
        ? fileUrlToPath(fileName)
        : path.resolve(fileName);
      res.sendFile(pathName);
    } else {
      res.status(404).end();
    }
  });
  extEvt.reply("get-artist", req.params.artistId);
});

expressApp.get("/get-album-art/:albumId", (req, res) => {
  ipcMain.once("get-album-" + req.params.albumId, (evt, data) => {
    const fileName = data && data.albumArtFile;
    if (fileName) {
      res.sendFile(path.resolve(fileName));
    } else {
      // it used to send nothing, so the phone's request hung until it timed out
      res.status(404).end();
    }
  });
  extEvt.reply("get-album", req.params.albumId);
});

// Identity endpoint so clients can verify a discovered address actually
// belongs to this app (and check protocol compatibility) before trusting it.
const PROTOCOL_VERSION = 1;
// --- DJ web app: a phone-friendly chat page served straight off the LAN, so any phone
// (iPhone included) can talk to the DJ with no app install. CRA copies public/ into build/,
// so __dirname resolves these in dev and in the packaged app alike. socket.io serves its own
// browser client at /socket.io/socket.io.js, so the page needs no internet access.
expressApp.get("/dj", (req, res) => {
  // Always revalidate: a phone that has the page on its home screen should pick up a new
  // deploy on its next open, without anyone re-adding the bookmark.
  res.set("Cache-Control", "no-cache");
  res.sendFile(path.join(__dirname, "dj-web/index.html"));
});

/** Identifies the deployed build, so an open page can tell when it has gone stale. */
function djBuildId() {
  try {
    return String(fs.statSync(path.join(__dirname, "dj-web/index.html")).mtimeMs);
  } catch (err) {
    return "unknown";
  }
}

expressApp.get("/dj/manifest.json", (req, res) => {
  res.sendFile(path.join(__dirname, "dj-web/manifest.json"));
});

expressApp.get("/dj/icon-180.png", (req, res) => {
  res.sendFile(path.join(__dirname, "dj-web/icon-180.png"));
});

expressApp.get("/dj/icon-192.png", (req, res) => {
  res.sendFile(path.join(__dirname, "dj-web/icon-192.png"));
});

expressApp.get("/dj/icon-512.png", (req, res) => {
  res.sendFile(path.join(__dirname, "dj-web/icon-512.png"));
});

expressApp.get("/ping", (req, res) => {
  res.json({app: "MyMusic", protocol: PROTOCOL_VERSION});
});

http.listen(expressPort);

// discovery

/**
 * Advertise over mDNS. Preferred path: register with the OS's own Bonjour
 * responder via dns-sd, which handles interface selection (VPNs, Docker,
 * etc.), sleep/wake, and network changes correctly. The unmaintained JS
 * responder is kept only as a fallback and for old clients browsing _http.
 */
const {spawn} = require("child_process");

function advertise() {
  try {
    const dnssd = spawn("dns-sd", [
      "-R", "MyMusic", "_mymusic._tcp", ".", String(expressPort),
      `protocol=${PROTOCOL_VERSION}`,
    ], {stdio: "ignore"});
    dnssd.on("error", advertiseFallback);
    dnssd.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        advertiseFallback();
      }
    });
    app.on("will-quit", () => dnssd.kill());
  } catch (err) {
    advertiseFallback();
  }
}

let fellBack = false;
function advertiseFallback() {
  if (fellBack) {
    return;
  }
  fellBack = true;
  require("bonjour")().publish({name: "MyMusic", type: "mymusic", port: expressPort});
}

// Not from a dev copy: the phone would find it as "MyMusic", sync its plays into the dev library
// and clear them from the phone (see devSafety.js). Reach a dev copy by IP when testing.
if (externalEffectsAllowed("bonjour", isDev)) {
  advertise();
  // legacy advertisement for old mobile builds that browse _http._tcp
  require("bonjour")().publish({name: "MyMusic", type: "http", port: expressPort});
}
