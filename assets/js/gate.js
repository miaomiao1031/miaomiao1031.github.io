/* 作品集访问门：用口令在浏览器**本地**解密页面内容。
 *
 * 本文件不含口令、也不含任何密钥 —— 每个页面的密文与盐/IV 由
 * scripts/showcase_gate.mjs 在构建时写进页面的 <script id="gate-payload">。
 * 因此本文件可以公开；没有口令的人拿到的只是密文。
 *
 * 口令校验不靠「存储的哈希比对」，而是靠 AES-GCM 的认证标签：
 * 口令派生出的密钥不对，解密就会抛异常。所以源码里不存在口令的任何痕迹。
 *
 * 解密成功后把派生密钥放进 sessionStorage，同一次浏览会话里翻页
 * （116 篇正文之间跳转）就不用反复输口令；关掉标签页即失效。
 */
(function () {
  'use strict';

  var ITER = 250000;            // PBKDF2 迭代次数，须与 showcase_gate.mjs 一致
  var SKEY = 'vxm-gate-key';    // sessionStorage 里存派生密钥的键

  var el = document.getElementById('gate-payload');
  if (!el) return;

  var payload;
  try { payload = JSON.parse(el.textContent); } catch (e) { return; }
  var salt = b64ToBytes(payload.s);
  var iv = b64ToBytes(payload.i);
  var ct = b64ToBytes(payload.c);
  var title = payload.t || document.title;

  function b64ToBytes(s) {
    var bin = atob(s), n = bin.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  function bytesToB64(buf) {
    var u = new Uint8Array(buf), s = '';
    for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s);
  }

  function deriveKey(password) {
    var base = crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return base.then(function (k) {
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: salt, iterations: ITER, hash: 'SHA-256' },
        k, { name: 'AES-GCM', length: 256 },
        true,          // 需可导出，才能把密钥存进 sessionStorage
        ['decrypt']);
    });
  }

  function decrypt(key) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct)
      .then(function (buf) { return new TextDecoder().decode(buf); });
  }

  function render(html) {
    // 用 document.write 而非 innerHTML：正文里含外链脚本与相对图片路径，
    // write 能保留正常的文档解析流程，且 URL 不变、相对路径依旧成立。
    document.open();
    document.write(html);
    document.close();
  }

  // ---- 界面（自足样式，不依赖站点 CSS） ----
  function injectStyle() {
    if (document.getElementById('gate-style')) return;
    var css = ''
      + 'html,body{height:100%}'
      + 'body#gate-body{margin:0;background:#f7f6f3;color:#26251f;'
      + 'font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;'
      + 'display:flex;align-items:center;justify-content:center;padding:24px}'
      + '.gate-card{width:100%;max-width:392px;background:#fff;border-radius:14px;'
      + 'border:1px solid rgba(0,0,0,.09);padding:30px 28px;box-sizing:border-box}'
      + '.gate-kicker{font-size:12px;letter-spacing:.14em;color:#8b8878;margin-bottom:10px}'
      + '.gate-card h1{font-size:19px;font-weight:600;margin:0 0 6px;line-height:1.45}'
      + '.gate-sub{font-size:13.5px;color:#6d6a5e;margin:0 0 22px;line-height:1.65}'
      + '.gate-card input{width:100%;box-sizing:border-box;font-size:15px;padding:11px 13px;'
      + 'border:1px solid rgba(0,0,0,.16);border-radius:8px;background:#fbfbf9;outline:none}'
      + '.gate-card input:focus{border-color:#5c6b8a;background:#fff}'
      + '.gate-card button{width:100%;margin-top:12px;font-size:14.5px;padding:11px;'
      + 'border:0;border-radius:8px;background:#2f3646;color:#fff;cursor:pointer}'
      + '.gate-card button:hover{background:#3d465a}'
      + '.gate-card button:disabled{opacity:.55;cursor:default}'
      + '.gate-msg{font-size:13px;margin:12px 0 0;min-height:18px;color:#a33}'
      + '.gate-foot{font-size:12px;color:#9a978a;margin:20px 0 0;line-height:1.6}';
    var st = document.createElement('style');
    st.id = 'gate-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function showPrompt(busy, message) {
    document.title = title;
    var box = document.getElementById('gate-box');
    if (!box) {
      injectStyle();
      document.body.id = 'gate-body';
      document.body.innerHTML = ''
        + '<div class="gate-card" id="gate-box">'
        + '  <div class="gate-kicker">仅限受邀阅读</div>'
        + '  <h1>这是一份未公开的作品集</h1>'
        + '  <p class="gate-sub">请输入访问凭证。内容在您的浏览器本地解密，'
        + '不会上传到任何服务器。</p>'
        + '  <input id="gate-pw" type="password" autocomplete="current-password" '
        + 'placeholder="访问凭证" aria-label="访问凭证">'
        + '  <button id="gate-btn" type="button">进入</button>'
        + '  <p class="gate-msg" id="gate-msg"></p>'
        + '  <p class="gate-foot">没有任何凭证？可联系作者获取。</p>'
        + '</div>';
      box = document.getElementById('gate-box');
    }
    var pw = document.getElementById('gate-pw');
    var btn = document.getElementById('gate-btn');
    var msg = document.getElementById('gate-msg');
    btn.disabled = !!busy;
    if (message) msg.textContent = message;
    if (!busy) pw.focus();

    function submit() {
      var v = pw.value;
      if (!v) { pw.focus(); return; }
      btn.disabled = true;
      msg.textContent = '正在校验…';
      deriveKey(v)
        .then(function (k) { return decrypt(k).then(function (html) { return [k, html]; }); })
        .then(function (r) {
          return crypto.subtle.exportKey('raw', r[0]).then(function (raw) {
            try { sessionStorage.setItem(SKEY, bytesToB64(raw)); } catch (e) {}
            render(r[1]);
          });
        })
        .catch(function () {
          btn.disabled = false;
          msg.textContent = '凭证不正确，请重试。';
          pw.select();
        });
    }
    btn.addEventListener('click', submit);
    pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  }

  // ---- 启动：先试会话里的密钥，没有再让用户输入 ----
  document.body.id = 'gate-body';
  document.body.innerHTML = '<div class="gate-card"><p class="gate-sub">正在解密…</p></div>';

  var saved = null;
  try { saved = sessionStorage.getItem(SKEY); } catch (e) {}

  if (saved) {
    crypto.subtle.importKey('raw', b64ToBytes(saved), { name: 'AES-GCM' }, true, ['decrypt'])
      .then(function (k) { return decrypt(k).then(function (html) { render(html); }); })
      .catch(function () { try { sessionStorage.removeItem(SKEY); } catch (e) {} showPrompt(false, ''); });
  } else {
    showPrompt(false, '');
  }
})();
