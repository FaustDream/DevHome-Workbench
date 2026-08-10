/**
 * 背景管理（对齐原版 js/bgManager.js）
 *
 * - 存储：`bg` = `{ type: 'image'|'video', data: dataURL }`；`wallpaperSettings` = `{ blur, overlay }`
 * - 上传入口：设置面板「背景」区块（uploadBg → #bgInput 隐藏输入）
 * - 图片压缩到 1920px 宽；视频/图片上限 5MB
 * - 应用：`#bgImage` src + `--bg-blur` CSS 变量 + `#bgOverlay` 遮罩
 */

import { warn } from '../../lib/logger';
import { clamp } from '../../lib/utils';
import { WALLPAPER_JPEG_QUALITY, WALLPAPER_MAX_WIDTH } from '../../shared/constants';
import type { WallpaperSettings } from '../../shared/types';

const MODULE = 'wallpaper';
/** 背景存储键（对齐原版） */
const BG_STORAGE_KEY = 'bg';
/** 壁纸设置存储键（对齐原版） */
const WALLPAPER_SETTINGS_KEY = 'wallpaperSettings';
/** 上传大小上限 5MB */
const MAX_SIZE = 5 * 1024 * 1024;
/** 允许的文件类型 */
const ALLOWED_TYPES: readonly string[] = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm',
];

/** 背景数据 */
interface BgData {
  type: 'image' | 'video';
  data: string;
}

/** 读取壁纸设置（默认 blur 0 / overlay 30） */
export function getWallpaperSettings(): WallpaperSettings {
  try {
    const raw = localStorage.getItem(WALLPAPER_SETTINGS_KEY);
    if (raw === null) return { blur: 0, overlay: 30 };
    const parsed = JSON.parse(raw) as Partial<WallpaperSettings>;
    return {
      blur: clamp(parsed.blur ?? 0, 0, 100),
      overlay: clamp(parsed.overlay ?? 30, 0, 100),
    };
  } catch {
    return { blur: 0, overlay: 30 };
  }
}

/** 应用模糊/遮罩到 CSS */
function applyBlurSettings(): void {
  const settings = getWallpaperSettings();
  const root = document.documentElement;
  root.style.setProperty('--bg-blur', `${settings.blur}px`);
  const bgImage = document.getElementById('bgImage');
  if (bgImage !== null) {
    bgImage.style.filter = 'blur(var(--bg-blur))';
  }
  const bgOverlay = document.getElementById('bgOverlay');
  if (bgOverlay !== null) {
    bgOverlay.style.opacity = String(settings.overlay / 100);
  }
}

/** 应用背景（图片/视频） */
export function applyBg(bgData: BgData | null): void {
  const bgImage = document.getElementById('bgImage') as HTMLImageElement | null;
  const bgVideo = document.getElementById('bgVideo') as HTMLVideoElement | null;
  if (bgData === null || bgData.type === 'image') {
    if (bgVideo !== null) {
      bgVideo.pause();
      bgVideo.removeAttribute('src');
      bgVideo.style.display = 'none';
    }
    if (bgImage !== null) {
      if (bgData !== null) {
        bgImage.src = bgData.data;
        bgImage.style.display = '';
      } else {
        bgImage.removeAttribute('src');
        bgImage.style.display = 'none';
      }
    }
  } else {
    if (bgImage !== null) bgImage.style.display = 'none';
    if (bgVideo !== null) {
      bgVideo.src = bgData.data;
      bgVideo.style.display = '';
      void bgVideo.play().catch(() => {});
    }
  }
  applyBlurSettings();
}

/** 保存背景 */
function saveBg(bgData: BgData): void {
  localStorage.setItem(BG_STORAGE_KEY, JSON.stringify(bgData));
}

