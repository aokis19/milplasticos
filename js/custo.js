// ====================================================
// CUSTO.JS - Central de Custos (Firestore Puro - v2.2)
// Persistência exclusiva no Firebase Firestore
// 100% Cloud - Sem localStorage
// ====================================================
(function() {
  'use strict';

  // ======== INICIALIZAÇÃO DO FIREBASE ========
  const db = window.firebaseDB || window.db;
  if (!db) {
    alert('Firebase não foi inicializado. O sistema não pode funcionar.');
    throw new Error('Firestore indisponível');
  }

  // Ativar persistência offline do Firestore
  db.enablePersistence().catch(err => console.warn('Persistência offline não ativada:', err));

  // Coleções do Firestore
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

  // ======== ESTADO DA APLICAÇÃO (MEMÓRIA) ========
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
  let configCampos = {
    setorNome: 'Nome do Setor',
    setorDesc: 'Descrição',
    custoTotal: 'Custo Total',
    producaoKg: 'Produção (KG)',
    custoPorKg: 'Custo por KG'
  };

  // ======== UTILITÁRIOS ========
  function formatMoney(v) { return 'R$ ' + (v || 0).toFixed(2).replace('.', ','); }
  function formatMoneySimples(v) { return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
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
  
  function calcularCustosSetor(setorld) {
    const itens = itensCusto.filter(i => i.setorld === setorld);
    const totalCusto = itens.reduce((s, i) => s + (i.valorTotal * (i.percentual || 100) / 100), 0);
    const prods = producoes.filter(p => p.setorld === setorld);
    const totalKg = prods.reduce((s, p) => s + p.kg, 0);
    const custoPorKg = totalKg > 0 ? totalCusto / totalKg : 0;
    return { totalCusto, totalKg, custoPorKg, qtdItens: itens.length };
  }
  
  function getCustoPorKgSetor(setorld) {
    const custos = calcularCustosSetor(setorld);
    return custos.totalKg > 0 ? custos.totalCusto / custos.totalKg : 0;
  }
  
  function calcularResumoPeriodo(periodoidParam, excluirSetores) {
    const pid = periodoidParam || (periodoAtual ? periodoAtual.id : null);
    const excluir = excluirSetores || setoresExcluidosResumo;
    if (!pid) return { custoTotalGeral: 0, producaoTotalGeral: 0, custoPorKgGeral: 0, qtdSetores: 0, setoresFinais: [], qtdProdutosFinais: 0 };
    
    const sets = getSetoresDoPeriodo(pid).filter(s => !excluir.has(s.id));
    let custoTotalGeral = 0;
    sets.forEach(s => { custoTotalGeral += calcularCustosSetor(s.id).totalCusto; });
    
    const setsFinais = sets.filter(s => s.produtoFinal === true);
    let producaoTotalGeral = 0;
    const detalhesFinais = [];
    setsFinais.forEach(sf => {
      const custos = calcularCustosSetor(sf.id);
      producaoTotalGeral += custos.totalKg;
      detalhesFinais.push({ setor: sf, custo: custos.totalCusto, producao: custos.totalKg, custoPorKg: custos.custoPorKg });
    });
    
    return {
      custoTotalGeral,
      producaoTotalGeral,
      custoPorKgGeral: producaoTotalGeral > 0 ? custoTotalGeral / producaoTotalGeral : 0,
      qtdSetores: sets.length,
      qtdProdutosFinais: setsFinais.length,
      setoresFinais: detalhesFinais
    };
  }
  
  function calcularResumoConsolidado() {
    if (periodosSelecionadosResumo.size === 0) return null;
    let custoTotal = 0, producaoTotal = 0, qtdSetores = 0;
    periodosSelecionadosResumo.forEach(pid => {
      const resumo = calcularResumoPeriodo(pid, new Set());
      custoTotal += resumo.custoTotalGeral;
      producaoTotal += resumo.producaoTotalGeral;
      qtdSetores += resumo.qtdSetores;
    });
    return {
      custoTotal,
      producaoTotal,
      custoPorKg: producaoTotal > 0 ? custoTotal / producaoTotal : 0,
      qtdSetores,
      qtdPeriodos: periodosSelecionadosResumo.size
    };
  }

  // ======== FUNÇÕES DE PERSISTÊNCIA NO FIRESTORE ========
  async function salvarFB(colecaoNome, dados) {
    try {
      if (!dados.id) {
        dados.id = colecaoNome + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      }
      const ref = colecoes[colecaoNome].doc(dados.id);
      const { id, ...dadosSemId } = dados;
      await ref.set({ ...dadosSemId, id }, { merge: true });
      console.log(`✅ Documento ${dados.id} salvo em ${colecaoNome}`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao salvar em ${colecaoNome}:`, error);
      return false;
    }
  }

  async function excluirFB(colecaoNome, id) {
    try {
      await colecoes[colecaoNome].doc(id).delete();
      console.log(`🗑️ Documento ${id} excluído de ${colecaoNome}`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao excluir ${id} de ${colecaoNome}:`, error);
      return false;
    }
  }

  async function carregarDadosFirebase() {
    console.log('🔄 Carregando dados do Firestore...');
    try {
      const [snapPeriodos, snapSetores, snapCategorias, snapItens, snapProducoes, 
             snapMateriais, snapCustosMat, snapCustosFixos] = await Promise.all([
        colecoes.periodos.get(),
        colecoes.setores.get(),
        colecoes.categorias.get(),
        colecoes.itensCusto.get(),
        colecoes.producoes.get(),
        colecoes.materiais.get(),
        colecoes.custosMateriais.get(),
        colecoes.custosFixos.get()
      ]);

      periodos = snapPeriodos.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setores = snapSetores.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      categorias = snapCategorias.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      itensCusto = snapItens.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      producoes = snapProducoes.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      materiais = snapMateriais.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      custosMateriais = snapCustosMat.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      custosFixos = snapCustosFixos.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Inicializar categorias padrão se necessário
      if (categorias.length === 0) {
        categorias = [
          { id: 'cat1', nome: 'Energia Elétrica', cor: '#f57c00' },
          { id: 'cat2', nome: 'Matéria-Prima', cor: '#0d904f' },
          { id: 'cat3', nome: 'Mão de Obra', cor: '#0277bd' },
          { id: 'cat4', nome: 'Manutenção', cor: '#6a1b9a' },
          { id: 'cat5', nome: 'Insumos', cor: '#c62828' }
        ];
        await Promise.all(categorias.map(c => salvarFB('categorias', c)));
      }

      console.log(`✅ Dados carregados: ${periodos.length} períodos, ${setores.length} setores, ${itensCusto.length} itens`);
    } catch (error) {
      console.error('❌ Erro ao carregar dados do Firestore:', error);
      throw error;
    }
  }

  // ======== CONFIGURAÇÕES DE CAMPOS (100% FIREBASE) ========
  async function carregarConfigCampos() {
    try {
      const doc = await colecoes.configuracoes.doc('custos_configCampos').get();
      
      if (doc.exists && doc.data().config) {
        const saved = doc.data().config;
        if (saved && typeof saved === 'object') {
          configCampos = { ...configCampos, ...saved };
          console.log('✅ Configurações de campos carregadas do Firebase');
        }
      } else {
        console.log('ℹ️ Nenhuma configuração de campos salva - usando padrão');
      }
    } catch (e) {
      console.warn('⚠️ Erro ao carregar configurações do Firebase:', e);
    }
  }

  async function salvarConfigCamposFB() {
    try {
      await colecoes.configuracoes.doc('custos_configCampos').set({
        config: configCampos,
        ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log('✅ Configurações de campos salvas no Firebase');
      return true;
    } catch (e) {
      console.warn('⚠️ Erro ao salvar configurações no Firebase:', e);
      return false;
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
      if (input && input.value.trim()) {
        configCampos[key] = input.value.trim();
      }
    });
    
    await salvarConfigCamposFB(); // ✅ Salva no Firebase
    window.fecharModal('modalConfigCampos');
    renderizarTela();
    alert('Configurações salvas com sucesso!');
  };

  // ======== RENDERIZAÇÃO PRINCIPAL ========
  function renderizarTela() {
    if (nivelAtual === 'periodos') renderizarPeriodos();
    else if (nivelAtual === 'setores') renderizarSetores();
    else if (nivelAtual === 'analise') renderizarAnalise();
    else if (nivelAtual === 'materiais') renderizarMateriais();
    else if (nivelAtual === 'historicoMaterial') renderizarHistoricoMaterial();
    atualizarBreadcrumb();
  }

  // ======== RENDERIZAR PERÍODOS ========
  function renderizarPeriodos() {
    const container = document.getElementById('conteudoDinamico');
    if (!container) return;

    const anosDisponiveis = Array.from(new Set(periodos.map(p => p.ano))).sort((a, b) => b - a);
    const periodosFiltrados = filtroAnoAtual === 'todos' 
      ? [...periodos] 
      : periodos.filter(p => p.ano === parseInt(filtroAnoAtual));
    
    periodosFiltrados.sort((a, b) => b.ano - a.ano || b.mes - a.mes);
    const resumoConsolidado = calcularResumoConsolidado();
    
    let html = '';
    
    // Resumo consolidado
    if (resumoConsolidado) {
      html += `
      <div class="resumo-consolidado">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
          <h3 style="margin:0;"><i class="fas fa-layer-group"></i> Resumo Consolidado</h3>
          <button class="btn btn-purple btn-sm" onclick="window.abrirGraficoConsolidado()"><i class="fas fa-chart-bar"></i> Ver Gráfico</button>
        </div>
        <div class="periodos-selecionados-tags">
          ${Array.from(periodosSelecionadosResumo).map(pid => {
            const per = periodos.find(p => p.id === pid);
            return per ? `<span class="periodo-tag">${getNomeMes(per.mes)}/${per.ano} <span class="remover-tag" onclick="window.removePeriodoResumo('${pid}')">&times;</span></span>` : '';
          }).join('')}
          ${periodosSelecionadosResumo.size > 0 ? '<span class="btn-selecionar-todos" onclick="window.limparSelecaoResumo()">Limpar</span>' : ''}
        </div>
        <div class="stats-grid-resumo">
          <div class="stat-resumo"><div class="sr-valor">${resumoConsolidado.qtdPeriodos}</div><div class="sr-label">Períodos</div></div>
          <div class="stat-resumo"><div class="sr-valor">${resumoConsolidado.qtdSetores}</div><div class="sr-label">Setores</div></div>
          <div class="stat-resumo"><div class="sr-valor">${formatMoney(resumoConsolidado.custoTotal)}</div><div class="sr-label">${configCampos.custoTotal}</div></div>
          <div class="stat-resumo"><div class="sr-valor">${formatNumber(resumoConsolidado.producaoTotal, 0)} kg</div><div class="sr-label">${configCampos.producaoKg}</div></div>
          <div class="stat-resumo destaque"><div class="sr-valor">${formatMoney(resumoConsolidado.custoPorKg)}/kg</div><div class="sr-label">${configCampos.custoPorKg}</div></div>
        </div>
      </div>`;
    }

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

    // Preencher grid de períodos
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
  }

  // ======== RENDERIZAR SETORES ========
  function renderizarSetores() {
    const container = document.getElementById('conteudoDinamico');
    if (!container) return;

    if (!periodoAtual) {
      container.innerHTML = '<div class="card"><p style="text-align:center;padding:2rem;">Selecione um período primeiro.</p></div>';
      return;
    }

    const sets = getSetoresDoPeriodo(periodoAtual.id);
    const resumo = calcularResumoPeriodo(periodoAtual.id);
    
    let html = `
    <div class="card">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-industry"></i> ${configCampos.setorNome} - ${getNomeMes(periodoAtual.mes)}/${periodoAtual.ano}</span>
        <div style="display:flex;gap:0.5rem;align-items:center;">
          <button class="btn btn-primary btn-sm" onclick="window.abrirModalSetor()"><i class="fas fa-plus"></i> Novo Setor</button>
          <button class="btn btn-outline btn-sm" onclick="window.navegarPara('periodos')"><i class="fas fa-arrow-left"></i> Voltar</button>
        </div>
      </div>
      <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;background:#f9f9f9;padding:0.75rem;border-radius:8px;">
        <span><strong>Setores:</strong> ${resumo.qtdSetores}</span>
        <span><strong>${configCampos.custoTotal}:</strong> ${formatMoney(resumo.custoTotalGeral)}</span>
        <span><strong>${configCampos.producaoKg}:</strong> ${formatNumber(resumo.producaoTotalGeral, 0)} kg</span>
        <span><strong>${configCampos.custoPorKg} Médio:</strong> ${formatMoney(resumo.custoPorKgGeral)}/kg</span>
      </div>`;

    if (sets.length === 0) {
      html += '<p style="text-align:center;padding:1rem;">Nenhum setor cadastrado.</p>';
    } else {
      html += '<div class="setores-grid" id="setoresGrid"></div>';
    }

    html += `
      <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button class="btn btn-warning btn-sm" onclick="window.abrirModalCustoFixo()"><i class="fas fa-thumbtack"></i> Novo Custo Fixo</button>
        <button class="btn btn-outline btn-sm" onclick="window.abrirModalCategoria()"><i class="fas fa-tag"></i> Nova Categoria</button>
      </div>
    </div>`;

    container.innerHTML = html;

    if (sets.length > 0) {
      const grid = document.getElementById('setoresGrid');
      if (!grid) return;

      sets.forEach(s => {
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
          </div>`;
        grid.appendChild(div);
      });
    }
  }

  // ======== RENDERIZAR ANÁLISE ========
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
      <div style="display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:1.5rem;">
        <div><strong>${configCampos.custoTotal}:</strong> ${formatMoney(custos.totalCusto)}</div>
        <div><strong>${configCampos.producaoKg}:</strong> ${formatNumber(custos.totalKg, 0)} kg</div>
        <div><strong>${configCampos.custoPorKg}:</strong> ${formatMoney(custos.custoPorKg)}/kg</div>
        <div><strong>Itens:</strong> ${custos.qtdItens}</div>
      </div>
      <h4>Itens de Custo</h4>`;

    if (itens.length === 0) {
      html += '<p>Nenhum item cadastrado.</p>';
    } else {
      html += `
      <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Item</th><th>Categoria</th><th>Valor Total</th><th>% Rateio</th><th>Valor Rateado</th><th>Ações</th></tr></thead>
        <tbody>`;
      itens.forEach(i => {
        const cat = categorias.find(c => c.id === i.categoriald);
        const valorRateado = i.valorTotal * (i.percentual || 100) / 100;
        html += `
        <tr>
          <td>${i.nome} ${i.tipo === 'fixo' ? '<span class="badge badge-orange">Fixo</span>' : ''}</td>
          <td>${cat ? cat.nome : '-'}</td>
          <td>${formatMoney(i.valorTotal)}</td>
          <td>${i.percentual || 100}%</td>
          <td>${formatMoney(valorRateado)}</td>
          <td>
            <button class="btn btn-outline btn-xs" onclick="window.editarItemCusto('${i.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger btn-xs" onclick="window.excluirItemCusto('${i.id}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }

    html += `
      <div style="margin-top:1rem;">
        <button class="btn btn-primary btn-sm" onclick="window.abrirModalItemCusto()"><i class="fas fa-plus"></i> Adicionar Item</button>
      </div>
      <h4 style="margin-top:2rem;">Produção</h4>`;

    if (prods.length === 0) {
      html += '<p>Nenhuma produção registrada.</p>';
    } else {
      html += `
      <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Produto</th><th>KG</th><th>Data</th><th>Ações</th></tr></thead>
        <tbody>`;
      prods.forEach(p => {
        html += `
        <tr>
          <td>${p.produto}</td>
          <td>${formatNumber(p.kg, 0)}</td>
          <td>${p.data || '-'}</td>
          <td><button class="btn btn-danger btn-xs" onclick="window.excluirProducao('${p.id}')"><i class="fas fa-trash"></i></button></td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }

    html += `
      <div style="margin-top:1rem;">
        <button class="btn btn-teal btn-sm" onclick="window.abrirModalProducao()"><i class="fas fa-plus"></i> Registrar Produção</button>
      </div>
    </div>`;

    container.innerHTML = html;
  }

  // ======== RENDERIZAR MATERIAIS ========
  function renderizarMateriais() {
    const container = document.getElementById('conteudoDinamico');
    if (!container) return;

    let html = `
    <div class="card">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-box"></i> Materiais</span>
        <div style="display:flex;gap:0.5rem;">
          <button class="btn btn-outline btn-sm" onclick="window.navegarPara('periodos')"><i class="fas fa-arrow-left"></i> Voltar</button>
          <button class="btn btn-primary btn-sm" onclick="window.abrirModalMaterial()"><i class="fas fa-plus"></i> Novo Material</button>
        </div>
      </div>`;

    if (materiais.length === 0) {
      html += '<p style="text-align:center;padding:1rem;">Nenhum material cadastrado.</p>';
    } else {
      html += `
      <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Nome</th><th>Descrição</th><th>Ações</th></tr></thead>
        <tbody>`;
      materiais.forEach(m => {
        html += `
        <tr>
          <td>${m.nome}</td>
          <td>${m.descricao || '-'}</td>
          <td>
            <button class="btn btn-outline btn-xs" onclick="window.editarMaterial('${m.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger btn-xs" onclick="window.excluirMaterial('${m.id}')"><i class="fas fa-trash"></i></button>
            <button class="btn btn-info btn-xs" onclick="window.verHistoricoMaterial('${m.id}')"><i class="fas fa-history"></i></button>
          </td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  function renderizarHistoricoMaterial() {
    const container = document.getElementById('conteudoDinamico');
    if (!container) return;
    container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-history"></i> Histórico de Custos de Materiais</span>
        <button class="btn btn-outline btn-sm" onclick="window.navegarPara('materiais')"><i class="fas fa-arrow-left"></i> Voltar</button>
      </div>
      <p>Histórico de materiais (em desenvolvimento)</p>
    </div>`;
  }

  // ======== BREADCRUMB ========
  function atualizarBreadcrumb() {
    const bc = document.getElementById('breadcrumb');
    if (!bc) return;
    
    let html = `<span class="breadcrumb-item ${nivelAtual === 'periodos' ? 'active' : ''}" onclick="window.navegarPara('periodos')"><i class="fas fa-home"></i> Home</span>`;
    
    if (periodoAtual) {
      html += `<span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span>
               <span class="breadcrumb-item ${nivelAtual === 'setores' ? 'active' : ''}" onclick="window.navegarPara('setores')">${getNomeMes(periodoAtual.mes)}/${periodoAtual.ano}</span>`;
    }
    
    if (setorAtual) {
      html += `<span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span>
               <span class="breadcrumb-item active">${setorAtual.nome}</span>`;
    }
    
    bc.innerHTML = html;
  }

  // ======== NAVEGAÇÃO ========
  window.navegarPara = function(nivel) {
    if (nivel === 'periodos') {
      periodoAtual = null;
      setorAtual = null;
      nivelAtual = 'periodos';
    } else if (nivel === 'setores') {
      setorAtual = null;
      nivelAtual = 'setores';
    } else if (nivel === 'materiais') {
      nivelAtual = 'materiais';
    }
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
    
    if (editId) {
      periodo.id = editId;
      const idx = periodos.findIndex(p => p.id === editId);
      if (idx !== -1) periodos[idx] = { ...periodos[idx], ...periodo };
    } else {
      periodo.id = 'per_' + Date.now();
      periodos.push(periodo);
    }
    
    await salvarFB('periodos', periodo);
    window.fecharModal('modalPeriodo');
    renderizarTela();
  };

  window.editarPeriodo = function(id) {
    if (!id) return;
    window.abrirModalPeriodo(id);
  };

  window.excluirPeriodo = async function(id) {
    if (!confirm('Excluir período e todos os dados relacionados? Esta ação não pode ser desfeita.')) return;
    
    try {
      const setoresDoPeriodo = setores.filter(s => s.periodold === id);
      for (const s of setoresDoPeriodo) {
        const itensDoSetor = itensCusto.filter(i => i.setorld === s.id);
        const prodsDoSetor = producoes.filter(p => p.setorld === s.id);
        
        await Promise.all([
          ...itensDoSetor.map(i => excluirFB('itensCusto', i.id)),
          ...prodsDoSetor.map(p => excluirFB('producoes', p.id)),
          excluirFB('setores', s.id)
        ]);
        
        itensCusto = itensCusto.filter(i => i.setorld !== s.id);
        producoes = producoes.filter(p => p.setorld !== s.id);
      }
      
      const fixosDoPeriodo = custosFixos.filter(cf => cf.periodold === id);
      await Promise.all(fixosDoPeriodo.map(cf => excluirFB('custosFixos', cf.id)));
      
      setores = setores.filter(s => s.periodold !== id);
      custosFixos = custosFixos.filter(cf => cf.periodold !== id);
      periodos = periodos.filter(p => p.id !== id);
      periodosSelecionadosResumo.delete(id);
      
      await excluirFB('periodos', id);
      
      if (periodoAtual && periodoAtual.id === id) {
        periodoAtual = null;
        nivelAtual = 'periodos';
      }
      
      renderizarTela();
    } catch (error) {
      console.error('Erro ao excluir período:', error);
      alert('Erro ao excluir período. Tente novamente.');
    }
  };

  // ======== CRUD SETORES ========
  window.abrirModalSetor = function(id) {
    if (!periodoAtual) {
      alert('Selecione um período!');
      return;
    }
    
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
    if (!periodoAtual) {
      alert('Nenhum período selecionado!');
      return;
    }
    
    const nome = document.getElementById('setorNome').value.trim();
    if (!nome) {
      alert('Digite o nome!');
      return;
    }
    
    const setor = {
      periodold: periodoAtual.id,
      nome: nome,
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
      setor.id = 'set_' + Date.now();
      setores.push(setor);
    }
    
    await salvarFB('setores', setor);
    window.fecharModal('modalSetor');
    renderizarTela();
  };

  window.editarSetor = function(id) {
    window.abrirModalSetor(id);
  };

  window.excluirSetor = async function(id) {
    if (!confirm('Excluir setor e todos os itens/produções relacionados?')) return;
    
    try {
      const itensDoSetor = itensCusto.filter(i => i.setorld === id);
      const prodsDoSetor = producoes.filter(p => p.setorld === id);
      
      await Promise.all([
        ...itensDoSetor.map(i => excluirFB('itensCusto', i.id)),
        ...prodsDoSetor.map(p => excluirFB('producoes', p.id)),
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
      alert('Erro ao excluir setor. Tente novamente.');
    }
  };

  // ======== CRUD CATEGORIAS ========
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

  window.salvarCategoria = async function() {
    const nome = document.getElementById('categoriaNome').value.trim();
    if (!nome) {
      alert('Digite o nome da categoria.');
      return;
    }
    
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
      categoria = { id: 'cat_' + Date.now(), nome, cor };
      categorias.push(categoria);
    }
    
    await salvarFB('categorias', categoria);
    window.fecharModal('modalCategoria');
    renderizarTela();
  };

  window.editarCategoria = function(id) {
    window.abrirModalCategoria(id);
  };

  window.excluirCategoria = async function(id) {
    if (!confirm('Excluir categoria? Itens que usam esta categoria não serão afetados.')) return;
    categorias = categorias.filter(c => c.id !== id);
    await excluirFB('categorias', id);
    renderizarTela();
  };

  // ======== CRUD CUSTO FIXO ========
  window.abrirModalCustoFixo = function(id) {
    const modal = document.getElementById('modalCustoFixo');
    if (!modal) return;
    
    modal.classList.add('active');
    
    const selPeriodo = document.getElementById('custoFixoPeriodo');
    selPeriodo.innerHTML = '<option value="">Selecione um período...</option>' + 
      periodos.map(p => `<option value="${p.id}">${getNomeMes(p.mes)}/${p.ano}</option>`).join('');
    
    const selCat = document.getElementById('custoFixoCategoria');
    selCat.innerHTML = '<option value="">Selecione uma categoria...</option>' + 
      categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    
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
      document.getElementById('custoFixoPeriodo').value = periodoAtual ? periodoAtual.id : '';
      document.getElementById('custoFixoCategoria').value = categorias[0] ? categorias[0].id : '';
      document.getElementById('custoFixoNome').value = '';
      document.getElementById('custoFixoValor').value = '';
    }
  };

  window.salvarCustoFixo = async function() {
    const periodoId = document.getElementById('custoFixoPeriodo').value;
    const categoriaId = document.getElementById('custoFixoCategoria').value;
    const nome = document.getElementById('custoFixoNome').value.trim();
    const valor = parseFloat(document.getElementById('custoFixoValor').value);
    
    if (!periodoId) { alert('Selecione um período.'); return; }
    if (!categoriaId) { alert('Selecione uma categoria.'); return; }
    if (!nome) { alert('Digite o nome do custo fixo.'); return; }
    if (isNaN(valor) || valor <= 0) { alert('Digite um valor válido.'); return; }
    
    const editId = document.getElementById('custoFixoEditId').value;
    const cf = { periodold: periodoId, categoriald: categoriaId, nome, valor };
    
    if (editId) {
      cf.id = editId;
      const idx = custosFixos.findIndex(x => x.id === editId);
      if (idx !== -1) custosFixos[idx] = Object.assign({}, custosFixos[idx], cf);
    } else {
      cf.id = 'cf_' + Date.now();
      custosFixos.push(cf);
    }
    
    await salvarFB('custosFixos', cf);
    window.fecharModal('modalCustoFixo');
    renderizarTela();
  };

  window.editarCustoFixo = function(id) {
    window.abrirModalCustoFixo(id);
  };

  window.excluirCustoFixo = async function(id) {
    if (!confirm('Excluir custo fixo? Itens que usam este custo fixo não serão afetados.')) return;
    custosFixos = custosFixos.filter(c => c.id !== id);
    await excluirFB('custosFixos', id);
    renderizarTela();
  };

  // ======== CRUD ITENS DE CUSTO ========
  window.abrirModalItemCusto = function(id) {
    if (!setorAtual) {
      alert('Selecione um setor primeiro.');
      return;
    }
    
    const modal = document.getElementById('modalItemCusto');
    if (!modal) return;
    
    modal.classList.add('active');
    
    const selCat = document.getElementById('itemCategoria');
    if (selCat) {
      selCat.innerHTML = categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    }
    
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
          if (cf) {
            document.getElementById('itemFixoNomeDisplay').value = cf.nome;
            document.getElementById('itemFixoValorDisplay').value = formatMoney(cf.valor);
            document.getElementById('itemFixoPercentual').value = item.percentual || 100;
          }
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
      document.getElementById('itemFixoNomeDisplay').value = '';
      document.getElementById('itemFixoValorDisplay').value = '';
      document.getElementById('itemFixoPercentual').value = 100;
      custoFixoSelecionadoId = null;
      mudarTipoItem('normal');
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
             onclick="window.selecionarCustoFixo('${cf.id}')" style="cursor:pointer;margin-bottom:0.5rem;">
          <div>
            <div class="cf-nome">${cf.nome}</div>
            <div class="cf-categoria">${categorias.find(c => c.id === cf.categoriald)?.nome || 'Sem categoria'}</div>
          </div>
          <div class="cf-valor">${formatMoney(cf.valor)}</div>
        </div>
      `).join('');
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
    
    const tabNormal = document.getElementById('tabNormal');
    const tabFixo = document.getElementById('tabFixo');
    if (tabNormal) tabNormal.classList.toggle('active', tipo === 'normal');
    if (tabFixo) tabFixo.classList.toggle('active', tipo === 'fixo');
  }

  window.mudarTipoItem = mudarTipoItem;

  window.salvarItemCusto = async function() {
    const tipo = document.getElementById('itemTipo').value;
    const editId = document.getElementById('itemEditId').value;
    
    const item = {
      setorld: setorAtual ? setorAtual.id : null,
      nome: document.getElementById('itemNome').value.trim(),
      obs: document.getElementById('itemObs').value.trim() || '',
      tipo: tipo
    };
    
    if (tipo === 'normal') {
      item.categoriald = document.getElementById('itemCategoria').value;
      item.valorTotal = parseFloat(document.getElementById('itemValorTotal').value) || 0;
      item.percentual = parseFloat(document.getElementById('itemPercentual').value) || 100;
      item.custoFixold = null;
    } else {
      if (!custoFixoSelecionadoId) {
        alert('Selecione um custo fixo.');
        return;
      }
      const cf = custosFixos.find(c => c.id === custoFixoSelecionadoId);
      if (!cf) { alert('Custo fixo não encontrado.'); return; }
      
      item.categoriald = cf.categoriald;
      item.valorTotal = cf.valor;
      item.percentual = parseFloat(document.getElementById('itemFixoPercentual').value) || 100;
      item.custoFixold = custoFixoSelecionadoId;
      item.nome = cf.nome;
    }
    
    if (!item.setorld) { alert('Selecione um setor primeiro.'); return; }
    if (!item.nome) { alert('Digite o nome do item.'); return; }
    if (item.valorTotal <= 0) { alert('Valor total deve ser maior que zero.'); return; }
    
    if (editId) {
      item.id = editId;
      const idx = itensCusto.findIndex(x => x.id === editId);
      if (idx !== -1) itensCusto[idx] = Object.assign({}, itensCusto[idx], item);
    } else {
      item.id = 'item_' + Date.now();
      itensCusto.push(item);
    }
    
    await salvarFB('itensCusto', item);
    window.fecharModal('modalItemCusto');
    renderizarTela();
  };

  window.editarItemCusto = function(id) {
    window.abrirModalItemCusto(id);
  };

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
    const data = document.getElementById('producaoData').value;
    
    if (!produto) { alert('Digite o produto.'); return; }
    if (!kg || kg <= 0) { alert('Digite uma quantidade válida.'); return; }
    
    const p = {
      id: 'prod_' + Date.now(),
      setorld: setorAtual.id,
      produto,
      kg,
      data
    };
    
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
    const m = {
      nome,
      descricao: document.getElementById('materialDescricao').value.trim() || ''
    };
    
    if (editId) {
      m.id = editId;
      const idx = materiais.findIndex(x => x.id === editId);
      if (idx !== -1) materiais[idx] = Object.assign({}, materiais[idx], m);
    } else {
      m.id = 'mat_' + Date.now();
      materiais.push(m);
    }
    
    await salvarFB('materiais', m);
    window.fecharModal('modalMaterial');
    renderizarTela();
  };

  window.editarMaterial = function(id) {
    window.abrirModalMaterial(id);
  };

  window.excluirMaterial = async function(id) {
    if (!confirm('Excluir material? Os custos de material associados não serão excluídos.')) return;
    materiais = materiais.filter(m => m.id !== id);
    await excluirFB('materiais', id);
    renderizarTela();
  };

  window.verHistoricoMaterial = function(id) {
    nivelAtual = 'historicoMaterial';
    renderizarTela();
  };

  // ======== GERAR CUSTO MATERIAL ========
  window.abrirGerarCustoMaterial = function() {
    const modal = document.getElementById('modalGerarCusto');
    if (!modal) return;
    
    modal.classList.add('active');
    
    const selPeriodo = document.getElementById('gerarCustoPeriodo');
    selPeriodo.innerHTML = '<option value="">Selecione um período...</option>' + 
      periodos.map(p => `<option value="${p.id}">${getNomeMes(p.mes)}/${p.ano}</option>`).join('');
    
    const selMat = document.getElementById('gerarCustoMaterial');
    selMat.innerHTML = '<option value="">Selecione um material...</option>' + 
      materiais.map(m => `<option value="${m.id}">${m.nome}</option>`).join('');
    
    document.getElementById('insumosContainer').innerHTML = `
      <div class="insumo-row">
        <input type="text" class="insumo-nome" placeholder="Nome do insumo">
        <input type="number" class="insumo-custo" step="0.01" placeholder="R$/kg">
        <button class="btn btn-danger btn-xs" onclick="this.parentElement.remove();window.atualizarResumoGerarCusto();"><i class="fas fa-times"></i></button>
      </div>`;
    
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
            <input type="checkbox" ${setoresSelecionadosGerar.has(s.id) ? 'checked' : ''} 
                   onchange="window.toggleSetorGerarCusto('${s.id}', this.checked)">
            <div class="ss-info">
              <div class="ss-nome">${s.nome} ${s.produtoFinal ? '⭐' : ''}</div>
              <div class="ss-custo">${s.descricao || ''} | Custo atual: ${formatMoney(calcularCustosSetor(s.id).totalCusto)}</div>
            </div>
          </div>
        </div>
      `).join('');
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
    
    let html = '<div class="linha"><span>Custo dos Setores</span><span class="l-valor">' + formatMoney(custoKg) + '/kg</span></div>';
    html += '<div class="linha"><span>Insumos Adicionais</span><span class="l-valor">' + formatMoney(custoInsumos) + '/kg</span></div>';
    html += '<div class="linha"><span>Custo Final</span><span class="l-valor">' + formatMoney(custoFinal) + '/kg</span></div>';
    if (imposto > 0) {
      html += '<div class="linha"><span>Imposto (' + imposto + '%)</span><span class="l-valor">' + formatMoney(custoFinal * imposto / 100) + '/kg</span></div>';
    }
    if (margem > 0) {
      html += '<div class="linha"><span>Margem (' + margem + '%)</span><span class="l-valor">' + formatMoney(custoFinal * (1 + imposto / 100) * margem / 100) + '/kg</span></div>';
    }
    html += '<div class="linha total"><span>Preço Sugerido</span><span class="l-valor">' + formatMoney(precoSugerido) + '/kg</span></div>';
    if (valorAtual > 0) {
      const diff = precoSugerido - valorAtual;
      html += '<div class="linha"><span>Valor Atual</span><span class="l-valor">' + formatMoney(valorAtual) + '/kg</span></div>';
      html += '<div class="linha"><span>Diferença</span><span class="l-valor" style="color:' + (diff >= 0 ? '#4caf50' : '#f44336') + '">' + (diff >= 0 ? '+' : '') + formatMoney(diff) + '/kg</span></div>';
    }
    
    container.innerHTML = html;
  };

  window.adicionarInsumo = function() {
    const container = document.getElementById('insumosContainer');
    const div = document.createElement('div');
    div.className = 'insumo-row';
    div.innerHTML = `
      <input type="text" class="insumo-nome" placeholder="Nome do insumo">
      <input type="number" class="insumo-custo" step="0.01" placeholder="R$/kg">
      <button class="btn btn-danger btn-xs" onclick="this.parentElement.remove();window.atualizarResumoGerarCusto();"><i class="fas fa-times"></i></button>`;
    container.appendChild(div);
  };

  window.salvarCustoMaterial = async function() {
    const periodoId = document.getElementById('gerarCustoPeriodo').value;
    const materialId = document.getElementById('gerarCustoMaterial').value;
    
    if (!periodoId || !materialId) {
      alert('Selecione período e material.');
      return;
    }
    
    const setorIds = Array.from(setoresSelecionadosGerar.keys());
    if (setorIds.length === 0) {
      alert('Selecione pelo menos um setor.');
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
    const insumos = [];
    document.querySelectorAll('.insumo-row').forEach(row => {
      const nome = row.querySelector('.insumo-nome')?.value.trim() || '';
      const custo = parseFloat(row.querySelector('.insumo-custo')?.value) || 0;
      custoInsumos += custo;
      if (nome) insumos.push({ nome, custo });
    });
    
    const imposto = parseFloat(document.getElementById('gerarCustoImposto').value) || 0;
    const margem = parseFloat(document.getElementById('gerarCustoMargem').value) || 0;
    const valorAtual = parseFloat(document.getElementById('gerarCustoValorAtual').value) || 0;
    const custoFinal = custoKg + custoInsumos;
    const precoSugerido = custoFinal * (1 + imposto / 100) * (1 + margem / 100);
    
    const periodo = periodos.find(p => p.id === periodoId);
    
    const registro = {
      id: 'cm_' + Date.now(),
      materialld: materialId,
      periodold: periodoId,
      mes: periodo ? periodo.mes : 0,
      ano: periodo ? periodo.ano : 0,
      custoKgFinal: custoFinal,
      subtotal: custoKg,
      imposto,
      valorImposto: custoFinal * imposto / 100,
      margem,
      precoSugerido,
      valorAtual,
      setoresDetalhes: setorIds.map(id => {
        const s = setores.find(x => x.id === id);
        const custos = calcularCustosSetor(id);
        return { id, nome: s ? s.nome : '', custo: custos.totalCusto, producao: custos.totalKg };
      }),
      insumos,
      setoresUtilizados: setorIds,
      createdAt: new Date().toISOString()
    };
    
    custosMateriais.push(registro);
    await salvarFB('custosMateriais', registro);
    alert('Custo de material salvo com sucesso!');
    window.fecharModal('modalGerarCusto');
    renderizarTela();
  };

  window.gerarPDFCustoMaterial = function() {
    alert('Função de exportação PDF em desenvolvimento.');
  };

  // ======== GRÁFICOS ========
  window.abrirGraficoMensal = function(periodoId) {
    if (typeof Chart === 'undefined') {
      alert('Biblioteca de gráficos não carregada. Verifique sua conexão com a internet.');
      console.error('Chart.js não está disponível');
      return;
    }
    
    const modal = document.getElementById('modalGraficoMensal');
    if (!modal) return;
    
    modal.classList.add('active');
    
    const per = periodos.find(p => p.id === periodoId);
    if (!per) return;
    
    document.getElementById('graficoMensalTitulo').innerText = getNomeMes(per.mes) + '/' + per.ano;
    
    const sets = getSetoresDoPeriodo(periodoId);
    const cats = categorias.map(c => Object.assign({}, c, { total: 0 }));
    
    sets.forEach(s => {
      const itens = itensCusto.filter(i => i.setorld === s.id);
      itens.forEach(i => {
        const cat = cats.find(c => c.id === i.categoriald);
        if (cat) cat.total += i.valorTotal * (i.percentual || 100) / 100;
      });
    });
    
    const catsComDados = cats.filter(c => c.total > 0);
    const labels = catsComDados.map(c => c.nome);
    const values = catsComDados.map(c => c.total);
    const colors = catsComDados.map(c => c.cor);
    
    if (graficoMensalChart) {
      graficoMensalChart.destroy();
      graficoMensalChart = null;
    }
    
    const canvas = document.getElementById('graficoMensalCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    graficoMensalChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Custo por Categoria',
          data: values,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { 
            callbacks: { 
              label: function(ctx) { return formatMoney(ctx.raw); } 
            } 
          }
        },
        scales: {
          y: { 
            beginAtZero: true, 
            ticks: { 
              callback: function(value) { return formatMoney(value); } 
            } 
          }
        }
      }
    });
    
    const total = values.reduce((a, b) => a + b, 0);
    let resumoHtml = '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:1rem;">';
    catsComDados.forEach(c => {
      const pct = total > 0 ? (c.total / total * 100).toFixed(1) : 0;
      resumoHtml += `<span style="background:${c.cor};color:white;padding:0.2rem 0.6rem;border-radius:12px;font-size:0.75rem;">${c.nome}: ${formatMoney(c.total)} (${pct}%)</span>`;
    });
    resumoHtml += `<span style="font-weight:600;">Total: ${formatMoney(total)}</span></div>`;
    document.getElementById('graficoMensalResumo').innerHTML = resumoHtml;
  };

  window.abrirGraficoConsolidado = function() {
    if (typeof Chart === 'undefined') {
      alert('Biblioteca de gráficos não carregada. Verifique sua conexão com a internet.');
      console.error('Chart.js não está disponível');
      return;
    }
    
    if (periodosSelecionadosResumo.size === 0) {
      alert('Selecione pelo menos um período para consolidar.');
      return;
    }
    
    const modal = document.getElementById('modalGraficoConsolidado');
    if (!modal) return;
    
    modal.classList.add('active');
    
    const tagsHtml = Array.from(periodosSelecionadosResumo).map(pid => {
      const per = periodos.find(p => p.id === pid);
      return per ? `<span class="periodo-tag">${getNomeMes(per.mes)}/${per.ano}</span>` : '';
    }).join('');
    document.getElementById('graficoConsolidadoTags').innerHTML = tagsHtml;
    
    const cats = categorias.map(c => Object.assign({}, c, { total: 0 }));
    periodosSelecionadosResumo.forEach(pid => {
      const sets = getSetoresDoPeriodo(pid);
      sets.forEach(s => {
        const itens = itensCusto.filter(i => i.setorld === s.id);
        itens.forEach(i => {
          const cat = cats.find(c => c.id === i.categoriald);
          if (cat) cat.total += i.valorTotal * (i.percentual || 100) / 100;
        });
      });
    });
    
    const catsComDados = cats.filter(c => c.total > 0);
    const labels = catsComDados.map(c => c.nome);
    const values = catsComDados.map(c => c.total);
    const colors = catsComDados.map(c => c.cor);
    
    if (graficoConsolidadoChart) {
      graficoConsolidadoChart.destroy();
      graficoConsolidadoChart = null;
    }
    
    const canvas = document.getElementById('graficoConsolidadoCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    graficoConsolidadoChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Custo por Categoria (Consolidado)',
          data: values,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { 
            callbacks: { 
              label: function(ctx) { return formatMoney(ctx.raw); } 
            } 
          }
        },
        scales: {
          y: { 
            beginAtZero: true, 
            ticks: { 
              callback: function(value) { return formatMoney(value); } 
            } 
          }
        }
      }
    });
    
    const total = values.reduce((a, b) => a + b, 0);
    let infoHtml = '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;justify-content:center;">';
    catsComDados.forEach(c => {
      infoHtml += `<span style="background:${c.cor};color:white;padding:0.2rem 0.6rem;border-radius:12px;font-size:0.75rem;">${c.nome}: ${formatMoney(c.total)}</span>`;
    });
    infoHtml += `<span style="font-weight:600;">Total: ${formatMoney(total)}</span></div>`;
    document.getElementById('graficoConsolidadoInfo').innerHTML = infoHtml;
  };

  window.ajustarGrafico = function(tipo, tamanho) {
    const containerId = tipo === 'mensal' ? 'graficoMensalContainer' : 'graficoConsolidadoContainer';
    const infoId = tipo === 'mensal' ? 'graficoMensalTamanho' : 'graficoConsolidadoTamanho';
    const container = document.getElementById(containerId);
    const info = document.getElementById(infoId);
    
    const alturas = { pequeno: 300, medio: 500, grande: 700, telaCheia: window.innerHeight - 200 };
    
    if (container) {
      container.style.height = alturas[tamanho] + 'px';
      container.classList.remove('fullscreen');
    }
    if (info) info.innerText = alturas[tamanho] + 'px';
    
    const chart = tipo === 'mensal' ? graficoMensalChart : graficoConsolidadoChart;
    if (chart) chart.resize();
  };

  window.toggleFullscreenGrafico = function(tipo) {
    const containerId = tipo === 'mensal' ? 'graficoMensalContainer' : 'graficoConsolidadoContainer';
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!container.classList.contains('fullscreen')) {
      container.classList.add('fullscreen');
      container.style.height = '100vh';
      
      if (!container.querySelector('.grafico-fullscreen-close')) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'grafico-fullscreen-close';
        closeBtn.innerHTML = '<i class="fas fa-times"></i> Sair da Tela Cheia';
        closeBtn.onclick = function(e) {
          e.stopPropagation();
          container.classList.remove('fullscreen');
          closeBtn.remove();
          window.ajustarGrafico(tipo, 'medio');
        };
        container.appendChild(closeBtn);
      }
    } else {
      container.classList.remove('fullscreen');
      const closeBtn = container.querySelector('.grafico-fullscreen-close');
      if (closeBtn) closeBtn.remove();
      window.ajustarGrafico(tipo, 'medio');
    }
    
    const chart = tipo === 'mensal' ? graficoMensalChart : graficoConsolidadoChart;
    if (chart) setTimeout(() => chart.resize(), 100);
  };

  window.exportarGraficoMensal = function() {
    const canvas = document.getElementById('graficoMensalCanvas');
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = 'grafico-mensal.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  window.exportarGraficoConsolidado = function() {
    const canvas = document.getElementById('graficoConsolidadoCanvas');
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = 'grafico-consolidado.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // ======== FILTROS E RESUMO ========
  window.mudarFiltroAno = function(v) {
    filtroAnoAtual = v;
    renderizarTela();
  };

  window.togglePeriodoResumo = function(pid, checked) {
    if (checked) periodosSelecionadosResumo.add(pid);
    else periodosSelecionadosResumo.delete(pid);
    renderizarTela();
  };

  window.removePeriodoResumo = function(pid) {
    periodosSelecionadosResumo.delete(pid);
    renderizarTela();
  };

  window.limparSelecaoResumo = function() {
    periodosSelecionadosResumo.clear();
    renderizarTela();
  };

  window.toggleSetorResumo = function(sid, checked) {
    if (checked) setoresExcluidosResumo.delete(sid);
    else setoresExcluidosResumo.add(sid);
    renderizarTela();
  };

  window.limparSetoresExcluidos = function() {
    setoresExcluidosResumo.clear();
    renderizarTela();
  };

  // ======== COPIAR PERÍODO ========
  window.abrirCopiarPeriodo = function(id) {
    const p = periodos.find(x => x.id === id);
    if (!p) return;
    
    periodoOrigemCopia = p;
    document.getElementById('copiarOrigem').value = getNomeMes(p.mes) + '/' + p.ano;
    
    const modal = document.getElementById('modalCopiarPeriodo');
    if (modal) modal.classList.add('active');
  };

  window.copiarPeriodo = async function() {
    if (!periodoOrigemCopia) return;
    
    const novoMes = parseInt(document.getElementById('copiarMes').value);
    const novoAno = parseInt(document.getElementById('copiarAno').value);
    
    if (!novoMes || !novoAno) { alert('Selecione mês e ano válidos.'); return; }
    
    const existe = periodos.find(p => p.mes === novoMes && p.ano === novoAno);
    if (existe) {
      if (!confirm(`Já existe um período para ${getNomeMes(novoMes)}/${novoAno}. Deseja continuar mesmo assim?`)) {
        return;
      }
    }
    
    try {
      const novoPeriodo = {
        id: 'per_' + Date.now(),
        mes: novoMes,
        ano: novoAno,
        obs: 'Cópia de ' + getNomeMes(periodoOrigemCopia.mes) + '/' + periodoOrigemCopia.ano,
        createdAt: new Date().toISOString()
      };
      
      periodos.push(novoPeriodo);
      await salvarFB('periodos', novoPeriodo);
      
      const setoresOrigem = setores.filter(s => s.periodold === periodoOrigemCopia.id);
      
      for (const s of setoresOrigem) {
        const novoSetor = { ...s };
        delete novoSetor._id;
        novoSetor.id = 'set_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        novoSetor.periodold = novoPeriodo.id;
        setores.push(novoSetor);
        await salvarFB('setores', novoSetor);
        
        const itensOrigem = itensCusto.filter(i => i.setorld === s.id);
        for (const i of itensOrigem) {
          const novoItem = { ...i };
          delete novoItem._id;
          novoItem.id = 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
          novoItem.setorld = novoSetor.id;
          itensCusto.push(novoItem);
          await salvarFB('itensCusto', novoItem);
        }
        
        const prodsOrigem = producoes.filter(p => p.setorld === s.id);
        for (const p of prodsOrigem) {
          const novoProd = { ...p };
          delete novoProd._id;
          novoProd.id = 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
          novoProd.setorld = novoSetor.id;
          producoes.push(novoProd);
          await salvarFB('producoes', novoProd);
        }
      }
      
      const fixosOrigem = custosFixos.filter(cf => cf.periodold === periodoOrigemCopia.id);
      for (const cf of fixosOrigem) {
        const novoFixo = { ...cf };
        delete novoFixo._id;
        novoFixo.id = 'cf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        novoFixo.periodold = novoPeriodo.id;
        custosFixos.push(novoFixo);
        await salvarFB('custosFixos', novoFixo);
      }
      
      window.fecharModal('modalCopiarPeriodo');
      periodoOrigemCopia = null;
      renderizarTela();
      alert('Período copiado com sucesso!');
    } catch (error) {
      console.error('Erro ao copiar período:', error);
      alert('Erro ao copiar período. Tente novamente.');
    }
  };

  // ======== FECHAR MODAL ========
  window.fecharModal = function(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    
    modal.classList.remove('active');
    
    if (id === 'modalGraficoMensal' && graficoMensalChart) {
      graficoMensalChart.destroy();
      graficoMensalChart = null;
    }
    if (id === 'modalGraficoConsolidado' && graficoConsolidadoChart) {
      graficoConsolidadoChart.destroy();
      graficoConsolidadoChart = null;
    }
    
    const fullscreenContainer = modal.querySelector('.grafico-container.fullscreen');
    if (fullscreenContainer) {
      fullscreenContainer.classList.remove('fullscreen');
      const closeBtn = fullscreenContainer.querySelector('.grafico-fullscreen-close');
      if (closeBtn) closeBtn.remove();
    }
  };

  // ======== EVENT LISTENERS ========
  function handleModalClick(e) {
    if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('active')) {
      const modalId = e.target.id;
      e.target.classList.remove('active');
      
      if (modalId === 'modalGraficoMensal' && graficoMensalChart) {
        graficoMensalChart.destroy();
        graficoMensalChart = null;
      }
      if (modalId === 'modalGraficoConsolidado' && graficoConsolidadoChart) {
        graficoConsolidadoChart.destroy();
        graficoConsolidadoChart = null;
      }
    }
    
    const target = e.target.closest('.btn-editar-periodo');
    if (target) {
      const id = target.getAttribute('data-id');
      if (id) {
        e.preventDefault();
        e.stopPropagation();
        window.editarPeriodo(id);
      }
    }
  }

  function handleEscapeKey(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(modal => {
        const modalId = modal.id;
        modal.classList.remove('active');
        
        if (modalId === 'modalGraficoMensal' && graficoMensalChart) {
          graficoMensalChart.destroy();
          graficoMensalChart = null;
        }
        if (modalId === 'modalGraficoConsolidado' && graficoConsolidadoChart) {
          graficoConsolidadoChart.destroy();
          graficoConsolidadoChart = null;
        }
      });
    }
  }

  function adicionarListeners() {
    document.removeEventListener('click', handleModalClick);
    document.removeEventListener('keydown', handleEscapeKey);
    
    document.addEventListener('click', handleModalClick);
    document.addEventListener('keydown', handleEscapeKey);
  }

  // ======== STATUS FIREBASE ========
  function atualizarStatusFirebase() {
    const statusEl = document.getElementById('firebaseStatus');
    if (statusEl) {
      statusEl.innerHTML = '<span class="status-dot"></span> Firebase Online';
      statusEl.className = 'firebase-status status-firebase';
    }
  }

  // ======== INICIALIZAÇÃO ========
  async function init() {
    const loadingEl = document.getElementById('loadingOverlay');
    if (loadingEl) loadingEl.classList.add('active');
    
    try {
      // Carregar configurações do Firebase
      await carregarConfigCampos();
      
      // Adicionar event listeners
      adicionarListeners();
      
      // Carregar dados do Firebase
      await carregarDadosFirebase();
      atualizarStatusFirebase();
      renderizarTela();
      console.log('✅ Sistema inicializado com sucesso (100% Firebase)');
      console.log('📊 Chart.js disponível:', typeof Chart !== 'undefined');
    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      alert('Erro ao carregar dados do Firebase. Verifique sua conexão.');
    } finally {
      if (loadingEl) loadingEl.classList.remove('active');
    }
  }

  // Iniciar o sistema
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
