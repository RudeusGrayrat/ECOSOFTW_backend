const Comercial_Cotizaciones = require("../../../Models/Comercial/Cotizaciones");
const UserEcosoft = require("../../../Models/Herramientas/User");
const Parametro = require("../../../Models/Comercial/Parametros");
const TipoDeGasto = require("../../../Models/Comercial/TipoDeGastos");

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const refreshTotals = (cotizacion) => {
    const totalSinIgv = round2([...(cotizacion.analisis || []), ...(cotizacion.gastosOperativos || []), ...(cotizacion.gastosAdministrativos || [])].reduce((total, item) => total + Number(item.subtotal || 0), 0));
    cotizacion.totalSinIgv = totalSinIgv;
    cotizacion.igv = round2(totalSinIgv * 0.18);
    cotizacion.totalConIgv = round2(totalSinIgv + cotizacion.igv);
};

const withParameterSnapshots = async (analisis = []) => {
    const ids = [...new Set(analisis.map((item) => item.parametro_id?._id?.toString() || item.parametro_id?.toString()).filter(Boolean))];
    const parameters = await Parametro.find({ _id: { $in: ids }, estado: { $ne: "INACTIVO" } }).lean();
    const parameterMap = new Map(parameters.map((parameter) => [parameter._id.toString(), parameter]));
    if (parameterMap.size !== ids.length) throw new Error("Uno o más parámetros no existen o están inactivos");
    return analisis.map((analysis) => {
        const id = analysis.parametro_id?._id?.toString() || analysis.parametro_id?.toString();
        const parameter = parameterMap.get(id);
        const cantidad = Number(analysis.cantidad || 0);
        const precioUnitario = Number.isFinite(Number(analysis.precio ?? analysis.precioUnitario)) ? Number(analysis.precio ?? analysis.precioUnitario) : Number(parameter.precio || 0);
        return { ...analysis, parametro_id: id, cantidad, precioUnitario, subtotal: round2(precioUnitario * cantidad), parametroSnapshot: { tipoDeAnalisis: parameter.tipoDeAnalisis, categoria: parameter.categoria, nombreCorto: parameter.nombreCorto, parametro: parameter.parametro, componentes: parameter.componentes, tipoItem: parameter.tipoItem, unidadCobro: parameter.unidadCobro, metodo: parameter.metodo, acreditadoPor: parameter.acreditadoPor, tipoDeAcreditacion: parameter.tipoDeAcreditacion, limiteDeCuantificacionDelMetodo: parameter.limiteDeCuantificacionDelMetodo, limiteDeDeteccionDelMetodo: parameter.limiteDeDeteccionDelMetodo, unidadDeMedida: parameter.unidadDeMedida, precio: parameter.precio, vigenciaDesde: parameter.vigenciaDesde, vigenciaHasta: parameter.vigenciaHasta } };
    });
};
const withExpenseSnapshots = async (gastos = [], categoria) => {
    const rawIds = gastos.map((item) => item.tipoDeGasto_id?._id?.toString() || item.tipoDeGasto_id?.toString()).filter(Boolean);
    const ids = [...new Set(rawIds)];
    const tipos = await TipoDeGasto.find({ _id: { $in: ids }, categoria, estado: "ACTIVO" }).lean();
    const byId = new Map(tipos.map((tipo) => [tipo._id.toString(), tipo]));
    if (byId.size !== ids.length) throw new Error("Uno o más gastos no pertenecen a la categoría seleccionada o están inactivos");
    return gastos.map((gasto) => {
        const id = gasto.tipoDeGasto_id?._id?.toString() || gasto.tipoDeGasto_id?.toString();
        const tipo = id ? byId.get(id) : null;
        const descripcionManual = typeof gasto.descripcion === "string" ? gasto.descripcion.trim() : "";
        if (!tipo && !descripcionManual) throw new Error("Indica un tipo de gasto o una descripción para OTRO");
        const cantidad = Number(gasto.cantidad || 0);
        const dias = categoria === "OPERATIVO" ? Number(gasto.dias || 0) : undefined;
        const precioUnitario = Number.isFinite(Number(gasto.precio ?? gasto.precioUnitario)) ? Number(gasto.precio ?? gasto.precioUnitario) : Number(tipo?.precio || 0);
        return { ...gasto, ...(tipo ? { tipoDeGasto_id: id } : { tipoDeGasto_id: undefined }), cantidad, ...(categoria === "OPERATIVO" ? { dias } : {}), precioUnitario, subtotal: round2(precioUnitario * cantidad * (categoria === "OPERATIVO" ? dias : 1)), gastoSnapshot: tipo
            ? { codigo: tipo.codigo || "", tipoDeGasto: tipo.tipoDeGasto, categoria: tipo.categoria, descripcion: tipo.descripcion, precio: tipo.precio, origen: tipo.origen || "MANUAL", unidadReferencia: tipo.unidadReferencia || "FIJO", vigenciaDesde: tipo.vigenciaDesde, vigenciaHasta: tipo.vigenciaHasta }
            : { codigo: "", tipoDeGasto: "OTRO", categoria, descripcion: descripcionManual, precio: precioUnitario, origen: "MANUAL", unidadReferencia: "FIJO" } };
    });
};

const patchCotizacion = async (req, res) => {
    const { id: _id } = req.params;
    const {
        proyecto_id,
        solicitud_id,
        tipoDeServicio,
        tiempoDeEntrega,
        analisis,
        gastosOperativos,
        gastosAdministrativos,
        estado,
        facturacion,
        actualizadoPor,
        aprobadoPor,
        firmaAprobador,
    } = req.body;
    try {
        const findCotizacion = await Comercial_Cotizaciones.findById(_id);
        if (!findCotizacion) {
            return res.status(403).json({ message: "Cotización no encontrada" });
        }
        if (proyecto_id) findCotizacion.proyecto_id = proyecto_id;
        if (solicitud_id) findCotizacion.solicitud_id = solicitud_id;
        if (tipoDeServicio) findCotizacion.tipoDeServicio = tipoDeServicio;
        if (tiempoDeEntrega) findCotizacion.tiempoDeEntrega = tiempoDeEntrega;
        if (analisis) findCotizacion.analisis = await withParameterSnapshots(analisis);
        if (gastosOperativos) findCotizacion.gastosOperativos = await withExpenseSnapshots(gastosOperativos, "OPERATIVO");
        if (gastosAdministrativos) findCotizacion.gastosAdministrativos = await withExpenseSnapshots(gastosAdministrativos, "ADMINISTRATIVO");
        if (analisis || gastosOperativos || gastosAdministrativos) refreshTotals(findCotizacion);
        if (estado) findCotizacion.estado = estado;
        if (facturacion) findCotizacion.facturacion = facturacion;
        if (actualizadoPor) findCotizacion.actualizadoPor = actualizadoPor;
        if (aprobadoPor) {
            findCotizacion.aprobadoPor = aprobadoPor;
            // La firma queda como una referencia al archivo guardado del usuario,
            // no a una URL que el navegador pueda cambiar o dejar inválida.
            const approver = await UserEcosoft.findById(aprobadoPor).select("firma firmaArchivo");
            findCotizacion.firmaAprobador = approver?.firmaArchivo?.path || approver?.firma || firmaAprobador || "";
        } else if (firmaAprobador) findCotizacion.firmaAprobador = firmaAprobador;

        const updatedCotizacion = await findCotizacion.save();

        res.status(200).json({
            message: "Cotización actualizada exitosamente", data: updatedCotizacion, type: "Correcto"
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = patchCotizacion;
