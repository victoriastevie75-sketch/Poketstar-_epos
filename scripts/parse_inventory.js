const fs = require('fs');
const path = require('path');

// Category inference without changing product names or barcodes
function inferCategory(name) {
    const lower = name.toLowerCase();
    if (lower.includes("tea") || lower.includes("water") || lower.includes("juice") || lower.includes("drink") || lower.includes("soda") || lower.includes("milk") || lower.includes("coca") || lower.includes("fanta") || lower.includes("sprite") || lower.includes("pepsi") || lower.includes("afia") || lower.includes("yoghurt") || lower.includes("malt") || lower.includes("quencher") || lower.includes("coffee") || lower.includes("brava") || lower.includes("novida") || lower.includes("ribena") || lower.includes("frosti")) {
        return "Beverages";
    }
    if (lower.includes("biscuit") || lower.includes("breaktime") || lower.includes("nuvita") || lower.includes("snack") || lower.includes("popcorn") || lower.includes("crisp") || lower.includes("sweet") || lower.includes("candy") || lower.includes("chocolate") || lower.includes("gum") || lower.includes("cake") || lower.includes("chew") || lower.includes("waffle")) {
        return "Snacks & Bakery";
    }
    if (lower.includes("oil") || lower.includes("flour") || lower.includes("rice") || lower.includes("sugar") || lower.includes("salt") || lower.includes("margarine") || lower.includes("spice") || lower.includes("masala") || lower.includes("noodles") || lower.includes("pasta") || lower.includes("yeast") || lower.includes("baking") || lower.includes("jam") || lower.includes("maize") || lower.includes("ugali") || lower.includes("somo") || lower.includes("salit") || lower.includes("rina") || lower.includes("royco") || lower.includes("jogoo") || lower.includes("ndovu") || lower.includes("exe") || lower.includes("ajab") || lower.includes("kensalt") || lower.includes("wheat") || lower.includes("cereal") || lower.includes("honey") || lower.includes("ketchup")) {
        return "Grocery";
    }
    if (lower.includes("soap") || lower.includes("detergent") || lower.includes("powder") || lower.includes("cleaner") || lower.includes("bleach") || lower.includes("omo") || lower.includes("ariel") || lower.includes("toss") || lower.includes("sunlight") || lower.includes("jik") || lower.includes("vim") || lower.includes("scour") || lower.includes("broom") || lower.includes("mop") || lower.includes("tissue") || lower.includes("toilex") || lower.includes("serviette") || lower.includes("msafi") || lower.includes("zenta") || lower.includes("sta-soft") || lower.includes("starsoft") || lower.includes("wosha")) {
        return "Cleaning & Household";
    }
    if (lower.includes("lotion") || lower.includes("jelly") || lower.includes("vaseline") || lower.includes("cream") || lower.includes("toothpaste") || lower.includes("colgate") || lower.includes("pepsodent") || lower.includes("hair") || lower.includes("shampoo") || lower.includes("perfume") || lower.includes("spray") || lower.includes("deodorant") || lower.includes("nivea") || lower.includes("geisha") || lower.includes("sanitary") || lower.includes("diaper") || lower.includes("pads") || lower.includes("baby") || lower.includes("molfix") || lower.includes("clere") || lower.includes("movit") || lower.includes("arimis") || lower.includes("amara") || lower.includes("razor") || lower.includes("blade") || lower.includes("gillette") || lower.includes("adora") || lower.includes("sedoso") || lower.includes("skala") || lower.includes("rexona") || lower.includes("valon") || lower.includes("softcare")) {
        return "Personal Care & Beauty";
    }
    if (lower.includes("book") || lower.includes("pencil") || lower.includes("pen") || lower.includes("ruler") || lower.includes("mathematical") || lower.includes("paper") || lower.includes("crayon") || lower.includes("chalk") || lower.includes("glue") || lower.includes("calculator") || lower.includes("eraser") || lower.includes("sharpener") || lower.includes("kasuku") || lower.includes("a-star") || lower.includes("crown") || lower.includes("polar") || lower.includes("note") || lower.includes("bic")) {
        return "Stationery";
    }
    if (lower.includes("flask") || lower.includes("hotpot") || lower.includes("sufuria") || lower.includes("knife") || lower.includes("spoon") || lower.includes("plate") || lower.includes("cup") || lower.includes("mug") || lower.includes("jug") || lower.includes("basin") || lower.includes("bucket") || lower.includes("jiko") || lower.includes("gas") || lower.includes("torch") || lower.includes("bulb") || lower.includes("battery") || lower.includes("cable") || lower.includes("charger") || lower.includes("umbrella") || lower.includes("slippers") || lower.includes("blanket") || lower.includes("duvet") || lower.includes("pillow") || lower.includes("mattress") || lower.includes("lock") || lower.includes("toy") || lower.includes("ball") || lower.includes("kenpoly") || lower.includes("adix") || lower.includes("oraimo") || lower.includes("sunda") || lower.includes("jembe")) {
        return "Home & Hardware";
    }
    return "General";
}

