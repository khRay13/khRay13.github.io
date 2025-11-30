(function(){
  /*
    voting-sim.js
    - Simulate ranking changes for 15 candidates
    - Update every 500ms
    - Uses FLIP technique to animate list reordering smoothly
    - Exposes window.votingSim.start() and .stop() for easy control/removal

    *** FIX: 修正 DOM 排序邏輯，明確移除掉出 Top 10 的元素，以避免 Rank 10 -> Rank 1 的時序/順序錯誤。***
  */

  const INTERVAL_MS = 30000; // update every 30s
  const CANDIDATE_COUNT = 15;
  const TOP_DISPLAY = 10; // only show top 10 in the list
  const containerId = 'voting-list';
  // tuning parameters for vote changes
  const BURST_PROB = 0.06; // chance to get a larger burst
  const BURST_MAX = 20;    // max votes added on burst
  const NORMAL_MAX = 8;    // max votes added on normal increment

  const makeCandidates = () => {
    const arr = [];
    for (let i = 1; i <= CANDIDATE_COUNT; i++) {
      arr.push({ id: 'c' + i, name: `# ${i}`, votes: Math.floor(Math.random() * 200), initialIndex: i });
    }
    // sort desc initially
    arr.sort((a,b) => b.votes - a.votes);
    return arr;
  };

  let candidates = makeCandidates();
  let timer = null;
  // remember previous rendered order (id -> index) to use as tie-breaker
  let prevOrder = new Map();

  function sortCandidates(){
    // sort by votes desc, stable by id as tie-breaker
    candidates.sort((a,b) => {
      const diff = b.votes - a.votes;
      if (diff !== 0) return diff;
      // tie-breaker: prefer previous order if available
      if (prevOrder.has(a.id) && prevOrder.has(b.id)) {
        return prevOrder.get(a.id) - prevOrder.get(b.id);
      }
      // fallback: use initial creation order (numeric) to keep deterministic stable ordering
      return (a.initialIndex || 0) - (b.initialIndex || 0);
    });
    // verification: ensure the array is actually non-increasing by votes
    for (let i = 1; i < candidates.length; i++){
      if (candidates[i-1].votes < candidates[i].votes){
        // unexpected: resort and log for debugging
        console.warn('voting-sim: sort verification failed; re-sorting candidates', candidates.map(c=>c.votes));
        candidates.sort((a,b) => b.votes - a.votes || a.id.localeCompare(b.id));
        break;
      }
    }
  }

  function ensureContainer(){
    return document.getElementById(containerId);
  }

  function renderInitial(){
    const container = ensureContainer();
    if (!container) return;
    container.innerHTML = '';
    // ensure sorted by votes desc before initial render
    sortCandidates();
    // determine max votes among top candidates (for proportional widths)
    const maxVotes = candidates.length ? (candidates[0].votes || 1) : 1;
    candidates.slice(0, TOP_DISPLAY).forEach((c, idx) => {
      const el = makeItemEl(c);
      const rankEl = el.querySelector('.rank');
      if (rankEl) rankEl.textContent = String(idx + 1);
      const pct = maxVotes > 0 ? (c.votes / maxVotes) * 100 : 0;
      // set initial width proportional to top vote (first = 100%)
      el.style.width = pct + '%';
      container.appendChild(el);
    });
    // record initial rendered order for future tie-breaking
    prevOrder.clear();
    Array.from(container.children).forEach((n, idx) => prevOrder.set(n.dataset.id, idx));
  }

  function makeItemEl(item){
    const el = document.createElement('div');
    el.className = 'answer';
    el.dataset.id = item.id;
    el.innerHTML = `
      <div class="meta"><div class="rank"></div><div class="who">${escapeHtml(item.name)}</div></div>
      <div class="score">${escapeHtml(item.votes)}</div>
    `;
    return el;
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  // FLIP animate reorder: before DOM change record positions, after change compute deltas
  function flipAnimate(oldPositions){
    const container = ensureContainer();
    if (!container) return;
    const nodes = Array.from(container.children);
    // compute new positions
    const newPositions = new Map();
    for (const node of nodes){
      newPositions.set(node.dataset.id, node.getBoundingClientRect());
    }
    // apply transforms to invert
    for (const node of nodes){
      const id = node.dataset.id;
      const old = oldPositions.get(id);
      const neu = newPositions.get(id);

      // 僅對同時存在於舊位置和新位置的元素進行動畫
      if (!old || !neu) continue;

      const deltaY = old.top - neu.top;
      if (deltaY){
        node.style.transition = 'none';
        node.style.transform = `translateY(${deltaY}px)`;
        // force reflow
        node.getBoundingClientRect();
        // animate to zero
        node.style.transition = 'transform 700ms cubic-bezier(.2,.9,.2,1)';
        node.style.transform = '';
        // cleanup after animation
        (function(n){
          const cleanup = () => {
            // 清理屬性，但確保不會意外清除 transitionend 導致的動畫
            if (n.style.transform === '') {
              n.style.transition = '';
            }
            n.removeEventListener('transitionend', cleanup);
          };
          // 使用 setTimeout 作為 fallback，以確保在 transitionend 失敗時也能清理
          const timeout = setTimeout(cleanup, 800);
          n.addEventListener('transitionend', () => {
            clearTimeout(timeout);
            cleanup();
          });
        })(node);
      }
    }
  }

  function updateVotesAndRender(){
    const container = ensureContainer();
    if (!container) return;

    // F (First): 記錄舊位置
    const oldPositions = new Map();
    // 遍歷當前所有子節點
    for (const child of Array.from(container.children)){
      oldPositions.set(child.dataset.id, child.getBoundingClientRect());
    }

    // 記錄當前順序作為 tie-breaker
    prevOrder.clear();
    candidates.forEach((c, idx) => prevOrder.set(c.id, idx));

    // 變動 votes (Mutate)
    for (const c of candidates){
      const delta = (Math.random() < BURST_PROB) ? Math.floor(Math.random()*BURST_MAX) : Math.floor(Math.random()*NORMAL_MAX);
      c.votes += delta;
    }

    // shuffle minor randomness
    if (Math.random() < 0.2){
      const i = Math.floor(Math.random()*candidates.length);
      const j = Math.floor(Math.random()*candidates.length);
      const tmp = candidates[i]; candidates[i] = candidates[j]; candidates[j] = tmp;
    }

    // L (Last): 排序
    sortCandidates();

    // --- 修正後的 DOM 更新邏輯開始 ---

    // 1. 建立一個包含新的 Top N ID 的集合
    const newTopIds = new Set(candidates.slice(0, TOP_DISPLAY).map(c => c.id));

    // 2. 準備現有 DOM 節點的 Map
    const existing = new Map();
    for (const node of Array.from(container.children)){
      existing.set(node.dataset.id, node);
    }

    // 3. 移除所有不在新 Top N 列表中的現有子元素 (清理掉出列表的舊 Rank 10 元素)
    Array.from(container.children).forEach(node => {
      if (!newTopIds.has(node.dataset.id)) {
        // 從 DOM 移除
        container.removeChild(node);
        // 從 oldPositions 移除，避免 flipAnimate 試圖處理一個已移除的元素
        oldPositions.delete(node.dataset.id);
      }
    });

    // 4. 重建 DOM 結構，確保順序正確 (L 步驟的另一部分)
    const maxVotes = candidates.length ? (candidates[0].votes || 1) : 1;
    const fragment = document.createDocumentFragment();

    candidates.slice(0, TOP_DISPLAY).forEach((c, idx) => {
      // 取得或創建節點
      const node = existing.get(c.id) || makeItemEl(c);

      // 更新顯示內容
      const scoreEl = node.querySelector('.score');
      if (scoreEl) scoreEl.textContent = String(c.votes);
      const rankEl = node.querySelector('.rank');
      if (rankEl) rankEl.textContent = String(idx + 1);

      // 更新寬度
      const pct = maxVotes > 0 ? (c.votes / maxVotes) * 100 : 0;
      node.style.width = pct + '%';

      // 將節點放入 DocumentFragment (優化性能)
      fragment.appendChild(node);
    });

    // 5. 一次性替換容器內容
    container.innerHTML = '';
    container.appendChild(fragment);

    // --- 修正後的 DOM 更新邏輯結束 ---

    // I (Invert) & P (Play): 動畫
    flipAnimate(oldPositions);

    // 更新 prevOrder to reflect this render order
    prevOrder.clear();
    Array.from(container.children).forEach((n, idx) => prevOrder.set(n.dataset.id, idx));
  }

  function start(){
    stop();
    renderInitial();
    timer = setInterval(updateVotesAndRender, INTERVAL_MS);
  }

  function stop(){
    if (timer) { clearInterval(timer); timer = null; }
  }

  // expose control for easy removal
  window.votingSim = { start, stop, _candidates: candidates };

  // auto-start simulation when loaded
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();