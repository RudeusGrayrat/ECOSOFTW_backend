const Permissions = require("../../../models/Herramientas/Permission");

const postPermissions = async (req, res) => {
  const { name, description } = req.body;
  try {
    const existingPermission = await Permissions.findOne({ name });
    if (existingPermission) {
      return res.status(400).json({ message: `El permiso '${name}' ya existe` });
    }
    const newPermission = new Permissions({ name, description });
    await newPermission.save();
    return res.status(201).json({
      message: `Permiso '${name}' creado exitosamente`,
      permission: newPermission,
    });
  } catch (error) {
    res.status(500).json({ message: "Error del servidor", error });
  }
};
module.exports = postPermissions;
