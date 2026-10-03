import { EventBus } from './utils.js';
import { getSettings, saveSettings } from './storage.js';
import { setVolume, playAlarm } from './audio.js';
import { requestPermission } from './notifications.js';

let settings = {};
let modal = null;

const DEFAULT_SETTINGS = {
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
};

/**
 * Initialize settings module
 */
export function initSettings() {
  settings = getSettings() || { ...DEFAULT_SETTINGS };
  modal = document.getElementById('settings-modal');
  
  const btnSettings = document.getElementById('btn-settings');
  const btnClose = document.getElementById('btn-close-settings');
  const btnReset = document.getElementById('btn-reset-settings') || document.getElementById('btn-reset-defaults');
  const btnTestSound = document.getElementById('btn-test-sound');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');

  if (btnSettings) btnSettings.addEventListener('click', openSettings);
  if (btnClose) btnClose.addEventListener('click', closeSettings);
  if (btnReset) btnReset.addEventListener('click', resetToDefaults);

  if (btnTestSound) {
    btnTestSound.addEventListener('click', () => {
      const alarmSound = settings.alarmSound || 'bell';
      setVolume(settings.volume);
      playAlarm(alarmSound);
    });
  }

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      settings.theme = newTheme;
      applyTheme(newTheme, settings.accentColor);
      saveSettings(settings);
      populateForm();
      EventBus.emit('settings:changed', { settings });
    });
  }
  
  applyTheme(settings.theme, settings.accentColor);
  setupFormListeners();
}

/**
 * Open the settings modal
 */
export function openSettings() {
  populateForm();
  if (modal && typeof modal.showModal === 'function') {
    modal.showModal();
  }
}

/**
 * Close the settings modal
 */
export function closeSettings() {
  if (modal && typeof modal.close === 'function') {
    modal.close();
  }
}

/**
 * Apply theme and accent color to document
 * @param {string} theme 
 * @param {string} accent 
 */
export function applyTheme(theme, accent) {
  if (theme === 'system') {
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    
    if (!window.__themeChangeListenerSetup) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (settings.theme === 'system') {
          document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
      });
      window.__themeChangeListenerSetup = true;
    }
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  
  document.documentElement.setAttribute('data-accent', accent || 'tomato');
  
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    const colorMap = {
      tomato: '#e74c3c',
      ocean: '#3498db',
      forest: '#27ae60',
      purple: '#9b59b6'
    };
    metaThemeColor.setAttribute('content', colorMap[accent] || '#e74c3c');
  }
  
  EventBus.emit('theme:changed', { theme, accent });
}

/**
 * Reset settings to defaults
 */
export function resetToDefaults() {
  if (confirm('Are you sure you want to reset all settings to their defaults?')) {
    settings = { ...DEFAULT_SETTINGS };
    saveSettings(settings);
    populateForm();
    applyTheme(settings.theme, settings.accentColor);
    setVolume(settings.volume);
    EventBus.emit('settings:changed', { settings });
  }
}

/**
 * Setup listeners for all form inputs
 */
function setupFormListeners() {
  const ids = [
    'setting-focus-duration', 'setting-short-break', 'setting-long-break',
    'setting-sessions-count', 'setting-sessions-interval', 
    'setting-auto-start-breaks', 'setting-auto-start-focus',
    'setting-sound', 'setting-sound-enabled', 'setting-tick-sound', 'setting-notifications',
    'setting-volume', 'setting-alarm-sound',
    'setting-theme-light', 'setting-theme-dark', 'setting-theme-system',
    'setting-daily-goal'
  ];
  
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    
    el.addEventListener('change', (e) => {
      handleSettingChange(e.target);
    });
  });
  
  const volumeSlider = document.getElementById('setting-volume');
  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value) / 100;
      settings.volume = Math.max(0, Math.min(1, vol));
      setVolume(settings.volume);
    });
    volumeSlider.addEventListener('change', () => {
      saveSettings(settings);
      EventBus.emit('settings:changed', { settings });
    });
  }

  // Accent color buttons
  const colorBtns = document.querySelectorAll('.color-btn');
  colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      colorBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const color = btn.dataset.color ? btn.dataset.color.toLowerCase() : 'tomato';
      settings.accentColor = color;
      applyTheme(settings.theme, settings.accentColor);
      saveSettings(settings);
      EventBus.emit('settings:changed', { settings });
    });
  });

  // Radio button groups for theme
  const themeRadios = document.querySelectorAll('input[name="theme"]');
  themeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        settings.theme = e.target.value.toLowerCase();
        applyTheme(settings.theme, settings.accentColor);
        saveSettings(settings);
        EventBus.emit('settings:changed', { settings });
      }
    });
  });
}

