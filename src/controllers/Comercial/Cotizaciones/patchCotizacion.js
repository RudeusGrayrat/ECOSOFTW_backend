const Comercial_Cotizaciones = require("../../../Models/Comercial/Cotizaciones");

const patchCotizacion = async (req, res) => {
    const { id: _id } = req.params;
    const {
        proyecto_id,
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
        actualizadoPor,
    } = req.body;
    try {
        const findCotizacion = await Comercial_Cotizaciones.findById(_id);
        if (!findCotizacion) {
            return res.status(403).json({ message: "Cotización no encontrada" });
        }
        if (proyecto_id) findCotizacion.proyecto_id = proyecto_id;
        if (tipoDeServicio) findCotizacion.tipoDeServicio = tipoDeServicio;
        if (tiempoDeEntrega) findCotizacion.tiempoDeEntrega = tiempoDeEntrega;
        if (analisis) findCotizacion.analisis = analisis;
        if (gastosOperativos) findCotizacion.gastosOperativos = gastosOperativos;
        if (gastosAdministrativos) findCotizacion.gastosAdministrativos = gastosAdministrativos;
        if (gastosGenerales) findCotizacion.gastosGenerales = gastosGenerales;
        if (totalSinIgv) findCotizacion.totalSinIgv = totalSinIgv;
        if (totalConIgv) findCotizacion.totalConIgv = totalConIgv;
        if (igv) findCotizacion.igv = igv;
        if (estado) findCotizacion.estado = estado;
        if (actualizadoPor) findCotizacion.actualizadoPor = actualizadoPor;

        const updatedCotizacion = await findCotizacion.save();

        res.status(200).json({
            message: "Cotización actualizada exitosamente", data: updatedCotizacion, type: "Correcto"
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = patchCotizacion;