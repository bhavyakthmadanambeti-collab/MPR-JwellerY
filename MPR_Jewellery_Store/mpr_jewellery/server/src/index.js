
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// ===============================
// 1. SECURITY AND CONFIGURATION
// ===============================

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured in production');
}

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-this';

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error('Origin not allowed by CORS'));
    }
}));

app.use(express.json({ limit: '2mb' }));

// ===============================
// 2. DATABASE CONFIGURATION
// ===============================

// On Render, set DB_PATH=/var/data/mpr.sqlite
const DB_PATH = process.env.DB_PATH || './mpr.sqlite';

fs.mkdirSync(path.dirname(path.resolve(DB_PATH)), { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ===============================
// 3. CREATE DATABASE TABLES
// ===============================

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'customer'
    );

    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT,
        metal TEXT,
        gemstone TEXT,
        price REAL NOT NULL,
        image TEXT,
        description TEXT,
        stock INTEGER DEFAULT 10
    );

    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        items TEXT NOT NULL,
        total REAL NOT NULL,
        status TEXT DEFAULT 'Payment pending',
        payment_status TEXT DEFAULT 'Pending',
        payment_reference TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
`);

// Add missing columns when upgrading an older database.
const addColumnIfMissing = (table, column, definition) => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some(c => c.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
};

addColumnIfMissing('orders', 'payment_status', "TEXT DEFAULT 'Pending'");
addColumnIfMissing('orders', 'payment_reference', 'TEXT');

// ===============================
// 4. SETTINGS
// ===============================

const setting = key =>
    db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;

const put = (key, value) => {
    db.prepare(`
        INSERT OR REPLACE INTO settings(key, value)
        VALUES (?, ?)
    `).run(key, value);
};

put('upi', setting('upi') || process.env.OWNER_UPI || 'merchant@upi');

// ===============================
// 5. CREATE OWNER ACCOUNT
// ===============================

const ownerEmail = (process.env.OWNER_EMAIL || 'owner@example.com')
    .trim()
    .toLowerCase();

const ownerPassword = process.env.OWNER_PASSWORD;

if (!ownerPassword && process.env.NODE_ENV === 'production') {
    throw new Error('Set OWNER_PASSWORD in Render environment variables');
}

if (!db.prepare('SELECT id FROM users WHERE email = ?').get(ownerEmail)) {
    db.prepare(`
        INSERT INTO users(name, email, password, role)
        VALUES (?, ?, ?, ?)
    `).run(
        'Store Owner',
        ownerEmail,
        bcrypt.hashSync(ownerPassword || 'change-me-now', 12),
        'owner'
    );
}

// ===============================
// 6. SEED JEWELLERY PRODUCTS
// ===============================

const seedProducts = [
    [
        'Gold Necklace', 'Necklaces', 'Gold', 'None',
        25999,
        'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=800',
        'Elegant gold necklace', 5
    ],
    [
        'Diamond Studs', 'Earrings', 'Diamond', 'Diamond',
        18999,
        'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800',
        'Classic sparkling studs', 8
    ],
    [
        'Silver Bracelet', 'Bracelets', 'Silver', 'None',
        2999,
        'https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=800',
        'Polished silver bracelet', 12
    ],
    [
        'Ruby Ring', 'Rings', 'Gold', 'Ruby',
        12999,
        'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800',
        'Ruby accent ring', 6
    ],
    [
        'Pearl Pendant', 'Pendants', 'Silver', 'Pearl',
        4999,
        'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800',
        'Pearl pendant', 10
    ]
];

const productCount = db.prepare(
    'SELECT COUNT(*) AS count FROM products'
).get().count;

if (productCount === 0) {
    const insertProduct = db.prepare(`
        INSERT INTO products
        (name, category, metal, gemstone, price, image, description, stock)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedTransaction = db.transaction(() => {
        seedProducts.forEach(product => insertProduct.run(...product));
    });

    seedTransaction();
}

// ===============================
// 7. AUTHENTICATION MIDDLEWARE
// ===============================

