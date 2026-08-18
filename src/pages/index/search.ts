/**
 * 搜索系统（对齐原版 js/search.js）
 *
 * 建议面板：`#suggestionsHeader`（历史标题 + 清空按钮）+ `#suggestionsList` + `#suggestionsFooter`。
 * 建议来源：搜索历史（去重上限 20）+ 磁贴匹配。
 * 键盘导航：↑/↓ 移动、Enter 执行或选中、Esc 关闭；失焦 200ms 延迟隐藏。
 */

import { debug } from '../../lib/logger';
import {
  LS_KEYS,
  SEARCH_HISTORY_LIMIT,
  SUGGESTION_HISTORY_LIMIT,
} from '../../shared/constants';
import { getEngineById } from '../../shared/types';
import type { EngineId } from '../../shared/types';
import { parseBooleanStr } from '../../shared/guards';
import { state } from './state';
import { localStorageService } from './storage';
import { openUrl } from './link-opener';
import { icon } from './icons';

const MODULE = 'search';

/** 建议项类型 */
export type SuggestionItem =
  | { type: 'history'; text: string }
  | { type: 'tile'; text: string; url: string };

/** 建议面板状态（模块级） */
const suggestionState = {
  items: [] as SuggestionItem[],
  selectedIndex: -1,
  visible: false,
};

/** 搜索相关开关（initSearch 时读取一次，设置变更时通过 updateSearchFlags 更新） */
export const searchFlags = {
  /** 是否显示搜索建议（历史 + 磁贴） */
  suggestions: true,
  /** 搜索后是否保留输入框内容 */
  retain: false,
  /** 是否隐藏搜索按钮 */
  hideBtn: false,
};

/** 更新搜索开关并立即生效 */
export function updateSearchFlags(key: string, value: boolean): void {
  const searchBtn = document.getElementById('searchButton');
  switch (key) {
    case 'search_suggestions':
      searchFlags.suggestions = value;
      // 关闭「显示搜索建议」时立即收起已展开的建议面板
      if (!value) hideSuggestions();
      break;
    case 'search_retain':
      searchFlags.retain = value;
      break;
    case 'search_hide_btn':
      searchFlags.hideBtn = value;
      if (searchBtn !== null) {
        searchBtn.style.display = value ? 'none' : '';
      }
      break;
  }
}

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

/** 构建建议列表（历史 + 磁贴） */
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

/** 处理输入变更：构建建议 */
export function handleSearchInput(query: string): void {
  // 「显示搜索建议」关闭时，不产生任何建议（含历史记录）
  if (!searchFlags.suggestions) {
    suggestionState.items = [];
    suggestionState.selectedIndex = -1;
    hideSuggestions();
    return;
  }

  const items = buildSuggestions(query);
  suggestionState.items = items;
  suggestionState.selectedIndex = -1;
  if (query.trim() !== '' && !suggestionState.visible) {
    suggestionState.visible = true;
  }
  renderSuggestions();
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
        el.id = `suggestion-item-${i}`;
        el.classList.toggle('selected', i === suggestionState.selectedIndex);
        el.setAttribute('role', 'option');
        el.setAttribute('aria-selected', String(i === suggestionState.selectedIndex));
        const iconWrap = document.createElement('span');
        iconWrap.setAttribute('aria-hidden', 'true');
        iconWrap.innerHTML = icon(item.type === 'tile' ? 'link' : 'search', 'dh-icon--sm');
        el.appendChild(iconWrap);
        const text = document.createElement('span');
        if (item.type === 'tile') {
          // 网址来自本地磁贴数据，必须走 textContent，避免通过导入数据注入 HTML
          text.textContent = item.url;
        } else {
          text.textContent = item.text;
        }
        el.appendChild(text);
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

  const visible = searchFlags.suggestions && suggestionState.visible && (suggestionState.items.length > 0 || q !== '');
  panel.classList.toggle('visible', visible);
  panel.classList.toggle('empty', q !== '' && suggestionState.items.length === 0);
  panel.hidden = !visible;
  suggestionState.visible = visible;

  // 更新 combobox ARIA 属性
  const inputEl = document.getElementById('searchInput') as HTMLInputElement | null;
  if (inputEl !== null) {
    inputEl.setAttribute('aria-expanded', String(visible));
    if (visible && suggestionState.selectedIndex >= 0 && suggestionState.selectedIndex < suggestionState.items.length) {
      inputEl.setAttribute('aria-activedescendant', `suggestion-item-${suggestionState.selectedIndex}`);
    } else {
      inputEl.setAttribute('aria-activedescendant', '');
    }
  }
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
  // 未开启「保留搜索内容」时，搜索后清空输入框
  if (!searchFlags.retain) {
    const input = document.getElementById('searchInput') as HTMLInputElement | null;
    if (input !== null) input.value = '';
  }
}

/** 初始化搜索：加载历史 + 绑定事件 */
export function initSearch(): void {
  loadSearchHistory();
  // 读取搜索相关开关（suggestions 默认开启，其余默认关闭）
  const suggestionsRaw = localStorageService.getRaw(LS_KEYS.SEARCH_SUGGESTIONS);
  searchFlags.suggestions = suggestionsRaw === null ? true : parseBooleanStr(suggestionsRaw);
  searchFlags.retain = parseBooleanStr(localStorageService.getRaw(LS_KEYS.SEARCH_RETAIN));
  searchFlags.hideBtn = parseBooleanStr(localStorageService.getRaw(LS_KEYS.SEARCH_HIDE_BTN));

  const input = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchButton');
  if (input === null) return;

  // 隐藏搜索按钮开关
  if (searchFlags.hideBtn && searchBtn !== null) {
    searchBtn.style.display = 'none';
  }

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
