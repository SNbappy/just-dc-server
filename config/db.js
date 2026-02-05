// config/db.js
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: process.env.DB_LOGGING === 'true' ? console.log : false,
        timezone: '+00:00',
        dialectOptions: {
            dateStrings: true,
            typeCast: true,
        },
    }
);

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ MySQL Connected (Sequelize)');
    } catch (err) {
        console.error('❌ DB Connection Error:', err.message);
        throw err;
    }
};

/**
 * ✅ Database synchronization strategy:
 * - SKIP_SYNC=true: Skip sync entirely (tables already exist)
 * - Production: Safe sync only (no alter)
 * - Development: Alter tables automatically
 * - FORCE_RESET=true: Drop and recreate all tables (DANGEROUS!)
 */
const syncDB = async () => {
    const isProd = process.env.NODE_ENV === 'production';
    const skipSync = process.env.SKIP_SYNC === 'true';
    const forceReset = process.env.FORCE_RESET === 'true';

    try {
        // ⏭️ SKIP SYNC (Use this if you have index issues)
        if (skipSync) {
            console.log('⏭️ Skipping database sync (SKIP_SYNC=true)');
            console.log('💡 Make sure all required tables exist in your database');
            return;
        }

        // 🚨 FORCE RESET (DEVELOPMENT ONLY - DROPS ALL TABLES!)
        if (forceReset && !isProd) {
            console.warn('⚠️ FORCE RESET: Dropping all tables...');
            await sequelize.sync({ force: true });
            console.log('✅ DB Reset Complete (all tables dropped and recreated)');
            console.log('💡 Set FORCE_RESET=false in .env to disable this');
            return;
        }

        // 🔒 PRODUCTION: Safe sync only
        if (isProd) {
            await sequelize.sync();
            console.log('✅ DB Sync done (production safe - no alter)');
            return;
        }

        // 🛠️ DEVELOPMENT: Alter tables
        await sequelize.sync({ alter: true });
        console.log('✅ DB Sync done (dev mode - alter=true)');
        console.log('💡 If you get "too many keys" error, set SKIP_SYNC=true');

    } catch (error) {
        console.error('❌ Database sync failed:', error.message);

        // If it's the "too many keys" error, provide helpful message
        if (error.message?.includes('Too many keys')) {
            console.error('\n🚨 TOO MANY INDEXES ERROR:');
            console.error('   Add SKIP_SYNC=true to your .env file, then:');
            console.error('   1. Connect to MySQL: mysql -u root -p');
            console.error('   2. Use database: USE just_dc;');
            console.error('   3. Drop users table: DROP TABLE users;');
            console.error('   4. Restart server\n');
        }

        throw error;
    }
};

/**
 * ✅ Helper: Check if a table exists
 */
const tableExists = async (tableName) => {
    try {
        const [results] = await sequelize.query(
            `SHOW TABLES LIKE '${tableName}'`
        );
        return results.length > 0;
    } catch (error) {
        console.error(`Error checking table ${tableName}:`, error.message);
        return false;
    }
};

/**
 * ✅ Helper: Create email_logs table manually if it doesn't exist
 */
const createEmailLogsTable = async () => {
    try {
        const exists = await tableExists('email_logs');

        if (!exists) {
            console.log('📧 Creating email_logs table...');

            await sequelize.query(`
                CREATE TABLE email_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    senderId INT NOT NULL,
                    recipientType ENUM('all', 'role', 'individual', 'event', 'custom') NOT NULL,
                    recipients JSON,
                    subject VARCHAR(255) NOT NULL,
                    message TEXT NOT NULL,
                    htmlContent TEXT,
                    emailsSent INT DEFAULT 0,
                    status ENUM('sent', 'failed', 'pending') DEFAULT 'pending',
                    errorMessage TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_sender (senderId),
                    INDEX idx_status (status),
                    INDEX idx_created (createdAt)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

            console.log('✅ email_logs table created successfully');
        } else {
            console.log('✅ email_logs table already exists');
        }
    } catch (error) {
        console.error('❌ Failed to create email_logs table:', error.message);
    }
};

/**
 * ✅ Initialize database (connect + sync + create missing tables)
 */
const initializeDB = async () => {
    await connectDB();
    await syncDB();

    // Create email_logs table if SKIP_SYNC is enabled
    if (process.env.SKIP_SYNC === 'true') {
        await createEmailLogsTable();
    }
};

module.exports = {
    sequelize,
    connectDB,
    syncDB,
    initializeDB,
    tableExists,
    createEmailLogsTable
};
