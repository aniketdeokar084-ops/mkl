import { EventBus, formatTime, formatDate, formatDateDisplay, getStartOfDay, getDaysBetween, generateId } from './utils.js';
import { getSessions, getDistractions, getTasks, getSettings } from './storage.js';

/**
 * Initializes the stats module
 */
export function initStats() {
    refreshStats();
    EventBus.on('session:logged', refreshStats);
    EventBus.on('data:imported', refreshStats);
    EventBus.on('data:cleared', refreshStats);
    EventBus.on('distraction:logged', refreshStats);
    EventBus.on('quality:rated', refreshStats);
}

/**
 * Refreshes all stats on the UI
 */
export function refreshStats() {
    renderStatCards();
    renderDailyGoal();
    renderDistractionStats();
    renderFocusQualityStats();
    renderSmartSuggestions();
}

/**
 * Retrieves today's stats
 * @returns {Object} Today's stats including focus time, sessions, and goal progress
 */
export function getTodayStats() {
  const sessions = getSessions();
  const today = getStartOfDay(new Date());
  const todaySessions = sessions.filter(s => s.completedAt >= today && s.mode === 'focus');
  const focusTime = todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const settings = getSettings();
  const goal = settings.dailyGoal || 8;
  return {
    focusTime,         // seconds
    sessions: todaySessions.length,
    goalProgress: goal > 0 ? todaySessions.length / goal : 0,
  };
}

/**
 * Gets streak data
 * @returns {Object} Current and best streak
 */
export function getStreakData() {
  const sessions = getSessions().filter(s => s.mode === 'focus');
  if (!sessions.length) return { current: 0, best: 0 };
  
  const dateSet = new Set();
  sessions.forEach(s => dateSet.add(formatDate(s.completedAt)));
  const dates = [...dateSet].sort();
  
  const today = formatDate(Date.now());
  const yesterday = formatDate(Date.now() - 86400000);
  
  let current = 0;
  let checkDate = new Date();
  
  if (!dateSet.has(today)) {
    if (!dateSet.has(yesterday)) return { current: 0, best: getBestStreak(dates) };
    checkDate = new Date(Date.now() - 86400000);
  }
  
  while (dateSet.has(formatDate(checkDate.getTime()))) {
    current++;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  return { current, best: Math.max(current, getBestStreak(dates)) };
}

function getBestStreak(sortedDates) {
  if (!sortedDates.length) return 0;
  let best = 1, current = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i-1]);
    const curr = new Date(sortedDates[i]);
    const diff = (curr - prev) / 86400000;
    if (Math.round(diff) === 1) {
      current++;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }
  return best;
}

/**
 * Gets total focus hours across all time
 * @returns {number} Total focus hours as a decimal
 */
export function getTotalFocusHours() {
    const sessions = getSessions().filter(s => s.mode === 'focus');
    const totalSeconds = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    return totalSeconds / 3600;
}

/**
 * Gets focus minutes for the last 7 days
 * @returns {Array} Array of { date, label, minutes }
 */
export function getLast7DaysData() {
    const sessions = getSessions().filter(s => s.mode === 'focus');
    const days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = formatDate(d.getTime());
        const label = d.toLocaleDateString(undefined, { weekday: 'short' });
        
        const dayStart = getStartOfDay(d);
        const dayEnd = dayStart + 86400000;
        
        const daySessions = sessions.filter(s => s.completedAt >= dayStart && s.completedAt < dayEnd);
        const minutes = Math.round(daySessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60);

        days.push({ date: dateStr, label, minutes });
    }

    return days;
}

/**
 * Gets focus minutes for the last 30 days
 * @returns {Array} Array of { date, label, minutes }
 */
export function getLast30DaysData() {
    const sessions = getSessions().filter(s => s.mode === 'focus');
    const days = [];
    const today = new Date();

    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = formatDate(d.getTime());
        const label = `${d.getMonth() + 1}/${d.getDate()}`;
        
        const dayStart = getStartOfDay(d);
        const dayEnd = dayStart + 86400000;
        
        const daySessions = sessions.filter(s => s.completedAt >= dayStart && s.completedAt < dayEnd);
        const minutes = Math.round(daySessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60);

        days.push({ date: dateStr, label, minutes });
    }

    return days;
}

/**
 * Gets distribution of focus time by tag
 * @returns {Array} Array of { tag, minutes }
 */
