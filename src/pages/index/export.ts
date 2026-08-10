/**
 * 导出中心（对齐原版 js/export.js + 设置面板导出按钮）
 *
 * - 导出 v2 数据（tasks/captures/pomodoro_sessions/config/pages）为 JSON 文件下载
 * - 导入：解析 JSON → 写回 v2 storage
 * - 触发：设置面板 `data-setting-action="exportData"` 按钮
 */

import { info, warn } from '../../lib/logger';
import { V2_KEYS } from '../../shared/constants';
import { chromeStorageV2 } from './storage';

const MODULE = 'export';

/** 导出数据结构 */
interface ExportPayload {
  version: '1.0';
  exportedAt: number;
  data: Record<string, unknown>;
}

/** 导出所有 v2 数据为 JSON 触发下载 */
export async function exportAllData(): Promise<void> {
  const keys = [
    V2_KEYS.PAGES, V2_KEYS.PAGE_NAMES, V2_KEYS.CAPTURES, V2_KEYS.CONFIG,
  ];
  const data: Record<string, unknown> = {};
  for (const k of keys) {
    data[k] = await chromeStorageV2.get(k, null);
  }
  const payload: ExportPayload = {
    version: '1.0',
    exportedAt: Date.now(),
    data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date(payload.exportedAt).toISOString().replace(/[:.]/g, '-');
  a.download = `thrilled-export-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  info(MODULE, `数据已导出`, { keys: Object.keys(data) });
}

/** 导入 JSON 文件 */
export async function importDataFile(file: File): Promise<void> {
  try {
    const text = await file.text();
    const payload = JSON.parse(text) as ExportPayload;
    if (typeof payload !== 'object' || payload === null || typeof payload.data !== 'object') {
      throw new Error('非法导出文件结构');
    }
    for (const [k, v] of Object.entries(payload.data)) {
      if (v !== null) {
        await chromeStorageV2.set(k, v);
      }
    }
    info(MODULE, `数据已导入`, { keys: Object.keys(payload.data) });
  } catch (e) {
    warn(MODULE, `导入失败`, { err: (e as Error).message });
    throw e;
  }
}

/** 初始化导出/导入入口 */
export function initExport(): void {
  document.querySelectorAll('[data-setting-action="exportData"]').forEach((btn) => {
    btn.addEventListener('click', () => void exportAllData());
  });
  document.querySelectorAll<HTMLInputElement>('[data-setting-input="importData"]').forEach((input) => {
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file !== undefined) {
        void importDataFile(file).then(() => {
          input.value = '';
        });
      }
    });
  });
}
