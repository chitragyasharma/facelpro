const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    googleId: { type: String, unique: true, sparse: true },
    password: { type: String }
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
    desc: String
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
    created_at: { type: Date, default: Date.now }
});

module.exports = {
    User: mongoose.model('User', UserSchema),
    Product: mongoose.model('Product', ProductSchema),
    Cart: mongoose.model('Cart', CartSchema),
    Wishlist: mongoose.model('Wishlist', WishlistSchema),
    Order: mongoose.model('Order', OrderSchema),
};
