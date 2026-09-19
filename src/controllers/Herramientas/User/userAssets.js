const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const User = require("../../../Models/Herramientas/User");

const root = path.resolve(process.env.USER_ASSETS_PATH || path.join(process.cwd(), "storage", "usuarios"));
const allowedTypes = ["image/png", "image/jpeg"];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: (_req, file, cb) => allowedTypes.includes(file.mimetype) ? cb(null, true) : cb(new Error("Solo se permiten imágenes PNG o JPG")) });

exports.uploadAssets = (req, res, next) => upload.fields([{ name: "photo", maxCount: 1 }, { name: "firma", maxCount: 1 }])(req, res, (error) => error ? res.status(400).json({ message: error.message, type: "Error" }) : next());
exports.uploadOne = (req, res, next) => upload.single("archivo")(req, res, (error) => error ? res.status(400).json({ message: error.message, type: "Error" }) : next());

const safePath = (filePath) => {
  const resolved = path.resolve(filePath); const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Ruta de archivo no permitida");
  return resolved;
};
const save = async (user, type, file) => {
  if (!file) return;
  const extension = file.mimetype === "image/png" ? "png" : "jpg";
  await fs.mkdir(root, { recursive: true });
  const filename = `${user._id}_${type}_${crypto.randomUUID()}.${extension}`;
  const filePath = path.join(root, filename);
  const key = type === "foto" ? "photoArchivo" : "firmaArchivo";
  const urlKey = type === "foto" ? "photo" : "firma";
  if (user[key]?.path) await fs.rm(safePath(user[key].path), { force: true });
  await fs.writeFile(filePath, file.buffer);
  user[key] = { path: filePath, filename, mimetype: file.mimetype, bytes: file.size, updatedAt: new Date() };
  user[urlKey] = `/api/herramientas/public/usuarios/${user._id}/${type}`;
};
exports.attachIncomingAssets = async (user, files = {}) => {
  await save(user, "foto", files.photo?.[0]);
  await save(user, "firma", files.firma?.[0]);
};
exports.replaceAsset = async (req, res) => {
  try {
    const type = req.params.type === "foto" ? "foto" : req.params.type === "firma" ? "firma" : null;
    if (!type) return res.status(400).json({ message: "Tipo de archivo no válido", type: "Error" });
    if (!req.file) return res.status(400).json({ message: "Selecciona una imagen PNG o JPG", type: "Error" });
    const user = await User.findById(req.params.id); if (!user) return res.status(404).json({ message: "Usuario no encontrado", type: "Error" });
    await save(user, type, req.file); await user.save();
    return res.json({ message: `${type === "foto" ? "Foto" : "Firma"} actualizada correctamente`, type: "Correcto", data: user });
  } catch (error) { return res.status(500).json({ message: error.message, type: "Error" }); }
};
exports.removeAsset = async (req, res) => {
  try {
    const type = req.params.type === "foto" ? "foto" : req.params.type === "firma" ? "firma" : null;
    if (!type) return res.status(400).json({ message: "Tipo de archivo no válido", type: "Error" });
    const user = await User.findById(req.params.id); if (!user) return res.status(404).json({ message: "Usuario no encontrado", type: "Error" });
    const key = type === "foto" ? "photoArchivo" : "firmaArchivo"; const urlKey = type === "foto" ? "photo" : "firma";
    if (user[key]?.path) await fs.rm(safePath(user[key].path), { force: true });
    user[key] = undefined; user[urlKey] = ""; await user.save();
    return res.json({ message: `${type === "foto" ? "Foto" : "Firma"} eliminada`, type: "Correcto", data: user });
  } catch (error) { return res.status(500).json({ message: error.message, type: "Error" }); }
};
exports.publicAsset = async (req, res) => {
  try {
    const type = req.params.type === "foto" ? "photoArchivo" : req.params.type === "firma" ? "firmaArchivo" : null;
    const user = await User.findById(req.params.id).select(`${type} userName`); if (!type || !user?.[type]?.path) return res.sendStatus(404);
    res.setHeader("Content-Type", user[type].mimetype || "image/png");
    return res.sendFile(safePath(user[type].path));
  } catch (_error) { return res.sendStatus(404); }
};
