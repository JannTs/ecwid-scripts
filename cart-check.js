// == Константы ==
var QVM = {
  validate: function (v) {
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
  ALERT_EXTRA_ITEMS: 'Це спеціальний кошик для акційного товару.Він діє лише для товару:\n"Ящик екстракту полісолодового (15бан./550г) в асортименті"\n\nНаразі у кошику є інші товари. Це порушує умови акції — будь ласка:\n✔ Видаліть зайві позиції або ✔ Оформіть їх окремим замовленням',
  LINK_TEXT_REMOVE: '❌ Видалити товар з кошика'
};

var lastAlertTime = 0;

// == Функции ==
function waitEcwid(callback) {
  if (typeof Ecwid !== 'undefined' && typeof Ecwid.OnAPILoaded !== 'undefined') {
    callback();
  } else {
    setTimeout(() => waitEcwid(callback), 100);
  }
}

function updateQuantityText() {
  const hasBoxProduct = Array.from(document.querySelectorAll('.ec-cart-item__title'))
    .some(el => el.textContent.trim() === MSG.PRODUCT_TITLE);

  if (!hasBoxProduct) return;

  document.querySelectorAll('.form-control__select-text').forEach(el => {
    if (el.textContent.includes(':') && !el.textContent.includes('ящиків')) {
      el.innerHTML = el.textContent.replace(':', `${MSG.BOX_TEXT}:`);
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
    if (title && title.textContent.trim() === MSG.PRODUCT_TITLE) {
      productFound = true;
      item.querySelectorAll('.ec-cart-option--value').forEach(option => {
        const value = parseInt(option.textContent.trim().match(/\d+/), 10);
        total += isNaN(value) ? 0 : value;
      });

      const checkbox = document.getElementById('form-control__checkbox--agree');
      const isValid = QVM.validate(total | 0);
      if (checkbox) checkbox.disabled = !isValid;

      if (!isValid) {
        shouldShowAlert = true;
        let optionsDiv = item.querySelector('.ec-cart-item__options.ec-text-muted');
        if (optionsDiv && !optionsDiv.nextElementSibling?.classList?.contains('ec-form__title')) {
          const linkDiv = document.createElement('div');
          linkDiv.className = 'ec-form__title ec-header-h6';
          linkDiv.innerHTML = `
            <div class="marker-required marker-required--medium marker-required--active"></div>
            <a href="${MSG.PRODUCT_URL}" target="_self" style="color: red; font-weight: bold;">
              ${MSG.LINK_TEXT}
            </a>
          `;
          const link = linkDiv.querySelector('a');
          link.addEventListener('click', function (e) {
            e.preventDefault();
            Ecwid.Cart.clear();
            setTimeout(() => {
              window.location.href = this.href;
            }, 200);
          });
          optionsDiv.parentNode.insertBefore(linkDiv, optionsDiv.nextSibling);
        }
      } else {
        const warningDiv = item.querySelector('.ec-cart-item__options.ec-text-muted + .ec-form__title');
        if (warningDiv) {
          warningDiv.remove();
        }
      }
    }
  });

  if (shouldShowAlert && Date.now() - lastAlertTime > 5000) {
    alert(MSG.ALERT);
    lastAlertTime = Date.now();
  }

  if (!productFound) {
    document.querySelectorAll('.ec-form__title.ec-header-h6').forEach(el => {
      if (el.querySelector('a')?.textContent === MSG.LINK_TEXT) {
        el.remove();
      }
    });
  }
}

function checkExtraItems() {
  const items = document.querySelectorAll('.ec-cart-item__wrap-primary');
  const itemTitles = Array.from(items).map(el => el.querySelector('.ec-cart-item__title')?.textContent.trim());
  const hasBoxProduct = itemTitles.includes(MSG.PRODUCT_TITLE);

  if (!hasBoxProduct) return;

  const extraItems = Array.from(items).filter(el => {
    const title = el.querySelector('.ec-cart-item__title')?.textContent.trim();
    return title && title !== MSG.PRODUCT_TITLE;
  });

  // 🔒 Блокировка чекбокса, если есть лишние товары
  const checkbox = document.getElementById('form-control__checkbox--agree');
  if (checkbox) {
    checkbox.disabled = extraItems.length > 0;
  }

  extraItems.forEach(item => {
    if (!item.querySelector('.ec-remove-link-marker')) {
      const linkDiv = document.createElement('div');
      linkDiv.className = 'ec-form__title ec-header-h6 ec-remove-link-marker';
      linkDiv.innerHTML = `
        <div class="marker-required marker-required--medium marker-required--active"></div>
        <a href="#" target="_self" style="color: red; font-weight: bold;">
          ${MSG.LINK_TEXT_REMOVE}
        </a>
      `;
      const removeLink = linkDiv.querySelector('a');
      removeLink.addEventListener('click', function (e) {
        e.preventDefault();
        const removeButton = item.querySelector('.ec-cart-item__control-inner');
        if (removeButton) removeButton.click();
      });

      item.appendChild(linkDiv);
    }
  });

  if (extraItems.length > 0 && Date.now() - lastAlertTime > 5000) {
    alert(MSG.ALERT_EXTRA_ITEMS);
    lastAlertTime = Date.now();
  }
}


// == Подключение ==
waitEcwid(() => {
  Ecwid.OnAPILoaded.add(() => {
    Ecwid.OnCartChanged.add(function () {
      setTimeout(() => {
        updateQuantityText();
        validateCartItems();
        checkExtraItems();
      }, 300);
    });

    Ecwid.OnPageLoaded.add(page => {
      if (page.type === "CART") {
        setTimeout(() => {
          updateQuantityText();
          validateCartItems();
          checkExtraItems();
        }, 500);
      }
    });
  });
});
