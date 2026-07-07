/**
 * DevHome Workbench - 交互式数据看板组件
 *
 * 利用 React 18 构建，替代原生 DOM 更新的 renderBehaviorDashboard()，
 * 提供日历热力图、统计卡片动画、趋势可视化，数据变更时自动刷新。
 *
 * 编译: node build.mjs → js/ui-components/dashboard.js
 * 引入: <script src="js/ui-components/dashboard.js"></script>
 * 挂载: ReactDOM.createRoot(document.getElementById('reactDashboardRoot'))
 *
 * 数据源: window.__dashboardData = { streak, totalTasks, totalNotes, ... }
 * 更新: 修改 __dashboardData 后调用 window.__refreshDashboard()
 */

const { useState, useEffect, useCallback, useMemo } = React;

/* ===== 子组件：统计卡片（带动画计数） ===== */
function StatCard({ icon, label, value, color }) {
    const [displayVal, setDisplayVal] = useState(0);

    useEffect(() => {
        // 数字从 0 动画递增到目标值
        const target = parseInt(value) || 0;
        if (target === displayVal) return;
        const step = Math.max(1, Math.ceil(target / 20));
        let current = displayVal;
        const timer = setInterval(() => {
            current += step;
            if (current >= target) { setDisplayVal(target); clearInterval(timer); }
            else setDisplayVal(current);
        }, 30);
        return () => clearInterval(timer);
    }, [value]);

    return React.createElement('div', { className: 'db-stat-card', style: { '--accent': color } },
        React.createElement('div', { className: 'db-stat-icon' }, icon),
        React.createElement('div', { className: 'db-stat-num' }, displayVal),
        React.createElement('div', { className: 'db-stat-label' }, label)
    );
}

/* ===== 子组件：7 日活跃热力图（迷你日历条） ===== */
function WeekHeatmap({ dailyStats }) {
    const daysOfWeek = ['日', '一', '二', '三', '四', '五', '六'];
    const cells = useMemo(() => {
        const result = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            const active = !!(dailyStats && dailyStats[ds] && dailyStats[ds].streakDay);
            result.push({ day: daysOfWeek[d.getDay()], date: ds.slice(5), active });
        }
        return result;
    }, [dailyStats]);

    return React.createElement('div', { className: 'db-heatmap' },
        React.createElement('div', { className: 'db-heatmap-title' }, '近 7 天活跃'),
        React.createElement('div', { className: 'db-heatmap-row' },
            cells.map(c =>
                React.createElement('div', {
                    key: c.date,
                    className: 'db-heatmap-cell' + (c.active ? ' active' : ''),
                    title: c.date + (c.active ? ' ✅ 已完成打卡' : ' 未打卡')
                },
                    React.createElement('div', { className: 'db-heatmap-day' }, c.day),
                    React.createElement('div', { className: 'db-heatmap-dot' })
                )
            )
        )
    );
}

/* ===== 子组件：番茄钟环形进度 ===== */
function PomodoroRing({ completed, total, focusMinutes }) {
    const pct = total > 0 ? Math.round(completed / total * 100) : 0;
    const circumference = 2 * Math.PI * 40;
    const offset = circumference - (pct / 100) * circumference;

    return React.createElement('div', { className: 'db-pomodoro-ring' },
        React.createElement('svg', { width: 100, height: 100, viewBox: '0 0 100 100' },
            React.createElement('circle', { cx: 50, cy: 50, r: 40, fill: 'none', stroke: 'var(--color-glass-border)', strokeWidth: 6 }),
            React.createElement('circle', {
                cx: 50, cy: 50, r: 40, fill: 'none',
                stroke: 'var(--color-accent)', strokeWidth: 6,
                strokeDasharray: circumference, strokeDashoffset: offset,
                strokeLinecap: 'round', transform: 'rotate(-90 50 50)',
                style: { transition: 'stroke-dashoffset 0.6s ease' }
            })
        ),
        React.createElement('div', { className: 'db-pomodoro-center' },
            React.createElement('div', { className: 'db-pomodoro-big' }, focusMinutes),
            React.createElement('div', { className: 'db-pomodoro-sub' }, '分钟')
        ),
        React.createElement('div', { className: 'db-pomodoro-label' }, '已完成 ' + completed + '/' + total + ' 个 🍅')
    );
}

/* ===== 主组件：数据看板 ===== */
function Dashboard() {
    const [data, setData] = useState(window.__dashboardData || {});

    const refresh = useCallback(() => {
        setData(window.__dashboardData || {});
    }, []);

    useEffect(() => {
        window.__refreshDashboard = refresh;
        return () => { delete window.__refreshDashboard; };
    }, [refresh]);

    const {
        streak = 0, totalCompleted = 0, totalPomodoros = 0,
        totalFocusMinutes = 0, totalNotes = 0, dailyStats = {}
    } = data;

    return React.createElement('div', { className: 'db-dashboard' },
        // 标题行
        React.createElement('div', { className: 'db-header' },
            React.createElement('h3', { className: 'db-title' }, '行为数据看板'),
            React.createElement('span', { className: 'db-streak-badge', title: '连续打卡天数' },
                '🔥 连续 ' + (streak || 0) + ' 天'
            )
        ),

        // 统计卡片行
        React.createElement('div', { className: 'db-cards-row' },
            React.createElement(StatCard, { icon: '✅', label: '完成任务', value: totalCompleted, color: 'var(--color-success)' }),
            React.createElement(StatCard, { icon: '🍅', label: '番茄钟',   value: totalPomodoros, color: '#ff6348' }),
            React.createElement(StatCard, { icon: '📝', label: '笔记',     value: totalNotes,     color: 'var(--color-accent)' }),
            React.createElement(StatCard, { icon: '⏱️', label: '专注分钟', value: totalFocusMinutes, color: '#7ad7ff' })
        ),

        // 下部双栏：热力图 + 番茄钟环
        React.createElement('div', { className: 'db-bottom-row' },
            React.createElement(WeekHeatmap, { dailyStats }),
            React.createElement(PomodoroRing, {
                completed: totalPomodoros,
                total: Math.max(totalPomodoros, 1),
                focusMinutes: totalFocusMinutes
            })
        )
    );
}

// 暴露到全局（供 React 挂载）
window.DashboardApp = { Dashboard, StatCard, WeekHeatmap, PomodoroRing };
