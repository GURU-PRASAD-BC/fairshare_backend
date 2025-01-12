const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {sendMail} = require("../utils/mailer");
const prisma = require("../config/prismaClient");
const { signUpSchema, signInSchema } = require("../utils/schemaValidation");

const JWT_SECRET = process.env.JWT_SECRET || "jwt";
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || "5");
const frontendURL = process.env.FRONTEND_URL || "http://192.168.0.126:3000";

// Utility to generate JWT token
const generateJWT = (user) => {
  // console.log({ id: user.userID, email: user.email, role: user.role })
  return jwt.sign({ id: user.userID, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
};

// User Sign-Up
exports.signUp = async (req, res) => {
  try {
    const { error } = signUpSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { name, email, password, profileImage,phone } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ message: "Email is already registered." });

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const defaultProfileImage = "https://s3.amazonaws.com/splitwise/uploads/user/default_avatars/avatar-ruby39-200px.png";

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        image: profileImage || defaultProfileImage, 
        phone:phone,
      },
    });

    res.status(201).json({ message: "User registered successfully", user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// User Sign-In
exports.logIn = async (req, res) => {
  try {
    const { error } = signInSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: "Invalid email or password" });

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) return res.status(404).json({ message: "Invalid email or password" });

    const token = generateJWT(user);
    res.status(200).json({ message: "Login successful", token});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

//GetInfo
exports.getLoggedInUser = async (req, res) => {
  try {
    // Get token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization token is missing or invalid" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { userID: decoded.id },
      select: { userID: true, name: true, email: true, image: true, role: true }, 
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching logged-in user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

//Update the user
exports.updateUser = async (req, res) => {
  try {
    const { name, password, image, phone } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization token is missing or invalid" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const updateData = {};
    if (name) updateData.name = name;
    if (password) updateData.password = await bcrypt.hash(password, SALT_ROUNDS);
    if (image) updateData.image = image;
    if (phone) updateData.phone = phone;

    const updatedUser = await prisma.user.update({
      where: { userID: decoded.id },
      data: updateData,
    });

    res.status(200).json({ message: "User updated successfully", user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Delete User and related Deletion
exports.deleteUser = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization token is missing or invalid" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const userId = decoded.id;

    // Delete all related entities
    await prisma.$transaction([
      prisma.friends.deleteMany({ where: { OR: [{ userID: userId }, { friendID: userId }] } }),
      prisma.groupMember.deleteMany({ where: { userID: userId } }),
      prisma.expenses.deleteMany({ where: { paidBy: userId } }),
      prisma.expenseSplit.deleteMany({ where: { userID: userId } }),
      prisma.balances.deleteMany({ where: { OR: [{ userID: userId }, { friendID: userId }] } }),
      prisma.activities.deleteMany({ where: { userID: userId } }),
      prisma.group.deleteMany({ where: { createdBy: userId } }),
      prisma.user.delete({ where: { userID: userId } }),
    ]);

    res.status(200).json({ message: "User and related data deleted successfully" });
  } catch (error) {
    console.error("Error deleting user and related data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


// Send Password Reset Email
exports.sendPasswordResetEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const resetToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "1h" });

    const resetLink = `${frontendURL}/auth/reset-password?token=${resetToken}`;

    const mail= email;
    const subject= "Password Reset Request";
    const html= `
      <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            background-color: #f7f7f7;
            color: #333;
        }
        .container {
            max-width: 600px;
            margin: 30px auto;
            padding: 20px;
            background-color: #fff;
            border: 1px solid #ddd;
            border-radius: 5px;
            text-align: center;
        }
        .header {
            margin-bottom: 20px;
        }
        .header img {
            width: 150px;
            height: auto;
        }
        .content {
            text-align: left;
            margin-bottom: 30px;
            text-align: center;
        }
        .content a {
            color: #007bff;
            text-decoration: none;
        }
        .content a:hover {
            text-decoration: underline;
        }
        .footer {
            font-size: 12px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Password Reset Link</h2>
        </div>
        <div class="content">
            <p>Click <a href="${resetLink}">here</a> to reset your password. This link will expire in 1 hour.</p>
        </div>
        <div class="footer">
            <p>If you did not request this password reset, please ignore this email.</p>
        </div>
    </div>
</body>
      `
    await sendMail(mail,subject,html);

    res.status(200).json({ message: "Password reset email sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const decoded = jwt.verify(token, JWT_SECRET);

    // console.log('Received Token-',token); 
    // console.log('Received Password-',password);

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    await prisma.user.update({
      where: { email: decoded.email },
      data: { password: hashedPassword },
    });

    res.status(200).json({ message: "Password updated successfully" });
    // res.redirect(`${frontendURL}/auth/login`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Invalid or expired token" });
  }
};

