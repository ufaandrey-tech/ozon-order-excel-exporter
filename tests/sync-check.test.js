// ============================================================
// F6: Тест синхронности двух файлов (D6).
// Загружает оба файла через require, берёт тела функций из
// экспорта F1 и сравнивает после нормализации:
//  - удаляются комментарии (//… и /*…*/);
//  - удаляются пробелы/табуляции/переносы ВНЕ строковых литералов;
//  - содержимое строковых литералов заменяется плейсхолдерами
//    (чтобы не было ложных различий из-за путей/текстов).
// Платформенные блоки (GM_*, STYLE_CSS, textarea, @match/@require)
// — вне сравнения: они не входят в тела чистых функций.
// ============================================================

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const userScript = require('../ozon-orders-copier.user.js');
const extension = require('../extension/content.js');

// Список функций для сравнения — все экспортируемые чистые функции.
const FUNCTIONS_TO_COMPARE = [
    'yearForOrderMonth',
    'yearForDeliveryMonth',
    'parsePrice',
    'normalizeStatus',
    'normalizePaymentStatus',
    'parseRussianDate',
    'parseDeliveryDate',
    'escapeHtml',
    'backoffDelay',
    'formatTSV',
    'dedupeOrders',
    'fetchWithTimeout',
    'fetchOrderDetails',
    'detectImageType',
    'extractComposerAction',
    'buildXlsxWorkbook',
    'downloadXLSX'
];

// --- Нормализация кода ---
// Лексер: заменяет строковые литералы на плейсхолдеры, удаляет
// комментарии и весь whitespace вне строк.
function normalizeFunction(fn) {
    const src = Function.prototype.toString.call(fn);
    return normalizeCode(src);
}

function normalizeCode(src) {
    let out = '';
    let i = 0;
    const n = src.length;
    const isSpace = (ch) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v';

    while (i < n) {
        const ch = src[i];
        const next = src[i + 1];

        // Комментарий //…
        if (ch === '/' && next === '/') {
            while (i < n && src[i] !== '\n') i++;
            continue;
        }
        // Комментарий /*…*/
        if (ch === '/' && next === '*') {
            i += 2;
            while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
            i += 2;
            continue;
        }
        // Строковый литерал '…'
        if (ch === "'" || ch === '"') {
            const quote = ch;
            out += ch;
            i++;
            while (i < n) {
                const c = src[i];
                out += c;
                i++;
                if (c === '\\') {
                    // escape-последовательность
                    if (i < n) { out += src[i]; i++; }
                    continue;
                }
                if (c === quote) break;
            }
            continue;
        }
        // Template literal `…`: литеральный текст СОХРАНЯЕМ (после удаления
        // whitespace он сравним), а вложенный код ${…} заменяем на
        // плейсхолдер. Так различия в литеральном тексте (например,
        // «✅ Скачан XLSX: …») реально обнаруживаются, а платформенный
        // код внутри ${…} не даёт ложных расхождений.
        if (ch === '`') {
            out += '`';
            i++;
            let depth = 0;
            while (i < n) {
                const c = src[i];
                if (depth > 0) {
                    // Внутри ${…}: содержимое интерполяции не влияет на
                    // сравнение — пропускаем его целиком, корректно
                    // отслеживая вложенные ${…}, строки и шаблоны.
                    if (c === '\\') { i += 2; continue; }
                    if (c === '$' && src[i + 1] === '{') { depth++; i += 2; continue; }
                    if (c === '}') {
                        depth--;
                        if (depth === 0) { out += '`TMPL`'; }
                        i++;
                        continue;
                    }
                    if (c === "'" || c === '"') {
                        const q = c;
                        i++;
                        while (i < n) {
                            const sc = src[i];
                            if (sc === '\\') { i += 2; continue; }
                            i++;
                            if (sc === q) break;
                        }
                        continue;
                    }
                    if (c === '`') {
                        // вложенный template literal внутри ${…}
                        i++;
                        let d2 = 0;
                        while (i < n) {
                            const sc = src[i];
                            if (sc === '\\') { i += 2; continue; }
                            if (sc === '`') {
                                if (d2 === 0) { i++; break; }
                                i++;
                                continue;
                            }
                            if (sc === '$' && src[i + 1] === '{') { d2++; i += 2; continue; }
                            if (sc === '}' && d2 > 0) { d2--; i++; continue; }
                            i++;
                        }
                        continue;
                    }
                    i++;
                    continue;
                }
                if (c === '\\') {
                    // экранированная последовательность в шаблоне
                    out += src[i]; i++;
                    if (i < n) { out += src[i]; i++; }
                    continue;
                }
                if (c === '`') {
                    out += '`'; i++; break;
                }
                if (c === '$' && src[i + 1] === '{') {
                    depth++;
                    out += '${';
                    i += 2;
                    continue;
                }
                // литеральный фрагмент: пробельные символы пропускаем,
                // остальное копируем как есть
                if (isSpace(c)) { i++; continue; }
                out += c;
                i++;
            }
            continue;
        }
        // Регэксп-литерал /…/ — сложно отличить от деления;
        // в телах функций регэкспы есть. Заменяем их плейсхолдером,
        // чтобы символы внутри (пробелы, слэши) не влияли на сравнение.
        if (ch === '/' && !isSpace(next) && next !== '*' && next !== '/') {
            // Пытаемся распознать регэксп: от текущей позиции до
            // незаэкранированного '/' (с учётом флагов [a-z]*).
            let j = i + 1;
            let inClass = false;
            let ok = false;
            while (j < n) {
                const c = src[j];
                if (c === '\\') { j += 2; continue; }
                if (c === '[') { inClass = true; j++; continue; }
                if (c === ']') { inClass = false; j++; continue; }
                if (c === '/' && !inClass) { j++; ok = true; break; }
                if (c === '\n') break;
                j++;
            }
            if (ok) {
                // флаги
                while (j < n && /[a-z]/i.test(src[j])) j++;
                out += '`RE`';
                i = j;
                continue;
            }
        }

        if (isSpace(ch)) {
            i++;
            continue;
        }
        out += ch;
        i++;
    }
    return out;
}

