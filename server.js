const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const session = require('express-session');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname));

// Database setup
const db = new sqlite3.Database('./course.db');

// IMPORTANT: Drop and recreate tables with correct schema
db.serialize(() => {
    // Drop existing tables to start fresh
    db.run(`DROP TABLE IF EXISTS downloads`);
    db.run(`DROP TABLE IF EXISTS payments`);
    db.run(`DROP TABLE IF EXISTS registrations`);
    db.run(`DROP TABLE IF EXISTS users`);
    
    // Create users table - password can be NULL (will be set on first login)
    db.run(`
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT,
            role TEXT DEFAULT 'student',
            reset_token TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create registrations table
    db.run(`
        CREATE TABLE registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            course TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Create payments table
    db.run(`
        CREATE TABLE payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            email TEXT NOT NULL,
            course_name TEXT NOT NULL,
            amount REAL NOT NULL,
            crypto_type TEXT NOT NULL,
            transaction_hash TEXT UNIQUE,
            status TEXT DEFAULT 'pending',
            paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Create downloads table
    db.run(`
        CREATE TABLE downloads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            email TEXT NOT NULL,
            resource_name TEXT NOT NULL,
            downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Create admin user
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
        ['Admin', 'admin@ethicalhack.com', hashedPassword, 'admin']);
    
    console.log('✅ Database tables created successfully');
});

// Email Configuration (optional)
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS && 
    process.env.EMAIL_USER !== 'your_email@gmail.com') {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}

