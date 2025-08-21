<script>
(function(){
  const API_ENDPOINT = 'https://ecwid-custom-pricing.vercel.app/api/custom-product/quote';
  const MIN = 1000, MAX = 12000;
  const PLACEHOLDER_TEXT = `Numeric from ${MIN} to ${MAX}`;

  function waitEcwid(cb){ (typeof Ecwid!=='undefined'&&Ecwid.OnAPILoaded)?cb():setTimeout(()=>waitEcwid(cb),100); }

  waitEcwid(() => {
    Ecwid.OnAPILoaded.add(() => {
      Ecwid.OnPageLoaded.add(page => {
        if (page.type !== 'PRODUCT') return;
        const sku = getSku();
        if (!sku || !/^WIDTH-1210\b/i.test(sku)) return;

        ensureLengthFieldUI();         // ⚙️ патчим плейсхолдер + инпут
        injectButton();
        wireAutoAdd();

        // На случай динамических перерисовок — наблюдаем и перепатчиваем
        attachObserver();
      });
    });
  });

  // ============ SKU ============
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

  // ============ Length input + placeholder ============
  function getLengthInput(){
    let input =
      document.querySelector('input[aria-label="Length (mm)"]') ||
      document.querySelector('input[aria-label*="Length"]') ||
      document.querySelector('input[aria-label*="Длина"]') ||
      document.querySelector('input[aria-label*="Довжина"]');

    if (!input) {
      const title = Array.from(
        document.querySelectorAll('.details-product-option__title, .product-details-module__title')
      ).find(el => /length\s*\(mm\)|length/i.test(el.textContent || ''));
      const container = title?.closest('.product-details-module') || title?.parentElement;
      input = container?.querySelector('input.form-control__text') || container?.querySelector('input');
    }

    if (!input) {
      const ph = Array.from(document.querySelectorAll('.form-control__placeholder-inner'))
        .find(el => /enter your text|numeric from/i.test(el.textContent || ''));
      input = ph?.closest('.form-control')?.querySelector('input') || null;
    }
    return input || null;
  }

  function ensureLengthFieldUI(){
    const input = getLengthInput();
    if (!input) return;

    // Настройки для числового ввода
    input.placeholder = PLACEHOLDER_TEXT;
    input.setAttribute('inputmode','numeric');
    input.setAttribute('pattern','[0-9]*');
    input.setAttribute('maxlength','6'); // 12000 — максимум 5-6 символов

    // Устанавливаем всплывающий плейсхолдер Ecwid
    const phInner = input.closest('.form-control')?.querySelector('.form-control__placeholder-inner');
    if (phInner && phInner.textContent?.trim() !== PLACEHOLDER_TEXT) {
      phInner.textContent = PLACEHOLDER_TEXT;
    }

    // Санитизация ввода: оставляем только цифры
    if (!input.dataset.cpcBound) {
      input.addEventListener('input', () => {
        const onlyDigits = (input.value || '').replace(/[^\d]/g, '');
        if (onlyDigits !== input.value) input.value = onlyDigits;
      });
      input.addEventListener('blur', () => {
        const v = parseInt(input.value || '0', 10);
        if (!Number.isFinite(v) || v < MIN || v > MAX) {
          // Подсветим ошибку валидации
          input.classList.add('cpc-error');
          // Можно показать мини-подсказку
          showTinyHint(input, `Enter a number from ${MIN} to ${MAX}`);
        } else {
          input.classList.remove('cpc-error');
          hideTinyHint(input);
        }
      });
      input.dataset.cpcBound = '1';
      injectTinyHintStyles();
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
  function injectTinyHintStyles(){
    if (document.getElementById('cpc-hint-style')) return;
    const st = document.createElement('style');
    st.id = 'cpc-hint-style';
    st.textContent = `
      .cpc-hint{margin-top:6px;font-size:12px;color:#b91c1c;}
      input.cpc-error{outline:1px solid #ef4444;}
    `;
    document.head.appendChild(st);
  }

  function attachObserver(){
    const root = document.querySelector('.ec-store, .ecwid-productBrowser, body');
    if (!root || root.dataset.cpcObserved) return;
    const mo = new MutationObserver(() => {
      // Если Ecwid перерисовал блок — перепатчим плейсхолдер
      ensureLengthFieldUI();
    });
    mo.observe(root, { childList:true, subtree:true });
    root.dataset.cpcObserved = '1';
  }

  // ============ Толщина/Длина чтение ============
  function findOptionBlockByLabel(keywords){
    const labels = document.querySelectorAll('.form-control__label,.ec-form__label,.ecwid-productOptions-name,.details-product-option__title,.details-product-option__name,label');
    const keys = keywords.map(k=>k.toLowerCase());
    for (const L of labels){
      const t = (L.textContent||'').toLowerCase();
      if (!keys.some(k=>t.includes(k))) continue;
      let n=L; for (let i=0;i<5&&n;i++){
        if (n.matches?.('.form-control,.ec-form__row,.ecwid-productOptions-option,.product-details-module,.details-product-option')) return n;
        n=n.parentElement;
      }
      return L;
    }
    return null;
  }
  const findSelect = b => b && (b.querySelector('select,.form-control__select,.ec-select') || b.querySelector('select'));

  function readLengthMm(){
    const inp = getLengthInput();
    if (!inp) return { ok:false, reason:'Length field not found' };
    const raw = (inp.value || '').trim();
    const num = parseInt(raw, 10);
    if (!Number.isFinite(num)) return { ok:false, reason:`Enter number ${MIN}..${MAX} mm` };
    if (num < MIN || num > MAX) return { ok:false, reason:`Length ${MIN}..${MAX} mm` };
    return { ok:true, value:num };
  }

  function readThickness(){
    const blk = findOptionBlockByLabel(['толщина','thickness']);
    const sel = findSelect(blk);
    if (!sel) return { ok:false, reason:'Select thickness' };
    const txt = sel.options[sel.selectedIndex]?.textContent || '';
    const m = txt.match(/0[.,]5|0[.,]6|0[.,]7/);
    if (!m) return { ok:false, reason:'Thickness 0.5 / 0.6 / 0.7 mm' };
    return { ok:true, value:m[0].replace(',','.') };
  }

  // ============ Кнопка и клик ============
  function injectButton(){
    if (document.querySelector('[data-cpc-btn]')) return;
    const host = document.querySelector('.details-product-purchase,.product-details__product-controls,.ecwid-productDetails') || document.querySelector('.ec-store');
    if (!host) return setTimeout(injectButton, 300);

    const wrap = document.createElement('div');
    wrap.style.marginTop='10px';
    wrap.innerHTML = `
      <a href="#" data-cpc-btn class="form-control form-control--button" style="display:inline-block;">
        <span class="details-product-purchase__button">Рассчитать и купить</span>
      </a>
      <div style="margin-top:6px;color:#6b7280;font-size:12px">Цена по м² и толщине → добавим товар в корзину.</div>
    `;
    host.appendChild(wrap);

    document.addEventListener('click', onBuyClick, true);
  }

  async function onBuyClick(e){
    const btn = e.target.closest('[data-cpc-btn]');
    if (!btn) return;
    e.preventDefault();

    const baseSku = getSku();
    const L = readLengthMm();  if (!L.ok) return alert(L.reason);
    const T = readThickness(); if (!T.ok) return alert(T.reason);

    try{
      btnToggle(btn,true);
      const r = await fetch(API_ENDPOINT, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
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
      btnToggle(btn,false);
    }
  }

  function btnToggle(btn, loading){
    const span = btn.querySelector('.details-product-purchase__button') || btn;
    if (loading){
      btn.setAttribute('disabled','disabled');
      btn.style.opacity='0.6'; btn.style.cursor='wait';
      span.dataset._txt = span.textContent;
      span.textContent = 'Загрузка...';
    } else {
      btn.removeAttribute('disabled');
      btn.style.opacity=''; btn.style.cursor='';
      if (span.dataset._txt) span.textContent = span.dataset._txt;
    }
  }

  // ============ Автодобавление ============
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
})();
</script>
