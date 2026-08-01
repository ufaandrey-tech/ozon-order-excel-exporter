#!/usr/bin/env node
'use strict';

// ============================================================
// Ozon Order Copier — сборка артефактов (этап 3 рефакторинга)
// Без внешних зависимостей (только Node.js stdlib).
//
// Входные данные:
//   - src/core/index.js            — порядок секций ядра (массив имён);
//   - src/core/<name>.js           — секции ядра;
//   - src/platforms/userscript.js  — обёртка Tampermonkey (шапка + IIFE-open, НЕ закрыт);
//   - src/platforms/extension.js   — обёртка Chrome Extension (header + IIFE-open, НЕ закрыт);
//   - src/ui/ui.js                 — общий UI (showPreview…init, IIFE не оборачивает);
//   - extension/manifest.json      — шаблон манифеста (версия подставится);
//   - extension/lib/, extension/icons/ — ресурсы для dist/extension/.
//
// Единая версия: const SCRIPT_VERSION в src/core/constants.js (источник истины).
// Артефакты: dist/ozon-orders-copier.user.js, dist/extension/*.
//
// Чтение исходников — read-only (src/ не изменяется).
//
// Функции сборки экспортируются (module.exports) — используются тестом
// целостности tests/build-integrity.test.js (этап 4). При запуске как
// CLI-скрипта выполняется полная сборка с проверками и сводкой.
// ============================================================

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const DIST_EXT_DIR = path.join(DIST_DIR, 'extension');

const CORE_DIR = path.join(ROOT, 'src', 'core');
const UI_FILE = path.join(ROOT, 'src', 'ui', 'ui.js');
const USERS_WRAPPER = path.join(ROOT, 'src', 'platforms', 'userscript.js');
const EXT_WRAPPER = path.join(ROOT, 'src', 'platforms', 'extension.js');

const MANIFEST_FILE = path.join(ROOT, 'extension', 'manifest.json');
const EXT_LIB_DIR = path.join(ROOT, 'extension', 'lib');
const EXT_ICONS_DIR = path.join(ROOT, 'extension', 'icons');

const OUT_USERS = path.join(DIST_DIR, 'ozon-orders-copier.user.js');
const OUT_EXT_JS = path.join(DIST_EXT_DIR, 'content.js');
const OUT_MANIFEST = path.join(DIST_EXT_DIR, 'manifest.json');

// Экспорты гарда (17 функций; группы задают переносы строк в гарде —
// порядок и состав фиксированы — см. src/ui/ui.js и ядро src/core/).
const EXPORT_GROUPS = [
    ['yearForOrderMonth', 'yearForDeliveryMonth', 'parsePrice'],
    ['normalizeStatus', 'normalizePaymentStatus', 'parseRussianDate'],
    ['parseDeliveryDate', 'escapeHtml', 'backoffDelay', 'formatTSV'],
    ['dedupeOrders', 'fetchWithTimeout', 'fetchOrderDetails'],
    ['detectImageType', 'extractComposerAction', 'buildXlsxWorkbook', 'downloadXLSX']
];
const EXPORTS = EXPORT_GROUPS.flat();

// ---- Утилиты ввода/вывода (UTF-8, LF) ----
function readFile(absPath) {
    return fs.readFileSync(absPath, 'utf8');
}

function writeFile(absPath, content) {
    fs.writeFileSync(absPath, content, 'utf8');
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function rel(absPath) {
    return path.relative(ROOT, absPath).split(path.sep).join('/');
}

// ---- 1. Единая версия из src/core/constants.js ----
function readScriptVersion() {
    const src = readFile(path.join(CORE_DIR, 'constants.js'));
    const m = src.match(/SCRIPT_VERSION\s*=\s*'([^']+)'/);
    if (!m) {
        throw new Error('Не найдена SCRIPT_VERSION в src/core/constants.js');
    }
    return m[1];
}

