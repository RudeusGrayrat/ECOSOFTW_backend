const crypto = require("crypto");
const { execFile } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { promisify } = require("util");
const bcrypt = require("bcrypt");
const multer = require("multer");
const QRCode = require("qrcode");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const Informe = require("../../Models/Operaciones/InformeEnsayo");
const InformeConfig = require("../../Models/Operaciones/InformeEnsayoConfig");

const execFileAsync = promisify(execFile);
const storageRoot = path.resolve(process.env.INFORMES_STORAGE_PATH || path.join(process.cwd(), "storage", "informes-ensayo"));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_, file, cb) => cb(null, file.mimetype === "application/pdf"),
});
const uploadAsset = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_, file, cb) => cb(null, ["application/pdf", "image/png", "image/jpeg"].includes(file.mimetype)),
});

exports.upload = upload.single("archivo");
exports.uploadAsset = uploadAsset.single("archivo");

const actor = (req) => req.user?._id;
const audit = (report, req, accion, detalle) => report.auditoria.push({ accion, usuario: actor(req), detalle });
const portalUrl = () => `${process.env.PUBLIC_REPORT_URL || process.env.FRONTEND_URL || "http://localhost:5174"}/consulta-informes`;
const normalize = (value) => (value || "").toString().trim().toUpperCase();
const safeSegment = (value) => normalize(value).replace(/[^A-Z0-9-]/g, "_");
const cm = (value) => value * 28.3464567;
const selloLayout = {
  qrX: cm(6.14),
  qrY: cm(3.55),
  qrSize: cm(3.5),
  idGap: cm(0.35),
  firmaX: cm(10.45),
  firmaY: cm(3.1),
  firmaSize: cm(5),
};

const detectCode = (filename = "") => {
  const baseName = path.basename(filename, path.extname(filename)).trim().toUpperCase();
  const firstEight = baseName.slice(0, 8);
  if (/^\d{6}-I$/.test(firstEight)) return firstEight;
  const firstSix = baseName.slice(0, 6);
  if (/^\d{6}$/.test(firstSix)) return firstSix;
  return "";
};

const parseInformeFilename = (filename = "") => {
  const baseName = path.basename(filename, path.extname(filename)).trim();
  const pmMatch = baseName.match(/\((PM\s*[^)]+)\)/i);
  const matrizMatch = baseName.match(/\)\s*.*-\s*([^-()]+)$/) || baseName.match(/-\s*([^-()]+)$/);

  return {
    pm: pmMatch?.[1]?.replace(/\s+/g, " ").trim().toUpperCase() || "",
    matriz: matrizMatch?.[1]?.replace(/\s+/g, " ").trim().toUpperCase() || "",
  };
};

const randomAccessId = () => crypto.randomBytes(12).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();

async function uniqueAccessId() {
  let idAcceso = randomAccessId();
  while (await Informe.exists({ idAcceso })) idAcceso = randomAccessId();
  return idAcceso;
}

const filenameFor = (codigo, version, type, originalName = "") => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const originalBase = path.basename(originalName || codigo, path.extname(originalName || codigo)).replace(/[^a-zA-Z0-9-_ ]/g, "").trim();
  return type === "publicado"
    ? `IE_${safeSegment(codigo)}_${date}_v${version}.pdf`
    : `${safeSegment(originalBase || codigo)}_${date}_v${version}_original.pdf`;
};

async function saveFile(codigo, version, filename, buffer) {
  const directory = path.join(storageRoot, safeSegment(codigo), `v${version}`);
  await fs.mkdir(directory, { recursive: true });
  const absolutePath = path.join(directory, filename);
  await fs.writeFile(absolutePath, buffer);
  return absolutePath;
}

async function saveConfigFile(filename, buffer) {
  const directory = path.join(storageRoot, "config");
  await fs.mkdir(directory, { recursive: true });
  const absolutePath = path.join(directory, filename);
  await fs.writeFile(absolutePath, buffer);
  return absolutePath;
}

async function removeStoredFile(filePath) {
  if (!filePath) return;
  await fs.rm(assertInsideStorage(filePath), { force: true });
}

