const jwt = require("jsonwebtoken");
const User = require("../../Models/Herramientas/User");

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.cookies?.token;
  if (!token) return res.status(401).json({ message: "No hay token" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded._id).select("-password");
    if (!user) return res.status(401).json({ message: "Usuario no encontrado" });
    req.user = user;
    next();
  } catch (_) {
    return res.status(401).json({ message: "Token no válido o expirado" });
  }
};