// ---- 2. Порядок секций ядра из src/core/index.js (массив имён) ----
function readCoreSectionNames() {
    const src = readFile(path.join(CORE_DIR, 'index.js'));
    const arr = src.match(/=\s*\[([\s\S]*?)\]/);
    if (!arr) {
        throw new Error('Не найден массив секций в src/core/index.js');
    }
    const names = (arr[1].match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1));
    if (names.length === 0) {
        throw new Error('Массив секций в src/core/index.js пуст');
    }
    return names;
}

// ---- 3. Подстановка версии в шапку userscript ----
// Заменяем только строки шапки ==UserScript== (до ==/UserScript==):
//   - // @version  X  →  // @version  <VER>;
//   - все вхождения v\d+\.\d+ (например v9.15 в @name/@description) → v<VER>.
function patchUserscriptHeader(src, version) {
    const marker = '==/UserScript==';
    const endIdx = src.indexOf(marker);
    if (endIdx === -1) {
        throw new Error('Не найдена шапка ==/UserScript== в src/platforms/userscript.js');
    }
    const headerEnd = endIdx + marker.length;
    let header = src.slice(0, headerEnd);
    const body = src.slice(headerEnd);
    header = header
        .replace(/^(\s*\/\/\s*@version\s+)[\d.]+/m, `$1${version}`)
        .replace(/v\d+\.\d+/g, `v${version}`);
    return header + body;
}

// ---- 4. Гард module.exports ----
function buildGuard() {
    let idx = 0;
    const bodyLines = [];
    for (const group of EXPORT_GROUPS) {
        const groupLines = group.map((name) => {
            const isLast = idx === EXPORTS.length - 1;
            idx++;
            return '            ' + name + (isLast ? '' : ',');
        });
        bodyLines.push(groupLines.join('\n'));
    }
    return [
        '    // F1: гард для Node-тестов (node --test). В браузере module не определён —',
        '    // выполняется init(); в Node экспортируем чистые функции, не трогая DOM.',
        '    if (typeof module !== \'undefined\' && module.exports) {',
        '        module.exports = {',
        ...bodyLines,
        '        };',
        '    } else {',
        '        init();',
        '    }'
    ].join('\n');
}

// ---- 5. Склейка артефакта ----
// Порядок: [обёртка (шапка + IIFE-open)] → [секции ядра] → [ui.js] →
//          [гард module.exports] → ["})();"].
// Между файлами ровно один перевод строки-разделитель: хвостовые \n каждого
// файла нормализуются до одного, и части склеиваются через '\n' (LF).
function assemble(wrapperSrc, sections, uiSrc, guard) {
    const parts = [wrapperSrc, ...sections, uiSrc]
        .map((s) => s.replace(/\s+$/, ''));
    return parts.join('\n') + '\n' + guard + '\n})();\n';
}

// ---- 6. Копирование ресурсов рекурсивно ----
function copyDirRecursive(srcDir, destDir) {
    ensureDir(destDir);
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// ---- Проверки ----
function nodeCheck(jsPath) {
    try {
        execFileSync(process.execPath, ['--check', jsPath], { stdio: 'pipe' });
        return true;
    } catch (e) {
        const stderr = (e.stderr && e.stderr.toString()) || e.message;
        throw new Error(`node --check не прошёл для ${rel(jsPath)}:\n${stderr}`);
    }
}

function countMatches(content, regex) {
    return (content.match(regex) || []).length;
}

// IIFE-проверка «нет двойной обёртки».
// Открытие: (function() { + 'use strict' — уникален для обёрток платформ
//   (в комментариях/коде ядра такого паттерна нет; внутренние IIFE в коде —
//   стрелочные/анонимные с другой формой).
// Закрытие: ровно одно «})();» в конце файла (добавляет build); внутренние
//   «})();» в коде ядра (например, в export-tsv) не входят в этот хвост.
function checkIife(content, label) {
    const openCount = countMatches(content, /\(function\s*\(\)\s*\{\s*\r?\n\s*'use strict'/);
    const tail = content.slice(-100);
    const closeInTail = countMatches(tail, /\}\)\(\);/);
    const endsWithClose = tail.trimEnd().endsWith('})();');
    return {
        label,
        open: openCount,
        close: closeInTail,
        ok: openCount === 1 && closeInTail === 1 && endsWithClose
    };
}

// Сводка «функция присутствует и в собранном файле, и в исходниках src/» (regex по имени).
function compareExports(builtContent, srcContent) {
    const missingInBuilt = [];
    const missingInSrc = [];
    for (const name of EXPORTS) {
        const re = new RegExp(`\\b${name}\\b`);
        if (!re.test(builtContent)) missingInBuilt.push(name);
        if (!re.test(srcContent)) missingInSrc.push(name);
    }
    return { missingInBuilt, missingInSrc };
}

// Эталон для структурного сравнения: конкатенация всех секций ядра + ui.js.
// Монолиты удалены (этап 5) — канон сборки только src/.
function buildSrcContent() {
    const sectionNames = readCoreSectionNames();
    const sections = sectionNames.map((name) =>
        readFile(path.join(CORE_DIR, `${name}.js`))
    );
    return sections.join('\n') + '\n' + readFile(UI_FILE);
}

function extractBuiltVersion(builtContent, label) {
    const m = builtContent.match(/SCRIPT_VERSION\s*=\s*'([^']+)'/);
    if (!m) {
        throw new Error(`Не найдена SCRIPT_VERSION в собранном файле (${label})`);
    }
    return m[1];
}

