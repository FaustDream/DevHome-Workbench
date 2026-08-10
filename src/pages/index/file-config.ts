/**
 * 文件同步（对齐原版 js/fileConfig.js 完整版）
 *
 * - 选择本地目录（File System Access API），DirectoryHandle 持久化 IndexedDB，跨会话恢复
 * - 数据变更自动节流同步：storage 层 registerDirtyListener → markDirty → 防抖写盘（R11）
 * - 手动「立即同步到文件」+ beforeunload 强制刷盘
 * - 权限失效检测：queryPermission / requestPermission 恢复写权限
 *
 * 目录结构（按数据类别分目录，wiki/02 §2.3.6）：
 *   config_dir/{captures,tasks,pomodoro,behavior,tiles,config}/data.json
 */

import { error, info, warn } from '../../lib/logger';
import {
  FILECONFIG_DB_NAME,
  FILECONFIG_DB_STORE,
  FILECONFIG_HANDLE_KEY,
  FILECONFIG_WRITE_DEBOUNCE_MS,
  LS_KEYS,
  V2_KEYS,
} from '../../shared/constants';
import { chromeStorageV2, localStorageService, registerDirtyListener, V2_TO_CATEGORY } from './storage';

const MODULE = 'file-config';

/**
 * File System Access API 类型补充（Chrome 86+，lib.dom 未收录 queryPermission/showDirectoryPicker）
 * @see https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
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

/** 数据类别 → 子目录/文件名/描述（R9 单一来源） */
interface CategoryLayout {
  dir: string;
  file: string;
  desc: string;
}

/** 类别布局表（对齐原版 fileConfig.js DATA_LAYOUT） */
const DATA_LAYOUT: Readonly<Record<string, CategoryLayout>> = {
  captures: { dir: 'captures', file: 'data.json', desc: '快速捕获' },
  tiles: { dir: 'tiles', file: 'tiles.json', desc: '磁贴与分类' },
  config: { dir: 'config', file: 'app.json', desc: '应用配置' },
};

/** 类别 → 对应 v2 键（tiles 组合 pages/pageNames，单独处理） */
const CATEGORY_TO_V2_KEY: Readonly<Record<string, string>> = {
  captures: V2_KEYS.CAPTURES,
  config: V2_KEYS.CONFIG,
};

/** 需要收集的 tabpage_* 设置键（磁贴设置同步用） */
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
/** 待同步类别集合（脏标记） */
const dirtyCategories = new Set<string>();
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let syncInProgress = false;
let lastSyncTime = 0;
let lastSyncError: string | null = null;
let dirHandleDB: IDBDatabase | null = null;
/** 写权限是否待用户授权（后台防抖触发时静默跳过） */
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

/** 静默查询权限（仅 queryPermission，不弹窗） */
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

/** 读取全部类别文件（目录为空/无数据时返回 null） */
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

/** 收集磁贴设置（tabpage_* 原始字符串，供 tiles 类别同步） */
function collectTileSettings(): Record<string, string> {
  const settings: Record<string, string> = {};
  for (const key of TILE_SETTING_KEYS) {
    const raw = localStorageService.getRaw(key);
    if (raw !== null) settings[key] = raw;
  }
  return settings;
}

/** 收集所有需要持久化的数据，按类别组织（对齐原版 collectAllData） */
async function collectAllData(): Promise<Record<string, unknown>> {
  const keys = [...Object.values(CATEGORY_TO_V2_KEY), V2_KEYS.PAGES, V2_KEYS.PAGE_NAMES];
  const all = await chromeStorageV2.getAll<Record<string, unknown>>(keys);
  const data: Record<string, unknown> = {};
  for (const [cat, v2Key] of Object.entries(CATEGORY_TO_V2_KEY)) {
    data[cat] = all[v2Key] ?? null;
  }
  data.tiles = {
    pages: all[V2_KEYS.PAGES] ?? [],
    pageNames: all[V2_KEYS.PAGE_NAMES] ?? [],
    settings: collectTileSettings(),
  };
  return data;
}

/** 从文件数据恢复到存储（对齐原版 restoreAllData） */
async function restoreAllData(data: Record<string, unknown>): Promise<void> {
  for (const [cat, v2Key] of Object.entries(CATEGORY_TO_V2_KEY)) {
    const value = data[cat];
    if (value !== undefined && value !== null) {
      await chromeStorageV2.set(v2Key, value);
    }
  }
  const tiles = data.tiles as { pages?: unknown; pageNames?: unknown; settings?: Record<string, string> } | undefined;
  if (tiles?.pages !== undefined) await chromeStorageV2.set(V2_KEYS.PAGES, tiles.pages);
  if (tiles?.pageNames !== undefined) await chromeStorageV2.set(V2_KEYS.PAGE_NAMES, tiles.pageNames);
  if (tiles?.settings !== undefined) {
    for (const [k, v] of Object.entries(tiles.settings)) {
      localStorageService.setRaw(k, v);
    }
  }
}

