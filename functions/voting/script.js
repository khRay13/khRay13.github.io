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

// TODO submit前的popup確認視窗
// TODO 將submit與api gateway串接
// submit handler
function submitHandler(e) {
    e.preventDefault();
    const input = document.getElementById('staffId');
    const fb = document.getElementById('feedback');

    const val = input.value.trim();
    if (!val) {
        fb.textContent = '請輸入員工編號（8碼）再送出。';
        input.focus();
        return;
    }

    // 以下是正責8碼數字驗證的範例
    const idPattern = /^\d{8}$/;
    if (!idPattern.test(val)) {
        fb.textContent = '員工編號格式錯誤，請輸入8碼數字。';
        input.focus();
        return;
    }

    // fb.textContent = `謝謝，投票 ${val} 成功！已經收到回覆。`;
    fb.textContent = `謝謝，投票成功！已經收到回覆。`;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.animate([
        { transform: 'translateY(0)' },
        { transform: 'translateY(-6px)' },
        { transform: 'translateY(0)' }
    ], { duration: 300 });
}