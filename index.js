require("dotenv").config();

const { chromium } = require("playwright");

const { setupLogger } = require("./utils/logger");
const { normalizarTipoComplementar } = require("./utils/normalizers");

const {
  dagoLogin,
  buscarProxima,
  registrarSucesso,
  registrarErro,
} = require("./apiDago");

const { loginSSW, recoverMenuPage } = require("./ssw/session");
const { sleep, closeExtraPages } = require("./ssw/helpers");

const complementar222 = require("./robots/complementar222");
const reentrega = require("./robots/reentrega");
const paletizacao = require("./robots/paletizacao");

const HEADLESS = String(process.env.HEADLESS ?? "1").trim() !== "0";

const robots = {
  complementar222,
  reentrega,
  paletizacao,
};

function prepararItem(apiResponse) {
  const item = apiResponse?.item ?? apiResponse;

  if (!item) throw new Error("Resposta da API sem item.");
  if (!item.emissaoComplementarId) throw new Error("Item sem emissaoComplementarId.");
  if (!item.tipoComplementar) throw new Error("Item sem tipoComplementar.");
  if (!item.ctrc) throw new Error("Item sem CTRC.");

  const configRobo = normalizarTipoComplementar(item.tipoComplementar);

  return {
    ...item,
    ...configRobo,
  };
}

async function run() {
  const { LOG_FILE } = setupLogger();

  console.log("🤖 Robô REAL de emissão complementar iniciado");
  console.log("API:", process.env.DAGO_API_BASE ?? "https://api.paineldg.com.br");
  console.log("HEADLESS:", HEADLESS);
  console.log("DEBUG:", String(process.env.DEBUG ?? "").trim() === "1");
  console.log("Log:", LOG_FILE);

  const authToken = await dagoLogin();

  const browser = await chromium.launch({
    headless: HEADLESS,
  });

  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: {
        width: 1366,
        height: 768,
      },
    });

    let menuPage = await context.newPage();
    await loginSSW(menuPage);

    let processadas = 0;
    let emitidas = 0;
    let erros = 0;

    while (true) {
      const apiResponse = await buscarProxima(authToken);

      if (!apiResponse) {
        console.log("Nenhuma emissão pendente encontrada.");
        break;
      }

      const item = prepararItem(apiResponse);
      const robo = robots[item.robo];

      if (!robo) {
        throw new Error(`Robô não registrado: ${item.robo}`);
      }

      try {
        const resultado = await robo.executar({
          context,
          menuPage,
          item,
        });

        await registrarSucesso(
          authToken,
          item.emissaoComplementarId,
          resultado.numeroDocumentoGerado
        );

        menuPage = await recoverMenuPage(context);

        processadas++;
        emitidas++;

        console.log(
          `✅ Emissão ${item.emissaoComplementarId} registrada como EMITIDA | Documento ${resultado.numeroDocumentoGerado}`
        );
      } catch (err) {
        erros++;

        console.error(
          `❌ Erro na emissão ${item.emissaoComplementarId} | CTRC ${item.ctrc}:`,
          err?.stack || err
        );

        try {
          await registrarErro(
            authToken,
            item.emissaoComplementarId,
            String(err?.message || err).slice(0, 500),
            robo.nome,
            err?.stack || null
          );
        } catch (erroRegistro) {
          console.error(
            "❌ Falha ao registrar erro na API:",
            erroRegistro?.message || erroRegistro
          );
        }

        try {
          menuPage = await recoverMenuPage(context);
          await closeExtraPages(context, [menuPage]);
        } catch (recoverErr) {
          console.error(
            "❌ Falha ao recuperar menu após erro:",
            recoverErr?.stack || recoverErr
          );

          throw recoverErr;
        }
      }

      await sleep(1000);
    }

    console.log("======================================");
    console.log("Fim do processamento REAL");
    console.log("Processadas:", processadas);
    console.log("Emitidas:", emitidas);
    console.log("Erros:", erros);
    console.log("Log:", LOG_FILE);
    console.log("======================================");
  } finally {
    await browser.close().catch(() => {});
  }
}

run().catch((err) => {
  console.error("🛑 Falha geral:", err?.stack || err);
  process.exit(1);
});