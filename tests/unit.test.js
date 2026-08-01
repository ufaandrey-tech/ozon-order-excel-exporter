// ============================================================
// Юнит-тесты чистой логики (F2) + COMPOSER_ACTION (F3).
// Этап 4 рефакторинга: архитектура переведена на единое ядро
// (src/core/), сборка даёт dist/ozon-orders-copier.user.js и
// dist/extension/content.js. Оба артефакта собираются из одного
// ядра, поэтому тесты идут по ЕДИНОМУ источнику — собранному
// userscript (у него тот же гард module.exports, что и у
// extension/content.js). Ядро одно — тестировать можно любой из
// собранных артефактов, для единообразия выбран userscript.
// Относительные даты: годы не хардкодим, генерируем через
// new Date(year, month±1, 1).
// ============================================================

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const userScript = require('../dist/ozon-orders-copier.user.js');
const { createExcelJsStub } = require('./stubs/exceljs-stub.js');

const implementations = [
    { name: 'userscript', m: userScript }
];

// Ожидаемые HTML-сущности собираем конкатенацией, чтобы исходник
// не содержал HTML-сущностей (они искажаются при записи файла).
const LT = '&' + 'lt;';
const GT = '&' + 'gt;';
const AMP = '&' + 'amp;';
const QUOT = '&' + 'quot;';
const APOS = '&' + '#39;';
const BACKTICK_ENT = '&' + '#96;';

// ------------------------------------------------------------
// Вспомогательные функции для работы с относительными датами
// ------------------------------------------------------------
function currentYear() {
    return new Date().getFullYear();
}

// Месяц (1..12), отстоящий от текущего на delta месяцев (delta может быть ±).
function monthInFuture(delta) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + delta, 1);
    return d.getMonth() + 1;
}

function monthInPast(delta) {
    return monthInFuture(-delta);
}

function currentMonth() {
    return new Date().getMonth() + 1;
}

// Русское название месяца по номеру (1..12)
const RU_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function ruMonth(m) {
    return RU_MONTHS[m - 1];
}

// ============================================================
// F2: A1 — yearForOrderMonth / yearForDeliveryMonth
// ============================================================
for (const { name, m } of implementations) {
    test(`${name}: A1 yearForOrderMonth — будущий месяц → год−1 (заказ из будущего невозможен)`, () => {
        const nextM = monthInFuture(1);
        assert.strictEqual(m.yearForOrderMonth(nextM), currentYear() - 1);
    });

    test(`${name}: A1 yearForOrderMonth — текущий месяц → текущий год`, () => {
        assert.strictEqual(m.yearForOrderMonth(currentMonth()), currentYear());
    });

    test(`${name}: A1 yearForOrderMonth — прошлый месяц → текущий год`, () => {
        const prevM = monthInPast(1);
        assert.strictEqual(m.yearForOrderMonth(prevM), currentYear());
    });

    test(`${name}: A1 yearForDeliveryMonth — «Получен» в будущем месяце → год−1`, () => {
        const futureM = monthInFuture(1);
        assert.strictEqual(
            m.yearForDeliveryMonth(futureM, `Получен ${futureM} ${ruMonth(futureM)}`),
            currentYear() - 1
        );
    });

    test(`${name}: A1 yearForDeliveryMonth — «Ожидаем» в прошлом месяце → год+1`, () => {
        const pastM = monthInPast(1);
        assert.strictEqual(
            m.yearForDeliveryMonth(pastM, `Ожидаем ${pastM} ${ruMonth(pastM)}`),
            currentYear() + 1
        );
    });

    test(`${name}: A1 yearForDeliveryMonth — «Ожидаем» в будущем месяце → текущий год`, () => {
        const futureM = monthInFuture(1);
        assert.strictEqual(
            m.yearForDeliveryMonth(futureM, `Ожидаем ${futureM} ${ruMonth(futureM)}`),
            currentYear()
        );
    });

    test(`${name}: A1 yearForDeliveryMonth — диапазон без маркера прошлого/будущего → текущий год`, () => {
        const futureM = monthInFuture(1);
        assert.strictEqual(
            m.yearForDeliveryMonth(futureM, `17–18 ${ruMonth(futureM)}`),
            currentYear()
        );
    });

    test(`${name}: A1 yearForDeliveryMonth — «хранится до» в будущем месяце → год−1`, () => {
        const futureM = monthInFuture(1);
        assert.strictEqual(
            m.yearForDeliveryMonth(futureM, `хранится до 28 ${ruMonth(futureM)}`),
            currentYear() - 1
        );
    });
}

