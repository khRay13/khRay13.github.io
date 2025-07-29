document.addEventListener('DOMContentLoaded', () => {
  const optionsFileInput = document.getElementById('optionsFile');
  const startButton = document.getElementById('startButton');
  const status = document.getElementById('status');
  const reel = document.getElementById('reel');
  const reelContent = reel.querySelector('.reel-content');
  
  let options = ['Option 1', 'Option 2', 'Option 3']; // 預設選項
  let availableOptions = [...options]; // 可用的選項列表

  // 處理檔案上傳並調整寬度
  optionsFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        options = event.target.result.split('\n').map(item => item.trim()).filter(item => item);
        if (options.length === 0) {
          options = ['Option 1', 'Option 2', 'Option 3'];
          availableOptions = [...options];
          status.textContent = '檔案無有效選項，使用預設選項';
        } else {
          availableOptions = [...options];
          // 計算最長文字的寬度並調整 reel 寬度
          const longestOption = options.reduce((longest, current) => 
            current.length > longest.length ? current : longest, '');
          const tempSpan = document.createElement('span');
          tempSpan.style.font = '28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          tempSpan.style.visibility = 'hidden';
          tempSpan.textContent = longestOption;
          document.body.appendChild(tempSpan);
          const width = Math.max(160, tempSpan.getBoundingClientRect().width + 20); // 最小 160px，額外 20px 留邊距
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
    status.textContent = '抽籤中...';
    reel.classList.add('spinning');
    updateReelContent();

    // 模擬快速滾動後停止
    setTimeout(() => {
      reel.classList.remove('spinning');
      reel.classList.add('stopping');
      const randomIndex = Math.floor(Math.random() * availableOptions.length);
      const selectedOption = availableOptions[randomIndex];
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
      // 準備下次動畫
      setTimeout(() => {
        reel.classList.remove('stopping');
      }, 500);
    }, 1000);
  });

  // 初始化滾輪內容
  updateReelContent();
});