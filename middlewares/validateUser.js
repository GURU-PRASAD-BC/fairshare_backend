const prisma = require('../config/prismaClient');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'jwt';

const authenticateUser = async (req, res, next) => {
  try {
    // Check if the user is authenticated via session
    if (req.isAuthenticated() && req.user) {
      req.userID = req.user.userID; // Attach user ID from session
      return next();
    }

    // Check if the user is authenticated via JWT
    //const token = req.cookies.token; 
    const token = req.headers.authorization?.split(' ')[1]; 

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: Please log in' });
    }

    // Attach user ID from JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userID = decoded.id;
    //console.log(req.userID,decoded.id)

    const user = await prisma.user.findUnique({ where: { userID: req.userID } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    req.user = user;

    if (user.isBlocked) {
      return res.status(403).json({ message: "You are temporarily blocked from this website" });
    }

    next();
  } catch (err) {
    console.error(err);
    res.status(403).json({ message: 'Invalid token or session' });
  }
};

module.exports = authenticateUser;