// ============================================================
// F2: A2 — escapeHtml
// ============================================================
for (const { name, m } of implementations) {
    test(`${name}: A2 escapeHtml — XSS-вектор экранируется`, () => {
        const out = m.escapeHtml('<img src=x onerror=alert(1)>');
        assert.ok(!out.includes('<img'));
        assert.ok(out.includes(LT));
        assert.ok(out.includes(GT));
        assert.strictEqual(out, LT + 'img src=x onerror=alert(1)' + GT);
    });

    test(`${name}: A2 escapeHtml — экранируются все спецсимволы & < > " ' и бэктик`, () => {
        const out = m.escapeHtml('&<>"\'' + '`');
        assert.strictEqual(out, AMP + LT + GT + QUOT + APOS + BACKTICK_ENT);
    });

    test(`${name}: A2 escapeHtml — обычный текст без изменений`, () => {
        assert.strictEqual(m.escapeHtml('Простой текст 123'), 'Простой текст 123');
    });

    test(`${name}: A2 escapeHtml — null/undefined → ''`, () => {
        assert.strictEqual(m.escapeHtml(null), '');
        assert.strictEqual(m.escapeHtml(undefined), '');
    });
}

// ============================================================
// F2: A5 — backoffDelay
// ============================================================
for (const { name, m } of implementations) {
    test(`${name}: A5 backoffDelay — база 500/1000/2000 с джиттером`, () => {
        for (let attempt = 0; attempt < 3; attempt++) {
            const base = 500 * Math.pow(2, attempt);
            for (let i = 0; i < 20; i++) {
                const d = m.backoffDelay(attempt);
                assert.ok(d >= base && d <= base + 200,
                    `attempt=${attempt} delay=${d} должен быть в [${base}, ${base + 200}]`);
            }
        }
    });

    test(`${name}: A5 backoffDelay — последовательность 500/1000/2000/4000/5000 (cap на attempt>=4)`, () => {
        for (let attempt = 0; attempt < 6; attempt++) {
            const base = Math.min(500 * Math.pow(2, attempt), 5000);
            for (let i = 0; i < 20; i++) {
                const d = m.backoffDelay(attempt);
                assert.ok(d >= base && d <= base + 200,
                    `attempt=${attempt} delay=${d} должен быть в [${base}, ${base + 200}]`);
            }
        }
    });
}

// ============================================================
// F2: B1/B2 — formatTSV (10 колонок, итог в «Сумма»)
// ============================================================
const HEADERS_10 = ['Дата заказа', '№ Заказа', 'Статус доставки', 'Товары', 'Кол-во', 'Сумма', 'Статус оплаты', 'Пункт выдачи', 'Дата доставки', 'Фото'];

