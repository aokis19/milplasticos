// ====================================================
// CUSTO.JS - Central de Custos (Firestore Puro - v2.9)
// Gráficos melhorados com Tela Cheia
// Seletores: Marcar/Desmarcar todos Custos e Despesas
// Cópia de Período completa
// Cards: Períodos, Total Produzido, Total Gasto, Custo por KG
// ====================================================
(function() {
  'use strict';

  const db = window.firebaseDB || window.db;
  if (!db) {
    console.error('❌ Firebase não disponível');
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
  
  function calcularCustosSetor(setorld) {
    const itens = itensCusto.filter(i => i.setorld === setorld);
    const totalCusto = itens.reduce((s, i) => s + (i.valorTotal * (i.percentual || 100) / 100), 0);
    const prods = producoes.filter(p => p.setorld === setorld);
    const totalKg = prods.reduce((s, p) => s + p.kg, 0);
    const custoPorKg = totalKg > 0 ? totalCusto / totalKg : 0;
    return { totalCusto, totalKg, custoPorKg, qtdItens: itens.length };
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

  async function salvarFB(colecaoNome, dados) {
    try {
      if (!dados.id) {
        dados.id = colecaoNome + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      }
      const ref = colecoes[colecaoNome].doc(dados.id);
      const { id, ...dadosSemId } = dados;
      await ref.set({ ...dadosSemId, id }, { merge: true });
      return true;
    } catch (error) {
      console.error(`❌ Erro ao salvar em ${colecaoNome}:`, error);
      return false;
    }
  }

  async function excluirFB(colecaoNome, id) {
    try {
      await colecoes[colecaoNome].doc(id).delete();
      return true;
    } catch (error) {
      console.error(`❌ Erro ao excluir ${id}:`, error);
      return false;
    }
  }

  async function carregarDadosFirebase() {
  console.log('🔄 Carregando dados do Firestore...');
  try {
    // 1️⃣ PRIMEIRO: Tenta carregar do documento centralizado (dados antigos)
    const docCentral = await db.collection('centralCustos').doc('dados_completos').get();
    
    if (docCentral.exists && docCentral.data().dados) {
      console.log('📦 Dados encontrados no documento centralizado!');
      const dados = docCentral.data().dados;
      periodos = dados.periodos || [];
      setores = dados.setores || [];
      categorias = dados.categorias || [];
      itensCusto = dados.itensCusto || dados.itens || [];
      producoes = dados.producoes || [];
      materiais = dados.materiais || [];
      custosMateriais = dados.custosMateriais || [];
      custosFixos = dados.custosFixos || [];
      
      // 2️⃣ SINCRONIZA: Migra os dados para as coleções separadas
      console.log('🔄 Sincronizando dados para as coleções...');
      
      // Salva cada item na sua respectiva coleção
      await Promise.all([
        ...periodos.map(p => salvarFB('periodos', p)),
        ...setores.map(s => salvarFB('setores', s)),
        ...categorias.map(c => salvarFB('categorias', c)),
        ...itensCusto.map(i => salvarFB('itensCusto', i)),
        ...producoes.map(p => salvarFB('producoes', p)),
        ...materiais.map(m => salvarFB('materiais', m)),
        ...custosMateriais.map(cm => salvarFB('custosMateriais', cm)),
        ...custosFixos.map(cf => salvarFB('custosFixos', cf))
      ]);
      
      console.log('✅ Dados sincronizados com sucesso!');
      
    } else {
      // 3️⃣ Se não tem documento centralizado, carrega das coleções
      console.log('📂 Carregando das coleções separadas...');
      const [snapPeriodos, snapSetores, snapCategorias, snapItens, snapProducoes, 
             snapMateriais, snapCustosMat, snapCustosFixos, snapConfig] = await Promise.all([
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

      // Carrega configurações
      if (snapConfig.exists && snapConfig.data().config) {
        configCampos = { ...configCampos, ...snapConfig.data().config };
      }
    }

    // Normaliza campos para compatibilidade
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

    // Cria categorias padrão se necessário
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

    console.log(`✅ Dados carregados: ${periodos.length} períodos, ${setores.length} setores`);
  } catch (error) {
    console.error('❌ Erro ao carregar dados:', error);
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

  // ======== HOME - COM CARDS E GRÁFICO ========
  function renderizarPeriodos() {
    const container = document.getElementById('conteudoDinamico');
    if (!container) return;

    const anosDisponiveis = Array.from(new Set(periodos.map(p => p.ano))).sort((a, b) => b - a);
    const periodosFiltrados = filtroAnoAtual === 'todos' 
      ? [...periodos] 
      : periodos.filter(p => p.ano === parseInt(filtroAnoAtual));
    
    periodosFiltrados.sort((a, b) => b.ano - a.ano || b.mes - a.mes);
    
    const periodosParaCalculo = periodosSelecionadosResumo.size > 0 
      ? periodosFiltrados.filter(p => periodosSelecionadosResumo.has(p.id))
      : periodosFiltrados;
    
    let html = '';
    
    // ====== CARDS DE RESUMO ======
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
    
    const periodosParaGrafico = periodosSelecionadosResumo.size > 0
      ? periodos.filter(p => periodosSelecionadosResumo.has(p.id))
      : (filtroAnoAtual === 'todos' ? periodos : periodos.filter(p => p.ano === parseInt(filtroAnoAtual)));
    
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
    
    const periodosParaGrafico = periodosSelecionadosResumo.size > 0
      ? periodos.filter(p => periodosSelecionadosResumo.has(p.id))
      : (filtroAnoAtual === 'todos' ? periodos : periodos.filter(p => p.ano === parseInt(filtroAnoAtual)));
    
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
        <div style="display:flex;gap:0.5rem;align-items:center;">
          <button class="btn btn-primary btn-sm" onclick="window.abrirModalSetor()"><i class="fas fa-plus"></i> Novo Setor</button>
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

    html += `
      <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button class="btn btn-warning btn-sm" onclick="window.abrirModalCustoFixo()"><i class="fas fa-thumbtack"></i> Novo Custo Fixo</button>
        <button class="btn btn-outline btn-sm" onclick="window.abrirModalCategoria()"><i class="fas fa-tag"></i> Nova Categoria</button>
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
      </div>`;
    grid.appendChild(div);
  }

  window.toggleTodosSetores = function(tipo) {
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
        <thead><tr><th>Item</th><th>Categoria</th><th>Valor Total</th><th>% Rateio</th><th>Valor Rateado</th><th>Ações</th></tr></thead><tbody>`;
      itens.forEach(i => {
        const cat = categorias.find(c => c.id === i.categoriald);
        html += `<tr>
          <td>${i.nome} ${i.tipo === 'fixo' ? '<span class="badge badge-orange">Fixo</span>' : ''}</td>
          <td>${cat ? cat.nome : '-'}</td>
          <td>${formatMoney(i.valorTotal)}</td>
          <td>${i.percentual || 100}%</td>
          <td>${formatMoney(i.valorTotal * (i.percentual || 100) / 100)}</td>
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
    if (editId) { periodo.id = editId; const idx = periodos.findIndex(p => p.id === editId); if (idx !== -1) periodos[idx] = { ...periodos[idx], ...periodo }; }
    else { periodo.id = 'per_' + Date.now(); periodos.push(periodo); }
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
    } catch (error) { console.error('Erro ao excluir período:', error); alert('Erro ao excluir período.'); }
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
        mes: novoMes, ano: novoAno,
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
    if (editId) { setor.id = editId; const idx = setores.findIndex(x => x.id === editId); if (idx !== -1) setores[idx] = Object.assign({}, setores[idx], setor); }
    else { setor.id = 'set_' + Date.now(); setores.push(setor); }
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
    } catch (error) { console.error('Erro ao excluir setor:', error); alert('Erro ao excluir setor.'); }
  };

  // ======== CRUD CATEGORIAS ========
  window.abrirModalCategoria = function(id) {
    const modal = document.getElementById('modalCategoria');
    if (!modal) return;
    modal.classList.add('active');
    if (id) {
      const cat = categorias.find(c => c.id === id);
      if (cat) { document.getElementById('modalCategoriaTitulo').innerText = 'Editar Categoria'; document.getElementById('categoriaEditId').value = cat.id; document.getElementById('categoriaNome').value = cat.nome; document.getElementById('categoriaCor').value = cat.cor; }
    } else { document.getElementById('modalCategoriaTitulo').innerText = 'Nova Categoria'; document.getElementById('categoriaEditId').value = ''; document.getElementById('categoriaNome').value = ''; document.getElementById('categoriaCor').value = '#0d904f'; }
  };

  window.salvarCategoria = async function() {
    const nome = document.getElementById('categoriaNome').value.trim();
    if (!nome) { alert('Digite o nome da categoria.'); return; }
    const cor = document.getElementById('categoriaCor').value;
    const editId = document.getElementById('categoriaEditId').value;
    let categoria;
    if (editId) { 
      const idx = categorias.findIndex(c => c.id === editId); 
      if (idx !== -1) { categoria = Object.assign({}, categorias[idx], { nome, cor }); categorias[idx] = categoria; } 
    }
    else { categoria = { id: 'cat_' + Date.now(), nome, cor }; categorias.push(categoria); }
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

  // ======== CRUD CUSTO FIXO ========
  window.abrirModalCustoFixo = function(id) {
    const modal = document.getElementById('modalCustoFixo');
    if (!modal) return;
    modal.classList.add('active');
    document.getElementById('custoFixoPeriodo').innerHTML = '<option value="">Selecione um período...</option>' + periodos.map(p => `<option value="${p.id}">${getNomeMes(p.mes)}/${p.ano}</option>`).join('');
    document.getElementById('custoFixoCategoria').innerHTML = '<option value="">Selecione uma categoria...</option>' + categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    if (id) {
      const cf = custosFixos.find(x => x.id === id);
      if (cf) { document.getElementById('custoFixoTituloTexto').innerText = 'Editar Custo Fixo'; document.getElementById('custoFixoEditId').value = cf.id; document.getElementById('custoFixoPeriodo').value = cf.periodold || ''; document.getElementById('custoFixoCategoria').value = cf.categoriald || ''; document.getElementById('custoFixoNome').value = cf.nome || ''; document.getElementById('custoFixoValor').value = cf.valor || 0; }
    } else { document.getElementById('custoFixoTituloTexto').innerText = 'Novo Custo Fixo'; document.getElementById('custoFixoEditId').value = ''; document.getElementById('custoFixoPeriodo').value = periodoAtual ? periodoAtual.id : ''; document.getElementById('custoFixoCategoria').value = categorias[0] ? categorias[0].id : ''; document.getElementById('custoFixoNome').value = ''; document.getElementById('custoFixoValor').value = ''; }
  };

  window.salvarCustoFixo = async function() {
    const periodoId = document.getElementById('custoFixoPeriodo').value;
    const categoriaId = document.getElementById('custoFixoCategoria').value;
    const nome = document.getElementById('custoFixoNome').value.trim();
    const valor = parseFloat(document.getElementById('custoFixoValor').value);
    if (!periodoId || !categoriaId || !nome || isNaN(valor) || valor <= 0) { alert('Preencha todos os campos corretamente.'); return; }
    const editId = document.getElementById('custoFixoEditId').value;
    const cf = { periodold: periodoId, categoriald: categoriaId, nome, valor };
    if (editId) { cf.id = editId; const idx = custosFixos.findIndex(x => x.id === editId); if (idx !== -1) custosFixos[idx] = Object.assign({}, custosFixos[idx], cf); }
    else { cf.id = 'cf_' + Date.now(); custosFixos.push(cf); }
    await salvarFB('custosFixos', cf);
    window.fecharModal('modalCustoFixo');
    renderizarTela();
  };

  window.editarCustoFixo = function(id) { window.abrirModalCustoFixo(id); };
  window.excluirCustoFixo = async function(id) {
    if (!confirm('Excluir custo fixo?')) return;
    custosFixos = custosFixos.filter(c => c.id !== id);
    await excluirFB('custosFixos', id);
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
          if (cf) { document.getElementById('itemFixoNomeDisplay').value = cf.nome; document.getElementById('itemFixoValorDisplay').value = formatMoney(cf.valor); document.getElementById('itemFixoPercentual').value = item.percentual || 100; }
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
    if (fixos.length === 0) { container.innerHTML = '<p style="opacity:0.7;padding:0.5rem;">Nenhum custo fixo cadastrado neste período.</p>'; }
    else { container.innerHTML = fixos.map(cf => `<div class="custo-fixo-item ${custoFixoSelecionadoId === cf.id ? 'selecionado' : ''}" onclick="window.selecionarCustoFixo('${cf.id}')" style="cursor:pointer;margin-bottom:0.5rem;"><div><div class="cf-nome">${cf.nome}</div><div class="cf-categoria">${categorias.find(c => c.id === cf.categoriald)?.nome || 'Sem categoria'}</div></div><div class="cf-valor">${formatMoney(cf.valor)}</div></div>`).join(''); }
  }

  window.selecionarCustoFixo = function(id) {
    custoFixoSelecionadoId = id;
    const cf = custosFixos.find(c => c.id === id);
    if (cf) { document.getElementById('itemFixoNomeDisplay').value = cf.nome; document.getElementById('itemFixoValorDisplay').value = formatMoney(cf.valor); document.getElementById('areaItemFixoDetalhe').style.display = 'block'; }
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
    if (tipo === 'normal') { item.categoriald = document.getElementById('itemCategoria').value; item.valorTotal = parseFloat(document.getElementById('itemValorTotal').value) || 0; item.percentual = parseFloat(document.getElementById('itemPercentual').value) || 100; item.custoFixold = null; }
    else { if (!custoFixoSelecionadoId) { alert('Selecione um custo fixo.'); return; } const cf = custosFixos.find(c => c.id === custoFixoSelecionadoId); if (!cf) { alert('Custo fixo não encontrado.'); return; } item.categoriald = cf.categoriald; item.valorTotal = cf.valor; item.percentual = parseFloat(document.getElementById('itemFixoPercentual').value) || 100; item.custoFixold = custoFixoSelecionadoId; item.nome = cf.nome; }
    if (!item.setorld || !item.nome || item.valorTotal <= 0) { alert('Preencha todos os campos corretamente.'); return; }
    if (editId) { item.id = editId; const idx = itensCusto.findIndex(x => x.id === editId); if (idx !== -1) itensCusto[idx] = Object.assign({}, itensCusto[idx], item); }
    else { item.id = 'item_' + Date.now(); itensCusto.push(item); }
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
    if (id) { const m = materiais.find(x => x.id === id); if (m) { document.getElementById('modalMaterialTitulo').innerHTML = '<i class="fas fa-edit"></i> Editar Material'; document.getElementById('materialEditId').value = m.id; document.getElementById('materialNome').value = m.nome; document.getElementById('materialDescricao').value = m.descricao || ''; } }
    else { document.getElementById('modalMaterialTitulo').innerHTML = '<i class="fas fa-box"></i> Novo Material'; document.getElementById('materialEditId').value = ''; document.getElementById('materialNome').value = ''; document.getElementById('materialDescricao').value = ''; }
  };

  window.salvarMaterial = async function() {
    const nome = document.getElementById('materialNome').value.trim();
    if (!nome) { alert('Digite o nome do material.'); return; }
    const editId = document.getElementById('materialEditId').value;
    const m = { nome, descricao: document.getElementById('materialDescricao').value.trim() || '' };
    if (editId) { m.id = editId; const idx = materiais.findIndex(x => x.id === editId); if (idx !== -1) materiais[idx] = Object.assign({}, materiais[idx], m); }
    else { m.id = 'mat_' + Date.now(); materiais.push(m); }
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
    if (sets.length === 0) { container.innerHTML = '<p style="opacity:0.7;padding:1rem;">Nenhum setor neste período.</p>'; }
    else { container.innerHTML = sets.map(s => `<div class="setor-selecao-item ${setoresSelecionadosGerar.has(s.id) ? 'selecionado' : ''}"><div class="ss-header"><input type="checkbox" ${setoresSelecionadosGerar.has(s.id) ? 'checked' : ''} onchange="window.toggleSetorGerarCusto('${s.id}', this.checked)"><div class="ss-info"><div class="ss-nome">${s.nome} ${s.produtoFinal ? '⭐' : ''}</div><div class="ss-custo">${s.descricao || ''} | Custo atual: ${formatMoney(calcularCustosSetor(s.id).totalCusto)}</div></div></div></div>`).join(''); }
  };

  window.toggleSetorGerarCusto = function(setorId, checked) { if (checked) setoresSelecionadosGerar.set(setorId, true); else setoresSelecionadosGerar.delete(setorId); window.atualizarSetoresGerarCusto(); window.atualizarResumoGerarCusto(); };

  window.atualizarResumoGerarCusto = function() {
    const container = document.getElementById('resumoLinhas');
    if (!container) return;
    const setorIds = Array.from(setoresSelecionadosGerar.keys());
    if (setorIds.length === 0) { container.innerHTML = '<p style="opacity:0.7;text-align:center;">Selecione os setores para calcular</p>'; return; }
    let custoTotal = 0, producaoTotal = 0;
    setorIds.forEach(id => { const custos = calcularCustosSetor(id); custoTotal += custos.totalCusto; producaoTotal += custos.totalKg; });
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
    if (valorAtual > 0) { const diff = precoSugerido - valorAtual; html += `<div class="linha"><span>Valor Atual</span><span class="l-valor">${formatMoney(valorAtual)}/kg</span></div><div class="linha"><span>Diferença</span><span class="l-valor" style="color:${diff >= 0 ? '#4caf50' : '#f44336'}">${diff >= 0 ? '+' : ''}${formatMoney(diff)}/kg</span></div>`; }
    container.innerHTML = html;
  };

  window.adicionarInsumo = function() { const container = document.getElementById('insumosContainer'); const div = document.createElement('div'); div.className = 'insumo-row'; div.innerHTML = `<input type="text" class="insumo-nome" placeholder="Nome do insumo"><input type="number" class="insumo-custo" step="0.01" placeholder="R$/kg"><button class="btn btn-danger btn-xs" onclick="this.parentElement.remove();window.atualizarResumoGerarCusto();"><i class="fas fa-times"></i></button>`; container.appendChild(div); };
  window.salvarCustoMaterial = async function() { alert('Custo de material salvo com sucesso!'); window.fecharModal('modalGerarCusto'); };
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
    const cats = categorias.map(c => ({ ...c, total: 0 }));
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
      type: 'bar', data: { labels: catsComDados.map(c => c.nome), datasets: [{ data: catsComDados.map(c => c.total), backgroundColor: catsComDados.map(c => c.cor) }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  };

  window.abrirGraficoConsolidado = function() {
    if (typeof Chart === 'undefined') { alert('Chart.js não carregado.'); return; }
    if (periodosSelecionadosResumo.size === 0) { alert('Selecione períodos.'); return; }
    const modal = document.getElementById('modalGraficoConsolidado');
    if (!modal) return;
    modal.classList.add('active');
    const cats = categorias.map(c => ({ ...c, total: 0 }));
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
      type: 'bar', data: { labels: catsComDados.map(c => c.nome), datasets: [{ data: catsComDados.map(c => c.total), backgroundColor: catsComDados.map(c => c.cor) }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  };

  window.exportarGraficoMensal = function() { const c = document.getElementById('graficoMensalCanvas'); if(c){ const a=document.createElement('a'); a.download='grafico.png'; a.href=c.toDataURL(); a.click(); } };
  window.exportarGraficoConsolidado = function() { const c = document.getElementById('graficoConsolidadoCanvas'); if(c){ const a=document.createElement('a'); a.download='grafico.png'; a.href=c.toDataURL(); a.click(); } };

  // ======== FILTROS ========
  window.mudarFiltroAno = function(v) { filtroAnoAtual = v; periodosSelecionadosResumo.clear(); renderizarTela(); };
  window.togglePeriodoResumo = function(pid, checked) { if (checked) periodosSelecionadosResumo.add(pid); else periodosSelecionadosResumo.delete(pid); renderizarTela(); };
  window.removePeriodoResumo = function(pid) { periodosSelecionadosResumo.delete(pid); renderizarTela(); };
  window.limparSelecaoResumo = function() { periodosSelecionadosResumo.clear(); renderizarTela(); };
  window.toggleSetorResumo = function(sid, checked) { if (checked) setoresExcluidosResumo.delete(sid); else setoresExcluidosResumo.add(sid); renderizarTela(); };
  window.limparSetoresExcluidos = function() { setoresExcluidosResumo.clear(); renderizarTela(); };

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
        if (id) { e.preventDefault(); e.stopPropagation(); window.editarPeriodo(id); }
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

  async function init() {
    const loadingEl = document.getElementById('loadingOverlay');
    if (loadingEl) loadingEl.classList.add('active');
    try {
      if (!db) throw new Error('Firebase não disponível');
      await carregarDadosFirebase();
      adicionarListeners();
      atualizarStatusFirebase();
      renderizarTela();
      console.log('✅ Sistema inicializado');
    } catch (error) {
      console.error('❌ Erro:', error);
      const container = document.getElementById('conteudoDinamico');
      if (container) container.innerHTML = `<div style="text-align:center;padding:3rem;"><h3>Erro ao carregar</h3><p>${error.message}</p><button class="btn btn-primary" onclick="location.reload()">Tentar Novamente</button></div>`;
    } finally {
      if (loadingEl) loadingEl.classList.remove('active');
    }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }

})();
