/**
 * 搜索系统（对齐原版 js/search.js）
 *
 * 建议面板：`#suggestionsHeader`（历史标题 + 清空按钮）+ `#suggestionsList` + `#suggestionsFooter`。
 * 建议来源：搜索历史（去重上限 20）+ 磁贴匹配 + Bing 网络联想（防抖）。
 * 键盘导航：↑/↓ 移动、Enter 执行或选中、Esc 关闭；失焦 200ms 延迟隐藏。
 */

import { debug, warn } from '../../lib/logger';
import {
  BING_SUGGESTION_ENDPOINT,
  LS_KEYS,
  SEARCH_HISTORY_LIMIT,
  SUGGESTION_DEBOUNCE_MS,
  SUGGESTION_HISTORY_LIMIT,
} from '../../shared/constants';
import { getEngineById } from '../../shared/types';
import type { EngineId } from '../../shared/types';
import { state } from './state';
import { localStorageService } from './storage';
import { openUrl } from './link-opener';
import { icon } from './icons';

const MODULE = 'search';

/** 建议项类型 */
export type SuggestionItem =
  | { type: 'history'; text: string }
  | { type: 'tile'; text: string; url: string }
  | { type: 'online'; text: string };

/** 建议面板状态（模块级） */
const suggestionState = {
  items: [] as SuggestionItem[],
  selectedIndex: -1,
  visible: false,
};

/* ================= 搜索历史 ================= */

/** 加载搜索历史 */
export function loadSearchHistory(): void {
  state.searchHistory = localStorageService.get<string[]>(LS_KEYS.SEARCH_HISTORY, []);
}

/** 新增搜索历史：去重后 unshift，超限截断（幂等 R6） */
export function addSearchHistory(term: string): void {
  const trimmed = term.trim();
  if (trimmed === '') return;
  const next = [trimmed, ...state.searchHistory.filter((t) => t !== trimmed)];
  state.searchHistory = next.slice(0, SEARCH_HISTORY_LIMIT);
  localStorageService.set(LS_KEYS.SEARCH_HISTORY, state.searchHistory);
}

/** 清除搜索历史 */
export function clearSearchHistory(): void {
  state.searchHistory = [];
  localStorageService.set(LS_KEYS.SEARCH_HISTORY, []);
  renderSuggestions();
}

/* ================= 建议构建 ================= */

/** 构建建议列表（历史 + 磁贴 + 在线） */
export function buildSuggestions(query: string): SuggestionItem[] {
  const q = query.trim();
  const items: SuggestionItem[] = [];

  if (q === '') {
    items.push(...state.searchHistory.slice(0, SUGGESTION_HISTORY_LIMIT).map((t) => ({ type: 'history' as const, text: t })));
    return items;
  }
  items.push(
    ...state.searchHistory
      .filter((t) => t.includes(q))
      .slice(0, SUGGESTION_HISTORY_LIMIT)
      .map((t) => ({ type: 'history' as const, text: t })),
  );
  items.push(
    ...state.currentTiles
      .filter((t) => t.label.includes(q))
      .slice(0, 5)
      .map((t) => ({ type: 'tile' as const, text: t.url, url: t.url })),
  );
  return items;
}

