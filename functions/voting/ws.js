/*
 WebSocket client for live voting-list monitor
 - Receives messages via WebSocket and batches them
 - Keeps up to MAX_DISPLAY_DEFAULT latest votes
 - Renders voting-list into #voting-list and writes simple logs to #log
*/
const BATCH_INTERVAL_MS = 10; // how often to process incoming messages (ms)
const MAX_DISPLAY_DEFAULT = 10; // maximum number of votes to keep

// Runtime state
let ws = null;
let connected = false;
let reconnectAttempts = 0;
let messageQueue = [];
let votingState = [];
// connection attempt state and timeout handle
let attempting = false;
let connectionTimeout = null;

// Cached DOM elements (must exist in the page)
const connStatus = document.getElementById('connStatus');
const statusText = document.getElementById('statusText');
const votingListEl = document.getElementById('voting-list');
const logEl = document.getElementById('log');
const btnToggle = document.getElementById('btnToggle');

// Manual disconnect flag used to avoid automatic reconnect when user disconnects
let manualDisconnect = false;

// Toggle connect/disconnect when user clicks the button
btnToggle.addEventListener('click', () => {
  if (!connected) {
    manualDisconnect = false; // user initiated connect
    connect();
  } else {
    manualDisconnect = true; // user initiated disconnect
    disconnect();
  }
});

// Simple logger appended into #log
function log(msg) {
  if (!logEl) return;
  logEl.innerText += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
}

// Connect to WebSocket URL from input #wssUrl
function connect() {
  const input = document.getElementById('wssUrl');
  const WS_URL = input ? input.value : '';

  // Require a non-empty URL
  if (WS_URL.trim() === '') {
    log('請設定 WS_URL');
    return;
  }

  statusText.innerText = '連線中...';
  attempting = true;
  // disable the toggle button while attempting to connect to prevent duplicate clicks
  if (btnToggle) {
    btnToggle.disabled = true;
    btnToggle.setAttribute('aria-disabled', 'true');
  }
  // set a 10s timeout: if still not connected after 10s, mark as failure
  connectionTimeout = setTimeout(() => {
    if (!connected) {
      attempting = false;
      try { safeCloseWs(); } catch (e) {}
      if (statusText) statusText.innerText = '連線失敗';
      if (btnToggle) {
        btnToggle.disabled = false;
        btnToggle.removeAttribute('aria-disabled');
        btnToggle.innerText = 'Connect';
      }
      log('連線逾時：10 秒內未能建立連線');
    }
  }, 10000);

  // The WebSocket constructor can throw synchronously for invalid URLs
  try {
    ws = new WebSocket(WS_URL);
  } catch (e) {
    attempting = false;
    if (connectionTimeout) { clearTimeout(connectionTimeout); connectionTimeout = null; }
    try { safeCloseWs(); } catch (ee) {}
    if (statusText) statusText.innerText = '連線失敗';
    if (btnToggle) {
      btnToggle.disabled = false;
      btnToggle.removeAttribute('aria-disabled');
      btnToggle.innerText = 'Connect';
    }
    log('WebSocket 建構失敗: ' + (e && e.message ? e.message : String(e)));
    return;
  }

  ws.onopen = () => {
    connected = true;
    reconnectAttempts = 0;
    attempting = false;
    if (connectionTimeout) { clearTimeout(connectionTimeout); connectionTimeout = null; }
    statusText.innerText = '已連線';
    if (connStatus) connStatus.classList.add('connected');
    if (btnToggle) { btnToggle.innerText = 'Disconnect'; btnToggle.disabled = false; btnToggle.removeAttribute('aria-disabled'); }
    log('WebSocket 已建立連線');
  };

  ws.onmessage = (evt) => {
    // Safely parse incoming JSON; if parse fails, log and ignore
    try {
      const data = JSON.parse(evt.data);
      messageQueue.push(data);
    } catch (e) {
      log('非 JSON 訊息: ' + evt.data);
    }
  };

  ws.onclose = (evt) => {
    connected = false;
    if (connStatus) connStatus.classList.remove('connected');
    // if we closed while attempting to connect (and never reached connected), show failure
    if (attempting && !connected) {
      attempting = false;
      if (connectionTimeout) { clearTimeout(connectionTimeout); connectionTimeout = null; }
      if (statusText) statusText.innerText = '連線失敗';
      if (btnToggle) { btnToggle.innerText = 'Connect'; btnToggle.disabled = false; btnToggle.removeAttribute('aria-disabled'); }
      log(`連線已關閉 (during attempt) (code=${evt.code})`);
      // do not schedule reconnect automatically here (it was just a failed attempt)
      return;
    }

    if (statusText) statusText.innerText = '已斷線';
    if (btnToggle) btnToggle.innerText = 'Connect';
    log(`連線已關閉 (code=${evt.code})`);
    if (!manualDisconnect) scheduleReconnect();
  };

  ws.onerror = (err) => {
    log('WebSocket error: ' + (err.message || JSON.stringify(err)));
    // if error happens before connection established, treat as failure and restore button
    if (!connected) {
      attempting = false;
      if (connectionTimeout) { clearTimeout(connectionTimeout); connectionTimeout = null; }
      if (statusText) statusText.innerText = '連線失敗';
      if (btnToggle) { btnToggle.disabled = false; btnToggle.removeAttribute('aria-disabled'); btnToggle.innerText = 'Connect'; }
    }
  };
}

