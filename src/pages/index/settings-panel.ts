/**
 * 设置面板（对齐原版 js/ui/_settings-panel.js + index.html #settingsOverlay）
 *
 * - 打开/关闭：`#settingsGearBtn` / `#settingsCloseBtn` / 遮罩点击
 * - Tab 切换：`.s-nav-item[data-s-tab]` ↔ `.s-tab[data-s-tab]`
 * - 开关：`.s-toggle input` 读写对应存储键并更新 state
 * - 分段控件：磁贴大小/每排数量 → CSS 变量
 * - 主题卡片：`.s-theme-card[data-scheme]`
 * - 滑块：搜索框宽度/圆角/不透明度 → CSS 变量；背景滑块由 wallpaper.ts 接管
 */

import { info } from '../../lib/logger';
import { LS_KEYS, RAW_KEYS, SHORTCUT_SIZE_OPTIONS } from '../../shared/constants';
import { isShortcutColumns, isShortcutSize } from '../../shared/guards';
import type { ShortcutColumns, ShortcutSize } from '../../shared/types';
import { state } from './state';
import { localStorageService } from './storage';
import { setColorScheme } from './theme-manager';
import { showConfirm } from './dialogs';
import { resetAllData } from './reset';

const MODULE = 'settings-panel';

/** 开关控件 id → 存储键映射（原版命名） */
const TOGGLE_MAP: Readonly<Record<string, { key: string; defaultVal: boolean }>> = {
  sToggleAutoFocus: { key: LS_KEYS.AUTO_FOCUS, defaultVal: false },
  sToggleCategoryMemory: { key: LS_KEYS.CATEGORY_MEMORY, defaultVal: true },
  sToggleNewTabTiles: { key: LS_KEYS.LINK_NEW_TAB_TILES, defaultVal: true },
  sToggleNewTabSearch: { key: LS_KEYS.LINK_NEW_TAB_SEARCH, defaultVal: true },
  searchSuggestionsToggle: { key: LS_KEYS.SEARCH_SUGGESTIONS, defaultVal: true },
  searchRetainToggle: { key: LS_KEYS.SEARCH_RETAIN, defaultVal: false },
  searchHideBtnToggle: { key: LS_KEYS.SEARCH_HIDE_BTN, defaultVal: false },
  animReduceToggle: { key: LS_KEYS.ANIM_REDUCE, defaultVal: false },
  sToggleCatRow: { key: LS_KEYS.CAT_ROW, defaultVal: true },
};

/** 打开设置面板 */
export function openSettings(): void {
  const overlay = document.getElementById('settingsOverlay');
  overlay?.classList.add('visible');
  syncAllControls();
}

/** 关闭设置面板 */
export function closeSettings(): void {
  const overlay = document.getElementById('settingsOverlay');
  overlay?.classList.remove('visible');
}

/** 面板是否打开 */
export function isSettingsOpen(): boolean {
  const overlay = document.getElementById('settingsOverlay');
  return overlay !== null && overlay.classList.contains('visible');
}

/** 同步所有控件状态（从存储读取） */
function syncAllControls(): void {
  for (const [toggleId, cfg] of Object.entries(TOGGLE_MAP)) {
    const el = document.getElementById(toggleId) as HTMLInputElement | null;
    if (el !== null) {
      const raw = localStorageService.getRaw(cfg.key);
      el.checked = raw === null ? cfg.defaultVal : raw !== 'false';
    }
  }
  syncShortcutControls();
  syncThemeCards();
}

/** 同步磁贴大小/列数分段控件 */
function syncShortcutControls(): void {
  const sizeBtns = document.querySelectorAll<HTMLElement>('[data-shortcut-size]');
  sizeBtns.forEach((b) => {
    b.classList.toggle('active', b.dataset.shortcutSize === state.settings.shortcutSize);
  });
  const colBtns = document.querySelectorAll<HTMLElement>('[data-shortcut-columns]');
  colBtns.forEach((b) => {
    b.classList.toggle('active', b.dataset.shortcutColumns === state.settings.shortcutColumns);
  });
}

/** 同步主题卡片高亮 */
function syncThemeCards(): void {
  const scheme = localStorageService.getRaw(RAW_KEYS.THEME_CARD) ?? 'auto';
  document.querySelectorAll<HTMLElement>('.s-theme-card').forEach((c) => {
    c.classList.toggle('active', c.dataset.scheme === scheme);
  });
}

