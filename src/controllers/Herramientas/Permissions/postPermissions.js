const Permissions = require("../../../Models/Herramientas/Permission");

const postPermissions = async (req, res) => {
  const { name, description } = req.body;
  try {
    const newPermission = new Permissions({ name, description });
    await newPermission.save();
    return res.status(201).json({
      message: "Permiso creado exitosamente",
      permission: newPermission,
    });
  } catch (error) {
    res.status(500).json({ message: "Error del servidor", error });
  }
};
module.exports = postPermissions;
