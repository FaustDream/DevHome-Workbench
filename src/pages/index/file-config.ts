/**
 * 文件同步
 *
 * - 选择本地目录（File System Access API），DirectoryHandle 持久化 IndexedDB，跨会话恢复
 * - 手动「立即同步到文件」+ beforeunload 强制刷盘
 * - 权限失效检测：queryPermission / requestPermission 恢复写权限
 */

import { error, info, warn } from '../../lib/logger';
import {
  FILECONFIG_DB_NAME,
  FILECONFIG_DB_STORE,
  FILECONFIG_HANDLE_KEY,
  FILECONFIG_WRITE_DEBOUNCE_MS,
  LS_KEYS,
} from '../../shared/constants';
import { localStorageService } from './storage';

const MODULE = 'file-config';

/**
 * File System Access API 类型补充（Chrome 86+）
 */
declare global {
  interface Window {
    showDirectoryPicker(options?: { mode: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
  }
  interface FileSystemDirectoryHandle {
    queryPermission(options: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
    requestPermission(options: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  }
}

/** 数据类别 → 子目录/文件名/描述 */
interface CategoryLayout {
  dir: string;
  file: string;
  desc: string;
}

const DATA_LAYOUT: Readonly<Record<string, CategoryLayout>> = {
  tiles: { dir: 'tiles', file: 'tiles.json', desc: '磁贴与分类' },
  config: { dir: 'config', file: 'app.json', desc: '应用配置' },
};

/** 需要同步的设置键 */
const TILE_SETTING_KEYS: readonly string[] = [
  LS_KEYS.ENGINE,
  LS_KEYS.SHORTCUT_SIZE,
  LS_KEYS.SHORTCUT_COLUMNS,
  LS_KEYS.AUTO_FOCUS,
  LS_KEYS.CATEGORY_MEMORY,
  LS_KEYS.LAST_PAGE,
  LS_KEYS.CAT_ROW,
  LS_KEYS.PAGE_TRANSITION,
  LS_KEYS.LINK_NEW_TAB_TILES,
  LS_KEYS.LINK_NEW_TAB_SEARCH,
  LS_KEYS.CONFIG_NICKNAME,
];

/* ================= 内部状态 ================= */

let dirHandle: FileSystemDirectoryHandle | null = null;
let isReady = false;
let syncInProgress = false;
let lastSyncTime = 0;
let lastSyncError: string | null = null;
let dirHandleDB: IDBDatabase | null = null;
let writePermissionPending = false;

/* ================= IndexedDB Handle 持久化 ================= */

function openHandlesDB(): Promise<IDBDatabase> {
  if (dirHandleDB !== null) return Promise.resolve(dirHandleDB);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILECONFIG_DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dirHandleDB = request.result;
      resolve(dirHandleDB);
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILECONFIG_DB_STORE)) {
        db.createObjectStore(FILECONFIG_DB_STORE);
      }
    };
  });
}