export function getTagDistribution() {
    const sessions = getSessions().filter(s => s.mode === 'focus');
    const tasks = getTasks();
    const taskMap = new Map();
    tasks.forEach(t => taskMap.set(t.id, t));

    const tagMinutes = {};

    sessions.forEach(s => {
        let tag = 'No Tag';
        if (s.taskId && taskMap.has(s.taskId)) {
            tag = taskMap.get(s.taskId).tag || 'No Tag';
        }
        const mins = Math.round((s.duration || 0) / 60);
        tagMinutes[tag] = (tagMinutes[tag] || 0) + mins;
    });

    return Object.keys(tagMinutes).map(tag => ({
        tag,
        minutes: tagMinutes[tag]
    })).sort((a, b) => b.minutes - a.minutes);
}

/**
 * Gets heatmap data for specified number of weeks
 * @param {number} weeks 
 * @returns {Array} Array of { date, count }
 */
export function getHeatmapData(weeks = 12) {
    const sessions = getSessions().filter(s => s.mode === 'focus');
    const days = [];
    const totalDays = weeks * 7;
    const today = new Date();

    const counts = {};
    sessions.forEach(s => {
        const dStr = formatDate(s.completedAt);
        counts[dStr] = (counts[dStr] || 0) + 1;
    });

    for (let i = totalDays - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = formatDate(d.getTime());
        days.push({
            date: dateStr,
            count: counts[dateStr] || 0
        });
    }

    return days;
}

/**
 * Gets breakdown of distractions
 * @returns {Array} Distraction breakdown
 */
export function getDistractionBreakdown() {
    const distractions = getDistractions();
    if (!distractions || distractions.length === 0) return [];

    const counts = {};
    distractions.forEach(d => {
        const reason = d.reason || 'other';
        counts[reason] = (counts[reason] || 0) + 1;
    });

    const total = distractions.length;
    const breakdown = Object.keys(counts).map(reason => ({
        reason,
        count: counts[reason],
        percentage: Math.round((counts[reason] / total) * 100)
    })).sort((a, b) => b.count - a.count);

    const tips = {
      phone: 'Put your phone in another room or turn on Do Not Disturb.',
      social_media: 'Use a website blocker or log out during focus sessions.',
      noise: 'Try noise-cancelling headphones or ambient sounds in Focus Mode.',
      thoughts: 'Keep a quick notepad nearby to jot ideas down without breaking focus.',
      other: 'Identify recurring distractions and design friction against them.'
    };

    return Object.assign(breakdown, { tips });
}

/**
 * Gets average focus quality by hour of day
 * @returns {Array} Focus quality by hour
 */
export function getFocusQualityByHour() {
    const sessions = getSessions().filter(s => s.mode === 'focus' && typeof s.focusQuality === 'number' && s.focusQuality > 0);
    const hourStats = {};
    sessions.forEach(s => {
        const hour = new Date(s.completedAt).getHours();
        if (!hourStats[hour]) hourStats[hour] = { sum: 0, count: 0 };
        hourStats[hour].sum += s.focusQuality;
        hourStats[hour].count++;
    });

    return Object.keys(hourStats).map(hour => ({
        hour: parseInt(hour, 10),
        avgQuality: hourStats[hour].sum / hourStats[hour].count,
        sessionCount: hourStats[hour].count
    })).sort((a, b) => a.hour - b.hour);
}

/**
 * Generates smart suggestions based on user data
 * @returns {Object} Smart suggestions
 */
export function getSmartSuggestions() {
  const sessions = getSessions().filter(s => s.mode === 'focus');
  
  const goodSessions = sessions.filter(s => typeof s.focusQuality === 'number' && s.focusQuality >= 4);
  let idealDuration = 25;
  if (goodSessions.length >= 3) {
    idealDuration = Math.round(goodSessions.reduce((s, x) => s + (x.plannedDuration || x.duration || 1500), 0) / goodSessions.length / 60);
  }
  
  const qualityByHour = getFocusQualityByHour();
  const bestHours = qualityByHour
    .filter(h => h.sessionCount >= 2)
    .sort((a, b) => b.avgQuality - a.avgQuality)
    .slice(0, 3)
    .map(h => h.hour);
  
  const distractions = getDistractionBreakdown();
  const tips = [];
  if (distractions.length > 0) {
    const top = distractions[0];
    if (top.reason === 'phone') tips.push('📱 Your phone is your #1 distraction. Try putting it in another room.');
    else if (top.reason === 'social_media') tips.push('🌐 Social media is interrupting your flow. Consider using a website blocker.');
    else if (top.reason === 'noise') tips.push('🔊 Noise is distracting. Try listening to ambient sounds in Focus Mode.');
    else if (top.reason === 'thoughts') tips.push('💭 You are distracted by wandering thoughts. Keep a notepad nearby to capture them.');
  }

  if (sessions.length >= 3) {
    tips.push(`🎯 Your peak sessions average around ${idealDuration} minutes.`);
  }
  
  return { idealDuration, bestHours, tips, hasEnoughData: sessions.length >= 3 };
}

