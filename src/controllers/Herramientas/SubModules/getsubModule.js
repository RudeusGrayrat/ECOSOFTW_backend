const Submodule = require("../../models/SubModule");

const getSubModules = async (req, res) => {
  try {
    const subModules = await Submodule.find();
    return res.status(200).json(subModules);
  } catch (error) {
    return res.status(500).json({ message: error });
  }
};
module.exports = getSubModules;
