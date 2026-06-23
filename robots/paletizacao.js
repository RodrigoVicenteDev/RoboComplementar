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
  formatMoneyBR,
  normalizeValue,
} = require("../utils/formatters");

async function verificarErroFuncionalPaletizacao(context, pageHint) {
  const pages = context.pages().filter((p) => !p.isClosed());

  for (const p of pages) {
    try {
      const label = p.locator("div#errormsglabel").first();

      if (await label.isVisible().catch(() => false)) {
        const texto = await label.innerText().catch(() => "");

        if (/Conhecimento\s+j[aá]\s+possui\s+vale/i.test(texto)) {
          throw new Error(texto.replace(/\s+/g, " ").trim());
        }
      }
    } catch (err) {
      throw err;
    }
  }

  if (pageHint && !pageHint.isClosed()) {
    const label = pageHint.locator("div#errormsglabel").first();

    if (await label.isVisible().catch(() => false)) {
      const texto = await label.innerText().catch(() => "");

      if (/Conhecimento\s+j[aá]\s+possui\s+vale/i.test(texto)) {
        throw new Error(texto.replace(/\s+/g, " ").trim());
      }
    }
  }
}

function extrairDocumentoGeradoPaletizacao(texto) {
  const value = normalizeValue(texto);

  // Modal novo:
  // CTRC GRU414677-8 e Vale Pallet PEI000008-6 gerados.
  const matchCtrc = value.match(
    /\bCTRC\s+([A-Z]{3}\d{6,8}-\d)\b/i
  );

  if (matchCtrc) {
    return matchCtrc[1].toUpperCase();
  }

  // Modal antigo:
  // Vale Pallet QNS000113-9 gerado.
  const matchValePallet = value.match(
    /\bVale\s+Pallet\s+([A-Z]{3}\d{6,}-\d)\b/i
  );

  if (matchValePallet) {
    return matchValePallet[1].toUpperCase();
  }

  throw new Error(
    `Não consegui extrair documento gerado do modal final: "${value}"`
  );
}

async function openOption89(menuPage, context) {
  console.log("6) Abrindo opção 89...");

  const selector89 = [
    'input[name="ser_ctrc"]',
    'input[id="ser_ctrc"]',
    'input[name="nro_ctrc"]',
    'input[id="nro_ctrc"]',
    'a[id="1"]',
  ].join(", ");

  await debugScreenshot(menuPage, "debug_antes_089.png");

  const page89 = await openAfterAction({
    context,
    currentPage: menuPage,
    selector: selector89,
    label: "opção 89",
    action: async () => {
      await typeMenuOption(menuPage, "89");
      await debugScreenshot(menuPage, "debug_pos_089.png");
    },
  });

  await debugScreenshot(page89, "02_tela_089_inicial.png");

  return page89;
}

async function preencherTela089Inicial(context, page89Base, item) {
  console.log(`8) Preenchendo tela 089 inicial para CTRC ${item.ctrc}...`);

  const parsed = parseCtrcComDv(item.ctrc);

  const found = await getTargetWithSelector(
    context,
    page89Base,
    'input[name="ser_ctrc"], input[id="ser_ctrc"]',
    "tela 089 inicial"
  );

  const pageReal = found.page;
  const target = found.target;

  await fill(target, 'input[name="ser_ctrc"], input[id="ser_ctrc"]', parsed.sigla);
  await fill(
    target,
    'input[name="nro_ctrc"], input[id="nro_ctrc"]',
    parsed.semHifenComDv
  );

  await debugScreenshot(pageReal, `03_tela_089_inicial_${parsed.semHifenComDv}.png`);

  return pageReal;
}

async function avancarTela089Inicial(context, page89Base) {
  console.log("9) Clicando na primeira setinha da 089...");

  const found = await getTargetWithSelector(
    context,
    page89Base,
    'input[name="ser_ctrc"], input[id="ser_ctrc"]',
    "tela 089 inicial"
  );

  const pageReal = found.page;
  const target = found.target;

  const selectorTela2 = [
    'input[name="f2"]',
    'input[id="2"]',
    'input[name="f3"]',
    'input[id="3"]',
    'a:has-text("Informar")',
    'a[id="4"]',
    'a[id="9"]',
  ].join(", ");

  let pageTela2;

  try {
    pageTela2 = await openAfterAction({
      context,
      currentPage: pageReal,
      selector: selectorTela2,
      label: "segunda tela da 089",
      action: async () => {
        const seta = target.locator('a[id="1"]').first();

        await seta.waitFor({
          state: "visible",
          timeout: 30000,
        });

        await seta.click();
      },
    });
  } catch (err) {
    await verificarErroFuncionalPaletizacao(context, pageReal);
    throw err;
  }

  // proteção extra caso abra modal de erro
  await verificarErroFuncionalPaletizacao(context, pageTela2);

  await debugScreenshot(pageTela2, "04_tela_089_segunda_tela.png");

  return pageTela2;
}

