/**
 * 倒计时卡片（对齐原版 js/countdown.js + css/countdown.css）
 *
 * 容器 `#countdownRoot` 动态创建并挂到 body（原版行为）。
 * 卡片结构：`countdown-card > countdown-title(icon+text) / countdown-days / countdown-label /
 * countdown-progress / countdown-target-date / countdown-delete-btn`。
 * 每分钟刷新（天级精度）。
 */

import { calcCountdown } from '../../lib/utils';
import { COUNTDOWN_REFRESH_INTERVAL_MS, RAW_KEYS } from '../../shared/constants';
import type { CountdownItem } from '../../shared/types';

/** 读取倒计时列表（校验结构，R20） */
export function getCountdowns(): CountdownItem[] {
  try {
    const raw = localStorage.getItem(RAW_KEYS.COUNTDOWNS);
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCountdownItem);
  } catch {
    return [];
  }
}

function isCountdownItem(v: unknown): v is CountdownItem {
  if (typeof v !== 'object' || v === null) return false;
  const item = v as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.targetDate === 'string' &&
    typeof item.createdAt === 'string'
  );
}

/** 保存倒计时列表 */
export function saveCountdowns(items: readonly CountdownItem[]): void {
  localStorage.setItem(RAW_KEYS.COUNTDOWNS, JSON.stringify(items));
}

/** 删除倒计时 */
export function deleteCountdown(id: string): void {
  const next = getCountdowns().filter((c) => c.id !== id);
  saveCountdowns(next);
  refreshCountdownUI();
}

/** 渲染单个倒计时卡片（对齐原版 DOM） */
function renderCountdownCard(cd: CountdownItem): HTMLElement {
  const card = document.createElement('div');
  card.className = 'countdown-card';
  card.dataset.countdownId = cd.id;

  const result = calcCountdown(cd);

  // 标题行：icon + 文本
  const titleEl = document.createElement('div');
  titleEl.className = 'countdown-title';
  const iconEl = document.createElement('span');
  iconEl.className = 'countdown-title-icon';
  iconEl.textContent = result.isOverdue ? '\u23F0' : '\u2728';
  const titleText = document.createElement('span');
  titleText.textContent = cd.title;
  titleEl.appendChild(iconEl);
  titleEl.appendChild(titleText);
  card.appendChild(titleEl);

  if (result.isOverdue) {
    const daysEl = document.createElement('div');
    daysEl.className = 'countdown-days overdue';
    daysEl.textContent = '已过期';
    card.appendChild(daysEl);
    const badge = document.createElement('div');
    badge.className = 'countdown-overdue-badge';
    badge.textContent = '\u26A0\uFE0F ' + formatTargetDate(cd.targetDate);
    card.appendChild(badge);
  } else {
    const daysEl = document.createElement('div');
    daysEl.className = 'countdown-days';
    daysEl.textContent = String(result.days);
    card.appendChild(daysEl);
    const labelEl = document.createElement('div');
    labelEl.className = 'countdown-label';
    labelEl.textContent = result.days === 0 ? '就在今天！' : '天后';
    card.appendChild(labelEl);
    if (!result.isToday) {
      const progressWrap = document.createElement('div');
      progressWrap.className = 'countdown-progress';
      const bar = document.createElement('div');
      bar.className = 'countdown-progress-bar';
      bar.style.width = `${result.progress}%`;
      progressWrap.appendChild(bar);
      card.appendChild(progressWrap);
    }
  }

  const dateEl = document.createElement('div');
  dateEl.className = 'countdown-target-date';
  dateEl.textContent = '目标：' + formatTargetDate(cd.targetDate);
  card.appendChild(dateEl);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'countdown-delete-btn';
  deleteBtn.innerHTML = '&#x2715;';
  deleteBtn.title = '删除此倒计时';
  deleteBtn.setAttribute('aria-label', `删除倒计时 ${cd.title}`);
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteCountdown(cd.id);
  });
  card.appendChild(deleteBtn);

  return card;
}

/** 目标日期格式化 YYYY-MM-DD → YYYY/M/D */
function formatTargetDate(targetDate: string): string {
  return targetDate.replace(/-/g, '/');
}

/** 刷新倒计时 UI */
function refreshCountdownUI(): void {
  const root = document.getElementById('countdownRoot');
  if (root === null) return;
  const list = getCountdowns();
  root.replaceChildren();
  for (const cd of list) {
    root.appendChild(renderCountdownCard(cd));
  }
}

/** 初始化倒计时：动态创建容器 + 渲染 + 每分钟刷新 */
export function initCountdown(): void {
  let root = document.getElementById('countdownRoot');
  if (root === null) {
    root = document.createElement('div');
    root.id = 'countdownRoot';
    document.body.appendChild(root);
  }
  refreshCountdownUI();
  setInterval(refreshCountdownUI, COUNTDOWN_REFRESH_INTERVAL_MS);
}
