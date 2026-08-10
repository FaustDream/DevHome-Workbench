/**
 * 新标签页启动入口（对齐原版 main.js boot + 原版 DOM 结构）
 *
 * Phase 0：主题（0 开销）
 * Phase 1：数据加载（设置/磁贴/存储监听）
 * Phase 2：首屏渲染（引擎/磁贴/分类/搜索/背景/倒计时/问候/天气/设置面板/右键菜单）
 */

import { info } from '../../lib/logger';
import { SHORTCUT_SIZE_OPTIONS } from '../../shared/constants';
import { initTheme, getColorScheme } from './theme-manager';
import { initStorageWatch, dataService } from './storage';
import { state } from './state';
import { tileManager, renderTiles, attachTileDrag } from './tiles';
import { renderCatRow, handleWheelScroll, attachCategoryDrag } from './category-ui';
import { initSearch } from './search';
import { bindEngineSelector, initEngineUI } from './navigation';
import { initWallpaper } from './wallpaper';
import { initCountdown } from './countdown';
import { initDailyGreetingCard } from './daily-greeting';
import { initWeather } from './weather';
import { initSettingsPanel } from './settings-panel';
import { initContextMenus } from './context-menu';
import { initExport, exportAllData } from './export';
import { initFileConfig } from './file-config';
import { initIconHydrate } from './icon-hydrate';
import { initOnboarding } from './onboarding';
import { resetAllData } from './reset';
import { bindGlobalEvents } from '../events';

const MODULE = 'main';

/** 应用快捷方式尺寸（CSS 变量，对齐原版 --shortcut-*） */
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

  // Phase 1：数据加载
  initStorageWatch();
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
  initWallpaper();
  initCountdown();
  initDailyGreetingCard();
  initWeather();
  initSettingsPanel();
  initContextMenus();
  initExport();
  initFileConfig();
  initIconHydrate();
  bindGlobalEvents();
  info(MODULE, 'Phase 2 渲染完成');

  // Phase 2.5：首次初始化引导（弹窗询问收藏夹 → 生成分类磁贴）
  // 注意：必须在渲染完成后调用（依赖 state.totalPages 已就绪）
  void initOnboarding();

  // Phase 3：全局事件
  bindEvents();

  // Phase 4：全局快捷键
  document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+E 导出数据
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      void exportAllData();
    }
    // Ctrl+Shift+R 重置所有数据到出厂状态
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      void resetAllData();
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

  // 滚轮翻页
  document.addEventListener('wheel', (e) => {
    handleWheelScroll(e);
  });

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

  info(MODULE, 'Phase 3 事件绑定完成');
}

void boot();
