const Comercial_Cotizaciones = require("../../../Models/Comercial/Cotizaciones");

const generarCorrelativa = async (fechaOperacion) => {
  try {
    const añoActual = fechaOperacion.getFullYear().toString().slice(2); // "25"
    const correlativaBase = `${añoActual}`; // "25"

    // Buscar la última correlativa del año actual
    const ultima = await Comercial_Cotizaciones.findOne({
      correlativa: {
        $gte: Number(`${correlativaBase}00001`),
        $lt: Number(`${correlativaBase}99999`),
      },
    })
      .sort({ correlativa: -1 })
      .lean();

    let nuevoNumeroSecuencial = 1;

    if (ultima) {
      const secuencia = parseInt(
        ultima.correlativa.toString().slice(2), // obtiene solo la secuencia
        10
      );

      if (isNaN(secuencia)) {
        throw new Error(`Secuencia inválida: ${ultima.correlativa}`);
      }

      nuevoNumeroSecuencial = secuencia + 1;
    }

    // Construir correlativa numérica (para guardar en BD)
    const correlativa = Number(
      `${correlativaBase}${nuevoNumeroSecuencial.toString().padStart(5, "0")}`
    );

    if (isNaN(correlativa)) {
      throw new Error(`Correlativa generada inválida: ${correlativa}`);
    }

    // Construir correlativa visible (string final)
    const correlativaVisible = `ECO${añoActual}-${nuevoNumeroSecuencial
      .toString()
      .padStart(5, "0")}-CT CAC - VER08`;

    return {
      correlativa, // numérico (para la BD)
      correlativaVisible, // para mostrar en frontend
    };
  } catch (error) {
    console.error("Error al generar correlativa:", error.message);
    throw error;
  }
};
module.exports = generarCorrelativa;
