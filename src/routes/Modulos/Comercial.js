const { Router } = require("express");

const getClientesPaginacion = require("../../controllers/Comercial/Clientes/getClientesPaginacion");
const postCliente = require("../../controllers/Comercial/Clientes/postCliente");
const getProyectosPagination = require("../../controllers/Comercial/Proyectos/getProyectosPaginacion");
const getCotizacionesPagination = require("../../controllers/Comercial/Cotizaciones/getCotizacionesPagination");
const getParametrosPagination = require("../../controllers/Comercial/Cotizaciones/getParametrosPagination");
const getTiposDeGastosPaginacion = require("../../controllers/Comercial/Cotizaciones/getTiposDeGatosPaginacion");
const patchCliente = require("../../controllers/Comercial/Clientes/patchCliente");
const patchCotizacion = require("../../controllers/Comercial/Cotizaciones/patchCotizacion");
const patchProyecto = require("../../controllers/Comercial/Proyectos/patchProyecto");
const patchParametro = require("../../controllers/Comercial/Parametros/patchParametros");
const deleteParametro = require("../../controllers/Comercial/Parametros/deleteParametro");
const patchTipoDeGasto = require("../../controllers/Comercial/TiposDeGastos/patchTipoDeGasto");
const postProyectos = require("../../controllers/Comercial/Proyectos/postProyecto");
const postTiposDeGastos = require("../../controllers/Comercial/Cotizaciones/postTipoDeGastos");
const postParametro = require("../../controllers/Comercial/Cotizaciones/postParametros");
const postSolicitudCotizacion = require("../../controllers/Comercial/Cotizaciones/postSolicitudCotizacion");
const postCotizacion = require("../../controllers/Comercial/Cotizaciones/postCotizacion");
const postNuevaVersionCotizacion = require("../../controllers/Comercial/Cotizaciones/postNuevaVersionCotizacion");
const getSolicitudesCotizacion = require("../../controllers/Comercial/Cotizaciones/getSolicitudesCotizacion");
const deleteProyecto = require("../../controllers/Comercial/Proyectos/delete");
const proveedores = require("../../controllers/Comercial/Proveedores/proveedores");
const documentos = require("../../controllers/Documentos/generarPdf");


const comercialRouter = Router();

comercialRouter.get("/getClientesPaginacion", getClientesPaginacion);
comercialRouter.get("/getProyectosPaginacion", getProyectosPagination);
comercialRouter.get("/getCotizacionesPaginacion", getCotizacionesPagination);
comercialRouter.get("/getParametrosPaginacion", getParametrosPagination);
comercialRouter.get("/getTiposDeGastosPaginacion", getTiposDeGastosPaginacion);
comercialRouter.get("/proveedores", proveedores.listar);
comercialRouter.get("/solicitudes-cotizacion", getSolicitudesCotizacion);

comercialRouter.patch("/patchCliente/:id", patchCliente);
comercialRouter.patch("/patchCotizacion/:id", patchCotizacion);
comercialRouter.patch("/patchProyecto/:id", patchProyecto);
comercialRouter.patch("/patchParametro/:id", patchParametro);
comercialRouter.delete("/parametros/:id", deleteParametro);
comercialRouter.patch("/patchTipoDeGasto/:id", patchTipoDeGasto);

comercialRouter.post("/postCliente", postCliente);
comercialRouter.post("/postCotizacion", postCotizacion);
comercialRouter.post("/cotizaciones/:id/nueva-version", postNuevaVersionCotizacion);
comercialRouter.post("/cotizaciones/:id/pdf", documentos.cotizacion);
comercialRouter.post("/postFormularioCotizacion", postSolicitudCotizacion);
comercialRouter.post("/postProyecto", postProyectos);
comercialRouter.post("/postParametro", postParametro);
comercialRouter.post("/postTiposDeGastos", postTiposDeGastos);
comercialRouter.post("/proveedores", proveedores.crear);
comercialRouter.patch("/proveedores/:id", proveedores.actualizar);

comercialRouter.delete("/deleteProyecto/:id", deleteProyecto);

module.exports = comercialRouter;
