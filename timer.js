import { EventBus, formatTime, announce } from './utils.js';
import { getSettings, saveTimerState, getTimerState, getCompletedFocusCount, setCompletedFocusCount, addSession, getActiveTaskId, getTasks } from './storage.js';
import { playAlarm, playTick } from './audio.js';
import { sendNotification } from './notifications.js';

let timerInterval = null;
let mode = 'focus';       // 'focus' | 'shortBreak' | 'longBreak'
let status = 'idle';      // 'idle' | 'running' | 'paused'
let remaining = 1500;     // seconds
let total = 1500;
let startTimestamp = null; // Date.now() when started/resumed
let remainingAtStart = 1500;
let sessionStartTime = null; // Date.now() when session first started

let elTimerTime, elTimerLabel, elRingProgress, elSessionDots, elBtnStart, elBtnPause, elBtnReset, elBtnSkip, elBtnDistraction, elActiveTaskName, modeButtons;

/**
 * Update the active task text display in the timer
 * @param {Object|null} task 
 */
function updateActiveTaskDisplay(task) {
  if (!elActiveTaskName) elActiveTaskName = document.getElementById('active-task-name');
  if (!elActiveTaskName) return;

  if (task && task.title) {
    elActiveTaskName.textContent = task.title;
  } else {
    const activeId = getActiveTaskId();
    const tasks = getTasks() || [];
    const active = tasks.find(t => t.id === activeId && !t.completed);
    elActiveTaskName.textContent = active ? active.title : 'No task selected';
  }
}

/**
 * Initialize timer module
 */
export function initTimer() {
  const savedState = getTimerState();
  const settings = getSettings();
  
  if (savedState) {
    mode = savedState.mode || 'focus';
    status = savedState.status || 'idle';
    remaining = typeof savedState.remaining === 'number' ? savedState.remaining : 1500;
    total = typeof savedState.total === 'number' ? savedState.total : 1500;
    startTimestamp = savedState.startTimestamp;
  } else {
    total = (settings.focusDuration || 25) * 60;
    remaining = total;
  }

  elTimerTime = document.getElementById('timer-time');
  elTimerLabel = document.getElementById('timer-label');
  elRingProgress = document.getElementById('ring-progress');
  elSessionDots = document.getElementById('session-dots');
  elBtnStart = document.getElementById('btn-start');
  elBtnPause = document.getElementById('btn-pause');
  elBtnReset = document.getElementById('btn-reset');
  elBtnSkip = document.getElementById('btn-skip');
  elBtnDistraction = document.getElementById('btn-distraction');
  elActiveTaskName = document.getElementById('active-task-name');
  modeButtons = document.querySelectorAll('.mode-selector button, .mode-btn');

  if (elBtnStart) elBtnStart.addEventListener('click', startTimer);
  if (elBtnPause) elBtnPause.addEventListener('click', pauseTimer);
  if (elBtnReset) elBtnReset.addEventListener('click', resetTimer);
  if (elBtnSkip) elBtnSkip.addEventListener('click', skipTimer);
  
  if (elBtnDistraction) {
    elBtnDistraction.addEventListener('click', () => {
      const modal = document.getElementById('distraction-modal');
      if (modal && typeof modal.showModal === 'function') {
        modal.showModal();
      }
    });
  }

  if (modeButtons && modeButtons.length > 0) {
    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const newMode = btn.dataset.mode;
        if (newMode && newMode !== mode) setMode(newMode);
      });
    });
  }

  EventBus.on('settings:changed', (data) => {
    if (status === 'idle') {
      const s = data.settings || getSettings();
      if (mode === 'focus') total = s.focusDuration * 60;
      else if (mode === 'shortBreak') total = s.shortBreakDuration * 60;
      else if (mode === 'longBreak') total = s.longBreakDuration * 60;
      remaining = total;
      updateDisplay();
    }
  });

  EventBus.on('task:selected', (data) => {
    updateActiveTaskDisplay(data ? data.task : null);
  });

  EventBus.on('task:updated', () => {
    updateActiveTaskDisplay();
  });

  EventBus.on('task:deleted', () => {
    updateActiveTaskDisplay();
  });

  EventBus.on('tasks:cleared', () => {
    updateActiveTaskDisplay();
  });

  updateActiveTaskDisplay();
  updateModeUI();
  updateSessionDots();
  updateDisplay();
  updateButtons();

  if (status === 'running') {
    if (startTimestamp) {
      const elapsed = (Date.now() - startTimestamp) / 1000;
      remaining = Math.max(0, remaining - elapsed);
    }
    remainingAtStart = remaining;
    startTimestamp = Date.now();
    startTimerInterval();
  }
}

