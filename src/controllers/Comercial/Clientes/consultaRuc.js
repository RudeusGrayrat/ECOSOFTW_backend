const ComercialCliente = require("../../../Models/Comercial/Clientes");

const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

const firstText = (...values) => values.find((value) => typeof value === "string" && value.trim())?.trim() || "";

const normalizeProviderResponse = (payload) => {
  const data = payload?.data || payload?.result || payload?.response || payload || {};
  const fullName = firstText(data.full_name, data.nombre_completo, [data.first_last_name, data.second_last_name, data.first_name].filter(Boolean).join(" "));
  return {
    razonSocial: firstText(data.razonSocial, data.razon_social, data.nombre_o_razon_social, data.nombre, data.businessName, fullName),
    direccionLegal: firstText(data.direccion, data.direccion_completa, data.domicilio_fiscal, data.address),
    estado: firstText(data.estado, data.estado_contribuyente, data.status),
    condicion: firstText(data.condicion, data.condicion_contribuyente, data.condition),
    departamento: firstText(data.departamento),
    provincia: firstText(data.provincia),
    distrito: firstText(data.distrito),
    ubigeo: firstText(data.ubigeo),
  };
};

const providerUrlFor = (template, documentNumber) => {
  if (template.includes("{ruc}") || template.includes("{dni}") || template.includes("{numero}")) {
    return template.replaceAll("{ruc}", encodeURIComponent(documentNumber)).replaceAll("{dni}", encodeURIComponent(documentNumber)).replaceAll("{numero}", encodeURIComponent(documentNumber));
  }
  const separator = template.includes("?") ? "&" : "?";
  // Decolecta documenta el parámetro como `numero`, no como `ruc` o `dni`.
  return `${template}${separator}numero=${encodeURIComponent(documentNumber)}`;
};

exports.consultaDocumento = async (req, res) => {
  const documentNumber = digitsOnly(req.params.numero || req.params.ruc);
  const isRuc = /^\d{11}$/.test(documentNumber);
  const isDni = /^\d{8}$/.test(documentNumber);
  if (!isRuc && !isDni) return res.status(400).json({ message: "Ingresa un RUC de 11 dígitos o un DNI de 8 dígitos.", type: "Advertencia" });

  try {
    // Primero aprovechamos la información ya registrada para no consumir saldo de la API.
    const local = await ComercialCliente.findOne({ numeroDocumento: documentNumber }).lean();
    if (local) return res.json({ data: { razonSocial: local.cliente, direccionLegal: local.direccionLegal || "", fuente: "ECOSOFT" }, type: "Correcto" });

    const url = providerUrlFor(isRuc ? (process.env.API_REST_SUNAT || "https://api.decolecta.com/v1/sunat/ruc") : (process.env.API_REST_RENIEC || "https://api.decolecta.com/v1/reniec/dni"), documentNumber);
    // Decolecta usa el mismo token para RUC y DNI. Se puede sobrescribir por separado si fuera necesario.
    const token = isRuc ? process.env.API_REST_SUNAT_TOKEN : (process.env.API_REST_RENIEC_TOKEN || process.env.API_REST_SUNAT_TOKEN);
    if (!url || !token) {
      return res.status(503).json({ message: `La consulta de ${isRuc ? "RUC" : "DNI"} aún no está configurada. Puedes completar los datos manualmente.`, type: "Advertencia" });
    }

    const header = isRuc ? (process.env.API_REST_SUNAT_TOKEN_HEADER || "Authorization") : (process.env.API_REST_RENIEC_TOKEN_HEADER || process.env.API_REST_SUNAT_TOKEN_HEADER || "Authorization");
    const prefix = isRuc ? (process.env.API_REST_SUNAT_TOKEN_PREFIX === undefined ? "Bearer" : process.env.API_REST_SUNAT_TOKEN_PREFIX) : (process.env.API_REST_RENIEC_TOKEN_PREFIX === undefined ? (process.env.API_REST_SUNAT_TOKEN_PREFIX === undefined ? "Bearer" : process.env.API_REST_SUNAT_TOKEN_PREFIX) : process.env.API_REST_RENIEC_TOKEN_PREFIX);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response;
    try {
      response = await fetch(url, { headers: { [header]: prefix ? `${prefix} ${token}`.trim() : token, Accept: "application/json" }, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      console.warn("[DOCUMENTO] Consulta externa rechazada", { status: response.status, tipo: isRuc ? "RUC" : "DNI", documento: `${documentNumber.slice(0, 2)}***${documentNumber.slice(-2)}` });
      return res.status(response.status === 404 ? 404 : 502).json({ message: response.status === 404 ? "No encontramos datos para ese documento. Verifica el número o completa los datos manualmente." : "No pudimos consultar el documento en este momento. Puedes completar los datos manualmente.", type: "Advertencia" });
    }
    const data = normalizeProviderResponse(await response.json());
    if (!data.razonSocial) return res.status(404).json({ message: "No encontramos datos para ese documento. Verifica el número o completa los datos manualmente.", type: "Advertencia" });
    console.info("[DOCUMENTO] Consulta externa exitosa", { tipo: isRuc ? "RUC" : "DNI", documento: `${documentNumber.slice(0, 2)}***${documentNumber.slice(-2)}`, razonSocial: data.razonSocial });
    console.log("[DOCUMENTO] Datos obtenidos", { ...data, fuente: isRuc ? "SUNAT" : "RENIEC" });
    return res.json({ data: { ...data, fuente: isRuc ? "SUNAT" : "RENIEC" }, type: "Correcto" });
  } catch (error) {
    console.error("[DOCUMENTO] Error de consulta", { name: error.name, message: error.message });
    return res.status(502).json({ message: "No pudimos consultar el documento en este momento. Puedes completar los datos manualmente.", type: "Advertencia" });
  }
};

exports.consultaRuc = exports.consultaDocumento;