async function getConfig() {
  return InformeConfig.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { key: "default" } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

function assertInsideStorage(filePath) {
  const resolved = path.resolve(filePath);
  const relative = path.relative(storageRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Ruta de informe no permitida");
  return resolved;
}

function createViewToken(report) {
  const exp = Date.now() + 10 * 60 * 1000;
  const payload = `${report._id}:${report.versionActual}:${exp}`;
  const signature = crypto.createHmac("sha256", process.env.JWT_SECRET || "secret").update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

function verifyViewToken(token) {
  const decoded = Buffer.from(token || "", "base64url").toString("utf8");
  const [id, version, exp, signature] = decoded.split(":");
  if (!id || !version || !exp || !signature || Number(exp) < Date.now()) return null;
  const payload = `${id}:${version}:${exp}`;
  const expected = crypto.createHmac("sha256", process.env.JWT_SECRET || "secret").update(payload).digest("hex");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;
  return { id, version: Number(version) };
}

async function processPdf(source, report) {
  const originalPdf = await PDFDocument.load(source);
  const config = await getConfig();
  const watermark = config.marcasAgua?.[report.plantilla?.tipo];
  let pdf = originalPdf;

  if (watermark?.path) {
    const watermarkedPdf = await PDFDocument.create();
    const watermarkBytes = await fs.readFile(assertInsideStorage(watermark.path));
    const [watermarkPage] = await watermarkedPdf.embedPdf(watermarkBytes, [0]);
    const originalPages = await watermarkedPdf.embedPages(originalPdf.getPages());

    originalPdf.getPages().forEach((originalPage, index) => {
      const { width, height } = originalPage.getSize();
      const page = watermarkedPdf.addPage([width, height]);
      page.drawPage(watermarkPage, { x: 0, y: 0, width, height });
      page.drawPage(originalPages[index], { x: 0, y: 0, width, height });
    });

    pdf = watermarkedPdf;
  }

  const firstPage = pdf.getPages()[0];
  if (!firstPage) {
    throw new Error("El PDF no tiene páginas para procesar");
  }

  const qr = await QRCode.toDataURL(portalUrl(), { margin: 1, width: 280 });
  const qrImage = await pdf.embedPng(qr);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const qrX = selloLayout.qrX;
  const qrY = selloLayout.qrY;
  const qrSize = selloLayout.qrSize;
  const idText = `ID: ${report.idAcceso}`;
  const idX = qrX + ((qrSize - font.widthOfTextAtSize(idText, 11)) / 2);
  const idY = qrY - selloLayout.idGap;

  firstPage.drawRectangle({ x: qrX - 4, y: qrY - 4, width: qrSize + 8, height: qrSize + 24, color: rgb(1, 1, 1), opacity: 0.92 });
  firstPage.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  firstPage.drawText(idText, { x: idX, y: idY, size: 11, font, color: rgb(0, 0, 0) });

  if (config.firma?.path) {
    const signatureBytes = await fs.readFile(assertInsideStorage(config.firma.path));
    const signatureImage = config.firma.mimetype === "image/png"
      ? await pdf.embedPng(signatureBytes)
      : await pdf.embedJpg(signatureBytes);
    const scale = Math.min(selloLayout.firmaSize / signatureImage.width, selloLayout.firmaSize / signatureImage.height);
    const signatureWidth = signatureImage.width * scale;
    const signatureHeight = signatureImage.height * scale;
    firstPage.drawImage(signatureImage, {
      x: selloLayout.firmaX + ((selloLayout.firmaSize - signatureWidth) / 2),
      y: selloLayout.firmaY + ((selloLayout.firmaSize - signatureHeight) / 2),
      width: signatureWidth,
      height: signatureHeight,
    });
  }

  return Buffer.from(await pdf.save());
}

async function protectPdfIfAvailable(buffer) {
  const qpdfPath = process.env.QPDF_PATH || "qpdf";
  const ownerPassword = process.env.INFORMES_PDF_OWNER_PASSWORD || crypto.randomBytes(18).toString("base64url");
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ecosoft-informe-"));
  const input = path.join(directory, "input.pdf");
  const output = path.join(directory, "output.pdf");
  try {
    await fs.writeFile(input, buffer);
    await execFileAsync(qpdfPath, [
      "--encrypt",
      "",
      ownerPassword,
      "256",
      "--modify=none",
      "--extract=n",
      "--print=full",
      "--",
      input,
      output,
    ]);
    return await fs.readFile(output);
  } catch (_) {
    return buffer;
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

exports.configuracion = async (req, res) => {
  try {
    const config = await getConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.actualizarFirma = async (req, res) => {
  try {
    if (!req.file || !["image/png", "image/jpeg"].includes(req.file.mimetype)) {
      return res.status(400).json({ message: "Debes enviar una firma en PNG o JPG" });
    }
    const config = await getConfig();
    const extension = req.file.mimetype === "image/png" ? "png" : "jpg";
    const filename = `firma_autorizada_${Date.now()}.${extension}`;
    const filePath = await saveConfigFile(filename, req.file.buffer);
    await removeStoredFile(config.firma?.path);
    config.firma = { path: filePath, filename, mimetype: req.file.mimetype, bytes: req.file.size, updatedAt: new Date() };
    await config.save();
    res.json({ message: "Firma actualizada correctamente", type: "Correcto", data: config });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.eliminarFirma = async (_req, res) => {
  try {
    const config = await getConfig();
    await removeStoredFile(config.firma?.path);
    config.firma = undefined;
    await config.save();
    res.json({ message: "Firma eliminada correctamente", type: "Correcto", data: config });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.actualizarMarcaAgua = async (req, res) => {
  try {
    const tipo = normalize(req.params.tipo);
    if (!["INACAL", "NAC", "SIN_ACREDITACION"].includes(tipo)) return res.status(400).json({ message: "Tipo de marca de agua no válido" });
    if (!req.file || req.file.mimetype !== "application/pdf") return res.status(400).json({ message: "Debes enviar una marca de agua en PDF" });
    const config = await getConfig();
    const filename = `marca_${tipo}_${Date.now()}.pdf`;
    const filePath = await saveConfigFile(filename, req.file.buffer);
    if (!config.marcasAgua) config.marcasAgua = {};
    await removeStoredFile(config.marcasAgua?.[tipo]?.path);
    config.marcasAgua[tipo] = { path: filePath, filename, mimetype: req.file.mimetype, bytes: req.file.size, updatedAt: new Date() };
    await config.save();
    res.json({ message: "Marca de agua actualizada correctamente", type: "Correcto", data: config });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.eliminarMarcaAgua = async (req, res) => {
  try {
    const tipo = normalize(req.params.tipo);
    if (!["INACAL", "NAC", "SIN_ACREDITACION"].includes(tipo)) return res.status(400).json({ message: "Tipo de marca de agua no válido" });
    const config = await getConfig();
    await removeStoredFile(config.marcasAgua?.[tipo]?.path);
    if (!config.marcasAgua) config.marcasAgua = {};
    config.marcasAgua[tipo] = undefined;
    config.markModified("marcasAgua");
    await config.save();
    res.json({ message: "Marca de agua eliminada correctamente", type: "Correcto", data: config });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.listar = async (req, res) => {
  const { page = 0, limit = 10, search = "" } = req.query;
  try {
    const filter = search
      ? { $or: [{ codigo: { $regex: search, $options: "i" } }, { idAcceso: { $regex: search, $options: "i" } }, { estado: { $regex: search, $options: "i" } }] }
      : {};
    const [data, total] = await Promise.all([
      Informe.find(filter)
        .sort({ createdAt: -1 })
        .skip(Number(page) * Number(limit))
        .limit(Number(limit))
        .populate("proyectoId clienteId", "nombre cliente")
        .lean(),
      Informe.countDocuments(filter),
    ]);

    res.json({
      data: data.map((item) => ({
        ...item,
        ...(() => {
          const versionActual = item.versiones?.find((version) => version.numero === item.versionActual);
          const originalFilename = versionActual?.original?.filename || item.migracion?.archivoLegacy || "";
          return {
            ...parseInformeFilename(originalFilename),
            archivoOriginal: originalFilename,
            archivoGenerado: versionActual?.publicado?.filename || "",
            urlConsulta: portalUrl(),
          };
        })(),
      })),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.procesar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Debes enviar un PDF de hasta 50 MB" });

    const { codigo: codigoBody, reemplazar = "false", proyectoId, clienteId, tipoPlantilla = "SIN_ACREDITACION", motivo = "Carga inicial" } = req.body;
    const codigo = normalize(codigoBody || detectCode(req.file.originalname));
    if (!codigo) return res.status(400).json({ message: "No se pudo detectar el código del informe desde el nombre del PDF" });

    let report = await Informe.findOne({ codigo });
    if (report && reemplazar !== "true") {
      return res.status(409).json({
        message: "El informe ya existe. ¿Desea reemplazarlo?",
        exists: true,
        data: { _id: report._id, codigo: report.codigo, estado: report.estado, versionActual: report.versionActual },
      });
    }

    if (!report) {
      const idAcceso = await uniqueAccessId();
      report = new Informe({
        codigo,
        idAcceso,
        proyectoId: proyectoId || undefined,
        clienteId: clienteId || undefined,
        tokenPublico: crypto.randomBytes(18).toString("base64url"),
        claveAccesoHash: await bcrypt.hash(idAcceso, 12),
        estado: "DISPONIBLE",
        plantilla: { tipo: tipoPlantilla },
      });
    } else {
      if (!report.idAcceso) {
        report.idAcceso = await uniqueAccessId();
        report.claveAccesoHash = await bcrypt.hash(report.idAcceso, 12);
      }
      if (["BORRADOR", "PROCESADO", "PUBLICADO"].includes(report.estado)) report.estado = "DISPONIBLE";
      if (report.estado === "ANULADO") report.estado = "NO DISPONIBLE";
    }

    const nextVersion = report.versionActual + 1;
    const originalFilename = filenameFor(codigo, nextVersion, "original", req.file.originalname);
    const processedFilename = filenameFor(codigo, nextVersion, "publicado", req.file.originalname);
    const processedBuffer = await protectPdfIfAvailable(await processPdf(req.file.buffer, report));
    const originalPath = await saveFile(codigo, nextVersion, originalFilename, req.file.buffer);
    const processedPath = await saveFile(codigo, nextVersion, processedFilename, processedBuffer);

    report.versionActual = nextVersion;
    report.plantilla = { ...report.plantilla, tipo: tipoPlantilla };
    report.versiones.push({
      numero: nextVersion,
      original: { path: originalPath, filename: originalFilename, bytes: req.file.size },
      publicado: { path: processedPath, filename: processedFilename, bytes: processedBuffer.length },
      procesadoPor: actor(req),
      motivo,
    });
    if (!report.estado) report.estado = "DISPONIBLE";
    audit(report, req, nextVersion === 1 ? "REGISTRADO" : "REEMPLAZADO", motivo);
    await report.save();

    res.status(201).json({
      message: nextVersion === 1 ? "Informe registrado correctamente" : "Informe reemplazado correctamente",
      type: "Correcto",
      data: report,
      idAcceso: report.idAcceso,
      urlConsulta: portalUrl(),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.publicar = async (req, res) => {
  try {
    const report = await Informe.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Informe no encontrado" });
    if (!report.versionActual) return res.status(400).json({ message: "El informe aún no tiene una versión procesada" });
    if (report.estado === "DISPONIBLE") return res.status(400).json({ message: "El informe ya está disponible" });
    report.estado = "DISPONIBLE";
    audit(report, req, "DISPONIBLE", "Disponible para consulta pública");
    await report.save();
    res.json({ message: "Informe disponible correctamente", type: "Correcto", data: report, urlConsulta: portalUrl() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.anular = async (req, res) => {
  try {
    const report = await Informe.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Informe no encontrado" });
    if (report.estado === "NO DISPONIBLE") return res.status(400).json({ message: "El informe ya está no disponible" });
    report.estado = "NO DISPONIBLE";
    audit(report, req, "NO DISPONIBLE", req.body?.motivo || "Informe marcado como no disponible desde ECOSOFT");
    await report.save();
    res.json({ message: "Informe marcado como no disponible", type: "Correcto", data: report });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.archivoAdmin = async (req, res) => {
  try {
    const report = await Informe.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Informe no encontrado" });
    const version = report.versiones.find((item) => item.numero === report.versionActual);
    const filePath = assertInsideStorage(version?.publicado?.path || "");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${req.query.download === "true" ? "attachment" : "inline"}; filename="${version.publicado.filename}"`);
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.consultar = async (req, res) => {
  try {
    const codigo = normalize(req.body.codigo);
    const idAcceso = normalize(req.body.idAcceso || req.body.claveAcceso);
    const report = await Informe.findOne({ codigo, estado: "DISPONIBLE" });
    if (!report || !(await bcrypt.compare(idAcceso || "", report.claveAccesoHash))) {
      return res.status(404).json({ message: "Informe o ID de acceso no válidos" });
    }
    res.json({ codigo: report.codigo, idAcceso: report.idAcceso, version: report.versionActual, viewToken: createViewToken(report) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.archivoPublico = async (req, res) => {
  try {
    const payload = verifyViewToken(req.query.token);
    if (!payload) return res.status(403).json({ message: "Acceso vencido o no válido" });
    const report = await Informe.findOne({ _id: payload.id, estado: "DISPONIBLE" });
    if (!report || report.versionActual !== payload.version) return res.status(404).json({ message: "Informe no disponible" });
    const version = report.versiones.find((item) => item.numero === report.versionActual);
    const filePath = assertInsideStorage(version?.publicado?.path || "");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${req.query.download === "true" ? "attachment" : "inline"}; filename="${version.publicado.filename}"`);
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
