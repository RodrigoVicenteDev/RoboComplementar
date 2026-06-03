const {
  getTargetWithSelector,
  openAfterAction,
  closeExtraPages,
  debugScreenshot,
  findFrameWithSelector,
  sleep,
} = require("../ssw/helpers");

const { typeMenuOption, recoverMenuPage } = require("../ssw/session");

async function clicarOkSeAparecer(context, pageHint, label = "aviso") {
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    const pages = context.pages().filter((p) => !p.isClosed());

    for (const p of pages) {
      try {
        const ok = p.locator('a.dialog:has-text("OK"), a[id="0"]').first();

        if (await ok.isVisible().catch(() => false)) {
          const texto = await p.locator("div#errormsglabel").innerText().catch(() => "");
          console.log(`${label}: ${texto.replace(/\s+/g, " ").trim()}`);
          await ok.click({ force: true }).catch(() => {});
          await sleep(500);
          return true;
        }

        const fr = await findFrameWithSelector(p, 'a.dialog:has-text("OK"), a[id="0"]');

        if (fr) {
          const okFrame = fr.locator('a.dialog:has-text("OK"), a[id="0"]').first();

          if (await okFrame.isVisible().catch(() => false)) {
            const texto = await fr.locator("div#errormsglabel").innerText().catch(() => "");
            console.log(`${label}: ${texto.replace(/\s+/g, " ").trim()}`);
            await okFrame.click({ force: true }).catch(() => {});
            await sleep(500);
            return true;
          }
        }
      } catch {}
    }

    await sleep(250);
  }

  return false;
}

async function clicarEnviarSefazMeus(context, page007) {
  console.log("Pós-processamento 007) Clicando em Enviar à SEFAZ / meus...");

  const found = await getTargetWithSelector(
    context,
    page007,
    'a[id="5"]',
    "link Enviar à SEFAZ / meus da 007",
    30000
  );

  const pageReal = found.page;
  const target = found.target;

  const link = target.locator('a[id="5"]').first();

  await link.waitFor({ state: "visible", timeout: 30000 });
  await link.click({ force: true });

  await sleep(5000);

  await clicarOkSeAparecer(context, pageReal, "Retorno Enviar à SEFAZ / meus");

  await debugScreenshot(pageReal, "pos_007_enviar_sefaz_meus.png");

  return pageReal;
}
async function lerTextoTarget(target, selector) {
  return await target
    .locator(selector)
    .first()
    .innerText()
    .catch(async () => {
      return await target.locator(selector).first().inputValue().catch(() => "");
    });
}

