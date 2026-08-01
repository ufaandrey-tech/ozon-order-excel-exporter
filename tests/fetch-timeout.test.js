// ============================================================
// F5: Тест fetchWithTimeout (A4).
//  - незавершённый fetch + таймер → TimeoutError (не тихий);
//  - внешний сигнал отмены → AbortError → тихий возврат;
//  - clearTimeout не оставляет висящих таймеров;
//  - retry-цепочка fetchOrderDetails: после исчерпания попыток
//    результат содержит error (текст таймаута), fetch вызван 3 раза.
// Фейковый fetch подменяется через global.fetch.
// Этап 4 рефакторинга: оба артефакта (userscript и extension)
// собираются из единого ядра src/core/, поэтому тест идёт по
// ЕДИНОМУ источнику — собранному dist/ozon-orders-copier.user.js
// (у него тот же гард module.exports, что и у dist/extension/content.js).
// ============================================================

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const userScript = require('../dist/ozon-orders-copier.user.js');

const implementations = [
    { name: 'userscript', m: userScript }
];

// Фейковый fetch: pending до abort сигнала, отклоняет с signal.reason.
function makePendingFetch() {
    return function pendingFetch(url, opts) {
        return new Promise((resolve, reject) => {
            const signal = opts && opts.signal;
            if (!signal) return; // никогда не завершится — ждём внутренний таймаут
            const onAbort = () => reject(signal.reason || new DOMException('aborted', 'AbortError'));
            if (signal.aborted) return onAbort();
            signal.addEventListener('abort', onAbort, { once: true });
        });
    };
}

function makeOkResponse() {
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => '' },
        text: async () => '<html></html>',
        arrayBuffer: async () => new ArrayBuffer(0),
        json: async () => ({}),
        blob: async () => ({ size: 0 })
    };
}

for (const { name, m } of implementations) {
    test(`${name}: F5 fetchWithTimeout — незавершённый fetch → TimeoutError через таймаут`, async () => {
        const realFetch = global.fetch;
        global.fetch = makePendingFetch();
        try {
            await assert.rejects(
                m.fetchWithTimeout('https://example.com/slow', { ms: 30 }),
                (e) => e.name === 'TimeoutError'
            );
        } finally {
            global.fetch = realFetch;
        }
    });

    test(`${name}: F5 fetchWithTimeout — внешний signal aborted → AbortError`, async () => {
        const realFetch = global.fetch;
        global.fetch = makePendingFetch();
        try {
            const controller = new AbortController();
            controller.abort(new DOMException('aborted', 'AbortError'));
            await assert.rejects(
                m.fetchWithTimeout('https://example.com/slow', { ms: 5000, signal: controller.signal }),
                (e) => e.name === 'AbortError'
            );
        } finally {
            global.fetch = realFetch;
        }
    });

    test(`${name}: F5 fetchWithTimeout — успешный ответ: clearTimeout вызван (нет висящих таймеров)`, async () => {
        const realFetch = global.fetch;
        const realSetTimeout = global.setTimeout;
        const realClearTimeout = global.clearTimeout;
        global.fetch = async () => makeOkResponse();
        let scheduled = 0;
        let cleared = 0;
        global.setTimeout = function(fn, ms, ...args) {
            scheduled++;
            return realSetTimeout(fn, ms, ...args);
        };
        global.clearTimeout = function(id) {
            cleared++;
            return realClearTimeout(id);
        };
        try {
            const resp = await m.fetchWithTimeout('https://example.com/ok', { ms: 5000 });
            assert.ok(resp);
            assert.ok(resp.ok);
            // После успешного ответа внутренний таймер должен быть очищен.
            assert.ok(cleared >= 1, `clearTimeout должен вызываться (cleared=${cleared}, scheduled=${scheduled})`);
        } finally {
            global.fetch = realFetch;
            global.setTimeout = realSetTimeout;
            global.clearTimeout = realClearTimeout;
        }
    });

    test(`${name}: F5 fetchOrderDetails — исчерпание попыток: 3 вызова fetch и error-поле`, async () => {
        const realFetch = global.fetch;
        let calls = 0;
        // Фейковый fetch всегда бросает TimeoutError немедленно (не ждём 5с на попытку).
        global.fetch = async () => {
            calls++;
            throw new DOMException('timeout', 'TimeoutError');
        };
        try {
            const res = await m.fetchOrderDetails('12345678');
            assert.strictEqual(calls, 3, 'должно быть 3 попытки fetch');
            assert.deepStrictEqual(res.items, []);
            assert.strictEqual(res.address, '');
            assert.ok(res.error, 'должно быть error-поле после исчерпания попыток');
            assert.ok(String(res.error).includes('таймаут'), `error должен описывать таймаут: ${res.error}`);
        } finally {
            global.fetch = realFetch;
        }
    });

    test(`${name}: F5 fetchOrderDetails — внешний AbortError → тихий возврат без error`, async () => {
        const realFetch = global.fetch;
        global.fetch = makePendingFetch();
        try {
            const controller = new AbortController();
            controller.abort(new DOMException('aborted', 'AbortError'));
            const res = await m.fetchOrderDetails('12345678', controller.signal);
            assert.deepStrictEqual(res.items, []);
            assert.strictEqual(res.address, '');
            assert.strictEqual(res.error, undefined, 'при внешней отмене error отсутствует (тихий возврат)');
        } finally {
            global.fetch = realFetch;
        }
    });

    test(`${name}: F5 fetchOrderDetails — HTTP-ошибка после retry → error 'HTTP …'`, async () => {
        const realFetch = global.fetch;
        let calls = 0;
        global.fetch = async () => {
            calls++;
            return {
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                headers: { get: () => '' },
                text: async () => '<html>error</html>',
                arrayBuffer: async () => new ArrayBuffer(0),
                json: async () => ({}),
                blob: async () => ({ size: 0 })
            };
        };
        try {
            const res = await m.fetchOrderDetails('12345678');
            assert.strictEqual(calls, 3, 'должно быть 3 попытки fetch');
            assert.ok(res.error, 'должно быть error-поле');
            assert.ok(String(res.error).includes('HTTP'), `error должен содержать HTTP: ${res.error}`);
        } finally {
            global.fetch = realFetch;
        }
    });
}
