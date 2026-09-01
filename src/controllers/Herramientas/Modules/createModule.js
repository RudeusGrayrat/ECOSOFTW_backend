const Module = require("../../../Models/Herramientas/Modulo");

const createModule = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Faltan datos obligatorios para crear el modulo" });
    }

    const moduleName = name.trim().toUpperCase();
    const findModule = await Module.findOne({ name: moduleName });
    if (findModule) {
      return res.status(409).json({
        message: "El modulo ya existe",
      });
    }
    const newModule = new Module({ name: moduleName });
    await newModule.save();
    return res.status(201).json({
      message: `Modulo '${moduleName}' creado exitosamente`,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = createModule;
