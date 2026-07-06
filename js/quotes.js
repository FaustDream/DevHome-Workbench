/**
 * 个性化问候语 + 每日金句模块
 * 问候语根据系统时间动态更新，金句每天随机刷新（本地库 + hitokoto API 兜底）。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    /** 本地金句库（50 条）：名言/诗词/冷知识混合 */
    var LOCAL_QUOTES = [
        '代码如诗，简洁即美。',
        '不积跬步，无以至千里。 ——荀子',
        'Stay hungry, stay foolish. ——Steve Jobs',
        '最好的代码是没有代码。',
        'Debugging is twice as hard as writing the code. ——Brian Kernighan',
        '千里之行，始于足下。 ——老子',
        'Talk is cheap. Show me the code. ——Linus Torvalds',
        '阳光每 8 分 20 秒才能到达地球，你看到的永远是过去的太阳。',
        '人的差异在于业余时间。 ——爱因斯坦',
        '简单是可靠的先决条件。 ——Edsger Dijkstra',
        '章鱼有三颗心脏，血液是蓝色的。',
        '先完成，再完美。',
        '你写下的每一个 bug，都是未来自己的惊喜。',
        '学而不思则罔，思而不学则殆。 ——孔子',
        '蜜蜂采一公斤蜜要飞绕地球 10 圈。',
        'It does not matter how slowly you go so long as you do not stop. ——孔子',
        '每一个优秀的程序员都是从复制粘贴开始的。',
        '天行健，君子以自强不息。 ——《周易》',
        'Rome wasn\'t built in a day.',
        '香蕉其实是有辐射的（含钾-40），但吃 100 根也不会超标。',
        '求知若饥，虚心若愚。',
        '瀑布下落时，每秒钟约有 2800 吨水从尼亚加拉瀑布倾泻。',
        'The best preparation for tomorrow is doing your best today.',
        '博观而约取，厚积而薄发。 ——苏轼',
        '水熊虫能在太空真空中存活，是地球上最顽强的生物。',
        'Less is more. ——Ludwig Mies van der Rohe',
        '业精于勤，荒于嬉。 ——韩愈',
        '你大脑的存储容量约为 2.5 PB（拍字节），相当于 300 万小时视频。',
        'Do what you can, with what you have, where you are.',
        '人类的 DNA 和香蕉有 50% 相同。',
        'Make it work, make it right, make it fast.',
        '路漫漫其修远兮，吾将上下而求索。 ——屈原',
        '企鹅的膝盖藏在羽毛下面，所以走路才一摇一摆。',
        'The only way to do great work is to love what you do.',
        '天下大事，必作于细。 ——老子',
        '土星密度小于水，如果有一个足够大的浴缸，它能浮起来。',
        'Premature optimization is the root of all evil. ——Donald Knuth',
        '知者不惑，仁者不忧，勇者不惧。 ——孔子',
        '考拉指纹和人类指纹在显微镜下几乎无法区分。',
        'Every great developer you know got there by solving problems they had no idea how to solve.',
        '海纳百川，有容乃大。 ——林则徐',
        '鸭嘴兽没有胃，食物直接从食道进入肠道。',
        'First, solve the problem. Then, write the code. ——John Johnson',
        '志不强者智不达。 ——墨子',
        '火柴的发明比打火机晚了两年。',
        'The best error message is the one that never shows up.',
        '锲而不舍，金石可镂。 ——荀子',
        '抹香鲸可以憋气超过 90 分钟，是潜水最深的哺乳动物。',
        'Simplicity is the soul of efficiency. ——Austin Freeman',
        '不飞则已，一飞冲天；不鸣则已，一鸣惊人。 ——司马迁'
    ];

    var QUOTE_CACHE_KEY = 'tabpage_quote_cache';

    /** 从本地库随机获取一条金句 */
    function getLocalQuote() {
        var idx = Math.floor(Math.random() * LOCAL_QUOTES.length);
        return LOCAL_QUOTES[idx];
    }

    /** 从 hitokoto API 获取一条金句 */
    async function fetchHitokoto() {
        try {
            var controller = new AbortController();
            var timeout = setTimeout(function () { controller.abort(); }, 5000);
            var resp = await fetch('https://v1.hitokoto.cn/?c=a&c=b&c=d&c=e&c=k&encode=text', { signal: controller.signal });
            clearTimeout(timeout);
            if (resp.ok) {
                var text = await resp.text();
                if (text && text.trim()) return text.trim();
            }
        } catch (e) { /* 静默降级到本地库 */ }
        return null;
    }

    /** 加载今日金句（优先缓存 → 本地库 → API 兜底） */
    async function loadDailyQuote() {
        var today = new Date().toLocaleDateString('zh-CN');
        var cached;
        try { cached = JSON.parse(localStorage.getItem(QUOTE_CACHE_KEY)); } catch (e) { }

        // 同一天直接用缓存
        if (cached && cached.date === today && cached.text) {
            return cached.text;
        }

        // 先取本地库
        var text = getLocalQuote();

        // 异步尝试 API，成功则覆盖
        fetchHitokoto().then(function (apiText) {
            if (apiText && apiText.length > 2) {
                var el = document.getElementById('quoteText');
                if (el) { el.textContent = '「' + apiText + '」'; el.title = '每日金句（来自一言API）'; }
                localStorage.setItem(QUOTE_CACHE_KEY, JSON.stringify({ date: today, text: apiText }));
            }
        });

        // 先缓存本地库结果
        if (!cached || cached.date !== today) {
            localStorage.setItem(QUOTE_CACHE_KEY, JSON.stringify({ date: today, text: text }));
        }
        return text;
    }

    /** 根据小时返回问候语和时区标签 */
    function getGreeting(hour) {
        if (hour >= 6 && hour < 9) return { text: 'GOOD MORNING ☀', sub: 'Focused Efficiency, Personalized Future.' };
        if (hour >= 9 && hour < 12) return { text: 'GOOD MORNING ☀', sub: 'Focused Efficiency, Personalized Future.' };
        if (hour >= 12 && hour < 14) return { text: 'GOOD AFTERNOON 🌤', sub: 'Take a break, then keep moving.' };
        if (hour >= 14 && hour < 18) return { text: 'GOOD AFTERNOON 🌤', sub: 'Focused Efficiency, Personalized Future.' };
        if (hour >= 18 && hour < 23) return { text: 'GOOD EVENING 🌙', sub: 'Reflect and recharge.' };
        return { text: 'GOOD NIGHT 🌃', sub: 'Rest well, dream big.' };
    }

    /** 更新问候语 DOM */
    function updateGreeting() {
        var el = document.getElementById('greetingText');
        if (!el) return;
        if (!ns.isModuleEnabled('greeting')) { el.style.display = 'none'; return; }
        el.style.display = '';
        var hour = new Date().getHours();
        var g = getGreeting(hour);
        el.innerHTML = '<span class="greeting-main">' + g.text + '</span><span class="greeting-sub">' + g.sub + '</span>';
    }

    /** 渲染金句到 DOM */
    async function renderQuote() {
        var el = document.getElementById('quoteText');
        if (!el) return;
        if (!ns.isModuleEnabled('dailyQuote')) { el.style.display = 'none'; return; }
        el.style.display = '';
        var text = await loadDailyQuote();
        el.textContent = '「' + text + '」';
        el.title = '每日金句';
    }

    /** 初始化：渲染金句 + 问候语，问候语每分钟自动刷新 */
    ns.initQuotes = async function () {
        await renderQuote();
        updateGreeting();
        // 每分钟检查问候语是否需要更新
        setInterval(function () {
            var now = new Date();
            // 仅在整点或切换时区时更新
            if (now.getMinutes() === 0) updateGreeting();
        }, 60000);
        // 每次页面可见时刷新（用户切回来可能跨时区）
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) updateGreeting();
        });
        console.log('[每日金句] 渲染完成');
    };

})(window.DevHome);
