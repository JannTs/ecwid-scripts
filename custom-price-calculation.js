// == Custom Dynamic Pricing for Length × Thickness ==
// Назначение: рассчитывает стоимость по м² с учётом введённой длины и выбранной толщины

// == Custom Dynamic Pricing for Ecwid Product ==
// Назначение: рассчитывает цену на основе длины (ввод пользователя), толщины (опция) и фиксированной ширины 1210 мм

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
        initCustomPricing(page); // ✅ передаём page
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
    let value = ec.getProductOptionValue(productId, 'Длина в мм') || ec.getProductOptionValue(productId, 'Length in mm');
    value = parseFloat(value);
    return (value >= 1000 && value <= 12000) ? value : 0;
  }

  function getSelectedThicknessSurcharge() {
    let selectedOption = ec.getSelectedOption(productId, 'Толщина') || ec.getSelectedOption(productId, 'Thickness');
    if (selectedOption && selectedOption.surcharge) {
      return parseFloat(selectedOption.surcharge);
    }
    return 0;
  }

  function calculatePrice() {

    console.log('[DEBUG] calculatePrice called');
    let lengthMm = getEnteredLength();
    let thicknessSurcharge = getSelectedThicknessSurcharge();

    if (lengthMm === 0) {
      ec.setProductPrice(productId, 1); // fallback
      renderPriceInfo(null); // очистить блок
      return;
    }

    let widthM = FIXED_WIDTH_MM / 1000;
    let lengthM = lengthMm / 1000;
    let areaSqM = +(widthM * lengthM).toFixed(3);

    let basePrice = areaSqM * BASE_PRICE_PER_SQM;
    let surcharge = areaSqM * thicknessSurcharge;
    let finalPrice = +(basePrice + surcharge).toFixed(2);

    ec.setProductPrice(productId, finalPrice);
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
      infoElement.innerHTML = '';
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

  ec.OnOptionChanged.add(option => {
    if (['Длина в мм', 'Length in mm', 'Толщина', 'Thickness'].inclu
