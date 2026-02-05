// models/EmailLog.js
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class EmailLog extends Model { }

EmailLog.init(
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },

        sentBy: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            comment: 'User ID who sent the email',
        },

        recipients: {
            type: DataTypes.JSON,
            allowNull: false,
            comment: 'Array of recipient emails or user IDs',
        },

        recipientType: {
            type: DataTypes.ENUM('individual', 'role', 'all', 'custom'),
            allowNull: false,
            defaultValue: 'individual',
        },

        subject: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        message: {
            type: DataTypes.TEXT,
            allowNull: false,
        },

        htmlContent: {
            type: DataTypes.TEXT,
            allowNull: true,
        },

        templateUsed: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Template name if used',
        },

        status: {
            type: DataTypes.ENUM('sent', 'failed', 'pending'),
            allowNull: false,
            defaultValue: 'sent',
        },

        emailsSent: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Number of emails successfully sent',
        },

        errorMessage: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: 'EmailLog',
        tableName: 'email_logs',
        timestamps: true,
        indexes: [
            { fields: ['sentBy'] },
            { fields: ['recipientType'] },
            { fields: ['status'] },
        ],
    }
);

module.exports = EmailLog;
