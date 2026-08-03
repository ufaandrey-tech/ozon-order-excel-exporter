// ============================================================
// Этап 4 рефакторинга: тест целостности сборки (замена F6 sync-check).
// Раньше sync-check сравнивал два монолита (ozon-orders-copier.user.js
// и extension/content.js) — они были независимыми копиями. Теперь оба
// артефакта (dist/ozon-orders-copier.user.js и dist/extension/content.js)
// СОБИРАЮТСЯ из единого ядра src/core/ (+ src/ui/ui.js), поэтому сравнение
// двух файлов потеряло смысл — ядро одно.
//
// Вместо этого проверяем ЦЕЛОСТНОСТЬ СБОРКИ:
//   1. оба артефакта существуют в dist/ (их создаёт npm run build /
//      pretest);
//   2. SCRIPT_VERSION совпадает везде: src/core/constants.js (источник
//      истины) = шапка userscript (@version) = dist/extension/manifest.json
//      = SCRIPT_VERSION в обоих собранных файлах;
//   3. все 17 экспортируемых функций гарда (module.exports) присутствуют
//      в ОБОИХ собранных файлах (require + typeof) и ровно 17 штук;
//   4. в каждом файле ровно одна IIFE-обёртка: один «(function() {» с
//      'use strict' и один закрывающий «})();» в конце файла.
//
// Функции сборки берутся из ../build/build.js (экспортированы на этапе 4).
// ============================================================

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');

const {
    getVersion,
    buildArtifacts,
    EXPORTS,
    OUT_USERS,
    OUT_EXT_JS,
    OUT_MANIFEST,
    checkIife,
    extractBuiltVersion,
    extractHeaderVersion,
    extractManifestVersion
} = require('../build/build.js');

// Ровно 23 чистых функций в гарде (17 базовых + Фаза E:
// parseOrdersV2JSON, formatAmount, getPath, createParseResult,
// buildDiagnosticsMarkdown, extractAddressFromDoc).
test('build-integrity: гард экспортирует ровно 23 функции', () => {
    assert.strictEqual(EXPORTS.length, 23, `ожидалось 23 экспорта, получено ${EXPORTS.length}`);
});

test('build-integrity: оба артефакта существуют в dist/ (после npm run build)', () => {
    assert.ok(fs.existsSync(OUT_USERS), `не найден собранный userscript: ${OUT_USERS}`);
    assert.ok(fs.existsSync(OUT_EXT_JS), `не найден собранный extension content: ${OUT_EXT_JS}`);
    assert.ok(fs.existsSync(OUT_MANIFEST), `не найден собранный manifest: ${OUT_MANIFEST}`);
});

test('build-integrity: SCRIPT_VERSION едина во всех источниках', () => {
    // Эталон — src/core/constants.js (источник истины).
    const version = getVersion();
    assert.match(version, /^\d+\.\d+$/, `некорректный формат версии: ${version}`);

    // Собранный контент в памяти (без записи на диск).
    const { userscriptContent, extensionContent, manifestContent } = buildArtifacts();
    assert.strictEqual(extractBuiltVersion(userscriptContent, 'userscript'), version,
        'SCRIPT_VERSION в собранном userscript не совпадает с constants.js');
    assert.strictEqual(extractBuiltVersion(extensionContent, 'extension'), version,
        'SCRIPT_VERSION в собранном extension не совпадает с constants.js');
    assert.strictEqual(extractHeaderVersion(userscriptContent), version,
        '@version в шапке userscript не совпадает с constants.js');
    assert.strictEqual(extractManifestVersion(manifestContent), version,
        'version в manifest.json не совпадает с constants.js');

    // Файлы на диске (собирает pretest → npm run build перед тестами).
    const usOnDisk = fs.readFileSync(OUT_USERS, 'utf8');
    const extOnDisk = fs.readFileSync(OUT_EXT_JS, 'utf8');
    const manifestOnDisk = fs.readFileSync(OUT_MANIFEST, 'utf8');
    assert.strictEqual(extractBuiltVersion(usOnDisk, 'userscript'), version,
        'SCRIPT_VERSION в файле dist/ozon-orders-copier.user.js не совпадает');
    assert.strictEqual(extractBuiltVersion(extOnDisk, 'extension'), version,
        'SCRIPT_VERSION в файле dist/extension/content.js не совпадает');
    assert.strictEqual(extractHeaderVersion(usOnDisk), version,
        '@version в файле dist/ozon-orders-copier.user.js не совпадает');
    assert.strictEqual(extractManifestVersion(manifestOnDisk), version,
        'version в файле dist/extension/manifest.json не совпадает');
});

test('build-integrity: все 23 функции гарда присутствуют в обоих собранных файлах', () => {
    const userScript = require('../dist/ozon-orders-copier.user.js');
    const extension = require('../dist/extension/content.js');

    // Наборы экспортов должны совпадать и быть ровно EXPORTS.length.
    const keysU = Object.keys(userScript).sort();
    const keysE = Object.keys(extension).sort();
    assert.deepStrictEqual(keysU, keysE, 'наборы экспортов userscript и extension должны совпадать');
    assert.strictEqual(keysU.length, EXPORTS.length, 'число экспортов должно быть равно EXPORTS.length');

    for (const fn of EXPORTS) {
        assert.strictEqual(typeof userScript[fn], 'function',
            `userscript должен экспортировать функцию ${fn}`);
        assert.strictEqual(typeof extension[fn], 'function',
            `extension должен экспортировать функцию ${fn}`);
    }
});

test('build-integrity: в каждом собранном файле ровно одна IIFE-обёртка', () => {
    const us = fs.readFileSync(OUT_USERS, 'utf8');
    const ext = fs.readFileSync(OUT_EXT_JS, 'utf8');

    // Открытие: ровно один «(function() {» с 'use strict'.
    // Закрытие: ровно один «})();» в конце файла.
    const usIife = checkIife(us, 'userscript');
    const extIife = checkIife(ext, 'extension');

    assert.strictEqual(usIife.open, 1, 'в userscript должно быть ровно одно открытие IIFE');
    assert.strictEqual(usIife.close, 1, 'в userscript должно быть ровно одно закрытие IIFE');
    assert.ok(us.trimEnd().endsWith('})();'), 'userscript должен заканчиваться на });');

    assert.strictEqual(extIife.open, 1, 'в extension должно быть ровно одно открытие IIFE');
    assert.strictEqual(extIife.close, 1, 'в extension должно быть ровно одно закрытие IIFE');
    assert.ok(ext.trimEnd().endsWith('})();'), 'extension должен заканчиваться на });');
});
