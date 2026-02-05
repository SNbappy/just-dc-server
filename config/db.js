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
        logging: false,
    }
);

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ MySQL Connected Successfully');
    } catch (error) {
        console.error('❌ MySQL connection failed:', error.message);
        process.exit(1);
    }
};

// ✅ If you don’t want migrations, keep this ON (dev/staging).
// In production, use migrations later.
const syncDB = async () => {
    try {
        await sequelize.sync({ alter: true });
        console.log('✅ MySQL Tables Synced (alter:true)');
    } catch (error) {
        console.error('❌ MySQL sync failed:', error.message);
        process.exit(1);
    }
};

module.exports = { sequelize, connectDB, syncDB };
