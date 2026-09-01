const Module = require("../../../Models/Herramientas/Modulo");
const Submodule = require("../../../Models/Herramientas/Submodulo");

const createSubmodule = async (req, res) => {
  const { name, module } = req.body;
  try {
    if (!name || !module) {
      return res.status(400).json({
        message: "Faltan datos obligatorios para crear el submodulo",
      });
    }

    const submoduleName = name.trim().toUpperCase();
    const moduleName = module.trim().toUpperCase();
    const findSubmodule = await Submodule.findOne({
      name: submoduleName,
      module: moduleName,
    });
    if (findSubmodule) {
      return res.status(409).json({
        message: `En el modulo ${moduleName} ya existe un submodulo con el nombre ${submoduleName}`,
      });
    }
    const findModule = await Module.findOne({ name: moduleName });
    if (!findModule) {
      return res.status(404).json({
        message: "El modulo no existe",
      });
    }
    const newSubmodule = new Submodule({ name: submoduleName, module: moduleName, moduleId: findModule._id });

    await newSubmodule.save();
    return res.status(201).json({
      message: `Submodulo '${submoduleName}' creado exitosamente en el modulo '${moduleName}'`,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = createSubmodule;