/** 应用磁贴尺寸 */
function applyShortcutSize(size: ShortcutSize): void {
  state.settings.shortcutSize = size;
  const cfg = SHORTCUT_SIZE_OPTIONS[size];
  const root = document.documentElement;
  root.style.setProperty('--shortcut-container', `${cfg.size}px`);
  root.style.setProperty('--shortcut-icon', `${cfg.icon}px`);
  root.style.setProperty('--shortcut-gap', `${cfg.gap}px`);
  root.style.setProperty('--shortcut-radius', `${cfg.radius}px`);
  root.style.setProperty('--shortcut-label-size', `${cfg.fontSize}px`);
  localStorageService.setRaw(LS_KEYS.SHORTCUT_SIZE, size);
}

/** 应用磁贴列数 */
function applyShortcutColumns(cols: ShortcutColumns): void {
  state.settings.shortcutColumns = cols;
  document.documentElement.style.setProperty('--shortcut-columns', String(cols === 'auto' ? 6 : Number(cols)));
  localStorageService.setRaw(LS_KEYS.SHORTCUT_COLUMNS, cols);
}

/** 初始化设置面板 */
export function initSettingsPanel(): void {
  const overlay = document.getElementById('settingsOverlay');
  const gearBtn = document.getElementById('settingsGearBtn');
  const closeBtn = document.getElementById('settingsCloseBtn');

  gearBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isSettingsOpen()) closeSettings();
    else openSettings();
  });
  closeBtn?.addEventListener('click', closeSettings);
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeSettings();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSettingsOpen()) closeSettings();
  });

  // Tab 切换
  const nav = document.getElementById('sNav');
  nav?.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.s-nav-item');
    if (item === null) return;
    const tab = item.dataset.sTab;
    if (tab === undefined) return;
    nav.querySelectorAll('.s-nav-item').forEach((n) => n.classList.toggle('active', n === item));
    document.querySelectorAll('.s-tab').forEach((t) => t.classList.toggle('active', t.getAttribute('data-s-tab') === tab));
  });

  // 开关绑定
  for (const [toggleId, cfg] of Object.entries(TOGGLE_MAP)) {
    const el = document.getElementById(toggleId) as HTMLInputElement | null;
    el?.addEventListener('change', () => {
      localStorageService.setRaw(cfg.key, String(el.checked));
      info(MODULE, `设置变更`, { key: cfg.key, value: el.checked });
    });
  }

  // 分段控件：磁贴大小
  document.querySelectorAll<HTMLElement>('[data-shortcut-size]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const size = btn.dataset.shortcutSize;
      if (size !== undefined && isShortcutSize(size)) {
        applyShortcutSize(size);
        syncShortcutControls();
      }
    });
  });

  // 分段控件：每排数量
  document.querySelectorAll<HTMLElement>('[data-shortcut-columns]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cols = btn.dataset.shortcutColumns;
      if (cols !== undefined && isShortcutColumns(cols)) {
        applyShortcutColumns(cols);
        syncShortcutControls();
      }
    });
  });

  // 主题卡片
  document.querySelectorAll<HTMLElement>('.s-theme-card').forEach((card) => {
    card.addEventListener('click', () => {
      const scheme = card.dataset.scheme;
      if (scheme === undefined) return;
      localStorageService.setRaw(RAW_KEYS.THEME_CARD, scheme);
      if (scheme === 'light' || scheme === 'dark') {
        setColorScheme(scheme);
      }
      syncThemeCards();
    });
  });

  // 搜索框设置滑块
  bindSlider('searchWidthSlider', 'searchWidthValue', (v) => {
    document.documentElement.style.setProperty('--search-width', `${v}px`);
  });
  bindSlider('searchRadiusSlider', 'searchRadiusValue', (v) => {
    document.documentElement.style.setProperty('--search-radius', `${v}px`);
  });
  bindSlider('searchOpacitySlider', 'searchOpacityValue', (v) => {
    document.documentElement.style.setProperty('--search-opacity', String(v / 100));
  });

  // 高级 Tab：全部数据重置按钮
  document.querySelectorAll('[data-setting-action="resetSettings"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      void showConfirm('确定要重置所有数据到出厂状态吗？此操作不可撤销。', {
        title: '重置所有数据',
        iconType: 'warning',
        danger: true,
        confirmText: '重置',
      }).then((ok) => {
        if (ok) {
          void resetAllData();
        }
      });
    });
  });
}

/** 滑块绑定（实时更新值标签） */
function bindSlider(sliderId: string, valueId: string, apply: (v: number) => void): void {
  const slider = document.getElementById(sliderId) as HTMLInputElement | null;
  const valueEl = document.getElementById(valueId);
  if (slider === null) return;
  slider.addEventListener('input', () => {
    const v = Number(slider.value);
    apply(v);
    if (valueEl !== null) valueEl.textContent = String(v);
  });
}
