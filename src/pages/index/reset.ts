/**
 * 数据重置模块 — 将扩展恢复到出厂默认状态
 *
 * 清除所有 localStorage 数据，重新加载默认分类磁贴并刷新页面。
 *
 * 触发方式：
 * - 控制台：`__thrilledReset()`
 * - 快捷键：Ctrl+Shift+R（在 boot 中绑定）
 */

import { info, warn } from '../../lib/logger';
import {
  LS_KEYS,
  STORAGE_PREFIX,
  DEFAULTS_JSON_PATH,
  DEFAULTS_VERSION,
  FILECONFIG_DB_NAME,
} from '../../shared/constants';
import { normalizeTilePositions, parseDefaultPages } from '../../lib/default-data-loader';
import { closeFileConfigDB } from './file-config';

const MODULE = 'reset';

/** ===== localStorage 清除 ===== */

function clearAllLocalStorage(): void {
  const count = localStorage.length;
  localStorage.clear();
  info(MODULE, `localStorage 已清空`, { removedKeys: count });
}

/** ===== IndexedDB 清除 ===== */

/** 重试配置 */
const IDB_DELETE_MAX_RETRY = 3;
const IDB_DELETE_RETRY_DELAY_MS = 300;

function deleteFileConfigDB(retryCount = 0): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(FILECONFIG_DB_NAME);
      req.onsuccess = () => {
        info(MODULE, `IndexedDB ${FILECONFIG_DB_NAME} 已删除`);
        resolve();
      };
      req.onerror = () => {
        info(MODULE, `IndexedDB ${FILECONFIG_DB_NAME} 删除失败（已忽略）`, { err: String(req.error?.message ?? 'unknown') });
        resolve();
      };
      req.onblocked = () => {
        if (retryCount < IDB_DELETE_MAX_RETRY) {
          info(MODULE, `IndexedDB 删除被占用，${IDB_DELETE_RETRY_DELAY_MS}ms 后重试 (${retryCount + 1}/${IDB_DELETE_MAX_RETRY})`);
          setTimeout(() => {
            deleteFileConfigDB(retryCount + 1).then(resolve);
          }, IDB_DELETE_RETRY_DELAY_MS);
        } else {
          info(MODULE, `IndexedDB 删除多次重试仍被占用，跳过（刷新后自动清理）`);
          resolve();
        }
      };
    } catch (e) {
      info(MODULE, 'IndexedDB 删除异常（已忽略）', { err: (e as Error).message });
      resolve();
    }
  });
}

/** ===== 默认数据写入 ===== */

async function writeDefaultPages(): Promise<void> {
  try {
    localStorage.removeItem(LS_KEYS.DEFAULTS_CACHED);
    localStorage.removeItem(LS_KEYS.DEFAULTS_VERSION);

    const url = chrome.runtime.getURL(DEFAULTS_JSON_PATH);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    const pages = normalizeTilePositions(parseDefaultPages(raw));
    if (pages.length > 0) {
      localStorage.setItem(`${STORAGE_PREFIX}${LS_KEYS.PAGES}`, JSON.stringify(pages));
      const names = pages.map((p) => p.name);
      localStorage.setItem(`${STORAGE_PREFIX}${LS_KEYS.PAGE_NAMES}`, JSON.stringify(names));
      localStorage.setItem(LS_KEYS.DEFAULTS_CACHED, raw);
      localStorage.setItem(LS_KEYS.DEFAULTS_VERSION, DEFAULTS_VERSION);
      info(MODULE, `默认磁贴已写入`, { pages: pages.length, names });
    }
  } catch (e) {
    warn(MODULE, '默认数据写入失败', { err: (e as Error).message });
  }
}

/** ===== 主入口 ===== */

export async function resetAllData(): Promise<void> {
  info(MODULE, '开始重置所有数据...');

  // Step 1: 清空所有 localStorage
  clearAllLocalStorage();

  // Step 2: 写入默认磁贴
  await writeDefaultPages();

  // Step 3: 关闭并删除 IndexedDB
  closeFileConfigDB();
  await deleteFileConfigDB();

  info(MODULE, '所有数据已重置，即将刷新页面');
  window.location.reload();
}

/** 暴露到全局 */
declare global {
  interface Window {
    __thrilledReset?: typeof resetAllData;
  }
}
if (typeof window !== 'undefined') {
  window.__thrilledReset = resetAllData;
}