/**
 * Start or resume the timer
 */
export function startTimer() {
  if (status === 'idle') {
    sessionStartTime = Date.now();
  }
  
  status = 'running';
  startTimestamp = Date.now();
  remainingAtStart = remaining;
  
  startTimerInterval();
  updateButtons();
  
  if (mode === 'focus' && elBtnDistraction) {
    elBtnDistraction.style.display = 'inline-flex';
  }

  EventBus.emit(status === 'idle' ? 'timer:start' : 'timer:resume', { mode, total, remaining });
  saveState();
  updateDisplay();
}

/**
 * Pause the timer
 */
export function pauseTimer() {
  if (status !== 'running') return;
  
  remaining = Math.max(0, remainingAtStart - (Date.now() - startTimestamp) / 1000);
  startTimestamp = null;
  status = 'paused';
  
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  
  updateButtons();
  EventBus.emit('timer:pause', { mode, remaining });
  saveState();
  updateDisplay();
}

/**
 * Resume the timer (alias for startTimer)
 */
export function resumeTimer() {
  startTimer();
}

/**
 * Reset the timer to original duration
 */
export function resetTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  
  const settings = getSettings();
  if (mode === 'focus') total = settings.focusDuration * 60;
  else if (mode === 'shortBreak') total = settings.shortBreakDuration * 60;
  else if (mode === 'longBreak') total = settings.longBreakDuration * 60;
  
  remaining = total;
  status = 'idle';
  startTimestamp = null;
  
  updateButtons();
  updateDisplay();
  
  if (elBtnDistraction) elBtnDistraction.style.display = 'none';
  
  EventBus.emit('timer:reset', { mode });
  saveState();
}

/**
 * Skip current session
 */
export function skipTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  status = 'idle';
  
  EventBus.emit('timer:skip', { mode });
  moveToNextMode(false);
}

/**
 * Change timer mode manually
 * @param {string} newMode 
 */
export function setMode(newMode) {
  if (status === 'running') {
    if (!confirm('Are you sure you want to switch modes? The current session will be reset.')) {
      return;
    }
  }
  
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  
  mode = newMode;
  status = 'idle';
  
  const settings = getSettings();
  if (mode === 'focus') total = (settings.focusDuration || 25) * 60;
  else if (mode === 'shortBreak') total = (settings.shortBreakDuration || 5) * 60;
  else if (mode === 'longBreak') total = (settings.longBreakDuration || 15) * 60;
  
  remaining = total;
  
  updateModeUI();
  updateButtons();
  updateDisplay();
  
  if (elBtnDistraction) {
    elBtnDistraction.style.display = 'none';
  }

  EventBus.emit('mode:change', { mode, duration: total });
  saveState();
}

/**
 * Get current timer status
 * @returns {Object} status object with current status and isRunning flag
 */
export function getTimerStatus() {
  return {
    status,
    isRunning: status === 'running',
    mode,
    remaining,
    total
  };
}

function startTimerInterval() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const elapsed = (Date.now() - startTimestamp) / 1000;
    remaining = Math.max(0, remainingAtStart - elapsed);
    
    updateDisplay();
    
    const settings = getSettings();
    if (settings.tickSoundEnabled && mode === 'focus' && remaining > 0) {
      if (Math.floor(remaining) !== Math.floor(remaining + 0.1)) {
        playTick();
      }
    }
    
    if (remaining <= 0) {
      onTimerComplete();
    }
  }, 100);
}

