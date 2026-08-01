// Порядок секций ядра для сборки (каждая секция — отдельный файл в src/core/).
// Порядок важен: константы и функции должны быть объявлены до использования.
// Логика не меняется — это те же function declarations в общем скоупе IIFE.
// diagnostics стоит ДО parse/fetch (как в монолите: Diagnostics объявлен в
// секции 1b раньше), т.к. parse/fetch используют объект Diagnostics в рантайме.
// export-tsv/export-xlsx — после fetch (чистые функции экспорта, используют
// safeCell/mergePaymentStatus/Diagnostics.logImage из предыдущих секций).
module.exports = [
    'constants',
    'utils',
    'net',
    'dates',
    'statuses',
    'prices',
    'diagnostics',
    'parse',
    'fetch',
    'export-tsv',
    'export-xlsx'
];
