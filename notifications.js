/**
 * Initialize notifications, checking current permission state without auto-requesting.
 */
export function initNotifications() {
  try {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported by this browser.');
    }
  } catch (e) {
    console.error('Error initializing notifications:', e);
  }
}

/**
 * Request notification permission from the user.
 * @returns {Promise<boolean>} True if granted, false otherwise.
 */
export async function requestPermission() {
  try {
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (e) {
    console.warn('Failed to request notification permission:', e);
    return false;
  }
}

/**
 * Check if notification permission is currently granted.
 * @returns {boolean} True if granted.
 */
export function isPermissionGranted() {
  try {
    return 'Notification' in window && Notification.permission === 'granted';
  } catch (e) {
    return false;
  }
}

/**
 * Send a desktop notification.
 * @param {string} title - The notification title.
 * @param {string} body - The notification body.
 * @param {Object} [options={}] - Additional options (e.g. icon, badge).
 */
export function sendNotification(title, body, options = {}) {
  try {
    if (!isPermissionGranted()) return;
    
    const n = new Notification(title, {
      body,
      icon: options.icon || undefined,
      badge: options.badge || undefined,
      tag: 'focusflow',
      renotify: true,
      ...options
    });
    
    setTimeout(() => {
      try {
        n.close();
      } catch (e) {}
    }, 5000);
  } catch (e) {
    console.warn('Notification failed:', e);
  }
}
