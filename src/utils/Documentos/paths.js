const fs = require("fs");
const path = require("path");

const templatesRoot = path.resolve(process.env.DOCUMENT_TEMPLATES_PATH || path.join(process.cwd(), "storage", "templates"));
const ensureTemplatesRoot = () => fs.mkdirSync(templatesRoot, { recursive: true });
const templatePath = (fileName) => path.join(templatesRoot, path.basename(fileName));

module.exports = { templatesRoot, ensureTemplatesRoot, templatePath };
