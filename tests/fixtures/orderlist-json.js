// ============================================================
// Фикстуры для тестов чистого ядра parseOrdersV2JSON (Фаза E).
// Данные АНОНИМИЗИРОВАНЫ: номера заказов, адреса и имена товаров
// заменены вымышленными. Используются ТОЛЬКО поля, нужные парсеру
// (ordersV2[].leftBlock, rightBlock.products.products, action.link).
//
// Формат — полный state-orderList JSON после JSON.parse:
//   { ordersV2: [ ... ] }
//
// ORDERLIST_JSON_OLD — старая схема Ozon (под неё писался код):
//   leftBlock.title.text (адрес ПВЗ), leftBlock.cellList.cells
//   (сумма), badgeStatus у товаров.
// ORDERLIST_JSON_NEW — новая схема (из diagn/ 31.07):
//   title ОТСУТСТВУЕТ у доставленных, cellList удалён, badgeStatus
//   только у «В пути».
// Каждая фикстура содержит 2 заказа: «В пути» (со старой схемой)
// и «Доставлен» (с новой схемой) — проверяем оба типа в одном JSON.
// ============================================================

'use strict';

// Общий шаблон заказа «В пути» (старая схема: title + cellList + badgeStatus).
function inTransitOrder(orderNum, productName, priceText) {
    return {
        leftBlock: {
            common: {
                action: { link: `https://www.ozon.ru/my/orderdetails/?order=${orderNum}` }
            },
            textIcon: { text: { text: 'В пути' } },
            title: { text: 'Пункт Ozon: Россия, Москва, ул. Тестовая, 1' },
            subtitle: { text: 'Доставка в пункт выдачи' },
            cellList: {
                cells: [
                    { dsCell: { rightBlock: { price: { price: [{ text: priceText }] } } } }
                ]
            }
        },
        rightBlock: {
            products: {
                products: [
                    {
                        title: { name: { text: productName } },
                        price: { price: [{ text: priceText }] },
                        image: { productMedia: { image: { url: 'https://cdn.example.com/a.jpg' } } },
                        badgeStatus: { text: 'Оплачен' }
                    }
                ]
            }
        }
    };
}

// Общий шаблон заказа «Доставлен» (новая схема: НЕТ title, НЕТ cellList,
// badgeStatus отсутствует).
function deliveredOrder(orderNum, productName, priceText) {
    return {
        leftBlock: {
            common: {
                action: { link: `https://www.ozon.ru/my/orderdetails/?order=${orderNum}` }
            },
            textIcon: { text: { text: 'Получен 30 июля' } },
            subtitle: { text: 'Доставка в пункт выдачи' }
        },
        rightBlock: {
            products: {
                products: [
                    {
                        title: { name: { text: productName } },
                        price: { price: [{ text: priceText }] },
                        image: { productMedia: { image: { url: 'https://cdn.example.com/b.jpg' } } }
                    }
                ]
            }
        }
    };
}

// Старая схема: «В пути» + «Доставлен» (доставленный — тоже со старой
// схемой: у него есть title/cellList/badgeStatus).
const ORDERLIST_JSON_OLD = {
    ordersV2: [
        inTransitOrder('00000000-0001', 'Товар А', '1 100 ₽'),
        {
            leftBlock: {
                common: {
                    action: { link: 'https://www.ozon.ru/my/orderdetails/?order=00000000-0002' }
                },
                textIcon: { text: { text: 'Получен 30 июля' } },
                title: { text: 'Пункт Ozon: Россия, Москва, ул. Тестовая, 2' },
                subtitle: { text: 'Доставка в пункт выдачи' },
                cellList: {
                    cells: [
                        { dsCell: { rightBlock: { price: { price: [{ text: '8 573,50 ₽' }] } } } }
                    ]
                }
            },
            rightBlock: {
                products: {
                    products: [
                        {
                            title: { name: { text: 'Товар B' } },
                            price: { price: [{ text: '8 573,50 ₽' }] },
                            image: { productMedia: { image: { url: 'https://cdn.example.com/c.jpg' } } },
                            badgeStatus: { text: 'Оплачен' }
                        }
                    ]
                }
            }
        }
    ]
};

// Новая схема: «В пути» (badgeStatus есть) + «Доставлен» (badgeStatus НЕТ).
const ORDERLIST_JSON_NEW = {
    ordersV2: [
        inTransitOrder('00000000-0003', 'Товар В', '2 300 ₽'),
        deliveredOrder('00000000-0004', 'Товар Г', '8573,50 ₽')
    ]
};

module.exports = {
    ORDERLIST_JSON_OLD,
    ORDERLIST_JSON_NEW
};