/**
 * Generates a weekly report
 * @returns {Object} Weekly report data
 */
export function generateWeeklyReport() {
    const last7 = getLast7DaysData();
    const totalMinutes = last7.reduce((sum, d) => sum + d.minutes, 0);
    const sessions = getSessions().filter(s => s.mode === 'focus');
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    
    const weekSessions = sessions.filter(s => s.completedAt >= weekAgo.getTime());
    const dateRange = `${formatDateDisplay(weekAgo.getTime())} - ${formatDateDisplay(today.getTime())}`;
    
    let bestDay = { date: '', minutes: 0, label: 'None' };
    last7.forEach(d => {
        if (d.minutes > bestDay.minutes) {
            bestDay = d;
        }
    });

    const tags = getTagDistribution();
    const topTag = tags.length > 0 ? tags[0] : { tag: 'None', minutes: 0 };

    const qualitySessions = weekSessions.filter(s => typeof s.focusQuality === 'number' && s.focusQuality > 0);
    const avgQuality = qualitySessions.length > 0 
      ? (qualitySessions.reduce((sum, s) => sum + s.focusQuality, 0) / qualitySessions.length) 
      : 0;

    return {
        dateRange,
        totalHours: (totalMinutes / 60).toFixed(1),
        totalSessions: weekSessions.length,
        bestDay,
        currentStreak: getStreakData().current,
        topTag: { name: topTag.tag, minutes: topTag.minutes },
        avgQuality: avgQuality > 0 ? avgQuality.toFixed(1) : 'N/A',
        dailyAverage: Math.round(totalMinutes / 7)
    };
}

/**
 * Renders the weekly report card on a canvas
 * @returns {string} Data URL of the generated image
 */
export function renderWeeklyReportCard() {
    const canvas = document.getElementById('report-canvas') || document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    const report = generateWeeklyReport();

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 600, 400);
    gradient.addColorStop(0, '#1e293b');
    gradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 600, 400);

    // Accent line at top
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(0, 0, 600, 6);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    
    // Title
    ctx.font = 'bold 28px -apple-system, sans-serif';
    ctx.fillText('🍅 FocusFlow Weekly Report', 300, 55);

    // Date range
    ctx.font = '14px -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(report.dateRange, 300, 85);

    // Grid coordinates
    const startX = 110;
    const startY = 145;
    const colWidth = 190;
    const rowHeight = 90;

    const drawStat = (title, value, x, y) => {
        // Card background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.roundRect(x - 80, y - 25, 160, 70, 8);
        ctx.fill();

        ctx.font = '12px -apple-system, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(title, x, y);
        ctx.font = 'bold 22px -apple-system, sans-serif';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(value, x, y + 28);
    };

    drawStat('Total Focus Time', `${report.totalHours} hrs`, startX, startY);
    drawStat('Sessions Completed', `${report.totalSessions}`, startX + colWidth, startY);
    drawStat('Best Focus Day', `${report.bestDay.label} (${Math.round(report.bestDay.minutes/60*10)/10}h)`, startX + colWidth * 2, startY);

    drawStat('Current Streak', `${report.currentStreak} days`, startX, startY + rowHeight);
    drawStat('Top Category', report.topTag.name, startX + colWidth, startY + rowHeight);
    drawStat('Average Focus Quality', typeof report.avgQuality === 'string' && report.avgQuality !== 'N/A' ? `${report.avgQuality} / 5 ⭐` : 'N/A', startX + colWidth * 2, startY + rowHeight);

    // Branding Footer
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Generated by FocusFlow • Productive Habits Tracker', 300, 365);

    return canvas.toDataURL('image/png');
}

function renderStatCards() {
    const today = getTodayStats();
    const streak = getStreakData();
    const totalHours = getTotalFocusHours();

    const todayTimeEl = document.getElementById('stat-today-time');
    const todaySessionsEl = document.getElementById('stat-today-sessions');
    const streakEl = document.getElementById('stat-streak');
    const bestStreakEl = document.getElementById('stat-best-streak');
    const totalEl = document.getElementById('stat-total');

    const hrs = Math.floor(today.focusTime / 3600);
    const mins = Math.round((today.focusTime % 3600) / 60);

    if (todayTimeEl) todayTimeEl.textContent = `${hrs}h ${mins}m`;
    if (todaySessionsEl) todaySessionsEl.textContent = today.sessions;
    if (streakEl) streakEl.textContent = `${streak.current} day${streak.current === 1 ? '' : 's'}`;
    if (bestStreakEl) bestStreakEl.textContent = `${streak.best} day${streak.best === 1 ? '' : 's'}`;
    if (totalEl) totalEl.textContent = `${totalHours.toFixed(1)} hrs`;
}

