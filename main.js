import { EventBus, generateId } from './utils.js';
import { loadState, getSettings, getActiveTaskId, getTasks, getSessions, addDistraction, exportCSV, exportData, importData, clearAllData, saveState } from './storage.js';
import { initAudio, playAlarm, startAmbient, stopAmbient, setAmbientVolume } from './audio.js';
import { initNotifications } from './notifications.js';
import { initTimer, startTimer, pauseTimer, resetTimer, skipTimer, setMode, getTimerStatus } from './timer.js';
import { initTasks, setActiveTask } from './tasks.js';
import { initSettings, applyTheme } from './settings.js';
import { initStats, renderWeeklyReportCard } from './stats.js';
import { initCharts, updateCharts } from './charts.js';

document.addEventListener('DOMContentLoaded', () => {
  // Load state from localStorage
  loadState();
  
  // AudioContext unlock after first user gesture (satisfies browser autoplay policies)
  let audioInitialized = false;
  function ensureAudio() {
    if (!audioInitialized) {
      initAudio();
      audioInitialized = true;
    }
  }
  document.addEventListener('click', ensureAudio, { once: true });
  document.addEventListener('keydown', ensureAudio, { once: true });
  
  // Initialize modular subsystems
  initNotifications();
  initSettings();
  initTimer();
  initTasks();
  initStats();
  
  // Wire interactive features
  setupTabNavigation();
  setupKeyboardShortcuts();
  setupInstallPrompt();
  setupConfetti();
  setupFocusMode();
  setupWeeklyReport();
  setupDataManagement();
  setupDistractionModal();
  setupQualityModal();
  setupModalDismissals();
  
  // Service Worker Registration for Offline PWA support
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then(reg => console.log('FocusFlow SW registered:', reg.scope))
        .catch(err => console.warn('FocusFlow SW registration failed:', err));
    });
  }
});

/**
 * Configure tab bar switching between Timer, Tasks, and Stats
 */
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('[role="tabpanel"], .panel');
  let chartsInitialized = false;

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      
      tabButtons.forEach(b => {
        const isMatch = b === btn;
        b.setAttribute('aria-selected', isMatch ? 'true' : 'false');
        b.classList.toggle('active', isMatch);
      });
      
      tabPanels.forEach(panel => {
        const isActive = panel.id === `panel-${target}` || panel.id === target;
        panel.classList.toggle('active', isActive);
        if (isActive) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', '');
        }
      });

      // Lazy-init charts on first stats tab viewing
      if (target === 'stats') {
        if (!chartsInitialized) {
          initCharts();
          chartsInitialized = true;
        } else {
          updateCharts();
        }
      }
    });
  });
}

/**
 * Set up application-wide keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore keystrokes when focused in inputs, textareas, or selects
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      return;
    }
    
    switch (e.key) {
      case ' ':
        e.preventDefault();
        const status = getTimerStatus();
        if (status.isRunning) pauseTimer();
        else startTimer();
        break;
      case 'r':
      case 'R':
        resetTimer();
        break;
      case 's':
      case 'S':
        skipTimer();
        break;
      case 'n':
      case 'N':
        e.preventDefault();
        const tabTasksBtn = document.querySelector('.tab-btn[data-tab="tasks"]');
        if (tabTasksBtn) tabTasksBtn.click();
        const taskInput = document.getElementById('task-input');
        if (taskInput) {
          setTimeout(() => taskInput.focus(), 50);
        }
        break;
      case 'f':
      case 'F':
        toggleFocusMode();
        break;
      case '?':
        const shortcutsModal = document.getElementById('shortcuts-modal');
        if (shortcutsModal && typeof shortcutsModal.showModal === 'function') {
          shortcutsModal.showModal();
        }
        break;
      case 'Escape':
        const overlay = document.getElementById('focus-mode-overlay');
        if (overlay && !overlay.hasAttribute('hidden') && overlay.classList.contains('active')) {
          exitFocusMode();
        }
        document.querySelectorAll('dialog[open]').forEach(d => d.close());
        break;
      case '1':
        setMode('focus');
        break;
      case '2':
        setMode('shortBreak');
        break;
      case '3':
        setMode('longBreak');
        break;
    }
  });
}

/**
 * Handle PWA beforeinstallprompt
 */
