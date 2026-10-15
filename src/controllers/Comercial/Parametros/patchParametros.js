const Comercial_Parametros = require("../../../Models/Comercial/Parametros");

const patchParametro = async (req, res) => {
    const { id } = req.params;
    const { tipoDeAnalisis, categoria, nombreCorto, parametro, componentes, tipoItem, unidadCobro, metodo, acreditadoPor, tipoDeAcreditacion, limiteDeCuantificacionDelMetodo, limiteDeDeteccionDelMetodo, unidadDeMedida, precio, vigenciaDesde, vigenciaHasta, estado } = req.body;

    try {
        const updatedParametro = await Comercial_Parametros.findById(id);

        if (!updatedParametro) {
            return res.status(404).json({ message: "Parámetro no encontrado", type: "Advertencia" });
        }

        if (tipoDeAnalisis) updatedParametro.tipoDeAnalisis = tipoDeAnalisis;
        if (categoria) updatedParametro.categoria = categoria;
        if (nombreCorto !== undefined) updatedParametro.nombreCorto = String(nombreCorto).trim();
        if (parametro) updatedParametro.parametro = parametro;
        if (componentes !== undefined) updatedParametro.componentes = Array.isArray(componentes) ? componentes.map((item) => String(item).trim()).filter(Boolean) : [];
        if (tipoItem !== undefined) {
            if (!["INDIVIDUAL", "PAQUETE", "CAMPO"].includes(tipoItem)) return res.status(400).json({ message: "Tipo de ítem no válido", type: "Advertencia" });
            updatedParametro.tipoItem = tipoItem;
        }
        if (unidadCobro !== undefined) {
            if (!["POR_UNIDAD", "POR_PUNTO", "POR_MUESTRA", "POR_DIA", "POR_CAMPANA", "POR_EQUIPO"].includes(unidadCobro)) return res.status(400).json({ message: "Unidad de cobro no válida", type: "Advertencia" });
            updatedParametro.unidadCobro = unidadCobro;
        }
        if (metodo) updatedParametro.metodo = metodo;
        if (acreditadoPor !== undefined) updatedParametro.acreditadoPor = acreditadoPor;
        if (tipoDeAcreditacion) updatedParametro.tipoDeAcreditacion = tipoDeAcreditacion;
        if (limiteDeCuantificacionDelMetodo) updatedParametro.limiteDeCuantificacionDelMetodo = limiteDeCuantificacionDelMetodo;
        if (limiteDeDeteccionDelMetodo) updatedParametro.limiteDeDeteccionDelMetodo = limiteDeDeteccionDelMetodo;
        if (unidadDeMedida !== undefined) updatedParametro.unidadDeMedida = unidadDeMedida;
        if (precio !== undefined) updatedParametro.precio = precio;
        if (vigenciaDesde !== undefined) updatedParametro.vigenciaDesde = vigenciaDesde || undefined;
        if (vigenciaHasta !== undefined) updatedParametro.vigenciaHasta = vigenciaHasta || undefined;
        if (estado) updatedParametro.estado = estado;
        await updatedParametro.save();

        res.status(200).json({ message: "Parámetro actualizado correctamente", parametro: updatedParametro, type: "Correcto" });
    } catch (error) {
        console.error("Error al actualizar el parámetro:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

module.exports = patchParametro;
