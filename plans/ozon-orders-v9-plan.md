# План реализации: Ozon Order Copier v9

## Общая цель

Внести 5 изменений в userscript и Python-шаблон:
1. Адрес (Пункт выдачи) — повторять в каждой строке товара
2. Итоговая сумма — не учитывать отменённые заказы (`❌ Отменён`)
3. Новая колонка «Дата доставки» — из `header[1].textIcon.text.text` shipment widget (ожидаемая дата)
4. Статус оплаты — пропагировать с заказа на каждую строку товара
5. Новая колонка «Кол-во» — из `addToCartButton.action.quantity` (по умолчанию `1`)

## Источники данных (по результатам исследования)

| Данные | Источник | Уровень |
|--------|----------|:------:|
| `deliveryDate` | `header[1].textIcon.text.text` — текст вида «до 27 июля включительно», «Ожидаемая дата: 15 июля», «Ожидаемая дата: с 17 до 18 июля» | shipment |
| `qty` | `addToCartButton.action.quantity` (int), default `1` | product |
| `paymentStatus` | `.b5_7_0-a4` на карточке заказа (orderlist) — один на заказ | order |
| `pickupPoint` | `.dx0_11, .d0x_11` на карточке заказа (orderlist) — один на заказ | order |

## Итоговая структура колонок (10 шт.)

| № | Буква | Колонка | На каждой строке? | Источник |
|---|-------|---------|:---:|----------|
| 1 | A | Дата | ❌ только первая | `parseRussianDate(statusEl)` на карточке orderlist |
| 2 | B | № Заказа | ❌ только первая | URL карточки |
| 3 | C | Статус доставки | ✅ | `header[0].textIcon.text.text` (shipment) / карточка |
| 4 | D | Товары | ✅ | `title.name.text` (product) |
| 5 | E | **🆕 Кол-во** | ✅ | `addToCartButton.action.quantity` (product) |
| 6 | F | Сумма | ✅ | `price.price[0].text` (product) |
| 7 | G | Статус оплаты | ✅ | `.b5_7_0-a4` карточки orderlist (order-level) |
| 8 | H | Пункт выдачи | ✅ | `.dx0_11` карточки orderlist (order-level) |
| 9 | I | **🆕 Дата доставки** | ❌ только первая | `header[1].textIcon.text.text` (shipment) |
| 10 | J | Фото | ✅ | `picture.image.image` (product) |

---

## Файл 1: `ozon-orders-copier.user.js`

### Изменение 0 — Новая функция `parseDeliveryDate()` (добавить перед `fetchOrderDetails`)

**Вставить после строки 252** (после `parseRussianDate`):

```js
    // ============================================================
    // 4b. ПАРСИНГ ДАТЫ ДОСТАВКИ ИЗ HEADER[1] SHIPMENT WIDGET
    // ============================================================
    function parseDeliveryDate(text) {
        if (!text) return '';
        // Форматы:
        // "Из пункта выдачи Ozon, до 27 июля включительно"
        // "Ожидаемая дата: 15 июля"
        // "Ожидаемая дата: с 17 до 18 июля"
        let m = text.match(/до\s+(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i);
        if (m) {
            const day = m[1].padStart(2, '0');
            const month = MONTHS_RU[m[2].toLowerCase()] || '01';
            const year = new Date().getFullYear();
            return `${day}.${month}.${year}`;
        }
        // "Ожидаемая дата: 15 июля" или "Ожидаемая дата: с 17 до 18 июля"
        m = text.match(/ожидаемая\s+дата[:\s]+(?:с\s+)?(\d{1,2})\s+(?:до\s+\d{1,2}\s+)?(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i);
        if (m) {
            const day = m[1].padStart(2, '0');
            const month = MONTHS_RU[m[2].toLowerCase()] || '01';
            const year = new Date().getFullYear();
            return `${day}.${month}.${year}`;
        }
        return '';
    }
```

---

### Изменение 1.1 — `fetchOrderDetails()` — извлечение `qty` + `deliveryDate`

