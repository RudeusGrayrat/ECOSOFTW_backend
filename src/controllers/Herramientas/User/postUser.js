const UserEcosoft = require("../../../Models/Herramientas/User");
const { hashPassword } = require("../../auth/bcrypt");

const postUsuariosEcosoft = async (req, res) => {
  const { userName, password, photo, modules, correoElectronico, colaborador, telefono, puesto } = req.body;
  try {
    if (!userName || !password || !Array.isArray(modules)) {
      return res.status(400).json({ message: "Faltan datos obligatorios" });
    }
    const hashedPassword = await hashPassword(password);
    const findUsuario = await UserEcosoft.findOne({ userName });
    if (findUsuario) {
      return res
        .status(409)
        .json({ message: "El nombre de usuario ya existe" });
    }
    if (!hashedPassword) {
      return res
        .status(500)
        .json({ message: "Error al hashear la contraseña" });
    }
    const newUser = new UserEcosoft({
      userName,
      password: hashedPassword,
      photo,
      modules,
      correoElectronico,
      colaborador,
      telefono,
      puesto
    });
    await newUser.save();
    res
      .status(201)
      .json({ message: "Usuario creado exitosamente", user: newUser });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Error al crear el usuario" });
  }
};
module.exports = postUsuariosEcosoft;
