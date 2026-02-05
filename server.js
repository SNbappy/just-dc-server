// server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

// 1) Load env FIRST
dotenv.config();

// 2) Load DB after env
const { connectDB, syncDB } = require('./config/db');

// 3) ✅ UPDATED: Load models through index.js to initialize associations
require('./models/index');

const app = express();

// Middleware
app.use(
    cors({
        origin: process.env.CLIENT_URL,
        credentials: true,
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/members', require('./routes/memberRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/gallery', require('./routes/galleryRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/sslcommerz', require('./routes/sslcommerzRoutes'));
app.use('/api/emails', require('./routes/emailRoutes')); // ✅ ADD THIS

// Welcome route
app.get('/', (req, res) => {
    res.json({
        message: 'JUST Debate Club API',
        version: '1.0.0',
    });
});

// Error handler (must be last)
app.use(require('./middleware/errorHandler'));

const PORT = process.env.PORT || 5000;

(async () => {
    try {
        await connectDB();
        await syncDB(); // ✅ auto creates/updates tables without migrations

        app.listen(PORT, () => {
            console.log(
                `Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`
            );
        });
    } catch (err) {
        console.error('❌ Server startup failed:', err);
        process.exit(1);
    }
})();
