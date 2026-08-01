// ============================================================
// СЕКЦИЯ: src/core/fetch.js
// Источник: ozon-orders-copier.user.js — блоки «7. ПОДГРУЗКА ТОВАРОВ С
//   ЦЕНАМИ ИЗ /my/orderdetails/» и «7b. ОБОЁРТКА С RETRY» (строки 1667–2159):
//   fetchOrderDetailsOnce (1673–2061), fetchOrderDetails (2071–2097),
//   enrichOrdersWithProducts (2099–2159).
// Зависимости: Diagnostics (enabled/logError/logParseResult/logDomProbe/
//   snapshotRawData/snapshotOrderDetails — объявлен в секции diagnostics);
//   DOM: document, DOMParser; платформа: fetch (через fetchWithTimeout),
//   AbortController, setTimeout, console; ядро: fetchWithTimeout,
//   backoffDelay, normalizeStatus, normalizePaymentStatus,
//   pickBestPaymentStatus, parseDeliveryDate, parseRussianDate,
//   formatDateParts, MONTHS_RU_NAMES, parsePrice, extractProductPaymentStatus,
//   extractPaymentStatusFromAny, mergePaymentStatus.
// Объявляет: fetchOrderDetailsOnce, fetchOrderDetails, enrichOrdersWithProducts.
// ============================================================
    // ============================================================
    // 7. ПОДГРУЗКА ТОВАРОВ С ЦЕНАМИ ИЗ /my/orderdetails/
    // ============================================================
    // Внутренняя функция: одна попытка загрузки orderdetails.
    // При сетевой/HTTP-ошибке выбрасывает исключение (ловится обёрткой fetchOrderDetails).
    // Таймаут попытки — 5 с (реальный, через fetchWithTimeout: и заголовки, и чтение тела).
    async function fetchOrderDetailsOnce(orderNumber, signal) {
        try {
            const url = `/my/orderdetails/?order=${orderNumber}`;
            const resp = await fetchWithTimeout(url, { ms: 5000, signal, credentials: 'include' });
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

            // B2b (SECONDARY): дата оформления заказа со страницы orderdetails.
            // Реальный селектор — диагностический: snapshot HTML + logParseResult.
            // Финальный селектор может уточняться после реального прогона (F8).
            let orderDate = '';
            try {
                const dateCandidates = [];
                doc.querySelectorAll('.tsBody400Small, .tsBody500Medium, .tsCompactControl400Small, [class*="tsBody"], [class*="tsHeadline"]').forEach(el => {
                    const t = (el.textContent || '').trim();
                    if (!t || t.length > 120) return;
                    // «Заказ от 6 июля», «Оформлен 6 июля», «от 6 июля» — типовые подписи даты заказа
                    if (/от\s+\d{1,2}\s+[а-яё]+|оформлен|заказ\s+(от|№)/i.test(t)) {
                        dateCandidates.push(t);
                    }
                });
                if (dateCandidates.length === 0 && doc.body) {
                    dateCandidates.push((doc.body.textContent || '').replace(/\s+/g, ' '));
                }
                for (const cand of dateCandidates) {
                    // Точный паттерн «от ДД месяца» (дата заказа, не доставки)
                    const m = cand.match(new RegExp(`от\\s+(\\d{1,2})\\s+(${MONTHS_RU_NAMES})`, 'i'));
                    if (m) { orderDate = formatDateParts(m[1], m[2]); break; }
                    orderDate = parseRussianDate(cand);
                    if (orderDate) break;
                }
                if (orderDate) {
                    Diagnostics.logParseResult(orderNumber, 'JSON.orderDate',
                        'fallback: orderdetails (от ДД месяца → formatDateParts / parseRussianDate)', orderDate);
                } else {
                    Diagnostics.logParseResult(orderNumber, 'JSON.orderDate',
                        'orderdetails: дата оформления не распознана (snapshot HTML сохранён)', '');
                }
            } catch(e) {
                Diagnostics.logError(orderNumber, 'fetchOrderDetails.orderDate', '', e);
            }

            return { items: allItems, address: detailsAddress, orderDate };
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
    // Таймаут попытки 5 с + backoff 0,5/1/2 с → общий лимит ~16–21 с на заказ.
    // НЕ бросает исключение: при исчерпании попыток возвращает { items, address, error }.
    //   - TimeoutError (внутренний таймаут) → НЕ тихий возврат: retry, потом error-поле.
    //   - AbortError (внешняя отмена) → тихий возврат { items: [], address: '' } как раньше.
    // ============================================================
    async function fetchOrderDetails(orderNumber, signal) {
        const MAX_RETRIES = 3;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                return await fetchOrderDetailsOnce(orderNumber, signal);
            } catch(e) {
                if (e.name === 'AbortError') return { items: [], address: '' };
                if (e.name === 'TimeoutError') {
                    console.warn(`[Ozon Copier] fetch timeout for ${orderNumber}, attempt ${attempt + 1}/${MAX_RETRIES}`);
                }
                if (attempt < MAX_RETRIES - 1) {
                    const delay = backoffDelay(attempt);
                    console.warn(`[Ozon Copier] fetch attempt ${attempt + 1}/${MAX_RETRIES} failed for ${orderNumber}, retry in ${Math.round(delay)}ms:`, e.message || e);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                // Все попытки исчерпаны — формируем текст ошибки для пользователя
                const errText = (e.name === 'TimeoutError')
                    ? 'таймаут загрузки деталей заказа'
                    : ('HTTP ' + (e.message || 'ошибка загрузки деталей заказа'));
                console.warn(`[Ozon Copier] fetch error for ${orderNumber} after ${MAX_RETRIES} attempts:`, e);
                Diagnostics.logError(orderNumber, 'fetchOrderDetails (outer catch)', '', e);
                return { items: [], address: '', error: errText };
            }
        }
        return { items: [], address: '', error: 'таймаут загрузки деталей заказа' };
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
                // Ошибка загрузки деталей (таймаут/HTTP после retry) — пробрасываем заказу,
                // чтобы copyOrders/showPreview/downloadXLSX показали причину вместо статичного текста.
                if (data.error) order.error = data.error;
                // Запасной адрес пункта выдачи со страницы orderdetails
                if (!order.pickupPoint && data.address) {
                    order.pickupPoint = data.address;
                }
                // B2b (SECONDARY): дата заказа из orderdetails, если primary-fallback не дал.
                // Если и тут пусто — дата уже зафиксирована в Diagnostics (parseOrdersFromStateJSON).
                if (!order.date && data.orderDate) {
                    order.date = data.orderDate;
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