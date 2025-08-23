
(function(){
  // === Settings ===
  const API_ENDPOINT = 'https://ecwid-custom-pricing.vercel.app/api/custom-product/quote';
  const MIN = 1000, MAX = 12000;
  const PLACEHOLDER = `Numeric from ${MIN} to ${MAX}`;
  const AUTO_ADD_ENABLED = false;

  // === Ecwid boot ===
  function waitEcwid(cb){ (typeof Ecwid!=='undefined' && Ecwid.OnAPILoaded)?cb():setTimeout(()=>waitEcwid(cb),100); }

  waitEcwid(() => {
    Ecwid.OnAPILoaded.add(() => {
      if (!window.__cpc_wired_autoadd && AUTO_ADD_ENABLED) {
        wireAutoAdd();
        window.__cpc_wired_autoadd = true;
      }

      Ecwid.OnPageLoaded.add(page => {
        if (page.type !== 'PRODUCT') { teardownNonTarget(); return; }

        window.__cpc_current_pid = String(page.productId || '');
        window.__cpc_applied_pid = null; // reset for new product page

        if (isTargetProduct()) {
          safeScheduleApply();
          ensureObserver();   // наблюдаем только на нужной карточке
        } else {
          teardownNonTarget(); // убрать наши элементы, вернуть панель
        }
      });
    });
  });

  // === SKU (strict WIDTH-1210) ===
  function getSku(){
    const sels = [
      '[itemprop="sku"]','.product-details__product-sku','[data-product-sku]',
      '.product-details__sku','.details-product-code__value','.ec-store__product-sku','.ecwid-productBrowser-sku'
    ];
    for (const s of sels){
      const el = document.querySelector(s);
      if (!el) continue;
      const raw = (el.getAttribute('content') || el.textContent || '').trim();
      if (!raw) continue;
      const tokens = raw.toUpperCase().match(/[A-Z0-9._-]+/g) || [];
      const filtered = tokens.filter(t => t !== 'SKU');
      if (filtered.length) return filtered[filtered.length - 1];
    }
    return null;
  }
  function getSkuCached(){
    const pid = String(window.__cpc_current_pid || '');
    if (!pid) return getSku();
    window.__cpc_sku_cache = window.__cpc_sku_cache || {};
    if (window.__cpc_sku_cache[pid] !== undefined) return window.__cpc_sku_cache[pid];
    const sku = getSku();
    window.__cpc_sku_cache[pid] = sku;
    return sku;
  }
  function isTargetProduct(){ return getSkuCached() === 'WIDTH-1210'; }

  // === Panel: hide qty & controls (only on base product) ===
  function suppressActionPanel(){
    const panel = document.querySelector('.product-details-module.product-details__action-panel.details-product-purchase');
    if (!panel) return;
    panel.setAttribute('data-cpc-scope','1');
    if (!document.getElementById('cpc-style-hide')){
      const st = document.createElement('style');
      st.id = 'cpc-style-hide';
      st.textContent = `
        .product-details__action-panel.details-product-purchase[data-cpc-scope="1"] .details-product-purchase__qty,
        .product-details__action-panel.details-product-purchase[data-cpc-scope="1"] .details-product-purchase__controls{
          display: none !important;
        }
        .cpc-hint{margin-top:6px;font-size:12px;color:#b91c1c;}
        input.cpc-error{outline:1px solid #ef4444;}
      `;
      document.head.appendChild(st);
    }
  }

  // === Teardown for non-target product pages ===
  function teardownNonTarget(){
    // вернуть панель в нормальный вид (снять метку)
    document.querySelectorAll('.product-details__action-panel.details-product-purchase[data-cpc-scope="1"]').forEach(p=>{
      p.removeAttribute('data-cpc-scope');
    });
    // убрать нашу кнопку
    document.querySelectorAll('[data-cpc-btn]').forEach(b=>{
      const wrap = b.closest('.form-control.form-control--button'); if (wrap) wrap.remove();
      b.remove();
    });
    // убрать инфоблок
    const info = document.getElementById('cpc-quote-box'); if (info) info.remove();
  }

  // === Length input ===
  function getLengthInput(){
    let input =
      document.querySelector('input[aria-label="Length (mm)"]') ||
      document.querySelector('input[aria-label*="Length"]') ||
      document.querySelector('input[aria-label*="Длина"]') ||
      document.querySelector('input[aria-label*="Довжина"]');
    if (!input) {
      const title = Array.from(document.querySelectorAll('.product-details-module__title,.details-product-option__title'))
        .find(el => /length\s*\(mm\)|\blength\b/i.test(el.textContent || ''));
      const mod = title?.closest('.product-details-module') || title?.closest('.details-product-option');
      input = mod?.querySelector('input.form-control__text') || mod?.querySelector('input') || null;
    }
    if (!input) {
      const ph = Array.from(document.querySelectorAll('.form-control__placeholder-inner'))
        .find(el => /enter your text|numeric from/i.test(el.textContent || ''));
      input = ph?.closest('.form-control')?.querySelector('input') || null;
    }
    return input || null;
  }
  function patchLengthField(){
    const input = getLengthInput();
    if (!input) return;
    input.setAttribute('inputmode','numeric');
    input.setAttribute('pattern','[0-9]*');
    input.setAttribute('maxlength','6');
    input.placeholder = PLACEHOLDER;
    const phInner = input.closest('.form-control')?.querySelector('.form-control__placeholder-inner');
    if (phInner && phInner.textContent?.trim() !== PLACEHOLDER) phInner.textContent = PLACEHOLDER;

    if (!input.dataset.cpcSanitize){
      input.addEventListener('input', () => {
        const digits = (input.value || '').replace(/[^\d]/g,'');
        if (digits !== input.value) input.value = digits;
        scheduleRecalcPrice();
      });
      input.addEventListener('blur', () => {
        const v = parseInt(input.value || '0', 10);
        if (!Number.isFinite(v) || v < MIN || v > MAX) {
          input.classList.add('cpc-error');
          showTinyHint(input, `Enter a number from ${MIN} to ${MAX}`);
        } else {
          input.classList.remove('cpc-error');
          hideTinyHint(input);
        }
        scheduleRecalcPrice();
      });
      input.dataset.cpcSanitize = '1';
    }
  }
  function showTinyHint(input, text){
    let hint = input.closest('.form-control')?.querySelector('.cpc-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'cpc-hint';
      input.closest('.form-control')?.appendChild(hint);
    }
    hint.textContent = text;
  }
  function hideTinyHint(input){
    const hint = input.closest('.form-control')?.querySelector('.cpc-hint');
    if (hint) hint.remove();
  }
  function readLengthMm(){
    const inp = getLengthInput();
    if (!inp) return { ok:false, reason:'Length field not found' };
    const num = parseInt((inp.value||'').trim(), 10);
    if (!Number.isFinite(num)) return { ok:false, reason:`Enter number ${MIN}..${MAX} mm` };
    if (num < MIN || num > MAX) return { ok:false, reason:`Length ${MIN}..${MAX} mm` };
    return { ok:true, value:num };
  }

  // === Thickness ===
  function getThicknessRadios(){
    let radios = document.querySelectorAll('input[type="radio"][name="Thickness"]');
    if (!radios.length) radios = document.querySelectorAll('input[type="radio"][name*="hickness"]');
    return Array.from(radios);
  }
  function bindThicknessChange(){
    const radios = getThicknessRadios();
    radios.forEach(r=>{
      if (r.dataset.cpcBound) return;
      r.addEventListener('change', scheduleRecalcPrice);
      r.dataset.cpcBound = '1';
    });
  }
  function readThickness(){
    const list = getThicknessRadios();
    const checked = list.find(r => r.checked);
    const labelText = checked
      ? (document.querySelector(`label[for="${checked.id}"]`)?.textContent || checked.value || '')
      : '';
    const m = labelText.match(/0[.,]5|0[.,]6|0[.,]7/);
    if (!m) return { ok:false, reason:'Select thickness 0.5 / 0.6 / 0.7 mm' };
    return { ok:true, value: m[0].replace(',','.') };
  }

  // === Front calc (same as backend) ===
  function calcClient(lengthMm, thickness){
    const widthM = 1.21;
    const area = +(widthM * (lengthMm/1000)).toFixed(3);
    const base = +(area * 22).toFixed(2);
    const surchargePerSqm = thickness==='0.6'?3 : (thickness==='0.7'?4:0);
    const extra = +(area * surchargePerSqm).toFixed(2);
    const final = +(base + extra).toFixed(2);
    return { area, base, extra, final };
  }

  // === Price UI + Info block ===
  function getPriceEls(){
    const box = document.querySelector('.product-details__product-price.ec-price-item[itemprop="price"]') ||
                document.querySelector('.product-details__product-price.ec-price-item');
    const span = document.querySelector('.details-product-price__value.ec-price-item');
    return { box, span };
  }
  function getCurrencySymbol(){
    const { span } = getPriceEls();
    const txt = (span?.textContent || '').trim();
    const m = txt.match(/[^\d.,-]+/);
    return m ? m[0].trim() : '€';
  }
  function formatPrice(v){
    const sym = getCurrencySymbol();
    return `${sym}${v.toFixed(2)}`;
  }
  function trimZeros(n){
    return (+n).toFixed(3).replace(/\.?0+$/,'');
  }
  function ensureQuoteStyles(){
    if (document.getElementById('cpc-quote-style')) return;
    const st = document.createElement('style');
    st.id = 'cpc-quote-style';
    st.textContent = `
      #cpc-quote-box{margin-top:8px;font-size:12px;line-height:1.35;}
      #cpc-quote-box .cpc-row{display:block;margin:2px 0;}
      #cpc-quote-box .cpc-muted{opacity:.7;}
      #cpc-quote-box b{font-weight:600;}
    `;
    document.head.appendChild(st);
  }
  function ensureInfoBlock(){
    ensureQuoteStyles();
    let box = document.getElementById('cpc-quote-box');
    if (box) return box;
    const { span } = getPriceEls();
    const mount = span ? span.parentElement : document.querySelector('.product-details__product-price');
    if (!mount || !mount.parentNode) return null;
    box = document.createElement('div');
    box.id = 'cpc-quote-box';
    box.setAttribute('aria-live','polite');
    mount.parentNode.insertBefore(box, mount.nextSibling);
    return box;
  }
  function renderInfoBlock(c){
    const el = ensureInfoBlock(); if (!el) return;
    const sym = getCurrencySymbol();
    el.innerHTML = `
      <div class="cpc-row">Area: <b>${trimZeros(c.area)} m²</b></div>
      <div class="cpc-row">Base price: <b>${sym}${c.base.toFixed(2)}</b></div>
      <div class="cpc-row">Surcharge (by thickness): <b>${sym}${c.extra.toFixed(2)}</b></div>
      <div class="cpc-row">Final price: <b>${sym}${c.final.toFixed(2)}</b></div>
    `;
  }
  function clearInfoBlock(){
    const el = ensureInfoBlock(); if (!el) return;
    el.innerHTML = `<div class="cpc-row cpc-muted">Set length and thickness to see quote</div>`;
  }
  function updateDisplayedPrice(){
    const { box, span } = getPriceEls();
    if (!span) return;
    const L = readLengthMm();
    const T = readThickness();
    if (!L.ok || !T.ok) {
      span.textContent = formatPrice(0);
      if (box) box.setAttribute('content', '0');
      clearInfoBlock();
      return;
    }
    const c = calcClient(L.value, T.value);
    span.textContent = formatPrice(c.final);
    if (box) box.setAttribute('content', String(c.final));
    renderInfoBlock(c);
  }
  let __cpc_priceRAF = false;
  function scheduleRecalcPrice(){
    if (__cpc_priceRAF) return;
    __cpc_priceRAF = true;
    requestAnimationFrame(()=>{ __cpc_priceRAF = false; updateDisplayedPrice(); });
  }

  // === Inject button (Approve the quote) ===
  function injectCalcButton(){
    if (document.querySelector('[data-cpc-btn]')) return;
    const panel = document.querySelector('.product-details-module.product-details__action-panel.details-product-purchase');
    if (!panel) return;
    const wrap = document.createElement('div');
    wrap.className = 'form-control form-control--button';
    wrap.style.marginTop = '10px';
    wrap.innerHTML = `
      <button type="button" data-cpc-btn class="form-control__button form-control__button--icon-center">
        <span class="form-control__button-text">Approve the quote</span>
      </button>
    `;
    panel.appendChild(wrap);
    if (!window.__cpc_click_bound) {
      document.addEventListener('click', onApproveClick, true);
      window.__cpc_click_bound = true;
    }
  }

  // === Anti-duplication cache (same params -> reuse product) ===
  function makeKey(lengthMm, thickness){
    // SKU строго WIDTH-1210, можно включить и его для надёжности
    return `WIDTH-1210|${lengthMm}|${thickness}`;
  }
  function getPidFromCache(lengthMm, thickness){
    try {
      const map = JSON.parse(sessionStorage.getItem('cpc_pid_map') || '{}');
      return map[makeKey(lengthMm, thickness)] || null;
    } catch { return null; }
  }
  function putPidToCache(lengthMm, thickness, pid){
    try {
      const map = JSON.parse(sessionStorage.getItem('cpc_pid_map') || '{}');
      map[makeKey(lengthMm, thickness)] = String(pid);
      sessionStorage.setItem('cpc_pid_map', JSON.stringify(map));
    } catch {}
  }

  // === Approve → create/open product ===
  let __cpc_pending = false;
  async function onApproveClick(e){
    const btn = e.target.closest('[data-cpc-btn]');
    if (!btn) return;
    e.preventDefault();

    // работаем только на базовом товаре
    if (!isTargetProduct()) return;

    const L = readLengthMm();   if (!L.ok) return alert(L.reason);
    const T = readThickness();  if (!T.ok) return alert(T.reason);

    // если уже создавали для этих параметров — просто откроем
    const cached = getPidFromCache(L.value, T.value);
    if (cached) return openProductSafe(String(cached));

    if (__cpc_pending) return; // защита от дабл-клика в процессе
    __cpc_pending = true;

    try{
      setBtnLoading(btn,true); // "Creating…"

      const payload = { lengthMm: L.value, thickness: T.value, baseSku: getSkuCached() };
      const r = await fetch(API_ENDPOINT, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });
      const text = await r.text(); let data = {}; try { data = JSON.parse(text); } catch(_){}
      if (!r.ok || !data.ok) {
        const cause = (data && data.error) ? data.error : (text || `${r.status} ${r.statusText}`) || 'Unknown error';
        alert(`Ошибка сервера:\n${cause}`);
        return;
      }

      const pid = String(data.productId);
      putPidToCache(L.value, T.value, pid);           // кэшируем, чтобы не плодить дубликаты
      sessionStorage.setItem('cpc_last_created_pid', pid); // метка (не критично)
      openProductSafe(pid);

    }catch(err){
      console.error(err);
      alert(`Сеть/браузер: ${err?.message || err}`);
    }finally{
      setBtnLoading(btn,false);
      __cpc_pending = false;
    }
  }

  // === Loading state ===
  function setBtnLoading(btn, loading){
    const textSpan = btn.querySelector('.form-control__button-text') || btn;
    if (loading){
      btn.setAttribute('disabled','disabled');
      btn.style.opacity='0.7'; btn.style.cursor='wait';
      if (!textSpan.dataset._txt) textSpan.dataset._txt = textSpan.textContent || '';
      textSpan.textContent = 'Creating…';
    } else {
      btn.removeAttribute('disabled');
      btn.style.opacity=''; btn.style.cursor='';
      if (textSpan.dataset._txt) textSpan.textContent = textSpan.dataset._txt;
    }
  }

  // === Open product safely (several strategies) ===
  function isHashRouting(){ return /#!/.test(location.href); }
  function openProductSafe(pid){
    try { if (window.Ecwid && typeof Ecwid.openProduct === 'function') { Ecwid.openProduct('p' + pid); return; } } catch(_){}
    try { if (window.Ecwid && typeof Ecwid.openPage === 'function') { Ecwid.openPage('product', pid); return; } } catch(_){}
    // Instant Site SEO URL
    if (/\/products(\/|$)/.test(location.pathname)) {
      location.assign(`${location.origin}/products/-p${pid}`);
      return;
    }
    // hash-store fallback
    if (isHashRouting()) {
      const base = location.origin + location.pathname;
      location.assign(`${base}#!/p/${pid}`);
      return;
    }
    // ultimate fallback: hidden link
    const a = document.createElement('a');
    a.href = `#!/p/${pid}`;
    a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // === (Optional) auto-add (still off) ===
  function findAddToBagButton(){
    return document.querySelector('.details-product-purchase__add-to-bag button.form-control__button');
  }
  function clickAddToBagWithRetries(maxTries = 8, delay = 250){
    let tries = 0;
    (function tryClick(){
      const btn = findAddToBagButton();
      if (btn) {
        btn.click();
        setTimeout(() => (window.Ecwid && Ecwid.openPage) ? Ecwid.openPage('cart') : (location.hash='#!/cart'), 400);
      } else if (tries++ < maxTries) {
        setTimeout(tryClick, delay);
      }
    })();
  }
  function wireAutoAdd(){
    if (!AUTO_ADD_ENABLED) return;
    Ecwid.OnPageLoaded.add(page=>{
      if (page.type !== 'PRODUCT') return;
      const expected = sessionStorage.getItem('cpc_last_created_pid');
      if (!expected || String(page.productId) !== String(expected)) return;
      setTimeout(() => clickAddToBagWithRetries(), 300);
    });
  }

  // === One-shot apply on frame ===
  function safeScheduleApply(){
    if (window.__cpc_scheduled) return;
    window.__cpc_scheduled = true;
    requestAnimationFrame(() => {
      try {
        if (window.__cpc_applied_pid === window.__cpc_current_pid) return;
        suppressActionPanel();
        patchLengthField();
        bindThicknessChange();
        injectCalcButton();
        scheduleRecalcPrice(); // initial render
        window.__cpc_applied_pid = window.__cpc_current_pid;
      } finally {
        window.__cpc_scheduled = false;
      }
    });
  }

  // === Observer (narrow root + RAF; runs only on target product) ===
  function ensureObserver(){
    if (window.__cpcMo) return;
    const root =
      document.querySelector('.ec-product-details, .ecwid-productBrowser-details, .product-details') ||
      document.querySelector('.ec-store, .ecwid-productBrowser') ||
      document.body;
    let scheduled = false;
    const mo = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        if (!isTargetProduct()) return;
        safeScheduleApply();
      });
    });
    mo.observe(root, { childList:true, subtree:true });
    window.__cpcMo = mo;
  }

})();

