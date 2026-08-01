// ============================================================
// СЕКЦИЯ: src/core/export-xlsx.js
// Источник: ozon-orders-copier.user.js — секция «12a. ПОСТРОЕНИЕ XLSX-КНИГИ»
//   (строки 2538–2754): buildXlsxWorkbook (2544–2754). Все вспомогательные
//   функции внутри тела (arrow-helper'ы price/qtyNum) — часть тела функции.
// ЕДИНСТВЕННОЕ изменение против монолита (DI-рефакторинг, согласован в плане):
//   - сигнатура: buildXlsxWorkbook(deduped, imageCache, ExcelJSRef);
//   - в теле `ExcelJS.` → `ExcelJSRef.` (рабочие вхождения, НЕ комментарии).
// Вызовы buildXlsxWorkbook(deduped, imageCache) из обёрток будут адаптированы
// на этапе 2: buildXlsxWorkbook(deduped, imageCache, ExcelJS), где ExcelJS —
// глобал платформы (userscript: @require; extension: lib/exceljs.min.js).
// Тесты ядра будут вызывать buildXlsxWorkbook(orders, cache, exceljsStub).
// Зависимости: ядро: safeCell (utils), mergePaymentStatus (statuses),
//   Diagnostics.logImage (diagnostics — в catch вставки картинки);
//   платформа: console; использует поля заказов (date, orderNumber,
//   deliveryStatus, paymentStatus, pickupPoint, cardDeliveryDate, items[],
//   error, fallbackAmount) и imageCache (Map: picture → {buffer, extension}).
// Платформа: ExcelJS — через параметр ExcelJSRef (DI, не глобал).
// Объявляет: buildXlsxWorkbook.
// ============================================================
    // ============================================================
    // 12a. ПОСТРОЕНИЕ XLSX-КНИГИ (вынесено для юнит-тестов F4)
    // Создаёт и возвращает workbook через глобальный ExcelJS.
    // 10 колонок по словарю B1: «Дата заказа» первой (A), остальные сдвинуты на +1.
    // Логика идентична в userscript и extension (проверяется sync-check F6).
    // ============================================================
    function buildXlsxWorkbook(deduped, imageCache, ExcelJSRef) {
        const workbook = new ExcelJSRef.Workbook();
        workbook.creator = 'Ozon Copier';
        const ws = workbook.addWorksheet('Заказы');

        const HEADER_FILL = '1F4E79';
        const HEADER_FONT_COLOR = 'FFFFFF';

        // Заголовки (10 колонок, единый словарь B1: в TSV и XLSX — «Статус доставки»)
        const headers = ['Дата заказа', '№ Заказа', 'Статус доставки', 'Товары', 'Кол-во', 'Сумма', 'Статус оплаты', 'Пункт выдачи', 'Дата доставки', 'Фото'];
        headers.forEach((h, i) => {
            const cell = ws.getCell(1, i + 1);
            cell.value = h;
            cell.font = { bold: true, color: { argb: HEADER_FONT_COLOR }, size: 12 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = {
                top: { style: 'thin' }, bottom: { style: 'thin' },
                left: { style: 'thin' }, right: { style: 'thin' }
            };
        });

        // Ширина колонок (A: 14 — дата заказа)
        ws.columns = [
            { width: 14 }, // A: Дата заказа
            { width: 20 }, // B: № Заказа
            { width: 24 }, // C: Статус доставки
            { width: 55 }, // D: Товары
            { width: 22 }, // E: Кол-во
            { width: 13 }, // F: Сумма
            { width: 22 }, // G: Статус оплаты
            { width: 28 }, // H: Пункт выдачи
            { width: 18 }, // I: Дата доставки (диапазоны 17–18.07.2026)
            { width: 18 }  // J: Фото
        ];

        // Фиксация шапки
        ws.views = [{ state: 'frozen', ySplit: 1 }];

        // Данные
        let row = 2;
        const IMG_HEIGHT = 60; // px — высота картинки в ячейке

        deduped.forEach(o => {
            const hasItems = o.items && o.items.length > 0;
            const displayItems = hasItems
                ? o.items
                : [{
                    name: o.error || '(не удалось загрузить детали заказа)',
                    price: '',
                    qty: '1',
                    shipmentStatus: '',
                    deliveryDate: o.cardDeliveryDate || '',
                    paymentStatus: o.paymentStatus || '',
                    picture: ''
                }];
            // Весь заказ отменён? (для очистки колонок «Кол-во»/«Сумма»/«Статус оплаты»)
            const isCancelled = o.deliveryStatus === '❌ Отменён';

            displayItems.forEach((item, idx) => {
                // Очистка: табы/переносы в названии товара (консистентно с TSV).
                const name = String(item.name || '').replace(/[\t\r\n]+/g, ' ');
                const displayStatus = (idx === 0)
                    ? (item.shipmentStatus || o.deliveryStatus || '')
                    : (item.shipmentStatus || '');
                // Проблема 2: для отменённых строк (весь заказ ИЛИ конкретный shipment)
                // очищаем «Кол-во», «Сумма» и «Статус оплаты».
                const rowCancelled = isCancelled || displayStatus.includes('❌ Отменён');
                const price = (hasItems && !rowCancelled) ? (() => {
                    const v = String(item.price || '').replace(',', '.');
                    const n = parseFloat(v);
                    return isNaN(n) ? (item.price || '') : n;
                })() : '';
                const qtyNum = rowCancelled ? '' : (() => {
                    const n = parseInt(item.qty, 10);
                    return !isNaN(n) && n > 0 ? n : 1;
                })();
                const picture = item.picture || '';
                const deliveryDateRaw = item.deliveryDate || o.cardDeliveryDate || '';
                const pay = rowCancelled ? '' : mergePaymentStatus(item.paymentStatus, o.paymentStatus);
                // Префикс для «Готов к выдаче»
                const deliveryDateDisplay = (displayStatus.includes('Готов к выдаче') && deliveryDateRaw)
                    ? 'ожидает вручения до ' + deliveryDateRaw
                    : deliveryDateRaw;

                // safeCell защищает строковые ячейки от формульной инъекции
                // (= + - @ в начале). Числовые qtyNum/price остаются числами.
                if (idx === 0) {
                    ws.getCell(row, 1).value = safeCell(o.date); // A: Дата заказа
                    ws.getCell(row, 2).value = safeCell(o.orderNumber); // B: № Заказа
                }

                ws.getCell(row, 3).value = safeCell(displayStatus); // C: Статус доставки
                ws.getCell(row, 4).value = safeCell(name); // D: Товары
                ws.getCell(row, 5).value = qtyNum; // E: Кол-во (число)
                ws.getCell(row, 6).value = price; // F: Сумма (число)
                ws.getCell(row, 6).numFmt = '#,##0.00';
                ws.getCell(row, 7).value = safeCell(pay); // G: Статус оплаты
                ws.getCell(row, 8).value = safeCell(o.pickupPoint); // H: Пункт выдачи

                // I: Дата / диапазон доставки — всегда текст (без timezone-сдвига)
                ws.getCell(row, 9).value = safeCell(String(deliveryDateDisplay));

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
                        // Диагностика: не удалось вставить картинку в Excel
                        Diagnostics.logImage(picture, '', 0, 'EXCEL_INSERT_ERROR', e);
                        ws.getCell(row, 10).value = picture;
                    }
                } else if (picture && !imageCache.has(picture)) {
                    ws.getCell(row, 10).value = picture;
                }

                // Стили для строки (10 колонок)
                const isEvenRow = (row % 2 === 0);
                const rowFill = isEvenRow
                    ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F7FB' } }
                    : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF' } };
                for (let c = 1; c <= 10; c++) {
                    const cell = ws.getCell(row, c);
                    cell.fill = rowFill;
                    cell.border = {
                        top: { style: 'thin' }, bottom: { style: 'thin' },
                        left: { style: 'thin' }, right: { style: 'thin' }
                    };
                    cell.alignment = { vertical: 'middle', wrapText: true };
                    if (c === 5 || c === 6 || c === 9) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                    }
                }

                row++;
            });
        });

        // Автофильтр
        ws.autoFilter = { from: 'A1', to: `J${row - 1}` };

        // Условное форматирование по статусам доставки (колонка C — 8 статусов)
        const lastDataRow = row - 1;
        if (lastDataRow >= 2) {
            ws.addConditionalFormatting({
                ref: `C2:C${lastDataRow}`,
                rules: [
                    //  Зелёные: Доставлен, Готов к выдаче
                    { type: 'containsText', operator: 'containsText', text: 'Доставлен', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C6EFCE' } }, font: { color: { argb: '006100' } } } },
                    { type: 'containsText', operator: 'containsText', text: 'Готов к выдаче', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C6EFCE' } }, font: { color: { argb: '006100' } } } },
                    //  Жёлтые: Передаётся, Передан, В пути
                    { type: 'containsText', operator: 'containsText', text: 'Передаётся', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEB9C' } }, font: { color: { argb: '9C5700' } } } },
                    { type: 'containsText', operator: 'containsText', text: 'Передан', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEB9C' } }, font: { color: { argb: '9C5700' } } } },
                    { type: 'containsText', operator: 'containsText', text: 'В пути', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEB9C' } }, font: { color: { argb: '9C5700' } } } },
                    //  Красно-розовый: Отменён
                    { type: 'containsText', operator: 'containsText', text: 'Отменён', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC7CE' } }, font: { color: { argb: '9C0006' } } } },
                    //  Серо-голубой: Собирается, Обрабатывается
                    { type: 'containsText', operator: 'containsText', text: 'Собирается', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9E2F3' } }, font: { color: { argb: '1F3864' } } } },
                    { type: 'containsText', operator: 'containsText', text: 'Обрабатывается', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9E2F3' } }, font: { color: { argb: '1F3864' } } } },
                ]
            });
        }

        // Условное форматирование по статусам оплаты (колонка G)
        ws.addConditionalFormatting({
            ref: `G2:G${lastDataRow}`,
            rules: [
                { type: 'containsText', operator: 'containsText', text: 'Оплачен', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C6EFCE' } }, font: { color: { argb: '006100' } } } },
                { type: 'containsText', operator: 'containsText', text: 'Не оплачен', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC7CE' } }, font: { color: { argb: '9C0006' } } } },
                { type: 'containsText', operator: 'containsText', text: 'При получении', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEB9C' } }, font: { color: { argb: '9C5700' } } } },
                { type: 'containsText', operator: 'containsText', text: 'Ожидает оплаты', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEB9C' } }, font: { color: { argb: '9C5700' } } } },
                { type: 'containsText', operator: 'containsText', text: 'Частично', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEB9C' } }, font: { color: { argb: '9C5700' } } } },
                { type: 'containsText', operator: 'containsText', text: 'Возврат', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E4DFEC' } }, font: { color: { argb: '4F2F6C' } } } },
            ]
        });

        // Итоговая строка с формулой SUMIF (не учитывает отменённые)
        const summaryRow = row;
        const summaryFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D6E4F0' } };
        ws.mergeCells(summaryRow, 5, summaryRow, 6);
        ws.getCell(summaryRow, 5).value = 'ИТОГО (без отмен):';
        ws.getCell(summaryRow, 5).font = { bold: true, size: 12 };
        ws.getCell(summaryRow, 5).alignment = { horizontal: 'right', vertical: 'middle' };
        ws.getCell(summaryRow, 5).fill = summaryFill;
        ws.getCell(summaryRow, 6).fill = summaryFill;
        ws.getCell(summaryRow, 7).value = {
            formula: `SUMIF(C2:C${lastDataRow},"<>❌ Отменён",F2:F${lastDataRow})`
        };
        ws.getCell(summaryRow, 7).font = { bold: true, size: 12 };
        ws.getCell(summaryRow, 7).numFmt = '#,##0.00';
        ws.getCell(summaryRow, 7).fill = summaryFill;
        for (let c = 1; c <= 10; c++) {
            ws.getCell(summaryRow, c).border = {
                top: { style: 'double' }, bottom: { style: 'thin' },
                left: { style: 'thin' }, right: { style: 'thin' }
            };
        }

        return workbook;
    }