for (const { name, m } of implementations) {
    test(`${name}: B1/B2 formatTSV — 10 заголовков по словарю`, () => {
        const tsv = m.formatTSV([]);
        const firstLine = tsv.replace(/^\uFEFF/, '').split('\n')[0];
        assert.strictEqual(firstLine, HEADERS_10.join('\t'));
    });

    test(`${name}: B1/B2 formatTSV — multi-item заказ: дата только в первой строке`, () => {
        const orders = [{
            orderNumber: '12345678-0001',
            date: '06.07.2026',
            deliveryStatus: '✅ Доставлен',
            pickupPoint: 'Пункт Ozon, Адрес',
            cardDeliveryDate: '',
            paymentStatus: '',
            fallbackAmount: '',
            items: [
                { name: 'Товар A', price: '100', qty: '1', shipmentStatus: '✅ Доставлен', deliveryDate: '17.07.2026', paymentStatus: '✅ Оплачен', picture: '' },
                { name: 'Товар B', price: '50,50', qty: '2', shipmentStatus: '✅ Доставлен', deliveryDate: '17.07.2026', paymentStatus: '✅ Оплачен', picture: '' }
            ]
        }];
        const tsv = m.formatTSV(orders);
        const lines = tsv.replace(/^\uFEFF/, '').split('\n').filter(l => l.length > 0);
        // 1 заголовок + 2 строки товаров + 1 пустая строка-разделитель + 1 итоговая
        assert.strictEqual(lines.length, 5);
        // Строка 1 (первый товар): дата заказа в колонке 0
        const row1 = lines[1].split('\t');
        assert.strictEqual(row1[0], '06.07.2026');
        assert.strictEqual(row1[1], '12345678-0001');
        assert.strictEqual(row1[2], '✅ Доставлен');
        assert.strictEqual(row1[3], 'Товар A');
        assert.strictEqual(row1[4], '1');
        assert.strictEqual(row1[5], '100');
        // Строка 2 (второй товар): дата и номер пустые
        const row2 = lines[2].split('\t');
        assert.strictEqual(row2[0], '');
        assert.strictEqual(row2[1], '');
        assert.strictEqual(row2[3], 'Товар B');
        assert.strictEqual(row2[4], '2');
        assert.strictEqual(row2[5], '50,50');
        // Итоговая строка: 10 элементов, grandTotalStr в индексе 5 («Сумма»)
        const summary = lines[4].split('\t');
        assert.strictEqual(summary.length, 10);
        assert.strictEqual(summary[0], 'ИТОГО:');
        assert.strictEqual(summary[5], '150,50');
    });

    test(`${name}: B1/B2 formatTSV — отменённый заказ: пустые Кол-во/Сумма/Статус оплаты`, () => {
        const orders = [{
            orderNumber: '99999999-0001',
            date: '',
            deliveryStatus: '❌ Отменён',
            pickupPoint: '',
            cardDeliveryDate: '',
            paymentStatus: '❌ Не оплачен',
            fallbackAmount: '',
            items: [
                { name: 'Отменённый товар', price: '300', qty: '1', shipmentStatus: '❌ Отменён', deliveryDate: '', paymentStatus: '❌ Не оплачен', picture: '' }
            ]
        }];
        const tsv = m.formatTSV(orders);
        const lines = tsv.replace(/^\uFEFF/, '').split('\n').filter(l => l.length > 0);
        const row = lines[1].split('\t');
        assert.strictEqual(row[3], 'Отменённый товар');
        assert.strictEqual(row[4], ''); // Кол-во пусто
        assert.strictEqual(row[5], ''); // Сумма пуста
        assert.strictEqual(row[6], ''); // Статус оплаты пуст
    });

    test(`${name}: B1/B2 formatTSV — «грязное» название товара с табом/переносом`, () => {
        const orders = [{
            orderNumber: '12345678-0002',
            date: '',
            deliveryStatus: '✅ Доставлен',
            pickupPoint: '',
            cardDeliveryDate: '',
            paymentStatus: '',
            fallbackAmount: '',
            items: [
                { name: 'Товар\tс табом\nи переносом', price: '10', qty: '1', shipmentStatus: '✅ Доставлен', deliveryDate: '', paymentStatus: '', picture: '' }
            ]
        }];
        const tsv = m.formatTSV(orders);
        const lines = tsv.replace(/^\uFEFF/, '').split('\n').filter(l => l.length > 0);
        // 1 заголовок + 1 строка товара + 1 пустая строка-разделитель + 1 итоговая
        assert.strictEqual(lines.length, 4);
        // Строка товара: ровно 10 полей — если таб из названия «уедет» в разделители,
        // количество полей будет больше 10, и тест упадёт.
        const row = lines[1].split('\t');
        assert.strictEqual(row.length, 10);
        // Таб/перенос внутри названия заменены на пробел (проверяем ДО split по разделителю)
        assert.ok(!lines[1].includes('\t') || lines[1].includes('Товар с табом и переносом'), 'в строке не должно быть «сырого» таба из названия');
        assert.ok(!row[3].includes('\t'));
        assert.ok(!row[3].includes('\n'));
        assert.strictEqual(row[3], 'Товар с табом и переносом');
        // Пустая строка-разделитель и итоговая строка остались корректными
        const summary = lines[3].split('\t');
        assert.strictEqual(summary.length, 10);
        assert.strictEqual(summary[0], 'ИТОГО:');
    });

    test(`${name}: B1/B2 formatTSV — формульная инъекция: названия = + - @ получают апостроф`, () => {
        const orders = [{
            orderNumber: '=HYPERLINK("http://evil")',
            date: '06.07.2026',
            deliveryStatus: '✅ Доставлен',
            pickupPoint: '',
            cardDeliveryDate: '',
            paymentStatus: '',
            fallbackAmount: '',
            items: [
                { name: '=HYPERLINK("http://evil")', price: '100', qty: '1', shipmentStatus: '✅ Доставлен', deliveryDate: '17.07.2026', paymentStatus: '', picture: '=cmd' }
            ]
        }];
        const tsv = m.formatTSV(orders);
        const lines = tsv.replace(/^\uFEFF/, '').split('\n').filter(l => l.length > 0);
        const row = lines[1].split('\t');
        // Все строковые ячейки с формульным префиксом защищены апострофом
        assert.strictEqual(row[0], '06.07.2026');
        assert.strictEqual(row[1], "'=HYPERLINK(\"http://evil\")");
        assert.strictEqual(row[3], "'=HYPERLINK(\"http://evil\")");
        assert.strictEqual(row[9], "'=cmd");
        // Числовые ячейки не тронуты
        assert.strictEqual(row[4], '1');
        assert.strictEqual(row[5], '100');
        // Обычные строки не меняются
        assert.strictEqual(row[2], '✅ Доставлен');
    });

    test(`${name}: B1/B2 formatTSV — обычные названия и числа не меняются`, () => {
        const orders = [{
            orderNumber: '12345678-0003',
            date: '06.07.2026',
            deliveryStatus: '✅ Доставлен',
            pickupPoint: 'Пункт Ozon',
            cardDeliveryDate: '',
            paymentStatus: '✅ Оплачен',
            fallbackAmount: '',
            items: [
                { name: 'Товар', price: '100,50', qty: '2', shipmentStatus: '✅ Доставлен', deliveryDate: '', paymentStatus: '✅ Оплачен', picture: '' }
            ]
        }];
        const tsv = m.formatTSV(orders);
        const lines = tsv.replace(/^\uFEFF/, '').split('\n').filter(l => l.length > 0);
        const row = lines[1].split('\t');
        assert.strictEqual(row[1], '12345678-0003');
        assert.strictEqual(row[3], 'Товар');
        assert.strictEqual(row[4], '2');
        assert.strictEqual(row[5], '100,50');
        assert.strictEqual(row[2], '✅ Доставлен');
        assert.strictEqual(row[7], 'Пункт Ozon');
    });

    test(`${name}: B1/B2 buildXlsxWorkbook — формульная инъекция: строка '=SUM(A1)' в названии получает апостроф`, () => {
        const { ExcelJS, trace } = createExcelJsStub();
        const prev = global.ExcelJS;
        global.ExcelJS = ExcelJS;
        try {
            // Этап 4: ядро использует DI — стаб передаётся третьим аргументом (ExcelJSRef).
            m.buildXlsxWorkbook([{
                orderNumber: '12345678-0004',
                date: '06.07.2026',
                deliveryStatus: '✅ Доставлен',
                pickupPoint: '',
                cardDeliveryDate: '',
                paymentStatus: '',
                fallbackAmount: '',
                items: [
                    { name: '=SUM(A1)', price: '100', qty: '1', shipmentStatus: '✅ Доставлен', deliveryDate: '', paymentStatus: '', picture: '' }
                ]
            }], new Map(), ExcelJS);
        } finally {
            global.ExcelJS = prev;
        }
        // D2 (товары): строка =SUM(A1) защищена апострофом
        assert.strictEqual(trace.cells['2,4'].value, "'=SUM(A1)");
        // Числа остаются числами
        assert.strictEqual(trace.cells['2,5'].value, 1);
        assert.strictEqual(trace.cells['2,6'].value, 100);
        // Обычная строка (номер заказа) не меняется
        assert.strictEqual(trace.cells['2,2'].value, '12345678-0004');
    });
}