function onTimerComplete() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  
  const settings = getSettings();
  if (settings.soundEnabled) {
    playAlarm(settings.alarmSound || 'bell');
  }
  
  const modeLabels = { focus: 'Focus Session', shortBreak: 'Short Break', longBreak: 'Long Break' };
  if (settings.notificationsEnabled) {
    sendNotification('FocusFlow Timer Finished', `${modeLabels[mode]} complete! Time for a break.`);
  }
  
  const actualDuration = (Date.now() - (sessionStartTime || Date.now())) / 1000;
  const session = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
    mode,
    duration: Math.round(actualDuration > 0 ? actualDuration : total),
    plannedDuration: total,
    startedAt: sessionStartTime || Date.now() - total * 1000,
    completedAt: Date.now(),
    taskId: mode === 'focus' ? getActiveTaskId() : null,
    focusQuality: null
  };
  
  addSession(session);
  EventBus.emit('session:logged', { session });
  
  moveToNextMode(true);
  announce(`${modeLabels[mode]} complete`);
}

function moveToNextMode(completed) {
  const settings = getSettings();
  
  if (mode === 'focus') {
    if (completed) {
      let focusCount = getCompletedFocusCount() + 1;
      setCompletedFocusCount(focusCount);
      
      const taskId = getActiveTaskId();
      EventBus.emit('timer:complete', { mode, duration: total, taskId });
      
      const qModal = document.getElementById('quality-modal');
      if (qModal && typeof qModal.showModal === 'function') {
        qModal.showModal();
      }
      
      if (focusCount >= settings.sessionsBeforeLongBreak) {
        setMode('longBreak');
        setCompletedFocusCount(0);
      } else {
        setMode('shortBreak');
      }
    } else {
      setMode('shortBreak');
    }
    
    if (settings.autoStartBreaks && completed) {
      setTimeout(startTimer, 1500);
    }
  } else {
    setMode('focus');
    if (settings.autoStartFocus && completed) {
      setTimeout(startTimer, 1500);
    }
  }
  
  updateSessionDots();
}

function updateDisplay() {
  const formattedTime = formatTime(Math.ceil(remaining));
  if (elTimerTime) elTimerTime.textContent = formattedTime;
  
  const progress = calculateProgress(remaining, total);
  const circumference = 2 * Math.PI * 105;
  const strokeOffset = circumference * (1 - progress);

  if (elRingProgress) {
    elRingProgress.style.strokeDashoffset = strokeOffset;
  }
  
  // Sync focus mode overlay timer if open
  const focusTimeEl = document.getElementById('focus-timer-time');
  const focusRingEl = document.getElementById('focus-ring-progress');
  if (focusTimeEl) focusTimeEl.textContent = formattedTime;
  if (focusRingEl) focusRingEl.style.strokeDashoffset = strokeOffset;

  const modeLabels = { focus: 'Focus', shortBreak: 'Short Break', longBreak: 'Long Break' };
  const label = modeLabels[mode] || 'Focus';
  if (elTimerLabel) elTimerLabel.textContent = label;
  
  const focusLabelEl = document.getElementById('focus-timer-label');
  if (focusLabelEl) focusLabelEl.textContent = label;

  document.title = `${formattedTime} - ${label} | FocusFlow`;
  
  EventBus.emit('timer:tick', { mode, remaining, total, progress, timeFormatted: formattedTime });
}

function updateButtons() {
  if (!elBtnStart || !elBtnPause || !elBtnReset || !elBtnSkip) return;
  
  if (status === 'running') {
    elBtnStart.style.display = 'none';
    elBtnPause.style.display = 'inline-flex';
    elBtnReset.disabled = false;
    elBtnSkip.disabled = false;
  } else if (status === 'paused') {
    elBtnStart.style.display = 'inline-flex';
    elBtnPause.style.display = 'none';
    elBtnReset.disabled = false;
    elBtnSkip.disabled = false;
  } else {
    elBtnStart.style.display = 'inline-flex';
    elBtnPause.style.display = 'none';
    elBtnReset.disabled = true;
    elBtnSkip.disabled = true;
  }
}

