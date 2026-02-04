const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class GalleryImage extends Model { }

GalleryImage.init(
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true
        },

        galleryId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false
        },

        url: {
            type: DataTypes.STRING,
            allowNull: false
        },

        caption: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: ''
        },

        uploadedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    },
    {
        sequelize,
        modelName: 'GalleryImage',
        tableName: 'gallery_images',
        timestamps: false
    }
);

module.exports = GalleryImage;
