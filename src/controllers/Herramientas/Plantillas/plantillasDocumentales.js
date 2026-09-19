const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { randomUUID } = require("crypto");
const Plantilla = require("../../../Models/Herramientas/PlantillaDocumental");
const { ensureTemplatesRoot, templatePath } = require("../../../utils/Documentos/paths");

const isDocx = (file) => file?.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file?.originalname?.toLowerCase().endsWith(".docx");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, isDocx(file)) });
exports.upload = upload.single("archivo");

const saveFile = (file) => {
  if (!isDocx(file)) throw new Error("La plantilla debe ser un archivo Word .docx");
  ensureTemplatesRoot();
  const fileName = `${randomUUID()}.docx`;
  fs.writeFileSync(templatePath(fileName), file.buffer);
  return fileName;
};

exports.listar = async (_req, res) => res.json({ data: await Plantilla.find().sort({ tipo: 1 }).populate("actualizadoPor", "colaborador userName") });

exports.guardar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Debes cargar una plantilla Word .docx", type: "Advertencia" });
    const { tipo, nombre, version, vigenciaDesde, estado = "ACTIVA" } = req.body;
    if (!tipo || !nombre || !version) return res.status(400).json({ message: "Tipo, nombre y versión son obligatorios", type: "Advertencia" });
    const archivo = saveFile(req.file);
    const previous = await Plantilla.findOne({ tipo });
    if (previous?.archivo) fs.rmSync(templatePath(previous.archivo), { force: true });
    const data = await Plantilla.findOneAndUpdate({ tipo }, { tipo, nombre, version, vigenciaDesde: vigenciaDesde || undefined, estado, archivo, nombreOriginal: req.file.originalname, actualizadoPor: req.user?._id }, { upsert: true, new: true, runValidators: true });
    return res.status(201).json({ data, message: "Plantilla documental guardada", type: "Correcto" });
  } catch (error) { return res.status(400).json({ message: error.message, type: "Error" }); }
};

exports.actualizar = async (req, res) => {
  try {
    const current = await Plantilla.findById(req.params.id); if (!current) return res.status(404).json({ message: "Plantilla no encontrada", type: "Error" });
    const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => ["nombre", "version", "vigenciaDesde", "estado"].includes(key)));
    if (req.file) { const archivo = saveFile(req.file); fs.rmSync(templatePath(current.archivo), { force: true }); changes.archivo = archivo; changes.nombreOriginal = req.file.originalname; }
    changes.actualizadoPor = req.user?._id;
    const data = await Plantilla.findByIdAndUpdate(current._id, changes, { new: true, runValidators: true });
    return res.json({ data, message: "Plantilla actualizada", type: "Correcto" });
  } catch (error) { return res.status(400).json({ message: error.message, type: "Error" }); }
};

exports.descargar = async (req, res) => {
  const template = await Plantilla.findOne({ tipo: req.params.tipo, estado: "ACTIVA" });
  if (!template) return res.status(404).json({ message: "No existe una plantilla activa para este documento", type: "Error" });
  const file = templatePath(template.archivo); if (!fs.existsSync(file)) return res.status(404).json({ message: "El archivo de plantilla no está disponible", type: "Error" });
  return res.download(file, path.basename(template.nombreOriginal));
};
