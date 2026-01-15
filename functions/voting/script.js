const _0xdaa88b=_0x381c;
function _0x5deb(){
    const _0x5114d6=['Invalid\x20ID\x20length.','18ZCjPZi','12vPfAjz','5558340GSWkiv','12825856bCYBMj','29065122TdGysU','Invalid\x20Base62\x20character.','3519748mPKOnv','length','indexOf','202051mOYoqE','0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ','4384182HsVzLM','2525957YTrRtH'];
    _0x5deb=function(){return _0x5114d6;};
    return _0x5deb();
}
function _0x381c(_0xfeb55f,_0x178ee2){
    const _0x5deb2e=_0x5deb();
    return _0x381c=function(_0x381cdc,_0x514f31){
        _0x381cdc=_0x381cdc-0xf7;
        let _0x3dc8b9=_0x5deb2e[_0x381cdc];
        return _0x3dc8b9;
    },
    _0x381c(_0xfeb55f,_0x178ee2);
}(
    function(_0x2d4575,_0x1d53d7){
        const _0x4fc58d=_0x381c,_0x3543c5=_0x2d4575();
        while(!![]){
            try{
                const _0x27682b=parseInt(_0x4fc58d(0xf7))/0x1*(-parseInt(_0x4fc58d(0xfd))/0x2)+-parseInt(_0x4fc58d(0xf9))/0x3+parseInt(_0x4fc58d(0x102))/0x4+-parseInt(_0x4fc58d(0xfe))/0x5+-parseInt(_0x4fc58d(0xfc))/0x6*(parseInt(_0x4fc58d(0xfa))/0x7)+parseInt(_0x4fc58d(0xff))/0x8+parseInt(_0x4fc58d(0x100))/0x9;
                if(_0x27682b===_0x1d53d7)break;
                else _0x3543c5['push'](_0x3543c5['shift']());
            }catch(_0x4dc139){
                _0x3543c5['push'](_0x3543c5['shift']());
            }
        }
    }(_0x5deb,0xce3a2));
    const BASE62_CHARS=_0xdaa88b(0xf8);
    function decodeIdNoZero(_0x851987){
        const _0x3f4100=_0xdaa88b;
        if(_0x851987[_0x3f4100(0x103)]!==0x8)throw new Error(_0x3f4100(0xfb));
        let _0x2beca8=0x0;
        for(const _0x117659 of _0x851987){
            const _0x5899cf=BASE62_CHARS[_0x3f4100(0x104)](_0x117659);
            if(_0x5899cf===-0x1)throw new Error(_0x3f4100(0x101));
            _0x2beca8=_0x2beca8*0x3e+_0x5899cf;
        }
        return _0x2beca8-0x333f0966f80>>0x1^0x1352505;
    }

// get votenbr from URL
document.addEventListener("DOMContentLoaded", function(){
    const params = new URLSearchParams(window.location.search);
    const voteNbr = params.get("voteNbr");
    if (voteNbr !== null) {
      console.log("讀到 votenbr =", voteNbr);
      // 接下來你可以把這值填入 input 或改變畫面
      const inp = document.getElementById("voting-id");
      if (inp) {
        inp.textContent = decodeIdNoZero(voteNbr);
      }
    } else {
      console.log("votenbr 參數不存在");
    }
  });

// Simple UI wrappers that use native alert/confirm but return Promises
function uiAlert(message) {
    return new Promise((resolve) => {
        try {
            alert(message);
        } catch (e) {
            // in environments where alert is unavailable, fallback to console
            console.log('ALERT:', message);
        }
        resolve();
    });
}

function uiConfirm(message) {
    return new Promise((resolve) => {
        try {
            const ok = confirm(message);
            resolve(Boolean(ok));
        } catch (e) {
            // fallback: treat as cancelled
            console.log('CONFIRM (fallback cancel):', message);
            resolve(false);
        }
    });
}

