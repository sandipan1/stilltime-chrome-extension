const STATE_KEY = "stilltimeState";
const DATA_KEY = "stilltimeData";
const PAUSED_KEY = "stilltimePaused";
let writeChain = Promise.resolve();

const localDay = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

async function readState() {
  const result = await chrome.storage.local.get([STATE_KEY, DATA_KEY, PAUSED_KEY]);
  return {
    state: result[STATE_KEY] || { domain: null, since: Date.now(), active: false },
    data: result[DATA_KEY] || { days: {} },
    paused: Boolean(result[PAUSED_KEY])
  };
}

async function currentContext() {
  const settings = await chrome.storage.local.get(PAUSED_KEY);
  if (settings[PAUSED_KEY]) return { active: false, domain: null };
  const win = await chrome.windows.getLastFocused({ populate: true }).catch(() => null);
  if (!win || win.state === "minimized" || !win.focused) return { active: false, domain: null };
  const tab = win.tabs?.find(item => item.active);
  if (!tab?.url) return { active: false, domain: null };
  let domain = null;
  try {
    const url = new URL(tab.url);
    if (["http:", "https:"].includes(url.protocol)) domain = url.hostname.replace(/^www\./, "");
  } catch {}
  const idle = await chrome.idle.queryState(60).catch(() => "active");
  return { active: Boolean(domain) && idle === "active", domain };
}

async function checkpointNow(next = null) {
  const { state, data } = await readState();
  const now = Date.now();
  if (state.active && state.domain && now > state.since) {
    const day = localDay(new Date(state.since));
    data.days[day] ||= {};
    data.days[day][state.domain] ||= { ms: 0, visits: 0 };
    data.days[day][state.domain].ms += now - state.since;
  }
  const context = next || await currentContext();
  const changed = state.domain !== context.domain || state.active !== context.active;
  if (changed && context.active && context.domain) {
    const day = localDay(new Date(now));
    data.days[day] ||= {};
    data.days[day][context.domain] ||= { ms: 0, visits: 0 };
    data.days[day][context.domain].visits += 1;
  }
  await chrome.storage.local.set({
    [DATA_KEY]: data,
    [STATE_KEY]: { domain: context.domain, since: now, active: context.active }
  });
}

async function checkpoint(next = null) {
  const operation = writeChain.then(() => checkpointNow(next));
  writeChain = operation.catch(() => {});
  return operation;
}

async function resetClockAndSync() {
  const { state } = await readState();
  await chrome.storage.local.set({ [STATE_KEY]: { domain: state.domain, since: Date.now(), active: false } });
  await syncContext();
}
async function syncContext() { await checkpoint(await currentContext()); }

chrome.runtime.onInstalled.addListener(async () => {
  chrome.idle.setDetectionInterval(60);
  chrome.alarms.create("stilltime-checkpoint", { periodInMinutes: 1 });
  await resetClockAndSync();
});
chrome.runtime.onStartup.addListener(async () => {
  chrome.idle.setDetectionInterval(60);
  chrome.alarms.create("stilltime-checkpoint", { periodInMinutes: 1 });
  await resetClockAndSync();
});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "stilltime-checkpoint") syncContext();
});
chrome.tabs.onActivated.addListener(syncContext);
chrome.tabs.onUpdated.addListener((_id, change) => {
  if (change.status === "complete" || change.url) syncContext();
});
chrome.windows.onFocusChanged.addListener(syncContext);
chrome.idle.onStateChanged.addListener(syncContext);
chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message?.type === "getStats") {
    (async () => {
      await syncContext();
      const stateData = await readState();
      respond({ data: stateData.data, current: stateData.state.domain, tracking: stateData.state.active, paused: stateData.paused });
    })();
    return true;
  }
  if (message?.type === "setPaused") {
    (async () => {
      const paused = Boolean(message.paused);
      await chrome.storage.local.set({ [PAUSED_KEY]: paused });
      await syncContext();
      respond({ ok: true, paused });
    })();
    return true;
  }
  if (message?.type === "clearStats") {
    chrome.storage.local.set({ [DATA_KEY]: { days: {} } }).then(async () => {
      const context = await currentContext();
      await chrome.storage.local.set({ [STATE_KEY]: { domain: context.domain, since: Date.now(), active: context.active } });
      respond({ ok: true });
    });
    return true;
  }
});
