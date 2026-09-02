const jwt = require("jsonwebtoken");
const User = require("../../Models/Herramientas/User");

const attachUser = async (req, _res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.cookies?.token;
  if (!token || !process.env.JWT_SECRET) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded._id).select("-password");
  } catch (_) {
    req.user = null;
  }

  next();
};

module.exports = attachUser;
