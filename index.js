const {
  fill,
  setInputOrValidate,
  getTargetWithSelector,
  openAfterAction,
  closeExtraPages,
  debugScreenshot,
  debugWriteFile,
  findFrameWithSelector,
  sleep,
} = require("../ssw/helpers");

const {
  typeMenuOption,
  recoverMenuPage,
} = require("../ssw/session");

const {
  parseCtrcComDv,
  formatMoneyBR,
  normalizeValue,
} = require("../utils/formatters");

const LOCAL_PRESTACAO_PADRAO =
  process.env.SSW_LOCAL_PRESTACAO ?? "O";

function extrairNumeroNovoCtrc(texto) {
  const value = normalizeValue(texto);

  const match = value.match(
    /Novo\s+CTRC:\s*([A-Z]{3})?(\d+)-(\d+)/i
  );

  if (!match) {
    throw new Error(
      `Não consegui extrair o Novo CTRC do texto: "${value}"`
    );
  }

  const sigla = match[1]
    ? match[1].toUpperCase()
    : "";

  return `${sigla}${match[2]}-${match[3]}`;
}

async function openOption222(menuPage, context) {
  console.log("6) Abrindo opção 222...");

  const selector222 = [
    'input[name="motivo"]',
    'input[id="motivo"]',
    'input[name="f1"]',
    'input[name="f2"]',
    'a[id="3"]',
  ].join(", ");

  await debugScreenshot(
    menuPage,
    "debug_antes_222.png"
  );

  const page222 = await openAfterAction({
    context,
    currentPage: menuPage,
    selector: selector222,
    label: "opção 222",

    action: async () => {
      await typeMenuOption(menuPage, "222");

      await debugScreenshot(
        menuPage,
        "debug_pos_222.png"
      );
    },
  });

  await debugScreenshot(
    page222,
    "02_tela_222_inicial.png"
  );

  return page222;
}

async function preencherTela222Inicial(
  context,
  page222Base,
  item
) {
  console.log(
    `8) Preenchendo tela 222 inicial para CTRC ${item.ctrc}...`
  );

  const parsed = parseCtrcComDv(item.ctrc);

  const found = await getTargetWithSelector(
    context,
    page222Base,
    'input[name="motivo"], input[id="motivo"]',
    "tela 222 inicial"
  );

  const pageReal = found.page;
  const target = found.target;

  await fill(
    target,
    'input[name="motivo"], input[id="motivo"]',
    item.motivoSSW
  );

  await fill(
    target,
    'input[name="f1"], input[id="1"]',
    parsed.sigla
  );

  await fill(
    target,
    'input[name="f2"], input[id="2"]',
    parsed.semHifenComDv
  );

  await debugScreenshot(
    pageReal,
    `03_tela_222_inicial_${parsed.semHifenComDv}.png`
  );

  return pageReal;
}

async function avancarTela222Inicial(
  context,
  page222Base
) {
  console.log(
    "9) Clicando na primeira setinha da 222..."
  );

  const found = await getTargetWithSelector(
    context,
    page222Base,
    'input[name="motivo"], input[id="motivo"]',
    "tela 222 inicial"
  );

  const pageReal = found.page;
  const target = found.target;

  const selectorTela2 = [
    'input[name="vlr_frete_valor"]',
    'input[id="vlr_frete_valor"]',
    'input[name="unid_emit"]',
    'input[name="tp_doc"]',
    'input[name="obs_1"]',
    'a[id="2"]',
  ].join(", ");

  const pageTela2 = await openAfterAction({
    context,
    currentPage: pageReal,
    selector: selectorTela2,
    label: "segunda tela da 222",

    action: async () => {
      const seta = target.locator('a[id="3"]').first();

      await seta.waitFor({
        state: "visible",
        timeout: 30000,
      });

      await seta.click();
    },
  });

  await debugScreenshot(
    pageTela2,
    "04_tela_222_segunda_tela.png"
  );

  return pageTela2;
}

async function preencherTela222Segunda(
  context,
  pageTela2,
  item
) {
  console.log(
    "10) Preenchendo segunda tela da 222..."
  );

  const found = await getTargetWithSelector(
    context,
    pageTela2,
    'input[name="vlr_frete_valor"], input[id="vlr_frete_valor"]',
    "segunda tela da 222"
  );

  const pageReal = found.page;
  const target = found.target;

  const valorFrete = formatMoneyBR(
    item.valorTotal
  );

  const obs1 = normalizeValue(item.obsSsw1);
  const obs2 = normalizeValue(item.obsSsw2);
  const obs3 = normalizeValue(item.obsSsw3);

  await fill(
    target,
    'input[name="vlr_frete_valor"], input[id="vlr_frete_valor"]',
    valorFrete
  );

  await setInputOrValidate(
    target,
    'input[name="unid_emit"], input[id="unid_emit"]',
    LOCAL_PRESTACAO_PADRAO
  );

  await setInputOrValidate(
    target,
    'input[name="tp_doc"], input[id="tp_doc"]',
    item.tipoDocumento
  );

  await fill(
    target,
    'input[name="obs_1"], input[id="obs_1"]',
    obs1.slice(0, 90)
  );

  await fill(
    target,
    'input[name="obs_2"], input[id="obs_2"]',
    obs2.slice(0, 90)
  );

  await fill(
    target,
    'input[name="obs_3"], input[id="obs_3"]',
    obs3.slice(0, 90)
  );

  await debugScreenshot(
    pageReal,
    "05_tela_222_segunda_preenchida.png"
  );

  return pageReal;
}

