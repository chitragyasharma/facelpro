const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { AdminUser, User, Product, Order, Cart, Wishlist, ActivityLog, Coupon, Return, Influencer, Setting } = require('./models');
const { authenticateAdmin, requireRole, logActivity, getClientIP, ADMIN_SECRET } = require('./admin-middleware');

// ═══════════════════════════════════════
//  OTP STORE (In-memory for admin 2FA)
// ═══════════════════════════════════════
const ADMIN_OTP_STORE = {};

// ═══════════════════════════════════════
//  AUTH ROUTES
// ═══════════════════════════════════════

// Admin Login — Step 1: email + password
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const admin = await AdminUser.findOne({ email, isActive: true });
        if (!admin || !bcrypt.compareSync(password, admin.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (admin.twoFactorEnabled) {
            // Generate OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            ADMIN_OTP_STORE[email] = { otp, expiresAt: Date.now() + 5 * 60 * 1000, adminId: admin.id };
            console.log(`\n========================================`);
            console.log(`🔐 ADMIN 2FA OTP for ${email}: ${otp}`);
            console.log(`========================================\n`);
            return res.json({ requires2FA: true, message: 'OTP sent to your email' });
        }

        // No 2FA — issue token directly
        const token = jwt.sign({ id: admin.id, name: admin.name, email: admin.email, role: admin.role }, ADMIN_SECRET, { expiresIn: '8h' });
        admin.lastLogin = new Date();
        admin.lastLoginIP = getClientIP(req);
        await admin.save();
        await logActivity(admin.id, admin.name, 'Login', 'auth', 'Admin logged in', req);
        res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
    } catch (error) {
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Admin Login — Step 2: verify OTP
router.post('/verify-2fa', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const record = ADMIN_OTP_STORE[email];
        if (!record || record.otp !== otp || record.expiresAt < Date.now()) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }
        delete ADMIN_OTP_STORE[email];

        const admin = await AdminUser.findOne({ id: record.adminId });
        if (!admin) return res.status(404).json({ error: 'Admin not found' });

        const token = jwt.sign({ id: admin.id, name: admin.name, email: admin.email, role: admin.role }, ADMIN_SECRET, { expiresIn: '8h' });
        admin.lastLogin = new Date();
        admin.lastLoginIP = getClientIP(req);
        await admin.save();
        await logActivity(admin.id, admin.name, 'Login (2FA verified)', 'auth', 'Admin logged in with 2FA', req);
        res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
    } catch (error) {
        res.status(500).json({ error: 'Server error verifying OTP' });
    }
});

// Get current admin profile
router.get('/me', authenticateAdmin, async (req, res) => {
    try {
        const admin = await AdminUser.findOne({ id: req.admin.id }, '-password -__v -_id');
        res.json(admin);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching profile' });
    }
});

// Change password
router.post('/change-password', authenticateAdmin, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const admin = await AdminUser.findOne({ id: req.admin.id });
        if (!bcrypt.compareSync(currentPassword, admin.password)) {
            return res.status(400).json({ error: 'Current password incorrect' });
        }
        admin.password = bcrypt.hashSync(newPassword, 10);
        await admin.save();
        await logActivity(req.admin.id, req.admin.name, 'Password Changed', 'auth', '', req);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error changing password' });
    }
});

// ═══════════════════════════════════════
//  DASHBOARD STATS
// ═══════════════════════════════════════

