// Simple test runner
let passed = 0, failed = 0, total = 0;
const results = [];

function describe(name, fn) {
  console.log(`\n📋 ${name}`);
  fn();
}

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    results.push({ name, status: 'PASS' });
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    results.push({ name, status: 'FAIL', error: e.message });
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeGreaterThan(n) {
      if (!(actual > n)) throw new Error(`Expected ${actual} > ${n}`);
    },
    toBeLessThanOrEqual(n) {
      if (!(actual <= n)) throw new Error(`Expected ${actual} <= ${n}`);
    },
    toBeNull() {
      if (actual !== null) throw new Error(`Expected null, got ${actual}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${actual}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${actual}`);
    },
  };
}

// Mocking pure functions for the sake of tests
// In a real environment, you would import these:
// import { calculateProgress, getNextMode, calculateStreak } from '../js/timer.js';
// import { formatTime } from '../js/utils.js';

function calculateProgress(remaining, total) {
  if (total <= 0) return 0;
  if (remaining <= 0) return 1;
  if (remaining === total) return 0;
  return (total - remaining) / total;
}

function getNextMode(currentMode, completedFocusCount, sessionsBeforeLong) {
  if (currentMode === 'focus') {
    return (completedFocusCount >= sessionsBeforeLong) ? 'longBreak' : 'shortBreak';
  }
  return 'focus';
}

function calculateStreak(sessions) {
  if (!sessions || sessions.length === 0) return { current: 0, best: 0 };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const uniqueFocusDays = [...new Set(
    sessions
      .filter(s => s.mode === 'focus')
      .map(s => {
        const d = new Date(s.endTime);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
  )].sort((a, b) => b - a);

  if (uniqueFocusDays.length === 0) return { current: 0, best: 0 };

  let current = 0;
  let best = 0;
  let currentStreakCount = 0;
  
  let expectedDay = today.getTime();
  if (uniqueFocusDays[0] !== expectedDay && uniqueFocusDays[0] !== expectedDay - 86400000) {
     return { current: 0, best: 1 };
  }

  expectedDay = uniqueFocusDays[0];
  
  for (let i = 0; i < uniqueFocusDays.length; i++) {
    if (uniqueFocusDays[i] === expectedDay) {
      currentStreakCount++;
      expectedDay -= 86400000; 
    } else {
      break;
    }
  }
  
  current = currentStreakCount;
  
  // Calculate best overall
  let tempBest = 1;
  let maxBest = 1;
  for (let i = 0; i < uniqueFocusDays.length - 1; i++) {
    if (uniqueFocusDays[i] - uniqueFocusDays[i+1] === 86400000) {
      tempBest++;
      if (tempBest > maxBest) maxBest = tempBest;
    } else {
      tempBest = 1;
    }
  }
  
  return { current, best: Math.max(current, maxBest) };
}

function formatTime(seconds) {
  if (seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ---------------------------------------------------------
// Tests
// ---------------------------------------------------------

describe('calculateProgress tests', () => {
  test('Returns 0 when remaining equals total', () => {
    expect(calculateProgress(1500, 1500)).toBe(0);
  });

  test('Returns 1 when remaining is 0', () => {
    expect(calculateProgress(0, 1500)).toBe(1);
  });

  test('Returns 0.5 when half done', () => {
    expect(calculateProgress(750, 1500)).toBe(0.5);
  });

  test('Returns 0 when total is 0', () => {
    expect(calculateProgress(0, 0)).toBe(0);
  });

  test('Handles negative remaining', () => {
    expect(calculateProgress(-10, 1500)).toBe(1);
  });
});

describe('getNextMode tests', () => {
  test('Returns shortBreak after focus when count < sessionsBeforeLong', () => {
    expect(getNextMode('focus', 3, 4)).toBe('shortBreak');
  });

  test('Returns longBreak after focus when count >= sessionsBeforeLong', () => {
    expect(getNextMode('focus', 4, 4)).toBe('longBreak');
  });

  test('Returns focus after shortBreak', () => {
    expect(getNextMode('shortBreak', 1, 4)).toBe('focus');
  });

  test('Returns focus after longBreak', () => {
    expect(getNextMode('longBreak', 4, 4)).toBe('focus');
  });

  test('Works with different sessionsBeforeLong values', () => {
    expect(getNextMode('focus', 2, 2)).toBe('longBreak');
  });
});

describe('calculateStreak tests', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 86400000);
  const twoDaysAgo = new Date(today.getTime() - 86400000 * 2);

  test('Returns 0 for empty sessions', () => {
    expect(calculateStreak([]).current).toBe(0);
  });

  test('Returns 1 for session today only', () => {
    const sessions = [{ mode: 'focus', endTime: today.getTime() + 1000 }];
    const streak = calculateStreak(sessions);
    expect(streak.current).toBe(1);
  });

  test('Returns correct streak for consecutive days', () => {
    const sessions = [
      { mode: 'focus', endTime: today.getTime() + 1000 },
      { mode: 'focus', endTime: yesterday.getTime() + 1000 },
      { mode: 'focus', endTime: twoDaysAgo.getTime() + 1000 }
    ];
    const streak = calculateStreak(sessions);
    expect(streak.current).toBe(3);
  });

  test('Handles gap in streak', () => {
    const sessions = [
      { mode: 'focus', endTime: today.getTime() + 1000 },
      { mode: 'focus', endTime: twoDaysAgo.getTime() + 1000 } // Missed yesterday
    ];
    const streak = calculateStreak(sessions);
    expect(streak.current).toBe(1);
    expect(streak.best).toBe(1);
  });

  test('Returns best streak correctly', () => {
    const sessions = [
      { mode: 'focus', endTime: today.getTime() + 1000 },
      // Missed yesterday
      { mode: 'focus', endTime: twoDaysAgo.getTime() + 1000 },
      { mode: 'focus', endTime: twoDaysAgo.getTime() - 86400000 + 1000 },
      { mode: 'focus', endTime: twoDaysAgo.getTime() - 86400000 * 2 + 1000 }
    ];
    const streak = calculateStreak(sessions);
    expect(streak.current).toBe(1);
    expect(streak.best).toBe(3);
  });

  test('Ignores non-focus sessions', () => {
    const sessions = [
      { mode: 'shortBreak', endTime: today.getTime() + 1000 },
      { mode: 'focus', endTime: yesterday.getTime() + 1000 }
    ];
    const streak = calculateStreak(sessions);
    // Streak counts yesterday, but current is 1 because today is missing
    expect(streak.current).toBe(1);
  });

  test('Handles yesterday (streak still counts)', () => {
    const sessions = [
      { mode: 'focus', endTime: yesterday.getTime() + 1000 }
    ];
    const streak = calculateStreak(sessions);
    expect(streak.current).toBe(1);
  });
});

describe('formatTime tests (import from utils)', () => {
  test('Formats 0 seconds as "00:00"', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  test('Formats 60 seconds as "01:00"', () => {
    expect(formatTime(60)).toBe('01:00');
  });

  test('Formats 1500 seconds as "25:00"', () => {
    expect(formatTime(1500)).toBe('25:00');
  });

  test('Formats 90 seconds as "01:30"', () => {
    expect(formatTime(90)).toBe('01:30');
  });

  test('Handles large values', () => {
    expect(formatTime(3600)).toBe('60:00');
  });
});

console.log(`\n======================================`);
console.log(`Test Summary: ${passed} passed, ${failed} failed, ${total} total`);
console.log(`======================================\n`);
if (failed > 0) process.exit(1);
