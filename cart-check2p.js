const MSG = {
  ALERT_BOX: 'Загальна кількість банок у ящику має бути 15. Будь ласка, змініть вміст.\n\nУмови:\n• Класичний Полісол — до 7 банок\n• Інші види (Ш, Ж, М, Ч) — мінімум 8 банок',
  LINK_TEXT_BOX: 'Натисніть тут, щоб змінити вміст ящика',
  PRODUCT_URL_BOX: '/Yaschik-ekstrakta-polisolodovogo-550g-15banok-p717719689',
  PRODUCT_TITLE_BOX: 'Ящик екстракту полісолодового (15бан./550г) в асортименті:',
  BOX_TEXT: '&nbsp;ящиків',
  ALERT_CANS: 'Невідповідність кількості банок!\nУсі позиції повинні мати однакову загальну кількість банок.\nБудь ласка, змініть параметри замовлення.',
  LINK_TEXT_CANS: 'Налаштувати кількість банок',
  PRODUCT_URL_CANS: '/Polisol-tm-opt-p747565531',
  PRODUCT_TITLE_CANS: 'Полісол™ (опт)',
  CANS_TEXT: '&nbsp;банок'
};

let lastAlertTime = 0;

const QVM = {
  validateBox: qty => qty === 15,
  validateCans: (vrs, total) => {
    const a = vrs.filter(v => /Ш|Ж|М|Ч/.test(v.variation2)).length;
    return total === vrs.length * (total / vrs.length) && a >= 8;
  }
};

function updateQuantityText() {
  document.querySelectorAll('.form-control__select-text').forEach(el => {
    const t = el.closest('.ec-cart-item__wrap-primary')?.querySelector('.ec-cart-item__title')?.textContent?.trim();
    if (t === MSG.PRODUCT_TITLE_BOX && el.textContent.includes(':')) {
      el.innerHTML = el.textContent.replace(':', `${MSG.BOX_TEXT}:`);
    }
  });
}

function updateQuantityCansText() {
  document.querySelectorAll('.form-control__select-text').forEach(el => {
    const t = el.closest('.ec-cart-item__wrap-primary')?.querySelector('.ec-cart-item__title')?.textContent?.trim();
    if (t === MSG.PRODUCT_TITLE_CANS && el.textContent.includes(':')) {
      el.innerHTML = el.textContent.replace(':', `${MSG.CANS_TEXT}:`);
    }
  });
}

function validateCartItems() {
  let total = 0, found = false, alertNow = false, valid = false;
  document.querySelectorAll('.ec-cart-item__wrap-primary').forEach(item => {
    const title = item.querySelector('.ec-cart-item__title')?.textContent?.trim();
    if (title === MSG.PRODUCT_TITLE_BOX) {
      found = true;
      item.querySelectorAll('.ec-cart-option--value').forEach(opt => {
        const v = parseInt(opt.textContent.trim().match(/\d+/), 10);
        total += isNaN(v) ? 0 : v;
      });
      valid = QVM.validateBox(total | 0);
      const cb = document.getElementById('form-control__checkbox--agree');
      if (cb) cb.disabled = !valid;

      const linkBlock = item.querySelector('.ec-cart-item__options + .ec-form__title');
      if (!valid) {
        alertNow = true;
        if (!linkBlock) {
          const div = document.createElement('div');
          div.className = 'ec-form__title ec-header-h6';
          div.innerHTML = `<div class="marker-required marker-required--medium marker-required--active"></div><a href="${MSG.PRODUCT_URL_BOX}" style="color:red;font-weight:bold;">${MSG.LINK_TEXT_BOX}</a>`;
          div.querySelector('a').onclick = e => {
            e.preventDefault();
            Ecwid.Cart.clear();
            setTimeout(() => location.href = MSG.PRODUCT_URL_BOX, 200);
          };
          item.querySelector('.ec-cart-item__options')?.after(div);
        }
      } else if (linkBlock) {
        linkBlock.remove();
      }
    }
  });

  if (alertNow && Date.now() - lastAlertTime > 5000) {
    alert(MSG.ALERT_BOX);
    lastAlertTime = Date.now();
  }

  if (!found) {
    document.querySelectorAll('.ec-form__title a').forEach(a => {
      if (a.textContent === MSG.LINK_TEXT_BOX) a.parentElement.remove();
    });
    const cb = document.getElementById('form-control__checkbox--agree');
    if (cb) cb.disabled = true;
  }
}

function validateCartCans() {
  const items = document.querySelectorAll('.ec-cart-item__wrap-primary');
  let vrs = [], total = 0, found = false, valid = false;

  items.forEach(item => {
    const title = item.querySelector('.ec-cart-item__title')?.textContent?.trim();
    if (title === MSG.PRODUCT_TITLE_CANS) {
      found = true;
      const opts = item.querySelectorAll('.ec-cart-option');
      const v1 = opts[0]?.querySelector('.ec-cart-option--value')?.textContent?.trim();
      const v2 = opts[1]?.querySelector('.ec-cart-option--value')?.textContent?.trim();
      if (v1 && v2) {
        const n = parseInt(v1.match(/\d+/)[0], 10);
        vrs.push({ variation1: v1, variation2: v2 });
        total += n;
      }
    }
  });

  if (found) {
    valid = QVM.validateCans(vrs, total);
    const cb = document.getElementById('form-control__checkbox--agree');
    if (cb) cb.disabled = !valid;

    if (!valid && Date.now() - lastAlertTime > 5000) {
      alert(MSG.ALERT_CANS);
      lastAlertTime = Date.now();
    }

    if (!document.querySelector('.ec-form__title.cans-link')) {
      const div = document.createElement('div');
      div.className = 'ec-form__title ec-header-h6 cans-link';
      div.innerHTML = `<a href="${MSG.PRODUCT_URL_CANS}" style="color:blue;font-weight:bold;">${MSG.LINK_TEXT_CANS}</a>`;
      document.querySelector('.ec-cart__footer')?.prepend(div);
    }
  } else {
    document.querySelectorAll('.cans-link').forEach(e => e.remove());
    const cb = document.getElementById('form-control__checkbox--agree');
    if (cb) cb.disabled = true;
  }
}

function setupCartWatcher() {
  Ecwid.OnCartChanged.add(() => {
    validateCartItems();
    validateCartCans();
    updateQuantityText();
    updateQuantityCansText();
  });
}

Ecwid.OnApiLoaded.add(() => {
  setupCartWatcher();
  Ecwid.OnPageLoaded.add(page => {
    if (page.type === "CART") {
      setTimeout(() => {
        updateQuantityText();
        updateQuantityCansText();
        validateCartItems();
        validateCartCans();
      }, 100);
    }
  });
});
