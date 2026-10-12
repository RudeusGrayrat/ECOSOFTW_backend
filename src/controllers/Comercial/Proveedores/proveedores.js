const Proveedor = require("../../../Models/Comercial/Proveedores");
const escapeRegExp = require("../../../utils/escapeRegex");
exports.listar = async (req, res) => {
  const { todos, page, limit, search = "" } = req.query;
  const filter = todos === "true" ? {} : { estado: "ACTIVO" };
  if (search) filter.nombre = { $regex: escapeRegExp(search.trim()), $options: "i" };

  const hasPagination = page !== undefined || limit !== undefined;
  if (!hasPagination) {
    const data = await Proveedor.find(filter).sort({ nombre: 1 });
    return res.json({ data, total: data.length });
  }

  const safePage = Math.max(0, Number(page) || 0);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
  const [data, total] = await Promise.all([
    Proveedor.find(filter).sort({ nombre: 1 }).skip(safePage * safeLimit).limit(safeLimit),
    Proveedor.countDocuments(filter),
  ]);
  return res.json({ data, total });
};
exports.crear = async (req, res) => { try { const data = await Proveedor.create({ nombre: req.body.nombre }); return res.status(201).json({ data, message: "Proveedor creado", type: "Correcto" }); } catch (error) { return res.status(400).json({ message: error.message, type: "Error" }); } };
exports.actualizar = async (req, res) => {
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => ["nombre", "estado"].includes(key)));
  const data = await Proveedor.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true });
  return data ? res.json({ data, message: "Proveedor actualizado", type: "Correcto" }) : res.status(404).json({ message: "Proveedor no encontrado", type: "Error" });
};
