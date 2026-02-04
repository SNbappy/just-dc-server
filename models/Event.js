const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class Event extends Model { }

Event.init(
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true
        },

        title: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: { msg: 'Please add an event title' }
            }
        },

        description: {
            type: DataTypes.TEXT,
            allowNull: false,
            validate: {
                notEmpty: { msg: 'Please add a description' }
            }
        },

        date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },

        time: {
            type: DataTypes.STRING,
            allowNull: false
        },

        location: {
            type: DataTypes.STRING,
            allowNull: false
        },

        category: {
            type: DataTypes.ENUM(
                'workshop',
                'tournament',
                'practice',
                'seminar',
                'competition'
            ),
            allowNull: false,
            defaultValue: 'workshop'
        },

        maxParticipants: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null
        },

        image: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null
        },

        status: {
            type: DataTypes.ENUM(
                'upcoming',
                'ongoing',
                'completed',
                'cancelled'
            ),
            allowNull: false,
            defaultValue: 'upcoming'
        },

        createdBy: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false
            // Will link to User.id later (foreign key)
        }
    },
    {
        sequelize,
        modelName: 'Event',
        tableName: 'events',
        timestamps: true,

        indexes: [
            {
                type: 'FULLTEXT',
                fields: ['title', 'description']
            }
        ]
    }
);

module.exports = Event;
