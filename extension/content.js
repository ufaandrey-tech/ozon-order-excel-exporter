// ================================================================
// Ozon Order Copier — Chrome Extension (Manifest V3)
// Портировано из Tampermonkey-скрипта v9.14
// ExcelJS загружается через manifest.json → content_scripts.js
// ================================================================

(function() {
    'use strict';

    // ============================================================
    // 1. СТИЛИ
    // ============================================================
    const STYLE_CSS = `
        .ozon-copy-btn {
            position: fixed !important;
            bottom: 24px !important;
            right: 24px !important;
            z-index: 999999 !important;
            padding: 14px 24px !important;
            background: #005bff !important;
            color: #fff !important;
            border: none !important;
            border-radius: 12px !important;
            font-size: 16px !important;
            font-weight: 600 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            cursor: pointer !important;
            box-shadow: 0 4px 20px rgba(0, 91, 255, 0.4) !important;
            transition: all 0.2s ease !important;
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
            white-space: nowrap !important;
        }
        .ozon-copy-btn:hover {
            background: #004ed9 !important;
            box-shadow: 0 6px 24px rgba(0, 91, 255, 0.55) !important;
            transform: translateY(-2px) !important;
        }
        .ozon-copy-btn:active {
            transform: translateY(0) !important;
        }
        .ozon-copy-btn--loading {
            opacity: 0.7 !important;
            pointer-events: none !important;
        }
        .ozon-copy-btn--success {
            background: #0ab463 !important;
            box-shadow: 0 4px 20px rgba(10, 180, 99, 0.4) !important;
        }
        .ozon-copy-btn--error {
            background: #f44336 !important;
            box-shadow: 0 4px 20px rgba(244, 67, 54, 0.4) !important;
        }
        .ozon-xlsx-btn {
            position: fixed !important;
            bottom: 84px !important;
            right: 24px !important;
            z-index: 999999 !important;
            padding: 14px 24px !important;
            background: #0ab463 !important;
            color: #fff !important;
            border: none !important;
            border-radius: 12px !important;
            font-size: 16px !important;
            font-weight: 600 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            cursor: pointer !important;
            box-shadow: 0 4px 20px rgba(10, 180, 99, 0.4) !important;
            transition: all 0.2s ease !important;
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
            white-space: nowrap !important;
        }
        .ozon-xlsx-btn:hover {
            background: #089e53 !important;
            box-shadow: 0 6px 24px rgba(10, 180, 99, 0.55) !important;
            transform: translateY(-2px) !important;
        }
        .ozon-xlsx-btn:active {
            transform: translateY(0) !important;
        }
        .ozon-copy-toast {
            position: fixed !important;
            bottom: 24px !important;
            left: 24px !important;
            z-index: 1000000 !important;
            padding: 12px 20px !important;
            border-radius: 10px !important;
            font-size: 14px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            opacity: 0 !important;
            transform: translateY(10px) !important;
            transition: all 0.3s ease !important;
            pointer-events: none !important;
        }
        .ozon-copy-toast--show {
            opacity: 1 !important;
            transform: translateY(0) !important;
            pointer-events: auto !important;
        }
        .ozon-copy-toast--success {
            background: #e8f5e9 !important;
            color: #2e7d32 !important;
            border: 1px solid #a5d6a7 !important;
        }
        .ozon-copy-toast--error {
            background: #fbe9e7 !important;
            color: #c62828 !important;
            border: 1px solid #ef9a9a !important;
        }
        .ozon-copy-counter {
            position: fixed !important;
            bottom: 80px !important;
            left: 24px !important;
            right: auto !important;
            z-index: 999998 !important;
            background: #fff !important;
            border-radius: 12px !important;
            padding: 16px 20px !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            font-size: 14px !important;
            min-width: 280px !important;
            max-height: 400px !important;
            overflow-y: auto !important;
            opacity: 0 !important;
            transform: translateY(10px) !important;
            transition: all 0.3s ease !important;
        }
        .ozon-copy-counter--show {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
        .ozon-copy-counter table {
            border-collapse: collapse !important;
            width: 100% !important;
            font-size: 13px !important;
        }
        .ozon-copy-counter td {
            padding: 2px 6px !important;
            border-bottom: 1px solid #f0f0f0 !important;
            vertical-align: top !important;
        }
        .ozon-copy-counter td:last-child {
            text-align: right !important;
            font-weight: 600 !important;
            white-space: nowrap !important;
        }
        .ozon-copy-counter .summary {
            font-weight: 700 !important;
            padding-top: 8px !important;
            border-top: 2px solid #005bff !important;
        }
        .ozon-copy-counter .product-name {
            color: #666 !important;
            font-size: 11px !important;
            display: block !important;
            max-width: 180px !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
        }
        .ozon-copy-progress {
            position: fixed !important;
            bottom: 80px !important;
            left: 24px !important;
            right: auto !important;
            z-index: 999998 !important;
            background: #fff !important;
            border-radius: 12px !important;
            padding: 16px 24px !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            font-size: 14px !important;
            color: #333 !important;
            display: flex !important;
            align-items: center !important;
            gap: 12px !important;
        }
        .ozon-copy-progress .spinner {
            width: 20px;
            height: 20px;
            border: 3px solid #e0e0e0;
            border-top-color: #005bff;
            border-radius: 50%;
            animation: ozon-spin 0.8s linear infinite;
        }
        @keyframes ozon-spin {
            to { transform: rotate(360deg); }
        }

        /* На узких экранах — предпросмотр и прогресс над кнопками, иначе перекрываются */
        @media (max-width: 700px) {
            .ozon-copy-counter,
            .ozon-copy-progress {
                left: 24px !important;
                right: 24px !important;
                bottom: 200px !important;
                min-width: auto !important;
                max-width: none !important;
            }
        }
        .ozon-diag-btn {
            position: fixed !important;
            bottom: 144px !important;
            right: 24px !important;
            z-index: 999999 !important;
            padding: 14px 24px !important;
            background: #6b46c1 !important;
            color: #fff !important;
            border: none !important;
            border-radius: 12px !important;
            font-size: 16px !important;
            font-weight: 600 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            cursor: pointer !important;
            box-shadow: 0 4px 20px rgba(107, 70, 193, 0.4) !important;
            transition: all 0.2s ease !important;
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
            white-space: nowrap !important;
        }
        .ozon-diag-btn:hover {
            background: #5a3aa8 !important;
            box-shadow: 0 6px 24px rgba(107, 70, 193, 0.55) !important;
            transform: translateY(-2px) !important;
        }
        .ozon-diag-btn:active {
            transform: translateY(0) !important;
        }
        .ozon-diag-btn--loading {
            opacity: 0.7 !important;
            pointer-events: none !important;
        }
        .ozon-diag-btn--success {
            background: #0ab463 !important;
            box-shadow: 0 4px 20px rgba(10, 180, 99, 0.4) !important;
        }
        .ozon-diag-btn--error {
            background: #f44336 !important;
            box-shadow: 0 4px 20px rgba(244, 67, 54, 0.4) !important;
        }
    `;
    const styleEl = document.createElement('style');
    styleEl.textContent = STYLE_CSS;
    document.head.appendChild(styleEl);

    // ============================================================
    // 1b. ДИАГНОСТИЧЕСКИЙ МОДУЛЬ
    // ============================================================
    // Включается только при нажатии кнопки «🔬 Диагностика».
    // Собирает:
    //   - errors[]:         заказ → этап → сырые данные → текст ошибки
    //   - rawSnapshots[]:   заказ → cardHTML, stateOrderList JSON, shipmentWidgets JSON
    //   - parseResults[]:   заказ → поле → ожидаемый путь → фактическое значение → OK/FAIL
    //   - imageLogs[]:      url → HTTP-статус → байты → результат вставки в Excel
    // ============================================================
    const SCRIPT_VERSION = '9.13';
    const Diagnostics = {
        enabled: false,
        errors: [],
        rawSnapshots: [],
        parseResults: [],
        imageLogs: [],
        // Новое: пробы DOM-селекторов и снимки страницы orderdetails
        domProbes: [],
        orderDetailsSnapshots: [],

        /** Сброс накопленных данных перед новым запуском. */
        reset() {
            this.errors = [];
            this.rawSnapshots = [];
            this.parseResults = [];
            this.imageLogs = [];
            this.domProbes = [];
            this.orderDetailsSnapshots = [];
        },

        /** Зафиксировать ошибку на любом этапе обработки заказа. */
        logError(orderNumber, stage, raw, error) {
            if (!this.enabled) return;
            this.errors.push({
                timestamp: new Date().toISOString(),
                orderNumber: orderNumber || '',
                stage: stage || '',
                raw: this._toString(raw),
                error: error ? (error.message || String(error)) : ''
            });
        },

        /** Зафиксировать результат извлечения конкретного поля. */
        logParseResult(orderNumber, field, expectedPath, actualValue) {
            if (!this.enabled) return;
            this.parseResults.push({
                timestamp: new Date().toISOString(),
                orderNumber: orderNumber || '',
                field: field || '',
                expectedPath: expectedPath || '',
                actualValue: this._toString(actualValue),
                status: actualValue ? 'OK' : 'FAIL'
            });
        },

        /** Сохранить сырой снимок DOM/JSON для заказа (для воспроизведения проблемы).
         *  БЕЗ обрезки — Markdown не имеет лимита ячейки в 32767 символов. */
        snapshotRawData(orderNumber, cardHTML, stateOrderListJSON, shipmentWidgetsJSON) {
            if (!this.enabled) return;
            this.rawSnapshots.push({
                timestamp: new Date().toISOString(),
                orderNumber: orderNumber || '',
                cardHTML: this._toString(cardHTML),
                stateOrderListJSON: this._toString(stateOrderListJSON),
                shipmentWidgetsJSON: this._toString(shipmentWidgetsJSON),
                userAgent: navigator.userAgent,
                pageUrl: window.location.href,
                scriptVersion: SCRIPT_VERSION
            });
        },

        /** Зафиксировать результат пробы набора CSS-селекторов на DOM-элементе.
         *  Позволяет LLM увидеть, какие селекторы срабатывают, а какие — нет,
         *  и восстановить актуальную структуру DOM для pickupPoint / detailsAddress. */
        logDomProbe(orderNumber, scope, rootSelector, probes) {
            if (!this.enabled) return;
            this.domProbes.push({
                timestamp: new Date().toISOString(),
                orderNumber: orderNumber || '',
                scope: scope || '',           // 'orderlist' | 'orderdetails'
                rootSelector: rootSelector || '',
                probes: probes || []          // [{ selector, found, text, html, count }]
            });
        },

        /** Сохранить полный снимок страницы orderdetails (HTML + найденные shipmentWidgets).
         *  Нужен, чтобы LLM видел реальную разметку страницы деталей заказа. */
        snapshotOrderDetails(orderNumber, html, shipmentWidgetsCount) {
            if (!this.enabled) return;
            this.orderDetailsSnapshots.push({
                timestamp: new Date().toISOString(),
                orderNumber: orderNumber || '',
                html: this._toString(html),
                shipmentWidgetsCount: shipmentWidgetsCount || 0,
                pageUrl: window.location.href
            });
        },

        /** Зафиксировать этап обработки фото товара. */
        logImage(url, httpStatus, bytes, result, error) {
            if (!this.enabled) return;
            this.imageLogs.push({
                timestamp: new Date().toISOString(),
                url: url || '',
                httpStatus: httpStatus || '',
                bytes: bytes || 0,
                result: result || '',
                error: error ? (error.message || String(error)) : ''
            });
        },

        /** Метаданные окружения для шапки отчёта. */
        getEnvironment() {
            return {
                timestamp: new Date().toISOString(),
                scriptVersion: SCRIPT_VERSION,
                pageUrl: window.location.href,
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                viewport: `${window.innerWidth}x${window.innerHeight}`
            };
        },

        /** Привести произвольное значение к строке без обрезки. */
        _toString(value) {
            if (value == null) return '';
            if (typeof value === 'string') return value;
            try { return JSON.stringify(value); } catch (e) { return String(value); }
        }
    };

    // ============================================================
    // 2. СТАТУСЫ
    // ============================================================
    function normalizeStatus(text) {
        if (!text) return '';
        const raw = text.trim();
        const t = raw.toLowerCase().replace(/\s+/g, ' ');
        const map = {
            'оплачен': '✅ Оплачен',
            'оплачено': '✅ Оплачен',
            'не оплачен': '❌ Не оплачен',
            'не оплачено': '❌ Не оплачен',
            'к оплате при получении': '⏳ При получении',
            'к оплате': '⏳ При получении',
            'ожидает': '⏳ Ожидает оплаты',
            'ожидает оплаты': '⏳ Ожидает оплаты',
            'частично': '🟡 Частично оплачен',
            'частично оплачен': '🟡 Частично оплачен',
            'возврат': '🔄 Возврат',
            'доставлен': '✅ Доставлен',
            'доставлено': '✅ Доставлен',
            'получен': '✅ Доставлен',
            'получено': '✅ Доставлен',
            'можно забирать': '📦 Готов к выдаче',
            'в пути': '🚚 В пути',
            'передан': '🚚 Передан в доставку',
            'передан в доставку': '🚚 Передан в доставку',
            'передаётся в доставку': '🚚 Передаётся в доставку',
            'передается в доставку': '🚚 Передаётся в доставку',
            'передаётся': '🚚 Передаётся в доставку',
            'передается': '🚚 Передаётся в доставку',
            'собирается': '📦 Собирается',
            'собираем': '📦 Собирается',
            'обрабатывается': '📦 Обрабатывается',
            'отменён': '❌ Отменён',
            'отменен': '❌ Отменён',
            'отменено': '❌ Отменён',
        };
        if (map[t]) return map[t];

        // Частичные вхождения (плашки, title, длинные фразы)
        if (/(^|\s)не\s+оплачен/i.test(t) || t.includes('неоплачен')) return '❌ Не оплачен';
        if (t.includes('к оплате')) return '⏳ При получении';
        if (/(частично).*(оплач)/i.test(t)) return '🟡 Частично оплачен';
        if (/(^|\s)оплачен/i.test(t) && !t.includes('не оплачен')) return '✅ Оплачен';

        if (t.includes('можно забирать')) return '📦 Готов к выдаче';
        if (t.includes('в пути')) return '🚚 В пути';
        if (t.includes('передаётся') || t.includes('передается')) return '🚚 Передаётся в доставку';
        if (t.includes('отмен')) return '❌ Отменён';
        if (t.includes('доставлен') || t.includes('получен')) return '✅ Доставлен';
        if (t.includes('собираем')) return '📦 Собирается';

        // Диагностика: статус не распознан — логируем сырой текст
        Diagnostics.logParseResult('', 'normalizeStatus', 'map[] + частичные вхождения', raw);
        return raw;
    }

    // Только статус оплаты (не путать с «2 шт» и прочим текстом карточки)
    function normalizePaymentStatus(text) {
        if (!text) return '';
        // Важно: сначала нормализуем «не\s*оплачен» и «НЕОПЛАЧЕН»
        const t = String(text)
            .toLowerCase()
            .replace(/\u00a0/g, ' ')
            .replace(/[^\S\r\n]+/g, ' ')
            .trim();
        if (!t) return '';

        // НЕ ОПЛАЧЕН / НЕОПЛАЧЕН / не_оплачен — до проверки «оплачен»
        if (/не\s*[-_]?\s*оплачен/i.test(t) || t.includes('неоплачен')) return '❌ Не оплачен';
        if (t.includes('к оплате')) return '⏳ При получении';
        if (t.includes('ожидает') && t.includes('оплат')) return '⏳ Ожидает оплаты';
        if (/(частично).*(оплач)/i.test(t)) return '🟡 Частично оплачен';
        if (t.includes('возврат') && t.includes('оплат')) return '🔄 Возврат';
        // Только явно «оплачен» без «не»
        if (/(^|[^а-яa-z])оплачен/i.test(t) && !/не\s*[-_]?\s*оплачен/i.test(t)) return '✅ Оплачен';
        return '';
    }

    // Собрать все статусы оплаты из произвольного значения; при смешанных — приоритет «Не оплачен»
    function collectPaymentStatuses(value, acc, depth) {
        if (value == null || depth > 6) return;
        if (!acc) return;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            const n = normalizePaymentStatus(String(value));
            if (n) acc.add(n);
            return;
        }
        if (Array.isArray(value)) {
            for (const item of value) collectPaymentStatuses(item, acc, depth + 1);
            return;
        }
        if (typeof value === 'object') {
            for (const key of Object.keys(value)) {
                if (/image|url|href|link|icon|svg|rgb|color|price|button|action|src/i.test(key)) continue;
                collectPaymentStatuses(value[key], acc, depth + 1);
            }
        }
    }

    function pickBestPaymentStatus(statuses) {
        if (!statuses || !statuses.size) return '';
        // Приоритет: не оплачен > к оплате > ожидает > частично > возврат > оплачен
        const order = [
            '❌ Не оплачен',
            '⏳ При получении',
            '⏳ Ожидает оплаты',
            '🟡 Частично оплачен',
            '🔄 Возврат',
            '✅ Оплачен'
        ];
        for (const s of order) {
            if (statuses.has(s)) return s;
        }
        return [...statuses][0] || '';
    }

    function extractPaymentStatusFromAny(value) {
        const acc = new Set();
        collectPaymentStatuses(value, acc, 0);
        return pickBestPaymentStatus(acc);
    }

    function extractProductPaymentStatus(product) {
        if (!product) return '';

        // Явные кандидаты вокруг фото/бейджа (приоритет над deep walk)
        const preferred = [
            product.picture?.badge,
            product.picture?.label,
            product.picture?.status,
            product.picture?.tag,
            product.picture?.tags,
            product.picture?.image?.badge,
            product.picture?.image?.label,
            product.badge,
            product.badges,
            product.label,
            product.labels,
            product.tag,
            product.tags,
            product.status,
            product.paymentStatus,
            product.payment,
            product.subtitle,
            product.captions,
            product.info,
            product.tile,
            product.footer
        ];

        const acc = new Set();
        for (const c of preferred) {
            collectPaymentStatuses(c, acc, 0);
        }
        const preferredHit = pickBestPaymentStatus(acc);
        if (preferredHit) return preferredHit;

        // Deep walk: если в product есть НЕ ОПЛАЧЕН — выбираем его, даже если где-то «оплачен»
        return extractPaymentStatusFromAny(product);
    }

    // Не перетирать item unpaid order-level paid
    function mergePaymentStatus(itemPay, orderPay) {
        if (itemPay) return itemPay;
        return orderPay || '';
    }

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

    function currentYearForMonth(monthNum) {
        // Если месяц сильно «из прошлого» относительно текущего (напр. декабрь при январе) —
        // оставляем текущий год; Ozon не даёт год явно. Для июля 2026 ~ now ок.
        return new Date().getFullYear();
    }

    function formatDateParts(day, monthName) {
        const month = MONTHS_RU[String(monthName).toLowerCase()] || '';
        if (!month) return '';
        const d = String(day).padStart(2, '0');
        const year = currentYearForMonth(month);
        return `${d}.${month}.${year}`;
    }

    // dd.mm.yyyy -> проверка валидности; Date НЕ используем в Excel (timezone shift 15→14)
    function isValidDdMmYyyy(str) {
        if (!str) return false;
        const m = String(str).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (!m) return false;
        const day = parseInt(m[1], 10);
        const month = parseInt(m[2], 10);
        const year = parseInt(m[3], 10);
        if (month < 1 || month > 12 || day < 1 || day > 31) return false;
        const dt = new Date(year, month - 1, day);
        return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day;
    }

    // Excel-safe: ВСЕГДА строка dd.mm.yyyy или диапазон «17–18.07.2026».
    // new Date(y,m,d) + ExcelJS даёт сдвиг на −1 день в TZ UTC+3.
    function toExcelDateValue(dateStr) {
        if (!dateStr) return '';
        return String(dateStr);
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

        // Диапазон: "с 17 до 18 июля" / "17 - 18 июля" / "17–18 июля"
        let m = src.match(new RegExp(
            `(?:с\\s+)?(\\d{1,2})\\s*(?:[-–—]|до)\\s*(\\d{1,2})\\s+(${MONTHS_RU_NAMES})`,
            'i'
        ));
        if (m) {
            const month = MONTHS_RU[m[3].toLowerCase()] || '01';
            const year = currentYearForMonth(month);
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
        if (m) return formatDateParts(m[1], m[2]);

        // "Ожидаемая дата: 15 июля"
        m = src.match(new RegExp(
            `ожидаемая\\s+дата[:\\s]+(\\d{1,2})\\s+(${MONTHS_RU_NAMES})`,
            'i'
        ));
        if (m) return formatDateParts(m[1], m[2]);

        // "до 27 июля включительно" / "до 27 июля"
        m = src.match(new RegExp(
            `до\\s+(\\d{1,2})\\s+(${MONTHS_RU_NAMES})`,
            'i'
        ));
        if (m) return formatDateParts(m[1], m[2]);

        // "15 июля" / "15 июля, среда" в контексте доставки
        if (/доставк|ожида|пункт|хран/i.test(src)) {
            m = src.match(new RegExp(
                `(\\d{1,2})\\s+(${MONTHS_RU_NAMES})(?:\\s*,\\s*[а-яa-z]+)?`,
                'i'
            ));
            if (m) return formatDateParts(m[1], m[2]);
        }

        // Диагностика: дата доставки не распознана — логируем сырой текст
        Diagnostics.logParseResult('', 'parseDeliveryDate', 'regex chain (диапазон/ожидаем/до/контекст)', src);
        return '';
    }

    // ============================================================
    // 4. ПАРСИНГ ЦЕНЫ ИЗ data-state
    // ============================================================
    function parsePrice(text) {
        if (!text) return '';
        // "1 102 ₽" → 1102, "8 573 ₽" → 8573
        const cleaned = text.replace(/[^\d,.]/g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        if (isNaN(num)) return '';
        return num % 1 === 0 ? num.toString() : num.toFixed(2).replace('.', ',');
    }

    // ============================================================
    // 5. ПАРСИНГ КАРТОЧКИ ЗАКАЗА
    // ============================================================
    function parseOrder(card) {
        const text = card.textContent || '';
        const html = card.innerHTML || '';

        // Диагностика: снимок сырых данных карточки (HTML + textContent)
        let _diagOrderNumber = '';
        try {
            const _link = card.querySelector('a[href*="order="]');
            if (_link) {
                const _m = _link.href.match(/order=(\d+(?:-?\d+)?)/);
                if (_m) _diagOrderNumber = _m[1];
            }
            if (!_diagOrderNumber) {
                const _nm = text.match(/(\d{5,}[-–]?\d*)/);
                if (_nm) _diagOrderNumber = _nm[1];
            }
            Diagnostics.snapshotRawData(_diagOrderNumber, html, null, null);
        } catch(e) {
            Diagnostics.logError(_diagOrderNumber, 'parseOrder.snapshotRawData', html, e);
        }

        // --- НОМЕР ЗАКАЗА ---
        let orderNumber = '';
        const link = card.querySelector('a[href*="order="]');
        if (link) {
            const match = link.href.match(/order=(\d+(?:-?\d+)?)/);
            if (match) orderNumber = match[1];
        }
        if (!orderNumber) {
            const numMatch = text.match(/(\d{5,}[-–]?\d*)/);
            if (numMatch) orderNumber = numMatch[1];
        }

        // --- СТАТУС / ДАТА ЗАКАЗА ---
        // Дату заказа берём ТОЛЬКО из строки статуса (например «Получен 6 июля»).
        // Нельзя парсить весь text карточки — туда попадают «хранится до…» и окна доставки.
        let date = '';
        const statusEl = card.querySelector('.tsHeadline550Medium');
        if (statusEl) {
            date = parseRussianDate(statusEl.textContent);
        }
        // Без fallback на «сегодня» и без парсинга всего card text

        // --- СТАТУС ДОСТАВКИ (основной, с карточки) ---
        let deliveryStatus = '';
        if (statusEl) {
            // Убираем хвост с датой из статуса, если есть
            const statusRaw = (statusEl.textContent || '').trim();
            const statusWithoutDate = statusRaw
                .replace(new RegExp(`\\d{1,2}\\s+(${MONTHS_RU_NAMES}).*$`, 'i'), '')
                .trim() || statusRaw;
            deliveryStatus = normalizeStatus(statusWithoutDate);
        }
        if (!deliveryStatus) {
            const lower = text.toLowerCase();
            if (lower.includes('можно забирать')) deliveryStatus = '📦 Готов к выдаче';
            else if (lower.includes('получен')) deliveryStatus = '✅ Доставлен';
            else if (lower.includes('доставлен')) deliveryStatus = '✅ Доставлен';
            else if (lower.includes('в пути')) deliveryStatus = '🚚 В пути';
            else if (lower.includes('отмен')) deliveryStatus = '❌ Отменён';
        }

        // --- ДАТА ДОСТАВКИ С КАРТОЧКИ (fallback для «В пути») ---
        // На orderlist: «Доставка в пункт выдачи 17 - 18 июля», «Сегодня с 09:00…»
        let cardDeliveryDate = '';
        const deliveryHints = [];
        // Типичные подписи под статусом
        card.querySelectorAll('.tsBody500Medium, .tsBody400Small, .tsBodyControl400Small, [class*="tsBody"]').forEach(el => {
            const t = (el.textContent || '').trim();
            if (!t || t.length > 120) return;
            if (/доставк|ожида|раз|июл|январ|феврал|март|апрел|ма[яй]|июн|август|сентябр|октябр|ноябр|декабр/i.test(t)) {
                deliveryHints.push(t);
            }
        });
        for (const hint of deliveryHints) {
            cardDeliveryDate = parseDeliveryDate(hint);
            if (cardDeliveryDate) break;
        }
        if (!cardDeliveryDate) {
            // «Ожидаем15 июля, среда» / «Ожидаем 15 июля»
            const expectMatch = text.match(new RegExp(
                `ожидаем\\s*(\\d{1,2})\\s+(${MONTHS_RU_NAMES})`,
                'i'
            ));
            if (expectMatch) {
                cardDeliveryDate = parseDeliveryDate(expectMatch[0]);
            }
        }
        if (!cardDeliveryDate) {
            // Последний шанс — точечный поиск окна доставки в тексте карточки
            const rangeMatch = text.match(new RegExp(
                `(?:доставка[^\\n]{0,40})?(?:с\\s+)?(\\d{1,2})\\s*(?:[-–—]|до)\\s*(\\d{1,2})\\s+(${MONTHS_RU_NAMES})`,
                'i'
            ));
            if (rangeMatch) {
                cardDeliveryDate = parseDeliveryDate(rangeMatch[0]);
            }
        }

        // --- ТОВАРЫ (будут подгружены позже) ---
        let items = [];

        // --- СТАТУС ОПЛАТЫ (order-level fallback) ---
        // Не принимать произвольный текст селектора (например «2 шт»).
        let paymentStatus = '';
        const payCandidates = [];
        card.querySelectorAll('.b5_7_1-a4, [class*="badge"], [class*="Badge"]').forEach(el => {
            payCandidates.push(el.getAttribute('title') || '');
            payCandidates.push(el.textContent || '');
        });
        // title/aria, где явно про оплату
        card.querySelectorAll('[title], [aria-label]').forEach(el => {
            const t = el.getAttribute('title') || el.getAttribute('aria-label') || '';
            if (/оплач/i.test(t)) payCandidates.push(t);
        });
        // Плашки «ОПЛАЧЕН» / «НЕ ОПЛАЧЕН» на миниатюрах orderlist
        card.querySelectorAll('img, [class*="image"], [class*="Image"]').forEach(el => {
            if (el.alt) payCandidates.push(el.alt);
            if (el.title) payCandidates.push(el.title);
        });
        // Текстовые бейджи рядом с фото («ОПЛАЧЕН» / «НЕ ОПЛАЧЕН»)
        const itemPayFromCard = [];
        card.querySelectorAll('span, div, p, b, strong').forEach(el => {
            const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
            if (!t || t.length > 32) return;
            // Только короткие плашки, не длинные абзацы
            // «оплачен» / «оплачено» / «к оплате» — все варианты статуса оплаты
            if (!/оплачен|к\s+оплате/i.test(t)) return;
            // Игнор если это не похоже на badge (слишком много слов)
            if (t.split(' ').length > 4) return;
            payCandidates.push(t);
            const norm = normalizePaymentStatus(t);
            if (norm) itemPayFromCard.push(norm);
        });
        // Доп. проход по HTML/тексту карточки на случай badge в unusual markup
        if (!itemPayFromCard.length) {
            const badgeHits = text.match(/не\s*оплачен|оплачен|к\s+оплате/gi) || [];
            badgeHits.forEach(h => {
                const norm = normalizePaymentStatus(h);
                if (norm) itemPayFromCard.push(norm);
            });
        }
        // Уникальные статусы оплаты с плашек карточки
        const uniquePays = [...new Set(itemPayFromCard)];
        if (uniquePays.length === 1) {
            // Одна плашка на все товары — можно как order-level
            paymentStatus = uniquePays[0];
        } else if (uniquePays.length > 1) {
            // Смешанная оплата: НЕ ставим order-level paid, иначе перетрёт НЕ ОПЛАЧЕН у отдельного товара.
            // Если среди плашек есть «Не оплачен» — всё равно не угадываем для всего заказа.
            paymentStatus = '';
        } else {
            // Нет коротких плашек — собраем из candidates с приоритетом «Не оплачен»
            const acc = new Set();
            for (const c of payCandidates) {
                const n = normalizePaymentStatus(c);
                if (n) acc.add(n);
            }
            if (!acc.size) {
                const n = normalizePaymentStatus(text);
                if (n) acc.add(n);
            }
            paymentStatus = pickBestPaymentStatus(acc);
        }

        // --- СУММА (FALLBACK — если подгрузка не удастся) ---
        let fallbackAmount = '';
        const amountEls = card.querySelectorAll('.tsHeadline400Small');
        const amounts = [];
        amountEls.forEach(el => {
            const t = (el.textContent || '').trim();
            if (t && t.includes('₽')) {
                amounts.push(t);
            }
        });
        if (amounts.length > 0) {
            let total = 0;
            amounts.forEach(a => {
                const cleaned = a.replace(/[^\d,.]/g, '').replace(/\s/g, '').replace(',', '.');
                const num = parseFloat(cleaned);
                if (!isNaN(num)) total += num;
            });
            if (total > 0) {
                fallbackAmount = total % 1 === 0 ? total.toString() : total.toFixed(2).replace('.', ',');
            }
        }
        if (!fallbackAmount) {
            const amMatch = text.match(/([\d\s]+[.,]?\d*)\s*₽/);
            if (amMatch) {
                const cleaned = amMatch[1].replace(/\s/g, '').replace(',', '.');
                const num = parseFloat(cleaned);
                if (!isNaN(num)) {
                    fallbackAmount = num % 1 === 0 ? num.toString() : num.toFixed(2).replace('.', ',');
                }
            }
        }

        // --- ПУНКТ ВЫДАЧИ ---
        // card = .w9d_11; адрес находится в соседнем .dx_11, а не внутри card.
        // Поднимаемся до общего родителя — .d9w_11 (контейнер заказа).
        let pickupPoint = '';
        const orderContainer = card.closest('.d9w_11') || card.closest('.wd6_11') || card.parentElement?.parentElement || card;
        // 1) Полный адрес в одном элементе: "Пункт Ozon: Успенский пер., 30"
        const addrElFull = orderContainer.querySelector('.dx_11 .tsCompactControl500Medium');
        if (addrElFull && /пункт/i.test(addrElFull.textContent || '')) {
            pickupPoint = (addrElFull.textContent || '').trim().replace(/^(Пункт Ozon[:\s]*)/i, '');
        }
        // 2) Запасной: два соседних элемента — "Пункт Ozon •" + "Успенский пер., 30"
        if (!pickupPoint) {
            const markerEl = orderContainer.querySelector('.ga5_4_0-a3');
            if (markerEl && /пункт/i.test(markerEl.textContent || '')) {
                const nextSpan = markerEl.nextElementSibling;
                if (nextSpan) {
                    pickupPoint = (nextSpan.textContent || '').trim();
                }
            }
        }
        // 3) Старый селектор на случай если Ozon вернёт классы
        if (!pickupPoint) {
            const addrEl = orderContainer.querySelector('.dx0_11, .d0x_11');
            if (addrEl) {
                pickupPoint = (addrEl.textContent || '').trim().replace(/^(Пункт Ozon:\s*)/i, '');
            }
        }

        // Диагностика: пробы DOM-селекторов для pickupPoint на orderlist.
        // Пробуем все известные и потенциальные селекторы и сохраняем результат,
        // чтобы LLM увидел, что именно есть в DOM и какие классы у элементов с адресом.
        if (Diagnostics.enabled) {
            const _probes = [];
            const _probeSelectors = [
                // Текущие рабочие
                '.dx_11 .tsCompactControl500Medium',
                '.ga5_4_0-a3',
                '.dx0_11',
                '.d0x_11',
                // Широкие текстовые классы Ozon
                '.tsCompactControl500Medium',
                '.tsBody400Small',
                '.tsBody500Medium',
                '.tsCompactControl400Small',
                '.b35_5_1-b4',
                // Любой элемент, содержащий «пункт»
                '[class*="pickup"]',
                '[class*="address"]',
                '[class*="deliveryPoint"]',
            ];
            _probeSelectors.forEach(sel => {
                try {
                    const els = orderContainer.querySelectorAll(sel);
                    els.forEach((el, i) => {
                        if (i >= 5) return; // не больше 5 элементов на селектор
                        const txt = (el.textContent || '').trim().slice(0, 300);
                        const cls = (el.className && typeof el.className === 'string') ? el.className : '';
                        _probes.push({
                            selector: sel,
                            found: true,
                            count: els.length,
                            text: txt,
                            className: cls,
                            tagName: el.tagName,
                            outerHTML: (el.outerHTML || '').slice(0, 400)
                        });
                    });
                    if (els.length === 0) {
                        _probes.push({ selector: sel, found: false, count: 0, text: '', className: '', tagName: '', outerHTML: '' });
                    }
                } catch(e) {
                    _probes.push({ selector: sel, found: false, count: 0, text: `ERROR: ${e.message}`, className: '', tagName: '', outerHTML: '' });
                }
            });
            // Дополнительно: поиск ВСЕХ элементов с текстом «пункт» внутри orderContainer
            try {
                const _allEls = orderContainer.querySelectorAll('*');
                const _punktEls = [];
                _allEls.forEach(el => {
                    const t = (el.textContent || '').trim();
                    if (t.length > 0 && t.length < 200 && /пункт/i.test(t)) {
                        _punktEls.push(el);
                    }
                });
                _punktEls.slice(0, 10).forEach(el => {
                    const cls = (el.className && typeof el.className === 'string') ? el.className : '';
                    _probes.push({
                        selector: '(text contains "пункт")',
                        found: true,
                        count: _punktEls.length,
                        text: (el.textContent || '').trim().slice(0, 300),
                        className: cls,
                        tagName: el.tagName,
                        outerHTML: (el.outerHTML || '').slice(0, 400)
                    });
                });
            } catch(e) {}
            // Структура orderContainer: список прямых потомков с их классами
            const _children = [];
            try {
                Array.from(orderContainer.children).forEach((ch, i) => {
                    if (i >= 15) return;
                    const cls = (ch.className && typeof ch.className === 'string') ? ch.className : '';
                    _children.push({ tagName: ch.tagName, className: cls.slice(0, 200) });
                });
            } catch(e) {}
            Diagnostics.logDomProbe(orderNumber, 'orderlist', 'orderContainer (.d9w_11)', _probes);
            // Логируем структуру контейнера отдельно через parseResult (компактно)
            Diagnostics.logParseResult(orderNumber, 'orderContainer.children',
                'orderContainer children (tagName+className)', JSON.stringify(_children));
        }

        if (!orderNumber) {
            // Диагностика: номер заказа не найден — карточка не распознана
            Diagnostics.logError('', 'parseOrder.orderNumber', html, 'orderNumber not found in card');
            return null;
        }

        // Диагностика: логируем результат извлечения ключевых полей карточки
        Diagnostics.logParseResult(orderNumber, 'date', '.tsHeadline550Medium → parseRussianDate', date);
        Diagnostics.logParseResult(orderNumber, 'deliveryStatus', '.tsHeadline550Medium → normalizeStatus', deliveryStatus);
        Diagnostics.logParseResult(orderNumber, 'cardDeliveryDate', '.tsBody* → parseDeliveryDate', cardDeliveryDate);
        Diagnostics.logParseResult(orderNumber, 'paymentStatus', '.b5_7_1-a4 / badge → normalizePaymentStatus', paymentStatus);
        Diagnostics.logParseResult(orderNumber, 'pickupPoint', '.dx_11 .tsCompactControl500Medium', pickupPoint);
        Diagnostics.logParseResult(orderNumber, 'fallbackAmount', '.tsHeadline400Small → parsePrice', fallbackAmount);

        return {
            orderNumber,
            date,
            deliveryStatus,
            items,
            paymentStatus,
            fallbackAmount,
            pickupPoint,
            cardDeliveryDate
        };
    }

    // ============================================================
    // 5b. ИЗВЛЕЧЕНИЕ СТАТУСОВ ОПЛАТЫ ИЗ ГЛОБАЛЬНОГО JSON ORDERLIST
    // ============================================================
    // JSON: ordersV2[i].rightBlock.products.products[j].badgeStatus.text
    // Возвращает { orderIdx: [{ productIdx, status }] }
    function extractPaymentFromOrderListJSON(cardCount) {
        const result = Array(cardCount).fill(null).map(() => []);
        try {
            const stateEl = document.querySelector('[id*="state-orderList"]');
            if (!stateEl) {
                // Диагностика: элемент state-orderList не найден — структура DOM изменилась
                Diagnostics.logError('', 'extractPaymentFromOrderListJSON.stateEl',
                    document.body.innerHTML.substring(0, 2000),
                    '[id*="state-orderList"] not found');
                return result;
            }
            const raw = stateEl.getAttribute('data-state');
            if (!raw) {
                // Диагностика: атрибут data-state пустой
                Diagnostics.logError('', 'extractPaymentFromOrderListJSON.dataState',
                    stateEl.outerHTML, 'data-state attribute is empty');
                return result;
            }
            // Диагностика: снимок сырого JSON orderList (один раз на всю страницу)
            Diagnostics.snapshotRawData('[orderList]', null, raw, null);

            let json;
            try {
                json = JSON.parse(raw);
            } catch(parseErr) {
                // Диагностика: JSON не распарсился — логируем первые 500 символов
                Diagnostics.logError('', 'extractPaymentFromOrderListJSON.JSON.parse',
                    raw.substring(0, 500), parseErr);
                return result;
            }
            // ordersV2 — массив заказов на странице
            const ordersArr = json?.ordersV2;
            if (!Array.isArray(ordersArr)) {
                // Диагностика: структура JSON изменилась — ordersV2 не массив
                Diagnostics.logParseResult('', 'ordersV2', 'json.ordersV2 (Array)', JSON.stringify(json).substring(0, 500));
                return result;
            }

            ordersArr.forEach((order, oi) => {
                if (oi >= cardCount) return;
                const products = order?.rightBlock?.products?.products;
                if (!Array.isArray(products)) {
                    // Диагностика: путь к products изменился
                    Diagnostics.logParseResult(`order#${oi}`, 'rightBlock.products.products',
                        'order.rightBlock.products.products (Array)', JSON.stringify(order).substring(0, 500));
                    return;
                }
                products.forEach((p, pi) => {
                    const badgeText = p?.badgeStatus?.text;
                    if (!badgeText) {
                        // Диагностика: badgeStatus.text отсутствует у товара
                        Diagnostics.logParseResult(`order#${oi}.product#${pi}`, 'badgeStatus.text',
                            'p.badgeStatus.text', JSON.stringify(p).substring(0, 300));
                        return;
                    }
                    const norm = normalizePaymentStatus(badgeText);
                    if (!norm) {
                        // Диагностика: badgeStatus не нормализовался
                        Diagnostics.logParseResult(`order#${oi}.product#${pi}`, 'normalizePaymentStatus',
                            'badgeStatus.text → normalizePaymentStatus', badgeText);
                        return;
                    }
                    // Извлекаем цену для маппинга (productIdx ≠ индекс в orderdetails)
                    let productPrice = '';
                    try {
                        productPrice = parsePrice(p.price.price[0].text);
                    } catch(e) {
                        // Диагностика: цена не извлечена — путь p.price.price[0].text изменился
                        Diagnostics.logParseResult(`order#${oi}.product#${pi}`, 'price.price[0].text',
                            'p.price.price[0].text', JSON.stringify(p.price).substring(0, 300));
                    }
                    result[oi].push({ productIdx: pi, status: norm, price: productPrice });
                });
            });
        } catch(e) {
            console.warn('[Ozon Copier] Ошибка парсинга payment из JSON:', e);
            Diagnostics.logError('', 'extractPaymentFromOrderListJSON', '', e);
        }
        return result;
    }

    // ============================================================
    // 5c. JSON-FIRST ПАРСИНГ ЗАКАЗОВ ИЗ state-orderList
    // ============================================================
    // Извлекает заказы напрямую из JSON (ordersV2), НЕ завися от
    // хэшей CSS-классов контейнеров. Устойчив к правкам DOM Ozon:
    // классы вида dw8_11 / d9w_11 / w9d_11 периодически меняются,
    // а структура JSON ordersV2 остаётся стабильной.
    // Каждый заказ из JSON содержит: номер, статус, адрес ПВЗ,
    // дату/время выдачи, товары с фото, цены, статусы оплаты.
    // Полные названия товаров и кол-во подтягиваются позже через
    // enrichOrdersWithProducts → fetchOrderDetails.
    function parseOrdersFromStateJSON() {
        try {
            const stateEl = document.querySelector('[id*="state-orderList"]');
            if (!stateEl) {
                Diagnostics.logError('', 'parseOrdersFromStateJSON.stateEl',
                    '[id*="state-orderList"] not found', 'stateEl not found');
                return [];
            }
            const raw = stateEl.getAttribute('data-state');
            if (!raw) {
                Diagnostics.logError('', 'parseOrdersFromStateJSON.dataState',
                    stateEl.outerHTML.slice(0, 500), 'data-state is empty');
                return [];
            }
            let json;
            try {
                json = JSON.parse(raw);
            } catch(parseErr) {
                Diagnostics.logError('', 'parseOrdersFromStateJSON.JSON.parse',
                    raw.slice(0, 500), parseErr);
                return [];
            }
            const ordersArr = json?.ordersV2;
            if (!Array.isArray(ordersArr) || ordersArr.length === 0) {
                Diagnostics.logParseResult('', 'parseOrdersFromStateJSON.ordersV2',
                    'json.ordersV2 (Array)', String(ordersArr?.length || 0));
                return [];
            }
            // Снимок полного JSON orderList (один раз на всю страницу)
            Diagnostics.snapshotRawData('[orderList]', null, raw, null);

            const orders = ordersArr.map((order, oi) => {
                const leftBlock = order?.leftBlock || {};
                const rightBlock = order?.rightBlock || {};

                // --- НОМЕР ЗАКАЗА из action.link ---
                // link приходит с экранированными слешами; после JSON.parse это обычная строка.
                // Поддерживаем два формата action:
                //   1) BEHAVIOR_TYPE_REDIRECT — обычная ссылка с ?order=XXXXXXXX
                //   2) BEHAVIOR_TYPE_COMPOSER_ACTION — составной/мульти-заказ, ссылка вида
                //      v2/cacheOrderProducts?data=eyJwb3N0aW5ncyI6WyI1ODk1NzY0OS0wNTgzLTEi...
                //      где data — base64 от JSON {"postings":["XXXXXXXX-NNN-1","XXXXXXXX-NNN-2",...]}.
                //      Номер заказа — общий префикс до первого дефиса-сегмента отправления.
                let orderNumber = '';
                const linkCandidates = [
                    leftBlock?.common?.action?.link,
                    leftBlock?.textIcon?.common?.action?.link,
                    leftBlock?.title?.common?.action?.link,
                    rightBlock?.products?.common?.action?.link,
                ].filter(Boolean);
                for (const lnk of linkCandidates) {
                    const s = String(lnk);
                    // Путь 1: обычная редирект-ссылка с ?order=
                    const mm = s.match(/order=(\d+(?:-?\d+)?)/);
                    if (mm) { orderNumber = mm[1]; break; }
                    // Путь 2: COMPOSER_ACTION с base64 data-параметром (мульти-отправление)
                    const dm = s.match(/[?&]data=([A-Za-z0-9_\-=]+)/);
                    if (dm) {
                        try {
                            const decoded = atob(dm[1]);
                            const parsed = JSON.parse(decoded);
                            const postings = parsed?.postings;
                            if (Array.isArray(postings) && postings.length > 0) {
                                // postings[0] = "58957649-0583-1" → общий номер = "58957649-0583"
                                const first = String(postings[0]);
                                // Отрезаем последний сегмент отправления (-1, -2, ...)
                                const m2 = first.match(/^(\d+-\d+)/);
                                if (m2) { orderNumber = m2[1]; break; }
                            }
                        } catch(e) {
                            Diagnostics.logError('', `parseOrdersFromStateJSON.composerAction#${oi}`,
                                s.slice(0, 300), e);
                        }
                    }
                }

                if (!orderNumber) {
                    Diagnostics.logError('', `parseOrdersFromStateJSON.orderNumber#${oi}`,
                        JSON.stringify(order).slice(0, 500), 'orderNumber not found in JSON order');
                    return null;
                }

                // --- СТАТУС ---
                const statusText = leftBlock?.textIcon?.text?.text
                    || leftBlock?.textIcon?.common?.text?.text || '';
                const deliveryStatus = normalizeStatus(statusText);
                const date = parseRussianDate(statusText);

                // --- АДРЕС ПВЗ ---
                const titleText = leftBlock?.title?.text || '';
                let pickupPoint = titleText.replace(/^Пункт\s+Ozon[:\s]*/i, '').trim();
                // "Доставка в пункт выдачи" — это не адрес, очищаем (подтянется из orderdetails)
                if (/^доставк/i.test(pickupPoint)) {
                    pickupPoint = '';
                }

                // --- ДАТА/ВРЕМЯ ВЫДАЧИ ---
                const subtitleText = leftBlock?.subtitle?.text || '';
                let cardDeliveryDate = parseDeliveryDate(subtitleText)
                    || parseDeliveryDate(titleText)
                    || parseDeliveryDate(statusText);

                // --- ТОВАРЫ (с фото, ценой, статусом оплаты) ---
                let items = [];
                const products = rightBlock?.products?.products;
                if (Array.isArray(products)) {
                    items = products.map((p, pi) => {
                        // Фото: несколько возможных путей внутри продукта orderlist
                        const picture = p?.image?.productMedia?.image?.url
                            || p?.picture?.image?.image
                            || p?.image?.url
                            || '';
                        // Цена
                        let price = '';
                        try {
                            price = parsePrice(p?.price?.price?.[0]?.text || p?.price?.[0]?.text || '');
                        } catch(e) {
                            Diagnostics.logParseResult(orderNumber, `JSON.product#${pi}.price`,
                                'p.price.price[0].text', JSON.stringify(p?.price || {}).slice(0, 200));
                        }
                        // Статус оплаты товара
                        const itemPayment = extractProductPaymentStatus(p)
                            || extractPaymentStatusFromAny(p)
                            || '';
                        // Количество
                        let qty = '1';
                        try {
                            const rawQty = p?.addToCartButton?.action?.quantity;
                            if (rawQty != null) {
                                const n = parseInt(rawQty, 10);
                                if (!isNaN(n) && n > 0) qty = String(n);
                            }
                        } catch(e) {}
                        return {
                            name: p?.title?.name?.text || '',
                            price,
                            qty,
                            shipmentStatus: deliveryStatus,
                            deliveryDate: cardDeliveryDate,
                            paymentStatus: itemPayment,
                            picture
                        };
                    }).filter(it => it.picture || it.name || it.price);
                }

                // --- СУММА fallback (из cellList → «К оплате при получении») ---
                let fallbackAmount = '';
                try {
                    const cells = leftBlock?.cellList?.cells;
                    if (Array.isArray(cells)) {
                        let total = 0;
                        cells.forEach(c => {
                            const t = c?.dsCell?.rightBlock?.price?.price?.[0]?.text
                                || c?.rightBlock?.price?.price?.[0]?.text || '';
                            if (t.includes('₽')) total += parseFloat(parsePrice(t)) || 0;
                        });
                        if (total > 0) {
                            fallbackAmount = total % 1 === 0
                                ? String(total)
                                : total.toFixed(2).replace('.', ',');
                        }
                    }
                } catch(e) {
                    Diagnostics.logError(orderNumber, 'parseOrdersFromStateJSON.fallbackAmount', '', e);
                }

                // --- СТАТУС ОПЛАТЫ (order-level) ---
                // Если все товары имеют одинаковый статус — используем как order-level.
                // При смешанных (есть «Не оплачен») — не угадываем, оставляем пустым.
                let paymentStatus = '';
                const paySet = new Set();
                items.forEach(it => { if (it.paymentStatus) paySet.add(it.paymentStatus); });
                if (paySet.size === 1) {
                    paymentStatus = [...paySet][0];
                } else if (paySet.size === 0) {
                    // Пробуем badgeStatus.text напрямую (если extractProductPaymentStatus не сработал)
                    const badgeSet = new Set();
                    if (Array.isArray(products)) {
                        products.forEach(p => {
                            const bt = p?.badgeStatus?.text;
                            if (bt) {
                                const n = normalizePaymentStatus(bt);
                                if (n) badgeSet.add(n);
                            }
                        });
                    }
                    if (badgeSet.size > 0) paymentStatus = pickBestPaymentStatus(badgeSet);
                }

                // Fallback 3: статус оплаты из cellList (orderlist JSON).
                // cellList.cells[].dsCell.centerBlock.title.text содержит
                // «К оплате при получении» / «Оплачено» / «Не оплачен» и т.п.
                // Это order-level статус оплаты, видимый на карточке заказа.
                if (!paymentStatus) {
                    try {
                        const cells = leftBlock?.cellList?.cells;
                        if (Array.isArray(cells)) {
                            const cellPaySet = new Set();
                            cells.forEach(c => {
                                const titleText = c?.dsCell?.centerBlock?.title?.text
                                    || c?.centerBlock?.title?.text || '';
                                if (titleText) {
                                    const n = normalizePaymentStatus(titleText);
                                    if (n) cellPaySet.add(n);
                                }
                            });
                            if (cellPaySet.size > 0) {
                                paymentStatus = pickBestPaymentStatus(cellPaySet);
                            }
                        }
                    } catch(e) {
                        Diagnostics.logError(orderNumber, 'parseOrdersFromStateJSON.cellListPayment', '', e);
                    }
                }

                // Диагностика: логируем результат извлечения полей из JSON
                Diagnostics.logParseResult(orderNumber, 'JSON.orderNumber',
                    'leftBlock.common.action.link → /order=/', orderNumber);
                Diagnostics.logParseResult(orderNumber, 'JSON.deliveryStatus',
                    'leftBlock.textIcon.text.text → normalizeStatus', deliveryStatus);
                Diagnostics.logParseResult(orderNumber, 'JSON.pickupPoint',
                    'leftBlock.title.text', pickupPoint);
                Diagnostics.logParseResult(orderNumber, 'JSON.cardDeliveryDate',
                    'leftBlock.subtitle.text → parseDeliveryDate', cardDeliveryDate);
                Diagnostics.logParseResult(orderNumber, 'JSON.itemsCount',
                    'rightBlock.products.products', String(items.length));
                Diagnostics.logParseResult(orderNumber, 'JSON.fallbackAmount',
                    'cellList.cells → price', fallbackAmount);
                Diagnostics.logParseResult(orderNumber, 'JSON.paymentStatus',
                    'items / badgeStatus → normalizePaymentStatus', paymentStatus);

                return {
                    orderNumber,
                    date,
                    deliveryStatus,
                    items,
                    paymentStatus,
                    fallbackAmount,
                    pickupPoint,
                    cardDeliveryDate,
                    _source: 'json'
                };
            }).filter(Boolean);

            console.log(`[Ozon Copier] JSON-first: извлечено ${orders.length} заказов из state-orderList`);
            return orders;
        } catch(e) {
            Diagnostics.logError('', 'parseOrdersFromStateJSON', '', e);
            return [];
        }
    }

    // ============================================================
    // 6. ПАРСИНГ ВСЕХ ЗАКАЗОВ
    // ============================================================
    // Стратегия (v9.11): JSON-first + структурный DOM-fallback.
    //   1) JSON-first — извлекаем заказы из state-orderList.ordersV2.
    //      Не зависит от хэшей CSS-классов; работает всегда, когда
    //      Ozon рендерит страницу (а state-orderList рендерится всегда).
    //   2) DOM-fallback — если JSON недоступен/пуст, ищем карточки в DOM.
    //      Массив известных хэшей + структурный поиск по ссылкам → section.
    function parseOrders() {
        // === Уровень 1: JSON-first ===
        const jsonOrders = parseOrdersFromStateJSON();
        if (jsonOrders.length > 0) {
            return jsonOrders;
        }

        // === Уровень 2: DOM-fallback (если JSON недоступен) ===
        // Массив известных хэшей контейнеров заказа (от новых к старым).
        // Ozon периодически меняет суффикс: dw8_11 → d9w_11 → w9d_11 → ...
        const CARD_SELECTORS = [
            'SECTION.dw8_11',   // актуальная разметка (2026-07-30)
            'SECTION.d9w_11',   // предыдущая (v9.10)
            '.w9d_11',          // более старая (v9.8 / v9.9)
            'section[class*="dw8"]',
            'section[class*="d9w"]',
            'section[class*="w9d"]',
        ];
        let cards = [];
        for (const sel of CARD_SELECTORS) {
            cards = document.querySelectorAll(sel);
            if (cards.length > 0) break;
        }

        // Структурный fallback: ищем по ссылкам на orderdetails,
        // поднимаемся до ближайшего <section> (НЕ привязываемся к хэшу класса).
        if (cards.length === 0) {
            const allLinks = document.querySelectorAll('a[href*="/my/orderdetails/?order="], a[href*="order="]');
            const seenContainers = new Set();
            allLinks.forEach(a => {
                // Поднимаемся до блока заказа: section → [data-widget] → контейнер с хэш-суффиксом
                const container = a.closest('section')
                    || a.closest('[data-widget]')
                    || a.closest('[class*="_11"]');
                if (container) seenContainers.add(container);
            });
            if (seenContainers.size > 0) {
                cards = Array.from(seenContainers);
                console.log(`[Ozon Copier] DOM-fallback (структурный): найдено ${cards.length} контейнеров по ссылкам`);
            }
        }

        // Последний fallback: старый контейнер .x3d_11
        if (cards.length === 0) {
            const container = document.querySelector('.x3d_11');
            if (container) {
                const items = container.querySelectorAll(':scope > div');
                if (items.length > 0) {
                    const orders = Array.from(items).map(parseOrder).filter(Boolean);
                    const paymentGrid = extractPaymentFromOrderListJSON(items.length);
                    orders.forEach((o, oi) => {
                        if (paymentGrid[oi] && paymentGrid[oi].length > 0) {
                            o.jsonPayment = paymentGrid[oi];
                            const unique = [...new Set(paymentGrid[oi].map(v => v.status))];
                            if (unique.length === 1 && !o.paymentStatus) o.paymentStatus = unique[0];
                        }
                    });
                    return orders;
                }
            }
            console.warn('[Ozon Copier] Заказы не найдены ни в JSON, ни в DOM');
            return [];
        }

        const orders = Array.from(cards).map(parseOrder).filter(Boolean);
        // Привязываем per-product статусы оплаты из глобального JSON
        const paymentGrid = extractPaymentFromOrderListJSON(cards.length);
        orders.forEach((o, oi) => {
            // Если JSON дал per‑product статусы — кладём в order.jsonPayment
            if (paymentGrid[oi] && paymentGrid[oi].length > 0) {
                o.jsonPayment = paymentGrid[oi];
                // Если все товары имеют один статус — используем как order-level, иначе order-level не трогаем
                const unique = [...new Set(paymentGrid[oi].map(v => v.status))];
                if (unique.length === 1 && !o.paymentStatus) {
                    o.paymentStatus = unique[0];
                }
            }
        });
        return orders;
    }

    // ============================================================
    // 7. ПОДГРУЗКА ТОВАРОВ С ЦЕНАМИ ИЗ /my/orderdetails/
    // ============================================================
    // Внутренняя функция: одна попытка загрузки orderdetails.
    // При сетевой/HTTP-ошибке выбрасывает исключение (ловится обёрткой fetchOrderDetails).
    async function fetchOrderDetailsOnce(orderNumber, signal) {
        try {
            const url = `/my/orderdetails/?order=${orderNumber}`;
            const resp = await fetch(url, { signal, credentials: 'include' });
            if (!resp.ok) {
                // HTTP-ошибка → выбрасываем для retry в обёртке
                throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
            }

            const html = await resp.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Глобальный индекс плашек оплаты с страницы orderdetails
            // (текст «ОПЛАЧЕН»/«НЕ ОПЛАЧЕН» рядом с карточками товаров)
            const pagePaymentHints = [];
            try {
                doc.querySelectorAll('span, div, p').forEach(el => {
                    const t = (el.textContent || '').trim();
                    if (!t || t.length > 32) return;
                    // «оплачен» / «оплачено» / «к оплате» — все варианты статуса оплаты
                    if (/оплачен|к\s+оплате/i.test(t)) pagePaymentHints.push(t);
                });
            } catch(e) {}

            // Ищем shipmentWidget-ы — каждый содержит товары одной отправки
            const shipmentWidgets = doc.querySelectorAll('[id*="shipmentWidget"]');
            const allItems = [];

            // Диагностика: если shipmentWidget-ов нет — структура страницы изменилась
            if (shipmentWidgets.length === 0) {
                Diagnostics.logError(orderNumber, 'fetchOrderDetails.shipmentWidgets',
                    html.substring(0, 3000), '[id*="shipmentWidget"] not found in orderdetails');
            }

            // Диагностика: снимок всех data-state shipmentWidget-ов (один раз на заказ)
            if (Diagnostics.enabled && shipmentWidgets.length > 0) {
                const _widgetsJSON = [];
                shipmentWidgets.forEach(el => {
                    const _raw = el.getAttribute('data-state') || '';
                    if (_raw) _widgetsJSON.push(_raw);
                });
                Diagnostics.snapshotRawData(orderNumber, null, null, _widgetsJSON.join('\n---WIDGET---\n'));
            }

            shipmentWidgets.forEach(el => {
                const raw = el.getAttribute('data-state') || '';
                if (!raw) return;
                let json;
                try {
                    json = JSON.parse(raw);
                } catch(parseErr) {
                    // Диагностика: JSON.parse упал — логируем первые 500 символов
                    Diagnostics.logError(orderNumber, 'fetchOrderDetails.JSON.parse',
                        raw.substring(0, 500), parseErr);
                    return;
                }
                try {

                    // Статус этой отправки: header[0].textIcon.text.text
                    let shipmentStatus = '';
                    try {
                        shipmentStatus = json.header[0].textIcon.text.text || '';
                    } catch(e) {
                        // Диагностика: путь к shipmentStatus изменился
                        Diagnostics.logParseResult(orderNumber, 'shipmentStatus',
                            'json.header[0].textIcon.text.text', JSON.stringify(json.header).substring(0, 500));
                    }

                    // Дата доставки: собираем тексты из header[*] (header[1] и соседние)
                    let deliveryDate = '';
                    try {
                        const headerTexts = [];
                        const headers = Array.isArray(json.header) ? json.header : [];
                        headers.forEach(h => {
                            try {
                                const t = h?.textIcon?.text?.text || h?.text?.text || h?.title || '';
                                if (t) headerTexts.push(String(t));
                            } catch(e) {}
                        });
                        // Также subtitle / description shipment-уровня
                        try {
                            if (json.subtitle?.text) headerTexts.push(String(json.subtitle.text));
                        } catch(e) {}
                        try {
                            if (json.description?.text) headerTexts.push(String(json.description.text));
                        } catch(e) {}

                        for (const ht of headerTexts) {
                            deliveryDate = parseDeliveryDate(ht);
                            if (deliveryDate) break;
                        }
                        // Если header не распарсился — fallback по сериализованным текстам shipment
                        if (!deliveryDate) {
                            const joined = headerTexts.join(' | ');
                            deliveryDate = parseDeliveryDate(joined);
                        }
                        // Fallback: фактическая дата получения из статуса для доставленных заказов
                        // ("Получен 29 июля" → 29.07.2026)
                        if (!deliveryDate) {
                            try {
                                const statusText = json.header[0]?.textIcon?.text?.text || '';
                                deliveryDate = parseRussianDate(statusText);
                            } catch(e) {}
                        }
                    } catch(e) {}

                    // Товары в этой отправке
                    const items = json.items || [];
                    items.forEach(item => {
                        const sellers = item.sellers || [];
                        sellers.forEach(seller => {
                            const products = seller.products || [];
                            products.forEach(p => {
                                const name = p.title?.name?.text;
                                if (!name || name.length < 3 || name.length > 300) {
                                    // Диагностика: имя товара не извлечено или не прошло валидацию
                                    Diagnostics.logParseResult(orderNumber, 'product.name',
                                        'p.title.name.text (3..300 chars)', name || JSON.stringify(p.title).substring(0, 300));
                                    return;
                                }

                                // Цена: price.price[0].text
                                let price = '';
                                try {
                                    price = parsePrice(p.price.price[0].text);
                                } catch(e) {
                                    // Диагностика: путь к цене изменился
                                    Diagnostics.logParseResult(orderNumber, 'product.price',
                                        'p.price.price[0].text', JSON.stringify(p.price).substring(0, 300));
                                }

                                // Количество: addToCartButton.action.quantity
                                let qty = '1';
                                try {
                                    const rawQty = p.addToCartButton?.action?.quantity;
                                    if (rawQty !== undefined && rawQty !== null) {
                                        const n = parseInt(rawQty, 10);
                                        if (!isNaN(n) && n > 0) qty = n.toString();
                                    }
                                } catch(e) {
                                    // Диагностика: путь к qty изменился
                                    Diagnostics.logParseResult(orderNumber, 'product.qty',
                                        'p.addToCartButton.action.quantity', JSON.stringify(p.addToCartButton).substring(0, 300));
                                }

                                // Фото: picture.image.image
                                let picture = '';
                                try {
                                    picture = p.picture.image.image || '';
                                } catch(e) {
                                    // Диагностика: путь к фото изменился
                                    Diagnostics.logParseResult(orderNumber, 'product.picture',
                                        'p.picture.image.image', JSON.stringify(p.picture).substring(0, 300));
                                }

                                // Оплата с плашки на товаре (ОПЛАЧЕН / НЕ ОПЛАЧЕН)
                                let itemPayment = '';
                                try {
                                    itemPayment = extractProductPaymentStatus(p);
                                } catch(e) {
                                    Diagnostics.logError(orderNumber, 'fetchOrderDetails.extractProductPaymentStatus',
                                        JSON.stringify(p).substring(0, 500), e);
                                }
                                // Если в JSON нет — пробуем вытащить из data-state raw product subtree
                                if (!itemPayment) {
                                    try {
                                        itemPayment = extractPaymentStatusFromAny(p);
                                    } catch(e) {
                                        Diagnostics.logError(orderNumber, 'fetchOrderDetails.extractPaymentStatusFromAny',
                                            JSON.stringify(p).substring(0, 500), e);
                                    }
                                }

                                // Диагностика: логируем итоговый результат извлечения полей товара
                                Diagnostics.logParseResult(orderNumber, 'product (final)',
                                    'name+price+qty+picture+payment',
                                    `name="${name}" price="${price}" qty="${qty}" pic="${picture ? 'OK' : 'EMPTY'}" pay="${itemPayment || 'EMPTY'}"`);

                                allItems.push({
                                    name: name,
                                    price: price,
                                    qty: qty,
                                    shipmentStatus: normalizeStatus(shipmentStatus),
                                    deliveryDate: deliveryDate,
                                    paymentStatus: itemPayment,
                                    picture: picture
                                });
                            });
                        });
                    });
                } catch(e) {
                    // Диагностика: общая ошибка обработки shipmentWidget
                    Diagnostics.logError(orderNumber, 'fetchOrderDetails.shipmentWidget',
                        raw.substring(0, 500), e);
                }
            });

            // Извлекаем адрес пункта выдачи со страницы orderdetails.
            // Каскад селекторов: Ozon периодически меняет хэш-префикс (b35_5_1 → b35_5_2 → ...),
            // поэтому сначала пробуем точные хэши, затем структурный fallback по контексту блока.
            let detailsAddress = '';
            try {
                // 1) Точные селекторы для известных версий разметки (от новых к старым)
                const _addrHashSelectors = [
                    '.b35_5_3-b4.tsBody400Small',   // актуальная разметка (июль 2026)
                    '.b35_5_2-b4.tsBody400Small',   // предыдущая разметка
                    '.b35_5_1-b4.tsBody400Small',   // более старая разметка
                ];
                let addrEl = null;
                for (const sel of _addrHashSelectors) {
                    addrEl = doc.querySelector(sel);
                    if (addrEl) break;
                }
                // 2) Структурный fallback: span внутри блока доставки [class*="b35"],
                //    чей текст начинается с «Пункт Ozon,» (полный адрес, а не лейбл «Пункт Ozon •»).
                //    Устойчив к любой смене хэша b35_5_X.
                if (!addrEl) {
                    const _candidates = doc.querySelectorAll('[class*="b35"] span');
                    for (const el of _candidates) {
                        const t = (el.textContent || '').trim();
                        // Матчит "Пункт Ozon, ..." и "Пункт выдачи крупногабаритных товаров Ozon, ..."
                        if (/^Пункт\s+(Ozon|выдачи)\s*,?\s*.+/i.test(t)) { addrEl = el; break; }
                    }
                }
                // Более полный адрес: "Пункт Ozon, Россия, Ростовская, ..., 30"
                if (addrEl) {
                    const fullText = (addrEl.textContent || '').trim();
                    // Извлекаем после "Пункт Ozon, " — полный адрес
                    const m = fullText.match(/Пункт\s+Ozon[,\s]+(.+)/i);
                    detailsAddress = m ? m[1].trim() : fullText.replace(/^(Пункт\s+Ozon[,\s]*)/i, '');
                }
                if (!detailsAddress) {
                    // 3) Последний шанс — тот же подход что и на orderlist: .tsCompactControl500Medium
                    const altEl = doc.querySelector('.tsCompactControl500Medium');
                    if (altEl && /пункт/i.test(altEl.textContent || '')) {
                        detailsAddress = (altEl.textContent || '').trim().replace(/^(Пункт Ozon[:\s]*)/i, '');
                    }
                }
                // Диагностика: логируем результат извлечения адреса
                Diagnostics.logParseResult(orderNumber, 'detailsAddress',
                    'каскад: .b35_5_3-b4 → .b35_5_2-b4 → .b35_5_1-b4 → [class*=b35] span{^Пункт (Ozon|выдачи)} → .tsCompactControl500Medium',
                    detailsAddress);

                // Диагностика: пробы DOM-селекторов для detailsAddress на orderdetails.
                // Пробуем те же и дополнительные селекторы на doc (DOM страницы orderdetails).
                const _addrProbes = [];
                const _addrSelectors = [
                    '.b35_5_3-b4.tsBody400Small',
                    '.b35_5_2-b4.tsBody400Small',
                    '.b35_5_1-b4.tsBody400Small',
                    '.b35_5_3-b4',
                    '.b35_5_2-b4',
                    '.b35_5_1-b4',
                    '.tsCompactControl500Medium',
                    '.tsBody400Small',
                    '.tsBody500Medium',
                    '.tsCompactControl400Small',
                    '[class*="pickup"]',
                    '[class*="address"]',
                    '[class*="point"]',
                    '[class*="b35"]'
                ];
                _addrSelectors.forEach(sel => {
                    try {
                        const els = doc.querySelectorAll(sel);
                        els.forEach((el, i) => {
                            if (i >= 8) return;
                            const txt = (el.textContent || '').trim().slice(0, 300);
                            const cls = (el.className && typeof el.className === 'string') ? el.className : '';
                            _addrProbes.push({
                                selector: sel,
                                found: true,
                                count: els.length,
                                text: txt,
                                className: cls,
                                tagName: el.tagName,
                                outerHTML: (el.outerHTML || '').slice(0, 400)
                            });
                        });
                        if (els.length === 0) {
                            _addrProbes.push({ selector: sel, found: false, count: 0, text: '', className: '', tagName: '', outerHTML: '' });
                        }
                    } catch(e) {
                        _addrProbes.push({ selector: sel, found: false, count: 0, text: `ERROR: ${e.message}`, className: '', tagName: '', outerHTML: '' });
                    }
                });
                // Поиск всех элементов с «пункт» / «пвз» / «выдач» на странице orderdetails
                try {
                    const _allEls = doc.querySelectorAll('*');
                    const _punktEls = [];
                    _allEls.forEach(el => {
                        const t = (el.textContent || '').trim();
                        if (t.length > 0 && t.length < 200 && /пункт|пвз|выдач|адрес/i.test(t)) {
                            _punktEls.push(el);
                        }
                    });
                    _punktEls.slice(0, 12).forEach(el => {
                        const cls = (el.className && typeof el.className === 'string') ? el.className : '';
                        _addrProbes.push({
                            selector: '(text contains пункт/пвз/выдач/адрес)',
                            found: true,
                            count: _punktEls.length,
                            text: (el.textContent || '').trim().slice(0, 300),
                            className: cls,
                            tagName: el.tagName,
                            outerHTML: (el.outerHTML || '').slice(0, 400)
                        });
                    });
                } catch(e) {}
                Diagnostics.logDomProbe(orderNumber, 'orderdetails', 'document', _addrProbes);
            } catch(e) {
                Diagnostics.logError(orderNumber, 'fetchOrderDetails.detailsAddress', '', e);
            }

            // Диагностика: снимок HTML страницы orderdetails (без обрезки).
            // Ограничиваем 200 КБ, чтобы файл был читаемым, но без потери ключевых данных.
            const _detailsHtml = (html || '').slice(0, 200000);
            Diagnostics.snapshotOrderDetails(orderNumber, _detailsHtml, shipmentWidgets.length);

            // Плашки оплаты со страницы orderdetails
            const hintSet = new Set(
                pagePaymentHints.map(h => normalizePaymentStatus(h)).filter(Boolean)
            );
            const pagePay = pickBestPaymentStatus(hintSet);
            if (pagePay) {
                if (hintSet.size === 1) {
                    // Единая плашка на странице — заполняем пустые item-полы
                    allItems.forEach(it => {
                        if (!it.paymentStatus) it.paymentStatus = pagePay;
                    });
                } else if (allItems.length === 1) {
                    // Один товар + смешанные текстовки на странице:
                    // pickBestPaymentStatus отдаст «Не оплачен» при наличии
                    if (!allItems[0].paymentStatus) {
                        allItems[0].paymentStatus = pagePay;
                    } else {
                        // Если JSON сказал «Оплачен», а на странице есть «Не оплачен» — страница важнее
                        allItems[0].paymentStatus = pickBestPaymentStatus(
                            new Set([allItems[0].paymentStatus, pagePay])
                        );
                    }
                }
                // Если товаров несколько и плашки разные — не угадываем order-level paid
            }

            return { items: allItems, address: detailsAddress };
        } catch(e) {
            // AbortError не повторяем — отмена по сигналу вышестоящего кода
            if (e.name === 'AbortError') return { items: [], address: '' };
            // Пробрасываем ошибку в обёртку fetchOrderDetails для retry
            throw e;
        }
    }

    // ============================================================
    // 7b. ОБОЁРТКА С RETRY: до 3 попыток с экспоненциальной задержкой.
    // Защищает от «Failed to fetch» и временных HTTP-ошибок (429/502/503).
    // ============================================================
    async function fetchOrderDetails(orderNumber, signal) {
        const MAX_RETRIES = 3;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                return await fetchOrderDetailsOnce(orderNumber, signal);
            } catch(e) {
                if (e.name === 'AbortError') return { items: [], address: '' };
                if (attempt < MAX_RETRIES - 1) {
                    const delay = 500 * (attempt + 1);
                    console.warn(`[Ozon Copier] fetch attempt ${attempt + 1}/${MAX_RETRIES} failed for ${orderNumber}, retry in ${delay}ms:`, e.message || e);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                // Все попытки исчерпаны
                console.warn(`[Ozon Copier] fetch error for ${orderNumber} after ${MAX_RETRIES} attempts:`, e);
                Diagnostics.logError(orderNumber, 'fetchOrderDetails (outer catch)', '', e);
                return { items: [], address: '' };
            }
        }
        return { items: [], address: '' };
    }

    async function enrichOrdersWithProducts(orders, onProgress) {
        const controller = new AbortController();
        const CONCURRENCY = 2; // 2 одновременных запроса

        for (let i = 0; i < orders.length; i += CONCURRENCY) {
            const batch = orders.slice(i, i + CONCURRENCY);
            const results = await Promise.all(
                batch.map(order => fetchOrderDetails(order.orderNumber, controller.signal))
            );
            results.forEach((result, idx) => {
                const order = orders[i + idx];
                const data = result || { items: [], address: '' };
                const list = data.items || [];
                // Запасной адрес пункта выдачи со страницы orderdetails
                if (!order.pickupPoint && data.address) {
                    order.pickupPoint = data.address;
                }
                // Fallback: дата доставки с orderlist-карточки (особенно «В пути»).
                // Оплата: item-level из JSON orderlist → item из orderdetails → order-level fallback.
                // При этом mergePaymentStatus не превращает unpaid→paid.
                order.items = list.map((it, pi) => {
                    // Статус из JSON orderlist per‑product (точный)
                    // Маппинг: сначала по цене, затем по productIdx, затем для одного товара — любой статус
                    let jsonProductPay = '';
                    if (order.jsonPayment && order.jsonPayment.length > 0) {
                        const match = order.jsonPayment.find(jp => {
                            if (jp.price && it.price) {
                                return jp.price === it.price; // Нормализованная цена
                            }
                            return jp.productIdx === pi; // Fallback на индекс
                        });
                        if (match) {
                            jsonProductPay = match.status;
                        } else if (list.length === 1 && order.jsonPayment.length === 1) {
                            // Один товар — один статус из jsonPayment
                            jsonProductPay = order.jsonPayment[0].status;
                        } else if (pi < order.jsonPayment.length) {
                            // Простой индексный fallback (если цены не совпали)
                            jsonProductPay = order.jsonPayment[pi]?.status || '';
                        }
                    }
                    return {
                        ...it,
                        deliveryDate: it.deliveryDate || order.cardDeliveryDate || '',
                        paymentStatus: jsonProductPay || mergePaymentStatus(it.paymentStatus, order.paymentStatus)
                    };
                });
            });
            if (onProgress) onProgress(Math.min(i + CONCURRENCY, orders.length), orders.length);
        }

        return orders;
    }

    // ============================================================
    // 8. ФОРМАТИРОВАНИЕ В TSV
    // ============================================================
    function formatTSV(orders) {
        const BOM = '\uFEFF';
        const sep = '\t';

        const headers = [
            '№ Заказа',
            'Статус',
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
                    name: '(не удалось загрузить детали заказа)',
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
                const name = item.name || '';
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

                if (idx === 0) {
                    tsv += [
                        o.orderNumber, // A: № Заказа
                        displayStatus, // B: Статус доставки
                        name, // C: Товары
                        qty, // D: Кол-во
                        price, // E: Сумма
                        pay, // F: Статус оплаты (item-level)
                        o.pickupPoint, // G: Пункт выдачи
                        deliveryDate, // H: Дата доставки (по shipment)
                        picture // I: Фото
                    ].join(sep) + '\n';
                } else {
                    tsv += [
                        '',
                        displayStatus,
                        name,
                        qty,
                        price,
                        pay,
                        o.pickupPoint,
                        deliveryDate,
                        picture
                    ].join(sep) + '\n';
                }
                totalRows++;
            });
        });

        // Итоги
        if (orders.length > 0) {
            tsv += '\n';
            tsv += ['', '', '', '', '', '', '', '', ''].join(sep) + '\n';
            const grandTotalStr = isNaN(grandTotal) ? '' :
                (grandTotal % 1 === 0 ? grandTotal.toString() : grandTotal.toFixed(2).replace('.', ','));
            tsv += ['ИТОГО:', orders.length + ' заказов, ' + totalRows + ' позиций', '', '', grandTotalStr, '', '', '', ''].join(sep) + '\n';
        }

        return tsv;
    }

    // ============================================================
    // 9. ПОКАЗ ПРЕДПРОСМОТРА
    // ============================================================
    function showPreview(orders) {
        const existing = document.querySelector('.ozon-copy-counter');
        if (existing) existing.remove();

        const div = document.createElement('div');
        div.className = 'ozon-copy-counter';

        let html = '<table>';
        html += `<tr><td colspan="3" style="font-weight:700;font-size:14px;padding-bottom:6px;">📊 Найдено заказов: ${orders.length}</td></tr>`;

        let grandTotal = 0;
        let totalItems = 0;
        let withPics = 0;
        orders.forEach(o => {
            const hasItems = o.items && o.items.length > 0;
            const itemCount = hasItems ? o.items.length : 0;
            totalItems += itemCount || 1;

            const isCancelled = o.deliveryStatus === '❌ Отменён';
            const orderTotal = hasItems
                ? o.items.reduce((s, item) => {
                    const p = parseFloat((item.price || '').replace(',', '.'));
                    return s + (isNaN(p) ? 0 : p);
                }, 0)
                : parseFloat((o.fallbackAmount || '').replace(',', '.'));
            if (!isNaN(orderTotal) && !isCancelled) grandTotal += orderTotal;

            const firstItem = hasItems ? o.items[0] : null;
            const hasPic = firstItem && firstItem.picture ? ' 📸' : '';
            if (firstItem && firstItem.picture) withPics++;
            const previewName = firstItem
                ? firstItem.name.substring(0, 50) + (firstItem.name.length > 50 ? '…' : '')
                : '';
            const moreCount = hasItems ? o.items.length - 1 : 0;

            html += `<tr>
                <td>
                    <small><b>${o.orderNumber}</b></small>
                    ${previewName ? `<span class="product-name">${previewName}</span>` : ''}
                    ${moreCount > 0 ? `<span style="color:#999;font-size:11px;">+${moreCount} товаров</span>` : ''}
                </td>
                <td>
                    ${hasItems ? o.items.map(i => i.price).join('+') : ''}
                </td>
                <td>${hasPic ? '📸' : ''}</td>
            </tr>`;
        });

        function orderTotalStr(val) {
            if (isNaN(val) || val === 0) return '—';
            return val % 1 === 0 ? val.toString() : val.toFixed(2).replace('.', ',');
        }

        const grandTotalStr = orderTotalStr(grandTotal);
        html += `<tr class="summary"><td style="font-weight:700;">💵 Всего: ${grandTotalStr}₽ (${totalItems} товаров${withPics ? ', '+withPics+' с фото' : ''})</td><td style="font-weight:700;">${grandTotalStr}</td><td></td></tr>`;
        html += '</table>';

        div.innerHTML = html;
        document.body.appendChild(div);
        requestAnimationFrame(() => div.classList.add('ozon-copy-counter--show'));
        setTimeout(() => {
            div.classList.remove('ozon-copy-counter--show');
            setTimeout(() => div.remove(), 300);
        }, 10000);
    }

    // ============================================================
    // 10. ПОКАЗ ПРОГРЕССА
    // ============================================================
    function showProgress(current, total) {
        let el = document.querySelector('.ozon-copy-progress');
        if (!el) {
            el = document.createElement('div');
            el.className = 'ozon-copy-progress';
            el.innerHTML = '<div class="spinner"></div><span class="text">Загружаю названия товаров...</span>';
            document.body.appendChild(el);
        }
        el.querySelector('.text').textContent = `📦 Загружаю товары: ${current}/${total}`;
        if (current >= total) {
            setTimeout(() => {
                el.style.opacity = '0';
                el.style.transition = 'opacity 0.3s';
                setTimeout(() => el.remove(), 300);
            }, 500);
        }
    }

    // ============================================================
    // 11. КОПИРОВАНИЕ
    // ============================================================
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch(e) {
            // Fallback для случаев, когда clipboard API недоступен
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                return true;
            } catch(e2) {
                return false;
            }
        }
    }

    function showToast(msg, type = 'success') {
        const existing = document.querySelector('.ozon-copy-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `ozon-copy-toast ozon-copy-toast--${type}`;
        document.body.appendChild(toast);

        // Текст сообщения
        const textSpan = document.createElement('span');
        textSpan.textContent = msg;
        textSpan.style.cssText = 'flex:1; word-break:break-word;';
        toast.appendChild(textSpan);

        // Кнопка копирования текста ошибки
        if (type === 'error') {
            const copyBtn = document.createElement('button');
            copyBtn.textContent = '📋';
            copyBtn.title = 'Скопировать текст ошибки';
            copyBtn.style.cssText =
                'flex-shrink:0; margin-left:10px; padding:4px 8px; border:1px solid #ef9a9a; ' +
                'border-radius:6px; background:#fff; color:#c62828; cursor:pointer; ' +
                'font-size:16px; line-height:1; transition:background 0.15s;';
            copyBtn.addEventListener('mouseenter', () => { copyBtn.style.background = '#ffebee'; });
            copyBtn.addEventListener('mouseleave', () => { copyBtn.style.background = '#fff'; });
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(msg).then(() => {
                    copyBtn.textContent = '✅';
                    setTimeout(() => { copyBtn.textContent = '📋'; }, 1500);
                }).catch(() => {
                    // Fallback для старых браузеров
                    const ta = document.createElement('textarea');
                    ta.value = msg;
                    ta.style.cssText = 'position:fixed;left:-9999px;';
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    copyBtn.textContent = '✅';
                    setTimeout(() => { copyBtn.textContent = '📋'; }, 1500);
                });
            });
            toast.appendChild(copyBtn);
        }

        // Toast — flex-контейнер для span + button
        toast.style.display = 'flex';
        toast.style.alignItems = 'flex-start';

        requestAnimationFrame(() => toast.classList.add('ozon-copy-toast--show'));
        setTimeout(() => {
            toast.classList.remove('ozon-copy-toast--show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    async function copyOrders() {
        const btn = document.querySelector('.ozon-copy-btn');
        if (!btn) return;

        // Синхронно создаём textarea ПОКА действует пользовательский жест (клик).
        // После await-а user activation теряется, и clipboard API падает с NotAllowedError.
        const clipTA = document.createElement('textarea');
        clipTA.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none;';
        document.body.appendChild(clipTA);
        clipTA.focus();

        btn.classList.add('ozon-copy-btn--loading');
        btn.innerHTML = '⏳ Анализирую...';

        try {
            // Шаг 1: Парсим заказы из DOM
            const orders = parseOrders();

            // Шаг 1.5: Дедупликация — Ozon может показывать один заказ в нескольких карточках
            const seenNumbers = new Set();
            const deduped = [];
            for (const o of orders) {
                if (!seenNumbers.has(o.orderNumber)) {
                    seenNumbers.add(o.orderNumber);
                    deduped.push(o);
                }
            }
            if (deduped.length < orders.length) {
                console.log(`[Ozon Copier] Удалено дублей: ${orders.length - deduped.length}`);
            }
            orders.length = 0;
            orders.push(...deduped);

            if (orders.length === 0) {
                document.body.removeChild(clipTA);
                btn.classList.remove('ozon-copy-btn--loading');
                btn.classList.add('ozon-copy-btn--error');
                btn.innerHTML = '❌ Не найдено';
                showToast('❌ Заказы не найдены. Обновите страницу или проверьте вкладку "Актуальные"', 'error');
                setTimeout(() => {
                    btn.classList.remove('ozon-copy-btn--error');
                    btn.innerHTML = '📋 Копировать заказы';
                }, 3000);
                return;
            }

            // Шаг 2: Подгружаем товары с ценами
            btn.innerHTML = `⏳ Загружаю товары (0/${orders.length})...`;

            await enrichOrdersWithProducts(orders, (current, total) => {
                btn.innerHTML = `⏳ Загружаю товары (${current}/${total})...`;
                showProgress(current, total);
            });

            // Шаг 3: Итоговый предпросмотр
            showPreview(orders);

            // Шаг 4: Форматируем и копируем — используем заранее созданную textarea
            const tsv = formatTSV(orders);
            clipTA.value = tsv;
            clipTA.focus();
            clipTA.select();

            let ok = false;
            try {
                // execCommand('copy') — основной метод, не триггерит индикатор буфера Chrome
                ok = document.execCommand('copy');
            } catch(_) {}
            if (!ok) {
                try {
                    await navigator.clipboard.writeText(tsv);
                    ok = true;
                } catch(_) {}
            }
            document.body.removeChild(clipTA);

            if (ok) {
                btn.classList.remove('ozon-copy-btn--loading');
                btn.classList.add('ozon-copy-btn--success');
                const totalItems = orders.reduce((s, o) => s + ((o.items && o.items.length) || 0), 0);
                btn.innerHTML = `✅ ${orders.length} заказов, ${totalItems} товаров`;

                showToast(`✅ Скопировано: ${orders.length} заказов, ${totalItems} товаров\n📋 Вставьте: Ctrl+V`, 'success');

                setTimeout(() => {
                    btn.classList.remove('ozon-copy-btn--success');
                    btn.innerHTML = '📋 Копировать заказы';
                }, 5000);
            } else {
                throw new Error('Copy failed');
            }
        } catch(err) {
            // Подчищаем textarea при ошибке
            if (clipTA.parentNode) document.body.removeChild(clipTA);
            console.error('[Ozon Copier] Error:', err);
            btn.classList.remove('ozon-copy-btn--loading');
            btn.classList.add('ozon-copy-btn--error');
            btn.innerHTML = '❌ Ошибка';
            showToast('❌ Ошибка: ' + (err.message || 'неизвестная'), 'error');
            setTimeout(() => {
                btn.classList.remove('ozon-copy-btn--error');
                btn.innerHTML = '📋 Копировать заказы';
            }, 3000);
        }
    }

    // ============================================================
    // 12. СКАЧИВАНИЕ XLSX С РЕАЛЬНЫМИ ФОТО
    // ============================================================
    async function downloadXLSX() {
        const btn = document.querySelector('.ozon-xlsx-btn');
        if (!btn) return;

        btn.style.opacity = '0.7';
        btn.style.pointerEvents = 'none';
        btn.innerHTML = '⏳ Анализирую...';

        try {
            // Шаг 1: Парсим заказы из DOM
            const orders = parseOrders();

            // Дедупликация
            const seenNumbers = new Set();
            const deduped = [];
            for (const o of orders) {
                if (!seenNumbers.has(o.orderNumber)) {
                    seenNumbers.add(o.orderNumber);
                    deduped.push(o);
                }
            }
            if (deduped.length < orders.length) {
                console.log(`[Ozon Copier] Удалено дублей: ${orders.length - deduped.length}`);
            }

            if (deduped.length === 0) {
                showToast('❌ Заказы не найдены', 'error');
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
                btn.innerHTML = '📥 XLSX с фото';
                return;
            }

            // Шаг 2: Подгружаем товары
            btn.innerHTML = `⏳ Загружаю товары (0/${deduped.length})...`;
            await enrichOrdersWithProducts(deduped, (current, total) => {
                btn.innerHTML = `⏳ Загружаю товары (${current}/${total})...`;
                showProgress(current, total);
            });

            const totalItems = deduped.reduce((s, o) => s + ((o.items && o.items.length) || 0), 0);

            // Шаг 3: Скачиваем картинки (параллельно, до 4 одновременно)
            btn.innerHTML = '🖼 Скачиваю фото...';
            const imageCache = new Map(); // url -> { buffer, extension }
            const allPics = [];

            deduped.forEach(o => {
                if (o.items) {
                    o.items.forEach(item => {
                        if (item.picture) allPics.push(item.picture);
                    });
                }
            });

            // Уникальные URL для скачивания
            const uniquePics = [...new Set(allPics)];
            let picsDone = 0;

            const fetchImage = async (url) => {
                if (imageCache.has(url)) return;
                try {
                    const resp = await fetch(url);
                    if (!resp.ok) {
                        // Диагностика: HTTP-ошибка при загрузке фото
                        Diagnostics.logImage(url, resp.status, 0, 'HTTP_ERROR',
                            `HTTP ${resp.status} ${resp.statusText}`);
                        return;
                    }
                    const buffer = await resp.arrayBuffer();
                    // Определяем расширение
                    let ext = 'jpeg';
                    if (url.includes('.png')) ext = 'png';
                    else if (url.includes('.webp')) ext = 'webp';
                    else if (url.includes('.gif')) ext = 'gif';
                    imageCache.set(url, { buffer, extension: ext });
                    // Диагностика: фото успешно скачано и закэшировано
                    Diagnostics.logImage(url, resp.status, buffer.byteLength, 'CACHED', '');
                } catch(e) {
                    console.warn('[Ozon Copier] Не удалось скачать фото:', url, e);
                    // Диагностика: сетевая/прочая ошибка при загрузке фото
                    Diagnostics.logImage(url, '', 0, 'FETCH_ERROR', e);
                }
                picsDone++;
                btn.innerHTML = `🖼 Фото: ${picsDone}/${uniquePics.length}`;
            };

            // Скачиваем по 4 параллельно
            const CONCURRENCY = 4;
            for (let i = 0; i < uniquePics.length; i += CONCURRENCY) {
                const batch = uniquePics.slice(i, i + CONCURRENCY);
                await Promise.all(batch.map(fetchImage));
            }

            // Шаг 4: Собираем XLSX через ExcelJS
            btn.innerHTML = '📊 Собираю файл...';
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Ozon Copier';
            const ws = workbook.addWorksheet('Заказы');

            const HEADER_FILL = '1F4E79';
            const HEADER_FONT_COLOR = 'FFFFFF';

            // Заголовки
            const headers = ['№ Заказа', 'Статус', 'Товары', 'Кол-во', 'Сумма', 'Статус оплаты', 'Пункт выдачи', 'Дата доставки', 'Фото'];
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

            // Ширина колонок
            ws.columns = [
                { width: 20 }, // A: № Заказа
                { width: 24 }, // B: Статус доставки
                { width: 55 }, // C: Товары
                { width: 22 }, // D: Кол-во
                { width: 13 }, // E: Сумма
                { width: 22 }, // F: Статус оплаты
                { width: 28 }, // G: Пункт выдачи
                { width: 18 }, // H: Дата доставки (диапазоны 17–18.07.2026)
                { width: 18 } // I: Фото
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
                        name: '',
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
                    const name = item.name || '';
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

                    if (idx === 0) {
                        ws.getCell(row, 1).value = o.orderNumber;
                    }

                    ws.getCell(row, 2).value = displayStatus;
                    ws.getCell(row, 3).value = name;
                    ws.getCell(row, 4).value = qtyNum;
                    ws.getCell(row, 5).value = price;
                    ws.getCell(row, 5).numFmt = '#,##0.00';
                    ws.getCell(row, 6).value = pay;
                    ws.getCell(row, 7).value = o.pickupPoint;

                    // H: Дата / диапазон доставки — всегда текст (без timezone-сдвига)
                    ws.getCell(row, 8).value = toExcelDateValue(deliveryDateDisplay);

                    // Вставляем картинку в колонку I (col=8, 0-based)
                    if (picture && imageCache.has(picture)) {
                        const cached = imageCache.get(picture);
                        try {
                            const imageId = workbook.addImage({
                                buffer: cached.buffer,
                                extension: cached.extension
                            });
                            ws.addImage(imageId, {
                                tl: { col: 8, row: row - 1 },
                                ext: { width: IMG_HEIGHT, height: IMG_HEIGHT },
                                editAs: 'oneCell'
                            });
                            ws.getRow(row).height = IMG_HEIGHT * 0.75;
                        } catch(e) {
                            console.warn('[Ozon Copier] Ошибка вставки картинки:', e);
                            // Диагностика: не удалось вставить картинку в Excel
                            Diagnostics.logImage(picture, '', 0, 'EXCEL_INSERT_ERROR', e);
                            ws.getCell(row, 9).value = picture;
                        }
                    } else if (picture && !imageCache.has(picture)) {
                        ws.getCell(row, 9).value = picture;
                    }

                    // Стили для строки (9 колонок)
                    const isEvenRow = (row % 2 === 0);
                    const rowFill = isEvenRow
                        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F7FB' } }
                        : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF' } };
                    for (let c = 1; c <= 9; c++) {
                        const cell = ws.getCell(row, c);
                        cell.fill = rowFill;
                        cell.border = {
                            top: { style: 'thin' }, bottom: { style: 'thin' },
                            left: { style: 'thin' }, right: { style: 'thin' }
                        };
                        cell.alignment = { vertical: 'middle', wrapText: true };
                        if (c === 4 || c === 5 || c === 8) {
                            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                        }
                    }

                    row++;
                });
            });

            // Автофильтр
            ws.autoFilter = { from: 'A1', to: `I${row - 1}` };

            // Условное форматирование по статусам доставки (колонка B — 8 статусов)
            const lastDataRow = row - 1;
            if (lastDataRow >= 2) {
                ws.addConditionalFormatting({
                    ref: `B2:B${lastDataRow}`,
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

            // Условное форматирование по статусам оплаты (колонка F)
            ws.addConditionalFormatting({
                ref: `F2:F${lastDataRow}`,
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
            ws.mergeCells(summaryRow, 4, summaryRow, 5);
            ws.getCell(summaryRow, 4).value = 'ИТОГО (без отмен):';
            ws.getCell(summaryRow, 4).font = { bold: true, size: 12 };
            ws.getCell(summaryRow, 4).alignment = { horizontal: 'right', vertical: 'middle' };
            ws.getCell(summaryRow, 4).fill = summaryFill;
            ws.getCell(summaryRow, 5).fill = summaryFill;
            ws.getCell(summaryRow, 6).value = {
                formula: `SUMIF(B2:B${lastDataRow},"<>❌ Отменён",E2:E${lastDataRow})`
            };
            ws.getCell(summaryRow, 6).font = { bold: true, size: 12 };
            ws.getCell(summaryRow, 6).numFmt = '#,##0.00';
            ws.getCell(summaryRow, 6).fill = summaryFill;
            for (let c = 1; c <= 9; c++) {
                ws.getCell(summaryRow, c).border = {
                    top: { style: 'double' }, bottom: { style: 'thin' },
                    left: { style: 'thin' }, right: { style: 'thin' }
                };
            }

            // Шаг 5: Сохраняем и скачиваем
            btn.innerHTML = '💾 Сохраняю...';
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Ozon_Заказы_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
            btn.innerHTML = '📥 XLSX с фото';
            showToast(`✅ Скачан XLSX: ${deduped.length} заказов, ${totalItems} товаров, ${uniquePics.length} фото`, 'success');

        } catch(err) {
            console.error('[Ozon Copier] XLSX error:', err);
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
            btn.innerHTML = '📥 XLSX с фото';
            showToast('❌ Ошибка создания XLSX: ' + (err.message || 'неизвестная'), 'error');
        }
    }

    // ============================================================
    // 12b. ДИАГНОСТИЧЕСКИЙ ЭКСПОРТ В MARKDOWN (один файл, все секции)
    // ============================================================
    // Запускает обычный парсинг с включённым сборщиком Diagnostics,
    // затем формирует единый Markdown-файл со всеми секциями БЕЗ обрезки:
    //   1. Окружение      — метаданные (UA, URL, версия скрипта, время)
    //   2. Итоги          — сводка по заказам и collected-данным
    //   3. DOM-пробы      — какие CSS-селекторы сработали для pickupPoint/detailsAddress
    //   4. Diff парсинга  — ожидаемый путь → фактическое значение → OK/FAIL
    //   5. Ошибки         — агрегированный лог ошибок/предупреждений
    //   6. Сырые данные   — cardHTML, stateOrderList JSON, shipmentWidgets JSON (полностью)
    //   7. Снимки orderdetails — полный HTML страниц деталей заказов
    //   8. Фото           — лог загрузки и вставки изображений
    // ============================================================

    // ------------------------------------------------------------
    // Вспомогательная функция: построение строки Markdown-отчёта.
    // Принимает env (метаданные) и deduped (список распарсенных заказов).
    // Возвращает одну большую строку Markdown со всеми секциями.
    // ------------------------------------------------------------
    function buildDiagnosticsMarkdown(env, deduped) {
        const lines = [];
        const L = (s) => lines.push(s);
        const now = new Date();
        const stamp = now.toISOString().slice(0, 19).replace('T', ' ');

        // === Заголовок ===
        L(`# 🔬 Ozon Order Copier — Диагностический отчёт`);
        L('');
        L(`> Сгенерировано: **${stamp}** · версия скрипта **${SCRIPT_VERSION}**`);
        L('');
        L('Этот файл собран userscriptом для анализа проблем парсинга. ');
        L('Содержит полные (без обрезки) сырые данные DOM/JSON, результаты ');
        L('проб CSS-селекторов, diff парсинга и снимки страниц orderdetails.');
        L('');
        L('---');
        L('');

        // === 1. Окружение ===
        L(`## 1. 🖥 Окружение`);
        L('');
        L('| Параметр | Значение |');
        L('|---|---|');
        L(`| Время экспорта | ${env.timestamp} |`);
        L(`| Версия скрипта | ${env.scriptVersion} |`);
        L(`| URL страницы | ${env.pageUrl} |`);
        L(`| User-Agent | ${env.userAgent} |`);
        L(`| Платформа | ${env.platform} |`);
        L(`| Язык браузера | ${env.language} |`);
        L(`| Размер окна | ${env.viewport} |`);
        L('');
        L('---');
        L('');

        // === 2. Итоги (сводка) ===
        L(`## 2. 📊 Итоги сбора`);
        L('');
        L('| Метрика | Значение |');
        L('|---|---|');
        L(`| Найдено заказов (после дедупликации) | ${deduped.length} |`);
        L(`| Всего ошибок | ${Diagnostics.errors.length} |`);
        L(`| parse-результатов (diff) | ${Diagnostics.parseResults.length} |`);
        L(`| сырых снимков orderlist | ${Diagnostics.rawSnapshots.length} |`);
        L(`| снимков orderdetails | ${Diagnostics.orderDetailsSnapshots.length} |`);
        L(`| DOM-проб | ${Diagnostics.domProbes.length} |`);
        L(`| записей о фото | ${Diagnostics.imageLogs.length} |`);
        L('');

        // Краткая сводка по заказам (как их видит скрипт)
        if (deduped.length > 0) {
            L('### Сводка по заказам');
            L('');
            L('| № Заказа | Статус | Дата | PickupPoint | Items | FallbackAmount |');
            L('|---|---|---|---|---|---|');
            deduped.forEach(o => {
                const itemsCount = (o.items && o.items.length) ? o.items.length : 0;
                const pp = (o.pickupPoint || '').replace(/\|/g, '\\|').slice(0, 60);
                const d = (o.date || '').replace(/\|/g, '\\|');
                const st = (o.deliveryStatus || '').replace(/\|/g, '\\|');
                const fa = (o.fallbackAmount || '').replace(/\|/g, '\\|');
                L(`| ${o.orderNumber} | ${st} | ${d} | ${pp} | ${itemsCount} | ${fa} |`);
            });
            L('');
        }
        L('---');
        L('');

        // === 3. DOM-пробы ===
        L(`## 3. 🔎 DOM-пробы (селекторы для pickupPoint / detailsAddress)`);
        L('');
        L('Здесь показано, какие CSS-селекторы срабатывают на реальной странице, ');
        L('а какие — нет. Это ключ к обновлению логики извлечения адреса пункта выдачи.');
        L('');
        if (Diagnostics.domProbes.length === 0) {
            L('_DOM-пробы не собирались (заказы не найдены или этап пропущен)._');
        } else {
            Diagnostics.domProbes.forEach(probe => {
                L(`### 📦 Заказ \`${probe.orderNumber || '—'}\` · scope: \`${probe.scope}\` · root: \`${probe.rootSelector}\``);
                L('');
                if (!probe.probes || probe.probes.length === 0) {
                    L('_Нет данных._');
                    L('');
                    return;
                }
                probe.probes.forEach((p, i) => {
                    const status = p.found ? '✅ найден' : '❌ не найден';
                    L(`**[${i + 1}]** селектор \`${p.selector}\` — ${status}`);
                    if (p.count !== undefined) L(`- совпадений: ${p.count}`);
                    if (p.found && p.text) {
                        const txt = p.text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
                        L(`- текст: \`${txt}\``);
                    }
                    if (p.className) {
                        const cls = p.className.replace(/`/g, '\\`').slice(0, 250);
                        L(`- className: \`${cls}\``);
                    }
                    if (p.tagName) L(`- tagName: \`${p.tagName}\``);
                    if (p.found && p.outerHTML) {
                        L('');
                        L('<details><summary>outerHTML (обрезано до 400 символов)</summary>');
                        L('');
                        L('```html');
                        L(p.outerHTML);
                        L('```');
                        L('');
                        L('</details>');
                    }
                    L('');
                });
            });
        }
        L('---');
        L('');

        // === 4. Diff парсинга ===
        L(`## 4. 🧪 Diff парсинга (ожидание vs факт)`);
        L('');
        if (Diagnostics.parseResults.length === 0) {
            L('_parse-результатов нет._');
        } else {
            L('| # | Время | Заказ | Поле | Ожидаемый путь | Фактическое значение | Статус |');
            L('|---|---|---|---|---|---|---|');
            Diagnostics.parseResults.forEach((pr, i) => {
                const val = (pr.actualValue || '').replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 500);
                const exp = (pr.expectedPath || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
                const on = (pr.orderNumber || '').replace(/\|/g, '\\|');
                const fld = (pr.field || '').replace(/\|/g, '\\|');
                const st = pr.status === 'OK' ? '✅ OK' : '❌ FAIL';
                L(`| ${i + 1} | ${pr.timestamp} | ${on} | ${fld} | ${exp} | ${val} | ${st} |`);
            });
        }
        L('');
        L('---');
        L('');

        // === 5. Ошибки ===
        L(`## 5. ⚠️ Ошибки`);
        L('');
        if (Diagnostics.errors.length === 0) {
            L('_Ошибок не зафиксировано._');
        } else {
            Diagnostics.errors.forEach((err, i) => {
                L(`### [${i + 1}] ${err.timestamp} · заказ \`${err.orderNumber || '—'}\``);
                L('');
                L(`- **Этап:** \`${err.stage || '—'}\``);
                if (err.error) {
                    L(`- **Ошибка:** ${String(err.error).replace(/\n/g, ' ')}`);
                }
                if (err.raw) {
                    L('');
                    L('<details><summary>Сырые данные (полностью)</summary>');
                    L('');
                    L('```');
                    L(err.raw);
                    L('```');
                    L('');
                    L('</details>');
                }
                L('');
            });
        }
        L('---');
        L('');

        // === 6. Сырые данные orderlist ===
        L(`## 6. 🗂 Сырые данные orderlist (cardHTML / stateOrderList / shipmentWidgets)`);
        L('');
        if (Diagnostics.rawSnapshots.length === 0) {
            L('_Сырых снимков orderlist нет._');
        } else {
            Diagnostics.rawSnapshots.forEach((snap, i) => {
                L(`### [${i + 1}] Заказ \`${snap.orderNumber || '—'}\``);
                L('');
                L(`- Время: ${snap.timestamp}`);
                L(`- URL: ${snap.pageUrl}`);
                L(`- UA: ${snap.userAgent}`);
                L(`- Версия: ${snap.scriptVersion}`);
                L('');

                if (snap.cardHTML) {
                    L(`<details><summary>cardHTML (${snap.cardHTML.length} символов)</summary>`);
                    L('');
                    L('```html');
                    L(snap.cardHTML);
                    L('```');
                    L('');
                    L('</details>');
                    L('');
                }
                if (snap.stateOrderListJSON) {
                    L(`<details><summary>stateOrderListJSON (${snap.stateOrderListJSON.length} символов)</summary>`);
                    L('');
                    L('```json');
                    L(snap.stateOrderListJSON);
                    L('```');
                    L('');
                    L('</details>');
                    L('');
                }
                if (snap.shipmentWidgetsJSON) {
                    L(`<details><summary>shipmentWidgetsJSON (${snap.shipmentWidgetsJSON.length} символов)</summary>`);
                    L('');
                    L('```json');
                    L(snap.shipmentWidgetsJSON);
                    L('```');
                    L('');
                    L('</details>');
                    L('');
                }
            });
        }
        L('---');
        L('');

        // === 7. Снимки orderdetails ===
        L(`## 7. 📄 Снимки страниц orderdetails`);
        L('');
        if (Diagnostics.orderDetailsSnapshots.length === 0) {
            L('_Снимки orderdetails не собирались (этап fetch не выполнялся)._');
        } else {
            Diagnostics.orderDetailsSnapshots.forEach((snap, i) => {
                L(`### [${i + 1}] Заказ \`${snap.orderNumber || '—'}\``);
                L('');
                L(`- Время: ${snap.timestamp}`);
                L(`- shipmentWidgets найдено: ${snap.shipmentWidgetsCount}`);
                L(`- URL: ${snap.pageUrl}`);
                L(`- HTML размер: ${snap.html.length} символов`);
                L('');
                if (snap.html) {
                    L(`<details><summary>orderdetails HTML (${snap.html.length} символов)</summary>`);
                    L('');
                    L('```html');
                    L(snap.html);
                    L('```');
                    L('');
                    L('</details>');
                    L('');
                }
            });
        }
        L('---');
        L('');

        // === 8. Фото ===
        L(`## 8. 🖼 Фото`);
        L('');
        if (Diagnostics.imageLogs.length === 0) {
            L('_Записей о фото нет._');
        } else {
            L('| # | Время | URL | HTTP | Байты | Результат | Ошибка |');
            L('|---|---|---|---|---|---|---|');
            Diagnostics.imageLogs.forEach((il, i) => {
                const url = (il.url || '').replace(/\|/g, '\\|');
                const err = (il.error || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
                const res = il.result === 'CACHED' ? '✅ CACHED' : '❌ ' + (il.result || '');
                L(`| ${i + 1} | ${il.timestamp} | ${url} | ${il.httpStatus} | ${il.bytes} | ${res} | ${err} |`);
            });
        }
        L('');
        L('---');
        L('');
        L(`_Конец отчёта. Версия скрипта ${SCRIPT_VERSION}._`);

        return lines.join('\n');
    }

    async function exportDiagnostics() {
        const btn = document.querySelector('.ozon-diag-btn');
        if (!btn) return;

        btn.classList.add('ozon-diag-btn--loading');
        btn.innerHTML = '⏳ Собираю данные...';

        // Включаем сборщик и сбрасываем накопленные данные
        Diagnostics.enabled = true;
        Diagnostics.reset();

        try {
            // Шаг 1: Парсим заказы из DOM (с включённым логированием)
            btn.innerHTML = '⏳ Парсинг карточек...';
            const orders = parseOrders();

            // Дедупликация (как в copyOrders/downloadXLSX)
            const seenNumbers = new Set();
            const deduped = [];
            for (const o of orders) {
                if (!seenNumbers.has(o.orderNumber)) {
                    seenNumbers.add(o.orderNumber);
                    deduped.push(o);
                }
            }

            if (deduped.length === 0) {
                // Даже если заказы не найдены — всё равно формируем отчёт
                // (в нём будут сырые данные DOM и ошибки парсинга)
                console.log('[Ozon Copier] Диагностика: заказы не найдены, формирую отчёт по сырым данным');

                // v9.10: Захват сырого DOM для анализа структуры страницы
                try {
                    // Снимок body innerHTML (обрезаем до 500 КБ для Markdown)
                    const bodyHTML = document.body.innerHTML;
                    Diagnostics.snapshotRawData('[FALLBACK:body]', bodyHTML.substring(0, 500000), null, null);
                } catch(e) {
                    Diagnostics.logError('', 'exportDiagnostics.bodyHTML', '', e);
                }

                // Пробуем найти все ссылки на заказы и их родительскую иерархию
                try {
                    const orderLinks = document.querySelectorAll('a[href*="/my/orderdetails/?order="]');
                    const linkHints = [];
                    orderLinks.forEach((a, i) => {
                        if (i >= 10) return;
                        let el = a, chain = [], depth = 0;
                        while (el && el !== document.body && depth < 15) {
                            const cls = (el.className && typeof el.className === 'string') ? el.className.slice(0, 80) : '';
                            chain.push(el.tagName + (cls ? '.' + cls : ''));
                            el = el.parentElement;
                            depth++;
                        }
                        linkHints.push({
                            href: a.href,
                            parentChain: chain.join(' > '),
                            textSample: (a.textContent || '').trim().slice(0, 100)
                        });
                    });
                    Diagnostics.logParseResult('[orderList]', 'a[href*="order="] parent chains',
                        'all order links with parent hierarchy', JSON.stringify(linkHints, null, 2));
                } catch(e) {
                    Diagnostics.logError('', 'exportDiagnostics.orderLinks', '', e);
                }

                // Пробуем найти state-orderList JSON и записать его структуру
                try {
                    const stateEl = document.querySelector('[id*="state-orderList"]');
                    if (stateEl) {
                        const raw = stateEl.getAttribute('data-state') || '';
                        Diagnostics.snapshotRawData('[FALLBACK:state-orderList]', null, raw.substring(0, 500000), null);
                        try {
                            const json = JSON.parse(raw);
                            Diagnostics.logParseResult('[orderList]', 'state-orderList.ordersV2.length',
                                'json.ordersV2.length', String((json?.ordersV2 || []).length));
                        } catch(parseErr) {
                            Diagnostics.logError('', 'state-orderList.JSON.parse', raw.substring(0, 500), parseErr);
                        }
                    } else {
                        Diagnostics.logError('', 'state-orderList', '', '[id*="state-orderList"] not found');
                    }
                } catch(e) {
                    Diagnostics.logError('', 'exportDiagnostics.stateOrderList', '', e);
                }

                // Сканируем все элементы на странице с классами, похожими на d9w / w4d
                try {
                    const containers = [];
                    ['SECTION.d9w_11', '.d9w_11', '.w4d_11', 'SECTION[class*="d9w"]', 'DIV[class*="d9w_"]'].forEach(sel => {
                        const els = document.querySelectorAll(sel);
                        if (els.length > 0) {
                            containers.push({ selector: sel, count: els.length, sample: (els[0].className || '').slice(0, 100) });
                        }
                    });
                    Diagnostics.logParseResult('[orderList]', 'potential container selectors',
                        'd9w / w4d selectors scan', JSON.stringify(containers, null, 2));
                } catch(e) {
                    Diagnostics.logError('', 'exportDiagnostics.containerScan', '', e);
                }
            }

            // Шаг 2: Подгружаем товары (с логированием fetchOrderDetails)
            if (deduped.length > 0) {
                btn.innerHTML = `⏳ Загружаю детали (0/${deduped.length})...`;
                await enrichOrdersWithProducts(deduped, (current, total) => {
                    btn.innerHTML = `⏳ Загружаю детали (${current}/${total})...`;
                    showProgress(current, total);
                });
            }

            // Шаг 3: Скачиваем фото (с логированием fetchImage)
            if (deduped.length > 0) {
                btn.innerHTML = '🖼 Скачиваю фото...';
                const imageCache = new Map();
                const allPics = [];
                deduped.forEach(o => {
                    if (o.items) {
                        o.items.forEach(item => {
                            if (item.picture) allPics.push(item.picture);
                        });
                    }
                });
                const uniquePics = [...new Set(allPics)];
                let picsDone = 0;

                const fetchImage = async (url) => {
                    if (imageCache.has(url)) return;
                    try {
                        const resp = await fetch(url);
                        if (!resp.ok) {
                            Diagnostics.logImage(url, resp.status, 0, 'HTTP_ERROR',
                                `HTTP ${resp.status} ${resp.statusText}`);
                            return;
                        }
                        const buffer = await resp.arrayBuffer();
                        let ext = 'jpeg';
                        if (url.includes('.png')) ext = 'png';
                        else if (url.includes('.webp')) ext = 'webp';
                        else if (url.includes('.gif')) ext = 'gif';
                        imageCache.set(url, { buffer, extension: ext });
                        Diagnostics.logImage(url, resp.status, buffer.byteLength, 'CACHED', '');
                    } catch(e) {
                        Diagnostics.logImage(url, '', 0, 'FETCH_ERROR', e);
                    }
                    picsDone++;
                    btn.innerHTML = `🖼 Фото: ${picsDone}/${uniquePics.length}`;
                };

                const CONCURRENCY = 4;
                for (let i = 0; i < uniquePics.length; i += CONCURRENCY) {
                    const batch = uniquePics.slice(i, i + CONCURRENCY);
                    await Promise.all(batch.map(fetchImage));
                }
            }

            // Шаг 4: Формируем единый Markdown-файл со всеми секциями
            btn.innerHTML = '📝 Собираю Markdown...';
            const env = Diagnostics.getEnvironment();
            const md = buildDiagnosticsMarkdown(env, deduped);
            const totalBytes = new Blob([md]).size;
            const totalKB = Math.round(totalBytes / 1024);
            const totalMB = (totalBytes / 1048576).toFixed(2);

            // Шаг 5: Сохраняем и скачиваем .md
            btn.innerHTML = '💾 Сохраняю...';
            const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Ozon_Диагностика_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            btn.classList.remove('ozon-diag-btn--loading');
            btn.classList.add('ozon-diag-btn--success');
            btn.innerHTML = '✅ Отчёт скачан';
            showToast(
                `🔬 Диагностика: ${Diagnostics.errors.length} ошибок, ` +
                `${Diagnostics.parseResults.length} проверок, ` +
                `${Diagnostics.imageLogs.length} фото, ` +
                `размер ${totalKB >= 1024 ? totalMB + ' МБ' : totalKB + ' КБ'}`,
                'success'
            );
            setTimeout(() => {
                btn.classList.remove('ozon-diag-btn--success');
                btn.innerHTML = '🔬 Диагностика';
            }, 5000);

        } catch(err) {
            console.error('[Ozon Copier] Diagnostics error:', err);
            btn.classList.remove('ozon-diag-btn--loading');
            btn.classList.add('ozon-diag-btn--error');
            btn.innerHTML = '❌ Ошибка';
            showToast('❌ Ошибка диагностики: ' + (err.message || 'неизвестная'), 'error');
            setTimeout(() => {
                btn.classList.remove('ozon-diag-btn--error');
                btn.innerHTML = '🔬 Диагностика';
            }, 3000);
        } finally {
            // Всегда выключаем сборщик, чтобы не влиял на обычную работу
            Diagnostics.enabled = false;
        }
    }

    // ============================================================
    // 13. ДОБАВЛЕНИЕ КНОПОК
    // ============================================================
    function addButton() {
        if (document.querySelector('.ozon-copy-btn')) return;

        // Кнопка «Копировать TSV»
        const btn = document.createElement('button');
        btn.className = 'ozon-copy-btn';
        btn.innerHTML = '📋 Копировать заказы';
        btn.title = 'Скопировать все заказы на этой странице в буфер обмена для Яндекс Таблицы';
        btn.addEventListener('click', copyOrders);
        document.body.appendChild(btn);

        // Кнопка «Скачать XLSX с фото»
        const xlsxBtn = document.createElement('button');
        xlsxBtn.className = 'ozon-xlsx-btn';
        xlsxBtn.innerHTML = '📥 XLSX с фото';
        xlsxBtn.title = 'Скачать Excel-файл с реальными фотографиями товаров';
        xlsxBtn.addEventListener('click', downloadXLSX);
        document.body.appendChild(xlsxBtn);

        // Кнопка «🔬 Диагностика»
        const diagBtn = document.createElement('button');
        diagBtn.className = 'ozon-diag-btn';
        diagBtn.innerHTML = '🔬 Диагностика';
        diagBtn.title = 'Скачать диагностический Markdown-отчёт для разработчика (сырые данные, ошибки, diff парсинга, пробы селекторов)';
        diagBtn.addEventListener('click', exportDiagnostics);
        document.body.appendChild(diagBtn);

        console.log('[Ozon Copier v9.13] Кнопки добавлены');
    }

    // ============================================================
    // 14. ЗАПУСК
    // ============================================================
    function init() {
        const waitAndAdd = () => setTimeout(addButton, 1500);

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', waitAndAdd);
        } else {
            waitAndAdd();
        }

        const observer = new MutationObserver(() => {
            // v9.10: отслеживаем новые селекторы карточек заказов
            const hasCards = document.querySelector('SECTION.d9w_11')
                || document.querySelector('.w9d_11')
                || document.querySelector('a[href*="/my/orderdetails/?order="]');
            if (!document.querySelector('.ozon-copy-btn') && hasCards) {
                addButton();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        const origPush = history.pushState;
        history.pushState = function() {
            origPush.apply(this, arguments);
            setTimeout(addButton, 2000);
        };
        const origReplace = history.replaceState;
        history.replaceState = function() {
            origReplace.apply(this, arguments);
            setTimeout(addButton, 2000);
        };
    }

    init();

})();