function setupInstallPrompt() {
  let deferredPrompt;
  const installBtn = document.getElementById('btn-install');
  if (!installBtn) return;
  
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.removeAttribute('hidden');
    installBtn.style.display = 'inline-flex';
  });
  
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      installBtn.style.display = 'none';
    }
    deferredPrompt = null;
  });
}

/**
 * Setup session completion celebratory confetti
 */
function setupConfetti() {
  EventBus.on('timer:complete', (data) => {
    if (data.mode === 'focus') {
      triggerConfetti();
    }
  });
}

function triggerConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  
  const particles = [];
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#ff7675'];
  
  for (let i = 0; i < 65; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 50,
      w: Math.random() * 10 + 6,
      h: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 2.5,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 8,
      opacity: 1,
    });
  }
  
  let frame = 0;
  const maxFrames = 130;
  
  function animate() {
    if (frame >= maxFrames) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.rotation += p.rotationSpeed;
      p.opacity = Math.max(0, 1 - (frame / maxFrames));
      
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    
    frame++;
    requestAnimationFrame(animate);
  }
  
  requestAnimationFrame(animate);
}

/**
 * Configure distraction-free Focus Mode
 */
function setupFocusMode() {
  const overlay = document.getElementById('focus-mode-overlay');
  const enterBtn = document.getElementById('btn-focus-mode');
  const exitBtn = document.getElementById('btn-exit-focus');
  const taskDisplay = document.getElementById('focus-task-name');
  const ambientSelect = document.getElementById('ambient-sound-select');
  const ambientVolume = document.getElementById('ambient-volume');

  if (enterBtn) enterBtn.addEventListener('click', toggleFocusMode);
  if (exitBtn) exitBtn.addEventListener('click', exitFocusMode);

  if (ambientSelect) {
    ambientSelect.addEventListener('change', (e) => {
      const type = e.target.value.toLowerCase().replace(' ', '');
      if (type === 'none' || !type) {
        stopAmbient();
      } else {
        startAmbient(type);
      }
    });
  }

  if (ambientVolume) {
    ambientVolume.addEventListener('input', (e) => {
      setAmbientVolume(parseFloat(e.target.value) / 100);
    });
  }

  EventBus.on('task:selected', (data) => {
    if (taskDisplay) {
      taskDisplay.textContent = (data && data.task && data.task.title) ? data.task.title : 'No active task';
    }
  });
}

function toggleFocusMode() {
  const overlay = document.getElementById('focus-mode-overlay');
  if (!overlay) return;

  if (overlay.classList.contains('active') && !overlay.hasAttribute('hidden')) {
    exitFocusMode();
  } else {
    enterFocusMode();
  }
}

function enterFocusMode() {
  const overlay = document.getElementById('focus-mode-overlay');
  if (!overlay) return;

  overlay.removeAttribute('hidden');
  overlay.classList.add('active');
  
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
  
  // Sync current active task
  const activeId = getActiveTaskId();
  const tasks = getTasks() || [];
  const activeTask = tasks.find(t => t.id === activeId && !t.completed);
  const taskDisplay = document.getElementById('focus-task-name');
  if (taskDisplay) {
    taskDisplay.textContent = activeTask ? activeTask.title : 'No task selected';
  }

  EventBus.emit('focusmode:enter');
}

function exitFocusMode() {
  const overlay = document.getElementById('focus-mode-overlay');
  if (!overlay) return;

  overlay.setAttribute('hidden', '');
  overlay.classList.remove('active');
  
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }

  // Stop ambient sound
  stopAmbient();
  const ambientSelect = document.getElementById('ambient-sound-select');
  if (ambientSelect) ambientSelect.value = 'none';

  EventBus.emit('focusmode:exit');
}

/**
 * Configure weekly summary report card generation & download
 */
