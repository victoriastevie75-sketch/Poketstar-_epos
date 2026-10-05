const fs = require('fs');
const path = require('path');

function inferCategory(name) {
    const lower = name.toLowerCase();
    if (lower.includes("tea") || lower.includes("water") || lower.includes("juice") || lower.includes("drink") || lower.includes("soda") || lower.includes("milk") || lower.includes("coca") || lower.includes("fanta") || lower.includes("sprite") || lower.includes("pepsi") || lower.includes("afia") || lower.includes("yoghurt") || lower.includes("yorgut") || lower.includes("malt") || lower.includes("quencher") || lower.includes("coffee") || lower.includes("brava") || lower.includes("novida") || lower.includes("ribena") || lower.includes("frosti") || lower.includes("dawa") || lower.includes("minute maid") || lower.includes("delmonte") || lower.includes("monster") || lower.includes("red bull") || lower.includes("predator")) {
        return "Beverages";
    }
    if (lower.includes("biscuit") || lower.includes("bisquit") || lower.includes("bisccuit") || lower.includes("breaktime") || lower.includes("nuvita") || lower.includes("snack") || lower.includes("popcorn") || lower.includes("crisp") || lower.includes("sweet") || lower.includes("candy") || lower.includes("chocolate") || lower.includes("gum") || lower.includes("cake") || lower.includes("chew") || lower.includes("waffle") || lower.includes("cookies") || lower.includes("bread") || lower.includes("loaf") || lower.includes("scones") || lower.includes("muffin")) {
        return "Snacks & Bakery";
    }
    if (lower.includes("oil") || lower.includes("flour") || lower.includes("rice") || lower.includes("sugar") || lower.includes("salt") || lower.includes("margarine") || lower.includes("spice") || lower.includes("masala") || lower.includes("noodles") || lower.includes("pasta") || lower.includes("yeast") || lower.includes("baking") || lower.includes("jam") || lower.includes("maize") || lower.includes("ugali") || lower.includes("somo") || lower.includes("salit") || lower.includes("rina") || lower.includes("royco") || lower.includes("jogoo") || lower.includes("ndovu") || lower.includes("exe") || lower.includes("ajab") || lower.includes("kensalt") || lower.includes("wheat") || lower.includes("cereal") || lower.includes("honey") || lower.includes("sauce") || lower.includes("dola") || lower.includes("golden drop") || lower.includes("golden fry") || lower.includes("pika") || lower.includes("top fry") || lower.includes("fresh fry") || lower.includes("kimbo") || lower.includes("cowboy") || lower.includes("chipsy") || lower.includes("tilly") || lower.includes("bahari") || lower.includes("pendo") || lower.includes("blue band") || lower.includes("peanuts") || lower.includes("peanut butter") || lower.includes("spaghetti")) {
        return "Grocery";
    }
    if (lower.includes("soap") || lower.includes("detergent") || lower.includes("powder") || lower.includes("cleaner") || lower.includes("bleach") || lower.includes("omo") || lower.includes("ariel") || lower.includes("toss") || lower.includes("sunlight") || lower.includes("jik") || lower.includes("vim") || lower.includes("scour") || lower.includes("broom") || lower.includes("mop") || lower.includes("tissue") || lower.includes("toilex") || lower.includes("serviette") || lower.includes("msafi") || lower.includes("zenta") || lower.includes("sta-soft") || lower.includes("starsoft") || lower.includes("wosha") || lower.includes("downy") || lower.includes("harpic") || lower.includes("dettol") || lower.includes("detrex") || lower.includes("ushindi") || lower.includes("jumbo roll") || lower.includes("air freshener") || lower.includes("domestos") || lower.includes("scouring") || lower.includes("sponge") || lower.includes("steelwool")) {
        return "Cleaning & Household";
    }
    if (lower.includes("lotion") || lower.includes("jelly") || lower.includes("vaseline") || lower.includes("cream") || lower.includes("toothpaste") || lower.includes("colgate") || lower.includes("pepsodent") || lower.includes("hair") || lower.includes("shampoo") || lower.includes("perfume") || lower.includes("spray") || lower.includes("deodorant") || lower.includes("nivea") || lower.includes("geisha") || lower.includes("sanitary") || lower.includes("diaper") || lower.includes("diappers") || lower.includes("pads") || lower.includes("baby") || lower.includes("molfix") || lower.includes("clere") || lower.includes("movit") || lower.includes("arimis") || lower.includes("amara") || lower.includes("razor") || lower.includes("blade") || lower.includes("gillette") || lower.includes("adora") || lower.includes("sedoso") || lower.includes("skala") || lower.includes("rexona") || lower.includes("valon") || lower.includes("softcare") || lower.includes("glycerine") || lower.includes("powder") || lower.includes("soap") || lower.includes("dye") || lower.includes("conditioner") || lower.includes("relaxer") || lower.includes("body") || lower.includes("lip") || lower.includes("nail") || lower.includes("shoe polish") || lower.includes("kiwi")) {
        return "Personal Care & Beauty";
    }
    if (lower.includes("book") || lower.includes("pencil") || lower.includes("pen") || lower.includes("ruler") || lower.includes("mathematical") || lower.includes("paper") || lower.includes("crayon") || lower.includes("chalk") || lower.includes("glue") || lower.includes("calculator") || lower.includes("eraser") || lower.includes("sharpener") || lower.includes("kasuku") || lower.includes("a-star") || lower.includes("crown") || lower.includes("polar") || lower.includes("note") || lower.includes("bic") || lower.includes("staples") || lower.includes("diary") || lower.includes("cover") || lower.includes("rim paper") || lower.includes("clip board") || lower.includes("casio")) {
        return "Stationery";
    }
    if (lower.includes("flask") || lower.includes("hotpot") || lower.includes("hot pot") || lower.includes("sufuria") || lower.includes("knife") || lower.includes("spoon") || lower.includes("plate") || lower.includes("cup") || lower.includes("mug") || lower.includes("jug") || lower.includes("basin") || lower.includes("bucket") || lower.includes("jiko") || lower.includes("gas") || lower.includes("torch") || lower.includes("bulb") || lower.includes("battery") || lower.includes("cable") || lower.includes("charger") || lower.includes("umbrella") || lower.includes("slippers") || lower.includes("blanket") || lower.includes("duvet") || lower.includes("pillow") || lower.includes("mattress") || lower.includes("matress") || lower.includes("lock") || lower.includes("toy") || lower.includes("ball") || lower.includes("kenpoly") || lower.includes("adix") || lower.includes("oraimo") || lower.includes("sunda") || lower.includes("jembe") || lower.includes("pot") || lower.includes("pan") || lower.includes("box") || lower.includes("lunch box") || lower.includes("bag") || lower.includes("socks") || lower.includes("net") || lower.includes("suitcase")) {
        return "Home & Hardware";
    }
    return "General";
}