/**
 * Handle individual setting change
 * @param {HTMLElement} el 
 */
function handleSettingChange(el) {
  if (el.id === 'setting-focus-duration') settings.focusDuration = Math.max(1, Math.min(120, parseInt(el.value, 10) || 25));
  else if (el.id === 'setting-short-break') settings.shortBreakDuration = Math.max(1, Math.min(60, parseInt(el.value, 10) || 5));
  else if (el.id === 'setting-long-break') settings.longBreakDuration = Math.max(1, Math.min(60, parseInt(el.value, 10) || 15));
  else if (el.id === 'setting-sessions-count' || el.id === 'setting-sessions-interval') settings.sessionsBeforeLongBreak = Math.max(2, Math.min(8, parseInt(el.value, 10) || 4));
  else if (el.id === 'setting-auto-start-breaks') settings.autoStartBreaks = el.checked;
  else if (el.id === 'setting-auto-start-focus') settings.autoStartFocus = el.checked;
  else if (el.id === 'setting-sound' || el.id === 'setting-sound-enabled') settings.soundEnabled = el.checked;
  else if (el.id === 'setting-tick-sound') settings.tickSoundEnabled = el.checked;
  else if (el.id === 'setting-notifications') {
    settings.notificationsEnabled = el.checked;
    if (el.checked) requestPermission();
  }
  else if (el.id === 'setting-alarm-sound') settings.alarmSound = el.value.toLowerCase();
  else if (el.name === 'theme' && el.checked) {
    settings.theme = el.value.toLowerCase();
    applyTheme(settings.theme, settings.accentColor);
  }
  else if (el.id === 'setting-daily-goal') settings.dailyGoal = Math.max(1, Math.min(20, parseInt(el.value, 10) || 8));
  
  saveSettings(settings);
  EventBus.emit('settings:changed', { settings });
}

/**
 * Populate form inputs from current settings
 */
function populateForm() {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  const setCheck = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = val;
  };
  
  setVal('setting-focus-duration', settings.focusDuration);
  setVal('setting-short-break', settings.shortBreakDuration);
  setVal('setting-long-break', settings.longBreakDuration);
  setVal('setting-sessions-count', settings.sessionsBeforeLongBreak);
  setVal('setting-sessions-interval', settings.sessionsBeforeLongBreak);
  
  setCheck('setting-auto-start-breaks', settings.autoStartBreaks);
  setCheck('setting-auto-start-focus', settings.autoStartFocus);
  setCheck('setting-sound', settings.soundEnabled);
  setCheck('setting-sound-enabled', settings.soundEnabled);
  setCheck('setting-tick-sound', settings.tickSoundEnabled);
  setCheck('setting-notifications', settings.notificationsEnabled);
  
  const volumeSlider = document.getElementById('setting-volume');
  if (volumeSlider) {
    volumeSlider.value = Math.round((settings.volume || 0.7) * 100);
  }

  setVal('setting-alarm-sound', (settings.alarmSound || 'bell').toLowerCase());
  setVal('setting-daily-goal', settings.dailyGoal || 8);
  
  const themeRadio = document.querySelector(`input[name="theme"][value="${settings.theme}"]`) || document.getElementById(`setting-theme-${settings.theme}`);
  if (themeRadio) themeRadio.checked = true;
  
  document.querySelectorAll('.color-btn').forEach(btn => {
    const color = btn.dataset.color ? btn.dataset.color.toLowerCase() : '';
    btn.classList.toggle('active', color === (settings.accentColor || 'tomato').toLowerCase());
  });
}
