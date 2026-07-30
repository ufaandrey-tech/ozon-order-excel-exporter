// ==UserScript==
// @name         📋 Ozon Order Copier v8 (XLSX с реальными фото)
// @namespace    http://tampermonkey.net/
// @version      8.0
// @description  Копирует заказы Ozon. Дедупликация. Инд. цены. Кнопка скачивания XLSX с реальными фото.
// @author       Volunteer Helper
// @match        https://www.ozon.ru/my/orderlist*
// @match        https://ozon.ru/my/orderlist*
// @icon         https://www.ozon.ru/favicon.ico
// @require      https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @connect      ir.ozone.ru
// ==/UserScript==

(function() {
    'use strict';

    // ============================================================
    // 1. СТИЛИ
    // ============================================================
    GM_addStyle(`
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
            bottom: 80px !important;
            right: 24px !important;
            z-index: 999998 !important;
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
            right: 24px !important;
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
            right: 24px !important;
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
    `);

    // ============================================================
    // 2. СТАТУСЫ
    // ============================================================
    function normalizeStatus(text) {
        if (!text) return '';
        const t = text.toLowerCase().trim();
        const map = {
            'оплачен': '✅ Оплачен',
            'оплачено': '✅ Оплачен',
            'не оплачен': '❌ Не оплачен',
            'не оплачено': '❌ Не оплачен',
            'к оплате при получении': '⏳ При получении',
            'ожидает': '⏳ Ожидает оплаты',
            'частично': '🟡 Частично оплачен',
            'возврат': '🔄 Возврат',
            'доставлен': '✅ Доставлен',
            'доставлено': '✅ Доставлен',
            'получен': '✅ Доставлен',
            'получено': '✅ Доставлен',
            'можно забирать': '📦 Готов к выдаче',
            'в пути': '🚚 В пути',
            'передан': '🚚 Передан в доставку',
            'собирается': '📦 Собирается',
            'обрабатывается': '📦 Обрабатывается',
            'отменён': '❌ Отменён',
            'отменено': '❌ Отменён',
        };
        return map[t] || text.trim();
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

    function parseRussianDate(text) {
        if (!text) return '';
        // "Получен 6 июля" или "6 июля"
        const m = text.match(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i);
        if (m) {
            const day = m[1].padStart(2, '0');
            const month = MONTHS_RU[m[2].toLowerCase()] || '01';
            const year = new Date().getFullYear();
            return `${day}.${month}.${year}`;
        }
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

        // --- ДАТА ---
        let date = '';
        const statusEl = card.querySelector('.tsHeadline550Medium');
        if (statusEl) {
            date = parseRussianDate(statusEl.textContent);
        }
        if (!date) {
            date = parseRussianDate(text);
        }
        if (!date) {
            const now = new Date();
            date = now.toLocaleDateString('ru-RU');
        }

        // --- СТАТУС ДОСТАВКИ (основной, с карточки) ---
        let deliveryStatus = '';
        if (statusEl) {
            deliveryStatus = normalizeStatus(statusEl.textContent);
        }
        if (!deliveryStatus) {
            const lower = text.toLowerCase();
            if (lower.includes('можно забирать')) deliveryStatus = '📦 Готов к выдаче';
            else if (lower.includes('получен')) deliveryStatus = '✅ Доставлен';
            else if (lower.includes('доставлен')) deliveryStatus = '✅ Доставлен';
            else if (lower.includes('в пути')) deliveryStatus = '🚚 В пути';
            else if (lower.includes('отмен')) deliveryStatus = '❌ Отменён';
        }

        // --- ТОВАРЫ (будут подгружены позже) ---
        let items = [];

        // --- СТАТУС ОПЛАТЫ ---
        let paymentStatus = '';
        const payEl = card.querySelector('.b5_7_0-a4');
        if (payEl) {
            const t = (payEl.title || payEl.textContent || '').trim();
            if (t) paymentStatus = normalizeStatus(t);
        }
        if (!paymentStatus) {
            const lower = text.toLowerCase();
            if (lower.includes('не оплачен')) paymentStatus = '❌ Не оплачен';
            else if (lower.includes('оплачен')) paymentStatus = '✅ Оплачен';
            else if (lower.includes('к оплате')) paymentStatus = '⏳ При получении';
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
        let pickupPoint = '';
        const addrEl = card.querySelector('.dx0_11, .d0x_11');
        if (addrEl) {
            pickupPoint = (addrEl.textContent || '').trim().replace(/^(Пункт Ozon:\s*)/i, '');
        }

        if (!orderNumber) return null;

        return { orderNumber, date, deliveryStatus, items, paymentStatus, fallbackAmount, pickupPoint };
    }

    // ============================================================
    // 6. ПАРСИНГ ВСЕХ ЗАКАЗОВ
    // ============================================================
    function parseOrders() {
        const cards = document.querySelectorAll('.w9d_11');
        if (cards.length === 0) {
            const container = document.querySelector('.x3d_11');
            if (container) {
                const items = container.querySelectorAll(':scope > div');
                if (items.length > 0) return Array.from(items).map(parseOrder).filter(Boolean);
            }
            return [];
        }
        return Array.from(cards).map(parseOrder).filter(Boolean);
    }

    // ============================================================
    // 7. ПОДГРУЗКА ТОВАРОВ С ЦЕНАМИ ИЗ /my/orderdetails/
    // ============================================================
    async function fetchOrderDetails(orderNumber, signal) {
        try {
            const url = `/my/orderdetails/?order=${orderNumber}`;
            const resp = await fetch(url, { signal, credentials: 'include' });
            if (!resp.ok) return [];

            const html = await resp.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Ищем shipmentWidget-ы — каждый содержит товары одной отправки
            const shipmentWidgets = doc.querySelectorAll('[id*="shipmentWidget"]');
            const allItems = [];

            shipmentWidgets.forEach(el => {
                try {
                    const raw = el.getAttribute('data-state') || '';
                    if (!raw) return;
                    const json = JSON.parse(raw);

                    // Статус этой отправки: header[0].textIcon.text.text
                    let shipmentStatus = '';
                    try {
                        shipmentStatus = json.header[0].textIcon.text.text || '';
                    } catch(e) {}

                    // Товары в этой отправке
                    const items = json.items || [];
                    items.forEach(item => {
                        const sellers = item.sellers || [];
                        sellers.forEach(seller => {
                            const products = seller.products || [];
                            products.forEach(p => {
                                const name = p.title?.name?.text;
                                if (!name || name.length < 3 || name.length > 300) return;

                                // Цена: price.price[0].text
                                let price = '';
                                try {
                                    price = parsePrice(p.price.price[0].text);
                                } catch(e) {}

                                // Фото: picture.image.image
                                let picture = '';
                                try {
                                    picture = p.picture.image.image || '';
                                } catch(e) {}

                                allItems.push({
                                    name: name,
                                    price: price,
                                    shipmentStatus: normalizeStatus(shipmentStatus),
                                    picture: picture
                                });
                            });
                        });
                    });
                } catch(e) {
                    // Пропускаем не JSON или не ту структуру
                }
            });

            return allItems;
        } catch(e) {
            if (e.name === 'AbortError') return [];
            console.warn(`[Ozon Copier] fetch error for ${orderNumber}:`, e);
            return [];
        }
    }

    async function enrichOrdersWithProducts(orders, onProgress) {
        const controller = new AbortController();
        const CONCURRENCY = 2; // 2 одновременных запроса

        for (let i = 0; i < orders.length; i += CONCURRENCY) {
            const batch = orders.slice(i, i + CONCURRENCY);
            const results = await Promise.all(
                batch.map(order => fetchOrderDetails(order.orderNumber, controller.signal))
            );
            results.forEach((items, idx) => {
                orders[i + idx].items = items || [];
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
            'Дата',
            '№ Заказа',
            'Статус',
            'Товары',
            'Сумма',
            'Статус оплаты',
            'Пункт выдачи',
            'Фото'
        ];

        let tsv = BOM + headers.join(sep) + '\n';

        let grandTotal = 0;
        let totalRows = 0;

        orders.forEach(o => {
            const hasItems = o.items && o.items.length > 0;

            // Если товары подгружены — используем их, иначе fallback (одна пустая строка)
            const displayItems = hasItems ? o.items : [{ name: '', price: '', shipmentStatus: '', picture: '' }];

            // Сумма по заказу (только для итоговой строки)
            const orderTotal = hasItems
                ? o.items.reduce((s, item) => {
                    const p = parseFloat((item.price || '').replace(',', '.'));
                    return s + (isNaN(p) ? 0 : p);
                }, 0)
                : parseFloat((o.fallbackAmount || '').replace(',', '.'));
            if (!isNaN(orderTotal)) grandTotal += orderTotal;

            // Префикс ' чтобы Excel не конвертировал дату в число
            const dateText = o.date ? "'" + o.date : '';

            displayItems.forEach((item, idx) => {
                const name = item.name || '';
                const price = hasItems ? (item.price || '') : '';
                const picture = item.picture || '';
                // Для первого товара используем статус доставки с карточки
                // Для остальных — статус отправки, если есть
                const displayStatus = (idx === 0) ? o.deliveryStatus : (item.shipmentStatus || '');

                if (idx === 0) {
                    // Первая строка — все колонки. Сумма = индивидуальная цена товара
                    tsv += [
                        dateText,
                        o.orderNumber,
                        displayStatus,
                        name,
                        price, // Индивидуальная цена товара
                        o.paymentStatus,
                        o.pickupPoint,
                        picture
                    ].join(sep) + '\n';
                } else {
                    // Последующие строки — товар + его цена
                    tsv += [
                        '',
                        '',
                        displayStatus,
                        name,
                        price, // Индивидуальная цена товара
                        '',
                        '',
                        picture
                    ].join(sep) + '\n';
                }
                totalRows++;
            });
        });

        // Итоги
        if (orders.length > 0) {
            tsv += '\n';
            tsv += ['', '', '', '', '', '', '', ''].join(sep) + '\n';
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

            const orderTotal = hasItems
                ? o.items.reduce((s, item) => {
                    const p = parseFloat((item.price || '').replace(',', '.'));
                    return s + (isNaN(p) ? 0 : p);
                }, 0)
                : parseFloat((o.fallbackAmount || '').replace(',', '.'));
            if (!isNaN(orderTotal)) grandTotal += orderTotal;

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
    function copyToClipboard(text) {
        try {
            GM_setClipboard(text, 'text');
            return true;
        } catch(e) {
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
        toast.textContent = msg;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('ozon-copy-toast--show'));
        setTimeout(() => {
            toast.classList.remove('ozon-copy-toast--show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    async function copyOrders() {
        const btn = document.querySelector('.ozon-copy-btn');
        if (!btn) return;

        btn.classList.add('ozon-copy-btn--loading');
        btn.innerHTML = '⏳ Анализирую...';

        try {
            // Шаг 1: Парсим заказы из DOM
            const orders = parseOrders();

            // Шаг 1.5: Дедупликация — Ozon может показывать один заказ в нескольких карточках
            // (разные отправления). Оставляем только первое вхождение каждого orderNumber.
            const seenNumbers = new Set();
            const deduped = [];
            for (const o of orders) {
                if (!seenNumbers.has(o.orderNumber)) {
                    seenNumbers.add(o.orderNumber);
                    deduped.push(o);
                }
            }
            if (deduped.length < orders.length) {
                const removed = orders.length - deduped.length;
                console.log(`[Ozon Copier] Удалено дублей: ${removed}`);
            }
            orders.length = 0;
            orders.push(...deduped);

            if (orders.length === 0) {
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

            // Шаг 4: Форматируем и копируем
            const tsv = formatTSV(orders);
            const ok = copyToClipboard(tsv);

            if (ok) {
                btn.classList.remove('ozon-copy-btn--loading');
                btn.classList.add('ozon-copy-btn--success');
                const totalItems = orders.reduce((s, o) => s + ((o.items && o.items.length) || 0), 0);
                btn.innerHTML = `✅ ${orders.length} заказов, ${totalItems} товаров`;

                let msg = `✅ Скопировано: ${orders.length} заказов, ${totalItems} товаров\n📋 Вставьте: Ctrl+V`;

                showToast(msg, 'success');

                setTimeout(() => {
                    btn.classList.remove('ozon-copy-btn--success');
                    btn.innerHTML = '📋 Копировать заказы';
                }, 5000);
            } else {
                throw new Error('Copy failed');
            }
        } catch(err) {
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
                    if (!resp.ok) return;
                    const buffer = await resp.arrayBuffer();
                    // Определяем расширение
                    let ext = 'jpeg';
                    if (url.includes('.png')) ext = 'png';
                    else if (url.includes('.webp')) ext = 'webp';
                    else if (url.includes('.gif')) ext = 'gif';
                    imageCache.set(url, { buffer, extension: ext });
                } catch(e) {
                    console.warn('[Ozon Copier] Не удалось скачать фото:', url, e);
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
            const headers = ['Дата', '№ Заказа', 'Статус', 'Товары', 'Сумма', 'Статус оплаты', 'Пункт выдачи', 'Фото'];
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
                { width: 14 },
                { width: 20 },
                { width: 24 },
                { width: 55 },
                { width: 13 },
                { width: 22 },
                { width: 28 },
                { width: 18 }
            ];

            // Фиксация шапки
            ws.views = [{ state: 'frozen', ySplit: 1 }];

            // Данные
            let row = 2;
            const IMG_HEIGHT = 100; // px — высота картинки в ячейке

            deduped.forEach(o => {
                const hasItems = o.items && o.items.length > 0;
                const displayItems = hasItems ? o.items : [{ name: '', price: '', shipmentStatus: '', picture: '' }];
                const dateText = o.date ? "'" + o.date : '';

                displayItems.forEach((item, idx) => {
                    const name = item.name || '';
                    const price = hasItems ? (() => { const v = String(item.price || '').replace(',', '.'); const n = parseFloat(v); return isNaN(n) ? (item.price || '') : n; })() : '';
                    const picture = item.picture || '';
                    const displayStatus = (idx === 0) ? o.deliveryStatus : (item.shipmentStatus || '');

                    if (idx === 0) {
                        ws.getCell(row, 1).value = dateText;
                        ws.getCell(row, 2).value = o.orderNumber;
                        ws.getCell(row, 3).value = displayStatus;
                        ws.getCell(row, 4).value = name;
                        ws.getCell(row, 5).value = price;
                        ws.getCell(row, 6).value = o.paymentStatus;
                        ws.getCell(row, 7).value = o.pickupPoint;
                    } else {
                        ws.getCell(row, 3).value = displayStatus;
                        ws.getCell(row, 4).value = name;
                        ws.getCell(row, 5).value = price;
                    }

                    // Вставляем картинку
                    if (picture && imageCache.has(picture)) {
                        const cached = imageCache.get(picture);
                        try {
                            const imageId = workbook.addImage({
                                buffer: cached.buffer,
                                extension: cached.extension
                            });
                            ws.addImage(imageId, {
                                tl: { col: 7, row: row - 1 }, // 0-based
                                ext: { width: IMG_HEIGHT, height: IMG_HEIGHT },
                                editAs: 'oneCell'
                            });
                            ws.getRow(row).height = IMG_HEIGHT * 0.75; // px → pt conversion
                        } catch(e) {
                            console.warn('[Ozon Copier] Ошибка вставки картинки:', e);
                            ws.getCell(row, 8).value = picture; // fallback: ссылка
                        }
                    } else if (picture && !imageCache.has(picture)) {
                        // Картинка не скачалась — вставляем ссылку
                        ws.getCell(row, 8).value = picture;
                    }

                    // Стили для строки
                    for (let c = 1; c <= 8; c++) {
                        const cell = ws.getCell(row, c);
                        cell.border = {
                            top: { style: 'thin' }, bottom: { style: 'thin' },
                            left: { style: 'thin' }, right: { style: 'thin' }
                        };
                        cell.alignment = { vertical: 'middle', wrapText: true };
                    }

                    row++;
                });
            });

            // Автофильтр
            ws.autoFilter = { from: 'A1', to: `H${row - 1}` };

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

        console.log('[Ozon Copier v8] Кнопки добавлены');
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
            if (!document.querySelector('.ozon-copy-btn') && document.querySelector('.w9d_11')) {
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
