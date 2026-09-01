const Permissions = require("../../../Models/Herramientas/Permission");

const postPermissions = async (req, res) => {
  const { name, description } = req.body;
  try {
    if (!name) {
      return res.status(400).json({ message: "Faltan datos obligatorios para crear el permiso" });
    }

    const permissionName = name.trim().toUpperCase();
    const existingPermission = await Permissions.findOne({ name: permissionName });
    if (existingPermission) {
      return res.status(409).json({ message: `El permiso '${permissionName}' ya existe` });
    }
    const newPermission = new Permissions({ name: permissionName, description });
    await newPermission.save();
    return res.status(201).json({
      message: `Permiso '${permissionName}' creado exitosamente`,
      permission: newPermission,
    });
  } catch (error) {
    res.status(500).json({ message: "Error del servidor", error });
  }
};
module.exports = postPermissions;
