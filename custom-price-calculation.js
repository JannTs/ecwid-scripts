// == Custom Dynamic Pricing for Ecwid Product with Debug Logs ==
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
        initCustomPricing(page);
      }
    });
  });
});

function initCustomPricing(page) {
  const ec = Ecwid;
  const productId = page.productId;

  const FIXED_WIDTH_MM = 1210;
  const BASE_PRICE_PER_SQM = 22;

  function getEnteredLength() {
    let value =
      ec.getProductOptionValue(productId, 'Длина в мм') ||
      ec.getProductOptionValue(productId, 'Length in mm');

    if (!value) {
      console.warn('[DEBUG] Длина не введена');
      return 0;
    }

    value = parseFloat(value);
    const valid = value >= 1000 && value <= 12000;

    console.log('[DEBUG] Parsed length:', value, '| Valid:', valid);
    return valid ? value : 0;
  }

  function getSelectedThicknessSurcharge() {
    let selectedOption =
      ec.getSelectedOption(productId, 'Толщина') ||
      ec.getSelectedOption(productId, 'Thickness');

    if (selectedOption && selectedOption.surcharge) {
      const surcharge = parseFloat(selectedOption.surcharge);
      console.log('[DEBUG] Surcharge from thickness:', surcharge);
      return surcharge;
    }

    console.log('[DEBUG] No surcharge (0)');
    return 0;
  }

  function calculatePrice() {
    console.log('[DEBUG] calculatePrice() called');

    const lengthMm = getEnteredLength();
    const thicknessSurcharge = getSelectedThicknessSurcharge();

    if (lengthMm === 0) {
      ec.setProductPrice(productId, 1);
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

    ec.setProductPrice(productId, finalPrice);

    console.log(`[DEBUG] Width: ${widthM}m, Length: ${lengthM}m, Area: ${areaSqM}m²`);
    console.log(`[DEBUG] Base: ${basePrice}€, Surcharge: ${surcharge}€, Final: ${finalPrice}€`);

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
      infoElement.innerHTML = '<span style="color: red;">Пожалуйста, введите корректную длину от 1000 до 12000 мм.</span>';
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

  // Проверяем наличие слушателя изменений опций
  if (ec.OnOptionChanged && typeof ec.OnOptionChanged.add === 'function') {
    ec.OnOptionChanged.add(option => {
      console.log('[DEBUG] Option changed:', option.optionName);
      if (['Длина в мм', 'Length in mm', 'Толщина', 'Thickness'].includes(option.optionName)) {
        calculatePrice();
      }
    });
  } else {
    console.warn('[DEBUG] Ecwid.OnOptionChanged не доступен.');
  }

  // Запускаем расчет после загрузки
  setTimeout(() => {
    console.log('[DEBUG] Initial price calculation triggered');
    calculatePrice();
  }, 500);
}

