import { EventBus, generateId, sanitize, createElement, announce } from './utils.js';
import { getTasks, saveTasks, getActiveTaskId, setActiveTaskId } from './storage.js';

let tasks = [];
let activeTaskId = null;
let currentFilter = 'all';    // 'all' | 'active' | 'completed'
let currentTagFilter = 'all'; // 'all' | specific tag
let draggedItem = null;

let elTaskForm, elTaskInput, elTaskTagSelect, elTaskPomodorosInput, elTaskNoteInput, elTaskList, elFilters, elBtnClearCompleted, elEmptyState;

/**
 * Initialize tasks module
 */
export function initTasks() {
  tasks = getTasks() || [];
  activeTaskId = getActiveTaskId();
  
  elTaskForm = document.getElementById('task-form');
  elTaskInput = document.getElementById('task-input');
  elTaskTagSelect = document.getElementById('task-tag-select');
  elTaskPomodorosInput = document.getElementById('task-pomodoros-input');
  elTaskNoteInput = document.getElementById('task-note-input');
  elTaskList = document.getElementById('task-list');
  elFilters = document.getElementById('task-filters') || document.querySelector('.task-filters');
  elBtnClearCompleted = document.getElementById('btn-clear-completed');
  elEmptyState = document.getElementById('task-empty-state') || document.querySelector('.empty-state');

  if (elTaskForm) {
    elTaskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = elTaskInput.value.trim();
      const tag = elTaskTagSelect ? elTaskTagSelect.value : '';
      const pomodoros = elTaskPomodorosInput ? parseInt(elTaskPomodorosInput.value, 10) : 1;
      const note = elTaskNoteInput ? elTaskNoteInput.value.trim() : '';
      
      if (title) {
        addTask(title, pomodoros, note, tag);
        elTaskForm.reset();
        if (elTaskPomodorosInput) elTaskPomodorosInput.value = '1';
        elTaskInput.focus();
      }
    });
  }

  if (elFilters) {
    const filterBtns = elFilters.querySelectorAll('button[data-filter]');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderTasks();
      });
    });
  }

  const tagFilterSelect = document.getElementById('task-tag-filter');
  if (tagFilterSelect) {
    tagFilterSelect.addEventListener('change', (e) => {
      currentTagFilter = e.target.value;
      renderTasks();
    });
  }

  if (elBtnClearCompleted) {
    elBtnClearCompleted.addEventListener('click', clearCompleted);
  }

  EventBus.on('timer:complete', (data) => {
    if (data.mode === 'focus' && data.taskId) {
      incrementTaskPomodoro(data.taskId);
    }
  });

  EventBus.on('data:imported', () => {
    tasks = getTasks() || [];
    activeTaskId = getActiveTaskId();
    renderTasks();
  });

  EventBus.on('data:cleared', () => {
    tasks = [];
    activeTaskId = null;
    renderTasks();
  });

  renderTasks();
}

/**
 * Add a new task
 * @param {string} title 
 * @param {number} estimatedPomodoros 
 * @param {string} note 
 * @param {string} tag 
 */
export function addTask(title, estimatedPomodoros, note, tag) {
  const task = {
    id: generateId(),
    title: sanitize(title),
    estimatedPomodoros: Math.max(1, Math.min(10, estimatedPomodoros || 1)),
    completedPomodoros: 0,
    note: sanitize(note || ''),
    tag: tag || '',
    completed: false,
    createdAt: Date.now(),
    order: tasks.length
  };
  
  tasks.push(task);
  saveTasks(tasks);
  
  if (!activeTaskId) {
    setActiveTask(task.id);
  }
  
  renderTasks();
  EventBus.emit('task:added', { task });
  announce('Task added');
}

/**
 * Render task list
 */