function parseRawLine(line) {
    line = line.trim();
    if (!line || line.startsWith('Product code') || line.startsWith('==') || line.startsWith('page ')) {
        return null;
    }

    // Match price at the end: digits, comma, dot, 2 decimal places
    const priceMatch = line.match(/\s+([\d,]+\.\d{2})$/);
    if (!priceMatch) {
        return null;
    }

    const priceStr = priceMatch[1].replace(/,/g, '');
    const price = parseFloat(priceStr);
    if (isNaN(price)) return null;

    let remainder = line.substring(0, priceMatch.index).trim();

    let barcode = "-";
    let name = "";

    if (remainder.startsWith('- ') || remainder.startsWith('_ ')) {
        barcode = "-";
        name = remainder.substring(2).trim();
    } else if (remainder.startsWith('-') || remainder.startsWith('_')) {
        barcode = "-";
        name = remainder.substring(1).trim();
    } else {
        // Look for barcode at the beginning:
        // Could be digits (e.g. 6008459000972, 411541, 288) or alphanumeric (TZS 313 LN 1777 Loti, https://bit.ly/3S8CE, 0745114896377)
        if (/^(https:\/\/[^\s]+)\s+(.*)$/i.test(remainder)) {
            const m = remainder.match(/^(https:\/\/[^\s]+)\s+(.*)$/i);
            barcode = m[1].trim();
            name = m[2].trim();
        } else if (/^(TZS\s+313\s+LN\s+1777\s+Loti)\s+(.*)$/i.test(remainder)) {
            const m = remainder.match(/^(TZS\s+313\s+LN\s+1777\s+Loti)\s+(.*)$/i);
            barcode = m[1].trim();
            name = m[2].trim();
        } else if (/^([0-9]{3,20})\s+(.*)$/.test(remainder)) {
            const m = remainder.match(/^([0-9]{3,20})\s+(.*)$/);
            barcode = m[1].trim();
            name = m[2].trim();
        } else {
            // Check for space separating first token
            const spaceIdx = remainder.indexOf(' ');
            if (spaceIdx > 0 && /^[A-Z0-9\-\.]+$/i.test(remainder.substring(0, spaceIdx))) {
                barcode = remainder.substring(0, spaceIdx).trim();
                name = remainder.substring(spaceIdx + 1).trim();
            } else {
                barcode = "-";
                name = remainder;
            }
        }
    }

    if (!name) return null;

    // Check if item is standard East Africa VAT exempt (maize meal / unga, bread, milk, rice, wheat flour, sanitary pads, salt)
    let taxRate = 16;
    const lowerName = name.toLowerCase();
    if (
        lowerName.includes("maize meal") || lowerName.includes("unga") || lowerName.includes("flour") ||
        lowerName.includes("milk") || lowerName.includes("bread") || lowerName.includes("loaf") ||
        lowerName.includes("rice") || lowerName.includes("sanitary") || lowerName.includes("pads") ||
        lowerName.includes("diaper") || lowerName.includes("diappers") || lowerName.includes("salt") ||
        lowerName.includes("sugar")
    ) {
        taxRate = 0;
    }

    const buyingPrice = Math.round(price * 0.7 * 100) / 100;
    const category = inferCategory(name);

    return {
        name,
        barcode,
        price,
        buyingPrice,
        qty: 50,
        category,
        taxRate,
        _searchStr: `${name} ${barcode} ${category}`.toLowerCase()
    };
}

