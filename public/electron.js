const {
  app,
  globalShortcut,
  BrowserWindow,
  Menu,
  MenuItem,
  ipcMain,
  shell,
} = require("electron");

// shouldn't need package for this ... figure out better way
const isDev = require("electron-is-dev");

const path = require("path");
const defaultMenu = require("electron-default-menu");

let mainWindow = null;
let extensionWindow = null;
// TODO: change name to be playerEvt or something since its used for more than
// just extensions
// TODO: refactor all of this into a channel class w/ names and queues and shit
// goddamit i hate channels
let extEvt = null;
let extensionEvt = null;

ipcMain.on("goToArtist", (evt, data) => {
  maximize();
  evt.reply("toArtist", data);
});

ipcMain.on("goToSong", (evt, data) => {
  maximize();
  evt.reply("toSong", data);
});

ipcMain.on("goToAlbum", (evt, data) => {
  maximize();
  evt.reply("toAlbum", data);
});

ipcMain.on("minimize", (evt) => {
  //mainWindow.setSize(300, 100);
  mainWindow.setSize(240, 120);
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

ipcMain.on("extension-monitor-ready", (evt) => {
  extensionEvt = evt;
});

const messageQueue = [];

ipcMain.on("extension-update", (evt, arg) => {
  messageQueue.push(arg);
  if (extensionEvt) {
    while (messageQueue.length) {
      const msg = messageQueue.shift();
      extensionEvt.reply(msg.type, msg);
    }
  }
});

ipcMain.on("extension-close", () => {
  if (extensionWindow) {
    extensionWindow.close();
  }
});

/** Forward event to reset the library from main to the App. */
function resetLibrary() {
  extEvt.reply("reset-library");
}

/**
 * Start running an extension.
 * @param {string} type The type of extension to run.
 */
function runExtension(type) {
  extEvt.reply("run-extension", type);
  extensionEvt = null;
  extensionWindow = new BrowserWindow({
    height: 250,
    webPreferences: {
      nodeIntegration: true,
      webSecutiry: false,
    },
    width: 500,
  });
  extensionWindow.loadURL(
    `file://${path.join(__dirname, "./extension_monitor.html")}`);
}

/** Creates the main window. */
function createWindow() {
  mainWindow = new BrowserWindow({
    frame: false,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
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
    label: "Extensions",
    submenu: [
    {label: "Wikipedia", click: () => runExtension("wikipedia")},
    {label: "Genius", click: () => runExtension("genius")},
  ],
  }));
  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
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