function disconnect() {
  if (ws) ws.close();
}

function safeCloseWs() {
  try {
    if (ws) ws.close();
  } catch (e) {
    // ignore
  }
  ws = null;
}

// Exponential backoff reconnect
function scheduleReconnect() {
  reconnectAttempts += 1;
  const delay = Math.min(30000, Math.pow(2, Math.min(reconnectAttempts, 6)) * 1000);
  log(`重連排程：${delay / 1000}s 後嘗試 (第${reconnectAttempts}次)`);
  setTimeout(() => connect(), delay);
}

// Periodically process the incoming message queue in small batches
setInterval(() => {
  if (messageQueue.length === 0) return;
  const batch = messageQueue.splice(0, messageQueue.length);
  handleBatch(batch);
}, BATCH_INTERVAL_MS);

// Handle a batch of incoming messages
function handleBatch(batch) {
  const MAX_DISPLAY = MAX_DISPLAY_DEFAULT;
  batch.forEach((msg) => {
    const entry = normalizeAnswer(msg.body || msg);
    // prevent duplicates by user id
    if (!votingState.some((a) => a.id === entry.user)) votingState.unshift(entry);
  });

  if (votingState.length > MAX_DISPLAY) votingState = votingState.slice(0, MAX_DISPLAY);
  renderVotes();
}

// Normalize incoming message into { user, ts }
function normalizeAnswer(msg) {
  console.log(msg);
  const now = Date.now();
  if (!msg) return { user: 'None', ts: now };

  // Try to convert ISO time string to HH:MM:SS, otherwise fallback to timestamp
  try {
    const std_time = (msg.time || '').split('T')[1].split('+')[0];
    return { user: msg.alias || 'None', ts: std_time || now };
  } catch (e) {
    return { user: msg.alias || 'None', ts: now };
  }
}

// Render the votingState into the DOM
function renderVotes() {
  if (!votingListEl) return;
  votingListEl.innerHTML = '';
  votingState.forEach((itm, i) => {
    const el = document.createElement('div');
    el.className = 'answer' + (i === 0 ? ' new' : '');
    el.innerHTML = `
      <div class="meta">
        <div class="meta-left"><div class="who">${escapeHtml(itm.user)}</div></div>
        <div class="meta-right"><div class="ts">${escapeHtml(itm.ts)}</div></div>
      </div>
    `;
    votingListEl.appendChild(el);
    if (i === 0) setTimeout(() => el.classList.remove('new'), 800);
  });
}

// Minimal HTML-escaping utility
function escapeHtml(s) {
  return String(s || '').replace(/[&<>\\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

log('Client initialized.');