**Файл:** `ozon-orders-copier.user.js`
**Строки:** ~393–461 (вся функция)

**Новый код функции:**

```js
    async function fetchOrderDetails(orderNumber, signal) {
        try {
            const url = `/my/orderdetails/?order=${orderNumber}`;
            const resp = await fetch(url, { signal, credentials: 'include' });
            if (!resp.ok) return [];

            const html = await resp.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Ищем shipmentWidget-ы — каждый содержит товары одной отправки
            const shipmentWidgets = doc.querySelectorAll('[id*="shipmentWidget"]');
            const allItems = [];

            shipmentWidgets.forEach(el => {
                try {
                    const raw = el.getAttribute('data-state') || '';
                    if (!raw) return;
                    const json = JSON.parse(raw);

                    // Статус этой отправки: header[0].textIcon.text.text
                    let shipmentStatus = '';
                    try {
                        shipmentStatus = json.header[0].textIcon.text.text || '';
                    } catch(e) {}

                    // Дата доставки: header[1].textIcon.text.text (может отсутствовать у отменённых)
                    let deliveryDate = '';
                    try {
                        const rawDate = json.header[1].textIcon.text.text || '';
                        deliveryDate = parseDeliveryDate(rawDate);
                    } catch(e) {}

                    // Товары в этой отправке
                    const items = json.items || [];
                    items.forEach(item => {
                        const sellers = item.sellers || [];
                        sellers.forEach(seller => {
                            const products = seller.products || [];
                            products.forEach(p => {
                                const name = p.title?.name?.text;
                                if (!name || name.length < 3 || name.length > 300) return;

                                // Цена: price.price[0].text
                                let price = '';
                                try {
                                    price = parsePrice(p.price.price[0].text);
                                } catch(e) {}

                                // Количество: addToCartButton.action.quantity
                                let qty = '1';
                                try {
                                    const rawQty = p.addToCartButton?.action?.quantity;
                                    if (rawQty !== undefined && rawQty !== null) {
                                        const n = parseInt(rawQty, 10);
                                        if (!isNaN(n) && n > 0) qty = n.toString();
                                    }
                                } catch(e) {}

                                // Фото: picture.image.image
                                let picture = '';
                                try {
                                    picture = p.picture.image.image || '';
                                } catch(e) {}

                                allItems.push({
                                    name: name,
                                    price: price,
                                    qty: qty,
                                    shipmentStatus: normalizeStatus(shipmentStatus),
                                    deliveryDate: deliveryDate,
                                    picture: picture
                                });
                            });
                        });
                    });
                } catch(e) {
                    // Пропускаем не JSON или не ту структуру
                }
            });

            return allItems;
        } catch(e) {
            if (e.name === 'AbortError') return [];
            console.warn(`[Ozon Copier] fetch error for ${orderNumber}:`, e);
            return [];
        }
    }
```

**Что изменилось:**
- Добавлен парсинг `deliveryDate` из `header[1].textIcon.text.text` через новую `parseDeliveryDate()`
- `qty` берётся из `p.addToCartButton?.action?.quantity` (а не `p.quantity`)
- Поле `deliveryDate` добавлено в каждый `allItems.push(...)`

---

### Изменение 1.2 — `formatTSV()` — новая структура 10 колонок

**Файл:** `ozon-orders-copier.user.js`
**Строки:** 484–569

#### 1.2a — Заголовки (строки 488–497)

**Новый код:**
```js
        const headers = [
            'Дата',
            '№ Заказа',
            'Статус',
            'Товары',
            'Кол-во',
            'Сумма',
            'Статус оплаты',
            'Пункт выдачи',
            'Дата доставки',
            'Фото'
        ];
```

#### 1.2b — fallback-элемент (строка 508)

**Новый код:**
```js
            const displayItems = hasItems ? o.items : [{ name: '', price: '', qty: '1', shipmentStatus: '', deliveryDate: '', picture: '' }];
```

#### 1.2c — grandTotal с исключением отменённых (строки 510–517)

