// ============================================================
// Фаза E5: тесты каскада извлечения detailsAddress из orderdetails.
// extractAddressFromDoc(doc, orderNumber) — чистая функция по doc
// (querySelector/querySelectorAll), поэтому тесты используют МОК-документ
// без DOMParser. Diagnostics не включён (enabled=false по умолчанию) —
// вызовы logParseResult/logDomProbe безопасны.
//
// Селекторы каскада (в порядке вызова):
//   1. .b35_5_3-b4.tsBody400Small → .b35_5_2-b4.tsBody400Small → .b35_5_1-b4.tsBody400Small
//   2. [class*="b35"] span { текст начинается с «Пункт (Ozon|выдачи),» }
//   3. .tsCompactControl500Medium (если /пункт/i)
// Затем — DOM-пробы (querySelectorAll по списку селекторов + '*'),
// результат НЕ влияет на address.
// ============================================================

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const userScript = require('../dist/ozon-orders-copier.user.js');

const implementations = [
    { name: 'userscript', m: userScript }
];

// Фейковый элемент: минимальный объект, который читает extractAddressFromDoc
// (textContent, className, outerHTML, tagName).
const fakeEl = (textContent, className) => ({
    textContent,
    className,
    outerHTML: `<span class="${className}">${textContent}</span>`,
    tagName: 'SPAN'
});

// Универсальный мок-документ: querySelector ищет по карте селекторов,
// querySelectorAll возвращает массив (по умолчанию пустой).
function mockDoc(selectorsMap) {
    return {
        querySelector(sel) {
            return (selectorsMap[sel] !== undefined) ? selectorsMap[sel] : null;
        },
        querySelectorAll() {
            return [];
        }
    };
}

// ============================================================
// E5: .b35_5_3-b4.tsBody400Small (актуальная разметка) → адрес извлечён
// ============================================================
for (const { name, m } of implementations) {
    test(`${name}: E5 detailsAddress — .b35_5_3-b4.tsBody400Small → адрес извлечён`, () => {
        const doc = mockDoc({
            '.b35_5_3-b4.tsBody400Small': fakeEl('Пункт Ozon, Россия, Москва, ул. Тестовая, 1', 'b35_5_3-b4 tsBody400Small')
        });
        const { address } = m.extractAddressFromDoc(doc, '00000000-0001');
        assert.strictEqual(address, 'Россия, Москва, ул. Тестовая, 1');
    });

    test(`${name}: E5 detailsAddress — .b35_5_2-b4 (старая разметка) → адрес извлечён (fallback)`, () => {
        // Точный селектор .b35_5_3 отсутствует → null, срабатывает .b35_5_2
        const doc = mockDoc({
            '.b35_5_2-b4.tsBody400Small': fakeEl('Пункт Ozon, Россия, Москва, ул. Тестовая, 2', 'b35_5_2-b4 tsBody400Small')
        });
        const { address } = m.extractAddressFromDoc(doc, '00000000-0002');
        assert.strictEqual(address, 'Россия, Москва, ул. Тестовая, 2');
    });

    test(`${name}: E5 detailsAddress — структурный fallback [class*="b35"] span{^Пункт (Ozon|выдачи)}`, () => {
        // Все точные хэши отсутствуют; структурный fallback находит span с «Пункт Ozon,»
        const doc = {
            querySelector() {
                return null; // все точные селекторы и .tsCompactControl500Medium — null
            },
            querySelectorAll(sel) {
                if (sel === '[class*="b35"] span') {
                    return [fakeEl('Пункт Ozon, Россия, Москва, ул. Тестовая, 3', 'b35_5_9-b4 tsBody400Small')];
                }
                return [];
            }
        };
        const { address } = m.extractAddressFromDoc(doc, '00000000-0003');
        assert.strictEqual(address, 'Россия, Москва, ул. Тестовая, 3');
    });

    test(`${name}: E5 detailsAddress — .tsCompactControl500Medium (последний шанс) → адрес извлечён`, () => {
        const doc = mockDoc({
            '.tsCompactControl500Medium': fakeEl('Пункт Ozon: Россия, Москва, ул. Тестовая, 4', 'tsCompactControl500Medium')
        });
        const { address } = m.extractAddressFromDoc(doc, '00000000-0004');
        assert.strictEqual(address, 'Россия, Москва, ул. Тестовая, 4');
    });

    test(`${name}: E5 detailsAddress — doc без адреса → ''`, () => {
        const doc = mockDoc({});
        const { address } = m.extractAddressFromDoc(doc, '00000000-0005');
        assert.strictEqual(address, '');
    });
}
