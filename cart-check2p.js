// == Константы ==
var QVM = {
  validate: function(v) {
    "use asm";
    v = v | 0;
    return (v === 15) | 0;
  }
};

var MSG = {
  ALERT: 'Загальна кількість банок у ящику має бути 15. Будь ласка, змініть вміст.\n\nУмови:\n• Класичний Полісол — до 7 банок\n• Інші види (Ш, Ж, М, Ч) — мінімум 8 банок',
  LINK_TEXT: 'Натисніть тут, щоб змінити вміст ящика',
  PRODUCT_URL: '/Yaschik-ekstrakta-polisolodovogo-550g-15banok-p717719689',
  PRODUCT_TITLE: 'Ящик екстракту полісолодового (15бан./550г) в асортименті:',
  BOX_TEXT: '&nbsp;ящиків',

  PRODUCT_TITLE_CANS: 'Полісол™ (опт)',
  PRODUCT_URL_CANS: '/Polisol-tm-opt-p747565531',
  LINK_TEXT_CANS: 'Перевірити вміст замовлення',
  BOX_TEXT_CANS: '&nbsp;банок',
  ALERT_CANS: 'Кількість банок не відповідає обраному загальному об’єму.\n\nПеревірте, будь ласка, обрані параметри.'
};

var lastAlertTime = 0;

// == Вспомогательные функции ==
function waitEcwid(callback) {
  if (typeof Ecwid !== 'undefined' && typeof Ecwid.OnAPILoaded !== 'undefined') {
    callback();
  } else {
    setTimeout(() => waitEcwid(callback), 100);
  }
}

// == Обновление текста количества ==
function updateQuantityText() {
  const titles = Array.from(document.querySelectorAll('.ec-cart-item__title')).map(el => el.textContent.trim());
  const hasBoxProduct = titles.includes(MSG.PRODUCT_TITLE);
  const hasCansProduct = titles.includes(MSG.PRODUCT_TITLE_CANS);

  document.querySelectorAll('.form-control__select-text').forEach(el => {
    if (el.textContent.includes(':')) {
      if (hasBoxProduct && !el.textContent.includes('ящиків')) {
        el.innerHTML = el.textContent.replace(':', `${MSG.BOX_TEXT}:`);
      }
      if (hasCansProduct && !el.textContent.includes('банок')) {
        el.innerHTML = el.textContent.replace(':', `${MSG.BOX_TEXT_CANS}:`);
      }
    }
  });
}

// == Валидация ящиков ==
function validateCartItems(cart) {
  let total = 0;
  let productFound = false;
  let shouldShowAlert = false;

  const items = cart.items || [];
  items.forEach(item => {
    if (item.name === MSG.PRODUCT_TITLE) {
      productFound = true;
      item.options.forEach(option => {
        const value = parseInt(option.value.match(/\d+/), 10);
        total += isNaN(value) ? 0 : value;
      });
    }
  });

  const checkbox = document.getElementById('form-control__checkbox--agree');
  const isValid = QVM.validate(total);
  if (checkbox) checkbox.disabled = !isValid;

  if (productFound) {
    const nodes = document.querySelectorAll('.ec-cart-item__wrap-primary');
    nodes.forEach(node => {
      const title = node.querySelector('.ec-cart-item__title');
      if (title && title.textContent.trim() === MSG.PRODUCT_TITLE) {
        const optionsDiv = node.querySelector('.ec-cart-item__options.ec-text-muted');
        const hasWarning = node.querySelector(`a[href="${MSG.PRODUCT_URL}"]`);
        if (!isValid && optionsDiv && !hasWarning) {
          const linkDiv = document.createElement('div');
          linkDiv.className = 'ec-form__title ec-header-h6';
          linkDiv.innerHTML = `
            <div class="marker-required marker-required--medium marker-required--active"></div>
            <a href="${MSG.PRODUCT_URL}" target="_self" style="color: red; font-weight: bold;">
              ${MSG.LINK_TEXT}
            </a>
          `;
          node.appendChild(linkDiv);
        } else if (isValid && hasWarning?.closest('.ec-form__title')) {
          hasWarning.closest('.ec-form__title').remove();
        }
      }
    });
    if (!isValid && Date.now() - lastAlertTime > 5000) {
      alert(MSG.ALERT);
      lastAlertTime = Date.now();
    }
  }
}

// == Валидация банок ==
function validateCartCans(cart) {
  const cansItems = cart.items.filter(item => item.name === MSG.PRODUCT_TITLE_CANS);
  if (cansItems.length === 0) return;

  const refQty = extractMainQty(cansItems[0]);
  const allSame = cansItems.every(item => extractMainQty(item) === refQty);
  const total = cansItems.reduce((acc, item) => acc + item.quantity, 0);

  const checkbox = document.getElementById('form-control__checkbox--agree');
  const isValid = allSame && total === refQty;
  if (checkbox) checkbox.disabled = !isValid;

  const nodes = document.querySelectorAll('.ec-cart-item__wrap-primary');
  nodes.forEach(node => {
    const title = node.querySelector('.ec-cart-item__title');
    if (title && title.textContent.trim() === MSG.PRODUCT_TITLE_CANS) {
      const hasLink = node.querySelector(`a[href="${MSG.PRODUCT_URL_CANS}"]`);
      if (!isValid && !hasLink) {
        const linkDiv = document.createElement('div');
        linkDiv.className = 'ec-form__title ec-header-h6';
        linkDiv.innerHTML = `
          <div class="marker-required marker-required--medium marker-required--active"></div>
          <a href="${MSG.PRODUCT_URL_CANS}" target="_self" style="color: blue; font-weight: bold;">
            ${MSG.LINK_TEXT_CANS}
          </a>
        `;
        node.appendChild(linkDiv);
      } else if (isValid && hasLink?.closest('.ec-form__title')) {
        hasLink.closest('.ec-form__title').remove();
      }
    }
  });

  if (!isValid && Date.now() - lastAlertTime > 5000) {
    alert(MSG.ALERT_CANS);
    lastAlertTime = Date.now();
  }
}

function extractMainQty(item) {
  const qtyOption = item.options.find(opt => opt.name.includes('банок'));
  const match = qtyOption?.value.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

// == Подключения ==
waitEcwid(() => {
  Ecwid.OnAPILoaded.add(() => {
    Ecwid.OnCartChanged.add(cart => {
      setTimeout(() => {
        updateQuantityText();
        validateCartItems(cart);
        validateCartCans(cart);
      }, 300);
    });

    Ecwid.OnPageLoaded.add(page => {
      if (page.type === "CART") {
        setTimeout(() => {
          updateQuantityText();
        }, 500);
      }
    });
  });
});

