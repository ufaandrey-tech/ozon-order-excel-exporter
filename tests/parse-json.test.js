// ============================================================
// Фаза E: тесты чистого ядра parseOrdersV2JSON на обеих схемах
// Ozon (старая с title/cellList/badgeStatus и новая без них),
// утилиты getPath/formatAmount и диагностики createParseResult /
// buildDiagnosticsMarkdown (OK/FAIL/N/A).
//
// Тесты грузятся из собранного userscript (гард module.exports) —
// перед прогоном обязательно `npm run build` (pretest делает это сам).
// ============================================================

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const userScript = require('../dist/ozon-orders-copier.user.js');
const {
    ORDERLIST_JSON_OLD,
    ORDERLIST_JSON_NEW
} = require('./fixtures/orderlist-json.js');

const implementations = [
    { name: 'userscript', m: userScript }
];

// ============================================================
// E3: parseOrdersV2JSON — старая схема (title + cellList + badgeStatus)
// ============================================================
for (const { name, m } of implementations) {
    test(`${name}: E3 старая схема — pickupPoint из leftBlock.title.text (без «Пункт Ozon:»)`, () => {
        const orders = m.parseOrdersV2JSON(ORDERLIST_JSON_OLD.ordersV2);
        assert.strictEqual(orders.length, 2);
        const inTransit = orders.find(o => o.orderNumber === '00000000-0001');
        assert.ok(inTransit, 'заказ «В пути» должен распарситься');
        assert.strictEqual(inTransit.pickupPoint, 'Россия, Москва, ул. Тестовая, 1');
        assert.ok(!(inTransit._na || []).includes('pickupPoint'), 'адрес есть — N/A быть не должно');
    });

    test(`${name}: E3 старая схема — fallbackAmount из cellList (целая сумма)`, () => {
        const orders = m.parseOrdersV2JSON(ORDERLIST_JSON_OLD.ordersV2);
        const inTransit = orders.find(o => o.orderNumber === '00000000-0001');
        assert.strictEqual(inTransit.fallbackAmount, '1100');
    });

    test(`${name}: E3 старая схема — fallbackAmount из cellList с дробными ценами (регрессия A2: копейки)`, () => {
        const orders = m.parseOrdersV2JSON(ORDERLIST_JSON_OLD.ordersV2);
        const delivered = orders.find(o => o.orderNumber === '00000000-0002');
        assert.strictEqual(delivered.fallbackAmount, '8573,50');
    });

    test(`${name}: E3 старая схема — badgeStatus → paymentStatus «✅ Оплачен»`, () => {
        const orders = m.parseOrdersV2JSON(ORDERLIST_JSON_OLD.ordersV2);
        const inTransit = orders.find(o => o.orderNumber === '00000000-0001');
        assert.strictEqual(inTransit.paymentStatus, '✅ Оплачен');
    });
}

// ============================================================
// E3: parseOrdersV2JSON — новая схема (title/cellList/badgeStatus НЕТ)
// ============================================================
for (const { name, m } of implementations) {
    test(`${name}: E3 новая схема — pickupPoint = '' + order._na содержит 'pickupPoint'`, () => {
        const orders = m.parseOrdersV2JSON(ORDERLIST_JSON_NEW.ordersV2);
        const delivered = orders.find(o => o.orderNumber === '00000000-0004');
        assert.ok(delivered, 'доставленный заказ должен распарситься');
        assert.strictEqual(delivered.pickupPoint, '');
        assert.deepStrictEqual(delivered._na, ['pickupPoint'],
            'N/A-флаг должен быть установлен для pickupPoint (адрес перенесён в orderdetails)');
    });

    test(`${name}: E3 новая схема — fallbackAmount из товаров (копейки не теряются)`, () => {
        const orders = m.parseOrdersV2JSON(ORDERLIST_JSON_NEW.ordersV2);
        const delivered = orders.find(o => o.orderNumber === '00000000-0004');
        assert.strictEqual(delivered.fallbackAmount, '8573,50');
    });

    test(`${name}: E3 новая схема — cardDeliveryDate из statusText «Получен 30 июля» (OK, не N/A)`, () => {
        const orders = m.parseOrdersV2JSON(ORDERLIST_JSON_NEW.ordersV2);
        const delivered = orders.find(o => o.orderNumber === '00000000-0004');
        assert.match(delivered.cardDeliveryDate, /^30\.07\.\d{4}$/, `неожиданная дата: ${delivered.cardDeliveryDate}`);
        assert.ok(!(delivered._na || []).includes('cardDeliveryDate'),
            'cardDeliveryDate для доставленных — OK (дата получения), не N/A');
    });

    test(`${name}: E3 новая схема — «В пути» с badgeStatus «Оплачен» → paymentStatus`, () => {
        const orders = m.parseOrdersV2JSON(ORDERLIST_JSON_NEW.ordersV2);
        const inTransit = orders.find(o => o.orderNumber === '00000000-0003');
        assert.strictEqual(inTransit.paymentStatus, '✅ Оплачен');
    });

    test(`${name}: E3 смешанная схема — «В пути» + «Доставлен» в одном JSON`, () => {
        const orders = m.parseOrdersV2JSON(ORDERLIST_JSON_NEW.ordersV2);
        assert.strictEqual(orders.length, 2);
        const inTransit = orders.find(o => o.orderNumber === '00000000-0003');
        const delivered = orders.find(o => o.orderNumber === '00000000-0004');
        assert.strictEqual(inTransit.deliveryStatus, '🚚 В пути');
        assert.strictEqual(delivered.deliveryStatus, '✅ Доставлен');
        assert.strictEqual(inTransit.pickupPoint, 'Россия, Москва, ул. Тестовая, 1');
        assert.strictEqual(delivered.pickupPoint, '');
        assert.ok(delivered._na.includes('pickupPoint'), 'доставленный — N/A pickupPoint');
        assert.ok(!(inTransit._na || []).includes('pickupPoint'), '«В пути» — адрес есть');
    });

    test(`${name}: E3 C2 — badgeStatus «Оплачен» → jsonPayment содержит {status: "✅ Оплачен"}`, () => {
        const orders = m.parseOrdersV2JSON(ORDERLIST_JSON_NEW.ordersV2);
        const inTransit = orders.find(o => o.orderNumber === '00000000-0003');
        assert.ok(Array.isArray(inTransit.jsonPayment), 'jsonPayment должен быть массивом');
        assert.ok(inTransit.jsonPayment.length > 0, 'jsonPayment не должен быть пустым');
        assert.strictEqual(inTransit.jsonPayment[0].status, '✅ Оплачен');
        assert.strictEqual(inTransit.jsonPayment[0].productIdx, 0);
    });
}

