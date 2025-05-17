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

window.addEventListener('beforeunload', () => {
  document.querySelectorAll('.custom-disabled-tooltip').forEach(t => t.remove());
});

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

function disableCouponPlaceholderText() {
  const placeholder = document.querySelector('.ec-cart__coupon .form-control__placeholder-inner');

  if (placeholder && !placeholder.dataset.modified) {
    placeholder.textContent = '🔕 Тут код не діє';
    placeholder.dataset.modified = 'true'; // предотвратим повторную подмену
  }
}


function addDomNoticeForBlockedOptions() {
  const couponBlock = document.querySelector('.ec-cart__coupon.ec-cart-coupon');
  const shoppingBlock = document.querySelector('.ec-cart__shopping.ec-cart-shopping');
  const localizedMessage = '🔕 Ці опції тимчасово недоступні — кошик вже містить акційний товар.';

  // Добавить префикс к заголовкам
  const titleSpans = document.querySelectorAll('.ec-cart__coupon .ec-cart__title, .ec-cart__shopping .ec-cart__title');
  titleSpans.forEach(title => {
    if (!title.dataset.modified) {
      title.textContent = `🔕 ${title.textContent}`;
      title.dataset.modified = 'true';
    }
  });

  // Вставить пояснение после shoppingBlock (если еще не вставлено)
  if (shoppingBlock && !document.querySelector('.ec-disabled-options-note')) {
    const note = document.createElement('div');
    note.className = 'ec-disabled-options-note';
    note.textContent = localizedMessage;
    note.style.fontSize = '13px';
    note.style.color = '#888';
    note.style.marginTop = '8px';
    note.style.marginBottom = '12px';
    shoppingBlock.parentNode.insertBefore(note, shoppingBlock.nextSibling);
  }
}


function initControlInterceptors() {
  const message = MSG.DISABLED_CONTROL_HINT;

  const tryIntercept = () => {
    ['.ec-cart__coupon a', '.ec-cart__shopping a'].forEach(selector => {
      const link = document.querySelector(selector);
      if (link && !link.dataset.blocked) {
        link.dataset.blocked = 'true';
        link.style.cursor = 'not-allowed';

        // Самое важное: удаляем href, если можно
        link.setAttribute('href', 'javascript:void(0)');
        link.removeAttribute('onclick');

        // Tooltip
        link.addEventListener('mouseenter', () => showCustomTooltip(link, message));
        link.addEventListener('mouseleave', () => hideCustomTooltip(link));

        // На всякий случай — полный запрет действий
        link.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopImmediatePropagation();
          return false;
        });
      }
    });
  };

  // Первый запуск
  tryIntercept();

  // Следим за DOM (Ecwid может перерендерить корзину)
  const observer = new MutationObserver(() => tryIntercept());
  observer.observe(document.body, { childList: true, subtree: true });
}



function showCustomTooltip(target, message) {
  return; // 🔕 временно отключено
  const tooltip = document.createElement('div');
  tooltip.className = 'custom-disabled-tooltip';
  tooltip.textContent = message;
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

function disableCartControls() {
  const couponBlock = document.querySelector('.ec-cart__coupon.ec-cart-coupon');
  const shoppingBlock = document.querySelector('.ec-cart__shopping.ec-cart-shopping');
  const message = MSG.DISABLED_CONTROL_HINT;

  function setupLinkTooltip(block) {
    const link = block?.querySelector('a');
    if (link) {
      link.style.pointerEvents = 'auto';
      link.style.cursor = 'not-allowed';

      // Удаляем старый обработчик (если был)
      link.removeEventListener('click', link._preventClickHandler);

      // Блокируем клик
      const preventClickHandler = function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return false;
      };

      link.addEventListener('click', preventClickHandler);
      link._preventClickHandler = preventClickHandler;

      link.addEventListener('mouseenter', () => showCustomTooltip(link, message));
      link.addEventListener('mouseleave', () => hideCustomTooltip(link));
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
}

/**
 * Обновлённа логіка:
 * Увесь функціонал cart-check.js активується лише,
 * якщо у кошику явно присутній акційний товар: MSG.PRODUCT_TITLE.
 */
function isBoxProductInCart() {
  return Array.from(document.querySelectorAll('.ec-cart-item__title'))
    .some(el => el.textContent.trim() === MSG.PRODUCT_TITLE);
}


// == Подключение ==
waitEcwid(() => {
  Ecwid.OnAPILoaded.add(() => {

    Ecwid.OnCartChanged.add(() => {
      setTimeout(() => {
        if (!isBoxProductInCart()) return;

        updateQuantityText();
        validateCartItems();
        checkExtraItems();
        disableCartControls();
        initControlInterceptors();
        addDomNoticeForBlockedOptions();
        disableCouponPlaceholderText();
      }, 300);
    });

    Ecwid.OnPageLoaded.add(page => {
      if (page.type === "CART") {
        setTimeout(() => {
          if (!isBoxProductInCart()) return;

          updateQuantityText();
          validateCartItems();
          checkExtraItems();
          disableCartControls();
          initControlInterceptors();
          addDomNoticeForBlockedOptions();
          disableCouponPlaceholderText();
        }, 500);
      }
    });

  });
});


