/* ============================================
   Matrix 数字雨背景动画 (主页)
   攻防双向流动 + 涟漪 / 扫描线 / 呼吸
   默认可通过设置面板手动开启
   ============================================ */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';
    const c = document.getElementById('matrixCanvas');
    if (!c) return;
    const ctx = c.getContext('2d');

    c.style.position = 'fixed';
    c.style.top = '0';
    c.style.left = '0';
    c.style.zIndex = '-1';
    c.style.pointerEvents = 'none';
    c.style.display = 'none';  // 默认隐藏，设置中手动开启
    c.style.margin = '0';
    c.style.padding = '0';

let w, h;
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzαβγδεζηθικλμνξπρστυφχψω∑∏∫√∞≈≠≤≥±×÷∂∇∆∈∉⊂⊃∪∩∧∨⊕⊗⊥∥∠';
    const combatChars = '攻防守突破穿刺击粉碎撕裂碾压横扫冲击波';
    const dangerChars = 'ＷＡＲＮＩＮＧ渗透入侵警报锁定瞄准拦截';

    let _running = false;
    let _animationFrameId = null;

    function getFontSize() {
        const saved = localStorage.getItem('tabpage_char_size');
        return saved ? parseInt(saved) : 8;
    }
    let fontSize = getFontSize();

    function getSpeedMultiplier() {
        const saved = localStorage.getItem('tabpage_flow_speed');
        return saved ? parseInt(saved) : 2;
    }

    function getDensity() {
        const saved = localStorage.getItem('tabpage_char_density');
        const v = saved ? parseInt(saved) : 3;
        return v / 5;
    }

let columns, maxRow;
let rows = [], speeds = [], dirs = [], charsPerCol = [];
    let frameCount = 0;

