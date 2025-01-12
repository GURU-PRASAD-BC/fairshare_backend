const express = require("express");
const router = express.Router();
const { addFriend, getFriends, removeFriend } = require("../controllers/friendController");
//const { isAuthenticated } = require("../middlewares/authMiddleware");
const validateUser = require('../middlewares/validateUser'); // Middleware for user validation

// Add a friend by email
router.post("/add", validateUser, addFriend);
// Get list of friends
router.get("/", validateUser, getFriends);
// Remove a friend
router.delete("/remove/:friendID", validateUser, removeFriend);

module.exports = router;
