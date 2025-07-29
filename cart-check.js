// === 1. Проверка на параметр в URL ===
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.has(param);
}

let isFromPolisol = getQueryParam('productView'); // fallback
let isProductShown = false;

// === 2. Приём сообщения от polisol.online ===
window.addEventListener('message', event => {
  if (event.origin === 'https://polisol.online' && event.data.source === 'polisol') {
    isFromPolisol = true;
    document.body.classList.add('from-polisol-embed');
  }
});

// === 3. Ожидание загрузки Ecwid ===
function waitEcwid(callback) {
  if (typeof Ecwid !== 'undefined' && typeof Ecwid.OnAPILoaded !== 'undefined') {
    callback();
  } else {
    setTimeout(() => waitEcwid(callback), 100);
  }
}

waitEcwid(() => {
  Ecwid.OnAPILoaded.add(() => {

    // === 4. Логика при загрузке страницы ===
    Ecwid.OnPageLoaded.add(page => {
      if (isFromPolisol && !isProductShown && page.type !== 'PRODUCT') {
        isProductShown = true;
        Ecwid.openProduct('p671365720');
      }

      // === 5. Модификации на странице товара ===
      if (isFromPolisol && page.type === 'PRODUCT' && page.productId === 671365720) {
        const qtyBlock = document.querySelector('.details-product-purchase__qty');
        if (qtyBlock) qtyBlock.style.display = 'none';

        const btn = document.querySelector('.form-control.form-control--button .details-product-purchase__button');
        if (btn) btn.textContent = 'Pay for this';
      }

      // === 6. Модификация внешнего вида корзины ===
      if (isFromPolisol && page.type === 'CART') {
        const style = document.createElement('style');
        style.textContent = `
          header, footer, .ec-store__breadcrumbs, .ec-cart__shopping, .ec-cart__coupon {
            display: none !important;
          }
          .form-control__button-inner {
            font-weight: bold;
            background: #4caf50;
            color: white;
            border-radius: 6px;
            padding: 10px 20px;
          }
          .form-control__button-inner::after {
            content: " ➔ Продовжити оформлення";
          }
        `;
        document.head.appendChild(style);
      }
    });

    // === 7. Клик по кнопке → перейти в корзину ===
    document.addEventListener('click', e => {
      if (isFromPolisol) {
        const btn = e.target.closest('.form-control.form-control--button .details-product-purchase__button');
        if (btn) {
          setTimeout(() => Ecwid.openPage('cart'), 300);
        }
      }
    });

  });
});

function resolveProductUrl(productId, fallbackSlug, fallbackName = '') {
  const baseUrl = location.origin + location.pathname;
  const isEcwidEmbed = /#!/.test(location.href); // обнаруживает hash-based ссылки

  if (isEcwidEmbed) {
    // Формирует ссылку типа /?page_id=XYZ#!/Product-Name/p/ID
    const slug = fallbackName || 'product';
    return `${baseUrl}#!/${slug}/p/${productId}`;
  }

  return fallbackSlug;
}
// == Константы ==
const MSG = {
  cart: {
    ALERT: 'Загальна кількість банок у ящику має бути 15. Будь ласка, змініть вміст.\n\nУмови:\n• Класичний Полісол — до 7 банок\n• Інші види (Ш, Ж, М, Ч) — мінімум 8 банок',
    LINK_TEXT: 'Натисніть тут, щоб змінити вміст ящика',
    PRODUCT_URL: '/Yaschik-ekstrakta-polisolodovogo-550g-15banok-p717719689',
    PRODUCT_TITLE: 'Ящик екстракту полісолодового (15бан./550г) в асортименті:',
    BOX_TEXT: '&nbsp;ящиків',
    ALERT_EXTRA_ITEMS: 'Це спеціальний кошик для акційного товару. Він діє лише для:\n"Ящик екстракту полісолодового (15бан./550г) в асортименті"\n\nОднак наразі у кошику є інші товари. Це порушує умови акції — будь ласка:\n✔ Видаліть зайві позиції або ✔ Оформіть їх окремим замовленням',
    LINK_TEXT_REMOVE: '❌ Видалити товар з кошика',
    DISABLED_CONTROL_HINT: 'Ця дія тимчасово недоступна при замовленні акційного товару.'
  },
  bulk: {
    PRODUCT_TITLE: 'Полісол™ (опт)',
    PRODUCT_URL: resolveProductUrl('747565531', '/Polisol-tm-opt-p747565531', 'Polisol-tm-opt'),
    INVALID_NOTICE: '⚠️ Помилка формування партії:\n• Оптова ціна визначається єдиним розміром партії, встановленим для кожного виду Полісолу з асортименту в кошику. Видаліть небажані позиції, що не відповідають цій вимозі.\n•Сума банок різних видів Полісолу повинна дорівнювати обсягу партії\n• У кошику не повинно бути сторонніх товарів\n✔ Додайте необхідні варіації або видаліть зайві товари',
    CONTROL_HINT: 'Ця дія недоступна під час оформлення партії Полісол™ (опт)'
  },
  shared: {
    MIXED_WARNING: '⚠️ У кошику не можна одночасно мати два акційні товари:\n• “Ящик екстракту...” та “Полісол™ (опт)”\nВидаліть один з них, щоб продовжити оформлення.'
  }
};

