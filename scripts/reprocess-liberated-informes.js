require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs/promises");
const Informe = require("../src/Models/Calidad/InformeEnsayo");
const informesController = require("../src/controllers/Calidad/informesEnsayo");

const args = process.argv.slice(2);
const write = args.includes("--write");
const codigoArg = args.find((arg) => arg.startsWith("--codigo="))?.split("=")[1]?.trim().toUpperCase();

const fakeReq = {
  user: {
    _id: undefined,
    userName: "script-reprocess-liberated-informes",
  },
};

const main = async () => {
  await mongoose.connect(process.env.DATABASE_URL);

  const filter = {
    estado: { $in: ["LIBERADO", "DISPONIBLE"] },
    papelera: { $ne: true },
  };
  if (codigoArg) filter.codigo = codigoArg;

  const reports = await Informe.find(filter);
  console.log(`Informes liberados encontrados: ${reports.length}`);

  let processed = 0;
  const omitted = [];

  for (const report of reports) {
    try {
      const version = report.versiones.find((item) => item.numero === report.versionActual);
      if (!version?.original?.path) {
        omitted.push(`${report.codigo}: sin archivo original`);
        continue;
      }
      const beforeBytes = version.publicado?.path
        ? await fs.stat(version.publicado.path).then((stat) => stat.size).catch(() => 0)
        : 0;

      if (!write) {
        console.log(`[dry-run] ${report.codigo}: se regeneraría ${version.publicado?.filename || "sin publicado"} (${beforeBytes} bytes actuales)`);
        continue;
      }

      await informesController.__regenerarOficial(report, fakeReq, "Reprocesado oficial por mantenimiento");
      const updatedVersion = report.versiones.find((item) => item.numero === report.versionActual);
      const afterBytes = updatedVersion?.publicado?.path
        ? await fs.stat(updatedVersion.publicado.path).then((stat) => stat.size).catch(() => updatedVersion.publicado?.bytes || 0)
        : 0;
      console.log(`${report.codigo}: oficial regenerado (${beforeBytes} -> ${afterBytes} bytes)`);
      processed += 1;
    } catch (error) {
      omitted.push(`${report.codigo}: ${error.message}`);
    }
  }

  if (omitted.length) {
    console.log("Omitidos:");
    omitted.forEach((item) => console.log(`- ${item}`));
  }

  console.log(write ? `Reprocesados: ${processed}` : "Dry-run completado. Usa --write para aplicar cambios.");
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
