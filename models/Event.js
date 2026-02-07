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

        // Legacy image field (keep for backward compatibility)
        image: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },

        status: {
            type: DataTypes.ENUM('upcoming', 'ongoing', 'completed', 'cancelled'),
            allowNull: false,
            defaultValue: 'upcoming',
        },

        // public vs inter-club
        accessType: {
            type: DataTypes.ENUM('public', 'inter_club'),
            allowNull: false,
            defaultValue: 'public',
        },

        // fee for event registration (0 = free)
        registrationFee: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },

        // enable/disable registration
        registrationOpen: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },

        // ✅ NEW: Allow team registration for this event
        allowTeamRegistration: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Enable team registrations for debate competitions',
        },

        // ✅ NEW: Team size constraints
        minTeamSize: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 2,
            comment: 'Minimum team members (including captain)',
        },

        maxTeamSize: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 3,
            comment: 'Maximum team members (including captain)',
        },

        // ✅ NEW: Registration categories for this event
        // Example: [{ name, type, price, capacity, accessType, teamMin, teamMax }]
        categories: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: [],
            comment: 'Registration categories (Debater, Adjudicator, etc.)',
        },

        // ✅ UPDATED: Team members structure
        // Structure: [
        //   {
        //     type: 'internal' | 'external',
        //     role: 'organizer' | 'volunteer' | 'core_adjudicator' | 'tab_team' | 'speaker' | 'guest',
        //     userId: number (if internal),
        //     name: string (if external),
        //     email: string (REQUIRED for certificates),
        //     designation: string (optional),
        //     org: string (optional),
        //     certificateIssued: boolean,
        //     credentialId: string,
        //     certificateIssuedAt: date
        //   }
        // ]
        participants: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: [],
            comment:
                'Event team members (organizers, volunteers, speakers, etc.) - MUST include email for certificates',
        },

        // ✅ NEW: Event format/rules
        eventFormat: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: null,
            comment: 'Event format, rules, or additional information',
        },

        // ✅ NEW: Certificate template
        certificateTemplate: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: 'default',
            comment: 'Certificate template to use for this event',
        },

        // ✅ NEW: Banner/cover image
        bannerImage: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
            comment: 'Main banner/cover image for the event',
        },

        // ✅ NEW: Event highlights/achievements
        highlights: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: null,
            comment: 'Event highlights, achievements, or summary after completion',
        },

        // ✅ NEW: Prize information
        prizes: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: null,
            comment: 'Prize information for competitions: [{position, prize, amount}]',
        },

        // ✅ NEW: Registration deadline
        registrationDeadline: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
            comment: 'Last date to register for the event',
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
            { fields: ['status'] },
            { fields: ['category'] },
            { fields: ['date'] },
            { fields: ['accessType'] },
            { fields: ['registrationOpen'] },
        ],
    }
);

// ✅ ASSOCIATIONS
Event.associate = function (models) {
    // Event has many EventRegistrations
    Event.hasMany(models.EventRegistration, {
        foreignKey: 'eventId',
        as: 'registrations',
    });

    // Event belongs to User (creator)
    Event.belongsTo(models.User, {
        foreignKey: 'createdBy',
        as: 'creator',
    });
};

// ✅ INSTANCE METHODS

// Check if registration is open
Event.prototype.isRegistrationOpen = function () {
    if (!this.registrationOpen) return false;

    if (this.registrationDeadline) {
        return new Date() < new Date(this.registrationDeadline);
    }

    // Also check if event date has passed
    return new Date() < new Date(this.date);
};

// Check if registration is full
Event.prototype.isRegistrationFull = async function () {
    if (!this.maxParticipants) return false;

    const EventRegistration = require('./EventRegistration');
    const count = await EventRegistration.count({
        where: {
            eventId: this.id,
            status: 'confirmed',
        },
    });

    return count >= this.maxParticipants;
};

// Get participant by userId or email
Event.prototype.getParticipant = function (identifier) {
    if (!this.participants || !Array.isArray(this.participants)) return null;

    return this.participants.find((p) => {
        if (typeof identifier === 'number') {
            return p.type === 'internal' && p.userId === identifier;
        }
        return p.email && p.email.toLowerCase() === identifier.toLowerCase();
    });
};

// Get participants by role
Event.prototype.getParticipantsByRole = function (role) {
    if (!this.participants || !Array.isArray(this.participants)) return [];

    return this.participants.filter((p) => p.role === role);
};

// Get all organizers
Event.prototype.getOrganizers = function () {
    return this.getParticipantsByRole('organizer');
};

// Get all volunteers
Event.prototype.getVolunteers = function () {
    return this.getParticipantsByRole('volunteer');
};

// Get all adjudicators
Event.prototype.getAdjudicators = function () {
    return this.getParticipantsByRole('core_adjudicator');
};

// Check if user is team member
Event.prototype.isTeamMember = function (userId) {
    if (!this.participants || !Array.isArray(this.participants)) return false;

    return this.participants.some((p) => p.type === 'internal' && p.userId === userId);
};

// Get team member role
Event.prototype.getTeamMemberRole = function (userId) {
    const participant = this.participants?.find(
        (p) => p.type === 'internal' && p.userId === userId
    );
    return participant?.role || null;
};

module.exports = Event;