function setupWeeklyReport() {
  const btn = document.getElementById('btn-weekly-report');
  const modal = document.getElementById('report-modal');
  const downloadBtn = document.getElementById('btn-download-report');

  if (btn && modal) {
    btn.addEventListener('click', () => {
      renderWeeklyReportCard();
      modal.showModal();
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const canvas = document.getElementById('report-canvas');
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `focusflow-report-${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }
}

/**
 * Configure data export, import, and clearing
 */
function setupDataManagement() {
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnImportJson = document.getElementById('btn-import-json');
  const fileInput = document.getElementById('file-import-json');
  const btnClearData = document.getElementById('btn-clear-data');

  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      const csv = exportCSV();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `focusflow-sessions-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
      const json = exportData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `focusflow-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  if (btnImportJson && fileInput) {
    btnImportJson.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          importData(event.target.result);
          alert('Data imported successfully!');
          EventBus.emit('data:imported');
          location.reload();
        } catch (err) {
          alert('Import failed: ' + err.message);
        }
      };
      reader.readAsText(file);
      fileInput.value = '';
    });
  }

  if (btnClearData) {
    btnClearData.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all history, tasks, and settings? This cannot be undone.')) {
        clearAllData();
        EventBus.emit('data:cleared');
        alert('All FocusFlow data has been reset.');
        location.reload();
      }
    });
  }
}

/**
 * Configure distraction logging modal
 */
function setupDistractionModal() {
  const modal = document.getElementById('distraction-modal');
  const submitBtn = document.getElementById('btn-submit-distraction');
  const cancelBtn = document.getElementById('btn-cancel-distraction');
  const customContainer = document.getElementById('distraction-custom-container');
  const customInput = document.getElementById('distraction-custom');
  const options = document.querySelectorAll('.distraction-opt');
  let selectedReason = null;

  options.forEach(opt => {
    opt.addEventListener('click', () => {
      options.forEach(o => o.classList.remove('btn-primary'));
      options.forEach(o => o.classList.add('btn-secondary'));
      
      opt.classList.remove('btn-secondary');
      opt.classList.add('btn-primary');
      
      selectedReason = opt.dataset.reason;
      
      if (customContainer) {
        customContainer.style.display = selectedReason === 'other' ? 'block' : 'none';
        if (selectedReason === 'other' && customInput) customInput.focus();
      }
      
      if (submitBtn) submitBtn.disabled = false;
    });
  });

  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      if (!selectedReason) return;
      
      const distraction = {
        id: generateId(),
        reason: selectedReason,
        customReason: (customInput && selectedReason === 'other') ? customInput.value.trim() : '',
        timestamp: Date.now(),
        sessionId: null
      };

      addDistraction(distraction);
      EventBus.emit('distraction:logged', { distraction });

      // Reset & close
      options.forEach(o => o.classList.remove('btn-primary'));
      options.forEach(o => o.classList.add('btn-secondary'));
      if (customInput) customInput.value = '';
      if (customContainer) customContainer.style.display = 'none';
      selectedReason = null;
      submitBtn.disabled = true;

      if (modal && typeof modal.close === 'function') modal.close();
    });
  }

  if (cancelBtn && modal) {
    cancelBtn.addEventListener('click', () => {
      modal.close();
    });
  }
}

/**
 * Configure focus quality rating modal
 */
function setupQualityModal() {
  const modal = document.getElementById('quality-modal');
  const starBtns = document.querySelectorAll('.quality-star-btn');
  const skipBtn = document.getElementById('btn-skip-quality');

  starBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const rating = parseInt(btn.dataset.rating, 10);
      const sessions = getSessions();
      if (sessions.length > 0) {
        const lastSession = sessions[sessions.length - 1];
        lastSession.focusQuality = rating;
        saveState();
        EventBus.emit('quality:rated', { sessionId: lastSession.id, rating });
      }
      if (modal && typeof modal.close === 'function') modal.close();
    });
  });

  if (skipBtn && modal) {
    skipBtn.addEventListener('click', () => modal.close());
  }
}

/**
 * Setup dialog close button listeners
 */
function setupModalDismissals() {
  const closeReport = document.getElementById('btn-close-report');
  const reportModal = document.getElementById('report-modal');
  if (closeReport && reportModal) {
    closeReport.addEventListener('click', () => reportModal.close());
  }

  const closeShortcuts = document.getElementById('btn-close-shortcuts');
  const shortcutsModal = document.getElementById('shortcuts-modal');
  if (closeShortcuts && shortcutsModal) {
    closeShortcuts.addEventListener('click', () => shortcutsModal.close());
  }
}
