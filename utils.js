export const EventBus = {
  listeners: new Map(),
  /**
   * @param {string} event
   * @param {Function} callback
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  },
  /**
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  },
  /**
   * @param {string} event
   * @param {*} data
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error(`Error in event listener for ${event}:`, e);
        }
      });
    }
  }
};

/** @returns {string} */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * @param {number} seconds
 * @returns {string}
 */
export function formatTime(seconds) {
  const isNegative = seconds < 0;
  const absSeconds = Math.abs(Math.floor(seconds));
  const m = Math.floor(absSeconds / 60).toString().padStart(2, '0');
  const s = (absSeconds % 60).toString().padStart(2, '0');
  return `${isNegative ? '-' : ''}${m}:${s}`;
}

/**
 * @param {number} timestamp
 * @returns {string}
 */
export function formatDate(timestamp) {
  const d = new Date(timestamp);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * @param {number} timestamp
 * @returns {string}
 */
export function formatDateDisplay(timestamp) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * @param {string} str
 * @returns {string}
 */
export function sanitize(str) {
  if (!str) return '';
  const map = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
  return String(str).replace(/[<>&"']/g, m => map[m]);
}

/**
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
export function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * @param {Date|number} date
 * @returns {number}
 */
export function getStartOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * @param {Date|number} date
 * @returns {number}
 */
export function getStartOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).getTime();
}

/**
 * @param {Date|number} date1
 * @param {Date|number} date2
 * @returns {number}
 */
export function getDaysBetween(date1, date2) {
  const ONE_DAY = 1000 * 60 * 60 * 24;
  const d1 = getStartOfDay(date1);
  const d2 = getStartOfDay(date2);
  return Math.round(Math.abs((d2 - d1) / ONE_DAY));
}

/**
 * @param {string} tag
 * @param {Object} attrs
 * @param {Array<Node|string>} children
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') el.className = value;
    else if (key === 'textContent') el.textContent = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else el.setAttribute(key, value);
  }
  children.forEach(child => {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child instanceof Node) el.appendChild(child);
  });
  return el;
}

/**
 * @param {string} message
 */
export function announce(message) {
  const el = document.getElementById('sr-announcer');
  if (el) {
    el.textContent = '';
    requestAnimationFrame(() => { el.textContent = message; });
  }
}
