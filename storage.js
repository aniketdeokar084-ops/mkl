import { EventBus } from './utils.js';

const STORAGE_KEY = 'focusflow_data';
const CURRENT_VERSION = 1;

const DEFAULT_STATE = {
  version: 1,
  settings: {
    focusDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsBeforeLongBreak: 4,
    autoStartBreaks: false,
    autoStartFocus: false,
    soundEnabled: true,
    tickSoundEnabled: false,
    notificationsEnabled: false,
    volume: 0.7,
    alarmSound: 'bell',
    theme: 'system',
    accentColor: 'tomato',
    dailyGoal: 8,
  },
  tasks: [],
  activeTaskId: null,
  sessions: [],
  distractions: [],
  completedFocusCount: 0,
  timerState: {
    mode: 'focus',
    status: 'idle',
    remaining: 1500,
    total: 1500,
    startTimestamp: null,
    pausedAt: null,
  }
};

/**
 * @param {Object} state
 * @returns {Object}
 */
function migrate(state) {
  if (state.version !== CURRENT_VERSION) {
    // Future migrations go here
    state.version = CURRENT_VERSION;
  }
  return state;
}

/**
 * Deep merge objects
 */
function deepMerge(target, source) {
  if (!source) return target;
  for (const key in source) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key]) && key in target) {
      target[key] = deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

/**
 * @returns {Object}
 */
export function loadState() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return JSON.parse(JSON.stringify(DEFAULT_STATE));
    let parsed = JSON.parse(data);
    parsed = migrate(parsed);
    const merged = deepMerge(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed);
    return merged;
  } catch (e) {
    console.error('Error loading state, returning defaults:', e);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

/**
 * @param {Object} state
 */
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Error saving state:', e);
  }
}

export function getSettings() {
  return loadState().settings;
}

export function saveSettings(settings) {
  try {
    const state = loadState();
    state.settings = { ...state.settings, ...settings };
    saveState(state);
    EventBus.emit('settings:changed', { settings: state.settings });
  } catch (e) {
    console.error('Error saving settings:', e);
  }
}

export function getTasks() {
  return loadState().tasks;
}

export function saveTasks(tasks) {
  try {
    const state = loadState();
    state.tasks = tasks;
    saveState(state);
  } catch (e) {
    console.error('Error saving tasks:', e);
  }
}

export function getActiveTaskId() {
  return loadState().activeTaskId;
}

export function setActiveTaskId(id) {
  try {
    const state = loadState();
    state.activeTaskId = id;
    saveState(state);
  } catch (e) {
    console.error('Error setting active task ID:', e);
  }
}

export function getSessions() {
  return loadState().sessions;
}

export function addSession(session) {
  try {
    const state = loadState();
    state.sessions.push(session);
    saveState(state);
    EventBus.emit('session:logged', { session });
  } catch (e) {
    console.error('Error adding session:', e);
  }
}

export function getDistractions() {
  return loadState().distractions;
}

export function addDistraction(distraction) {
  try {
    const state = loadState();
    state.distractions.push(distraction);
    saveState(state);
    EventBus.emit('distraction:logged', { distraction });
  } catch (e) {
    console.error('Error adding distraction:', e);
  }
}

export function getTimerState() {
  return loadState().timerState;
}

export function saveTimerState(timerState) {
  try {
    const state = loadState();
    state.timerState = { ...state.timerState, ...timerState };
    saveState(state);
  } catch (e) {
    console.error('Error saving timer state:', e);
  }
}

export function getCompletedFocusCount() {
  return loadState().completedFocusCount;
}

export function setCompletedFocusCount(count) {
  try {
    const state = loadState();
    state.completedFocusCount = count;
    saveState(state);
  } catch (e) {
    console.error('Error setting completed focus count:', e);
  }
}

export function exportData() {
  return JSON.stringify(loadState(), null, 2);
}

export function importData(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!('version' in data) || !('settings' in data) || !('tasks' in data) || !('sessions' in data)) {
      throw new Error('Invalid data structure');
    }
    const migrated = migrate(data);
    saveState(migrated);
    EventBus.emit('data:imported', {});
  } catch (e) {
    console.error('Error importing data:', e);
    throw e;
  }
}

export function clearAllData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    const defaults = JSON.parse(JSON.stringify(DEFAULT_STATE));
    EventBus.emit('data:cleared', {});
    return defaults;
  } catch (e) {
    console.error('Error clearing data:', e);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

export function exportCSV() {
  try {
    const state = loadState();
    const sessions = state.sessions;
    const tasks = state.tasks;
    
    let csv = 'Date,Start Time,End Time,Mode,Duration (min),Task,Tag,Focus Quality\n';
    
    sessions.forEach(session => {
      const startDate = new Date(session.startedAt);
      const endDate = new Date(session.completedAt);
      
      const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
      const startStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
      const endStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
      const mode = session.mode;
      const durationMin = (session.duration / 60).toFixed(2);
      
      let taskName = '';
      let tag = '';
      if (session.taskId) {
        const task = tasks.find(t => t.id === session.taskId);
        if (task) {
          taskName = `"${task.title.replace(/"/g, '""')}"`;
          tag = task.tag || '';
        }
      }
      
      const quality = session.focusQuality || '';
      
      csv += `${dateStr},${startStr},${endStr},${mode},${durationMin},${taskName},${tag},${quality}\n`;
    });
    
    return csv;
  } catch (e) {
    console.error('Error exporting CSV:', e);
    return '';
  }
}
