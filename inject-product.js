
(function(){
  const MIN = 1000, MAX = 12000;
  const PLACEHOLDER = `Numeric from ${MIN} to ${MAX}`;

  function waitEcwid(cb){ (typeof Ecwid!=='undefined' && Ecwid.OnAPILoaded)?cb():setTimeout(()=>waitEcwid(cb),100); }

  waitEcwid(() => {
    Ecwid.OnAPILoaded.add(() => {
      Ecwid.OnPageLoaded.add(page => {
        if (page.type !== 'PRODUCT') return;
        applyForWidth1210();
        // На случай перерисовок Ecwid — повторно применяем
        ensureObserver();
      });
    });
  });

  // --- 1) Проверка SKU ---
  function getSku(){
    // Ваш DOM: <div class="product-details__product-sku" itemprop="sku">SKU  WIDTH-1210</div>
    const sels = ['[itemprop="sku"]','.product-details__product-sku','[data-product-sku]'];
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

  // --- 2) Подавление видимости qty и controls (без удаления) ---
  function suppressActionPanel(){
    const panel = document.querySelector('.product-details-module.product-details__action-panel.details-product-purchase');
    if (!panel) return;
    // помечаем контейнер
    panel.setAttribute('data-cpc-scope','1');
    // инжектим CSS единожды
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

  // --- 3) Настройка поля длины и плейсхолдера ---
  function getLengthInput(){
    // 3.1 Ищем по aria-label
    let input = document.querySelector('input[aria-label="Length (mm)"]')
             || document.querySelector('input[aria-label*="Length"]');
    // 3.2 Если нет — ищем модуль с заголовком "Length (mm)"
    if (!input) {
      const title = Array.from(document.querySelectorAll('.product-details-module__title, .details-product-option__title'))
        .find(el => /length\s*\(mm\)|\blength\b/i.test(el.textContent || ''));
      const mod = title?.closest('.product-details-module') || title?.closest('.details-product-option');
      input = mod?.querySelector('input.form-control__text') || mod?.querySelector('input');
    }
    // 3.3 Фолбэк по плейсхолдеру
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

    // числовой ввод
    input.setAttribute('inputmode','numeric');
    input.setAttribute('pattern','[0-9]*');
    input.setAttribute('maxlength','6'); // до 12000
    input.placeholder = PLACEHOLDER;

    // обновляем «оверлейный» плейсхолдер Ecwid
    const phInner = input.closest('.form-control')?.querySelector('.form-control__placeholder-inner');
    if (phInner && phInner.textContent?.trim() !== PLACEHOLDER) {
      phInner.textContent = PLACEHOLDER;
    }

    // аккуратная санитизация: только цифры
    if (!input.dataset.cpcSanitize) {
      input.addEventListener('input', () => {
        const digits = (input.value || '').replace(/[^\d]/g,'');
        if (digits !== input.value) input.value = digits;
      });
      input.dataset.cpcSanitize = '1';
    }
  }

  // --- 4) Применение для целевых товаров ---
  function applyForWidth1210(){
    if (!isTargetProduct()) return;
    suppressActionPanel();
    patchLengthField();
  }

  // --- 5) Наблюдение за перерисовками (Ecwid часто обновляет DOM) ---
  function ensureObserver(){
    if (window.__cpcMo) return;
    const root = document.querySelector('.ec-store, .ecwid-productBrowser, body') || document.body;
    const mo = new MutationObserver(() => applyForWidth1210());
    mo.observe(root, { childList:true, subtree:true });
    window.__cpcMo = mo;
  }

})();


