const UserEcosoft = require("../../../Models/Herramientas/User");

const PatchUser = async (req, res) => {
    const { id } = req.params;
    const { userName, password, photo, modules, correoElectronico, colaborador, telefono, puesto } = req.body;

    try {
        if (!id) {
            return res.status(400).json({ message: "Falta el ID del usuario" });
        }
        const findUser = await UserEcosoft.findById(id);
        if (!findUser) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }
        if (userName) findUser.userName = userName;
        if (password) findUser.password = password;
        if (photo) findUser.photo = photo;
        if (Array.isArray(modules)) findUser.modules = modules;
        if (correoElectronico) findUser.correoElectronico = correoElectronico;
        if (colaborador) findUser.colaborador = colaborador;
        if (telefono) findUser.telefono = telefono;
        if (puesto) findUser.puesto = puesto;

        const updatedUser = await findUser.save();
        return res.status(200).json({ message: "Usuario actualizado exitosamente", data: updatedUser, type: "Correcto" });
    } catch (error) {
        return res.status(500).json({ message: error.message || "Error al actualizar el usuario" });
    }

};

module.exports = PatchUser;
