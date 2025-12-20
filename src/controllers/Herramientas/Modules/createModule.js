const Module = require("../../../Models/Herramientas/Modulo");

const createModule = async (req, res) => {
  try {
    const { name } = req.body;
    const findModule = await Module.findOne({ name });
    if (findModule) {
      return res.status(409).json({
        message: "El modulo ya existe",
      });
    }
    const newModule = new Module({ name });
    await newModule.save();
    return res.status(201).json({
      message: `Modulo '${name}' creado exitosamente`,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({ message: error.message });
  }
};

module.exports = createModule;
