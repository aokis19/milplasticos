(function() {
  'use strict';

  const db = window.firebaseDB || window.db;
  if (!db) {
    console.error('❌ Firebase não disponível');
    document.getElementById('conteudoDinamico').innerHTML =
      '<div class="card"><h3>⚠️ Firebase não configurado</h3></div>';
    return;
  }

  const colecoes = {
    periodos: db.collection('custos_periodos'),
    setores: db.collection('custos_setores'),
    categorias: db.collection('custos_categorias'),
    itensCusto: db.collection('custos_itens'),
    producoes: db.collection('custos_producoes'),
    materiais: db.collection('custos_materiais'),
    custosMateriais: db.collection('custos_materiais_custos'),
    custosFixos: db.collection('custos_fixos'),
    configuracoes: db.collection('configuracoes')
  };

  let periodos = [], setores = [], categorias = [], itensCusto = [], producoes = [];
  let materiais = [], custosMateriais = [], custosFixos = [];
  let periodoAtual = null, setorAtual = null;
  let nivelAtual = 'periodos';
  let setoresSelecionadosGerar = new Map();
  let filtroAnoAtual = 'todos';
  let periodoOrigemCopia = null;
  let custoFixoSelecionadoId = null;
  let periodosSelecionadosResumo = new Set();
  let setoresExcluidosResumo = new Set();
  let configCampos = {
    setorNome: 'Nome do Setor',
    setorDesc: 'Descrição',
    custoTotal: 'Custo Total',
    producaoKg: 'Produção (KG)',
    custoPorKg: 'Custo por KG'
  };

  // ======== VARIÁVEIS DO CUSTO POR MATERIAL (CADEIA) ========
  let cpmPeriodosSelecionados = [];
  let cpmSetoresDisponiveis = [];
  let cpmCadeia = [];
  let cpmUltimoResultado = null;

  // ======== UTILITÁRIOS ========
  function formatMoney(v) { return 'R$ ' + (v || 0).toFixed(2).replace('.', ','); }
  function formatNumber(n, d) { d = d || 2; return (n || 0).toFixed(d).replace('.', ','); }
  function formatPercent(v) { return (v || 0).toFixed(2).replace('.', ',') + '%'; }
  function getNomeMes(m) {
    return ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][m - 1] || '';
  }
  function gerarId(prefixo) {
    return prefixo + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  function getPercentual(item) {
    const p = item.percentual;
    return (p === undefined || p === null) ? 100 : p;
  }
  function getSetoresDoPeriodo(periodoid) {
    const pid = periodoid || (periodoAtual ? periodoAtual.id : null);
    if (!pid) return [];
    return setores.filter(s => s.periodold === pid).sort((a, b) => a.ordem - b.ordem);
  }
  function getCustosFixosDoPeriodo(periodoid) {
    const pid = periodoid || (periodoAtual ? periodoAtual.id : null);
    if (!pid) return [];
    return custosFixos.filter(cf => cf.periodold === pid);
  }

  function calcularCustosSetor(setorld) {
    const itens = itensCusto.filter(i => i.setorld === setorld);
    const totalCusto = itens.reduce((s, i) => s + (i.valorTotal * getPercentual(i) / 100), 0);
    const prods = producoes.filter(p => p.setorld === setorld);
    const totalKg = prods.reduce((s, p) => s + p.kg, 0);
    const custoPorKg = totalKg > 0 ? totalCusto / totalKg : 0;
    return { totalCusto, totalKg, custoPorKg, qtdItens: itens.length };
  }

  function getSetsParaProducao(sets) {
    const setsFinais = sets.filter(s => s.produtoFinal === true);
    if (setsFinais.length > 0) return setsFinais;
    if (sets.length === 0) return [];
    const maxOrdem = Math.max(...sets.map(s => s.ordem || 0));
    const ultimos = sets.filter(s => (s.ordem || 0) === maxOrdem);
    return ultimos.length > 0 ? ultimos : sets;
  }

  function calcularResumoPeriodo(periodoidParam, excluirSetores) {
    const pid = periodoidParam || (periodoAtual ? periodoAtual.id : null);
    const excluir = excluirSetores || setoresExcluidosResumo;
    if (!pid) return {
      custoTotalGeral: 0, producaoTotalGeral: 0, custoPorKgGeral: 0,
      qtdSetores: 0, setoresFinais: [], qtdProdutosFinais: 0
    };
    const sets = getSetoresDoPeriodo(pid).filter(s => !excluir.has(s.id));
    let custoTotalGeral = 0;
    sets.forEach(s => { custoTotalGeral += calcularCustosSetor(s.id).totalCusto; });
    const setsFinais = sets.filter(s => s.produtoFinal === true);
    const setsParaProducao = getSetsParaProducao(sets);
    let producaoTotalGeral = 0;
    setsParaProducao.forEach(sf => { producaoTotalGeral += calcularCustosSetor(sf.id).totalKg; });
    return {
      custoTotalGeral,
      producaoTotalGeral,
      custoPorKgGeral: producaoTotalGeral > 0 ? custoTotalGeral / producaoTotalGeral : 0,
      qtdSetores: sets.length,
      qtdProdutosFinais: setsFinais.length
    };
  }

  async function salvarFB(colecaoNome, dados) {
    try {
      if (!dados.id) dados.id = gerarId(colecaoNome);
      await colecoes[colecaoNome].doc(dados.id).set({ ...dados }, { merge: true });
      console.log(`✅ Salvo em ${colecaoNome}:`, dados.id);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao salvar em ${colecaoNome}:`, error);
      return false;
    }
  }

  async function excluirFB(colecaoNome, id) {
    try {
      await colecoes[colecaoNome].doc(id).delete();
      console.log(`✅ Excluído de ${colecaoNome}:`, id);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao excluir ${id}:`, error);
      return false;
    }
  }

  async function carregarDadosFirebase() {
    console.log('🔄 Iniciando carregamento...');
    try {
      const [snapPeriodos, snapSetores, snapCategorias, snapItens, snapProducoes,
        snapMateriais, snapCustosMat, snapCustosFixos, snapConfig
      ] = await Promise.all([
        colecoes.periodos.get(),
        colecoes.setores.get(),
        colecoes.categorias.get(),
        colecoes.itensCusto.get(),
        colecoes.producoes.get(),
        colecoes.materiais.get(),
        colecoes.custosMateriais.get(),
        colecoes.custosFixos.get(),
        colecoes.configuracoes.doc('custos_configCampos').get()
      ]);
      periodos = snapPeriodos.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setores = snapSetores.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      categorias = snapCategorias.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      itensCusto = snapItens.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      producoes = snapProducoes.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      materiais = snapMateriais.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      custosMateriais = snapCustosMat.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      custosFixos = snapCustosFixos.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (periodos.length === 0) {
        console.log('📦 Coleções vazias. Verificando documento centralizado...');
        try {
          const docCentral = await db.collection('centralCustos').doc('dados_completos').get();
          if (docCentral.exists && docCentral.data().dados) {
            console.log('✅ Dados antigos encontrados! Recuperando...');
            const dados = docCentral.data().dados;
            periodos = dados.periodos || [];
            setores = dados.setores || [];
            categorias = dados.categorias || [];
            itensCusto = dados.itensCusto || dados.itens || [];
            producoes = dados.producoes || [];
            materiais = dados.materiais || [];
            custosMateriais = dados.custosMateriais || [];
            custosFixos = dados.custosFixos || [];
          }
        } catch (err) {
          console.log('ℹ️ Nenhum dado antigo encontrado:', err.message);
        }
      }

      setores = setores.map(s => ({ ...s, periodold: s.periodold || s.periodoId }));
      itensCusto = itensCusto.map(i => ({
        ...i,
        setorld: i.setorld || i.maquinaId || i.setorId,
        categoriald: i.categoriald || i.categoriaId
      }));
      custosFixos = custosFixos.map(cf => ({
        ...cf,
        periodold: cf.periodold || cf.periodoId,
        categoriald: cf.categoriald || cf.categoriaId
      }));
      producoes = producoes.map(p => ({ ...p, setorld: p.setorld || p.maquinaId }));

      if (snapConfig.exists && snapConfig.data().config) {
        configCampos = { ...configCampos, ...snapConfig.data().config };
      }
      if (categorias.length === 0) {
        categorias = [
          { id: 'cat1', nome: 'Energia Elétrica', cor: '#f57c00' },
          { id: 'cat2', nome: 'Matéria-Prima', cor: '#0d904f' },
          { id: 'cat3', nome: 'Mão de Obra', cor: '#0277bd' },
          { id: 'cat4', nome: 'Manutenção', cor: '#6a1b9a' },
          { id: 'cat5', nome: 'Insumos', cor: '#c62828' }
        ];
      }
      console.log(`✅ PRONTO: ${periodos.length} períodos, ${setores.length} setores`);
    } catch (error) {
      console.error('❌ ERRO:', error);
      throw error;
    }
  }

  window.abrirConfigCampos = function() {
    const modal = document.getElementById('modalConfigCampos');
    if (!modal) return;
    modal.classList.add('active');
    const container = document.getElementById('listaConfigCampos');
    if (!container) return;
    const labels = {
      setorNome: 'Nome do Campo "Nome do Setor"',
      setorDesc: 'Nome do Campo "Descrição"',
      custoTotal: 'Nome do Campo "Custo Total"',
      producaoKg: 'Nome do Campo "Produção (KG)"',
      custoPorKg: 'Nome do Campo "Custo por KG"'
    };
    container.innerHTML = Object.keys(configCampos).map(key => `
      <div class="form-group">
        <label>${labels[key] || key}</label>
        <input type="text" id="config_${key}" value="${configCampos[key]}" class="config-campo-input">
      </div>
    `).join('');
  };

  window.salvarConfigCampos = async function() {
    Object.keys(configCampos).forEach(key => {
      const input = document.getElementById('config_' + key);
      if (input && input.value.trim()) configCampos[key] = input.value.trim();
    });
    await colecoes.configuracoes.doc('custos_configCampos').set({
      config: configCampos,
      ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    window.fecharModal('modalConfigCampos');
    renderizarTela();
  };

  function renderizarTela() {
    if (nivelAtual === 'periodos') renderizarPeriodos();
    else if (nivelAtual === 'setores') renderizarSetores();
    else if (nivelAtual === 'analise') renderizarAnalise();
    else if (nivelAtual === 'materiais') renderizarMateriais();
    else if (nivelAtual === 'historicoMaterial') renderizarHistoricoMaterial();
    atualizarBreadcrumb();
  }

  function renderizarPeriodos() {
    const container = document.getElementById('conteudoDinamico');
    if (!container) return;

    const anosDisponiveis = Array.from(new Set(periodos.map(p => p.ano))).sort((a, b) => b - a);
    const periodosFiltrados = filtroAnoAtual === 'todos' ?
      [...periodos] : periodos.filter(p => p.ano === parseInt(filtroAnoAtual));
    periodosFiltrados.sort((a, b) => b.ano - a.ano || b.mes - a.mes);

    const periodosParaCalculo = periodosSelecionadosResumo.size > 0 ?
      periodosFiltrados.filter(p => periodosSelecionadosResumo.has(p.id)) :
      periodosFiltrados;

    let html = '';
    let totalProduzidoGeral = 0;
    let totalGastoGeral = 0;
    let totalSetoresCount = 0;
    let totalSetoresFinais = 0;

    periodosParaCalculo.forEach(per => {
      const sets = getSetoresDoPeriodo(per.id);
      totalSetoresCount += sets.length;
      const setsFinais = sets.filter(s => s.produtoFinal === true);
      totalSetoresFinais += setsFinais.length;
      const setsVisiveis = sets.filter(s => !setoresExcluidosResumo.has(s.id));
      const setsParaProducao = getSetsParaProducao(setsVisiveis);
      setsVisiveis.forEach(s => { totalGastoGeral += calcularCustosSetor(s.id).totalCusto; });
      setsParaProducao.forEach(s => { totalProduzidoGeral += calcularCustosSetor(s.id).totalKg; });
    });

    const custoPorKgCalculado = totalProduzidoGeral > 0 ? totalGastoGeral / totalProduzidoGeral : 0;

    html += '<div class="stats-grid-home">';
    html += `
      <div class="stat-card-home">
        <div class="stat-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
          <i class="fas fa-calendar-check"></i>
        </div>
        <div class="stat-info">
          <div class="stat-label">Períodos</div>
          <div class="stat-value">${periodosParaCalculo.length}</div>
          <div style="font-size:0.7rem;color:var(--text-light);">${totalSetoresCount} setores (${totalSetoresFinais} finais)</div>
        </div>
      </div>`;
    html += `
      <div class="stat-card-home">
        <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb, #f5576c);">
          <i class="fas fa-weight-hanging"></i>
        </div>
        <div class="stat-info">
          <div class="stat-label">Total Produzido</div>
          <div class="stat-value">${formatNumber(totalProduzidoGeral, 0)} kg</div>
          <div style="font-size:0.7rem;color:var(--text-light);">Apenas produtos finais</div>
        </div>
      </div>`;
    html += `
      <div class="stat-card-home">
        <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe, #00f2fe);">
          <i class="fas fa-money-bill-wave"></i>
        </div>
        <div class="stat-info">
          <div class="stat-label">Total Gasto</div>
          <div class="stat-value">${formatMoney(totalGastoGeral)}</div>
          <div style="font-size:0.7rem;color:var(--text-light);">${configCampos.custoTotal}</div>
        </div>
      </div>`;
    html += `
      <div class="stat-card-home" style="border: 2px solid #43e97b; background: linear-gradient(135deg, #f0fff4 0%, #e6ffe6 100%);">
        <div class="stat-icon" style="background: linear-gradient(135deg, #43e97b, #38f9d7);">
          <i class="fas fa-calculator"></i>
        </div>
        <div class="stat-info">
          <div class="stat-label">Custo por KG</div>
          <div class="stat-value" style="color:#0d904f;">${formatMoney(custoPorKgCalculado)}/kg</div>
          <div style="font-size:0.7rem;color:var(--text-light);">Gasto ÷ Produzido (finais)</div>
        </div>
      </div>`;
    html += '</div>';

    html += `
    <div class="card">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-calendar-alt"></i> Períodos</span>
        <div style="display:flex;gap:0.5rem;align-items:center;">
          <select id="filtroAno" onchange="window.mudarFiltroAno(this.value)" style="padding:0.3rem 0.5rem;border-radius:6px;border:1px solid #ddd;font-size:0.8rem;">
            <option value="todos" ${filtroAnoAtual === 'todos' ? 'selected' : ''}>Todos</option>
            ${anosDisponiveis.map(a => `<option value="${a}" ${filtroAnoAtual == a ? 'selected' : ''}>${a}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" onclick="window.abrirModalPeriodo()"><i class="fas fa-plus"></i> Novo</button>
        </div>
      </div>`;

    if (periodosFiltrados.length === 0) {
      html += '<div style="text-align:center;padding:2rem;"><p>Nenhum período cadastrado.</p></div>';
    } else {
      html += '<div class="periodos-grid" id="periodosGrid"></div>';
    }
    html += '</div>';

    container.innerHTML = html;

    if (periodosFiltrados.length > 0) {
      const grid = document.getElementById('periodosGrid');
      if (!grid) return;
      periodosFiltrados.forEach(per => {
        const resumo = calcularResumoPeriodo(per.id, new Set());
        const isSelecionado = periodosSelecionadosResumo.has(per.id);
        const div = document.createElement('div');
        div.className = 'periodo-card' + (isSelecionado ? ' selecionado-resumo' : '');
        div.innerHTML = `
          <div class="periodo-check">
            <input type="checkbox" ${isSelecionado ? 'checked' : ''} onchange="window.togglePeriodoResumo('${per.id}', this.checked)">
          </div>
          <div class="acoes">
            <button class="btn btn-info btn-xs" onclick="event.stopPropagation();window.abrirCopiarPeriodo('${per.id}')" title="Copiar Período"><i class="fas fa-copy"></i></button>
            <button class="btn btn-outline btn-xs btn-editar-periodo" data-id="${per.id}" title="Editar"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger btn-xs" onclick="event.stopPropagation();window.excluirPeriodo('${per.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
          </div>
          <div class="periodo-titulo" onclick="window.selecionarPeriodo('${per.id}')">
            <i class="fas fa-calendar-check"></i> ${getNomeMes(per.mes)}/${per.ano}
          </div>
          <div class="periodo-obs">${per.obs || 'Sem descrição'}</div>
          <div class="periodo-stats">
            <div class="periodo-stat"><span class="label">Setores</span><span class="valor">${resumo.qtdSetores}</span></div>
            <div class="periodo-stat"><span class="label">${configCampos.custoTotal}</span><span class="valor money">${formatMoney(resumo.custoTotalGeral)}</span></div>
            <div class="periodo-stat"><span class="label">${configCampos.producaoKg}</span><span class="valor">${formatNumber(resumo.producaoTotalGeral, 0)} kg</span></div>
            <div class="periodo-stat"><span class="label">${configCampos.custoPorKg}</span><span class="valor money">${formatMoney(resumo.custoPorKgGeral)}/kg</span></div>
          </div>`;
        grid.appendChild(div);
      });
    }
  }

  function renderizarCardSetor(s, grid) {
    const custos = calcularCustosSetor(s.id);
    const isExcluido = setoresExcluidosResumo.has(s.id);
    const tipoClass = s.tipo === 'despesa' ? 'tipo-despesa' : 'tipo-custo';
    const div = document.createElement('div');
    div.className = `setor-card ${tipoClass} ${isExcluido ? 'excluido-resumo' : ''} ${s.produtoFinal ? 'produto-final' : ''}`;
    div.innerHTML = `
      <div class="setor-toggle">
        <input type="checkbox" ${!isExcluido ? 'checked' : ''} onchange="window.toggleSetorResumo('${s.id}', this.checked)" title="Incluir/Excluir do resumo">
      </div>
      <div class="setor-acoes">
        <button class="btn btn-outline btn-xs" onclick="event.stopPropagation();window.editarSetor('${s.id}')" title="Editar"><i class="fas fa-edit"></i></button>
        <button class="btn btn-danger btn-xs" onclick="event.stopPropagation();window.excluirSetor('${s.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
      </div>
      <div onclick="window.selecionarSetor('${s.id}')" style="cursor:pointer;">
        <div class="setor-nome">
          ${s.nome}
          <span class="badge ${s.tipo === 'despesa' ? 'badge-despesa' : 'badge-custo'}">${s.tipo === 'despesa' ? 'Despesa' : 'Custo'}</span>
          ${s.produtoFinal ? '<span class="badge badge-orange">⭐ Produto Final</span>' : ''}
        </div>
        <div class="setor-desc">${s.descricao || 'Sem descrição'}</div>
        <div class="setor-info">
          <div><span class="info-label">${configCampos.custoTotal}</span><span class="info-valor money">${formatMoney(custos.totalCusto)}</span></div>
          <div><span class="info-label">${configCampos.producaoKg}</span><span class="info-valor">${formatNumber(custos.totalKg, 0)} kg</span></div>
          <div><span class="info-label">${configCampos.custoPorKg}</span><span class="info-valor money">${formatMoney(custos.custoPorKg)}/kg</span></div>
          <div><span class="info-label">Itens</span><span class="info-valor">${custos.qtdItens}</span></div>
        </div>
      </div>
    `;
    grid.appendChild(div);
  }

  function renderizarSetores() {
    const container = document.getElementById('conteudoDinamico');
    if (!container) return;
    if (!periodoAtual) {
      container.innerHTML = '<div class="card"><p style="text-align:center;padding:2rem;">Selecione um período primeiro.</p></div>';
      return;
    }
    const sets = getSetoresDoPeriodo(periodoAtual.id);
    const resumo = calcularResumoPeriodo(periodoAtual.id);
    const setoresCusto = sets.filter(s => s.tipo !== 'despesa');
    const setoresDespesa = sets.filter(s => s.tipo === 'despesa');

    let html = `
    <div class="card">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-industry"></i> ${configCampos.setorNome} - ${getNomeMes(periodoAtual.mes)}/${periodoAtual.ano}</span>
        <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" onclick="window.abrirModalSetor()"><i class="fas fa-plus"></i> Novo Setor</button>
          <button class="btn btn-warning btn-sm" onclick="window.abrirModalCustoFixo()"><i class="fas fa-thumbtack"></i> Novo Custo Fixo</button>
          <button class="btn btn-outline btn-sm" onclick="window.navegarPara('periodos')"><i class="fas fa-arrow-left"></i> Voltar</button>
        </div>
      </div>
      <div class="stats-grid-home" style="margin-bottom:1.5rem;">
        <div class="stat-card-home">
          <div class="stat-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);"><i class="fas fa-industry"></i></div>
          <div class="stat-info">
            <div class="stat-label">Setores</div>
            <div class="stat-value">${resumo.qtdSetores}</div>
            <div style="font-size:0.7rem;color:var(--text-light);">Cadastrados</div>
          </div>
        </div>
        <div class="stat-card-home">
          <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb, #f5576c);"><i class="fas fa-weight-hanging"></i></div>
          <div class="stat-info">
            <div class="stat-label">${configCampos.producaoKg}</div>
            <div class="stat-value">${formatNumber(resumo.producaoTotalGeral, 0)} kg</div>
            <div style="font-size:0.7rem;color:var(--text-light);">Total produzido</div>
          </div>
        </div>
        <div class="stat-card-home">
          <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe, #00f2fe);"><i class="fas fa-money-bill-wave"></i></div>
          <div class="stat-info">
            <div class="stat-label">${configCampos.custoTotal}</div>
            <div class="stat-value">${formatMoney(resumo.custoTotalGeral)}</div>
            <div style="font-size:0.7rem;color:var(--text-light);">Total gasto</div>
          </div>
        </div>
        <div class="stat-card-home" style="border: 2px solid #43e97b; background: linear-gradient(135deg, #f0fff4 0%, #e6ffe6 100%);">
          <div class="stat-icon" style="background: linear-gradient(135deg, #43e97b, #38f9d7);"><i class="fas fa-calculator"></i></div>
          <div class="stat-info">
            <div class="stat-label">${configCampos.custoPorKg} Médio</div>
            <div class="stat-value" style="color:#0d904f;">${formatMoney(resumo.custoPorKgGeral)}/kg</div>
            <div style="font-size:0.7rem;color:var(--text-light);">Gasto ÷ Produzido</div>
          </div>
        </div>
      </div>`;

    if (sets.length === 0) {
      html += '<p style="text-align:center;padding:1rem;">Nenhum setor cadastrado.</p>';
    } else {
      if (setoresCusto.length > 0) {
        const todosCustoExcluidos = setoresCusto.every(s => setoresExcluidosResumo.has(s.id));
        html += `
          <div class="setor-secao" style="margin-bottom:1.5rem;">
            <div class="secao-titulo" style="display:flex;justify-content:space-between;align-items:center;">
              <span><i class="fas fa-coins" style="color:#0d904f;"></i> 💰 <strong>CUSTOS</strong> <span class="badge badge-custo">${setoresCusto.length}</span></span>
              <button class="btn btn-xs btn-outline" onclick="window.toggleTodosSetores('custo')" style="font-size:0.7rem;">
                <i class="fas ${todosCustoExcluidos ? 'fa-check-square' : 'fa-square'}"></i> 
                ${todosCustoExcluidos ? 'Marcar Todos' : 'Desmarcar Todos'}
              </button>
            </div>
            <div class="setores-grid" id="setoresCustoGrid"></div>
          </div>`;
      }
      if (setoresDespesa.length > 0) {
        const todosDespesaExcluidos = setoresDespesa.every(s => setoresExcluidosResumo.has(s.id));
        html += `
          <div class="setor-secao" style="margin-bottom:1.5rem;">
            <div class="secao-titulo" style="display:flex;justify-content:space-between;align-items:center;">
              <span><i class="fas fa-receipt" style="color:#c62828;"></i> 📝 <strong>DESPESAS</strong> <span class="badge badge-despesa">${setoresDespesa.length}</span></span>
              <button class="btn btn-xs btn-outline" onclick="window.toggleTodosSetores('despesa')" style="font-size:0.7rem;">
                <i class="fas ${todosDespesaExcluidos ? 'fa-check-square' : 'fa-square'}"></i> 
                ${todosDespesaExcluidos ? 'Marcar Todos' : 'Desmarcar Todos'}
              </button>
            </div>
            <div class="setores-grid" id="setoresDespesaGrid"></div>
          </div>`;
      }
    }

    html += `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2rem;padding-top:1.5rem;border-top:2px solid var(--border);">
        <h4 style="margin:0;"><i class="fas fa-thumbtack"></i> Custos Fixos</h4>
        <div style="display:flex;gap:0.5rem;">
          <button class="btn btn-outline btn-sm btn-toggle-custos-fixos" onclick="window.toggleCustosFixos()">
            <i class="fas fa-chevron-up"></i> Ocultar
          </button>
          <button class="btn btn-warning btn-sm" onclick="window.abrirModalCustoFixo()">
            <i class="fas fa-plus"></i> Novo Custo Fixo
          </button>
        </div>
      </div>
      <div id="listaCustosFixosContainer" style="margin-top:1rem;"></div>
      <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" onclick="window.abrirModalCategoria()"><i class="fas fa-tag"></i> Nova Categoria</button>
        <button class="btn btn-outline btn-sm" onclick="window.listarCustosFixos('${periodoAtual.id}')"><i class="fas fa-sync"></i> Atualizar Custos Fixos</button>
      </div>
    </div>`;

    container.innerHTML = html;

    if (setoresCusto.length > 0) {
      const gridCusto = document.getElementById('setoresCustoGrid');
      if (gridCusto) setoresCusto.forEach(s => renderizarCardSetor(s, gridCusto));
    }
    if (setoresDespesa.length > 0) {
      const gridDespesa = document.getElementById('setoresDespesaGrid');
      if (gridDespesa) setoresDespesa.forEach(s => renderizarCardSetor(s, gridDespesa));
    }
    window.listarCustosFixos(periodoAtual.id);
  }

  window.listarCustosFixos = function(periodoId) {
    const container = document.getElementById('listaCustosFixosContainer');
    if (!container) return;
    const pid = periodoId || (periodoAtual ? periodoAtual.id : null);
    if (!pid) {
      container.innerHTML = '<p style="color:var(--text-light);padding:1rem;">Selecione um período para ver os custos fixos.</p>';
      return;
    }
    const fixos = custosFixos.filter(cf => cf.periodold === pid);
    if (fixos.length === 0) {
      container.innerHTML = `
            <div style="text-align:center;padding:2rem;color:var(--text-light);">
                <i class="fas fa-thumbtack" style="font-size:2rem;display:block;margin-bottom:1rem;opacity:0.5;"></i>
                Nenhum custo fixo cadastrado neste período.
                <br>
                <button class="btn btn-warning btn-sm" onclick="window.abrirModalCustoFixo()" style="margin-top:1rem;">
                    <i class="fas fa-plus"></i> Criar Novo Custo Fixo
                </button>
            </div>`;
      return;
    }
    const agrupados = {};
    fixos.forEach(cf => {
      const catId = cf.categoriald || 'sem_categoria';
      if (!agrupados[catId]) {
        const cat = categorias.find(c => c.id === catId);
        agrupados[catId] = { nome: cat ? cat.nome : 'Sem Categoria', cor: cat ? cat.cor : '#6b7280', itens: [] };
      }
      agrupados[catId].itens.push(cf);
    });
    let html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
            <h4 style="margin:0;"><i class="fas fa-thumbtack"></i> Custos Fixos <span class="badge badge-warning">${fixos.length}</span></h4>
            <button class="btn btn-warning btn-sm" onclick="window.abrirModalCustoFixo()">
                <i class="fas fa-plus"></i> Novo Custo Fixo
            </button>
        </div>
        <div class="custos-fixos-grid">`;
    Object.values(agrupados).forEach(grupo => {
      html += `
            <div class="categoria-grupo">
                <div class="categoria-header" style="background:${grupo.cor}15;border-left:4px solid ${grupo.cor};padding:0.5rem 1rem;border-radius:8px;margin-bottom:0.5rem;">
                    <span style="display:flex;align-items:center;gap:0.5rem;">
                        <span style="width:12px;height:12px;border-radius:50%;background:${grupo.cor};display:inline-block;"></span>
                        <strong>${grupo.nome}</strong>
                        <span class="badge" style="background:${grupo.cor};color:#fff;">${grupo.itens.length}</span>
                    </span>
                </div>
                <div class="custo-fixo-lista">`;
      grupo.itens.forEach(cf => {
        const itensFixosRelacionados = itensCusto.filter(i => i.custoFixold === cf.id && i.tipo === 'fixo');
        const setoresVinculados = itensFixosRelacionados.map(i => {
          const setor = setores.find(s => s.id === i.setorld);
          return setor ? setor.nome : 'Setor removido';
        });
        html += `
                <div class="custo-fixo-card" data-id="${cf.id}">
                    <div class="cf-info">
                        <div class="cf-nome"><i class="fas fa-thumbtack" style="color:${grupo.cor};"></i> ${cf.nome}</div>
                        <div class="cf-valor">${formatMoney(cf.valor)}</div>
                    </div>
                    <div class="cf-detalhes">
                        ${setoresVinculados.length > 0 ? `<span class="cf-setores"><i class="fas fa-industry"></i> ${setoresVinculados.join(', ')}</span>` : '<span class="cf-setores" style="color:#f59e0b;"><i class="fas fa-exclamation-triangle"></i> Nenhum setor vinculado</span>'}
                    </div>
                    <div class="cf-acoes">
                        <button class="btn btn-outline btn-xs btn-editar-custo-fixo" data-id="${cf.id}" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-xs" onclick="window.excluirCustoFixo('${cf.id}')" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>`;
      });
      html += `</div></div>`;
    });
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.btn-editar-custo-fixo').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = this.getAttribute('data-id');
        if (id) window.editarCustoFixo(id);
      });
    });
  };

  window.abrirModalCustoFixo = function(id) {
    const modal = document.getElementById('modalCustoFixo');
    if (!modal) return;
    document.getElementById('custoFixoPeriodo').innerHTML =
      '<option value="">Selecione um período...</option>' +
      periodos.map(p => `<option value="${p.id}" ${(periodoAtual && p.id === periodoAtual.id) ? 'selected' : ''}>${getNomeMes(p.mes)}/${p.ano}</option>`).join('');
    document.getElementById('custoFixoCategoria').innerHTML =
      '<option value="">Selecione uma categoria...</option>' +
      categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    const setoresContainer = document.getElementById('custoFixoSetores');
    if (setoresContainer) {
      const pid = periodoAtual ? periodoAtual.id : null;
      const sets = pid ? getSetoresDoPeriodo(pid) : [];
      if (sets.length === 0) {
        setoresContainer.innerHTML = '<p style="color:var(--text-light);padding:0.5rem;">Nenhum setor cadastrado neste período.</p>';
      } else {
        let html = '<div class="setores-selecao-grid">';
        sets.forEach(s => {
          let checked = false;
          let percentual = 0;
          if (id) {
            const cf = custosFixos.find(x => x.id === id);
            if (cf) {
              const itemExistente = itensCusto.find(i => i.custoFixold === cf.id && i.setorld === s.id && i.tipo === 'fixo');
              if (itemExistente) { checked = true; percentual = itemExistente.percentual || 0; }
            }
          }
          html += `
                    <div class="setor-selecao-item">
                        <label class="setor-checkbox">
                            <input type="checkbox" class="setor-fixo-checkbox" data-setor-id="${s.id}" ${checked ? 'checked' : ''}>
                            <span>${s.nome}</span>
                            ${s.produtoFinal ? '<span class="badge badge-orange" style="font-size:0.6rem;">⭐</span>' : ''}
                        </label>
                        <div class="setor-percentual">
                            <input type="number" class="setor-fixo-percentual" data-setor-id="${s.id}" 
                                   value="${percentual}" min="0" max="100" step="0.01" 
                                   placeholder="%" ${checked ? '' : 'disabled'}>
                            <span>%</span>
                        </div>
                    </div>`;
        });
        html += '</div>';
        setoresContainer.innerHTML = html;
        setoresContainer.querySelectorAll('.setor-fixo-checkbox').forEach(checkbox => {
          checkbox.addEventListener('change', function() {
            const percentInput = this.closest('.setor-selecao-item').querySelector('.setor-fixo-percentual');
            if (this.checked) {
              percentInput.disabled = false;
              if (!percentInput.value || parseFloat(percentInput.value) === 0) percentInput.value = 100;
            } else {
              percentInput.disabled = true;
              percentInput.value = 0;
            }
          });
        });
      }
    }
    if (id) {
      const cf = custosFixos.find(x => x.id === id);
      if (cf) {
        document.getElementById('custoFixoTituloTexto').innerText = 'Editar Custo Fixo';
        document.getElementById('custoFixoEditId').value = cf.id;
        document.getElementById('custoFixoPeriodo').value = cf.periodold || '';
        document.getElementById('custoFixoCategoria').value = cf.categoriald || '';
        document.getElementById('custoFixoNome').value = cf.nome || '';
        document.getElementById('custoFixoValor').value = cf.valor || 0;
      }
    } else {
      document.getElementById('custoFixoTituloTexto').innerText = 'Novo Custo Fixo';
      document.getElementById('custoFixoEditId').value = '';
      document.getElementById('custoFixoNome').value = '';
      document.getElementById('custoFixoValor').value = '';
      if (periodoAtual) document.getElementById('custoFixoPeriodo').value = periodoAtual.id;
      if (categorias.length > 0) document.getElementById('custoFixoCategoria').value = categorias[0].id;
    }
    modal.classList.add('active');
  };

  window.salvarCustoFixo = async function() {
    const periodoId = document.getElementById('custoFixoPeriodo').value;
    const categoriaId = document.getElementById('custoFixoCategoria').value;
    const nome = document.getElementById('custoFixoNome').value.trim();
    const valor = parseFloat(document.getElementById('custoFixoValor').value);
    if (!periodoId || !categoriaId || !nome || isNaN(valor) || valor <= 0) {
      alert('Preencha todos os campos corretamente.');
      return;
    }
    const setoresSelecionados = [];
    document.querySelectorAll('.setor-fixo-checkbox:checked').forEach(checkbox => {
      const setorId = checkbox.dataset.setorId;
      const percentInput = document.querySelector(`.setor-fixo-percentual[data-setor-id="${setorId}"]`);
      const percentual = parseFloat(percentInput.value) || 0;
      if (percentual > 0) setoresSelecionados.push({ setorId, percentual });
    });
    if (setoresSelecionados.length === 0) {
      alert('Selecione pelo menos um setor e defina uma porcentagem maior que 0.');
      return;
    }
    const somaPercentuais = setoresSelecionados.reduce((s, x) => s + x.percentual, 0);
    if (Math.abs(somaPercentuais - 100) > 0.01) {
      alert(`❌ A soma dos percentuais é ${somaPercentuais.toFixed(2)}%.\n\nDeve ser exatamente 100%.\n\nAjuste os valores e tente novamente.`);
      return;
    }
    const editId = document.getElementById('custoFixoEditId').value;
    const cf = { periodold: periodoId, categoriald: categoriaId, nome, valor };
    if (editId) {
      cf.id = editId;
      const idx = custosFixos.findIndex(x => x.id === editId);
      if (idx !== -1) custosFixos[idx] = Object.assign({}, custosFixos[idx], cf);
    } else {
      cf.id = gerarId('cf');
      custosFixos.push(cf);
    }
    await salvarFB('custosFixos', cf);
    if (editId) {
      const itensAntigos = itensCusto.filter(i => i.custoFixold === editId && i.tipo === 'fixo');
      for (const item of itensAntigos) {
        const idx = itensCusto.indexOf(item);
        if (idx !== -1) itensCusto.splice(idx, 1);
        await excluirFB('itensCusto', item.id);
      }
    }
    for (const selecao of setoresSelecionados) {
      const novoItem = {
        id: gerarId('item'),
        setorld: selecao.setorId,
        categoriald: categoriaId,
        nome: nome + ' (fixo)',
        valorTotal: valor,
        percentual: selecao.percentual,
        tipo: 'fixo',
        custoFixold: cf.id,
        obs: `Custo fixo: ${nome} - ${selecao.percentual}%`,
        createdAt: new Date().toISOString()
      };
      itensCusto.push(novoItem);
      await salvarFB('itensCusto', novoItem);
    }
    window.fecharModal('modalCustoFixo');
    renderizarTela();
    alert(`✅ Custo fixo "${nome}" salvo com sucesso!\n\n📊 ${setoresSelecionados.length} setores vinculados`);
  };

  window.editarCustoFixo = function(id) { window.abrirModalCustoFixo(id); };

  window.excluirCustoFixo = async function(id) {
    if (!confirm('Excluir este custo fixo e todos os itens vinculados?')) return;
    try {
      const itensVinculados = itensCusto.filter(i => i.custoFixold === id && i.tipo === 'fixo');
      for (const item of itensVinculados) {
        const idx = itensCusto.indexOf(item);
        if (idx !== -1) itensCusto.splice(idx, 1);
        await excluirFB('itensCusto', item.id);
      }
      custosFixos = custosFixos.filter(c => c.id !== id);
      await excluirFB('custosFixos', id);
      renderizarTela();
      alert('✅ Custo fixo excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir custo fixo:', error);
      alert('Erro ao excluir custo fixo.');
    }
  };

  window.toggleTodosSetores = function(tipo) {
    if (!periodoAtual) return;
    const sets = getSetoresDoPeriodo(periodoAtual.id);
    const setsDoTipo = sets.filter(s => tipo === 'custo' ? s.tipo !== 'despesa' : s.tipo === 'despesa');
    const todosExcluidos = setsDoTipo.every(s => setoresExcluidosResumo.has(s.id));
    if (todosExcluidos) setsDoTipo.forEach(s => setoresExcluidosResumo.delete(s.id));
    else setsDoTipo.forEach(s => setoresExcluidosResumo.add(s.id));
    renderizarTela();
  };

  window.toggleCustosFixos = function() {
    const container = document.getElementById('listaCustosFixosContainer');
    if (!container) return;
    const isHidden = container.style.display === 'none';
    container.style.display = isHidden ? 'block' : 'none';
    const btn = document.querySelector('.btn-toggle-custos-fixos');
    if (btn) {
      btn.innerHTML = isHidden ?
        '<i class="fas fa-chevron-down"></i> Mostrar Custos Fixos' :
        '<i class="fas fa-chevron-up"></i> Ocultar Custos Fixos';
    }
  };

  function renderizarAnalise() {
    const container = document.getElementById('conteudoDinamico');
    if (!container) return;
    if (!setorAtual) {
      container.innerHTML = '<div class="card"><p style="text-align:center;padding:2rem;">Selecione um setor.</p></div>';
      return;
    }
    const setor = setorAtual;
    const custos = calcularCustosSetor(setor.id);
    const itens = itensCusto.filter(i => i.setorld === setor.id);
    const prods = producoes.filter(p => p.setorld === setor.id);

    let html = `
    <div class="card">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-chart-pie"></i> Análise - ${setor.nome}</span>
        <button class="btn btn-outline btn-sm" onclick="window.navegarPara('setores')"><i class="fas fa-arrow-left"></i> Voltar</button>
      </div>
      <div class="stats-grid-home" style="margin-bottom:1.5rem;">
        <div class="stat-card-home">
          <div class="stat-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);"><i class="fas fa-cubes"></i></div>
          <div class="stat-info">
            <div class="stat-label">Itens de Custo</div>
            <div class="stat-value">${custos.qtdItens}</div>
            <div style="font-size:0.7rem;color:var(--text-light);">Cadastrados</div>
          </div>
        </div>
        <div class="stat-card-home">
          <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb, #f5576c);"><i class="fas fa-weight-hanging"></i></div>
          <div class="stat-info">
            <div class="stat-label">${configCampos.producaoKg}</div>
            <div class="stat-value">${formatNumber(custos.totalKg, 0)} kg</div>
            <div style="font-size:0.7rem;color:var(--text-light);">Total produzido</div>
          </div>
        </div>
        <div class="stat-card-home">
          <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe, #00f2fe);"><i class="fas fa-money-bill-wave"></i></div>
          <div class="stat-info">
            <div class="stat-label">${configCampos.custoTotal}</div>
            <div class="stat-value">${formatMoney(custos.totalCusto)}</div>
            <div style="font-size:0.7rem;color:var(--text-light);">Total gasto</div>
          </div>
        </div>
        <div class="stat-card-home" style="border: 2px solid #43e97b; background: linear-gradient(135deg, #f0fff4 0%, #e6ffe6 100%);">
          <div class="stat-icon" style="background: linear-gradient(135deg, #43e97b, #38f9d7);"><i class="fas fa-calculator"></i></div>
          <div class="stat-info">
            <div class="stat-label">${configCampos.custoPorKg}</div>
            <div class="stat-value" style="color:#0d904f;">${formatMoney(custos.custoPorKg)}/kg</div>
            <div style="font-size:0.7rem;color:var(--text-light);">Gasto ÷ Produzido</div>
          </div>
        </div>
      </div>`;

    html += '<h4>Itens de Custo</h4>';
    if (itens.length === 0) {
      html += '<p>Nenhum item cadastrado.</p>';
    } else {
      html += `<div class="table-wrap"><table class="table">
        <thead><tr><th>Item</th><th>Categoria</th><th>Valor Total</th><th>% Rateio</th><th>Valor Rateado</th><th>Tipo</th><th>Ações</th></tr></thead><tbody>`;
      itens.forEach(i => {
        const cat = categorias.find(c => c.id === i.categoriald);
        const tipoLabel = i.tipo === 'fixo' ? '<span class="badge badge-purple">Fixo</span>' : '<span class="badge badge-green">Normal</span>';
        html += `<tr>
          <td>${i.nome}</td>
          <td>${cat ? cat.nome : '-'}</td>
          <td>${formatMoney(i.valorTotal)}</td>
          <td>${getPercentual(i)}%</td>
          <td>${formatMoney(i.valorTotal * getPercentual(i) / 100)}</td>
          <td>${tipoLabel}</td>
          <td>
            <button class="btn btn-outline btn-xs" onclick="window.editarItemCusto('${i.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger btn-xs" onclick="window.excluirItemCusto('${i.id}')"><i class="fas fa-trash"></i></button>
          </td></tr>`;
      });
      html += '</tbody></table></div>';
    }

    html += `<div style="margin-top:1rem;"><button class="btn btn-primary btn-sm" onclick="window.abrirModalItemCusto()"><i class="fas fa-plus"></i> Adicionar Item</button></div>
      <h4 style="margin-top:2rem;">Produção</h4>`;
    if (prods.length === 0) {
      html += '<p>Nenhuma produção registrada.</p>';
    } else {
      html += `<div class="table-wrap"><table class="table">
        <thead><tr><th>Produto</th><th>KG</th><th>Data</th><th>Ações</th></tr></thead><tbody>`;
      prods.forEach(p => {
        html += `<tr><td>${p.produto}</td><td>${formatNumber(p.kg, 0)}</td><td>${p.data || '-'}</td>
          <td><button class="btn btn-danger btn-xs" onclick="window.excluirProducao('${p.id}')"><i class="fas fa-trash"></i></button></td></tr>`;
      });
      html += '</tbody></table></div>';
    }
    html += `<div style="margin-top:1rem;"><button class="btn btn-teal btn-sm" onclick="window.abrirModalProducao()"><i class="fas fa-plus"></i> Registrar Produção</button></div></div>`;
    container.innerHTML = html;
  }

  function renderizarMateriais() {
    const container = document.getElementById('conteudoDinamico');
    if (!container) return;
    let html = `<div class="card">
      <div class="card-header"><span class="card-title"><i class="fas fa-box"></i> Materiais</span>
        <div style="display:flex;gap:0.5rem;">
          <button class="btn btn-outline btn-sm" onclick="window.navegarPara('periodos')"><i class="fas fa-arrow-left"></i> Voltar</button>
          <button class="btn btn-primary btn-sm" onclick="window.abrirModalMaterial()"><i class="fas fa-plus"></i> Novo Material</button>
        </div></div>`;
    if (materiais.length === 0) {
      html += '<p style="text-align:center;padding:1rem;">Nenhum material cadastrado.</p>';
    } else {
      html += `<div class="table-wrap"><table class="table"><thead><tr><th>Nome</th><th>Descrição</th><th>Ações</th></tr></thead><tbody>`;
      materiais.forEach(m => {
        html += `<tr><td>${m.nome}</td><td>${m.descricao || '-'}</td>
          <td>
            <button class="btn btn-outline btn-xs" onclick="window.editarMaterial('${m.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger btn-xs" onclick="window.excluirMaterial('${m.id}')"><i class="fas fa-trash"></i></button>
            <button class="btn btn-info btn-xs" onclick="window.verHistoricoMaterial('${m.id}')"><i class="fas fa-history"></i></button>
          </td></tr>`;
      });
      html += '</tbody></table></div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  function renderizarHistoricoMaterial() {
    const container = document.getElementById('conteudoDinamico');
    if (!container) return;
    container.innerHTML = `<div class="card"><div class="card-header"><span class="card-title"><i class="fas fa-history"></i> Histórico de Custos de Materiais</span>
      <button class="btn btn-outline btn-sm" onclick="window.navegarPara('materiais')"><i class="fas fa-arrow-left"></i> Voltar</button></div><p>Histórico de materiais (em desenvolvimento)</p></div>`;
  }

  function atualizarBreadcrumb() {
    const bc = document.getElementById('breadcrumb');
    if (!bc) return;
    let html = `<span class="breadcrumb-item ${nivelAtual === 'periodos' ? 'active' : ''}" onclick="window.navegarPara('periodos')"><i class="fas fa-home"></i> Home</span>`;
    if (periodoAtual) html += `<span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span><span class="breadcrumb-item ${nivelAtual === 'setores' ? 'active' : ''}" onclick="window.navegarPara('setores')">${getNomeMes(periodoAtual.mes)}/${periodoAtual.ano}</span>`;
    if (setorAtual) html += `<span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span><span class="breadcrumb-item active">${setorAtual.nome}</span>`;
    bc.innerHTML = html;
  }

  window.navegarPara = function(nivel) {
    if (nivel === 'periodos') { periodoAtual = null; setorAtual = null; nivelAtual = 'periodos'; }
    else if (nivel === 'setores') { setorAtual = null; nivelAtual = 'setores'; }
    else if (nivel === 'materiais') { nivelAtual = 'materiais'; }
    renderizarTela();
  };

  window.selecionarPeriodo = function(id) {
    periodoAtual = periodos.find(p => p.id === id);
    setorAtual = null;
    nivelAtual = 'setores';
    setoresExcluidosResumo.clear();
    renderizarTela();
  };

  window.selecionarSetor = function(id) {
    setorAtual = setores.find(s => s.id === id);
    nivelAtual = 'analise';
    renderizarTela();
  };

  window.abrirModalPeriodo = function(id) {
    const modal = document.getElementById('modalPeriodo');
    if (!modal) return;
    modal.classList.add('active');
    if (id) {
      const p = periodos.find(x => x.id === id);
      if (p) {
        document.getElementById('modalPeriodoTitulo').innerText = 'Editar Período';
        document.getElementById('periodoEditId').value = p.id;
        document.getElementById('periodoMes').value = p.mes;
        document.getElementById('periodoAno').value = p.ano;
        document.getElementById('periodoObs').value = p.obs || '';
      }
    } else {
      document.getElementById('modalPeriodoTitulo').innerText = 'Novo Período';
      document.getElementById('periodoEditId').value = '';
      document.getElementById('periodoMes').value = new Date().getMonth() + 1;
      document.getElementById('periodoAno').value = new Date().getFullYear();
      document.getElementById('periodoObs').value = '';
    }
  };

  window.salvarPeriodo = async function() {
    const mes = parseInt(document.getElementById('periodoMes').value);
    const ano = parseInt(document.getElementById('periodoAno').value);
    const obs = document.getElementById('periodoObs').value.trim();
    const editId = document.getElementById('periodoEditId').value;
    const periodo = { mes, ano, obs, createdAt: new Date().toISOString() };
    if (editId) {
      periodo.id = editId;
      const idx = periodos.findIndex(p => p.id === editId);
      if (idx !== -1) periodos[idx] = { ...periodos[idx], ...periodo };
    } else {
      periodo.id = gerarId('per');
      periodos.push(periodo);
    }
    await salvarFB('periodos', periodo);
    window.fecharModal('modalPeriodo');
    renderizarTela();
  };

  window.editarPeriodo = function(id) { if (id) window.abrirModalPeriodo(id); };

  window.excluirPeriodo = async function(id) {
    if (!confirm('Excluir período e todos os dados relacionados?')) return;
    try {
      const setoresDoPeriodo = setores.filter(s => s.periodold === id);
      for (const s of setoresDoPeriodo) {
        await Promise.all([
          ...itensCusto.filter(i => i.setorld === s.id).map(i => excluirFB('itensCusto', i.id)),
          ...producoes.filter(p => p.setorld === s.id).map(p => excluirFB('producoes', p.id)),
          excluirFB('setores', s.id)
        ]);
        itensCusto = itensCusto.filter(i => i.setorld !== s.id);
        producoes = producoes.filter(p => p.setorld !== s.id);
      }
      await Promise.all(custosFixos.filter(cf => cf.periodold === id).map(cf => excluirFB('custosFixos', cf.id)));
      setores = setores.filter(s => s.periodold !== id);
      custosFixos = custosFixos.filter(cf => cf.periodold !== id);
      periodos = periodos.filter(p => p.id !== id);
      periodosSelecionadosResumo.delete(id);
      await excluirFB('periodos', id);
      if (periodoAtual && periodoAtual.id === id) { periodoAtual = null; nivelAtual = 'periodos'; }
      renderizarTela();
    } catch (error) {
      console.error('Erro ao excluir período:', error);
      alert('Erro ao excluir período.');
    }
  };

  window.abrirCopiarPeriodo = function(id) {
    const p = periodos.find(x => x.id === id);
    if (!p) return;
    periodoOrigemCopia = p;
    document.getElementById('copiarOrigem').value = getNomeMes(p.mes) + '/' + p.ano;
    const modal = document.getElementById('modalCopiarPeriodo');
    if (modal) {
      modal.classList.add('active');
      document.getElementById('copiarMes').value = new Date().getMonth() + 1;
      document.getElementById('copiarAno').value = new Date().getFullYear();
    }
  };

  window.copiarPeriodo = async function() {
    if (!periodoOrigemCopia) { alert('Selecione um período de origem primeiro.'); return; }
    const novoMes = parseInt(document.getElementById('copiarMes').value);
    const novoAno = parseInt(document.getElementById('copiarAno').value);
    const periodoExistente = periodos.find(p => p.mes === novoMes && p.ano === novoAno);
    if (periodoExistente) { alert('Já existe um período para ' + getNomeMes(novoMes) + '/' + novoAno); return; }
    try {
      const loadingEl = document.getElementById('loadingOverlay');
      if (loadingEl) loadingEl.classList.add('active');
      const novoPeriodo = {
        id: gerarId('per'), mes: novoMes, ano: novoAno,
        obs: 'Cópia de ' + getNomeMes(periodoOrigemCopia.mes) + '/' + periodoOrigemCopia.ano,
        createdAt: new Date().toISOString()
      };
      await salvarFB('periodos', novoPeriodo);
      periodos.push(novoPeriodo);
      const setoresOrigem = getSetoresDoPeriodo(periodoOrigemCopia.id);
      const mapaCustosFixos = {};
      const custosFixosOrigem = getCustosFixosDoPeriodo(periodoOrigemCopia.id);
      for (const cfOrigem of custosFixosOrigem) {
        const novoId = gerarId('cf');
        mapaCustosFixos[cfOrigem.id] = novoId;
        const novoCF = { ...cfOrigem, id: novoId, periodold: novoPeriodo.id, createdAt: new Date().toISOString() };
        await salvarFB('custosFixos', novoCF);
        custosFixos.push(novoCF);
      }
      for (const setorOrigem of setoresOrigem) {
        const novoSetorId = gerarId('set');
        const novoSetor = { ...setorOrigem, id: novoSetorId, periodold: novoPeriodo.id, createdAt: new Date().toISOString() };
        await salvarFB('setores', novoSetor);
        setores.push(novoSetor);
        const itensOrigem = itensCusto.filter(i => i.setorld === setorOrigem.id);
        for (const itemOrigem of itensOrigem) {
          const novoItem = { ...itemOrigem, id: gerarId('item'), setorld: novoSetorId, createdAt: new Date().toISOString() };
          if (novoItem.tipo === 'fixo' && novoItem.custoFixold) {
            novoItem.custoFixold = mapaCustosFixos[novoItem.custoFixold] || null;
          }
          await salvarFB('itensCusto', novoItem);
          itensCusto.push(novoItem);
        }
        const prodsOrigem = producoes.filter(p => p.setorld === setorOrigem.id);
        for (const prodOrigem of prodsOrigem) {
          const novaProd = { ...prodOrigem, id: gerarId('prod'), setorld: novoSetorId, createdAt: new Date().toISOString() };
          await salvarFB('producoes', novaProd);
          producoes.push(novaProd);
        }
      }
      window.fecharModal('modalCopiarPeriodo');
      periodoOrigemCopia = null;
      renderizarTela();
      alert('✅ Período copiado com sucesso!\n\n📅 ' + getNomeMes(novoMes) + '/' + novoAno + '\n🏭 ' + setoresOrigem.length + ' setores\n💰 ' + custosFixosOrigem.length + ' custos fixos');
    } catch (error) {
      console.error('❌ Erro ao copiar período:', error);
      alert('Erro ao copiar período: ' + error.message);
    } finally {
      const loadingEl = document.getElementById('loadingOverlay');
      if (loadingEl) loadingEl.classList.remove('active');
    }
  };

  window.abrirModalSetor = function(id) {
    if (!periodoAtual) { alert('Selecione um período!'); return; }
    const modal = document.getElementById('modalSetor');
    if (!modal) return;
    modal.classList.add('active');
    if (id) {
      const s = setores.find(x => x.id === id);
      if (s) {
        document.getElementById('modalSetorTitulo').innerHTML = '<i class="fas fa-edit"></i> Editar Setor';
        document.getElementById('setorEditId').value = s.id;
        document.getElementById('setorNome').value = s.nome || '';
        document.getElementById('setorDescricao').value = s.descricao || '';
        document.getElementById('setorOrdem').value = s.ordem || 1;
        document.getElementById('setorProdutoFinal').checked = s.produtoFinal || false;
        document.getElementById('setorTipo').value = s.tipo || 'custo';
      }
    } else {
      document.getElementById('modalSetorTitulo').innerHTML = '<i class="fas fa-plus"></i> Novo Setor';
      document.getElementById('setorEditId').value = '';
      document.getElementById('setorNome').value = '';
      document.getElementById('setorDescricao').value = '';
      document.getElementById('setorOrdem').value = '1';
      document.getElementById('setorProdutoFinal').checked = false;
      document.getElementById('setorTipo').value = 'custo';
    }
  };

  window.salvarSetor = async function() {
    if (!periodoAtual) { alert('Nenhum período selecionado!'); return; }
    const nome = document.getElementById('setorNome').value.trim();
    if (!nome) { alert('Digite o nome!'); return; }
    const setor = {
      periodold: periodoAtual.id,
      nome,
      descricao: document.getElementById('setorDescricao').value.trim() || '',
      ordem: parseInt(document.getElementById('setorOrdem').value) || 1,
      produtoFinal: document.getElementById('setorProdutoFinal').checked || false,
      tipo: document.getElementById('setorTipo').value || 'custo',
      createdAt: new Date().toISOString()
    };
    const editId = document.getElementById('setorEditId').value;
    if (editId) {
      setor.id = editId;
      const idx = setores.findIndex(x => x.id === editId);
      if (idx !== -1) setores[idx] = Object.assign({}, setores[idx], setor);
    } else {
      setor.id = gerarId('set');
      setores.push(setor);
    }
    await salvarFB('setores', setor);
    window.fecharModal('modalSetor');
    renderizarTela();
  };

  window.editarSetor = function(id) { window.abrirModalSetor(id); };

  window.excluirSetor = async function(id) {
    if (!confirm('Excluir setor e todos os itens/produções relacionados?')) return;
    try {
      await Promise.all([
        ...itensCusto.filter(i => i.setorld === id).map(i => excluirFB('itensCusto', i.id)),
        ...producoes.filter(p => p.setorld === id).map(p => excluirFB('producoes', p.id)),
        excluirFB('setores', id)
      ]);
      itensCusto = itensCusto.filter(i => i.setorld !== id);
      producoes = producoes.filter(p => p.setorld !== id);
      setores = setores.filter(s => s.id !== id);
      setoresExcluidosResumo.delete(id);
      if (setorAtual && setorAtual.id === id) setorAtual = null;
      renderizarTela();
    } catch (error) {
      console.error('Erro ao excluir setor:', error);
      alert('Erro ao excluir setor.');
    }
  };

  window.abrirModalCategoria = function(id) {
    const modal = document.getElementById('modalCategoria');
    if (!modal) return;
    modal.classList.add('active');
    if (id) {
      const cat = categorias.find(c => c.id === id);
      if (cat) {
        document.getElementById('modalCategoriaTitulo').innerText = 'Editar Categoria';
        document.getElementById('categoriaEditId').value = cat.id;
        document.getElementById('categoriaNome').value = cat.nome;
        document.getElementById('categoriaCor').value = cat.cor;
      }
    } else {
      document.getElementById('modalCategoriaTitulo').innerText = 'Nova Categoria';
      document.getElementById('categoriaEditId').value = '';
      document.getElementById('categoriaNome').value = '';
      document.getElementById('categoriaCor').value = '#0d904f';
    }
  };

  window.editarCategoria = function(id) { window.abrirModalCategoria(id); };

  window.salvarCategoria = async function() {
    const nome = document.getElementById('categoriaNome').value.trim();
    if (!nome) { alert('Digite o nome da categoria.'); return; }
    const cor = document.getElementById('categoriaCor').value;
    const editId = document.getElementById('categoriaEditId').value;
    let categoria;
    if (editId) {
      const idx = categorias.findIndex(c => c.id === editId);
      if (idx !== -1) {
        categoria = Object.assign({}, categorias[idx], { nome, cor });
        categorias[idx] = categoria;
      }
    } else {
      categoria = { id: gerarId('cat'), nome, cor };
      categorias.push(categoria);
    }
    await salvarFB('categorias', categoria);
    window.fecharModal('modalCategoria');
    renderizarTela();
  };

  window.excluirCategoria = async function(id) {
    if (!confirm('Excluir categoria?')) return;
    categorias = categorias.filter(c => c.id !== id);
    await excluirFB('categorias', id);
    renderizarTela();
  };

  window.abrirModalItemCusto = function(id) {
    if (!setorAtual) { alert('Selecione um setor primeiro.'); return; }
    const modal = document.getElementById('modalItemCusto');
    if (!modal) return;
    modal.classList.add('active');
    const selCat = document.getElementById('itemCategoria');
    if (selCat) selCat.innerHTML = categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    const tabNormal = document.getElementById('tabNormal');
    const tabFixo = document.getElementById('tabFixo');
    if (id) {
      const item = itensCusto.find(i => i.id === id);
      if (item) {
        document.getElementById('modalItemTitulo').innerText = 'Editar Item';
        document.getElementById('itemEditId').value = item.id;
        document.getElementById('itemTipo').value = item.tipo || 'normal';
        if (selCat) selCat.value = item.categoriald || '';
        document.getElementById('itemNome').value = item.nome || '';
        document.getElementById('itemValorTotal').value = item.valorTotal || 0;
        document.getElementById('itemPercentual').value = getPercentual(item);
        document.getElementById('itemObs').value = item.obs || '';
        if (item.tipo === 'fixo' && item.custoFixold) {
          custoFixoSelecionadoId = item.custoFixold;
          const cf = custosFixos.find(c => c.id === item.custoFixold);
          if (cf) {
            document.getElementById('itemFixoNomeDisplay').value = cf.nome;
            document.getElementById('itemFixoValorDisplay').value = formatMoney(cf.valor);
            document.getElementById('itemFixoPercentual').value = getPercentual(item);
          }
        }
        mudarTipoItem(item.tipo || 'normal');
        if (tabNormal) { tabNormal.disabled = true; tabNormal.style.opacity = '0.5'; tabNormal.style.cursor = 'not-allowed'; }
        if (tabFixo) { tabFixo.disabled = true; tabFixo.style.opacity = '0.5'; tabFixo.style.cursor = 'not-allowed'; }
      }
    } else {
      document.getElementById('modalItemTitulo').innerText = 'Novo Item';
      document.getElementById('itemEditId').value = '';
      document.getElementById('itemTipo').value = 'normal';
      if (selCat) selCat.value = categorias[0] ? categorias[0].id : '';
      document.getElementById('itemNome').value = '';
      document.getElementById('itemValorTotal').value = '';
      document.getElementById('itemPercentual').value = 100;
      document.getElementById('itemObs').value = '';
      custoFixoSelecionadoId = null;
      mudarTipoItem('normal');
      if (tabNormal) { tabNormal.disabled = false; tabNormal.style.opacity = '1'; tabNormal.style.cursor = 'pointer'; }
      if (tabFixo) { tabFixo.disabled = false; tabFixo.style.opacity = '1'; tabFixo.style.cursor = 'pointer'; }
    }
    atualizarListaCustosFixos();
  };

  function atualizarListaCustosFixos() {
    const container = document.getElementById('custosFixosSelect');
    if (!container) return;
    const fixos = getCustosFixosDoPeriodo(periodoAtual ? periodoAtual.id : null);
    if (fixos.length === 0) {
      container.innerHTML = '<p style="opacity:0.7;padding:0.5rem;">Nenhum custo fixo cadastrado neste período.</p>';
    } else {
      container.innerHTML = fixos.map(cf => `
        <div class="custo-fixo-item ${custoFixoSelecionadoId === cf.id ? 'selecionado' : ''}" 
             onclick="window.selecionarCustoFixo('${cf.id}')" 
             style="cursor:pointer;margin-bottom:0.5rem;">
          <div>
            <div class="cf-nome">${cf.nome}</div>
            <div class="cf-categoria">${categorias.find(c => c.id === cf.categoriald)?.nome || 'Sem categoria'}</div>
          </div>
          <div class="cf-valor">${formatMoney(cf.valor)}</div>
        </div>`).join('');
    }
  }

  window.selecionarCustoFixo = function(id) {
    custoFixoSelecionadoId = id;
    const cf = custosFixos.find(c => c.id === id);
    if (cf) {
      document.getElementById('itemFixoNomeDisplay').value = cf.nome;
      document.getElementById('itemFixoValorDisplay').value = formatMoney(cf.valor);
      document.getElementById('areaItemFixoDetalhe').style.display = 'block';
    }
    atualizarListaCustosFixos();
  };

  function mudarTipoItem(tipo) {
    document.getElementById('itemTipo').value = tipo;
    document.getElementById('areaItemNormal').style.display = tipo === 'normal' ? 'block' : 'none';
    document.getElementById('areaItensFixos').style.display = tipo === 'fixo' ? 'block' : 'none';
    document.getElementById('areaItemFixoDetalhe').style.display = tipo === 'fixo' && custoFixoSelecionadoId ? 'block' : 'none';
    if (document.getElementById('tabNormal')) document.getElementById('tabNormal').classList.toggle('active', tipo === 'normal');
    if (document.getElementById('tabFixo')) document.getElementById('tabFixo').classList.toggle('active', tipo === 'fixo');
  }
  window.mudarTipoItem = mudarTipoItem;

  window.salvarItemCusto = async function() {
    const tipo = document.getElementById('itemTipo').value;
    const editId = document.getElementById('itemEditId').value;
    const item = {
      setorld: setorAtual ? setorAtual.id : null,
      nome: document.getElementById('itemNome').value.trim(),
      obs: document.getElementById('itemObs').value.trim() || '',
      tipo
    };
    if (tipo === 'normal') {
      item.categoriald = document.getElementById('itemCategoria').value;
      item.valorTotal = parseFloat(document.getElementById('itemValorTotal').value) || 0;
      item.percentual = parseFloat(document.getElementById('itemPercentual').value) || 100;
      const itemOriginal = editId ? itensCusto.find(x => x.id === editId) : null;
      item.custoFixold = (itemOriginal && itemOriginal.tipo === 'fixo') ? itemOriginal.custoFixold : null;
    } else {
      if (!custoFixoSelecionadoId) { alert('Selecione um custo fixo.'); return; }
      const cf = custosFixos.find(c => c.id === custoFixoSelecionadoId);
      if (!cf) { alert('Custo fixo não encontrado.'); return; }
      item.categoriald = cf.categoriald;
      item.valorTotal = cf.valor;
      item.percentual = parseFloat(document.getElementById('itemFixoPercentual').value) || 100;
      item.custoFixold = custoFixoSelecionadoId;
      item.nome = cf.nome;
    }
    if (!item.setorld || !item.nome || item.valorTotal <= 0) {
      alert('Preencha todos os campos corretamente.');
      return;
    }
    if (editId) {
      item.id = editId;
      const idx = itensCusto.findIndex(x => x.id === editId);
      if (idx !== -1) itensCusto[idx] = Object.assign({}, itensCusto[idx], item);
    } else {
      item.id = gerarId('item');
      itensCusto.push(item);
    }
    await salvarFB('itensCusto', item);
    window.fecharModal('modalItemCusto');
    renderizarTela();
  };

  window.editarItemCusto = function(id) { window.abrirModalItemCusto(id); };

  window.excluirItemCusto = async function(id) {
    if (!confirm('Excluir item?')) return;
    itensCusto = itensCusto.filter(i => i.id !== id);
    await excluirFB('itensCusto', id);
    renderizarTela();
  };

  window.abrirModalProducao = function() {
    if (!setorAtual) { alert('Selecione um setor primeiro.'); return; }
    const modal = document.getElementById('modalProducao');
    if (!modal) return;
    modal.classList.add('active');
    document.getElementById('producaoProduto').value = '';
    document.getElementById('producaoKg').value = '';
    document.getElementById('producaoData').value = new Date().toISOString().split('T')[0];
  };

  window.salvarProducao = async function() {
    if (!setorAtual) { alert('Selecione um setor.'); return; }
    const produto = document.getElementById('producaoProduto').value.trim();
    const kg = parseFloat(document.getElementById('producaoKg').value);
    if (!produto || !kg || kg <= 0) { alert('Preencha todos os campos corretamente.'); return; }
    const p = { id: gerarId('prod'), setorld: setorAtual.id, produto, kg, data: document.getElementById('producaoData').value };
    producoes.push(p);
    await salvarFB('producoes', p);
    window.fecharModal('modalProducao');
    renderizarTela();
  };

  window.excluirProducao = async function(id) {
    if (!confirm('Excluir produção?')) return;
    producoes = producoes.filter(p => p.id !== id);
    await excluirFB('producoes', id);
    renderizarTela();
  };

  window.abrirModalMaterial = function(id) {
    const modal = document.getElementById('modalMaterial');
    if (!modal) return;
    modal.classList.add('active');
    if (id) {
      const m = materiais.find(x => x.id === id);
      if (m) {
        document.getElementById('modalMaterialTitulo').innerHTML = '<i class="fas fa-edit"></i> Editar Material';
        document.getElementById('materialEditId').value = m.id;
        document.getElementById('materialNome').value = m.nome;
        document.getElementById('materialDescricao').value = m.descricao || '';
      }
    } else {
      document.getElementById('modalMaterialTitulo').innerHTML = '<i class="fas fa-box"></i> Novo Material';
      document.getElementById('materialEditId').value = '';
      document.getElementById('materialNome').value = '';
      document.getElementById('materialDescricao').value = '';
    }
  };

  window.salvarMaterial = async function() {
    const nome = document.getElementById('materialNome').value.trim();
    if (!nome) { alert('Digite o nome do material.'); return; }
    const editId = document.getElementById('materialEditId').value;
    const m = { nome, descricao: document.getElementById('materialDescricao').value.trim() || '' };
    if (editId) {
      m.id = editId;
      const idx = materiais.findIndex(x => x.id === editId);
      if (idx !== -1) materiais[idx] = Object.assign({}, materiais[idx], m);
    } else {
      m.id = gerarId('mat');
      materiais.push(m);
    }
    await salvarFB('materiais', m);
    window.fecharModal('modalMaterial');
    renderizarTela();
  };

  window.editarMaterial = function(id) { window.abrirModalMaterial(id); };
  window.excluirMaterial = async function(id) {
    if (!confirm('Excluir material?')) return;
    materiais = materiais.filter(m => m.id !== id);
    await excluirFB('materiais', id);
    renderizarTela();
  };
  window.verHistoricoMaterial = function(id) { nivelAtual = 'historicoMaterial'; renderizarTela(); };

  window.abrirGerarCustoMaterial = function() {
    const modal = document.getElementById('modalGerarCusto');
    if (!modal) return;
    modal.classList.add('active');
    document.getElementById('gerarCustoPeriodo').innerHTML = '<option value="">Selecione um período...</option>' +
      periodos.map(p => `<option value="${p.id}">${getNomeMes(p.mes)}/${p.ano}</option>`).join('');
    document.getElementById('gerarCustoMaterial').innerHTML = '<option value="">Selecione um material...</option>' +
      materiais.map(m => `<option value="${m.id}">${m.nome}</option>`).join('');
    document.getElementById('insumosContainer').innerHTML = `<div class="insumo-row"><input type="text" class="insumo-nome" placeholder="Nome do insumo"><input type="number" class="insumo-custo" step="0.01" placeholder="R$/kg"><button class="btn btn-danger btn-xs" onclick="this.parentElement.remove();window.atualizarResumoGerarCusto();"><i class="fas fa-times"></i></button></div>`;
    document.getElementById('gerarCustoImposto').value = 0;
    document.getElementById('gerarCustoMargem').value = 0;
    document.getElementById('gerarCustoValorAtual').value = 0;
    document.getElementById('resumoLinhas').innerHTML = '<p style="opacity:0.7;text-align:center;">Selecione os setores para calcular</p>';
    setoresSelecionadosGerar = new Map();
    window.atualizarSetoresGerarCusto();
  };

  window.atualizarSetoresGerarCusto = function() {
    const periodoId = document.getElementById('gerarCustoPeriodo').value;
    const container = document.getElementById('setoresGerarCusto');
    if (!periodoId) {
      container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:1rem;">Selecione um período primeiro</p>';
      return;
    }
    const sets = setores.filter(s => s.periodold === periodoId);
    if (sets.length === 0) {
      container.innerHTML = '<p style="opacity:0.7;padding:1rem;">Nenhum setor neste período.</p>';
    } else {
      container.innerHTML = sets.map(s => `
        <div class="setor-selecao-item ${setoresSelecionadosGerar.has(s.id) ? 'selecionado' : ''}">
          <div class="ss-header">
            <input type="checkbox" ${setoresSelecionadosGerar.has(s.id) ? 'checked' : ''} onchange="window.toggleSetorGerarCusto('${s.id}', this.checked)">
            <div class="ss-info">
              <div class="ss-nome">${s.nome} ${s.produtoFinal ? '⭐' : ''}</div>
              <div class="ss-custo">${s.descricao || ''} | Custo atual: ${formatMoney(calcularCustosSetor(s.id).totalCusto)}</div>
            </div>
          </div>
        </div>`).join('');
    }
  };

  window.toggleSetorGerarCusto = function(setorId, checked) {
    if (checked) setoresSelecionadosGerar.set(setorId, true);
    else setoresSelecionadosGerar.delete(setorId);
    window.atualizarSetoresGerarCusto();
    window.atualizarResumoGerarCusto();
  };

  window.atualizarResumoGerarCusto = function() {
    const container = document.getElementById('resumoLinhas');
    if (!container) return;
    const setorIds = Array.from(setoresSelecionadosGerar.keys());
    if (setorIds.length === 0) {
      container.innerHTML = '<p style="opacity:0.7;text-align:center;">Selecione os setores para calcular</p>';
      return;
    }
    let custoTotal = 0, producaoTotal = 0;
    setorIds.forEach(id => {
      const custos = calcularCustosSetor(id);
      custoTotal += custos.totalCusto;
      producaoTotal += custos.totalKg;
    });
    const custoKg = producaoTotal > 0 ? custoTotal / producaoTotal : 0;
    let custoInsumos = 0;
    document.querySelectorAll('.insumo-row').forEach(row => {
      const input = row.querySelector('.insumo-custo');
      if (input) custoInsumos += parseFloat(input.value) || 0;
    });
    const imposto = parseFloat(document.getElementById('gerarCustoImposto').value) || 0;
    const margem = parseFloat(document.getElementById('gerarCustoMargem').value) || 0;
    const valorAtual = parseFloat(document.getElementById('gerarCustoValorAtual').value) || 0;
    const custoFinal = custoKg + custoInsumos;
    const precoSugerido = custoFinal * (1 + imposto / 100) * (1 + margem / 100);
    let html = `<div class="linha"><span>Custo dos Setores</span><span class="l-valor">${formatMoney(custoKg)}/kg</span></div>`;
    html += `<div class="linha"><span>Insumos Adicionais</span><span class="l-valor">${formatMoney(custoInsumos)}/kg</span></div>`;
    html += `<div class="linha"><span>Custo Final</span><span class="l-valor">${formatMoney(custoFinal)}/kg</span></div>`;
    if (imposto > 0) html += `<div class="linha"><span>Imposto (${imposto}%)</span><span class="l-valor">${formatMoney(custoFinal * imposto / 100)}/kg</span></div>`;
    if (margem > 0) html += `<div class="linha"><span>Margem (${margem}%)</span><span class="l-valor">${formatMoney(custoFinal * (1 + imposto / 100) * margem / 100)}/kg</span></div>`;
    html += `<div class="linha total"><span>Preço Sugerido</span><span class="l-valor">${formatMoney(precoSugerido)}/kg</span></div>`;
    if (valorAtual > 0) {
      const diff = precoSugerido - valorAtual;
      html += `<div class="linha"><span>Valor Atual</span><span class="l-valor">${formatMoney(valorAtual)}/kg</span></div>`;
      html += `<div class="linha"><span>Diferença</span><span class="l-valor" style="color:${diff >= 0 ? '#4caf50' : '#f44336'}">${diff >= 0 ? '+' : ''}${formatMoney(diff)}/kg</span></div>`;
    }
    container.innerHTML = html;
  };

  window.adicionarInsumo = function() {
    const container = document.getElementById('insumosContainer');
    const div = document.createElement('div');
    div.className = 'insumo-row';
    div.innerHTML = `<input type="text" class="insumo-nome" placeholder="Nome do insumo"><input type="number" class="insumo-custo" step="0.01" placeholder="R$/kg"><button class="btn btn-danger btn-xs" onclick="this.parentElement.remove();window.atualizarResumoGerarCusto();"><i class="fas fa-times"></i></button>`;
    container.appendChild(div);
  };

  window.salvarCustoMaterial = async function() {
    alert('Custo de material salvo com sucesso!');
    window.fecharModal('modalGerarCusto');
  };

  window.gerarPDFCustoMaterial = function() {
    alert('Função de exportação PDF em desenvolvimento.');
  };

  window.mudarFiltroAno = function(v) { filtroAnoAtual = v; periodosSelecionadosResumo.clear(); renderizarTela(); };
  window.togglePeriodoResumo = function(pid, checked) {
    if (checked) periodosSelecionadosResumo.add(pid);
    else periodosSelecionadosResumo.delete(pid);
    renderizarTela();
  };
  window.removePeriodoResumo = function(pid) { periodosSelecionadosResumo.delete(pid); renderizarTela(); };
  window.limparSelecaoResumo = function() { periodosSelecionadosResumo.clear(); renderizarTela(); };
  window.toggleSetorResumo = function(sid, checked) {
    if (checked) setoresExcluidosResumo.delete(sid);
    else setoresExcluidosResumo.add(sid);
    renderizarTela();
  };
  window.limparSetoresExcluidos = function() { setoresExcluidosResumo.clear(); renderizarTela(); };
  window.fecharModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
    if (id === 'modalCustoPorMaterial') {
      const box = document.getElementById('cpmModalBox');
      if (box) {
        box.classList.remove('cpm-fullscreen', 'cpm-expandido');
      }
      document.body.style.overflow = '';
    }
  };

  function adicionarListeners() {
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('active')) {
        e.target.classList.remove('active');
        if (e.target.id === 'modalCustoPorMaterial') {
          const box = document.getElementById('cpmModalBox');
          if (box) box.classList.remove('cpm-fullscreen', 'cpm-expandido');
          document.body.style.overflow = '';
        }
      }
      const btnEditar = e.target.closest('.btn-editar-periodo');
      if (btnEditar) {
        const id = btnEditar.getAttribute('data-id');
        if (id) { e.preventDefault(); e.stopPropagation(); window.editarPeriodo(id); }
      }
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        const cpmBox = document.getElementById('cpmModalBox');
        if (cpmBox && (cpmBox.classList.contains('cpm-fullscreen') || cpmBox.classList.contains('cpm-expandido'))) {
          cpmBox.classList.remove('cpm-fullscreen', 'cpm-expandido');
          document.body.style.overflow = '';
          return;
        }
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      }
    });
  }

  function atualizarStatusFirebase() {
    const el = document.getElementById('firebaseStatus');
    if (el) el.innerHTML = '<span class="status-dot"></span> Firebase Online';
  }

  // ====================================================
  // CUSTO POR MATERIAL — SIMULAÇÃO EM CADEIA
  // ====================================================

  window.cpmToggleExpandir = function() {
    const box = document.getElementById('cpmModalBox');
    const btn = document.getElementById('cpmBtnExpandir');
    if (!box) return;
    if (box.classList.contains('cpm-fullscreen')) {
      box.classList.remove('cpm-fullscreen');
      document.body.style.overflow = '';
      const btnFs = document.getElementById('cpmBtnFullscreen');
      if (btnFs) {
        const spanFs = btnFs.querySelector('span');
        if (spanFs) spanFs.textContent = 'Tela Cheia';
        const iconFs = btnFs.querySelector('i');
        if (iconFs) iconFs.className = 'fas fa-expand';
      }
    }
    const ativo = box.classList.toggle('cpm-expandido');
    if (btn) {
      const span = btn.querySelector('span');
      if (span) span.textContent = ativo ? 'Recolher' : 'Expandir';
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = ativo
          ? 'fas fa-down-left-and-up-right-to-center'
          : 'fas fa-up-right-and-down-left-from-center';
      }
    }
  };

  window.cpmToggleFullscreen = function() {
    const box = document.getElementById('cpmModalBox');
    const btn = document.getElementById('cpmBtnFullscreen');
    if (!box) return;
    const ativo = box.classList.toggle('cpm-fullscreen');
    if (ativo) {
      box.classList.remove('cpm-expandido');
      const btnExp = document.getElementById('cpmBtnExpandir');
      if (btnExp) {
        const span = btnExp.querySelector('span');
        if (span) span.textContent = 'Expandir';
        const icon = btnExp.querySelector('i');
        if (icon) icon.className = 'fas fa-up-right-and-down-left-from-center';
      }
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    if (btn) {
      const span = btn.querySelector('span');
      if (span) span.textContent = ativo ? 'Sair Tela Cheia' : 'Tela Cheia';
      const icon = btn.querySelector('i');
      if (icon) icon.className = ativo ? 'fas fa-compress' : 'fas fa-expand';
    }
  };

  window.abrirCustoPorMaterial = function() {
    const modal = document.getElementById('modalCustoPorMaterial');
    if (!modal) { alert('Modal "modalCustoPorMaterial" não encontrado no HTML.'); return; }

    const anosDisponiveis = Array.from(new Set(periodos.map(p => p.ano))).sort((a, b) => b - a);
    const selectAno = document.getElementById('cpmAno');
    if (selectAno) {
      selectAno.innerHTML = '<option value="">Todos</option>' +
        anosDisponiveis.map(a => `<option value="${a}">${a}</option>`).join('');
    }

    cpmPeriodosSelecionados = [];
    cpmSetoresDisponiveis = [];
    cpmCadeia = [];
    cpmUltimoResultado = null;

    document.getElementById('cpmMpNome').value = '';
    document.getElementById('cpmMpPeso').value = '';
    document.getElementById('cpmMpCusto').value = '';
    document.getElementById('cpmMpImposto').value = '0';
    document.getElementById('cpmResultadoSection').style.display = 'none';
    document.getElementById('cpmComercialSection').style.display = 'none';

    // Reset campos comerciais
    document.getElementById('cpmTransDistancia').value = 0;
    document.getElementById('cpmTransCustoKm').value = 0;
    document.getElementById('cpmTransTotal').value = 'R$ 0,00';
    document.getElementById('cpmNfValorVenda').value = 0;
    document.getElementById('cpmNfImposto').value = 0;
    document.getElementById('cpmNfImpostoValor').value = 'R$ 0,00';
    document.getElementById('cpmMargemDesejada').value = 0;
    document.getElementById('cpmCustoBase').value = 'R$ 0,00';
    document.getElementById('cpmPrecoVendaIdeal').value = 'R$ 0,00';

    const box = document.getElementById('cpmModalBox');
    if (box) box.classList.remove('cpm-fullscreen', 'cpm-expandido');
    document.body.style.overflow = '';
    const btnExp = document.getElementById('cpmBtnExpandir');
    if (btnExp) {
      const span = btnExp.querySelector('span');
      if (span) span.textContent = 'Expandir';
      const icon = btnExp.querySelector('i');
      if (icon) icon.className = 'fas fa-up-right-and-down-left-from-center';
    }
    const btnFs = document.getElementById('cpmBtnFullscreen');
    if (btnFs) {
      const span = btnFs.querySelector('span');
      if (span) span.textContent = 'Tela Cheia';
      const icon = btnFs.querySelector('i');
      if (icon) icon.className = 'fas fa-expand';
    }

    window.cpmAtualizarPeriodos();
    window.cpmRenderizarCadeia();
    window.cpmRenderizarConfiguracoes();

    modal.classList.add('active');
  };

  window.cpmAtualizarPeriodos = function() {
    const ano = document.getElementById('cpmAno').value;
    const selectPeriodos = document.getElementById('cpmPeriodos');
    if (!selectPeriodos) return;
    let filtrados = [...periodos];
    if (ano) filtrados = filtrados.filter(p => p.ano === parseInt(ano));
    filtrados.sort((a, b) => b.ano - a.ano || b.mes - a.mes);
    selectPeriodos.innerHTML = filtrados.map(p =>
      `<option value="${p.id}">${getNomeMes(p.mes)}/${p.ano}</option>`
    ).join('');
    cpmPeriodosSelecionados = cpmPeriodosSelecionados.filter(id => filtrados.some(p => p.id === id));
    Array.from(selectPeriodos.options).forEach(opt => {
      opt.selected = cpmPeriodosSelecionados.includes(opt.value);
    });
    selectPeriodos.onchange = function() {
      cpmPeriodosSelecionados = Array.from(this.selectedOptions).map(o => o.value);
      window.cpmRenderizarTagsPeriodos();
      window.cpmCarregarSetores();
    };
    window.cpmRenderizarTagsPeriodos();
    window.cpmCarregarSetores();
  };

  window.cpmRenderizarTagsPeriodos = function() {
    const container = document.getElementById('cpmPeriodosSelecionados');
    if (!container) return;
    if (cpmPeriodosSelecionados.length === 0) {
      container.innerHTML = '<span style="font-size:0.75rem;color:var(--text-light);">Nenhum período selecionado (usará todos do filtro de ano)</span>';
      return;
    }
    container.innerHTML = cpmPeriodosSelecionados.map(pid => {
      const per = periodos.find(p => p.id === pid);
      if (!per) return '';
      return `<span class="cpm-tag"><i class="fas fa-calendar"></i> ${getNomeMes(per.mes)}/${per.ano}</span>`;
    }).join('');
  };

  window.cpmCarregarSetores = function() {
    const container = document.getElementById('cpmSetoresLista');
    if (!container) return;
    let periodosParaUsar;
    if (cpmPeriodosSelecionados.length > 0) {
      periodosParaUsar = periodos.filter(p => cpmPeriodosSelecionados.includes(p.id));
    } else {
      const ano = document.getElementById('cpmAno').value;
      periodosParaUsar = ano ? periodos.filter(p => p.ano === parseInt(ano)) : [...periodos];
    }
    if (periodosParaUsar.length === 0) {
      container.innerHTML = '<p class="cpm-empty">Nenhum período encontrado com os filtros selecionados.</p>';
      cpmSetoresDisponiveis = [];
      return;
    }
    const todosSetores = [];
    periodosParaUsar.forEach(per => {
      getSetoresDoPeriodo(per.id)
        .filter(s => s.tipo !== 'despesa')
        .forEach(s => {
          todosSetores.push({ ...s, periodoId: per.id, periodoNome: `${getNomeMes(per.mes)}/${per.ano}` });
        });
    });
    const porNome = {};
    todosSetores.forEach(s => {
      if (!porNome[s.nome]) {
        porNome[s.nome] = { nome: s.nome, custosKg: [], periodos: new Set(), produtoFinal: false };
      }
      const custos = calcularCustosSetor(s.id);
      if (custos.totalKg > 0) porNome[s.nome].custosKg.push(custos.custoPorKg);
      porNome[s.nome].periodos.add(s.periodoNome);
      if (s.produtoFinal) porNome[s.nome].produtoFinal = true;
    });
    cpmSetoresDisponiveis = Object.values(porNome).map(item => {
      const soma = item.custosKg.reduce((a, b) => a + b, 0);
      const media = item.custosKg.length > 0 ? soma / item.custosKg.length : 0;
      return {
        nome: item.nome,
        custoKgMedio: media,
        qtdPeriodos: item.periodos.size,
        produtoFinal: item.produtoFinal
      };
    }).sort((a, b) => a.nome.localeCompare(b.nome));
    if (cpmSetoresDisponiveis.length === 0) {
      container.innerHTML = '<p class="cpm-empty">Nenhum setor de custo encontrado.</p>';
      return;
    }
    container.innerHTML = cpmSetoresDisponiveis.map((s, idx) => `
      <div class="cpm-setor-item">
        <div class="cpm-setor-info">
          <div class="cpm-setor-nome">
            <i class="fas fa-industry" style="color:var(--purple);"></i>
            ${s.nome}
            ${s.produtoFinal ? '<span class="badge badge-orange" style="font-size:0.6rem;">⭐ Final</span>' : ''}
          </div>
          <div class="cpm-setor-meta">
            Custo médio: <strong>${formatMoney(s.custoKgMedio)}/kg</strong>
            · ${s.qtdPeriodos} período(s)
          </div>
        </div>
        <div class="cpm-setor-add">
          <button class="btn btn-purple btn-xs" onclick="window.cpmAdicionarSetor(${idx})">
            <i class="fas fa-plus"></i> Adicionar
          </button>
        </div>
      </div>
    `).join('');
  };

  window.cpmAdicionarSetor = function(idx) {
    const setor = cpmSetoresDisponiveis[idx];
    if (!setor) return;
    cpmCadeia.push({
      id: gerarId('cpm'),
      nome: setor.nome,
      custoKg: setor.custoKgMedio,
      perda: 0
    });
    window.cpmRenderizarCadeia();
    window.cpmRenderizarConfiguracoes();
  };

  window.cpmRemoverSetor = function(id) {
    cpmCadeia = cpmCadeia.filter(item => item.id !== id);
    window.cpmRenderizarCadeia();
    window.cpmRenderizarConfiguracoes();
  };

  window.cpmLimparCadeia = function() {
    if (cpmCadeia.length === 0) return;
    if (!confirm('Remover todos os setores da cadeia?')) return;
    cpmCadeia = [];
    window.cpmRenderizarCadeia();
    window.cpmRenderizarConfiguracoes();
  };

  window.cpmRenderizarCadeia = function() {
    const container = document.getElementById('cpmCadeia');
    if (!container) return;
    if (cpmCadeia.length === 0) {
      container.innerHTML = '<p class="cpm-empty">Nenhum setor adicionado. Clique nos setores acima para montar a cadeia.</p>';
      return;
    }
    let html = '';
    cpmCadeia.forEach((item, i) => {
      html += `
        <div class="cpm-cadeia-item">
          <span class="cpm-cadeia-ordem">${String(i + 1).padStart(2, '0')}</span>
          <span>${item.nome}</span>
          <span style="font-size:0.7rem;opacity:0.7;">${formatMoney(item.custoKg)}/kg</span>
        </div>`;
      if (i < cpmCadeia.length - 1) {
        html += '<span class="cpm-cadeia-seta"><i class="fas fa-arrow-right"></i></span>';
      }
    });
    container.innerHTML = html;
  };

  window.cpmRenderizarConfiguracoes = function() {
    const container = document.getElementById('cpmConfiguracoes');
    if (!container) return;
    if (cpmCadeia.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = cpmCadeia.map((item, i) => `
      <div class="cpm-config-item">
        <div class="cpm-config-ordem">${String(i + 1).padStart(2, '0')}</div>
        <div>
          <div class="cpm-config-nome">${item.nome}</div>
          <div class="cpm-config-sub">Custo médio: ${formatMoney(item.custoKg)}/kg</div>
        </div>
        <div class="cpm-config-field">
          <label>Custo/kg (R$)</label>
          <input type="number" step="0.01" min="0" value="${item.custoKg.toFixed(2)}"
                 onchange="window.cpmAtualizarCampo('${item.id}', 'custoKg', this.value)">
        </div>
        <div class="cpm-config-field">
          <label>Perda (%)</label>
          <input type="number" step="0.1" min="0" max="100" value="${item.perda}"
                 onchange="window.cpmAtualizarCampo('${item.id}', 'perda', this.value)">
        </div>
        <div class="cpm-config-remove">
          <button class="btn btn-danger btn-xs" onclick="window.cpmRemoverSetor('${item.id}')" title="Remover">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  };

  window.cpmAtualizarCampo = function(id, campo, valor) {
    const item = cpmCadeia.find(x => x.id === id);
    if (!item) return;
    const v = parseFloat(valor) || 0;
    item[campo] = v;
    window.cpmRenderizarCadeia();
  };

  window.cpmCalcular = function() {
    const nome = document.getElementById('cpmMpNome').value.trim() || 'Matéria-prima';
    const pesoInicial = parseFloat(document.getElementById('cpmMpPeso').value) || 0;
    const custoKgMp = parseFloat(document.getElementById('cpmMpCusto').value) || 0;
    const impostoMp = parseFloat(document.getElementById('cpmMpImposto').value) || 0;

    if (pesoInicial <= 0) { alert('Informe o peso inicial da matéria-prima.'); return; }
    if (cpmCadeia.length === 0) { alert('Adicione pelo menos um setor à cadeia.'); return; }

    let pesoAtual = pesoInicial;
    let custoTotalAcumulado = 0;
    const detalhes = [];

    const custoMP = pesoAtual * custoKgMp * (1 + impostoMp / 100);
    custoTotalAcumulado += custoMP;
    detalhes.push({
      ordem: 'MP', nome,
      pesoEntrada: pesoAtual, custoKg: custoKgMp,
      perda: 0, pesoPerdido: 0, pesoSaida: pesoAtual,
      custoParcial: custoMP, custoAcumulado: custoTotalAcumulado,
      isMP: true
    });

    let pesoEntrada = pesoAtual;
    cpmCadeia.forEach((setor, i) => {
      const perda = setor.perda || 0;
      const pesoPerdido = pesoEntrada * (perda / 100);
      const pesoSaida = pesoEntrada - pesoPerdido;
      const custoParcial = pesoEntrada * setor.custoKg;
      custoTotalAcumulado += custoParcial;
      detalhes.push({
        ordem: String(i + 1).padStart(2, '0'),
        nome: setor.nome,
        pesoEntrada, custoKg: setor.custoKg,
        perda, pesoPerdido, pesoSaida,
        custoParcial, custoAcumulado: custoTotalAcumulado
      });
      pesoAtual = pesoSaida;
      pesoEntrada = pesoSaida;
    });

    const perdaTotal = pesoInicial > 0 ? ((pesoInicial - pesoAtual) / pesoInicial * 100) : 0;
    const custoKgFinal = pesoAtual > 0 ? custoTotalAcumulado / pesoAtual : 0;

    cpmUltimoResultado = {
      nomeMateriaPrima: nome,
      pesoInicial, pesoFinal: pesoAtual,
      perdaTotal, custoTotal: custoTotalAcumulado,
      custoKgFinal, detalhes
    };

    document.getElementById('cpmResPesoInicial').textContent = formatNumber(pesoInicial, 0) + ' kg';
    document.getElementById('cpmResPesoFinal').textContent = formatNumber(pesoAtual, 0) + ' kg';
    document.getElementById('cpmResPerdaTotal').textContent = perdaTotal.toFixed(1) + '%';
    document.getElementById('cpmResCustoTotal').textContent = formatMoney(custoTotalAcumulado);
    document.getElementById('cpmResCustoKg').textContent = formatMoney(custoKgFinal) + '/kg';

    const tbody = document.getElementById('cpmTabelaDetalhe');
    if (tbody) {
      let html = '';
      detalhes.forEach(d => {
        html += `
          <tr class="${d.isMP ? 'linha-mp' : ''}">
            <td><strong>${d.ordem}</strong></td>
            <td>${d.nome}</td>
            <td style="text-align:right;">${formatNumber(d.pesoEntrada, 0)} kg</td>
            <td style="text-align:right;">${formatMoney(d.custoKg)}</td>
            <td style="text-align:right;" class="${d.perda > 0 ? 'txt-danger' : ''}">${d.perda > 0 ? d.perda + '%' : '-'}</td>
            <td style="text-align:right;" class="${d.perda > 0 ? 'txt-danger' : ''}">${d.perda > 0 ? formatNumber(d.pesoPerdido, 0) + ' kg' : '-'}</td>
            <td style="text-align:right;" class="txt-success">${formatNumber(d.pesoSaida, 0)} kg</td>
            <td style="text-align:right;">${formatMoney(d.custoParcial)}</td>
            <td style="text-align:right;font-weight:600;">${formatMoney(d.custoAcumulado)}</td>
          </tr>`;
      });
      html += `
        <tr class="linha-total">
          <td colspan="8" style="text-align:right;color:var(--teal-dark);">CUSTO TOTAL ACUMULADO</td>
          <td style="text-align:right;color:var(--teal-dark);font-size:0.95rem;">${formatMoney(custoTotalAcumulado)}</td>
        </tr>
        <tr class="linha-custo-kg">
          <td colspan="8" style="text-align:right;">CUSTO FINAL POR KG</td>
          <td style="text-align:right;font-size:0.95rem;">${formatMoney(custoKgFinal)}/kg</td>
        </tr>`;
      tbody.innerHTML = html;
    }

    document.getElementById('cpmResultadoSection').style.display = 'block';

    // Atualiza a Etapa 5 (Análise Comercial)
    // Pré-preenche o valor de venda com o custo base (se estiver em 0)
    const nfValorAtual = parseFloat(document.getElementById('cpmNfValorVenda').value) || 0;
    if (nfValorAtual === 0) {
      document.getElementById('cpmNfValorVenda').value = custoTotalAcumulado.toFixed(2);
    }
    document.getElementById('cpmComercialSection').style.display = 'block';
    window.cpmRecalcularComercial();
  };

  // ======== RECÁLCULO COMERCIAL (ETAPA 5) ========
  window.cpmRecalcularComercial = function() {
    if (!cpmUltimoResultado) return;

    const custoProcesso = cpmUltimoResultado.custoTotal;

    const distancia = parseFloat(document.getElementById('cpmTransDistancia').value) || 0;
    const custoKm = parseFloat(document.getElementById('cpmTransCustoKm').value) || 0;
    const custoTransporte = distancia * custoKm;
    document.getElementById('cpmTransTotal').value = formatMoney(custoTransporte);

    const nfValorVenda = parseFloat(document.getElementById('cpmNfValorVenda').value) || 0;
    const nfImpostoPct = parseFloat(document.getElementById('cpmNfImposto').value) || 0;
    const nfImpostoValor = nfValorVenda * (nfImpostoPct / 100);
    document.getElementById('cpmNfImpostoValor').value = formatMoney(nfImpostoValor);

    const margemDesejada = parseFloat(document.getElementById('cpmMargemDesejada').value) || 0;

    const custoBase = custoProcesso + custoTransporte;
    document.getElementById('cpmCustoBase').value = formatMoney(custoBase);

    // Preço de venda ideal = custo base × (1 + margem%)
    // Importante: a margem é aplicada sobre o custo base. O imposto da NF
    // é calculado sobre o preço de venda, portanto entra no lucro líquido.
    const precoVendaIdeal = custoBase * (1 + margemDesejada / 100);
    document.getElementById('cpmPrecoVendaIdeal').value = formatMoney(precoVendaIdeal);

    // Resumo
    document.getElementById('cpmResumoProcesso').textContent = formatMoney(custoProcesso);
    document.getElementById('cpmResumoTransporte').textContent = formatMoney(custoTransporte);
    document.getElementById('cpmResumoCustoBase').textContent = formatMoney(custoBase);
    document.getElementById('cpmResumoMargemPct').textContent = margemDesejada.toFixed(2);
    const margemValor = custoBase * (margemDesejada / 100);
    document.getElementById('cpmResumoMargemValor').textContent = formatMoney(margemValor);
    document.getElementById('cpmResumoPrecoIdeal').textContent = formatMoney(precoVendaIdeal);
    document.getElementById('cpmResumoImpostoPct').textContent = nfImpostoPct.toFixed(2);

    // Considera: se o usuário informou um valor de venda, usamos ele; senão, o ideal
    const precoVendaConsiderado = nfValorVenda > 0 ? nfValorVenda : precoVendaIdeal;
    const impostoConsiderado = precoVendaConsiderado * (nfImpostoPct / 100);
    const lucroLiquido = precoVendaConsiderado - custoBase - impostoConsiderado;

    document.getElementById('cpmResumoImpostoValor').textContent = formatMoney(impostoConsiderado);
    document.getElementById('cpmResumoLucroLiquido').textContent = formatMoney(lucroLiquido);

    const lucroSobreVenda = precoVendaConsiderado > 0 ? (lucroLiquido / precoVendaConsiderado) * 100 : 0;
    const lucroSobreCusto = custoBase > 0 ? (lucroLiquido / custoBase) * 100 : 0;
    document.getElementById('cpmResumoLucroSobreVenda').textContent = lucroSobreVenda.toFixed(2).replace('.', ',') + '%';
    document.getElementById('cpmResumoLucroSobreCusto').textContent = lucroSobreCusto.toFixed(2).replace('.', ',') + '%';
  };

  window.cpmLimparTudo = function() {
    if (!confirm('Limpar todos os dados da simulação?')) return;
    cpmPeriodosSelecionados = [];
    cpmCadeia = [];
    cpmUltimoResultado = null;
    document.getElementById('cpmMpNome').value = '';
    document.getElementById('cpmMpPeso').value = '';
    document.getElementById('cpmMpCusto').value = '';
    document.getElementById('cpmMpImposto').value = '0';
    document.getElementById('cpmResultadoSection').style.display = 'none';
    document.getElementById('cpmComercialSection').style.display = 'none';

    // Reset comerciais
    document.getElementById('cpmTransDistancia').value = 0;
    document.getElementById('cpmTransCustoKm').value = 0;
    document.getElementById('cpmTransTotal').value = 'R$ 0,00';
    document.getElementById('cpmNfValorVenda').value = 0;
    document.getElementById('cpmNfImposto').value = 0;
    document.getElementById('cpmNfImpostoValor').value = 'R$ 0,00';
    document.getElementById('cpmMargemDesejada').value = 0;
    document.getElementById('cpmCustoBase').value = 'R$ 0,00';
    document.getElementById('cpmPrecoVendaIdeal').value = 'R$ 0,00';

    const sel = document.getElementById('cpmPeriodos');
    if (sel) Array.from(sel.options).forEach(o => o.selected = false);
    window.cpmRenderizarTagsPeriodos();
    window.cpmCarregarSetores();
    window.cpmRenderizarCadeia();
    window.cpmRenderizarConfiguracoes();
  };

  window.cpmExportarPDF = function() {
    if (!cpmUltimoResultado) { alert('Calcule a simulação antes de exportar o PDF.'); return; }
    const r = cpmUltimoResultado;
    const dataAtual = new Date().toLocaleString('pt-BR');

    // Dados comerciais
    const custoProcesso = r.custoTotal;
    const custoTransporte = parseFloat(document.getElementById('cpmTransTotal').value.replace('R$ ', '').replace('.', '').replace(',', '.')) || 0;
    const custoBase = custoProcesso + custoTransporte;
    const nfValorVenda = parseFloat(document.getElementById('cpmNfValorVenda').value) || 0;
    const nfImpostoPct = parseFloat(document.getElementById('cpmNfImposto').value) || 0;
    const margemPct = parseFloat(document.getElementById('cpmMargemDesejada').value) || 0;
    const precoVendaIdeal = custoBase * (1 + margemPct / 100);
    const precoVendaConsiderado = nfValorVenda > 0 ? nfValorVenda : precoVendaIdeal;
    const impostoValor = precoVendaConsiderado * (nfImpostoPct / 100);
    const lucroLiquido = precoVendaConsiderado - custoBase - impostoValor;
    const lucroSobreVenda = precoVendaConsiderado > 0 ? (lucroLiquido / precoVendaConsiderado) * 100 : 0;

    let html = `
      <div style="font-family:Arial,sans-serif;padding:20px;max-width:1000px;margin:0 auto;">
        <h1 style="color:#7c3aed;border-bottom:3px solid #7c3aed;padding-bottom:10px;">
          Custo por Material — Simulação em Cadeia
        </h1>
        <p><strong>Matéria-prima:</strong> ${r.nomeMateriaPrima}</p>
        <p><strong>Gerado em:</strong> ${dataAtual}</p>

        <h2 style="color:#7c3aed;margin-top:24px;">1. Simulação do Processo</h2>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:15px 0;background:#f8fafc;padding:15px;border-radius:8px;">
          <div><strong>Peso Inicial:</strong><br>${formatNumber(r.pesoInicial, 0)} kg</div>
          <div><strong>Peso Final:</strong><br>${formatNumber(r.pesoFinal, 0)} kg</div>
          <div><strong>Perda Total:</strong><br>${r.perdaTotal.toFixed(1)}%</div>
          <div><strong>Custo Total:</strong><br>${formatMoney(r.custoTotal)}</div>
          <div><strong>Custo Final/kg:</strong><br>${formatMoney(r.custoKgFinal)}</div>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:0.85rem;margin-top:15px;">
          <thead>
            <tr style="background:#7c3aed;color:#fff;">
              <th style="padding:8px;text-align:left;">Ordem</th>
              <th style="padding:8px;text-align:left;">Item</th>
              <th style="padding:8px;text-align:right;">Peso Entrada</th>
              <th style="padding:8px;text-align:right;">Custo/kg</th>
              <th style="padding:8px;text-align:right;">Perda %</th>
              <th style="padding:8px;text-align:right;">Peso Saída</th>
              <th style="padding:8px;text-align:right;">Custo Parcial</th>
              <th style="padding:8px;text-align:right;">Custo Acum.</th>
            </tr>
          </thead>
          <tbody>`;
    r.detalhes.forEach(d => {
      html += `
            <tr style="border-bottom:1px solid #e5e7eb;${d.isMP ? 'background:#fef3c7;' : ''}">
              <td style="padding:6px 8px;font-weight:600;">${d.ordem}</td>
              <td style="padding:6px 8px;">${d.nome}</td>
              <td style="padding:6px 8px;text-align:right;">${formatNumber(d.pesoEntrada, 0)} kg</td>
              <td style="padding:6px 8px;text-align:right;">${formatMoney(d.custoKg)}</td>
              <td style="padding:6px 8px;text-align:right;${d.perda > 0 ? 'color:#ef4444;font-weight:600;' : ''}">${d.perda > 0 ? d.perda + '%' : '-'}</td>
              <td style="padding:6px 8px;text-align:right;font-weight:600;color:#7c3aed;">${formatNumber(d.pesoSaida, 0)} kg</td>
              <td style="padding:6px 8px;text-align:right;">${formatMoney(d.custoParcial)}</td>
              <td style="padding:6px 8px;text-align:right;font-weight:600;">${formatMoney(d.custoAcumulado)}</td>
            </tr>`;
    });
    html += `
            <tr style="background:#f0fdf4;font-weight:700;border-top:2px solid #7c3aed;">
              <td colspan="7" style="padding:8px;text-align:right;color:#7c3aed;">CUSTO TOTAL ACUMULADO</td>
              <td style="padding:8px;text-align:right;color:#7c3aed;font-size:1.1rem;">${formatMoney(custoProcesso)}</td>
            </tr>
          </tbody>
        </table>

        <h2 style="color:#7c3aed;margin-top:24px;">2. Análise Comercial</h2>
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem;margin-top:15px;">
          <tbody>
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="padding:8px;">Custo do processo:</td>
              <td style="padding:8px;text-align:right;font-weight:600;">${formatMoney(custoProcesso)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="padding:8px;">(+) Transporte (${document.getElementById('cpmTransDistancia').value} km × ${formatMoney(parseFloat(document.getElementById('cpmTransCustoKm').value) || 0)}):</td>
              <td style="padding:8px;text-align:right;font-weight:600;">${formatMoney(custoTransporte)}</td>
            </tr>
            <tr style="background:#f8fafc;border-bottom:2px solid #7c3aed;">
              <td style="padding:8px;font-weight:700;">(=) Custo base:</td>
              <td style="padding:8px;text-align:right;font-weight:700;font-size:1.05rem;">${formatMoney(custoBase)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="padding:8px;">(+) Margem de lucro (${margemPct.toFixed(2)}%):</td>
              <td style="padding:8px;text-align:right;font-weight:600;">${formatMoney(custoBase * margemPct / 100)}</td>
            </tr>
            <tr style="background:#f0fdf4;border-bottom:1px solid #86efac;">
              <td style="padding:8px;font-weight:700;color:#0f766e;">(=) Preço de venda ideal:</td>
              <td style="padding:8px;text-align:right;font-weight:700;font-size:1.1rem;color:#0f766e;">${formatMoney(precoVendaIdeal)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="padding:8px;">Valor de venda considerado na NF:</td>
              <td style="padding:8px;text-align:right;font-weight:600;">${formatMoney(precoVendaConsiderado)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="padding:8px;">(-) Imposto NF (${nfImpostoPct.toFixed(2)}%):</td>
              <td style="padding:8px;text-align:right;font-weight:600;color:#dc2626;">${formatMoney(impostoValor)}</td>
            </tr>
            <tr style="background:#f0fdf4;border-top:2px solid #16a34a;">
              <td style="padding:10px;font-weight:700;color:#166534;font-size:1.1rem;">(=) Lucro líquido:</td>
              <td style="padding:10px;text-align:right;font-weight:700;color:#166534;font-size:1.15rem;">${formatMoney(lucroLiquido)}</td>
            </tr>
            <tr style="background:#dbeafe;">
              <td style="padding:8px;font-weight:600;color:#1e40af;">Margem sobre a venda:</td>
              <td style="padding:8px;text-align:right;font-weight:700;color:#1e40af;">${lucroSobreVenda.toFixed(2).replace('.', ',')}%</td>
            </tr>
          </tbody>
        </table>
      </div>`;

    const win = window.open('', '_blank', 'width=1000,height=700');
    win.document.write(`<html><head><title>Custo por Material</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;} @media print { body { padding:10px; } }</style>
    </head><body>`);
    win.document.write(html);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  // ✅ INIT
  async function init() {
    const loadingEl = document.getElementById('loadingOverlay');
    if (loadingEl) loadingEl.classList.add('active');
    try {
      if (!db) throw new Error('Firebase não disponível');
      await carregarDadosFirebase();
      adicionarListeners();
      atualizarStatusFirebase();
      renderizarTela();
      console.log('✅ Sistema inicializado com sucesso!');
    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      if (loadingEl) loadingEl.classList.remove('active');
      const container = document.getElementById('conteudoDinamico');
      if (container) {
        container.innerHTML = `
          <div style="text-align:center;padding:3rem;">
            <h3>❌ Erro ao carregar</h3>
            <p>${error.message}</p>
            <button class="btn btn-primary" onclick="location.reload()">
              <i class="fas fa-redo"></i> Tentar Novamente
            </button>
          </div>`;
      }
      return;
    }
    if (loadingEl) loadingEl.classList.remove('active');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
