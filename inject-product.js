
(function(){
  const API_ENDPOINT = 'https://ecwid-custom-pricing.vercel.app/api/custom-product/quote';
  const MIN = 1000, MAX = 12000;
  const PLACEHOLDER = `Numeric from ${MIN} to ${MAX}`;

  function waitEcwid(cb){ (typeof Ecwid!=='undefined'&&Ecwid.OnAPILoaded)?cb():setTimeout(()=>waitEcwid(cb),100); }

  waitEcwid(() => {
    Ecwid.OnAPILoaded.add(() => {
      Ecwid.OnPageLoaded.add(page => {
        if (page.type !== 'PRODUCT') return;
        if (!isTargetProduct()) return;

        suppressActionPanel();     // скрыть qty и controls (CSS, без удаления)
        patchLengthField();        // плейсхолдер + числовой ввод
        injectCalcButton();        // вставить кнопку
        wireAutoAdd();             // автодобавление созданного товара → корзина
        ensureObserver();          // повторно применять при перерисовках
      });
    });
  });

  // ---------- SKU ----------
  function getSku(){
    const sels = ['[itemprop="sku"]','.product-details__product-sku','[data-product-sku]','.product-details__sku','.details-product-code__value'];
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
  function isTargetProduct(){ const sku = getSku(); return !!sku && /^WIDTH-1210\b/i.test(sku); }

  // ---------- Panel: hide qty & controls via CSS ----------
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
      `;
      document.head.appendChild(st);
    }
  }

  // ---------- Length input ----------
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
      input.dataset.cpcSanitize = '1';
    }
  }

  function readLengthMm(){
    const inp = getLengthInput();
    if (!inp) return { ok:false, reason:'Length field not found' };
    const num = parseInt((inp.value||'').trim(), 10);
    if (!Number.isFinite(num)) return { ok:false, reason:`Enter number ${MIN}..${MAX} mm` };
    if (num < MIN || num > MAX) return { ok:false, reason:`Length ${MIN}..${MAX} mm` };
    return { ok:true, value:num };
  }

  // ---------- Thickness (radio) ----------
  function readThickness(){
    // ищем radio name="Thickness" (или частично)
    let radios = document.querySelectorAll('input[type="radio"][name="Thickness"]');
    if (!radios.length) radios = document.querySelectorAll('input[type="radio"][name*="hickness"]');
    const list = Array.from(radios);
    const checked = list.find(r => r.checked);
    const labelText = checked
      ? (document.querySelector(`label[for="${checked.id}"]`)?.textContent || checked.value || '')
      : '';
    const m = labelText.match(/0[.,]5|0[.,]6|0[.,]7/);
    if (!m) return { ok:false, reason:'Select thickness 0.5 / 0.6 / 0.7 mm' };
    return { ok:true, value: m[0].replace(',','.') }; // '0.5'|'0.6'|'0.7'
  }

  // ---------- Client-side calc (для UX/логов) ----------
  function calcClient(lengthMm, thickness){
    const widthM = 1.21;
    const area = +(widthM * (lengthMm/1000)).toFixed(3);
    const base = +(area * 22).toFixed(2);
    const surchargePerSqm = thickness==='0.6'?3 : thickness==='0.7'?4 : 0;
    const extra = +(area * surchargePerSqm).toFixed(2);
    const final = +(base + extra).toFixed(2);
    return { area, base, extra, final };
  }

  // ---------- Inject button ----------
  function injectCalcButton(){
    if (document.querySelector('[data-cpc-btn]')) return;
    const panel = document.querySelector('.product-details-module.product-details__action-panel.details-product-purchase');
    if (!panel) return;

    const wrap = document.createElement('div');
    wrap.className = 'form-control form-control--button';
    wrap.style.marginTop = '10px';
    wrap.innerHTML = `
      <button type="button" data-cpc-btn
        class="form-control__button form-control__button--icon-center">
        Рассчитать и купить
      </button>
    `;
    panel.appendChild(wrap);

    document.addEventListener('click', onCalcClick, true);
  }

  async function onCalcClick(e){
    const btn = e.target.closest('[data-cpc-btn]');
    if (!btn) return;
    e.preventDefault();

    const baseSku = getSku();
    const L = readLengthMm();   if (!L.ok) return alert(L.reason);
    const T = readThickness();  if (!T.ok) return alert(T.reason);

    // (необязательно) локальный расчёт — лог/отладка
    const c = calcClient(L.value, T.value);
    console.log('[CPC] area:', c.area, 'base:', c.base, 'extra:', c.extra, 'final:', c.final);

    try{
      setBtnLoading(btn, true);
      const r = await fetch(API_ENDPOINT, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ lengthMm: L.value, thickness: T.value, baseSku })
      });
      const data = await r.json().catch(()=> ({}));
      if (!r.ok || !data.ok) throw new Error(data?.error || 'Server error');

      const pid = String(data.productId);
      sessionStorage.setItem('cpc_last_created_pid', pid);
      Ecwid.openProduct('p'+pid);
    }catch(err){
      console.error(err);
      alert('Не удалось создать товар. Попробуйте позже.');
    }finally{
      setBtnLoading(btn, false);
    }
  }

  function setBtnLoading(btn, loading){
    if (loading){
      btn.setAttribute('disabled','disabled');
      btn.dataset._txt = btn.textContent;
      btn.textContent = 'Загрузка...';
      btn.style.opacity='0.7'; btn.style.cursor='wait';
    } else {
      btn.removeAttribute('disabled');
      if (btn.dataset._txt) btn.textContent = btn.dataset._txt;
      btn.style.opacity=''; btn.style.cursor='';
    }
  }

  // ---------- Auto add to cart on created product ----------
  function wireAutoAdd(){
    Ecwid.OnPageLoaded.add(page=>{
      if (page.type!=='PRODUCT') return;
      const expected = sessionStorage.getItem('cpc_last_created_pid');
      if (!expected || String(page.productId)!==expected) return;

      setTimeout(()=>{
        const buyBtn = document.querySelector('.details-product-purchase__button,.ecwid-btn--submit');
        if (buyBtn) {
          buyBtn.click();
          setTimeout(()=> Ecwid.openPage('cart'), 400);
        } else {
          setTimeout(()=>{
            const b2 = document.querySelector('.details-product-purchase__button,.ecwid-btn--submit');
            if (b2){ b2.click(); setTimeout(()=> Ecwid.openPage('cart'), 400); }
          }, 500);
        }
      }, 300);
    });
  }

  // ---------- Re-apply on re-render ----------
  function ensureObserver(){
    if (window.__cpcMo) return;
    const root = document.querySelector('.ec-store, .ecwid-productBrowser, body') || document.body;
    const mo = new MutationObserver(() => {
      if (!isTargetProduct()) return;
      suppressActionPanel();
      patchLengthField();
      injectCalcButton();
    });
    mo.observe(root, { childList:true, subtree:true });
    window.__cpcMo = mo;
  }
})();


