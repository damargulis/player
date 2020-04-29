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

class ExtensionMonitor {
  constructor(extensionId) {
    this.extensionId = extensionId;
    this.extensionWindow_ = new BrowserWindow({
      height: 250,
      webPreferences: {
        nodeIntegration: true,
        webSecutiry: false,
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

ipcMain.on("goToSong", (evt, data) => {
  maximize();
  evt.reply("toSong", data);
});

ipcMain.on("goToAlbum", (evt, data) => {
  maximize();
  evt.reply("toAlbum", data);
});

ipcMain.on("minimize", (evt) => {
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

const expressPort = 4444;
const express = require("express");
const expressApp = express();
const http = require("http").createServer(expressApp);
const io = require("socket.io")(http);

let lastState = null;

io.on("connection", (socket) => {
  if (lastState) {
    socket.emit("state", lastState);
  }

  socket.on("action", (action) => {
    extEvt.reply(action);
  });

});

ipcMain.on("controller-state", (evt, state) => {
  io.emit("state", state);
  lastState = state;
});

http.listen(expressPort, () => {
});
