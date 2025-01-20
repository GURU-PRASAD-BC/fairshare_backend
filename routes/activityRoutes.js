const express = require("express");
const router = express.Router();
const {getUserActivities, logActivity} = require("../controllers/activityController");
const authenticateUser = require('../middlewares/validateUser');

// Get recent activities for a user
router.get("/",authenticateUser,getUserActivities);
// Log a new activity (can be used internally for different actions like adding expenses or in groups)
router.post("/log",authenticateUser,logActivity);

module.exports = router;
