// models/Event.js
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class Event extends Model { }

Event.init(
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },

        title: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: { notEmpty: { msg: 'Please add an event title' } },
        },

        description: {
            type: DataTypes.TEXT,
            allowNull: false,
            validate: { notEmpty: { msg: 'Please add a description' } },
        },

        date: { type: DataTypes.DATEONLY, allowNull: false },
        time: { type: DataTypes.STRING, allowNull: false },
        location: { type: DataTypes.STRING, allowNull: false },

        category: {
            type: DataTypes.ENUM('workshop', 'tournament', 'practice', 'seminar', 'competition'),
            allowNull: false,
            defaultValue: 'workshop',
        },

        maxParticipants: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
        image: { type: DataTypes.STRING, allowNull: true, defaultValue: null },

        status: {
            type: DataTypes.ENUM('upcoming', 'ongoing', 'completed', 'cancelled'),
            allowNull: false,
            defaultValue: 'upcoming',
        },

        // ✅ NEW: public vs inter-club
        accessType: {
            type: DataTypes.ENUM('public', 'inter_club'),
            allowNull: false,
            defaultValue: 'public',
        },

        // ✅ NEW: fee for event registration (0 = free)
        registrationFee: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },

        // ✅ NEW: enable/disable registration
        registrationOpen: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },

        // People list (your existing)
        participants: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: [],
        },

        createdBy: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
    },
    {
        sequelize,
        modelName: 'Event',
        tableName: 'events',
        timestamps: true,
        indexes: [
            { type: 'FULLTEXT', fields: ['title', 'description'] },
        ],
    }
);

// ✅ ADD ASSOCIATIONS HERE (after init)
Event.associate = function (models) {
    // Event has many EventRegistrations
    Event.hasMany(models.EventRegistration, {
        foreignKey: 'eventId',
        as: 'registrations',
    });
};

module.exports = Event;