function renderTasks() {
  if (!elTaskList) return;
  
  elTaskList.innerHTML = '';
  
  const filtered = getFilteredTasks(currentFilter, currentTagFilter);
  
  if (filtered.length === 0) {
    if (elEmptyState) elEmptyState.style.display = 'block';
  } else {
    if (elEmptyState) elEmptyState.style.display = 'none';
    
    filtered.sort((a, b) => a.order - b.order).forEach(task => {
      const li = document.createElement('li');
      li.className = `task-item ${task.id === activeTaskId ? 'active' : ''} ${task.completed ? 'completed' : ''}`;
      li.draggable = true;
      li.dataset.id = task.id;
      
      const chkBtn = document.createElement('button');
      chkBtn.className = 'task-checkbox';
      chkBtn.setAttribute('aria-label', task.completed ? 'Mark incomplete' : 'Mark complete');
      chkBtn.innerHTML = task.completed 
        ? '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>' 
        : '';
      chkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTask(task.id);
      });
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'task-content';
      contentDiv.setAttribute('role', 'button');
      contentDiv.setAttribute('tabindex', '0');
      contentDiv.setAttribute('aria-label', `Select ${task.title} as active task`);
      contentDiv.addEventListener('click', () => setActiveTask(task.id));
      contentDiv.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setActiveTask(task.id);
        }
      });
      
      const titleSpan = document.createElement('span');
      titleSpan.className = 'task-title';
      titleSpan.textContent = task.title;
      
      const metaDiv = document.createElement('div');
      metaDiv.className = 'task-meta';
      
      if (task.tag) {
        const tagSpan = document.createElement('span');
        tagSpan.className = `tag tag-${task.tag.toLowerCase()}`;
        tagSpan.textContent = task.tag;
        metaDiv.appendChild(tagSpan);
      }
      
      const pomoSpan = document.createElement('span');
      pomoSpan.className = 'task-pomodoros';
      pomoSpan.textContent = `${task.completedPomodoros}/${task.estimatedPomodoros} 🍅`;
      metaDiv.appendChild(pomoSpan);

      if (task.note) {
        const noteSpan = document.createElement('span');
        noteSpan.className = 'task-note-preview';
        noteSpan.textContent = `📝 ${task.note}`;
        metaDiv.appendChild(noteSpan);
      }
      
      contentDiv.appendChild(titleSpan);
      contentDiv.appendChild(metaDiv);
      
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'task-actions';
      
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-icon btn-sm';
      editBtn.setAttribute('aria-label', 'Edit task');
      editBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newTitle = prompt('Edit task title:', task.title);
        if (newTitle !== null && newTitle.trim() !== '') {
          updateTask(task.id, { title: sanitize(newTitle.trim()) });
        }
      });
      
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-icon btn-sm';
      delBtn.setAttribute('aria-label', 'Delete task');
      delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTask(task.id);
      });
      
      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(delBtn);
      
      const dragHandle = document.createElement('span');
      dragHandle.className = 'drag-handle';
      dragHandle.setAttribute('aria-label', 'Drag to reorder');
      dragHandle.textContent = '⠿';
      
      li.appendChild(chkBtn);
      li.appendChild(contentDiv);
      li.appendChild(actionsDiv);
      li.appendChild(dragHandle);
      
      // Native drag and drop events
      li.addEventListener('dragstart', handleDragStart);
      li.addEventListener('dragover', handleDragOver);
      li.addEventListener('drop', handleDrop);
      li.addEventListener('dragend', handleDragEnd);
      
      elTaskList.appendChild(li);
    });
  }
}

// Drag and drop handlers
function handleDragStart(e) {
  draggedItem = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.id);
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  if (this !== draggedItem) {
    const bounding = this.getBoundingClientRect();
    const offset = bounding.y + bounding.height / 2;
    if (e.clientY - offset > 0) {
      this.style.borderBottom = '2px solid var(--color-primary)';
      this.style.borderTop = '';
    } else {
      this.style.borderTop = '2px solid var(--color-primary)';
      this.style.borderBottom = '';
    }
  }
}