function updateModeUI() {
  modeButtons = document.querySelectorAll('.mode-selector button, .mode-btn');
  if (modeButtons && modeButtons.length > 0) {
    modeButtons.forEach(btn => {
      if (btn.dataset.mode === mode) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }
  document.body.className = `mode-${mode}`;
}

function updateSessionDots() {
  if (!elSessionDots) elSessionDots = document.getElementById('session-dots');
  if (!elSessionDots) return;

  const settings = getSettings();
  const count = getCompletedFocusCount();
  const totalDots = settings.sessionsBeforeLongBreak || 4;
  
  elSessionDots.innerHTML = '';
  for (let i = 0; i < totalDots; i++) {
    const dot = document.createElement('div');
    dot.className = `session-dot ${i < count ? 'completed' : (i === count && mode === 'focus' ? 'active' : '')}`;
    dot.title = `Session ${i + 1} of ${totalDots}`;
    elSessionDots.appendChild(dot);
  }
}

function saveState() {
  saveTimerState({
    mode,
    status,
    remaining,
    total,
    startTimestamp
  });
}

/**
 * Pure function to calculate progress
 * @param {number} rem 
 * @param {number} tot 
 * @returns {number} 0 to 1
 */
export function calculateProgress(rem, tot) {
  if (tot <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - (rem / tot)));
}

/**
 * Get next mode
 * @param {string} currentMode 
 * @param {number} focusCount 
 * @param {number} sessionsBeforeLong 
 * @returns {string} next mode
 */
export function getNextMode(currentMode, focusCount, sessionsBeforeLong) {
  if (currentMode === 'focus') {
    return focusCount >= sessionsBeforeLong ? 'longBreak' : 'shortBreak';
  }
  return 'focus';
}

/**
 * Calculate streak data
 * @param {Array} sessions 
 * @returns {Object} {current, best}
 */
export function calculateStreak(sessions) {
  if (!sessions || !Array.isArray(sessions)) return { current: 0, best: 0 };
  const focusSessions = sessions.filter(s => s.mode === 'focus');
  if (focusSessions.length === 0) return { current: 0, best: 0 };
  
  const dates = [...new Set(focusSessions.map(s => {
    const d = new Date(s.completedAt);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }))].sort().reverse();
  
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  
  let current = 0;
  let checkDate = new Date(today);
  
  if (dates[0] !== todayStr) {
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth()+1).padStart(2,'0')}-${String(checkDate.getDate()).padStart(2,'0')}`;
    if (dates[0] !== yesterdayStr) return { current: 0, best: findBestStreak(dates) };
  }
  
  for (const dateStr of dates) {
    const expected = `${checkDate.getFullYear()}-${String(checkDate.getMonth()+1).padStart(2,'0')}-${String(checkDate.getDate()).padStart(2,'0')}`;
    if (dateStr === expected) {
      current++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (dateStr < expected) {
      break;
    }
  }
  
  return { current, best: Math.max(current, findBestStreak(dates)) };
}

function findBestStreak(sortedDatesDesc) {
  if (!sortedDatesDesc || sortedDatesDesc.length === 0) return 0;
  let best = 1;
  let current = 1;
  let checkDate = new Date(sortedDatesDesc[0]);
  
  for (let i = 1; i < sortedDatesDesc.length; i++) {
    checkDate.setDate(checkDate.getDate() - 1);
    const expected = `${checkDate.getFullYear()}-${String(checkDate.getMonth()+1).padStart(2,'0')}-${String(checkDate.getDate()).padStart(2,'0')}`;
    if (sortedDatesDesc[i] === expected) {
      current++;
      if (current > best) best = current;
    } else {
      current = 1;
      checkDate = new Date(sortedDatesDesc[i]);
    }
  }
  return best;
}
