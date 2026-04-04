const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Product, AdminUser, Coupon, Influencer, Return, Setting } = require('./models');

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/facelook';
        await mongoose.connect(uri);
        console.log('MongoDB Connected...');
        await seedProducts();
        await seedAdmin();
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    }
};

const seedAdmin = async () => {
    try {
        const count = await AdminUser.countDocuments();
        if (count === 0) {
            await AdminUser.create({
                id: 1,
                name: 'Super Admin',
                email: 'admin@facelook.com',
                password: bcrypt.hashSync('Admin@123', 10),
                role: 'super_admin',
                twoFactorEnabled: true
            });
            console.log('Admin seeded: admin@facelook.com / Admin@123');
        }

        // Seed demo coupons
        const couponCount = await Coupon.countDocuments();
        if (couponCount === 0) {
            await Coupon.insertMany([
                { id: 1, code: 'BEAUTY20', type: 'percentage', value: 20, minOrder: 499, maxDiscount: 200, usageLimit: 100, usedCount: 34, validFrom: new Date(), validTo: new Date(Date.now() + 30*24*60*60*1000), isActive: true, campaignName: 'Summer Sale' },
                { id: 2, code: 'FLAT100', type: 'flat', value: 100, minOrder: 599, usageLimit: 50, usedCount: 12, validFrom: new Date(), validTo: new Date(Date.now() + 15*24*60*60*1000), isActive: true, campaignName: 'New User' },
                { id: 3, code: 'GLOW30', type: 'percentage', value: 30, minOrder: 799, maxDiscount: 300, usageLimit: 200, usedCount: 89, validFrom: new Date(Date.now() - 60*24*60*60*1000), validTo: new Date(Date.now() - 5*24*60*60*1000), isActive: false, campaignName: 'Glow Up Campaign' }
            ]);
            console.log('Demo coupons seeded.');
        }

        // Seed demo influencers
        const infCount = await Influencer.countDocuments();
        if (infCount === 0) {
            await Influencer.insertMany([
                { id: 1, name: 'Priya Sharma', platform: 'Instagram', handle: '@priyabeauty', referralCode: 'FL-PRIYA-1', totalSales: 47, totalRevenue: 23500, commission: 12, commissionPaid: 1800, isActive: true, campaigns: [{ name: 'Summer Glow', startDate: new Date(), endDate: new Date(Date.now() + 30*24*60*60*1000), sales: 47, revenue: 23500, status: 'active' }] },
                { id: 2, name: 'Ananya Gupta', platform: 'YouTube', handle: '@ananyamakeup', referralCode: 'FL-ANANYA-2', totalSales: 83, totalRevenue: 41500, commission: 15, commissionPaid: 4200, isActive: true, campaigns: [{ name: 'Monsoon Matte', startDate: new Date(Date.now() - 30*24*60*60*1000), endDate: new Date(Date.now() + 15*24*60*60*1000), sales: 83, revenue: 41500, status: 'active' }] },
                { id: 3, name: 'Riya Patel', platform: 'Instagram', handle: '@riyalooks', referralCode: 'FL-RIYA-3', totalSales: 21, totalRevenue: 10500, commission: 10, commissionPaid: 1050, isActive: true, campaigns: [{ name: 'Festive Glam', startDate: new Date(Date.now() - 60*24*60*60*1000), endDate: new Date(Date.now() - 10*24*60*60*1000), sales: 21, revenue: 10500, status: 'completed' }] }
            ]);
            console.log('Demo influencers seeded.');
        }

        // Seed default settings
        const settingCount = await Setting.countDocuments();
        if (settingCount === 0) {
            await Setting.insertMany([
                { key: 'gst_rate', value: 18, category: 'tax' },
                { key: 'free_shipping_threshold', value: 599, category: 'shipping' },
                { key: 'currency', value: 'INR', category: 'general' },
                { key: 'banner_text', value: '✨ FREE SHIPPING ABOVE ₹599 | USE CODE BEAUTY20 FOR 20% OFF ✨', category: 'website' },
                { key: 'low_stock_threshold', value: 10, category: 'inventory' }
            ]);
            console.log('Default settings seeded.');
        }
    } catch (e) {
        console.error('Error seeding admin data:', e.message);
    }
};

const seedProducts = async () => {
    try {
        const count = await Product.countDocuments();
        if (count === 0) {
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
            await Product.insertMany(PRODUCTS);
            console.log('Database seeded with products.');
        }
    } catch (e) {
        console.error('Error seeding products:', e);
    }
};

module.exports = connectDB;