```js
            // Сумма по заказу (только для итоговой строки)
            // Отменённые заказы не учитываются в общей сумме
            const isCancelled = o.deliveryStatus === '❌ Отменён';
            const orderTotal = hasItems
                ? o.items.reduce((s, item) => {
                    const p = parseFloat((item.price || '').replace(',', '.'));
                    return s + (isNaN(p) ? 0 : p);
                }, 0)
                : parseFloat((o.fallbackAmount || '').replace(',', '.'));
            if (!isNaN(orderTotal) && !isCancelled) grandTotal += orderTotal;
```

#### 1.2d — Рендер строк товаров (строки 522–556)

**Новый код:**
```js
            displayItems.forEach((item, idx) => {
                const name = item.name || '';
                const price = hasItems ? (item.price || '') : '';
                const qty = item.qty || '1';
                const picture = item.picture || '';
                const deliveryDate = (idx === 0 && item.deliveryDate) ? "'" + item.deliveryDate : '';
                const displayStatus = (idx === 0) ? o.deliveryStatus : (item.shipmentStatus || '');

                if (idx === 0) {
                    tsv += [
                        dateText,           // A: Дата
                        o.orderNumber,      // B: № Заказа
                        displayStatus,      // C: Статус доставки
                        name,               // D: Товары
                        qty,                // E: Кол-во (🆕)
                        price,              // F: Сумма
                        o.paymentStatus,    // G: Статус оплаты (теперь на каждой строке)
                        o.pickupPoint,      // H: Пункт выдачи (теперь на каждой строке)
                        deliveryDate,       // I: Дата доставки (🆕, из shipment)
                        picture             // J: Фото
                    ].join(sep) + '\n';
                } else {
                    tsv += [
                        '',
                        '',
                        displayStatus,
                        name,
                        qty,
                        price,
                        o.paymentStatus,    // G: на каждой строке
                        o.pickupPoint,      // H: на каждой строке
                        '',                 // I: только на первой строке
                        picture
                    ].join(sep) + '\n';
                }
                totalRows++;
            });
```

> **Примечание:** `deliveryDate` выводится только на первой строке заказа (`idx === 0`) — это сознательное ограничение, а не баг. Если в заказе несколько shipment widget'ов, берётся дата из первого виджета.

#### 1.2e — Итоговая строка (строки 559–566)

```js
        // Итоги
        if (orders.length > 0) {
            tsv += '\n';
            tsv += ['', '', '', '', '', '', '', '', '', ''].join(sep) + '\n';
            const grandTotalStr = isNaN(grandTotal) ? '' :
                (grandTotal % 1 === 0 ? grandTotal.toString() : grandTotal.toFixed(2).replace('.', ','));
            tsv += ['ИТОГО:', orders.length + ' заказов, ' + totalRows + ' позиций', '', '', '', grandTotalStr, '', '', '', ''].join(sep) + '\n';
        }
```

---

### Изменение 1.3 — `showPreview()` — исключение отменённых из grandTotal

**Строки:** 592–598

```js
            const isCancelled = o.deliveryStatus === '❌ Отменён';
            const orderTotal = hasItems
                ? o.items.reduce((s, item) => {
                    const p = parseFloat((item.price || '').replace(',', '.'));
                    return s + (isNaN(p) ? 0 : p);
                }, 0)
                : parseFloat((o.fallbackAmount || '').replace(',', '.'));
            if (!isNaN(orderTotal) && !isCancelled) grandTotal += orderTotal;
```

---

### Изменение 1.4 — `downloadXLSX()` — новая структура 10 колонок

#### 1.4a — Заголовки (строка 883)

```js
            const headers = ['Дата', '№ Заказа', 'Статус', 'Товары', 'Кол-во', 'Сумма', 'Статус оплаты', 'Пункт выдачи', 'Дата доставки', 'Фото'];
```

#### 1.4b — Ширина колонок (строки 897–906)

