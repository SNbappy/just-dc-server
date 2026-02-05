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
 * ✅ No migrations needed:
 * - dev: alter table automatically
 * - prod: DO NOT use alter/force (keep safe)
 */
const syncDB = async () => {
    const isProd = process.env.NODE_ENV === 'production';

    if (isProd) {
        await sequelize.sync(); // safe
        console.log('✅ DB Sync done (production safe)');
        return;
    }

    await sequelize.sync({ alter: true });
    console.log('✅ DB Sync done (dev alter=true)');
};

module.exports = { sequelize, connectDB, syncDB };