function handleDrop(e) {
  e.preventDefault();
  this.style.borderTop = '';
  this.style.borderBottom = '';
  
  if (this !== draggedItem) {
    const fromId = draggedItem.dataset.id;
    const toId = this.dataset.id;
    
    const fromIndex = tasks.findIndex(t => t.id === fromId);
    const toIndex = tasks.findIndex(t => t.id === toId);
    
    if (fromIndex !== -1 && toIndex !== -1) {
      const [moved] = tasks.splice(fromIndex, 1);
      tasks.splice(toIndex, 0, moved);
      
      tasks.forEach((t, i) => t.order = i);
      saveTasks(tasks);
      renderTasks();
      EventBus.emit('task:reordered', { tasks });
    }
  }
}

function handleDragEnd() {
  this.classList.remove('dragging');
  if (elTaskList) {
    elTaskList.querySelectorAll('.task-item').forEach(item => {
      item.style.borderTop = '';
      item.style.borderBottom = '';
    });
  }
}

/**
 * Update task
 * @param {string} id 
 * @param {Object} updates 
 */
export function updateTask(id, updates) {
  const task = tasks.find(t => t.id === id);
  if (task) {
    Object.assign(task, updates);
    saveTasks(tasks);
    renderTasks();
    EventBus.emit('task:updated', { task });
    if (activeTaskId === id) {
      EventBus.emit('task:selected', { taskId: id, task });
      EventBus.emit('task:active', task);
    }
  }
}

/**
 * Delete task
 * @param {string} id 
 */
export function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks(tasks);
  
  if (activeTaskId === id) {
    const nextTask = tasks.find(t => !t.completed);
    setActiveTask(nextTask ? nextTask.id : null);
  }
  
  renderTasks();
  EventBus.emit('task:deleted', { taskId: id });
  announce('Task deleted');
}

/**
 * Toggle task completion status
 * @param {string} id 
 */
export function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    saveTasks(tasks);
    
    if (task.completed && activeTaskId === id) {
      const nextTask = tasks.find(t => !t.completed);
      setActiveTask(nextTask ? nextTask.id : null);
    } else if (!task.completed && !activeTaskId) {
      setActiveTask(id);
    }
    
    renderTasks();
    EventBus.emit('task:updated', { task });
  }
}

/**
 * Set active task
 * @param {string} id 
 */
export function setActiveTask(id) {
  activeTaskId = id;
  setActiveTaskId(id);
  renderTasks();
  const activeTask = tasks.find(t => t.id === id) || null;
  EventBus.emit('task:selected', { taskId: id, task: activeTask });
  EventBus.emit('task:active', activeTask);
}

/**
 * Clear all completed tasks
 */
export function clearCompleted() {
  tasks = tasks.filter(t => !t.completed);
  saveTasks(tasks);
  
  if (activeTaskId && !tasks.find(t => t.id === activeTaskId)) {
    setActiveTask(null);
  }
  
  renderTasks();
  EventBus.emit('tasks:cleared', {});
}

/**
 * Get filtered list of tasks
 * @param {string} filter 
 * @param {string} tagFilter 
 * @returns {Array} 
 */
export function getFilteredTasks(filter, tagFilter) {
  let filtered = tasks;
  
  if (filter === 'active') {
    filtered = filtered.filter(t => !t.completed);
  } else if (filter === 'completed') {
    filtered = filtered.filter(t => t.completed);
  }
  
  if (tagFilter && tagFilter !== 'all') {
    filtered = filtered.filter(t => t.tag && t.tag.toLowerCase() === tagFilter.toLowerCase());
  }
  
  return filtered;
}

/**
 * Increment completed pomodoros for a task
 * @param {string} taskId 
 */
export function incrementTaskPomodoro(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    task.completedPomodoros++;
    if (task.completedPomodoros >= task.estimatedPomodoros) {
      task.completed = true;
      if (activeTaskId === taskId) {
        const nextTask = tasks.find(t => !t.completed);
        setActiveTask(nextTask ? nextTask.id : null);
      }
    }
    saveTasks(tasks);
    renderTasks();
    EventBus.emit('task:updated', { task });
  }
}
