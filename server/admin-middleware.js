const jwt = require('jsonwebtoken');
const { ActivityLog } = require('./models');

const SECRET_KEY = process.env.SECRET_KEY || "facelook_super_secret_key";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "facelook_admin_secret_2024";

// Authenticate admin JWT token
function authenticateAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Admin access denied" });

    jwt.verify(token, ADMIN_SECRET, (err, admin) => {
        if (err) return res.status(403).json({ error: "Invalid admin token" });
        req.admin = admin;
        next();
    });
}

// Role-based access control
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.admin || !roles.includes(req.admin.role)) {
            return res.status(403).json({ error: "Insufficient permissions" });
        }
        next();
    };
}

// Log admin activity
async function logActivity(adminId, adminName, action, category, details, req) {
    try {
        const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || req.ip || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        await ActivityLog.create({
            adminId,
            adminName,
            action,
            category,
            details: typeof details === 'object' ? JSON.stringify(details) : details,
            ip,
            userAgent
        });
    } catch (e) {
        console.error('Activity log error:', e.message);
    }
}

// Extract client IP
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.connection?.remoteAddress || req.ip || 'unknown';
}

module.exports = { authenticateAdmin, requireRole, logActivity, getClientIP, ADMIN_SECRET };
