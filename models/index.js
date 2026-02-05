// models/index.js
const { sequelize } = require('../config/db');

// Import all models
const User = require('./User');
const Event = require('./Event');
const EventRegistration = require('./EventRegistration');
const Payment = require('./Payment');
const GalleryImage = require('./GalleryImage');
const EmailLog = require('./EmailLog'); // ✅ ADD THIS LINE

// Collect all models
const models = {
    User,
    Event,
    EventRegistration,
    Payment,
    GalleryImage,
    EmailLog,
};

// ✅ Initialize associations
Object.keys(models).forEach((modelName) => {
    if (models[modelName].associate) {
        models[modelName].associate(models);
    }
});

module.exports = {
    sequelize,
    ...models,
};
