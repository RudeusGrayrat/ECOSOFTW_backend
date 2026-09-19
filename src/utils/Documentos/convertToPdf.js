const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

module.exports = async (docxBuffer) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "ecosoft-doc-"));
  const input = path.join(folder, "documento.docx"); const output = path.join(folder, "documento.pdf");
  try {
    fs.writeFileSync(input, docxBuffer);
    await execFileAsync(process.env.UNOCONVERT_BIN || "unoconvert", ["--convert-to", "pdf", input, output]);
    return fs.readFileSync(output);
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
};
