(function(){
  const API_ENDPOINT = 'https://ecwid-custom-pricing.vercel.app/api/custom-product/quote';
  const MIN = 1000, MAX = 12000;

  function waitEcwid(cb){ (typeof Ecwid!=='undefined'&&Ecwid.OnAPILoaded)?cb():setTimeout(()=>waitEcwid(cb),100); }

  waitEcwid(() => {
    Ecwid.OnAPILoaded.add(() => {
      Ecwid.OnPageLoaded.add(page => {
        if (page.type !== 'PRODUCT') return;
        const sku = getSku();
        if (!sku || !/^WIDTH-1210\b/i.test(sku)) return;     // показываем только для нужного SKU
        injectButton();
        wireAutoAdd();                                       // автодобавление после создания одноразового товара
      });
    });
  });

  // --- helpers ---
  function getSku(){
    const sels = [
      '[data-product-sku]', '.product-details__sku', '.details-product-code__value',
      '.ec-store__product-sku', '.ecwid-productBrowser-sku'
    ];
    for (const s of sels){
      const el = document.querySelector(s);
      if (!el) continue;
      const raw = (el.getAttribute('data-product-sku') || el.textContent || '').trim();
      if (!raw) continue;
      const m = raw.match(/[A-Z0-9._-]+/i);
      if (m) return m[0].toUpperCase();
    }
    return null;
  }

  function findOptionBlockByLabel(keywords){
    const labels = document.querySelectorAll('.form-control__label,.ec-form__label,.ecwid-productOptions-name,.details-product-option__name,label');
    const keys = keywords.map(k=>k.toLowerCase());
    for (const L of labels){
      const t = (L.textContent||'').toLowerCase();
      if (!keys.some(k=>t.includes(k))) continue;
      let n=L; for (let i=0;i<5&&n;i++){ if (n.matches?.('.form-control,.ec-form__row,.ecwid-productOptions-option,.details-product-option')) return n; n=n.parentElement; }
      return L;
    }
    return null;
  }
  const findInput = b => b && (b.querySelector('input[type="text"],input[type="number"],.form-control__text-input input,.ec-input input') || b.querySelector('input'));
  const findSelect = b => b && (b.querySelector('select,.form-control__select,.ec-select') || b.querySelector('select'));

  function readLengthMm(){
    const blk = findOptionBlockByLabel(['длина','length']);
    const inp = findInput(blk);
    const v = parseFloat((inp?.value||'').replace(',', '.'));
    if (!Number.isFinite(v)) return {ok:false, reason:'Введите длину в мм'};
    if (v<MIN || v>MAX)     return {ok:false, reason:`Длина ${MIN}..${MAX} мм`};
    return {ok:true, value:v};
  }
  function readThickness(){
    const blk = findOptionBlockByLabel(['толщина','thickness']);
    const sel = findSelect(blk);
    if (!sel) return {ok:false, reason:'Выберите толщину'};
    const txt = sel.options[sel.selectedIndex]?.textContent || '';
    const m = txt.match(/0[.,]5|0[.,]6|0[.,]7/);
    if (!m) return {ok:false, reason:'Толщина 0.5 / 0.6 / 0.7 мм'};
    return {ok:true, value:m[0].replace(',','.')}; // '0.5'|'0.6'|'0.7'
  }

  // --- UI ---
  function injectButton(){
    if (document.querySelector('[data-cpc-btn]')) return; // уже вставлено
    const host = document.querySelector('.details-product-purchase,.product-details__product-controls,.ecwid-productDetails') || document.querySelector('.ec-store');
    if (!host) return setTimeout(injectButton, 300);

    const wrap = document.createElement('div');
    wrap.style.marginTop='10px';
    wrap.innerHTML = `
      <a href="#" data-cpc-btn class="form-control form-control--button" style="display:inline-block;">
        <span class="details-product-purchase__button">Рассчитать и купить</span>
      </a>
      <div style="margin-top:6px;color:#6b7280;font-size:12px">Цена по м² и толщине → товар будет добавлен в корзину.</div>
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
      if (!r.ok || !data.ok) throw new Error(data?.error || 'Ошибка сервера');

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

  // --- Автодобавление созданного товара ---
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

