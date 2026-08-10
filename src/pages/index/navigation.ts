/**
 * 导航与搜索引擎（对齐原版 js/search.js 引擎选择器）
 *
 * 引擎选择器：`#currentEngine`（引擎图标 + 名称 + chevron）点击 → body 级 `#engineDropdown`
 * 显示；`.engine-option[data-engine]` 点击 → 切换引擎并更新 UI。
 * 引擎图标：`#dhIconSprite` 中的 `dh-icon-<engine.icon>` symbol。
 */

import { info } from '../../lib/logger';
import { LS_KEYS } from '../../shared/constants';
import { ENGINES, getEngineById } from '../../shared/types';
import type { EngineId } from '../../shared/types';
import { isEngineId } from '../../shared/guards';
import { state } from './state';
import { localStorageService } from './storage';
import { icon } from './icons';

const MODULE = 'navigation';

/** 读取持久化引擎（启动恢复） */
export function loadEngine(): EngineId {
  const raw = localStorageService.getRaw(LS_KEYS.ENGINE);
  if (raw !== null && isEngineId(raw)) {
    state.engine = raw;
    return raw;
  }
  return state.engine;
}

/** 切换引擎：持久化 + 更新 UI */
export function setEngine(id: EngineId): void {
  if (!isEngineId(id)) return;
  state.engine = id;
  localStorageService.setRaw(LS_KEYS.ENGINE, id);
  updateCurrentEngine();
  info(MODULE, `引擎切换`, { id });
}

/** 初始化引擎选择器 UI（启动时调用，从 ENGINES 动态生成下拉项） */
export function initEngineUI(): void {
  const dropdown = document.getElementById('engineDropdown');
  if (dropdown !== null) {
    dropdown.replaceChildren();
    for (const eng of ENGINES) {
      const opt = document.createElement('div');
      opt.className = 'engine-option';
      opt.dataset.engine = eng.id;
      opt.innerHTML = `${icon(eng.iconName ?? eng.id, 'dh-icon--md')}<span>${eng.name}</span>`;
      opt.addEventListener('click', () => {
        if (isEngineId(eng.id)) {
          setEngine(eng.id);
          hideEngineDropdown();
        }
      });
      dropdown.appendChild(opt);
    }
  }
  updateCurrentEngine();
}

/** 更新引擎选择器按钮（图标 + 名称） */
function updateCurrentEngine(): void {
  const current = document.getElementById('currentEngine');
  const engine = getEngineById(state.engine);
  if (current === null || engine === null) return;
  const iconEl = current.querySelector('.engine-icon-placeholder');
  if (iconEl !== null) {
    iconEl.innerHTML = icon(engine.iconName ?? engine.id, 'dh-icon--md');
  }
  const nameEl = current.querySelector<HTMLElement>('span:nth-child(2)');
  if (nameEl !== null) {
    nameEl.textContent = engine.name;
  }
}

/** 引擎下拉是否可见 */
export function isEngineDropdownVisible(): boolean {
  const dropdown = document.getElementById('engineDropdown');
  return dropdown !== null && dropdown.classList.contains('visible');
}

/** 显示引擎下拉（定位到引擎选择器正下方，对齐原版） */
export function showEngineDropdown(): void {
  const dropdown = document.getElementById('engineDropdown');
  const selector = document.getElementById('engineSelector');
  if (dropdown === null || selector === null) return;
  const rect = selector.getBoundingClientRect();
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.top = `${rect.bottom + 6}px`;
  dropdown.classList.add('visible');
  selector.classList.add('active');
}

/** 隐藏引擎下拉 */
export function hideEngineDropdown(): void {
  const dropdown = document.getElementById('engineDropdown');
  const selector = document.getElementById('engineSelector');
  dropdown?.classList.remove('visible');
  selector?.classList.remove('active');
}

/** 绑定引擎选择器事件（点击切换下拉） */
export function bindEngineSelector(selectorEl: HTMLElement): void {
  selectorEl.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.engine-option') !== null) return;
    e.stopPropagation();
    if (isEngineDropdownVisible()) {
      hideEngineDropdown();
    } else {
      showEngineDropdown();
    }
  });
}

/** 数字键 1-N 快速切换引擎（global-events 调用） */
export function switchEngineByNumber(n: number): void {
  const engine = ENGINES[n - 1];
  if (engine !== undefined) {
    setEngine(engine.id);
  }
}
