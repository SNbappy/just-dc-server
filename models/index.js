// models/index.js
const { sequelize } = require('../config/db');

// Import models
const User = require('./User');
const Event = require('./Event');
const Member = require('./Member');
const GalleryImage = require('./GalleryImage');
const Payment = require('./Payment');
const EventRegistration = require('./EventRegistration');
const Certificate = require('./Certificate'); // ✅ ADD THIS

// =====================================================
// ASSOCIATIONS
// =====================================================

// Event → User (creator)
Event.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
User.hasMany(Event, { foreignKey: 'createdBy', as: 'createdEvents' });

// GalleryImage → User (uploader)
GalleryImage.belongsTo(User, { foreignKey: 'uploadedBy', as: 'uploader' });
User.hasMany(GalleryImage, { foreignKey: 'uploadedBy', as: 'uploadedImages' });

// Payment → User
Payment.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Payment, { foreignKey: 'userId', as: 'payments' });

// Payment → Event
Payment.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });
Event.hasMany(Payment, { foreignKey: 'eventId', as: 'payments' });

// EventRegistration → Event
EventRegistration.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });
Event.hasMany(EventRegistration, { foreignKey: 'eventId', as: 'registrations' });

// EventRegistration → User (optional - for logged-in users)
EventRegistration.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(EventRegistration, { foreignKey: 'userId', as: 'registrations' });

// EventRegistration → Payment
EventRegistration.belongsTo(Payment, { foreignKey: 'paymentId', as: 'payment' });
Payment.hasOne(EventRegistration, { foreignKey: 'paymentId', as: 'registration' });

// ✅ CERTIFICATE ASSOCIATIONS
// Certificate → Event
Certificate.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });
Event.hasMany(Certificate, { foreignKey: 'eventId', as: 'certificates' });

// Certificate → User (recipient)
Certificate.belongsTo(User, { foreignKey: 'userId', as: 'recipient' });
User.hasMany(Certificate, { foreignKey: 'userId', as: 'certificates' });

// Certificate → User (issuer)
Certificate.belongsTo(User, { foreignKey: 'issuedBy', as: 'issuer' });
User.hasMany(Certificate, { foreignKey: 'issuedBy', as: 'issuedCertificates' });

module.exports = {
    sequelize,
    User,
    Event,
    Member,
    GalleryImage,
    Payment,
    EventRegistration,
    Certificate, // ✅ EXPORT THIS
};