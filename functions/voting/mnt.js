const MAX_DISPLAY_DEFAULT = 10; // maximum number of votes to keep
const POLL_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes polling interval
const FETCH_URL = 'https://3kwozocua2wyg5aebwb5uxxele0ljmdp.lambda-url.ap-southeast-1.on.aws/';

let connected = false;
let votingState = []; // current voting state array

// Cached DOM elements (must exist in the page)
const connStatus   = document.getElementById('connStatus');
const statusText   = document.getElementById('statusText');
const votingListEl = document.getElementById('voting-list');
const logEl        = document.getElementById('log');
const btnToggle    = document.getElementById('btnToggle');
var   intervalObj  = null; // interval object for polling
var   inputPwd     = null; // input DOM element for connection password

// Toggle connect/disconnect when user clicks the button
btnToggle.addEventListener('click', () => {
  inputPwd = document.getElementById('getUrl');
  const connPwd = inputPwd ? inputPwd.value.trim() : '';

  if (!connected) {
    // Require a non-empty Password
    if (connPwd.trim() === '') {
      log('請輸入連線密碼');
      return;
    }

    validate(connPwd, 'password');
  } else {
    disconnect();
  }
});

// Simple logger appended into #log
function log(msg) {
  if (!logEl) return;
  logEl.innerText += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
}

const formatDateTime = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const i = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${i}:${s}`;
};

// Validate connection password before connecting
async function validate(value, route) {
     const resp = await fetch(FETCH_URL+`valid/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: value })
    });
    let data;
    try {
      data = await resp.json();
      if (data.status === false){
        log(`${data.context}`);
        return;
      } else {
        connect();
        return
      }
    } catch(e) {
        console.error(e);
        return;
    }
}

// Connect to HTTP API URL from input #getUrl
function connect() {
  statusText.innerText = '連線中...';
  if (btnToggle) {
    btnToggle.disabled = true;
    btnToggle.setAttribute('aria-disabled', 'true');
  }

  try {
    // === Initial load & auto refresh ===
    fetchVotes();
    intervalObj =setInterval(fetchVotes, POLL_INTERVAL_MS);
    statusText.innerText = '已連線';
    log('API 連線成功');
    connected = true;

    if (connStatus) connStatus.classList.add('connected');
    if (btnToggle) {
      btnToggle.innerText = 'Disconnect';
      btnToggle.disabled = false;
      btnToggle.removeAttribute('aria-disabled');
    }
  } catch (e) {
    if (statusText) statusText.innerText = '連線失敗';
    if (btnToggle) {
      btnToggle.disabled = false;
      btnToggle.removeAttribute('aria-disabled');
      btnToggle.innerText = 'Connect';
    }
    log('API 連線失敗: ' + (e && e.message ? e.message : String(e)));
    return;
  }
}

function disconnect() {
  clearInterval(intervalObj);
  connected = false;
  inputPwd.value = '';
  if (connStatus) connStatus.classList.remove('connected');
  if (statusText) statusText.innerText = '已斷線';
  if (btnToggle) btnToggle.innerText = 'Connect';
  log(`連線已關閉`);
}

/**
 * 渲染一個帶有比例寬度（柱狀圖效果）的列表到指定的容器。
 *
 * @param {HTMLElement} container - 要渲染列表的 DOM 容器元素（例如：votingListEl）。
 * @param {Array<Object>} data - 已按值降序排序的資料陣列。
 * @param {string} valueKey - 資料物件中代表數值（票數/分數）的鍵名（例如：'votes'）。
 * @param {string} nameKey - 資料物件中代表名稱/標籤的鍵名（例如：'candidate'）。
 */
function renderProportionalList(container, data, valueKey, nameKey) {
  if (!container || !data || data.length === 0) {
    if (container) container.innerHTML = '';
    return;
  }

  // 1. 找到最大值 (Max Value)
  // 因為資料已假設為降序，最大值就是第一個項目的數值。
  // 使用 .votes 或 valueKey 來取得數值
  const maxVal = data.length > 0 ? (data[0][valueKey] || 1) : 1;

  // 清空容器
  container.innerHTML = '';

  const fragment = document.createDocumentFragment();

  data.forEach((item, index) => {
    // 取得當前項目的數值
    const currentVal = item[valueKey] || 0;

    // 2. 計算比例寬度 (Proportional Width)
    const pct = maxVal > 0 ? (currentVal / maxVal) * 100 : 0;

    // 3. 創建並設定 DOM 元素
    const el = document.createElement('div');
    el.className = 'answer'; // 沿用 ws.js 和 voting-sim.js 的 CSS 類名

    // 應用比例寬度
    el.style.width = pct + '%';

    // 設置內部 HTML 結構，使用傳入的鍵名
    // <div class="who">No.${escapeHtml(item[nameKey])}</div>
    el.innerHTML = `
      <div class="meta">
        <div class="meta-left">
            <div class="rank">${index + 1}</div>
            <div class="who">${escapeHtml(item[nameKey])}</div>
        </div>
        <div class="meta-right">
            <div class="score">${escapeHtml(currentVal)}</div>
        </div>
      </div>
    `;

    fragment.appendChild(el);

    // 為了視覺效果，可以為排名第一的項目添加一個特殊類別
    if (index === 0) {
        el.classList.add('top-rank');
    }
  });

  container.appendChild(fragment);
}

// Minimal HTML-escaping utility (從 ws.js 複製過來)
function escapeHtml(s) {
  return String(s || '').replace(/[&<>\\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Render the votingState into the DOM (updated for ranking data)
function renderVotes() {
  if (!votingListEl) return;
  votingListEl.innerHTML = '';

  // votingState 預期為：[{ rank: x, candidate: y, updated_at: ts }, ...]
  // <div class="meta-left"><div class="who">${escapeHtml(itm.candidate)}</div></div>
  votingState.forEach((itm, i) => {
    const el = document.createElement('div');
    el.className = 'answer' + (i === 0 ? ' new' : '');
    el.innerHTML = `
      <div class="meta">
        <div class="meta-left"><div class="who">${escapeHtml(itm.staffName)}</div></div>
        <div class="meta-right"><div class="ts">${escapeHtml(itm.votes)}</div></div>
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

// === Polling function ===
async function fetchVotes() {
    try {
        const res = await fetch(FETCH_URL + 'get/votes');
        if (!res.ok) throw new Error('HTTP ' + res.status);

        const data = await res.json();

        // data.results = [{rank:1, candidate:33}, ...]
        // 把 updated_at 帶進每筆方便使用
        if (data.updated_at) {
          data.results.forEach(r => r.updated_at = data.updated_at);
        }

        votingState = data.results.slice(0, 10); // 確保最多 10 筆
        renderVotes();
        // renderProportionalList(votingListEl, votingState, 'votes', 'candidate');
        renderProportionalList(votingListEl, votingState, 'votes', 'staffName');

        console.log("資料更新成功 👍 " + formatDateTime());
    } catch (err) {
        disconnect();
        log("資料更新失敗: " + err.message + " ⚠️ " + formatDateTime());
    }
}

function formatTimestamp(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString();
}
