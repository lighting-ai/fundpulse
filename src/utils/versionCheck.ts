/**
 * 版本检查和强制刷新工具
 * 用于检测应用更新并强制刷新页面
 */

/**
 * 检查应用版本并强制刷新
 * 通过检查 index.html 的版本号或更新时间来判断是否有更新
 */
export const checkVersionAndReload = async () => {
  try {
    // 获取当前页面的基础路径
    const basePath = import.meta.env.BASE_URL || '/fundpulse/';
    const indexUrl = `${basePath}index.html?t=${Date.now()}`;
    
    // 方法1: 检查 HTML 中的版本号 meta 标签
    const htmlResponse = await fetch(indexUrl, { cache: 'no-store' });
    const htmlText = await htmlResponse.text();
    const versionMatch = htmlText.match(/<meta\s+name="version"\s+content="([^"]+)"/i);
    
    if (versionMatch) {
      const serverVersion = versionMatch[1];
      const cachedVersion = localStorage.getItem('app_version');
      
      if (cachedVersion && cachedVersion !== serverVersion) {
        console.log(`[版本检查] 检测到新版本: ${cachedVersion} -> ${serverVersion}，准备刷新...`);
        // 清除版本缓存
        localStorage.removeItem('app_version');
        localStorage.removeItem('app_last_modified');
        // 强制刷新
        window.location.reload();
        return;
      } else if (!cachedVersion) {
        // 首次访问，保存版本号
        localStorage.setItem('app_version', serverVersion);
      }
    }
    
    // 方法2: 如果版本号检查失败，回退到检查 Last-Modified
    const lastModified = htmlResponse.headers.get('Last-Modified');
    if (lastModified && !versionMatch) {
      const serverTime = new Date(lastModified).getTime();
      const cachedTime = localStorage.getItem('app_last_modified');
      
      if (cachedTime) {
        const cachedTimeNum = parseInt(cachedTime, 10);
        // 如果服务器时间比缓存时间新，说明有更新
        if (serverTime > cachedTimeNum) {
          console.log('[版本检查] 检测到新版本（通过时间戳），准备刷新...');
          // 清除所有缓存
          localStorage.removeItem('app_last_modified');
          // 强制刷新
          window.location.reload();
          return;
        }
      } else {
        // 首次访问，保存时间戳
        localStorage.setItem('app_last_modified', serverTime.toString());
      }
    }
  } catch (error) {
    // 版本检查失败不影响应用运行
    console.warn('[版本检查] 检查失败:', error);
  }
};

/**
 * 注册 Service Worker 并监听更新
 */
export const registerServiceWorker = () => {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    // 使用 workbox-window 注册 Service Worker
    import('workbox-window').then(({ Workbox }) => {
      // 获取当前页面的基础路径
      const basePath = import.meta.env.BASE_URL || '/fundpulse/';
      const swPath = `${basePath}sw.js`;
      const wb = new Workbox(swPath);
      
      // 监听 Service Worker 更新
      wb.addEventListener('waiting', () => {
        console.log('[Service Worker] 检测到新版本，准备刷新...');
        // 立即激活新版本并刷新
        wb.messageSkipWaiting();
      });
      
      // 监听 Service Worker 控制权变更
      wb.addEventListener('controlling', () => {
        console.log('[Service Worker] 新版本已激活，刷新页面...');
        window.location.reload();
      });
      
      // 注册 Service Worker
      wb.register().then((registration) => {
        console.log('[Service Worker] 注册成功');
        
        // 定期检查更新（每5分钟）
        setInterval(() => {
          registration?.update();
        }, 5 * 60 * 1000);
      }).catch((error) => {
        console.warn('[Service Worker] 注册失败:', error);
      });
    });
  }
};

/**
 * 初始化版本检查
 * 在应用启动时调用
 */
export const initVersionCheck = () => {
  // 注册 Service Worker
  registerServiceWorker();
  
  // 页面加载完成后检查版本
  if (document.readyState === 'complete') {
    checkVersionAndReload();
  } else {
    window.addEventListener('load', () => {
      // 延迟一下，确保 Service Worker 已注册
      setTimeout(() => {
        checkVersionAndReload();
      }, 1000);
    });
  }
  
  // 定期检查版本（每10分钟）
  setInterval(() => {
    checkVersionAndReload();
  }, 10 * 60 * 1000);
};
