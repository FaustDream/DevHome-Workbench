/**
 * 剪藏分类器（纯逻辑，无 chrome.* / 无 DOM，可单测）
 *
 * 网页剪藏时的自动分类：
 * - 根据选区文本关键词识别笔记类型（note/idea/bug/meeting）
 * - 从来源 URL 提取主域名作为标签
 * - 附加创建日期标签（YYYY-MM-DD）
 * @see wiki/10 §10.5.2 剪藏流程 / wiki/02 §2.7.2 捕获数据模型
 */

/** 剪藏可识别类型（仅分类器内部使用，原 NoteType 已被移除） */
type CaptureAssignedType = 'meeting' | 'bug' | 'idea' | 'note';

/** 剪藏类型识别关键词表（R9/R14：单一来源，集中定义） */
const TYPE_KEYWORDS: Readonly<Array<{ type: CaptureAssignedType; keywords: readonly string[] }>> = [
  { type: 'meeting', keywords: ['会议', 'meeting', '议程', 'agenda', '周会', '同步会', '总结会', 'standup'] },
  { type: 'bug', keywords: ['bug', 'error', '报错', '异常', '崩溃', 'issue', '缺陷', '修复', '排查'] },
  { type: 'idea', keywords: ['想法', 'idea', '灵感', '创意', '建议', '规划', '构思', 'brainstorm'] },
];

/** 匹配关键词，返回对应类型（未命中返回 'note'） */
export function classifyCaptureType(text: string): CaptureAssignedType {
  for (const rule of TYPE_KEYWORDS) {
    if (rule.keywords.some((k) => text.toLowerCase().includes(k))) return rule.type;
  }
  return 'note';
}

/** 从 URL 提取主域名（非 http(s) 或非法 URL 返回 ''） */
export function extractHostname(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.hostname;
  } catch {
    return '';
  }
}

/** 当前日期 YYYY-MM-DD */
export function todayTag(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** 构造剪藏标签：创建日期 + 来源域名（去重保序） */
export function buildCaptureTags(url: string, now: Date = new Date()): string[] {
  const tags = [todayTag(now)];
  const host = extractHostname(url);
  if (host !== '' && !tags.includes(host)) tags.push(host);
  return tags;
}