function getQuantidadePallets(item) {
  const valor =
    item.quantidadePallet ??
    item.QuantidadePallet ??
    item.quantidadePallets ??
    item.qtdPallets ??
    item.quantidade ??
    item.qtd;

  const texto = normalizeValue(valor);

  if (!texto) {
    throw new Error(
      `Item ${item.emissaoComplementarId || ""} sem quantidade de pallets para paletização.`
    );
  }

  const somenteNumeros = texto.replace(/\D/g, "");

  if (!somenteNumeros || Number(somenteNumeros) <= 0) {
    throw new Error(
      `Quantidade de pallets inválida para paletização: "${texto}".`
    );
  }

  return somenteNumeros;
}

async function preencherPbr(context, pageTela2, item) {
  console.log("10) Preenchendo quantidade de pallets no campo PBR...");

  const found = await getTargetWithSelector(
    context,
    pageTela2,
    'input[name="f2"], input[id="2"]',
    "campo PBR da paletização"
  );

  const pageReal = found.page;
  const target = found.target;

  const qtdPallets = getQuantidadePallets(item);

  await fill(target, 'input[name="f2"], input[id="2"]', qtdPallets);

  await debugScreenshot(pageReal, "05_tela_089_pbr_preenchido.png");

  return pageReal;
}

async function abrirModalFrete(context, pageTela2) {
  console.log("11) Clicando em Informar frete...");

  const found = await getTargetWithSelector(
    context,
    pageTela2,
    'a:has-text("Informar"), a[id="4"]',
    "link Informar frete"
  );

  const pageReal = found.page;
  const target = found.target;

  const linkFrete = target.locator('a:has-text("Informar"), a[id="4"]').first();

  await linkFrete.waitFor({
    state: "visible",
    timeout: 30000,
  });

  await linkFrete.click({ force: true });

  const pageModal = await aguardarModalValorFrete(context, pageReal);

  await debugScreenshot(pageModal, "06_modal_frete_paletizacao.png");

  return pageModal;
}

async function aguardarModalValorFrete(context, pageHint) {
  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    const pages = context.pages().filter((p) => !p.isClosed());

    for (const p of pages) {
      try {
        const campoValor = p.locator('input[name="-2"], input[id="-2"]').first();

        if (await campoValor.isVisible().catch(() => false)) {
          return p;
        }

        const fr = await findFrameWithSelector(p, 'input[name="-2"], input[id="-2"]');

        if (fr) {
          return p;
        }
      } catch {}
    }

    if (pageHint && !pageHint.isClosed()) {
      try {
        const campoValor = pageHint.locator('input[name="-2"], input[id="-2"]').first();

        if (await campoValor.isVisible().catch(() => false)) {
          return pageHint;
        }
      } catch {}
    }

    await sleep(250);
  }

  throw new Error("Não encontrei o modal de valor para paletização.");
}

async function preencherModalFrete(context, pageModal, item) {
  console.log("12) Preenchendo valor da paletização...");

  const found = await getTargetWithSelector(
    context,
    pageModal,
    'div#errormsg input[name="-2"], div#errormsg input[id="-2"]',
    "modal valor paletização"
  );

  const pageReal = found.page;
  const target = found.target;

  const valor = formatMoneyBR(item.valorTotal);

  const campoValor = target.locator(
    'div#errormsg input[name="-2"], div#errormsg input[id="-2"]'
  ).first();

  await campoValor.waitFor({
    state: "visible",
    timeout: 30000,
  });

  await campoValor.click({ force: true });
  await campoValor.fill("");

  await campoValor.evaluate((el, value) => {
    el.value = value;
    el.setAttribute("currencyvalue", value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, valor);

  await debugScreenshot(pageReal, "07_modal_frete_paletizacao_preenchido.png");

  await target.evaluate(() => {
    const btn = document.querySelector('div#errormsg a[id="-1"]');
    if (!btn) {
      throw new Error("Setinha do modal de frete não encontrada.");
    }

    btn.click();
  });

  await pageReal.waitForFunction(
    () => {
      const modal = document.querySelector("div#errormsg");
      const campo = document.querySelector('div#errormsg input[id="-2"]');

      if (!modal) return true;

      const style = window.getComputedStyle(modal);

      return (
        style.visibility === "hidden" ||
        style.display === "none" ||
        !campo
      );
    },
    null,
    { timeout: 30000 }
  );

  return pageReal;
}

async function aguardarRetornoTelaPaletizacao(context, pageHint) {
  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    const pages = context.pages().filter((p) => !p.isClosed());

    for (const p of pages) {
      try {
        const modalValor = p.locator('input[name="-2"], input[id="-2"]').first();

        if (await modalValor.isVisible().catch(() => false)) {
          continue;
        }

        const tipoDoc = p.locator('input[name="f6"], input[id="6"]').first();
        const obs = p.locator('input[name="f8"], input[id="8"]').first();

        if (
          (await tipoDoc.isVisible().catch(() => false)) &&
          (await obs.count().catch(() => 0)) > 0
        ) {
          return p;
        }
      } catch {}
    }

    await sleep(250);
  }

  throw new Error("Não encontrei a tela de paletização após informar o frete.");
}

async function aguardarProcessamentoSSW(target, timeoutMs = 15000) {
  // Espera o indicador "Aguarde..." (#procimg) do SSW ficar oculto, indicando
  // que a requisição AJAX (ex.: getFil) terminou e o form parou de recarregar.
  try {
    const proc = target.locator("#procimg").first();

    if ((await proc.count().catch(() => 0)) === 0) {
      return;
    }

    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const processando = await proc
        .evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.visibility !== "hidden" && style.display !== "none";
        })
        .catch(() => false);

      if (!processando) {
        return;
      }

      await sleep(250);
    }
  } catch {}
}

