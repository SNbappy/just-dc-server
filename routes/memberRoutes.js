const express = require('express');
const router = express.Router();

const {
    getAllMembers,
    getMember,
    createMember,
    updateMember,
    deleteMember,
} = require('../controllers/memberController');

const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Public routes
router.get('/', getAllMembers);
router.get('/:id', getMember);

// Management routes
router.post(
    '/',
    protect,
    authorize('admin', 'president', 'general_secretary'),
    upload.single('image'),
    createMember
);

router.put(
    '/:id',
    protect,
    authorize('admin', 'president', 'general_secretary'),
    upload.single('image'),
    updateMember
);

router.delete(
    '/:id',
    protect,
    authorize('admin', 'president', 'general_secretary'),
    deleteMember
);

module.exports = router;