function extractHeaderVersion(userscriptContent) {
    const m = userscriptContent.match(/^\/\/\s*@version\s+([\d.]+)/m);
    if (!m) {
        throw new Error('Не найден @version в шапке собранного userscript');
    }
    return m[1];
}

function extractManifestVersion(manifestContent) {
    const m = manifestContent.match(/"version"\s*:\s*"([\d.]+)"/);
    if (!m) {
        throw new Error('Не найдена version в dist/extension/manifest.json');
    }
    return m[1];
}

// ============================================================
// Экспортируемые функции сборки (этап 4: build-integrity.test.js)
// ============================================================

// Единая версия из src/core/constants.js (источник истины).
function getVersion() {
    return readScriptVersion();
}

// Сборка артефактов В ПАМЯТЬ (без записи на диск и без проверок).
// Возвращает { version, sectionNames, userscriptContent, extensionContent, manifestContent }.
function buildArtifacts() {
    const version = readScriptVersion();
    const sectionNames = readCoreSectionNames();
    const sections = sectionNames.map((name) =>
        readFile(path.join(CORE_DIR, `${name}.js`))
    );
    const wrapperUs = patchUserscriptHeader(readFile(USERS_WRAPPER), version);
    const wrapperExt = readFile(EXT_WRAPPER);
    const uiSrc = readFile(UI_FILE);
    const guard = buildGuard();

    const userscriptContent = assemble(wrapperUs, sections, uiSrc, guard);
    const extensionContent = assemble(wrapperExt, sections, uiSrc, guard);
    const manifestContent = readFile(MANIFEST_FILE)
        .replace(/"version"\s*:\s*"[\d.]+"/, `"version": "${version}"`);

    return { version, sectionNames, userscriptContent, extensionContent, manifestContent };
}

// Содержимое собранного userscript (для тестов, без записи на диск).
function buildUserscript() {
    return buildArtifacts().userscriptContent;
}

// Содержимое собранного extension content.js (для тестов, без записи на диск).
function buildExtension() {
    return buildArtifacts().extensionContent;
}

// Запись артефактов в dist/ (чистый каталог, UTF-8, LF).
function writeArtifacts(artifacts) {
    const { userscriptContent, extensionContent, manifestContent } = artifacts;
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
    ensureDir(DIST_EXT_DIR);
    writeFile(OUT_USERS, userscriptContent);
    writeFile(OUT_EXT_JS, extensionContent);
    writeFile(OUT_MANIFEST, manifestContent);
    copyDirRecursive(EXT_LIB_DIR, path.join(DIST_EXT_DIR, 'lib'));
    copyDirRecursive(EXT_ICONS_DIR, path.join(DIST_EXT_DIR, 'icons'));
}