function parseFileExact(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const products = [];

    for (let rawLine of lines) {
        let line = rawLine.trim();
        if (!line || line.startsWith("Picture") || line.startsWith("Allow oversell") || line.length < 5) continue;

        let taxRate = 16;
        if (/EXEMPT/i.test(line) || /ZERO\s*RATE/i.test(line)) {
            taxRate = 0;
        }

        const priceRegex = /([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/g;
        const matches = [...line.matchAll(priceRegex)];
        if (!matches || matches.length === 0) continue;

        const lastMatch = matches[matches.length - 1];
        const salePriceStr = lastMatch[1].replace(/,/g, "");
        const salePrice = parseFloat(salePriceStr);
        if (isNaN(salePrice) || salePrice <= 0) continue;

        let text = line.substring(0, lastMatch.index).trim();

        text = text
            .replace(/\s*(ITEMS|items|ltems|lTEMS|TIEMS)\s+(SHOP|shop)\s+(PC|pc|0|-)\s*$/i, "")
            .replace(/\s*(ITEMS|items|ltems|lTEMS|TIEMS)\s+(SHOP|shop)\s*$/i, "")
            .replace(/\s*(SHOP|shop)\s+(PC|pc|0|-)\s*$/i, "")
            .replace(/\s*(ITEMS|items|ltems|lTEMS|TIEMS)\s+(PC|pc|0|-)\s*$/i, "")
            .replace(/\s*(ITEMS|items|ltems|lTEMS|TIEMS)\s*$/i, "")
            .trim();

        let barcode = "";
        let name = "";

        if (/^[-_~]\s*/.test(text)) {
            barcode = "-";
            name = text.replace(/^[-_~]\s*/, "").trim();
        } else if (/^([0-9]{3,15})\s+(.*)$/.test(text)) {
            const m = text.match(/^([0-9]{3,15})\s+(.*)$/);
            barcode = m[1].trim();
            name = m[2].trim();
        } else if (/^([0-9]{8,15})([A-Za-z].*)$/.test(text)) {
            const m = text.match(/^([0-9]{8,15})([A-Za-z].*)$/);
            barcode = m[1].trim();
            name = m[2].trim();
        } else if (/^(TZS\s*313\s*[A-Z]?)(.*)$/i.test(text)) {
            const m = text.match(/^(TZS\s*313\s*[A-Z]?)(.*)$/i);
            barcode = m[1].trim();
            name = m[2].trim();
        } else if (/^(https:\/\/[^\s]+)\s*(.*)$/i.test(text)) {
            const m = text.match(/^(https:\/\/[^\s]+)\s*(.*)$/i);
            barcode = m[1].trim();
            name = m[2].trim();
        } else if (/^([0-9]{6,7})([A-Za-z].*)$/.test(text)) {
            const m = text.match(/^([0-9]{6,7})([A-Za-z].*)$/);
            barcode = m[1].trim();
            name = m[2].trim();
        } else {
            barcode = "-";
            name = text.trim();
        }

        name = name.replace(/\s*ITEMS$/i, "").trim();
        const category = inferCategory(name);
        const buyingPrice = Math.round(salePrice * 0.7);

        products.push({
            name: name,
            barcode: barcode,
            buyingPrice: buyingPrice,
            price: salePrice,
            qty: 50,
            category: category,
            taxRate: taxRate
        });
    }

    return products;
}

const allExact = [
    ...parseFileExact(path.join(__dirname, "raw_ocr_part1.txt")),
    ...parseFileExact(path.join(__dirname, "raw_ocr_part2.txt")),
    ...parseFileExact(path.join(__dirname, "raw_ocr_part3.txt")),
    ...parseFileExact(path.join(__dirname, "raw_ocr_part4.txt"))
];

const uniqueMap = new Map();
const exactProducts = [];

for (const p of allExact) {
    const key = p.barcode + "::" + p.name + "::" + p.price;
    if (!uniqueMap.has(key)) {
        uniqueMap.set(key, true);
        exactProducts.push(p);
    }
}

// 1. Write /products.json
fs.writeFileSync(path.join(__dirname, "../products.json"), JSON.stringify(exactProducts, null, 2), "utf8");
console.log("Written products.json with", exactProducts.length, "items.");

// 2. Write /src/offline-products.js
const offlineJs = `// Offline Embedded Master Catalog (Exact PDF Export)\nwindow.OFFLINE_PRODUCTS = ${JSON.stringify(exactProducts, null, 2)};\n`;
fs.writeFileSync(path.join(__dirname, "../src/offline-products.js"), offlineJs, "utf8");
console.log("Written src/offline-products.js");
