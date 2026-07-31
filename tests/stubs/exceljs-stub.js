// ============================================================
// Стаб-объект ExcelJS для юнит-теста структуры XLSX (F4).
// Записывает все вызовы buildXlsxWorkbook в трассировку,
// позволяя проверить заголовки, формулы, автофильтр,
// условное форматирование, картинки и mergeCells БЕЗ
// реальной генерации .xlsx-файла (внешних зависимостей нет).
// ============================================================

'use strict';

function createCell(row, col, onValueSet) {
    const cell = {
        row,
        col,
        _value: undefined,
        numFmt: undefined,
        font: undefined,
        fill: undefined,
        alignment: undefined,
        border: undefined
    };
    Object.defineProperty(cell, 'value', {
        enumerable: true,
        configurable: true,
        get() {
            return cell._value;
        },
        set(v) {
            cell._value = v;
            if (onValueSet) onValueSet(row, col, v);
        }
    });
    return cell;
}

function createExcelJsStub() {
    const trace = {
        headers: [],            // значения ячеек строки 1
        columns: null,          // ws.columns (массив ширин)
        autoFilter: null,       // ws.autoFilter
        views: null,            // ws.views
        cells: {},              // "r,c" -> cell
        mergeCells: [],         // записи mergeCells
        images: [],             // записи addImage
        imagePlacements: [],    // записи ws.addImage (второй вызов)
        conditionalFormatting: [], // записи addConditionalFormatting
        creator: undefined,
        getRowHeight: {}        // row -> height
    };

    function getCell(row, col) {
        const key = row + ',' + col;
        if (!trace.cells[key]) {
            trace.cells[key] = createCell(row, col, (r, c, v) => {
                // Заголовки — значения первой строки
                if (r === 1) {
                    trace.headers.push(v);
                }
            });
        }
        return trace.cells[key];
    }

    const worksheet = {
        // заглушки-методы, сохраняющие вызовы
        getCell,
        getRow(row) {
            return {
                set height(v) { trace.getRowHeight[row] = v; },
                get height() { return trace.getRowHeight[row]; }
            };
        },
        mergeCells(...args) {
            trace.mergeCells.push(args);
        },
        addImage(imageId, opts) {
            trace.imagePlacements.push({ imageId, opts });
        },
        addConditionalFormatting(cfg) {
            trace.conditionalFormatting.push(cfg);
        },
        set columns(v) {
            trace.columns = v;
        },
        get columns() {
            return trace.columns;
        },
        set autoFilter(v) {
            trace.autoFilter = v;
        },
        get autoFilter() {
            return trace.autoFilter;
        },
        set views(v) {
            trace.views = v;
        },
        get views() {
            return trace.views;
        },
        xlsx: {
            writeBuffer: async () => Buffer.from('stub-xlsx')
        }
    };

    function Workbook() {
        const workbook = {
            addWorksheet() {
                return worksheet;
            },
            addImage(imageOpts) {
                trace.images.push(imageOpts);
                return trace.images.length;
            },
            set creator(v) {
                trace.creator = v;
            },
            get creator() {
                return trace.creator;
            },
            xlsx: {
                writeBuffer: async () => Buffer.from('stub-xlsx')
            }
        };
        return workbook;
    }

    return {
        ExcelJS: { Workbook },
        trace,
        worksheet
    };
}

module.exports = { createExcelJsStub };
