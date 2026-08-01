// ============================================================
// СЕКЦИЯ: src/core/diagnostics.js
// Источник: ozon-orders-copier.user.js:
//   1) секция «1b. ДИАГНОСТИЧЕСКИЙ МОДУЛЬ» (строки 256–387): объект
//      Diagnostics (267–387);
//   2) секция «12b. ДИАГНОСТИЧЕСКИЙ ЭКСПОРТ В MARKDOWN» (строки 2886–3171):
//      buildDiagnosticsMarkdown (2906–3171).
// Зависимости: SCRIPT_VERSION (constants — объявлен раньше в скоупе);
//   Diagnostics читает window/navigator в методах getEnvironment()/
//   snapshotRawData/snapshotOrderDetails (рантайм, вызывается только из
//   обёрток на этапе 2); buildDiagnosticsMarkdown(env, deduped) — чистая по
//   сути (env передаётся параметром), использует SCRIPT_VERSION и Diagnostics
//   из того же скоупа.
// Платформа: window/navigator ТОЛЬКО в рантайм-методах Diagnostics;
// buildDiagnosticsMarkdown — чистый (env передаётся параметром).
// Объявляет: Diagnostics, buildDiagnosticsMarkdown.
// ============================================================
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
                const on = (o.orderNumber || '').replace(/\|/g, '\\|');
                L(`| ${on} | ${st} | ${d} | ${pp} | ${itemsCount} | ${fa} |`);
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
