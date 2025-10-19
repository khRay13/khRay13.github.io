/* TODO 目前已實作到可以在lambda收到action類別
        下一步需要根據 action 類別來處理不同的邏輯 */
const BATCH_INTERVAL_MS = 10;

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
    connect();
  } else {
    manualDisconnect = true; // 主動斷線
    disconnect();
  }
};
document.getElementById('btnClear').onclick = () => {
  answersState = []; renderAnswers();
  log("Cleared.");
};

function log(msg){ logEl.innerText = `[${new Date().toLocaleTimeString()}] ${msg}\n` + logEl.innerText; }

function connect(){
  let WS_URL = document.getElementById("wssUrl").value;
  // console.log("WS_URL=", WS_URL);
  if (!WS_URL.trim()=="") {
    statusText.innerText = "連線中..."; // 顯示提示
    ws = new WebSocket(WS_URL);
  } else {
    log("請設定 WS_URL");
    return;
  }

  ws.onopen = ()=>{
    connected=true; reconnectAttempts=0;
    statusText.innerText="已連線";
    connStatus.classList.add('connected');
    btnToggle.innerText="Disconnect";
    btnToggle.classList.replace("bg-green-500","bg-red-500");
    log("WebSocket 已建立連線");

    // const payload = {
    //   action: "register",
    //   alias: "viewer_onlyans",
    //   ts: Date.now()
    // };
    // try {
    //   ws.send(JSON.stringify(payload)); log("註冊訊息已送出");
    // } catch(e) {
    //   log("註冊訊息送出失敗: "+e.message);
    // }
  };

  // TODO 加入當 Server 處理 Clear 且完成發送時, 清空目前的 answersState 陣列

  ws.onmessage = evt => {
    // console.log("收到訊息: ", evt.data);
    try {
      messageQueue.push(JSON.parse(evt.data));
    } catch(e) {
      log("非 JSON 訊息: "+evt.data);
    }
  };

  ws.onclose = evt=>{
    connected = false;
      connStatus.classList.remove('connected');
      statusText.innerText = "已斷線";
      btnToggle.innerText = "Connect";
      btnToggle.classList.replace("bg-red-500","bg-green-500");
      log(`連線已關閉 (code=${evt.code})`);
      if(!manualDisconnect){ // 非手動斷線才排程重連
        scheduleReconnect();
      }
  };
  ws.onerror = err=>{ log("WebSocket error: "+(err.message||JSON.stringify(err))); }
}
function disconnect(){
  if(ws) ws.close();
}

function safeCloseWs(){
  try{
    if(ws) ws.close();
  } catch{} ws=null;
}

function scheduleReconnect(){
  reconnectAttempts++;
  const delay = Math.min(30000, Math.pow(2, Math.min(reconnectAttempts,6))*1000);
  log(`重連排程：${delay/1000}s 後嘗試 (第${reconnectAttempts}次)`);
  setTimeout(()=>connect(), delay);
}

setInterval(()=>{
  if(messageQueue.length===0) return;
  const batch = messageQueue.splice(0,messageQueue.length);
  handleBatch(batch);
}, BATCH_INTERVAL_MS);

function handleBatch(batch){
  let MAX_DISPLAY = parseInt(document.getElementById('maxAnswers').value)||10;
  batch.forEach(msg=>{
    let entry = normalizeAnswer(msg.body || msg);
    if(!answersState.some(a=>a.id===entry.user)) answersState.unshift(entry);
  });
  if(answersState.length>MAX_DISPLAY) answersState=answersState.slice(0,MAX_DISPLAY);
  renderAnswers();
}

function normalizeAnswer(msg){
  const now=Date.now();
  console.log("Response: ", msg);

  // Transfrom the time format from ISO to HH:MM:SS
  let std_time = msg.time.split("T")[1].split("+")[0];
  return {user: msg.alias||'None', ts: std_time||now};
}

function renderAnswers(){
  answersEl.innerHTML='';
  answersState.forEach((itm,i)=>{
    const el=document.createElement('div');
    el.className='answer'+(i===0?' new':'');
    el.innerHTML=`<div class="meta"><div class="who">${escapeHtml(itm.user)}</div></div>
                    <div class="score">${escapeHtml(itm.ts)}</div>`;
    answersEl.appendChild(el);
    if(i===0) setTimeout(()=>el.classList.remove('new'),800);
  });
}

function escapeHtml(s){
  return String(s||'').replace(
    /[&<>"]/g, c=>(
      {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]
    )
  );
}

log('Client initialized.');