function parseNumeroFila(texto) {
  const value = String(texto ?? "").replace(/\s+/g, "").trim();
  if (!value) return 0;

  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

async function openOption007(menuPage, context) {
  console.log("Pós-processamento 007) Abrindo opção 007...");

  const selector007 = [
    'input[id="sefaz"]',
    'a[id="1"][onclick*="ATU"]',
    'a[id="5"][onclick*="ENV"]',
    'a[id="link_imp_meus_sem_imp_2"]',
  ].join(", ");

  await debugScreenshot(menuPage, "debug_antes_007.png");

  const page007 = await openAfterAction({
    context,
    currentPage: menuPage,
    selector: selector007,
    label: "opção 007",
    action: async () => {
      await typeMenuOption(menuPage, "7");
      await debugScreenshot(menuPage, "debug_pos_007.png");
    },
  });

  await sleep(5000);

  const found = await getTargetWithSelector(
    context,
    page007,
    selector007,
    "tela real da opção 007",
    60000
  );

  await debugScreenshot(found.page, "pos_007_tela_inicial.png");

  return found.page;
}

async function clicarDigitadosMeus(context, page007) {
  console.log("Pós-processamento 007) Abrindo tela de Digitados...");

  const found = await getTargetWithSelector(
    context,
    page007,
    'a[id="3"]',
    "contador Digitados da 007",
    30000
  );

  const pageReal = found.page;
  const target = found.target;

  const contador = target.locator('a[id="3"]').first();

  await contador.waitFor({
    state: "visible",
    timeout: 30000,
  });

  const paginaDigitadosPromise = openAfterAction({
    context,
    currentPage: pageReal,
    selector: 'table, a[href*="gructr"]',
    label: "tela Digitados",
    action: async () => {
      await contador.click({ force: true });
    },
  });

  const paginaDigitados = await paginaDigitadosPromise;

  await sleep(5000);

  await debugScreenshot(
    paginaDigitados,
    "pos_007_tela_digitados.png"
  );

  // Conta linhas reais da tabela
  // Conta linhas cujo Digitador seja o usuário do robô
let quantidade = 0;

try {
  quantidade = await paginaDigitados.evaluate(() => {
    const usuarioRobo = "dora";

    const linhasXml = Array.from(
      document.querySelectorAll("xml#xmlsr r")
    );

    if (linhasXml.length > 0) {
      return linhasXml.filter((linha) => {
        const digitador = linha.querySelector("f13")?.textContent || "";
        return digitador.trim().toLowerCase() === usuarioRobo;
      }).length;
    }

    const linhasTabela = Array.from(
      document.querySelectorAll("tr.srtr2")
    );

    return linhasTabela.filter((linha) => {
      const celulas = Array.from(linha.querySelectorAll("td"));
      const digitador = celulas[13]?.innerText || "";
      return digitador.trim().toLowerCase() === usuarioRobo;
    }).length;
  });
} catch {
  quantidade = 0;
}

  console.log(
    `Pós-processamento 007) Quantidade encontrada em Digitados: ${quantidade}`
  );

  // Se não tiver nada digitado, encerra tudo
  if (quantidade <= 0) {
    console.log(
      "Pós-processamento 007) Nenhum CT-e digitado encontrado. Encerrando processamento."
    );

    await paginaDigitados.close().catch(() => {});

    return {
      pageReal,
      quantidade: 0,
      teveAviso: true,
    };
  }

  // Fecha tela Digitados
  await paginaDigitados.close().catch(() => {});

  await sleep(1000);

  // Volta para tela principal 007
  const page007Retorno = await getTargetWithSelector(
    context,
    pageReal,
    'a[id="5"]',
    "retorno tela principal 007",
    30000
  );

  console.log(
    `Pós-processamento 007) ${quantidade} CT-e(s) digitado(s) encontrados.`
  );

  return {
    pageReal: page007Retorno.page,
    quantidade,
    teveAviso: false,
  };
}

async function atualizarFilaELerEnviados(context, page007) {
  const found = await getTargetWithSelector(
    context,
    page007,
    'a[id="1"], a[id="6"], a[id="9"]',
    "Atualizar fila / Enviados / Autorizados da 007",
    30000
  );

  const pageReal = found.page;
  const target = found.target;

  await debugScreenshot(pageReal, "pos_007_antes_atualizar_fila.png");

  const atualizar = target.locator('a[id="1"]').first();

  await atualizar.waitFor({
    state: "visible",
    timeout: 30000,
  });

  console.log("Pós-processamento 007) Atualizando fila SEFAZ...");

  await atualizar.evaluate((el) => el.click());

  await sleep(4000);

  await debugScreenshot(pageReal, "pos_007_apos_atualizar_fila.png");

  await clicarOkSeAparecer(
    context,
    pageReal,
    "Retorno Atualizar fila 007"
  );

  await sleep(1000);

  // =========================
  // ENVIADOS À SEFAZ
  // =========================

  const textoEnviados = await lerTextoTarget(
    target,
    'input[id="sefaz"], a[id="6"]'
  );

  const textoEnviadosLimpo = String(textoEnviados ?? "").trim();

  const enviados =
    textoEnviadosLimpo === ""
      ? -1
      : parseNumeroFila(textoEnviadosLimpo);

  // =========================
  // AUTORIZADOS SEM IMPRESSÃO
  // =========================

  let autorizados = 0;

  try {
    const textoAutorizados = await lerTextoTarget(
      target,
      'a[id="9"]'
    );

    autorizados = parseNumeroFila(textoAutorizados);
  } catch {
    autorizados = 0;
  }

  console.log(
    `Pós-processamento 007) Enviados: ${textoEnviadosLimpo || "aguardando"} | Autorizados: ${autorizados}`
  );

  return {
    pageReal,
    enviados,
    autorizados,
  };
}

async function aguardarFilaSefazZerar(
  context,
  page007,
  quantidadeEsperada
) {
  console.log(
    `Pós-processamento 007) Aguardando ${quantidadeEsperada} CT-e(s) autorizado(s)...`
  );

  let pageAtual = page007;

  const maxTentativas = 60;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    const resultado = await atualizarFilaELerEnviados(
      context,
      pageAtual
    );

    pageAtual = resultado.pageReal;

    // fila ainda nem apareceu
    if (resultado.enviados === -1) {
      console.log(
        "Pós-processamento 007) SSW ainda não atualizou fila..."
      );

      await sleep(5000);
      continue;
    }

    // REGRA PRINCIPAL
    if (resultado.autorizados >= quantidadeEsperada) {
      console.log(
        `Pós-processamento 007) Quantidade autorizada atingida (${resultado.autorizados}/${quantidadeEsperada}).`
      );

      return pageAtual;
    }

    console.log(
      `Pós-processamento 007) Aguardando autorizações (${resultado.autorizados}/${quantidadeEsperada})...`
    );

    await sleep(10000);
  }

  console.log(
    "Pós-processamento 007) Timeout aguardando autorizações. Vou tentar imprimir mesmo assim."
  );

  return pageAtual;
}