let lastAlertTime = 0;

function injectBulkMarkers() {
  const optionPairs = document.querySelectorAll('.ec-cart-item__option');
  optionPairs.forEach(pair => {
    const key = pair.querySelector('.ec-cart-option--key')?.textContent.toLowerCase() || '';
    const value = pair.querySelector('.ec-cart-option--value');

    const isBulkSizeOption =
      key.includes('розмір партії') || (value && value.textContent.includes('='));

    if (isBulkSizeOption && value && !value.querySelector('.marker-required--small')) {
      const marker = document.createElement('div');
      marker.className = 'marker-required marker-required--small';
      value.appendChild(marker);
    }
  });
}


function activateBulkMarkers(active = true) {
  const markers = document.querySelectorAll('.marker-required--small');
  markers.forEach(m => {
    if (active) {
      m.classList.add('marker-required--active');
    } else {
      m.classList.remove('marker-required--active');
    }
  });
}


// == Детектор ==
function detectTrigger() {
  const titles = Array.from(document.querySelectorAll('.ec-cart-item__title')).map(e => e.textContent.trim());
  const first = titles[0];
  return {
    isMixed: titles.includes(MSG.cart.PRODUCT_TITLE) && titles.includes(MSG.bulk.PRODUCT_TITLE),
    trigger: first === MSG.cart.PRODUCT_TITLE ? 'cart' : (first === MSG.bulk.PRODUCT_TITLE ? 'bulk' : null)
  };
}

