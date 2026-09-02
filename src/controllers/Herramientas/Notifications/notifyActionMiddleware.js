const NotificationService = require("./NotificationService");

const routeMap = [
  { pattern: /^\/api\/comercial\/.*Cliente/i, module: "COMERCIAL", submodule: "CLIENTES" },
  { pattern: /^\/api\/comercial\/.*Cotizacion/i, module: "COMERCIAL", submodule: "COTIZACIONES" },
  { pattern: /^\/api\/comercial\/.*Proyecto/i, module: "COMERCIAL", submodule: "PROYECTOS" },
  { pattern: /^\/api\/comercial\/.*Parametro/i, module: "COMERCIAL", submodule: "PARAMETROS" },
  { pattern: /^\/api\/comercial\/.*Tipos?DeGastos/i, module: "COMERCIAL", submodule: "TIPOS DE GASTOS" },
  { pattern: /^\/api\/herramientas\/.*Usuarios/i, module: "HERRAMIENTAS", submodule: "USUARIOS" },
  { pattern: /^\/api\/herramientas\/.*Permissions|^\/api\/herramientas\/.*Permission/i, module: "HERRAMIENTAS", submodule: "PERMISOS" },
  { pattern: /^\/api\/herramientas\/.*Modules?|^\/api\/herramientas\/.*SubModules?|^\/api\/herramientas\/.*Modulo/i, module: "HERRAMIENTAS", submodule: "MODULOS Y SUBMODULOS" },
  { pattern: /^\/api\/operaciones\/informes-ensayo/i, module: "OPERACIONES", submodule: "INFORMES DE ENSAYO" },
];

const actionByMethod = {
  POST: "CREO",
  PATCH: "ACTUALIZO",
  PUT: "ACTUALIZO",
  DELETE: "ELIMINO",
};

const titleByAction = {
  CREO: "Nuevo registro",
  ACTUALIZO: "Registro actualizado",
  ELIMINO: "Registro eliminado",
};

const userLabel = (user) => user?.colaborador || user?.userName || "Un colaborador";
const findScope = (path) => routeMap.find((item) => item.pattern.test(path));

const notifyActionMiddleware = (req, res, next) => {
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) return next();
  if (req.path.includes("/publico/") || req.path.includes("/login") || req.path.includes("/notificaciones")) return next();

  res.on("finish", async () => {
    if (res.statusCode < 200 || res.statusCode >= 300 || !req.user?._id) return;

    const scope = findScope(req.originalUrl || req.path);
    if (!scope) return;

    const action = actionByMethod[req.method] || "EJECUTO";

    try {
      await NotificationService.send(req.app.get("io"), {
        title: titleByAction[action] || "Accion registrada",
        message: `${userLabel(req.user)} ${action.toLowerCase()} una accion en ${scope.submodule}.`,
        type: "SUBMODULE",
        module: scope.module,
        submodule: scope.submodule,
        action,
        route: `/${scope.module.toLowerCase()}/${scope.submodule.toLowerCase()}`,
        creator: req.user._id,
        creatorName: userLabel(req.user),
      });
    } catch (error) {
      console.error("Error creando notificacion:", error.message);
    }
  });

  next();
};

module.exports = notifyActionMiddleware;
