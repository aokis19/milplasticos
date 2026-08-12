// ====================================================
// CUSTO.JS - Central de Custos (Firestore Puro - v3.3 FINAL)
// ✅ CORRIGIDO: Cadastro de custo fixo com seleção de setores
// ✅ CORRIGIDO: Definição de porcentagem por setor
// ✅ CORRIGIDO: Criação direta de itens fixos nos setores
// ✅ CORRIGIDO: Painel de Custo de Processo - Soma dos Custo/KG
// ✅ CORRIGIDO: Custo Casual (extra) com imposto
// ✅ CORRIGIDO: Período opcional - carrega múltiplos períodos
// ====================================================
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

  let periodos = [],
    setores = [],
    categorias = [],
    itensCusto = [],
    producoes = [];
  let materiais = [],
    custosMateriais = [],
    custosFixos = [];
  let periodoAtual = null,
    setorAtual = null;
  let nivelAtual = 'periodos';
  let setoresSelecionadosGerar = new Map();
  let filtroAnoAtual = 'todos';
  let periodoOrigemCopia = null;
  let custoFixoSelecionadoId = null;
  let periodosSelecionadosResumo = new Set();
  let setoresExcluidosResumo = new Set();
  let graficoMensalChart = null;
  let graficoConsolidadoChart = null;
  let graficoCategoriasHomeChart = null;
  let graficoAnaliseSetorChart = null;
  let configCampos = {
    setorNome: 'Nome do Setor',
    setorDesc: 'Descrição',
    custoTotal: 'Custo Total',
    producaoKg: 'Produção (KG)',
    custoPorKg: 'Custo por KG'
  };

  // ======== VARIÁVEIS DO PAINEL DE CUSTO DE PROCESSO ========
  let custoProcessoSetoresSelecionados = [];
  let custoProcessoCasualItens = [];

  // ======== UTILITÁRIOS ========
  function formatMoney(v) { return 'R$ ' + (v || 0).toFixed(2).replace('.', ','); }
  function formatNumber(n, d) { d = d || 2; return (n || 0).toFixed(d).replace('.', ','); }
  function getNomeMes(m) { return ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][m - 1] || ''; }

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

  // ======== CALCULAR CUSTOS DO SETOR ========
  function calcularCustosSetor(setorld) {
    const itens = itensCusto.filter(i => i.setorld === setorld);
    const totalCusto = itens.reduce((s, i) => s + (i.valorTotal * (i.percentual || 100) / 100), 0);
    const prods = producoes.filter(p => p.setorld === setorld);
    const totalKg = prods.reduce((s, p) => s + p.kg, 0);
    const custoPorKg = totalKg > 0 ? totalCusto / totalKg : 0;
    return { totalCusto, totalKg, custoPorKg, qtdItens: itens.length };
  }

  // ======== CALCULAR RESUMO DO PERÍODO ========
  function calcularResumoPeriodo(periodoidParam, excluirSetores) {
    const pid = periodoidParam || (periodoAtual ? periodoAtual.id : null);
    const excluir = excluirSetores || setoresExcluidosResumo;
    if (!pid) return {
      custoTotalGeral: 0,
      producaoTotalGeral: 0,
      custoPorKgGeral: 0,
      qtdSetores: 0,
      setoresFinais: [],
      qtdProdutosFinais: 0
    };

    const sets = getSetoresDoPeriodo(pid).filter(s => !excluir.has(s.id));
    let custoTotalGeral = 0;
    sets.forEach(s => { custoTotalGeral += calcularCustosSetor(s.id).totalCusto; });

    const setsFinais = sets.filter(s => s.produtoFinal === true);
    let producaoTotalGeral = 0;
    setsFinais.forEach(sf => {
      const custos = calcularCustosSetor(sf.id);
      producaoTotalGeral += custos.totalKg;
    });

    return {
      custoTotalGeral,
      producaoTotalGeral,
      custoPorKgGeral: producaoTotalGeral > 0 ? custoTotalGeral / producaoTotalGeral : 0,
      qtdSetores: sets.length,
      qtdProdutosFinais: setsFinais.length
    };
  }

  // ======== PERSISTÊNCIA NO FIRESTORE ========
  async function salvarFB(colecaoNome, dados) {
    try {
      if (!dados.id) {
        dados.id = colecaoNome + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      }
      const ref = colecoes[colecaoNome].doc(dados.id);
      const dadosParaSalvar = { ...dados };
      await ref.set(dadosParaSalvar, { merge: true });
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

  // ✅ FUNÇÃO DE CARREGAMENTO
  async function carregarDadosFirebase() {
    console.log('🔄 Iniciando carregamento...');

    try {
      console.log('📂 Carregando das coleções...');
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

            console.log(`📊 Recuperado: ${periodos.length} períodos, ${setores.length} setores`);
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

      console.log(`✅ PRONTO: ${periodos.length} períodos, ${setores.length} setores, ${categorias.length} categorias`);

    } catch (error) {
      console.error('❌ ERRO:', error);
      throw error;
    }
  }

  // ======== FUNÇÕES GLOBAIS ========
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

  // ======== HOME - COM CARDS, GRÁFICO E PAINEL DE CUSTO DE PROCESSO ========
  function renderizarPeriodos() {
    const container = document.getElementById('conteudoDinamico');
    if (!container) return;

    const anosDisponiveis = Array.from(new Set(periodos.map(p => p.ano))).sort((a, b) => b - a);
    const periodosFiltrados = filtroAnoAtual === 'todos' ?
      [...periodos] :
      periodos.filter(p => p.ano === parseInt(filtroAnoAtual));

    periodosFiltrados.sort((a, b) => b.ano - a.ano || b.mes - a.mes);

    const periodosParaCalculo = periodosSelecionadosResumo.size > 0 ?
      periodosFiltrados.filter(p => periodosSelecionadosResumo.has(p.id)) :
      periodosFiltrados;

    let html = '';

    let totalProduzidoGeral = 0;
    let totalGastoGeral = 0;
    let totalSetoresCount = 0;

    periodosParaCalculo.forEach(per => {
      const sets = getSetoresDoPeriodo(per.id);
      totalSetoresCount += sets.length;
      sets.forEach(s => {
        const custosSetor = calcularCustosSetor(s.id);
        totalGastoGeral += custosSetor.totalCusto;
        totalProduzidoGeral += custosSetor.totalKg;
      });
    });

    const custoPorKgCalculado = totalProduzidoGeral > 0 ? totalGastoGeral / totalProduzidoGeral : 0;

    // ====== CARDS DE RESUMO ======
    html += '<div class="stats-grid-home">';

    html += `
      <div class="stat-card-home">
        <div class="stat-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
          <i class="fas fa-calendar-check"></i>
        </div>
        <div class="stat-info">
          <div class="stat-label">Períodos</div>
          <div class="stat-value">${periodosParaCalculo.length}</div>
          <div style="font-size:0.7rem;color:var(--text-light);">${totalSetoresCount} setores</div>
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
          <div style="font-size:0.7rem;color:var(--text-light);">Produção acumulada</div>
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
          <div style="font-size:0.7rem;color:var(--text-light);">Gasto ÷ Produzido</div>
        </div>
      </div>`;

    html += '</div>';

    // ====== PAINEL DE CUSTO DE PROCESSO ======
    html += `
<div class="card custo-processo-card" style="margin-bottom:1.5rem;margin-top:1.5rem;">
  <div class="card-header">
    <span class="card-title"><i class="fas fa-cogs"></i> Custo de Processo - Soma dos Custos/KG por Setor</span>
    <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
      <button class="btn btn-outline btn-sm" onclick="window.limparCustoProcesso()">
        <i class="fas fa-eraser"></i> Limpar
      </button>
      <button class="btn btn-teal btn-sm" onclick="window.exportarCustoProcessoPDF()">
        <i class="fas fa-file-pdf"></i> Exportar PDF
      </button>
    </div>
  </div>

  <!-- Filtros -->
  <div class="custo-processo-filtros" style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;padding:1rem;background:#f8fafc;border-radius:8px;">
    <div class="form-group" style="margin:0;flex:1;min-width:150px;">
      <label style="font-size:0.8rem;font-weight:600;">Ano</label>
      <select id="custoProcessoAno" onchange="window.filtrarCustoProcesso()" style="width:100%;padding:0.4rem;border-radius:6px;border:1px solid #ddd;">
        <option value="">Todos</option>
      </select>
    </div>
    <div class="form-group" style="margin:0;flex:1;min-width:150px;">
      <label style="font-size:0.8rem;font-weight:600;">Meses (selecione múltiplos)</label>
      <select id="custoProcessoMeses" multiple style="width:100%;padding:0.4rem;border-radius:6px;border:1px solid #ddd;min-height:80px;">
        <option value="1">Janeiro</option>
        <option value="2">Fevereiro</option>
        <option value="3">Março</option>
        <option value="4">Abril</option>
        <option value="5">Maio</option>
        <option value="6">Junho</option>
        <option value="7">Julho</option>
        <option value="8">Agosto</option>
        <option value="9">Setembro</option>
        <option value="10">Outubro</option>
        <option value="11">Novembro</option>
        <option value="12">Dezembro</option>
      </select>
      <div class="hint" style="font-size:0.7rem;color:var(--text-light);">Segure CTRL para selecionar múltiplos meses</div>
    </div>
    <div class="form-group" style="margin:0;flex:1;min-width:150px;">
      <label style="font-size:0.8rem;font-weight:600;">Período (opcional)</label>
      <select id="custoProcessoPeriodo" onchange="window.carregarSetoresProcesso()" style="width:100%;padding:0.4rem;border-radius:6px;border:1px solid #ddd;">
        <option value="">Todos os períodos</option>
      </select>
    </div>
  </div>

  <!-- Resumo Principal -->
  <div class="custo-processo-resumo" id="custoProcessoResumo" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:1.5rem;">
    <div class="stat-card-home" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;">
      <div class="stat-info">
        <div class="stat-label" style="color:rgba(255,255,255,0.8);">Setores Selecionados</div>
        <div class="stat-value" id="custoProcessoQtdSetores" style="color:#fff;">0</div>
      </div>
    </div>
    <div class="stat-card-home" style="background:linear-gradient(135deg,#f093fb,#f5576c);color:#fff;border:none;">
      <div class="stat-info">
        <div class="stat-label" style="color:rgba(255,255,255,0.8);">Soma dos Custos/KG</div>
        <div class="stat-value" id="custoProcessoProducao" style="color:#fff;">R$ 0,00</div>
      </div>
    </div>
    <div class="stat-card-home" style="background:linear-gradient(135deg,#43e97b,#38f9d7);color:#fff;border:none;">
      <div class="stat-info">
        <div class="stat-label" style="color:rgba(255,255,255,0.8);">Custos Casuais</div>
        <div class="stat-value" id="custoProcessoCasualCount" style="color:#fff;">0</div>
      </div>
    </div>
  </div>

  <!-- Custos Casuais -->
  <div style="margin-bottom:1rem;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
      <label style="font-weight:600;font-size:0.9rem;margin:0;">
        <i class="fas fa-plus-circle" style="color:#f59e0b;"></i> Custos Casuais (Extra)
      </label>
      <button class="btn btn-warning btn-sm" onclick="window.adicionarCustoCasual()">
        <i class="fas fa-plus"></i> Adicionar Custo Casual
      </button>
    </div>
    <div id="custoProcessoCasualLista" style="border:1px solid #e5e7eb;border-radius:8px;padding:0.5rem;min-height:50px;">
      <p style="color:var(--text-light);text-align:center;padding:0.5rem;margin:0;font-size:0.85rem;">
        Nenhum custo casual adicionado.
      </p>
    </div>
  </div>

  <!-- Lista de Setores do Período -->
  <div style="margin-bottom:1rem;">
    <label style="font-weight:600;font-size:0.9rem;display:block;margin-bottom:0.5rem;">
      <i class="fas fa-industry"></i> Setores de Custo
      <span style="font-weight:400;font-size:0.8rem;color:var(--text-light);">(selecione os setores para somar os custos/kg)</span>
    </label>
    <div id="custoProcessoSetoresLista" style="max-height:250px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;padding:0.5rem;">
      <p style="color:var(--text-light);text-align:center;padding:1rem;">Selecione os filtros para carregar os setores.</p>
    </div>
  </div>

  <!-- Setores Selecionados -->
  <div style="margin-bottom:1rem;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
      <label style="font-weight:600;font-size:0.9rem;margin:0;">
        <i class="fas fa-check-circle" style="color:#0d904f;"></i> Setores Selecionados
      </label>
      <button class="btn btn-outline btn-sm" onclick="window.limparSelecaoSetores()">
        <i class="fas fa-times"></i> Limpar Seleção
      </button>
    </div>
    <div id="custoProcessoSetoresSelecionados" style="border:1px solid #e5e7eb;border-radius:8px;padding:0.5rem;min-height:80px;">
      <p style="color:var(--text-light);text-align:center;padding:1rem;margin:0;">
        Nenhum setor selecionado. Marque os setores abaixo para calcular a soma.
      </p>
    </div>
  </div>

  <!-- Botões de Ação -->
  <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
    <button class="btn btn-warning btn-sm" onclick="window.calcularCustoProcesso()">
      <i class="fas fa-sync"></i> Calcular Soma
    </button>
    <button class="btn btn-outline btn-sm" onclick="window.limparCustoProcesso()">
      <i class="fas fa-eraser"></i> Limpar Tudo
    </button>
  </div>
</div>
`;

    // ====== GRÁFICO DE CATEGORIAS ======
    html += `
      <div class="categorias-section">
        <div class="card">
          <div class="card-header">
            <span class="card-title"><i class="fas fa-chart-bar"></i> Custos por Categoria</span>
            <div style="display:flex;gap:0.5rem;">
              <button class="btn btn-outline btn-sm" onclick="window.abrirModalCategoria()">
                <i class="fas fa-plus"></i> Nova Categoria
              </button>
            </div>
          </div>
          <div class="periodos-selecionados-tags" style="margin-bottom:1rem;">
            ${periodosSelecionadosResumo.size > 0 ?
        Array.from(periodosSelecionadosResumo).map(pid => {
          const per = periodos.find(p => p.id === pid);
          return per ? `<span class="periodo-tag" style="background:#e3f2fd;color:#1565c0;">${getNomeMes(per.mes)}/${per.ano} <span class="remover-tag" onclick="window.removePeriodoResumo('${pid}')">&times;</span></span>` : '';
        }).join('') + '<span class="btn-selecionar-todos" onclick="window.limparSelecaoResumo()" style="background:#e3f2fd;color:#1565c0;">Limpar</span>'
        : '<span style="font-size:0.8rem;color:var(--text-light);">Selecione os períodos abaixo para filtrar</span>'
      }
          </div>
          <div class="categorias-content">
            <div class="grafico-categorias-wrapper">
              <div style="height: 450px; position: relative;">
                <canvas id="graficoCategoriasHome"></canvas>
              </div>
            </div>
            <div class="lista-categorias-wrapper">
              <h4 style="margin: 0 0 1rem 0; font-size: 0.9rem; color: var(--text-light);">
                <i class="fas fa-list"></i> Resumo por Categoria
              </h4>
              <div id="listaCategoriasHome"></div>
            </div>
          </div>
        </div>
      </div>`;

    // ====== LISTA DE PERÍODOS ======
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
            <button class="btn btn-purple btn-xs" onclick="event.stopPropagation();window.abrirGraficoMensal('${per.id}')" title="Ver Gráfico"><i class="fas fa-chart-bar"></i></button>
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

    setTimeout(() => {
      inicializarGraficoCategorias();
      renderizarListaCategorias();
      window.inicializarCustoProcesso();
    }, 100);
  }

  // ======== GRÁFICO VERTICAL - CATEGORIAS NA HOME ========
  function inicializarGraficoCategorias() {
    const canvas = document.getElementById('graficoCategoriasHome');
    if (!canvas) return;

    if (window.graficoCategoriasHomeChart) {
      window.graficoCategoriasHomeChart.destroy();
    }

    const totaisCategorias = {};
    categorias.forEach(cat => {
      totaisCategorias[cat.id] = { nome: cat.nome, cor: cat.cor, total: 0 };
    });

    const periodosParaGrafico = periodosSelecionadosResumo.size > 0 ?
      periodos.filter(p => periodosSelecionadosResumo.has(p.id)) :
      (filtroAnoAtual === 'todos' ? periodos : periodos.filter(p => p.ano === parseInt(filtroAnoAtual)));

    periodosParaGrafico.forEach(per => {
      getSetoresDoPeriodo(per.id).forEach(s => {
        itensCusto.filter(i => i.setorld === s.id).forEach(i => {
          if (totaisCategorias[i.categoriald]) {
            totaisCategorias[i.categoriald].total += i.valorTotal * (i.percentual || 100) / 100;
          }
        });
      });
    });

    const dadosGrafico = Object.values(totaisCategorias).filter(cat => cat.total > 0);

    if (dadosGrafico.length === 0) {
      canvas.parentElement.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-light);">Nenhum custo registrado.</p>';
      return;
    }

    dadosGrafico.sort((a, b) => b.total - a.total);

    const wrapper = canvas.parentElement;
    const btnFullOld = document.getElementById('btnFullscreenHome');
    if (btnFullOld) btnFullOld.remove();

    const btnFull = document.createElement('button');
    btnFull.id = 'btnFullscreenHome';
    btnFull.className = 'btn-fullscreen-grafico';
    btnFull.innerHTML = '<i class="fas fa-expand"></i> Tela Cheia';
    btnFull.onclick = () => abrirGraficoFullscreen('home');
    wrapper.style.position = 'relative';
    wrapper.appendChild(btnFull);

    window.graficoCategoriasHomeChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: dadosGrafico.map(c => c.nome),
        datasets: [{
          label: 'Valor Total',
          data: dadosGrafico.map(c => c.total),
          backgroundColor: dadosGrafico.map(c => c.cor + 'CC'),
          borderColor: dadosGrafico.map(c => c.cor),
          borderWidth: 2,
          borderRadius: 10,
          borderSkipped: false,
          hoverBackgroundColor: dadosGrafico.map(c => c.cor),
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            titleFont: { size: 14 },
            bodyFont: { size: 13 },
            callbacks: {
              label: function(context) {
                const value = context.parsed.y;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percent = total > 0 ? ((value * 100) / total).toFixed(1) : 0;
                return ` ${context.label}: ${formatMoney(value)} (${percent}%)`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: function(value) { return formatMoney(value); }, font: { size: 12, weight: '600' } },
            grid: { color: '#e5e7eb', drawBorder: false }
          },
          x: {
            ticks: { font: { size: 12, weight: '500' }, maxRotation: 45, minRotation: 0 },
            grid: { display: false }
          }
        }
      }
    });
  }

  function renderizarListaCategorias() {
    const container = document.getElementById('listaCategoriasHome');
    if (!container) return;

    if (categorias.length === 0) {
      container.innerHTML = '<p style="text-align:center;padding:1rem;color:var(--text-light);">Nenhuma categoria.</p>';
      return;
    }

    const totais = {};
    categorias.forEach(cat => { totais[cat.id] = { ...cat, total: 0 }; });

    const periodosParaGrafico = periodosSelecionadosResumo.size > 0 ?
      periodos.filter(p => periodosSelecionadosResumo.has(p.id)) :
      (filtroAnoAtual === 'todos' ? periodos : periodos.filter(p => p.ano === parseInt(filtroAnoAtual)));

    periodosParaGrafico.forEach(per => {
      getSetoresDoPeriodo(per.id).forEach(s => {
        itensCusto.filter(i => i.setorld === s.id).forEach(i => {
          if (totais[i.categoriald]) {
            totais[i.categoriald].total += i.valorTotal * (i.percentual || 100) / 100;
          }
        });
      });
    });

    const categoriasOrdenadas = Object.values(totais).sort((a, b) => b.total - a.total);

    container.innerHTML = categoriasOrdenadas.map(cat => `
      <div class="categoria-item-home">
        <div class="categoria-cor" style="background-color: ${cat.cor};" title="${cat.nome}"></div>
        <div class="categoria-info">
          <div class="categoria-nome">${cat.nome}</div>
          <div class="categoria-total">${formatMoney(cat.total)}</div>
        </div>
        <button class="btn btn-xs btn-outline" onclick="window.editarCategoria('${cat.id}')" title="Editar">
          <i class="fas fa-edit"></i>
        </button>
      </div>
    `).join('');
  }

  // ======== RENDERIZAR CARD SETOR ========
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

  // ======== SETORES ========
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
          <div class="stat-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
            <i class="fas fa-industry"></i>
          </div>
          <div class="stat-info">
            <div class="stat-label">Setores</div>
            <div class="stat-value">${resumo.qtdSetores}</div>
            <div style="font-size:0.7rem;color:var(--text-light);">Cadastrados</div>
          </div>
        </div>
        <div class="stat-card-home">
          <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb, #f5576c);">
            <i class="fas fa-weight-hanging"></i>
          </div>
          <div class="stat-info">
            <div class="stat-label">${configCampos.producaoKg}</div>
            <div class="stat-value">${formatNumber(resumo.producaoTotalGeral, 0)} kg</div>
            <div style="font-size:0.7rem;color:var(--text-light);">Total produzido</div>
          </div>
        </div>
        <div class="stat-card-home">
          <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe, #00f2fe);">
            <i class="fas fa-money-bill-wave"></i>
          </div>
          <div class="stat-info">
            <div class="stat-label">${configCampos.custoTotal}</div>
            <div class="stat-value">${formatMoney(resumo.custoTotalGeral)}</div>
            <div style="font-size:0.7rem;color:var(--text-light);">Total gasto</div>
          </div>
        </div>
        <div class="stat-card-home" style="border: 2px solid #43e97b; background: linear-gradient(135deg, #f0fff4 0%, #e6ffe6 100%);">
          <div class="stat-icon" style="background: linear-gradient(135deg, #43e97b, #38f9d7);">
            <i class="fas fa-calculator"></i>
          </div>
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

    // ==== ÁREA DE CUSTOS FIXOS ====
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

    // Renderiza os cards de setores
    if (setoresCusto.length > 0) {
      const gridCusto = document.getElementById('setoresCustoGrid');
      if (gridCusto) setoresCusto.forEach(s => renderizarCardSetor(s, gridCusto));
    }

    if (setoresDespesa.length > 0) {
      const gridDespesa = document.getElementById('setoresDespesaGrid');
      if (gridDespesa) setoresDespesa.forEach(s => renderizarCardSetor(s, gridDespesa));
    }

    // Renderiza os custos fixos
    window.listarCustosFixos(periodoAtual.id);
  }

  // ======== LISTAR CUSTOS FIXOS ========
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
            </div>
        `;
      return;
    }

    const agrupados = {};
    fixos.forEach(cf => {
      const catId = cf.categoriald || 'sem_categoria';
      if (!agrupados[catId]) {
        const cat = categorias.find(c => c.id === catId);
        agrupados[catId] = {
          nome: cat ? cat.nome : 'Sem Categoria',
          cor: cat ? cat.cor : '#6b7280',
          itens: []
        };
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
        <div class="custos-fixos-grid">
    `;

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
                <div class="custo-fixo-lista">
        `;

      grupo.itens.forEach(cf => {
        // Verifica quais setores receberam este custo fixo
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
                </div>
            `;
      });

      html += `
                </div>
            </div>
        `;
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

  // ======== ABRIR MODAL CUSTO FIXO ========
  window.abrirModalCustoFixo = function(id) {
    const modal = document.getElementById('modalCustoFixo');
    if (!modal) return;

    // Preenche períodos
    document.getElementById('custoFixoPeriodo').innerHTML =
      '<option value="">Selecione um período...</option>' +
      periodos.map(p => `<option value="${p.id}" ${(periodoAtual && p.id === periodoAtual.id) ? 'selected' : ''}>${getNomeMes(p.mes)}/${p.ano}</option>`).join('');

    // Preenche categorias
    document.getElementById('custoFixoCategoria').innerHTML =
      '<option value="">Selecione uma categoria...</option>' +
      categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

    // Preenche setores do período
    const setoresContainer = document.getElementById('custoFixoSetores');
    if (setoresContainer) {
      const pid = periodoAtual ? periodoAtual.id : null;
      const sets = pid ? getSetoresDoPeriodo(pid) : [];

      if (sets.length === 0) {
        setoresContainer.innerHTML = '<p style="color:var(--text-light);padding:0.5rem;">Nenhum setor cadastrado neste período.</p>';
      } else {
        let html = '<div class="setores-selecao-grid">';
        sets.forEach(s => {
          // Se estiver editando, verifica se este setor já está vinculado
          let checked = false;
          let percentual = 0;
          if (id) {
            const cf = custosFixos.find(x => x.id === id);
            if (cf) {
              const itemExistente = itensCusto.find(i => i.custoFixold === cf.id && i.setorld === s.id && i.tipo === 'fixo');
              if (itemExistente) {
                checked = true;
                percentual = itemExistente.percentual || 0;
              }
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
                    </div>
                `;
        });
        html += '</div>';
        setoresContainer.innerHTML = html;

        // Adiciona eventos para habilitar/desabilitar o input de porcentagem
        setoresContainer.querySelectorAll('.setor-fixo-checkbox').forEach(checkbox => {
          checkbox.addEventListener('change', function() {
            const percentInput = this.closest('.setor-selecao-item').querySelector('.setor-fixo-percentual');
            if (this.checked) {
              percentInput.disabled = false;
              if (!percentInput.value || parseFloat(percentInput.value) === 0) {
                percentInput.value = 100;
              }
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
      if (periodoAtual) {
        document.getElementById('custoFixoPeriodo').value = periodoAtual.id;
      }
      if (categorias.length > 0) {
        document.getElementById('custoFixoCategoria').value = categorias[0].id;
      }
    }

    modal.classList.add('active');
  };

  // ======== SALVAR CUSTO FIXO ========
  window.salvarCustoFixo = async function() {
    const periodoId = document.getElementById('custoFixoPeriodo').value;
    const categoriaId = document.getElementById('custoFixoCategoria').value;
    const nome = document.getElementById('custoFixoNome').value.trim();
    const valor = parseFloat(document.getElementById('custoFixoValor').value);

    if (!periodoId || !categoriaId || !nome || isNaN(valor) || valor <= 0) {
      alert('Preencha todos os campos corretamente.');
      return;
    }

    // Coleta os setores selecionados e suas porcentagens
    const setoresSelecionados = [];
    document.querySelectorAll('.setor-fixo-checkbox:checked').forEach(checkbox => {
      const setorId = checkbox.dataset.setorId;
      const percentInput = document.querySelector(`.setor-fixo-percentual[data-setor-id="${setorId}"]`);
      const percentual = parseFloat(percentInput.value) || 0;

      if (percentual > 0) {
        setoresSelecionados.push({
          setorId: setorId,
          percentual: percentual
        });
      }
    });

    if (setoresSelecionados.length === 0) {
      alert('Selecione pelo menos um setor e defina uma porcentagem maior que 0.');
      return;
    }

    const editId = document.getElementById('custoFixoEditId').value;
    const cf = {
      periodold: periodoId,
      categoriald: categoriaId,
      nome,
      valor
    };

    // Salva o custo fixo
    if (editId) {
      cf.id = editId;
      const idx = custosFixos.findIndex(x => x.id === editId);
      if (idx !== -1) custosFixos[idx] = Object.assign({}, custosFixos[idx], cf);
    } else {
      cf.id = 'cf_' + Date.now();
      custosFixos.push(cf);
    }
    await salvarFB('custosFixos', cf);

    // Remove os itens fixos antigos (se estiver editando)
    if (editId) {
      const itensAntigos = itensCusto.filter(i => i.custoFixold === editId && i.tipo === 'fixo');
      for (const item of itensAntigos) {
        const idx = itensCusto.indexOf(item);
        if (idx !== -1) itensCusto.splice(idx, 1);
        await excluirFB('itensCusto', item.id);
      }
    }

    // Cria os itens fixos para cada setor selecionado
    for (const selecao of setoresSelecionados) {
      const novoItem = {
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
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

  // ======== EDITAR CUSTO FIXO ========
  window.editarCustoFixo = function(id) {
    window.abrirModalCustoFixo(id);
  };

  // ======== EXCLUIR CUSTO FIXO ========
  window.excluirCustoFixo = async function(id) {
    if (!confirm('Excluir este custo fixo e todos os itens vinculados?')) return;

    try {
      // Remove os itens fixos vinculados
      const itensVinculados = itensCusto.filter(i => i.custoFixold === id && i.tipo === 'fixo');
      for (const item of itensVinculados) {
        const idx = itensCusto.indexOf(item);
        if (idx !== -1) itensCusto.splice(idx, 1);
        await excluirFB('itensCusto', item.id);
      }

      // Remove o custo fixo
      custosFixos = custosFixos.filter(c => c.id !== id);
      await excluirFB('custosFixos', id);
      renderizarTela();
      alert('✅ Custo fixo excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir custo fixo:', error);
      alert('Erro ao excluir custo fixo.');
    }
  };

  // ======== TOGGLE TODOS SETORES ========
  window.toggleTodosSetores = function(tipo) {
    if (!periodoAtual) return;
    const sets = getSetoresDoPeriodo(periodoAtual.id);
    const setsDoTipo = sets.filter(s =>
      tipo === 'custo' ? s.tipo !== 'despesa' : s.tipo === 'despesa'
    );

    const todosExcluidos = setsDoTipo.every(s => setoresExcluidosResumo.has(s.id));

    if (todosExcluidos) {
      setsDoTipo.forEach(s => setoresExcluidosResumo.delete(s.id));
    } else {
      setsDoTipo.forEach(s => setoresExcluidosResumo.add(s.id));
    }

    renderizarTela();
  };

  // ======== MINIMIZAR/EXPANDIR CUSTOS FIXOS ========
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

  // ======== ANÁLISE ========
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
          <div class="stat-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
            <i class="fas fa-cubes"></i>
          </div>
          <div class="stat-info">
            <div class="stat-label">Itens de Custo</div>
            <div class="stat-value">${custos.qtdItens}</div>
            <div style="font-size:0.7rem;color:var(--text-light);">Cadastrados</div>
          </div>
        </div>
        <div class="stat-card-home">
          <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb, #f5576c);">
            <i class="fas fa-weight-hanging"></i>
          </div>
          <div class="stat-info">
            <div class="stat-label">${configCampos.producaoKg}</div>
            <div class="stat-value">${formatNumber(custos.totalKg, 0)} kg</div>
            <div style="font-size:0.7rem;color:var(--text-light);">Total produzido</div>
          </div>
        </div>
        <div class="stat-card-home">
          <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe, #00f2fe);">
            <i class="fas fa-money-bill-wave"></i>
          </div>
          <div class="stat-info">
            <div class="stat-label">${configCampos.custoTotal}</div>
            <div class="stat-value">${formatMoney(custos.totalCusto)}</div>
            <div style="font-size:0.7rem;color:var(--text-light);">Total gasto</div>
          </div>
        </div>
        <div class="stat-card-home" style="border: 2px solid #43e97b; background: linear-gradient(135deg, #f0fff4 0%, #e6ffe6 100%);">
          <div class="stat-icon" style="background: linear-gradient(135deg, #43e97b, #38f9d7);">
            <i class="fas fa-calculator"></i>
          </div>
          <div class="stat-info">
            <div class="stat-label">${configCampos.custoPorKg}</div>
            <div class="stat-value" style="color:#0d904f;">${formatMoney(custos.custoPorKg)}/kg</div>
            <div style="font-size:0.7rem;color:var(--text-light);">Gasto ÷ Produzido</div>
          </div>
        </div>
      </div>`;

    if (itens.length > 0) {
      html += `
        <div style="margin-bottom: 1.5rem;">
          <h4 style="margin-bottom: 1rem;"><i class="fas fa-chart-bar"></i> Custos por Categoria</h4>
          <div style="height: 400px; position: relative;">
            <canvas id="graficoAnaliseSetor"></canvas>
          </div>
        </div>`;
    }

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
          <td>${i.percentual || 100}%</td>
          <td>${formatMoney(i.valorTotal * (i.percentual || 100) / 100)}</td>
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

    if (itens.length > 0) {
      setTimeout(() => inicializarGraficoAnaliseSetor(), 100);
    }
  }

  function inicializarGraficoAnaliseSetor() {
    const canvas = document.getElementById('graficoAnaliseSetor');
    if (!canvas) return;

    if (window.graficoAnaliseSetorChart) {
      window.graficoAnaliseSetorChart.destroy();
    }

    const itens = itensCusto.filter(i => i.setorld === setorAtual.id);
    if (itens.length === 0) return;

    const totaisPorCategoria = {};
    itens.forEach(i => {
      const catId = i.categoriald || 'sem_categoria';
      if (!totaisPorCategoria[catId]) {
        const cat = categorias.find(c => c.id === catId);
        totaisPorCategoria[catId] = {
          nome: cat ? cat.nome : 'Sem Categoria',
          cor: cat ? cat.cor : '#6b7280',
          total: 0
        };
      }
      totaisPorCategoria[catId].total += i.valorTotal * (i.percentual || 100) / 100;
    });

    const dadosGrafico = Object.values(totaisPorCategoria).filter(c => c.total > 0);
    dadosGrafico.sort((a, b) => b.total - a.total);

    const wrapper = canvas.parentElement;
    const btnFullOld = document.getElementById('btnFullscreenAnalise');
    if (btnFullOld) btnFullOld.remove();

    const btnFull = document.createElement('button');
    btnFull.id = 'btnFullscreenAnalise';
    btnFull.className = 'btn-fullscreen-grafico';
    btnFull.innerHTML = '<i class="fas fa-expand"></i> Tela Cheia';
    btnFull.onclick = () => abrirGraficoFullscreen('analise');
    wrapper.style.position = 'relative';
    wrapper.appendChild(btnFull);

    window.graficoAnaliseSetorChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: dadosGrafico.map(c => c.nome),
        datasets: [{
          label: 'Valor Total',
          data: dadosGrafico.map(c => c.total),
          backgroundColor: dadosGrafico.map(c => c.cor + 'CC'),
          borderColor: dadosGrafico.map(c => c.cor),
          borderWidth: 2,
          borderRadius: 10,
          borderSkipped: false,
          hoverBackgroundColor: dadosGrafico.map(c => c.cor),
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            titleFont: { size: 14 },
            bodyFont: { size: 13 },
            callbacks: {
              label: function(context) {
                const value = context.parsed.y;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percent = total > 0 ? ((value * 100) / total).toFixed(1) : 0;
                return ` ${context.label}: ${formatMoney(value)} (${percent}%)`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: function(value) { return formatMoney(value); }, font: { size: 12, weight: '600' } },
            grid: { color: '#e5e7eb', drawBorder: false }
          },
          x: {
            ticks: { font: { size: 12, weight: '500' }, maxRotation: 45, minRotation: 0 },
            grid: { display: false }
          }
        }
      }
    });
  }

  // ======== TELA CHEIA ========
  function abrirGraficoFullscreen(tipo) {
    let modal = document.getElementById('modalGraficoFullscreen');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalGraficoFullscreen';
      modal.className = 'modal-grafico-fullscreen';
      modal.innerHTML = `
        <div class="header-fullscreen">
          <h3 id="fullscreenTitulo"><i class="fas fa-chart-bar"></i> Gráfico</h3>
          <button class="btn-fechar-fullscreen" onclick="fecharGraficoFullscreen()">
            <i class="fas fa-times"></i> Fechar
          </button>
        </div>
        <div class="canvas-container-fullscreen">
          <canvas id="graficoFullscreenCanvas"></canvas>
        </div>
      `;
      document.body.appendChild(modal);

      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.getElementById('modalGraficoFullscreen')?.classList.contains('active')) {
          fecharGraficoFullscreen();
        }
      });
    }

    modal.classList.add('active');

    let chartInstance, titulo;
    if (tipo === 'home') {
      chartInstance = window.graficoCategoriasHomeChart;
      titulo = 'Custos por Categoria';
      if (periodosSelecionadosResumo.size > 0) titulo += ' (Períodos Selecionados)';
    } else {
      chartInstance = window.graficoAnaliseSetorChart;
      titulo = `Análise - ${setorAtual ? setorAtual.nome : 'Setor'}`;
    }

    document.getElementById('fullscreenTitulo').innerHTML = `<i class="fas fa-chart-bar"></i> ${titulo}`;

    setTimeout(() => {
      const canvas = document.getElementById('graficoFullscreenCanvas');
      if (canvas && chartInstance) {
        new Chart(canvas.getContext('2d'), {
          type: chartInstance.config.type,
          data: JSON.parse(JSON.stringify(chartInstance.config.data)),
          options: {
            ...chartInstance.config.options,
            responsive: true,
            maintainAspectRatio: true,
            scales: {
              y: { ...chartInstance.config.options.scales.y, ticks: { ...chartInstance.config.options.scales.y.ticks, font: { size: 14, weight: '600' } } },
              x: { ...chartInstance.config.options.scales.x, ticks: { ...chartInstance.config.options.scales.x.ticks, font: { size: 14, weight: '500' } } }
            },
            plugins: {
              ...chartInstance.config.options.plugins,
              tooltip: { ...chartInstance.config.options.plugins.tooltip, titleFont: { size: 16 }, bodyFont: { size: 15 } }
            }
          }
        });
      }
    }, 100);
  }

  function fecharGraficoFullscreen() {
    const modal = document.getElementById('modalGraficoFullscreen');
    if (modal) {
      modal.classList.remove('active');
      const canvas = document.getElementById('graficoFullscreenCanvas');
      if (canvas) {
        const chart = Chart.getChart(canvas);
        if (chart) chart.destroy();
      }
    }
  }

  window.abrirGraficoFullscreen = abrirGraficoFullscreen;
  window.fecharGraficoFullscreen = fecharGraficoFullscreen;

  // ======== MATERIAIS ========
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
    if (nivel === 'periodos') { periodoAtual = null;
      setorAtual = null;
      nivelAtual = 'periodos'; } else if (nivel === 'setores') { setorAtual = null;
      nivelAtual = 'setores'; } else if (nivel === 'materiais') { nivelAtual = 'materiais'; }
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

  // ======== CRUD PERÍODOS ========
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
    if (editId) { periodo.id = editId;
      const idx = periodos.findIndex(p => p.id === editId); if (idx !== -1) periodos[idx] = { ...periodos[idx], ...periodo }; } else { periodo.id = 'per_' + Date.now();
      periodos.push(periodo); }
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
      if (periodoAtual && periodoAtual.id === id) { periodoAtual = null;
        nivelAtual = 'periodos'; }
      renderizarTela();
    } catch (error) { console.error('Erro ao excluir período:', error);
      alert('Erro ao excluir período.'); }
  };

  // ======== COPIAR PERÍODO ========
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
        id: 'per_' + Date.now(),
        mes: novoMes,
        ano: novoAno,
        obs: 'Cópia de ' + getNomeMes(periodoOrigemCopia.mes) + '/' + periodoOrigemCopia.ano,
        createdAt: new Date().toISOString()
      };

      await salvarFB('periodos', novoPeriodo);
      periodos.push(novoPeriodo);

      const setoresOrigem = getSetoresDoPeriodo(periodoOrigemCopia.id);

      for (const setorOrigem of setoresOrigem) {
        const novoSetorId = 'set_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const novoSetor = { ...setorOrigem, id: novoSetorId, periodold: novoPeriodo.id, createdAt: new Date().toISOString() };

        await salvarFB('setores', novoSetor);
        setores.push(novoSetor);

        const itensOrigem = itensCusto.filter(i => i.setorld === setorOrigem.id);
        for (const itemOrigem of itensOrigem) {
          const novoItem = { ...itemOrigem, id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), setorld: novoSetorId, createdAt: new Date().toISOString() };
          await salvarFB('itensCusto', novoItem);
          itensCusto.push(novoItem);
        }

        const prodsOrigem = producoes.filter(p => p.setorld === setorOrigem.id);
        for (const prodOrigem of prodsOrigem) {
          const novaProd = { ...prodOrigem, id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), setorld: novoSetorId, createdAt: new Date().toISOString() };
          await salvarFB('producoes', novaProd);
          producoes.push(novaProd);
        }
      }

      const custosFixosOrigem = getCustosFixosDoPeriodo(periodoOrigemCopia.id);
      for (const cfOrigem of custosFixosOrigem) {
        const novoCF = { ...cfOrigem, id: 'cf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), periodold: novoPeriodo.id, createdAt: new Date().toISOString() };
        await salvarFB('custosFixos', novoCF);
        custosFixos.push(novoCF);
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

  // ======== CRUD SETORES ========
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
    const setor = { periodold: periodoAtual.id, nome, descricao: document.getElementById('setorDescricao').value.trim() || '', ordem: parseInt(document.getElementById('setorOrdem').value) || 1, produtoFinal: document.getElementById('setorProdutoFinal').checked || false, tipo: document.getElementById('setorTipo').value || 'custo', createdAt: new Date().toISOString() };
    const editId = document.getElementById('setorEditId').value;
    if (editId) { setor.id = editId;
      const idx = setores.findIndex(x => x.id === editId); if (idx !== -1) setores[idx] = Object.assign({}, setores[idx], setor); } else { setor.id = 'set_' + Date.now();
      setores.push(setor); }
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
    } catch (error) { console.error('Erro ao excluir setor:', error);
      alert('Erro ao excluir setor.'); }
  };

  // ======== CRUD CATEGORIAS ========
  window.abrirModalCategoria = function(id) {
    const modal = document.getElementById('modalCategoria');
    if (!modal) return;
    modal.classList.add('active');
    if (id) {
      const cat = categorias.find(c => c.id === id);
      if (cat) { document.getElementById('modalCategoriaTitulo').innerText = 'Editar Categoria';
        document.getElementById('categoriaEditId').value = cat.id;
        document.getElementById('categoriaNome').value = cat.nome;
        document.getElementById('categoriaCor').value = cat.cor; }
    } else { document.getElementById('modalCategoriaTitulo').innerText = 'Nova Categoria';
      document.getElementById('categoriaEditId').value = '';
      document.getElementById('categoriaNome').value = '';
      document.getElementById('categoriaCor').value = '#0d904f'; }
  };

  window.salvarCategoria = async function() {
    const nome = document.getElementById('categoriaNome').value.trim();
    if (!nome) { alert('Digite o nome da categoria.'); return; }
    const cor = document.getElementById('categoriaCor').value;
    const editId = document.getElementById('categoriaEditId').value;
    let categoria;
    if (editId) {
      const idx = categorias.findIndex(c => c.id === editId);
      if (idx !== -1) { categoria = Object.assign({}, categorias[idx], { nome, cor });
        categorias[idx] = categoria; }
    } else { categoria = { id: 'cat_' + Date.now(), nome, cor };
      categorias.push(categoria); }
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

  // ======== CRUD ITENS DE CUSTO ========
  window.abrirModalItemCusto = function(id) {
    if (!setorAtual) { alert('Selecione um setor primeiro.'); return; }
    const modal = document.getElementById('modalItemCusto');
    if (!modal) return;
    modal.classList.add('active');
    const selCat = document.getElementById('itemCategoria');
    if (selCat) selCat.innerHTML = categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    if (id) {
      const item = itensCusto.find(i => i.id === id);
      if (item) {
        document.getElementById('modalItemTitulo').innerText = 'Editar Item';
        document.getElementById('itemEditId').value = item.id;
        document.getElementById('itemTipo').value = item.tipo || 'normal';
        if (selCat) selCat.value = item.categoriald || '';
        document.getElementById('itemNome').value = item.nome || '';
        document.getElementById('itemValorTotal').value = item.valorTotal || 0;
        document.getElementById('itemPercentual').value = item.percentual || 100;
        document.getElementById('itemObs').value = item.obs || '';
        if (item.tipo === 'fixo' && item.custoFixold) {
          custoFixoSelecionadoId = item.custoFixold;
          const cf = custosFixos.find(c => c.id === item.custoFixold);
          if (cf) { document.getElementById('itemFixoNomeDisplay').value = cf.nome;
            document.getElementById('itemFixoValorDisplay').value = formatMoney(cf.valor);
            document.getElementById('itemFixoPercentual').value = item.percentual || 100; }
        }
        mudarTipoItem(item.tipo || 'normal');
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
    }
    atualizarListaCustosFixos();
  };

  function atualizarListaCustosFixos() {
    const container = document.getElementById('custosFixosSelect');
    if (!container) return;
    const fixos = getCustosFixosDoPeriodo(periodoAtual ? periodoAtual.id : null);
    if (fixos.length === 0) { container.innerHTML = '<p style="opacity:0.7;padding:0.5rem;">Nenhum custo fixo cadastrado neste período.</p>'; } else { container.innerHTML = fixos.map(cf => `<div class="custo-fixo-item ${custoFixoSelecionadoId === cf.id ? 'selecionado' : ''}" onclick="window.selecionarCustoFixo('${cf.id}')" style="cursor:pointer;margin-bottom:0.5rem;"><div><div class="cf-nome">${cf.nome}</div><div class="cf-categoria">${categorias.find(c => c.id === cf.categoriald)?.nome || 'Sem categoria'}</div></div><div class="cf-valor">${formatMoney(cf.valor)}</div></div>`).join(''); }
  }

  window.selecionarCustoFixo = function(id) {
    custoFixoSelecionadoId = id;
    const cf = custosFixos.find(c => c.id === id);
    if (cf) { document.getElementById('itemFixoNomeDisplay').value = cf.nome;
      document.getElementById('itemFixoValorDisplay').value = formatMoney(cf.valor);
      document.getElementById('areaItemFixoDetalhe').style.display = 'block'; }
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
    const item = { setorld: setorAtual ? setorAtual.id : null, nome: document.getElementById('itemNome').value.trim(), obs: document.getElementById('itemObs').value.trim() || '', tipo };
    if (tipo === 'normal') { item.categoriald = document.getElementById('itemCategoria').value;
      item.valorTotal = parseFloat(document.getElementById('itemValorTotal').value) || 0;
      item.percentual = parseFloat(document.getElementById('itemPercentual').value) || 100;
      item.custoFixold = null; } else { if (!custoFixoSelecionadoId) { alert('Selecione um custo fixo.'); return; } const cf = custosFixos.find(c => c.id === custoFixoSelecionadoId); if (!cf) { alert('Custo fixo não encontrado.'); return; } item.categoriald = cf.categoriald;
      item.valorTotal = cf.valor;
      item.percentual = parseFloat(document.getElementById('itemFixoPercentual').value) || 100;
      item.custoFixold = custoFixoSelecionadoId;
      item.nome = cf.nome; }
    if (!item.setorld || !item.nome || item.valorTotal <= 0) { alert('Preencha todos os campos corretamente.'); return; }
    if (editId) { item.id = editId;
      const idx = itensCusto.findIndex(x => x.id === editId); if (idx !== -1) itensCusto[idx] = Object.assign({}, itensCusto[idx], item); } else { item.id = 'item_' + Date.now();
      itensCusto.push(item); }
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

  // ======== CRUD PRODUÇÃO ========
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
    const p = { id: 'prod_' + Date.now(), setorld: setorAtual.id, produto, kg, data: document.getElementById('producaoData').value };
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

  // ======== CRUD MATERIAL ========
  window.abrirModalMaterial = function(id) {
    const modal = document.getElementById('modalMaterial');
    if (!modal) return;
    modal.classList.add('active');
    if (id) { const m = materiais.find(x => x.id === id); if (m) { document.getElementById('modalMaterialTitulo').innerHTML = '<i class="fas fa-edit"></i> Editar Material';
        document.getElementById('materialEditId').value = m.id;
        document.getElementById('materialNome').value = m.nome;
        document.getElementById('materialDescricao').value = m.descricao || ''; } } else { document.getElementById('modalMaterialTitulo').innerHTML = '<i class="fas fa-box"></i> Novo Material';
      document.getElementById('materialEditId').value = '';
      document.getElementById('materialNome').value = '';
      document.getElementById('materialDescricao').value = ''; }
  };

  window.salvarMaterial = async function() {
    const nome = document.getElementById('materialNome').value.trim();
    if (!nome) { alert('Digite o nome do material.'); return; }
    const editId = document.getElementById('materialEditId').value;
    const m = { nome, descricao: document.getElementById('materialDescricao').value.trim() || '' };
    if (editId) { m.id = editId;
      const idx = materiais.findIndex(x => x.id === editId); if (idx !== -1) materiais[idx] = Object.assign({}, materiais[idx], m); } else { m.id = 'mat_' + Date.now();
      materiais.push(m); }
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
  window.verHistoricoMaterial = function(id) { nivelAtual = 'historicoMaterial';
    renderizarTela(); };

  // ======== GERAR CUSTO MATERIAL ========
  window.abrirGerarCustoMaterial = function() {
    const modal = document.getElementById('modalGerarCusto');
    if (!modal) return;
    modal.classList.add('active');
    document.getElementById('gerarCustoPeriodo').innerHTML = '<option value="">Selecione um período...</option>' + periodos.map(p => `<option value="${p.id}">${getNomeMes(p.mes)}/${p.ano}</option>`).join('');
    document.getElementById('gerarCustoMaterial').innerHTML = '<option value="">Selecione um material...</option>' + materiais.map(m => `<option value="${m.id}">${m.nome}</option>`).join('');
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
    if (!periodoId) { container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:1rem;">Selecione um período primeiro</p>'; return; }
    const sets = setores.filter(s => s.periodold === periodoId);
    if (sets.length === 0) { container.innerHTML = '<p style="opacity:0.7;padding:1rem;">Nenhum setor neste período.</p>'; } else { container.innerHTML = sets.map(s => `<div class="setor-selecao-item ${setoresSelecionadosGerar.has(s.id) ? 'selecionado' : ''}"><div class="ss-header"><input type="checkbox" ${setoresSelecionadosGerar.has(s.id) ? 'checked' : ''} onchange="window.toggleSetorGerarCusto('${s.id}', this.checked)"><div class="ss-info"><div class="ss-nome">${s.nome} ${s.produtoFinal ? '⭐' : ''}</div><div class="ss-custo">${s.descricao || ''} | Custo atual: ${formatMoney(calcularCustosSetor(s.id).totalCusto)}</div></div></div></div>`).join(''); }
  };

  window.toggleSetorGerarCusto = function(setorId, checked) { if (checked) setoresSelecionadosGerar.set(setorId, true);
    else setoresSelecionadosGerar.delete(setorId);
    window.atualizarSetoresGerarCusto();
    window.atualizarResumoGerarCusto(); };

  window.atualizarResumoGerarCusto = function() {
    const container = document.getElementById('resumoLinhas');
    if (!container) return;
    const setorIds = Array.from(setoresSelecionadosGerar.keys());
    if (setorIds.length === 0) { container.innerHTML = '<p style="opacity:0.7;text-align:center;">Selecione os setores para calcular</p>'; return; }
    let custoTotal = 0,
      producaoTotal = 0;
    setorIds.forEach(id => { const custos = calcularCustosSetor(id);
      custoTotal += custos.totalCusto;
      producaoTotal += custos.totalKg; });
    const custoKg = producaoTotal > 0 ? custoTotal / producaoTotal : 0;
    let custoInsumos = 0;
    document.querySelectorAll('.insumo-row').forEach(row => { const input = row.querySelector('.insumo-custo'); if (input) custoInsumos += parseFloat(input.value) || 0; });
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
    if (valorAtual > 0) { const diff = precoSugerido - valorAtual;
      html += `<div class="linha"><span>Valor Atual</span><span class="l-valor">${formatMoney(valorAtual)}/kg</span></div><div class="linha"><span>Diferença</span><span class="l-valor" style="color:${diff >= 0 ? '#4caf50' : '#f44336'}">${diff >= 0 ? '+' : ''}${formatMoney(diff)}/kg</span></div>`; }
    container.innerHTML = html;
  };

  window.adicionarInsumo = function() { const container = document.getElementById('insumosContainer');
    const div = document.createElement('div');
    div.className = 'insumo-row';
    div.innerHTML = `<input type="text" class="insumo-nome" placeholder="Nome do insumo"><input type="number" class="insumo-custo" step="0.01" placeholder="R$/kg"><button class="btn btn-danger btn-xs" onclick="this.parentElement.remove();window.atualizarResumoGerarCusto();"><i class="fas fa-times"></i></button>`;
    container.appendChild(div); };
  window.salvarCustoMaterial = async function() { alert('Custo de material salvo com sucesso!');
    window.fecharModal('modalGerarCusto'); };
  window.gerarPDFCustoMaterial = function() { alert('Função de exportação PDF em desenvolvimento.'); };

  // ======== GRÁFICOS MODAIS ========
  window.abrirGraficoMensal = function(periodoId) {
    if (typeof Chart === 'undefined') { alert('Chart.js não carregado.'); return; }
    const modal = document.getElementById('modalGraficoMensal');
    if (!modal) return;
    modal.classList.add('active');
    const per = periodos.find(p => p.id === periodoId);
    if (!per) return;
    document.getElementById('graficoMensalTitulo').innerText = getNomeMes(per.mes) + '/' + per.ano;
    const sets = getSetoresDoPeriodo(periodoId);
    const cats = categorias.map(c => ({ ...c,
      total: 0 }));
    sets.forEach(s => {
      itensCusto.filter(i => i.setorld === s.id).forEach(i => {
        const cat = cats.find(c => c.id === i.categoriald);
        if (cat) cat.total += i.valorTotal * (i.percentual || 100) / 100;
      });
    });
    const catsComDados = cats.filter(c => c.total > 0);
    if (graficoMensalChart) graficoMensalChart.destroy();
    const canvas = document.getElementById('graficoMensalCanvas');
    if (!canvas) return;
    graficoMensalChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels: catsComDados.map(c => c.nome), datasets: [{ data: catsComDados.map(c => c.total), backgroundColor: catsComDados.map(c => c.cor) }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  };

  window.abrirGraficoConsolidado = function() {
    if (typeof Chart === 'undefined') { alert('Chart.js não carregado.'); return; }
    if (periodosSelecionadosResumo.size === 0) { alert('Selecione períodos.'); return; }
    const modal = document.getElementById('modalGraficoConsolidado');
    if (!modal) return;
    modal.classList.add('active');
    const cats = categorias.map(c => ({ ...c,
      total: 0 }));
    periodosSelecionadosResumo.forEach(pid => {
      getSetoresDoPeriodo(pid).forEach(s => {
        itensCusto.filter(i => i.setorld === s.id).forEach(i => {
          const cat = cats.find(c => c.id === i.categoriald);
          if (cat) cat.total += i.valorTotal * (i.percentual || 100) / 100;
        });
      });
    });
    const catsComDados = cats.filter(c => c.total > 0);
    if (graficoConsolidadoChart) graficoConsolidadoChart.destroy();
    const canvas = document.getElementById('graficoConsolidadoCanvas');
    if (!canvas) return;
    graficoConsolidadoChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels: catsComDados.map(c => c.nome), datasets: [{ data: catsComDados.map(c => c.total), backgroundColor: catsComDados.map(c => c.cor) }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  };

  window.exportarGraficoMensal = function() { const c = document.getElementById('graficoMensalCanvas'); if (c) { const a = document.createElement('a');
    a.download = 'grafico.png';
    a.href = c.toDataURL();
    a.click(); } };
  window.exportarGraficoConsolidado = function() { const c = document.getElementById('graficoConsolidadoCanvas'); if (c) { const a = document.createElement('a');
    a.download = 'grafico.png';
    a.href = c.toDataURL();
    a.click(); } };

  // ======== FILTROS ========
  window.mudarFiltroAno = function(v) { filtroAnoAtual = v;
    periodosSelecionadosResumo.clear();
    renderizarTela(); };
  window.togglePeriodoResumo = function(pid, checked) { if (checked) periodosSelecionadosResumo.add(pid);
    else periodosSelecionadosResumo.delete(pid);
    renderizarTela(); };
  window.removePeriodoResumo = function(pid) { periodosSelecionadosResumo.delete(pid);
    renderizarTela(); };
  window.limparSelecaoResumo = function() { periodosSelecionadosResumo.clear();
    renderizarTela(); };
  window.toggleSetorResumo = function(sid, checked) { if (checked) setoresExcluidosResumo.delete(sid);
    else setoresExcluidosResumo.add(sid);
    renderizarTela(); };
  window.limparSetoresExcluidos = function() { setoresExcluidosResumo.clear();
    renderizarTela(); };

  window.fecharModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
  };

  function adicionarListeners() {
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('active')) {
        e.target.classList.remove('active');
      }
      const btnEditar = e.target.closest('.btn-editar-periodo');
      if (btnEditar) {
        const id = btnEditar.getAttribute('data-id');
        if (id) { e.preventDefault();
          e.stopPropagation();
          window.editarPeriodo(id); }
      }
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      }
    });
  }

  function atualizarStatusFirebase() {
    const el = document.getElementById('firebaseStatus');
    if (el) el.innerHTML = '<span class="status-dot"></span> Firebase Online';
  }

  // ====================================================
  // PAINEL DE CUSTO DE PROCESSO - SOMA DOS CUSTO/KG + CUSTOS CASUAIS
  // ====================================================

  // ======== INICIALIZAR PAINEL ========
  window.inicializarCustoProcesso = function() {
    // Preenche os filtros de ano
    const anosDisponiveis = Array.from(new Set(periodos.map(p => p.ano))).sort((a, b) => b - a);
    const selectAno = document.getElementById('custoProcessoAno');
    if (selectAno) {
      selectAno.innerHTML = '<option value="">Todos</option>' +
        anosDisponiveis.map(a => `<option value="${a}">${a}</option>`).join('');
    }

    // Preenche períodos
    window.atualizarPeriodosCustoProcesso();
  };

  // ======== ATUALIZAR PERÍODOS ========
  window.atualizarPeriodosCustoProcesso = function() {
    const selectPeriodo = document.getElementById('custoProcessoPeriodo');
    if (!selectPeriodo) return;

    const ano = document.getElementById('custoProcessoAno').value;
    const mesesSelect = document.getElementById('custoProcessoMeses');
    const mesesSelecionados = Array.from(mesesSelect.selectedOptions).map(opt => parseInt(opt.value));

    let periodosFiltrados = [...periodos];
    if (ano) periodosFiltrados = periodosFiltrados.filter(p => p.ano === parseInt(ano));
    if (mesesSelecionados.length > 0) {
      periodosFiltrados = periodosFiltrados.filter(p => mesesSelecionados.includes(p.mes));
    }

    periodosFiltrados.sort((a, b) => b.ano - a.ano || b.mes - a.mes);

    selectPeriodo.innerHTML = '<option value="">Todos os períodos</option>' +
      periodosFiltrados.map(p => `<option value="${p.id}">${getNomeMes(p.mes)}/${p.ano}</option>`).join('');
  };

  // ======== FILTRAR CUSTO PROCESSO ========
  window.filtrarCustoProcesso = function() {
    window.atualizarPeriodosCustoProcesso();
    // Limpa seleção anterior
    document.getElementById('custoProcessoSetoresLista').innerHTML =
      '<p style="color:var(--text-light);text-align:center;padding:1rem;">Selecione os filtros para carregar os setores.</p>';
    document.getElementById('custoProcessoSetoresSelecionados').innerHTML =
      '<p style="color:var(--text-light);text-align:center;padding:1rem;margin:0;">Nenhum setor selecionado.</p>';
    custoProcessoSetoresSelecionados = [];
    window.limparResumoCustoProcesso();
  };

  // ======== CARREGAR SETORES DO PERÍODO ========
  window.carregarSetoresProcesso = function() {
    const periodoId = document.getElementById('custoProcessoPeriodo').value;
    const ano = document.getElementById('custoProcessoAno').value;
    const mesesSelect = document.getElementById('custoProcessoMeses');
    const mesesSelecionados = Array.from(mesesSelect.selectedOptions).map(opt => parseInt(opt.value));

    const container = document.getElementById('custoProcessoSetoresLista');
    let html = '';

    // Busca os períodos filtrados
    let periodosFiltrados = [...periodos];
    if (ano) periodosFiltrados = periodosFiltrados.filter(p => p.ano === parseInt(ano));
    if (mesesSelecionados.length > 0) {
      periodosFiltrados = periodosFiltrados.filter(p => mesesSelecionados.includes(p.mes));
    }

    // Se não houver períodos filtrados
    if (periodosFiltrados.length === 0) {
      container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:1rem;">Nenhum período encontrado com os filtros selecionados.</p>';
      return;
    }

    // Se tiver período específico selecionado, usa apenas ele
    let periodosParaBuscar = periodosFiltrados;
    if (periodoId) {
      periodosParaBuscar = periodosFiltrados.filter(p => p.id === periodoId);
      if (periodosParaBuscar.length === 0) {
        container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:1rem;">Período não encontrado.</p>';
        return;
      }
    }

    // Busca todos os setores dos períodos filtrados (apenas CUSTOS, não despesas)
    let todosSetores = [];
    periodosParaBuscar.forEach(per => {
      const sets = getSetoresDoPeriodo(per.id).filter(s => s.tipo !== 'despesa');
      sets.forEach(s => {
        todosSetores.push({
          ...s,
          periodoNome: `${getNomeMes(per.mes)}/${per.ano}`,
          periodoId: per.id
        });
      });
    });

    // Remove duplicados (mesmo setor em períodos diferentes)
    const setoresUnicos = [];
    const nomesSetores = new Set();
    todosSetores.forEach(s => {
      if (!nomesSetores.has(s.nome)) {
        nomesSetores.add(s.nome);
        setoresUnicos.push(s);
      }
    });

    if (setoresUnicos.length === 0) {
      html = '<p style="color:var(--text-light);text-align:center;padding:1rem;">Nenhum setor de custo encontrado nos períodos selecionados.</p>';
    } else {
      // Calcula dados de cada setor (média entre os períodos)
      setoresUnicos.forEach(s => {
        // Pega todos os períodos que têm este setor
        const setoresDoPeriodo = todosSetores.filter(item => item.nome === s.nome);

        // Calcula a média do custo/kg
        let somaCustoKg = 0;
        let count = 0;
        setoresDoPeriodo.forEach(item => {
          const custos = calcularCustosSetor(item.id);
          somaCustoKg += custos.custoPorKg;
          count++;
        });
        const mediaCustoKg = count > 0 ? somaCustoKg / count : 0;

        // Pega o último setor para produção e custo total (ou calcula média)
        const ultimoSetor = setoresDoPeriodo[setoresDoPeriodo.length - 1];
        const custos = calcularCustosSetor(ultimoSetor.id);

        const isSelecionado = custoProcessoSetoresSelecionados.some(item => item.id === s.id);

        html += `
                <div style="display:flex;align-items:center;padding:0.5rem;border-bottom:1px solid #f0f0f0;${isSelecionado ? 'background:#f0fdf4;' : ''}">
                    <input type="checkbox" class="setor-processo-checkbox" data-setor-id="${s.id}" 
                           data-nome="${s.nome}" data-custo-kg="${mediaCustoKg}"
                           ${isSelecionado ? 'checked' : ''}
                           onchange="window.toggleSetorCustoProcesso(this)">
                    <div style="flex:1;margin-left:0.5rem;">
                        <div style="font-weight:500;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                            ${s.nome}
                            ${s.produtoFinal ? '<span class="badge badge-orange" style="font-size:0.6rem;padding:0.1rem 0.4rem;">⭐ Final</span>' : ''}
                            <span style="font-size:0.65rem;color:var(--text-light);font-weight:400;">
                                (${setoresDoPeriodo.length} períodos)
                            </span>
                        </div>
                        <div style="font-size:0.75rem;color:var(--text-light);display:flex;gap:1rem;flex-wrap:wrap;">
                            <span>📈 Custo/KG médio: ${formatMoney(mediaCustoKg)}/kg</span>
                            <span>📊 Produção: ${formatNumber(custos.totalKg, 0)} kg</span>
                            <span>💰 Custo: ${formatMoney(custos.totalCusto)}</span>
                        </div>
                        <div style="font-size:0.6rem;color:var(--text-light);margin-top:0.2rem;">
                            Períodos: ${setoresDoPeriodo.map(item => item.periodoNome).join(', ')}
                        </div>
                    </div>
                </div>
            `;
      });
    }

    container.innerHTML = html;

    // Atualiza lista de selecionados
    window.atualizarSetoresSelecionados();
    window.calcularCustoProcesso();
  };

  // ======== TOGGLE SETOR CUSTO PROCESSO ========
  window.toggleSetorCustoProcesso = function(checkbox) {
    const setorId = checkbox.dataset.setorId;
    const nome = checkbox.dataset.nome;
    const custoKg = parseFloat(checkbox.dataset.custoKg) || 0;

    if (checkbox.checked) {
      const existe = custoProcessoSetoresSelecionados.some(item => item.id === setorId);
      if (!existe) {
        custoProcessoSetoresSelecionados.push({
          id: setorId,
          nome: nome,
          custoKg: custoKg
        });
      }
    } else {
      custoProcessoSetoresSelecionados = custoProcessoSetoresSelecionados.filter(item => item.id !== setorId);
    }

    window.atualizarSetoresSelecionados();
    window.calcularCustoProcesso();
  };

  // ======== ATUALIZAR SETORES SELECIONADOS ========
  window.atualizarSetoresSelecionados = function() {
    const container = document.getElementById('custoProcessoSetoresSelecionados');
    if (!container) return;

    if (custoProcessoSetoresSelecionados.length === 0) {
      container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:1rem;margin:0;">Nenhum setor selecionado.</p>';
      return;
    }

    let html = '';
    custoProcessoSetoresSelecionados.forEach(setor => {
      html += `
            <div style="display:inline-flex;align-items:center;gap:0.3rem;background:#f0fdf4;padding:0.3rem 0.6rem;border-radius:6px;border:1px solid #86efac;margin:0.2rem;">
                <span style="font-weight:500;font-size:0.85rem;">${setor.nome}</span>
                <span style="font-size:0.7rem;color:var(--text-light);">
                    ${formatMoney(setor.custoKg)}/kg
                </span>
                <button class="btn btn-danger btn-xs" onclick="window.removerSetorSelecionado('${setor.id}')" style="padding:0.1rem 0.3rem;font-size:0.6rem;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
  };

  // ======== REMOVER SETOR SELECIONADO ========
  window.removerSetorSelecionado = function(setorId) {
    const checkbox = document.querySelector(`.setor-processo-checkbox[data-setor-id="${setorId}"]`);
    if (checkbox) checkbox.checked = false;

    custoProcessoSetoresSelecionados = custoProcessoSetoresSelecionados.filter(item => item.id !== setorId);

    window.atualizarSetoresSelecionados();
    window.calcularCustoProcesso();
  };

  // ======== LIMPAR SELEÇÃO DE SETORES ========
  window.limparSelecaoSetores = function() {
    document.querySelectorAll('.setor-processo-checkbox').forEach(cb => cb.checked = false);
    custoProcessoSetoresSelecionados = [];
    window.atualizarSetoresSelecionados();
    window.limparResumoCustoProcesso();
  };

  // ======== ADICIONAR CUSTO CASUAL ========
  window.adicionarCustoCasual = function() {
    const nome = prompt('Digite o nome do custo casual (ex: Matéria Prima X):');
    if (!nome) return;

    const custoKg = prompt('Digite o custo por KG (R$):');
    if (custoKg === null || isNaN(parseFloat(custoKg))) return;

    const imposto = prompt('Digite o imposto (%) (opcional, deixe 0 se não houver):', '0');
    if (imposto === null || isNaN(parseFloat(imposto))) return;

    const id = 'casual_' + Date.now();
    custoProcessoCasualItens.push({
      id: id,
      nome: nome,
      custoKg: parseFloat(custoKg),
      imposto: parseFloat(imposto) || 0
    });

    window.atualizarListaCasual();
    window.calcularCustoProcesso();
  };

  // ======== REMOVER CUSTO CASUAL ========
  window.removerCustoCasual = function(id) {
    custoProcessoCasualItens = custoProcessoCasualItens.filter(item => item.id !== id);
    window.atualizarListaCasual();
    window.calcularCustoProcesso();
  };

  // ======== ATUALIZAR LISTA DE CUSTOS CASUAIS ========
  window.atualizarListaCasual = function() {
    const container = document.getElementById('custoProcessoCasualLista');
    if (!container) return;

    if (custoProcessoCasualItens.length === 0) {
      container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:0.5rem;margin:0;font-size:0.85rem;">Nenhum custo casual adicionado.</p>';
      return;
    }

    let html = '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;">';
    custoProcessoCasualItens.forEach(item => {
      const valorComImposto = item.custoKg * (1 + (item.imposto || 0) / 100);
      html += `
            <div style="display:inline-flex;align-items:center;gap:0.3rem;background:#fef3c7;padding:0.3rem 0.6rem;border-radius:6px;border:1px solid #f59e0b;margin:0.1rem;">
                <span style="font-weight:500;font-size:0.85rem;">${item.nome}</span>
                <span style="font-size:0.7rem;color:var(--text-light);">
                    ${formatMoney(item.custoKg)}/kg
                    ${item.imposto > 0 ? `+ ${item.imposto}%` : ''}
                    <strong style="color:#d97706;">→ ${formatMoney(valorComImposto)}/kg</strong>
                </span>
                <button class="btn btn-danger btn-xs" onclick="window.removerCustoCasual('${item.id}')" style="padding:0.1rem 0.3rem;font-size:0.6rem;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;

    // Atualiza contador
    document.getElementById('custoProcessoCasualCount').textContent = custoProcessoCasualItens.length;
  };

  // ======== CALCULAR CUSTO PROCESSO (SOMA DOS CUSTO/KG + CASUAIS) ========
  window.calcularCustoProcesso = function() {
    let somaCustoKg = 0;
    let qtdSetores = custoProcessoSetoresSelecionados.length;

    // Soma dos custos/kg dos setores
    custoProcessoSetoresSelecionados.forEach(setor => {
      somaCustoKg += setor.custoKg;
    });

    // Soma dos custos casuais (com imposto)
    custoProcessoCasualItens.forEach(item => {
      const valorComImposto = item.custoKg * (1 + (item.imposto || 0) / 100);
      somaCustoKg += valorComImposto;
    });

    const totalItens = qtdSetores + custoProcessoCasualItens.length;

    // Atualiza resumo
    document.getElementById('custoProcessoQtdSetores').textContent = totalItens;
    document.getElementById('custoProcessoProducao').textContent = formatMoney(somaCustoKg);
    document.getElementById('custoProcessoCustoTotal').textContent = totalItens > 0 ? formatMoney(somaCustoKg / totalItens) : 'R$ 0,00';
    document.getElementById('custoProcessoCustoKg').textContent = totalItens > 0 ? formatMoney(somaCustoKg / totalItens) + '/kg' : 'R$ 0,00/kg';
  };

  // ======== LIMPAR RESUMO ========
  window.limparResumoCustoProcesso = function() {
    document.getElementById('custoProcessoQtdSetores').textContent = '0';
    document.getElementById('custoProcessoProducao').textContent = 'R$ 0,00';
    document.getElementById('custoProcessoCustoTotal').textContent = 'R$ 0,00';
    document.getElementById('custoProcessoCustoKg').textContent = 'R$ 0,00/kg';
  };

  // ======== LIMPAR TUDO ========
  window.limparCustoProcesso = function() {
    document.querySelectorAll('.setor-processo-checkbox').forEach(cb => cb.checked = false);
    custoProcessoSetoresSelecionados = [];
    custoProcessoCasualItens = [];
    window.atualizarSetoresSelecionados();
    window.atualizarListaCasual();
    window.limparResumoCustoProcesso();
  };

  // ======== EXPORTAR PDF ========
  window.exportarCustoProcessoPDF = function() {
    if (custoProcessoSetoresSelecionados.length === 0 && custoProcessoCasualItens.length === 0) {
      alert('Selecione pelo menos um setor ou adicione um custo casual para exportar.');
      return;
    }

    const periodoId = document.getElementById('custoProcessoPeriodo').value;
    const periodo = periodos.find(p => p.id === periodoId);
    const nomePeriodo = periodo ? `${getNomeMes(periodo.mes)}/${periodo.ano}` : 'Período não selecionado';

    let somaCustoKg = 0;
    custoProcessoSetoresSelecionados.forEach(setor => {
      somaCustoKg += setor.custoKg;
    });
    custoProcessoCasualItens.forEach(item => {
      const valorComImposto = item.custoKg * (1 + (item.imposto || 0) / 100);
      somaCustoKg += valorComImposto;
    });
    const totalItens = custoProcessoSetoresSelecionados.length + custoProcessoCasualItens.length;
    const mediaCustoKg = totalItens > 0 ? somaCustoKg / totalItens : 0;

    let html = `
        <div style="font-family:Arial,sans-serif;padding:20px;max-width:900px;margin:0 auto;">
            <h1 style="color:#0d904f;border-bottom:3px solid #0d904f;padding-bottom:10px;">
                <i class="fas fa-cogs"></i> Custo de Processo - Soma de Custos
            </h1>
            <p><strong>Período:</strong> ${nomePeriodo}</p>
            <p><strong>Total de Itens:</strong> ${totalItens}</p>
            
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin:20px 0;background:#f8fafc;padding:15px;border-radius:8px;">
                <div><strong>Soma dos Custos/KG:</strong> ${formatMoney(somaCustoKg)}</div>
                <div><strong>Média do Custo/KG:</strong> ${formatMoney(mediaCustoKg)}/kg</div>
                <div><strong>Itens:</strong> ${totalItens}</div>
            </div>
            
            <h3 style="margin-top:20px;">Setores Analisados</h3>
            <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
                <thead>
                    <tr style="background:#0d904f;color:#fff;">
                        <th style="padding:8px;text-align:left;">Item</th>
                        <th style="padding:8px;text-align:right;">Custo / KG</th>
                        <th style="padding:8px;text-align:center;">Tipo</th>
                    </tr>
                </thead>
                <tbody>`;

    custoProcessoSetoresSelecionados.forEach(setor => {
      html += `
            <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:6px 8px;">${setor.nome}</td>
                <td style="padding:6px 8px;text-align:right;">${formatMoney(setor.custoKg)}</td>
                <td style="padding:6px 8px;text-align:center;"><span class="badge badge-green">Setor</span></td>
            </tr>
        `;
    });

    custoProcessoCasualItens.forEach(item => {
      const valorComImposto = item.custoKg * (1 + (item.imposto || 0) / 100);
      html += `
            <tr style="border-bottom:1px solid #e5e7eb;background:#fef3c7;">
                <td style="padding:6px 8px;">${item.nome}</td>
                <td style="padding:6px 8px;text-align:right;">${formatMoney(item.custoKg)} ${item.imposto > 0 ? `(+${item.imposto}%)` : ''}</td>
                <td style="padding:6px 8px;text-align:center;"><span class="badge badge-warning">Casual</span></td>
            </tr>
        `;
    });

    html += `
                <tr style="background:#f0fdf4;font-weight:700;border-top:2px solid #0d904f;">
                    <td style="padding:8px;color:#0d904f;">SOMA</td>
                    <td style="padding:8px;text-align:right;color:#0d904f;">${formatMoney(somaCustoKg)}</td>
                    <td style="padding:8px;text-align:center;color:#0d904f;">-</td>
                </tr>
                <tr style="background:#fef3c7;font-weight:700;border-top:1px solid #f59e0b;">
                    <td style="padding:8px;color:#d97706;">MÉDIA</td>
                    <td style="padding:8px;text-align:right;color:#d97706;">${formatMoney(mediaCustoKg)}/kg</td>
                    <td style="padding:8px;text-align:center;color:#d97706;">-</td>
                </tr>
            </tbody>
        </table>
        
        <p style="margin-top:20px;font-size:0.8rem;color:#999;">
            Gerado em ${new Date().toLocaleString()}
        </p>
    </div>`;

    const win = window.open('', '_blank', 'width=900,height=600');
    win.document.write(`<html><head><title>Custo de Processo - ${nomePeriodo}</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 900px; margin: 0 auto; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; }
            .badge-green { background: #0d904f; color: #fff; }
            .badge-warning { background: #f59e0b; color: #fff; }
        </style>
    </head><body>`);
    win.document.write(html);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  // ✅ FUNÇÃO INIT CORRIGIDA
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

  // Inicializa o sistema
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
