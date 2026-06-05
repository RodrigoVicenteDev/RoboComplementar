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
async function preencherCampoCurtoObrigatorio(target, selector, valor, nomeCampo) {
  const loc = target.locator(selector).first();

  await loc.waitFor({
    state: "visible",
    timeout: 30000,
  });

  const valorTratado = String(valor ?? "").trim().toUpperCase();

  if (!valorTratado) {
    throw new Error(`${nomeCampo} vazio. Não vou preencher valor padrão inventado.`);
  }

  await loc.click({ force: true }).catch(() => {});
  await loc.press("Control+A").catch(() => {});
  await loc.press("Backspace").catch(() => {});
  await loc.type(valorTratado, { delay: 120 });
  await loc.press("Tab").catch(() => {});
  await sleep(500);

  const valorFinal = await loc.inputValue().catch(() => "");

  if (String(valorFinal).trim().toUpperCase() !== valorTratado) {
    throw new Error(
      `${nomeCampo} não foi preenchido corretamente. Esperado "${valorTratado}", ficou "${valorFinal}".`
    );
  }

  console.log(`${nomeCampo} preenchido: ${valorFinal}`);
}

async function preencherTela016Reentrega(context, pageTela2, item) {
  console.log("10) Preenchendo tela de reentrega da 016...");

  const found = await getTargetWithSelector(
    context,
    pageTela2,
    'input[name="f2"], input[id="2"], input[name="f3"], input[id="3"], input[name="f4"], input[id="4"]',
    "tela de reentrega da 016"
  );

  const pageReal = found.page;
  const target = found.target;

  const obs1 = normalizeValue(item.obsSsw1);
  const obs2 = normalizeValue(item.obsSsw2);

  const localPrestacao = process.env.SSW_LOCAL_PRESTACAO ?? "O";
  const tipoDocumento = normalizeValue(item.tipoDocumento).toUpperCase();

  if (!tipoDocumento) {
    throw new Error(
      `Item ${item.emissaoComplementarId} sem tipoDocumento para reentrega.`
    );
  }

  await preencherCampoCurtoObrigatorio(
    target,
    'input[name="f2"], input[id="2"]',
    localPrestacao,
    "Local de prestação"
  );

  // f2 dispara getFil(this.value), então espera o SSW terminar antes do f3.
  await sleep(1500);

  await preencherCampoCurtoObrigatorio(
    target,
    'input[name="f4"], input[id="4"]',
    "1",
    "Tipo de frete"
  );

  await fill(target, 'input[name="f7"], input[id="7"]', obs1.slice(0, 55));
  await fill(target, 'input[name="f8"], input[id="8"]', obs2.slice(0, 55));

  // Tipo do documento fica POR ÚLTIMO para não ser limpo pelo getFil.
  await preencherCampoCurtoObrigatorio(
    target,
    'input[name="f3"], input[id="3"]',
    tipoDocumento,
    "Tipo do documento"
  );

  await target
    .locator('input[name="f6"], input[id="6"]')
    .first()
    .click({ force: true })
    .catch(() => {});

  await sleep(500);

  const tipoFinal = await target
    .locator('input[name="f3"], input[id="3"]')
    .first()
    .inputValue()
    .catch(() => "");

  if (!String(tipoFinal).trim()) {
    throw new Error("Tipo do documento ficou vazio antes do envio da reentrega.");
  }

  await debugScreenshot(pageReal, "05_tela_016_reentrega_preenchida.png");

  return pageReal;
}

async function enviarTela016Reentrega(context, pageTela2) {
  console.log("11) Clicando na setinha final da 016...");

  const found = await getTargetWithSelector(
    context,
    pageTela2,
    'input[name="f7"], input[id="7"], a[id="9"]',
    "tela de reentrega da 016"
  );

  const pageReal = found.page;
  const target = found.target;

  const seta = target.locator('a[id="9"]').first();

  await seta.waitFor({
    state: "visible",
    timeout: 30000,
  });

  await debugScreenshot(pageReal, "06_antes_click_seta_final_016.png");

  console.log("11.1) Disparando ajaxEnvia REENT da 016...");

  await seta.evaluate((el) => el.click());

  await sleep(1500);

  await debugScreenshot(pageReal, "07_depois_click_seta_final_016.png");

  const modalVisivel = await pageReal
    .locator('div#errormsg, div#errormsglabel, a.dialog:has-text("Continuar")')
    .first()
    .isVisible()
    .catch(() => false);

  const processando = await pageReal
    .locator("#procimg")
    .evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.visibility !== "hidden" && style.display !== "none";
    })
    .catch(() => false);

  if (!modalVisivel && !processando) {
    console.log("⚠️ Após clique final não apareceu modal/processamento. Tentando chamada direta ajaxEnvia('REENT', 0)...");

    await target.evaluate(() => {
      if (typeof ajaxEnvia !== "function") {
        throw new Error("Função ajaxEnvia não encontrada na tela 016.");
      }

      ajaxEnvia("REENT", 0);
    });

    await sleep(1500);

    await debugScreenshot(pageReal, "08_depois_ajax_direto_reent_016.png");
  }

  return pageReal;
}

async function confirmarGeracao016(context, pageHint) {
  console.log("12) Esperando confirmação da geração da reentrega...");

  await debugScreenshot(pageHint, "09_antes_confirmar_modal_016.png");

  const clicou = await clicarContinuarSeAparecer(
    context,
    pageHint,
    "confirmação de geração da 016"
  );

  if (!clicou) {
    await debugScreenshot(pageHint, "10_modal_continuar_nao_encontrado_016.png");

    throw new Error("Não encontrei o modal de confirmação da geração da reentrega.");
  }

  await debugScreenshot(pageHint, "11_depois_continuar_modal_016.png");

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
            await debugScreenshot(p, "12_novo_ctrc_reentrega_encontrado.png");
            return p;
          }
        }

        const fr = await findFrameWithSelector(p, "div#errormsglabel");

        if (fr) {
          const frameLabel = fr.locator("div#errormsglabel").first();
          const visible = await frameLabel.isVisible().catch(() => false);
          const texto = await frameLabel.innerText().catch(() => "");

          if (visible && texto.includes("Novo CTRC:")) {
            await debugScreenshot(p, "12_novo_ctrc_reentrega_encontrado_frame.png");
            return p;
          }
        }
      } catch {}
    }

    await sleep(250);
  }

  await debugScreenshot(pageHint, "13_falha_novo_ctrc_reentrega_016.png");

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

  const pageAposEnvio = await enviarTela016Reentrega(context, pageReal2);

  const pageFinal = await confirmarGeracao016(context, pageAposEnvio);
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