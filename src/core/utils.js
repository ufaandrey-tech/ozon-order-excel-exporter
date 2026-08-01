// ============================================================
// СЕКЦИЯ: src/core/utils.js
// Источник: ozon-orders-copier.user.js — блок «1c. УТИЛИТЫ»,
//   escapeHtml (394–403), backoffDelay (452–455),
//   extractComposerAction (461–483), dedupeOrders (487–497),
//   safeCell (717–722).
// Зависимости: нет (чистые функции, DOM/GM не читают).
// Объявляет: escapeHtml, backoffDelay, extractComposerAction,
//   dedupeOrders, safeCell.
// ============================================================

    // ============================================================
    // 1c. УТИЛИТЫ (escapeHtml, fetchWithTimeout, backoffDelay)
    // ============================================================
    // Экранирование HTML: защита от XSS при вставке произвольных строк
    // (orderNumber, названия товаров, цены из JSON) в innerHTML.
    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&' + 'amp;')
            .replace(/</g, '&' + 'lt;')
            .replace(/>/g, '&' + 'gt;')
            .replace(/"/g, '&' + 'quot;')
            .replace(/'/g, '&' + '#39;')
            .replace(/`/g, '&' + '#96;');
    }

    // Экспоненциальная задержка между retry: 500/1000/2000/4000/5000 (cap) + джиттер ≤ 200 мс.
    function backoffDelay(attempt) {
        const base = Math.min(500 * Math.pow(2, attempt), 5000);
        return base + Math.random() * 200;
    }

    // Чистое извлечение номера заказа из COMPOSER_ACTION-ссылки (base64 data-параметр).
    // Возвращает номер вида "58957649-0583" (общий префикс postings[0]) или null.
    // Устойчив к URL-кодированию (%3D, %2B) и символу «+» — легальному символу base64.
    // Никогда не бросает исключение: при битом base64/JSON возвращает null.
    function extractComposerAction(url) {
        if (!url) return null;
        const s = String(url);
        const dm = s.match(/[?&]data=([A-Za-z0-9_\-=%+]+)/);
        if (!dm) return null;
        let b64 = dm[1];
        try {
            b64 = decodeURIComponent(b64).replace(/ /g, '+');
        } catch(e) {
            return null;
        }
        try {
            const parsed = JSON.parse(atob(b64));
            const postings = parsed?.postings;
            if (Array.isArray(postings) && postings.length > 0) {
                const m2 = String(postings[0]).match(/^(\d+-\d+)/);
                if (m2) return m2[1];
            }
        } catch(e) {
            return null;
        }
        return null;
    }

    // Дедупликация заказов по orderNumber: первый заказ сохраняется, дубли удаляются.
    // НЕ мутирует исходный массив — возвращает новый массив уникальных заказов.
    function dedupeOrders(orders) {
        const seen = new Set();
        const result = [];
        for (const o of orders || []) {
            if (!seen.has(o.orderNumber)) {
                seen.add(o.orderNumber);
                result.push(o);
            }
        }
        return result;
    }

    // Защита от формульной инъекции: строка, начинающаяся с = + - @,
    // при вставке в TSV/XLSX интерпретируется Excel как формула.
    // Префикс-апостроф делает значение безопасным текстом (в Excel
    // апостроф в начале ячейки не отображается). Числа не трогаем —
    // они не начинаются с =+-@, пустые значения возвращаем как есть.
    function safeCell(value) {
        if (value == null) return '';
        const s = String(value);
        if (s === '') return '';
        return /^[=+\-@]/.test(s) ? "'" + s : s;
    }