console.log('--- Parsing 63-page OCR Files ---');
const files = [
    path.join(__dirname, 'pdf_raw_part1.txt'),
    path.join(__dirname, 'pdf_raw_part2.txt'),
    path.join(__dirname, 'pdf_raw_part3.txt')
];

let allProducts = [];
let seenKeys = new Set();

files.forEach((f, idx) => {
    if (!fs.existsSync(f)) {
        console.error('File not found:', f);
        return;
    }
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    let pageCount = 0;
    lines.forEach(l => {
        const prod = parseRawLine(l);
        if (prod) {
            // Deduplicate if identical barcode and name
            const key = (prod.barcode !== '-' ? prod.barcode : '') + ':::' + prod.name.toLowerCase();
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                allProducts.push(prod);
                pageCount++;
            }
        }
    });
    console.log(`Part ${idx + 1} parsed: ${pageCount} products.`);
});

console.log(`Total unique products parsed: ${allProducts.length}`);

// Save to root products.json
fs.writeFileSync('products.json', JSON.stringify(allProducts, null, 2), 'utf8');
console.log('Saved to /products.json');

// Save to /data/orgs/default/products.json
const orgDefaultDir = path.join(process.cwd(), 'data', 'orgs', 'default');
if (!fs.existsSync(orgDefaultDir)) fs.mkdirSync(orgDefaultDir, { recursive: true });
fs.writeFileSync(path.join(orgDefaultDir, 'products.json'), JSON.stringify(allProducts, null, 2), 'utf8');
console.log('Saved to /data/orgs/default/products.json');

// Also update any other orgs in /data/orgs/
const orgsDir = path.join(process.cwd(), 'data', 'orgs');
if (fs.existsSync(orgsDir)) {
    fs.readdirSync(orgsDir, { withFileTypes: true }).forEach(entry => {
        if (entry.isDirectory() && entry.name !== 'default') {
            const orgP = path.join(orgsDir, entry.name, 'products.json');
            fs.writeFileSync(orgP, JSON.stringify(allProducts, null, 2), 'utf8');
            console.log(`Synced to /data/orgs/${entry.name}/products.json`);
        }
    });
}

// Update embedded #pos-products-json in index.html
if (fs.existsSync('index.html')) {
    let html = fs.readFileSync('index.html', 'utf8');
    const regex = /<script id="pos-products-json" type="application\/json">([\s\S]*?)<\/script>/;
    if (regex.test(html)) {
        html = html.replace(regex, `<script id="pos-products-json" type="application/json">\n${JSON.stringify(allProducts, null, 2)}\n    </script>`);
        fs.writeFileSync('index.html', html, 'utf8');
        console.log('Updated embedded #pos-products-json in index.html');
        if (fs.existsSync('web/index.html')) {
            fs.writeFileSync('web/index.html', html, 'utf8');
            console.log('Synced to web/index.html');
        }
    }
}
