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

// == Функции из cart-check.js без изменений ==
function waitEcwid(c) {
  typeof Ecwid !== 'undefined' && typeof Ecwid.OnAPILoaded !== 'undefined' 
    ? c() 
    : setTimeout(() => waitEcwid(c), 100);
}

function updateQuantityText() {
  document.querySelectorAll('.form-control__select-text').forEach(el => {
   if (el.textContent.includes(':') && !el.textContent.includes('ящиків')) {
  el.innerHTML = el.textContent.replace(':', `&nbsp;ящиків:`);
}
  });
}

function validateCartItems() {
  let total = 0;
  const items = document.querySelectorAll('.ec-cart-item__wrap-primary');
  let productFound = false;
  let shouldShowAlert = false;

  items.forEach(item => {
    const title = item.querySelector('.ec-cart-item__title');
    if(title && title.textContent.trim() === MSG.PRODUCT_TITLE) {
      productFound = true;
      item.querySelectorAll('.ec-cart-option--value').forEach(option => {
        const value = parseInt(option.textContent.trim().match(/\d+/), 10);
        total += isNaN(value) ? 0 : value;
      });

      const checkbox = document.getElementById('form-control__checkbox--agree');
      const isValid = QVM.validate(total | 0);
      if(checkbox) checkbox.disabled = !isValid;

      if(!isValid) {
        shouldShowAlert = true;
        let optionsDiv = item.querySelector('.ec-cart-item__options.ec-text-muted');
        if(optionsDiv && !optionsDiv.nextElementSibling?.classList?.contains('ec-form__title')) {
          const linkDiv = document.createElement('div');
          linkDiv.className = 'ec-form__title ec-header-h6';
          linkDiv.innerHTML = `
            <div class="marker-required marker-required--medium marker-required--active"></div>
            <a href="${MSG.PRODUCT_URL}" target="_self" style="color: red; font-weight: bold;">
              ${MSG.LINK_TEXT}
            </a>
          `;
          const link = linkDiv.querySelector('a');
          link.addEventListener('click', function(e) {
            e.preventDefault();
            Ecwid.Cart.clear();
            setTimeout(() => { window.location.href = this.href; }, 200);
          });
          optionsDiv.parentNode.insertBefore(linkDiv, optionsDiv.nextSibling);
        }
      } else {
        const warningDiv = item.querySelector('.ec-cart-item__options.ec-text-muted + .ec-form__title');
        if(warningDiv) {
          warningDiv.remove();
        }
      }
    }
  });

  if(shouldShowAlert && Date.now() - lastAlertTime > 5000) {
    alert(MSG.ALERT);
    lastAlertTime = Date.now();
  }

  if(!productFound) {
    document.querySelectorAll('.ec-form__title.ec-header-h6').forEach(el => {
      if(el.querySelector('a')?.textContent === MSG.LINK_TEXT) {
        el.remove();
      }
    });
  }
}

// == Новые функции для "Полісол™ (опт)" ==
function updateQuantityCansTxt() {
  document.querySelectorAll('.form-control__select-text').forEach(el => {
    if (el.textContent.includes(':') && !el.textContent.includes('банок')) {
  el.innerHTML = el.textContent.replace(':', `&nbsp;банок:`);
}
  });
}

function validateCartCans(cart) {
  const cansItems = cart.items.filter(item => item.name === MSG.PRODUCT_TITLE_CANS);
  if (cansItems.length === 0) return;

  const refQty = extractMainQty(cansItems[0]);
  const allSame = cansItems.every(item => extractMainQty(item) === refQty);
  const total = cansItems.reduce((acc, item) => acc + item.quantity, 0);

  const checkbox = document.getElementById('form-control__checkbox--agree');
  const isValid = allSame && total === refQty;
  if(checkbox) checkbox.disabled = !isValid;

  const productRow = document.querySelectorAll('.ec-cart-item__wrap-primary').find(el => 
    el.querySelector('.ec-cart-item__title')?.textContent.trim() === MSG.PRODUCT_TITLE_CANS
  );

  if (!isValid && productRow) {
    const linkDiv = document.createElement('div');
    linkDiv.className = 'ec-form__title ec-header-h6';
    linkDiv.innerHTML = `
      <div class="marker-required marker-required--medium marker-required--active"></div>
      <a href="${MSG.PRODUCT_URL_CANS}" target="_self" style="color: blue; font-weight: bold;">
        ${MSG.LINK_TEXT_CANS}
      </a>
    `;
    if (!productRow.querySelector(`a[href="${MSG.PRODUCT_URL_CANS}"]`)) {
      productRow.appendChild(linkDiv);
    }

    if (Date.now() - lastAlertTime > 5000) {
      alert(MSG.ALERT_CANS);
      lastAlertTime = Date.now();
    }
  }
}

function extractMainQty(item) {
  const qtyOption = item.options.find(opt => opt.name.includes('банок'));
  if (!qtyOption) return 0;
  const match = qtyOption.value.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

// == Подключение ==
function setupCartWatcher() {
  Ecwid.OnCartChanged.add(function(cart) {
    setTimeout(() => {
      updateQuantityText();
      validateCartItems();

      updateQuantityCansTxt();
      validateCartCans(cart);
    }, 300);
  });
}

waitEcwid(() => {
  Ecwid.OnAPILoaded.add(() => {
    setupCartWatcher();
    Ecwid.OnPageLoaded.add(page => {
      if (page.type === "CART") {
        setTimeout(() => {
          updateQuantityText();
          validateCartItems();
          updateQuantityCansTxt();
        }, 500);
      }
    });
  });
});
