const Permissions = require("../../../models/Herramientas/Permission");

const getPermissions = async (req, res) => {
    try {

        const permissionsFound = await Permissions.find();
        return res.status(201).json(
            permissionsFound
        );
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}
module.exports = getPermissions