# Stilltime — Web Time Tracker

Stilltime is a small Manifest V3 browser extension for understanding where browsing time goes. It uses a quiet glass-inspired dashboard with an interactive website chart, visit counts, daily site details, and CSV export.

## Install as an unpacked extension

1. Open the browser's extensions manager (in Chrome, visit `chrome://extensions`).
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this `stilltime-chrome-extension` folder.
4. Pin the Stilltime icon if you want quick access.

Stilltime uses standard Manifest V3 extension APIs and is intended for Chromium-based browsers that support unpacked MV3 extensions, including Chrome and Dia.

## How tracking works

- Time is counted while a normal website is selected in the focused browser window, the browser is not idle, and manual tracking is not paused.
- Use the pause/play button in the popup to stop and resume tracking. The preference persists across popup closes and browser restarts.
- The dashboard summarizes today, the last 7 days, the last 30 days, or all recorded time.
- Click a chart segment or website row to view time spent, visit count, average time per visit, and a 7-day activity chart.
- Browser-internal pages such as `chrome://` are not tracked.

Chrome's idle and focus signals do not perfectly account for every system sleep or browser transition, so use the totals as estimates.

## Privacy

All records are stored locally in `chrome.storage.local`. Stilltime records website hostnames, daily time totals, visit counts, and the pause preference. It does not store full page URLs, page content, or send browsing data to a server. The extension requests `tabs`, `storage`, `idle`, and `alarms` permissions to read the active tab's hostname, maintain local statistics, detect inactivity, and checkpoint time.

## Features

- Interactive time filters and donut chart
- Website-level time, visits, average visit duration, and daily rhythm
- Manual pause/resume control
- CSV export and local data clearing
- Offline-first interface with no remote fonts or analytics
