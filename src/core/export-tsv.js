// ============================================================
// СЕКЦИЯ: src/core/export-tsv.js
// Источник: ozon-orders-copier.user.js — секция «8. ФОРМАТИРОВАНИЕ В TSV»
//   (строки 2161–2280): formatTSV (2164–2280).
// Зависимости: ядро: safeCell (utils), mergePaymentStatus (statuses);
//   использует поля заказов (date, orderNumber, deliveryStatus, paymentStatus,
//   pickupPoint, cardDeliveryDate, items[], error, fallbackAmount).
// Платформа: нет (чистая функция, BOM — строковая константа).
// Объявляет: formatTSV.
// ============================================================
    // ============================================================
    // 8. ФОРМАТИРОВАНИЕ В TSV
    // ============================================================
    function formatTSV(orders) {
        const BOM = '\uFEFF';
        const sep = '\t';

        const headers = [
            'Дата заказа',
            '№ Заказа',
            'Статус доставки',
            'Товары',
            'Кол-во',
            'Сумма',
            'Статус оплаты',
            'Пункт выдачи',
            'Дата доставки',
            'Фото'
        ];

        let tsv = BOM + headers.join(sep) + '\n';

        let grandTotal = 0;
        let totalRows = 0;

        orders.forEach(o => {
            const hasItems = o.items && o.items.length > 0;

            // Если товары подгружены — используем их, иначе fallback (одна строка с наличными данными карточки).
            // fallbackAmount сохраняет сумму заказа даже при сбое загрузки деталей.
            const displayItems = hasItems
                ? o.items
                : [{
                    name: o.error || '(не удалось загрузить детали заказа)',
                    price: o.fallbackAmount || '',
                    qty: '1',
                    shipmentStatus: o.deliveryStatus || '',
                    deliveryDate: o.cardDeliveryDate || '',
                    paymentStatus: o.paymentStatus || '',
                    picture: ''
                }];

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

            displayItems.forEach((item, idx) => {
                // Очистка: табы/переносы в названии товара «разъезжают» строку
                // TSV по колонкам при вставке в Excel — заменяем их на пробел.
                const name = String(item.name || '').replace(/[\t\r\n]+/g, ' ');
                // Статус: на первой строке — order-level (если shipment пуст),
                // далее — статус конкретной отправки
                const displayStatus = (idx === 0)
                    ? (item.shipmentStatus || o.deliveryStatus || '')
                    : (item.shipmentStatus || '');
                // ПРоблема 2: для отменённых строк (весь заказ ИЛИ конкретный shipment)
                // очищаем «Кол-во», «Сумма» и «Статус оплаты».
                const rowCancelled = isCancelled || displayStatus.includes('❌ Отменён');
                const price = (hasItems && !rowCancelled) ? (item.price || '') : '';
                const qty = rowCancelled ? '' : (item.qty || '1');
                const picture = item.picture || '';
                // Дата доставки на КАЖДОЙ строке своего shipment (а не только idx===0)
                const deliveryDateRaw = item.deliveryDate || o.cardDeliveryDate || '';
                const pay = rowCancelled ? '' : mergePaymentStatus(item.paymentStatus, o.paymentStatus);
                // Префикс для «Готов к выдаче»
                const deliveryDate = (displayStatus.includes('Готов к выдаче') && deliveryDateRaw)
                    ? 'ожидает вручения до ' + deliveryDateRaw
                    : deliveryDateRaw;

                // safeCell защищает строковые ячейки от формульной инъекции
                // (= + - @ в начале). Числовые qty/price и пустые — без изменений.
                if (idx === 0) {
                    tsv += [
                        safeCell(o.date), // A: Дата заказа
                        safeCell(o.orderNumber), // B: № Заказа
                        safeCell(displayStatus), // C: Статус доставки
                        safeCell(name), // D: Товары
                        qty, // E: Кол-во
                        price, // F: Сумма
                        safeCell(pay), // G: Статус оплаты (item-level)
                        safeCell(o.pickupPoint), // H: Пункт выдачи
                        safeCell(deliveryDate), // I: Дата доставки (по shipment)
                        safeCell(picture) // J: Фото
                    ].join(sep) + '\n';
                } else {
                    tsv += [
                        '',
                        '',
                        safeCell(displayStatus),
                        safeCell(name),
                        qty,
                        price,
                        safeCell(pay),
                        safeCell(o.pickupPoint),
                        safeCell(deliveryDate),
                        safeCell(picture)
                    ].join(sep) + '\n';
                }
                totalRows++;
            });
        });

        // Итоги
        if (orders.length > 0) {
            tsv += '\n';
            tsv += ['', '', '', '', '', '', '', '', '', ''].join(sep) + '\n';
            const grandTotalStr = isNaN(grandTotal) ? '' : formatAmount(grandTotal);
            tsv += ['ИТОГО:', orders.length + ' заказов, ' + totalRows + ' позиций', '', '', '', grandTotalStr, '', '', '', ''].join(sep) + '\n';
        }

        return tsv;
    }
