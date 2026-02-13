const Comercial_Proyectos = require("../../../Models/Comercial/Proyectos");

const deleteProyecto = async (req, res) => {
    try {
        const { id } = req.params;
        const findProyecto = await Comercial_Proyectos.findById(id);
        if (!findProyecto) {
            return res
                .status(404)
                .json({ message: "Proyecto no encontrado", type: "Error" });
        }
        await Comercial_Proyectos.findByIdAndDelete(id);
        return res
            .status(200)
            .json({ message: "Proyecto eliminado correctamente", type: "Success" });
    } catch (error) {
        console.error("Error al eliminar el proyecto:", error);
        return res.status(500).json({
            message: "Error del servidor al eliminar el proyecto",
            type: "Error",
        });
    }
};

module.exports = deleteProyecto;