async function enviarTela222Segunda(
  context,
  pageTela2
) {
  console.log(
    "11) Clicando na setinha final da 222..."
  );

  const found = await getTargetWithSelector(
    context,
    pageTela2,
    'input[name="vlr_frete_valor"], input[id="vlr_frete_valor"]',
    "segunda tela da 222"
  );

  const target = found.target;

  const seta = target
    .locator('a[id="2"]')
    .first();

  await seta.waitFor({
    state: "visible",
    timeout: 30000,
  });

  await seta.click();
}

async function continuarAvisoTela222(
  context,
  pageTela2
) {
  console.log(
    "12) Esperando aviso de conferência..."
  );

  const found = await getTargetWithSelector(
    context,
    pageTela2,
    'div#errormsg, a[id="0"]',
    "aviso de conferência da 222",
    30000
  );

  const pageReal = found.page;
  const target = found.target;

  const aviso = target
    .locator("div#errormsg")
    .first();

  await aviso.waitFor({
    state: "visible",
    timeout: 30000,
  });

  const textoAviso = await aviso
    .innerText()
    .catch(() => "");

  console.log(
    "Aviso detectado:",
    textoAviso.replace(/\s+/g, " ").trim()
  );

  const continuar = target
    .locator('a[id="0"]')
    .first();

  await continuar.waitFor({
    state: "visible",
    timeout: 30000,
  });

  await continuar.click({
    force: true,
  });

  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    const pages = context
      .pages()
      .filter((p) => !p.isClosed());

    for (const p of pages) {
      try {
        const label = p
          .locator("div#errormsglabel")
          .first();

        const count = await label
          .count()
          .catch(() => 0);

        if (count > 0) {
          const visible = await label
            .isVisible()
            .catch(() => false);

          const texto = await label
            .innerText()
            .catch(() => "");

          if (
            visible &&
            texto.includes("Novo CTRC:")
          ) {
            return p;
          }
        }

        const fr = await findFrameWithSelector(
          p,
          "div#errormsglabel"
        );

        if (fr) {
          const frameLabel = fr
            .locator("div#errormsglabel")
            .first();

          const visible = await frameLabel
            .isVisible()
            .catch(() => false);

          const texto = await frameLabel
            .innerText()
            .catch(() => "");

          if (
            visible &&
            texto.includes("Novo CTRC:")
          ) {
            return p;
          }
        }
      } catch {}
    }

    await sleep(250);
  }

  throw new Error(
    "Não encontrei o aviso final com Novo CTRC."
  );
}

async function capturarNovoCtrc(
  context,
  pageHint
) {
  console.log("13) Capturando Novo CTRC...");

  const found = await getTargetWithSelector(
    context,
    pageHint,
    "div#errormsglabel",
    "aviso final com Novo CTRC",
    30000
  );

  const pageReal = found.page;
  const target = found.target;

  const label = target
    .locator("div#errormsglabel")
    .first();

  await label.waitFor({
    state: "visible",
    timeout: 30000,
  });

  const texto = await label.innerText();

  const novoCtrc =
    extrairNumeroNovoCtrc(texto);

  console.log(
    `✅ Novo CTRC capturado: ${novoCtrc}`
  );

  const ok = target
    .locator('a[id="0"]')
    .first();

  if (
    (await ok.count().catch(() => 0)) > 0
  ) {
    await ok.click({
      force: true,
    }).catch(() => {});
  }

  return novoCtrc;
}

async function executar({
  context,
  menuPage,
  item,
}) {
  console.log("======================================");
  console.log(
    `🤖 Processando emissão ${item.emissaoComplementarId}`
  );

  console.log(`CTRC: ${item.ctrc}`);

  console.log(
    `Tipo complementar: ${item.tipoComplementar}`
  );

  console.log(
    `Motivo SSW: ${item.motivoSSW}`
  );

  console.log(
    `Valor total: ${item.valorTotal}`
  );

  console.log("======================================");

  await closeExtraPages(context, [
    menuPage,
  ]);

  const menuAtual =
    await recoverMenuPage(context);

  const page222Base =
    await openOption222(
      menuAtual,
      context
    );

  const pageReal1 =
    await preencherTela222Inicial(
      context,
      page222Base,
      item
    );

  const pageTela2 =
    await avancarTela222Inicial(
      context,
      pageReal1
    );

  const pageReal2 =
    await preencherTela222Segunda(
      context,
      pageTela2,
      item
    );

  await enviarTela222Segunda(
    context,
    pageReal2
  );

  const pageAposContinuar =
    await continuarAvisoTela222(
      context,
      pageReal2
    );

  const novoCtrc =
    await capturarNovoCtrc(
      context,
      pageAposContinuar
    );

  await closeExtraPages(context, [
    menuAtual,
  ]);

  return {
    numeroDocumentoGerado:
      novoCtrc,
  };
}

module.exports = {
  nome: "complementar222",
  executar,
};