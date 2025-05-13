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
  BOX_TEXT: '&nbsp;ящиків'
};

var lastAlertTime = 0; // Таймер последнего показа alert

function waitEcwid(c) {
  typeof Ecwid !== 'undefined' && typeof Ecwid.OnAPILoaded !== 'undefined' 
    ? c() 
    : setTimeout(() => waitEcwid(c), 100);
}

function updateQuantityText() {
  document.querySelectorAll('.form-control__select-text').forEach(el => {
    if(el.textContent.includes(':')) {
      el.innerHTML = el.textContent.replace(':', ${MSG.BOX_TEXT}:);
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
          linkDiv.innerHTML = 
            <div class="marker-required marker-required--medium marker-required--active"></div>
            <a href="${MSG.PRODUCT_URL}" target="_self" style="color: red; font-weight: bold;">
              ${MSG.LINK_TEXT}
            </a>
          ;

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

  // Показываем alert только при первом обнаружении ошибки
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

function setupCartWatcher() {
  Ecwid.OnCartChanged.add(function() {
    setTimeout(() => {
      updateQuantityText();
      validateCartItems();
    }, 300);
  });
}
 

waitEcwid(() => {
  Ecwid.OnAPILoaded.add(() => {
    setupCartWatcher();
    
    Ecwid.OnPageLoaded.add(page => {
      if(page.type === "CART") {
        setTimeout(() => {
          updateQuantityText();
          validateCartItems();
        }, 500);
      }
    });
  });
});