const auth = (req, res, next) => {
    try {
        const header = req.headers.authorization || '';

        if (!header.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Please sign in'
            });
        }

        const token = header.slice(7);
        req.user = jwt.verify(token, JWT_SECRET);

        next();
    } catch {
        return res.status(401).json({
            error: 'Invalid or expired token'
        });
    }
};

const owner = (req, res, next) => {
    if (req.user?.role !== 'owner') {
        return res.status(403).json({
            error: 'Owner access required'
        });
    }

    next();
};

// ===============================
// 8. HEALTH CHECK
// ===============================

app.get('/api/health', (req, res) => {
    res.json({
        ok: true,
        service: 'MPR Jewellery API',
        message: 'Backend is running'
    });
});

app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to MPR Jewellery API',
        health: '/api/health',
        products: '/api/products'
    });
});

// ===============================
// 9. PUBLIC SETTINGS
// ===============================

app.get('/api/settings', (req, res) => {
    res.json({
        upi: setting('upi') || ''
    });
});

// ===============================
// 10. CUSTOMER REGISTRATION
// ===============================

app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (
            typeof name !== 'string' ||
            !name.trim() ||
            typeof email !== 'string' ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            typeof password !== 'string' ||
            password.length < 8
        ) {
            return res.status(400).json({
                error: 'Enter a valid name, email and password of at least 8 characters'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const result = db.prepare(`
            INSERT INTO users(name, email, password, role)
            VALUES (?, ?, ?, 'customer')
        `).run(
            name.trim(),
            email.trim().toLowerCase(),
            hashedPassword
        );

        const token = jwt.sign({
            id: result.lastInsertRowid,
            role: 'customer'
        }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            token,
            role: 'customer',
            name: name.trim()
        });

    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({
                error: 'Email already registered'
            });
        }

        console.error(error);

        res.status(500).json({
            error: 'Registration failed'
        });
    }
});

// ===============================
// 11. CUSTOMER AND OWNER LOGIN
// ===============================

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (typeof email !== 'string' || typeof password !== 'string') {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }

        const user = db.prepare(
            'SELECT * FROM users WHERE email = ?'
        ).get(email.trim().toLowerCase());

        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        const token = jwt.sign({
            id: user.id,
            role: user.role
        }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            role: user.role,
            name: user.name
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Login failed'
        });
    }
});

// ===============================
// 12. GET ALL PRODUCTS
// ===============================

app.get('/api/products', (req, res) => {
    const products = db.prepare(
        'SELECT * FROM products ORDER BY id DESC'
    ).all();

    res.json(products);
});

// ===============================
// 13. CUSTOMER ORDER PLACEMENT
// ===============================

