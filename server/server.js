require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const connectDB = require('./db');
const { User, Product, Cart, Wishlist, Order } = require('./models');
const adminRoutes = require('./admin-routes');
const Razorpay = require('razorpay');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || "facelook_super_secret_key";

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder'
});

// Connect to MongoDB
connectDB();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Admin routes
app.use('/api/admin', adminRoutes);

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../client')));

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
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: 'Email already exists' });

        const hash = bcrypt.hashSync(password, 10);
        
        // Auto-increment logic
        const lastUser = await User.findOne().sort({ id: -1 });
        const id = lastUser ? lastUser.id + 1 : 1;

        const newUser = new User({ id, name, email, password: hash });
        await newUser.save();

        const token = jwt.sign({ id, name, email }, SECRET_KEY);
        res.json({ token, user: { name, email } });
    } catch (error) {
        res.status(500).json({ error: 'Server error during registration' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user || !user.password || !bcrypt.compareSync(password, user.password)) {
            return res.status(400).json({ error: "Invalid credentials (did you sign up with Google?)" });
        }
        
        const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, SECRET_KEY);
        res.json({ token, user: { name: user.name, email: user.email } });
    } catch (error) {
        res.status(500).json({ error: 'Server error during login' });
    }
});

// --- OTP Store (In-Memory for demonstration) ---
const OTP_STORE = {};

app.post('/api/auth/send-otp', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'Phone number required' });
        
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        OTP_STORE[phone] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };
        
        console.log(`\n========================================`);
        console.log(`📱 MOCK SMS TO ${phone}`);
        console.log(`Your FACÉLOOK OTP is: ${otp}`);
        console.log(`========================================\n`);
        
        res.json({ success: true, message: 'OTP sent successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error sending OTP' });
    }
});

app.post('/api/auth/verify-otp', async (req, res) => {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP required' });
        
        const record = OTP_STORE[phone];
        if (!record || record.otp !== otp || record.expiresAt < Date.now()) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }
        
        delete OTP_STORE[phone];
        
        let user = await User.findOne({ phone });
        if (!user) {
            const lastUser = await User.findOne().sort({ id: -1 });
            const id = lastUser ? lastUser.id + 1 : 1;
            user = new User({ id, name: phone, phone });
            await user.save();
        }
        
        const token = jwt.sign({ id: user.id, name: user.name, phone: user.phone }, SECRET_KEY);
        res.json({ token, user: { name: user.name, phone: user.phone } });
    } catch (error) {
        res.status(500).json({ error: 'Server error verifying OTP' });
    }
});

app.post('/api/auth/google', async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) return res.status(400).json({ error: 'Google credential missing' });
        
        const payloadBase64 = credential.split('.')[1];
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('ascii'));
        const { email, name, sub: googleId } = payload;
        
        let user = await User.findOne({ email });
        if (!user) user = await User.findOne({ googleId });
        
        if (!user) {
            const lastUser = await User.findOne().sort({ id: -1 });
            const id = lastUser ? lastUser.id + 1 : 1;
            user = new User({ id, name, email, googleId });
            await user.save();
        } else if (!user.googleId) {
            user.googleId = googleId;
            await user.save();
        }
        
        const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, SECRET_KEY);
        res.json({ token, user: { name: user.name, email: user.email } });
    } catch (error) {
        res.status(500).json({ error: 'Server error decoding Google credential' });
    }
});

// --- PRODUCTS ---
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find({}, '-_id -__v').sort({ id: 1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching products' });
    }
});

// --- CART ---
app.get('/api/cart', authenticateToken, async (req, res) => {
    try {
        const cartItems = await Cart.find({ user_id: req.user.id });
        const products = await Product.find({ id: { $in: cartItems.map(c => c.product_id) } });
        
        const result = cartItems.map(c => {
            const product = products.find(p => p.id === c.product_id);
            if (!product) return null;
            return {
                ...product._doc,
                qty: c.qty
            };
        }).filter(item => item !== null);
        
        // Remove MongoDB specific fields before sending
        result.forEach(r => { delete r._id; delete r.__v; });
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching cart' });
    }
});

