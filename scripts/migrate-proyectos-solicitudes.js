require("dotenv").config();

const mongoose = require("mongoose");
const Proyecto = require("../src/Models/Comercial/Proyectos");
const SolicitudCotizacion = require("../src/Models/Comercial/SolicitudesCotizacion");

const text = (value) => (typeof value === "string" ? value.trim() : String(value || "").trim());

const run = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está configurada.");
  }

  await mongoose.connect(process.env.DATABASE_URL);

  const proyectos = await Proyecto.find({}).select("estado cantidadPuntosParametros").lean();
  let actualizados = 0;
  let detallesRecuperados = 0;

  for (const proyecto of proyectos) {
    const changes = {};

    // Los estados comerciales antiguos pertenecen a la Solicitud/Cotización,
    // no al proyecto maestro.
    if (!["ACTIVO", "INACTIVO"].includes(proyecto.estado)) {
      changes.estado = "ACTIVO";
    }

    // Los proyectos históricos no tenían el detalle. Se recupera desde la
    // última solicitud que les corresponde, sin borrar su historial.
    if (!text(proyecto.cantidadPuntosParametros)) {
      const solicitud = await SolicitudCotizacion.findOne({ proyecto_id: proyecto._id })
        .sort({ createdAt: -1 })
        .select("cantidadPuntosParametros")
        .lean();

      const detalle = text(solicitud?.cantidadPuntosParametros);
      if (detalle) {
        changes.cantidadPuntosParametros = detalle;
        detallesRecuperados += 1;
      }
    }

    if (Object.keys(changes).length) {
      await Proyecto.updateOne({ _id: proyecto._id }, { $set: changes });
      actualizados += 1;
    }
  }

  console.log(JSON.stringify({ proyectosRevisados: proyectos.length, actualizados, detallesRecuperados }));
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