async function preencherFinalPaletizacao(context, pageTela, item) {
  console.log("13) Preenchendo tipo de documento, local da prestação e observação da paletização...");

  const found = await getTargetWithSelector(
    context,
    pageTela,
    'input[name="f6"], input[id="6"]',
    "tipo documento paletização"
  );

  const pageReal = found.page;
  const target = found.target;

  const tipoDocumento = normalizeValue(item.tipoDocumento).toUpperCase();

  if (!tipoDocumento) {
    throw new Error(
      `Item ${item.emissaoComplementarId || ""} sem tipoDocumento para paletização.`
    );
  }

  // 1) Local da prestação (f5) PRIMEIRO. Esse campo dispara getFil(this.value),
  // que limpa o Tipo do documento, então preenchemos ele antes e esperamos o SSW.
  const localPrestacao = target.locator('input[name="f5"], input[id="5"]').first();

  if (await localPrestacao.isVisible().catch(() => false)) {
    const disabled = await localPrestacao.isDisabled().catch(() => true);

    if (!disabled) {
      await setInputOrValidate(
        target,
        'input[name="f5"], input[id="5"]',
        "O"
      );

      // f5 dispara getFil(this.value); espera o SSW terminar de processar
      // (indicador "Aguarde..." #procimg) antes de preencher o f6.
      await sleep(800);
      await aguardarProcessamentoSSW(target);
    }
  }

  // 2) Observação (f8) antes do Tipo do documento.
  const obs = normalizeValue(item.obsSsw1 || item.obsSsw2 || item.obsSsw3);

  if (obs) {
    await fill(target, 'input[name="f8"], input[id="8"]', obs.slice(0, 70));
  }

  // 3) Tipo do documento (f6) POR ÚLTIMO, com retentativas: o getFil do f5 e
  // o recarregamento do form (após informar o frete) podem limpar o campo de
  // forma assíncrona, então redigitamos até o valor "grudar".
  const campoTipoDoc = target.locator('input[name="f6"], input[id="6"]').first();

  let tipoFinal = "";
  const maxTentativas = 5;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    await campoTipoDoc.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await aguardarProcessamentoSSW(target);

    await campoTipoDoc.click({ force: true }).catch(() => {});
    await campoTipoDoc.press("Control+A").catch(() => {});
    await campoTipoDoc.press("Backspace").catch(() => {});
    await campoTipoDoc.type(tipoDocumento, { delay: 120 });
    await campoTipoDoc.press("Tab").catch(() => {});
    await sleep(800);

    tipoFinal = await campoTipoDoc.inputValue().catch(() => "");

    if (String(tipoFinal).trim().toUpperCase() === tipoDocumento) {
      break;
    }

    console.log(
      `⚠️ Tipo do documento ficou "${tipoFinal}" na tentativa ${tentativa}/${maxTentativas}. Repreenchendo...`
    );

    await sleep(700);
  }

  if (String(tipoFinal).trim().toUpperCase() !== tipoDocumento) {
    await debugScreenshot(pageReal, "08_falha_tipo_documento_089.png");

    throw new Error(
      `Tipo do documento da paletização não foi preenchido corretamente após ${maxTentativas} tentativas. Esperado "${tipoDocumento}", ficou "${tipoFinal}".`
    );
  }

  await debugScreenshot(pageReal, "08_tela_089_final_preenchida.png");

  return pageReal;
}

