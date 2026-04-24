// test-email.js - Run this to test email configuration
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
    console.log('📧 Testing email configuration...');
    console.log(`Using email: ${process.env.EMAIL_USER}`);
    
    // Create transporter
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    // Verify connection
    try {
        await transporter.verify();
        console.log('✅ SMTP connection successful!');
    } catch (error) {
        console.error('❌ SMTP connection failed:', error.message);
        return;
    }

    // Send test email
    try {
        const info = await transporter.sendMail({
            from: `"Ethical Hacking Course" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER, // Send to yourself for testing
            subject: '✅ Test Email - Your Email System is Working!',
            html: `
                <div style="font-family: monospace; background: #0a0a0a; color: #00ff41; padding: 20px;">
                    <h1 style="color: #00ff41;">✅ Email Test Successful!</h1>
                    <p>Your email system is configured correctly.</p>
                    <p>Students will now receive:</p>
                    <ul>
                        <li>Welcome emails on registration</li>
                        <li>Payment confirmation emails</li>
                        <li>Password reset links</li>
                    </ul>
                    <hr>
                    <p style="font-size: 12px;">Ethical Hacking Course - Automated Email</p>
                </div>
            `
        });
        
        console.log('✅ Test email sent!');
        console.log(`📨 Message ID: ${info.messageId}`);
        console.log(`📧 Check your inbox at ${process.env.EMAIL_USER}`);
    } catch (error) {
        console.error('❌ Failed to send email:', error.message);
    }
}

testEmail();