require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const Informe = require("../src/Models/Operaciones/InformeEnsayo");

const sqlPath = path.resolve(process.env.QRENSAYO_SQL_PATH || path.join(__dirname, "..", "..", "QRENSAYO", "bryyaurh_informedeensayo.sql"));
const sourcePdfDir = path.resolve(process.env.QRENSAYO_PDF_DIR || path.join(__dirname, "..", "..", "QRENSAYO", "public", "archivos", "certificados"));
const storageRoot = path.resolve(process.env.INFORMES_STORAGE_PATH || path.join(__dirname, "..", "storage", "informes-ensayo"));
const exportPath = path.resolve(process.env.QRENSAYO_EXPORT_PATH || path.join(__dirname, "..", "storage", "informes-ensayo", "migracion-qrensayo.csv"));
const dryRun = process.argv.includes("--dry-run");

function parseTuple(line) {
  let source = line.trim();
  if (source.endsWith(",") || source.endsWith(";")) source = source.slice(0, -1);
  if (source[0] === "(" && source[source.length - 1] === ")") source = source.slice(1, -1);

  const values = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "'" && source[index - 1] !== "\\") {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values.map((value) => value.replace(/\\'/g, "'"));
}

function readRows(sql) {
  const lines = [];
  let reading = false;

  for (const line of sql.split(/\r?\n/)) {
    if (line.includes("INSERT INTO `web_certificacion_certificado`")) {
      reading = true;
      continue;
    }
    if (!reading) continue;
    if (line.trim().startsWith("(")) lines.push(line);
    if (line.trim().endsWith(";")) reading = false;
  }

  return lines
    .map(parseTuple)
    .filter((fields) => fields.length >= 14)
    .map((fields) => ({
      id: fields[0],
      codigoLegacy: fields[1],
      fechaOperacion: toDate(fields[2]),
      claveHashLegacy: fields[5],
      llaveLegacy: fields[6],
      archivo: fields[7],
      registrado: fields[8],
      fechaRegistro: toDateFromUnix(fields[9]),
      modificado: fields[10],
      fechaModificacion: toDateFromUnix(fields[11]),
      estado: fields[12],
      eliminacionLogica: fields[13],
    }));
}

function toDate(value) {
  if (!value || value === "0000-00-00") return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toDateFromUnix(value) {
  const timestamp = Number(value);
  if (!timestamp) return undefined;
  const date = new Date(timestamp * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalize(value) {
  return (value || "").toString().trim().toUpperCase();
}

function safeSegment(value) {
  return normalize(value).replace(/[^A-Z0-9-]/g, "_");
}

function detectInformeCode(filename, fallback) {
  const baseName = path.basename(filename || "", path.extname(filename || "")).toUpperCase();
  const ieMatch = baseName.match(/(?:^|_)IE_(\d{5,6})(?:_I)?(?:_|$)/);
  if (ieMatch) return baseName.includes(`IE_${ieMatch[1]}_I`) ? `${ieMatch[1]}-I` : ieMatch[1];
  const ecologyMatch = baseName.match(/^ECOLOGY_(\d{5,6})(?:_I)?(?:_|$)/);
  if (ecologyMatch) return baseName.includes(`ECOLOGY_${ecologyMatch[1]}_I`) ? `${ecologyMatch[1]}-I` : ecologyMatch[1];
  const firstEight = baseName.slice(0, 8);
  if (/^\d{6}-I$/.test(firstEight)) return firstEight;
  const firstSix = baseName.slice(0, 6);
  if (/^\d{6}$/.test(firstSix)) return firstSix;
  return normalize(fallback);
}

function randomAccessId() {
  return crypto.randomBytes(12).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
}

async function uniqueAccessId() {
  let idAcceso = randomAccessId();
  while (await Informe.exists({ idAcceso })) idAcceso = randomAccessId();
  return idAcceso;
}

async function uniqueCodigo(baseCode) {
  let codigo = normalize(baseCode);
  if (!(await Informe.exists({ codigo }))) return codigo;

  let suffix = 2;
  while (await Informe.exists({ codigo: `${codigo}-${suffix}` })) suffix += 1;
  return `${codigo}-${suffix}`;
}

function csvValue(value) {
  const text = value === undefined || value === null ? "" : value.toString();
  return `"${text.replace(/"/g, '""')}"`;
}

async function migrateRow(row) {
  const sourcePath = path.join(sourcePdfDir, row.archivo);
  const codigoBase = detectInformeCode(row.archivo, row.codigoLegacy);
  const existingLegacy = await Informe.findOne({ "migracion.origen": "QRENSAYO", "migracion.legacyId": row.id });

  if (existingLegacy) {
    return {
      action: "omitido",
      codigo: existingLegacy.codigo,
      idAcceso: existingLegacy.idAcceso,
      archivo: row.archivo,
      reason: "Ya migrado",
    };
  }

  if (!fsSync.existsSync(sourcePath)) {
    return { action: "error", codigo: codigoBase, idAcceso: "", archivo: row.archivo, reason: "PDF no encontrado" };
  }

  const codigo = await uniqueCodigo(codigoBase);
  const idAcceso = await uniqueAccessId();
  const versionDir = path.join(storageRoot, safeSegment(codigo), "v1");
  const targetFilename = `IE_${safeSegment(codigo)}_migrado_v1.pdf`;
  const targetPath = path.join(versionDir, targetFilename);
  const stats = await fs.stat(sourcePath);

  if (!dryRun) {
    await fs.mkdir(versionDir, { recursive: true });
    await fs.copyFile(sourcePath, targetPath);

    await Informe.create({
      codigo,
      idAcceso,
      tokenPublico: crypto.randomBytes(18).toString("base64url"),
      claveAccesoHash: await bcrypt.hash(idAcceso, 12),
      estado: row.estado === "ACTIVO" && row.eliminacionLogica === "1" ? "DISPONIBLE" : "NO DISPONIBLE",
      plantilla: { tipo: "SIN_ACREDITACION" },
      versionActual: 1,
      versiones: [{
        numero: 1,
        original: { path: targetPath, filename: row.archivo, bytes: stats.size },
        publicado: { path: targetPath, filename: targetFilename, bytes: stats.size },
        creadoEn: row.fechaRegistro || new Date(),
        motivo: "Migracion desde QRENSAYO",
      }],
      auditoria: [{
        accion: "MIGRADO",
        detalle: `Migrado desde QRENSAYO legacyId=${row.id}, archivo=${row.archivo}`,
        fecha: new Date(),
      }],
      migracion: {
        origen: "QRENSAYO",
        legacyId: row.id,
        codigoLegacy: row.codigoLegacy,
        llaveLegacy: row.llaveLegacy,
        archivoLegacy: row.archivo,
        fechaOperacion: row.fechaOperacion,
        registrado: row.registrado,
        fechaRegistro: row.fechaRegistro,
        modificado: row.modificado,
        fechaModificacion: row.fechaModificacion,
        estadoLegacy: row.estado,
        eliminacionLogica: row.eliminacionLogica,
      },
    });
  }

  return { action: dryRun ? "simulado" : "migrado", codigo, idAcceso, archivo: row.archivo, reason: "" };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL en el .env");

  const sql = await fs.readFile(sqlPath, "latin1");
  const rows = readRows(sql).filter((row) => row.archivo);
  const report = [];

  await mongoose.connect(process.env.DATABASE_URL);

  for (const row of rows) {
    report.push(await migrateRow(row));
  }

  if (!dryRun) {
    await fs.mkdir(path.dirname(exportPath), { recursive: true });
    const csv = [
      ["accion", "codigo_ecosoft", "id_acceso_nuevo", "archivo_legacy", "observacion"].map(csvValue).join(","),
      ...report.map((row) => [row.action, row.codigo, row.idAcceso, row.archivo, row.reason].map(csvValue).join(",")),
    ].join("\n");
    await fs.writeFile(exportPath, csv, "utf8");
  }

  const totals = report.reduce((acc, row) => {
    acc[row.action] = (acc[row.action] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    dryRun,
    sqlPath,
    sourcePdfDir,
    storageRoot,
    exportPath: dryRun ? null : exportPath,
    totalRowsWithPdf: rows.length,
    totals,
    sample: report.slice(0, 5),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
