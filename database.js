const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'facelook.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDB();
    }
});

function initializeDB() {
    db.serialize(() => {
        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE,
            password TEXT
        )`);

        // Products Table
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY,
            name TEXT,
            cat TEXT,
            price REAL,
            orig REAL,
            rating REAL,
            reviews INTEGER,
            shade TEXT,
            emoji TEXT,
            tag TEXT,
            description TEXT
        )`);

        // Cart Table
        db.run(`CREATE TABLE IF NOT EXISTS cart (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            product_id INTEGER,
            qty INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(product_id) REFERENCES products(id),
            UNIQUE(user_id, product_id)
        )`);

        // Wishlist Table
        db.run(`CREATE TABLE IF NOT EXISTS wishlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            product_id INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(product_id) REFERENCES products(id),
            UNIQUE(user_id, product_id)
        )`);

        // Orders Table
        db.run(`CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            total REAL,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Seed Products
        db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
            if (row && row.count === 0) {
                const PRODUCTS = [
                  {id:1, name:'Velvet Matte Lip',     cat:'Lips',  price:349, orig:499, rating:4.9, reviews:234, shade:'Rosewood',     emoji:'💋', tag:'Bestseller', desc:'Long-lasting matte formula enriched with Vitamin E. Stays put 12 hours without drying.'},
                  {id:2, name:'Kohl Kajal Pro',       cat:'Eyes',  price:249, orig:349, rating:4.7, reviews:189, shade:'Deep Black',   emoji:'🖤', tag:'New',        desc:'Smudge-proof, waterproof kajal that glides on for intense, defined eyes. Lasts all day.'},
                  {id:3, name:'Glow Highlighter',     cat:'Face',  price:449, orig:599, rating:5.0, reviews:312, shade:'Pearl Blush',  emoji:'✨', tag:'Limited',    desc:'Buildable, blinding highlight for cheekbones, brow bones and inner corners. Ultra-pigmented.'},
                  {id:4, name:'Rose Blush Duo',       cat:'Face',  price:399, orig:549, rating:4.8, reviews:156, shade:'Petal & Mauve',emoji:'🌹', tag:'Popular',    desc:'Two complementary blush shades in one compact. Natural flushed finish for all skin tones.'},
                  {id:5, name:'Skin Tint SPF30',      cat:'Face',  price:599, orig:799, rating:4.6, reviews:278, shade:'Natural Beige',emoji:'💆', tag:'New',        desc:'Lightweight tinted moisturizer with SPF30. Buildable coverage with hydration benefits.'},
                  {id:6, name:'Eyeshadow Palette',    cat:'Eyes',  price:699, orig:999, rating:4.9, reviews:421, shade:'Nude Romance', emoji:'👁️',tag:'Bestseller', desc:'12 curated shades from matte to shimmer. Perfect for everyday and full glam looks.'},
                  {id:7, name:'Nail Lacquer',         cat:'Nails', price:199, orig:279, rating:4.7, reviews:98,  shade:'Ballet Pink',  emoji:'💅', tag:'Trending',   desc:'7-free formula with chip-resistant gloss finish that lasts up to 10 days.'},
                  {id:8, name:'Setting Spray',        cat:'Face',  price:299, orig:399, rating:4.8, reviews:203, shade:'Dewy Finish',  emoji:'💦', tag:'Fan Fave',   desc:'Lock makeup all day with this lightweight hydrating mist. Natural finish guaranteed.'},
                  {id:9, name:'Lip Liner',            cat:'Lips',  price:179, orig:249, rating:4.6, reviews:145, shade:'Dusty Rose',   emoji:'✏️', tag:null,         desc:'Creamy, precise lip liner that defines and fills for a fuller, longer-lasting look.'},
                  {id:10,name:'Mascara Volume+',      cat:'Eyes',  price:329, orig:449, rating:4.8, reviews:267, shade:'Jet Black',    emoji:'🪄', tag:'New',        desc:'Volumizing mascara that builds dramatic, clump-free lashes. Buildable in 2 coats.'},
                  {id:11,name:'Hydra-Glow Foundation',cat:'Face',  price:849, orig:1199,rating:4.7, reviews:189, shade:'Warm Ivory',   emoji:'🌸', tag:'Premium',    desc:'Full-coverage foundation with a natural lit-from-within glow. 24hr wear formula.'},
                  {id:12,name:'Glitter Liner',        cat:'Eyes',  price:279, orig:379, rating:4.9, reviews:134, shade:'Rose Gold',    emoji:'⭐', tag:'Trending',   desc:'High-impact glitter liner for festival looks. Highly pigmented, easy to apply.'},
                ];

                const stmt = db.prepare("INSERT INTO products (id, name, cat, price, orig, rating, reviews, shade, emoji, tag, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                PRODUCTS.forEach(p => {
                    stmt.run(p.id, p.name, p.cat, p.price, p.orig, p.rating, p.reviews, p.shade, p.emoji, p.tag, p.desc);
                });
                stmt.finalize();
                console.log("Database seeded with products.");
            }
        });
    });
}

module.exports = db;
