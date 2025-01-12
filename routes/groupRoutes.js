const express = require('express');
const {
  createGroup,
  editGroup,
  deleteGroup,
  viewGroupDetails,
  viewUserGroups
} = require('../controllers/groupController');
const validateUser = require('../middlewares/validateUser'); // Middleware for user validation

const router = express.Router();

// Create a new group
router.post('/create', validateUser, createGroup);
// Edit an existing group
router.put('/:groupID/edit', validateUser, editGroup);
// Delete a group
router.delete('/:groupID', validateUser, deleteGroup);
// View group details
router.get('/:groupID/details', validateUser, viewGroupDetails);
// View all groups related to the user
router.get('/user/groups', validateUser, viewUserGroups);

module.exports = router;
