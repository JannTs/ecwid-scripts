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
  ALERT_EXTRA_ITEMS: 'Це спеціальний кошик для акційного товару. Він діє лише для:\n"Ящик екстракту полісолодового (15бан./550г) в асортименті"\n\nОднак наразі у кошику є інші товари. Це порушує умови акції — будь ласка:\n✔ Видаліть зайві позиції або ✔ Оформіть їх окремим замовленням',
  LINK_TEXT_REMOVE: '❌ Видалити товар з кошика',
  DISABLED_CONTROL_HINT: 'Ця дія тимчасово недоступна при замовленні акційного товару.'
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

function showCustomTooltip(target, message) {
  const tooltip = document.createElement('div');
  tooltip.className = 'custom-disabled-tooltip';
  tooltip.textContent = message;

  // Базовые стили
  tooltip.style.position = 'absolute';
  tooltip.style.background = '#333';
  tooltip.style.color = '#fff';
  tooltip.style.padding = '6px 10px';
  tooltip.style.borderRadius = '4px';
  tooltip.style.fontSize = '13px';
  tooltip.style.whiteSpace = 'nowrap';
  tooltip.style.zIndex = '9999';
  tooltip.style.top = `${target.getBoundingClientRect().top + window.scrollY - 35}px`;
  tooltip.style.left = `${target.getBoundingClientRect().left + window.scrollX}px`;
  tooltip.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
  tooltip.style.pointerEvents = 'none';

  document.body.appendChild(tooltip);
  target._tooltip = tooltip;
}

function hideCustomTooltip(target) {
  if (target._tooltip) {
    document.body.removeChild(target._tooltip);
    delete target._tooltip;
  }
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

    const wrapContainer = item.closest('.ec-cart-item__wrap');
    if (wrapContainer) {
      const selectText = wrapContainer.querySelector('.form-control__select-text');
      if (selectText && selectText.textContent.includes('ящиків')) {
        selectText.innerHTML = selectText.innerHTML.replace('ящиків', '').replace(/\s+:/, ':');
      }
    }
  });

  if (extraItems.length > 0 && Date.now() - lastAlertTime > 5000) {
    alert(MSG.ALERT_EXTRA_ITEMS);
    lastAlertTime = Date.now();
  }
}

function addInfoIcon(target, message) {
  if (target && !target.nextElementSibling?.classList?.contains('disabled-info-icon-wrapper')) {
    const wrapper = document.createElement('div');
    wrapper.className = 'disabled-info-icon-wrapper';
    wrapper.style.display = 'inline-block';
    wrapper.style.marginLeft = '8px';

    const icon = document.createElement('span');
    icon.className = 'disabled-info-icon';
    icon.textContent = '❓';
    icon.title = message;
    icon.style.cursor = 'help';
    icon.style.color = 'red';
    icon.style.fontWeight = 'bold';
    icon.style.fontSize = '18px';

    wrapper.appendChild(icon);
    target.parentNode.insertBefore(wrapper, target.nextSibling);
  }
}


function disableCartControls() {
  const couponBlock = document.querySelector('.ec-cart__coupon.ec-cart-coupon');
  const shoppingBlock = document.querySelector('.ec-cart__shopping.ec-cart-shopping');
  const message = MSG.DISABLED_CONTROL_HINT;

  function setupLinkTooltip(block) {
    const link = block?.querySelector('a');
    if (link) {
      link.style.pointerEvents = 'auto';
      link.style.cursor = 'not-allowed';
      link.addEventListener('mouseenter', () => showCustomTooltip(link, message));
      link.addEventListener('mouseleave', () => hideCustomTooltip(link));
      link.addEventListener('click', (e) => e.preventDefault()); // 🚫 Блокируем переход
    }
  }

  if (couponBlock) {
    couponBlock.style.pointerEvents = 'none';
    couponBlock.style.opacity = '0.5';
    setupLinkTooltip(couponBlock);
  }

  if (shoppingBlock) {
    shoppingBlock.style.pointerEvents = 'none';
    shoppingBlock.style.opacity = '0.5';
    setupLinkTooltip(shoppingBlock);
  }

  // Удаление старого стиля, если есть
  const prevStyle = document.querySelector('#custom-disable-style');
  if (prevStyle) prevStyle.remove();
}




// == Подключение ==
waitEcwid(() => {
  Ecwid.OnAPILoaded.add(() => {
    Ecwid.OnCartChanged.add(function () {
      setTimeout(() => {
        updateQuantityText();
        validateCartItems();
        checkExtraItems();
        disableCartControls();
      }, 300);
    });

    Ecwid.OnPageLoaded.add(page => {
      if (page.type === "CART") {
        setTimeout(() => {
          updateQuantityText();
          validateCartItems();
          checkExtraItems();
          disableCartControls();
        }, 500);
      }
    });
  });
});
