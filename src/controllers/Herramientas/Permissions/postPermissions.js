const Permissions = require("../../../Models/Herramientas/Permission");

const postPermissions = async (req, res) => {
  const { name, description } = req.body;
  try {
    const newPermission = new Permissions({ name, description });
    await newPermission.save();
    return res.status(201).json({
      message: "Permission created successfully",
      permission: newPermission,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
module.exports = postPermissions;