let ripple = { active: false, x: 0, y: 0, radius: 0, maxR: 180, frames: 0, opacity: 0 };
    const mouseRipples = [];
    let lastMouseFrame = 0;

    function resize() {
        fontSize = getFontSize();
        w = c.width = window.innerWidth;
        h = c.height = window.innerHeight;
        c.style.width = w + 'px';
        c.style.height = h + 'px';
        columns = Math.ceil(w / fontSize);
        maxRow = Math.floor(h / fontSize);
        rows = new Array(columns);
        speeds = new Array(columns);
        dirs = new Array(columns);
        charsPerCol = new Array(columns);
        const spdMul = getSpeedMultiplier();
        for (let i = 0; i < columns; i++) {
            speeds[i] = (0.05 + Math.random() * 0.45) * spdMul;
            charsPerCol[i] = 0;
            dirs[i] = Math.random() < 0.55 ? 1 : -1;
            rows[i] = Math.floor(Math.random() * maxRow);
        }
    }

    document.addEventListener('mousemove', function (e) {
        if (!_running || frameCount - lastMouseFrame < 3) return;
        lastMouseFrame = frameCount;
        mouseRipples.push({
            x: e.clientX, y: e.clientY,
            radius: 0, maxR: 100 + Math.random() * 120,
            opacity: 0.06 + Math.random() * 0.04
        });
        if (mouseRipples.length > 20) mouseRipples.shift();
    });

    function calcRippleEffect(px, py) {
let dx = 0, dy = 0, glow = 0;
        for (let ri = 0; ri < mouseRipples.length; ri++) {
            const mr = mouseRipples[ri];
            if (mr.opacity < 0.005) continue;
            const dist = Math.sqrt((px - mr.x) ** 2 + (py - mr.y) ** 2);
            const effectRange = mr.radius + 80;
            if (dist < effectRange && dist > 0.1) {
                const strength = (1 - dist / effectRange) * mr.opacity * 50;
                dx += (px - mr.x) / dist * strength * 5;
                dy += (py - mr.y) / dist * strength * 2;
                glow = Math.max(glow, (1 - dist / effectRange) * mr.opacity * 15);
            }
        }
        return { dx: dx, dy: dy, glow: glow };
    }

    function draw() {
        if (!_running) return;
        frameCount++;
        ctx.fillStyle = 'rgba(0,0,0,0.13)';
        ctx.fillRect(0, 0, w, h);

        ctx.font = 'bold ' + fontSize + 'px "Cascadia Code","Consolas","Courier New",monospace';
        ctx.textBaseline = 'top';

        if (frameCount % 5 === 0) {
            for (let ci = 0; ci < columns; ci++) {
                if (Math.random() < 0.35) charsPerCol[ci] = Math.floor(Math.random() * chars.length);
            }
        }

        if (!ripple.active && frameCount % 120 === Math.floor(Math.random() * 120)) {
            ripple.active = true;
            ripple.x = Math.random() * w; ripple.y = Math.random() * h;
            ripple.radius = 0; ripple.frames = 0;
            ripple.maxR = 140 + Math.random() * 200;
        }
        if (ripple.active) {
            ripple.frames++; ripple.radius += 1.2;
            ripple.opacity = Math.max(0, 0.06 - ripple.frames * 0.0005);
            if (ripple.radius > ripple.maxR) { ripple.active = false; ripple.opacity = 0; }
        }

        for (const ri = mouseRipples.length - 1; ri >= 0; ri--) {
            const mr = mouseRipples[ri];
            mr.radius += 0.25; mr.opacity *= 0.9988;
            if (mr.radius > mr.maxR || mr.opacity < 0.003) mouseRipples.splice(ri, 1);
        }

        const density = getDensity();
        for (let i = 0; i < columns; i++) {
            if (density < 1 && Math.random() > density) continue;
            const baseX = i * fontSize;
            const baseY = rows[i] * fontSize;
            const dir = dirs[i];
            const brt = 0.35 + 0.65 * Math.random();
            const breathe = 1 + 0.25 * Math.sin((frameCount + i * 7) * 0.03);
let effect = calcRippleEffect(baseX, baseY);
            const drawX = baseX + effect.dx;
            const drawY = baseY + effect.dy;
            const glowBoost = effect.glow;
            const isDanger = dir === -1 || Math.random() < 0.04;

            if (Math.random() < 0.03) {
                ctx.fillStyle = isDanger
                    ? 'rgba(255,80,50,' + (0.6 * brt * breathe + glowBoost) + ')'
                    : 'rgba(170,255,170,' + (0.7 * brt * breathe + glowBoost) + ')';
            } else if (Math.random() < 0.14) {
                ctx.fillStyle = isDanger
                    ? 'rgba(255,120,40,' + (0.5 * brt * breathe + glowBoost) + ')'
                    : 'rgba(0,255,65,' + (0.55 * brt * breathe + glowBoost) + ')';
            } else {
                ctx.fillStyle = isDanger
                    ? 'rgba(255,50,30,' + (0.3 * brt * breathe + glowBoost) + ')'
                    : 'rgba(0,160,35,' + (0.3 * brt * breathe + glowBoost) + ')';
            }

            if (Math.random() < 0.06) {
                ctx.fillText(combatChars[Math.floor(Math.random() * combatChars.length)], drawX, drawY);
            } else if (isDanger && Math.random() < 0.3) {
                ctx.fillText(dangerChars[Math.floor(Math.random() * dangerChars.length)], drawX, drawY);
            } else {
                ctx.fillText(chars[charsPerCol[i] % chars.length], drawX, drawY);
            }

            rows[i] += speeds[i] * dir;
            if (dir === 1 && rows[i] > maxRow) { rows[i] = 0; charsPerCol[i] = Math.floor(Math.random() * chars.length); }
            else if (dir === -1 && rows[i] < 0) { rows[i] = maxRow; charsPerCol[i] = Math.floor(Math.random() * chars.length); }
            if (Math.random() < 0.0003) {
                rows[i] = dir === 1 ? 0 : maxRow;
                charsPerCol[i] = Math.floor(Math.random() * chars.length);
            }
        }

        _animationFrameId = requestAnimationFrame(draw);
    }

    function start() {
        if (_running) return;
        _running = true;
        c.style.display = 'block';
        console.log('[数字雨] 启动');
        resize();
        draw();
        localStorage.setItem('tabpage_matrix_rain_enabled', '1');
    }

    function stop() {
        _running = false;
        if (_animationFrameId) { cancelAnimationFrame(_animationFrameId); _animationFrameId = null; }
        c.style.display = 'none';
        console.log('[数字雨] 停止');
        localStorage.setItem('tabpage_matrix_rain_enabled', '0');
    }

    window.addEventListener('resize', resize);

    /* ===== 公开 API ===== */
    ns.matrixRain = {
        start: start,
        stop: stop,
        isRunning: function () { return _running; }
    };

    // 检查是否有保存的开启状态（默认关闭）
    const savedEnabled = localStorage.getItem('tabpage_matrix_rain_enabled');
    if (savedEnabled === '1') {
        // 延迟启动，让 DOM 和 CSS 先完成加载
        setTimeout(function () { start(); }, 200);
    }

})(window.DevHome);
