const Module = require("../../../Models/Herramientas/Modulo");
const Submodule = require("../../../Models/Herramientas/Submodulo");
const escapeRegExp = require("../../../utils/escapeRegex");

const getModulosYSubmodulosPaginacion = async (req, res) => {
  const { limit = 10, page = 0, search = "" } = req.query;
  try {
    const safeSearch = escapeRegExp(search);
    const regex = new RegExp(safeSearch, "i");

    const [modules, submodules] = await Promise.all([
      Module.find(search ? { name: regex } : {}).lean().sort({ createdAt: -1 }),
      Submodule.find(search ? { $or: [{ name: regex }, { module: regex }] } : {}).lean().sort({ createdAt: -1 }),
    ]);

    const moduleRows = modules.map((module) => ({
      _id: module._id,
      tipo: "MODULO",
      module: module.name,
      name: "",
      order: module.order || 0,
      estado: module.active === false ? "INACTIVO" : "ACTIVO",
      createdAt: module.createdAt,
    }));

    const submoduleRows = submodules.map((submodule) => ({
      _id: submodule._id,
      tipo: "SUBMODULO",
      module: submodule.module,
      name: submodule.name,
      order: submodule.order || 0,
      estado: submodule.active === false ? "INACTIVO" : "ACTIVO",
      createdAt: submodule.createdAt,
    }));

    const rows = [...moduleRows, ...submoduleRows].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    const start = Number(page) * Number(limit);
    const end = start + Number(limit);

    return res.status(200).json({
      data: rows.slice(start, end),
      total: rows.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = getModulosYSubmodulosPaginacion;