app.post('/api/cart', authenticateToken, async (req, res) => {
    try {
        const { product_id, qty = 1 } = req.body;
        const exItem = await Cart.findOne({ user_id: req.user.id, product_id });
        
        if (exItem) {
            exItem.qty += qty;
            await exItem.save();
        } else {
            const newItem = new Cart({ user_id: req.user.id, product_id, qty });
            await newItem.save();
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error updating cart' });
    }
});

app.put('/api/cart/:product_id', authenticateToken, async (req, res) => {
    try {
        const product_id = parseInt(req.params.product_id);
        const { qty } = req.body;
        
        await Cart.findOneAndUpdate(
            { user_id: req.user.id, product_id },
            { qty }
        );
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error updating cart item' });
    }
});

app.delete('/api/cart/:product_id', authenticateToken, async (req, res) => {
    try {
        const product_id = parseInt(req.params.product_id);
        await Cart.deleteOne({ user_id: req.user.id, product_id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error removing from cart' });
    }
});

// --- WISHLIST ---
app.get('/api/wishlist', authenticateToken, async (req, res) => {
    try {
        const userWish = await Wishlist.find({ user_id: req.user.id });
        const wishItems = await Product.find({ id: { $in: userWish.map(w => w.product_id) } }, '-_id -__v');
        res.json(wishItems);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching wishlist' });
    }
});

app.post('/api/wishlist/toggle', authenticateToken, async (req, res) => {
    try {
        const { product_id } = req.body;
        const exItem = await Wishlist.findOne({ user_id: req.user.id, product_id });
        
        if (exItem) {
            await Wishlist.deleteOne({ _id: exItem._id });
            res.json({ status: 'removed' });
        } else {
            const newItem = new Wishlist({ user_id: req.user.id, product_id });
            await newItem.save();
            res.json({ status: 'added' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error toggling wishlist' });
    }
});

// --- CHECKOUT ---
app.post('/api/checkout', authenticateToken, async (req, res) => {
    try {
        const { total, details } = req.body;
        
        const lastOrder = await Order.findOne().sort({ id: -1 });
        const order_id = lastOrder ? lastOrder.id + 1 : 1;
        
        const newOrder = new Order({ id: order_id, user_id: req.user.id, total, details });
        await newOrder.save();
        
        // Clear cart
        await Cart.deleteMany({ user_id: req.user.id });
        
        res.json({ success: true, order_id, message: "Order placed successfully" });
    } catch (error) {
        res.status(500).json({ error: 'Error during checkout' });
    }
});

app.post('/api/checkout/upi', authenticateToken, async (req, res) => {
    try {
        const { order_id, utr } = req.body;
        
        const order = await Order.findOne({ id: order_id });
        if (order) {
            order.status = 'Pending Verification';
            order.details.utr_number = utr;
            order.markModified('details');
            await order.save();
            res.json({ success: true, message: "UPI Payment pending verification" });
        } else {
            res.status(400).json({ error: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error processing UPI details' });
    }
});

app.post('/api/payment/create-order', authenticateToken, async (req, res) => {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        console.error("Razorpay Keys are missing in .env");
        return res.status(400).json({ error: "Razorpay credentials not configured in backend .env" });
    }
    const { amount } = req.body;
    try {
        const options = {
            amount: amount * 100,
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        };
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error("Razorpay Order Error:", error);
        res.status(500).json({ error: "Could not create Razorpay order: " + (error.description || error.message || "Unknown error") });
    }
});

app.post('/api/payment/verify', authenticateToken, async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder');
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    if (generated_signature === razorpay_signature) {
        const order = await Order.findOne({ id: order_id });
        if (order) {
            order.status = 'Paid';
            order.razorpay_payment_id = razorpay_payment_id;
            order.razorpay_order_id = razorpay_order_id;
            await order.save();
        }
        await Cart.deleteMany({ user_id: req.user.id });
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false, error: "Invalid signature" });
    }
});

app.get('/api/payment/key', (req, res) => {
    res.json({ key: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder' });
});

app.get('/api/orders', authenticateToken, async (req, res) => {
    try {
        const orders = await Order.find({ user_id: req.user.id }).sort({ id: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching orders' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/admin.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
