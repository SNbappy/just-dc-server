const express = require('express');
const router = express.Router();
const {
    getAllMembers,
    getMember,
    createMember,
    updateMember,
    deleteMember,
} = require('../controllers/memberController');
const { protect, admin } = require('../middleware/auth');
const upload = require('../middleware/uploadMiddleware');

// Public routes
router.get('/', getAllMembers);
router.get('/:id', getMember);

// Admin routes
router.post('/', protect, admin, upload.single('image'), createMember);
router.put('/:id', protect, admin, upload.single('image'), updateMember);
router.delete('/:id', protect, admin, deleteMember);

module.exports = router;
