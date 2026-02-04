const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class Member extends Model { }

Member.init(
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true
        },

        name: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: { msg: 'Please provide member name' }
            }
        },

        role: {
            type: DataTypes.ENUM(
                'President',
                'Vice President',
                'General Secretary',
                'Treasurer',
                'Executive Member',
                'Member'
            ),
            allowNull: false
        },

        department: {
            type: DataTypes.STRING,
            allowNull: false
        },

        batch: {
            type: DataTypes.STRING,
            allowNull: false
        },

        email: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: {
                isEmail: true
            }
        },

        phone: {
            type: DataTypes.STRING,
            allowNull: true
        },

        image: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: ''
        },

        bio: {
            type: DataTypes.STRING(500),
            allowNull: false,
            defaultValue: ''
        },

        socialLinks: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: {
                facebook: '',
                linkedin: '',
                twitter: ''
            }
        },

        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },

        priority: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    },
    {
        sequelize,
        modelName: 'Member',
        tableName: 'members',
        timestamps: true,

        indexes: [
            {
                fields: ['priority', 'createdAt']
            }
        ]
    }
);

module.exports = Member;
