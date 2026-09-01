const Module = require("../../../Models/Herramientas/Modulo");
const Submodule = require("../../../Models/Herramientas/Submodulo");

const patchModuloYSubmodulo = async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, module, name, order, estado } = req.body;
    const isModule = tipo === "MODULO";
    const record = isModule ? await Module.findById(id) : await Submodule.findById(id);

    if (!record) {
      return res.status(404).json({ message: "Registro no encontrado" });
    }

    if (isModule && module) record.name = module.trim().toUpperCase();
    if (!isModule && module) {
      const findModule = await Module.findOne({ name: module.trim().toUpperCase() });
      if (!findModule) return res.status(404).json({ message: "El modulo no existe" });
      record.module = module.trim().toUpperCase();
      record.moduleId = findModule._id;
    }
    if (!isModule && name !== undefined) record.name = name.trim().toUpperCase();
    if (order !== undefined) record.order = Number(order) || 0;
    if (estado) record.active = estado === "ACTIVO";

    await record.save();
    res.status(200).json({ message: "Registro actualizado correctamente", type: "Correcto" });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el registro", error });
  }
};

module.exports = patchModuloYSubmodulo;