router.get('/dashboard/stats', authenticateAdmin, async (req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const yearStart = new Date(now.getFullYear(), 0, 1);

        const [totalOrders, todayOrders, weekOrders, monthOrders] = await Promise.all([
            Order.countDocuments(),
            Order.countDocuments({ created_at: { $gte: todayStart } }),
            Order.countDocuments({ created_at: { $gte: weekStart } }),
            Order.countDocuments({ created_at: { $gte: monthStart } })
        ]);

        const [totalRevenue] = await Order.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]);
        const [monthRevenue] = await Order.aggregate([{ $match: { created_at: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$total' } } }]);
        const [yearRevenue] = await Order.aggregate([{ $match: { created_at: { $gte: yearStart } } }, { $group: { _id: null, total: { $sum: '$total' } } }]);

        const totalCustomers = await User.countDocuments();
        const totalProducts = await Product.countDocuments();
        const lowStockProducts = await Product.countDocuments({ stock: { $lte: 10 } });
        const pendingOrders = await Order.countDocuments({ status: 'pending' });
        const pendingReturns = await Return.countDocuments({ status: 'requested' });

        // Expiring products (within 90 days)
        const expiryThreshold = new Date(); expiryThreshold.setDate(expiryThreshold.getDate() + 90);
        const expiringProducts = await Product.countDocuments({ expiryDate: { $lte: expiryThreshold, $gte: now } });

        res.json({
            orders: { total: totalOrders, today: todayOrders, week: weekOrders, month: monthOrders },
            revenue: { total: totalRevenue?.total || 0, month: monthRevenue?.total || 0, year: yearRevenue?.total || 0 },
            customers: totalCustomers,
            products: totalProducts,
            lowStock: lowStockProducts,
            pendingOrders,
            pendingReturns,
            expiringProducts,
            conversionRate: totalCustomers > 0 ? ((totalOrders / totalCustomers) * 100).toFixed(1) : 0
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching dashboard stats' });
    }
});

// Revenue chart data (last 30 days)
router.get('/dashboard/revenue-chart', authenticateAdmin, async (req, res) => {
    try {
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const data = await Order.aggregate([
            { $match: { created_at: { $gte: thirtyDaysAgo } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, revenue: { $sum: '$total' }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching chart data' });
    }
});

// Top selling products
router.get('/dashboard/top-products', authenticateAdmin, async (req, res) => {
    try {
        const products = await Product.find({}, '-_id -__v').sort({ reviews: -1 }).limit(5);
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching top products' });
    }
});

// ═══════════════════════════════════════
//  ORDER MANAGEMENT
// ═══════════════════════════════════════

router.get('/orders', authenticateAdmin, async (req, res) => {
    try {
        const { status, page = 1, limit = 20, search, from, to } = req.query;
        const filter = {};
        if (status && status !== 'all') filter.status = status;
        if (from || to) {
            filter.created_at = {};
            if (from) filter.created_at.$gte = new Date(from);
            if (to) filter.created_at.$lte = new Date(to);
        }
        const total = await Order.countDocuments(filter);
        const orders = await Order.find(filter).sort({ created_at: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
        res.json({ orders, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching orders' });
    }
});

router.get('/orders/:id', authenticateAdmin, async (req, res) => {
    try {
        const order = await Order.findOne({ id: parseInt(req.params.id) });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        const customer = await User.findOne({ id: order.user_id }, '-password -__v -_id');
        res.json({ order, customer });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching order' });
    }
});

router.put('/orders/:id/status', authenticateAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findOneAndUpdate({ id: parseInt(req.params.id) }, { status }, { new: true });
        await logActivity(req.admin.id, req.admin.name, `Order #${req.params.id} status → ${status}`, 'orders', '', req);
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: 'Error updating order' });
    }
});

router.post('/orders/bulk-action', authenticateAdmin, async (req, res) => {
    try {
        const { orderIds, action } = req.body;
        await Order.updateMany({ id: { $in: orderIds } }, { status: action });
        await logActivity(req.admin.id, req.admin.name, `Bulk: ${orderIds.length} orders → ${action}`, 'orders', '', req);
        res.json({ success: true, updated: orderIds.length });
    } catch (error) {
        res.status(500).json({ error: 'Error performing bulk action' });
    }
});

// ═══════════════════════════════════════
//  PRODUCT MANAGEMENT
// ═══════════════════════════════════════

router.get('/products', authenticateAdmin, async (req, res) => {
    try {
        const { cat, search, page = 1, limit = 50 } = req.query;
        const filter = {};
        if (cat && cat !== 'all') filter.cat = cat;
        if (search) filter.name = { $regex: search, $options: 'i' };
        const total = await Product.countDocuments(filter);
        const products = await Product.find(filter, '-_id -__v').sort({ id: 1 }).skip((page - 1) * limit).limit(parseInt(limit));
        res.json({ products, total });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching products' });
    }
});

router.post('/products', authenticateAdmin, requireRole('super_admin', 'manager'), async (req, res) => {
    try {
        const lastProduct = await Product.findOne().sort({ id: -1 });
        const id = lastProduct ? lastProduct.id + 1 : 1;
        const product = new Product({ id, ...req.body });
        if (!product.sku) product.sku = `FL-${product.cat?.substring(0, 3).toUpperCase() || 'GEN'}-${String(id).padStart(4, '0')}`;
        await product.save();
        await logActivity(req.admin.id, req.admin.name, `Product created: ${product.name}`, 'products', '', req);
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: 'Error creating product' });
    }
});

router.put('/products/:id', authenticateAdmin, requireRole('super_admin', 'manager'), async (req, res) => {
    try {
        const product = await Product.findOneAndUpdate({ id: parseInt(req.params.id) }, req.body, { new: true });
        await logActivity(req.admin.id, req.admin.name, `Product updated: ${product.name}`, 'products', '', req);
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: 'Error updating product' });
    }
});

router.delete('/products/:id', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
    try {
        await Product.findOneAndUpdate({ id: parseInt(req.params.id) }, { isActive: false });
        await logActivity(req.admin.id, req.admin.name, `Product deleted: #${req.params.id}`, 'products', '', req);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting product' });
    }
});

// ═══════════════════════════════════════
//  CUSTOMER MANAGEMENT
// ═══════════════════════════════════════

router.get('/customers', authenticateAdmin, async (req, res) => {
    try {
        const { segment, search, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (segment && segment !== 'all') filter.segment = segment;
        if (search) filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
        const total = await User.countDocuments(filter);
        const customers = await User.find(filter, '-password -__v -_id').sort({ id: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
        
        // Enrich with order counts
        const enriched = await Promise.all(customers.map(async (c) => {
            const orderCount = await Order.countDocuments({ user_id: c.id });
            const totalSpent = await Order.aggregate([{ $match: { user_id: c.id } }, { $group: { _id: null, total: { $sum: '$total' } } }]);
            return { ...c.toObject(), orderCount, totalSpent: totalSpent[0]?.total || 0 };
        }));
        
        res.json({ customers: enriched, total });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching customers' });
    }
});

router.put('/customers/:id/block', authenticateAdmin, requireRole('super_admin', 'manager'), async (req, res) => {
    try {
        const user = await User.findOne({ id: parseInt(req.params.id) });
        user.isBlocked = !user.isBlocked;
        await user.save();
        await logActivity(req.admin.id, req.admin.name, `Customer ${user.isBlocked ? 'blocked' : 'unblocked'}: ${user.name}`, 'customers', '', req);
        res.json({ success: true, isBlocked: user.isBlocked });
    } catch (error) {
        res.status(500).json({ error: 'Error updating customer' });
    }
});

router.get('/customers/:id/orders', authenticateAdmin, async (req, res) => {
    try {
        const orders = await Order.find({ user_id: parseInt(req.params.id) }).sort({ created_at: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching customer orders' });
    }
});

// ═══════════════════════════════════════
//  COUPONS & DISCOUNTS
// ═══════════════════════════════════════

router.get('/coupons', authenticateAdmin, async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.json(coupons);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching coupons' });
    }
});

router.post('/coupons', authenticateAdmin, requireRole('super_admin', 'manager'), async (req, res) => {
    try {
        const lastCoupon = await Coupon.findOne().sort({ id: -1 });
        const id = lastCoupon ? lastCoupon.id + 1 : 1;
        const coupon = new Coupon({ id, ...req.body });
        await coupon.save();
        await logActivity(req.admin.id, req.admin.name, `Coupon created: ${coupon.code}`, 'coupons', '', req);
        res.json(coupon);
    } catch (error) {
        res.status(500).json({ error: 'Error creating coupon' });
    }
});

router.put('/coupons/:id', authenticateAdmin, requireRole('super_admin', 'manager'), async (req, res) => {
    try {
        const coupon = await Coupon.findOneAndUpdate({ id: parseInt(req.params.id) }, req.body, { new: true });
        await logActivity(req.admin.id, req.admin.name, `Coupon updated: ${coupon.code}`, 'coupons', '', req);
        res.json(coupon);
    } catch (error) {
        res.status(500).json({ error: 'Error updating coupon' });
    }
});

router.delete('/coupons/:id', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
    try {
        await Coupon.deleteOne({ id: parseInt(req.params.id) });
        await logActivity(req.admin.id, req.admin.name, `Coupon deleted: #${req.params.id}`, 'coupons', '', req);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting coupon' });
    }
});

// ═══════════════════════════════════════
//  RETURNS & REFUNDS
// ═══════════════════════════════════════

router.get('/returns', authenticateAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        const filter = {};
        if (status && status !== 'all') filter.status = status;
        const returns = await Return.find(filter).sort({ createdAt: -1 });
        res.json(returns);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching returns' });
    }
});

router.put('/returns/:id', authenticateAdmin, requireRole('super_admin', 'manager'), async (req, res) => {
    try {
        const { status, adminNote, refundAmount, refundMethod } = req.body;
        const update = { status };
        if (adminNote) update.adminNote = adminNote;
        if (refundAmount) update.refundAmount = refundAmount;
        if (refundMethod) update.refundMethod = refundMethod;
        if (status === 'approved' || status === 'rejected' || status === 'refunded') update.resolvedAt = new Date();
        const ret = await Return.findOneAndUpdate({ id: parseInt(req.params.id) }, update, { new: true });
        await logActivity(req.admin.id, req.admin.name, `Return #${req.params.id} → ${status}`, 'returns', '', req);
        res.json(ret);
    } catch (error) {
        res.status(500).json({ error: 'Error updating return' });
    }
});

// ═══════════════════════════════════════
//  INFLUENCER MANAGEMENT
// ═══════════════════════════════════════

router.get('/influencers', authenticateAdmin, async (req, res) => {
    try {
        const influencers = await Influencer.find().sort({ createdAt: -1 });
        res.json(influencers);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching influencers' });
    }
});

router.post('/influencers', authenticateAdmin, requireRole('super_admin', 'manager'), async (req, res) => {
    try {
        const lastInf = await Influencer.findOne().sort({ id: -1 });
        const id = lastInf ? lastInf.id + 1 : 1;
        const influencer = new Influencer({ id, ...req.body });
        if (!influencer.referralCode) influencer.referralCode = `FL-${influencer.name.replace(/\s/g, '').substring(0, 6).toUpperCase()}-${id}`;
        await influencer.save();
        await logActivity(req.admin.id, req.admin.name, `Influencer added: ${influencer.name}`, 'influencers', '', req);
        res.json(influencer);
    } catch (error) {
        res.status(500).json({ error: 'Error creating influencer' });
    }
});

router.put('/influencers/:id', authenticateAdmin, requireRole('super_admin', 'manager'), async (req, res) => {
    try {
        const influencer = await Influencer.findOneAndUpdate({ id: parseInt(req.params.id) }, req.body, { new: true });
        await logActivity(req.admin.id, req.admin.name, `Influencer updated: ${influencer.name}`, 'influencers', '', req);
        res.json(influencer);
    } catch (error) {
        res.status(500).json({ error: 'Error updating influencer' });
    }
});

// ═══════════════════════════════════════
//  ACTIVITY LOGS
// ═══════════════════════════════════════

router.get('/activity-logs', authenticateAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 50, category } = req.query;
        const filter = {};
        if (category && category !== 'all') filter.category = category;
        const total = await ActivityLog.countDocuments(filter);
        const logs = await ActivityLog.find(filter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
        res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching activity logs' });
    }
});