function renderDailyGoal() {
    const today = getTodayStats();
    const settings = getSettings();
    const goal = settings.dailyGoal || 8;
    const progressBar = document.getElementById('daily-goal-bar') || document.getElementById('daily-goal-progress');
    const progressText = document.getElementById('daily-goal-text');
    
    if (progressBar) {
        const pct = Math.min(100, Math.round(today.goalProgress * 100));
        progressBar.style.width = `${pct}%`;
    }
    if (progressText) {
        progressText.textContent = `${today.sessions} / ${goal} sessions completed (${Math.round(today.goalProgress * 100)}%)`;
    }
}

function renderDistractionStats() {
    const container = document.getElementById('distraction-stats') || document.getElementById('distraction-list');
    if (!container) return;
    
    const data = getDistractionBreakdown();
    if (data.length === 0) {
        container.innerHTML = '<p class="text-sm text-secondary">No distractions recorded yet. Great focus!</p>';
        return;
    }
    
    let html = '<div class="distraction-bars">';
    data.forEach(d => {
        html += `
            <div class="distraction-row" style="display:flex; align-items:center; margin-bottom:8px;">
                <span style="width:110px; font-size:13px; text-transform:capitalize;">${d.reason.replace('_', ' ')}</span>
                <div style="flex:1; background:var(--color-bg-secondary); height:12px; border-radius:6px; margin:0 10px; overflow:hidden;">
                    <div style="width:${d.percentage}%; background:var(--color-primary); height:100%; border-radius:6px;"></div>
                </div>
                <span style="width:40px; font-size:12px; text-align:right; font-weight:600;">${d.count} (${d.percentage}%)</span>
            </div>
        `;
    });
    html += '</div>';
    
    if (data.length > 0 && data.tips && data.tips[data[0].reason]) {
        html += `<div style="margin-top:12px; padding:8px 12px; background:var(--color-bg-secondary); border-radius:var(--radius-sm); font-size:13px; color:var(--color-text);"><strong>💡 Tip:</strong> ${data.tips[data[0].reason]}</div>`;
    }
    container.innerHTML = html;
}

function renderFocusQualityStats() {
    const container = document.getElementById('focus-quality-stats') || document.getElementById('quality-hourly-chart');
    if (!container) return;
    
    const data = getFocusQualityByHour();
    if (data.length === 0) {
        container.innerHTML = '<p class="text-sm text-secondary">Rate your focus quality after sessions to see hourly trends.</p>';
        return;
    }
    
    let html = '<div style="display:flex; align-items:flex-end; height:120px; gap:6px; padding-top:10px;">';
    data.forEach(d => {
        const height = Math.max(10, (d.avgQuality / 5) * 100);
        html += `
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;" title="Hour ${d.hour}:00 - Quality: ${d.avgQuality.toFixed(1)}/5 (${d.sessionCount} sessions)">
                <div style="width:100%; height:${height}px; background:var(--color-primary); border-radius:4px 4px 0 0; opacity:${d.sessionCount >= 2 ? 1 : 0.65}"></div>
                <span style="font-size:10px; color:var(--color-text-secondary);">${d.hour}h</span>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function renderSmartSuggestions() {
    const container = document.getElementById('smart-suggestions') || document.getElementById('suggestions-list');
    if (!container) return;
    
    const suggestions = getSmartSuggestions();
    if (!suggestions.hasEnoughData) {
        container.innerHTML = '<p class="text-sm text-secondary">Complete a few more focus sessions to unlock personalized habit recommendations.</p>';
        return;
    }
    
    let html = '';
    html += `<div style="background:var(--color-bg-secondary); padding:10px 14px; border-radius:var(--radius-sm); margin-bottom:8px; font-size:14px;">
        ⏱️ <strong>Recommended Session Length:</strong> ${suggestions.idealDuration} minutes
    </div>`;
    
    if (suggestions.bestHours.length > 0) {
        const hoursStr = suggestions.bestHours.map(h => `${h}:00`).join(', ');
        html += `<div style="background:var(--color-bg-secondary); padding:10px 14px; border-radius:var(--radius-sm); margin-bottom:8px; font-size:14px;">
            ⚡ <strong>Your Most Productive Hours:</strong> ${hoursStr}
        </div>`;
    }
    
    suggestions.tips.forEach(tip => {
        html += `<div style="background:var(--color-bg-secondary); padding:10px 14px; border-radius:var(--radius-sm); margin-bottom:8px; border-left:4px solid var(--color-primary); font-size:14px;">
            ${tip}
        </div>`;
    });
    
    container.innerHTML = html;
}
