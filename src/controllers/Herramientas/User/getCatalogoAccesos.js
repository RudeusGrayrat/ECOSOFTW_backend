const Module = require("../../../Models/Herramientas/Modulo");
const Submodule = require("../../../Models/Herramientas/Submodulo");
const Permission = require("../../../Models/Herramientas/Permission");

const getCatalogoAccesos = async (req, res) => {
  try {
    const [modules, submodules, permissions] = await Promise.all([
      Module.find({ active: { $ne: false } }).lean().sort({ order: 1, name: 1 }),
      Submodule.find({ active: { $ne: false } }).lean().sort({ module: 1, order: 1, name: 1 }),
      Permission.find({ active: { $ne: false } }).lean().sort({ name: 1 }),
    ]);

    return res.status(200).json({ modules, submodules, permissions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = getCatalogoAccesos;
