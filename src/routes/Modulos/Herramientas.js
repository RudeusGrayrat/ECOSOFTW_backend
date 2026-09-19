const { Router } = require("express");
const createModule = require("../../controllers/Herramientas/Modules/createModule");
const getModules = require("../../controllers/Herramientas/Modules/getModules");
const getModulosYSubmodulosPaginacion = require("../../controllers/Herramientas/Modules/getModulosYSubmodulosPaginacion");
const patchModuloYSubmodulo = require("../../controllers/Herramientas/Modules/patchModuloYSubmodulo");
const createSubmodule = require("../../controllers/Herramientas/SubModules/createSubModule");
const postPermissions = require("../../controllers/Herramientas/Permissions/postPermissions");
const getPermissionsPaginacion = require("../../controllers/Herramientas/Permissions/getPermissionsPaginacion");
const patchPermission = require("../../controllers/Herramientas/Permissions/patchPermission");
const postUsuariosEcosoft = require("../../controllers/Herramientas/User/postUser");
const getUsuariosPaginacion = require("../../controllers/Herramientas/User/getUsuariosPaginacion");
const getCatalogoAccesos = require("../../controllers/Herramientas/User/getCatalogoAccesos");
const EliminarDocumento = require("../../controllers/Comercial/Cotizaciones/eliminarDocumento");
const PatchUser = require("../../controllers/Herramientas/User/pacthUser");
const requireAuth = require("../../controllers/auth/requireAuth");
const getNotifications = require("../../controllers/Herramientas/Notifications/getNotifications");
const markNotificationRead = require("../../controllers/Herramientas/Notifications/markNotificationRead");
const hideNotification = require("../../controllers/Herramientas/Notifications/hideNotification");
const restoreNotification = require("../../controllers/Herramientas/Notifications/restoreNotification");
const plantillas = require("../../controllers/Herramientas/Plantillas/plantillasDocumentales");
const requirePermission = require("../../controllers/auth/requirePermission");

const herramientasRouter = Router();

herramientasRouter.post("/postUsuariosEcosoft", postUsuariosEcosoft);
herramientasRouter.get("/getUsuariosPaginacion", getUsuariosPaginacion);
herramientasRouter.get("/getCatalogoAccesos", getCatalogoAccesos);
herramientasRouter.get("/notificaciones", requireAuth, getNotifications);
herramientasRouter.patch("/notificaciones/:id/leida", requireAuth, markNotificationRead);
herramientasRouter.delete("/notificaciones/:id", requireAuth, hideNotification);
herramientasRouter.patch("/notificaciones/:id/restaurar", requireAuth, restoreNotification);
herramientasRouter.post("/postModule", createModule);
herramientasRouter.post("/postSubModule", createSubmodule);
herramientasRouter.post("/postPermission", postPermissions);
herramientasRouter.get("/getPermissionsPaginacion", getPermissionsPaginacion);
herramientasRouter.patch("/patchPermission/:id", patchPermission);
herramientasRouter.get("/getModules", getModules);
herramientasRouter.get("/getModulosYSubmodulosPaginacion", getModulosYSubmodulosPaginacion);
herramientasRouter.patch("/patchModuloYSubmodulo/:id", patchModuloYSubmodulo);

herramientasRouter.get("/plantillas-documentales", requireAuth, requirePermission("HERRAMIENTAS", "PLANTILLAS", "VER"), plantillas.listar);
herramientasRouter.post("/plantillas-documentales", requireAuth, requirePermission("HERRAMIENTAS", "PLANTILLAS", "CREAR"), plantillas.upload, plantillas.guardar);
herramientasRouter.patch("/plantillas-documentales/:id", requireAuth, requirePermission("HERRAMIENTAS", "PLANTILLAS", "EDITAR"), plantillas.upload, plantillas.actualizar);
herramientasRouter.get("/plantillas-documentales/:tipo/archivo", requireAuth, requirePermission("HERRAMIENTAS", "PLANTILLAS", "VER"), plantillas.descargar);

herramientasRouter.patch("/patchUser/:id", PatchUser)

herramientasRouter.delete("/deleteDocumentCloudinary", EliminarDocumento);

module.exports = herramientasRouter;