// ============================================================
// F2: dedupeOrders
// ============================================================
for (const { name, m } of implementations) {
    test(`${name}: dedupeOrders — первый заказ сохраняется, дубли удаляются`, () => {
        const orders = [
            { orderNumber: 'A', items: [] },
            { orderNumber: 'B', items: [] },
            { orderNumber: 'A', items: [] }
        ];
        const original = JSON.parse(JSON.stringify(orders));
        const deduped = m.dedupeOrders(orders);
        assert.strictEqual(deduped.length, 2);
        assert.strictEqual(deduped[0].orderNumber, 'A');
        assert.strictEqual(deduped[1].orderNumber, 'B');
        // Исходный массив не мутирован
        assert.deepStrictEqual(orders, original);
    });

    test(`${name}: dedupeOrders — пустой вход → []`, () => {
        assert.deepStrictEqual(m.dedupeOrders([]), []);
        assert.deepStrictEqual(m.dedupeOrders(null), []);
        assert.deepStrictEqual(m.dedupeOrders(undefined), []);
    });
}

// ============================================================
// F2: parseRussianDate
// ============================================================
for (const { name, m } of implementations) {
    test(`${name}: parseRussianDate — «6 июля» → дата заказа`, () => {
        const out = m.parseRussianDate('6 июля');
        assert.ok(out, 'должна вернуть дату');
        assert.match(out, /^06\.07\.\d{4}$/);
        const year = parseInt(out.split('.')[2], 10);
        // 6 июля в прошлом месяце (относительно текущего) — год не больше текущего
        assert.ok(year >= currentYear() - 1 && year <= currentYear() + 1);
    });

    test(`${name}: parseRussianDate — некорректный вход → ''`, () => {
        assert.strictEqual(m.parseRussianDate(''), '');
        assert.strictEqual(m.parseRussianDate(null), '');
        assert.strictEqual(m.parseRussianDate('Без даты'), '');
    });

    test(`${name}: parseRussianDate — «Получен 6 июля» из статуса`, () => {
        const out = m.parseRussianDate('Получен 6 июля');
        assert.match(out, /^06\.07\.\d{4}$/);
    });
}

