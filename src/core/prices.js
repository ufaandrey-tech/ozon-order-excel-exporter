// ============================================================
// СЕКЦИЯ: src/core/prices.js
// Источник: ozon-orders-copier.user.js — блок «4. ПАРСИНГ ЦЕНЫ ИЗ data-state»:
//   parsePrice (866–873).
// Зависимости: нет (чистая функция).
// Объявляет: parsePrice.
// ============================================================

    // ============================================================
    // 4. ПАРСИНГ ЦЕНЫ ИЗ data-state
    // ============================================================
    function parsePrice(text) {
        if (!text) return '';
        // "1 102 ₽" → 1102, "8 573 ₽" → 8573
        const cleaned = text.replace(/[^\d,.]/g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        if (isNaN(num)) return '';
        return formatAmount(num);
    }