/* ================= 同步逻辑 ================= */

/** 标记类别为脏，触发防抖写盘（R11） */
function markDirty(category: string): void {
  if (DATA_LAYOUT[category] === undefined) return;
  dirtyCategories.add(category);
  if (writeTimer !== null) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    void syncToFile(false);
  }, FILECONFIG_WRITE_DEBOUNCE_MS);
}

/**
 * 同步到文件
 * @param force true 写全部类别；false 仅写脏类别
 */
async function syncToFile(force: boolean): Promise<void> {
  if (!isReady || syncInProgress || dirHandle === null) return;
  const categories = force ? Object.keys(DATA_LAYOUT) : [...dirtyCategories];
  if (categories.length === 0) return;
  // 后台防抖触发 → 无用户手势时 requestPermission 会失败 → 静默跳过（数据仍在 storage）
  if (writePermissionPending) return;

  syncInProgress = true;
  try {
    const data = await collectAllData();
    for (const cat of categories) {
      if (data[cat] === undefined) continue;
      try {
        await writeCategoryFile(cat, data[cat]);
      } catch (e) {
        warn(MODULE, `写入 ${DATA_LAYOUT[cat]?.desc ?? cat} 失败`, { err: (e as Error).message });
      }
    }
    dirtyCategories.clear();
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

/** 页面关闭/刷新前强制刷盘（fire-and-forget，不阻塞） */
function handleBeforeUnload(): void {
  if (writeTimer !== null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  for (const cat of Object.keys(DATA_LAYOUT)) dirtyCategories.add(cat);
  void syncToFile(true);
}

/** 订阅 chrome.storage 外部变更（SW 剪藏等非本页写入），自动标记脏 */
function initStorageChangeWatch(): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || dirHandle === null || !isReady) return;
    for (const fullKey of Object.keys(changes)) {
      if (!fullKey.startsWith('v2/')) continue;
      const category = V2_TO_CATEGORY[fullKey.slice('v2/'.length)];
      if (category !== undefined) markDirty(category);
    }
  });
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
      status.textContent = dirName !== '' ? '已就绪，变更将自动同步' : '';
    }
  }
}

/* ================= 对外操作 ================= */

/** 选择本地目录（changeConfigDir 按钮） */
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

    // 优先从文件读回覆盖本地；目录为空则本地数据写入
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

/** 立即同步全部类别到文件（syncToFile 按钮） */
export async function manualSync(): Promise<void> {
  await syncToFile(true);
}

/** 关闭 IndexedDB 连接（重置时调用，避免 deleteDatabase 被占用阻塞） */
export function closeFileConfigDB(): void {
  if (dirHandleDB !== null) {
    dirHandleDB.close();
    dirHandleDB = null;
    info(MODULE, 'IndexedDB 连接已关闭');
  }
}

/* ================= 初始化 ================= */

/**
 * 初始化文件同步：
 * 1. 绑定设置面板按钮（选择目录/立即同步）
 * 2. 注册 storage 脏监听 + chrome.storage 外部变更监听
 * 3. beforeunload 强制刷盘
 * 4. 从 IndexedDB 恢复 handle，权限可用时读回文件数据
 */
export function initFileConfig(): void {
  document.querySelectorAll('[data-setting-action="changeConfigDir"]').forEach((btn) => {
    btn.addEventListener('click', () => void selectSyncDir());
  });
  document.querySelectorAll('[data-setting-action="syncToFile"]').forEach((btn) => {
    btn.addEventListener('click', () => void manualSync());
  });

  // 本页 chromeStorageV2 写入 → markDirty（R11 防抖合并）
  registerDirtyListener((category) => markDirty(category));
  // SW / 其他上下文写入 chrome.storage → markDirty
  initStorageChangeWatch();

  window.addEventListener('beforeunload', handleBeforeUnload);

  // 异步恢复（不阻塞 boot）
  void restoreHandleOnStartup();
}

/** 启动时从 IndexedDB 恢复 handle 并读回文件数据 */
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
    // 静默查询读权限（不弹窗，浏览器重启后首次访问可能未授权）
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
      // 权限暂不可用 → 仅本地存储，待用户手势恢复
      writePermissionPending = true;
    }
    updateStatusUI();
  } catch (e) {
    error(MODULE, 'fileConfig 启动恢复失败', e);
    isReady = true;
  }
}
