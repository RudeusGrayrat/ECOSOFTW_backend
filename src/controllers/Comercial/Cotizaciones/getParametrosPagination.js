const Comercial_Parametros = require("../../../Models/Comercial/Parametros");
const escapeRegExp = require("../../../utils/escapeRegex");
const firstFilterValue = (filters, field) => filters?.[field]?.constraints?.[0]?.value ?? filters?.[field]?.value;

const getParametrosPagination = async (req, res) => {
  try {
    const { limit = 10, page = 0, search = "", tipoDeAnalisis, tipoItem, unidadCobro, estado, includeInactive, filters: rawFilters } = req.query;
    let filters = {};
    try { filters = rawFilters ? JSON.parse(rawFilters) : {}; } catch { filters = {}; }
    const query = {};
    const estadoFiltro = estado || firstFilterValue(filters, "estado");
    const matrizFiltro = tipoDeAnalisis || firstFilterValue(filters, "tipoDeAnalisis");
    const tipoFiltro = tipoItem || firstFilterValue(filters, "tipoItem");
    const cobroFiltro = unidadCobro || firstFilterValue(filters, "unidadCobro");
    if (estadoFiltro) query.estado = estadoFiltro;
    else if (includeInactive !== "true") query.estado = { $ne: "INACTIVO" };
    if (search) {
      const safeSearch = escapeRegExp(search);
      const regex = new RegExp(safeSearch, "i");
      query.$or = [
        { tipoDeAnalisis: regex },
        { nombreCorto: regex },
        { parametro: regex },
        { metodo: regex },
        { categoria: regex },
        { componentes: regex },
      ];
    }
    if (matrizFiltro) query.tipoDeAnalisis = matrizFiltro;
    if (tipoFiltro) query.tipoItem = tipoFiltro;
    if (cobroFiltro) query.unidadCobro = cobroFiltro;
    const [data, total] = await Promise.all([
      Comercial_Parametros.find(query)
        .skip(Number(page) * Number(limit))
        .limit(Number(limit))
        .lean()
        .sort({ tipoDeAnalisis: 1, categoria: 1, nombreCorto: 1, parametro: 1 }),
      Comercial_Parametros.countDocuments(query),
    ]);
    return res.status(200).json({ data, total });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = getParametrosPagination;
