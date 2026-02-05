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

        // can be NULL for guests
        userId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            defaultValue: null,
        },

        // snapshot info (works for both guest & user)
        type: {
            type: DataTypes.ENUM('guest', 'internal'),
            allowNull: false,
            defaultValue: 'guest',
        },

        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        email: {
            type: DataTypes.STRING,
            allowNull: false,
            set(value) {
                this.setDataValue('email', value ? value.toLowerCase().trim() : value);
            },
        },

        phone: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },

        studentId: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },

        department: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },

        batch: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },

        organization: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },

        // ✅ NEW: fee snapshot
        amount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },

        // registration flow
        status: {
            type: DataTypes.ENUM('pending_payment', 'confirmed', 'cancelled'),
            allowNull: false,
            defaultValue: 'pending_payment',
        },

        // link to payments table (type=event)
        paymentId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            defaultValue: null,
        },

        // certificate related
        attendanceStatus: {
            type: DataTypes.ENUM('unknown', 'present', 'absent'),
            allowNull: false,
            defaultValue: 'unknown',
        },

        certificateIssued: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },

        credentialId: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },

        certificateUrl: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
    },
    {
        sequelize,
        modelName: 'EventRegistration',
        tableName: 'event_registrations',
        timestamps: true,
        indexes: [
            { fields: ['eventId'] },
            { fields: ['userId'] },
            { fields: ['email'] },
            { fields: ['paymentId'] },

            // ✅ prevent duplicate email per event (guest or internal snapshot)
            { unique: true, fields: ['eventId', 'email'] },

            // ✅ prevent duplicate logged-in user per event
            // MySQL allows multiple NULLs, so guests won't conflict here.
            { unique: true, fields: ['eventId', 'userId'] },
        ],
    }
);

module.exports = EventRegistration;
