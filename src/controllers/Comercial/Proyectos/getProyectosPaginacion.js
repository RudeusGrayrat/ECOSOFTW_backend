const Comercial_Clientes = require("../../../models/Comercial/Clientes");
const Comercial_Proyectos = require("../../../models/Comercial/Proyectos");

const getProyectosPagination = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = "", cliente = "", estado = "" } = req.query;
        const query = {};
        if (search) {
            const escapedSearch = escapeRegExp(search);
            const regex = new RegExp(escapedSearch, "i");
            const clientes = await Comercial_Clientes.find({
                $or: [{ cliente: regex }, { numeroDocumento: regex }, { nombreContacto: regex }],
            }).select("_id");
            const clienteIds = clientes.map((cli) => cli._id);
            query.$or = [
                { nombre: regex },
                { servicio: regex },
                { lugarMuestreo: regex },
                { fechaServicio: { $regex: regex } },
                { estado: regex },
                { cliente_id: { $in: clienteIds } },
            ];
        }
        if (cliente) {
            query.cliente_id = cliente;
            query.estado = "ACTIVO";
        }
        if (estado) {
            query.estado = estado;
        }
        const [data, total] = await Promise.all([
            Comercial_Proyectos.find(query)
                .skip(Number(page) * Number(limit))
                .limit(Number(limit))
                .sort({ createdAt: -1 })
                .populate("cliente_id"),
            Comercial_Proyectos.countDocuments(query),
        ]);
        res.status(200).json({ data: data || [], total });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = getProyectosPagination;