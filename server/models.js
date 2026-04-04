const mongoose = require('mongoose');

// ═══════════════════════════════════════
//  EXISTING MODELS (EXTENDED)
// ═══════════════════════════════════════

const UserSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    googleId: { type: String, unique: true, sparse: true },
    password: { type: String },
    isBlocked: { type: Boolean, default: false },
    loyaltyPoints: { type: Number, default: 0 },
    segment: { type: String, enum: ['new', 'repeat', 'high-value', 'inactive'], default: 'new' },
    createdAt: { type: Date, default: Date.now }
});

const ProductSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    name: String,
    cat: String,
    price: Number,
    orig: Number,
    rating: Number,
    reviews: Number,
    shade: String,
    emoji: String,
    image: String,
    images: [String],
    palette: [{
        name: String,
        hex: String,
        image: String
    }],
    tag: String,
    desc: String,
    // Cosmetics-specific fields
    stock: { type: Number, default: 100 },
    lowStockThreshold: { type: Number, default: 10 },
    expiryDate: { type: Date },
    batchNumber: { type: String, default: '' },
    skinTypes: [{ type: String, enum: ['oily', 'dry', 'sensitive', 'combination', 'normal'] }],
    ingredients: [String],
    sku: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    subcategory: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

const CartSchema = new mongoose.Schema({
    user_id: { type: Number, required: true },
    product_id: { type: Number, required: true },
    qty: { type: Number, default: 1 }
});

const WishlistSchema = new mongoose.Schema({
    user_id: { type: Number, required: true },
    product_id: { type: Number, required: true }
});

const OrderSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    user_id: { type: Number, required: true },
    total: Number,
    details: Object,
    status: { type: String, enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'], default: 'pending' },
    paymentMethod: { type: String, enum: ['cod', 'prepaid', 'upi', 'card', 'wallet'], default: 'prepaid' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    deliveryPartner: { type: String, default: '' },
    trackingId: { type: String, default: '' },
    created_at: { type: Date, default: Date.now }
});

// ═══════════════════════════════════════
//  ADMIN MODELS
// ═══════════════════════════════════════

const AdminUserSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['super_admin', 'manager', 'staff'], default: 'staff' },
    twoFactorEnabled: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    lastLoginIP: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const ActivityLogSchema = new mongoose.Schema({
    adminId: { type: Number, required: true },
    adminName: { type: String },
    action: { type: String, required: true },
    category: { type: String, default: 'general' },
    details: { type: String, default: '' },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now }
});

const CouponSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    code: { type: String, required: true, unique: true },
    type: { type: String, enum: ['flat', 'percentage'], required: true },
    value: { type: Number, required: true },
    minOrder: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: 0 },
    usageLimit: { type: Number, default: 0 },
    usedCount: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1 },
    validFrom: { type: Date, default: Date.now },
    validTo: { type: Date },
    applicableProducts: [Number],
    applicableCategories: [String],
    isActive: { type: Boolean, default: true },
    campaignName: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

const ReturnSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    orderId: { type: Number, required: true },
    userId: { type: Number, required: true },
    products: [{
        productId: Number,
        productName: String,
        qty: Number,
        reason: String
    }],
    status: { type: String, enum: ['requested', 'approved', 'rejected', 'refunded'], default: 'requested' },
    refundAmount: { type: Number, default: 0 },
    refundMethod: { type: String, default: '' },
    adminNote: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date }
});

const InfluencerSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    platform: { type: String, default: 'Instagram' },
    handle: { type: String, default: '' },
    referralCode: { type: String, unique: true, sparse: true },
    totalSales: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    commission: { type: Number, default: 10 },
    commissionPaid: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    campaigns: [{
        name: String,
        startDate: Date,
        endDate: Date,
        sales: { type: Number, default: 0 },
        revenue: { type: Number, default: 0 },
        status: { type: String, enum: ['active', 'completed', 'paused'], default: 'active' }
    }],
    createdAt: { type: Date, default: Date.now }
});

const SettingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed },
    category: { type: String, default: 'general' },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = {
    User: mongoose.model('User', UserSchema),
    Product: mongoose.model('Product', ProductSchema),
    Cart: mongoose.model('Cart', CartSchema),
    Wishlist: mongoose.model('Wishlist', WishlistSchema),
    Order: mongoose.model('Order', OrderSchema),
    AdminUser: mongoose.model('AdminUser', AdminUserSchema),
    ActivityLog: mongoose.model('ActivityLog', ActivityLogSchema),
    Coupon: mongoose.model('Coupon', CouponSchema),
    Return: mongoose.model('Return', ReturnSchema),
    Influencer: mongoose.model('Influencer', InfluencerSchema),
    Setting: mongoose.model('Setting', SettingSchema),
};
