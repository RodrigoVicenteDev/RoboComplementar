const {
  fill,
  setInputOrValidate,
  getTargetWithSelector,
  openAfterAction,
  closeExtraPages,
  debugScreenshot,
  findFrameWithSelector,
  sleep,
} = require("../ssw/helpers");

const { typeMenuOption, recoverMenuPage } = require("../ssw/session");

const {
  parseCtrcComDv,
  normalizeValue,
} = require("../utils/formatters");

function extrairNumeroNovoCtrc(texto) {
  const value = normalizeValue(texto);
  const match = value.match(/Novo\s+CTRC:\s*([A-Z]{3})?(\d+)-(\d+)/i);

  if (!match) {
    throw new Error(`Não consegui extrair o Novo CTRC do texto: "${value}"`);
  }

  const sigla = match[1] ? match[1].toUpperCase() : "";
  return `${sigla}${match[2]}-${match[3]}`;
}

async function openOption16(menuPage, context) {
  console.log("6) Abrindo opção 16...");

  const selector16 = [
    'input[name="f1"]',
    'input[id="1"]',
    'input[name="f2"]',
    'input[id="2"]',
    'input[name="f3"]',
    'input[id="3"]',
    'a[id="4"]',
  ].join(", ");

  await debugScreenshot(menuPage, "debug_antes_016.png");

  const page16 = await openAfterAction({
    context,
    currentPage: menuPage,
    selector: selector16,
    label: "opção 16",
    action: async () => {
      await typeMenuOption(menuPage, "16");
      await debugScreenshot(menuPage, "debug_pos_016.png");
    },
  });

  await debugScreenshot(page16, "02_tela_016_inicial.png");

  return page16;
}

async function preencherTela016Inicial(context, page16Base, item) {
  console.log(`8) Preenchendo tela 016 inicial para CTRC ${item.ctrc}...`);

  const parsed = parseCtrcComDv(item.ctrc);

  const found = await getTargetWithSelector(
    context,
    page16Base,
    'input[name="f1"], input[id="1"]',
    "tela 016 inicial"
  );

  const pageReal = found.page;
  const target = found.target;

  await fill(target, 'input[name="f1"], input[id="1"]', "R");
  await fill(target, 'input[name="f2"], input[id="2"]', parsed.sigla);
  await fill(target, 'input[name="f3"], input[id="3"]', parsed.semHifenComDv);

  await debugScreenshot(pageReal, `03_tela_016_inicial_${parsed.semHifenComDv}.png`);

  return pageReal;
}

async function avancarTela016Inicial(context, page16Base) {
  console.log("9) Clicando na primeira setinha da 016...");

  const found = await getTargetWithSelector(
    context,
    page16Base,
    'input[name="f1"], input[id="1"]',
    "tela 016 inicial"
  );

  const pageReal = found.page;
  const target = found.target;

  const selectorTela2 = [
    'input[name="f3"]',
    'input[id="3"]',
    'input[name="f7"]',
    'input[id="7"]',
    'input[name="f8"]',
    'input[id="8"]',
    'a[id="9"]',
  ].join(", ");

  const pageTela2 = await openAfterAction({
    context,
    currentPage: pageReal,
    selector: selectorTela2,
    label: "segunda tela da 016",
    action: async () => {
      const seta = target.locator('a[id="4"]').first();

      await seta.waitFor({
        state: "visible",
        timeout: 30000,
      });

      await seta.click();
    },
  });

  await clicarContinuarSeAparecer(context, pageTela2, "aviso inicial da 016");

  await debugScreenshot(pageTela2, "04_tela_016_segunda_tela.png");

  return pageTela2;
}

