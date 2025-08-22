(function(){
  // === Settings ===
  const API_ENDPOINT = 'https://ecwid-custom-pricing.vercel.app/api/custom-product/quote';
  const MIN = 1000, MAX = 12000;
  const PLACEHOLDER = `Numeric from ${MIN} to ${MAX}`;
  const AUTO_ADD_ENABLED = false; // ← включите true, чтобы автонажимать Add to Bag на созданном товаре

  // === Ecwid boot ===
  function waitEcwid(cb){ (typeof Ecwid!=='undefined'&&Ecwid.OnAPILoaded)?cb():setTimeout(()=>waitEcwid(cb),100); }
  waitEcwid(() => {
    Ecwid.OnAPILoaded.add(() => {
      if (!window.__cpc_wired_autoadd) { wireAutoAdd(); window.__cpc_wired_autoadd = true; }
      Ecwid.OnPageLoaded.add(page => {
        if (page.type !== 'PRODUCT') return;
        window.__cpc_last_page = page;
        applyForWidth1210(page);
        ensureObserver();
      });
    });
  });

  // === SKU helpers ===
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
  const isTargetProduct = () => {
    const sku = getSku();
    return !!sku && /^WIDTH-1210\b/i.test(sku);
  };
  const isCreatedOneOffPage = (page) => {
    const expected = sessionStorage.getItem('cpc_last_created_pid');
    return !!expected && page && String(page.productId) === String(expected);
  };

  // === Action panel: hide qty only (controls оставляем) ===
  function suppressQtyOnly(){
    const panel = document.querySelector('.product-details-module.product-details__action-panel.details-product-purchase');
    if (!panel) return;
    panel.setAttribute('data-cpc-scope','1');
    if (!document.getElementById('cpc-style-hide-qty')){
      const st = document.createElement('style');
      st.id = 'cpc-style-hide-qty';
      st.textContent = `
        .product-details__action-panel.details-product-purchase[data-cpc-scope="1"] .details-product-purchase__qty{
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
          input.classList.add('cpc-error'); showTinyHint(input, `Enter a number from ${MIN} to ${MAX}`);
        } else {
          input.classList.remove('cpc-error'); hideTinyHint(input);
        }
      });
      input.dataset.cpcSanitize = '1';
    }
  }
  function showTinyHint(input, text){
    let hint = input.closest('.form-control')?.querySelector('.cpc-hint');
    if (!hint) { hint = document.createElement('div'); hint.className = 'cpc-hint'; input.closest('.form-control')?.appendChild(hint); }
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

  // === Client calc (лог) ===
  function calcClient(lengthMm, thickness){
    const widthM = 1.21;
    const area = +(widthM * (lengthMm/1000)).toFixed(3);
    const base = +(area * 22).toFixed(2);
    const surchargePerSqm = thickness==='0.6'?3 : thickness==='0.7'?4 : 0;
    const extra = +(area * surchargePerSqm).toFixed(2);
    const final = +(base + extra).toFixed(2);
    return { area, base, extra, final };
  }

  // === Native button helpers ===
  function findNativeAddContainer(){
    return document.querySelector('.details-product-purchase__add-to-bag'); // контейнер div
  }
  function findAddToBagButton(){
    let btn = document.querySelector('.details-product-purchase__add-to-bag button.form-control__button');
    if (btn) return btn;
    const candidates = document.querySelectorAll('button.form-control__button');
    for (const b of candidates) {
      const txt = (b.textContent || '').trim();
      if (/add to bag|в корзину|купить|додати в кошик|до кошика/i.test(txt)) return b;
    }
    btn = document.querySelector('.ecwid-btn--submit');
    return btn || null;
  }

  // === Our button (exact placement) ===
  function ensureOurButtonBeforeNative(page){
    const panel = document.querySelector('.product-details-module.product-details__action-panel.details-product-purchase');
    const nativeWrap = findNativeAddContainer();
    if (!panel || !nativeWrap) return;

    // если мы на странице созданного one-off — показываем нативную, нашу скрываем
    if (isCreatedOneOffPage(page)) {
      nativeWrap.style.display = ''; nativeWrap.removeAttribute('data-cpc-native-hidden');
      const ourWrap = document.querySelector('.details-product-purchase__add-to-bag--cpc');
      if (ourWrap) ourWrap.style.display = 'none';
      return;
    }

    // базовый товар: вставляем нашу кнопку перед нативной и скрываем нативную
    let ourWrap = document.querySelector('.details-product-purchase__add-to-bag--cpc');
    if (!ourWrap) {
      ourWrap = document.createElement('div');
      ourWrap.className = [
        'form-control','form-control--button','form-control--large','form-control--primary',
        'form-control--flexible','form-control--animated',
        'details-product-purchase__add-to-bag','details-product-purchase__add-to-bag--cpc'
      ].join(' ');
      ourWrap.innerHTML = `
        <button type="button" data-cpc-btn class="form-control__button form-control__button--icon-center" aria-label="Quote & Add to Bag">
          <span class="form-control__button-text">Quote &amp; Add to Bag</span>
          <span class="form-control__button-svg">
            <span class="svg-icon">
              <svg width="27" height="23" viewBox="0 0 27 23" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                <path class="svg-line-check" d="M1.97 11.94L10.03 20 25.217 2" fill="none" fill-rule="evenodd" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path>
              </svg>
            </span>
          </span>
        </button>
      `;
      nativeWrap.parentNode.insertBefore(ourWrap, nativeWrap); // ← точное позиционирование
      document.addEventListener('click', onCalcClick, true);
    } else {
      // убедимся, что порядок верный
      if (ourWrap.nextElementSibling !== nativeWrap) {
        nativeWrap.parentNode.insertBefore(ourWrap, nativeWrap);
      }
      ourWrap.style.display = '';
    }

    // скрываем нативную, но не удаляем
    nativeWrap.style.display = 'none';
    nativeWrap.setAttribute('data-cpc-native-hidden','1');
  }

  // === Click handler ===
  async function onCalcClick(e){
    const btn = e.target.closest('[data-cpc-btn]');
    if (!btn) return;
    e.preventDefault();

    const baseSku = getSku();
    const L = readLengthMm();   if (!L.ok) return alert(L.reason);
    const T = readThickness();  if (!T.ok) return alert(T.reason);

    const c = calcClient(L.value, T.value);
    console.log('[CPC] area:', c.area, 'base:', c.base, 'extra:', c.extra, 'final:', c.final);

    const payload = { lengthMm: L.value, thickness: T.value, baseSku };
    try{
      setBtnLoading(btn,true);
      const r = await fetch(API_ENDPOINT, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      const text = await r.text(); let data = {}; try { data = JSON.parse(text); } catch(_){}
      if (!r.ok || !data.ok) { const cause = (data && data.error) ? data.error : (text || `${r.status} ${r.statusText}`); alert(`Ошибка сервера:\n${cause}`); return; }
      const pid = String(data.productId);
      if (AUTO_ADD_ENABLED) sessionStorage.setItem('cpc_last_created_pid', pid);
      openProductSafe(pid);
    }catch(err){
      console.error(err);
      alert(`Сеть/браузер: ${err?.message || err}`);
    }finally{
      setBtnLoading(btn,false);
    }
  }
  function setBtnLoading(btn, loading){
    const textSpan = btn.querySelector('.form-control__button-text') || btn;
    if (loading){
      btn.setAttribute('disabled','disabled'); btn.style.opacity='0.7'; btn.style.cursor='wait';
      if (!textSpan.dataset._txt) textSpan.dataset._txt = textSpan.textContent || '';
      textSpan.textContent = 'Calculating…';
    } else {
      btn.removeAttribute('disabled'); btn.style.opacity=''; btn.style.cursor='';
      if (textSpan.dataset._txt) textSpan.textContent = textSpan.dataset._txt;
    }
  }

  // === Open product safely ===
  const isHashRouting = () => /#!/.test(location.href);
  function openProductSafe(pid){
    try { if (window.Ecwid && typeof Ecwid.openProduct === 'function') { Ecwid.openProduct('p'+pid); return; } } catch(_){}
    if (isHashRouting()) { const base = location.origin + location.pathname; location.href = `${base}#!/p/${pid}`; return; }
    const a = document.createElement('a'); a.href = `#!/p/${pid}`; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove();
  }

  // === Auto add flow (optional) ===
  function clickAddToBagWithRetries(maxTries = 8, delay = 250){
    let tries = 0;
    (function tryClick(){
      const btn = findAddToBagButton();
      if (btn) {
        btn.click();
        setTimeout(() => (window.Ecwid && Ecwid.openPage) ? Ecwid.openPage('cart') : location.hash = '#!/cart', 400);
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
      // наша кнопка на созданной карточке не нужна
      const our = document.querySelector('.details-product-purchase__add-to-bag--cpc');
      if (our) our.style.display = 'none';
      // обязательно показать нативную
      const nativeWrap = findNativeAddContainer();
      if (nativeWrap) nativeWrap.style.display = '';
      setTimeout(() => clickAddToBagWithRetries(), 300);
    });
  }

  // === Apply for target product ===
  function applyForWidth1210(page){
    if (!isTargetProduct()) return;
    suppressQtyOnly();
    patchLengthField();
    ensureOurButtonBeforeNative(page);
  }

  // === Observe DOM re-renders ===
  function ensureObserver(){
    if (window.__cpcMo) return;
    const root = document.querySelector('.ec-store, .ecwid-productBrowser, body') || document.body;
    const mo = new MutationObserver(() => applyForWidth1210(window.__cpc_last_page));
    mo.observe(root, { childList:true, subtree:true });
    window.__cpcMo = mo;
  }

})();

