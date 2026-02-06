// models/Certificate.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Certificate = sequelize.define(
    'Certificate',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        credentialId: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false,
        },

        // Event reference
        eventId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },

        // Recipient information
        recipientName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        recipientEmail: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: true, // Null for external/guest participants
        },

        // Certificate type
        certificateType: {
            type: DataTypes.ENUM(
                'participant',      // Event participant/registrant
                'organizer',        // Event organizer
                'volunteer',        // Volunteer
                'adjudicator',      // Core adjudicator
                'tab_team',         // Tab team member
                'speaker',          // Speaker
                'guest'             // Guest participant
            ),
            allowNull: false,
        },

        // Role/designation
        role: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        designation: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        organization: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        // Additional info
        teamName: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        achievement: {
            type: DataTypes.STRING, // e.g., "Best Speaker", "Winner", "Runner-up"
            allowNull: true,
        },

        // Status
        status: {
            type: DataTypes.ENUM('issued', 'revoked'),
            defaultValue: 'issued',
        },
        issuedBy: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        issuedAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        revokedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },

        // Certificate file
        certificateUrl: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    },
    {
        tableName: 'certificates',
        timestamps: true,
        indexes: [
            { fields: ['credentialId'], unique: true },
            { fields: ['eventId'] },
            { fields: ['userId'] },
            { fields: ['recipientEmail'] },
        ],
    }
);

module.exports = Certificate;
