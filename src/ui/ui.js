// ============================================================
// СЕКЦИЯ: src/ui/ui.js
// Источник: ozon-orders-copier.user.js (userscript; идентичен
//   extension/content.js — проверено sync-check: расхождений нет).
//   Диапазон: секция «9. ПОКАЗ ПРЕДПРОСМОТРА» (строка 2282) —
//   конец init() (строка 3452), НО БЕЗ:
//     - copyToClipboard (строки 2381–2400) — перенесена в платформенные
//       обёртки src/platforms/userscript.js / extension.js;
//     - секции «12a. ПОСТРОЕНИЕ XLSX-КНИГИ» (строки 2538–2754) — уже
//       выделена в ядро src/core/export-xlsx.js (buildXlsxWorkbook);
//     - гарда module.exports (строки 3454–3478) — его добавит build этапа 3.
//   Обёртки IIFE ('use strict' / (function() { ... })();) не включены —
//   общий скоуп сборки.
// ЕДИНСТВЕННОЕ изменение против монолита (DI-адаптация, согласована):
//   - downloadXLSX: buildXlsxWorkbook(deduped, imageCache)
//     → buildXlsxWorkbook(deduped, imageCache, ExcelJS),
//     где ExcelJS — глобал платформы (userscript: @require;
//     extension: lib/exceljs.min.js в manifest).
//   Прямых обращений к new ExcelJS.Workbook() в UI-секции НЕТ
//   (workbook создаётся только в ядре buildXlsxWorkbook).
// Зависимости: ядро (escapeHtml, parseOrders, dedupeOrders,
//   enrichOrdersWithProducts, formatTSV, fetchWithTimeout,
//   detectImageType, Diagnostics, SCRIPT_VERSION); платформа
//   (copyToClipboard, ExcelJS); DOM.
// Объявляет: showPreview, showProgress, showToast, copyOrders,
//   downloadXLSX, buildDiagnosticsMarkdown, exportDiagnostics,
//   addButton, init (+ внутренние helper'ы orderTotalStr, fetchImage).
// ============================================================

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
            // Обрезка по code points (не режет суррогатные пары эмодзи).
            // Если детали не загрузились (error) — показываем текст ошибки вместо статичного плейсхолдера.
            const previewName = firstItem
                ? (() => {
                    const chars = Array.from(String(firstItem.name || ''));
                    return chars.slice(0, 50).join('') + (chars.length > 50 ? '…' : '');
                })()
                : (o.error || '(не удалось загрузить детали заказа)');
            const moreCount = hasItems ? o.items.length - 1 : 0;

            // ВСЕ подставляемые значения экранируем (XSS: <img onerror=...> в orderNumber/названии/цене)
            html += `<tr>
                <td>
                    <small><b>${escapeHtml(o.orderNumber)}</b></small>
                    ${previewName ? `<span class="product-name">${escapeHtml(previewName)}</span>` : ''}
                    ${moreCount > 0 ? `<span style="color:#999;font-size:11px;">+${escapeHtml(moreCount)} товаров</span>` : ''}
                </td>
                <td>
                    ${hasItems ? o.items.map(i => escapeHtml(i.price)).join('+') : ''}
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

        btn.classList.add('ozon-copy-btn--loading');
        btn.innerHTML = '⏳ Анализирую...';

        try {
            // Шаг 1: Парсим заказы из DOM
            const orders = parseOrders();

            // Шаг 1.5: Дедупликация — Ozon может показывать один заказ в нескольких карточках
            // (разные отправления). Оставляем только первое вхождение каждого orderNumber.
            const deduped = dedupeOrders(orders);
            if (deduped.length < orders.length) {
                console.log(`[Ozon Copier] Удалено дублей: ${orders.length - deduped.length}`);
            }

            if (deduped.length === 0) {
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
            btn.innerHTML = `⏳ Загружаю товары (0/${deduped.length})...`;

            await enrichOrdersWithProducts(deduped, (current, total) => {
                btn.innerHTML = `⏳ Загружаю товары (${current}/${total})...`;
                showProgress(current, total);
            });

            // Шаг 3: Итоговый предпросмотр
            showPreview(deduped);

            // Предупреждение о заказах, детали которых не удалось загрузить (таймаут/HTTP)
            const failedCount = deduped.filter(o => o.error).length;
            if (failedCount > 0) {
                showToast(`⚠️ ${failedCount} ${failedCount === 1 ? 'заказ' : 'заказов'} не удалось загрузить (таймаут/сеть)`, 'error');
            }

            // Шаг 4: Форматируем и копируем
            const tsv = formatTSV(deduped);
            const ok = copyToClipboard(tsv);

            if (ok) {
                btn.classList.remove('ozon-copy-btn--loading');
                btn.classList.add('ozon-copy-btn--success');
                const totalItems = deduped.reduce((s, o) => s + ((o.items && o.items.length) || 0), 0);
                btn.innerHTML = `✅ ${deduped.length} заказов, ${totalItems} товаров`;

                showToast(`✅ Скопировано: ${deduped.length} заказов, ${totalItems} товаров\n📋 Вставьте: Ctrl+V`, 'success');

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
            const deduped = dedupeOrders(orders);
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
                    // Фото: 30 с на запрос, БЕЗ retry (тяжёлые файлы, retry не поможет).
                    const resp = await fetchWithTimeout(url, { ms: 30000 });
                    if (!resp.ok) {
                        // Диагностика: HTTP-ошибка при загрузке фото
                        Diagnostics.logImage(url, resp.status, 0, 'HTTP_ERROR',
                            `HTTP ${resp.status} ${resp.statusText}`);
                        return;
                    }
                    const buffer = await resp.arrayBuffer();
                    // Определяем расширение по Content-Type/магическим байтам (fallback на URL)
                    const ext = detectImageType(buffer, url, resp.headers.get('content-type'));
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

            // Шаг 4: Собираем XLSX через ExcelJS (построение книги вынесено в buildXlsxWorkbook)
            btn.innerHTML = '📊 Собираю файл...';

            // ExcelJS подключается @require (userscript) / manifest (расширение).
            // Если он не загрузился — показываем понятную ошибку, а не роняем скрипт.
            if (typeof ExcelJS === 'undefined') {
                showToast('❌ ExcelJS не загружен. Проверьте подключение библиотеки (см. @require) и обновите страницу.', 'error');
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
                btn.innerHTML = '📥 XLSX с фото';
                return;
            }

            const workbook = buildXlsxWorkbook(deduped, imageCache, ExcelJS);

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
    // 12b. ДИАГНОСТИЧЕСКИЙ ЭКСПОРТ В MARKDOWN
    // buildDiagnosticsMarkdown объявлен в ядре src/core/diagnostics.js;
    // здесь — только точка входа exportDiagnostics (вызов ниже).
    // ============================================================

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
            const deduped = dedupeOrders(orders);

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
                        // Фото: 30 с на запрос, БЕЗ retry (тяжёлые файлы, retry не поможет).
                        const resp = await fetchWithTimeout(url, { ms: 30000 });
                        if (!resp.ok) {
                            Diagnostics.logImage(url, resp.status, 0, 'HTTP_ERROR',
                                `HTTP ${resp.status} ${resp.statusText}`);
                            return;
                        }
                        const buffer = await resp.arrayBuffer();
                        const ext = detectImageType(buffer, url, resp.headers.get('content-type'));
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

        console.log('[Ozon Copier v9.15] Кнопки добавлены');
    }

    // ============================================================
    // 14. ЗАПУСК
    // ============================================================
    function init() {
        // Защита от повторного патчинга history (повторные вызовы init при перезапуске скрипта):
        // если флаг уже установлен — не патчим повторно pushState/replaceState.
        if (!window.__ozonCopierPatched) {
            window.__ozonCopierPatched = true;
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
            // Флаг-дедупликация: если кнопки уже добавлены — addButton не вызываем.
            // НЕ используем disconnect(): после disconnect кнопки пропадут при SPA-переходах.
            if (!document.querySelector('.ozon-copy-btn') && hasCards) {
                addButton();
            }
        });

        // Защита от раннего старта: document.body может быть null
        // (например, скрипт запущен до построения DOM). Ждём DOMContentLoaded.
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', () => {
                observer.observe(document.body, { childList: true, subtree: true });
            });
        } else {
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }
