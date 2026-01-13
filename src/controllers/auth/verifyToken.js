const jwt = require("jsonwebtoken");
const UserEcosoft = require("../../Models/Herramientas/User");
const { JWT_SECRET } = process.env;

const verifyToken = async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  try {
    if (token) {
      jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) {
          if (err.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Token expirado" });
          }
          return res.status(403).json({ message: "Token no válido" });
        }
        const userFound = await UserEcosoft.findById(user._id);
        if (!userFound) {
          return res
            .status(401)
            .json({ message: "No se encuentra este usuario" });
        }
        const userData = userFound.toObject();
        delete userData.password;
        return res.status(200).json(userData);
      });
    } else {
      return res.status(401).json({
        message: "No hay token ",
      });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
module.exports = verifyToken;
