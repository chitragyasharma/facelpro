const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const Razorpay = require('razorpay');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || "facelook_super_secret_key";
let DB_FILE = path.resolve(__dirname, 'db.json');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder'
});

if (process.env.VERCEL) {
    DB_FILE = '/tmp/db.json';
    try {
        if (!fs.existsSync(DB_FILE) && fs.existsSync(path.resolve(__dirname, 'db.json'))) {
            fs.copyFileSync(path.resolve(__dirname, 'db.json'), DB_FILE);
        }
    } catch (e) { console.error("Could not seed DB", e); }
}

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- DB HELPER ---
function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        const PRODUCTS = [
            {id:1, name:'Velvet Matte Lip', cat:'Lips', price:349, orig:499, rating:4.9, reviews:234, shade:'Rosewood', emoji:'💋', tag:'Bestseller', desc:'Long-lasting matte formula enriched with Vitamin E. Stays put 12 hours without drying.'},
            {id:2, name:'Kohl Kajal Pro', cat:'Eyes', price:249, orig:349, rating:4.7, reviews:189, shade:'Deep Black', emoji:'🖤', tag:'New', desc:'Smudge-proof, waterproof kajal that glides on for intense, defined eyes. Lasts all day.'},
            {id:3, name:'Glow Highlighter', cat:'Face', price:449, orig:599, rating:5.0, reviews:312, shade:'Pearl Blush', emoji:'✨', tag:'Limited', desc:'Buildable, blinding highlight for cheekbones, brow bones and inner corners. Ultra-pigmented.'},
            {id:4, name:'Rose Blush Duo', cat:'Face', price:399, orig:549, rating:4.8, reviews:156, shade:'Petal & Mauve',emoji:'🌹', tag:'Popular', desc:'Two complementary blush shades in one compact. Natural flushed finish for all skin tones.'},
            {id:5, name:'Skin Tint SPF30', cat:'Face', price:599, orig:799, rating:4.6, reviews:278, shade:'Natural Beige',emoji:'💆', tag:'New', desc:'Lightweight tinted moisturizer with SPF30. Buildable coverage with hydration benefits.'},
            {id:6, name:'Eyeshadow Palette', cat:'Eyes', price:699, orig:999, rating:4.9, reviews:421, shade:'Nude Romance', emoji:'👁️',tag:'Bestseller', desc:'12 curated shades from matte to shimmer. Perfect for everyday and full glam looks.'},
            {id:7, name:'Nail Lacquer', cat:'Nails', price:199, orig:279, rating:4.7, reviews:98, shade:'Ballet Pink', emoji:'💅', tag:'Trending', desc:'7-free formula with chip-resistant gloss finish that lasts up to 10 days.'},
            {id:8, name:'Setting Spray', cat:'Face', price:299, orig:399, rating:4.8, reviews:203, shade:'Dewy Finish', emoji:'💦', tag:'Fan Fave', desc:'Lock makeup all day with this lightweight hydrating mist. Natural finish guaranteed.'},
            {id:9, name:'Lip Liner', cat:'Lips', price:179, orig:249, rating:4.6, reviews:145, shade:'Dusty Rose', emoji:'✏️', tag:null, desc:'Creamy, precise lip liner that defines and fills for a fuller, longer-lasting look.'},
            {id:10,name:'Mascara Volume+', cat:'Eyes', price:329, orig:449, rating:4.8, reviews:267, shade:'Jet Black', emoji:'🪄', tag:'New', desc:'Volumizing mascara that builds dramatic, clump-free lashes. Buildable in 2 coats.'},
            {id:11,name:'Hydra-Glow Foundation',cat:'Face', price:849, orig:1199,rating:4.7, reviews:189, shade:'Warm Ivory', emoji:'🌸', tag:'Premium', desc:'Full-coverage foundation with a natural lit-from-within glow. 24hr wear formula.'},
            {id:12,name:'Glitter Liner', cat:'Eyes', price:279, orig:379, rating:4.9, reviews:134, shade:'Rose Gold', emoji:'⭐', tag:'Trending', desc:'High-impact glitter liner for festival looks. Highly pigmented, easy to apply.'},
        ];
        fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], products: PRODUCTS, cart: [], wishlist: [], orders: [] }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- Middleware ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Access denied" });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = user;
        next();
    });
}

// --- AUTH ROUTES ---
app.post('/api/auth/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });

    const db = readDB();
    if (db.users.find(u => u.email === email)) return res.status(400).json({ error: 'Email already exists' });

    const hash = bcrypt.hashSync(password, 10);
    const id = db.users.length ? db.users[db.users.length - 1].id + 1 : 1;
    db.users.push({ id, name, email, password: hash });
    writeDB(db);

    const token = jwt.sign({ id, name, email }, SECRET_KEY);
    res.json({ token, user: { name, email } });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.email === email);
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(400).json({ error: "Invalid credentials" });
    }
    
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, SECRET_KEY);
    res.json({ token, user: { name: user.name, email: user.email } });
});