// == CART Namespace ==
const CART = {
  QVM: {
    validate: v => { "use asm"; v = v | 0; return (v === 15) | 0; }
  },
  updateQuantityText() {
    const hasBox = Array.from(document.querySelectorAll('.ec-cart-item__title')).some(el => el.textContent.trim() === MSG.cart.PRODUCT_TITLE);
    if (!hasBox) return;
    document.querySelectorAll('.form-control__select-text').forEach(el => {
      if (el.textContent.includes(':') && !el.textContent.includes('ящиків')) {
        el.innerHTML = el.textContent.replace(':', `${MSG.cart.BOX_TEXT}:`);
      }
    });
  },
  validateItems() {
    let total = 0;
    let found = false;
    let shouldAlert = false;
    const items = document.querySelectorAll('.ec-cart-item__wrap-primary');
    items.forEach(item => {
      const title = item.querySelector('.ec-cart-item__title')?.textContent.trim();
      if (title === MSG.cart.PRODUCT_TITLE) {
        found = true;
        item.querySelectorAll('.ec-cart-option--value').forEach(option => {
          const num = parseInt(option.textContent.match(/\d+/)?.[0], 10);
          total += isNaN(num) ? 0 : num;
        });
        const checkbox = document.getElementById('form-control__checkbox--agree');
        const valid = CART.QVM.validate(total | 0);
        if (checkbox) checkbox.disabled = !valid;
        if (!valid) {
          shouldAlert = true;
          const optionsDiv = item.querySelector('.ec-cart-item__options.ec-text-muted');
          if (optionsDiv && !optionsDiv.nextElementSibling?.classList?.contains('ec-form__title')) {
            const div = document.createElement('div');
            div.className = 'ec-form__title ec-header-h6';
            div.innerHTML = `
              <div class="marker-required marker-required--medium marker-required--active"></div>
              <a href="${MSG.cart.PRODUCT_URL}" style="color: red; font-weight: bold;">${MSG.cart.LINK_TEXT}</a>`;
            div.querySelector('a').addEventListener('click', e => {
              e.preventDefault(); Ecwid.Cart.clear();
              setTimeout(() => location.href = e.target.href, 200);
            });
            optionsDiv.parentNode.insertBefore(div, optionsDiv.nextSibling);
          }
        } else {
          const warning = item.querySelector('.ec-cart-item__options.ec-text-muted + .ec-form__title');
          if (warning) warning.remove();
        }
      }
    });
    if (shouldAlert && Date.now() - lastAlertTime > 5000) {
      alert(MSG.cart.ALERT); lastAlertTime = Date.now();
    }
    if (!found) {
      document.querySelectorAll('.ec-form__title.ec-header-h6').forEach(el => {
        if (el.querySelector('a')?.textContent === MSG.cart.LINK_TEXT) el.remove();
      });
    }
  },
  checkExtraItems() {
    const items = document.querySelectorAll('.ec-cart-item__wrap-primary');
    const extra = Array.from(items).filter(el => {
      const title = el.querySelector('.ec-cart-item__title')?.textContent.trim();
      return title && title !== MSG.cart.PRODUCT_TITLE;
    });
    const checkbox = document.getElementById('form-control__checkbox--agree');
    if (checkbox) checkbox.disabled = extra.length > 0;
    extra.forEach(item => {
      if (!item.querySelector('.ec-remove-link-marker')) {
        const div = document.createElement('div');
        div.className = 'ec-form__title ec-header-h6 ec-remove-link-marker';
        div.innerHTML = `<div class="marker-required marker-required--medium marker-required--active"></div>
        <a href="#" style="color: red; font-weight: bold;">${MSG.cart.LINK_TEXT_REMOVE}</a>`;
        div.querySelector('a').addEventListener('click', e => {
          e.preventDefault();
          item.querySelector('.ec-cart-item__control-inner')?.click();
        });
        item.appendChild(div);
      }
      const wrap = item.closest('.ec-cart-item__wrap');
      const sel = wrap?.querySelector('.form-control__select-text');
      if (sel && sel.textContent.includes('ящиків')) {
        sel.innerHTML = sel.innerHTML.replace('ящиків', '').replace(/\s+:/, ':');
      }
    });
    if (extra.length > 0 && Date.now() - lastAlertTime > 5000) {
      alert(MSG.cart.ALERT_EXTRA_ITEMS);
      lastAlertTime = Date.now();
    }
  },
  disableControls() {
    ['.ec-cart__coupon', '.ec-cart__shopping'].forEach(selector => {
      const block = document.querySelector(selector);
      const link = block?.querySelector('a');
      if (block) {
        block.style.pointerEvents = 'none';
        block.style.opacity = '0.5';
      }
      if (link) {
        link.style.cursor = 'not-allowed';
        link.addEventListener('click', e => {
          e.preventDefault();
          e.stopImmediatePropagation();
          return false;
        });
      }
    });
  },
  patchPlaceholder() {
    const placeholder = document.querySelector('.ec-cart__coupon .form-control__placeholder-inner');
    if (placeholder && !placeholder.dataset.modified) {
      placeholder.textContent = '🔕 Тут код не діє';
      placeholder.dataset.modified = 'true';
    }
  }
};

