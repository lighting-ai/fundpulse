// Preload 脚本：在渲染进程中运行，可以安全地暴露 API
const { contextBridge } = require('electron');

// 暴露受保护的方法给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 可以在这里添加需要暴露给前端的 Electron API
  platform: process.platform,
  versions: process.versions,
});
