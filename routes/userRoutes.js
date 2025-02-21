const express = require("express");
const jwt = require("jsonwebtoken");
const { signUp, logIn, sendPasswordResetEmail, resetPassword, getLoggedInUser, updateUser, deleteUser, inviteFriend, addFeedback } = require("../controllers/userControllers");
const passport = require("passport");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "jwt";

// Google Authentication Routes
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/google/callback",passport.authenticate("google", { failureRedirect: `${process.env.FRONTEND_URL }/login` }),
  (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication failed" });
    }
     // Redirect to the frontend with the token
     const frontendURL = process.env.FRONTEND_URL || "http://192.168.0.126:3000";

     if (req.user.isBlocked) {
      return  res.redirect(`${frontendURL}/auth/login/?userBlocked=true`);
    }

    const token = jwt.sign({ id: req.user.userID, email: req.user.email, role: req.user.role }, JWT_SECRET, { expiresIn: "1d" });
    //res.status(200).json({ message: "Login successful", token });

    // //httpOnly cookie
    // res.cookie("token", token, {
    //   httpOnly: true,
    //   secure: false, 
    //   sameSite: "None",
    //   maxAge: 24 * 60 * 60 * 1000, 
    //   });
    // res.redirect(`${frontendURL}/redirectPage/`);

    res.redirect(`${frontendURL}/redirectPage/?token=${token}`);
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

// Send Friend Invitation
router.post("/invite-friend", inviteFriend);
// Add Feedback
router.post("/feedback", addFeedback);

//logout
router.post("/logout", (req, res) => {
      res.clearCookie("token", {
        httpOnly: true,
        secure:true,
        sameSite: "Strict",
      });
      res.status(200).json({ message: "Logged out successfully" });
    }
);

module.exports = router;