// ============================================================
// F2: parseDeliveryDate
// ============================================================
for (const { name, m } of implementations) {
    test(`${name}: parseDeliveryDate — «17–18 июля» → диапазон`, () => {
        const out = m.parseDeliveryDate('17–18 июля');
        assert.match(out, /^17–18\.07\.\d{4}$/);
    });

    test(`${name}: parseDeliveryDate — «Ожидаем15 июля» (без пробела)`, () => {
        const out = m.parseDeliveryDate('Ожидаем15 июля');
        assert.match(out, /^15\.07\.\d{4}$/);
    });

    test(`${name}: parseDeliveryDate — «до 27 июля включительно»`, () => {
        const out = m.parseDeliveryDate('до 27 июля включительно');
        assert.match(out, /^27\.07\.\d{4}$/);
    });

    test(`${name}: parseDeliveryDate — «Ожидаемая дата: с 17 до 18 июля»`, () => {
        const out = m.parseDeliveryDate('Ожидаемая дата: с 17 до 18 июля');
        assert.match(out, /^17–18\.07\.\d{4}$/);
    });

    test(`${name}: parseDeliveryDate — «Доставка в пункт выдачи 17 - 18 июля»`, () => {
        const out = m.parseDeliveryDate('Доставка в пункт выдачи 17 - 18 июля');
        assert.match(out, /^17–18\.07\.\d{4}$/);
    });

    test(`${name}: parseDeliveryDate — пустой вход → ''`, () => {
        assert.strictEqual(m.parseDeliveryDate(''), '');
        assert.strictEqual(m.parseDeliveryDate(null), '');
    });

    test(`${name}: parseDeliveryDate — «до N месяца» в будущем месяце → год−1 (маркер ^до)`, () => {
        // «до 27 [будущий месяц]» без слова «хранится» — маркер ^до тоже считается прошлым
        const futureM = monthInFuture(1);
        const out = m.parseDeliveryDate(`до 27 ${ruMonth(futureM)}`);
        assert.ok(out, 'должна вернуть дату');
        assert.match(out, /^\d{2}\.\d{2}\.\d{4}$/);
        // Ветка «до N месяца» использует yearForDeliveryMonth с маркером ^до → год−1
        assert.strictEqual(parseInt(out.split('.')[2], 10), currentYear() - 1);
    });

    test(`${name}: parseDeliveryDate — «до 27 [будущий месяц] включительно» → год−1`, () => {
        const futureM = monthInFuture(1);
        const out = m.parseDeliveryDate(`до 27 ${ruMonth(futureM)} включительно`);
        assert.match(out, /^\d{2}\.\d{2}\.\d{4}$/);
        assert.strictEqual(parseInt(out.split('.')[2], 10), currentYear() - 1);
    });
}