// ============================================================
// E3: getPath — отсутствующий путь и путь с индексом
// ============================================================
for (const { name, m } of implementations) {
    test(`${name}: E3 getPath — отсутствующий путь → fallback`, () => {
        assert.strictEqual(m.getPath({ a: { b: 1 } }, 'a.c.d', 'FB'), 'FB');
        assert.strictEqual(m.getPath(null, 'a.b', 'FB'), 'FB');
        assert.strictEqual(m.getPath({}, 'x.y.z', ''), '');
    });

    test(`${name}: E3 getPath — путь с индексом price.price[0].text`, () => {
        const obj = { price: { price: [{ text: '1 100 ₽' }] } };
        assert.strictEqual(m.getPath(obj, 'price.price[0].text', ''), '1 100 ₽');
        // индекс за пределами массива → fallback
        assert.strictEqual(m.getPath(obj, 'price.price[5].text', 'FB'), 'FB');
    });

    test(`${name}: E3 formatAmount — целые и дробные суммы`, () => {
        assert.strictEqual(m.formatAmount(1100), '1100');
        assert.strictEqual(m.formatAmount(8573.5), '8573,50');
        assert.strictEqual(m.formatAmount(0.1 + 0.2), '0,30');
    });
}

// ============================================================
// E4: createParseResult — статусы OK / FAIL / N/A
// ============================================================
for (const { name, m } of implementations) {
    test(`${name}: E4 createParseResult — notApplicable=true → статус N/A`, () => {
        const pr = m.createParseResult('00000000-0001', 'pickupPoint', 'leftBlock.title.text', '', true);
        assert.strictEqual(pr.status, 'N/A');
    });

    test(`${name}: E4 createParseResult — пустое значение без N/A → статус FAIL`, () => {
        const pr = m.createParseResult('00000000-0001', 'fallbackAmount', 'cellList.cells', '', false);
        assert.strictEqual(pr.status, 'FAIL');
    });

    test(`${name}: E4 createParseResult — непустое значение → статус OK`, () => {
        const pr = m.createParseResult('00000000-0001', 'pickupPoint', 'leftBlock.title.text', 'Россия, Москва', false);
        assert.strictEqual(pr.status, 'OK');
    });

    test(`${name}: E4 createParseResult — объект сериализуется через JSON.stringify`, () => {
        const pr = m.createParseResult('00000000-0001', 'itemsCount', 'rightBlock.products.products', { count: 2 }, false);
        assert.strictEqual(pr.actualValue, '{"count":2}');
    });
}

