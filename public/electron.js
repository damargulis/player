
//const electron = require('electron');
//console.log(electron);
const {app, BrowserWindow, Menu, MenuItem, ipcMain, shell} = require('electron');
const defaultMenu = require('electron-default-menu');

const path = require('path');
// shouldn't need package for this ... figure out better way
const isDev = require('electron-is-dev');

let mainWindow;

ipcMain.on('goToArtist', (evt, data) => {
  maximize();
  evt.reply('toArtist', data);
});

ipcMain.on('goToAlbum', (evt, data) => {
  maximize();
  evt.reply('toAlbum', data);
});

ipcMain.on('minimize', (evt) => {
  mainWindow.setSize(300, 100);
  evt.reply('minimize-reply');
});

ipcMain.on('maximize', (evt) => {
  maximize();
  evt.reply('maximize-reply');
});

function maximize() {
  mainWindow.setSize(1430, 800);
}

let extEvt;
ipcMain.on('extension-ready', (evt) => {
  extEvt = evt;
});

function runExtension(type) {
  extEvt.reply('run-extension', type);
}

function createLibrary() {
  //const libraryFile = "~/Music/iTunes/iTunes\ Music\ Library.xml";

}

function createWindow() {
  createLibrary();
  mainWindow = new BrowserWindow({
    width: 1430,
    height: 800,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
    },
  });
  mainWindow.loadURL(isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, '../build/index.html')}`);
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  mainWindow.on('closed', () => mainWindow = null);
  const menu = defaultMenu(app, shell);
  menu.push(new MenuItem({
    label: "Extensions",
    submenu: [
      {label: "Wikipedia", click: () => runExtension('wikipedia')}
    ]
  }));
  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
  //const menu = Menu.getApplicationMenu();
  //menu.append(new MenuItem({
  //  label: "Extensions",
  //}));
  //Menu.setApplicationMenu(menu);
  // how to set menu:
  //var menu = Menu.buildFromTemplate([
  //  {
  //    label: 'Menu',
  //    submenu: [
  //      {label: 'Adjust Notification Value'},
  //      {label: 'CoinMarketCap'},
  //      {label: 'Exit'}
  //    ]
  //  }
  //]);
  //Menu.setApplicationMenu(menu);
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});


