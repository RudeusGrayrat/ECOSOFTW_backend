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
  { pattern: /^\/api\/(?:calidad|operaciones)\/informes-ensayo\/configuracion/i, module: "CALIDAD", submodule: "CONFIGURACION" },
  { pattern: /^\/api\/(?:calidad|operaciones)\/informes-ensayo/i, module: "CALIDAD", submodule: "INFORMES DE ENSAYO" },
];

const actionByMethod = {
  POST: "CREO",
  PATCH: "ACTUALIZO",
  PUT: "ACTUALIZO",
  DELETE: "ELIMINO",
};

const actionLabel = {
  CREO: "creó",
  ACTUALIZO: "actualizó",
  ELIMINO: "eliminó",
};

const userLabel = (user) => user?.colaborador || user?.userName || "Un colaborador";
const findScope = (path) => routeMap.find((item) => item.pattern.test(path));
const clean = (value) => (value || "").toString().trim();
const pick = (...values) => values.map(clean).find(Boolean);

const entityNameByScope = {
  CLIENTES: "cliente",
  COTIZACIONES: "cotización",
  PROYECTOS: "proyecto",
  PARAMETROS: "parámetro",
  "TIPOS DE GASTOS": "tipo de gasto",
  USUARIOS: "usuario",
  PERMISOS: "permiso",
  "MODULOS Y SUBMODULOS": "módulo/submódulo",
  "INFORMES DE ENSAYO": "informe de ensayo",
  CONFIGURACION: "configuración",
};

const titleBy = (scope, action, req) => {
  const entity = entityNameByScope[scope.submodule] || "registro";
  const path = req.originalUrl || req.path;

  if (path.includes("/configuracion/firma")) {
    if (req.method === "DELETE") return "Firma autorizada eliminada";
    return "Firma autorizada actualizada";
  }
  if (path.includes("/configuracion/marca-agua")) {
    const tipo = clean(req.params?.tipo).replace(/_/g, " ");
    if (req.method === "DELETE") return `Marca de agua ${tipo} eliminada`;
    return `Marca de agua ${tipo} actualizada`;
  }
  if (path.includes("/informes-ensayo/procesar")) {
    return action === "CREO" ? "Informe de ensayo procesado" : "Informe de ensayo reemplazado";
  }
  if (path.includes("/aprobar") || path.includes("/publicar")) return "Visto bueno de jefatura";
  if (path.includes("/liberar")) return "Informe oficial liberado";
  if (path.includes("/papelera") || path.includes("/anular")) return "Informe enviado a papelera";
  if (path.includes("/restablecer")) return "Informe restablecido";

  if (action === "CREO") return `Nuevo ${entity}`;
  if (action === "ACTUALIZO") return `${entity.charAt(0).toUpperCase()}${entity.slice(1)} actualizado`;
  if (action === "ELIMINO") return `${entity.charAt(0).toUpperCase()}${entity.slice(1)} eliminado`;
  return "Movimiento registrado";
};

const describeTarget = (req, responseBody = {}) => {
  const data = responseBody?.data || responseBody?.saved || responseBody?.item || {};
  const body = req.body || {};

  return pick(
    responseBody?.idAcceso && data?.codigo ? `${data.codigo} - ID ${responseBody.idAcceso}` : "",
    data?.codigo && data?.idAcceso ? `${data.codigo} - ID ${data.idAcceso}` : "",
    data?.codigo,
    Array.isArray(data) ? `${data.length} informe(s)` : "",
    body?.codigo,
    data?.cliente,
    body?.cliente,
    data?.nombre,
    body?.nombre,
    data?.name,
    body?.name,
    data?.userName,
    body?.userName,
    data?.tipoDeGasto,
    body?.tipoDeGasto,
    data?.parametro,
    body?.parametro,
    req.file?.originalname,
    req.files?.archivos?.length ? `${req.files.archivos.length} archivo(s)` : "",
    req.params?.id
  );
};

const detailBy = (req, responseBody = {}, scope, action) => {
  const body = req.body || {};
  const data = responseBody?.data || {};
  const parts = [];

  const target = describeTarget(req, responseBody);
  if (target) parts.push(`Registro: ${target}`);
  if (body.estado || data.estado) parts.push(`Estado: ${body.estado || data.estado}`);
  if (body.tipoPlantilla || data?.plantilla?.tipo) parts.push(`Marca de agua: ${body.tipoPlantilla || data.plantilla.tipo}`);
  if (responseBody?.idAcceso || data?.idAcceso) parts.push(`ID de acceso: ${responseBody.idAcceso || data.idAcceso}`);
  if (req.file?.originalname) parts.push(`Archivo: ${req.file.originalname}`);
  if (req.files?.archivos?.length) parts.push(`Archivos cargados: ${req.files.archivos.map((file) => file.originalname).join(", ")}`);
  if (body.motivo) parts.push(`Observación: ${body.motivo}`);
  if (responseBody?.conflicts?.length) parts.push(`Conflictos: ${responseBody.conflicts.length}`);
  if (responseBody?.message) parts.push(`Resultado: ${responseBody.message}`);

  if (!parts.length) {
    const entity = entityNameByScope[scope.submodule] || "registro";
    parts.push(`Se ${actionLabel[action] || "registró"} un ${entity} en ${scope.module}.`);
  }

  return parts.join(" | ");
};

const notifyActionMiddleware = (req, res, next) => {
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) return next();
  if (req.path.includes("/publico/") || req.path.includes("/login") || req.path.includes("/notificaciones")) return next();

  let responseBody = null;
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on("finish", async () => {
    if (res.statusCode < 200 || res.statusCode >= 300 || !req.user?._id) return;

    const scope = findScope(req.originalUrl || req.path);
    if (!scope) return;

    const action = actionByMethod[req.method] || "EJECUTO";

    try {
      const target = describeTarget(req, responseBody);
      const entity = entityNameByScope[scope.submodule] || "registro";
      await NotificationService.send(req.app.get("io"), {
        title: titleBy(scope, action, req),
        message: `${userLabel(req.user)} ${actionLabel[action] || "registró"} ${target ? `${entity}: ${target}` : `un ${entity}`} en ${scope.submodule}.`,
        detail: detailBy(req, responseBody, scope, action),
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
