// const WS_URL = "wss://REPLACE_WITH_YOUR_WEBSOCKET_ENDPOINT/dev";
const WS_URL = "wss";
const BATCH_INTERVAL_MS = 100;
const MAX_DISPLAY = 50;

let ws = null, connected = false, reconnectAttempts = 0;
let messageQueue = [], answersState = [];

const connStatus = document.getElementById('connStatus');
const statusText = document.getElementById('statusText');
const answersEl = document.getElementById('answers');
const logEl = document.getElementById('log');
const btnToggle = document.getElementById('btnToggle');

let manualDisconnect = false;
btnToggle.onclick = () => {
  if(!connected){
    manualDisconnect = false; // 這次是主動 Connect
    statusText.innerText = "連線中..."; // 顯示提示
    connect();
  } else {
    manualDisconnect = true; // 主動斷線
    disconnect();
  }
};
document.getElementById('btnClear').onclick = () => { answersState = []; renderAnswers(); };

function log(msg){ logEl.innerText = `[${new Date().toLocaleTimeString()}] ${msg}\n` + logEl.innerText; }

function connect(){
  if (!WS_URL.includes("REPLACE")){ ws = new WebSocket(WS_URL); }
  else { log("請設定 WS_URL"); return; }

  ws.onopen = ()=>{
    connected=true; reconnectAttempts=0;
    statusText.innerText="已連線"; connStatus.classList.add('connected');
    btnToggle.innerText="Disconnect"; btnToggle.classList.replace("bg-green-500","bg-red-500");
    log("WebSocket 已建立連線"); startHeartbeat();
  };

  ws.onmessage = evt => {
    try { messageQueue.push(JSON.parse(evt.data)); }
    catch(e){ log("非 JSON 訊息: "+evt.data); }
  };

//   ws.onclose = evt=>{
//     connected=false; connStatus.classList.remove('connected');
//     statusText.innerText="已斷線"; btnToggle.innerText="Connect"; btnToggle.classList.replace("bg-red-500","bg-green-500");
//     log(`連線已關閉 (code=${evt.code})`); stopHeartbeat(); scheduleReconnect();
//   };
  ws.onclose = wsOnClose;

  ws.onerror = err=>{ log("WebSocket error: "+(err.message||JSON.stringify(err))); }
}

function disconnect(){ if(ws) ws.close(); }

function wsOnClose(evt){
  connected = false;
  connStatus.classList.remove('connected');
  statusText.innerText = "已斷線";
  btnToggle.innerText = "Connect";
  btnToggle.classList.replace("bg-red-500","bg-green-500");
  log(`連線已關閉 (code=${evt.code})`);
  stopHeartbeat();
  if(!manualDisconnect){ // 非手動斷線才排程重連
    scheduleReconnect();
  }
}

function safeCloseWs(){ try{ if(ws) ws.close(); }catch{} ws=null; stopHeartbeat(); }

function scheduleReconnect(){
  reconnectAttempts++;
  const delay = Math.min(30000, Math.pow(2, Math.min(reconnectAttempts,6))*1000);
  log(`重連排程：${delay/1000}s 後嘗試 (第${reconnectAttempts}次)`);
  setTimeout(()=>connect(), delay);
}

let hbTimer=null;
function startHeartbeat(){ if(hbTimer) clearInterval(hbTimer); hbTimer=setInterval(()=>{ if(connected&&ws&&ws.readyState===WebSocket.OPEN){ try{ ws.send(JSON.stringify({action:"ping",ts:Date.now()})); }catch{} } },25000);}
function stopHeartbeat(){ if(hbTimer){ clearInterval(hbTimer); hbTimer=null; } }

setInterval(()=>{
  if(messageQueue.length===0) return;
  const batch = messageQueue.splice(0,messageQueue.length);
  handleBatch(batch);
}, BATCH_INTERVAL_MS);

function handleBatch(batch){
  batch.forEach(msg=>{
    let entry = normalizeAnswer(msg.body || msg);
    if(!answersState.some(a=>a.id===entry.id)) answersState.unshift(entry);
  });
  if(answersState.length>MAX_DISPLAY) answersState=answersState.slice(0,MAX_DISPLAY);
  renderAnswers();
}

function normalizeAnswer(msg){
  const now=Date.now();
  return {id: msg.id || `${msg.alias||'u'}_${msg.time||now}_${Math.random().toString(36).slice(2,7)}`, user: msg.alias||'匿名', answer: msg.answer||'', score: msg.score||'', ts: msg.time||now};
}

function renderAnswers(){
  answersEl.innerHTML='';
  answersState.forEach((itm,i)=>{
    const el=document.createElement('div');
    el.className='answer'+(i===0?' new':'');
    el.innerHTML=`<div class="avatar">${escapeHtml((itm.user||'匿名').slice(0,2))}</div>
                    <div class="meta"><div class="who">${escapeHtml(itm.user)}</div><div class="txt">${escapeHtml(itm.answer)}</div></div>
                    <div class="score">${escapeHtml(itm.score||'')}</div>`;
    answersEl.appendChild(el);
    if(i===0) setTimeout(()=>el.classList.remove('new'),800);
  });
}

function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

log('Client initialized.');