const Module = require("../../../models/Herramientas/Modulo");

const getModules = async (req, res) => {
  try {
    const modules = await Module.find();
    return res.status(200).json(modules);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
module.exports = getModules;
