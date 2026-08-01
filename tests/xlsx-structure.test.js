// ============================================================
// F4: Тест XLSX-структуры (юнит-тест структуры, НЕ генерация
// .xlsx-файла). Прогоняется через стаб-объект ExcelJS
// (tests/stubs/exceljs-stub.js).
// Этап 4 рефакторинга: оба артефакта (userscript и extension)
// собираются из единого ядра src/core/, поэтому тест идёт по
// ЕДИНОМУ источнику — собранному dist/ozon-orders-copier.user.js
// (у него тот же гард module.exports, что и у dist/extension/content.js).
// Ядро (src/core/export-xlsx.js) использует DI: стаб ExcelJS
// передаётся ТРЕТЬИМ аргументом buildXlsxWorkbook(deduped, imageCache,
// ExcelJSRef). global.ExcelJS больше не нужен.
// ============================================================

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const { createExcelJsStub } = require('./stubs/exceljs-stub.js');

const userScript = require('../dist/ozon-orders-copier.user.js');

const implementations = [
    { name: 'userscript', m: userScript }
];

// --- Фикстура заказа с фото, отменённым и обычным ---
function makeOrders() {
    return [
        {
            orderNumber: '12345678-0001',
            date: '06.07.2026',
            deliveryStatus: '✅ Доставлен',
            pickupPoint: 'Пункт Ozon, Адрес 1',
            cardDeliveryDate: '',
            paymentStatus: '✅ Оплачен',
            fallbackAmount: '',
            error: '',
            items: [
                {
                    name: 'Товар A',
                    price: '100',
                    qty: '1',
                    shipmentStatus: '✅ Доставлен',
                    deliveryDate: '17.07.2026',
                    paymentStatus: '✅ Оплачен',
                    picture: 'https://cdn.example.com/photo-a.png'
                }
            ]
        },
        {
            orderNumber: '99999999-0002',
            date: '',
            deliveryStatus: '❌ Отменён',
            pickupPoint: '',
            cardDeliveryDate: '',
            paymentStatus: '❌ Не оплачен',
            fallbackAmount: '',
            error: '',
            items: [
                {
                    name: 'Отменённый товар',
                    price: '300',
                    qty: '1',
                    shipmentStatus: '❌ Отменён',
                    deliveryDate: '',
                    paymentStatus: '❌ Не оплачен',
                    picture: ''
                }
            ]
        }
    ];
}

function makeImageCache() {
    const cache = new Map();
    cache.set('https://cdn.example.com/photo-a.png', {
        buffer: Buffer.from([0x89, 0x50, 0x4E, 0x47]),
        extension: 'png'
    });
    return cache;
}

