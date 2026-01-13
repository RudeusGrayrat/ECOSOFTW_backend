const Comercial_Clientes = require("../../../models/Comercial/Clientes");
const escapeRegExp = require("../../../utils/escapeRegex");

const getClientesPaginacion = async (req, res) => {
  try {
    const { page = 0, limit = 10, search = "" } = req.query;
    const query = {}
    if (search) {
      const escapedSearch = escapeRegExp(search);
      const regex = new RegExp(escapedSearch, "i");
      query.$or = [
        { nombreComercial: regex },
        { razonSocial: regex },
        { ruc: regex },
        { direccion: regex },
        { correo: regex },
        { telefono: regex },
      ];
    }
    const [data, total] = await Promise.all([
      Comercial_Clientes.find(query)
        .skip(Number(page) * Number(limit))
        .limit(Number(limit))
        .sort({ createdAt: -1 }),
      Comercial_Clientes.countDocuments(query),
    ]);
    res.json({ data, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
module.exports = getClientesPaginacion;
