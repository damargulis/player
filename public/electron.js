
//const electron = require('electron');
//console.log(electron);
const {app, BrowserWindow, Menu, ipcMain} = require('electron');

const path = require('path');
// shouldn't need package for this ... figure out better way
const isDev = require('electron-is-dev');

let mainWindow;

ipcMain.on('minimize', (evt) => {
  mainWindow.setSize(300, 100);
  evt.reply('minimize-reply');
});

ipcMain.on('maximize', (evt) => {
  mainWindow.setSize(1430, 800);
  evt.reply('maximize-reply');
});

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


