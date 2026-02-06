// server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');

// 1) Load env FIRST
dotenv.config();

// 2) Load DB after env
const { connectDB, syncDB } = require('./config/db');

// 3) ✅ Load models through index.js to initialize associations
require('./models/index');

const app = express();

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
    cors({
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        credentials: true,
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Serve static files for uploads (PDFs, images, certificates)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// =====================================================
// ROUTES
// =====================================================

// Existing routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/members', require('./routes/memberRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/gallery', require('./routes/galleryRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/emails', require('./routes/emailRoutes'));

// ✅ NEW ROUTES - with error handling
try {
    app.use('/api/registrations', require('./routes/registrationRoutes'));
    console.log('✅ Registration routes loaded');
} catch (error) {
    console.error('❌ Failed to load registration routes:', error.message);
}

try {
    app.use('/api/certificates', require('./routes/certificateRoutes'));
    console.log('✅ Certificate routes loaded');
} catch (error) {
    console.error('❌ Failed to load certificate routes:', error.message);
}

try {
    app.use('/api/sslcommerz', require('./routes/sslcommerzRoutes'));
    console.log('✅ SSLCommerz routes loaded');
} catch (error) {
    console.error('❌ Failed to load sslcommerz routes:', error.message);
}

// =====================================================
// WELCOME ROUTE
// =====================================================

app.get('/', (req, res) => {
    res.json({
        message: 'JUST Debate Club API',
        version: '2.0.0',
        features: [
            'Authentication',
            'Event Management',
            'Registration System',
            'Certificate Issuance',
            'Payment Integration (SSLCommerz)',
            'Email Notifications'
        ]
    });
});

// =====================================================
// ERROR HANDLER (must be last)
// =====================================================

app.use(require('./middleware/errorHandler'));

// =====================================================
// SERVER STARTUP
// =====================================================

const PORT = process.env.PORT || 5000;

(async () => {
    try {
        await connectDB();
        await syncDB(); // ✅ auto creates/updates tables

        app.listen(PORT, () => {
            console.log('='.repeat(50));
            console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode`);
            console.log(`📡 Port: ${PORT}`);
            console.log(`🌐 API: http://localhost:${PORT}`);
            console.log(`🎨 Client: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
            console.log('='.repeat(50));
            console.log('✅ Available Services:');
            console.log('   - Registration System');
            console.log('   - Certificate Management');
            console.log('   - Payment Gateway (SSLCommerz)');
            console.log('   - Email Service');
            console.log('='.repeat(50));
        });
    } catch (err) {
        console.error('❌ Server startup failed:', err);
        process.exit(1);
    }
})();
