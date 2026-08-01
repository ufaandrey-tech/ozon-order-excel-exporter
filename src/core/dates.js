// ============================================================
// СЕКЦИЯ: src/core/dates.js
// Источник: ozon-orders-copier.user.js — блок «3. ПАРСИНГ РУССКОЙ ДАТЫ»
//   и «4b. ПАРСИНГ ДАТЫ ДОСТАВКИ»:
//   MONTHS_RU / MONTHS_RU_NAMES (727–733), yearForOrderMonth (737–743),
//   yearForDeliveryMonth (751–762), formatDateParts (764–770),
//   parseRussianDate (772–782), parseDeliveryDate (795–861).
// Зависимости: Diagnostics (только для logParseResult в диагностических
//   ветках parseRussianDate/parseDeliveryDate; объявлен в секции diagnostics).
// Объявляет: MONTHS_RU, MONTHS_RU_NAMES, yearForOrderMonth,
//   yearForDeliveryMonth, formatDateParts, parseRussianDate, parseDeliveryDate.
// ============================================================

    // ============================================================
    // 3. ПАРСИНГ РУССКОЙ ДАТЫ
    // ============================================================
    const MONTHS_RU = {
        'января': '01', 'февраля': '02', 'марта': '03',
        'апреля': '04', 'мая': '05', 'июня': '06',
        'июля': '07', 'августа': '08', 'сентября': '09',
        'октября': '10', 'ноября': '11', 'декабря': '12'
    };
    const MONTHS_RU_NAMES = Object.keys(MONTHS_RU).join('|');

    // Год ДАТЫ ЗАКАЗА: «Получен 6 декабря» в январе → прошлый год.
    // Заказ не может быть из будущего: месяц > текущего → год − 1.
    function yearForOrderMonth(monthNum) {
        const now = new Date();
        const m = +monthNum; // monthNum приходит строкой '01'..'12' — приводим явно
        let year = now.getFullYear();
        if (m > now.getMonth() + 1) year -= 1;
        return year;
    }

    // Год ДАТЫ ДОСТАВКИ (контекстный, Вариант C — согласовано 31.07.2026):
    //   1. Прошедшие события («Получен …», «хранится до …») — месяц БУДУЩЕГО
    //      относительно текущего → год − 1 (например «Получен 29 июля» в январе → 2025);
    //   2. Ожидаемые события («Ожидаем …», «Ожидаемая дата …») — месяц ПРОШЛОГО
    //      относительно текущего → год + 1 (например «Ожидаем 15 января» в декабре → 2027);
    //   3. Иначе — текущий год.
    function yearForDeliveryMonth(monthNum, statusText) {
        const now = new Date();
        const m = +monthNum;
        const cur = now.getMonth() + 1;
        let year = now.getFullYear();
        const s = String(statusText || '').toLowerCase();
        const isPast = /получен|хранится|получите|^до(?=\s)/i.test(s);
        const isFuture = /ожидаем|ожидаемая|ожидается/i.test(s);
        if (isPast && m > cur) year -= 1;
        else if (isFuture && m < cur) year += 1;
        return year;
    }

    function formatDateParts(day, monthName) {
        const month = MONTHS_RU[String(monthName).toLowerCase()] || '';
        if (!month) return '';
        const d = String(day).padStart(2, '0');
        const year = yearForOrderMonth(month);
        return `${d}.${month}.${year}`;
    }

    function parseRussianDate(text) {
        if (!text) return '';
        // Только явная дата в статусе вида "Получен 6 июля" / "6 июля" —
        // НЕ использовать для всего текста карточки (там «хранится до…»).
        const m = text.match(new RegExp(
            `(\\d{1,2})\\s+(${MONTHS_RU_NAMES})`,
            'i'
        ));
        if (m) return formatDateParts(m[1], m[2]);
        return '';
    }

    // ============================================================
    // 4b. ПАРСИНГ ДАТЫ ДОСТАВКИ
    // ============================================================
    // Поддерживает:
    // - "до 27 июля включительно" / "хранится до 28 июля"
    // - "Ожидаемая дата: 15 июля"
    // - "Ожидаем 15 июля, среда" / "Ожидаем15 июля" (orderlist «В пути»)
    // - "Ожидаемая дата: с 17 до 18 июля"
    // - "Доставка в пункт выдачи 17 - 18 июля"
    // - "17–18 июля" / "17 - 18 июля"
    // Диапазон возвращаем как "17–18.07.2026"
    function parseDeliveryDate(text) {
        if (!text) return '';
        // Сохраняем возможность «Ожидаем15» без пробела
        let src = String(text).replace(/\u00a0/g, ' ').trim();
        // «Ожидаем15 июля» → «Ожидаем 15 июля»
        src = src.replace(/(ожидаем)(\d)/gi, '$1 $2');
        src = src.replace(/\s+/g, ' ').trim();
        if (!src) return '';

        // Год доставки — контекстный (Вариант C): маркеры прошлого/будущего в statusText.
        // statusText = ИСХОДНЫЙ текст (text), а не нормализованный src.
        const fmt = (day, monthName) => {
            const month = MONTHS_RU[String(monthName).toLowerCase()] || '';
            if (!month) return '';
            const d = String(day).padStart(2, '0');
            const year = yearForDeliveryMonth(month, text);
            return `${d}.${month}.${year}`;
        };

        // Диапазон: "с 17 до 18 июля" / "17 - 18 июля" / "17–18 июля"
        let m = src.match(new RegExp(
            `(?:с\\s+)?(\\d{1,2})\\s*(?:[-–—]|до)\\s*(\\d{1,2})\\s+(${MONTHS_RU_NAMES})`,
            'i'
        ));
        if (m) {
            const month = MONTHS_RU[m[3].toLowerCase()] || '01';
            const year = yearForDeliveryMonth(month, text);
            const d1 = String(m[1]).padStart(2, '0');
            const d2 = String(m[2]).padStart(2, '0');
            if (d1 === d2) return `${d1}.${month}.${year}`;
            return `${d1}–${d2}.${month}.${year}`;
        }

        // "Ожидаем 15 июля, среда" / "Ожидаем15 июля" (после нормализации)
        m = src.match(new RegExp(
            `ожидаем\\s*(\\d{1,2})\\s+(${MONTHS_RU_NAMES})`,
            'i'
        ));
        if (m) return fmt(m[1], m[2]);

        // "Ожидаемая дата: 15 июля"
        m = src.match(new RegExp(
            `ожидаемая\\s+дата[:\\s]+(\\d{1,2})\\s+(${MONTHS_RU_NAMES})`,
            'i'
        ));
        if (m) return fmt(m[1], m[2]);

        // "до 27 июля включительно" / "до 27 июля"
        m = src.match(new RegExp(
            `до\\s+(\\d{1,2})\\s+(${MONTHS_RU_NAMES})`,
            'i'
        ));
        if (m) return fmt(m[1], m[2]);

        // "15 июля" / "15 июля, среда" в контексте доставки
        if (/доставк|ожида|пункт|хран/i.test(src)) {
            m = src.match(new RegExp(
                `(\\d{1,2})\\s+(${MONTHS_RU_NAMES})(?:\\s*,\\s*[а-яa-z]+)?`,
                'i'
            ));
            if (m) return fmt(m[1], m[2]);
        }

        // Диагностика: дата доставки не распознана — логируем сырой текст
        Diagnostics.logParseResult('', 'parseDeliveryDate', 'regex chain (диапазон/ожидаем/до/контекст)', src);
        return '';
    }