// == BULK Namespace ==
const BULK = {
  updateQuantityText() {
    document.querySelectorAll('.form-control__select-text').forEach(el => {
      if (el.textContent.includes(':') && !el.textContent.includes('банок')) {
        el.innerHTML = el.textContent.replace(':', '&nbsp;банок:');
      }
    });
  },
  getJarCount(item) {
    const countText = item.closest('.ec-cart-item__wrap')?.querySelector('.form-control__select-text')?.textContent;
    return parseInt(countText?.match(/\d+/)?.[0], 10) || 0;
  },
  getBulkSize(item) {
    const match = item.querySelector('.ec-cart-option--value')?.textContent?.match(/(\d+)\s*банок/);
    return match ? parseInt(match[1], 10) : 0;
  },
  validate() {
    const items = Array.from(document.querySelectorAll('.ec-cart-item__wrap-primary'))
      .filter(i => i.querySelector('.ec-cart-item__title')?.textContent.trim() === MSG.bulk.PRODUCT_TITLE);
    if (!items.length) return;

    const sizes = items.map(BULK.getBulkSize);
    const same = sizes.every(s => s === sizes[0]);
    const sum = items.reduce((acc, i) => acc + BULK.getJarCount(i), 0);
    const valid = same && sum === sizes[0];

    const extraItems = Array.from(document.querySelectorAll('.ec-cart-item__title'))
      .some(t => t.textContent.trim() !== MSG.bulk.PRODUCT_TITLE);

    const checkbox = document.getElementById('form-control__checkbox--agree');
    if (checkbox) checkbox.disabled = !valid || extraItems;

    const existing = document.getElementById('bulk-validation-notice');
    if (existing) existing.remove();

    if (!valid || extraItems) {
  injectBulkMarkers(); // ✅ вставка маркеров

  const notice = document.createElement('div');
  notice.id = 'bulk-validation-notice';
  notice.style.color = 'red';
  notice.style.margin = '12px 0';
  notice.style.fontSize = '14px';

  notice.innerHTML = `
  ⚠️ <strong>Формування партії наразі некоректне:</strong><br>
  ${!same ? `
    <strong>• Опція <u data-hover="bulk">«розмір партії»</u> [15, 30, ..., 75] банок <br>→</strong>
    діє як <abbr title="Опція, яка впливає на знижку для всієї партії" style="cursor: help;">модифікатор оптової знижки!</abbr><br>
    → Ця опція має бути <u data-hover="bulk" style="cursor: help;">однаковою</u> для кожної позиції у кошику <em>(тобто для кожного різновиду товару)</em>.<br>
    Кількісні цілочисельні значення для банок щодо кожного різновиду, <em>також визначаються замовником</em> - під час формування асортименту - можуть <em>відрізнятись</em>, але їхня загальна кількість у замовленні має <u data-hover="bulk" style="cursor: help;">відповідати єдиному «розміру партії»</u>, встановленому для кожної товарної позиції у кошику.<br>  
    <strong>→ Щоб продовжити:</strong><br>
    <ul style="margin-top: 6px;">
      <li>Повністю очистіть кошик</li>
      <li>Створіть асортимент, обравши однаковий «розмір партії» для всіх позицій у кошику.</li>
    </ul>
  ` : ''}
  ${(sum !== sizes[0]) ? `• Загальна кількість банок: ${sum}, очікується: ${sizes[0]}<br>` : ''}
  ${extraItems ? '• У кошику є зайві товари<br>' : ''}
  ${
    sum < sizes[0]
      ? `<a href="${MSG.bulk.PRODUCT_URL}" style="color: blue;">➕ Додати ще банок до ${sizes[0]} шт.</a>`
      : `<div style="color: blue; margin-top: 6px;">🔻 Зменште кількість до ${sizes[0]} шт.</div>`
  }
  `;

  document.querySelector('.ec-cart__products-inner')?.appendChild(notice);

  // 🔄 Добавляем поведение при наведении на <u data-hover="bulk">
  document.querySelectorAll('u[data-hover="bulk"]').forEach(el => {
    el.addEventListener('mouseenter', () => activateBulkMarkers(true));
    el.addEventListener('mouseleave', () => activateBulkMarkers(false));
  });
}

  }
};

// == MAIN ROUTER ==
function runLogic() {
  const { isMixed, trigger } = detectTrigger();
  if (isMixed) {
    const notice = document.createElement('div');
    notice.id = 'mixed-trigger-warning';
    notice.style.color = 'darkred';
    notice.style.margin = '12px 0';
    notice.style.fontWeight = 'bold';
    notice.textContent = MSG.shared.MIXED_WARNING;
    document.querySelector('.ec-cart__products-inner')?.appendChild(notice);
    const checkbox = document.getElementById('form-control__checkbox--agree');
    if (checkbox) checkbox.disabled = true;
    return;
  }

  if (trigger === 'cart') {
    CART.updateQuantityText();
    CART.validateItems();
    CART.checkExtraItems();
    CART.disableControls();
    CART.patchPlaceholder();
  } else if (trigger === 'bulk') {
    BULK.updateQuantityText();
    BULK.validate();
  }
}

// == Ecwid Init ==
function waitEcwid(callback) {
  if (typeof Ecwid !== 'undefined' && typeof Ecwid.OnAPILoaded !== 'undefined') {
    callback();
  } else {
    setTimeout(() => waitEcwid(callback), 100);
  }
}

let isCartPage = false;

