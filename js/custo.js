// ==========================================================================
// CUSTO.JS - Central de Custos (Totalmente Integrado ao SyncSystem Unificado)
// ==========================================================================

(function() {
  'use strict';

  // Usar Firebase já inicializado pelo Firebase-init.js
  let db = window.firebaseDB || null;
  let usandoFirebase = !!db;

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
  let pieChart = null,
      barChart = null;
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

  const STORAGE_KEY = 'centralCustos_v14_milplastics';
  const CONFIG_KEY = 'centralCustos_config_v14';

  // ======== UTILITÁRIOS ========
  function formatMoney(v) {
    return 'R$ ' + (v || 0).toFixed(2).replace('.', ',');
  }

  function formatMoneySimples(v) {
    return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatNumber(n, d) {
    d = d || 2;
    return (n || 0).toFixed(d).replace('.', ',');
  }

  function getNomeMes(m) {
    return ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][m-1] || '';
  }

  function getSetoresDoPeriodo(periodoid) {
    var pid = periodoid || (periodoAtual ? periodoAtual.id : null);
    if (!pid) return [];
    return setores.filter(function(s) { return s.periodold === pid; }).sort(function(a, b) { return a.ordem - b.ordem; });
  }

  function getCustosFixosDoPeriodo(periodoid) {
    var pid = periodoid || (periodoAtual ? periodoAtual.id : null);
    if (!pid) return [];
    return custosFixos.filter(function(cf) { return cf.periodold === pid; });
  }

  function calcularCustosSetor(setorId) {
    var itens = itensCusto.filter(function(i) { return i.setorld === setorId; });
    var totalCusto = itens.reduce(function(s, i) { return s + (i.valorTotal * (i.percentual || 100) / 100); }, 0);
    var prods = producoes.filter(function(p) { return p.setorld === setorId; });
    var totalKg = prods.reduce(function(s, p) { return s + p.kg; }, 0);
    var custoPorKg = totalKg > 0 ? totalCusto / totalKg : 0;
    return { totalCusto: totalCusto, totalKg: totalKg, custoPorKg: custoPorKg, qtdItens: itens.length };
  }

  function getCustoPorKgSetor(setorId) {
    var custos = calcularCustosSetor(setorId);
    return custos.totalKg > 0 ? custos.totalCusto / custos.totalKg : 0;
  }

  function calcularResumoPeriodo(periodoidParam, excluirSetores) {
    var pid = periodoidParam || (periodoAtual ? periodoAtual.id : null);
    var excluir = excluirSetores || setoresExcluidosResumo;
    if (!pid) return { custoTotalGeral: 0, producaoTotalGeral: 0, custoPorKgGeral: 0, qtdSetores: 0, setoresFinais: [], qtdProdutosFinais: 0 };
    
    var sets = getSetoresDoPeriodo(pid);
    var setsAtivos = sets.filter(function(s) { return !excluir.has(s.id); });
    var custoTotalGeral = 0;
    
    setsAtivos.forEach(function(s) {
      var custos = calcularCustosSetor(s.id);
      custoTotalGeral += custos.totalCusto;
    });
    
    var setsFinais = setsAtivos.filter(function(s) { return s.produtoFinal === true; });
    var producaoTotalGeral = 0;
    var detalhesFinais = [];
    
    setsFinais.forEach(function(sf) {
      var custos = calcularCustosSetor(sf.id);
      producaoTotalGeral += custos.totalKg;
      detalhesFinais.push({ setor: sf, custo: custos.totalCusto, producao: custos.totalKg, custoPorKg: custos.custoPorKg });
    });
    
    return {
      custoTotalGeral: custoTotalGeral,
      producaoTotalGeral: producaoTotalGeral,
      custoPorKgGeral: producaoTotalGeral > 0 ? custoTotalGeral / producaoTotalGeral : 0,
      qtdSetores: setsAtivos.length,
      qtdProdutosFinais: setsFinais.length,
      setoresFinais: detalhesFinais
    };
  }

  function calcularResumoConsolidado() {
    if (periodosSelecionadosResumo.size === 0) return null;
    var custoTotal = 0, producaoTotal = 0, qtdSetores = 0;
    var emptySet = new Set();
    
    periodosSelecionadosResumo.forEach(function(pid) {
      var resumo = calcularResumoPeriodo(pid, emptySet);
      custoTotal += resumo.custoTotalGeral;
      producaoTotal += resumo.producaoTotalGeral;
      qtdSetores += resumo.qtdSetores;
    });
    
    return {
      custoTotal: custoTotal,
      producaoTotal: producaoTotal,
      custoPorKg: producaoTotal > 0 ? custoTotal / producaoTotal : 0,
      qtdSetores: qtdSetores,
      qtdPeriodos: periodosSelecionadosResumo.size
    };
  }

  // ======== CORRIGIDO: OPERAÇÕES DE ARMAZENAMENTO UNIFICADAS ========
  
  async function loadLocalData() {
    console.log('🔄 [Central de Custos] Solicitando dados unificados ao SyncSystem...');
    try {
      if (window.SyncSystem && window.SyncSystem.carregarModulo) {
        // Puxa os dados consolidados do cache local ou nuvem sem gerar conflitos de lote
        var dados = await window.SyncSystem.carregarModulo('centralCustos_v14_milplastics');
        if (dados && typeof dados === 'object' && !Array.isArray(dados) && Object.keys(dados).length > 0) {
          aplicarDados(dados);
          console.log('📂 Dados sincronizados via SyncSystem: ' + (periodos.length) + ' períodos.');
          renderizarTela();
          document.getElementById('loadingOverlay')?.classList.remove('active');
          return;
        }
      }
    } catch (e) {
      console.warn('⚠️ SyncSystem indisponível no carregamento inicial:', e.message);
    }

    // Fallback prioritário direto para cache local
    carregarLocalStorageFallback();
    document.getElementById('loadingOverlay')?.classList.remove('active');
    
    var savedConfig = localStorage.getItem(CONFIG_KEY);
    if (savedConfig) configCampos = Object.assign({}, configCampos, JSON.parse(savedConfig));
  }

  function carregarLocalStorageFallback() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        var p = JSON.parse(data);
        aplicarDados(p);
        console.log('📦 Dados carregados com segurança via contingência LocalStorage bruto.');
        renderizarTela();
      } else {
        inicializarDadosPadrao();
      }
    } catch (e) {
      inicializarDadosPadrao();
    }
  }

  function inicializarDadosPadrao() {
    periodos = []; setores = []; materiais = []; custosMateriais = []; custosFixos = [];
    categorias = [
      { id: 'cat1', nome: 'Energia Elétrica', cor: '#f57c00' },
      { id: 'cat2', nome: 'Matéria-Prima', cor: '#0d904f' },
      { id: 'cat3', nome: 'Mão de Obra', cor: '#0277bd' },
      { id: 'cat4', nome: 'Manutenção', cor: '#6a1b9a' },
      { id: 'cat5', nome: 'Insumos', cor: '#c62828' }
    ];
    itensCusto = []; producoes = [];
    renderizarTela();
  }

  async function saveLocalData() {
    try {
      var dados = {
        periodos: periodos,
        setores: setores,
        categorias: categorias,
        itensCusto: itensCusto,
        producoes: producoes,
        materiais: materiais,
        custosMateriais: custosMateriais,
        custosFixos: custosFixos
      };

      // Alimenta a fila transparente em background do SyncSystem
      if (window.SyncSystem && window.SyncSystem.salvarModulo) {
        await window.SyncSystem.salvarModulo('centralCustos_v14_milplastics', dados);
        console.log('✅ Dados de custos enfileirados com sucesso no SyncSystem.');
      }

      // Backup Local para contingência offline imediata
      var json = JSON.stringify(dados);
      var tamanhoEmMB = new Blob([json]).size / (1024 * 1024);
      if (tamanhoEmMB > 4) {
        var compactado = compactarDados(dados);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(compactado));
      } else {
        localStorage.setItem(STORAGE_KEY, json);
      }
      console.log('💾 Custo local atualizado em cache.');
    } catch (e) {
      console.error('❌ Falha ao processar salvamento:', e);
    }
  }

  function compactarDados(dados) {
    return {
      periodos: dados.periodos.map(function(p) { return { id: p.id, mes: p.mes, ano: p.ano, obs: p.obs || '' }; }),
      setores: dados.setores.map(function(s) { return { id: s.id, periodold: s.periodold, nome: s.nome, descricao: s.descricao || '', ordem: s.ordem, produtoFinal: s.produtoFinal || false, tipo: s.tipo || 'custo' }; }),
      categorias: dados.categorias.map(function(c) { return { id: c.id, nome: c.nome, cor: c.cor }; }),
      itensCusto: dados.itensCusto.map(function(i) { return { id: i.id, setorld: i.setorld, categoriald: i.categoriald, nome: i.nome, valorTotal: i.valorTotal, percentual: i.percentual, tipo: i.tipo || 'normal', custoFixold: i.custoFixold || null, obs: i.obs || '' }; }),
      producoes: dados.producoes.map(function(p) { return { id: p.id, setorld: p.setorld, produto: p.produto, kg: p.kg, data: p.data }; }),
      materiais: dados.materiais.map(function(m) { return { id: m.id, nome: m.nome, descricao: m.descricao || '' }; }),
      custosMateriais: dados.custosMateriais.map(function(c) { return { id: c.id, materialld: c.materialld, periodold: c.periodold, mes: c.mes, ano: c.ano, custoKgFinal: c.custoKgFinal, subtotal: c.subtotal, imposto: c.imposto, valorImposto: c.valorImposto, margem: c.margem, precoSugerido: c.precoSugerido, valorAtual: c.valorAtual, setoresDetalhes: c.setoresDetalhes, insumos: c.insumos, setoresUtilizados: c.setoresUtilizados }; }),
      custosFixos: dados.custosFixos.map(function(c) { return { id: c.id, periodold: c.periodold, categoriald: c.categoriald, nome: c.nome, valor: c.valor }; })
    };
  }

  function saveConfig() {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(configCampos));
  }

  function aplicarDados(dados) {
    periodos = dados.periodos || [];
    setores = dados.setores || [];
    categorias = dados.categorias || [];
    itensCusto = dados.itensCusto || [];
    producoes = dados.producoes || [];
    materiais = dados.materiais || [];
    custosMateriais = dados.custosMateriais || [];
    custosFixos = dados.custosFixos || [];
    if (categorias.length === 0) {
      categorias = [
        { id: 'cat1', nome: 'Energia Elétrica', cor: '#f57c00' },
        { id: 'cat2', nome: 'Matéria-Prima', cor: '#0d904f' },
        { id: 'cat3', nome: 'Mão de Obra', cor: '#0277bd' },
        { id: 'cat4', nome: 'Manutenção', cor: '#6a1b9a' },
        { id: 'cat5', nome: 'Insumos', cor: '#c62828' }
      ];
    }
  }

  // Desativado CRUD direto legível em prol do monitoramento do firebase-sync.js
  async function salvarFB(col, dados) { return false; }
  async function excluirFB(col, id) { return false; }

  // ======== RENDERIZAÇÃO PRINCIPAL ========
  function renderizarTela() {
    if (nivelAtual === 'periodos') renderizarPeriodos();
    else if (nivelAtual === 'setores') renderizarSetores();
    else if (nivelAtual === 'analise') renderizarAnalise();
    else if (nivelAtual === 'materiais') renderizarMateriais();
    else if (nivelAtual === 'historicoMaterial') renderizarHistoricoMaterial();
    
    if (typeof window.atualizarBreadcrumb === 'function') window.atualizarBreadcrumb();
  }

  // ======== RENDERIZAR PERÍODOS ========
  function renderizarPeriodos() {
    var container = document.getElementById('conteudoDinamico');
    if (!container) return;

    var anosDisponiveis = [];
    var anosSet = new Set();
    
    periodos.forEach(function(p) { if(p.ano) anosSet.add(p.ano); });
    anosDisponiveis = Array.from(anosSet).sort(function(a, b) { return b - a; });
   
    var periodosFiltrados = periodos.slice();
    if (filtroAnoAtual !== 'todos') {
      periodosFiltrados = periodosFiltrados.filter(function(p) { return p.ano === parseInt(filtroAnoAtual); });
    }
    periodosFiltrados.sort(function(a, b) {
      if (a.ano !== b.ano) return b.ano - a.ano;
      return b.mes - a.mes;
    });
    
    var resumoConsolidado = calcularResumoConsolidado();
    var html = '';
    
    if (resumoConsolidado) {
      html += '<div class="resumo-consolidado">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">';
      html += '<h3 style="margin:0;"><i class="fas fa-layer-group"></i> Resumo Consolidado</h3>';
      html += '<button class="btn btn-purple btn-sm" onclick="window.abrirGraficoConsolidado()"><i class="fas fa-chart-bar"></i> Ver Gráfico</button>';
      html += '</div>';
      html += '<div class="periodos-selecionados-tags">';
      var tagsHtml = '';
      periodosSelecionadosResumo.forEach(function(pid) {
        var per = periodos.find(function(p) { return p.id === pid; });
        if (per) {
          tagsHtml += '<span class="periodo-tag">' + getNomeMes(per.mes) + '/' + per.ano + ' <span class="remover-tag" onclick="window.removePeriodoResumo(\'' + pid + '\')">x</span></span>';
        }
      });
      html += tagsHtml;
      html += '<span class="btn-selecionar-todos" onclick="window.limparSelecaoResumo()">Limpar</span>';
      html += '</div>';
      
      html += '<div class="stats-grid-resumo">';
      html += '<div class="stat-resumo"><div class="sr-valor">' + resumoConsolidado.qtdPeriodos + '</div><div class="sr-label">Períodos</div></div>';
      html += '<div class="stat-resumo"><div class="sr-valor">' + resumoConsolidado.qtdSetores + '</div><div class="sr-label">Setores</div></div>';
      html += '<div class="stat-resumo"><div class="sr-valor">' + formatMoney(resumoConsolidado.custoTotal) + '</div><div class="sr-label">Custo Total</div></div>';
      html += '<div class="stat-resumo"><div class="sr-valor">' + formatNumber(resumoConsolidado.producaoTotal, 0) + ' kg</div><div class="sr-label">Produção Total</div></div>';
      html += '<div class="stat-resumo destaque"><div class="sr-valor">' + formatMoney(resumoConsolidado.custoPorKg) + '/kg</div><div class="sr-label">Custo Médio/KG</div></div>';
      html += '</div>';
      html += '</div>';
    }
   
    html += '<div class="card">';
    html += '<div class="card-header">';
    html += '<span class="card-title"><i class="fas fa-calendar-alt"></i> Períodos</span>';
    html += '<div style="display:flex;gap:0.5rem;align-items:center;">';
    html += '<select id="filtroAno" onchange="window.mudarFiltroAno(this.value)" style="padding:0.3rem 0.5rem;border-radius:6px;border:1px solid #ddd;font-size:0.8rem;">';
    html += '<option value="todos" ' + (filtroAnoAtual === 'todos' ? 'selected' : '') + '>Todos</option>';
    anosDisponiveis.forEach(function(a) {
      html += '<option value="' + a + '" ' + (filtroAnoAtual == a ? 'selected' : '') + '>' + a + '</option>';
    });
    html += '</select>';
    html += '<button class="btn btn-primary btn-sm" onclick="window.abrirModalPeriodo()"><i class="fas fa-plus"></i> Novo</button>';
    html += '</div>';
    html += '</div>';

    if (periodosFiltrados.length === 0) {
      html += '<div style="text-align:center;padding:2rem;"><p>Nenhum período cadastrado.</p></div>';
    } else {
      html += '<div class="periodos-grid" id="periodosGrid"></div>';
    }
    html += '</div>';
    
    container.innerHTML = html;
    
    if (periodosFiltrados.length > 0) {
      var grid = document.getElementById('periodosGrid');
      if (grid) {
        periodosFiltrados.forEach(function(per) {
          var resumo = calcularResumoPeriodo(per.id, new Set());
          var isSelecionado = periodosSelecionadosResumo.has(per.id);
          var div = document.createElement('div');
          div.className = 'periodo-card' + (isSelecionado ? ' selecionado-resumo' : '');
          div.innerHTML = '<div class="periodo-check"><input type="checkbox" ' + (isSelecionado ? 'checked' : '') + ' onchange="window.togglePeriodoResumo(\'' + per.id + '\', this.checked)"></div>' + 
                          '<div class="acoes">' + 
                            '<button class="btn btn-purple btn-xs" onclick="event.stopPropagation();window.abrirGraficoMensal(\'' + per.id + '\')"><i class="fas fa-chart-bar"></i></button>' + 
                            '<button class="btn btn-info btn-xs" onclick="event.stopPropagation();window.abrirCopiarPeriodo(\'' + per.id + '\')"><i class="fas fa-copy"></i></button>' + 
                            '<button class="btn btn-outline btn-xs" onclick="event.stopPropagation();window.abrirEditarPeriodo?.(\'' + per.id + '\')"><i class="fas fa-edit"></i></button>' + 
                            '<button class="btn btn-danger btn-xs" onclick="event.stopPropagation();window.excluirPeriodo(\'' + per.id + '\')"><i class="fas fa-trash"></i></button>' + 
                          '</div>' + 
                          '<div class="periodo-titulo" onclick="window.selecionarPeriodo(\'' + per.id + '\')"><i class="fas fa-calendar-check"></i> ' + getNomeMes(per.mes) + '/' + per.ano + '</div>' + 
                          '<div class="periodo-obs">' + (per.obs || 'Sem descrição') + '</div>' + 
                          '<div class="periodo-stats">' + 
                            '<div class="periodo-stat"><span class="label">Setores</span><span class="valor">' + resumo.qtdSetores + '</span></div>' + 
                            '<div class="periodo-stat"><span class="label">Custo Total</span><span class="valor money">' + formatMoney(resumo.custoTotalGeral) + '</span></div>' + 
                            '<div class="periodo-stat"><span class="label">Produção</span><span class="valor">' + formatNumber(resumo.producaoTotalGeral, 0) + ' kg</span></div>' + 
                            '<div class="periodo-stat"><span class="label">Custo/KG</span><span class="valor money">' + formatMoney(resumo.custoPorKgGeral) + '/kg</span></div>' + 
                          '</div>';
          grid.appendChild(div);
        });
      }
    }
  }

  // Falta de escopos e funções delegadas da UI expostas de volta para chamadas inline do HTML
  window.mudarFiltroAno = function(v) { filtroAnoAtual = v; renderizarTela(); };
  window.togglePeriodoResumo = function(pid, checked) { if (checked) periodosSelecionadosResumo.add(pid); else periodosSelecionadosResumo.delete(pid); renderizarTela(); };
  window.removePeriodoResumo = function(pid) { periodosSelecionadosResumo.delete(pid); renderizarTela(); };
  window.limparSelecaoResumo = function() { periodosSelecionadosResumo.clear(); renderizarTela(); };
  
  window.selecionarPeriodo = function(id) {
    var p = periodos.find(function(per) { return per.id === id; });
    if (p) { periodoAtual = p; nivelAtual = 'setores'; renderizarTela(); }
  };
  
  window.navegarPara = function(nivel) { nivelAtual = nivel; renderizarTela(); };

  // Inicializador de Ciclo seguro aguardando o Firebase se estabilizar
  function init() {
    loadLocalData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
