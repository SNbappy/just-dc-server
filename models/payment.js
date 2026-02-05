// models/Payment.js
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class Payment extends Model {}

Payment.init(
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true
        },

        userId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false
        },

        amount: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        type: {
            type: DataTypes.ENUM('registration', 'monthly'),
            allowNull: false
        },

        status: {
            type: DataTypes.ENUM('pending', 'paid', 'failed', 'overdue', 'refunded'),
            allowNull: false,
            defaultValue: 'pending'
        },

        paymentMethod: {
            type: DataTypes.ENUM('bkash', 'nagad', 'rocket', 'bank', 'cash', 'sslcommerz'),
            allowNull: true
        },

        transactionId: {
            type: DataTypes.STRING,
            allowNull: true
        },

        // YYYY-MM for monthly payments
        month: {
            type: DataTypes.STRING,
            allowNull: true
        },

        year: {
            type: DataTypes.INTEGER,
            allowNull: true
        },

        paidAt: {
            type: DataTypes.DATE,
            allowNull: true
        },

        verifiedBy: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true
        },

        verifiedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },

        dueDate: {
            type: DataTypes.DATE,
            allowNull: true
        },

        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    },
    {
        sequelize,
        modelName: 'Payment',
        tableName: 'payments',
        timestamps: true,

        indexes: [
            // Query performance
            { fields: ['userId', 'type'] },
            { fields: ['status'] },

            // ✅ Prevent duplicate monthly per user per month/year at DB level
            // (registration month is NULL so controller enforces that)
            {
                unique: true,
                fields: ['userId', 'type', 'month', 'year']
            }
        ]
    }
);

module.exports = Payment;
