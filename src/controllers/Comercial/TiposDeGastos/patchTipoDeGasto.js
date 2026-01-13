const Comercial_TiposDeGastos = require("../../../Models/Comercial/TipoDeGastos");

const patchTipoDeGasto = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            tipoDeGasto, descripcion, precio, estado
        } = req.body;
        const findtipoDeGasto = await Comercial_TiposDeGastos.findById(id);

        if (!findtipoDeGasto) {
            return res.status(404).json({ message: "Tipo de gasto no encontrado" });
        }

        if (tipoDeGasto) findtipoDeGasto.tipoDeGasto = tipoDeGasto;
        if (descripcion) findtipoDeGasto.descripcion = descripcion;
        if (precio) findtipoDeGasto.precio = precio;
        if (estado) findtipoDeGasto.estado = estado;
        await findtipoDeGasto.save();
        res.status(200).json({ message: "Tipo de gasto actualizado correctamente", type: "Correcto" });
    } catch (error) {
        res.status(500).json({ message: "Error al actualizar el tipo de gasto", error });
    }
};

module.exports = patchTipoDeGasto;