```js
            ws.columns = [
                { width: 14 },   // A: Дата
                { width: 20 },   // B: № Заказа
                { width: 24 },   // C: Статус доставки
                { width: 55 },   // D: Товары
                { width: 10 },   // E: Кол-во (🆕)
                { width: 13 },   // F: Сумма
                { width: 22 },   // G: Статус оплаты
                { width: 28 },   // H: Пункт выдачи
                { width: 16 },   // I: Дата доставки (🆕)
                { width: 18 }    // J: Фото
            ];
```

#### 1.4c — fallback-элемент (строка 917)

```js
                const displayItems = hasItems ? o.items : [{ name: '', price: '', qty: '1', shipmentStatus: '', deliveryDate: '', picture: '' }];
```

#### 1.4d — Рендер данных (строки 920–974)

```js
                displayItems.forEach((item, idx) => {
                    const name = item.name || '';
                    const price = hasItems ? (() => { const v = String(item.price || '').replace(',', '.'); const n = parseFloat(v); return isNaN(n) ? (item.price || '') : n; })() : '';
                    const qty = item.qty || '1';
                    const picture = item.picture || '';
                    const deliveryDate = (idx === 0 && item.deliveryDate) ? "'" + item.deliveryDate : '';
                    const displayStatus = (idx === 0) ? o.deliveryStatus : (item.shipmentStatus || '');

                    if (idx === 0) {
                        ws.getCell(row, 1).value = dateText;
                        ws.getCell(row, 2).value = o.orderNumber;
                        ws.getCell(row, 3).value = displayStatus;
                        ws.getCell(row, 4).value = name;
                        ws.getCell(row, 5).value = qty;
                        ws.getCell(row, 6).value = price;
                        ws.getCell(row, 7).value = o.paymentStatus;
                        ws.getCell(row, 8).value = o.pickupPoint;
                        ws.getCell(row, 9).value = deliveryDate;
                    } else {
                        ws.getCell(row, 3).value = displayStatus;
                        ws.getCell(row, 4).value = name;
                        ws.getCell(row, 5).value = qty;
                        ws.getCell(row, 6).value = price;
                        ws.getCell(row, 7).value = o.paymentStatus;
                        ws.getCell(row, 8).value = o.pickupPoint;
                    }

                    // Вставляем картинку в колонку J (col=9, 0-based)
                    if (picture && imageCache.has(picture)) {
                        const cached = imageCache.get(picture);
                        try {
                            const imageId = workbook.addImage({
                                buffer: cached.buffer,
                                extension: cached.extension
                            });
                            ws.addImage(imageId, {
                                tl: { col: 9, row: row - 1 },
                                ext: { width: IMG_HEIGHT, height: IMG_HEIGHT },
                                editAs: 'oneCell'
                            });
                            ws.getRow(row).height = IMG_HEIGHT * 0.75;
                        } catch(e) {
                            console.warn('[Ozon Copier] Ошибка вставки картинки:', e);
                            ws.getCell(row, 10).value = picture;
                        }
                    } else if (picture && !imageCache.has(picture)) {
                        ws.getCell(row, 10).value = picture;
                    }

                    // Стили для строки (10 колонок)
                    for (let c = 1; c <= 10; c++) {
                        const cell = ws.getCell(row, c);
                        cell.border = {
                            top: { style: 'thin' }, bottom: { style: 'thin' },
                            left: { style: 'thin' }, right: { style: 'thin' }
                        };
                        cell.alignment = { vertical: 'middle', wrapText: true };
                    }

                    row++;
                });
```

#### 1.4e — Автофильтр (строка 978)

```js
            ws.autoFilter = { from: 'A1', to: `J${row - 1}` };
```

#### 1.4f — Итоговая строка с формулой SUMIF (вставить после автофильтра)