// Улучшенный лексер: литеральный текст template literal сохраняется (после
// удаления whitespace), а вложенный код ${…} заменяется плейсхолдером.
// Это позволяет обнаруживать различия внутри литералов (например,
// «✅ Скачан XLSX: …») без ложных FAIL от платформенного кода в ${…}.
test('F6: нормализация template literal сохраняет литерал, маскирует ${…}', () => {
    const a = 'const x = `Товар: ${a} шт`;';
    const b = 'const x = `ТоварX: ${a} шт`;';
    const c = 'const x = `Товар: ${a} шт`;';
    const d = 'const x = `Товар: ${zzzzzzzz} шт`;';
    const e = 'const x = `Товар: ${a} шт`; // комментарий';
    assert.strictEqual(normalizeCode(a), normalizeCode(c), 'одинаковые литералы должны быть равны');
    assert.notStrictEqual(normalizeCode(a), normalizeCode(b), 'разные литералы должны различаться');
    assert.strictEqual(normalizeCode(a), normalizeCode(d), 'разный код внутри ${…} не должен влиять');
    assert.strictEqual(normalizeCode(a), normalizeCode(e), 'комментарий после шаблона не должен ломать');
});

test('F6: оба файла экспортируют одинаковый набор функций', () => {
    const keysU = Object.keys(userScript).sort();
    const keysE = Object.keys(extension).sort();
    assert.deepStrictEqual(keysU, keysE, 'наборы экспортируемых функций должны совпадать');
    for (const fn of FUNCTIONS_TO_COMPARE) {
        assert.ok(typeof userScript[fn] === 'function', `userscript должен экспортировать ${fn}`);
        assert.ok(typeof extension[fn] === 'function', `extension должен экспортировать ${fn}`);
    }
});

test('F6: тела чистых функций идентичны после нормализации', () => {
    const mismatches = [];
    for (const fn of FUNCTIONS_TO_COMPARE) {
        const u = normalizeFunction(userScript[fn]);
        const e = normalizeFunction(extension[fn]);
        if (u !== e) {
            mismatches.push(fn);
        }
    }
    assert.deepStrictEqual(mismatches, [], 'тела функций userscript и extension должны совпадать после нормализации');
});

// --- Отдельная проверка: регэкспы и строки в нормализации не ломают сравнение ---
test('F6: нормализация не ломает сами функции (контрольный вызов)', () => {
    // Простые контрольные проверки, что require-модули работают после нормализации
    assert.strictEqual(typeof userScript.escapeHtml, 'function');
    assert.strictEqual(typeof extension.escapeHtml, 'function');
    assert.strictEqual(userScript.escapeHtml('<b>'), extension.escapeHtml('<b>'));
    assert.strictEqual(userScript.parsePrice('1 102 ₽'), extension.parsePrice('1 102 ₽'));
});
