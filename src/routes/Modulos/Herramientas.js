const { Router } = require("express");
const createModule = require("../../controllers/Herramientas/Modules/createModule");
const createSubmodule = require("../../controllers/Herramientas/SubModules/createSubModule");
const postPermissions = require("../../controllers/Herramientas/Permissions/postPermissions");
const postUsuariosEcosoft = require("../../controllers/Herramientas/User/postUser");
const EliminarDocumento = require("../../controllers/Comercial/Cotizaciones/eliminarDocumento");

const herramientasRouter = Router();

herramientasRouter.post("/postUsuariosEcosoft", postUsuariosEcosoft);
herramientasRouter.post("/postModule", createModule);
herramientasRouter.post("/postSubModule", createSubmodule);
herramientasRouter.post("/postPermission", postPermissions);

herramientasRouter.delete("/deleteDocumentCloudinary", EliminarDocumento);


module.exports = herramientasRouter;
