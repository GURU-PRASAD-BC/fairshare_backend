require("dotenv").config(); 
const express = require("express");
const session = require('express-session');
const cookieParser = require("cookie-parser");
const passport = require('passport');
require('./config/passportSetup');
const cors = require("cors");
const morgan = require("morgan"); 
const http = require("http");
const { setupWebSocket } = require("./config/socketServer");
const prisma = require("./config/prismaClient"); 
const userRoutes = require("./routes/userRoutes");
const groupRoutes = require('./routes/groupRoutes');
const friendRoutes = require("./routes/friendRoutes");
const expenseRoutes = require('./routes/expenseRoutes');
const activityRoutes = require("./routes/activityRoutes");
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Middleware
app.use(express.json()); 
app.use(cors({
  origin:'*',
  credentials: true,
}));        
app.use(cookieParser());
app.use(session({ secret: process.env.SESSION_SECRET || 'secret',
   resave: false, 
   saveUninitialized: true,
   cookie: { secure: false }
})); 

// Logging
app.use(morgan("dev"));  

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Setup HTTP server
const server = http.createServer(app);

// Initialize WebSocket & middleware for passing the io
const io = setupWebSocket(server);
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Use routes
app.use('/auth', userRoutes);
app.use('/group', groupRoutes);
app.use("/friend", friendRoutes);
app.use('/expense', expenseRoutes);
app.use("/activities", activityRoutes);
app.use('/admin', adminRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// Start Server with WebSocket
const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  try {
    await prisma.$connect();
    console.log(`Server is running on http://localhost:${PORT}`);
  } catch (error) {
    console.error("Failed to connect to the database:", error);
    process.exit(1); 
  }
});
