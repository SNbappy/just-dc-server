const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables FIRST
dotenv.config();

// Import DB AFTER env is loaded
const { connectDB } = require('./config/db');

// Connect to MySQL
connectDB();

const app = express();

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true
}));
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

// Welcome route
app.get('/', (req, res) => {
    res.json({
        message: 'JUST Debate Club API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            events: '/api/events',
            members: '/api/members',
            gallery: '/api/gallery',
            upload: '/api/upload',
            users: '/api/users'
        }
    });
});

// Error handler (must be last)
app.use(require('./middleware/errorHandler'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
