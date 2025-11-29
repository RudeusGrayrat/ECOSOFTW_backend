const Comercial_Cotizaciones = require("../../../Models/Comercial/Cotizaciones");

const generarCorrelativa = async (fechaOperacion) => {
  try {
    const añoActual = fechaOperacion.getFullYear().toString().slice(2); // "25"
    const correlativaBase = `${añoActual}`; // "25"

    // Buscar la última correlativa del año actual
    const ultima = await Comercial_Cotizaciones.findOne({
      correlativaNumero: {
        $gte: Number(`${correlativaBase}00001`),
        $lt: Number(`${correlativaBase}99999`),
      },
    })
      .sort({ correlativaNumero: -1 })
      .lean();

    let nuevoNumeroSecuencial = 1;

    if (ultima) {
      const secuencia = parseInt(
        ultima.correlativaNumero.toString().slice(2), // obtiene solo la secuencia
        10
      );

      if (isNaN(secuencia)) {
        throw new Error(`Secuencia inválida: ${ultima.correlativaNumero}`);
      }

      nuevoNumeroSecuencial = secuencia + 1;
    }

    // Construir correlativa numérica (para guardar en BD)
    const correlativaNumero = Number(
      `${correlativaBase}${nuevoNumeroSecuencial.toString().padStart(5, "0")}`
    );

    if (isNaN(correlativaNumero)) {
      throw new Error(`Correlativa generada inválida: ${correlativaNumero}`);
    }

    // Construir correlativa visible (string final)
    const correlativaVisible = `ECO${añoActual}-${nuevoNumeroSecuencial
      .toString()
      .padStart(5, "0")}-CT CAC - VER08`;

    return {
      correlativaNumero, // numérico (para la BD)
      correlativaVisible, // para mostrar en frontend
    };
  } catch (error) {
    console.error("Error al generar correlativa:", error.message);
    throw error;
  }
};
module.exports = generarCorrelativa;