// ============================================================
// E4: buildDiagnosticsMarkdown(env, deduped, state) — OK / FAIL / N/A
// ============================================================
for (const { name, m } of implementations) {
    const baseEnv = {
        timestamp: '2026-08-03T00:00:00.000Z',
        scriptVersion: '9.16',
        pageUrl: 'https://www.ozon.ru/my/orderlist/',
        userAgent: 'test-ua',
        platform: 'test-platform',
        language: 'ru-RU',
        viewport: '1920x1080'
    };

    test(`${name}: E4 buildDiagnosticsMarkdown — запись N/A → «🟡 N/A»`, () => {
        const state = {
            errors: [], parseResults: [m.createParseResult('00000000-0001', 'pickupPoint', 'leftBlock.title.text', '', true)],
            rawSnapshots: [], domProbes: [], orderDetailsSnapshots: [], imageLogs: []
        };
        const md = m.buildDiagnosticsMarkdown(baseEnv, [], state);
        assert.ok(md.includes('🟡 N/A'), 'в отчёте должна быть строка «🟡 N/A»');
        assert.ok(md.includes('pickupPoint'), 'в отчёте должно быть имя поля');
    });

    test(`${name}: E4 buildDiagnosticsMarkdown — запись FAIL → «❌ FAIL»`, () => {
        const state = {
            errors: [], parseResults: [m.createParseResult('00000000-0001', 'fallbackAmount', 'cellList.cells', '', false)],
            rawSnapshots: [], domProbes: [], orderDetailsSnapshots: [], imageLogs: []
        };
        const md = m.buildDiagnosticsMarkdown(baseEnv, [], state);
        assert.ok(md.includes('❌ FAIL'), 'в отчёте должна быть строка «❌ FAIL»');
    });

    test(`${name}: E4 buildDiagnosticsMarkdown — запись OK → «✅ OK»`, () => {
        const state = {
            errors: [], parseResults: [m.createParseResult('00000000-0001', 'pickupPoint', 'leftBlock.title.text', 'Россия, Москва', false)],
            rawSnapshots: [], domProbes: [], orderDetailsSnapshots: [], imageLogs: []
        };
        const md = m.buildDiagnosticsMarkdown(baseEnv, [], state);
        assert.ok(md.includes('✅ OK'), 'в отчёте должна быть строка «✅ OK»');
    });
}

// ============================================================
// W-1: B2-корректировка pickupPoint N/A→FAIL (верификация v9.16).
// Полная цепочка (enrichOrdersWithProducts + Diagnostics.logParseResult)
// НЕ покрывается автотестом: enrichOrdersWithProducts и Diagnostics
// не экспортируются гардом (см. EXPORT_GROUPS в build/build.js) —
// это задокументированное ограничение, ручной smoke-пункт в ReleaseNotes.
// Покрываем семантику W-1 на уровне диагностики: для заказа с
// order._na=['pickupPoint'], у которого после fetch адрес НЕ восстановлен,
// в diff-отчёте должна быть запись «JSON.pickupPoint» со статусом
// «❌ FAIL» (notApplicable=false), а не «🟡 N/A».
// ============================================================
// baseEnv для buildDiagnosticsMarkdown (идентичен E4, объявлен локально,
// чтобы не зависеть от скоупа предыдущего цикла).
const w1Env = {
    timestamp: '2026-08-03T00:00:00.000Z',
    scriptVersion: '9.16',
    pageUrl: 'https://www.ozon.ru/my/orderlist/',
    userAgent: 'test-ua',
    platform: 'test-platform',
    language: 'ru-RU',
    viewport: '1920x1080'
};

for (const { name, m } of implementations) {
    test(`${name}: W-1 createParseResult — JSON.pickupPoint пуст, notApplicable=false → FAIL (не N/A)`, () => {
        const pr = m.createParseResult('00000000-0004', 'JSON.pickupPoint',
            'leftBlock.title.text (N/A→FAIL: fetch упал, адрес не восстановлен)', '', false);
        assert.strictEqual(pr.status, 'FAIL',
            'pickupPoint с пустым значением после неудачного fetch должен быть FAIL, не N/A');
        assert.strictEqual(pr.field, 'JSON.pickupPoint');
    });

    test(`${name}: W-1 buildDiagnosticsMarkdown — запись FAIL для JSON.pickupPoint → «❌ FAIL» в отчёте`, () => {
        const state = {
            errors: [], parseResults: [m.createParseResult('00000000-0004', 'JSON.pickupPoint',
                'leftBlock.title.text (N/A→FAIL: fetch упал, адрес не восстановлен)', '', false)],
            rawSnapshots: [], domProbes: [], orderDetailsSnapshots: [], imageLogs: []
        };
        const md = m.buildDiagnosticsMarkdown(w1Env, [], state);
        assert.ok(md.includes('❌ FAIL'), 'в diff-таблице должен быть «❌ FAIL» для pickupPoint');
        assert.ok(md.includes('JSON.pickupPoint'), 'в отчёте должно быть имя поля JSON.pickupPoint');
        assert.ok(!md.includes('🟡 N/A'), 'для потерянного адреса не должно быть «🟡 N/A»');
    });
}
