/**
 * 新标签页启动入口
 *
 * Phase 0：主题（0 开销）
 * Phase 1：数据加载（设置/磁贴）
 * Phase 2：首屏渲染（引擎/磁贴/分类/搜索/背景/倒计时/问候/天气/设置面板）
 */

import { info } from '../../lib/logger';
import { LS_KEYS, SHORTCUT_SIZE_OPTIONS } from '../../shared/constants';
import { initTheme, getColorScheme } from './theme-manager';
import { dataService, localStorageService } from './storage';
import { state } from './state';
import { tileManager, renderTiles, attachTileDrag, clearSelection, toggleEditMode } from './tiles';
import { renderCatRow, handleWheelScroll, attachCategoryDrag } from './category-ui';
import { initSearch } from './search';
import { bindEngineSelector, initEngineUI } from './navigation';
import { initWallpaper } from './wallpaper';
import { initCountdown } from './countdown';
import { initDailyGreetingCard } from './daily-greeting';
import { initWeather } from './weather';
import { initSettingsPanel } from './settings-panel';
import { initExport, exportAllData } from './export';
import { initFileConfig } from './file-config';
import { initIconHydrate } from './icon-hydrate';
import { initOnboarding } from './onboarding';
import { resetAllData } from './reset';
import { bindGlobalEvents } from '../events';

const MODULE = 'main';

/** 应用快捷方式尺寸（CSS 变量） */
function applyShortcutSize(): void {
  const cfg = SHORTCUT_SIZE_OPTIONS[state.settings.shortcutSize];
  const root = document.documentElement;
  root.style.setProperty('--shortcut-container', `${cfg.size}px`);
  root.style.setProperty('--shortcut-icon', `${cfg.icon}px`);
  root.style.setProperty('--shortcut-gap', `${cfg.gap}px`);
  root.style.setProperty('--shortcut-radius', `${cfg.radius}px`);
  root.style.setProperty('--shortcut-label-size', `${cfg.fontSize}px`);
  if (state.settings.shortcutColumns !== 'auto') {
    root.style.setProperty('--shortcut-columns', String(Number(state.settings.shortcutColumns)));
  }
}

/** 启动序列 */
export async function boot(): Promise<void> {
  // Phase 0：主题
  initTheme();
  info(MODULE, '主题初始化', { scheme: getColorScheme() });

  // 减少动画开关：给 body 添加 reduce-motion 类
  if (localStorageService.getRaw(LS_KEYS.ANIM_REDUCE) === 'true') {
    document.body.classList.add('reduce-motion');
  }

  // Phase 1：数据加载
  const settings = await dataService.getSettings();
  state.settings = settings;
  state.engine = settings.engine;
  state.currentPage = settings.categoryMemory ? settings.lastPage : 0;
  await tileManager.load();
  info(MODULE, 'Phase 1 数据加载完成', { pages: state.totalPages, engine: state.engine });

  // Phase 2：首屏渲染
  applyShortcutSize();
  initEngineUI();
  renderTiles();
  renderCatRow();
  initSearch();
  // 自动聚焦开关：启动时聚焦搜索框
  if (state.settings.autoFocus) {
    document.getElementById('searchInput')?.focus();
  }
  initWallpaper();
  initCountdown();
  initDailyGreetingCard();
  initWeather();
  initSettingsPanel();
  initExport();
  initFileConfig();
  initIconHydrate();
  bindGlobalEvents();
  info(MODULE, 'Phase 2 渲染完成');

  // Phase 2.5：首次初始化引导
  void initOnboarding();

  // Phase 3：全局事件
  bindEvents();

  // Phase 4：全局快捷键
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      void exportAllData();
    }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      void resetAllData();
    }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      toggleEditMode();
    }
  });

  info(MODULE, 'boot 完成');
}

/** 绑定全局交互事件 */
function bindEvents(): void {
  const tilesContainer = document.getElementById('tilesContainer');
  if (tilesContainer !== null) attachTileDrag(tilesContainer);

  const catRow = document.getElementById('catRow');
  if (catRow !== null) attachCategoryDrag(catRow);

  // 滚轮翻页：限定在磁贴容器区域，避免设置面板/下拉框滚动误触翻页
  if (tilesContainer !== null) {
    tilesContainer.addEventListener('wheel', (e) => {
      handleWheelScroll(e);
    });
  }

  // 引擎选择器
  const selector = document.getElementById('engineSelector');
  if (selector !== null) bindEngineSelector(selector);
  // 点击引擎下拉外部关闭
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('#engineSelector') === null && target.closest('#engineDropdown') === null) {
      document.getElementById('engineDropdown')?.classList.remove('visible');
    }
  });

  // 点击空白区域清除批量选择
  document.addEventListener('click', (e) => {
    if (state.selectedTileIds.size === 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.tile, .batch-action-bar') !== null) return;
    clearSelection();
  });

  info(MODULE, 'Phase 3 事件绑定完成');
}

void boot();
