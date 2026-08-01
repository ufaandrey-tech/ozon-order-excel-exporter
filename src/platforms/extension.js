// ================================================================
// Ozon Order Copier — Chrome Extension (Manifest V3)
// Портировано из Tampermonkey-скрипта v9.15
// ExcelJS загружается через manifest.json → content_scripts.js
// ================================================================

// ============================================================
// ПЛАТФОРМЕННАЯ ОБЁРТКА: Chrome Extension (content script)
// Источник: extension/content.js
//   - верхний комментарий-заголовок (строки 1–5) — без изменений;
//   - открытие IIFE + 'use strict' (строки 7–8);
//   - секция «1. СТИЛИ» (строки 10–252) — STYLE_CSS + инжекция <style>;
//   - copyToClipboard (строки 2379–2399) — navigator.clipboard + fallback.
// Секции 1b (Diagnostics) и 1c (утилиты) НЕ перенесены — они уже в ядре
// (src/core/). IIFE НЕ закрывается (закроет build этапа 3).
// Зависимости: navigator.clipboard, document; ExcelJS — через lib/exceljs.min.js
//   (manifest.json → content_scripts.js), используется только в ядре/UI.
// Объявляет: copyToClipboard (navigator-версия); добавляет стили в DOM.
// ============================================================

(function() {
    'use strict';

    // ============================================================
    // 1. СТИЛИ
    // ============================================================
    const STYLE_CSS = `
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
            bottom: 24px !important;
            left: 24px !important;
            z-index: 1000000 !important;
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
            pointer-events: auto !important;
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
            left: 24px !important;
            right: auto !important;
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
            left: 24px !important;
            right: auto !important;
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

        /* На узких экранах — предпросмотр и прогресс над кнопками, иначе перекрываются */
        @media (max-width: 700px) {
            .ozon-copy-counter,
            .ozon-copy-progress {
                left: 24px !important;
                right: 24px !important;
                bottom: 200px !important;
                min-width: auto !important;
                max-width: none !important;
            }
        }
        .ozon-diag-btn {
            position: fixed !important;
            bottom: 144px !important;
            right: 24px !important;
            z-index: 999999 !important;
            padding: 14px 24px !important;
            background: #6b46c1 !important;
            color: #fff !important;
            border: none !important;
            border-radius: 12px !important;
            font-size: 16px !important;
            font-weight: 600 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            cursor: pointer !important;
            box-shadow: 0 4px 20px rgba(107, 70, 193, 0.4) !important;
            transition: all 0.2s ease !important;
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
            white-space: nowrap !important;
        }
        .ozon-diag-btn:hover {
            background: #5a3aa8 !important;
            box-shadow: 0 6px 24px rgba(107, 70, 193, 0.55) !important;
            transform: translateY(-2px) !important;
        }
        .ozon-diag-btn:active {
            transform: translateY(0) !important;
        }
        .ozon-diag-btn--loading {
            opacity: 0.7 !important;
            pointer-events: none !important;
        }
        .ozon-diag-btn--success {
            background: #0ab463 !important;
            box-shadow: 0 4px 20px rgba(10, 180, 99, 0.4) !important;
        }
        .ozon-diag-btn--error {
            background: #f44336 !important;
            box-shadow: 0 4px 20px rgba(244, 67, 54, 0.4) !important;
        }
    `;
    // В Node (node --test) document отсутствует — стили не добавляем.
    if (typeof document !== 'undefined') {
        const styleEl = document.createElement('style');
        styleEl.textContent = STYLE_CSS;
        document.head.appendChild(styleEl);
    }

    // ============================================================
    // 11. КОПИРОВАНИЕ
    // ============================================================
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch(e) {
            // Fallback для случаев, когда clipboard API недоступен
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
