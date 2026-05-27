const BASE_URL = process.env.DAGO_API_BASE ?? "https://api.paineldg.com.br";
const DAGO_EMAIL = process.env.DAGO_EMAIL ?? "";
const DAGO_SENHA = process.env.DAGO_SENHA ?? "";

function pick(obj, keys) {
  for (const k of keys) {
    if (obj && typeof obj === "object" && obj[k]) return obj[k];
  }

  return null;
}

async function readJsonSafe(res) {
  const txt = await res.text().catch(() => "");

  try {
    return { json: JSON.parse(txt), txt };
  } catch {
    return { json: null, txt };
  }
}

async function dagoLogin() {
  if (!DAGO_EMAIL || !DAGO_SENHA) {
    throw new Error("Defina DAGO_EMAIL e DAGO_SENHA no .env");
  }

  console.log("🔐 Autenticando na API Dago...");

  const response = await fetch(`${BASE_URL}/api/Auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: DAGO_EMAIL,
      senha: DAGO_SENHA,
    }),
  });

  const { json, txt } = await readJsonSafe(response);

  if (!response.ok) {
    throw new Error(
      `Login falhou (${response.status}): ${txt || response.statusText}`
    );
  }

  const token =
    pick(json, ["token", "accessToken", "access_token"]) ||
    pick(json?.data, ["token", "accessToken", "access_token"]) ||
    pick(json?.result, ["token", "accessToken", "access_token"]);

  if (!token) {
    console.log("Resposta login:", json);
    throw new Error("Login OK, mas token não encontrado.");
  }

  console.log("✅ Login API Dago realizado.");
  return token;
}

async function buscarProxima(authToken) {
  const response = await fetch(
    `${BASE_URL}/api/emissao-complementar/robo/proxima`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }
  );

  const { json, txt } = await readJsonSafe(response);

  if (!response.ok) {
    throw new Error(
      `Erro ao buscar próxima (${response.status}): ${
        txt || response.statusText
      }`
    );
  }

  if (json?.item === null) {
    return null;
  }

  return json;
}

async function registrarSucesso(authToken, id, numeroDocumentoGerado) {
  const response = await fetch(
    `${BASE_URL}/api/emissao-complementar/robo/sucesso/${id}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        numeroDocumentoGerado,
      }),
    }
  );

  const { txt } = await readJsonSafe(response);

  if (!response.ok) {
    throw new Error(
      `Erro ao registrar sucesso (${response.status}): ${
        txt || response.statusText
      }`
    );
  }
}

async function registrarErro(authToken, id, mensagemErro, etapa, stackTrace) {
  const response = await fetch(
    `${BASE_URL}/api/emissao-complementar/robo/erro/${id}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mensagemErro,
        etapa,
        stackTrace,
      }),
    }
  );

  const { txt } = await readJsonSafe(response);

  if (!response.ok) {
    throw new Error(
      `Erro ao registrar erro (${response.status}): ${
        txt || response.statusText
      }`
    );
  }
}

module.exports = {
  dagoLogin,
  buscarProxima,
  registrarSucesso,
  registrarErro,
};