const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class Gallery extends Model { }

Gallery.init(
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
                notEmpty: { msg: 'Please provide a title' }
            }
        },

        description: {
            type: DataTypes.STRING(500),
            allowNull: false,
            defaultValue: ''
        },

        category: {
            type: DataTypes.ENUM(
                'Event',
                'Workshop',
                'Competition',
                'Meeting',
                'Achievement',
                'Other'
            ),
            allowNull: false,
            defaultValue: 'Other'
        },

        eventDate: {
            type: DataTypes.DATE,
            allowNull: true
        },

        isPublished: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },

        createdBy: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false
        }
    },
    {
        sequelize,
        modelName: 'Gallery',
        tableName: 'galleries',
        timestamps: true,

        indexes: [
            {
                fields: ['createdAt']
            }
        ]
    }
);

module.exports = Gallery;
