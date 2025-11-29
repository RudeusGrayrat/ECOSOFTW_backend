const { Router } = require("express");
const getClientesPaginacion = require("../../controllers/Comercial/Clientes/getClientesPaginacion");
const postCliente = require("../../controllers/Comercial/Clientes/postCliente");
const getCotizacionesPagination = require("../../controllers/Comercial/Cotizaciones/getCotizacionesPagination");
const postCotizacion = require("../../controllers/Comercial/Cotizaciones/postCotizacion");
const postProyectos = require("../../controllers/Comercial/Cotizaciones/postProyecto");
const postParametro = require("../../controllers/Comercial/Cotizaciones/postParametros");
const getParametrosPagination = require("../../controllers/Comercial/Cotizaciones/getParametrosPagination");
const postTiposDeGastos = require("../../controllers/Comercial/Cotizaciones/postTipoDeGastos");
const getTiposDeGastosPaginacion = require("../../controllers/Comercial/Cotizaciones/getTiposDeGatosPaginacion");

const comercialRouter = Router();

comercialRouter.get("/getClientesPaginacion", getClientesPaginacion);
comercialRouter.get("/getCotizacionesPaginacion", getCotizacionesPagination);
comercialRouter.get("/getParametrosPaginacion", getParametrosPagination);
comercialRouter.get("/getTiposDeGastosPaginacion", getTiposDeGastosPaginacion);

comercialRouter.post("/postCliente", postCliente);
comercialRouter.post("/postCotizacion", postCotizacion);
comercialRouter.post("/postProyecto", postProyectos);
comercialRouter.post("/postParametro", postParametro);
comercialRouter.post("/postTiposDeGastos", postTiposDeGastos);

module.exports = comercialRouter;
