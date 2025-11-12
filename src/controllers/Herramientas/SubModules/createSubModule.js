const Module = require("../../../Models/Herramientas/Modulo");
const Submodule = require("../../../Models/Herramientas/Submodulo");

const createSubmodule = async (req, res) => {
  const { name, module } = req.body;
  try {
    const findSubmodule = await Submodule.findOne({
      name: name,
      module: module,
    });
    if (findSubmodule) {
      return res.status(409).json({
        message: `En el modulo ${module} ya existe un submodulo con el nombre ${name}`,
      });
    }
    const findModule = await Module.findOne({ name: module });
    if (!findModule) {
      return res.status(404).json({
        message: "El modulo no existe",
      });
    }
    const newSubmodule = new Submodule({ name, module });

    await newSubmodule.save();
    return res.status(200).json({
      message: "Submodulo creado correctamente",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = createSubmodule;