/** 请求 Bing 在线联想（失败降级） */
async function fetchOnlineSuggestions(query: string): Promise<string[]> {
  try {
    const res = await fetch(`${BING_SUGGESTION_ENDPOINT}${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = (await res.json()) as [string, string[]];
    return Array.isArray(data[1]) ? data[1].slice(0, 8) : [];
  } catch {
    warn(MODULE, `Bing 联想词请求失败，降级离线建议`);
    return [];
  }
}

/** 建议面板防抖控制 */
let suggestionDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/** 处理输入变更：构建建议 + 防抖请求在线词 */
export function handleSearchInput(query: string): void {
  const items = buildSuggestions(query);
  suggestionState.items = items;
  suggestionState.selectedIndex = -1;
  if (query.trim() !== '' && !suggestionState.visible) {
    suggestionState.visible = true;
  }
  renderSuggestions();

  if (suggestionDebounceTimer !== null) {
    clearTimeout(suggestionDebounceTimer);
  }
  if (query.trim() !== '') {
    suggestionDebounceTimer = setTimeout(async () => {
      const online = await fetchOnlineSuggestions(query.trim());
      const existing = new Set(suggestionState.items.map((i) => i.text));
      suggestionState.items = [
        ...suggestionState.items,
        ...online.filter((t) => !existing.has(t)).map((t) => ({ type: 'online' as const, text: t })),
      ];
      renderSuggestions();
    }, SUGGESTION_DEBOUNCE_MS);
  }
}

/* ================= 建议渲染（header/list/footer） ================= */

/** 渲染建议面板 */
export function renderSuggestions(): void {
  const panel = document.getElementById('searchSuggestions');
  const list = document.getElementById('suggestionsList');
  const header = document.getElementById('suggestionsHeader');
  const footer = document.getElementById('suggestionsFooter');
  if (panel === null) return;

  const q = (document.getElementById('searchInput') as HTMLInputElement | null)?.value.trim() ?? '';

  // Header：历史记录标题 + 清空按钮（仅空查询且有历史时）
  if (header !== null) {
    header.textContent = '';
    if (q === '' && state.searchHistory.length > 0) {
      const label = document.createElement('span');
      label.className = 'suggestions-header-label';
      label.textContent = '历史记录';
      const clearBtn = document.createElement('button');
      clearBtn.className = 'suggestions-clear-btn';
      clearBtn.setAttribute('aria-label', '清空搜索历史');
      clearBtn.innerHTML = icon('trash', 'dh-icon--sm');
      clearBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearSearchHistory();
        document.getElementById('searchInput')?.focus();
      });
      header.appendChild(label);
      header.appendChild(clearBtn);
    }
  }

  // List
  if (list !== null) {
    list.replaceChildren();
    if (suggestionState.items.length === 0 && q !== '') {
      const empty = document.createElement('div');
      empty.className = 'suggestion-empty';
      empty.textContent = `未找到“${q}”的匹配项`;
      list.appendChild(empty);
    } else {
      suggestionState.items.forEach((item, i) => {
        const el = document.createElement('div');
        el.className = 'suggestion-item';
        el.classList.toggle('selected', i === suggestionState.selectedIndex);
        el.setAttribute('role', 'option');
        el.setAttribute('aria-selected', String(i === suggestionState.selectedIndex));
        if (item.type === 'tile') {
          el.innerHTML = `${icon('link', 'dh-icon--sm')}<span>${item.url}</span>`;
        } else {
          el.innerHTML = `${icon('search', 'dh-icon--sm')}<span>${escapeHtml(item.text)}</span>`;
        }
        el.addEventListener('click', () => selectSuggestion(i));
        list.appendChild(el);
      });
    }
  }

  // Footer：当前引擎名
  if (footer !== null) {
    footer.textContent = '';
    const engine = getEngineById(state.engine);
    if (engine !== null && q !== '') {
      const span = document.createElement('span');
      span.textContent = `按 Enter 使用 ${engine.name} 搜索`;
      footer.appendChild(span);
    }
  }

  const visible = suggestionState.visible && suggestionState.items.length > 0;
  panel.classList.toggle('visible', visible);
  panel.classList.toggle('empty', q !== '' && suggestionState.items.length === 0);
  suggestionState.visible = visible;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

/** 显示/隐藏建议面板 */
export function showSuggestions(): void {
  suggestionState.visible = true;
  renderSuggestions();
}

export function hideSuggestions(): void {
  suggestionState.visible = false;
  renderSuggestions();
}

/** 选择建议项 */
export function selectSuggestion(index: number): void {
  const item = suggestionState.items[index];
  if (item === undefined) return;
  if (item.type === 'tile') {
    void openUrl(item.url, { type: 'tiles' });
  } else {
    void executeSearch(item.text);
  }
}

/** 键盘导航：上下移动 */
export function navigateSuggestions(direction: -1 | 1): void {
  if (suggestionState.items.length === 0) return;
  const next = suggestionState.selectedIndex + direction;
  suggestionState.selectedIndex = next < 0 ? suggestionState.items.length - 1 : next >= suggestionState.items.length ? 0 : next;
  renderSuggestions();
}

/* ================= 搜索执行 ================= */

/** 执行搜索 */
export async function executeSearch(query: string, engineId?: EngineId): Promise<void> {
  const q = query.trim();
  if (q === '') return;
  const engine = getEngineById(engineId ?? state.engine);
  if (engine === null) return;
  addSearchHistory(q);
  hideSuggestions();
  await openUrl(`${engine.base}${encodeURIComponent(q)}`, { type: 'search' });
}

/** 初始化搜索：加载历史 + 绑定事件 */
export function initSearch(): void {
  loadSearchHistory();
  const input = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchButton');
  if (input === null) return;

  input.addEventListener('input', () => handleSearchInput((input as HTMLInputElement).value));
  input.addEventListener('focus', () => renderSuggestions());
  input.addEventListener('blur', () => {
    setTimeout(() => {
      const active = document.activeElement;
      if (active === null || active.closest('.suggestion-item') === null) hideSuggestions();
    }, 200);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateSuggestions(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateSuggestions(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = suggestionState.items[suggestionState.selectedIndex];
      if (selected !== undefined) {
        selectSuggestion(suggestionState.selectedIndex);
      } else {
        void executeSearch((input as HTMLInputElement).value);
      }
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  });
  searchBtn?.addEventListener('click', () => {
    void executeSearch((input as HTMLInputElement).value);
  });
  debug(MODULE, '搜索初始化完成');
}