// ============================================================
// F2: normalizeStatus / normalizePaymentStatus
// ============================================================
for (const { name, m } of implementations) {
    test(`${name}: normalizeStatus — полный словарь`, () => {
        assert.strictEqual(m.normalizeStatus('Получен'), '✅ Доставлен');
        assert.strictEqual(m.normalizeStatus('В пути'), '🚚 В пути');
        assert.strictEqual(m.normalizeStatus('Отменён'), '❌ Отменён');
        assert.strictEqual(m.normalizeStatus('Собирается'), '📦 Собирается');
        assert.strictEqual(m.normalizeStatus('Можно забирать'), '📦 Готов к выдаче');
        assert.strictEqual(m.normalizeStatus('Передан в доставку'), '🚚 Передан в доставку');
        assert.strictEqual(m.normalizeStatus(''), '');
        assert.strictEqual(m.normalizeStatus(null), '');
    });

    test(`${name}: normalizeStatus — частичные вхождения`, () => {
        assert.strictEqual(m.normalizeStatus('Ваш заказ отменён'), '❌ Отменён');
        assert.strictEqual(m.normalizeStatus('Заказ передаётся в доставку'), '🚚 Передаётся в доставку');
        assert.strictEqual(m.normalizeStatus('Товар не оплачен'), '❌ Не оплачен');
    });

    test(`${name}: normalizePaymentStatus — приоритет «Не оплачен»`, () => {
        assert.strictEqual(m.normalizePaymentStatus('НЕ ОПЛАЧЕН'), '❌ Не оплачен');
        assert.strictEqual(m.normalizePaymentStatus('Оплачен'), '✅ Оплачен');
        assert.strictEqual(m.normalizePaymentStatus('К оплате при получении'), '⏳ При получении');
        assert.strictEqual(m.normalizePaymentStatus('Частично оплачен'), '🟡 Частично оплачен');
        assert.strictEqual(m.normalizePaymentStatus(''), '');
        assert.strictEqual(m.normalizePaymentStatus(null), '');
        // «не оплачен» побеждает, даже если в строке есть «оплачен»
        assert.strictEqual(m.normalizePaymentStatus('Заказ не оплачен'), '❌ Не оплачен');
        // НЕОПЛАЧЕН слитно
        assert.strictEqual(m.normalizePaymentStatus('НЕОПЛАЧЕН'), '❌ Не оплачен');
    });
}

// ============================================================
// F2: parsePrice
// ============================================================
for (const { name, m } of implementations) {
    test(`${name}: parsePrice — «1 102 ₽» → 1102`, () => {
        assert.strictEqual(m.parsePrice('1 102 ₽'), '1102');
        assert.strictEqual(m.parsePrice('1102 ₽'), '1102');
    });

    test(`${name}: parsePrice — «8 573,50 ₽» → 8573,50`, () => {
        assert.strictEqual(m.parsePrice('8 573,50 ₽'), '8573,50');
    });

    test(`${name}: parsePrice — пустой/битый вход`, () => {
        assert.strictEqual(m.parsePrice(''), '');
        assert.strictEqual(m.parsePrice(null), '');
        assert.strictEqual(m.parsePrice('нет цены'), '');
    });
}

