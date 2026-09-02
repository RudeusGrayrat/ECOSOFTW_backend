const ComercialClientes = require("../../Models/Comercial/Clientes");
const ComercialCotizaciones = require("../../Models/Comercial/Cotizaciones");
const ComercialProyectos = require("../../Models/Comercial/Proyectos");
const Module = require("../../Models/Herramientas/Modulo");
const Permission = require("../../Models/Herramientas/Permission");
const Submodule = require("../../Models/Herramientas/Submodulo");
const User = require("../../Models/Herramientas/User");
const InformeEnsayo = require("../../Models/Operaciones/InformeEnsayo");

const monthStart = (monthsBack = 11) => {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  date.setMonth(date.getMonth() - monthsBack);
  return date;
};

const ensureMonthSeries = (rows, field = "total") => {
  const months = [];
  const cursor = monthStart();
  const values = new Map(rows.map((row) => [row.mes, row[field] || 0]));

  for (let i = 0; i < 12; i += 1) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    months.push({ mes: key, total: values.get(key) || 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
};

const byStatus = async (model, estadoField = "estado") => {
  const rows = await model.aggregate([
    { $group: { _id: `$${estadoField}`, total: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);
  return rows.map((row) => ({ estado: row._id || "SIN ESTADO", total: row.total }));
};

const cotizacionesPorMes = async () => {
  const rows = await ComercialCotizaciones.aggregate([
    { $match: { createdAt: { $gte: monthStart() } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        total: { $sum: 1 },
        monto: { $sum: { $ifNull: ["$totalConIgv", 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const totals = ensureMonthSeries(rows.map((row) => ({ mes: row._id, total: row.total })));
  const amounts = new Map(rows.map((row) => [row._id, row.monto || 0]));
  return totals.map((item) => ({ ...item, monto: amounts.get(item.mes) || 0 }));
};

const informesPorMes = async () => {
  const rows = await InformeEnsayo.aggregate([
    { $match: { createdAt: { $gte: monthStart() } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        total: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return ensureMonthSeries(rows.map((row) => ({ mes: row._id, total: row.total })));
};

const topClientes = async () => {
  const rows = await ComercialCotizaciones.aggregate([
    {
      $lookup: {
        from: "comercial_proyectos",
        localField: "proyecto_id",
        foreignField: "_id",
        as: "proyecto",
      },
    },
    { $unwind: { path: "$proyecto", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "comercial_clientes",
        localField: "proyecto.cliente_id",
        foreignField: "_id",
        as: "cliente",
      },
    },
    { $unwind: { path: "$cliente", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: "$cliente._id",
        cliente: { $first: "$cliente.cliente" },
        cotizaciones: { $sum: 1 },
        monto: { $sum: { $ifNull: ["$totalConIgv", 0] } },
      },
    },
    { $match: { cliente: { $ne: null } } },
    { $sort: { monto: -1 } },
    { $limit: 5 },
  ]);

  return rows.map((row) => ({
    cliente: row.cliente,
    cotizaciones: row.cotizaciones,
    monto: row.monto,
  }));
};

const actividadReciente = async () => {
  const [cotizaciones, informes, clientes] = await Promise.all([
    ComercialCotizaciones.find({})
      .sort({ createdAt: -1 })
      .limit(4)
      .select("correlativaVisible estado totalConIgv createdAt")
      .lean(),
    InformeEnsayo.find({})
      .sort({ createdAt: -1 })
      .limit(4)
      .select("codigo estado idAcceso versionActual createdAt")
      .lean(),
    ComercialClientes.find({})
      .sort({ createdAt: -1 })
      .limit(3)
      .select("cliente estado createdAt")
      .lean(),
  ]);

  return [
    ...cotizaciones.map((item) => ({
      tipo: "Cotizacion",
      titulo: item.correlativaVisible,
      detalle: `${item.estado} - S/ ${(item.totalConIgv || 0).toFixed(2)}`,
      fecha: item.createdAt,
    })),
    ...informes.map((item) => ({
      tipo: "Informe",
      titulo: item.codigo,
      detalle: `${item.estado} - v${item.versionActual} - ID ${item.idAcceso}`,
      fecha: item.createdAt,
    })),
    ...clientes.map((item) => ({
      tipo: "Cliente",
      titulo: item.cliente,
      detalle: item.estado,
      fecha: item.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, 8);
};

const getResumenDashboard = async (_, res) => {
  try {
    const [
      clientesTotal,
      clientesActivos,
      cotizacionesTotal,
      cotizacionesAprobadas,
      cotizacionesPendientes,
      montoCotizado,
      proyectosTotal,
      proyectosActivos,
      informesTotal,
      informesDisponibles,
      usuariosTotal,
      usuariosActivos,
      modulosActivos,
      submodulosActivos,
      permisosActivos,
      estadosCotizaciones,
      estadosClientes,
      estadosProyectos,
      estadosInformes,
      tendenciaCotizaciones,
      tendenciaInformes,
      clientesTop,
      actividad,
    ] = await Promise.all([
      ComercialClientes.countDocuments(),
      ComercialClientes.countDocuments({ estado: "ACTIVO" }),
      ComercialCotizaciones.countDocuments(),
      ComercialCotizaciones.countDocuments({ estado: "APROBADO" }),
      ComercialCotizaciones.countDocuments({ estado: "PENDIENTE" }),
      ComercialCotizaciones.aggregate([{ $group: { _id: null, total: { $sum: { $ifNull: ["$totalConIgv", 0] } } } }]),
      ComercialProyectos.countDocuments(),
      ComercialProyectos.countDocuments({ estado: { $in: ["ACTIVO", "COTIZADO"] } }),
      InformeEnsayo.countDocuments(),
      InformeEnsayo.countDocuments({ estado: "DISPONIBLE" }),
      User.countDocuments(),
      User.countDocuments({ estado: "ACTIVO" }),
      Module.countDocuments({ active: true }),
      Submodule.countDocuments({ active: true }),
      Permission.countDocuments({ active: true }),
      byStatus(ComercialCotizaciones),
      byStatus(ComercialClientes),
      byStatus(ComercialProyectos),
      byStatus(InformeEnsayo),
      cotizacionesPorMes(),
      informesPorMes(),
      topClientes(),
      actividadReciente(),
    ]);

    res.json({
      indicadores: {
        clientes: { total: clientesTotal, activos: clientesActivos },
        cotizaciones: {
          total: cotizacionesTotal,
          aprobadas: cotizacionesAprobadas,
          pendientes: cotizacionesPendientes,
          montoTotal: montoCotizado[0]?.total || 0,
        },
        proyectos: { total: proyectosTotal, activos: proyectosActivos },
        informes: { total: informesTotal, disponibles: informesDisponibles },
        herramientas: {
          usuarios: usuariosTotal,
          usuariosActivos,
          modulosActivos,
          submodulosActivos,
          permisosActivos,
        },
      },
      graficos: {
        estadosCotizaciones,
        estadosClientes,
        estadosProyectos,
        estadosInformes,
        tendenciaCotizaciones,
        tendenciaInformes,
        clientesTop,
      },
      actividad,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = getResumenDashboard;
