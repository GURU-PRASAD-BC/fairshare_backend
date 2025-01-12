const express = require("express");
const jwt = require("jsonwebtoken");
const { signUp, logIn, sendPasswordResetEmail, resetPassword, getLoggedInUser, updateUser, deleteUser} = require("../controllers/userControllers");
const passport = require("passport");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "jwt";

// Google Authentication Routes
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/google/callback",passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication failed" });
    }
    const token = jwt.sign({ id: req.user.userID, email: req.user.email, role: req.user.role }, JWT_SECRET, { expiresIn: "1d" });
    //res.status(200).json({ message: "Login successful", token });

     // Redirect to the frontend with the token
     const frontendURL = process.env.FRONTEND_URL || "http://192.168.0.126:3000";
     res.redirect(`${frontendURL}/home/?token=${token}`);
  }
);

// Normal Authentication Routes
router.post("/signup", signUp);
router.post("/login", logIn);

// Info Route
router.get("/me", getLoggedInUser);

 // Update User Data
router.put("/update", updateUser);
// Delete User and Related Data
router.delete("/delete", deleteUser);

// Password Reset Routes
router.post("/forgot-password", sendPasswordResetEmail);
router.post("/reset-password", resetPassword);

module.exports = router;
