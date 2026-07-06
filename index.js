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

const { loginSSW, recoverMenuPage, resetSessaoCompleta } = require("./ssw/session");
const {
  sleep,
  closeExtraPages,
  getTargetWithSelector,
  fill,
} = require("./ssw/helpers");
const { parseCtrcComDv } = require("./utils/formatters");

const complementar222 = require("./robots/complementar222");
const reentrega = require("./robots/reentrega");
const paletizacao = require("./robots/paletizacao");

const autorizacaoSefaz007 = require("./robots/autorizacaoSefaz007");
const autorizacaoPrefeitura009 = require("./robots/autorizacaoPrefeitura009");
const capaComprovante040 = require("./robots/capaComprovante040");

const HEADLESS = String(process.env.HEADLESS ?? "1").trim() !== "0";
const MAX_ERROS_CONSECUTIVOS = Number(process.env.MAX_ERROS_CONSECUTIVOS ?? 3);

const robots = {
  complementar222,
  reentrega,
  paletizacao,
};

const posProcessamentos = [
  autorizacaoSefaz007,
  autorizacaoPrefeitura009,
  capaComprovante040,
];

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
async function trocarUnidadeMenu(context, menuPage, unidade) {
  console.log(`🔄 Alterando unidade do menu para ${unidade}...`);

  const menuAtual = await recoverMenuPage(context);

  const found = await getTargetWithSelector(
    context,
    menuAtual,
    'input[name="f2"], input[id="2"]',
    "campo Unidade do menu",
    30000
  );

  const target = found.target;

  await fill(target, 'input[name="f2"], input[id="2"]', unidade);

  await target
    .locator('input[name="f2"], input[id="2"]')
    .first()
    .evaluate((el) => {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.blur();
    })
    .catch(() => {});

  await sleep(2000);

  console.log(`✅ Unidade do menu alterada para ${unidade}.`);

  return found.page;
}

async function executarPosDescarga(context, menuPage, unidade, numeroDocumento) {
  const isPrefeitura = String(numeroDocumento ?? "").trim().startsWith("999");
  const autorizacao = isPrefeitura ? autorizacaoPrefeitura009 : autorizacaoSefaz007;

  console.log("======================================");
  console.log(`🤖 Pós-processamento imediato da DESCARGA | Unidade ${unidade} | Doc ${numeroDocumento}`);
  console.log(`Documento ${numeroDocumento} → ${isPrefeitura ? "Prefeitura (009)" : "SEFAZ (007)"}`);
  console.log("======================================");

  let menuAtual = await trocarUnidadeMenu(context, menuPage, unidade);
  await closeExtraPages(context, [menuAtual]);

  await autorizacao.executar({ context, menuPage: menuAtual, esperaAutorizacaoMs: 3000 }); // 7 OU 9
  menuAtual = await recoverMenuPage(context);
  await closeExtraPages(context, [menuAtual]);

  await capaComprovante040.executar({ context, menuPage: menuAtual }); // depois o 40
  menuAtual = await recoverMenuPage(context);
  await closeExtraPages(context, [menuAtual]);

  return menuAtual;
}

async function executarPosProcessamentos(context, menuPage, unidadesProcessadas) {
  console.log("======================================");
  console.log("🤖 Iniciando pós-processamentos");
  console.log("======================================");

  let menuAtual = menuPage;

  const unidades = Array.from(unidadesProcessadas || []).filter(Boolean);

  if (unidades.length <= 0) {
    console.log("Nenhuma unidade processada. Pós-processamentos não serão executados.");
    return menuAtual;
  }

  console.log("Unidades para pós-processamento:", unidades.join(", "));

  for (const unidade of unidades) {
    console.log("======================================");
    console.log(`🏢 Pós-processamentos da unidade ${unidade}`);
    console.log("======================================");

    try {
      menuAtual = await trocarUnidadeMenu(context, menuAtual, unidade);
      await closeExtraPages(context, [menuAtual]);
    } catch (err) {
      console.error(
        `⚠️ Não consegui alterar unidade para ${unidade}:`,
        err?.stack || err
      );
      continue;
    }

    for (const pos of posProcessamentos) {
      try {
        console.log(`▶️ Executando pós-processamento: ${pos.nome} | Unidade ${unidade}`);

        await pos.executar({
          context,
          menuPage: menuAtual,
        });

        menuAtual = await recoverMenuPage(context);
        await closeExtraPages(context, [menuAtual]);

        console.log(`✅ Pós-processamento finalizado: ${pos.nome} | Unidade ${unidade}`);
      } catch (err) {
        console.error(
          `⚠️ Erro no pós-processamento ${pos.nome} | Unidade ${unidade}:`,
          err?.stack || err
        );

        try {
          menuAtual = await resetSessaoCompleta(context);
        } catch (recoverErr) {
          console.error(
            `⚠️ Não consegui recuperar a sessão após erro no pós-processamento ${pos.nome}:`,
            recoverErr?.stack || recoverErr
          );
        }
      }
    }
  }

  console.log("======================================");
  console.log("✅ Pós-processamentos concluídos");
  console.log("======================================");

  return menuAtual;
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
    let errosConsecutivos = 0;

    const unidadesProcessadas = new Set();

    while (true) {
      const apiResponse = await buscarProxima(authToken);

      if (!apiResponse) {
        console.log("Nenhuma emissão pendente encontrada.");
        break;
      }

      const item = prepararItem(apiResponse);
      const robo = robots[item.robo];

    const parsedCtrc = parseCtrcComDv(item.ctrc);
    // descarga é pós-processada na hora; as demais vão pro lote final
    if (item.motivoSSW !== "D") {
      unidadesProcessadas.add(parsedCtrc.sigla);
    }

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
        errosConsecutivos = 0;

        console.log(
          `✅ Emissão ${item.emissaoComplementarId} registrada como EMITIDA | Documento ${resultado.numeroDocumentoGerado}`
        );

        if (item.motivoSSW === "D") {
          try {
            menuPage = await executarPosDescarga(
              context,
              menuPage,
              parsedCtrc.sigla,
              resultado.numeroDocumentoGerado
            );
          } catch (posErr) {
            console.error(
              "⚠️ Erro no pós-processamento imediato da descarga:",
              posErr?.stack || posErr
            );
            menuPage = await resetSessaoCompleta(context);
          }
        }
      } catch (err) {
        erros++;
        errosConsecutivos++;

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

        if (errosConsecutivos >= MAX_ERROS_CONSECUTIVOS) {
          console.error(
            `🛑 ${errosConsecutivos} erros consecutivos — problema sistêmico (SSW fora do ar, tela alterada, sessão inválida?). Abortando a rodada; emissões restantes ficam pendentes para a próxima execução.`
          );
          break;
        }

        try {
          menuPage = await resetSessaoCompleta(context);
        } catch (recoverErr) {
          console.error(
            "❌ Falha ao recuperar sessão após erro:",
            recoverErr?.stack || recoverErr
          );

          throw recoverErr;
        }
      }

      await sleep(1000);
    }

    if (errosConsecutivos >= MAX_ERROS_CONSECUTIVOS) {
      console.log("⏭️ Pós-processamentos pulados por causa da rodada abortada.");
    } else {
      menuPage = await executarPosProcessamentos(
        context,
        menuPage,
        unidadesProcessadas
      );
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