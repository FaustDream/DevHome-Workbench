/**
 * Service Worker 入口（wiki/01 §1.9）
 *
 * - onInstalled：创建右键菜单「剪藏到新标签页」
 * - onMessage：判别联合路由（isExtensionRequest 守卫 + 穷尽 switch + never 兜底）
 * - 右键剪藏：选区保存至 v2/captures + 系统通知
 */

import { error, info, warn } from '../lib/logger';
import { BusinessError } from '../lib/errors';
import { countWords, createId } from '../lib/utils';
import { buildCaptureTags } from '../lib/capture-classifier';
import {
  CAPTURE_LIMIT,
  MESSAGE_TYPE,
  NOTIFICATION_MESSAGE_MAX,
  V2_KEYS,
} from '../shared/constants';
import {
  errResponse,
  okResponse,
  UNKNOWN_MESSAGE_REASON,
} from '../shared/messages';
import type { ExtensionRequest, ExtensionResponse } from '../shared/messages';
import type { CaptureItem } from '../shared/types';
import { isExtensionRequest } from '../shared/guards';
import { resolveRealFavicon } from './favicon-resolver';

const MODULE = 'background';
/** 剪藏右键菜单 id */
const CLIP_MENU_ID = 'clip-to-workbench';

/* ================= 生命周期 ================= */

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CLIP_MENU_ID,
    title: '剪藏到新标签页',
    contexts: ['selection'],
  });
  info(MODULE, '扩展已安装，右键菜单已创建');
});

/* ================= 消息路由（R3） ================= */

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse: (res: ExtensionResponse) => void) => {
    void routeMessage(message)
      .then(sendResponse)
      .catch((e: unknown) => {
        error(MODULE, '消息处理失败', e);
        sendResponse(errResponse('internal_error'));
      });
    return true; // 异步响应
  },
);

async function routeMessage(message: unknown): Promise<ExtensionResponse> {
  if (!isExtensionRequest(message)) {
    return errResponse(UNKNOWN_MESSAGE_REASON);
  }
  const req: ExtensionRequest = message;

  switch (req.type) {
    case MESSAGE_TYPE.OPEN_SIDE_PANEL:
      await openSidePanel();
      return okResponse();
    case MESSAGE_TYPE.RESOLVE_FAVICON: {
      const dataUrl = await resolveRealFavicon(req.data.domain);
      if (dataUrl === null) return errResponse('favicon_not_found');
      return okResponse(dataUrl);
    }
    default: {
      const exhaustive: never = req;
      throw new BusinessError('MESSAGE_UNKNOWN_TYPE', '未预期的消息类型', { exhaustive });
    }
  }
}

/** 打开侧边栏（需要 tabId） */
async function openSidePanel(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id !== undefined) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  } catch {
    warn(MODULE, '侧边栏打开失败（需 sidePanel API）');
  }
}

/* ================= 右键剪藏 ================= */

chrome.contextMenus.onClicked.addListener(async (clickData, tab) => {
  if (clickData.menuItemId !== CLIP_MENU_ID || tab?.id === undefined) return;
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() ?? '',
    });
    const text = result?.result ?? '';
    const trimmed = text.trim();
    if (trimmed === '') return;
    const sourceUrl = tab.url ?? '';
    const sourceTitle = tab.title ?? '';
    const capture: CaptureItem = {
      id: createId('cap'),
      content: trimmed,
      wordCount: countWords(trimmed),
      tags: buildCaptureTags(sourceUrl),
      sourceUrl,
      sourceTitle,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await chrome.storage.local.get(v2Key(V2_KEYS.CAPTURES)).then(async (res) => {
      const raw = res[v2Key(V2_KEYS.CAPTURES)];
      const list = Array.isArray(raw) ? raw : [];
      await chrome.storage.local.set({ [v2Key(V2_KEYS.CAPTURES)]: [capture, ...list].slice(0, CAPTURE_LIMIT) });
    });
    await chrome.notifications.create('clip-saved', {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '已剪藏',
      message: trimmed.length > NOTIFICATION_MESSAGE_MAX ? `${trimmed.slice(0, NOTIFICATION_MESSAGE_MAX)}…` : trimmed,
      priority: 1,
    });
    info(MODULE, '剪藏成功', { sourceTitle: sourceTitle.slice(0, 40), wordCount: capture.wordCount });
  } catch (e) {
    error(MODULE, '剪藏失败', e);
  }
});

function v2Key(key: string): string {
  return `v2/${key}`;
}

info(MODULE, 'Service Worker 就绪');
