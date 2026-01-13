const Module = require("../../../Models/Herramientas/Modulo");

const deleteModule = async (req, res) => {
  const { id } = req.params;
  try {
    const module = await Module.findById(id);
    if (!module) {
      return res.status(404).json({ message: "Modulo no encontrado" });
    }
    await Module.findByIdAndDelete(id);
    return res.status(200).json({ message: "Modulo eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
module.exports = deleteModule;
