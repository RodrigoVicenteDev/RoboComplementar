const { normalizeValue } = require("./formatters");

function normalizarTipoComplementar(tipo) {
  const value = normalizeValue(tipo)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (value.includes("DESCARGA")) {
    return {
      robo: "complementar222",
      motivoSSW: "D",
      opcaoSSW: "222",
    };
  }

  if (
    value.includes("DEDICADO") ||
    value.includes("VEICULO")
  ) {
    return {
      robo: "complementar222",
      motivoSSW: "V",
      opcaoSSW: "222",
    };
  }

  if (value.includes("ESTADIA")) {
    return {
      robo: "complementar222",
      motivoSSW: "E",
      opcaoSSW: "222",
    };
  }

  if (value.includes("ARMAZENAGEM")) {
    return {
      robo: "complementar222",
      motivoSSW: "C",
      opcaoSSW: "222",
    };
  }

  if (value.includes("REENTREGA")) {
  return {
    robo: "reentrega",
    motivoSSW: null,
    opcaoSSW: "016",
  };
}

  if (value.includes("PALETIZ")) {
    return {
      robo: "paletizacao",
      motivoSSW: null,
      opcaoSSW: null,
    };
  }

  throw new Error(
    `Tipo complementar inválido ou não mapeado: "${tipo}"`
  );
}

module.exports = {
  normalizarTipoComplementar,
};