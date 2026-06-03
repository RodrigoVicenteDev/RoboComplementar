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
    'a[id="5"]',
    'a[id="link_imp_meus_sem_imp_2"]',
    'a:has-text("Enviar à SEFAZ")',
    'body:has-text("Autorização de CT-es pelo SEFAZ")',
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

  await sleep(3000);
  await debugScreenshot(page007, "pos_007_tela_inicial.png");

  return page007;
}

async function clicarDigitadosMeus(context, page007) {
  console.log("Pós-processamento 007) Clicando em Digitados / meus...");

  const found = await getTargetWithSelector(
    context,
    page007,
    'a[id="5"]',
    "link Digitados / meus da 007",
    30000
  );

  const pageReal = found.page;
  const target = found.target;

  const link = target.locator('a[id="5"]').first();

  await link.waitFor({ state: "visible", timeout: 30000 });
  await link.click({ force: true });

  await sleep(5000);

  const teveAviso = await clicarOkSeAparecer(
    context,
    pageReal,
    "Retorno Digitados / meus"
  );

  await debugScreenshot(pageReal, "pos_007_digitados_meus.png");

  return { pageReal, teveAviso };
}

async function atualizarFilaELerEnviados(context, page007) {
  const found = await getTargetWithSelector(
    context,
    page007,
    'a[id="1"], a[id="6"]',
    "Atualizar fila / Enviados à SEFAZ da 007",
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

  // SSW antigo + Linux/headless funciona melhor assim
  await atualizar.evaluate((el) => el.click());

  await sleep(4000);

  await debugScreenshot(pageReal, "pos_007_apos_atualizar_fila.png");

  await clicarOkSeAparecer(
    context,
    pageReal,
    "Retorno Atualizar fila 007"
  );

  await sleep(1000);

  const textoEnviados = await lerTextoTarget(
    target,
    'input[id="sefaz"], a[id="6"]'
  );

  const textoLimpo = String(textoEnviados ?? "").trim();

  const quantidade =
    textoLimpo === ""
      ? -1
      : parseNumeroFila(textoLimpo);

  console.log(
    `Pós-processamento 007) Enviados à SEFAZ: ${
      textoLimpo || "aguardando contador"
    }`
  );

  return {
    pageReal,
    quantidade,
  };
}

async function aguardarFilaSefazZerar(context, page007) {
  console.log("Pós-processamento 007) Aguardando fila SEFAZ zerar...");

  let pageAtual = page007;
  const maxTentativas = 30;
  let filaInicializada = false;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    const resultado = await atualizarFilaELerEnviados(context, pageAtual);
    pageAtual = resultado.pageReal;

    if (resultado.quantidade === -1) {
      console.log("Pós-processamento 007) SSW ainda não atualizou contador da fila...");
      await sleep(5000);
      continue;
    }

    if (resultado.quantidade > 0) {
      filaInicializada = true;

      console.log(
        `Pós-processamento 007) Ainda há ${resultado.quantidade} enviado(s) à SEFAZ. Nova consulta em 10s...`
      );

      await sleep(10000);
      continue;
    }

    if (filaInicializada && resultado.quantidade === 0) {
      console.log("Pós-processamento 007) Fila SEFAZ zerada.");
      return pageAtual;
    }

    console.log("Pós-processamento 007) Aguardando inicialização da fila...");
    await sleep(5000);
  }

  console.log("Pós-processamento 007) Timeout aguardando fila SEFAZ. Vou tentar imprimir mesmo assim.");
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

  if (resultadoDigitados.teveAviso) {
    console.log("Pós-processamento 007) Aviso no envio de Digitados / meus. Encerrando 007 sem tentar impressão.");
    await closeExtraPages(context, [menuAtual]);
    console.log("✅ Pós-processamento 007 finalizado.");
    return { ok: true };
  }

  const pageFilaZerada = await aguardarFilaSefazZerar(
    context,
    resultadoDigitados.pageReal
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