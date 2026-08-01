// ============================================================
// СЕКЦИЯ: src/core/statuses.js
// Источник: ozon-orders-copier.user.js — блок «2. СТАТУСЫ»:
//   normalizeStatus (546–599), normalizePaymentStatus (602–621),
//   collectPaymentStatuses (624–642), pickBestPaymentStatus (644–659),
//   extractPaymentStatusFromAny (661–665), extractProductPaymentStatus (667–704),
//   mergePaymentStatus (707–710).
// Зависимости: Diagnostics (только logParseResult в диагностической
//   ветке normalizeStatus; объявлен в секции diagnostics).
// Объявляет: normalizeStatus, normalizePaymentStatus, collectPaymentStatuses,
//   pickBestPaymentStatus, extractPaymentStatusFromAny,
//   extractProductPaymentStatus, mergePaymentStatus.
// ============================================================

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
