const Comercial_Cotizaciones = require("../../../Models/Comercial/Cotizaciones");
const UserEcosoft = require("../../../Models/Herramientas/User");
const Parametro = require("../../../Models/Comercial/Parametros");

const withParameterSnapshots = async (analisis = []) => {
    const ids = [...new Set(analisis.map((item) => item.parametro_id?._id?.toString() || item.parametro_id?.toString()).filter(Boolean))];
    const parameters = await Parametro.find({ _id: { $in: ids }, estado: { $ne: "INACTIVO" } }).lean();
    const parameterMap = new Map(parameters.map((parameter) => [parameter._id.toString(), parameter]));
    if (parameterMap.size !== ids.length) throw new Error("Uno o más parámetros no existen o están inactivos");
    return analisis.map((analysis) => {
        const id = analysis.parametro_id?._id?.toString() || analysis.parametro_id?.toString();
        const parameter = parameterMap.get(id);
        return { ...analysis, parametro_id: id, parametroSnapshot: { tipoDeAnalisis: parameter.tipoDeAnalisis, categoria: parameter.categoria, parametro: parameter.parametro, metodo: parameter.metodo, acreditadoPor: parameter.acreditadoPor, tipoDeAcreditacion: parameter.tipoDeAcreditacion, limiteDeCuantificacionDelMetodo: parameter.limiteDeCuantificacionDelMetodo, limiteDeDeteccionDelMetodo: parameter.limiteDeDeteccionDelMetodo, unidadDeMedida: parameter.unidadDeMedida, precio: parameter.precio } };
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
        gastosGenerales,
        totalSinIgv,
        totalConIgv,
        igv,
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
        if (gastosOperativos) findCotizacion.gastosOperativos = gastosOperativos;
        if (gastosAdministrativos) findCotizacion.gastosAdministrativos = gastosAdministrativos;
        if (gastosGenerales) findCotizacion.gastosGenerales = gastosGenerales;
        if (totalSinIgv) findCotizacion.totalSinIgv = totalSinIgv;
        if (totalConIgv) findCotizacion.totalConIgv = totalConIgv;
        if (igv) findCotizacion.igv = igv;
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
