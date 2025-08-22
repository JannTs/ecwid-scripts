
(function(){
  // === Настройки ===
  const API_ENDPOINT = 'https://ecwid-custom-pricing.vercel.app/api/custom-product/quote';
  const MIN = 1000, MAX = 12000;
  const PLACEHOLDER = `Numeric from ${MIN} to ${MAX}`;
  const AUTO_ADD_ENABLED = false;

  // === Bootstrap Ecwid ===
  function waitEcwid(cb){ (typeof Ecwid!=='undefined' && Ecwid.OnAPILoaded)?cb():setTimeout(()=>waitEcwid(cb),100); }

  waitEcwid(() => {
    Ecwid.OnAPILoaded.add(() => {
      if (!window.__cpc_wired_autoadd && AUTO_ADD_ENABLED) {
        wireAutoAdd();
        window.__cpc_wired_autoadd = true;
      }
      Ecwid.OnPageLoaded.add(page => {
        if (page.type !== 'PRODUCT') return;

        window.__cpc_current_pid = String(page.productId || '');
        window.__cpc_applied_pid = null; // сброс на новый товар

        // ВАЖНО: работаем только на SKU ровно WIDTH-1210
        if (isTargetProduct()) {
          safeScheduleApply();
          ensureObserver(); // наблюдаем только в карточке нужного товара
        }
        // на остальных товарах — ничего не делаем
      });
    });
  });

  // === SKU ===
  function getSku(){
    const sels = [
      '[itemprop="sku"]',
      '.product-details__product-sku',
      '[data-product-sku]',
      '.product-details__sku',
      '.details-product-code__value',
      '.ec-store__product-sku',
      '.ecwid-productBrowser-sku'
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

  // кэшируем SKU на текущий productId, чтобы не гонять селекторы на каждую мутацию
  function getSkuCached(){
    const pid = String(window.__cpc_current_pid || '');
    if (!pid) return getSku();
    window.__cpc_sku_cache = window.__cpc_sku_cache || {};
    if (window.__cpc_sku_cache[pid] !== undefined) return window.__cpc_sku_cache[pid];
    const sku = getSku();
    window.__cpc_sku_cache[pid] = sku;
    return sku;
  }

  // ТОЛЬКО ровно WIDTH-1210 (без суффиксов)
  function isTargetProduct(){
    return getSkuCached() === 'WIDTH-1210';
  }

  // === Panel: hide qty & controls (CSS) — вызываем только на базовом товаре ===
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

  // === Length input & placeholder ===
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

  // === Thickness radio ===
  function readThickness(){
    let radios = document.querySelectorAll('input[type="radio"][name="Thickness"]');
    if (!radios.length) radios = document.querySelectorAll('input[type="radio"][name*="hickness"]');
    const list = Array.from(radios);
    const checked = list.find(r => r.checked);
    const labelText = checked
      ? (document.querySelector(`label[for="${checked.id}"]`)?.textContent || checked.value || '')
      : '';
    const m = labelText.match(/0[.,]5|0[.,]6|0[.,]7/);
    if (!m) return { ok:false, reason:'Select thickness 0.5 / 0.6 / 0.7 mm' };
    return { ok:true, value: m[0].replace(',','.') };
  }

  // === Client calc (лог/UX) ===
  function calcClient(lengthMm, thickness){
    const widthM = 1.21;
    const area = +(widthM * (lengthMm/1000)).toFixed(3);
    const base = +(area * 22).toFixed(2);
    const surchargePerSqm = thickness==='0.6'?3 : thickness==='0.7'?4 : 0;
    const extra = +(area * surchargePerSqm).toFixed(2);
    const final = +(base + extra).toFixed(2);
    return { area, base, extra, final };
  }

  // === Inject button (только на базовом товаре) ===
  function injectCalcButton(){
    if (document.querySelector('[data-cpc-btn]')) return;
    const panel = document.querySelector('.product-details-module.product-details__action-panel.details-product-purchase');
    if (!panel) return;
    const wrap = document.createElement('div');
    wrap.className = 'form-control form-control--button';
    wrap.style.marginTop = '10px';
    wrap.innerHTML = `
      <button type="button" data-cpc-btn class="form-control__button form-control__button--icon-center" data-cpc-mode="quote">
        <span class="form-control__button-text">Quote &amp; Add to Bag</span>
      </button>
    `;
    panel.appendChild(wrap);
    if (!window.__cpc_click_bound) {
      document.addEventListener('click', onCalcClick, true);
      window.__cpc_click_bound = true;
    }
  }

  // (оставляем для совместимости, но на one-off мы не инжектим кнопку, так что тут обычно нечего делать)
  function adjustButtonForOneOff(){
    const btn = document.querySelector('[data-cpc-btn]');
    if (!btn) return;
    const expected = sessionStorage.getItem('cpc_last_created_pid') || '';
    const current = String(window.__cpc_current_pid || '');
    const textSpan = btn.querySelector('.form-control__button-text') || btn;
    if (expected && current === expected) {
      btn.setAttribute('data-cpc-mode','add');
      textSpan.textContent = 'Add to Bag';
    } else {
      btn.setAttribute('data-cpc-mode','quote');
      textSpan.textContent = 'Quote & Add to Bag';
    }
  }

  async function onCalcClick(e){
    const btn = e.target.closest('[data-cpc-btn]');
    if (!btn) return;
    e.preventDefault();

    // на всякий случай: работаем только если это базовый товар
    if (!isTargetProduct()) {
      // на иных товарах наша кнопка не должна появляться; если появилась — пас
      return;
    }

    const mode = btn.getAttribute('data-cpc-mode') || 'quote';
    if (mode === 'add') {
      const native = findAddToBagButton();
      if (native) {
        native.click();
        setTimeout(() => (window.Ecwid && Ecwid.openPage) ? Ecwid.openPage('cart') : (location.hash='#!/cart'), 400);
      } else {
        alert('Add to Bag button is unavailable.');
      }
      return;
    }

    const baseSku = getSkuCached();
    const L = readLengthMm();   if (!L.ok) return alert(L.reason);
    const T = readThickness();  if (!T.ok) return alert(T.reason);

    const c = calcClient(L.value, T.value);
    console.log('[CPC] area:', c.area, 'base:', c.base, 'extra:', c.extra, 'final:', c.final);

    const payload = { lengthMm: L.value, thickness: T.value, baseSku };
    try{
      setBtnLoading(btn,true);
      const r = await fetch(API_ENDPOINT, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });
      const text = await r.text();
      let data = {}; try { data = JSON.parse(text); } catch(_){}
      console.log('[CPC] response', r.status, r.statusText, data || text);

      if (!r.ok || !data.ok) {
        const cause = (data && data.error) ? data.error : (text || `${r.status} ${r.statusText}`) || 'Unknown error';
        alert(`Ошибка сервера:\n${cause}`);
        return;
      }

      const pid = String(data.productId);
      sessionStorage.setItem('cpc_last_created_pid', pid); // маркер — но на one-off мы ничего не инжектим
      openProductSafe(pid);

    }catch(err){
      console.error(err);
      alert(`Сеть/браузер: ${err?.message || err}`);
    }finally{
      setBtnLoading(btn,false);
    }
  }

  // === Loading text ===
  function setBtnLoading(btn, loading){
    const textSpan = btn.querySelector('.form-control__button-text') || btn;
    if (loading){
      btn.setAttribute('disabled','disabled');
      btn.style.opacity='0.7'; btn.style.cursor='wait';
      if (!textSpan.dataset._txt) textSpan.dataset._txt = textSpan.textContent || '';
      textSpan.textContent = 'Calculating…';
    } else {
      btn.removeAttribute('disabled');
      btn.style.opacity=''; btn.style.cursor='';
      if (textSpan.dataset._txt) textSpan.textContent = textSpan.dataset._txt;
    }
  }

  // === Safe open product ===
  function isHashRouting(){ return /#!/.test(location.href); }
  function openProductSafe(pid){
    try {
      if (window.Ecwid && typeof Ecwid.openProduct === 'function') {
        Ecwid.openProduct('p' + pid);
        return;
      }
    } catch(_) {}
    if (isHashRouting()) {
      const base = location.origin + location.pathname;
      location.href = `${base}#!/p/${pid}`;
      return;
    }
    const a = document.createElement('a');
    a.href = `#!/p/${pid}`;
    a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // === Нативная Add to Bag (на базовом товаре она скрыта — используем по необходимости) ===
  function findAddToBagButton(){
    return document.querySelector('.details-product-purchase__add-to-bag button.form-control__button');
  }

  // === Автодобавление (опционально, но всё равно не затронет one-off, т.к. там не инжектим) ===
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

  // === Один безопасный запуск на кадр для текущего товара ===
  function safeScheduleApply(){
    if (window.__cpc_scheduled) return;
    window.__cpc_scheduled = true;
    requestAnimationFrame(() => {
      try {
        if (window.__cpc_applied_pid === window.__cpc_current_pid) return;
        suppressActionPanel();
        patchLengthField();
        injectCalcButton();
        adjustButtonForOneOff(); // на базовом товаре установит «Quote & Add to Bag»
        window.__cpc_applied_pid = window.__cpc_current_pid;
      } finally {
        window.__cpc_scheduled = false;
      }
    });
  }

  // === Observer: только в карточке нужного товара, с дебаунсом ===
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
        if (!isTargetProduct()) return; // на чужих товарах ничего не делаем
        safeScheduleApply();
      });
    });

    mo.observe(root, { childList:true, subtree:true });
    window.__cpcMo = mo;
  }

})();

