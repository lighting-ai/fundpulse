const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
    },
    icon: path.join(__dirname, '../public/favicon.svg'),
    titleBarStyle: 'default',
    backgroundColor: '#0a0a0f',
    show: false,
  });

  // 窗口准备好后显示，避免闪烁
  win.once('ready-to-show', () => {
    win.show();
  });

  // 加载应用
  if (isDev) {
    // 开发模式：连接到 Vite 开发服务器
    win.loadURL('http://localhost:5173/fundpulse/');
    // 打开开发者工具
    win.webContents.openDevTools();
  } else {
    // 生产模式：加载构建后的文件
    const indexPath = path.join(__dirname, '../dist/index.html');
    win.loadFile(indexPath).catch((err) => {
      console.error('Failed to load index.html:', err);
      // 如果加载失败，尝试使用 file:// 协议
      win.loadURL(`file://${indexPath}`);
    });
  }

  // 处理窗口关闭
  win.on('closed', () => {
    win = null;
  });
}

// 应用准备就绪
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
