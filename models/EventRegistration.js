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

        // ✅ NEW: Registration type (individual or team)
        registrationType: {
            type: DataTypes.ENUM('individual', 'team'),
            allowNull: false,
            defaultValue: 'individual',
        },

        // ✅ NEW: Team information (for debate teams)
        teamName: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
            comment: 'Name of the debate team (if registrationType is team)',
        },

        // ✅ NEW: Team members array (for team registrations)
        teamMembers: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: null,
            comment: 'Array of team member objects: [{name, email, phone, studentId, userId}]',
        },

        // snapshot info (works for both guest & user)
        // For team registration, this is the team captain/contact person
        type: {
            type: DataTypes.ENUM('guest', 'internal'),
            allowNull: false,
            defaultValue: 'guest',
        },

        name: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Primary contact name (team captain for teams, individual for solo)',
        },

        email: {
            type: DataTypes.STRING,
            allowNull: false,
            set(value) {
                this.setDataValue('email', value ? value.toLowerCase().trim() : value);
            },
            comment: 'Primary contact email',
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

        // ✅ NEW: Participant role (for individual registrations)
        participantRole: {
            type: DataTypes.ENUM('debater', 'adjudicator', 'observer', 'volunteer', 'other'),
            allowNull: true,
            defaultValue: 'debater',
            comment: 'Role of the participant (mainly for individual registrations)',
        },

        // fee snapshot
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

        // attendance tracking
        attendanceStatus: {
            type: DataTypes.ENUM('unknown', 'present', 'absent'),
            allowNull: false,
            defaultValue: 'unknown',
        },

        // ✅ UPDATED: Certificate for primary registrant only
        // For team registrations, each team member gets individual certificates
        certificateIssued: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Primary contact certificate status. Use Certificate model for all members.',
        },

        credentialId: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
            comment: 'Credential ID for primary contact (legacy - use Certificate model)',
        },

        certificateUrl: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },

        certificateIssuedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
        },

        // ✅ NEW: Additional metadata
        notes: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: null,
            comment: 'Admin notes or special requests',
        },

        // ✅ NEW: Achievement/award tracking
        achievement: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
            comment: 'e.g., Winner, Runner-up, Best Speaker, etc.',
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
            { fields: ['registrationType'] },
            { fields: ['status'] },

            // ✅ Prevent duplicate email per event (guest or internal snapshot)
            { unique: true, fields: ['eventId', 'email'], name: 'unique_event_email' },

            // ✅ Prevent duplicate logged-in user per event
            // MySQL allows multiple NULLs, so guests won't conflict here.
            { unique: true, fields: ['eventId', 'userId'], name: 'unique_event_user' },
        ],
    }
);

// ✅ ASSOCIATIONS
EventRegistration.associate = function (models) {
    // EventRegistration belongs to Event
    EventRegistration.belongsTo(models.Event, {
        foreignKey: 'eventId',
        as: 'event',
    });

    // EventRegistration belongs to User
    EventRegistration.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
    });

    // EventRegistration belongs to Payment
    EventRegistration.belongsTo(models.Payment, {
        foreignKey: 'paymentId',
        as: 'payment',
    });
};

// ✅ INSTANCE METHODS

// Get all team members including primary contact
EventRegistration.prototype.getAllMembers = function () {
    if (this.registrationType === 'individual') {
        return [
            {
                name: this.name,
                email: this.email,
                phone: this.phone,
                studentId: this.studentId,
                userId: this.userId,
                isPrimary: true,
            },
        ];
    }

    // Team registration
    const members = [
        {
            name: this.name,
            email: this.email,
            phone: this.phone,
            studentId: this.studentId,
            userId: this.userId,
            isPrimary: true,
            role: 'Team Captain',
        },
    ];

    if (this.teamMembers && Array.isArray(this.teamMembers)) {
        this.teamMembers.forEach((member) => {
            members.push({
                ...member,
                isPrimary: false,
                role: 'Team Member',
            });
        });
    }

    return members;
};

// Get team size
EventRegistration.prototype.getTeamSize = function () {
    if (this.registrationType === 'individual') return 1;
    return 1 + (this.teamMembers ? this.teamMembers.length : 0);
};

module.exports = EventRegistration;