async function clicarAutorizadosSemImpressaoMeus(context, page007) {
  console.log("Pós-processamento 007) Clicando em Autorizados sem impressão / meus...");

  const found = await getTargetWithSelector(
    context,
    page007,
    'a[id="link_imp_meus_sem_imp_2"]',
    "link Autorizados sem impressão / meus da 007",
    30000
  );

  const pageReal = found.page;
  const target = found.target;

  const link = target.locator('a[id="link_imp_meus_sem_imp_2"]').first();

  await link.waitFor({ state: "visible", timeout: 30000 });

  const downloadPromise = pageReal.waitForEvent("download", { timeout: 10000 }).catch(() => null);

  await link.click({ force: true });

  const download = await downloadPromise;

  if (download) {
    console.log("Pós-processamento 007) Download detectado e ignorado.");
    await download.delete().catch(() => {});
  }

  await sleep(1500);
  await clicarOkSeAparecer(context, pageReal, "Retorno Autorizados sem impressão / meus");

  await debugScreenshot(pageReal, "pos_007_autorizados_meus.png");

  return pageReal;
}

async function executar({ context, menuPage }) {
  console.log("======================================");
  console.log("🤖 Pós-processamento 007 iniciado");
  console.log("======================================");

  await closeExtraPages(context, [menuPage]);

  const menuAtual = await recoverMenuPage(context);
  const page007 = await openOption007(menuAtual, context);

  const resultadoDigitados = await clicarDigitadosMeus(context, page007);

if (
  resultadoDigitados.teveAviso ||
  resultadoDigitados.quantidade <= 0
) {
  console.log(
    "Pós-processamento 007) Nenhum CT-e digitado para processar. Encerrando."
  );

  await closeExtraPages(context, [menuAtual]);

  console.log("✅ Pós-processamento 007 finalizado.");

  return { ok: true };
}

 const pageAposEnvio = await clicarEnviarSefazMeus(
  context,
  resultadoDigitados.pageReal
);

const pageFilaZerada = await aguardarFilaSefazZerar(
  context,
  pageAposEnvio,
  resultadoDigitados.quantidade
);

  await clicarAutorizadosSemImpressaoMeus(context, pageFilaZerada);

  await closeExtraPages(context, [menuAtual]);

  console.log("✅ Pós-processamento 007 finalizado.");

  return { ok: true };
}

module.exports = {
  nome: "autorizacaoSefaz007",
  executar,
};