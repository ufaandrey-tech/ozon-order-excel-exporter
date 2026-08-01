// ============================================================
// СЕКЦИЯ: src/core/parse.js
// Источник: ozon-orders-copier.user.js — блоки «5. ПАРСИНГ КАРТОЧКИ ЗАКАЗА»,
//   «5b. ИЗВЛЕЧЕНИЕ СТАТУСОВ ОПЛАТЫ ИЗ ГЛОБАЛЬНОГО JSON ORDERLIST»,
//   «5c. JSON-FIRST ПАРСИНГ ЗАКАЗОВ ИЗ state-orderList»,
//   «6. ПАРСИНГ ВСЕХ ЗАКАЗОВ» (строки 875–1665):
//   parseOrder (878–1211), extractPaymentFromOrderListJSON (1218–1297),
//   parseOrdersFromStateJSON (1310–1575), parseOrders (1586–1665).
// Зависимости: Diagnostics (snapshotRawData/logError/logDomProbe/
//   logParseResult/enabled — объявлен в секции diagnostics);
//   DOM: document; console; ядро: parseRussianDate, parseDeliveryDate,
//   MONTHS_RU_NAMES, normalizeStatus, normalizePaymentStatus,
//   pickBestPaymentStatus, parsePrice, extractComposerAction,
//   extractProductPaymentStatus, extractPaymentStatusFromAny.
// Объявляет: parseOrder, extractPaymentFromOrderListJSON,
//   parseOrdersFromStateJSON, parseOrders.
// ============================================================
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
                    // Путь 2: COMPOSER_ACTION с base64 data-параметром (мульти-отправление).
                    // Чистая логика вынесена в extractComposerAction (тестируется в F3).
                    const composerNumber = extractComposerAction(s);
                    if (composerNumber) { orderNumber = composerNumber; break; }
                    if (/[?&]data=/.test(s)) {
                        // Диагностика: data-параметр был, но номер не извлечён (битый base64/JSON)
                        Diagnostics.logError('', `parseOrdersFromStateJSON.composerAction#${oi}`,
                            s.slice(0, 300), new Error('extractComposerAction → null (битый base64/JSON)'));
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
                // Дата заказа (B2b, PRIMARY fallback): парсим только из statusText
                // («Получен 6 июля»). Для «В пути»/«Отменён»/«Собирается» statusText
                // даты не содержит — подключаем fallback из текстовых полей leftBlock.
                let date = parseRussianDate(statusText);
                if (!date) {
                    // Fallback из JSON orderlist (B2b): парсим parseRussianDate по текстовым
                    // полям leftBlock КРОМЕ subtitle (subtitle занят датой доставки).
                    const leftDateCandidates = [
                        leftBlock?.title?.common?.text || leftBlock?.title?.text || '',
                        leftBlock?.common?.text || '',
                        leftBlock?.textIcon?.common?.text?.text || leftBlock?.textIcon?.text?.text || '',
                    ].filter(Boolean);
                    for (const cand of leftDateCandidates) {
                        date = parseRussianDate(cand);
                        if (date) {
                            // Диагностика: дата заказа восстановлена из leftBlock (не из statusText)
                            Diagnostics.logParseResult(orderNumber, 'JSON.date', 'fallback: leftBlock (title/common/textIcon) → parseRussianDate', date);
                            break;
                        }
                    }
                }
                if (!date) {
                    // Диагностика: дата заказа не найдена ни в statusText, ни в leftBlock —
                    // фиксируем в Diagnostics (B2b: для каждого заказа дата ИЛИ лог).
                    Diagnostics.logParseResult(orderNumber, 'JSON.date', 'parseRussianDate(statusText + leftBlock) → empty', 'дата заказа не определена (statusText: ' + statusText + ')');
                }

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