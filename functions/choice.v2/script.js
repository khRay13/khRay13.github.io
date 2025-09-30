document.addEventListener('DOMContentLoaded', () => {
  const optionsFileInput = document.getElementById('optionsFile'); // 檔案上傳輸入
  const startButton = document.getElementById('startButton'); // 開始抽籤按鈕
  const answerButton = document.getElementById('answerButton'); // 公佈答案按鈕
  const status = document.getElementById('status'); // 狀態顯示
  const reel = document.getElementById('reel'); // 抽籤滾輪
  const reelContent = reel.querySelector('.reel-content'); // 滾輪內容
  const modalOverlay = document.getElementById('modalOverlay'); // 解答小視窗遮罩
  const modalContent = document.getElementById('modalContent'); // 解答小視窗內容
  const modalClose = document.getElementById('modalClose'); // 解答小視窗關閉按鈕
  const modalBody = document.getElementById('modalBody'); // 解答小視窗主體

  let options = ['Option 1', 'Option 2', 'Option 3']; // 預設選項
  let availableOptions = [...options]; // 可用選項
  let optionsWithAnswers = {}; // 儲存題目與解答的對應
  let currentQuestion = null; // 當前抽中的題目

  // 處理檔案上傳並調整寬度
  optionsFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        // 解析檔案內容
        const lines = event.target.result.split('\n').map(item => item.trim()).filter(item => item);

        // 如果檔案無效，使用預設選項
        if (lines.length === 0) {
          options = ['Option 1', 'Option 2', 'Option 3'];
          availableOptions = [...options];
          optionsWithAnswers = {};
          status.textContent = '檔案無有效選項，使用預設選項';
        } else {
          options = [];
          optionsWithAnswers = {};

          // 解析 CSV 格式
          lines.forEach(line => {
            const parts = line.split(',');
            const question = parts[0].trim();
            const answer = parts.length > 1 ? parts[1].trim() : '無解答';
            options.push(question);
            optionsWithAnswers[question] = answer;
          });

          // 重置可用選項
          availableOptions = [...options];

          // 計算最長文字的寬度並調整 reel 寬度
          const longestOption = options.reduce((longest, current) =>
            current.length > longest.length ? current : longest, '');
          const tempSpan = document.createElement('span');
          tempSpan.style.font = '28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          tempSpan.style.visibility = 'hidden';
          tempSpan.textContent = longestOption;
          document.body.appendChild(tempSpan);
          const width = Math.max(250, tempSpan.getBoundingClientRect().width + 40); // 最小 160px，額外 20px 留邊距
          document.body.removeChild(tempSpan);
          reel.style.width = `${width}px`;
          status.textContent = `已載入 ${options.length} 個選項`;
          startButton.disabled = false;
        }
        updateReelContent();
      };
      reader.readAsText(file);
    }
  });

  // 更新滾輪內容
  function updateReelContent() {
    reelContent.innerHTML = '';
    if (availableOptions.length > 0) {
      const displayOptions = [...availableOptions, ...availableOptions].slice(0, 10); // 重複選項以填充滾輪
      displayOptions.forEach(option => {
        const span = document.createElement('span');
        span.textContent = option;
        reelContent.appendChild(span);
      });
    } else {
      const span = document.createElement('span');
      span.textContent = '無選項';
      reelContent.appendChild(span);
    }
    reelContent.style.transform = 'translateY(0)';
    reelContent.style.height = `${reel.clientHeight}px`;
  }

  // 開始抽籤
  startButton.addEventListener('click', () => {
    if (availableOptions.length === 0) {
      status.textContent = '無可用選項，請上傳新檔案或重置';
      startButton.disabled = true;
      return;
    }

    startButton.disabled = true;
    answerButton.disabled = true;
    status.textContent = '抽籤中...';
    reel.classList.add('spinning');
    updateReelContent();

    // 模擬快速滾動後停止
    setTimeout(() => {
      reel.classList.remove('spinning');
      reel.classList.add('stopping');
      const randomIndex = Math.floor(Math.random() * availableOptions.length);
      const selectedOption = availableOptions[randomIndex];
      currentQuestion = selectedOption; // 記錄當前抽中的題目

      // 動態更新最終選項並置中
      reelContent.innerHTML = '';
      const finalSpan = document.createElement('span');
      finalSpan.textContent = selectedOption;
      reelContent.appendChild(finalSpan);

      // 移除已抽選項
      availableOptions.splice(randomIndex, 1);
      //status.textContent = `抽中：${selectedOption}！${availableOptions.length} 個選項剩餘`;
      console.log(`抽中：${selectedOption}！${availableOptions.length} 個選項剩餘`);
      status.textContent = `登登 ~`;
      startButton.disabled = false;
      answerButton.disabled = false;

      // 準備下次動畫
      setTimeout(() => {
        reel.classList.remove('stopping');
      }, 500);
    }, 1000);
  });

  // 公佈答案按鈕
  answerButton.addEventListener('click', () => {
    if (currentQuestion && optionsWithAnswers[currentQuestion]) {
      modalBody.textContent = optionsWithAnswers[currentQuestion];
      modalOverlay.classList.add('show');
    }
  });

  // 關閉小視窗 - 點擊 X
  modalClose.addEventListener('click', (e) => {
    e.stopPropagation();
    modalOverlay.classList.remove('show');
  });

  // 關閉小視窗 - 點擊遮罩層
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.classList.remove('show');
    }
  });

  // 防止點擊小視窗內容時關閉
  modalContent.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // 初始化滾輪內容
  updateReelContent();
});