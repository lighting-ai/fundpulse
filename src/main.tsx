import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initVersionCheck } from './utils/versionCheck'

// 初始化版本检查和强制刷新机制
if (import.meta.env.PROD) {
  initVersionCheck();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
