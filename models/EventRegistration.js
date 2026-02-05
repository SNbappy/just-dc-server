// models/EventRegistration.js
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class EventRegistration extends Model { }

EventRegistration.init(
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },

        eventId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },

        // ✅ if logged in
        userId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            defaultValue: null,
        },

        // ✅ guest (public registration)
        guestName: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
        guestEmail: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
        guestPhone: { type: DataTypes.STRING, allowNull: true, defaultValue: null },

        // registration state
        status: {
            type: DataTypes.ENUM('pending', 'confirmed', 'cancelled'),
            allowNull: false,
            defaultValue: 'pending',
        },

        // payment
        amount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

        paymentStatus: {
            type: DataTypes.ENUM('none', 'pending', 'paid', 'failed'),
            allowNull: false,
            defaultValue: 'none',
        },

        paymentMethod: {
            type: DataTypes.ENUM('bkash', 'nagad', 'rocket', 'bank', 'cash', 'sslcommerz'),
            allowNull: true,
            defaultValue: null,
        },

        transactionId: { type: DataTypes.STRING, allowNull: true, defaultValue: null },

        // ✅ Certificate support later
        credentialId: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
            unique: true,
        },
        certificateIssued: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        certificateIssuedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    },
    {
        sequelize,
        modelName: 'EventRegistration',
        tableName: 'event_registrations',
        timestamps: true,
        indexes: [
            { fields: ['eventId'] },
            { fields: ['userId'] },
            { fields: ['paymentStatus'] },
        ],
    }
);

module.exports = EventRegistration;
