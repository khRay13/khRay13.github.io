/*
  WebSocket client for real-time quiz board
  - 使用 messageQueue + batch render (100ms)
  - 支援 message types: new_question, answer_update, full_update
  - 自動 reconnect + heartbeat ping
*/

// const WS_URL = "wss://REPLACE_WITH_YOUR_WEBSOCKET_ENDPOINT/dev"; // <-- 改成你的 endpoint
const WS_URL = "wss://42c6gvp4wh.execute-api.ap-southeast-1.amazonaws.com/poc/";
const BATCH_INTERVAL_MS = 100;   // 前端批次更新間隔（可微調，100ms 很適合高併發）
const MAX_DISPLAY = 50;         // 畫面上最多顯示幾筆搶答

let ws = null;
let connected = false;
let reconnectAttempts = 0;
let messageQueue = [];
let answersState = []; // 目前顯示的 answers（最新在前）
let currentQuestion = null;

// DOM
const connStatus = document.getElementById('connStatus');
const statusText = document.getElementById('statusText');
const answersEl = document.getElementById('answers');
const logEl = document.getElementById('log');
const questionText = document.getElementById('questionText');
const questionMeta = document.getElementById('questionMeta');
document.getElementById('btnReconnect').onclick = () => {
  log('Manual reconnect requested');
  reconnectAttempts = 0;
  safeCloseWs();
  connect();
};
document.getElementById('btnClear').onclick = () => {
  answersState = [];
  renderAnswers();
};

function log(msg){
  const ts = new Date().toLocaleTimeString();
  logEl.innerText = `[${ts}] ${msg}\n` + logEl.innerText;
}

// CONNECT / RECONNECT
function connect() {
  if (!WS_URL || WS_URL.includes("REPLACE_WITH_YOUR_WEBSOCKET_ENDPOINT")){
    log("請先設定 WS_URL 才能連線");
    statusText.innerText = "未設定 WS_URL";
    return;
  }

  log(`嘗試連線: ${WS_URL}`);
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    connected = true;
    reconnectAttempts = 0;
    statusText.innerText = "已連線";
    connStatus.classList.add('connected');
    log("WebSocket 已建立連線");
    // 開始心跳 (ping)
    startHeartbeat();
  };

  ws.onmessage = (evt) => {
    try {
      const payload = JSON.parse(evt.data);
      // push to queue only (快速)
      messageQueue.push(payload);
    } catch (e) {
      log("收到非 JSON 訊息: " + evt.data);
    }
  };

  ws.onclose = (evt) => {
    connected = false;
    connStatus.classList.remove('connected');
    statusText.innerText = "已斷線";
    log(`連線已關閉 (code=${evt.code})`);
    stopHeartbeat();
    scheduleReconnect();
  };

  ws.onerror = (err) => {
    log("WebSocket error: " + (err.message || JSON.stringify(err)));
    // 錯誤也會觸發 onclose
  };
}

// 安全關閉
function safeCloseWs(){
  try { if (ws) ws.close(); } catch(e){/*ignore*/ }
  ws = null;
  stopHeartbeat();
}

// 指數退避重連
function scheduleReconnect(){
  reconnectAttempts++;
  const delay = Math.min(30000, Math.pow(2, Math.min(reconnectAttempts, 6)) * 1000); // cap 30s
  log(`重連排程：${delay/1000}s 後嘗試 (第 ${reconnectAttempts} 次)`);
  setTimeout(() => connect(), delay);
}

// 心跳處理：每 25 秒送一個 ping（視 server 是否需要）
let hbTimer = null;
function startHeartbeat(){
  if (hbTimer) clearInterval(hbTimer);
  hbTimer = setInterval(() => {
    if (connected && ws && ws.readyState === WebSocket.OPEN){
      try {
        ws.send(JSON.stringify({ action: "ping", ts: Date.now() }));
      } catch(e) { /* ignore */ }
    }
  }, 25000);
}
function stopHeartbeat(){ if (hbTimer){ clearInterval(hbTimer); hbTimer = null; } }

