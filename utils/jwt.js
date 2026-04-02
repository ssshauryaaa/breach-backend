const jwt = require("jsonwebtoken");

const SECRET = "breachtrix_secret";

function generateToken(user) {
  return jwt.sign(user, SECRET, { expiresIn: "6h" });
}

module.exports = { generateToken, SECRET };