```js
            // Итоговая строка с формулой SUMIF (не учитывает отменённые)
            const summaryRow = row + 1;
            ws.getCell(summaryRow, 5).value = 'ИТОГО (без отмен):';
            ws.getCell(summaryRow, 5).font = { bold: true };
            ws.getCell(summaryRow, 6).value = {
                formula: `SUMIF(C2:C${row - 1},"<>❌ Отменён",F2:F${row - 1})`
            };
            ws.getCell(summaryRow, 6).font = { bold: true };
            ws.getCell(summaryRow, 6).numFormat = '#,##0.00';
            for (let c = 1; c <= 10; c++) {
                ws.getCell(summaryRow, c).border = {
                    top: { style: 'medium' }, bottom: { style: 'thin' },
                    left: { style: 'thin' }, right: { style: 'thin' }
                };
            }
```

> **Примечание:** метка «ИТОГО (без отмен)» размещается в колонке E — это ближайшая свободная ячейка слева от формулы `SUMIF` в колонке F. Колонка E в итоговой строке не содержит числовых данных, поэтому такое размещение корректно и не нарушает структуру.

---

## Файл 2: `generate_template.py`

### Изменение 2.1 — COLUMNS

```python
COLUMNS = [
    ("Дата", 14),
    ("№ Заказа Ozon", 18),
    ("Статус доставки", 24),
    ("Товары", 50),
    ("Кол-во", 10),
    ("Сумма", 12),
    ("Статус оплаты", 22),
    ("Пункт выдачи", 28),
    ("Дата доставки", 16),
    ("Фото", 40),
    ("Примечание", 30),
]
```

### Изменение 2.2 — Автофильтр

```python
    ws.auto_filter.ref = f"A1:K1"
```

### Изменение 2.3 — Data Validation для статуса оплаты (сдвиг F→G)

```python
    dv_payment.add(f"G2:G1001")
```

### Изменение 2.4 — Условное форматирование (сдвиг E→F для суммы, F→G для оплаты)

- Сумма: `E2:E1001` → `F2:F1001`
- Статус оплаты: `F2:F1001` → `G2:G1001`

### Изменение 2.5 — Справка

**Что изменилось в тексте справки:**
- `"v7"` → `"v9"` (в строке «Структура данных»)
- `"Колонка E = индивидуальная цена товара"` → `"Колонка F = индивидуальная цена товара"`
- `"Колонка H = ссылка на фото"` → `"Колонка J = ссылка на фото"`
- `"=СУММ(E:E)"` → `"=СУММЕСЛИ(C:C;\"<>❌ Отменён\";F:F)"` (разделитель `;` для русского Excel)

**Новый код справки:**

```python
        "📌 Структура данных (v9 — 10 колонок):",
        ...
        "E — Кол-во (количество единиц товара, из корзины)",
        "F — Сумма (индивидуальная цена товара)",
        "G — Статус оплаты (в каждой строке)",
        "H — Пункт выдачи (в каждой строке)",
        "I — Дата доставки (ожидаемая, из shipment widget)",
        "J — Фото (ссылка на изображение товара с ozon.ru)",
        "K — Примечание (можно заполнить вручную)",
        ...
        "- Общая сумма без отменённых: =СУММЕСЛИ(C:C;\"<>❌ Отменён\";F:F)",
```

---

## Порядок реализации (7 шагов)

1. **Обновить `@version`** в [`ozon-orders-copier.user.js`](ozon-orders-copier.user.js) — с `8.0` на `9.0`
2. **Добавить `parseDeliveryDate()`** — новая функция после строки 252
3. **Обновить [`fetchOrderDetails()`](ozon-orders-copier.user.js:393)** — `qty` из `addToCartButton.action.quantity`, `deliveryDate` из `header[1]`
4. **Обновить [`formatTSV()`](ozon-orders-copier.user.js:484)** — 10 колонок, адрес/оплата на каждой строке, `deliveryDate`, сумма без отмен
5. **Обновить [`showPreview()`](ozon-orders-copier.user.js:592)** — исключение отменённых из grandTotal
6. **Обновить [`downloadXLSX()`](ozon-orders-copier.user.js:788)** — 10 колонок, SUMIF, сдвиг фото в J
7. **Обновить [`generate_template.py`](generate_template.py)** — 11 колонок (A-K), валидация, условное форматирование