/** 上传背景文件 */
export function uploadBg(file: File): void {
  if (file.size > MAX_SIZE) {
    warn(MODULE, `文件过大（最大 5MB）`);
    return;
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    warn(MODULE, `不支持的文件格式: ${file.type}`);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const rawData = typeof reader.result === 'string' ? reader.result : '';
    if (rawData === '') return;
    const isVideo = file.type.startsWith('video/');
    if (isVideo) {
      const bgData: BgData = { type: 'video', data: rawData };
      saveBg(bgData);
      applyBg(bgData);
    } else {
      compressImage(rawData, (compressed) => {
        const bgData: BgData = { type: 'image', data: compressed };
        saveBg(bgData);
        applyBg(bgData);
      });
    }
  };
  reader.readAsDataURL(file);
}

/** 重置背景 */
export function resetBg(): void {
  localStorage.removeItem(BG_STORAGE_KEY);
  localStorage.removeItem(WALLPAPER_SETTINGS_KEY);
  applyBg(null);
  applyBlurSettings();
}

/** 更新模糊度/遮罩 */
export function setBgParams(partial: Partial<WallpaperSettings>): void {
  const next = { ...getWallpaperSettings(), ...partial };
  localStorage.setItem(WALLPAPER_SETTINGS_KEY, JSON.stringify(next));
  applyBlurSettings();
}

/** 图片压缩（宽 > 1920 等比缩放，JPEG） */
export function compressImage(rawDataUrl: string, done: (compressed: string) => void): void {
  const img = new Image();
  img.onload = () => {
    let { width, height } = img;
    if (width > WALLPAPER_MAX_WIDTH) {
      height = Math.round((height * WALLPAPER_MAX_WIDTH) / width);
      width = WALLPAPER_MAX_WIDTH;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      done(rawDataUrl);
      return;
    }
    ctx.drawImage(img, 0, 0, width, height);
    try {
      done(canvas.toDataURL('image/jpeg', WALLPAPER_JPEG_QUALITY));
    } catch {
      done(rawDataUrl);
    }
  };
  img.onerror = () => done(rawDataUrl);
  img.src = rawDataUrl;
}

/** 初始化背景：恢复保存 + 绑定设置面板背景区块 */
export function initWallpaper(): void {
  // 恢复已保存背景
  try {
    const raw = localStorage.getItem(BG_STORAGE_KEY);
    if (raw !== null) {
      const bgData = JSON.parse(raw) as BgData;
      if (bgData.type === 'image' || bgData.type === 'video') {
        applyBg(bgData);
      }
    } else {
      applyBg(null);
      applyBlurSettings();
    }
  } catch {
    applyBg(null);
  }

  // 绑定隐藏文件输入
  const bgInput = document.getElementById('bgInput') as HTMLInputElement | null;
  bgInput?.addEventListener('change', () => {
    const file = bgInput.files?.[0];
    if (file !== undefined) uploadBg(file);
    bgInput.value = '';
  });

  // 绑定设置面板背景按钮
  document.querySelectorAll('[data-setting-action="uploadBg"]').forEach((btn) => {
    btn.addEventListener('click', () => bgInput?.click());
  });
  document.querySelectorAll('[data-setting-action="resetBg"]').forEach((btn) => {
    btn.addEventListener('click', resetBg);
  });

  // 绑定滑块
  const blurSlider = document.getElementById('sBgBlurSlider') as HTMLInputElement | null;
  const overlaySlider = document.getElementById('sBgOverlaySlider') as HTMLInputElement | null;
  blurSlider?.addEventListener('input', () => {
    setBgParams({ blur: Number(blurSlider.value) });
    const val = document.getElementById('sBgBlurValue');
    if (val !== null) val.textContent = `${blurSlider.value}px`;
  });
  overlaySlider?.addEventListener('input', () => {
    setBgParams({ overlay: Number(overlaySlider.value) });
    const val = document.getElementById('sBgOverlayValue');
    if (val !== null) val.textContent = `${overlaySlider.value}%`;
  });
}
