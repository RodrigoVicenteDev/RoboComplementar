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

async function openOption007(menuPage, context) {
  console.log("Pós-processamento 007) Abrindo opção 007...");

  const selector007 = [
    'a[id="5"]',
    'a[id="link_imp_meus_sem_imp_2"]',
    'input[name="f13"]',
    'input[id="13"]',
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

  await link.waitFor({
    state: "visible",
    timeout: 30000,
  });

  await link.click({ force: true });

  await sleep(1500);
  await clicarOkSeAparecer(context, pageReal, "Retorno Digitados / meus");

  await debugScreenshot(pageReal, "pos_007_digitados_meus.png");

  return pageReal;
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

  await link.waitFor({
    state: "visible",
    timeout: 30000,
  });

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

  const pageAposDigitados = await clicarDigitadosMeus(context, page007);

  console.log("Pós-processamento 007) Aguardando 60 segundos...");
  await sleep(60000);

  await clicarAutorizadosSemImpressaoMeus(context, pageAposDigitados);

  await closeExtraPages(context, [menuAtual]);

  console.log("✅ Pós-processamento 007 finalizado.");

  return {
    ok: true,
  };
}

module.exports = {
  nome: "autorizacaoSefaz007",
  executar,
};