require("dotenv").config();

const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const Informe = require("../src/Models/Calidad/InformeEnsayo");

const write = process.argv.includes("--write");

const normalize = (value) => (value || "").toString().trim().toUpperCase();

const detectCode = (filename = "") => {
  const baseName = path.basename(filename, path.extname(filename)).trim().toUpperCase();
  const codeMatch = baseName.match(/^([A-Z]*_?IE_)?(\d{6}(?:-I)?)/i) || baseName.match(/^(\d{6}(?:-I)?)/);
  return codeMatch ? normalize(codeMatch[2] || codeMatch[1]) : "";
};

const parseInformeFilename = (filename = "") => {
  const baseName = path.basename(filename, path.extname(filename)).trim();
  const cleanName = baseName
    .replace(/^ecology_?/i, "")
    .replace(/^ie_/i, "")
    .replace(/_\d{10,}$/i, "")
    .replace(/_migrado_v\d+$/i, "")
    .replace(/_\d{8}_v\d+_original$/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const pmMatch = cleanName.match(/\(\s*PM\s+([^)]+)\)/i);
  const afterPm = cleanName.split(/\)\s*/).slice(1).join(") ").trim();
  const matrizMatch = afterPm.match(/-\s*([^-()]+)$/) || cleanName.match(/-\s*([^-()]+)$/);
  const cliente = afterPm.replace(/-\s*([^-()]+)$/, "").trim();

  return {
    codigo: detectCode(cleanName),
    planMonitoreo: normalize(pmMatch?.[1] || ""),
    cliente: normalize(cliente),
    matriz: normalize(matrizMatch?.[1] || ""),
  };
};

const randomAccessId = () => crypto.randomBytes(12).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL en el .env");
  await mongoose.connect(process.env.DATABASE_URL);

  const informes = await Informe.find({});
  const accessByPlan = new Map();
  informes.forEach((informe) => {
    if (informe.planMonitoreo && informe.idAcceso && !accessByPlan.has(informe.planMonitoreo)) {
      accessByPlan.set(informe.planMonitoreo, informe.idAcceso);
    }
  });

  let updated = 0;
  let skipped = 0;
  const unresolved = [];

  for (const informe of informes) {
    const versionActual = informe.versiones?.find((version) => version.numero === informe.versionActual);
    const filename = versionActual?.original?.filename || informe.migracion?.archivoLegacy || versionActual?.publicado?.filename || "";
    const parsed = parseInformeFilename(filename);
    const patch = {};

    if (!informe.planMonitoreo && parsed.planMonitoreo) patch.planMonitoreo = parsed.planMonitoreo;
    if (!informe.cliente && parsed.cliente) patch.cliente = parsed.cliente;
    if (!informe.matriz && parsed.matriz) patch.matriz = parsed.matriz;

    const plan = patch.planMonitoreo || informe.planMonitoreo;
    if (plan) {
      if (!accessByPlan.has(plan)) accessByPlan.set(plan, informe.idAcceso || randomAccessId());
      const sharedId = accessByPlan.get(plan);
      if (informe.idAcceso !== sharedId) {
        patch.idAcceso = sharedId;
        patch.claveAccesoHash = await bcrypt.hash(sharedId, 12);
      }
    }

    if (!Object.keys(patch).length) {
      skipped += 1;
      if (!informe.planMonitoreo || !informe.matriz) unresolved.push({ codigo: informe.codigo, filename });
      continue;
    }

    updated += 1;
    console.log(`${write ? "actualizado" : "simulado"} ${informe.codigo}:`, patch);

    if (write) {
      Object.assign(informe, patch);
      informe.auditoria.push({
        accion: "METADATOS NORMALIZADOS",
        detalle: `Metadata completada desde archivo: ${filename}`,
        fecha: new Date(),
      });
      await informe.save();
    }
  }

  console.log(`\nModo: ${write ? "ESCRITURA" : "SIMULACION"}`);
  console.log(`Actualizables: ${updated}`);
  console.log(`Sin cambios: ${skipped}`);
  if (unresolved.length) {
    console.log(`Pendientes sin datos suficientes: ${unresolved.length}`);
    unresolved.slice(0, 20).forEach((item) => console.log(`- ${item.codigo}: ${item.filename}`));
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