async function clicarContinuarSeAparecer(context, pageHint, label = "aviso") {
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    const pages = context.pages().filter((p) => !p.isClosed());

    for (const p of pages) {
      try {
        const continuar = p.locator('a.dialog:has-text("Continuar")').first();

        if (await continuar.isVisible().catch(() => false)) {
          console.log(`⚠️ ${label}: clicando em Continuar.`);
          await continuar.click({ force: true }).catch(() => {});
          await sleep(500);
          return true;
        }

        const fr = await findFrameWithSelector(p, 'a.dialog:has-text("Continuar")');

        if (fr) {
          const continuarFrame = fr.locator('a.dialog:has-text("Continuar")').first();

          if (await continuarFrame.isVisible().catch(() => false)) {
            console.log(`⚠️ ${label}: clicando em Continuar no frame.`);
            await continuarFrame.click({ force: true }).catch(() => {});
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

async function preencherTela016Reentrega(context, pageTela2, item) {
  console.log("10) Preenchendo tela de reentrega da 016...");

  const found = await getTargetWithSelector(
    context,
    pageTela2,
    'input[name="f3"], input[id="3"]',
    "tela de reentrega da 016"
  );

  const pageReal = found.page;
  const target = found.target;

  const obs1 = normalizeValue(item.obsSsw1);
  const obs2 = normalizeValue(item.obsSsw2);

  // LOCAL DA PRESTAÇÃO = O
  const localPrestacao = target.locator(
    'input[name="f2"], input[id="2"]'
  ).first();

  if (await localPrestacao.isVisible().catch(() => false)) {
    const disabled = await localPrestacao.isDisabled().catch(() => true);

    if (!disabled) {
      await setInputOrValidate(
        target,
        'input[name="f2"], input[id="2"]',
        "O"
      );
    }
  }

  // TIPO DOCUMENTO = C
  await setInputOrValidate(
    target,
    'input[name="f3"], input[id="3"]',
    "C"
  );

  await fill(target, 'input[name="f7"], input[id="7"]', obs1.slice(0, 55));
  await fill(target, 'input[name="f8"], input[id="8"]', obs2.slice(0, 55));

  await debugScreenshot(pageReal, "05_tela_016_reentrega_preenchida.png");

  return pageReal;
}

async function enviarTela016Reentrega(context, pageTela2) {
  console.log("11) Clicando na setinha final da 016...");

  const found = await getTargetWithSelector(
    context,
    pageTela2,
    'input[name="f7"], input[id="7"]',
    "tela de reentrega da 016"
  );

  const target = found.target;

  const seta = target.locator('a[id="9"]').first();

  await seta.waitFor({
    state: "visible",
    timeout: 30000,
  });

  await seta.click();
}

async function confirmarGeracao016(context, pageHint) {
  console.log("12) Esperando confirmação da geração da reentrega...");

  const clicou = await clicarContinuarSeAparecer(
    context,
    pageHint,
    "confirmação de geração da 016"
  );

  if (!clicou) {
    throw new Error("Não encontrei o modal de confirmação da geração da reentrega.");
  }

  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    const pages = context.pages().filter((p) => !p.isClosed());

    for (const p of pages) {
      try {
        const label = p.locator("div#errormsglabel").first();
        const count = await label.count().catch(() => 0);

        if (count > 0) {
          const visible = await label.isVisible().catch(() => false);
          const texto = await label.innerText().catch(() => "");

          if (visible && texto.includes("Novo CTRC:")) {
            return p;
          }
        }

        const fr = await findFrameWithSelector(p, "div#errormsglabel");

        if (fr) {
          const frameLabel = fr.locator("div#errormsglabel").first();
          const visible = await frameLabel.isVisible().catch(() => false);
          const texto = await frameLabel.innerText().catch(() => "");

          if (visible && texto.includes("Novo CTRC:")) {
            return p;
          }
        }
      } catch {}
    }

    await sleep(250);
  }

  throw new Error("Não encontrei o aviso final com Novo CTRC da reentrega.");
}

async function capturarNovoCtrc016(context, pageHint) {
  console.log("13) Capturando Novo CTRC da reentrega...");

  const found = await getTargetWithSelector(
    context,
    pageHint,
    "div#errormsglabel",
    "aviso final com Novo CTRC da 016",
    30000
  );

  const target = found.target;

  const label = target.locator("div#errormsglabel").first();

  await label.waitFor({
    state: "visible",
    timeout: 30000,
  });

  const texto = await label.innerText();
  const novoCtrc = extrairNumeroNovoCtrc(texto);

  console.log(`✅ Novo CTRC reentrega capturado: ${novoCtrc}`);

  const ok = target.locator('a.dialog:has-text("OK"), a[id="0"]').first();

  if ((await ok.count().catch(() => 0)) > 0) {
    await ok.click({ force: true }).catch(() => {});
  }

  return novoCtrc;
}

async function executar({ context, menuPage, item }) {
  console.log("======================================");
  console.log(`🤖 Processando REENTREGA ${item.emissaoComplementarId}`);
  console.log(`CTRC: ${item.ctrc}`);
  console.log(`Tipo complementar: ${item.tipoComplementar}`);
  console.log("Opção SSW: 16");
  console.log("======================================");

  await closeExtraPages(context, [menuPage]);

  const menuAtual = await recoverMenuPage(context);
  const page16Base = await openOption16(menuAtual, context);

  const pageReal1 = await preencherTela016Inicial(context, page16Base, item);
  const pageTela2 = await avancarTela016Inicial(context, pageReal1);
  const pageReal2 = await preencherTela016Reentrega(context, pageTela2, item);

  await enviarTela016Reentrega(context, pageReal2);

  const pageFinal = await confirmarGeracao016(context, pageReal2);
  const novoCtrc = await capturarNovoCtrc016(context, pageFinal);

  await closeExtraPages(context, [menuAtual]);

  return {
    numeroDocumentoGerado: novoCtrc,
  };
}

module.exports = {
  nome: "reentrega",
  executar,
};