// Email sending function
async function sendEmail(to, subject, html) {
    if (!transporter) {
        console.log(`📧 [SIMULATED] Email to ${to}: ${subject}`);
        return { success: true };
    }
    try {
        await transporter.sendMail({
            from: `"Ethical Hacking Course" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: html
        });
        console.log(`✅ Email sent to ${to}`);
        return { success: true };
    } catch (error) {
        console.error(`❌ Email failed:`, error.message);
        return { success: false };
    }
}

// FIXED: Registration endpoint - NO PASSWORD REQUIRED
app.post('/api/register', async (req, res) => {
    const { name, email, course } = req.body;
    
    console.log(`Registration attempt: ${name}, ${email}, ${course}`);
    
    if (!name || !email || !course) {
        return res.status(400).json({ success: false, error: 'All fields required' });
    }
    
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        return res.status(400).json({ success: false, error: 'Invalid email address' });
    }
    
    try {
        // First, check if user already exists
        const existingUser = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        let userId;
        let tempPassword = null;
        
        if (existingUser) {
            userId = existingUser.id;
            console.log(`Existing user found: ${email}`);
        } else {
            // Create NEW user with NULL password (they'll set it on first login)
            tempPassword = Math.random().toString(36).slice(-8);
            
            userId = await new Promise((resolve, reject) => {
                db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
                    [name, email.toLowerCase(), null, 'student'],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.lastID);
                    });
            });
            console.log(`New user created with ID: ${userId}`);
        }
        
        // Check if already registered for this course
        const existingReg = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM registrations WHERE email = ? AND course = ?', 
                [email.toLowerCase(), course], 
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
        });
        
        if (existingReg) {
            return res.json({ 
                success: true, 
                message: 'You are already registered! Please login.',
                redirectTo: '/login'
            });
        }
        
        // Create registration
        await new Promise((resolve, reject) => {
            db.run(`INSERT INTO registrations (user_id, name, email, course, status) 
                   VALUES (?, ?, ?, ?, 'pending')`,
                [userId, name, email.toLowerCase(), course],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                });
        });
        
        console.log(`✅ Registration successful for ${email}`);
        
        // Send welcome email (if configured)
        const welcomeHtml = `
            <h2>Welcome to Ethical Hacking Course!</h2>
            <p>Dear ${name},</p>
            <p>Thank you for registering for <strong>${course}</strong>!</p>
            <p>You can now log in to your dashboard:</p>
            <a href="http://localhost:${PORT}/login" style="background: green; color: white; padding: 10px;">Login Here</a>
            <p>Email: ${email}</p>
            ${tempPassword ? `<p>Temporary Password: <strong>${tempPassword}</strong> (change after login)</p>` : ''}
        `;
        await sendEmail(email, `Welcome to ${course}`, welcomeHtml);
        
        res.json({ 
            success: true, 
            message: 'Registration successful! Please login to continue.'
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Registration failed. Please try again.' 
        });
    }
});

// FIXED: Login endpoint - sets password on first login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password required' });
    }
    
    db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()], async (err, user) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Database error' });
        }
        
        if (!user) {
            return res.status(401).json({ success: false, error: 'User not found. Please register first.' });
        }
        
        let passwordValid = false;
        
        // Check if user has a password
        if (user.password) {
            passwordValid = bcrypt.compareSync(password, user.password);
        } else {
            // First time login - set their password
            const hashedPassword = bcrypt.hashSync(password, 10);
            await new Promise((resolve, reject) => {
                db.run('UPDATE users SET password = ? WHERE email = ?', 
                    [hashedPassword, email.toLowerCase()], 
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
            });
            passwordValid = true;
            console.log(`Password set for new user: ${email}`);
        }
        
        if (!passwordValid) {
            return res.status(401).json({ success: false, error: 'Invalid password' });
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'secret-key',
            { expiresIn: '7d' }
        );
        
        res.json({ 
            success: true, 
            token: token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    });
});

// Verify payment endpoint
app.post('/api/verify-payment', (req, res) => {
    const { email, courseName, transactionHash, cryptoType, amount } = req.body;
    
    db.get('SELECT id, name FROM users WHERE email = ?', [email.toLowerCase()], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        db.run(`INSERT INTO payments (user_id, email, course_name, amount, crypto_type, transaction_hash, status) 
               VALUES (?, ?, ?, ?, ?, ?, 'completed')`,
            [user.id, email.toLowerCase(), courseName, amount, cryptoType, transactionHash],
            function(err) {
                if (err) {
                    return res.status(500).json({ success: false, error: err.message });
                }
                
                db.run('UPDATE registrations SET status = "paid" WHERE email = ?', [email.toLowerCase()]);
                
                res.json({ success: true, message: 'Payment verified successfully!' });
            });
    });
});

// Track download
app.post('/api/track-download', (req, res) => {
    const { email, resourceName } = req.body;
    
    db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()], (err, user) => {
        db.run(`INSERT INTO downloads (user_id, email, resource_name) VALUES (?, ?, ?)`,
            [user?.id, email.toLowerCase(), resourceName],
            () => res.json({ success: true }));
    });
});

// Get dashboard data
app.get('/api/dashboard/:email', (req, res) => {
    const { email } = req.params;
    
    db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()], (err, user) => {
        db.get('SELECT * FROM registrations WHERE email = ?', [email.toLowerCase()], (err, registration) => {
            db.all('SELECT * FROM payments WHERE email = ? ORDER BY paid_at DESC', [email.toLowerCase()], (err, payments) => {
                db.all('SELECT * FROM downloads WHERE email = ? ORDER BY downloaded_at DESC', [email.toLowerCase()], (err, downloads) => {
                    res.json({ user, registration, payments, downloads });
                });
            });
        });
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running!' });
});

// Admin endpoints
app.get('/api/admin/registrations', (req, res) => {
    db.all('SELECT * FROM registrations ORDER BY registered_at DESC', (err, rows) => {
        res.json(rows || []);
    });
});

app.get('/api/admin/stats', (req, res) => {
    db.get(`SELECT 
        (SELECT COUNT(*) FROM registrations) as total_registrations,
        (SELECT COUNT(*) FROM registrations WHERE status = 'paid') as paid,
        (SELECT COUNT(*) FROM registrations WHERE status = 'pending') as pending,
        (SELECT COUNT(*) FROM downloads) as total_downloads`,
        (err, row) => {
            res.json(row || {});
        });
});

app.get('/api/admin/downloads', (req, res) => {
    db.all('SELECT * FROM downloads ORDER BY downloaded_at DESC LIMIT 50', (err, rows) => {
        res.json(rows || []);
    });
});

// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'course.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════════════════╗
    ║                                                      ║
    ║   🚀 Server is RUNNING!                             ║
    ║                                                      ║
    ║   📍 http://localhost:${PORT}                         ║
    ║   🔐 http://localhost:${PORT}/login                  ║
    ║   📊 http://localhost:${PORT}/dashboard              ║
    ║   👑 http://localhost:${PORT}/admin                  ║
    ║                                                      ║
    ║   ✨ Registration: No password required             ║
    ║   ✅ First login: Set your own password             ║
    ║                                                      ║
    ║   Press Ctrl+C to stop                               ║
    ╚══════════════════════════════════════════════════════╝
    `);
});