waitEcwid(() => {
  Ecwid.OnAPILoaded.add(() => {
    Ecwid.OnPageLoaded.add(page => {
      isCartPage = page.type === 'CART';
      if (isCartPage) {
        setTimeout(runLogic, 500);
      }
    });

    Ecwid.OnCartChanged.add(() => {
      if (!isCartPage) return;
      setTimeout(runLogic, 300);
    });
  });
});

// Ecwid-cart-check-debug-v2.js
// Попытка "закрепить" фильтр на странице cart, чтобы он не сбрасывался после рендеринга/навигации Ecwid.
(function () {
  var TARGET_PRODUCT_ID = null;
  var lastApplied = null;

  function cartHasProduct(productId) {
    var cartKey = Object.keys(localStorage).find(k => /^ecwid_cart_/.test(k));
    if (!cartKey) return false;
    try {
      var cart = JSON.parse(localStorage[cartKey]);
      return Array.isArray(cart.items) && cart.items.some(i => String(i.productId) === String(productId));
    } catch (e) { return false; }
  }

  function hideUnwantedEcwidElements() {
    console.log('[cart-check.js] Hiding all except #main (filtered)');
    var body = document.body;
    Array.from(body.children).forEach(function (el) {
      if (el.tagName.toLowerCase() !== "script" && el.id !== "main") {
        el.style.visibility = "hidden";
        el.style.pointerEvents = "none";
        el.style.height = "0";
        el.style.margin = "0";
        el.style.padding = "0";
        el.style.border = "none";
        el.style.minHeight = "0";
        el.style.maxHeight = "0";
        el.style.overflow = "hidden";
      }
    });
    Array.from(body.querySelectorAll("script")).forEach(function (s) {
      if (!/var hasStaticHtml/.test(s.textContent) && !/var isHomePage/.test(s.textContent)) {
        s.style.visibility = "hidden";
        s.type = "ecwid/hidden-script";
      }
    });
    lastApplied = "hide";
  }

  function showAllEcwidElements() {
    console.log('[cart-check.js] Restoring all elements (filter OFF)');
    var body = document.body;
    Array.from(body.children).forEach(function (el) {
      if (el.tagName.toLowerCase() !== "script" && el.id !== "main") {
        el.style.visibility = "";
        el.style.pointerEvents = "";
        el.style.height = "";
        el.style.margin = "";
        el.style.padding = "";
        el.style.border = "";
        el.style.minHeight = "";
        el.style.maxHeight = "";
        el.style.overflow = "";
      }
    });
    Array.from(body.querySelectorAll("script")).forEach(function (s) {
      s.style.visibility = "";
      if (s.type === "ecwid/hidden-script") s.type = "text/javascript";
    });
    lastApplied = "show";
  }

  function updateVisibility() {
    if (TARGET_PRODUCT_ID && cartHasProduct(TARGET_PRODUCT_ID)) {
      hideUnwantedEcwidElements();
    } else {
      showAllEcwidElements();
    }
  }

  // СТАБИЛИЗАТОР: повторять updateVisibility() после рендеринга корзины
  function stabilizeFilter(intervalMs) {
    setInterval(function () {
      if (TARGET_PRODUCT_ID && cartHasProduct(TARGET_PRODUCT_ID)) {
        if (lastApplied !== "hide") updateVisibility();
      } else {
        if (lastApplied !== "show") updateVisibility();
      }
    }, intervalMs);
  }

  window.addEventListener("message", function(ev) {
    if (typeof ev.data === "object" && ev.data.ecwidCleanProductId !== undefined) {
      TARGET_PRODUCT_ID = String(ev.data.ecwidCleanProductId) || null;
      console.log(`[cart-check.js] Получено postMessage ecwidCleanProductId:`, TARGET_PRODUCT_ID);
      updateVisibility();
    }
  });

  function waitMainAndTry(retries = 30) {
    if (document.querySelector('#main')) {
      updateVisibility();
      console.log('[cart-check.js] #main появился, вызов updateVisibility()');
    } else if (retries > 0) {
      setTimeout(() => waitMainAndTry(retries - 1), 200);
    }
  }
  waitMainAndTry();

  try {
    console.log('[cart-check.js] Скрипт подключён. window.name:', window.name);
  } catch (e) {}

  // Стартуем стабилизатор (каждые 500ms)
  stabilizeFilter(500);
})();