// BATCH 處理：每 BATCH_INTERVAL_MS 更新畫面
setInterval(() => {
  if (messageQueue.length === 0) return;
  const batch = messageQueue.splice(0, messageQueue.length); // 清空 queue
  handleBatch(batch);
}, BATCH_INTERVAL_MS);

// 處理一批訊息（可能包含多種 type）
function handleBatch(batch){
  // 合併處理：以最後一筆 question、並依序加入 answers
  let lastQuestion = null;
  const answerMsgs = [];

  for (const msg of batch){
    if (msg.type === 'new_question'){
      lastQuestion = msg;
    } else if (msg.type === 'answer_update'){
      // 一般搶答訊息格式預期: {type:'answer_update', user:'XXX', answer:'...', ts:...}
      answerMsgs.push(msg);
    } else if (msg.type === 'full_update'){
      // full_update 可用來直接替換整個狀態
      if (msg.question) lastQuestion = { question: msg.question, meta: msg.meta || '' };
      if (Array.isArray(msg.answers)) {
        // 直接替換 entire answersState (保留最新在前)
        answersState = msg.answers.slice().reverse().slice(0, MAX_DISPLAY);
      }
    } else {
      // 未知訊息：把它放到 answerMsgs 方便顯示
      answerMsgs.push(msg);
    }
  }

  // 若有新的題目，更新題目並清空舊的搶答（視需求；這裡假設新題目清掉之前的）
  if (lastQuestion){
    currentQuestion = lastQuestion.question || lastQuestion;
    questionText.innerText = currentQuestion;
    questionMeta.innerText = lastQuestion.meta || `題目時間：${new Date().toLocaleTimeString()}`;
    // 若需要在新題目時清空舊搶答，取消下面註解
    answersState = [];
  }

  // 將 answerMsgs 依序 prepend 到 answersState（最新在前）
  for (const m of answerMsgs){
    const entry = normalizeAnswer(m);
    // 簡單去重：若同一 user 且相同 ts 則跳過
    if (!answersState.some(a => a.id === entry.id)) {
      answersState.unshift(entry);
    }
  }

  // clip to MAX_DISPLAY
  if (answersState.length > MAX_DISPLAY) answersState = answersState.slice(0, MAX_DISPLAY);

  // 最後 render
  renderAnswers();
}

// 將 incoming 訊息標準化成 display entry
function normalizeAnswer(msg){
  // 預設欄位
  const now = Date.now();
  const id = msg.id || `${msg.user || 'u'}_${msg.ts || now}_${Math.random().toString(36).slice(2,7)}`;
  return {
    id,
    user: msg.user || msg.name || '匿名',
    answer: msg.answer || msg.text || JSON.stringify(msg),
    score: msg.score || '',
    ts: msg.ts || now,
    raw: msg
  };
}

// 真正執行 DOM update（盡量最小化操作）
function renderAnswers(){
  // 這個方法會重新生成目前 answersState 的 DOM（因為 MAX_DISPLAY 通常不大，這樣實作簡單且穩定）
  // 若你要極度優化，可改為 diff DOM
  answersEl.innerHTML = '';
  for (let i = 0; i < answersState.length; i++){
    const itm = answersState[i];
    const el = document.createElement('div');
    el.className = 'answer' + (i === 0 ? ' new' : '');
    el.innerHTML = `
      <div class="avatar">${escapeHtml((itm.user||'匿名').slice(0,2))}</div>
      <div class="meta">
        <div class="who">${escapeHtml(itm.user)}</div>
        <div class="txt">${escapeHtml(itm.answer)}</div>
      </div>
      <div class="score">${escapeHtml(itm.score || '')}</div>
    `;
    answersEl.appendChild(el);
    // 新項目短暫高亮
    if (i === 0) {
      setTimeout(()=> el.classList.remove('new'), 800);
    }
  }
}

// 輔助：簡單 escape
function escapeHtml(s){
  return String(s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

// 初始化
connect();
log('Client initialized.');

// debug: 若你想測試可以按以下方式手動推入訊息（打開 devtools console）
window.__TEST_PUSH = function(obj){
  // 模擬 server 訊息
  messageQueue.push(obj);
  log('Test message queued: ' + JSON.stringify(obj));
};