async function saveHandleToDB(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandlesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILECONFIG_DB_STORE, 'readwrite');
    const store = tx.objectStore(FILECONFIG_DB_STORE);
    store.put(handle, FILECONFIG_HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadHandleFromDB(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openHandlesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILECONFIG_DB_STORE, 'readonly');
    const store = tx.objectStore(FILECONFIG_DB_STORE);
    const request = store.get(FILECONFIG_HANDLE_KEY);
    request.onsuccess = () => resolve((request.result as FileSystemDirectoryHandle | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

/* ================= 权限检测 ================= */

async function verifyPermissionQuiet(handle: FileSystemDirectoryHandle, withWrite: boolean): Promise<boolean> {
  const opts = { mode: withWrite ? 'readwrite' : 'read' } as const;
  try {
    return (await handle.queryPermission(opts)) === 'granted';
  } catch {
    return false;
  }
}

/* ================= 分类文件读写 ================= */

async function readCategoryFile(category: string): Promise<unknown> {
  if (dirHandle === null) return null;
  const layout = DATA_LAYOUT[category];
  if (layout === undefined) return null;
  try {
    const subDir = await dirHandle.getDirectoryHandle(layout.dir, { create: false });
    const fileHandle = await subDir.getFileHandle(layout.file, { create: false });
    const file = await fileHandle.getFile();
    return JSON.parse(await file.text());
  } catch (e) {
    if ((e as DOMException).name === 'NotFoundError') return null;
    throw e;
  }
}

async function writeCategoryFile(category: string, data: unknown): Promise<void> {
  if (dirHandle === null) throw new Error('目录未授权');
  const layout = DATA_LAYOUT[category];
  if (layout === undefined) throw new Error(`未知数据类别: ${category}`);
  const subDir = await dirHandle.getDirectoryHandle(layout.dir, { create: true });
  const fileHandle = await subDir.getFileHandle(layout.file, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

async function readAllCategoryFiles(): Promise<Record<string, unknown> | null> {
  if (dirHandle === null) return null;
  const data: Record<string, unknown> = {};
  let hasAny = false;
  for (const cat of Object.keys(DATA_LAYOUT)) {
    try {
      const value = await readCategoryFile(cat);
      if (value !== null) {
        data[cat] = value;
        hasAny = true;
      }
    } catch (e) {
      warn(MODULE, `读取 ${DATA_LAYOUT[cat]?.desc ?? cat} 失败`, { err: (e as Error).message });
    }
  }
  return hasAny ? data : null;
}

/* ================= 数据收集与恢复 ================= */

function collectTileSettings(): Record<string, string> {
  const settings: Record<string, string> = {};
  for (const key of TILE_SETTING_KEYS) {
    const raw = localStorageService.getRaw(key);
    if (raw !== null) settings[key] = raw;
  }
  return settings;
}

function collectAllData(): Record<string, unknown> {
  const pages = localStorageService.get(LS_KEYS.PAGES, []);
  const pageNames = localStorageService.get(LS_KEYS.PAGE_NAMES, []);

  return {
    tiles: {
      pages,
      pageNames,
      settings: collectTileSettings(),
    },
    config: collectTileSettings(),
  };
}

async function restoreAllData(data: Record<string, unknown>): Promise<void> {
  const tiles = data.tiles as { pages?: unknown; pageNames?: unknown; settings?: Record<string, string> } | undefined;
  if (tiles?.pages !== undefined) {
    localStorageService.set(LS_KEYS.PAGES, tiles.pages);
  }
  if (tiles?.pageNames !== undefined) {
    localStorageService.set(LS_KEYS.PAGE_NAMES, tiles.pageNames);
  }
  if (tiles?.settings !== undefined) {
    for (const [k, v] of Object.entries(tiles.settings)) {
      localStorageService.setRaw(k, v);
    }
  }
}

/* ================= 同步逻辑 ================= */

async function syncToFile(force: boolean): Promise<void> {
  if (!isReady || syncInProgress || dirHandle === null) return;
  if (writePermissionPending) return;

  syncInProgress = true;
  try {
    const data = collectAllData();
    const categories = force ? Object.keys(DATA_LAYOUT) : Object.keys(DATA_LAYOUT);
    for (const cat of categories) {
      if (data[cat] === undefined) continue;
      try {
        await writeCategoryFile(cat, data[cat]);
      } catch (e) {
        warn(MODULE, `写入 ${DATA_LAYOUT[cat]?.desc ?? cat} 失败`, { err: (e as Error).message });
      }
    }
    lastSyncTime = Date.now();
    lastSyncError = null;
    updateStatusUI();
  } catch (e) {
    lastSyncError = (e as Error).message || '写入失败';
    error(MODULE, '同步文件失败', e);
  } finally {
    syncInProgress = false;
  }
}

function handleBeforeUnload(): void {
  void syncToFile(true);
}

/* ================= UI 状态 ================= */

function updateStatusUI(): void {
  const dirLabel = document.getElementById('configDirLabel');
  const syncBtn = document.getElementById('configSyncBtn');
  const status = document.getElementById('configSyncStatus');
  const dirName = dirHandle?.name ?? '';
  if (dirLabel !== null) dirLabel.textContent = dirName !== '' ? `当前：${dirName}` : '选择配置目录';
  if (syncBtn !== null) syncBtn.style.display = dirName !== '' ? '' : 'none';
  if (status !== null) {
    if (lastSyncError !== null) {
      status.textContent = `同步失败：${lastSyncError}`;
    } else if (lastSyncTime > 0) {
      status.textContent = `上次同步：${new Date(lastSyncTime).toLocaleTimeString()}`;
    } else {
      status.textContent = dirName !== '' ? '已就绪，点击同步按钮保存' : '';
    }
  }
}

/* ================= 对外操作 ================= */

export async function selectSyncDir(): Promise<boolean> {
  if (typeof window.showDirectoryPicker !== 'function') {
    warn(MODULE, '当前浏览器不支持 showDirectoryPicker（需 Chrome 86+）');
    return false;
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    dirHandle = handle;
    isReady = true;
    writePermissionPending = false;

    const categoryData = await readAllCategoryFiles();
    if (categoryData !== null) {
      await restoreAllData(categoryData);
      info(MODULE, '已从目录恢复数据', { categories: Object.keys(categoryData) });
    } else {
      await syncToFile(true);
      info(MODULE, '本地数据已同步到目录');
    }
    await saveHandleToDB(handle);
    updateStatusUI();
    return true;
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return false;
    warn(MODULE, '目录选择失败', { err: (e as Error).message });
    return false;
  }
}

export async function manualSync(): Promise<void> {
  await syncToFile(true);
}

export function closeFileConfigDB(): void {
  if (dirHandleDB !== null) {
    dirHandleDB.close();
    dirHandleDB = null;
    info(MODULE, 'IndexedDB 连接已关闭');
  }
}

/* ================= 初始化 ================= */

export function initFileConfig(): void {
  document.querySelectorAll('[data-setting-action="changeConfigDir"]').forEach((btn) => {
    btn.addEventListener('click', () => void selectSyncDir());
  });
  document.querySelectorAll('[data-setting-action="syncToFile"]').forEach((btn) => {
    btn.addEventListener('click', () => void manualSync());
  });

  window.addEventListener('beforeunload', handleBeforeUnload);
  void restoreHandleOnStartup();
}

async function restoreHandleOnStartup(): Promise<void> {
  if (typeof window.showDirectoryPicker !== 'function') {
    isReady = true;
    updateStatusUI();
    return;
  }
  try {
    const handle = await loadHandleFromDB();
    if (handle === null) {
      isReady = true;
      updateStatusUI();
      return;
    }
    dirHandle = handle;
    isReady = true;
    const readPermitted = await verifyPermissionQuiet(handle, false);
    if (readPermitted) {
      writePermissionPending = !(await verifyPermissionQuiet(handle, true));
      if (!writePermissionPending) {
        const categoryData = await readAllCategoryFiles();
        if (categoryData !== null) {
          await restoreAllData(categoryData);
          info(MODULE, '已从文件恢复数据（启动）');
        }
      }
    } else {
      writePermissionPending = true;
    }
    updateStatusUI();
  } catch (e) {
    error(MODULE, 'fileConfig 启动恢复失败', e);
    isReady = true;
  }
}
