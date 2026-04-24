// test-all-emails.js - Test all email templates
require('dotenv').config();

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function testAllEmails() {
    const testEmail = process.env.EMAIL_USER;
    
    console.log('📧 Testing all email templates...\n');
    
    // Test 1: Welcome Email
    console.log('1. Sending Welcome Email...');
    await transporter.sendMail({
        from: `"Ethical Hacking Course" <${process.env.EMAIL_USER}>`,
        to: testEmail,
        subject: 'TEST: Welcome to Ethical Hacking Course',
        html: getTestWelcomeEmail('Test Student', 'Complete Ethical Hacking', testEmail)
    });
    await delay(2000);
    
    // Test 2: Payment Confirmation
    console.log('2. Sending Payment Confirmation...');
    await transporter.sendMail({
        from: `"Ethical Hacking Course" <${process.env.EMAIL_USER}>`,
        to: testEmail,
        subject: 'TEST: Payment Confirmed',
        html: getTestPaymentEmail('Test Student', 'Complete Ethical Hacking', '0x1234567890abcdef')
    });
    await delay(2000);
    
    // Test 3: Password Reset
    console.log('3. Sending Password Reset...');
    await transporter.sendMail({
        from: `"Ethical Hacking Course" <${process.env.EMAIL_USER}>`,
        to: testEmail,
        subject: 'TEST: Password Reset Request',
        html: getTestResetEmail('Test Student', 'test-token-123')
    });
    
    console.log('\n✅ All test emails sent! Check your inbox at:', testEmail);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getTestWelcomeEmail(name, course, email) {
    return `
        <div style="font-family: monospace; background: #0a0a0a; color: #00ff41; padding: 20px;">
            <h1>🎉 Welcome to Ethical Hacking Mastery!</h1>
            <p>Dear ${name},</p>
            <p>Thank you for registering for <strong>${course}</strong>.</p>
            <p>This is a TEST email to confirm your email system is working.</p>
            <hr>
            <p><strong>Course Access:</strong> http://localhost:3000/login</p>
            <p><strong>Email:</strong> ${email}</p>
        </div>
    `;
}

function getTestPaymentEmail(name, course, txHash) {
    return `
        <div style="font-family: monospace; background: #0a0a0a; color: #00ff41; padding: 20px;">
            <h1>✅ Payment Confirmed (TEST)</h1>
            <p>Dear ${name},</p>
            <p>Your payment for <strong>${course}</strong> has been verified!</p>
            <p>Transaction: ${txHash}</p>
            <p><a href="http://localhost:3000/dashboard" style="background: #00ff41; color: #000; padding: 10px;">Access Course →</a></p>
        </div>
    `;
}

function getTestResetEmail(name, token) {
    return `
        <div style="font-family: monospace; background: #0a0a0a; color: #00ff41; padding: 20px;">
            <h1>🔐 Password Reset (TEST)</h1>
            <p>Hello ${name},</p>
            <p>Click here to reset your password:</p>
            <p><a href="http://localhost:3000/reset-password?token=${token}" style="background: #00ff41; color: #000; padding: 10px;">Reset Password →</a></p>
        </div>
    `;
}

testAllEmails();