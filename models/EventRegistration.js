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

        // ✅ NEW: Public registration ID
        registrationId: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false,
            comment: 'Public-facing registration ID (e.g., REG-xxx)',
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

        // ✅ Category Info
        categoryId: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Category ID from event.registrationCategories',
        },

        categoryName: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        // ✅ Source tracking
        source: {
            type: DataTypes.ENUM('public', 'admin'),
            defaultValue: 'public',
        },

        // ✅ Registration type (individual or team)
        registrationType: {
            type: DataTypes.ENUM('individual', 'team'),
            allowNull: false,
            defaultValue: 'individual',
        },

        // ✅ Team information (for debate teams)
        teamName: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
            comment: 'Name of the debate team (if registrationType is team)',
        },

        // ✅ Team members array (for team registrations)
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

        // ✅ Custom Fields
        customFieldsData: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: null,
            comment: 'Dynamic custom field responses',
        },

        // fee snapshot
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0,
        },

        // registration flow
        status: {
            type: DataTypes.ENUM('pending_payment', 'confirmed', 'cancelled', 'waitlisted', 'rejected'),
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

        // ✅ Guest Tracking
        verificationToken: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: null,
            comment: 'JWT token for guest registration tracking',
        },

        // ✅ PDF Receipt
        pdfReceiptUrl: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },

        // ✅ Certificate tracking
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

        // ✅ Additional metadata
        notes: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: null,
            comment: 'Admin notes or special requests',
        },

        // ✅ Achievement/award tracking
        achievement: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
            comment: 'e.g., Winner, Runner-up, Best Speaker, etc.',
        },

        // ✅ Timestamps
        confirmedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
        },

        cancelledAt: {
            type: DataTypes.DATE,
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
            { fields: ['registrationType'] },
            { fields: ['status'] },
            { fields: ['registrationId'], unique: true },
            { fields: ['categoryId'] },
        ],
    }
);

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
