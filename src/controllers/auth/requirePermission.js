const normalize = (value) => (value || "").toString().trim().toUpperCase();

module.exports = (moduleName, submodule, permission) => (req, res, next) => {
  const match = (req.user.modules || []).find((entry) =>
    normalize(entry.name) === normalize(moduleName) &&
    normalize(entry.submodule?.name) === normalize(submodule)
  );
  if (!match) return res.status(403).json({ message: "No tienes acceso a este submódulo" });
  const allowed = (match.submodule.permissions || []).map(normalize);
  const legacyToolsAdmin = normalize(moduleName) === "HERRAMIENTAS" && normalize(submodule) === "USUARIOS Y ACCESOS" && (req.user.modules || []).some((entry) =>
    normalize(entry.name) === "HERRAMIENTAS" && normalize(entry.submodule?.name) === "MODULOS Y SUBMODULOS" &&
    (entry.submodule.permissions || []).map(normalize).some((item) => ["CREAR", "EDITAR"].includes(item))
  );
  if (!allowed.includes(normalize(permission)) && !legacyToolsAdmin) return res.status(403).json({ message: "No tienes el permiso requerido" });
  next();
};
