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
      const notice = document.createElement('div');
      notice.id = 'bulk-validation-notice';
      notice.style.color = 'red';
      notice.style.margin = '12px 0';
      notice.style.fontSize = '14px';
      notice.innerHTML = `
        ⚠️ Формування партії наразі некоректне:<br>
        ${!same ? '• Оптова ціна визначається єдиним розміром партії, встановленим для\nкожного виду Полісолу з асортименту в кошику\n → будь ласка: видаліть небажані позиції, що не відповідають цій вимозі.<br>' : ''}
        ${(sum !== sizes[0]) ? `• Загальна кількість банок: ${sum}, очікується: ${sizes[0]}<br>` : ''}
        ${extraItems ? '• У кошику є зайві товари<br>' : ''}
        ${(sum < sizes[0])
          ? `<a href="${MSG.bulk.PRODUCT_URL}" style="color: blue;">➕ Додати ще банок до ${sizes[0]} шт.</a>`
          : `<div style="color: #444; margin-top: 6px;">🔻 Зменште кількість до ${sizes[0]} шт.</div>`}
      `;
      document.querySelector('.ec-cart__products-inner')?.appendChild(notice);
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


