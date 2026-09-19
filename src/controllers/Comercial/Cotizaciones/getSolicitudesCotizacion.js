const Solicitud = require("../../../Models/Comercial/SolicitudesCotizacion");
const getSolicitudesCotizacion = async (_req, res) => {
  const data = await Solicitud.find({ estado: { $in: ["RECIBIDA", "EN_REVISION"] } }).sort({ createdAt: -1 }).populate("cliente_id proyecto_id");
  return res.json({ data });
};
module.exports = getSolicitudesCotizacion;
