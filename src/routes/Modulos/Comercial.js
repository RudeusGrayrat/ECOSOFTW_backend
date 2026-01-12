const { Router } = require("express");
const getClientesPaginacion = require("../../controllers/Comercial/Clientes/getClientesPaginacion");
const postCliente = require("../../controllers/Comercial/Clientes/postCliente");
const getCotizacionesPagination = require("../../controllers/Comercial/Cotizaciones/getCotizacionesPagination");
const postCotizacion = require("../../controllers/Comercial/Cotizaciones/postCotizacion");
const postProyectos = require("../../controllers/Comercial/Proyectos/postProyecto");
const postParametro = require("../../controllers/Comercial/Cotizaciones/postParametros");
const getParametrosPagination = require("../../controllers/Comercial/Cotizaciones/getParametrosPagination");
const postTiposDeGastos = require("../../controllers/Comercial/Cotizaciones/postTipoDeGastos");
const getTiposDeGastosPaginacion = require("../../controllers/Comercial/Cotizaciones/getTiposDeGatosPaginacion");
const getProyectosPagination = require("../../controllers/Comercial/Proyectos/getProyectosPaginacion");
const postFormularioCotizacion = require("../../controllers/Comercial/Cotizaciones/postFormularioCotizacion");
const patchCliente = require("../../controllers/Comercial/Clientes/patchCliente");
const patchCotizacion = require("../../controllers/Comercial/Cotizaciones/patchCotizacion");
const patchTipoDeGasto = require("../../controllers/Comercial/TiposDeGastos/patchTipoDeGasto");
const patchProyecto = require("../../controllers/Comercial/Proyectos/patchProyecto");
const patchParametro = require("../../controllers/Comercial/Parametros/patchParametros");

const comercialRouter = Router();

comercialRouter.get("/getClientesPaginacion", getClientesPaginacion);
comercialRouter.get("/getProyectosPaginacion", getProyectosPagination);
comercialRouter.get("/getCotizacionesPaginacion", getCotizacionesPagination);
comercialRouter.get("/getParametrosPaginacion", getParametrosPagination);
comercialRouter.get("/getTiposDeGastosPaginacion", getTiposDeGastosPaginacion);

comercialRouter.patch("/patchCliente/:id", patchCliente);
comercialRouter.patch("/patchCotizacion/:id", patchCotizacion);
comercialRouter.patch("/patchProyecto/:id", patchProyecto);
comercialRouter.patch("/patchParametro/:id", patchParametro);
comercialRouter.patch("/patchTipoDeGasto/:id", patchTipoDeGasto);

comercialRouter.post("/postCliente", postCliente);
comercialRouter.post("/postCotizacion", postCotizacion);
comercialRouter.post("/postFormularioCotizacion", postFormularioCotizacion);
comercialRouter.post("/postProyecto", postProyectos);
comercialRouter.post("/postParametro", postParametro);
comercialRouter.post("/postTiposDeGastos", postTiposDeGastos);

module.exports = comercialRouter;
