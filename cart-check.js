// == Константы ==
var MSG = {
  BOX_TEXT: '&nbsp;ящиків'
};

// == Функции ==
function waitEcwid(callback) {
  if (typeof Ecwid !== 'undefined' && typeof Ecwid.OnAPILoaded !== 'undefined') {
    callback();
  } else {
    setTimeout(() => waitEcwid(callback), 100);
  }
}

function modifyBoxText() {
  const items = document.querySelectorAll('.ec-cart-item__wrap-primary');

  items.forEach(item => {
    const textEl = item.querySelector('.form-control__select-text');
    if (!textEl) return;

    if (textEl.textContent.includes(':') && !textEl.textContent.includes('ящиків')) {
      textEl.innerHTML = textEl.textContent.replace(':', `${MSG.BOX_TEXT}:`);
    }
  });
}

// == Подключение ==
waitEcwid(() => {
  Ecwid.OnAPILoaded.add(() => {

    Ecwid.OnCartChanged.add(() => {
      setTimeout(() => {
        modifyBoxText();
      }, 300);
    });

    Ecwid.OnPageLoaded.add(page => {
      if (page.type === "CART") {
        setTimeout(() => {
          modifyBoxText();
        }, 500);
      }
    });

  });
});
