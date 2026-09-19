const fs = require("fs");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const ImageModule = require("docxtemplater-image-module-free");
// El módulo de imágenes exige un buffer válido incluso cuando el usuario aún no
// tiene una firma configurada. Un PNG transparente permite que el documento se
// genere y deja el espacio de firma en blanco.
const EMPTY_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9dQAAAABJRU5ErkJggg==", "base64");

const getImage = (value) => {
  if (!value) return EMPTY_PNG;
  if (value.startsWith("data:image")) return Buffer.from(value.split(",")[1], "base64");
  // docxtemplater-image-module-free necesita un buffer síncrono. Las URLs se
  // convierten a data:image previamente en el controlador.
  if (value.startsWith("http")) throw new Error("La imagen de firma no fue preparada para el documento");
  return fs.readFileSync(value);
};

module.exports = async (data, filePath) => {
  const zip = new PizZip(fs.readFileSync(filePath, "binary"));
  const imageModule = new ImageModule({ centered: false, getImage, getSize: (_image, _value, tag) => tag.toLowerCase().includes("firma") ? [150, 70] : [120, 70] });
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, delimiters: { start: "{{", end: "}}" }, modules: [imageModule] });
  // Todas las imágenes ya llegan como buffers/rutas locales. render() evita el
  // fallo de resolve del módulo libre de imágenes cuando una firma es opcional.
  doc.render(data);
  return doc.getZip().generate({ type: "nodebuffer" });
};
