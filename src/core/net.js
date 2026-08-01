// ============================================================
// СЕКЦИЯ: src/core/net.js
// Источник: ozon-orders-copier.user.js — блок «1c. УТИЛИТЫ»:
//   fetchWithTimeout (411–449), detectImageType (506–541).
// Зависимости: нет (использует глобальный fetch/AbortController,
//   DOM/window/GM_* не читает).
// Объявляет: fetchWithTimeout, detectImageType.
// ============================================================

    // fetch с реальным таймаутом:
    //   - внутренний AbortController + setTimeout(abort(new DOMException('timeout','TimeoutError')), ms);
    //   - внешний signal слушаем через addEventListener('abort') → controller.abort() (приходит AbortError);
    //   - clearTimeout по завершении (в finally);
    //   - чтение тела (text/arrayBuffer/json/blob) тоже под таймаутом (зависшее тело не отменяется самим abort fetch).
    // Семантика: TimeoutError — НЕ тихий (retry в fetchOrderDetails), AbortError — внешняя отмена (тихий возврат).
    async function fetchWithTimeout(url, options) {
        const { ms = 30000, signal, ...rest } = options || {};
        const controller = new AbortController();
        let timer = null;
        const onAbort = () => controller.abort();
        if (signal) {
            if (signal.aborted) controller.abort();
            else signal.addEventListener('abort', onAbort, { once: true });
        }
        const armTimer = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                controller.abort(new DOMException('timeout', 'TimeoutError'));
            }, ms);
        };
        const clearTimer = () => {
            if (timer) { clearTimeout(timer); timer = null; }
        };
        try {
            armTimer();
            const resp = await fetch(url, { ...rest, signal: controller.signal });
            // Оборачиваем чтение тела тем же таймаутом.
            const wrapBodyRead = (fn) => (...args) => {
                armTimer();
                return fn(...args).finally(clearTimer);
            };
            resp.text = wrapBodyRead(resp.text.bind(resp));
            resp.arrayBuffer = wrapBodyRead(resp.arrayBuffer.bind(resp));
            resp.json = wrapBodyRead(resp.json.bind(resp));
            resp.blob = wrapBodyRead(resp.blob.bind(resp));
            clearTimer();
            return resp;
        } catch(e) {
            clearTimer();
            throw e;
        } finally {
            if (signal) signal.removeEventListener('abort', onAbort);
        }
    }

    // Определение типа изображения (расширения для ExcelJS) по приоритету:
    //   1. Магические байты данных (самый надёжный источник — фактические данные):
    //      PNG 89 50 4E 47, JPEG FF D8 FF, GIF 47 49 46 38,
    //      WebP 52 49 46 46 … 57 45 42 50 (RIFF…WEBP), BMP 42 4D;
    //   2. Content-Type из заголовка ответа (resp.headers.get('content-type'));
    //   3. URL (url.includes('.png') и т.п.) — ТОЛЬКО если заголовок отсутствует.
    // Возвращает расширение: 'png' | 'jpeg' | 'gif' | 'webp' | 'bmp' | 'jpeg' (по умолчанию).
    function detectImageType(bytes, url, contentType) {
        const b = bytes && bytes.length ? new Uint8Array(bytes) : null;
        if (b && b.length >= 4) {
            // PNG: 89 50 4E 47
            if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'png';
            // GIF: 47 49 46 38
            if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'gif';
            // BMP: 42 4D
            if (b[0] === 0x42 && b[1] === 0x4D) return 'bmp';
        }
        if (b && b.length >= 3) {
            // JPEG: FF D8 FF
            if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpeg';
        }
        if (b && b.length >= 12) {
            // WebP: RIFF(52 49 46 46) .... WEBP(57 45 42 50)
            if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
                b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
        }
        // Content-Type из заголовка ответа
        const ct = String(contentType || '').toLowerCase();
        if (ct) {
            if (ct.includes('png')) return 'png';
            if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpeg';
            if (ct.includes('gif')) return 'gif';
            if (ct.includes('webp')) return 'webp';
            if (ct.includes('bmp')) return 'bmp';
        }
        // Fallback на URL — только если Content-Type отсутствует
        const u = String(url || '').toLowerCase();
        if (u.includes('.png')) return 'png';
        if (u.includes('.webp')) return 'webp';
        if (u.includes('.gif')) return 'gif';
        if (u.includes('.bmp')) return 'bmp';
        return 'jpeg';
    }
