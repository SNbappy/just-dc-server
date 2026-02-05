// test-email-simple.js
require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('Testing Email with:', process.env.SMTP_USER);

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

transporter.verify((error, success) => {
    if (error) {
        console.error('❌ SMTP Error:', error);
    } else {
        console.log('✅ SMTP Ready!');

        transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: process.env.SMTP_USER,
            subject: 'Test from JUST DC',
            html: '<h1>✅ Email Working!</h1>',
        }, (err, info) => {
            if (err) {
                console.error('❌ Send failed:', err);
            } else {
                console.log('✅ Email sent! Check inbox:', process.env.SMTP_USER);
            }
        });
    }
});
