const { Router } = require("express");
const getClientesPaginacion = require("../../controllers/Comercial/Clientes/getClientesPaginacion");
const postCliente = require("../../controllers/Comercial/Clientes/postCliente");

const comercialRouter = Router();

comercialRouter.get("/getClientesPaginacion", getClientesPaginacion);
comercialRouter.post("/postCliente", postCliente);

module.exports = comercialRouter;
