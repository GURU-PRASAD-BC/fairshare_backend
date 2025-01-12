const express = require("express");
const router = express.Router();
const {getUserActivities, logActivity} = require("../controllers/activityController");

// Get recent activities for a user
router.get("/",getUserActivities);
// Log a new activity (can be used internally for different actions like adding expenses or groups)
router.post("/log",logActivity);

module.exports = router;
