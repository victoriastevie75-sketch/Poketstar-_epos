const fs = require('fs');
const path = require('path');

const products = JSON.parse(fs.readFileSync(path.join(__dirname, '../products.json'), 'utf8'));
const productsJsonString = JSON.stringify(products);

function updateFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let html = fs.readFileSync(filePath, 'utf8');

    // 1. Meta author
    if (!html.includes('<meta name="author"')) {
        html = html.replace(
            '<meta name="description" content="Boutique Retail OS — Enterprise Point of Sale & Invoicing">',
            '<meta name="description" content="Boutique Retail OS — Enterprise Point of Sale & Invoicing">\n    <meta name="author" content="Stephen barasa">'
        );
    } else {
        html = html.replace(/<meta name="author"[^>]*>/i, '<meta name="author" content="Stephen barasa">');
    }

    // 2. Embedded pos-products-json tag
    const tagOpen = '<script id="pos-products-json" type="application/json">';
    const tagClose = '</script>';
    const startIdx = html.indexOf(tagOpen);
    if (startIdx !== -1) {
        const endIdx = html.indexOf(tagClose, startIdx);
        if (endIdx !== -1) {
            html = html.substring(0, startIdx + tagOpen.length) + '\n' + productsJsonString + '\n    ' + html.substring(endIdx);
        }
    }

    // 3. Prevent barcode overwriting and bump cache version
    if (!html.includes('CATALOG_VER')) {
        html = html.replace(
            'function getInitialProducts() {\n            let list = [];',
            `function getInitialProducts() {\n            let list = [];\n            const CATALOG_VER = '2026.09.18-stephen-barasa-import';\n            if (localStorage.getItem('pos_catalog_ver') !== CATALOG_VER) {\n                localStorage.removeItem('pos_products');\n                localStorage.setItem('pos_catalog_ver', CATALOG_VER);\n            }`
        );
    } else {
        html = html.replace(
            /const CATALOG_VER\s*=\s*['"][^'"]+['"];/,
            `const CATALOG_VER = '2026.09.18-stephen-barasa-import';`
        );
    }

    // Replace all barcode overwriting instances
    html = html.replaceAll(
        "barcode: (p.barcode && p.barcode !== '-') ? p.barcode : `600${String(idx + 1).padStart(9, '0')}`,",
        "barcode: (p.barcode && p.barcode !== '') ? p.barcode : '-',"
    );

    html = html.replaceAll(
        "barcode: (p.barcode && p.barcode !== '-') ? p.barcode : (p.sku || `600${String(idx + 1).padStart(9, '0')}`),",
        "barcode: (p.barcode && p.barcode !== '') ? p.barcode : '-',"
    );

    // Replace in reindexProducts:
    html = html.replace(
        `if (!p.barcode || p.barcode === '-') {\n                    p.barcode = \`600\${String(idx + 1).padStart(9, '0')}\`;\n                }`,
        `if (!p.barcode) {\n                    p.barcode = '-';\n                }`
    );

    // Replace in idb.saveProducts:
    html = html.replace(
        `if (!p.barcode || p.barcode === '-') {\n                            p.barcode = \`600\${String(idx + 1).padStart(9, '0')}\`;\n                        }\n                        store.put(p);`,
        `store.put({ ...p, _id: idx + 1 });`
    );

    // Upgrade IDB to version 4
    html = html.replace(
        `const req = indexedDB.open('PoketStarPOS_DB', 3);`,
        `const req = indexedDB.open('PoketStarPOS_DB', 4);`
    );
    html = html.replace(
        `if (!db.objectStoreNames.contains('products')) db.createObjectStore('products', { keyPath: 'barcode' });`,
        `if (db.objectStoreNames.contains('products')) db.deleteObjectStore('products');\n                        db.createObjectStore('products', { keyPath: '_id', autoIncrement: true });`
    );

    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`Updated ${filePath}`);
}

updateFile(path.join(__dirname, '../index.html'));
updateFile(path.join(__dirname, '../web/index.html'));
