// models/Payment.js
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class Payment extends Model { }

Payment.init(
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true
        },

        // ✅ can be NULL for guest event payments
        userId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            defaultValue: null
        },

        // ✅ NEW: snapshot payer info for guest/edge cases
        payerName: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null
        },
        payerEmail: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
            set(value) {
                this.setDataValue('payerEmail', value ? value.toLowerCase().trim() : value);
            }
        },

        amount: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        // ✅ add "event" type
        type: {
            type: DataTypes.ENUM('registration', 'monthly', 'event'),
            allowNull: false
        },

        // ✅ NEW: event payment linkage
        eventId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            defaultValue: null
        },
        eventRegistrationId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            defaultValue: null
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
            { fields: ['userId', 'type'] },
            { fields: ['status'] },
            { fields: ['eventId'] },
            { fields: ['eventRegistrationId'] },
            { fields: ['transactionId'] },

            // keep monthly unique constraint
            {
                unique: true,
                fields: ['userId', 'type', 'month', 'year']
            }
        ]
    }
);

module.exports = Payment;
