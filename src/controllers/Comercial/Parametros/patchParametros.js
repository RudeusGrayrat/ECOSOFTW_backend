const Comercial_Parametros = require("../../../Models/Comercial/Parametros");

const patchParametro = async (req, res) => {
    const { id } = req.params;
    const { tipoDeAnalisis, categoria, parametro, metodo, acreditoPor, tipoDeAcreditacion, limiteDeCuantificacionDelMetodo, limiteDeDeteccionDelMetodo, unidad, precio } = req.body;

    try {
        const updatedParametro = await Comercial_Parametros.findById(id);

        if (!updatedParametro) {
            return res.status(404).json({ message: "Parámetro no encontrado", type: "Advertencia" });
        }

        if (tipoDeAnalisis) updatedParametro.tipoDeAnalisis = tipoDeAnalisis;
        if (categoria) updatedParametro.categoria = categoria;
        if (parametro) updatedParametro.parametro = parametro;
        if (metodo) updatedParametro.metodo = metodo;
        if (acreditoPor) updatedParametro.acreditoPor = acreditoPor;
        if (tipoDeAcreditacion) updatedParametro.tipoDeAcreditacion = tipoDeAcreditacion;
        if (limiteDeCuantificacionDelMetodo) updatedParametro.limiteDeCuantificacionDelMetodo = limiteDeCuantificacionDelMetodo;
        if (limiteDeDeteccionDelMetodo) updatedParametro.limiteDeDeteccionDelMetodo = limiteDeDeteccionDelMetodo;
        if (unidad) updatedParametro.unidad = unidad;
        if (precio) updatedParametro.precio = precio;
        await updatedParametro.save();

        res.status(200).json({ message: "Parámetro actualizado correctamente", parametro: updatedParametro, type: "Correcto" });
    } catch (error) {
        console.error("Error al actualizar el parámetro:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

module.exports = patchParametro;