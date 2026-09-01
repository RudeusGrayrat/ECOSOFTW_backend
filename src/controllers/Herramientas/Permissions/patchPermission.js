const Permissions = require("../../../Models/Herramientas/Permission");

const patchPermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, active, estado } = req.body;
    const findPermission = await Permissions.findById(id);

    if (!findPermission) {
      return res.status(404).json({ message: "Permiso no encontrado" });
    }

    if (description !== undefined) findPermission.description = description;
    if (active !== undefined) findPermission.active = active;
    if (estado) findPermission.active = estado === "ACTIVO";

    await findPermission.save();
    res.status(200).json({ message: "Permiso actualizado correctamente", type: "Correcto" });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el permiso", error });
  }
};

module.exports = patchPermission;
