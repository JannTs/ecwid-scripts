// == Константы ==
const CART_PRODUCT_TITLE = 'Ящик екстракту полісолодового (15бан./550г) в асортименті:';
const BULK_PRODUCT_TITLE = 'Полісол™ (опт)';
const BULK_PRODUCT_URL = '/Polisol-tm-opt-p747565531';
const BULK_NOTICE_ID = 'bulk-validation-notice';

// == Обёртка ожидания Ecwid API ==
function waitEcwid(callback) {
  if (typeof Ecwid !== 'undefined' && typeof Ecwid.OnAPILoaded !== 'undefined') {
    callback();
  } else {
    setTimeout(() => waitEcwid(callback), 100);
  }
}

// == ROUTER == //
function detectCartTrigger() {
  const container = document.querySelector('.ec-cart__sidebar-inner');
  if (!container) return null;

  const firstTitle = container.querySelector('.ec-cart-item__title')?.textContent.trim();
  if (firstTitle === CART_PRODUCT_TITLE) return 'cart';
  if (firstTitle === BULK_PRODUCT_TITLE) return 'bulk';

  return null;
}

function isMixedTriggersPresent() {
  const titles = Array.from(document.querySelectorAll('.ec-cart-item__title')).map(el => el.textContent.trim());
  return (
    titles.includes(CART_PRODUCT_TITLE) &&
    titles.includes(BULK_PRODUCT_TITLE)
  );
}

function renderMixedError() {
  const container = document.querySelector('.ec-cart__products-inner');
  if (!container || document.getElementById('mixed-trigger-warning')) return;

  const msg = document.createElement('div');
  msg.id = 'mixed-trigger-warning';
  msg.style.color = 'darkred';
  msg.style.fontWeight = 'bold';
  msg.style.margin = '12px 0';
  msg.style.fontSize = '14px';
  msg.innerHTML = `
    ⚠️ У кошику не можна одночасно мати два акційні товари:<br>
    • “Ящик екстракту...” та “Полісол™ (опт)”<br>
    <span style="color: gray;">Видаліть один з них, щоб продовжити оформлення замовлення.</span>
  `;
  container.appendChild(msg);

  const checkbox = document.getElementById('form-control__checkbox--agree');
  if (checkbox) checkbox.disabled = true;
}

// == CART-CHECK == //
function validateCartItems() {
  // Заглушка: тут должен быть ваш код из cart-check.js
}

function checkExtraItems() {
  // Заглушка: ваш код для проверки других товаров в cart-check.js
}

function disableCartControls() {
  // Заглушка: ваш код блокировки купона/кнопки cart-check.js
}

function initControlInterceptors() {
  // Заглушка: перехватчики событий cart-check.js
}

function addDomNoticeForBlockedOptions() {
  // Заглушка: DOM-подсказка cart-check.js
}

function disableCouponPlaceholderText() {
  // Заглушка: смена плейсхолдера cart-check.js
}

// == BULK-CHECK == //
function getBulkSize(item) {
  const option = item.querySelector('.ec-cart-option--value');
  const match = option?.textContent.match(/=\\s*(\\d+)\\s*банок/);
  return match ? parseInt(match[1], 10) : 0;
}

function getAllBulkSizes() {
  return Array.from(document.querySelectorAll('.ec-cart-item__wrap-primary'))
    .filter(item => item.querySelector('.ec-cart-item__title')?.textContent.trim() === BULK_PRODUCT_TITLE)
    .map(getBulkSize)
    .filter(v => v > 0);
}

function hasUniformBulkSize() {
  const sizes = getAllBulkSizes();
  return sizes.length > 0 && sizes.every(s => s === sizes[0]);
}

function getTotalJarCount() {
  return Array.from(document.querySelectorAll('.ec-cart-item__wrap-primary'))
    .filter(item => item.querySelector('.ec-cart-item__title')?.textContent.trim() === BULK_PRODUCT_TITLE)
    .reduce((sum, item) => {
      const countText = item.closest('.ec-cart-item__wrap')?.querySelector('.form-control__select-text')?.textContent;
      const count = parseInt(countText?.match(/\\d+/)?.[0], 10);
      return sum + (isNaN(count) ? 0 : count);
    }, 0);
}

function hasExtraItemsInCart() {
  const allItems = Array.from(document.querySelectorAll('.ec-cart-item__title')).map(el => el.textContent.trim());
  return allItems.some(title => title !== BULK_PRODUCT_TITLE);
}

function renderBulkValidationNotice(isValid, sameSize, sum, size, noExtraItems) {
  const container = document.querySelector('.ec-cart__products-inner');
  if (!container) return;

  let existing = document.getElementById(BULK_NOTICE_ID);
  if (existing) existing.remove();

  if (isValid) return;

  const msg = document.createElement('div');
  msg.id = BULK_NOTICE_ID;
  msg.style.color = 'red';
  msg.style.fontWeight = 'bold';
  msg.style.margin = '12px 0';
  msg.style.fontSize = '14px';
  msg.innerHTML = `
    ⚠️ Помилка формування партії:<br>
    ${!sameSize ? '• Усі позиції повинні мати однакову кількість банок (наприклад, "30 банок")<br>' : ''}
    ${(sum !== size) ? `• Сума банок (${sum}) не дорівнює обсягу партії (${size})<br>` : ''}
    ${!noExtraItems ? '• У кошику є зайві товари, окрім акційного<br>' : ''}
    <a href="${BULK_PRODUCT_URL}" class="ec-link" style="color: blue;">➕ Додати ще до партії</a>
  `;
  container.appendChild(msg);
}

function validateBulkCart() {
  const checkbox = document.getElementById('form-control__checkbox--agree');
  const sameSize = hasUniformBulkSize();
  const bulkSize = getAllBulkSizes()[0] || 0;
  const sum = getTotalJarCount();
  const noExtraItems = !hasExtraItemsInCart();

  const isValid = sameSize && (sum === bulkSize) && noExtraItems;

  if (checkbox) checkbox.disabled = !isValid;
  renderBulkValidationNotice(isValid, sameSize, sum, bulkSize, noExtraItems);
}

// == ROUTER WRAPPER ==
function handleTriggerRouting() {
  if (isMixedTriggersPresent()) {
    renderMixedError();
    return;
  }

  const trigger = detectCartTrigger();

  if (trigger === 'cart') {
    validateCartItems();
    checkExtraItems();
    disableCartControls();
    initControlInterceptors();
    addDomNoticeForBlockedOptions();
    disableCouponPlaceholderText();
  } else if (trigger === 'bulk') {
    validateBulkCart();
  }
}

// == Подключение ==
waitEcwid(() => {
  Ecwid.OnAPILoaded.add(() => {
    Ecwid.OnCartChanged.add(() => {
      setTimeout(() => {
        handleTriggerRouting();
      }, 300);
    });

    Ecwid.OnPageLoaded.add(page => {
      if (page.type === 'CART') {
        setTimeout(() => {
          handleTriggerRouting();
        }, 500);
      }
    });
  });
});
