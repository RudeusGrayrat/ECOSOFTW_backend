const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const root = path.resolve(process.env.SOLICITUDES_STORAGE_PATH || path.join(process.cwd(), "storage", "solicitudes-cotizacion"));
const allowedExtensions = [".pdf", ".doc", ".docx"];
const isAllowed = (file) => allowedExtensions.includes(path.extname(file?.originalname || "").toLowerCase());
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => cb(null, isAllowed(file)),
});

exports.upload = (req, res, next) => upload.array("adjuntos", 5)(req, res, (error) => {
  if (error instanceof multer.MulterError) return res.status(400).json({ message: error.code === "LIMIT_FILE_SIZE" ? "Cada adjunto puede pesar como máximo 10 MB." : "No se pudieron procesar los adjuntos.", type: "Advertencia" });
  if (error) return res.status(400).json({ message: "Solo puedes adjuntar archivos PDF, DOC o DOCX.", type: "Advertencia" });
  return next();
});

const safePath = (filePath) => {
  const resolved = path.resolve(filePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Ruta de adjunto no permitida");
  return resolved;
};

exports.saveIncoming = async (files = []) => {
  if (!files.length) return [];
  await fs.mkdir(root, { recursive: true });
  const saved = [];
  for (const file of files) {
    const id = crypto.randomUUID();
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = `${id}${extension}`;
    const filePath = path.join(root, filename);
    await fs.writeFile(filePath, file.buffer);
    saved.push({ id, nombre: file.originalname, archivo: filename, mimetype: file.mimetype || "application/octet-stream", bytes: file.size, path: filePath });
  }
  return saved;
};

exports.removeSaved = async (files = []) => Promise.all(files.map((file) => fs.rm(safePath(file.path), { force: true }).catch(() => undefined)));
