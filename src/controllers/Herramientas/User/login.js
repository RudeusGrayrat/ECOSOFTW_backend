const { compare } = require("bcrypt");
const UserEcosoft = require("../../../Models/Herramientas/User");
const generatetoken = require("../../auth/jwt");

const login = async (req, res) => {
  const { userName, password } = req.body;

  try {
    if (!userName || !password) {
      return res.status(400).json({ message: "Falta userName o password" });
    }
    const user = await UserEcosoft.findOne({ userName });

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    const isMatch = await compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Contraseña incorrecta" });
    }

    const userData = user.toObject();
    delete userData.password;
    const token = generatetoken(userData);

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
    });

    return res.status(200).json({
      data: userData,
      token: token,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = login;
