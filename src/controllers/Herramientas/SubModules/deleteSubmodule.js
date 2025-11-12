const Submodule = require("../../models/SubModule");

const deleteSubmodule = async (req, res) => {
  const { _id } = req.body;
  try {
    const submodule = await Submodule.findById(_id);
    if (!submodule) {
      return res.status(404).json({ message: "Submodulo no encontrado" });
    }
    await Submodule.findByIdAndDelete(_id);
    return res
      .status(200)
      .json({ message: "Submodulo eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = deleteSubmodule;