// ═══════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════

router.get('/settings', authenticateAdmin, async (req, res) => {
    try {
        const settings = await Setting.find();
        const obj = {};
        settings.forEach(s => obj[s.key] = s.value);
        res.json(obj);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching settings' });
    }
});

router.post('/settings', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
    try {
        const entries = Object.entries(req.body);
        for (const [key, value] of entries) {
            await Setting.findOneAndUpdate({ key }, { key, value, updatedAt: new Date() }, { upsert: true });
        }
        await logActivity(req.admin.id, req.admin.name, `Settings updated`, 'settings', entries.map(e => e[0]).join(', '), req);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error saving settings' });
    }
});

// ═══════════════════════════════════════
//  ANALYTICS
// ═══════════════════════════════════════

router.get('/analytics/sales', authenticateAdmin, async (req, res) => {
    try {
        const { from, to } = req.query;
        const filter = {};
        if (from || to) {
            filter.created_at = {};
            if (from) filter.created_at.$gte = new Date(from);
            if (to) filter.created_at.$lte = new Date(to);
        }
        
        const salesByDay = await Order.aggregate([
            { $match: filter },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        
        const salesByCategory = await Order.aggregate([
            { $match: filter },
            { $unwind: { path: '$details.items', preserveNullAndEmptyArrays: true } },
            { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$total' } } }
        ]);
        
        res.json({ salesByDay, salesByCategory });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching analytics' });
    }
});

router.get('/analytics/products', authenticateAdmin, async (req, res) => {
    try {
        const products = await Product.find({}, '-_id -__v').sort({ reviews: -1 }).limit(20);
        const lowStock = await Product.find({ stock: { $lte: 10 } }, '-_id -__v');
        const now = new Date();
        const expiryThreshold = new Date(); expiryThreshold.setDate(expiryThreshold.getDate() + 90);
        const expiring = await Product.find({ expiryDate: { $lte: expiryThreshold, $gte: now } }, '-_id -__v');
        res.json({ topProducts: products, lowStock, expiring });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching product analytics' });
    }
});

module.exports = router;
