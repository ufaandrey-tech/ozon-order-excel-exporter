// ============================================================
// СЕКЦИЯ: src/core/bridge.js
// Мост в страничный мир. Tampermonkey-песочница не видит JS-свойства
// DOM-узлов (__vueParentComponent / __reactFiber) и window.__NUXT__,
// поэтому номер заказа у «безымянной» плитки добывает внедрённый в
// страницу скрипт. Обмен — через window.postMessage.
// Зависимости: DOM: document/window; ядро: Diagnostics, sleepMs.
// Объявляет: installPageBridge, bridgeRequestOrderNumber.
// ============================================================

    // Скрипт страничного мира. Самодостаточный, без зависимостей от ядра.
    // Ищет номер заказа для плитки: Vue/React-инстанс компонента, затем
    // корневой инстанс приложения, затем Nuxt-пейлоад.
    const BRIDGE_SOURCE = [
        '(function(){',
        '  if (window.__ozonCopierBridgeInstalled) return;',
        '  window.__ozonCopierBridgeInstalled = true;',
        '  function numFromString(s){',
        '    if (typeof s !== "string") return "";',
        '    var m = s.match(/[?&](?:orderNumber|order)=([0-9]+-[0-9]+)/i);',
        '    return m ? m[1] : "";',
        '  }',
        '  function directNumber(obj){',
        '    if (!obj || typeof obj !== "object") return "";',
        '    var keys; try { keys = Object.keys(obj); } catch(e){ return ""; }',
        '    for (var i = 0; i < keys.length; i++){',
        '      var k = keys[i];',
        '      if (!/^(orderNumber|orderId|order_id|number|postingNumber|posting_number)$/i.test(k)) continue;',
        '      var v; try { v = obj[k]; } catch(e){ continue; }',
        '      if (typeof v === "string"){',
        '        var m = v.match(/[0-9]{5,}(?:-[0-9]+)+/);',
        '        if (m) return m[0];',
        '      }',
        '    }',
        '    return "";',
        '  }',
        '  function ownStrings(obj){',
        '    var out = [];',
        '    var keys; try { keys = Object.keys(obj); } catch(e){ return out; }',
        '    for (var i = 0; i < keys.length; i++){',
        '      var v; try { v = obj[keys[i]]; } catch(e){ continue; }',
        '      if (typeof v === "string") out.push(v);',
        '    }',
        '    return out;',
        '  }',
        '  function walk(root, status, budget){',
        '    if (!root || typeof root !== "object" || budget.n <= 0) return "";',
        '    if (budget.seen.indexOf(root) >= 0) return "";',
        '    budget.seen.push(root); budget.n--;',
        '    var n = directNumber(root);',
        '    if (n) return n;',
        '    var strs = ownStrings(root);',
        '    for (var i = 0; i < strs.length; i++){',
        '      var ln = numFromString(strs[i]);',
        '      if (ln) return ln;',
        '    }',
        '    if (status) {',
        '      var hasStatus = false;',
        '      for (var s = 0; s < strs.length; s++){',
        '        if (strs[s].indexOf(status) >= 0) { hasStatus = true; break; }',
        '      }',
        '      if (hasStatus) {',
        '        var sub = { n: 300, seen: [] };',
        '        var subNum = searchAny(root, sub, 0);',
        '        if (subNum) return subNum;',
        '      }',
        '    }',
        '    var keys; try { keys = Object.keys(root); } catch(e){ return ""; }',
        '    for (var j = 0; j < keys.length; j++){',
        '      var v; try { v = root[keys[j]]; } catch(e){ continue; }',
        '      if (typeof v === "function" || !v || typeof v !== "object") continue;',
        '      var found = walk(v, status, budget);',
        '      if (found) return found;',
        '    }',
        '    return "";',
        '  }',
        '  function searchAny(root, budget, depth){',
        '    if (!root || typeof root !== "object" || depth > 12 || budget.n <= 0) return "";',
        '    if (budget.seen.indexOf(root) >= 0) return "";',
        '    budget.seen.push(root); budget.n--;',
        '    var n = directNumber(root); if (n) return n;',
        '    var strs = ownStrings(root);',
        '    for (var i = 0; i < strs.length; i++){',
        '      var ln = numFromString(strs[i]); if (ln) return ln;',
        '    }',
        '    var keys; try { keys = Object.keys(root); } catch(e){ return ""; }',
        '    for (var j = 0; j < keys.length; j++){',
        '      var v; try { v = root[keys[j]]; } catch(e){ continue; }',
        '      if (!v || typeof v !== "object") continue;',
        '      var found = searchAny(v, budget, depth + 1);',
        '      if (found) return found;',
        '    }',
        '    return "";',
        '  }',
        '  function instanceRoots(node, maxUp){',
        '    var roots = [];',
        '    var n = node;',
        '    for (var d = 0; n && d < maxUp; d++, n = n.parentElement){',
        '      var keys; try { keys = Object.keys(n); } catch(e){ continue; }',
        '      for (var i = 0; i < keys.length; i++){',
        '        var k = keys[i];',
        '        if (k.indexOf("__vue") !== 0 && k.indexOf("__react") !== 0 && k !== "_vnode") continue;',
        '        var inst; try { inst = n[k]; } catch(e){ continue; }',
        '        if (!inst || typeof inst !== "object") continue;',
        '        roots.push(inst);',
        '        roots.push(inst.props, inst.vnode, inst.ctx, inst.setupState, inst.data, inst.$props, inst.$data, inst.$);',
        '      }',
        '    }',
        '    return roots;',
        '  }',
        '  function findForTile(index, status){',
        '    var tiles = document.querySelectorAll(\'section[data-widget="orderList"]\');',
        '    var tile = tiles[index];',
        '    if (!tile) return { num: "", source: "" };',
        '    if (status && (tile.textContent || "").indexOf(status) < 0) return { num: "", source: "" };',
        '    var near = instanceRoots(tile, 3);',
        '    for (var i = 0; i < near.length; i++){',
        '      var b = { n: 900, seen: [] };',
        '      var num = searchAny(near[i], b, 0);',
        '      if (num) return { num: num, source: "vue-near" };',
        '    }',
        '    var all = instanceRoots(tile, 10);',
        '    for (var j = 0; j < all.length; j++){',
        '      var b2 = { n: 2000, seen: [] };',
        '      var num2 = walk(all[j], status, b2);',
        '      if (num2) return { num: num2, source: "vue-up" };',
        '    }',
        '    var appRoot = document.querySelector("#__ozon") || document.querySelector("#__nuxt") || document.body;',
        '    var appKeys; try { appKeys = Object.keys(appRoot); } catch(e){ appKeys = []; }',
        '    for (var r = 0; r < appKeys.length; r++){',
        '      var rk = appKeys[r];',
        '      if (rk.indexOf("__vue") !== 0 && rk.indexOf("__react") !== 0 && rk !== "_vnode") continue;',
        '      var b3 = { n: 5000, seen: [] };',
        '      var num3 = walk(appRoot[rk], status, b3);',
        '      if (num3) return { num: num3, source: "vue-root" };',
        '    }',
        '    var stores = [window.__NUXT__, window.__INITIAL_STATE__, window.__APOLLO_STATE__, window.__NUXT_DATA__];',
        '    for (var s = 0; s < stores.length; s++){',
        '      if (!stores[s]) continue;',
        '      var b4 = { n: 8000, seen: [] };',
        '      var num4 = walk(stores[s], status, b4);',
        '      if (num4) return { num: num4, source: "nuxt" };',
        '    }',
        '    return { num: "", source: "" };',
        '  }',
        '  window.addEventListener("message", function(e){',
        '    if (e.source !== window) return;',
        '    var d = e.data;',
        '    if (!d || d.__ozonCopier !== "req") return;',
        '    var res = { __ozonCopier: "res", id: d.id, orderNumber: "", source: "" };',
        '    try {',
        '      var r = findForTile(d.index, d.status);',
        '      res.orderNumber = r.num; res.source = r.source;',
        '    } catch(err) {}',
        '    window.postMessage(res, "*");',
        '  });',
        '  window.postMessage({ __ozonCopier: "ready" }, "*");',
        '})();'
    ].join('\n');

    let bridgeInstalled = false;
    let bridgeReady = false;
    let bridgeSeq = 0;
    const bridgePending = new Map();

    function onBridgeMessage(event) {
        if (event.source !== window || !event.data || typeof event.data !== 'object') return;
        const data = event.data;
        if (data.__ozonCopier === 'ready') {
            bridgeReady = true;
            return;
        }
        if (data.__ozonCopier === 'res' && data.id != null) {
            const resolve = bridgePending.get(data.id);
            if (resolve) {
                bridgePending.delete(data.id);
                resolve(data);
            }
        }
    }

    function installPageBridge() {
        if (bridgeInstalled || typeof document === 'undefined') return;
        bridgeInstalled = true;
        try {
            window.addEventListener('message', onBridgeMessage);
            const script = document.createElement('script');
            const nonceEl = document.querySelector('script[nonce]');
            const nonce = nonceEl ? (nonceEl.nonce || nonceEl.getAttribute('nonce')) : '';
            if (nonce) script.setAttribute('nonce', nonce);
            script.textContent = BRIDGE_SOURCE;
            (document.head || document.documentElement).appendChild(script);
            script.remove();
        } catch(e) {
            Diagnostics.logError('', 'installPageBridge', '', e);
        }
    }

    async function bridgeRequestOrderNumber(index, status) {
        installPageBridge();
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        if (!bridgeReady) {
            for (let i = 0; i < 10 && !bridgeReady; i++) {
                await sleep(100);
            }
        }
        if (!bridgeReady) {
            Diagnostics.logParseResult('', 'DOM.bridge',
                'мост в страничный мир недоступен (CSP/инъекция)', 'нет ответа ready');
            return null;
        }
        const id = ++bridgeSeq;
        const response = await new Promise(resolve => {
            bridgePending.set(id, resolve);
            setTimeout(() => {
                if (bridgePending.has(id)) {
                    bridgePending.delete(id);
                    resolve(null);
                }
            }, 3000);
            try {
                window.postMessage({ __ozonCopier: 'req', id: id, index: index, status: status }, '*');
            } catch(e) {
                bridgePending.delete(id);
                resolve(null);
            }
        });
        if (!response) {
            Diagnostics.logParseResult('', 'DOM.bridgeTimeout', 'мост не ответил за 3 с', '');
            return null;
        }
        if (response.orderNumber) {
            Diagnostics.logParseResult(response.orderNumber, 'DOM.bridgeOrderNumber',
                'мост: ' + (response.source || 'unknown'), response.orderNumber);
        } else {
            Diagnostics.logParseResult('', 'DOM.bridgeMiss', 'мост: номер не найден',
                'источник: ' + (response.source || 'unknown'));
        }
        return response;
    }