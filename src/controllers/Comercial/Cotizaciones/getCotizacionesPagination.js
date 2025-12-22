const { populate } = require("dotenv");
const Comercial_Cotizaciones = require("../../../models/Comercial/Cotizaciones");
const Comercial_Parametros = require("../../../models/Comercial/Parametros");
const Comercial_Proyectos = require("../../../models/Comercial/Proyectos");
const Compercial_TipoDeGastos = require("../../../models/Comercial/TipoDeGastos");
const escapeRegExp = require("../../../utils/escapeRegex");

const getCotizacionesPagination = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const query = {};

    if (search) {
      const escapedSearch = escapeRegExp(search);
      const regex = new RegExp(escapedSearch, "i");
      const tipoDeGastos = await Compercial_TipoDeGastos.find({
        $or: [{ tipo: regex }, { descripcion: regex }, { precio: regex }],
      }).select("_id");
      const parametros = await Comercial_Parametros.find({
        $or: [
          { matriz: regex },
          { tipoDeAnalisis: regex },
          { categoria: regex },
          { parametro: regex },
          { metodo: regex },
          { acreditoPor: regex },
          { tipoDeAcreditacion: regex },
          { limiteDeCuantificacionDelMetodo: regex },
          { limiteDeDeteccionDelMetodo: regex },
          { unidad: regex },
          { precio: regex },
        ],
      }).select("_id");
      const proyectos = await Comercial_Proyectos.find({
        $or: [
          { proyecto: regex },
          { servicio: regex },
          { lugarMuestreo: regex },
        ],
      }).select("_id");

      const tipoDeGastosIds = tipoDeGastos.map((gasto) => gasto._id);
      const parametrosIds = parametros.map((param) => param._id);
      const proyectosIds = proyectos.map((proj) => proj._id);
      query.$or = [
        { "gastosOperativos.tipoDeGasto_id": { $in: tipoDeGastosIds } },
        { "gastosAdministrativos.tipoDeGasto_id": { $in: tipoDeGastosIds } },
        { "analisis.parametro_id": { $in: parametrosIds } },
        { proyecto_id: { $in: proyectosIds } },
        { totalSinIgv: isNaN(Number(search)) ? undefined : Number(search) },
        { totalConIgv: isNaN(Number(search)) ? undefined : Number(search) },
        { igv: isNaN(Number(search)) ? undefined : Number(search) },
      ];
    }

    const [data, total] = await Promise.all([
      Comercial_Cotizaciones.find(query)
        .skip(Number(page) * Number(limit))
        .limit(Number(limit))
        .sort({ correlativa: -1 })
        .populate([
          {
            path: "gastosOperativos.tipoDeGasto_id",
            model: Compercial_TipoDeGastos,
          },
          {
            path: "gastosAdministrativos.tipoDeGasto_id",
            model: Compercial_TipoDeGastos,
          },
          { path: "analisis.parametro_id", model: Comercial_Parametros },
          // proyecto populate: use the model name string if the model isn't imported above
          {
            path: "proyecto_id", model: Comercial_Proyectos, populate: {
              path: "cliente_id", model: "comercial_cliente"
            }
          },
        ]),
      Comercial_Cotizaciones.countDocuments(query),
    ]);

    return res.json({
      data,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
module.exports = getCotizacionesPagination;