// --- PRODUCTS ---
app.get('/api/products', (req, res) => {
    const db = readDB();
    res.json(db.products);
});

// --- CART ---
app.get('/api/cart', authenticateToken, (req, res) => {
    const db = readDB();
    const userCart = db.cart.filter(c => c.user_id === req.user.id);
    const cartItems = userCart.map(c => {
        const product = db.products.find(p => p.id === c.product_id);
        return { ...product, qty: c.qty };
    });
    res.json(cartItems);
});

app.post('/api/cart', authenticateToken, (req, res) => {
    const { product_id, qty = 1 } = req.body;
    const db = readDB();
    const exItem = db.cart.find(c => c.user_id === req.user.id && c.product_id === product_id);
    
    if (exItem) exItem.qty += qty;
    else db.cart.push({ user_id: req.user.id, product_id, qty });
    
    writeDB(db);
    res.json({ success: true });
});

app.put('/api/cart/:product_id', authenticateToken, (req, res) => {
    const product_id = parseInt(req.params.product_id);
    const { qty } = req.body;
    const db = readDB();
    const exItem = db.cart.find(c => c.user_id === req.user.id && c.product_id === product_id);
    
    if (exItem) {
        exItem.qty = qty;
        writeDB(db);
    }
    res.json({ success: true });
});

app.delete('/api/cart/:product_id', authenticateToken, (req, res) => {
    const product_id = parseInt(req.params.product_id);
    const db = readDB();
    db.cart = db.cart.filter(c => !(c.user_id === req.user.id && c.product_id === product_id));
    writeDB(db);
    res.json({ success: true });
});

// --- WISHLIST ---
app.get('/api/wishlist', authenticateToken, (req, res) => {
    const db = readDB();
    const userWish = db.wishlist.filter(w => w.user_id === req.user.id);
    const wishItems = userWish.map(w => db.products.find(p => p.id === w.product_id));
    res.json(wishItems);
});

app.post('/api/wishlist/toggle', authenticateToken, (req, res) => {
    const { product_id } = req.body;
    const db = readDB();
    const idx = db.wishlist.findIndex(w => w.user_id === req.user.id && w.product_id === product_id);
    
    if (idx >= 0) {
        db.wishlist.splice(idx, 1);
        writeDB(db);
        res.json({ status: 'removed' });
    } else {
        db.wishlist.push({ user_id: req.user.id, product_id });
        writeDB(db);
        res.json({ status: 'added' });
    }
});

// --- CHECKOUT & PAYMENTS ---
app.post('/api/checkout', authenticateToken, (req, res) => {
    const { total, details } = req.body;
    const db = readDB();
    const order_id = db.orders.length ? db.orders[db.orders.length - 1].id + 1 : 1;
    db.orders.push({ 
        id: order_id, 
        user_id: req.user.id, 
        total, 
        details, 
        status: details.pay === 'cod' ? 'Pending' : 'Awaiting Payment',
        created_at: new Date().toISOString() 
    });
    if (details.pay === 'cod') {
        db.cart = db.cart.filter(c => c.user_id !== req.user.id);
    }
    writeDB(db);
    res.json({ success: true, order_id, message: "Order initiated" });
});

app.post('/api/payment/create-order', authenticateToken, async (req, res) => {
    const { amount } = req.body; // amount in INR
    try {
        const options = {
            amount: amount * 100, // razorpay works in paise
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        };
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error("Razorpay Order Error:", error);
        res.status(500).json({ error: "Could not create Razorpay order" });
    }
});

app.post('/api/payment/verify', authenticateToken, async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder');
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    if (generated_signature === razorpay_signature) {
        const db = readDB();
        const order = db.orders.find(o => o.id === order_id);
        if (order) {
            order.status = 'Paid';
            order.razorpay_payment_id = razorpay_payment_id;
            order.razorpay_order_id = razorpay_order_id;
        }
        db.cart = db.cart.filter(c => c.user_id !== req.user.id); // clear cart on success
        writeDB(db);
        res.json({ success: true, message: "Payment verified successfully" });
    } else {
        res.status(400).json({ success: false, error: "Invalid signature" });
    }
});

app.get('/api/orders', authenticateToken, (req, res) => {
    const db = readDB();
    const userOrders = db.orders.filter(o => o.user_id === req.user.id);
    res.json(userOrders.reverse()); // latest first
});

app.get('/api/payment/key', (req, res) => {
    res.json({ key: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder' });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
