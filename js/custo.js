(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyD4GQv7odzKtxg36f_SSWLbQF-TmYi4xYI",
    authDomain: "system-mil.firebaseapp.com",
    projectId: "system-mil",
    storageBucket: "system-mil.firebasestorage.app",
    messagingSenderId: "138426359863",
    appId: "1:138426359863:web:ab731a7ae1b7e03f7a1fb2"
  };

  let db = null, usandoFirebase = false;
  let periodos = [], setores = [], categorias = [], itensCusto = [], producoes = [];
  let materiais = [], custosMateriais = [], custosFixos = [];
  let periodoAtual = null, setorAtual = null;
  let pieChart = null, barChart = null;
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

  // ========== FUNÇÕES DE ARMAZENAMENTO OTIMIZADAS ==========

  function loadLocalData() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const p = JSON.parse(data);
        periodos = p.periodos || [];
        setores = p.setores || [];
        categorias = p.categorias || [];
        itensCusto = p.itensCusto || [];
        producoes = p.producoes || [];
        materiais = p.materiais || [];
        custosMateriais = p.custosMateriais || [];
        custosFixos = p.custosFixos || [];
      } else {
        inicializarDadosPadrao();
      }
    } catch (e) {
      console.warn('Erro ao carregar dados do LocalStorage, usando dados padrão:', e);
      inicializarDadosPadrao();
    }
    
    const savedConfig = localStorage.getItem(CONFIG_KEY);
    if (savedConfig) configCampos = { ...configCampos, ...JSON.parse(savedConfig) };
  }

  function inicializarDadosPadrao() {
    periodos = [];
    setores = [];
    materiais = [];
    custosMateriais = [];
    custosFixos = [];
    categorias = [
      { id: 'cat1', nome: 'Energia Elétrica', cor: '#f57c00' },
      { id: 'cat2', nome: 'Matéria-Prima', cor: '#0d904f' },
      { id: 'cat3', nome: 'Mão de Obra', cor: '#0277bd' },
      { id: 'cat4', nome: 'Manutenção', cor: '#6a1b9a' },
      { id: 'cat5', nome: 'Insumos', cor: '#c62828' }
    ];
    itensCusto = [];
    producoes = [];
  }

  function saveLocalData() {
    try {
      const dados = {
        periodos, setores, categorias, itensCusto, producoes,
        materiais, custosMateriais, custosFixos
      };
      
      const json = JSON.stringify(dados);
      const tamanhoEmMB = new Blob([json]).size / (1024 * 1024);
      
      if (tamanhoEmMB > 4.5) {
        console.warn('⚠️ Dados estão grandes (~' + tamanhoEmMB.toFixed(2) + 'MB). Pode exceder o limite do LocalStorage.');
        
        const dadosCompactados = compactarDados(dados);
        const jsonCompactado = JSON.stringify(dadosCompactados);
        const tamanhoCompactado = new Blob([jsonCompactado]).size / (1024 * 1024);
        
        if (tamanhoCompactado < tamanhoEmMB) {
          console.log('✅ Dados compactados de ' + tamanhoEmMB.toFixed(2) + 'MB para ' + tamanhoCompactado.toFixed(2) + 'MB');
          localStorage.setItem(STORAGE_KEY, jsonCompactado);
          return;
        }
      }
      
      localStorage.setItem(STORAGE_KEY, json);
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        console.error('❌ Erro de cota do LocalStorage. Tentando compactar dados...');
        try {
          const dadosCompactados = compactarDados({
            periodos, setores, categorias, itensCusto, producoes,
            materiais, custosMateriais, custosFixos
          });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(dadosCompactados));
          console.log('✅ Dados salvos após compactação.');
        } catch (e2) {
          console.error('❌ Falha ao salvar mesmo após compactação. Limpando dados antigos...');
          limparDadosAntigos();
        }
      } else {
        console.error('❌ Erro ao salvar dados:', e);
      }
    }
  }

  function compactarDados(dados) {
    const compactado = {
      periodos: dados.periodos.map(p => ({ 
        id: p.id, mes: p.mes, ano: p.ano, obs: p.obs || '' 
      })),
      setores: dados.setores.map(s => ({ 
        id: s.id, periodoId: s.periodoId, nome: s.nome, 
        descricao: s.descricao || '', ordem: s.ordem, 
        produtoFinal: s.produtoFinal || false, tipo: s.tipo || 'custo'
      })),
      categorias: dados.categorias.map(c => ({ 
        id: c.id, nome: c.nome, cor: c.cor 
      })),
      itensCusto: dados.itensCusto.map(i => ({ 
        id: i.id, setorId: i.setorId, categoriaId: i.categoriaId, 
        nome: i.nome, valorTotal: i.valorTotal, percentual: i.percentual,
        tipo: i.tipo || 'normal', custoFixoId: i.custoFixoId || null,
        obs: i.obs || ''
      })),
      producoes: dados.producoes.map(p => ({ 
        id: p.id, setorId: p.setorId, produto: p.produto, 
        kg: p.kg, data: p.data 
      })),
      materiais: dados.materiais.map(m => ({ 
        id: m.id, nome: m.nome, descricao: m.descricao || '' 
      })),
      custosMateriais: dados.custosMateriais.map(c => ({ 
        id: c.id, materialId: c.materialId, periodoId: c.periodoId,
        mes: c.mes, ano: c.ano, custoKgFinal: c.custoKgFinal,
        subtotal: c.subtotal, imposto: c.imposto, valorImposto: c.valorImposto,
        margem: c.margem, precoSugerido: c.precoSugerido, valorAtual: c.valorAtual,
        setoresDetalhes: c.setoresDetalhes, insumos: c.insumos,
        setoresUtilizados: c.setoresUtilizados
      })),
      custosFixos: dados.custosFixos.map(c => ({ 
        id: c.id, periodoId: c.periodoId, categoriaId: c.categoriaId,
        nome: c.nome, valor: c.valor 
      }))
    };
    return compactado;
  }

  function limparDadosAntigos() {
    if (periodos.length > 50) periodos = periodos.slice(-50);
    if (setores.length > 200) setores = setores.slice(-200);
    if (itensCusto.length > 500) itensCusto = itensCusto.slice(-500);
    if (producoes.length > 500) producoes = producoes.slice(-500);
    if (custosMateriais.length > 200) custosMateriais = custosMateriais.slice(-200);
    if (custosFixos.length > 200) custosFixos = custosFixos.slice(-200);
    
    saveLocalData();
  }

  function saveConfig() { localStorage.setItem(CONFIG_KEY, JSON.stringify(configCampos)); }

  loadLocalData();

  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    usandoFirebase = true;
    const statusEl = document.getElementById('firebaseStatus');
    if (statusEl) {
      statusEl.innerHTML = '<span class="status-dot"></span> Firebase';
      statusEl.className = 'firebase-status status-firebase';
    }
    carregarDadosFirebase();
  } catch (e) {
    const statusEl = document.getElementById('firebaseStatus');
    if (statusEl) {
      statusEl.innerHTML = '<span class="status-dot"></span> Local';
      statusEl.className = 'firebase-status status-local';
    }
    renderizarTela();
  }

  async function carregarDadosFirebase() {
    if (!usandoFirebase || !db) return;
    try {
      const snaps = await Promise.all([
        db.collection('custos_periodos').get(),
        db.collection('custos_setores').get(),
        db.collection('custos_categorias').get(),
        db.collection('custos_itens').get(),
        db.collection('custos_producoes').get(),
        db.collection('custos_materiais').get(),
        db.collection('custos_materiais_custos').get(),
        db.collection('custos_fixos').get()
      ]);
      periodos = snaps[0].docs.map(d => ({ id: d.id, ...d.data() }));
      setores = snaps[1].docs.map(d => ({ id: d.id, ...d.data() }));
      categorias = snaps[2].docs.map(d => ({ id: d.id, ...d.data() }));
      itensCusto = snaps[3].docs.map(d => ({ id: d.id, ...d.data() }));
      producoes = snaps[4].docs.map(d => ({ id: d.id, ...d.data() }));
      materiais = snaps[5].docs.map(d => ({ id: d.id, ...d.data() }));
      custosMateriais = snaps[6].docs.map(d => ({ id: d.id, ...d.data() }));
      custosFixos = snaps[7].docs.map(d => ({ id: d.id, ...d.data() }));
      saveLocalData();
      renderizarTela();
      document.getElementById('loadingOverlay').classList.remove('active');
      verificarStatusFirebase();
    } catch (e) {
      console.error('Erro ao carregar dados do Firebase:', e);
      renderizarTela();
    }
  }

  async function salvarFB(col, dados) {
    if (!usandoFirebase || !db) return;
    try {
      if (dados.id) {
        await db.collection(col).doc(dados.id).set(dados);
      } else {
        const ref = await db.collection(col).add(dados);
        dados.id = ref.id;
      }
    } catch (e) { console.error('Erro ao salvar no Firebase:', e); }
  }

  async function excluirFB(col, id) {
    if (!usandoFirebase || !db || !id) return;
    try { await db.collection(col).doc(id).delete(); } catch (e) { console.error('Erro ao excluir do Firebase:', e); }
  }

  function formatMoney(v) {
    return 'R$ ' + (v || 0).toFixed(2).replace('.', ',');
  }

  function formatMoneySimples(v) {
    return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatNumber(n, d = 2) {
    return (n || 0).toFixed(d).replace('.', ',');
  }

  function getNomeMes(m) {
    return ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][m - 1] || '';
  }

  function getSetoresDoPeriodo(periodoId) {
    const pid = periodoId || (periodoAtual ? periodoAtual.id : null);
    if (!pid) return [];
    return setores.filter(s => s.periodoId === pid).sort((a, b) => a.ordem - b.ordem);
  }

  function getCustosFixosDoPeriodo(periodoId) {
    const pid = periodoId || (periodoAtual ? periodoAtual.id : null);
    if (!pid) return [];
    return custosFixos.filter(cf => cf.periodoId === pid);
  }

  function calcularCustosSetor(setorId) {
    const itens = itensCusto.filter(i => i.setorId === setorId);
    const totalCusto = itens.reduce((s, i) => s + (i.valorTotal * i.percentual / 100), 0);
    const prods = producoes.filter(p => p.setorId === setorId);
    const totalKg = prods.reduce((s, p) => s + p.kg, 0);
    const custoPorKg = totalKg > 0 ? totalCusto / totalKg : 0;
    return { totalCusto, totalKg, custoPorKg, qtdItens: itens.length };
  }

  function getCustoPorKgSetor(setorId) {
    const { totalCusto, totalKg } = calcularCustosSetor(setorId);
    return totalKg > 0 ? totalCusto / totalKg : 0;
  }

  // ============================================================
  // FUNÇÃO CORRIGIDA - Custo Total: TODOS os setores selecionados
  // Produção Total: APENAS produtos finais
  // ============================================================
  function calcularResumoPeriodo(periodoIdParam, excluirSetores = null) {
    const pid = periodoIdParam || (periodoAtual ? periodoAtual.id : null);
    const excluir = excluirSetores || setoresExcluidosResumo;

    if (!pid) return {
      custoTotalGeral: 0,
      producaoTotalGeral: 0,
      custoPorKgGeral: 0,
      qtdSetores: 0,
      setoresFinais: [],
      qtdProdutosFinais: 0
    };

    const sets = getSetoresDoPeriodo(pid);
    
    // FILTRAR APENAS SETORES NÃO EXCLUÍDOS
    const setsAtivos = sets.filter(s => !excluir.has(s.id));
    
    // CUSTO TOTAL = SOMA DE TODOS OS SETORES ATIVOS (CUSTO + DESPESA)
    let custoTotalGeral = 0;
    setsAtivos.forEach(s => {
      const { totalCusto } = calcularCustosSetor(s.id);
      custoTotalGeral += totalCusto;
    });

    // PRODUÇÃO TOTAL = SOMA APENAS DOS PRODUTOS FINAIS
    const setsFinais = setsAtivos.filter(s => s.produtoFinal === true);
    let producaoTotalGeral = 0;
    const detalhesFinais = [];

    setsFinais.forEach(sf => {
      const { totalCusto, totalKg, custoPorKg } = calcularCustosSetor(sf.id);
      producaoTotalGeral += totalKg;
      detalhesFinais.push({ 
        setor: sf, 
        custo: totalCusto, 
        producao: totalKg, 
        custoPorKg 
      });
    });

    return {
      custoTotalGeral,
      producaoTotalGeral,
      custoPorKgGeral: producaoTotalGeral > 0 ? custoTotalGeral / producaoTotalGeral : 0,
      qtdSetores: setsAtivos.length,
      qtdProdutosFinais: setsFinais.length,
      setoresFinais: detalhesFinais
    };
  }

  function calcularResumoConsolidado() {
    if (periodosSelecionadosResumo.size === 0) return null;

    let custoTotal = 0, producaoTotal = 0, qtdSetores = 0;
    const emptySet = new Set();

    periodosSelecionadosResumo.forEach(pid => {
      const resumo = calcularResumoPeriodo(pid, emptySet);
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

  function getHistoricoMaterial(materialId) {
    return custosMateriais.filter(cm => cm.materialId === materialId)
      .sort((a, b) => { if (a.ano !== b.ano) return b.ano - a.ano; return b.mes - a.mes; });
  }

  // ========== FUNÇÕES DOS GRÁFICOS ==========

  window.abrirGraficoMensal = function (periodoId) {
    const per = periodos.find(p => p.id === periodoId);
    if (!per) return;
    document.getElementById('graficoMensalTitulo').textContent =
      `${getNomeMes(per.mes)}/${per.ano} - Gastos por Categoria`;
    document.getElementById('modalGraficoMensal').classList.add('active');
    setTimeout(() => {
      criarGraficoMensal(periodoId);
    }, 200);
  };

  function criarGraficoMensal(periodoId) {
    if (graficoMensalChart) {
      graficoMensalChart.destroy();
      graficoMensalChart = null;
    }
    const sets = getSetoresDoPeriodo(periodoId);
    if (sets.length === 0) {
      document.getElementById('graficoMensalResumo').innerHTML =
        '<p style="text-align:center;color:var(--text-light);">Nenhum setor neste período.</p>';
      return;
    }

    const categoriasAgrupadas = {};
    sets.forEach(setor => {
      const itens = itensCusto.filter(i => i.setorId === setor.id);
      itens.forEach(item => {
        const valorAplicado = item.valorTotal * item.percentual / 100;
        const cat = categorias.find(c => c.id === item.categoriaId);
        const catNome = cat ? cat.nome : 'Sem Categoria';
        const catCor = cat ? cat.cor : '#999999';
        if (!categoriasAgrupadas[catNome]) {
          categoriasAgrupadas[catNome] = {
            nome: catNome,
            cor: catCor,
            total: 0,
            itens: []
          };
        }
        categoriasAgrupadas[catNome].total += valorAplicado;
        categoriasAgrupadas[catNome].itens.push({
          nome: item.nome,
          setor: setor.nome,
          valor: valorAplicado
        });
      });
    });

    const dadosCategorias = Object.values(categoriasAgrupadas).sort((a, b) => b.total - a.total);
    const totalGeral = dadosCategorias.reduce((s, d) => s + d.total, 0);

    if (totalGeral === 0 || dadosCategorias.length === 0) {
      document.getElementById('graficoMensalResumo').innerHTML =
        '<p style="text-align:center;color:var(--text-light);">Sem dados de custo para este período.</p>';
      return;
    }

    const canvas = document.getElementById('graficoMensalCanvas');
    const ctx = canvas.getContext('2d');

    const backgrounds = dadosCategorias.map((d) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, 380);
      gradient.addColorStop(0, d.cor + 'CC');
      gradient.addColorStop(1, d.cor + '44');
      return gradient;
    });

    graficoMensalChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: dadosCategorias.map(d => d.nome),
        datasets: [{
          label: 'Total Gasto (R$)',
          data: dadosCategorias.map(d => d.total),
          backgroundColor: backgrounds,
          borderColor: dadosCategorias.map(d => d.cor),
          borderWidth: 2,
          borderRadius: 12,
          borderSkipped: false,
          barPercentage: 0.7,
          categoryPercentage: 0.85,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(30, 30, 30, 0.95)',
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 12 },
            padding: 14,
            cornerRadius: 10,
            displayColors: true,
            callbacks: {
              label: function (context) {
                const valor = context.parsed.y;
                const percentual = ((valor / totalGeral) * 100).toFixed(1);
                const categoria = dadosCategorias[context.dataIndex];
                const qtdItens = categoria.itens.length;
                return [
                  `Total: R$ ${formatMoneySimples(valor)}`,
                  `Representa: ${percentual}% do total`,
                  `${qtdItens} item(ns) nesta categoria`
                ];
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
              drawBorder: false
            },
            ticks: {
              callback: function (value) {
                if (value >= 1000000) {
                  return 'R$ ' + (value / 1000000).toFixed(1) + 'M';
                } else if (value >= 1000) {
                  return 'R$ ' + (value / 1000).toFixed(0) + 'k';
                }
                return 'R$ ' + value.toFixed(0);
              },
              font: { size: 11 },
              padding: 10
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 12, weight: '600' },
              maxRotation: 45,
              minRotation: 0,
              padding: 10
            }
          }
        },
        layout: {
          padding: { top: 40 }
        }
      },
      plugins: [{
        id: 'valoresNasBarras',
        afterDatasetsDraw(chart) {
          const { ctx } = chart;
          const meta = chart.getDatasetMeta(0);
          meta.data.forEach((bar, index) => {
            const data = dadosCategorias[index];
            const valor = data.total;
            const percentual = ((valor / totalGeral) * 100).toFixed(1);
            const x = bar.x;
            const y = bar.y;
            ctx.save();
            ctx.font = 'bold 14px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#1a1a1a';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`R$ ${formatMoneySimples(valor)}`, x, y - 12);
            ctx.font = '11px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#6b7280';
            ctx.fillText(`${percentual}%`, x, y - 32);
            ctx.restore();
          });
        }
      }]
    });

    const maiorCategoria = dadosCategorias[0];
    document.getElementById('graficoMensalResumo').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;">
        <div style="text-align:center;">
          <div style="font-size:0.75rem;color:var(--text-light);margin-bottom:0.25rem;">TOTAL GERAL</div>
          <div style="font-size:1.3rem;font-weight:700;color:var(--primary);">R$ ${formatMoneySimples(totalGeral)}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:0.75rem;color:var(--text-light);margin-bottom:0.25rem;">MAIOR GASTO</div>
          <div style="font-size:1.1rem;font-weight:600;color:var(--warning);">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${maiorCategoria.cor};margin-right:4px;"></span>
            ${maiorCategoria.nome}
          </div>
          <div style="font-size:0.9rem;color:var(--text);">R$ ${formatMoneySimples(maiorCategoria.total)}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:0.75rem;color:var(--text-light);margin-bottom:0.25rem;">CATEGORIAS</div>
          <div style="font-size:1.3rem;font-weight:700;color:var(--info);">${dadosCategorias.length}</div>
        </div>
      </div>
      <details style="margin-top:1rem;cursor:pointer;">
        <summary style="font-size:0.85rem;font-weight:600;color:var(--text-light);">
          <i class="fas fa-list"></i> Detalhamento por categoria
        </summary>
        <div style="margin-top:0.75rem;font-size:0.8rem;max-height:250px;overflow-y:auto;">
          ${dadosCategorias.map(cat => `
            <div style="padding:0.5rem;margin-bottom:0.5rem;background:#f9fafb;border-radius:6px;border-left:3px solid ${cat.cor};">
              <div style="display:flex;justify-content:space-between;font-weight:600;margin-bottom:0.25rem;">
                <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${cat.cor};margin-right:4px;"></span>${cat.nome}</span>
                <span style="color:var(--primary);">R$ ${formatMoneySimples(cat.total)} (${((cat.total / totalGeral) * 100).toFixed(1)}%)</span>
              </div>
              <div style="color:var(--text-light);font-size:0.75rem;padding-left:12px;">
                ${cat.itens.slice(0, 5).map(item => `
                  <div>• ${item.nome} <span style="color:var(--text-light);">${item.setor}</span> - R$ ${formatMoneySimples(item.valor)}</div>
                `).join('')}
                ${cat.itens.length > 5 ? `<div style="font-style:italic;">... e mais ${cat.itens.length - 5} item(ns)</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </details>
    `;
  }

  window.abrirGraficoConsolidado = function () {
    if (periodosSelecionadosResumo.size === 0) {
      alert('Selecione ao menos um período marcando o checkbox nos cards!');
      return;
    }

    const tagsDiv = document.getElementById('graficoConsolidadoTags');
    tagsDiv.innerHTML = Array.from(periodosSelecionadosResumo).map(pid => {
      const per = periodos.find(p => p.id === pid);
      if (!per) return '';
      return `<span class="periodo-tag" style="background:rgba(13,144,79,0.15);color:var(--primary);">
        ${getNomeMes(per.mes)}/${per.ano}
      </span>`;
    }).join('');

    document.getElementById('modalGraficoConsolidado').classList.add('active');
    setTimeout(() => {
      criarGraficoConsolidado();
    }, 200);
  };

  function criarGraficoConsolidado() {
    if (graficoConsolidadoChart) {
      graficoConsolidadoChart.destroy();
      graficoConsolidadoChart = null;
    }

    const categoriasAgrupadas = {};
    let totalGeral = 0;

    periodosSelecionadosResumo.forEach(pid => {
      const sets = getSetoresDoPeriodo(pid);
      sets.forEach(setor => {
        const itens = itensCusto.filter(i => i.setorId === setor.id);
        itens.forEach(item => {
          const valorAplicado = item.valorTotal * item.percentual / 100;
          const cat = categorias.find(c => c.id === item.categoriaId);
          const catNome = cat ? cat.nome : 'Sem Categoria';
          const catCor = cat ? cat.cor : '#999999';
          if (!categoriasAgrupadas[catNome]) {
            categoriasAgrupadas[catNome] = {
              nome: catNome,
              cor: catCor,
              total: 0
            };
          }
          categoriasAgrupadas[catNome].total += valorAplicado;
          totalGeral += valorAplicado;
        });
      });
    });

    const dadosCategorias = Object.values(categoriasAgrupadas).sort((a, b) => b.total - a.total);

    if (dadosCategorias.length === 0) return;

    const canvas = document.getElementById('graficoConsolidadoCanvas');
    const ctx = canvas.getContext('2d');

    const backgrounds = dadosCategorias.map((d) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, 450);
      gradient.addColorStop(0, d.cor + 'CC');
      gradient.addColorStop(1, d.cor + '44');
      return gradient;
    });

    graficoConsolidadoChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: dadosCategorias.map(d => d.nome),
        datasets: [{
          label: 'Total Gasto (R$)',
          data: dadosCategorias.map(d => d.total),
          backgroundColor: backgrounds,
          borderColor: dadosCategorias.map(d => d.cor),
          borderWidth: 2,
          borderRadius: 12,
          borderSkipped: false,
          barPercentage: 0.7,
          categoryPercentage: 0.85,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(30, 30, 30, 0.95)',
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 12 },
            padding: 14,
            cornerRadius: 10,
            callbacks: {
              label: function (context) {
                const valor = context.parsed.y;
                const percentual = ((valor / totalGeral) * 100).toFixed(1);
                return [
                  `Total: R$ ${formatMoneySimples(valor)}`,
                  `Representa: ${percentual}% do total geral`,
                  `${periodosSelecionadosResumo.size} período(s) analisado(s)`
                ];
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
              drawBorder: false
            },
            ticks: {
              callback: function (value) {
                if (value >= 1000000) {
                  return 'R$ ' + (value / 1000000).toFixed(1) + 'M';
                } else if (value >= 1000) {
                  return 'R$ ' + (value / 1000).toFixed(0) + 'k';
                }
                return 'R$ ' + value.toFixed(0);
              },
              font: { size: 11 },
              padding: 10
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 12, weight: '600' },
              maxRotation: 45,
              minRotation: 0,
              padding: 10
            }
          }
        },
        layout: {
          padding: { top: 40 }
        }
      },
      plugins: [{
        id: 'valoresNasBarrasConsolidado',
        afterDatasetsDraw(chart) {
          const { ctx } = chart;
          const meta = chart.getDatasetMeta(0);
          meta.data.forEach((bar, index) => {
            const data = dadosCategorias[index];
            const valor = data.total;
            const percentual = ((valor / totalGeral) * 100).toFixed(1);
            const x = bar.x;
            const y = bar.y;
            ctx.save();
            ctx.font = 'bold 14px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#1a1a1a';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`R$ ${formatMoneySimples(valor)}`, x, y - 12);
            ctx.font = '11px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#6b7280';
            ctx.fillText(`${percentual}%`, x, y - 32);
            ctx.restore();
          });
        }
      }]
    });

    const infoDiv = document.getElementById('graficoConsolidadoInfo');
    if (infoDiv) {
      const maiorCategoria = dadosCategorias[0];
      infoDiv.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;text-align:center;">
          <div>
            <div style="color:var(--text-light);font-size:0.75rem;">Total Consolidado</div>
            <div style="font-size:1.3rem;font-weight:700;color:var(--primary);">R$ ${formatMoneySimples(totalGeral)}</div>
          </div>
          <div>
            <div style="color:var(--text-light);font-size:0.75rem;">Maior Categoria</div>
            <div style="font-weight:600;color:var(--warning);">${maiorCategoria.nome}</div>
            <div style="font-size:0.9rem;">R$ ${formatMoneySimples(maiorCategoria.total)}</div>
          </div>
          <div>
            <div style="color:var(--text-light);font-size:0.75rem;">Períodos</div>
            <div style="font-size:1.3rem;font-weight:700;color:var(--info);">${periodosSelecionadosResumo.size}</div>
          </div>
        </div>
      `;
    }
  }

  window.exportarGraficoMensal = function () {
    const canvas = document.getElementById('graficoMensalCanvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `grafico_categorias_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  window.exportarGraficoConsolidado = function () {
    const canvas = document.getElementById('graficoConsolidadoCanvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `grafico_consolidado_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // ========== RENDERIZAÇÃO ==========

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
    const anosDisponiveis = [...new Set(periodos.map(p => p.ano))].sort((a, b) => b - a);
    let periodosFiltrados = [...periodos];
    if (filtroAnoAtual !== 'todos') {
      periodosFiltrados = periodosFiltrados.filter(p => p.ano === parseInt(filtroAnoAtual));
    }
    const periodosOrdenados = periodosFiltrados.sort((a, b) => {
      if (a.ano !== b.ano) return b.ano - a.ano;
      return b.mes - a.mes;
    });

    const resumoConsolidado = calcularResumoConsolidado();

    container.innerHTML = `
      ${resumoConsolidado ? `
      <div class="resumo-consolidado" id="resumoConsolidado">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
          <h3 style="margin:0;"><i class="fas fa-layer-group"></i> Resumo Consolidado</h3>
          <button class="btn btn-purple btn-sm" onclick="window.abrirGraficoConsolidado()">
            <i class="fas fa-chart-bar"></i> Ver Gráfico
          </button>
        </div>
        <div class="periodos-selecionados-tags">
          ${Array.from(periodosSelecionadosResumo).map(pid => {
            const per = periodos.find(p => p.id === pid);
            if (!per) return '';
            return `<span class="periodo-tag">
              ${getNomeMes(per.mes)}/${per.ano}
              <span class="remover-tag" onclick="window.removerPeriodoResumo('${pid}')" title="Remover">×</span>
            </span>`;
          }).join('')}
          <span class="btn-selecionar-todos" onclick="window.limparSelecaoResumo()">Limpar seleção</span>
        </div>
        <div class="stats-grid-resumo">
          <div class="stat-resumo">
            <div class="sr-valor">${resumoConsolidado.qtdPeriodos}</div>
            <div class="sr-label">Períodos</div>
          </div>
          <div class="stat-resumo">
            <div class="sr-valor">${resumoConsolidado.qtdSetores}</div>
            <div class="sr-label">Setores</div>
          </div>
          <div class="stat-resumo">
            <div class="sr-valor">${formatMoney(resumoConsolidado.custoTotal)}</div>
            <div class="sr-label">Custo Total</div>
          </div>
          <div class="stat-resumo">
            <div class="sr-valor">${formatNumber(resumoConsolidado.producaoTotal, 0)} kg</div>
            <div class="sr-label">Produção Total</div>
          </div>
          <div class="stat-resumo destaque">
            <div class="sr-valor">${formatMoney(resumoConsolidado.custoPorKg)}/kg</div>
            <div class="sr-label">Custo Médio/KG</div>
          </div>
        </div>
      </div>
      ` : ''}
      <div class="alert-info" style="margin-bottom:1.5rem;">
        <i class="fas fa-hand-pointer"></i>
        <strong>Dica:</strong> Marque os checkboxes nos períodos abaixo para ver o resumo consolidado e gráfico comparativo.
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="fas fa-calendar-alt"></i> Períodos de Análise</span>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <div class="filtro-ano">
              <label style="font-size: 0.8rem; font-weight: 500;">Ano:</label>
              <select id="filtroAno" onchange="window.mudarFiltroAno(this.value)">
                <option value="todos" ${filtroAnoAtual === 'todos' ? 'selected' : ''}>Todos</option>
                ${anosDisponiveis.map(a => `<option value="${a}" ${filtroAnoAtual == a ? 'selected' : ''}>${a}</option>`).join('')}
              </select>
            </div>
            <button class="btn btn-primary btn-sm" onclick="window.abrirModalPeriodo()">
              <i class="fas fa-plus"></i> Novo
            </button>
          </div>
        </div>
        ${periodosOrdenados.length === 0 ? '<div style="text-align:center;padding:2rem;"><p style="color:var(--text-light);">Nenhum período cadastrado.</p></div>' :
        `<div class="periodos-grid" id="periodosGrid"></div>`
        }
      </div>
    `;

    if (periodosOrdenados.length > 0) {
      const grid = document.getElementById('periodosGrid');
      periodosOrdenados.forEach(per => {
        const resumo = calcularResumoPeriodo(per.id, new Set());
        const isSelecionado = periodosSelecionadosResumo.has(per.id);
        const div = document.createElement('div');
        div.className = `periodo-card ${isSelecionado ? 'selecionado-resumo' : ''}`;
        div.innerHTML = `
          <div class="periodo-check">
            <input type="checkbox" ${isSelecionado ? 'checked' : ''}
              onchange="window.togglePeriodoResumo('${per.id}', this.checked)"
              onclick="event.stopPropagation();">
          </div>
          <div class="acoes">
            <button class="btn btn-purple btn-xs" onclick="event.stopPropagation();window.abrirGraficoMensal('${per.id}')" title="Ver gráfico por categoria"><i class="fas fa-chart-bar"></i></button>
            <button class="btn btn-info btn-xs" onclick="event.stopPropagation();window.abrirCopiarPeriodo('${per.id}')" title="Copiar período completo"><i class="fas fa-copy"></i></button>
            <button class="btn btn-outline btn-xs" onclick="event.stopPropagation();window.editarPeriodo('${per.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger btn-xs" onclick="event.stopPropagation();window.excluirPeriodo('${per.id}')"><i class="fas fa-trash"></i></button>
          </div>
          <div class="periodo-titulo" onclick="window.selecionarPeriodo('${per.id}')">
            <i class="fas fa-calendar-check"></i> ${getNomeMes(per.mes)}/${per.ano}
          </div>
          <div class="periodo-obs" onclick="window.selecionarPeriodo('${per.id}')">${per.obs || 'Sem descrição'}</div>
          <div class="periodo-stats" onclick="window.selecionarPeriodo('${per.id}')">
            <div class="periodo-stat"><span class="label">Setores</span><span class="valor">${resumo.qtdSetores}</span></div>
            <div class="periodo-stat"><span class="label">Custos Fixos</span><span class="valor">${getCustosFixosDoPeriodo(per.id).length}</span></div>
            <div class="periodo-stat"><span class="label">Custo Total</span><span class="valor money">${formatMoney(resumo.custoTotalGeral)}</span></div>
            <div class="periodo-stat"><span class="label">Produção Total</span><span class="valor">${formatNumber(resumo.producaoTotalGeral, 0)} kg</span></div>
            <div class="periodo-stat"><span class="label">Custo/KG</span><span class="valor money" style="color:var(--warning);">${formatMoney(resumo.custoPorKgGeral)}/kg</span></div>
          </div>
        `;
        grid.appendChild(div);
      });
    }
  }

  // ===== RENDERIZAR SETORES COM SEPARAÇÃO CUSTO/DESPESA =====
  function renderizarSetores() {
    if (!periodoAtual) { navegarPara('periodos'); return; }
    const sets = getSetoresDoPeriodo();
    const resumo = calcularResumoPeriodo();

    const container = document.getElementById('conteudoDinamico');

    // Separar setores por tipo
    const setoresCusto = sets.filter(s => s.tipo === 'custo' || !s.tipo);
    const setoresDespesa = sets.filter(s => s.tipo === 'despesa');

    container.innerHTML = `
      <div class="resumo-consolidado" style="background:linear-gradient(135deg,#2d3748 0%,#1a202c 100%);">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
          <h3 style="color:#63b3ed;margin:0;">
            <i class="fas fa-chart-pie"></i> Fechamento: ${getNomeMes(periodoAtual.mes)}/${periodoAtual.ano}
            <span style="font-size:0.7rem;color:#90caf9;margin-left:0.5rem;">
              (${resumo.qtdProdutosFinais} produto(s) final(is))
            </span>
          </h3>
          <button class="btn btn-purple btn-sm" onclick="window.abrirGraficoMensal('${periodoAtual.id}')">
            <i class="fas fa-chart-bar"></i> Gráfico por Categoria
          </button>
        </div>
        ${setoresExcluidosResumo.size > 0 ? `
        <div class="periodos-selecionados-tags" style="margin-bottom:1rem;">
          <span class="periodo-tag" style="background:rgba(239,83,80,0.3);">
            <i class="fas fa-eye-slash"></i> ${setoresExcluidosResumo.size} setor(es) excluído(s)
            <span class="remover-tag" onclick="window.limparSetoresExcluidos()" title="Restaurar todos">×</span>
          </span>
        </div>
        ` : ''}
        <div class="stats-grid-resumo">
          <div class="stat-resumo">
            <div class="sr-valor">${resumo.qtdSetores}</div>
            <div class="sr-label">Setores Ativos</div>
          </div>
          <div class="stat-resumo">
            <div class="sr-valor">${formatMoney(resumo.custoTotalGeral)}</div>
            <div class="sr-label">Custo Total</div>
          </div>
          <div class="stat-resumo">
            <div class="sr-valor">${formatNumber(resumo.producaoTotalGeral, 0)} kg</div>
            <div class="sr-label">Produção Total</div>
          </div>
          <div class="stat-resumo destaque">
            <div class="sr-valor">${formatMoney(resumo.custoPorKgGeral)}/kg</div>
            <div class="sr-label">Custo por KG</div>
          </div>
        </div>
        
        <!-- Detalhamento dos produtos finais -->
        ${resumo.setoresFinais.length > 0 ? `
        <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,0.1);">
          <div style="font-size:0.75rem;color:#90caf9;margin-bottom:0.5rem;">Detalhamento por Produto Final:</div>
          ${resumo.setoresFinais.map(sf => {
            const tipo = sf.setor.tipo || 'custo';
            return `
              <div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:0.2rem 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                <span>${sf.setor.nome} <span class="badge ${tipo === 'custo' ? 'badge-custo' : 'badge-despesa'}" style="font-size:0.6rem;">${tipo === 'custo' ? 'Custo' : 'Despesa'}</span></span>
                <span>${formatNumber(sf.producao, 0)} kg | ${formatMoney(sf.custoPorKg)}/kg</span>
              </div>
            `;
          }).join('')}
        </div>
        ` : '<div style="margin-top:1rem;font-size:0.8rem;color:#90caf9;">Nenhum produto final cadastrado. Marque ⭐ Produto Final nos setores.</div>'}
      </div>

      <div class="cf-card" id="custosFixosCard">
        <div class="cf-header" onclick="window.toggleCustosFixos()">
          <div style="display:flex;align-items:center;gap:0.75rem;">
            <i class="fas fa-chevron-down" id="cfChevron" style="color:var(--warning);transition:transform 0.3s;"></i>
            <strong style="font-size:0.9rem;"><i class="fas fa-thumbtack" style="color:var(--warning);"></i> Custos Fixos de ${getNomeMes(periodoAtual.mes)}/${periodoAtual.ano}</strong>
          </div>
          <div style="display:flex;align-items:center;gap:1rem;">
            <span style="font-weight:700;font-size:0.9rem;">${formatMoney(getCustosFixosDoPeriodo().reduce((s, cf) => s + cf.valor, 0))}</span>
            <button class="btn btn-warning btn-sm" onclick="event.stopPropagation();window.abrirModalCustoFixo()">
              <i class="fas fa-plus"></i>
            </button>
          </div>
        </div>
        <div id="custosFixosBody" class="cf-body" style="display:none;">
          ${getCustosFixosDoPeriodo().length === 0 ? `
          <div style="padding:1rem;text-align:center;color:var(--text-light);">
            Nenhum custo fixo cadastrado para este período.
          </div>
          ` : `
          <div class="table-wrap" style="margin-top:0.5rem;">
            <table style="font-size:0.8rem;width:100%;">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Categoria</th>
                  <th>Valor</th>
                  <th style="width:60px;">Ações</th>
                </tr>
              </thead>
              <tbody>
                ${getCustosFixosDoPeriodo().map(cf => {
                  const cat = categorias.find(c => c.id === cf.categoriaId);
                  return `
                    <tr>
                      <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${cat?.cor || '#999'};margin-right:6px;"></span>${cf.nome}</td>
                      <td>${cat?.nome || 'Sem categoria'}</td>
                      <td class="money">${formatMoney(cf.valor)}</td>
                      <td>
                        <button class="btn btn-outline btn-xs" onclick="event.stopPropagation();window.editarCustoFixo('${cf.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger btn-xs" onclick="event.stopPropagation();window.excluirCustoFixo('${cf.id}')"><i class="fas fa-trash"></i></button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          `}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="fas fa-industry"></i> Setores</span>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="window.abrirModalSetor()"><i class="fas fa-plus"></i> Novo</button>
            <button class="btn btn-success btn-sm" onclick="window.alternarSelecaoTipo('custo')"><i class="fas fa-check-double"></i> Todos Custos</button>
            <button class="btn btn-danger btn-sm" onclick="window.alternarSelecaoTipo('despesa')"><i class="fas fa-check-double"></i> Todos Despesas</button>
            <button class="btn btn-outline btn-sm" onclick="window.deselecionarTodosSetores()"><i class="fas fa-times"></i> Desmarcar</button>
            <button class="btn btn-purple btn-sm" onclick="window.gerarPDFCentralCustos()"><i class="fas fa-file-pdf"></i> PDF</button>
            <button class="btn btn-outline btn-sm" onclick="window.navegarPara('periodos')"><i class="fas fa-arrow-left"></i> Voltar</button>
          </div>
        </div>
        <!-- Seção de Custos -->
        <div class="setor-secao">
          <div class="secao-titulo">
            <i class="fas fa-coins" style="color:var(--custo-color);"></i> Custos
            <span class="badge badge-custo">${setoresCusto.length}</span>
          </div>
          <div class="setores-grid" id="setoresGridCusto"></div>
        </div>
        <!-- Seção de Despesas -->
        <div class="setor-secao">
          <div class="secao-titulo">
            <i class="fas fa-receipt" style="color:var(--despesa-color);"></i> Despesas
            <span class="badge badge-despesa">${setoresDespesa.length}</span>
          </div>
          <div class="setores-grid" id="setoresGridDespesa"></div>
        </div>
      </div>
    `;

    // Renderizar setores de Custo
    const gridCusto = document.getElementById('setoresGridCusto');
    setoresCusto.forEach(setor => {
      gridCusto.appendChild(criarCardSetor(setor));
    });
    if (setoresCusto.length === 0) {
      gridCusto.innerHTML = '<p style="text-align:center;padding:1rem;color:var(--text-light);grid-column:1/-1;">Nenhum custo cadastrado</p>';
    }

    // Renderizar setores de Despesa
    const gridDespesa = document.getElementById('setoresGridDespesa');
    setoresDespesa.forEach(setor => {
      gridDespesa.appendChild(criarCardSetor(setor));
    });
    if (setoresDespesa.length === 0) {
      gridDespesa.innerHTML = '<p style="text-align:center;padding:1rem;color:var(--text-light);grid-column:1/-1;">Nenhuma despesa cadastrada</p>';
    }

    // Adicionar evento para mudar tipo diretamente nos cards
    document.querySelectorAll('.setor-tipo-select').forEach(select => {
      select.removeEventListener('change', window._handleTipoChange);
      select.addEventListener('change', window._handleTipoChange = function() {
        const setorId = this.dataset.setorId;
        const novoTipo = this.value;
        window.atualizarTipoSetor(setorId, novoTipo);
      });
    });
  }

  // Função auxiliar para criar card de setor
  function criarCardSetor(setor) {
    const isFinal = setor.produtoFinal === true;
    const isExcluido = setoresExcluidosResumo.has(setor.id);
    const { totalCusto, totalKg, custoPorKg } = calcularCustosSetor(setor.id);
    const tipo = setor.tipo || 'custo';
    const div = document.createElement('div');
    div.className = `setor-card tipo-${tipo} ${isFinal ? 'produto-final' : ''} ${isExcluido ? 'excluido-resumo' : ''}`;
    div.dataset.setorId = setor.id;

    div.innerHTML = `
      <div class="setor-toggle" onclick="event.stopPropagation();" title="${isExcluido ? 'Incluir no resumo' : 'Excluir do resumo'}">
        <input type="checkbox" id="toggle_setor_${setor.id}" ${isExcluido ? 'checked' : ''}
          onchange="window.toggleSetorResumo('${setor.id}', this.checked)">
      </div>
      <div class="setor-acoes">
        <button class="btn btn-outline btn-xs" onclick="event.stopPropagation();window.editarSetor('${setor.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn btn-danger btn-xs" onclick="event.stopPropagation();window.excluirSetor('${setor.id}')"><i class="fas fa-trash"></i></button>
      </div>
      <div class="setor-nome" onclick="window.selecionarSetor('${setor.id}')">
        ${setor.nome}
        <span class="badge ${isFinal ? 'badge-orange' : 'badge-green'}">${isFinal ? '⭐ FINAL' : 'Etapa ' + setor.ordem}</span>
        <select class="setor-tipo-select" data-setor-id="${setor.id}" onclick="event.stopPropagation();">
          <option value="custo" ${tipo === 'custo' ? 'selected' : ''}>💰 Custo</option>
          <option value="despesa" ${tipo === 'despesa' ? 'selected' : ''}>📝 Despesa</option>
        </select>
        ${isExcluido ? '<span class="badge" style="background:#ffcdd2;color:#c62828;">Excluído</span>' : ''}
      </div>
      <div class="setor-desc" onclick="window.selecionarSetor('${setor.id}')">${setor.descricao || ''}</div>
      <div class="setor-info" onclick="window.selecionarSetor('${setor.id}')">
        <div><div class="info-label">Custo</div><div class="info-valor money">${formatMoney(totalCusto)}</div></div>
        <div><div class="info-label">Produção</div><div class="info-valor">${formatNumber(totalKg, 0)} kg</div></div>
        <div style="grid-column:1/-1;">
          <div class="info-label">Custo Médio/KG</div>
          <div class="info-valor" style="color:${totalKg > 0 ? (isFinal ? '#e65100' : 'var(--teal)') : 'var(--text-light)'};">
            ${totalKg > 0 ? formatMoney(custoPorKg) + '/kg' : 'Sem produção registrada'}
          </div>
        </div>
      </div>
    `;
    return div;
  }

  // ===== FUNÇÕES DE SELEÇÃO EM MASSA (ALTERNA) =====
  window.alternarSelecaoTipo = function (tipo) {
    const sets = getSetoresDoPeriodo();
    // Verificar se todos os setores deste tipo estão excluídos
    const setsDoTipo = sets.filter(s => (s.tipo || 'custo') === tipo);
    const todosExcluidos = setsDoTipo.every(s => setoresExcluidosResumo.has(s.id));
    
    // Se todos estão excluídos, incluir todos; senão, excluir todos
    setsDoTipo.forEach(s => {
      if (todosExcluidos) {
        setoresExcluidosResumo.delete(s.id);
      } else {
        setoresExcluidosResumo.add(s.id);
      }
    });
    
    // Atualizar os checkboxes
    setsDoTipo.forEach(s => {
      const checkbox = document.getElementById(`toggle_setor_${s.id}`);
      if (checkbox) {
        checkbox.checked = setoresExcluidosResumo.has(s.id);
      }
    });
    
    renderizarSetores();
  };

  window.deselecionarTodosSetores = function () {
    const sets = getSetoresDoPeriodo();
    sets.forEach(s => {
      setoresExcluidosResumo.add(s.id);
      const checkbox = document.getElementById(`toggle_setor_${s.id}`);
      if (checkbox) checkbox.checked = true;
    });
    renderizarSetores();
  };

  // ===== FUNÇÃO PARA ATUALIZAR TIPO DO SETOR =====
  window.atualizarTipoSetor = async function (setorId, novoTipo) {
    const setor = setores.find(s => s.id === setorId);
    if (!setor) {
      console.error('Setor não encontrado:', setorId);
      return;
    }
    
    const tipoAntigo = setor.tipo || 'custo';
    setor.tipo = novoTipo;
    
    try {
      await salvarFB('custos_setores', setor);
      saveLocalData();
      
      const card = document.querySelector(`.setor-card[data-setor-id="${setorId}"]`);
      if (card) {
        card.classList.remove('tipo-custo', 'tipo-despesa');
        card.classList.add(`tipo-${novoTipo}`);
      }
      
      console.log(`🔄 Tipo do setor "${setor.nome}" alterado de "${tipoAntigo}" para "${novoTipo}"`);
    } catch (error) {
      console.error('❌ Erro ao atualizar tipo do setor:', error);
      setor.tipo = tipoAntigo;
      alert('Erro ao atualizar tipo. Tente novamente.');
    }
  };

  // ===== VERIFICAR STATUS DO FIREBASE =====
  function verificarStatusFirebase() {
    const statusEl = document.getElementById('firebaseStatus');
    if (!statusEl) return;
    
    if (usandoFirebase && db) {
      db.collection('custos_periodos').limit(1).get()
        .then(() => {
          statusEl.innerHTML = '<span class="status-dot"></span> Firebase ✅';
          statusEl.className = 'firebase-status status-firebase';
          console.log('✅ Firebase conectado e funcionando!');
        })
        .catch((err) => {
          console.warn('⚠️ Firebase conectado mas com erro de leitura:', err);
          statusEl.innerHTML = '<span class="status-dot"></span> Firebase (erro)';
          statusEl.className = 'firebase-status status-local';
        });
    } else if (usandoFirebase) {
      statusEl.innerHTML = '<span class="status-dot"></span> Firebase (offline)';
      statusEl.className = 'firebase-status status-local';
    } else {
      statusEl.innerHTML = '<span class="status-dot"></span> Local';
      statusEl.className = 'firebase-status status-local';
    }
  }

  // ===== FUNÇÕES PARA PERÍODOS =====
  window.mudarFiltroAno = function (value) {
    filtroAnoAtual = value;
    renderizarTela();
  };

  window.togglePeriodoResumo = function (periodoId, checked) {
    if (checked) {
      periodosSelecionadosResumo.add(periodoId);
    } else {
      periodosSelecionadosResumo.delete(periodoId);
    }
    renderizarTela();
  };

  window.removerPeriodoResumo = function (periodoId) {
    periodosSelecionadosResumo.delete(periodoId);
    renderizarTela();
  };

  window.limparSelecaoResumo = function () {
    periodosSelecionadosResumo.clear();
    renderizarTela();
  };

  window.toggleSetorResumo = function (setorId, checked) {
    if (checked) {
      setoresExcluidosResumo.add(setorId);
    } else {
      setoresExcluidosResumo.delete(setorId);
    }
    renderizarTela();
  };

  window.limparSetoresExcluidos = function () {
    setoresExcluidosResumo.clear();
    renderizarTela();
  };

  // ===== FUNÇÕES DE NAVEGAÇÃO =====
  window.navegarPara = function (nivel) {
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

  window.selecionarPeriodo = function (id) {
    periodoAtual = periodos.find(p => p.id === id);
    setorAtual = null;
    nivelAtual = 'setores';
    setoresExcluidosResumo.clear();
    renderizarTela();
  };

  window.selecionarSetor = function (id) {
    setorAtual = setores.find(s => s.id === id);
    nivelAtual = 'analise';
    renderizarTela();
  };

  function atualizarBreadcrumb() {
    const bc = document.getElementById('breadcrumb');
    let html = `<span class="breadcrumb-item ${nivelAtual === 'periodos' ? 'active' : ''}" onclick="window.navegarPara('periodos')"><i class="fas fa-home"></i> Home</span>`;

    if (nivelAtual === 'materiais') {
      html += `<span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span><span class="breadcrumb-item active">Materiais</span>`;
    } else if (nivelAtual === 'historicoMaterial') {
      const mat = materiais.find(m => m.id === window.historicoMaterialId);
      html += `<span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span><span class="breadcrumb-item active">Histórico: ${mat?.nome || ''}</span>`;
    } else if (periodoAtual) {
      html += `<span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span><span class="breadcrumb-item ${nivelAtual === 'setores' ? 'active' : ''}" onclick="window.navegarPara('setores')">${getNomeMes(periodoAtual.mes)}/${periodoAtual.ano}</span>`;
      if (setorAtual && nivelAtual === 'analise') {
        html += `<span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span><span class="breadcrumb-item active">${setorAtual.nome}</span>`;
      }
    }
    bc.innerHTML = html;
  }

  // ========== CRUD PERÍODOS ==========

  window.abrirModalPeriodo = function (id = null) {
    document.getElementById('modalPeriodo').classList.add('active');
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

  window.salvarPeriodo = async function () {
    const p = {
      mes: parseInt(document.getElementById('periodoMes').value),
      ano: parseInt(document.getElementById('periodoAno').value),
      obs: document.getElementById('periodoObs').value.trim(),
      createdAt: new Date().toISOString()
    };
    const editId = document.getElementById('periodoEditId').value;
    if (editId) {
      p.id = editId;
      const idx = periodos.findIndex(x => x.id === editId);
      if (idx !== -1) periodos[idx] = p;
    } else {
      p.id = 'per_' + Date.now();
      periodos.push(p);
    }
    await salvarFB('custos_periodos', p);
    saveLocalData();
    window.fecharModal('modalPeriodo');
    renderizarTela();
  };

  window.editarPeriodo = (id) => window.abrirModalPeriodo(id);

  window.excluirPeriodo = async function (id) {
    if (confirm('Excluir período? Isso removerá todos os setores, itens, produções e custos fixos vinculados!')) {
      const sets = setores.filter(s => s.periodoId === id);
      sets.forEach(s => {
        itensCusto = itensCusto.filter(i => i.setorId !== s.id);
        producoes = producoes.filter(p => p.setorId !== s.id);
      });
      setores = setores.filter(s => s.periodoId !== id);
      custosFixos = custosFixos.filter(cf => cf.periodoId !== id);
      periodos = periodos.filter(p => p.id !== id);
      periodosSelecionadosResumo.delete(id);
      await excluirFB('custos_periodos', id);
      saveLocalData();
      if (periodoAtual && periodoAtual.id === id) {
        periodoAtual = null;
        setorAtual = null;
        nivelAtual = 'periodos';
      }
      renderizarTela();
    }
  };

  // ========== CRUD SETORES (CORRIGIDO - SEM DUPLICAÇÃO) ==========

  function limparFormularioSetor() {
    document.getElementById('modalSetorTitulo').innerHTML = '<i class="fas fa-plus"></i> Novo Setor';
    document.getElementById('setorEditId').value = '';
    document.getElementById('setorNome').value = '';
    document.getElementById('setorDescricao').value = '';
    document.getElementById('setorOrdem').value = '1';
    document.getElementById('setorProdutoFinal').checked = false;
    document.getElementById('setorTipo').value = 'custo';
  }

  window.abrirModalSetor = function (id = null) {
    if (!periodoAtual) {
      alert('Selecione um período primeiro!');
      return;
    }
    document.getElementById('modalSetor').classList.add('active');
    
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
      } else {
        limparFormularioSetor();
      }
    } else {
      limparFormularioSetor();
    }
  };

  window.salvarSetor = async function () {
    if (!periodoAtual) {
      alert('Nenhum período selecionado!');
      return;
    }

    const nome = document.getElementById('setorNome').value.trim();
    if (!nome) {
      alert('Digite o nome do setor!');
      document.getElementById('setorNome').focus();
      return;
    }

    const s = {
      periodoId: periodoAtual.id,
      nome: nome,
      descricao: document.getElementById('setorDescricao').value.trim() || '',
      ordem: parseInt(document.getElementById('setorOrdem').value) || 1,
      produtoFinal: document.getElementById('setorProdutoFinal').checked || false,
      tipo: document.getElementById('setorTipo').value || 'custo',
      createdAt: new Date().toISOString()
    };

    const editId = document.getElementById('setorEditId').value;
    
    try {
      if (editId) {
        s.id = editId;
        const idx = setores.findIndex(x => x.id === editId);
        if (idx !== -1) {
          setores[idx] = { ...setores[idx], ...s };
        } else {
          setores.push(s);
        }
        console.log('✏️ Setor atualizado:', s.nome);
      } else {
        const existe = setores.some(x => 
          x.periodoId === s.periodoId && 
          x.nome.toLowerCase() === s.nome.toLowerCase()
        );
        
        if (existe) {
          if (!confirm(`Já existe um setor com o nome "${s.nome}" neste período. Deseja criar mesmo assim?`)) {
            return;
          }
        }
        
        s.id = 'set_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        setores.push(s);
        console.log('➕ Novo setor criado:', s.nome);
      }

      await salvarFB('custos_setores', s);
      saveLocalData();
      window.fecharModal('modalSetor');
      renderizarTela();
      console.log('✅ Setor salvo com sucesso!');
      
    } catch (error) {
      console.error('❌ Erro ao salvar setor:', error);
      alert('Erro ao salvar setor. Verifique o console para mais detalhes.');
    }
  };

  window.editarSetor = function (id) {
    console.log('✏️ Editando setor ID:', id);
    window.abrirModalSetor(id);
  };

  window.excluirSetor = async function (id) {
    if (!confirm('⚠️ Excluir setor e todos os seus itens/produções?')) return;
    
    try {
      const setor = setores.find(s => s.id === id);
      if (!setor) {
        alert('Setor não encontrado!');
        return;
      }
      
      console.log(`🗑️ Excluindo setor: ${setor.nome} (ID: ${id})`);
      
      const itensParaRemover = itensCusto.filter(i => i.setorId === id);
      console.log(`📦 Removendo ${itensParaRemover.length} itens de custo vinculados`);
      itensCusto = itensCusto.filter(i => i.setorId !== id);
      
      const prodsParaRemover = producoes.filter(p => p.setorId === id);
      console.log(`📦 Removendo ${prodsParaRemover.length} produções vinculadas`);
      producoes = producoes.filter(p => p.setorId !== id);
      
      setores = setores.filter(s => s.id !== id);
      setoresExcluidosResumo.delete(id);
      
      await excluirFB('custos_setores', id);
      saveLocalData();
      
      if (setorAtual && setorAtual.id === id) {
        setorAtual = null;
      }
      
      renderizarTela();
      console.log('✅ Setor excluído com sucesso!');
      
    } catch (error) {
      console.error('❌ Erro ao excluir setor:', error);
      
      try {
        saveLocalData();
      } catch (e) {
        console.error('❌ Erro ao salvar dados após exclusão:', e);
      }
      
      alert(`Erro ao excluir setor: ${error.message || 'Verifique o console para mais detalhes.'}`);
    }
  };

  // ========== CRUD CUSTOS FIXOS ==========

  window.abrirModalCustoFixo = function (id = null) {
    const selCat = document.getElementById('custoFixoCategoria');
    selCat.innerHTML = '<option value="">Selecione uma categoria...</option>' +
      categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

    const selPeriodo = document.getElementById('custoFixoPeriodo');
    selPeriodo.innerHTML = '<option value="">Selecione um período...</option>' +
      periodos.sort((a, b) => b.ano - a.ano || b.mes - a.mes).map(p =>
        `<option value="${p.id}">${getNomeMes(p.mes)}/${p.ano}</option>`
      ).join('');

    document.getElementById('modalCustoFixo').classList.add('active');

    if (id) {
      const cf = custosFixos.find(x => x.id === id);
      if (cf) {
        document.getElementById('custoFixoTituloTexto').innerText = 'Editar Custo Fixo';
        document.getElementById('custoFixoEditId').value = cf.id;
        document.getElementById('custoFixoCategoria').value = cf.categoriaId || '';
        document.getElementById('custoFixoNome').value = cf.nome;
        document.getElementById('custoFixoValor').value = cf.valor;
        document.getElementById('custoFixoPeriodo').value = cf.periodoId || '';
      }
    } else {
      document.getElementById('custoFixoTituloTexto').innerText = 'Novo Custo Fixo';
      document.getElementById('custoFixoEditId').value = '';
      document.getElementById('custoFixoCategoria').value = '';
      document.getElementById('custoFixoNome').value = '';
      document.getElementById('custoFixoValor').value = '';
      if (periodoAtual) {
        document.getElementById('custoFixoPeriodo').value = periodoAtual.id;
      } else {
        document.getElementById('custoFixoPeriodo').value = '';
      }
    }
  };

  window.salvarCustoFixo = async function () {
    const cf = {
      nome: document.getElementById('custoFixoNome').value.trim(),
      categoriaId: document.getElementById('custoFixoCategoria').value || null,
      valor: parseFloat(document.getElementById('custoFixoValor').value) || 0,
      periodoId: document.getElementById('custoFixoPeriodo').value || null,
      createdAt: new Date().toISOString()
    };

    if (!cf.nome || cf.valor <= 0) { alert('Preencha nome e valor!'); return; }
    if (!cf.periodoId) { alert('Selecione um período!'); return; }

    const editId = document.getElementById('custoFixoEditId').value;
    if (editId) {
      cf.id = editId;
      const idx = custosFixos.findIndex(x => x.id === editId);
      if (idx !== -1) custosFixos[idx] = cf;
    } else {
      cf.id = 'cf_' + Date.now();
      custosFixos.push(cf);
    }

    await salvarFB('custos_fixos', cf);
    saveLocalData();
    window.fecharModal('modalCustoFixo');
    renderizarTela();
  };

  window.editarCustoFixo = (id) => window.abrirModalCustoFixo(id);

  window.excluirCustoFixo = async function (id) {
    if (confirm('Excluir custo fixo?')) {
      custosFixos = custosFixos.filter(c => c.id !== id);
      await excluirFB('custos_fixos', id);
      saveLocalData();
      renderizarTela();
    }
  };

  window.toggleCustosFixos = function () {
    const body = document.getElementById('custosFixosBody');
    const chevron = document.getElementById('cfChevron');
    if (!body || !chevron) return;

    if (body.style.display === 'none' || body.style.display === '') {
      body.style.display = 'block';
      chevron.style.transform = 'rotate(180deg)';
    } else {
      body.style.display = 'none';
      chevron.style.transform = 'rotate(0deg)';
    }
  };

  // ========== COPIAR PERÍODO ==========

  window.abrirCopiarPeriodo = function (periodoId) {
    periodoOrigemCopia = periodoId;
    const per = periodos.find(p => p.id === periodoId);
    if (!per) return;
    document.getElementById('copiarOrigem').value = `${getNomeMes(per.mes)}/${per.ano} - ${per.obs || 'Sem descrição'}`;
    document.getElementById('copiarMes').value = (per.mes % 12) + 1;
    document.getElementById('copiarAno').value = per.mes === 12 ? per.ano + 1 : per.ano;
    document.getElementById('modalCopiarPeriodo').classList.add('active');
  };

  window.copiarPeriodo = async function () {
    if (!periodoOrigemCopia) return;

    const perOrigem = periodos.find(p => p.id === periodoOrigemCopia);
    if (!perOrigem) return;

    const novoMes = parseInt(document.getElementById('copiarMes').value);
    const novoAno = parseInt(document.getElementById('copiarAno').value);

    const periodoExistente = periodos.find(p => p.mes === novoMes && p.ano === novoAno);
    if (periodoExistente) {
      alert(`Já existe um período para ${getNomeMes(novoMes)}/${novoAno}! Escolha outro mês/ano.`);
      return;
    }

    if (!confirm(`Copiar TODOS os dados de ${getNomeMes(perOrigem.mes)}/${perOrigem.ano} para ${getNomeMes(novoMes)}/${novoAno}?\n\nSetores, itens, produções e custos fixos serão copiados.`)) {
      return;
    }

    document.getElementById('loadingOverlay').classList.add('active');

    try {
      const novoPeriodo = {
        mes: novoMes,
        ano: novoAno,
        obs: `Copiado de ${getNomeMes(perOrigem.mes)}/${perOrigem.ano}`,
        createdAt: new Date().toISOString(),
        id: 'per_' + Date.now()
      };
      periodos.push(novoPeriodo);
      await salvarFB('custos_periodos', novoPeriodo);

      const setoresOrigem = setores.filter(s => s.periodoId === periodoOrigemCopia);
      const mapaSetoresIds = new Map();
      let totalItensCopiados = 0;
      let totalProducoesCopiadas = 0;

      for (const setorOrig of setoresOrigem) {
        const novoSetorId = 'set_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
        mapaSetoresIds.set(setorOrig.id, novoSetorId);

        const novoSetor = {
          periodoId: novoPeriodo.id,
          nome: setorOrig.nome,
          descricao: setorOrig.descricao,
          ordem: setorOrig.ordem,
          produtoFinal: setorOrig.produtoFinal || false,
          tipo: setorOrig.tipo || 'custo',
          createdAt: new Date().toISOString(),
          id: novoSetorId
        };
        setores.push(novoSetor);
        await salvarFB('custos_setores', novoSetor);

        const itensDoSetor = itensCusto.filter(i => i.setorId === setorOrig.id);
        for (const item of itensDoSetor) {
          const novoItem = {
            ...item,
            id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8),
            setorId: novoSetorId,
            createdAt: new Date().toISOString()
          };
          itensCusto.push(novoItem);
          await salvarFB('custos_itens', novoItem);
          totalItensCopiados++;
        }

        const producoesDoSetor = producoes.filter(p => p.setorId === setorOrig.id);
        for (const prod of producoesDoSetor) {
          const novaProd = {
            ...prod,
            id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8),
            setorId: novoSetorId,
            createdAt: new Date().toISOString()
          };
          producoes.push(novaProd);
          await salvarFB('custos_producoes', novaProd);
          totalProducoesCopiadas++;
        }
      }

      const custosFixosOrigem = custosFixos.filter(cf => cf.periodoId === periodoOrigemCopia);
      let totalCFCopiados = 0;
      for (const cf of custosFixosOrigem) {
        const novoCF = {
          ...cf,
          id: 'cf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          periodoId: novoPeriodo.id,
          createdAt: new Date().toISOString()
        };
        custosFixos.push(novoCF);
        await salvarFB('custos_fixos', novoCF);
        totalCFCopiados++;
      }

      window.fecharModal('modalCopiarPeriodo');
      document.getElementById('loadingOverlay').classList.remove('active');

      alert(
        `Cópia completa realizada com sucesso!\n\n` +
        `Período: ${getNomeMes(novoMes)}/${novoAno}\n` +
        `Setores copiados: ${setoresOrigem.length}\n` +
        `Itens de custo copiados: ${totalItensCopiados}\n` +
        `Produções copiadas: ${totalProducoesCopiadas}\n` +
        `Custos fixos copiados: ${totalCFCopiados}\n\n` +
        `Agora você pode editar os valores conforme necessário.`
      );

      renderizarTela();
    } catch (error) {
      console.error('Erro ao copiar período:', error);
      document.getElementById('loadingOverlay').classList.remove('active');
      alert('Erro ao copiar período. Verifique o console para mais detalhes.');
    }
  };

  // ========== ANÁLISE ==========

  function renderizarAnalise() {
    if (!setorAtual) { navegarPara('setores'); return; }
    const { totalCusto, totalKg, custoPorKg } = calcularCustosSetor(setorAtual.id);
    const container = document.getElementById('conteudoDinamico');
    container.innerHTML = `
      <div class="stats-grid" style="margin-bottom:1.5rem;">
        <div class="stat-card"><div class="stat-icon"><i class="fas fa-dollar-sign"></i></div><div class="stat-value">${formatMoney(totalCusto)}</div><div class="stat-label">Custo Total</div></div>
        <div class="stat-card"><div class="stat-icon"><i class="fas fa-weight-hanging"></i></div><div class="stat-value">${formatNumber(totalKg, 0)} kg</div><div class="stat-label">Produção</div></div>
        <div class="stat-card"><div class="stat-icon"><i class="fas fa-chart-line"></i></div><div class="stat-value">${totalKg > 0 ? formatMoney(custoPorKg) + '/kg' : 'N/A'}</div><div class="stat-label">Custo Médio/KG</div></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title"><i class="fas fa-chart-pie"></i> Distribuição - ${setorAtual.nome}</span><button class="btn btn-outline btn-sm" onclick="window.navegarPara('setores')"><i class="fas fa-arrow-left"></i> Voltar</button></div>
        <div style="display:flex;flex-wrap:wrap;gap:1rem;"><div style="flex:1;min-width:250px;"><canvas id="pieChart" style="max-height:250px;"></canvas></div><div style="flex:1;min-width:250px;"><canvas id="barChart" style="max-height:250px;"></canvas></div></div>
      </div>
      <div style="display:grid;gap:1.5rem;grid-template-columns:repeat(auto-fit,minmax(350px,1fr));margin-top:1.5rem;">
        <div class="card"><div class="card-header"><span class="card-title">Categorias</span><button class="btn btn-success btn-sm" onclick="window.abrirModalCategoria()"><i class="fas fa-plus"></i></button></div><div id="categoriasList"></div></div>
        <div class="card"><div class="card-header"><span class="card-title">Itens</span><button class="btn btn-primary btn-sm" onclick="window.abrirModalItemCusto()"><i class="fas fa-plus"></i></button></div><div id="itensCustoList"></div></div>
      </div>
      <div class="card" style="margin-top:1.5rem;">
        <div class="card-header"><span class="card-title">Produção</span><button class="btn btn-info btn-sm" onclick="window.abrirModalProducao()"><i class="fas fa-plus"></i></button></div>
        <div id="producaoList"></div>
      </div>
      <div class="card" style="margin-top:1.5rem;">
        <div class="card-header"><span class="card-title">Detalhamento</span></div>
        <div class="table-wrap"><table><thead><tr><th>Categoria</th><th>Item</th><th>Tipo</th><th>Valor</th><th>%</th><th>Aplicado</th><th>Ações</th></tr></thead><tbody id="tabelaCustos"></tbody></table></div>
      </div>
    `;

    carregarCategoriasLista();
    carregarItensCustoLista();
    carregarTabelaCustos();
    carregarProducoesLista();
    setTimeout(atualizarGraficos, 150);
  }

  // ========== MATERIAIS ==========

  function renderizarMateriais() {
    const container = document.getElementById('conteudoDinamico');
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="fas fa-boxes"></i> Materiais</span>
          <div style="display:flex;gap:0.5rem;">
            <button class="btn btn-teal" onclick="window.abrirModalMaterial()"><i class="fas fa-plus"></i> Novo</button>
            <button class="btn btn-outline btn-sm" onclick="window.navegarPara('periodos')"><i class="fas fa-arrow-left"></i> Home</button>
          </div>
        </div>
        <div class="materiais-grid" id="materiaisGridFull"></div>
      </div>
    `;

    const grid = document.getElementById('materiaisGridFull');
    materiais.forEach(mat => {
      const hist = getHistoricoMaterial(mat.id);
      const ult = hist[0];
      const div = document.createElement('div');
      div.className = 'material-card';
      div.onclick = () => window.abrirHistoricoMaterial(mat.id);
      div.innerHTML = `
        <div class="acoes">
          <button class="btn btn-outline btn-xs" onclick="event.stopPropagation();window.editarMaterial('${mat.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-xs" onclick="event.stopPropagation();window.excluirMaterial('${mat.id}')"><i class="fas fa-trash"></i></button>
        </div>
        <div class="material-nome"><i class="fas fa-cube"></i> ${mat.nome}</div>
        <div class="material-desc">${mat.descricao || ''}</div>
        ${ult ? `
          <div class="material-ultimo">
            <strong>${formatMoney(ult.custoKgFinal)}/kg</strong>
            (${getNomeMes(ult.mes)}/${ult.ano})
          </div>
        ` : `
          <div class="material-ultimo">Sem custos registrados</div>
        `}
        <div style="font-size:0.7rem;margin-top:0.5rem;">${hist.length} registro(s)</div>
      `;
      grid.appendChild(div);
    });
  }

  function renderizarHistoricoMaterial() {
    const mat = materiais.find(m => m.id === window.historicoMaterialId);
    if (!mat) { navegarPara('periodos'); return; }
    const hist = getHistoricoMaterial(mat.id);
    const container = document.getElementById('conteudoDinamico');
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="fas fa-history"></i> Histórico: ${mat.nome}</span>
          <button class="btn btn-outline btn-sm" onclick="window.navegarPara('periodos')"><i class="fas fa-arrow-left"></i> Home</button>
        </div>
        ${hist.length === 0 ? '<p style="text-align:center;padding:2rem;">Nenhum custo registrado.</p>' :
        `<div class="historico-grid" id="historicoGrid"></div>`
        }
      </div>
    `;

    if (hist.length > 0) {
      const grid = document.getElementById('historicoGrid');
      hist.forEach(h => {
        const div = document.createElement('div');
        div.className = 'historico-item';
        const cores = ['#0d904f', '#f57c00', '#0277bd', '#6a1b9a', '#c62828', '#00897b'];
        const corIdx = ((h.mes || 1) - 1) % cores.length;
        div.style.borderLeftColor = cores[corIdx];
        div.onclick = () => window.verDetalheCustoMaterial(h.id);
        div.innerHTML = `
          <div class="hi-periodo"><i class="fas fa-calendar"></i> ${getNomeMes(h.mes)}/${h.ano}</div>
          <div class="hi-custo">
            <div class="valor">${formatMoney(h.custoKgFinal)}/kg</div>
            <div class="label">${h.setoresDetalhes?.length || 0} setor(es)</div>
          </div>
        `;
        grid.appendChild(div);
      });
    }
  }

  window.verDetalheCustoMaterial = function (custoId) {
    const custo = custosMateriais.find(c => c.id === custoId);
    if (!custo) return;
    const mat = materiais.find(m => m.id === custo.materialId);
    document.getElementById('historicoDetalheConteudo').innerHTML = `
      <div style="margin-bottom:1rem;">
        <strong>Material:</strong> ${mat?.nome || 'N/D'}<br>
        <strong>Período:</strong> ${getNomeMes(custo.mes)}/${custo.ano}
      </div>
      <div class="custo-material-resumo" style="border-radius:8px;">
        <h3 style="font-size:0.9rem;">Composição</h3>
        ${custo.setoresDetalhes?.map(s => `
          <div class="linha">
            <span>${s.nome} ${s.modo === 'percentual' ? s.valorConfig + '%' : 'Total'}</span>
            <span class="l-valor">${formatMoney(s.custoKg)}/kg</span>
          </div>
        `).join('') || ''}
        ${custo.insumos?.map(ins => `
          <div class="linha">
            <span>${ins.nome}</span>
            <span class="l-valor">${formatMoney(ins.custoKg)}/kg</span>
          </div>
        `).join('') || ''}
        <div class="linha">
          <span>Subtotal</span>
          <span class="l-valor">${formatMoney(custo.subtotal)}/kg</span>
        </div>
        ${custo.imposto > 0 ? `
          <div class="linha">
            <span>Imposto (${custo.imposto}%)</span>
            <span class="l-valor">${formatMoney(custo.valorImposto)}/kg</span>
          </div>
        ` : ''}
        <div class="linha total">
          <span>CUSTO FINAL</span>
          <span class="l-valor">${formatMoney(custo.custoKgFinal)}/kg</span>
        </div>
        ${custo.valorAtual > 0 ? `
          <div class="linha" style="color:#ffb74d;">
            <span>Valor Praticado</span>
            <span class="l-valor">${formatMoney(custo.valorAtual)}/kg</span>
          </div>
          <div class="linha" style="color:${custo.custoKgFinal <= custo.valorAtual ? '#4caf50' : '#ef5350'};">
            <span>${custo.custoKgFinal <= custo.valorAtual ? 'Lucro de' : 'Prejuízo de'}</span>
            <span class="l-valor">${formatMoney(Math.abs(custo.valorAtual - custo.custoKgFinal))}/kg (${formatNumber(Math.abs(custo.valorAtual - custo.custoKgFinal) / custo.custoKgFinal * 100, 0)}%)</span>
          </div>
        ` : ''}
      </div>
    `;
    document.getElementById('modalHistoricoDetalhe').classList.add('active');
  };

  // ========== CRUD CATEGORIAS ==========

  window.abrirModalCategoria = function (id = null) {
    document.getElementById('modalCategoria').classList.add('active');
    if (id) {
      const c = categorias.find(x => x.id === id);
      if (c) {
        document.getElementById('modalCategoriaTitulo').innerText = 'Editar Categoria';
        document.getElementById('categoriaEditId').value = c.id;
        document.getElementById('categoriaNome').value = c.nome;
        document.getElementById('categoriaCor').value = c.cor;
      }
    } else {
      document.getElementById('modalCategoriaTitulo').innerText = 'Nova Categoria';
      document.getElementById('categoriaEditId').value = '';
      document.getElementById('categoriaNome').value = '';
      document.getElementById('categoriaCor').value = '#0d904f';
    }
  };

  window.salvarCategoria = async function () {
    const c = {
      nome: document.getElementById('categoriaNome').value.trim(),
      cor: document.getElementById('categoriaCor').value
    };
    if (!c.nome) { alert('Digite o nome!'); return; }
    const editId = document.getElementById('categoriaEditId').value;
    if (editId) {
      c.id = editId;
      const idx = categorias.findIndex(x => x.id === editId);
      if (idx !== -1) categorias[idx] = c;
    } else {
      c.id = 'cat_' + Date.now();
      categorias.push(c);
    }
    await salvarFB('custos_categorias', c);
    saveLocalData();
    window.fecharModal('modalCategoria');
    if (nivelAtual === 'analise') renderizarAnalise();
    else renderizarTela();
  };

  window.editarCategoria = (id) => window.abrirModalCategoria(id);

  window.excluirCategoria = async function (id) {
    if (confirm('Excluir categoria? Itens e custos fixos vinculados ficarão sem categoria.')) {
      itensCusto.forEach(i => { if (i.categoriaId === id) i.categoriaId = null; });
      custosFixos.forEach(cf => { if (cf.categoriaId === id) cf.categoriaId = null; });
      categorias = categorias.filter(c => c.id !== id);
      await excluirFB('custos_categorias', id);
      saveLocalData();
      if (nivelAtual === 'analise') renderizarAnalise();
      else renderizarTela();
    }
  };

  // ========== CRUD ITENS CUSTO ==========

  window.mudarTipoItem = function (tipo) {
    document.getElementById('itemTipo').value = tipo;
    document.getElementById('tabNormal').classList.toggle('active', tipo === 'normal');
    document.getElementById('tabFixo').classList.toggle('active', tipo === 'fixo');
    document.getElementById('areaItemNormal').style.display = tipo === 'normal' ? 'block' : 'none';
    document.getElementById('areaItensFixos').style.display = tipo === 'fixo' ? 'block' : 'none';
    document.getElementById('areaItemFixoDetalhe').style.display = 'none';

    if (tipo === 'fixo') {
      const container = document.getElementById('custosFixosSelect');
      const cfsDoPeriodo = getCustosFixosDoPeriodo();
      container.innerHTML = cfsDoPeriodo.length === 0
        ? '<p style="text-align:center;padding:1rem;color:var(--text-light);">Nenhum custo fixo neste período. <a href="#" onclick="window.fecharModal(\'modalItemCusto\');window.abrirModalCustoFixo();return false;">Cadastrar agora</a></p>'
        : cfsDoPeriodo.map(cf => {
          const cat = categorias.find(c => c.id === cf.categoriaId);
          return `
            <div class="custo-fixo-select-item" onclick="window.selecionarCustoFixoParaItem('${cf.id}')" style="border-left:4px solid ${cat?.cor || '#999'};">
              <div>
                <div class="cfs-nome"><i class="fas fa-thumbtack" style="color:var(--warning);"></i> ${cf.nome}</div>
                <div class="cfs-categoria">${cat ? cat.nome : 'Sem categoria'}</div>
              </div>
              <div class="cfs-valor">${formatMoney(cf.valor)}</div>
              <button class="btn btn-warning btn-xs"><i class="fas fa-arrow-right"></i> Usar</button>
            </div>
          `;
        }).join('');
    }
    if (tipo === 'normal') carregarSelectCategorias();
    custoFixoSelecionadoId = null;
  };

  window.selecionarCustoFixoParaItem = function (cfId) {
    const cf = custosFixos.find(c => c.id === cfId);
    if (!cf) return;
    custoFixoSelecionadoId = cfId;
    document.getElementById('areaItemFixoDetalhe').style.display = 'block';
    document.getElementById('itemFixoNomeDisplay').value = cf.nome;
    document.getElementById('itemFixoValorDisplay').value = formatMoney(cf.valor);
    document.getElementById('itemFixoPercentual').value = '100';
    document.querySelectorAll('#custosFixosSelect .custo-fixo-select-item').forEach(el => {
      el.style.borderColor = 'var(--border)';
      el.style.background = '#fff';
    });
  };

  function carregarSelectCategorias() {
    const sel = document.getElementById('itemCategoria');
    if (sel) sel.innerHTML = categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
  }

  window.abrirModalItemCusto = function (id = null) {
    if (!setorAtual) return;
    window.mudarTipoItem('normal');
    document.getElementById('modalItemCusto').classList.add('active');

    if (id) {
      const item = itensCusto.find(i => i.id === id);
      if (item) {
        document.getElementById('modalItemTitulo').innerText = 'Editar Item';
        document.getElementById('itemEditId').value = item.id;

        if (item.tipo === 'fixo') {
          window.mudarTipoItem('fixo');
          custoFixoSelecionadoId = item.custoFixoId;
          document.getElementById('areaItemFixoDetalhe').style.display = 'block';
          document.getElementById('itemFixoNomeDisplay').value = item.nome;
          document.getElementById('itemFixoValorDisplay').value = formatMoney(item.valorTotal);
          document.getElementById('itemFixoPercentual').value = item.percentual;
        } else {
          window.mudarTipoItem('normal');
          carregarSelectCategorias();
          document.getElementById('itemCategoria').value = item.categoriaId || '';
          document.getElementById('itemNome').value = item.nome;
          document.getElementById('itemValorTotal').value = item.valorTotal;
          document.getElementById('itemPercentual').value = item.percentual;
          document.getElementById('itemObs').value = item.obs || '';
        }
      }
    } else {
      document.getElementById('modalItemTitulo').innerText = 'Novo Item';
      document.getElementById('itemEditId').value = '';
      document.getElementById('itemNome').value = '';
      document.getElementById('itemValorTotal').value = '';
      document.getElementById('itemPercentual').value = '100';
      document.getElementById('itemObs').value = '';
      document.getElementById('itemFixoPercentual').value = '100';
    }
  };

  window.salvarItemCusto = async function () {
    const tipo = document.getElementById('itemTipo').value;
    let item;

    if (tipo === 'fixo') {
      if (!custoFixoSelecionadoId) { alert('Selecione um custo fixo!'); return; }
      const cf = custosFixos.find(c => c.id === custoFixoSelecionadoId);
      if (!cf) { alert('Custo fixo não encontrado!'); return; }

      item = {
        setorId: setorAtual.id,
        tipo: 'fixo',
        custoFixoId: cf.id,
        categoriaId: cf.categoriaId,
        nome: cf.nome,
        valorTotal: cf.valor,
        percentual: parseFloat(document.getElementById('itemFixoPercentual').value) || 100,
        obs: '',
        createdAt: new Date().toISOString()
      };
    } else {
      item = {
        setorId: setorAtual.id,
        tipo: 'normal',
        categoriaId: document.getElementById('itemCategoria').value,
        nome: document.getElementById('itemNome').value.trim(),
        valorTotal: parseFloat(document.getElementById('itemValorTotal').value) || 0,
        percentual: parseFloat(document.getElementById('itemPercentual').value) || 0,
        obs: document.getElementById('itemObs').value.trim(),
        createdAt: new Date().toISOString()
      };
      if (!item.nome) { alert('Digite o nome do item!'); return; }
    }

    const editId = document.getElementById('itemEditId').value;
    if (editId) {
      item.id = editId;
      const idx = itensCusto.findIndex(i => i.id === editId);
      if (idx !== -1) itensCusto[idx] = item;
    } else {
      item.id = 'item_' + Date.now();
      itensCusto.push(item);
    }

    await salvarFB('custos_itens', item);
    saveLocalData();
    window.fecharModal('modalItemCusto');
    renderizarAnalise();
  };

  window.editarItemCusto = (id) => window.abrirModalItemCusto(id);

  window.excluirItemCusto = async function (id) {
    if (confirm('Excluir item?')) {
      itensCusto = itensCusto.filter(i => i.id !== id);
      await excluirFB('custos_itens', id);
      saveLocalData();
      renderizarAnalise();
    }
  };

  // ========== CRUD PRODUÇÃO ==========

  window.abrirModalProducao = function () {
    if (!setorAtual) return;
    document.getElementById('modalProducao').classList.add('active');
    document.getElementById('producaoProduto').value = '';
    document.getElementById('producaoKg').value = '';
    document.getElementById('producaoData').value = new Date().toISOString().split('T')[0];
  };

  window.salvarProducao = async function () {
    const prod = {
      setorId: setorAtual.id,
      produto: document.getElementById('producaoProduto').value.trim(),
      kg: parseFloat(document.getElementById('producaoKg').value) || 0,
      data: document.getElementById('producaoData').value,
      createdAt: new Date().toISOString(),
      id: 'prod_' + Date.now()
    };
    if (!prod.produto || prod.kg <= 0) { alert('Preencha todos os campos!'); return; }
    producoes.push(prod);
    await salvarFB('custos_producoes', prod);
    saveLocalData();
    window.fecharModal('modalProducao');
    renderizarAnalise();
  };

  window.excluirProducao = async function (id) {
    if (confirm('Excluir produção?')) {
      producoes = producoes.filter(p => p.id !== id);
      await excluirFB('custos_producoes', id);
      saveLocalData();
      renderizarAnalise();
    }
  };

  // ========== CRUD MATERIAIS ==========

  window.abrirModalMaterial = function (id = null) {
    document.getElementById('modalMaterial').classList.add('active');
    if (id) {
      const m = materiais.find(x => x.id === id);
      if (m) {
        document.getElementById('modalMaterialTitulo').innerHTML = '<i class="fas fa-edit"></i> Editar Material';
        document.getElementById('materialEditId').value = m.id;
        document.getElementById('materialNome').value = m.nome;
        document.getElementById('materialDescricao').value = m.descricao || '';
      }
    } else {
      document.getElementById('modalMaterialTitulo').innerHTML = '<i class="fas fa-plus"></i> Novo Material';
      document.getElementById('materialEditId').value = '';
      document.getElementById('materialNome').value = '';
      document.getElementById('materialDescricao').value = '';
    }
  };

  window.salvarMaterial = async function () {
    const m = {
      nome: document.getElementById('materialNome').value.trim(),
      descricao: document.getElementById('materialDescricao').value.trim(),
      createdAt: new Date().toISOString()
    };
    if (!m.nome) { alert('Digite o nome do material!'); return; }

    const editId = document.getElementById('materialEditId').value;
    if (editId) {
      m.id = editId;
      const idx = materiais.findIndex(x => x.id === editId);
      if (idx !== -1) materiais[idx] = m;
    } else {
      m.id = 'mat_' + Date.now();
      materiais.push(m);
    }

    await salvarFB('custos_materiais', m);
    saveLocalData();
    window.fecharModal('modalMaterial');
    if (document.getElementById('modalGerarCusto').classList.contains('active')) {
      window.abrirGerarCustoMaterial();
    }
    renderizarTela();
  };

  window.editarMaterial = (id) => window.abrirModalMaterial(id);

  window.excluirMaterial = async function (id) {
    if (confirm('Excluir material e todo seu histórico?')) {
      custosMateriais = custosMateriais.filter(c => c.materialId !== id);
      materiais = materiais.filter(m => m.id !== id);
      await excluirFB('custos_materiais', id);
      saveLocalData();
      renderizarTela();
    }
  };

  window.abrirHistoricoMaterial = function (id) {
    window.historicoMaterialId = id;
    nivelAtual = 'historicoMaterial';
    renderizarTela();
  };

  // ========== GERAR CUSTO MATERIAL ==========

  window.abrirGerarCustoMaterial = function () {
    document.getElementById('modalGerarCusto').classList.add('active');

    document.getElementById('gerarCustoPeriodo').innerHTML = '<option value="">Selecione...</option>' +
      periodos.sort((a, b) => b.ano !== a.ano ? b.ano - a.ano : b.mes - a.mes).map(p =>
        `<option value="${p.id}">${getNomeMes(p.mes)}/${p.ano}</option>`
      ).join('');

    document.getElementById('gerarCustoMaterial').innerHTML = '<option value="">Selecione...</option>' +
      materiais.map(m => `<option value="${m.id}">${m.nome}</option>`).join('');

    document.getElementById('setoresGerarCusto').innerHTML = '<p style="color:var(--text-light);text-align:center;padding:1rem;">Selecione um período</p>';
    document.getElementById('gerarCustoImposto').value = '0';
    document.getElementById('gerarCustoMargem').value = '0';
    document.getElementById('gerarCustoValorAtual').value = '0';

    document.getElementById('insumosContainer').innerHTML = `
      <div class="insumo-row">
        <input type="text" class="insumo-nome" placeholder="Nome do insumo">
        <input type="number" class="insumo-custo" step="0.01" placeholder="R$/kg">
        <button class="btn btn-danger btn-xs" onclick="this.parentElement.remove();window.atualizarResumoGerarCusto();"><i class="fas fa-times"></i></button>
      </div>
    `;

    document.getElementById('resumoLinhas').innerHTML = '<p style="opacity:0.7;text-align:center;">Selecione os setores para calcular</p>';
    setoresSelecionadosGerar = new Map();
  };

  window.atualizarSetoresGerarCusto = function () {
    const periodoId = document.getElementById('gerarCustoPeriodo').value;
    const container = document.getElementById('setoresGerarCusto');
    setoresSelecionadosGerar = new Map();

    if (!periodoId) {
      container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:1rem;">Selecione um período</p>';
      return;
    }

    const sets = setores.filter(s => s.periodoId === periodoId).sort((a, b) => a.ordem - b.ordem);
    if (sets.length === 0) {
      container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:1rem;">Nenhum setor</p>';
      return;
    }

    container.innerHTML = sets.map(s => {
      const custoKg = getCustoPorKgSetor(s.id);
      return `
        <div class="setor-selecao-item" id="setor_item_${s.id}">
          <div class="ss-header">
            <input type="checkbox" id="chk_setor_${s.id}" onchange="window.toggleSetorGerar('${s.id}', this)">
            <div class="ss-info">
              <div class="ss-nome">${s.produtoFinal ? '⭐ ' : ''}${s.nome} <span class="badge ${s.produtoFinal ? 'badge-orange' : 'badge-green'}">${s.produtoFinal ? 'Final' : 'Etapa ' + s.ordem}</span> <span class="badge ${s.tipo === 'custo' ? 'badge-custo' : 'badge-despesa'}">${s.tipo === 'custo' ? 'Custo' : 'Despesa'}</span></div>
              <div class="ss-custo">Custo médio do setor: <strong>${formatMoney(custoKg)}/kg</strong> | Custo total: ${formatMoney(calcularCustosSetor(s.id).totalCusto)}</div>
            </div>
          </div>
          <div class="ss-config" id="config_setor_${s.id}" style="display:none;">
            <select id="modo_setor_${s.id}" onchange="window.mudarModoSetorGerar('${s.id}')">
              <option value="total">Usar Valor Total (R$/kg)</option>
              <option value="percentual">Usar % do Rateio</option>
            </select>
            <input type="number" id="valor_setor_${s.id}" step="0.01" value="${custoKg.toFixed(2)}" placeholder="0,00" oninput="window.atualizarResumoGerarCusto()">
            <span id="unidade_setor_${s.id}" style="font-size:0.75rem;">R$/kg</span>
          </div>
        </div>
      `;
    }).join('');

    window.atualizarResumoGerarCusto();
  };

  window.toggleSetorGerar = function (setorId, checkbox) {
    const configDiv = document.getElementById('config_setor_' + setorId);
    const itemDiv = document.getElementById('setor_item_' + setorId);

    if (checkbox.checked) {
      const custoKg = getCustoPorKgSetor(setorId);
      setoresSelecionadosGerar.set(setorId, { modo: 'total', valor: custoKg });
      itemDiv.classList.add('selecionado');
      configDiv.style.display = 'flex';
      document.getElementById('modo_setor_' + setorId).value = 'total';
      document.getElementById('valor_setor_' + setorId).value = custoKg.toFixed(2);
      document.getElementById('unidade_setor_' + setorId).textContent = 'R$/kg';
    } else {
      setoresSelecionadosGerar.delete(setorId);
      itemDiv.classList.remove('selecionado');
      configDiv.style.display = 'none';
    }
    window.atualizarResumoGerarCusto();
  };

  window.mudarModoSetorGerar = function (setorId) {
    const modo = document.getElementById('modo_setor_' + setorId).value;
    const valorInput = document.getElementById('valor_setor_' + setorId);
    const unidadeSpan = document.getElementById('unidade_setor_' + setorId);
    const custoKg = getCustoPorKgSetor(setorId);

    if (modo === 'total') {
      valorInput.value = custoKg.toFixed(2);
      unidadeSpan.textContent = 'R$/kg';
    } else {
      valorInput.value = '100';
      unidadeSpan.textContent = '%';
    }

    if (setoresSelecionadosGerar.has(setorId)) {
      const config = setoresSelecionadosGerar.get(setorId);
      config.modo = modo;
      config.valor = parseFloat(valorInput.value) || 0;
    }
    window.atualizarResumoGerarCusto();
  };

  window.adicionarInsumo = function () {
    const container = document.getElementById('insumosContainer');
    const div = document.createElement('div');
    div.className = 'insumo-row';
    div.innerHTML = `
      <input type="text" class="insumo-nome" placeholder="Nome do insumo">
      <input type="number" class="insumo-custo" step="0.01" placeholder="R$/kg">
      <button class="btn btn-danger btn-xs" onclick="this.parentElement.remove();window.atualizarResumoGerarCusto();"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(div);
  };

  window.atualizarResumoGerarCusto = function () {
    const resumoLinhas = document.getElementById('resumoLinhas');
    let custoBase = 0;
    let html = '';

    setoresSelecionadosGerar.forEach((config, setorId) => {
      const valorInput = document.getElementById('valor_setor_' + setorId);
      if (valorInput) config.valor = parseFloat(valorInput.value) || 0;
    });

    setoresSelecionadosGerar.forEach((config, setorId) => {
      const setor = setores.find(s => s.id === setorId);
      const custoKgOriginal = getCustoPorKgSetor(setorId);
      let custoKgAplicado;
      let descricao;

      if (config.modo === 'total') {
        custoKgAplicado = config.valor;
        descricao = `Total: ${formatMoney(config.valor)}/kg`;
      } else {
        custoKgAplicado = custoKgOriginal * (config.valor / 100);
        descricao = `${config.valor}% de ${formatMoney(custoKgOriginal)}/kg`;
      }

      custoBase += custoKgAplicado;
      html += `<div class="linha"><span>${setor?.nome || 'Setor'} <small style="opacity:0.7;">${descricao}</small></span><span class="l-valor">${formatMoney(custoKgAplicado)}/kg</span></div>`;
    });

    if (setoresSelecionadosGerar.size === 0) {
      resumoLinhas.innerHTML = '<p style="opacity:0.7;text-align:center;">Selecione os setores e configure cada um</p>';
      return;
    }

    let custoInsumos = 0;
    document.querySelectorAll('#insumosContainer .insumo-row').forEach(row => {
      const nome = row.querySelector('.insumo-nome').value.trim();
      const custo = parseFloat(row.querySelector('.insumo-custo').value) || 0;
      if (nome && custo > 0) {
        custoInsumos += custo;
        html += `<div class="linha"><span>${nome}</span><span class="l-valor">${formatMoney(custo)}/kg</span></div>`;
      }
    });

    const subtotal = custoBase + custoInsumos;
    const imposto = parseFloat(document.getElementById('gerarCustoImposto').value) || 0;
    const valorImposto = subtotal * (imposto / 100);
    const custoFinal = subtotal + valorImposto;
    const margem = parseFloat(document.getElementById('gerarCustoMargem').value) || 0;
    const precoSugerido = margem > 0 ? custoFinal * (1 + margem / 100) : 0;
    const valorAtual = parseFloat(document.getElementById('gerarCustoValorAtual').value) || 0;

    html += `<div class="linha"><span>Subtotal</span><span class="l-valor">${formatMoney(subtotal)}/kg</span></div>`;
    if (imposto > 0) {
      html += `<div class="linha"><span>Imposto (${imposto}%)</span><span class="l-valor">${formatMoney(valorImposto)}/kg</span></div>`;
    }
    html += `<div class="linha total"><span>CUSTO FINAL</span><span class="l-valor">${formatMoney(custoFinal)}/kg</span></div>`;
    if (margem > 0) {
      html += `<div class="linha" style="color:#ffb74d;"><span>Preço Sugerido (${margem}%)</span><span class="l-valor">${formatMoney(precoSugerido)}/kg</span></div>`;
    }

    if (valorAtual > 0) {
      const diff = valorAtual - custoFinal;
      const diffPerc = (diff / custoFinal * 100);
      const isLucro = diff >= 0;
      html += `
        <div class="comparativo-destaque" style="color:#fff;">
          <div style="font-weight:600;margin-bottom:0.5rem;">Análise Comparativa</div>
          <div class="linha"><span>Valor Praticado</span><span class="l-valor">${formatMoney(valorAtual)}/kg</span></div>
          <div class="linha"><span>${isLucro ? 'Diferença (Lucro)' : 'Diferença (Prejuízo)'}</span><span class="l-valor" style="color:${isLucro ? '#4caf50' : '#ef5350'};">${formatMoney(Math.abs(diff))}/kg (${formatNumber(Math.abs(diffPerc), 1)}%)</span></div>
          <div class="linha" style="color:${isLucro ? '#4caf50' : '#ef5350'};font-weight:700;">${isLucro ? '✅ Operação Lucrativa' : '❌ Operação com Prejuízo'}</div>
        </div>
      `;
    }

    resumoLinhas.innerHTML = html;
  };

  // Listeners para atualizar resumo
  document.addEventListener('input', function (e) {
    if (['gerarCustoImposto', 'gerarCustoMargem', 'gerarCustoValorAtual'].includes(e.target.id)) {
      window.atualizarResumoGerarCusto();
    }
    if (e.target.id && e.target.id.startsWith('valor_setor_')) {
      window.atualizarResumoGerarCusto();
    }
  });

  window.salvarCustoMaterial = async function () {
    const periodoId = document.getElementById('gerarCustoPeriodo').value;
    const materialId = document.getElementById('gerarCustoMaterial').value;

    if (!periodoId || !materialId || setoresSelecionadosGerar.size === 0) {
      alert('Preencha todos os campos e selecione ao menos um setor!');
      return;
    }

    const periodo = periodos.find(p => p.id === periodoId);

    let custoBase = 0;
    const setoresDetalhes = [];
    const setoresUtilizados = [];

    setoresSelecionadosGerar.forEach((config, setorId) => {
      const setor = setores.find(s => s.id === setorId);
      const custoKgOriginal = getCustoPorKgSetor(setorId);
      let custoKgAplicado;

      if (config.modo === 'total') {
        custoKgAplicado = config.valor;
      } else {
        custoKgAplicado = custoKgOriginal * (config.valor / 100);
      }

      custoBase += custoKgAplicado;
      setoresUtilizados.push(setorId);
      setoresDetalhes.push({
        id: setorId,
        nome: setor?.nome || '',
        custoKg: custoKgAplicado,
        custoKgOriginal,
        modo: config.modo,
        valorConfig: config.valor
      });
    });

    let custoInsumos = 0;
    const insumos = [];
    document.querySelectorAll('#insumosContainer .insumo-row').forEach(row => {
      const nome = row.querySelector('.insumo-nome').value.trim();
      const custo = parseFloat(row.querySelector('.insumo-custo').value) || 0;
      if (nome && custo > 0) {
        custoInsumos += custo;
        insumos.push({ nome, custoKg: custo });
      }
    });

    const subtotal = custoBase + custoInsumos;
    const imposto = parseFloat(document.getElementById('gerarCustoImposto').value) || 0;
    const valorImposto = subtotal * (imposto / 100);
    const custoKgFinal = subtotal + valorImposto;
    const margem = parseFloat(document.getElementById('gerarCustoMargem').value) || 0;
    const precoSugerido = margem > 0 ? custoKgFinal * (1 + margem / 100) : 0;
    const valorAtual = parseFloat(document.getElementById('gerarCustoValorAtual').value) || 0;

    const custo = {
      materialId,
      periodoId,
      mes: periodo?.mes,
      ano: periodo?.ano,
      periodoObs: periodo?.obs || '',
      setoresUtilizados,
      setoresDetalhes,
      insumos,
      subtotal,
      imposto,
      valorImposto,
      custoKgFinal,
      margem,
      precoSugerido,
      valorAtual,
      createdAt: new Date().toISOString(),
      id: 'cm_' + Date.now()
    };

    custosMateriais.push(custo);
    await salvarFB('custos_materiais_custos', custo);
    saveLocalData();

    window.fecharModal('modalGerarCusto');
    alert(`Custo salvo com sucesso!\n${formatMoney(custoKgFinal)}/kg`);
    renderizarTela();
  };

  // ========== PDFs ==========

  window.gerarPDFCustoMaterial = async function () {
    const { jsPDF } = window.jspdf;
    const materialId = document.getElementById('gerarCustoMaterial').value;
    const mat = materiais.find(m => m.id === materialId);
    const periodoId = document.getElementById('gerarCustoPeriodo').value;
    const per = periodos.find(p => p.id === periodoId);

    let custoBase = 0;
    const linhasPDF = [];

    setoresSelecionadosGerar.forEach((config, setorId) => {
      const setor = setores.find(s => s.id === setorId);
      const custoKgOriginal = getCustoPorKgSetor(setorId);
      let custoKgAplicado;
      let descricao;

      if (config.modo === 'total') {
        custoKgAplicado = config.valor;
        descricao = `Total: ${formatMoney(config.valor)}/kg`;
      } else {
        custoKgAplicado = custoKgOriginal * (config.valor / 100);
        descricao = `${config.valor}% de ${formatMoney(custoKgOriginal)}/kg`;
      }

      custoBase += custoKgAplicado;
      linhasPDF.push({ nome: setor?.nome || 'Setor', descricao, valor: custoKgAplicado });
    });

    let custoInsumos = 0;
    const insumosPDF = [];
    document.querySelectorAll('#insumosContainer .insumo-row').forEach(row => {
      const nome = row.querySelector('.insumo-nome').value.trim();
      const custo = parseFloat(row.querySelector('.insumo-custo').value) || 0;
      if (nome && custo > 0) {
        custoInsumos += custo;
        insumosPDF.push({ nome, custoKg: custo });
      }
    });

    const subtotal = custoBase + custoInsumos;
    const imposto = parseFloat(document.getElementById('gerarCustoImposto').value) || 0;
    const valorImposto = subtotal * (imposto / 100);
    const custoFinal = subtotal + valorImposto;
    const margem = parseFloat(document.getElementById('gerarCustoMargem').value) || 0;
    const precoSugerido = margem > 0 ? custoFinal * (1 + margem / 100) : 0;
    const valorAtual = parseFloat(document.getElementById('gerarCustoValorAtual').value) || 0;

    const pdf = new jsPDF('p', 'mm', 'a4');
    let y = 20;

    pdf.setFillColor(0, 77, 64);
    pdf.rect(0, 0, 210, 30, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.text('Análise de Custo - Mil Plásticos', 105, 15, { align: 'center' });
    pdf.setFontSize(9);
    pdf.text('Reciclagem de Plásticos', 105, 22, { align: 'center' });

    y = 38;
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(13);
    pdf.text(`Material: ${mat?.nome || 'N/D'}`, 20, y);
    y += 7;
    pdf.setFontSize(10);
    pdf.text(`Período: ${per ? getNomeMes(per.mes) + '/' + per.ano : 'N/D'}`, 20, y);
    y += 5;
    pdf.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 20, y);
    y += 10;

    pdf.setFontSize(11);
    pdf.text('Composição do Custo:', 20, y);
    y += 7;

    linhasPDF.forEach(l => {
      pdf.setFontSize(9);
      pdf.text(`${l.nome} ${l.descricao}: ${formatMoney(l.valor)}/kg`, 25, y);
      y += 5;
    });

    insumosPDF.forEach(ins => {
      pdf.text(`Insumo - ${ins.nome}: ${formatMoney(ins.custoKg)}/kg`, 25, y);
      y += 5;
    });

    pdf.text(`Subtotal: ${formatMoney(subtotal)}/kg`, 25, y);
    y += 5;

    if (imposto > 0) {
      pdf.text(`Imposto (${imposto}%): ${formatMoney(valorImposto)}/kg`, 25, y);
      y += 5;
    }

    pdf.setFontSize(11);
    pdf.setTextColor(0, 77, 64);
    pdf.text(`CUSTO FINAL: ${formatMoney(custoFinal)}/kg`, 25, y);
    y += 7;

    if (margem > 0) {
      pdf.setTextColor(245, 124, 0);
      pdf.text(`Preço Sugerido (${margem}%): ${formatMoney(precoSugerido)}/kg`, 25, y);
      y += 7;
    }

    if (valorAtual > 0) {
      const diff = valorAtual - custoFinal;
      const diffPerc = (diff / custoFinal * 100);
      pdf.setTextColor(diff >= 0 ? 0 : 200, diff >= 0 ? 150 : 0, 0);
      pdf.text(`${diff >= 0 ? 'Lucro' : 'Prejuízo'}: ${formatMoney(Math.abs(diff))}/kg (${formatNumber(Math.abs(diffPerc), 1)}%)`, 25, y);
    }

    pdf.save(`Custo_${mat?.nome || 'Material'}_${per ? getNomeMes(per.mes) + '_' + per.ano : ''}.pdf`);
  };

  window.gerarPDFCentralCustos = async function () {
    if (!periodoAtual) { alert('Selecione um período!'); return; }
    const { jsPDF } = window.jspdf;
    const sets = getSetoresDoPeriodo();
    const resumo = calcularResumoPeriodo();

    const pdf = new jsPDF('p', 'mm', 'a4');
    let y = 20;

    pdf.setFillColor(13, 144, 79);
    pdf.rect(0, 0, 210, 30, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.text('Central de Custos - Mil Plásticos', 105, 15, { align: 'center' });
    pdf.setFontSize(9);
    pdf.text('Reciclagem de Plásticos', 105, 22, { align: 'center' });

    y = 38;
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(13);
    pdf.text(`Fechamento: ${getNomeMes(periodoAtual.mes)}/${periodoAtual.ano}`, 20, y);
    y += 8;

    if (setoresExcluidosResumo.size > 0) {
      pdf.setFontSize(9);
      pdf.setTextColor(200, 0, 0);
      pdf.text(`${setoresExcluidosResumo.size} setor(es) excluído(s) do resumo`, 20, y);
      y += 6;
    }

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    pdf.text(
      `Setores Ativos: ${resumo.qtdSetores} | Custo Total: ${formatMoney(resumo.custoTotalGeral)} | Produção: ${formatNumber(resumo.producaoTotalGeral, 0)} kg | Custo/KG: ${formatMoney(resumo.custoPorKgGeral)}/kg`,
      20, y
    );
    y += 10;

    sets.forEach(setor => {
      if (y > 260) { pdf.addPage(); y = 20; }
      const { totalCusto, totalKg, custoPorKg } = calcularCustosSetor(setor.id);
      const excluido = setoresExcluidosResumo.has(setor.id);
      const tipo = setor.tipo || 'custo';

      pdf.setFontSize(11);
      pdf.setFillColor(excluido ? 255 : 240, excluido ? 235 : 248, excluido ? 238 : 240);
      pdf.rect(20, y - 4, 170, 7, 'F');
      pdf.setTextColor(excluido ? 180 : 0, 0, 0);
      pdf.text(
        `${setor.nome} ${setor.produtoFinal ? '(PRODUTO FINAL)' : '(Etapa ' + setor.ordem + ')'} ${excluido ? '[EXCLUÍDO]' : ''} [${tipo === 'custo' ? 'CUSTO' : 'DESPESA'}]`,
        22, y
      );
      y += 6;
      pdf.setFontSize(9);
      pdf.text(`Custo: ${formatMoney(totalCusto)} | Produção: ${formatNumber(totalKg, 0)} kg | Custo/KG: ${formatMoney(custoPorKg)}/kg`, 25, y);
      y += 8;

      const itens = itensCusto.filter(i => i.setorId === setor.id);
      itens.forEach(item => {
        const cat = categorias.find(c => c.id === item.categoriaId);
        const tipoItem = item.tipo === 'fixo' ? 'FIXO' : '';
        pdf.text(
          `${cat?.nome || 'Sem cat.'} - ${item.nome} ${tipoItem}: ${formatMoney(item.valorTotal)} ${item.percentual}% = ${formatMoney(item.valorTotal * item.percentual / 100)}`,
          30, y
        );
        y += 4.5;
      });
      y += 3;
    });

    pdf.save(`Central_Custos_${getNomeMes(periodoAtual.mes)}_${periodoAtual.ano}.pdf`);
  };

  // ========== GRÁFICOS DO SETOR ==========

  function getCustosAgrupados() {
    if (!setorAtual) return { porCategoria: {} };
    const itens = itensCusto.filter(i => i.setorId === setorAtual.id);
    const porCategoria = {};
    itens.forEach(item => {
      const valor = item.valorTotal * item.percentual / 100;
      const cat = categorias.find(c => c.id === item.categoriaId);
      const catId = cat ? cat.id : 'sem_cat';
      if (!porCategoria[catId]) {
        porCategoria[catId] = { nome: cat ? cat.nome : 'Sem categoria', cor: cat ? cat.cor : '#999', total: 0 };
      }
      porCategoria[catId].total += valor;
    });
    return { porCategoria, itens };
  }

  function atualizarGraficos() {
    const { porCategoria } = getCustosAgrupados();
    const cats = Object.values(porCategoria);
    const pieCtx = document.getElementById('pieChart');
    const barCtx = document.getElementById('barChart');

    if (!pieCtx || !barCtx) return;

    if (pieChart) pieChart.destroy();
    if (barChart) barChart.destroy();

    if (cats.length > 0) {
      pieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
          labels: cats.map(c => c.nome),
          datasets: [{
            data: cats.map(c => c.total),
            backgroundColor: cats.map(c => c.cor || '#0d904f'),
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: 'bottom', labels: { font: { size: 10 } } }
          }
        }
      });

      barChart = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: cats.map(c => c.nome),
          datasets: [{
            label: 'Valor (R$)',
            data: cats.map(c => c.total),
            backgroundColor: cats.map(c => c.cor || '#0d904f'),
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { callback: v => 'R$ ' + v } } }
        }
      });
    }
  }

  function carregarCategoriasLista() {
    const el = document.getElementById('categoriasList');
    if (!el) return;
    el.innerHTML = categorias.map(c =>
      `<div class="campo-config-item" style="border-left:4px solid ${c.cor};">
        <span><i class="fas fa-circle" style="color:${c.cor};font-size:0.6rem;"></i> ${c.nome}</span>
        <div>
          <button class="btn btn-outline btn-xs" onclick="window.editarCategoria('${c.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-xs" onclick="window.excluirCategoria('${c.id}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>`
    ).join('');
  }

  function carregarItensCustoLista() {
    const el = document.getElementById('itensCustoList');
    if (!el || !setorAtual) return;
    const itens = itensCusto.filter(i => i.setorId === setorAtual.id);
    el.innerHTML = itens.map(item => {
      const cat = categorias.find(c => c.id === item.categoriaId);
      const tipoBadge = item.tipo === 'fixo' ? '<span class="badge badge-orange">Fixo</span>' : '';
      return `<div class="campo-config-item" style="border-left:4px solid ${cat?.cor || '#999'};">
        <div>
          <strong>${item.nome}</strong> ${tipoBadge}
          <br><small>${cat?.nome || 'Sem categoria'}</small>
        </div>
        <div style="text-align:right;">
          <div class="money">${formatMoney(item.valorTotal)}</div>
          <span class="badge badge-blue">${item.percentual}%</span>
        </div>
        <div>
          <button class="btn btn-outline btn-xs" onclick="window.editarItemCusto('${item.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-xs" onclick="window.excluirItemCusto('${item.id}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
    }).join('');

    if (itens.length === 0) {
      el.innerHTML = '<p style="text-align:center;padding:1rem;color:var(--text-light);">Nenhum item cadastrado</p>';
    }
  }

  function carregarTabelaCustos() {
    const tbody = document.getElementById('tabelaCustos');
    if (!tbody || !setorAtual) return;
    const itens = itensCusto.filter(i => i.setorId === setorAtual.id);

    if (itens.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;">Nenhum item cadastrado</td></tr>';
      return;
    }

    const grupos = {};
    itens.forEach(item => {
      const cid = item.categoriaId || 'sem_cat';
      if (!grupos[cid]) {
        grupos[cid] = { cat: categorias.find(c => c.id === cid), itens: [], subtotal: 0 };
      }
      grupos[cid].itens.push(item);
      grupos[cid].subtotal += item.valorTotal * item.percentual / 100;
    });

    tbody.innerHTML = Object.values(grupos).map(g => `
      <tr style="background:#f0faf4;">
        <td colspan="7">
          <strong><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${g.cat?.cor || '#999'};margin-right:5px;"></span>${g.cat?.nome || 'Sem categoria'}</strong>
          - Subtotal: ${formatMoney(g.subtotal)}
        </td>
      </tr>
      ${g.itens.map(item => `
        <tr>
          <td></td>
          <td>${item.nome}</td>
          <td><span class="badge ${item.tipo === 'fixo' ? 'badge-orange' : 'badge-blue'}">${item.tipo === 'fixo' ? 'Fixo' : 'Normal'}</span></td>
          <td class="money">${formatMoney(item.valorTotal)}</td>
          <td>${item.percentual}%</td>
          <td class="money">${formatMoney(item.valorTotal * item.percentual / 100)}</td>
          <td>
            <button class="btn btn-outline btn-xs" onclick="window.editarItemCusto('${item.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger btn-xs" onclick="window.excluirItemCusto('${item.id}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `).join('')}
    `).join('');
  }

  function carregarProducoesLista() {
    const el = document.getElementById('producaoList');
    if (!el || !setorAtual) return;
    const prods = producoes.filter(p => p.setorId === setorAtual.id);

    if (prods.length === 0) {
      el.innerHTML = '<p style="text-align:center;padding:1rem;color:var(--text-light);">Nenhuma produção registrada</p>';
      return;
    }

    el.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Data</th><th>Material</th><th>KG</th><th>Ações</th></tr></thead>
          <tbody>
            ${prods.map(p => `
              <tr>
                <td>${new Date(p.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td>${p.produto}</td>
                <td>${formatNumber(p.kg, 0)} kg</td>
                <td>
                  <button class="btn btn-danger btn-xs" onclick="window.excluirProducao('${p.id}')"><i class="fas fa-trash"></i></button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ========== CONFIGURAÇÕES ==========

  window.abrirConfigCampos = function () {
    document.getElementById('modalConfigCampos').classList.add('active');
    document.getElementById('listaConfigCampos').innerHTML = Object.entries(configCampos).map(([k, v]) => `
      <div class="form-group">
        <label>${k}</label>
        <input type="text" id="config_${k}" value="${v}">
      </div>
    `).join('');
  };

  window.salvarConfigCampos = function () {
    Object.keys(configCampos).forEach(k => {
      const inp = document.getElementById('config_' + k);
      if (inp) configCampos[k] = inp.value.trim() || configCampos[k];
    });
    saveConfig();
    window.fecharModal('modalConfigCampos');
    renderizarTela();
  };

  // ========== FECHAR MODAL ==========

  window.fecharModal = function (id) {
    document.getElementById(id).classList.remove('active');
    if (id === 'modalGraficoMensal' && graficoMensalChart) {
      graficoMensalChart.destroy();
      graficoMensalChart = null;
    }
    if (id === 'modalGraficoConsolidado' && graficoConsolidadoChart) {
      graficoConsolidadoChart.destroy();
      graficoConsolidadoChart = null;
    }
  };

  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('active');
    }
  });

  // ========== REDIMENSIONAR GRÁFICOS ==========

  window.ajustarGrafico = function (tipo, modo) {
    const containerId = tipo === 'mensal' ? 'graficoMensalContainer' : 'graficoConsolidadoContainer';
    const container = document.getElementById(containerId);
    if (!container) return;

    const alturas = {
      'menor': 350,
      'padrao': 500,
      'maior': 700,
      'telaCheia': window.innerHeight - 200
    };

    const altura = alturas[modo] || 500;
    container.style.height = altura + 'px';
    container.style.transition = 'height 0.3s ease';

    setTimeout(() => {
      if (tipo === 'mensal' && graficoMensalChart) {
        graficoMensalChart.resize();
      } else if (tipo === 'consolidado' && graficoConsolidadoChart) {
        graficoConsolidadoChart.resize();
      }
    }, 150);
  };

  // Redimensionar com scroll
  document.addEventListener('DOMContentLoaded', function () {
    const containers = document.querySelectorAll('.grafico-container');
    containers.forEach(container => {
      container.addEventListener('wheel', function (e) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const delta = e.deltaY > 0 ? -50 : 50;
          const currentHeight = parseInt(window.getComputedStyle(container).height);
          const newHeight = Math.max(300, Math.min(window.innerHeight - 150, currentHeight + delta));
          container.style.height = newHeight + 'px';
          container.style.transition = 'height 0.1s ease';
          setTimeout(() => {
            const chart = container.querySelector('canvas');
            if (chart && chart.chart) {
              chart.chart.resize();
            }
          }, 150);
        }
      }, { passive: false });
    });
  });

  // ========== INICIALIZAÇÃO ==========

  function init() {
    renderizarTela();
    document.getElementById('loadingOverlay').classList.remove('active');
    setTimeout(verificarStatusFirebase, 1000);
  }

  init();

})();
