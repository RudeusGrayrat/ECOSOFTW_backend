const crypto = require("crypto");
const { execFile } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { promisify } = require("util");
const bcrypt = require("bcrypt");
const multer = require("multer");
const nodemailer = require("nodemailer");
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

exports.upload = upload.fields([{ name: "archivos", maxCount: 50 }, { name: "archivo", maxCount: 1 }]);
exports.uploadAsset = uploadAsset.single("archivo");

const actor = (req) => req.user?._id;
const audit = (report, req, accion, detalle) => report.auditoria.push({ accion, usuario: actor(req), detalle });
const portalUrl = () => `${process.env.PUBLIC_REPORT_URL || process.env.FRONTEND_URL || "http://localhost:5174"}/consulta-informes`;
const normalize = (value) => (value || "").toString().trim().toUpperCase();
const safeSegment = (value) => normalize(value).replace(/[^A-Z0-9-]/g, "_");
const cm = (value) => value * 28.3464567;
const selloLayout = {
  qrX: cm(5.75),
  qrY: cm(3.55),
  qrSize: cm(3.5),
  idGap: cm(0.35),
  firmaX: cm(10.25),
  firmaY: cm(3.1),
  firmaSize: cm(5),
};

const tiposMarcaAgua = ["INACAL", "NAC", "SIN_ACREDITACION", "VERSION_PRELIMINAR"];
const tiposAcreditacion = ["INACAL", "NAC", "SIN_ACREDITACION"];

const detectCode = (filename = "") => {
  const baseName = path.basename(filename, path.extname(filename)).trim().toUpperCase();
  const codeMatch = baseName.match(/^([A-Z]*_?IE_)?(\d{6}(?:-I)?)/i) || baseName.match(/^(\d{6}(?:-I)?)/);
  if (codeMatch) return normalize(codeMatch[2] || codeMatch[1]);
  return "";
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
  const codigo = detectCode(cleanName);
  const pmMatch = cleanName.match(/\(\s*PM\s+([^)]+)\)/i);
  const afterPm = cleanName.split(/\)\s*/).slice(1).join(") ").trim();
  const matrizMatch = afterPm.match(/-\s*([^-()]+)$/) || cleanName.match(/-\s*([^-()]+)$/);
  const cliente = afterPm.replace(/-\s*([^-()]+)$/, "").trim();

  return {
    codigo,
    planMonitoreo: pmMatch?.[1]?.replace(/\s+/g, " ").trim().toUpperCase() || "",
    cliente: cliente.toUpperCase(),
    matriz: matrizMatch?.[1]?.replace(/\s+/g, " ").trim().toUpperCase() || "",
  };
};

const randomAccessId = () => crypto.randomBytes(12).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();

async function uniqueAccessId() {
  let idAcceso = randomAccessId();
  while (await Informe.exists({ idAcceso })) idAcceso = randomAccessId();
  return idAcceso;
}

async function accessIdForPlan(planMonitoreo) {
  if (!planMonitoreo) return uniqueAccessId();
  const existing = await Informe.findOne({
    planMonitoreo,
    idAcceso: { $exists: true, $ne: "" },
  }).select("idAcceso claveAccesoHash").lean();
  return existing?.idAcceso || uniqueAccessId();
}

const filenameFor = (codigo, version, type, originalName = "") => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const originalBase = path.basename(originalName || codigo, path.extname(originalName || codigo)).replace(/[^a-zA-Z0-9-_ ]/g, "").trim();
  if (type === "oficial") return `IE_${safeSegment(codigo)}_${date}_v${version}.pdf`;
  if (type === "preliminar") return `${safeSegment(originalBase || codigo)}_${date}_v${version}_preliminar.pdf`;
  if (type === "borrador") return `${safeSegment(originalBase || codigo)}_${date}_v${version}_borrador.pdf`;
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

