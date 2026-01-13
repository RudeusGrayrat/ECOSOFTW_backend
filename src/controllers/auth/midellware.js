const jwt = require("jsonwebtoken");
const UserEcosoft = require("../../Models/Herramientas/User");
const { JWT_SECRET } = process.env;

// Rutas públicas que NO necesitan token
const publicRoutes = ["/api/login", "/api/recepcionBoleta"];

const tokenVerify = async (req, res, next) => {
  // const authHeader = req.headers.authorization;
  // const token =
  //   req.cookies?.token ||
  //   (authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null);

  // // Permitir rutas públicas
  // if (publicRoutes.some((route) => req.path.startsWith(route))) {
  //   return next();
  // }

  // // No hay token
  // if (!token) {
  //   return res.status(401).json({ message: "No hay token" });
  // }

  try {
    // // Verificar el token
    // const decoded = jwt.verify(token, JWT_SECRET);
    // console.log("Token decodificado:", decoded);

    // // Buscar usuario según lo que guardaste en el token (email, userName, _id, etc)
    // const userFound = await UserEcosoft.findById(decoded._id).select(
    //   "-password"
    // );
    // if (!userFound) {
    //   return res.status(401).json({ message: "No se encuentra este usuario" });
    // }

    // // Guardar usuario en req para usarlo en controladores
    // req.user = userFound;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expirado" });
    }
    return res.status(403).json({ message: "Token no válido" });
  }
};

module.exports = tokenVerify;