app.post('/api/orders', auth, (req, res) => {
    try {
        const { items } = req.body;

        if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
            return res.status(400).json({
                error: 'Invalid order items'
            });
        }

        const getProduct = db.prepare(
            'SELECT * FROM products WHERE id = ?'
        );

        const orderItems = [];
        let total = 0;

        for (const item of items) {
            const productId = Number(item.productId ?? item.product_id ?? item.id);
            const quantity = Number(item.quantity ?? item.qty);

            if (
                !Number.isSafeInteger(productId) ||
                !Number.isSafeInteger(quantity) ||
                quantity < 1 ||
                quantity > 100
            ) {
                return res.status(400).json({
                    error: 'Invalid product or quantity'
                });
            }

            const product = getProduct.get(productId);

            if (!product) {
                return res.status(404).json({
                    error: `Product ${productId} not found`
                });
            }

            if (product.stock < quantity) {
                return res.status(400).json({
                    error: `${product.name} has insufficient stock`
                });
            }

            orderItems.push({
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity,
                image: product.image
            });

            total += product.price * quantity;
        }

        const placeOrder = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO orders(user_id, items, total, status, payment_status)
                VALUES (?, ?, ?, 'Payment pending', 'Pending')
            `).run(
                req.user.id,
                JSON.stringify(orderItems),
                total
            );

            return result.lastInsertRowid;
        });

        const orderId = placeOrder();

        res.status(201).json({
            orderId,
            total,
            status: 'Payment pending',
            paymentStatus: 'Pending',
            upi: setting('upi'),
            note: 'Pay using the store UPI ID and submit your payment reference for owner verification.'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Could not place order'
        });
    }
});

// ===============================
// 14. CUSTOMER SUBMITS PAYMENT REFERENCE
// ===============================

app.patch('/api/orders/:id/payment', auth, (req, res) => {
    const orderId = Number(req.params.id);
    const reference = req.body.reference;

    if (
        !Number.isSafeInteger(orderId) ||
        typeof reference !== 'string' ||
        reference.trim().length < 4 ||
        reference.trim().length > 100
    ) {
        return res.status(400).json({
            error: 'Enter a valid UPI transaction reference'
        });
    }

    const order = db.prepare(`
        SELECT * FROM orders WHERE id = ? AND user_id = ?
    `).get(orderId, req.user.id);

    if (!order) {
        return res.status(404).json({
            error: 'Order not found'
        });
    }

    if (order.payment_status === 'Verified') {
        return res.status(400).json({
            error: 'Payment is already verified'
        });
    }

    db.prepare(`
        UPDATE orders
        SET payment_reference = ?,
            payment_status = 'Verification pending'
        WHERE id = ? AND user_id = ?
    `).run(reference.trim(), orderId, req.user.id);

    res.json({
        ok: true,
        message: 'Payment reference submitted. Waiting for owner verification.'
    });
});

// ===============================
// 15. CUSTOMER ORDER HISTORY
// ===============================

app.get('/api/orders', auth, (req, res) => {
    const orders = db.prepare(`
        SELECT id, items, total, status, payment_status,
               payment_reference, created_at
        FROM orders
        WHERE user_id = ?
        ORDER BY id DESC
    `).all(req.user.id);

    res.json(orders.map(order => ({
        ...order,
        items: JSON.parse(order.items)
    })));
});

// ===============================
// 16. OWNER DASHBOARD SUMMARY
// ===============================

app.get('/api/admin/summary', auth, owner, (req, res) => {
    const productCount = db.prepare(
        'SELECT COUNT(*) AS n FROM products'
    ).get().n;

    const orderCount = db.prepare(
        'SELECT COUNT(*) AS n FROM orders'
    ).get().n;

    const pendingPayments = db.prepare(`
        SELECT COUNT(*) AS n FROM orders
        WHERE payment_status != 'Verified'
    `).get().n;

    res.json({
        productCount,
        orders: orderCount,
        pendingPayments,
        upi: setting('upi')
    });
});

// ===============================
// 17. OWNER ADD PRODUCT
// ===============================

app.post('/api/admin/products', auth, owner, (req, res) => {
    const p = req.body;

    if (
        typeof p.name !== 'string' ||
        !p.name.trim() ||
        !Number.isFinite(Number(p.price)) ||
        Number(p.price) <= 0 ||
        !Number.isSafeInteger(Number(p.stock ?? 10)) ||
        Number(p.stock ?? 10) < 0
    ) {
        return res.status(400).json({
            error: 'Invalid product details'
        });
    }

    const result = db.prepare(`
        INSERT INTO products
        (name, category, metal, gemstone, price, image, description, stock)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        p.name.trim(),
        p.category || '',
        p.metal || '',
        p.gemstone || '',
        Number(p.price),
        p.image || '',
        p.description || '',
        Number(p.stock ?? 10)
    );

    res.status(201).json({
        id: result.lastInsertRowid,
        message: 'Product added successfully'
    });
});

// ===============================
// 18. OWNER UPDATE PRODUCT
// ===============================

