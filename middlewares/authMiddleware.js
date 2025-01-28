// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

exports.isAdmin = (req, res, next) => {
  const token = req.cookies.token; 
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided, authorization denied' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user data to request object
    
    // Check if user is an admin
    if (req.user.role === 'ADMIN') {
      next();
    } else {
      res.status(403).json({ message: 'Access denied, admin only' });
    }
  } catch (error) {
    res.status(401).json({ message: 'Invalid token, authorization denied' });
  }
};


// const prisma = require("../config/prismaClient");
// const jwt = require("jsonwebtoken");

// const isAuthenticated = async (req, res, next) => {
//   const token = req.headers.authorization?.split(" ")[1];

//   if (!token) {
//     return res.status(401).json({ message: "Unauthorized!" });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const user = await prisma.user.findUnique({ where: { userID: decoded.userID } });

//     if (!user) {
//       return res.status(401).json({ message: "Unauthorized!" });
//     }

//     req.user = user;
//     next();
//   } catch (error) {
//     console.error(error);
//     res.status(401).json({ message: "Unauthorized!" });
//   }
// };

// module.exports = { isAuthenticated };
