const Comercial_TiposDeGastos = require("../../../Models/Comercial/TipoDeGastos");
const Cotizacion = require("../../../Models/Comercial/Cotizaciones");

const patchTipoDeGasto = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            tipoDeGasto, codigo, categoria, descripcion, precio, origen, unidadReferencia, vigenciaDesde, vigenciaHasta, estado
        } = req.body;
        const findtipoDeGasto = await Comercial_TiposDeGastos.findById(id);

        if (!findtipoDeGasto) {
            return res.status(404).json({ message: "Tipo de gasto no encontrado" });
        }

        if (tipoDeGasto) findtipoDeGasto.tipoDeGasto = tipoDeGasto;
        if (codigo !== undefined) {
            const codigoNormalizado = String(codigo || "").trim().toUpperCase();
            if (!/^[A-Z][A-Z0-9_]{2,49}$/.test(codigoNormalizado)) return res.status(400).json({ message: "Código técnico no válido", type: "Advertencia" });
            if (codigoNormalizado !== findtipoDeGasto.codigo) {
                const uso = await Cotizacion.countDocuments({ $or: [{ "gastosOperativos.tipoDeGasto_id": findtipoDeGasto._id }, { "gastosAdministrativos.tipoDeGasto_id": findtipoDeGasto._id }] });
                if (uso) return res.status(409).json({ message: "No puedes cambiar el código de un gasto ya usado en cotizaciones", type: "Advertencia" });
                findtipoDeGasto.codigo = codigoNormalizado;
            }
        }
        if (categoria) {
            if (!["OPERATIVO", "ADMINISTRATIVO", "SIN_CLASIFICAR"].includes(categoria)) return res.status(400).json({ message: "Categoría de gasto no válida", type: "Advertencia" });
            if ((origen || findtipoDeGasto.origen) === "CALCULADORA_LOGISTICA" && categoria !== "OPERATIVO") return res.status(400).json({ message: "Los conceptos de calculadora logística deben ser gastos operativos", type: "Advertencia" });
            findtipoDeGasto.categoria = categoria;
        }
        if (descripcion) findtipoDeGasto.descripcion = descripcion;
        if (precio) findtipoDeGasto.precio = precio;
        if (origen !== undefined) {
            if (!["MANUAL", "CALCULADORA_LOGISTICA"].includes(origen)) return res.status(400).json({ message: "Origen de gasto no válido", type: "Advertencia" });
            if (origen === "CALCULADORA_LOGISTICA" && (categoria || findtipoDeGasto.categoria) !== "OPERATIVO") return res.status(400).json({ message: "Los conceptos de calculadora logística deben ser gastos operativos", type: "Advertencia" });
            findtipoDeGasto.origen = origen;
        }
        if (unidadReferencia !== undefined) {
            if (!["FIJO", "POR_UNIDAD", "POR_DIA", "POR_PERSONA_DIA", "POR_KM", "POR_GALON"].includes(unidadReferencia)) return res.status(400).json({ message: "Unidad de referencia no válida", type: "Advertencia" });
            findtipoDeGasto.unidadReferencia = unidadReferencia;
        }
        if (vigenciaDesde !== undefined) findtipoDeGasto.vigenciaDesde = vigenciaDesde || undefined;
        if (vigenciaHasta !== undefined) findtipoDeGasto.vigenciaHasta = vigenciaHasta || undefined;
        if (estado) findtipoDeGasto.estado = estado;
        await findtipoDeGasto.save();
        res.status(200).json({ message: "Tipo de gasto actualizado correctamente", type: "Correcto" });
    } catch (error) {
        res.status(500).json({ message: "Error al actualizar el tipo de gasto", error });
    }
};

module.exports = patchTipoDeGasto;
