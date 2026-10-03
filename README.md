<div align="center">
  <h1>🍅 FocusFlow</h1>
  <p><strong>A beautiful Pomodoro timer and productivity tracker for better focus</strong></p>
  <p>
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
    <img src="https://img.shields.io/badge/PWA-ready-brightgreen.svg" alt="PWA">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">
    <img src="https://img.shields.io/badge/no_backend-required-orange.svg" alt="No Backend">
    <img src="https://img.shields.io/badge/offline-capable-blue.svg" alt="Offline">
  </p>
</div>

## Screenshots

Add screenshots here. Capture: timer view (light + dark), tasks panel, stats dashboard, focus mode, settings modal, mobile view. Recommended: use a screen recorder for a GIF demo.

## Features

### ⏱️ Timer
- Classic Pomodoro technique (Focus, Short Break, Long Break)
- Customizable timer durations
- Auto-start breaks and focus sessions
- Progress ring visualization
- Strict mode (prevents switching tabs or exiting)

### ✅ Tasks
- Integrated task management
- Assign pomodoros to specific tasks
- Reorder and prioritize
- Tagging system with colors
- Inline task creation

### 📊 Statistics
- Daily, weekly, and monthly productivity charts
- Focus streaks tracking
- Heatmaps of productive hours
- CSV data export for personal analysis

### 🧠 Focus Mode & Smart Features
- Fullscreen immersive mode
- Distraction tracking (count interruptions)
- Mood and focus quality logging
- Ambient sounds (Rain, Cafe, White Noise)
- Smart suggestions based on fatigue

### ♿ Accessibility
- Fully keyboard navigable
- ARIA labels for screen readers
- Reduced motion support
- High contrast themes

## Why FocusFlow is Different

Unlike other Pomodoro timers, **FocusFlow** is designed around holistic productivity. We don't just measure time; we help you understand your focus patterns. Features like distraction tracking and mood/focus quality analysis give you insights into *when* you are most productive. Paired with ambient sounds and a fully offline-capable PWA architecture, you get a premium experience without needing an account or an internet connection.

## Tech Stack

- **HTML5 & CSS3**: Modern layouts using Grid and Flexbox, with CSS variables for theming.
- **Vanilla JS**: Zero dependencies. Written in modern ES6 modules.
- **Chart.js**: For beautiful, responsive analytics.
- **Web Audio API**: For seamless, non-blocking ambient sounds.
- **Service Workers**: For complete offline capability and caching.

## Quick Start

FocusFlow requires no build steps. Since it uses ES modules, you just need a local static server to run it.

1. **Option A**: Use Python
   ```bash
   python -m http.server
   ```
2. **Option B**: Use npx and Node
   ```bash
   npx serve
   ```
3. **Option C**: Open `index.html` directly (some features like service workers may not function properly due to CORS).

## Deployment

### GitHub Pages
1. Push your repository to GitHub.
2. Go to **Settings > Pages**.
3. Select the `main` or `gh-pages` branch as your source.
4. Save and wait for the deployment to finish.

### Netlify
1. Log in to Netlify.
2. Drag and drop the project folder into the "Sites" tab, OR connect your GitHub repository for continuous deployment.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Start/Pause timer |
| `S` | Skip current session |
| `T` | Add a new task |
| `F` | Toggle fullscreen |
| `M` | Mute/Unmute sounds |
| `Esc` | Close modals / Exit fullscreen |
| `D` | Toggle Dark Mode |

## Project Structure

```
focusflow/
├── css/
│   ├── main.css      # Core styles
│   └── themes.css    # Theme variables
├── js/
│   ├── app.js        # Main entry point
│   ├── timer.js      # Timer logic
│   ├── storage.js    # LocalStorage wrapper
│   └── utils.js      # Helpers
├── tests/
│   ├── timer.test.js
│   └── storage.test.js
├── assets/           # Icons and sound files
├── index.html        # Main app view
└── manifest.json     # PWA manifest
```

## Architecture

FocusFlow uses a simple Event Bus pattern to decouple components. The `timer.js` module triggers events (like `timerTick` or `sessionComplete`), which the UI components listen to. State is persisted automatically to `localStorage` using the `storage.js` layer.

## PWA & Offline

FocusFlow is a Progressive Web App (PWA). It uses a Service Worker to cache all necessary assets on the first visit. Subsequent visits load instantly from the cache, making the app 100% functional without an internet connection. You can install it on your device straight from the browser's address bar.

## Testing

Tests are written using a simple, zero-dependency custom test runner. 
To run tests:
- Execute via node: `node tests/timer.test.js` and `node tests/storage.test.js`

## Manual Test Checklist

- [ ] Timer accuracy in background tab (start timer, switch tabs for 2 min, verify time is correct)
- [ ] Page reload mid-session (start timer, reload page, verify timer state is preserved)
- [ ] Notification permission denied (deny notification, verify app still works without errors)
- [ ] Offline mode (disconnect internet, verify all features work)
- [ ] Mobile layout (test at 360px width)
- [ ] Keyboard navigation (tab through all interactive elements)
- [ ] Theme switching (try all themes and accents)
- [ ] Import/Export (export data, clear, re-import)

## Roadmap

- Cloud sync with Google/GitHub account
- Browser extension for website blocking
- Spotify integration for focus music
- Team focus rooms (collaborative pomodoros)
- iOS/Android native apps (Capacitor)
- Calendar integration
- API for third-party integrations
- Customizable sounds (upload your own)
- Pomodoro templates (different durations for different tasks)
- Weekly/monthly email reports

## Contributing

We love contributions! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## Good First Issues

Looking to contribute? Here are some great places to start:
1. Add a 'dark mode only' keyboard shortcut (D key)
2. Add more tag colors/custom tags
3. Add task due dates
4. Add a 'total pomodoros today' counter to the timer view
5. Add sound preview in settings without opening a separate dialog

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<!-- GitHub Metadata -->
<!-- Repository description: 🍅 A beautiful, offline-capable Pomodoro timer PWA with task management, focus analytics, distraction tracking, and smart productivity insights. No backend required. -->
<!-- Topics/Tags: pomodoro, pomodoro-timer, productivity, focus, timer, pwa, vanilla-javascript, web-app, time-management, task-manager -->
<!-- Release name: v1.0.0 - First Focus 🎯 -->
