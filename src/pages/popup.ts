/**
 * Popup 页面脚本（wiki/11 §11.2）
 *
 * 入口导航：打开新标签页 / 侧边栏。
 * 业务主体在 index.html；popup 不直连 Native Host（红线）。
 */

import { MESSAGE_TYPE } from '../shared/constants';
import { info } from '../lib/logger';

const MODULE = 'popup';
const INDEX_PAGE = 'index.html';

function initPopup(): void {
  const versionEl = document.getElementById('version');
  if (versionEl !== null) {
    versionEl.textContent = `v${chrome.runtime.getManifest().version ?? ''}`;
  }

  document.getElementById('openIndex')?.addEventListener('click', () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL(INDEX_PAGE) });
    info(MODULE, '打开新标签页');
  });

  document.getElementById('openSidePanel')?.addEventListener('click', () => {
    void chrome.runtime.sendMessage({ type: MESSAGE_TYPE.OPEN_SIDE_PANEL });
    info(MODULE, '打开侧边栏');
  });
}

initPopup();