app.patch('/api/admin/products/:id', auth, owner, (req, res) => {
    const id = Number(req.params.id);
    const p = req.body;

    if (!Number.isSafeInteger(id)) {
        return res.status(400).json({ error: 'Invalid product ID' });
    }

    const existing = db.prepare(
        'SELECT * FROM products WHERE id = ?'
    ).get(id);

    if (!existing) {
        return res.status(404).json({ error: 'Product not found' });
    }

    const values = {
        name: p.name ?? existing.name,
        category: p.category ?? existing.category,
        metal: p.metal ?? existing.metal,
        gemstone: p.gemstone ?? existing.gemstone,
        price: Number(p.price ?? existing.price),
        image: p.image ?? existing.image,
        description: p.description ?? existing.description,
        stock: Number(p.stock ?? existing.stock)
    };

    if (
        !values.name.trim() ||
        !Number.isFinite(values.price) ||
        values.price <= 0 ||
        !Number.isSafeInteger(values.stock) ||
        values.stock < 0
    ) {
        return res.status(400).json({ error: 'Invalid product details' });
    }

    db.prepare(`
        UPDATE products SET
        name=?, category=?, metal=?, gemstone=?,
        price=?, image=?, description=?, stock=?
        WHERE id=?
    `).run(
        values.name,
        values.category,
        values.metal,
        values.gemstone,
        values.price,
        values.image,
        values.description,
        values.stock,
        id
    );

    res.json({ ok: true, message: 'Product updated' });
});

// ===============================
// 19. OWNER DELETE PRODUCT
// ===============================

app.delete('/api/admin/products/:id', auth, owner, (req, res) => {
    const result = db.prepare(
        'DELETE FROM products WHERE id = ?'
    ).run(Number(req.params.id));

    if (!result.changes) {
        return res.status(404).json({
            error: 'Product not found'
        });
    }

    res.json({
        ok: true,
        message: 'Product deleted'
    });
});

// ===============================
// 20. OWNER CHANGE UPI ID
// ===============================

app.patch('/api/admin/upi', auth, owner, (req, res) => {
    const upi = req.body.upi;

    if (
        typeof upi !== 'string' ||
        !/^[\w.-]+@[\w.-]+$/.test(upi.trim())
    ) {
        return res.status(400).json({
            error: 'Invalid UPI ID'
        });
    }

    put('upi', upi.trim());

    res.json({
        upi: setting('upi'),
        message: 'UPI ID updated successfully'
    });
});

// ===============================
// 21. OWNER VIEW ALL ORDERS
// ===============================

app.get('/api/admin/orders', auth, owner, (req, res) => {
    const orders = db.prepare(`
        SELECT orders.*, users.name AS customer_name,
               users.email AS customer_email
        FROM orders
        JOIN users ON users.id = orders.user_id
        ORDER BY orders.id DESC
    `).all();

    res.json(orders.map(order => ({
        ...order,
        items: JSON.parse(order.items)
    })));
});

// ===============================
// 22. OWNER VERIFY PAYMENT
// ===============================

app.patch('/api/admin/orders/:id/payment', auth, owner, (req, res) => {
    const id = Number(req.params.id);

    const order = db.prepare(
        'SELECT * FROM orders WHERE id = ?'
    ).get(id);

    if (!order) {
        return res.status(404).json({
            error: 'Order not found'
        });
    }

    if (!order.payment_reference) {
        return res.status(400).json({
            error: 'Customer has not submitted a payment reference'
        });
    }

    db.prepare(`
        UPDATE orders
        SET payment_status = 'Verified',
            status = 'Confirmed'
        WHERE id = ?
    `).run(id);

    res.json({
        ok: true,
        message: 'Payment verified and order confirmed'
    });
});

// ===============================
// 23. OWNER UPDATE ORDER STATUS
// ===============================

app.patch('/api/admin/orders/:id', auth, owner, (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body;

    const allowedStatuses = [
        'Payment pending',
        'Confirmed',
        'Processing',
        'Shipped',
        'Delivered',
        'Cancelled'
    ];

    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
            error: 'Invalid order status'
        });
    }

    const order = db.prepare(
        'SELECT * FROM orders WHERE id = ?'
    ).get(id);

    if (!order) {
        return res.status(404).json({
            error: 'Order not found'
        });
    }

    if (status === 'Confirmed' && order.payment_status !== 'Verified') {
        return res.status(400).json({
            error: 'Verify payment before confirming the order'
        });
    }

    db.prepare(
        'UPDATE orders SET status = ? WHERE id = ?'
    ).run(status, id);

    res.json({
        ok: true,
        message: 'Order status updated'
    });
});

// ===============================
// 24. START SERVER
// ===============================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`MPR Jewellery API listening on port ${PORT}`);
});
