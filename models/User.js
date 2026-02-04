const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/db');

class User extends Model {
    // Compare password
    async matchPassword(enteredPassword) {
        return await bcrypt.compare(enteredPassword, this.password);
    }

    // Ensure password is not returned in JSON responses
    toJSON() {
        const values = { ...this.get() };
        delete values.password;
        return values;
    }
}

User.init(
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
                notEmpty: { msg: 'Please provide a name' }
            }
        },

        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: { msg: 'Please provide a valid email' },
                notEmpty: { msg: 'Please provide an email' }
            }
        },

        password: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                len: { args: [6, 255], msg: 'Password must be at least 6 characters' }
            }
            // Note: In Mongoose you used select:false.
            // In Sequelize, we hide it using toJSON() override above.
        },

        role: {
            type: DataTypes.ENUM(
                'user',
                'member',
                'executive_member',
                'general_secretary',
                'president',
                'moderator',
                'admin'
            ),
            allowNull: false,
            defaultValue: 'user'
        },

        phone: {
            type: DataTypes.STRING,
            allowNull: true
        },

        department: {
            type: DataTypes.STRING,
            allowNull: true
        },

        batch: {
            type: DataTypes.STRING,
            allowNull: true
        },

        studentId: {
            type: DataTypes.STRING,
            allowNull: true
        },

        avatar: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: ''
        },

        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },

        membershipStatus: {
            type: DataTypes.ENUM('pending', 'approved', 'rejected', 'inactive'),
            allowNull: false,
            defaultValue: 'pending'
        },

        membershipDate: {
            type: DataTypes.DATE,
            allowNull: true
        },

        lastLogin: {
            type: DataTypes.DATE,
            allowNull: true
        },

        // Payment related fields
        registrationFeePaid: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },

        registrationFeeAmount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 150
        },

        registrationPaymentDate: {
            type: DataTypes.DATE,
            allowNull: true
        },

        lastMonthlyPayment: {
            type: DataTypes.DATE,
            allowNull: true
        },

        monthlyFeeStatus: {
            type: DataTypes.ENUM('current', 'overdue', 'exempt'),
            allowNull: false,
            defaultValue: 'current'
        }
    },
    {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        timestamps: true,

        hooks: {
            // Hash password before create
            beforeCreate: async (user) => {
                if (user.password) {
                    const salt = await bcrypt.genSalt(10);
                    user.password = await bcrypt.hash(user.password, salt);
                }
            },

            // Hash password before update (only if changed)
            beforeUpdate: async (user) => {
                if (user.changed('password')) {
                    const salt = await bcrypt.genSalt(10);
                    user.password = await bcrypt.hash(user.password, salt);
                }
            }
        },

        defaultScope: {
            // hide password by default when querying
            attributes: { exclude: ['password'] }
        },

        scopes: {
            // when you need password (e.g., login)
            withPassword: {
                attributes: {}
            }
        }
    }
);

module.exports = User;
