const bcrypt = require("bcrypt");
const prisma = require("../config/prisma");
const { generateToken } = require("../utils/jwt");

// ------------------- REGISTER -------------------
exports.register = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        password: hash,
        role: "student",
      },
    });

    // ✅ GENERATE TOKEN (same as login)
    const token = generateToken({ id: user.id, role: user.role });

    // ✅ SET COOKIE (same as login)
    res.cookie("token", token, {
  httpOnly: true,
  secure: true,        // ✅ REQUIRED for HTTPS (Render)
  sameSite: "none",    // ✅ REQUIRED for cross-site
  maxAge: 1000 * 60 * 60 * 2,
});

    // ✅ RESPONSE
    res.status(201).json({
      message: "User registered & logged in",
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (error) {
    // ✅ Handle duplicate username cleanly
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Username already exists" });
    }

    res.status(500).json({ error: error.message });
  }
};

// ------------------- LOGIN -------------------
// authController.js
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Wrong password" });

    const token = generateToken({ id: user.id, role: user.role });

    // ✅ Set token cookie
   res.cookie("token", token, {
  httpOnly: true,
  secure: true,        // ✅ REQUIRED for HTTPS (Render)
  sameSite: "none",    // ✅ REQUIRED for cross-site
  maxAge: 1000 * 60 * 60 * 2,
});

    // Also return a message if you want
    res.json({ message: "Logged in successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ------------------- LOGOUT -------------------
exports.logout = async (req, res) => {
  try {
    // Clear the cookie to log out
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ------------------- GET CURRENT USER -------------------
exports.getMe = async (req, res) => {
  try {
    // authMiddleware must be applied on this route
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, role: true }, // only safe fields
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