// Единственность объявления buildDiagnosticsMarkdown: функция живёт только
// в ядре src/core/diagnostics.js; в ui.js — только вызов. Дубликат в ui.js
// (этап 8, P2-1) удалён; если он вернётся — сборка падает здесь.
function checkMarkdownDeclarations(builtContent, label) {
    const count = countMatches(builtContent, /\bfunction buildDiagnosticsMarkdown\b/);
    return { label, count, ok: count === 1 };
}

// Проверка целостности собранных артефактов (без вывода).
// Возвращает детали проверок и агрегированный флаг ok.
function verifyArtifacts(artifacts) {
    const { version, userscriptContent, extensionContent, manifestContent } = artifacts;

    // Проверка 2: структурное сравнение с исходниками src/ (17 экспортов).
    const srcContent = buildSrcContent();
    const cmpUs = compareExports(userscriptContent, srcContent);
    const cmpExt = compareExports(extensionContent, srcContent);

    // Проверка 2b: ровно одно объявление buildDiagnosticsMarkdown в каждом файле.
    const mdUs = checkMarkdownDeclarations(userscriptContent, 'userscript');
    const mdExt = checkMarkdownDeclarations(extensionContent, 'extension');

    // Проверка 3: сверка версий.
    const builtVerUs = extractBuiltVersion(userscriptContent, 'userscript');
    const builtVerExt = extractBuiltVersion(extensionContent, 'extension');
    const headerVer = extractHeaderVersion(userscriptContent);
    const manifestVer = extractManifestVersion(manifestContent);

    // Проверка 5 (дополнительная): отсутствие двойной IIFE.
    const usIife = checkIife(userscriptContent, 'userscript');
    const extIife = checkIife(extensionContent, 'extension');

    const exportsOk =
        cmpUs.missingInBuilt.length === 0 && cmpUs.missingInSrc.length === 0 &&
        cmpExt.missingInBuilt.length === 0 && cmpExt.missingInSrc.length === 0;
    const versionsOk =
        version === builtVerUs && version === builtVerExt &&
        version === headerVer && version === manifestVer;
    const iifeOk = usIife.ok && extIife.ok;
    const mdOk = mdUs.ok && mdExt.ok;

    return {
        version,
        builtVerUs,
        builtVerExt,
        headerVer,
        manifestVer,
        cmpUs,
        cmpExt,
        usIife,
        extIife,
        mdUs,
        mdExt,
        exportsOk,
        versionsOk,
        iifeOk,
        mdOk,
        ok: exportsOk && versionsOk && iifeOk && mdOk
    };
}

