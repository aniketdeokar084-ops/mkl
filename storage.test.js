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

const mockStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, value) { this.store[key] = String(value); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; },
};
// Override global localStorage for testing
Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, writable: true });

// Mock Storage functions
const DEFAULT_STATE = { settings: { volume: 0.5 }, sessions: [] };

function loadState() {
  const data = localStorage.getItem('focusflow_data');
  if (!data) return DEFAULT_STATE;
  try {
    const parsed = JSON.parse(data);
    return { ...DEFAULT_STATE, ...parsed };
  } catch (e) {
    return DEFAULT_STATE;
  }
}

function saveState(state) {
  localStorage.setItem('focusflow_data', JSON.stringify(state));
}

function exportCSV(sessions) {
  if (!sessions || sessions.length === 0) return 'mode,duration,startTime,endTime,taskId\n';
  let csv = 'mode,duration,startTime,endTime,taskId\n';
  sessions.forEach(s => {
    csv += `${s.mode},${s.duration},${s.startTime},${s.endTime},${s.taskId || ''}\n`;
  });
  return csv;
}

function importData(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.settings || !Array.isArray(data.sessions)) {
      throw new Error('Invalid data format: missing required fields');
    }
    return data;
  } catch (e) {
    throw new Error('Invalid JSON: ' + e.message);
  }
}

function migrateData(data) {
  // Simulate v1 to current migration
  if (data.version === 1) {
    data.version = 2; // current version
    data.migrated = true;
  }
  return data;
}

describe('loadState tests', () => {
  test('Returns default state when localStorage is empty', () => {
    localStorage.clear();
    expect(loadState()).toEqual(DEFAULT_STATE);
  });

  test('Returns saved state when data exists', () => {
    localStorage.clear();
    const state = { settings: { volume: 1.0 }, sessions: [{ id: 1 }] };
    localStorage.setItem('focusflow_data', JSON.stringify(state));
    expect(loadState()).toEqual(state);
  });

  test('Handles corrupted JSON gracefully', () => {
    localStorage.clear();
    localStorage.setItem('focusflow_data', '{ corrupted_json: true');
    expect(loadState()).toEqual(DEFAULT_STATE);
  });

  test('Merges missing fields with defaults', () => {
    localStorage.clear();
    localStorage.setItem('focusflow_data', JSON.stringify({ sessions: [] }));
    const state = loadState();
    expect(state.settings).toBeTruthy();
  });
});

describe('saveState/loadState roundtrip', () => {
  test('Save and load returns same data', () => {
    localStorage.clear();
    const data = { settings: { volume: 0.8 }, sessions: [{ id: 42, mode: 'focus' }] };
    saveState(data);
    expect(loadState()).toEqual(data);
  });
});

describe('exportCSV tests', () => {
  test('Returns proper CSV header', () => {
    expect(exportCSV([])).toBe('mode,duration,startTime,endTime,taskId\n');
  });

  test('Formats sessions correctly', () => {
    const sessions = [{ mode: 'focus', duration: 1500, startTime: 1000, endTime: 2500, taskId: 't1' }];
    const csv = exportCSV(sessions);
    expect(csv).toBe('mode,duration,startTime,endTime,taskId\nfocus,1500,1000,2500,t1\n');
  });

  test('Handles empty sessions array', () => {
    expect(exportCSV([])).toBe('mode,duration,startTime,endTime,taskId\n');
  });

  test('Handles null task references', () => {
    const sessions = [{ mode: 'shortBreak', duration: 300, startTime: 1000, endTime: 1300, taskId: null }];
    const csv = exportCSV(sessions);
    expect(csv).toBe('mode,duration,startTime,endTime,taskId\nshortBreak,300,1000,1300,\n');
  });
});

describe('importData tests', () => {
  test('Imports valid JSON', () => {
    const validJson = JSON.stringify({ settings: {}, sessions: [] });
    const data = importData(validJson);
    expect(data).toBeTruthy();
  });

  test('Rejects invalid JSON', () => {
    let err = null;
    try {
      importData('invalid json');
    } catch (e) {
      err = e;
    }
    expect(err).toBeTruthy();
  });

  test('Rejects missing required fields', () => {
    let err = null;
    try {
      importData(JSON.stringify({ settings: {} })); // missing sessions
    } catch (e) {
      err = e;
    }
    expect(err).toBeTruthy();
  });
});

describe('Migration tests', () => {
  test('Migrates from version 1 to current', () => {
    const oldData = { version: 1, data: 'test' };
    const migrated = migrateData(oldData);
    expect(migrated.version).toBe(2);
    expect(migrated.migrated).toBe(true);
  });
});

console.log(`\n======================================`);
console.log(`Test Summary: ${passed} passed, ${failed} failed, ${total} total`);
console.log(`======================================\n`);
if (failed > 0) process.exit(1);
