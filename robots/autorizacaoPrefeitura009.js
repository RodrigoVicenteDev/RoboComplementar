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

    if (pageHint && !pageHint.isClosed()) {
      try {
        const ok = pageHint.locator('a.dialog:has-text("OK"), a[id="0"]').first();

        if (await ok.isVisible().catch(() => false)) {
          const texto = await pageHint.locator("div#errormsglabel").innerText().catch(() => "");
          console.log(`${label}: ${texto.replace(/\s+/g, " ").trim()}`);
          await ok.click({ force: true }).catch(() => {});
          await sleep(500);
          return true;
        }
      } catch {}
    }

    await sleep(250);
  }

  return false;
}

async function openOption009(menuPage, context) {
  console.log("Pós-processamento 009) Abrindo opção 009...");

  const selector009 = [
    'a[id="link_env_meus_1"]',
    'a[id="lnk_imp_meus_1"]',
    'input[id="id_imp_ordem_nf"]',
  ].join(", ");

  await debugScreenshot(menuPage, "debug_antes_009.png");

  const page009 = await openAfterAction({
    context,
    currentPage: menuPage,
    selector: selector009,
    label: "opção 009",
    action: async () => {
      await typeMenuOption(menuPage, "9");
      await debugScreenshot(menuPage, "debug_pos_009.png");
    },
  });

  await debugScreenshot(page009, "pos_009_tela_inicial.png");

  return page009;
}

async function clicarEnviarPrefeituraMeus(context, page009) {
  console.log("Pós-processamento 009) Clicando em Enviar à Prefeitura / meus...");

  const found = await getTargetWithSelector(
    context,
    page009,
    'a[id="link_env_meus_1"]',
    "link Enviar à Prefeitura / meus da 009",
    30000
  );

  const pageReal = found.page;
  const target = found.target;

  const link = target.locator('a[id="link_env_meus_1"]').first();

  await link.waitFor({
    state: "visible",
    timeout: 30000,
  });

  await link.click({ force: true });

  await sleep(1500);
  await clicarOkSeAparecer(context, pageReal, "Retorno Enviar à Prefeitura / meus");

  await debugScreenshot(pageReal, "pos_009_enviar_prefeitura_meus.png");

  return pageReal;
}

async function clicarAutorizadosSemImpressaoMeus(context, page009) {
  console.log("Pós-processamento 009) Clicando em Autorizados sem impressão / meus...");

  const found = await getTargetWithSelector(
    context,
    page009,
    'a[id="lnk_imp_meus_1"]',
    "link Autorizados sem impressão / meus da 009",
    30000
  );

  const pageReal = found.page;
  const target = found.target;

  const link = target.locator('a[id="lnk_imp_meus_1"]').first();

  await link.waitFor({
    state: "visible",
    timeout: 30000,
  });

  const downloadPromise = pageReal.waitForEvent("download", { timeout: 10000 }).catch(() => null);

  await link.click({ force: true });

  const download = await downloadPromise;

  if (download) {
    console.log("Pós-processamento 009) Download detectado e ignorado.");
    await download.delete().catch(() => {});
  }

  await sleep(1500);
  await clicarOkSeAparecer(context, pageReal, "Retorno Autorizados sem impressão / meus");

  await debugScreenshot(pageReal, "pos_009_autorizados_meus.png");

  return pageReal;
}

async function executar({ context, menuPage }) {
  console.log("======================================");
  console.log("🤖 Pós-processamento 009 iniciado");
  console.log("======================================");

  await closeExtraPages(context, [menuPage]);

  const menuAtual = await recoverMenuPage(context);
  const page009 = await openOption009(menuAtual, context);

  const pageAposEnvio = await clicarEnviarPrefeituraMeus(context, page009);

  console.log("Pós-processamento 009) Aguardando 60 segundos...");
  await sleep(60000);

  await clicarAutorizadosSemImpressaoMeus(context, pageAposEnvio);

  await closeExtraPages(context, [menuAtual]);

  console.log("✅ Pós-processamento 009 finalizado.");

  return {
    ok: true,
  };
}

module.exports = {
  nome: "autorizacaoPrefeitura009",
  executar,
};