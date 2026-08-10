/**
 * 数据重置模块 — 将扩展恢复到出厂默认状态
 *
 * 清除所有 localStorage / chrome.storage.local / IndexedDB 数据，
 * 重新加载默认分类磁贴并刷新页面。
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

/** 清除当前 origin 下所有 localStorage（最彻底方案） */
function clearAllLocalStorage(): void {
  const count = localStorage.length;
  localStorage.clear();
  info(MODULE, `localStorage 已清空`, { removedKeys: count });
}

/** ===== chrome.storage.local 清除 ===== */

/** 清除 `v2/` 前缀的所有键 */
async function clearV2Storage(): Promise<void> {
  try {
    // 先获取所有键，防止遗漏（不仅仅是已知的 4 个）
    const all = await chrome.storage.local.get(null);
    const v2Keys = Object.keys(all).filter((k) => k.startsWith('v2/'));
    if (v2Keys.length > 0) {
      await chrome.storage.local.remove(v2Keys);
      info(MODULE, `chrome.storage.local v2/ 键已清除`, { keys: v2Keys });
    }
  } catch (e) {
    warn(MODULE, 'chrome.storage.local 清除失败，继续', { err: (e as Error).message });
  }
}

/** ===== IndexedDB 清除 ===== */

/** 最多重试次数（onblocked 时等待其他标签页释放连接） */
const IDB_DELETE_MAX_RETRY = 3;
/** 重试间隔（ms） */
const IDB_DELETE_RETRY_DELAY_MS = 300;

/** 删除 FileConfig IndexedDB 数据库（带阻塞重试，失败不阻塞流程） */
function deleteFileConfigDB(retryCount = 0): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(FILECONFIG_DB_NAME);
      req.onsuccess = () => {
        info(MODULE, `IndexedDB ${FILECONFIG_DB_NAME} 已删除`);
        resolve();
      };
      req.onerror = () => {
        // error 事件在版本降级等场景触发，不影响核心流程
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
          // 多次重试仍被占用，放弃删除（页面刷新后连接自然断开）
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

/** 加载 defaults.json 并写入 localStorage（绕过缓存，强制重新 fetch） */
async function writeDefaultPages(): Promise<void> {
  try {
    // 清除缓存的 defaults（强制重新 fetch）
    localStorage.removeItem(LS_KEYS.DEFAULTS_CACHED);
    localStorage.removeItem(LS_KEYS.DEFAULTS_VERSION);

    const url = chrome.runtime.getURL(DEFAULTS_JSON_PATH);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    const pages = normalizeTilePositions(parseDefaultPages(raw));
    if (pages.length > 0) {
      // 写入 localStorage（页面 boot 时会从这里读取）
      localStorage.setItem(`${STORAGE_PREFIX}${LS_KEYS.PAGES}`, JSON.stringify(pages));
      const names = pages.map((p) => p.name);
      localStorage.setItem(`${STORAGE_PREFIX}${LS_KEYS.PAGE_NAMES}`, JSON.stringify(names));
      // 缓存 defaults 供后续使用
      localStorage.setItem(LS_KEYS.DEFAULTS_CACHED, raw);
      localStorage.setItem(LS_KEYS.DEFAULTS_VERSION, DEFAULTS_VERSION);
      info(MODULE, `默认磁贴已写入`, { pages: pages.length, names });
    }
  } catch (e) {
    warn(MODULE, '默认数据写入失败', { err: (e as Error).message });
  }
}

/** ===== 主入口 ===== */

/**
 * 重置所有数据到出厂状态
 *
 * 执行顺序：
 * 1. 清空所有 localStorage
 * 2. 写入默认磁贴数据（从 defaults.json）
 * 3. 清空 chrome.storage.local v2/ 键
 * 4. 删除 IndexedDB DevHomeFileConfig
 * 5. 刷新页面
 */
export async function resetAllData(): Promise<void> {
  info(MODULE, '开始重置所有数据...');

  // Step 1: 清空所有 localStorage
  clearAllLocalStorage();

  // Step 2: 写入默认磁贴（必须在清空之后，因为清空会删掉刚写入的）
  await writeDefaultPages();

  // Step 3-4: 异步清空 chrome.storage + IndexedDB（并行）
  // 先关闭现有 DB 连接，防止 deleteDatabase 被占用阻塞
  closeFileConfigDB();
  await Promise.all([clearV2Storage(), deleteFileConfigDB()]);

  info(MODULE, '所有数据已重置，即将刷新页面');

  // Step 5: 刷新页面 → boot 重新执行 → 进入默认状态
  window.location.reload();
}

/** 暴露到全局，方便控制台手动调用 */
declare global {
  interface Window {
    __thrilledReset?: typeof resetAllData;
  }
}
if (typeof window !== 'undefined') {
  window.__thrilledReset = resetAllData;
}
