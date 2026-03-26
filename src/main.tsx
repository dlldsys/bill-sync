import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/global.css'
import App from './App.tsx'

// 抑制 Tesseract OCR 的警告（这些是 WASM 引擎内部参数警告，不影响功能）
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Parameter not found')
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
