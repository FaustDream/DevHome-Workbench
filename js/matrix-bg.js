/* ============================================
   Matrix 数字雨背景动画 (主页)
   攻防双向流动 + 涟漪 / 扫描线 / 呼吸
   ============================================ */
(function() {
    'use strict';
    var c = document.getElementById('matrixCanvas');
    if (!c) return;
    var ctx = c.getContext('2d');

    c.style.position = 'fixed';
    c.style.top = '0';
    c.style.left = '0';
    c.style.zIndex = '-1';
    c.style.pointerEvents = 'none';
    c.style.display = 'block';
    c.style.margin = '0';
    c.style.padding = '0';

    var w, h;
    var chars = '0123456789abcdefghijklmnopqrstuvwxyzαβγδεζηθικλμνξπρστυφχψω∑∏∫√∞≈≠≤≥±×÷∂∇∆∈∉⊂⊃∪∩∧∨⊕⊗⊥∥∠';
    var combatChars = '攻防守突破穿刺击粉碎撕裂碾压横扫冲击波';
    var dangerChars = 'ＷＡＲＮＩＮＧ渗透入侵警报锁定瞄准拦截';

    // 动态设置：字符大小
    function getFontSize() {
        var saved = localStorage.getItem('tabpage_char_size');
        return saved ? parseInt(saved) : 8;
    }
    var fontSize = getFontSize();

    // 动态设置：速度倍率 (1-5，1=默认×1)
    function getSpeedMultiplier() {
        var saved = localStorage.getItem('tabpage_flow_speed');
        var v = saved ? parseInt(saved) : 2;
        return v;  // 2 ~ 20
    }

    // 动态设置：密度 (1-5，1=最稀疏20%, 5=全满100%)
    function getDensity() {
        var saved = localStorage.getItem('tabpage_char_density');
        var v = saved ? parseInt(saved) : 3;
        return v / 5;  // 0.6 ~ 1.0
    }
    var columns, maxRow;
    var rows = [];        // 每列当前行索引
    var speeds = [];      // 每列速度（始终正值）
    var dirs = [];        // 1=下落(攻), -1=上升(防)
    var charsPerCol = [];
    var frameCount = 0;

    // 随机涟漪
    var ripple = { active: false, x: 0, y: 0, radius: 0, maxR: 180, frames: 0, opacity: 0 };

    // 鼠标涟漪
    var mouseRipples = [];
    var maxMouseRipples = 20;
    var lastMouseFrame = 0;

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
        var spdMul = getSpeedMultiplier();
        for (var i = 0; i < columns; i++) {
            speeds[i] = (0.05 + Math.random() * 0.45) * spdMul;   // 动态速度
            charsPerCol[i] = 0;
            // 55% 下落(攻)，45% 上升(防)
            if (Math.random() < 0.55) {
                dirs[i] = 1;   // 攻
            } else {
                dirs[i] = -1;  // 防
            }
            rows[i] = Math.floor(Math.random() * maxRow);  // 散布全屏
        }
    }

    // 鼠标移动产生涟漪
    document.addEventListener('mousemove', function(e) {
        if (frameCount - lastMouseFrame < 3) return;
        lastMouseFrame = frameCount;
        mouseRipples.push({
            x: e.clientX, y: e.clientY,
            radius: 0, maxR: 100 + Math.random() * 120,
            opacity: 0.06 + Math.random() * 0.04
        });
        if (mouseRipples.length > maxMouseRipples) mouseRipples.shift();
    });

    function calcRippleEffect(px, py) {
        var dx = 0, dy = 0, glow = 0;
        for (var ri = 0; ri < mouseRipples.length; ri++) {
            var mr = mouseRipples[ri];
            if (mr.opacity < 0.005) continue;
            var distX = px - mr.x;
            var distY = py - mr.y;
            var dist = Math.sqrt(distX * distX + distY * distY);
            var effectRange = mr.radius + 80;
            if (dist < effectRange && dist > 0.1) {
                var strength = (1 - dist / effectRange) * mr.opacity * 50;
                dx += (distX / dist) * strength * 5;
                dy += (distY / dist) * strength * 2;
                glow = Math.max(glow, (1 - dist / effectRange) * mr.opacity * 15);
            }
        }
        return { dx: dx, dy: dy, glow: glow };
    }

    function draw() {
        frameCount++;
        ctx.fillStyle = 'rgba(0,0,0,0.13)';
        ctx.fillRect(0, 0, w, h);

        ctx.font = 'bold ' + fontSize + 'px "VT323","Courier New",monospace';
        ctx.textBaseline = 'top';

        if (frameCount % 5 === 0) {
            for (var ci = 0; ci < columns; ci++) {
                if (Math.random() < 0.35) charsPerCol[ci] = Math.floor(Math.random() * chars.length);
            }
        }

        // ==== 随机涟漪 ====
        if (!ripple.active && frameCount % 120 === Math.floor(Math.random() * 120)) {
            ripple.active = true;
            ripple.x = Math.random() * w;
            ripple.y = Math.random() * h;
            ripple.radius = 0; ripple.frames = 0;
            ripple.maxR = 140 + Math.random() * 200;
        }
        if (ripple.active) {
            ripple.frames++; ripple.radius += 1.2;
            ripple.opacity = Math.max(0, 0.06 - ripple.frames * 0.0005);
            if (ripple.radius > ripple.maxR) { ripple.active = false; ripple.opacity = 0; }
        }

        // ==== 鼠标涟漪（不绘制圆环，只更新状态用于字符位移） ====
        for (var ri = mouseRipples.length - 1; ri >= 0; ri--) {
            var mr = mouseRipples[ri];
            mr.radius += 0.25; mr.opacity *= 0.9988;
            if (mr.radius > mr.maxR || mr.opacity < 0.003) { mouseRipples.splice(ri, 1); }
        }

        // 主渲染循环
        var density = getDensity();
        for (var i = 0; i < columns; i++) {
            // 密度控制：按概率跳过某些列
            if (density < 1 && Math.random() > density) continue;
            var baseX = i * fontSize;
            var baseY = rows[i] * fontSize;
            var dir = dirs[i];
            var brt = 0.35 + 0.65 * Math.random();
            var breathe = 1 + 0.25 * Math.sin((frameCount + i * 7) * 0.03);

            var effect = calcRippleEffect(baseX, baseY);
            var drawX = baseX + effect.dx;
            var drawY = baseY + effect.dy;
            var glowBoost = effect.glow;

            // 颜色：下落=绿色系(攻)，上升=橙红色系(防)
            var isDanger = dir === -1 || Math.random() < 0.04;
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

            // ==== 生命周期：走完全程才重置 ====
            rows[i] += speeds[i] * dir;
            if (dir === 1 && rows[i] > maxRow) {
                // 下落到底 → 重置到顶部
                rows[i] = 0;
                charsPerCol[i] = Math.floor(Math.random() * chars.length);
            } else if (dir === -1 && rows[i] < 0) {
                // 上升到顶 → 重置到底部
                rows[i] = maxRow;
                charsPerCol[i] = Math.floor(Math.random() * chars.length);
            }
            // 极小概率随机重置（模拟信号中断）
            if (Math.random() < 0.0003) {
                if (dir === 1) rows[i] = 0;
                else rows[i] = maxRow;
                charsPerCol[i] = Math.floor(Math.random() * chars.length);
            }
        }

        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    draw();
})();
