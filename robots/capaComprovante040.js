const {
  fill,
  getTargetWithSelector,
  openAfterAction,
  closeExtraPages,
  debugScreenshot,
  findFrameWithSelector,
  sleep,
} = require("../ssw/helpers");

const { typeMenuOption, recoverMenuPage } = require("../ssw/session");

function hojeDDMMAA() {
  const d = new Date();

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const aa = String(d.getFullYear()).slice(-2);

  return `${dd}${mm}${aa}`;
}

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

async function openOption040(menuPage, context) {
  console.log("Pós-processamento 040) Abrindo opção 040...");

  const selector040 = [
    'input[name="f1"]',
    'input[id="1"]',
    'input[name="f2"]',
    'input[id="2"]',
    'a[id="3"]',
  ].join(", ");

  await debugScreenshot(menuPage, "debug_antes_040.png");

  const page040 = await openAfterAction({
    context,
    currentPage: menuPage,
    selector: selector040,
    label: "opção 040",
    action: async () => {
      await typeMenuOption(menuPage, "40");
      await debugScreenshot(menuPage, "debug_pos_040.png");
    },
  });

  await debugScreenshot(page040, "pos_040_tela_inicial.png");

  return page040;
}

async function gerarCapaMeus(context, page040) {
  console.log("Pós-processamento 040) Preenchendo data final e clicando Gerar meus...");

  const found = await getTargetWithSelector(
    context,
    page040,
    'input[name="f2"], input[id="2"]',
    "campo data final da opção 040",
    30000
  );

  const pageReal = found.page;
  const target = found.target;

  const hoje = hojeDDMMAA();

  await fill(target, 'input[name="f2"], input[id="2"]', hoje);

  await debugScreenshot(pageReal, "pos_040_data_final_preenchida.png");

  const linkGerarMeus = target.locator('a[id="3"]').first();

  await linkGerarMeus.waitFor({
    state: "visible",
    timeout: 30000,
  });

  const downloadPromise = pageReal.waitForEvent("download", { timeout: 10000 }).catch(() => null);

  await linkGerarMeus.click({ force: true });

  const download = await downloadPromise;

  if (download) {
    console.log("Pós-processamento 040) Download detectado e ignorado.");
    await download.delete().catch(() => {});
  }

  await sleep(1500);
  await clicarOkSeAparecer(context, pageReal, "Retorno Gerar meus 040");

  await debugScreenshot(pageReal, "pos_040_gerar_meus.png");

  return pageReal;
}

async function executar({ context, menuPage }) {
  console.log("======================================");
  console.log("🤖 Pós-processamento 040 iniciado");
  console.log("======================================");

  await closeExtraPages(context, [menuPage]);

  const menuAtual = await recoverMenuPage(context);
  const page040 = await openOption040(menuAtual, context);

  await gerarCapaMeus(context, page040);

  await closeExtraPages(context, [menuAtual]);

  console.log("✅ Pós-processamento 040 finalizado.");

  return {
    ok: true,
  };
}

module.exports = {
  nome: "capaComprovante040",
  executar,
};