// ============================================================
// F2: detectImageType (D3)
// ============================================================
for (const { name, m } of implementations) {
    test(`${name}: detectImageType — PNG-магические байты`, () => {
        const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        assert.strictEqual(m.detectImageType(png, '', ''), 'png');
    });

    test(`${name}: detectImageType — JPEG-магические байты`, () => {
        const jpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
        assert.strictEqual(m.detectImageType(jpeg, '', ''), 'jpeg');
    });

    test(`${name}: detectImageType — GIF-магические байты`, () => {
        const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38]);
        assert.strictEqual(m.detectImageType(gif, '', ''), 'gif');
    });

    test(`${name}: detectImageType — WebP-магические байты`, () => {
        const webp = new Uint8Array([
            0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
            0x57, 0x45, 0x42, 0x50
        ]);
        assert.strictEqual(m.detectImageType(webp, '', ''), 'webp');
    });

    test(`${name}: detectImageType — нет байтов, URL .png → png`, () => {
        assert.strictEqual(m.detectImageType(null, 'https://cdn.example.com/photo.png', ''), 'png');
    });

    test(`${name}: detectImageType — нет байтов, Content-Type png → png`, () => {
        assert.strictEqual(m.detectImageType(null, 'https://cdn.example.com/photo', 'image/png'), 'png');
    });

    test(`${name}: detectImageType — ничего нет → jpeg (дефолт)`, () => {
        assert.strictEqual(m.detectImageType(null, '', ''), 'jpeg');
        assert.strictEqual(m.detectImageType(new Uint8Array([]), '', ''), 'jpeg');
    });
}

// ============================================================
// F3: extractComposerAction (A3)
// ============================================================
// base64 от {"postings":["58957649-0583-1"]}
const B64_PLAIN = 'eyJwb3N0aW5ncyI6WyI1ODk1NzY0OS0wNTgzLTEiXX0=';
// URL-encoded вариант ( %3D )
const B64_URLENCODED = B64_PLAIN.replace(/=/g, '%3D');
// base64 с символом «+» (легальный символ base64): {"postings":["58957649-0583-1"],"x":"þ"}
const B64_PLUS = 'eyJwb3N0aW5ncyI6WyI1ODk1NzY0OS0wNTgzLTEiXSwieCI6IsO+In0=';
// URL-encoded вариант с «+» → «%2B»: {"postings":["58957649-0583-1"],"x":"+"}
const B64_PLUS_URLENCODED = 'eyJwb3N0aW5ncyI6WyI1ODk1NzY0OS0wNTgzLTEiXSwieCI6IisifQ==';

for (const { name, m } of implementations) {
    test(`${name}: F3 extractComposerAction — обычный base64 → «58957649-0583»`, () => {
        assert.strictEqual(
            m.extractComposerAction('https://ozon.ru/v2/cacheOrderProducts?data=' + B64_PLAIN),
            '58957649-0583'
        );
    });

    test(`${name}: F3 extractComposerAction — URL-encoded base64 (%3D)`, () => {
        assert.strictEqual(
            m.extractComposerAction('https://ozon.ru/v2/cacheOrderProducts?data=' + B64_URLENCODED),
            '58957649-0583'
        );
    });

    test(`${name}: F3 extractComposerAction — base64 с символом «+»`, () => {
        assert.strictEqual(
            m.extractComposerAction('https://ozon.ru/v2/cacheOrderProducts?data=' + B64_PLUS),
            '58957649-0583'
        );
    });

    test(`${name}: F3 extractComposerAction — URL-encoded «+» (%2B)`, () => {
        assert.strictEqual(
            m.extractComposerAction('https://ozon.ru/v2/cacheOrderProducts?data=' + B64_PLUS_URLENCODED),
            '58957649-0583'
        );
    });

    test(`${name}: F3 extractComposerAction — битый base64 → null без исключения`, () => {
        assert.strictEqual(m.extractComposerAction('https://ozon.ru/v2/cacheOrderProducts?data=!!!broken!!'), null);
    });

    test(`${name}: F3 extractComposerAction — нет data → null`, () => {
        assert.strictEqual(m.extractComposerAction('https://ozon.ru/my/orderdetails/?order=123'), null);
        assert.strictEqual(m.extractComposerAction(null), null);
        assert.strictEqual(m.extractComposerAction(''), null);
    });

    test(`${name}: F3 extractComposerAction — base64 валидный, но не JSON с postings → null`, () => {
        // base64 от {"foo":"bar"}
        const b64 = Buffer.from('{"foo":"bar"}', 'utf8').toString('base64');
        assert.strictEqual(m.extractComposerAction('https://ozon.ru/v2/cacheOrderProducts?data=' + b64), null);
    });
}
