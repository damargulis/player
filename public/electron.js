const {
  app,
  clipboard,
  dialog,
  globalShortcut,
  BrowserWindow,
  Menu,
  MenuItem,
  ipcMain,
  shell,
  protocol,
} = require("electron");

// TODO: shouldn't need package for this ... figure out better way
const isDev = require("electron-is-dev");
const path = require("path");
const defaultMenu = require("electron-default-menu");
const fs = require("fs");
const os = require("os");

app.whenReady().then(() => {
  protocol.registerFileProtocol("file", (req, callback) => {
    const pathname = req.url.replace("file:///", "");
    callback(pathname);
  });
});

class ExtensionMonitor {
  constructor(extensionId) {
    this.extensionId = extensionId;
    this.extensionWindow_ = new BrowserWindow({
      height: 250,
      webPreferences: {
        nodeIntegration: true,
        nodeIntegrationInWorker: true,
        contextIsolation: false,
        webSecurity: false,
      },
      width: 500,
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
  mainWindow.setSize(320, 120);
  evt.reply("minimize-reply");
});

ipcMain.on("maximize", (evt) => {
  maximize();
  evt.reply("maximize-reply");
});

/** Maximize the main window. */
function maximize() {
  mainWindow.setSize(1430, 800);
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

/** Forward event to reset the library from main to the App. */
function resetLibrary() {
  extEvt.reply("reset-library");
}

let gameWindow = null;

/** Opens the Name That Tune game window. */
function openNameThatTune() {
  if (gameWindow) {
    gameWindow.focus();
    return;
  }
  gameWindow = new BrowserWindow({
    height: 640,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      webSecurity: false,
    },
    width: 520,
  });
  gameWindow.loadURL(`file://${path.join(__dirname, "./name_that_tune.html")}`);
  gameWindow.on("closed", () => gameWindow = null);
}

// The game window asks for playable tracks; proxy through the renderer,
// which owns the library, like the mobile API endpoints do.
ipcMain.on("game-get-tracks", () => {
  ipcMain.once("game-tracks", (evt, data) => {
    if (gameWindow) {
      gameWindow.webContents.send("game-tracks", data);
    }
  });
  extEvt.reply("get-game-tracks");
});

// mirrors DATA_DIR in src/constants.tsx
function gameScoresFile() {
  const dataDir = isDev ? path.resolve("data") : path.join(app.getPath("userData"), "data");
  return path.join(dataDir, "tune_scores.json");
}

ipcMain.on("game-get-scores", (evt) => {
  let scores = {};
  try {
    scores = JSON.parse(fs.readFileSync(gameScoresFile(), "utf8"));
  } catch (err) {
    // no scores saved yet
  }
  evt.reply("game-scores", scores);
});

ipcMain.on("game-save-scores", (evt, scores) => {
  try {
    fs.mkdirSync(path.dirname(gameScoresFile()), {recursive: true});
    fs.writeFileSync(gameScoresFile(), JSON.stringify(scores));
  } catch (err) {
    // scores are best-effort; losing one save is fine
  }
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
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
    },
    width: 1430,
  });
  mainWindow.loadURL(isDev
    ? "http://localhost:3000"
    : `file://${path.join(__dirname, "./index.html")}`);
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  mainWindow.on("closed", () => mainWindow = null);
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
    {label: "MusicBrainz", click: () => runExtension("musicbrainz")},
    {type: "separator"},
    {label: "Name That Tune", click: () => openNameThatTune()},
  ],
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
const io = require("socket.io")(http);

let lastState = null;
let lastDjState = null;

io.on("connection", (socket) => {
  socket.emit("dj-build", djBuildId());
  if (lastState) {
    socket.emit("state", lastState);
  }
  if (lastDjState) {
    socket.emit("dj-state", lastDjState);
  }

  socket.on("action", (action) => {
    extEvt.reply(action.type, action.data);
  });
});

ipcMain.on("controller-state", (evt, state) => {
  io.emit("state", state);
  lastState = state;
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

expressApp.get("/start-sync", (req, res) => {
  ipcMain.once("synced-playlists", (evt, data) => {
    res.send(JSON.stringify(data));
  });
  const plays = JSON.parse(decodeURIComponent(req.query.plays));
  extEvt.reply("get-synced-playlists", plays);
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
    const fileName = data.filePath;
    const pathName = decodeURI(fileName.slice(7));
    res.sendFile(pathName);
  });
  extEvt.reply("get-track", req.params.trackId);
});

expressApp.get("/get-artist-pic/:artistId", (req, res) => {
  ipcMain.once("get-artist-" + req.params.artistId, (evt, data) => {
    const fileName = data.artFile;
    if (fileName) {
      // artist art is stored as a plain absolute path, but strip a
      // file:// prefix in case old library entries carry one
      const pathName = fileName.startsWith("file://")
        ? decodeURI(fileName.slice(7))
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
    const fileName = data.albumArtFile;
    if (fileName) {
      const pathName = path.resolve(fileName);
      res.sendFile(pathName);
    }
    // TODO: else send error?
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

advertise();

// legacy advertisement for old mobile builds that browse _http._tcp
const bonjour = require("bonjour")();
bonjour.publish({name: "MyMusic", type: "http", port: expressPort});