async function processPdf(source, report, options = {}) {
  const {
    tipoMarcaAgua = report.plantilla?.tipo,
    includeAccessSeal = true,
    includeFirma = true,
  } = options;
  const originalPdf = await PDFDocument.load(source);
  const config = await getConfig();
  const watermark = config.marcasAgua?.[tipoMarcaAgua];
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

  const font = await pdf.embedFont(StandardFonts.Helvetica);

  if (includeAccessSeal) {
    const qr = await QRCode.toDataURL(portalUrl(), { margin: 1, width: 280 });
    const qrImage = await pdf.embedPng(qr);
    const qrX = selloLayout.qrX;
    const qrY = selloLayout.qrY;
    const qrSize = selloLayout.qrSize;
    const idText = `ID: ${report.idAcceso}`;
    const idX = qrX + ((qrSize - font.widthOfTextAtSize(idText, 11)) / 2);
    const idY = qrY - selloLayout.idGap;

    firstPage.drawRectangle({ x: qrX - 4, y: qrY - 4, width: qrSize + 8, height: qrSize + 24, color: rgb(1, 1, 1), opacity: 0.92 });
    firstPage.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    firstPage.drawText(idText, { x: idX, y: idY, size: 11, font, color: rgb(0, 0, 0) });
  }

  if (includeFirma && config.firma?.path) {
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

async function enviarCorreoLiberacion(report, req, options = {}) {
  const destinatario = normalize(options.correoCliente).toLowerCase();
  if (!destinatario) return false;

  const smtpUser = process.env.EMAIL_ECOLOGY;
  const smtpPass = process.env.PASS_ECOLOGY;
  const smtpHost = process.env.SMTP_ECOLOGY;
  if (!smtpUser || !smtpPass || !smtpHost) throw new Error("Faltan credenciales SMTP para enviar el correo");

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true") !== "false",
    auth: { user: smtpUser, pass: smtpPass },
  });

  const remitenteUsuario = req.user?.correoElectronico || smtpUser;
  const asunto = options.asunto || `Informe de ensayo ${report.codigo} liberado`;
  const mensaje = options.mensaje || "Estimado cliente, su informe de ensayo ya se encuentra disponible para consulta.";
  const consulta = portalUrl();

  await transporter.sendMail({
    from: `"${req.user?.colaborador || "ECOSOFT"}" <${smtpUser}>`,
    replyTo: remitenteUsuario,
    to: destinatario,
    subject: asunto,
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
        <p>${mensaje}</p>
        <p><strong>Código:</strong> ${report.codigo}</p>
        <p><strong>Plan de monitoreo:</strong> ${report.planMonitoreo || "-"}</p>
        <p><strong>Matriz:</strong> ${report.matriz || "-"}</p>
        <p><strong>ID de acceso:</strong> ${report.idAcceso}</p>
        <p><strong>Portal de consulta:</strong> <a href="${consulta}">${consulta}</a></p>
      </div>
    `,
  });

  return true;
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
    if (!tiposMarcaAgua.includes(tipo)) return res.status(400).json({ message: "Tipo de marca de agua no válido" });
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
    if (!tiposMarcaAgua.includes(tipo)) return res.status(400).json({ message: "Tipo de marca de agua no válido" });
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
  const { page = 0, limit = 10, search = "", papelera = "false" } = req.query;
  try {
    const searchable = search
      ? {
        $or: [
          { codigo: { $regex: search, $options: "i" } },
          { planMonitoreo: { $regex: search, $options: "i" } },
          { cliente: { $regex: search, $options: "i" } },
          { matriz: { $regex: search, $options: "i" } },
          { idAcceso: { $regex: search, $options: "i" } },
          { estado: { $regex: search, $options: "i" } },
          { acreditacion: { $regex: search, $options: "i" } },
        ],
      }
      : {};
    const papeleraFilter = papelera === "true"
      ? { papelera: true }
      : { $or: [{ papelera: false }, { papelera: { $exists: false } }] };
    const filter = search ? { $and: [searchable, papeleraFilter] } : papeleraFilter;
    const [data, total] = await Promise.all([
      Informe.find(filter)
        .sort({ createdAt: -1 })
        .skip(Number(page) * Number(limit))
        .limit(Number(limit))
        .populate("proyectoId clienteId", "nombre cliente correoElectronico")
        .lean(),
      Informe.countDocuments(filter),
    ]);

    res.json({
      data: data.map((item) => ({
        ...item,
        ...(() => {
          const versionActual = item.versiones?.find((version) => version.numero === item.versionActual);
          const originalFilename = versionActual?.original?.filename || item.migracion?.archivoLegacy || "";
          const parsed = parseInformeFilename(originalFilename);
          const estadoNormalizado = item.estado === "DISPONIBLE" ? "LIBERADO" : item.estado === "NO DISPONIBLE" ? "BORRADOR" : item.estado;
          return {
            planMonitoreo: item.planMonitoreo || parsed.planMonitoreo,
            pm: item.planMonitoreo || parsed.planMonitoreo,
            cliente: item.cliente || parsed.cliente,
            matriz: item.matriz || parsed.matriz,
            acreditacion: item.acreditacion || item.plantilla?.tipo || "SIN_ACREDITACION",
            tipoVersion: item.tipoVersion || versionActual?.tipo || (estadoNormalizado === "LIBERADO" ? "OFICIAL" : estadoNormalizado),
            vistoBuenoJefatura: Boolean(item.vistoBuenoJefatura || estadoNormalizado === "LIBERADO" || estadoNormalizado === "PRELIMINAR"),
            estado: estadoNormalizado,
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

async function guardarBorrador(req, file, body, metadata = {}) {
  const { codigo: codigoBody, reemplazar = "false", proyectoId, clienteId, tipoPlantilla = "SIN_ACREDITACION" } = body;
  const parsed = parseInformeFilename(file.originalname);
  const codigo = normalize(metadata.codigo || codigoBody || parsed.codigo || detectCode(file.originalname));
  const acreditacion = normalize(tipoPlantilla || "SIN_ACREDITACION");
  if (!codigo) throw new Error("No se pudo detectar el código del informe desde el nombre del PDF");
  if (!tiposAcreditacion.includes(acreditacion)) throw new Error("Tipo de acreditación no válido");

  let report = await Informe.findOne({ codigo });
  if (report && reemplazar !== "true") {
    return {
      conflict: true,
      data: { _id: report._id, codigo: report.codigo, estado: report.estado, versionActual: report.versionActual, archivo: file.originalname },
    };
  }

  const planMonitoreo = normalize(metadata.planMonitoreo || body.planMonitoreo || parsed.planMonitoreo);
  if (!report) {
    const idAcceso = await accessIdForPlan(planMonitoreo);
    report = new Informe({
      codigo,
      idAcceso,
      proyectoId: proyectoId || undefined,
      clienteId: clienteId || undefined,
      tokenPublico: crypto.randomBytes(18).toString("base64url"),
      claveAccesoHash: await bcrypt.hash(idAcceso, 12),
    });
  } else if (!report.idAcceso) {
    report.idAcceso = await uniqueAccessId();
    report.claveAccesoHash = await bcrypt.hash(report.idAcceso, 12);
  }

  const nextVersion = report.versionActual + 1;
  const originalFilename = filenameFor(codigo, nextVersion, "original", file.originalname);
  const processedFilename = filenameFor(codigo, nextVersion, "borrador", file.originalname);
  const originalPath = await saveFile(codigo, nextVersion, originalFilename, file.buffer);
  const processedPath = await saveFile(codigo, nextVersion, processedFilename, file.buffer);

  report.codigo = codigo;
  report.planMonitoreo = planMonitoreo;
  report.cliente = normalize(metadata.cliente || body.cliente || parsed.cliente);
  report.matriz = normalize(metadata.matriz || body.matriz || parsed.matriz);
  report.acreditacion = acreditacion;
  report.estado = "BORRADOR";
  report.tipoVersion = "BORRADOR";
  report.vistoBuenoJefatura = false;
  report.papelera = false;
  report.eliminadoEn = undefined;
  report.eliminadoPor = undefined;
  report.plantilla = { ...report.plantilla, tipo: acreditacion };
  report.versionActual = nextVersion;
  report.versiones.push({
    numero: nextVersion,
    tipo: "BORRADOR",
    original: { path: originalPath, filename: originalFilename, bytes: file.size },
    publicado: { path: processedPath, filename: processedFilename, bytes: file.size },
    procesadoPor: actor(req),
  });
  audit(report, req, nextVersion === 1 ? "BORRADOR CARGADO" : "BORRADOR REEMPLAZADO", file.originalname);
  await report.save();

  return { conflict: false, data: report };
}

exports.procesar = async (req, res) => {
  try {
    const files = [
      ...(req.files?.archivos || []),
      ...(req.files?.archivo || []),
    ];
    if (!files.length) return res.status(400).json({ message: "Debes enviar uno o varios PDF de hasta 50 MB" });
    let metadataRows = [];
    try {
      metadataRows = req.body?.metadata ? JSON.parse(req.body.metadata) : [];
    } catch (_) {
      return res.status(400).json({ message: "La previsualización de archivos llegó con un formato inválido" });
    }

    const resultados = [];
    const conflictos = [];
    for (const [index, file] of files.entries()) {
      try {
        const metadata = metadataRows.find((item) => item.filename === file.originalname) || metadataRows[index] || {};
        const result = await guardarBorrador(req, file, req.body, metadata);
        if (result.conflict) conflictos.push(result.data);
        else resultados.push(result.data);
      } catch (error) {
        conflictos.push({ archivo: file.originalname, message: error.message });
      }
    }

    if (!resultados.length && conflictos.length === 1 && conflictos[0]?._id) {
      return res.status(409).json({
        message: "El informe ya existe. ¿Desea reemplazarlo?",
        exists: true,
        data: conflictos[0],
      });
    }

    res.status(resultados.length ? 201 : 400).json({
      message: resultados.length === 1 ? "Borrador cargado correctamente" : `${resultados.length} borradores cargados correctamente`,
      type: resultados.length ? "Correcto" : "Error",
      data: resultados,
      conflicts: conflictos,
      idAcceso: resultados[0]?.idAcceso,
      urlConsulta: portalUrl(),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

async function regenerarVersion(report, req, tipoVersion, tipoMarcaAgua, includeFirma, includeAccessSeal) {
  const version = report.versiones.find((item) => item.numero === report.versionActual);
  if (!version?.original?.path) throw new Error("El informe no tiene archivo original para procesar");
  const source = await fs.readFile(assertInsideStorage(version.original.path));
  const processedBuffer = await protectPdfIfAvailable(await processPdf(source, report, { tipoMarcaAgua, includeFirma, includeAccessSeal }));
  const filename = filenameFor(report.codigo, report.versionActual, tipoVersion === "OFICIAL" ? "oficial" : "preliminar", version.original.filename);
  const processedPath = await saveFile(report.codigo, report.versionActual, filename, processedBuffer);
  version.tipo = tipoVersion;
  version.publicado = { path: processedPath, filename, bytes: processedBuffer.length };
  version.procesadoPor = actor(req);
  version.creadoEn = new Date();
  report.markModified("versiones");
}

exports.aprobar = async (req, res) => {
  try {
    const report = await Informe.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Informe no encontrado" });
    if (report.papelera) return res.status(400).json({ message: "Restablece el informe antes de aprobarlo" });
    if (!report.versionActual) return res.status(400).json({ message: "El informe aún no tiene una versión cargada" });
    if (report.estado === "PRELIMINAR" || report.estado === "LIBERADO") return res.status(400).json({ message: "El informe ya tiene visto bueno de jefatura" });
    await regenerarVersion(report, req, "PRELIMINAR", "VERSION_PRELIMINAR", false, false);
    report.estado = "PRELIMINAR";
    report.tipoVersion = "PRELIMINAR";
    report.vistoBuenoJefatura = true;
    audit(report, req, "VISTO BUENO JEFATURA", "Borrador aprobado como version preliminar");
    await report.save();
    res.json({ message: "Informe aprobado como versión preliminar", type: "Correcto", data: report, urlConsulta: portalUrl() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.liberar = async (req, res) => {
  try {
    const report = await Informe.findById(req.params.id).populate("clienteId", "cliente correoElectronico");
    if (!report) return res.status(404).json({ message: "Informe no encontrado" });
    if (report.papelera) return res.status(400).json({ message: "Restablece el informe antes de liberarlo" });
    if (!report.vistoBuenoJefatura && report.estado !== "PRELIMINAR") return res.status(400).json({ message: "El informe necesita visto bueno de jefatura antes de liberarse" });
    await regenerarVersion(report, req, "OFICIAL", report.acreditacion || report.plantilla?.tipo || "SIN_ACREDITACION", true, true);
    report.estado = "LIBERADO";
    report.tipoVersion = "OFICIAL";
    audit(report, req, "LIBERADO", "Informe oficial liberado para consulta publica");
    const correoEnviado = await enviarCorreoLiberacion(report, req, {
      correoCliente: req.body?.correoCliente || report.clienteId?.correoElectronico,
      asunto: req.body?.asunto,
      mensaje: req.body?.mensaje,
    });
    if (correoEnviado) audit(report, req, "CORREO ENVIADO", `Correo de liberacion enviado a ${req.body?.correoCliente || report.clienteId?.correoElectronico}`);
    await report.save();
    res.json({ message: correoEnviado ? "Informe liberado y correo enviado correctamente" : "Informe liberado correctamente", type: "Correcto", data: report, urlConsulta: portalUrl() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.enviarPapelera = async (req, res) => {
  try {
    const report = await Informe.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Informe no encontrado" });
    if (report.papelera) return res.status(400).json({ message: "El informe ya está en papelera" });
    report.papelera = true;
    report.eliminadoEn = new Date();
    report.eliminadoPor = actor(req);
    audit(report, req, "ENVIADO A PAPELERA", "Eliminación lógica desde ECOSOFT");
    await report.save();
    res.json({ message: "Informe enviado a papelera", type: "Correcto", data: report });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.restablecer = async (req, res) => {
  try {
    const report = await Informe.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Informe no encontrado" });
    if (!report.papelera) return res.status(400).json({ message: "El informe no está en papelera" });
    report.papelera = false;
    report.eliminadoEn = undefined;
    report.eliminadoPor = undefined;
    audit(report, req, "RESTABLECIDO", "Informe restaurado desde papelera");
    await report.save();
    res.json({ message: "Informe restablecido correctamente", type: "Correcto", data: report });
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
    const report = await Informe.findOne({ codigo, estado: { $in: ["LIBERADO", "DISPONIBLE"] }, papelera: { $ne: true } });
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
    const report = await Informe.findOne({ _id: payload.id, estado: { $in: ["LIBERADO", "DISPONIBLE"] }, papelera: { $ne: true } });
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