async function enviarPaletizacao(context, pageTela) {
  console.log("14) Clicando na setinha final da paletização...");

  const found = await getTargetWithSelector(
    context,
    pageTela,
    'a[id="9"], input[name="f6"], input[id="6"]',
    "setinha final paletização"
  );

  const pageReal = found.page;
  const target = found.target;

  const seta = target.locator('a[id="9"]').first();

  await seta.waitFor({
    state: "visible",
    timeout: 30000,
  });

  // Clique via DOM (el.click) dispara o onclick="ajaxEnvia('GERA_VALE', 0)"
  // de forma confiável, ao contrário do click({force:true}) do Playwright.
  await seta.evaluate((el) => el.click());

  await sleep(1500);

  // Se nada aconteceu (sem modal e sem indicador de processamento), chama
  // ajaxEnvia('GERA_VALE', 0) diretamente, como faz a reentrega.
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
    console.log(
      "⚠️ Após clique final não apareceu modal/processamento. Tentando chamada direta ajaxEnvia('GERA_VALE', 0)..."
    );

    await target.evaluate(() => {
      if (typeof ajaxEnvia !== "function") {
        throw new Error("Função ajaxEnvia não encontrada na tela 089.");
      }

      ajaxEnvia("GERA_VALE", 0);
    });

    await sleep(1500);

    await debugScreenshot(pageReal, "08b_depois_ajax_direto_gera_vale_089.png");
  }

  return pageReal;
}

async function aguardarValePalletGerado(context, pageHint) {
  console.log("15) Aguardando Vale Pallet gerado...");

  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    const pages = context.pages().filter((p) => !p.isClosed());

    for (const p of pages) {
      try {
        const label = p.locator("div#errormsglabel").first();

        if (await label.isVisible().catch(() => false)) {
          const texto = await label.innerText().catch(() => "");

          if (/Vale\s+Pallet/i.test(texto) && /gerad?/i.test(texto)) {
            return p;
          }
        }

        const fr = await findFrameWithSelector(p, "div#errormsglabel");

        if (fr) {
          const frameLabel = fr.locator("div#errormsglabel").first();
          const texto = await frameLabel.innerText().catch(() => "");

          if (/Vale\s+Pallet/i.test(texto) && /gerado/i.test(texto)) {
            return p;
          }
        }
      } catch {}
    }

    if (pageHint && !pageHint.isClosed()) {
      try {
        const label = pageHint.locator("div#errormsglabel").first();
        const texto = await label.innerText().catch(() => "");

        if (/Vale\s+Pallet/i.test(texto) && /gerado/i.test(texto)) {
          return pageHint;
        }
      } catch {}
    }

    await sleep(250);
  }

  throw new Error("Não encontrei o aviso final com Vale Pallet gerado.");
}

async function capturarValePallet(context, pageHint) {
  console.log("16) Capturando Vale Pallet...");

  const found = await getTargetWithSelector(
    context,
    pageHint,
    "div#errormsglabel",
    "aviso final com Vale Pallet",
    30000
  );

  const target = found.target;
  const label = target.locator("div#errormsglabel").first();

  await label.waitFor({
    state: "visible",
    timeout: 30000,
  });

  const texto = await label.innerText();
 const documentoGerado =
  extrairDocumentoGeradoPaletizacao(texto);

console.log(`✅ Documento gerado capturado: ${documentoGerado}`);

return documentoGerado;
}

async function executar({ context, menuPage, item }) {
  console.log("======================================");
  console.log(`🤖 Processando PALETIZAÇÃO ${item.emissaoComplementarId}`);
  console.log(`CTRC: ${item.ctrc}`);
  console.log(`Tipo complementar: ${item.tipoComplementar}`);
  console.log("Opção SSW: 89");
  console.log("======================================");

  await closeExtraPages(context, [menuPage]);

  const menuAtual = await recoverMenuPage(context);
  const page89Base = await openOption89(menuAtual, context);

  const pageReal1 = await preencherTela089Inicial(context, page89Base, item);
  const pageTela2 = await avancarTela089Inicial(context, pageReal1);

  const pagePbr = await preencherPbr(context, pageTela2, item);
  const pageModal = await abrirModalFrete(context, pagePbr);

  await preencherModalFrete(context, pageModal, item);

  const pageRetorno = await aguardarRetornoTelaPaletizacao(context, pagePbr);
  const pageFinal = await preencherFinalPaletizacao(context, pageRetorno, item);

  await enviarPaletizacao(context, pageFinal);

  const pageVale = await aguardarValePalletGerado(context, pageFinal);
  const documentoGerado =
  await capturarValePallet(context, pageVale);

  await closeExtraPages(context, [menuAtual]);

  return {
    numeroDocumentoGerado: documentoGerado,
  };
}

module.exports = {
  nome: "paletizacao",
  executar,
};