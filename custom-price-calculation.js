function waitEcwid(callback) {
  if (typeof Ecwid !== 'undefined' && typeof Ecwid.OnAPILoaded !== 'undefined') {
    callback();
  } else {
    setTimeout(() => waitEcwid(callback), 100);
  }
}

waitEcwid(() => {
  Ecwid.OnAPILoaded.add(() => {
    Ecwid.OnPageLoaded.add(page => {
      if (page.type === 'PRODUCT') {
        console.log('[DEBUG] Product page loaded. Initializing custom pricing...');
        initCustomPricing();
      }
    });
  });
});

function initCustomPricing() {
  const FIXED_WIDTH_MM = 1210;
  const BASE_PRICE_PER_SQM = 22;

  function getEnteredLength() {
    const input = document.querySelector('input[name*="Длина в мм"], input[name*="Length in mm"]');
    if (!input) {
      console.warn('[DEBUG] Длина: поле не найдено');
      return 0;
    }
    const value = parseFloat(input.value);
    const valid = value >= 1000 && value <= 12000;
    console.log('[DEBUG] Parsed length:', value, '| Valid:', valid);
    return valid ? value : 0;
  }

  function getSelectedThicknessSurcharge() {
    const select = document.querySelector('select[name*="Толщина"], select[name*="Thickness"]');
    if (!select) {
      console.warn('[DEBUG] Толщина: поле не найдено');
      return 0;
    }

    const selectedOption = select.options[select.selectedIndex];
    const surchargeText = selectedOption.textContent.match(/\+?([0-9.,]+)/);
    const surcharge = surchargeText ? parseFloat(surchargeText[1].replace(',', '.')) : 0;

    console.log('[DEBUG] Толщина выбрана:', selectedOption.textContent, '| Наценка:', surcharge);
    return surcharge;
  }

  function calculatePrice() {
    console.log('[DEBUG] calculatePrice() called');

    const lengthMm = getEnteredLength();
    const thicknessSurcharge = getSelectedThicknessSurcharge();

    if (lengthMm === 0) {
      Ecwid.setProductPrice(1);
      renderPriceInfo(null);
      console.warn('[DEBUG] Invalid or missing length. Price reset to 1.');
      return;
    }

    const widthM = FIXED_WIDTH_MM / 1000;
    const lengthM = lengthMm / 1000;
    const areaSqM = +(widthM * lengthM).toFixed(3);
    const basePrice = +(areaSqM * BASE_PRICE_PER_SQM).toFixed(2);
    const surcharge = +(areaSqM * thicknessSurcharge).toFixed(2);
    const finalPrice = +(basePrice + surcharge).toFixed(2);

    Ecwid.setProductPrice(finalPrice);
    console.log(`[DEBUG] Final Price Set: ${finalPrice}€`);

    renderPriceInfo({
      widthM,
      lengthM,
      areaSqM,
      basePrice,
      surcharge,
      finalPrice
    });
  }

  function renderPriceInfo(data) {
    let infoElement = document.getElementById('custom-price-calculation');
    if (!infoElement) {
      infoElement = document.createElement('div');
      infoElement.id = 'custom-price-calculation';
      infoElement.style.marginTop = '20px';
      infoElement.style.padding = '12px';
      infoElement.style.border = '1px solid #ccc';
      infoElement.style.borderRadius = '6px';
      infoElement.style.background = '#f9f9f9';
      infoElement.style.fontSize = '14px';
      infoElement.style.lineHeight = '1.6';
      document.querySelector('.ecwid-productDetails__right')?.appendChild(infoElement);
    }

    if (!data) {
      infoElement.innerHTML = '<span style="color: red;">Введите корректную длину от 1000 до 12000 мм</span>';
      return;
    }

    infoElement.innerHTML = `
      <strong>Расчёт цены:</strong><br>
      Площадь: ${data.widthM} м × ${data.lengthM} м = <b>${data.areaSqM} м²</b><br>
      Базовая цена: ${data.areaSqM} м² × 22 €/м² = <b>${data.basePrice.toFixed(2)} €</b><br>
      Наценка за толщину: ${data.areaSqM} м² × ${getSelectedThicknessSurcharge().toFixed(2)} € = <b>${data.surcharge.toFixed(2)} €</b><br>
      <hr style="margin: 6px 0;">
      <b>Итоговая цена: ${data.finalPrice.toFixed(2)} €</b>
    `;
  }

  // Подключаем слушателей
  document.addEventListener('change', e => {
    if (
      e.target.name?.includes('Толщина') ||
      e.target.name?.includes('Thickness') ||
      e.target.name?.includes('Длина') ||
      e.target.name?.includes('Length')
    ) {
      console.log('[DEBUG] Изменение поля:', e.target.name);
      calculatePrice();
    }
  });

  document.addEventListener('input', e => {
    if (
      e.target.name?.includes('Длина') ||
      e.target.name?.includes('Length')
    ) {
      console.log('[DEBUG] Ввод длины:', e.target.value);
      calculatePrice();
    }
  });

  // Первый запуск
  setTimeout(() => {
    console.log('[DEBUG] Initial price calculation triggered');
    calculatePrice();
  }, 600);
}

