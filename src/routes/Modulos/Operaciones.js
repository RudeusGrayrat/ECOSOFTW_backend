const { Router } = require("express");
const requireAuth = require("../../controllers/auth/requireAuth");
const requirePermission = require("../../controllers/auth/requirePermission");
const informes = require("../../controllers/Operaciones/informesEnsayo");
const router = Router();

router.get("/informes-ensayo", requireAuth, requirePermission("OPERACIONES", "INFORMES DE ENSAYO", "VER"), informes.listar);
router.get("/informes-ensayo/configuracion", requireAuth, requirePermission("OPERACIONES", "INFORMES DE ENSAYO", "CREAR"), informes.configuracion);
router.post("/informes-ensayo/configuracion/firma", requireAuth, requirePermission("OPERACIONES", "INFORMES DE ENSAYO", "CREAR"), informes.uploadAsset, informes.actualizarFirma);
router.delete("/informes-ensayo/configuracion/firma", requireAuth, requirePermission("OPERACIONES", "INFORMES DE ENSAYO", "CREAR"), informes.eliminarFirma);
router.post("/informes-ensayo/configuracion/marca-agua/:tipo", requireAuth, requirePermission("OPERACIONES", "INFORMES DE ENSAYO", "CREAR"), informes.uploadAsset, informes.actualizarMarcaAgua);
router.delete("/informes-ensayo/configuracion/marca-agua/:tipo", requireAuth, requirePermission("OPERACIONES", "INFORMES DE ENSAYO", "CREAR"), informes.eliminarMarcaAgua);
router.post("/informes-ensayo/procesar", requireAuth, requirePermission("OPERACIONES", "INFORMES DE ENSAYO", "CREAR"), informes.upload, informes.procesar);
router.get("/informes-ensayo/:id/archivo", requireAuth, requirePermission("OPERACIONES", "INFORMES DE ENSAYO", "VER"), informes.archivoAdmin);
router.post("/informes-ensayo/:id/publicar", requireAuth, requirePermission("OPERACIONES", "INFORMES DE ENSAYO", "APROBAR"), informes.publicar);
router.post("/informes-ensayo/:id/anular", requireAuth, requirePermission("OPERACIONES", "INFORMES DE ENSAYO", "DESAPROBAR"), informes.anular);
router.post("/publico/informes-ensayo", informes.consultar);
router.get("/publico/informes-ensayo/archivo", informes.archivoPublico);
module.exports = router;
