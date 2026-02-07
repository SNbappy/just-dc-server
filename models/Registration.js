// models/Registration.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Registration = sequelize.define(
    'Registration',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        eventId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'events',
                key: 'id',
            },
        },
        categoryId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        categoryName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        registrationType: {
            type: DataTypes.ENUM('individual', 'team'),
            allowNull: false,
        },
        // Participant Info
        participantName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        participantEmail: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        participantPhone: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        participantInstitution: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        // Team Info (if team registration)
        teamName: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        teamMembers: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: 'Array of team member objects',
        },
        // Payment Info
        registrationFee: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0,
        },
        paymentStatus: {
            type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
            defaultValue: 'pending',
        },
        paymentId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'payments',
                key: 'id',
            },
        },
        transactionId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        // Status
        status: {
            type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'waitlisted'),
            defaultValue: 'pending',
        },
        registrationToken: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true,
            comment: 'For tracking registration without login',
        },
        // User Reference (optional - if logged in)
        userId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id',
            },
        },
        // Certificate
        certificateIssued: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        certificateId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        // Additional Info
        additionalInfo: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        registeredAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        tableName: 'registrations',
        timestamps: true,
    }
);

module.exports = Registration;