for (const { name, m } of implementations) {
    test(`${name}: F4 buildXlsxWorkbook — заголовки 10, первый «Дата заказа», «Статус доставки»`, () => {
        const { ExcelJS, trace } = createExcelJsStub();
        const prev = global.ExcelJS;
        global.ExcelJS = ExcelJS;
        try {
            m.buildXlsxWorkbook(makeOrders(), makeImageCache(), ExcelJS);
        } finally {
            global.ExcelJS = prev;
        }
        assert.strictEqual(trace.headers.length, 10);
        assert.strictEqual(trace.headers[0], 'Дата заказа');
        assert.strictEqual(trace.headers[2], 'Статус доставки');
        assert.strictEqual(trace.headers[9], 'Фото');
    });

    test(`${name}: F4 buildXlsxWorkbook — SUMIF C2:C…/F2:F… в ячейке 7 итоговой строки`, () => {
        const { ExcelJS, trace } = createExcelJsStub();
        const prev = global.ExcelJS;
        global.ExcelJS = ExcelJS;
        try {
            m.buildXlsxWorkbook(makeOrders(), makeImageCache(), ExcelJS);
        } finally {
            global.ExcelJS = prev;
        }
        // 2 заказа, по 1 товару → данные в строках 2-3, итоговая строка 4
        const summaryRow = 4;
        const formulaCell = trace.cells[summaryRow + ',7'];
        assert.ok(formulaCell, 'ячейка итоговой строки в колонке 7 должна существовать');
        assert.ok(formulaCell.value && typeof formulaCell.value === 'object' && formulaCell.value.formula,
            'в ячейке 7 должна быть формула');
        const formula = formulaCell.value.formula;
        assert.match(formula, /SUMIF\(C2:C\d+/);
        assert.match(formula, /F2:F\d+/);
        assert.ok(formula.includes('<>❌ Отменён'), 'формула не должна учитывать отменённые');
    });

    test(`${name}: F4 buildXlsxWorkbook — автофильтр A1:J`, () => {
        const { ExcelJS, trace } = createExcelJsStub();
        const prev = global.ExcelJS;
        global.ExcelJS = ExcelJS;
        try {
            m.buildXlsxWorkbook(makeOrders(), makeImageCache(), ExcelJS);
        } finally {
            global.ExcelJS = prev;
        }
        assert.ok(trace.autoFilter, 'autoFilter должен быть установлен');
        assert.strictEqual(trace.autoFilter.from, 'A1');
        assert.strictEqual(trace.autoFilter.to, 'J3');
    });

    test(`${name}: F4 buildXlsxWorkbook — условное форматирование C2:C (доставка) и G2:G (оплата)`, () => {
        const { ExcelJS, trace } = createExcelJsStub();
        const prev = global.ExcelJS;
        global.ExcelJS = ExcelJS;
        try {
            m.buildXlsxWorkbook(makeOrders(), makeImageCache(), ExcelJS);
        } finally {
            global.ExcelJS = prev;
        }
        const refs = trace.conditionalFormatting.map(c => c.ref);
        assert.ok(refs.some(r => /^C2:C\d+$/.test(r)), 'условное форматирование для C2:C (доставка)');
        assert.ok(refs.some(r => /^G2:G\d+$/.test(r)), 'условное форматирование для G2:G (оплата)');
    });

    test(`${name}: F4 buildXlsxWorkbook — картинка tl.col: 9 (0-based, колонка J)`, () => {
        const { ExcelJS, trace } = createExcelJsStub();
        const prev = global.ExcelJS;
        global.ExcelJS = ExcelJS;
        try {
            m.buildXlsxWorkbook(makeOrders(), makeImageCache(), ExcelJS);
        } finally {
            global.ExcelJS = prev;
        }
        assert.ok(trace.images.length > 0, 'должна быть добавлена картинка');
        const placed = trace.imagePlacements.find(p => p.imageId === 1);
        assert.ok(placed, 'картинка должна быть размещена на листе');
        assert.strictEqual(placed.opts.tl.col, 9);
        assert.strictEqual(placed.opts.tl.row, 1); // строка 2 → row-1 = 1
    });

    test(`${name}: F4 buildXlsxWorkbook — fallback URL фото в колонке 10`, () => {
        const { ExcelJS, trace } = createExcelJsStub();
        const prev = global.ExcelJS;
        global.ExcelJS = ExcelJS;
        try {
            // imageCache пустой → картинка не вставлена, должен быть URL в (row, 10)
            const cache = new Map();
            m.buildXlsxWorkbook(makeOrders(), cache, ExcelJS);
        } finally {
            global.ExcelJS = prev;
        }
        const cell = trace.cells['2,10'];
        assert.ok(cell, 'ячейка (2,10) должна существовать');
        assert.strictEqual(cell.value, 'https://cdn.example.com/photo-a.png');
    });

    test(`${name}: F4 buildXlsxWorkbook — mergeCells итоговой строки E:F (5,6)`, () => {
        const { ExcelJS, trace } = createExcelJsStub();
        const prev = global.ExcelJS;
        global.ExcelJS = ExcelJS;
        try {
            m.buildXlsxWorkbook(makeOrders(), makeImageCache(), ExcelJS);
        } finally {
            global.ExcelJS = prev;
        }
        const summaryRow = 4;
        // Фактический вызов в buildXlsxWorkbook: ws.mergeCells(summaryRow, 5, summaryRow, 6)
        const merge = trace.mergeCells.find(args =>
            args.length === 4 && args[0] === summaryRow && args[1] === 5 && args[2] === summaryRow && args[3] === 6
        );
        assert.ok(merge, `должен быть mergeCells(${summaryRow}, 5, ${summaryRow}, 6)`);
    });

    test(`${name}: F4 buildXlsxWorkbook — ширины колонок: A=14 и всего 10 ширин`, () => {
        const { ExcelJS, trace } = createExcelJsStub();
        const prev = global.ExcelJS;
        global.ExcelJS = ExcelJS;
        try {
            m.buildXlsxWorkbook(makeOrders(), makeImageCache(), ExcelJS);
        } finally {
            global.ExcelJS = prev;
        }
        assert.ok(Array.isArray(trace.columns), 'ws.columns должен быть массивом');
        assert.strictEqual(trace.columns.length, 10);
        assert.strictEqual(trace.columns[0].width, 14);
    });
}