// Полная сборка: buildArtifacts → writeArtifacts → node --check →
// verifyArtifacts → консольная сводка. Бросает исключение при ошибках.
function run() {
    const artifacts = buildArtifacts();
    const { version, sectionNames, userscriptContent } = artifacts;
    writeArtifacts(artifacts);

    // Проверка 1: node --check на оба собранных JS.
    nodeCheck(OUT_USERS);
    nodeCheck(OUT_EXT_JS);

    // Проверки 2/3/5: экспорты, версии, IIFE.
    const v = verifyArtifacts(artifacts);

    // Итог: пути и размеры.
    const sizeOf = (p) => fs.statSync(p).size;
    const artifactPaths = [
        OUT_USERS,
        OUT_EXT_JS,
        OUT_MANIFEST,
        path.join(DIST_EXT_DIR, 'lib', 'exceljs.min.js'),
        path.join(DIST_EXT_DIR, 'icons', 'icon16.png'),
        path.join(DIST_EXT_DIR, 'icons', 'icon48.png'),
        path.join(DIST_EXT_DIR, 'icons', 'icon128.png')
    ];

    // ---- Консольная сводка ----
    console.log('=== Сборка Ozon Order Copier (этап 3) ===');
    console.log(`Версия: ${version} (источник: src/core/constants.js)`);
    console.log(`Секции ядра (${sectionNames.length}): ${sectionNames.join(', ')}`);
    console.log('');

    console.log('Артефакты:');
    for (const p of artifactPaths) {
        console.log(`  ${rel(p)} (${sizeOf(p)} байт)`);
    }
    console.log('');

    console.log(`node --check: OK (2/2)`);
    console.log('');

    const okUs = v.cmpUs.missingInBuilt.length === 0 && v.cmpUs.missingInSrc.length === 0;
    const okExt = v.cmpExt.missingInBuilt.length === 0 && v.cmpExt.missingInSrc.length === 0;
    console.log('Структурное сравнение с исходниками src/ (17 экспортов):');
    console.log(`  userscript vs src/: ${okUs ? 'OK' : 'ПРОБЛЕМА'} (${EXPORTS.length}/${EXPORTS.length})`);
    if (!okUs) {
        if (v.cmpUs.missingInBuilt.length) console.log(`    нет в собранном: ${v.cmpUs.missingInBuilt.join(', ')}`);
        if (v.cmpUs.missingInSrc.length) console.log(`    нет в src/: ${v.cmpUs.missingInSrc.join(', ')}`);
    }
    console.log(`  extension vs src/: ${okExt ? 'OK' : 'ПРОБЛЕМА'} (${EXPORTS.length}/${EXPORTS.length})`);
    if (!okExt) {
        if (v.cmpExt.missingInBuilt.length) console.log(`    нет в собранном: ${v.cmpExt.missingInBuilt.join(', ')}`);
        if (v.cmpExt.missingInSrc.length) console.log(`    нет в src/: ${v.cmpExt.missingInSrc.join(', ')}`);
    }
    console.log('');

    console.log('Сверка версий:');
    console.log(`  userscript шапка (@version): ${v.headerVer}`);
    console.log(`  SCRIPT_VERSION (userscript): ${v.builtVerUs}`);
    console.log(`  SCRIPT_VERSION (extension):  ${v.builtVerExt}`);
    console.log(`  manifest.json:               ${v.manifestVer}`);
    console.log(`  Результат: ${v.versionsOk ? 'OK — все версии совпадают' : 'ОШИБКА — версии различаются'}`);
    console.log('');

    console.log('IIFE (проверка отсутствия двойной обёртки):');
    console.log(`  userscript: открытие IIFE × ${v.usIife.open}, закрытие в конце файла × ${v.usIife.close}`);
    console.log(`  extension:  открытие IIFE × ${v.extIife.open}, закрытие в конце файла × ${v.extIife.close}`);
    console.log(`  Результат: ${v.iifeOk ? 'OK — по одной обёртке' : 'ПРЕДУПРЕЖДЕНИЕ — проверьте IIFE'}`);
    console.log('');

    console.log('buildDiagnosticsMarkdown (единственность объявления):');
    console.log(`  userscript: × ${v.mdUs.count}`);
    console.log(`  extension:  × ${v.mdExt.count}`);
    console.log(`  Результат: ${v.mdOk ? 'OK — ровно одно объявление (ядро), ui.js только вызывает' : 'ОШИБКА — найдено более одного объявления'}`);
    console.log('');

    if (!v.ok) {
        throw new Error('Сборка завершена с ошибками проверок (см. сводку выше)');
    }
}

module.exports = {
    // функции сборки
    getVersion,
    buildArtifacts,
    buildUserscript,
    buildExtension,
    writeArtifacts,
    verifyArtifacts,
    run,
    // данные и пути (для тестов целостности)
    EXPORTS,
    EXPORT_GROUPS,
    DIST_DIR,
    CORE_DIR,
    MANIFEST_FILE,
    OUT_USERS,
    OUT_EXT_JS,
    OUT_MANIFEST,
    // проверки (для тестов целостности)
    checkIife,
    compareExports,
    checkMarkdownDeclarations,
    extractBuiltVersion,
    extractHeaderVersion,
    extractManifestVersion
};

// CLI-запуск: node build/build.js (npm run build).
if (require.main === module) {
    try {
        run();
        console.log('Сборка завершена успешно.');
    } catch (e) {
        console.error(`\n[build] ОШИБКА: ${e.message}`);
        process.exit(1);
    }
}
