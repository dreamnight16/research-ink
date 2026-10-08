/**
 * 用户偏好：关闭透明效果。
 * DNDL materials.css 通过 [data-dn-transparency="off"] 提供不透明回退，
 * 这里只负责读写偏好并把属性挂到 <html> 上。
 */
const STORAGE_KEY = 'yanmo-reduced-transparency';

export function transparencyOff(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function sync(off: boolean): void {
  const root = document.documentElement;
  if (off) root.setAttribute('data-dn-transparency', 'off');
  else root.removeAttribute('data-dn-transparency');
}

/** 启动时按已保存的偏好同步一次属性 */
export function applyStoredTransparency(): void {
  sync(transparencyOff());
}

/** 用户切换偏好：立即生效并持久化 */
export function setTransparencyPreference(off: boolean): void {
  sync(off);
  try {
    localStorage.setItem(STORAGE_KEY, off ? '1' : '0');
  } catch {
    /* 存储不可用时仅本次会话生效 */
  }
}
