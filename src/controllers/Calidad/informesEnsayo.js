const crypto = require("crypto");
const { execFile } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { promisify } = require("util");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const multer = require("multer");
const nodemailer = require("nodemailer");
const archiver = require("archiver");
const QRCode = require("qrcode");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const Informe = require("../../Models/Calidad/InformeEnsayo");
const InformeConfig = require("../../Models/Calidad/InformeEnsayoConfig");
const escapeRegExp = require("../../utils/escapeRegex");

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
const escapeHtml = (value = "") => value.toString()
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");
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

const tiposMarcaAgua = ["INACAL", "NAC", "SIN_ACREDITACION", "VERSION_PRELIMINAR"];
const tiposAcreditacion = ["INACAL", "NAC", "SIN_ACREDITACION"];

const sanitizeObjectIds = (ids = []) => {
  const uniqueIds = Array.from(new Set((Array.isArray(ids) ? ids : []).map((id) => id?.toString()).filter(Boolean)));
  const invalidIds = uniqueIds.filter((id) => !mongoose.isValidObjectId(id));
  const validIds = uniqueIds.filter((id) => mongoose.isValidObjectId(id));
  return { validIds, invalidIds };
};

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

const safeFilenameBase = (value) => path.basename(value || "", path.extname(value || ""))
  .replace(/[^a-zA-Z0-9-_ ()]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const filenameFor = (codigo, version, type, originalName = "") => {
  const originalBase = safeFilenameBase(originalName || codigo);
  if (type === "oficial") return `IE_${safeSegment(codigo)}.pdf`;
  if (type === "preliminar") return `PRELIMINAR_${safeSegment(codigo)}.pdf`;
  if (type === "borrador") return `${originalBase || safeSegment(codigo)}_borrador.pdf`;
  return type === "publicado"
    ? `IE_${safeSegment(codigo)}.pdf`
    : `${originalBase || safeSegment(codigo)}.pdf`;
};

const cleanOriginalVisibleName = (filename = "") => {
  if (!filename) return "";
  const extension = path.extname(filename) || ".pdf";
  const baseName = path.basename(filename, extension)
    .replace(/_\d{8}_v\d+_original$/i, "")
    .replace(/_v\d+_original$/i, "")
    .replace(/_original$/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${baseName}${extension}`;
};

const visibleProcessedName = (report, version) => {
  const tipo = normalize(version?.tipo || report.tipoVersion);
  if (tipo === "OFICIAL" || report.estado === "LIBERADO" || report.estado === "DISPONIBLE") return `IE_${safeSegment(report.codigo)}.pdf`;
  if (tipo === "PRELIMINAR" || report.estado === "PRELIMINAR") return `PRELIMINAR_${safeSegment(report.codigo)}.pdf`;
  return "";
};

const normalizeVersionType = (report, version) => {
  if (version?.tipo && version.tipo !== "BORRADOR") return version.tipo;
  if (report.tipoVersion === "OFICIAL" || report.estado === "LIBERADO" || report.estado === "DISPONIBLE") return "OFICIAL";
  if (report.tipoVersion === "PRELIMINAR" || report.estado === "PRELIMINAR") return "PRELIMINAR";
  return "BORRADOR";
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
  const isPreliminar = tipoMarcaAgua === "VERSION_PRELIMINAR";

  if (watermark?.path) {
    const watermarkedPdf = await PDFDocument.create();
    const watermarkBytes = await fs.readFile(assertInsideStorage(watermark.path));
    const [watermarkPage] = await watermarkedPdf.embedPdf(watermarkBytes, [0]);
    const originalPages = await watermarkedPdf.embedPages(originalPdf.getPages());

    originalPdf.getPages().forEach((originalPage, index) => {
      const { width, height } = originalPage.getSize();
      const page = watermarkedPdf.addPage([width, height]);
      if (isPreliminar) {
        page.drawPage(originalPages[index], { x: 0, y: 0, width, height });
        page.drawPage(watermarkPage, { x: 0, y: 0, width, height, opacity: 0.35 });
      } else {
        page.drawPage(watermarkPage, { x: 0, y: 0, width, height });
        page.drawPage(originalPages[index], { x: 0, y: 0, width, height });
      }
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

  const correoUsuario = (req.user?.correoElectronico || "").trim().toLowerCase();
  if (!correoUsuario) throw new Error("Tu usuario no tiene un correo configurado para enviar mensajes");

  const smtpUser = process.env.EMAIL_CALIDAD || process.env.EMAIL_ECOLOGY;
  const smtpPass = process.env.PASS_CALIDAD || process.env.PASS_ECOLOGY;
  const smtpHost = process.env.SMTP_CALIDAD || process.env.SMTP_ECOLOGY;
  if (!smtpUser || !smtpPass || !smtpHost) throw new Error("No está configurado el correo de Calidad para enviar informes");
  const smtpPort = Number(process.env.SMTP_CALIDAD_PORT || process.env.SMTP_PORT || 465);
  const smtpSecure = process.env.SMTP_CALIDAD_SECURE || process.env.SMTP_SECURE;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure ? String(smtpSecure) !== "false" : smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 5000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 5000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 15000),
    tls: {
      rejectUnauthorized: String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || "true") !== "false",
    },
  });

  const asunto = options.asunto || `Informe de ensayo ${report.codigo} liberado`;
  const mensaje = options.mensaje || "Estimado cliente, su informe de ensayo ya se encuentra disponible para consulta.";
  const consulta = portalUrl();
  const colaborador = req.user?.colaborador || req.user?.userName || "Area de Calidad";

  await transporter.sendMail({
    from: `"ECOSOFT - Calidad" <${smtpUser}>`,
    replyTo: correoUsuario,
    to: destinatario,
    subject: asunto,
    html: `
      <div style="margin:0;padding:0;background:#f3f7f4;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
        <div style="max-width:680px;margin:0 auto;padding:32px 18px;">
          <div style="background:linear-gradient(135deg,#4fa36f,#2f6f4c);border-radius:24px 24px 0 0;padding:28px 32px;color:#ffffff;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">ECOSOFT | Calidad</p>
            <h1 style="margin:0;font-size:28px;line-height:1.2;">Informe de ensayo disponible</h1>
          </div>
          <div style="background:#ffffff;border:1px solid #e5eee8;border-top:0;border-radius:0 0 24px 24px;padding:30px 32px;box-shadow:0 18px 45px rgba(31,41,55,.10);">
            <p style="margin:0 0 22px;font-size:16px;line-height:1.65;">${escapeHtml(mensaje)}</p>
            <div style="display:grid;gap:10px;margin:24px 0;padding:18px;border-radius:18px;background:#f8faf9;border:1px solid #e5eee8;">
              <p style="margin:0;"><strong>Codigo:</strong> ${escapeHtml(report.codigo)}</p>
              <p style="margin:0;"><strong>Plan de monitoreo:</strong> ${escapeHtml(report.planMonitoreo || "-")}</p>
              <p style="margin:0;"><strong>Matriz:</strong> ${escapeHtml(report.matriz || "-")}</p>
              <p style="margin:0;"><strong>ID de acceso:</strong> <span style="font-size:18px;font-weight:800;color:#2f6f4c;">${escapeHtml(report.idAcceso)}</span></p>
            </div>
            <a href="${consulta}" style="display:inline-block;background:#2f6f4c;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px;">Consultar informe</a>
            <p style="margin:24px 0 0;font-size:13px;color:#64748b;line-height:1.6;">
              Si necesita responder este mensaje, puede hacerlo directamente. Su respuesta llegara a ${escapeHtml(colaborador)} (${escapeHtml(correoUsuario)}).
            </p>
          </div>
        </div>
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
  const {
    page = 0,
    limit = 10,
    search = "",
    papelera = "false",
    codigo = "",
    planMonitoreo = "",
    cliente = "",
    matriz = "",
    idAcceso = "",
    acreditacion = "",
    estado = "",
    vistoBuenoJefatura = "",
    filters: tableFilterPayload = "",
    sortField = "createdAt",
    sortOrder = -1,
  } = req.query;
  try {
    const regex = (value) => ({ $regex: escapeRegExp(value), $options: "i" });
    const searchable = search
      ? {
        $or: [
          { codigo: regex(search) },
          { planMonitoreo: regex(search) },
          { cliente: regex(search) },
          { matriz: regex(search) },
          { idAcceso: regex(search) },
          { estado: regex(search) },
          { acreditacion: regex(search) },
        ],
      }
      : {};
    const papeleraFilter = papelera === "true"
      ? { papelera: true }
      : { $or: [{ papelera: false }, { papelera: { $exists: false } }] };
    const filterParts = [papeleraFilter];
    if (search) filterParts.push(searchable);
    if (codigo) filterParts.push({ codigo: regex(codigo) });
    if (planMonitoreo) filterParts.push({ planMonitoreo: regex(planMonitoreo) });
    if (cliente) filterParts.push({ cliente: regex(cliente) });
    if (matriz) filterParts.push({ matriz: regex(matriz) });
    if (idAcceso) filterParts.push({ idAcceso: regex(idAcceso) });
    if (acreditacion) filterParts.push({ acreditacion: normalize(acreditacion) });
    if (estado) filterParts.push({ estado: normalize(estado) === "LIBERADO" ? { $in: ["LIBERADO", "DISPONIBLE"] } : normalize(estado) });
    if (vistoBuenoJefatura === "SI") {
      filterParts.push({ $or: [{ vistoBuenoJefatura: true }, { estado: { $in: ["PRELIMINAR", "LIBERADO", "DISPONIBLE"] } }] });
    }
    if (vistoBuenoJefatura === "NO") {
      filterParts.push({
        $and: [
          { $or: [{ vistoBuenoJefatura: false }, { vistoBuenoJefatura: { $exists: false } }] },
          { estado: { $nin: ["PRELIMINAR", "LIBERADO", "DISPONIBLE"] } },
        ],
      });
    }
    const textCondition = (field, value, matchMode = "contains") => {
      const safeValue = escapeRegExp(value);
      const pattern = matchMode === "startsWith"
        ? `^${safeValue}`
        : matchMode === "endsWith"
          ? `${safeValue}$`
          : matchMode === "equals"
            ? `^${safeValue}$`
            : safeValue;
      const expression = new RegExp(pattern, "i");
      return matchMode === "notEquals" ? { [field]: { $not: expression } } : { [field]: expression };
    };
    const exactCondition = (field, value) => {
      const normalized = normalize(value);
      if (field === "estado" && normalized === "LIBERADO") return { estado: { $in: ["LIBERADO", "DISPONIBLE"] } };
      if (field === "vistoBuenoJefatura" && normalized === "SI") {
        return { $or: [{ vistoBuenoJefatura: true }, { estado: { $in: ["PRELIMINAR", "LIBERADO", "DISPONIBLE"] } }] };
      }
      if (field === "vistoBuenoJefatura" && normalized === "NO") {
        return {
          $and: [
            { $or: [{ vistoBuenoJefatura: false }, { vistoBuenoJefatura: { $exists: false } }] },
            { estado: { $nin: ["PRELIMINAR", "LIBERADO", "DISPONIBLE"] } },
          ],
        };
      }
      return { [field]: normalized };
    };
    const addPrimeTableFilters = () => {
      if (!tableFilterPayload) return;
      let parsedFilters = {};
      try {
        parsedFilters = JSON.parse(tableFilterPayload);
      } catch (_) {
        return;
      }

      const exactFields = ["acreditacion", "estado", "vistoBuenoJefatura"];
      const allowedFields = ["codigo", "planMonitoreo", "matriz", "idAcceso", ...exactFields];
      allowedFields.forEach((field) => {
        const meta = parsedFilters[field];
        if (!meta) return;
        const constraints = Array.isArray(meta.constraints) ? meta.constraints : [meta];
        const conditions = constraints
          .filter((constraint) => constraint?.value !== null && constraint?.value !== undefined && constraint?.value !== "")
          .map((constraint) => exactFields.includes(field)
            ? exactCondition(field, constraint.value)
            : textCondition(field, constraint.value, constraint.matchMode));
        if (!conditions.length) return;
        filterParts.push(meta.operator === "or" ? { $or: conditions } : { $and: conditions });
      });
    };
    addPrimeTableFilters();
    const filter = { $and: filterParts };
    const sortableFields = ["codigo", "planMonitoreo", "matriz", "idAcceso", "acreditacion", "vistoBuenoJefatura", "estado", "createdAt"];
    const sortKey = sortableFields.includes(sortField) ? sortField : "createdAt";
    const sortDirection = Number(sortOrder) === 1 ? 1 : -1;
    const [data, total] = await Promise.all([
      Informe.find(filter)
        .sort({ [sortKey]: sortDirection })
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
          const versionesVisibles = (item.versiones || [])
            .map((version) => ({
              ...version,
              tipo: normalizeVersionType({ ...item, estado: estadoNormalizado }, version),
              originalVisible: cleanOriginalVisibleName(version.original?.filename || ""),
              procesadoVisible: visibleProcessedName({ ...item, estado: estadoNormalizado }, version),
            }))
            .filter((version) => version.tipo !== "BORRADOR" || estadoNormalizado === "BORRADOR");
          return {
            planMonitoreo: item.planMonitoreo || parsed.planMonitoreo,
            pm: item.planMonitoreo || parsed.planMonitoreo,
            cliente: item.cliente || parsed.cliente,
            matriz: item.matriz || parsed.matriz,
            acreditacion: item.acreditacion || item.plantilla?.tipo || "SIN_ACREDITACION",
            tipoVersion: item.tipoVersion || versionActual?.tipo || (estadoNormalizado === "LIBERADO" ? "OFICIAL" : estadoNormalizado),
            vistoBuenoJefatura: Boolean(item.vistoBuenoJefatura || estadoNormalizado === "LIBERADO" || estadoNormalizado === "PRELIMINAR"),
            estado: estadoNormalizado,
            archivoOriginal: cleanOriginalVisibleName(originalFilename),
            archivoGenerado: visibleProcessedName({ ...item, estado: estadoNormalizado }, versionActual) || versionActual?.publicado?.filename || "",
            versionesVisibles,
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
    await report.save();
    let correoEnviado = false;
    let correoError = "";
    if (req.body?.enviarCorreo) {
      try {
        correoEnviado = await enviarCorreoLiberacion(report, req, {
          correoCliente: req.body?.correoCliente || report.clienteId?.correoElectronico,
          asunto: req.body?.asunto,
          mensaje: req.body?.mensaje,
        });
        if (correoEnviado) {
          audit(report, req, "CORREO ENVIADO", `Correo de liberacion enviado a ${req.body?.correoCliente || report.clienteId?.correoElectronico}`);
          await report.save();
        }
      } catch (error) {
        correoError = error.message;
        audit(report, req, "CORREO NO ENVIADO", correoError);
        await report.save();
      }
    }
    res.json({
      message: correoEnviado
        ? "Informe liberado y correo enviado correctamente"
        : correoError
          ? `Informe liberado correctamente, pero no se pudo enviar el correo: ${correoError}`
          : "Informe liberado correctamente",
      type: correoError ? "Advertencia" : "Correcto",
      data: report,
      urlConsulta: portalUrl(),
    });
  } catch (error) {
    console.error("Error al liberar informe:", error);
    const smtpMessages = {
      ETIMEDOUT: "No se pudo conectar al servidor SMTP de Calidad desde este servidor. Revisa si el VPS tiene salida al puerto SMTP o prueba con el puerto 587.",
      ECONNREFUSED: "El servidor SMTP rechazó la conexión desde el VPS. Revisa host, puerto o firewall.",
      EAUTH: "El correo de Calidad rechazó el usuario o la contraseña configurados.",
    };
    res.status(500).json({ message: smtpMessages[error.code] || error.message });
  }
};

exports.aprobarMasivo = async (req, res) => {
  try {
    const { validIds, invalidIds } = sanitizeObjectIds(req.body?.ids);
    if (!validIds.length) return res.status(400).json({ message: "Selecciona al menos un informe válido para aprobar" });
    if (invalidIds.length) return res.status(400).json({ message: `Hay IDs de informe no válidos: ${invalidIds.join(", ")}` });

    const reports = await Informe.find({ _id: { $in: validIds }, papelera: { $ne: true } });
    const resultado = { procesados: 0, omitidos: [] };
    if (reports.length !== validIds.length) {
      resultado.omitidos.push(`${validIds.length - reports.length} informes no encontrados o en papelera`);
    }
    for (const report of reports) {
      try {
        if (!report.versionActual) throw new Error("sin versión cargada");
        if (report.estado !== "BORRADOR") throw new Error(`no está en BORRADOR, estado actual: ${report.estado}`);
        if (report.vistoBuenoJefatura) throw new Error("ya tiene visto bueno");
        await regenerarVersion(report, req, "PRELIMINAR", "VERSION_PRELIMINAR", false, false);
        report.estado = "PRELIMINAR";
        report.tipoVersion = "PRELIMINAR";
        report.vistoBuenoJefatura = true;
        audit(report, req, "VISTO BUENO JEFATURA", "Aprobación masiva como versión preliminar");
        await report.save();
        resultado.procesados += 1;
      } catch (error) {
        resultado.omitidos.push(`${report.codigo}: ${error.message}`);
      }
    }

    res.json({
      message: `${resultado.procesados} informes aprobados como versión preliminar`,
      type: resultado.omitidos.length ? "Advertencia" : "Correcto",
      ...resultado,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.liberarMasivo = async (req, res) => {
  try {
    const { validIds, invalidIds } = sanitizeObjectIds(req.body?.ids);
    if (!validIds.length) return res.status(400).json({ message: "Selecciona al menos un informe válido para liberar" });
    if (invalidIds.length) return res.status(400).json({ message: `Hay IDs de informe no válidos: ${invalidIds.join(", ")}` });

    const reports = await Informe.find({ _id: { $in: validIds }, papelera: { $ne: true } }).populate("clienteId", "cliente correoElectronico");
    const resultado = { procesados: 0, correosEnviados: 0, omitidos: [], correosNoEnviados: [] };
    if (reports.length !== validIds.length) {
      resultado.omitidos.push(`${validIds.length - reports.length} informes no encontrados o en papelera`);
    }
    for (const report of reports) {
      try {
        if (report.estado === "LIBERADO" || report.estado === "DISPONIBLE") throw new Error("ya está liberado");
        if (!report.vistoBuenoJefatura && report.estado !== "PRELIMINAR") throw new Error("necesita visto bueno de jefatura");
        await regenerarVersion(report, req, "OFICIAL", report.acreditacion || report.plantilla?.tipo || "SIN_ACREDITACION", true, true);
        report.estado = "LIBERADO";
        report.tipoVersion = "OFICIAL";
        audit(report, req, "LIBERADO", "Liberación masiva como informe oficial");
        await report.save();
        resultado.procesados += 1;

        if (req.body?.enviarCorreo) {
          try {
            const correoEnviado = await enviarCorreoLiberacion(report, req, {
              correoCliente: report.clienteId?.correoElectronico || req.body?.correoCliente,
              asunto: req.body?.asunto || `Informe de ensayo ${report.codigo} liberado`,
              mensaje: req.body?.mensaje,
            });
            if (correoEnviado) {
              audit(report, req, "CORREO ENVIADO", `Correo de liberación masiva enviado a ${report.clienteId?.correoElectronico || req.body?.correoCliente}`);
              await report.save();
              resultado.correosEnviados += 1;
            }
          } catch (error) {
            resultado.correosNoEnviados.push(`${report.codigo}: ${error.message}`);
            audit(report, req, "CORREO NO ENVIADO", error.message);
            await report.save();
          }
        }
      } catch (error) {
        resultado.omitidos.push(`${report.codigo}: ${error.message}`);
      }
    }

    res.json({
      message: `${resultado.procesados} informes liberados correctamente`,
      type: resultado.omitidos.length || resultado.correosNoEnviados.length ? "Advertencia" : "Correcto",
      ...resultado,
    });
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

async function appendReportToArchive(archive, report, options = {}) {
  const version = options.officialOnly
    ? officialVersionFor(report)
    : (report.versiones || []).find((item) => item.numero === report.versionActual);
  const filePath = version?.publicado?.path ? assertInsideStorage(version.publicado.path) : "";
  if (!filePath) return `${report.codigo}: sin archivo disponible`;

  try {
    await fs.access(filePath);
    archive.file(filePath, {
      name: options.officialOnly
        ? visibleProcessedName(report, version) || `IE_${safeSegment(report.codigo)}.pdf`
        : version.publicado.filename || `${safeSegment(report.codigo)}.pdf`,
    });
    return "";
  } catch (_) {
    return `${report.codigo}: archivo no encontrado`;
  }
}

async function sendReportsZip(res, informes, options = {}) {
  if (!informes.length) return res.status(404).json({ message: "No se encontraron informes para descargar" });

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${options.filename || "informes_seleccionados"}.zip"`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (error) => {
    throw error;
  });
  archive.pipe(res);

  let added = 0;
  const omitted = [];
  for (const report of informes) {
    const omitReason = await appendReportToArchive(archive, report, options);
    if (omitReason) omitted.push(omitReason);
    else added += 1;
  }

  if (omitted.length) archive.append(omitted.join("\n"), { name: "omitidos.txt" });
  if (!added) archive.append("No se encontraron archivos físicos para los informes seleccionados.", { name: "sin_archivos.txt" });
  await archive.finalize();
}

function officialReportFilters(params = {}) {
  const { search = "", codigo = "", planMonitoreo = "", cliente = "", matriz = "", acreditacion = "", ids = [] } = params;
  const regex = (value) => ({ $regex: escapeRegExp(value), $options: "i" });
  const filters = [
    { estado: { $in: ["LIBERADO", "DISPONIBLE"] } },
    { papelera: { $ne: true } },
  ];

  if (Array.isArray(ids) && ids.length) filters.push({ _id: { $in: ids } });
  if (search) {
    filters.push({
      $or: [
        { codigo: regex(search) },
        { planMonitoreo: regex(search) },
        { cliente: regex(search) },
        { matriz: regex(search) },
        { acreditacion: regex(search) },
      ],
    });
  }
  if (codigo) filters.push({ codigo: regex(codigo) });
  if (planMonitoreo) filters.push({ planMonitoreo: regex(planMonitoreo) });
  if (cliente) filters.push({ cliente: regex(cliente) });
  if (matriz) filters.push({ matriz: regex(matriz) });
  if (acreditacion) filters.push({ acreditacion: normalize(acreditacion) });

  return { $and: filters };
}

const officialVersionFor = (report) => [...(report.versiones || [])].reverse().find((item) =>
  item.tipo === "OFICIAL" || report.estado === "LIBERADO" || report.estado === "DISPONIBLE"
);

exports.listarOficialesReporte = async (req, res) => {
  const { page = 0, limit = 25 } = req.query;
  try {
    const filter = officialReportFilters(req.query);
    const [data, total] = await Promise.all([
      Informe.find(filter)
        .sort({ codigo: 1 })
        .skip(Number(page) * Number(limit))
        .limit(Number(limit))
        .select("codigo planMonitoreo cliente matriz acreditacion idAcceso estado versiones")
        .lean(),
      Informe.countDocuments(filter),
    ]);

    res.json({
      data: data.map((report) => {
        const version = officialVersionFor(report);
        return {
          _id: report._id,
          codigo: report.codigo,
          planMonitoreo: report.planMonitoreo,
          cliente: report.cliente,
          matriz: report.matriz,
          acreditacion: report.acreditacion,
          idAcceso: report.idAcceso,
          archivo: visibleProcessedName(report, version) || `IE_${safeSegment(report.codigo)}.pdf`,
        };
      }),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.descargarOficialesReporte = async (req, res) => {
  try {
    const informes = await Informe.find(officialReportFilters(req.body || {})).sort({ codigo: 1 }).limit(5000).lean();
    await sendReportsZip(res, informes, {
      officialOnly: true,
      filename: `informes_oficiales_${new Date().toISOString().slice(0, 10)}`,
    });
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ message: error.message });
  }
};

exports.descargarSeleccionados = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ message: "Selecciona al menos un informe para descargar" });
    const informes = await Informe.find({ _id: { $in: ids }, papelera: { $ne: true } }).sort({ codigo: 1 }).limit(5000).lean();
    await sendReportsZip(res, informes, {
      officialOnly: false,
      filename: `informes_seleccionados_${new Date().toISOString().slice(0, 10)}`,
    });
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ message: error.message });
  }
};

exports.consultar = async (req, res) => {
  try {
    const codigo = normalize(req.body.codigo);
    const idAcceso = normalize(req.body.idAcceso || req.body.claveAcceso);
    const report = await Informe.findOne({ codigo, estado: { $in: ["PRELIMINAR", "LIBERADO", "DISPONIBLE"] }, papelera: { $ne: true } });
    if (!report || !(await bcrypt.compare(idAcceso || "", report.claveAccesoHash))) {
      return res.status(404).json({ message: "Informe o ID de acceso no válidos" });
    }
    res.json({ codigo: report.codigo, idAcceso: report.idAcceso, estado: report.estado === "DISPONIBLE" ? "LIBERADO" : report.estado, tipoVersion: report.tipoVersion, version: report.versionActual, viewToken: createViewToken(report) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.archivoPublico = async (req, res) => {
  try {
    const payload = verifyViewToken(req.query.token);
    if (!payload) return res.status(403).json({ message: "Acceso vencido o no válido" });
    const report = await Informe.findOne({ _id: payload.id, estado: { $in: ["PRELIMINAR", "LIBERADO", "DISPONIBLE"] }, papelera: { $ne: true } });
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
