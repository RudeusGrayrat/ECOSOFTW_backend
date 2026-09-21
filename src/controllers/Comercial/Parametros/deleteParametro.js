const Parametro = require("../../../Models/Comercial/Parametros");
const Cotizacion = require("../../../Models/Comercial/Cotizaciones");

const deleteParametro = async (req, res) => {
  try {
    const parametro = await Parametro.findById(req.params.id);
    if (!parametro) return res.status(404).json({ message: "Parámetro no encontrado", type: "Error" });

    const usageCount = await Cotizacion.countDocuments({ "analisis.parametro_id": parametro._id });
    if (usageCount > 0) {
      parametro.estado = "INACTIVO";
      await parametro.save();
      return res.json({ message: `El parámetro se desactivó porque está usado en ${usageCount} cotización(es). El historial se conserva.`, type: "Advertencia", action: "DESACTIVADO", usageCount });
    }

    await Parametro.findByIdAndDelete(parametro._id);
    return res.json({ message: "Parámetro eliminado definitivamente; no tenía cotizaciones asociadas.", type: "Correcto", action: "ELIMINADO", usageCount: 0 });
  } catch (error) {
    return res.status(500).json({ message: error.message || "No se pudo eliminar el parámetro", type: "Error" });
  }
};

module.exports = deleteParametro;