// submit event listener (now accepts parameters)
// Helper: show/hide waiting spinner in feedback element
function showSpinnerIn(element, text = '投票中...') {
    if (!element) return;
    element.textContent = text;
    // avoid duplicate within this element
    if (!element.querySelector('.voting-spinner')) {
        const sp = document.createElement('span');
        sp.className = 'voting-spinner';
        element.appendChild(sp);
    }
}

function hideSpinnerIn(element, finalText = '') {
    if (!element) return;
    const sp = element.querySelector('.voting-spinner');
    if (sp) sp.remove();
    element.textContent = finalText;
}

// submit to Lambda with 10s timeout using AbortController
async function submitEventListener(voteNbr, staffId) {
    const lambdaUrl = 'https://3kwozocua2wyg5aebwb5uxxele0ljmdp.lambda-url.ap-southeast-1.on.aws/';
    const payload = { VoteNbr: voteNbr, StaffID: staffId, timestamp: Date.now() };

    const controller = new AbortController();
    const signal = controller.signal;
    const timeout = 10000; // 10 seconds
    const timeoutId = setTimeout(() => {
        controller.abort();
        console.warn('Lambda 呼叫超時，已中止');
    }, timeout);

    try {
        const response = await fetch(lambdaUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error('Lambda 回應錯誤，狀態：', response.status);
            return false;
        }

        const result = await response.json();
        console.log('Lambda 回應：', result);
        return true;
    } catch (err) {
        if (err.name === 'AbortError') {
            console.error('呼叫 Lambda 時發生中止（可能超時）', err);
        } else {
            console.error('呼叫 Lambda 失敗：', err);
        }
        clearTimeout(timeoutId);
        return false;
    }
}

// submit handler
async function submitHandler(e) {
    e.preventDefault();
    const input = document.getElementById('staffId');
    const fb = document.getElementById('feedback');
    const curr_time = new Date();
    const dead_line = new Date('2026-01-19T19:50:00+08:00');
    if (curr_time > dead_line) {
        await uiAlert('投票已截止，感謝您的參與！');
        return;
    }

    const StaffID = input.value.trim();
    if (!StaffID) {
        await uiAlert('請輸入員工編號（8碼）再送出。');
        input.focus();
        return;
    }

    // 以下是正則8碼數字驗證
    const idPattern = /^\d{8}$/;
    if (!idPattern.test(StaffID)) {
        await uiAlert('員工編號格式錯誤，請輸入8碼數字。');
        input.focus();
        return;
    }
    // 取得 voteNbr（優先從畫面元素讀取）
    const voteNbrElem = document.getElementById('voting-id');
    const voteNbr = voteNbrElem ? voteNbrElem.textContent.trim() : '';

    // 顯示確認視窗（popup），使用者確認才送出
    const confirmMsg = `請確認送出投票：\n選擇：${voteNbr || '(無)'}\n員編：${StaffID}`;
    const confirmed = await uiConfirm(confirmMsg);
    if (!confirmed) {
        await uiAlert('已取消送出。');
        return;
    }

    // Call submit API with parameters and handle result
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    // 顯示 waiting 動畫
    showSpinnerIn(fb, '投票中，請稍候...');

    try {
        const success = await submitEventListener(voteNbr, StaffID);
        if (success) {
            hideSpinnerIn(fb, '謝謝，投票成功！已經收到回覆。');
            await uiAlert('謝謝，投票成功！已經收到回覆。');
            if (btn) {
                btn.animate([
                    { transform: 'translateY(0)' },
                    { transform: 'translateY(-6px)' },
                    { transform: 'translateY(0)' }
                ], { duration: 300 });
            }
        } else {
            hideSpinnerIn(fb, '投票失敗，或者您已投過，請稍後再試，謝謝。');
            await uiAlert('投票失敗，或者您已投過，請稍後再試，謝謝。');
        }
    } finally {
        if (btn) btn.disabled = false;
    }
}