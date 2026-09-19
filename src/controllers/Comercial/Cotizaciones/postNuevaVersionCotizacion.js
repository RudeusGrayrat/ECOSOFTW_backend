const Cotizacion = require("../../../Models/Comercial/Cotizaciones");

const nextCode = (code, version) => {
  const label = `VR${String(version).padStart(2, "0")}`;
  return /VR\d{2}/.test(code) ? code.replace(/VR\d{2}/, label) : `${code}-${label}`;
};

const postNuevaVersionCotizacion = async (req, res) => {
  try {
    const original = await Cotizacion.findById(req.params.id).lean();
    if (!original) return res.status(404).json({ message: "Cotización no encontrada", type: "Error" });
    const version = Number(original.version || 0) + 1;
    const { _id, createdAt, updatedAt, __v, ...base } = original;
    const nueva = await Cotizacion.create({
      ...base,
      ...req.body,
      version,
      correlativaVisible: nextCode(original.correlativaVisible, version),
      estado: "PENDIENTE",
      creadoPor: req.body.creadoPor || req.body.actualizadoPor || original.creadoPor,
      actualizadoPor: undefined,
    });
    return res.status(201).json({ message: `Nueva versión ${nueva.correlativaVisible} creada`, type: "Correcto", data: nueva });
  } catch (error) { return res.status(500).json({ message: error.message, type: "Error" }); }
};

module.exports = postNuevaVersionCotizacion;
