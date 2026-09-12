/* ==========================================================================
   RHDASHBOARD.JS — Dashboard de RH com Chart.js + filtros + seletor de gráficos
   ========================================================================== */

(function () {
  'use strict';

  const db = window.db || window.firebaseDB;
  if (!db) {
    console.error('❌ Firestore não disponível em rhdashboard.js');
    return;
  }

  const COL = {
    ocorrencias:  db.collection('ocorrencias'),
    funcionarios: db.collection('funcionarios'),
    setores:      db.collection('setores'),
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  /* ------------------------------------------------------------------ */
  /* Constantes                                                          */
  /* ------------------------------------------------------------------ */
  const HORAS_MES = 220;
  const HORAS_DIA = 8;

  const STORAGE_KEY = 'rhdashboard_charts_visiveis';

  const CORES = {
    red:    '#ef4444',
    purple: '#8b5cf6',
    yellow: '#f59e0b',
    blue:   '#3b82f6',
    green:  '#10b981',
  };

  const TIPO_COR = {
    'Falta':      CORES.red,
    'Atestado':   CORES.purple,
    'Atraso':     CORES.yellow,
    'Declaração': CORES.blue,
    'Licença':    CORES.green,
  };

  const CHARTS_PADRAO = [
    'chartEvolucao',
    'chartTipos',
    'chartSetores',
    'chartMotivos',
    'chartRanking',
    'chartDiasMes',
  ];

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  function horasPerdidas(oc) {
    if (!oc) return 0;
    if (oc.tipo === 'Atraso' || oc.tipo === 'Declaração') {
      return parseFloat(oc.horas) || 0;
    }
    return (parseInt(oc.dias) || 0) * HORAS_DIA;
  }

  const percentual = (h) => (h / HORAS_MES) * 100;

  const fmtHoras = (h) => h < 1
    ? `${(h * 60).toFixed(0)}min`
    : `${h.toFixed(1).replace('.', ',')}h`;

  const fmtPct = (p) => `${p.toFixed(2).replace('.', ',')}%`;

  function labelMes(ym) {
    const [y, m] = ym.split('-');
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${nomes[parseInt(m) - 1]}/${y.slice(2)}`;
  }

  const hojeISO = () => new Date().toISOString().split('T')[0];

  /* ------------------------------------------------------------------ */
  /* Dashboard                                                           */
  /* ------------------------------------------------------------------ */

  const Dashboard = {
    state: {
      ocorrencias: [],
      funcionarios: [],
      setores: [],
      filtro: {
        periodo: 'ano',
        dataInicio: '',
        dataFim: '',
        funcionarioId: '',
        setorId: '',
        tipo: '',
        cid: '',
      },
      charts: {},
      listeners: [],
      chartsVisiveis: [], // preenchido no init a partir do localStorage
    },

    init() {
      console.log('📊 Inicializando Dashboard');
      this.carregarPreferencias();
      this.bindEventos();
      this.iniciarListeners();

      setTimeout(() => {
        const ov = document.getElementById('loadingOverlay');
        if (ov) ov.style.display = 'none';
      }, 500);
    },

    /* ================================================================== */
    /* PREFERÊNCIAS (localStorage)                                        */
    /* ================================================================== */
    carregarPreferencias() {
      try {
        const salvo = localStorage.getItem(STORAGE_KEY);
        if (salvo) {
          const arr = JSON.parse(salvo);
          if (Array.isArray(arr)) {
            this.state.chartsVisiveis = arr.filter(c => CHARTS_PADRAO.includes(c));
          }
        }
      } catch (e) {
        console.warn('Erro ao ler preferências:', e);
      }
      if (!this.state.chartsVisiveis.length) {
        this.state.chartsVisiveis = [...CHARTS_PADRAO];
      }
      this.aplicarChips();
    },

    salvarPreferencias() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state.chartsVisiveis));
      } catch (e) {
        console.warn('Erro ao salvar preferências:', e);
      }
    },

    aplicarChips() {
      $$('#dashChartToggles .dash-chip').forEach(chip => {
        const ativo = this.state.chartsVisiveis.includes(chip.dataset.chart);
        chip.classList.toggle('active', ativo);
      });
    },

    /* ================================================================== */
    /* EVENTOS                                                            */
    /* ================================================================== */
    bindEventos() {
      const { filtro } = this.state;
      const onChange = (id, key) => {
        $('#' + id)?.addEventListener('change', (e) => {
          filtro[key] = e.target.value;
          if (key === 'periodo') this.togglePeriodoCustom();
          this.renderTudo();
        });
      };

      onChange('dashFiltroPeriodo', 'periodo');
      onChange('dashFiltroFuncionario', 'funcionarioId');
      onChange('dashFiltroSetor', 'setorId');
      onChange('dashFiltroTipo', 'tipo');
      onChange('dashFiltroCID', 'cid');

      $('#dashDataInicio')?.addEventListener('change', (e) => {
        filtro.dataInicio = e.target.value;
        this.renderTudo();
      });
      $('#dashDataFim')?.addEventListener('change', (e) => {
        filtro.dataFim = e.target.value;
        this.renderTudo();
      });

      $('#btnLimparFiltros')?.addEventListener('click', () => this.limparFiltros());
      $('#btnAtualizarDash')?.addEventListener('click', () => this.renderTudo());

      /* Seletor de gráficos */
      $$('#dashChartToggles .dash-chip').forEach(chip => {
        chip.addEventListener('click', () => this.toggleChart(chip.dataset.chart));
      });
    },

    toggleChart(chartId) {
      const idx = this.state.chartsVisiveis.indexOf(chartId);
      if (idx >= 0) {
        this.state.chartsVisiveis.splice(idx, 1);
      } else {
        this.state.chartsVisiveis.push(chartId);
      }
      this.aplicarChips();
      this.salvarPreferencias();
      this.atualizarVisibilidadeCards();
      // Re-renderiza para os gráficos aparecerem com tamanho certo
      setTimeout(() => this.renderTudo(), 50);
    },

    atualizarVisibilidadeCards() {
      $$('.dash-card[data-card]').forEach(card => {
        const id = card.dataset.card;
        const visivel = this.state.chartsVisiveis.includes(id);
        card.style.display = visivel ? '' : 'none';
      });
    },

    togglePeriodoCustom() {
      const box = $('#dashPeriodoCustom');
      const personalizado = this.state.filtro.periodo === 'personalizado';
      if (box) box.style.display = personalizado ? 'flex' : 'none';
      if (!personalizado) {
        this.state.filtro.dataInicio = '';
        this.state.filtro.dataFim = '';
        const di = $('#dashDataInicio'), df = $('#dashDataFim');
        if (di) di.value = '';
        if (df) df.value = '';
      }
    },

    limparFiltros() {
      this.state.filtro = {
        periodo: 'ano',
        dataInicio: '',
        dataFim: '',
        funcionarioId: '',
        setorId: '',
        tipo: '',
        cid: '',
      };
      ['dashFiltroPeriodo','dashFiltroFuncionario','dashFiltroSetor','dashFiltroTipo','dashFiltroCID']
        .forEach(id => {
          const el = $('#' + id);
          if (el) el.value = id === 'dashFiltroPeriodo' ? 'ano' : '';
        });
      const di = $('#dashDataInicio'), df = $('#dashDataFim');
      if (di) di.value = '';
      if (df) df.value = '';
      this.togglePeriodoCustom();
      this.renderTudo();
    },

    /* ================================================================== */
    /* LISTENERS FIRESTORE                                                */
    /* ================================================================== */
    iniciarListeners() {
      this.state.listeners.push(
        COL.funcionarios.onSnapshot(snap => {
          this.state.funcionarios = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
          this.popularFiltroFuncionario();
          this.renderTudo();
        }, err => console.error('funcionarios:', err))
      );

      this.state.listeners.push(
        COL.setores.onSnapshot(snap => {
          this.state.setores = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
          this.popularFiltroSetor();
          this.renderTudo();
        }, err => console.error('setores:', err))
      );

      this.state.listeners.push(
        COL.ocorrencias.onSnapshot(snap => {
          this.state.ocorrencias = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
          this.popularFiltroCID();
          this.renderTudo();
        }, err => console.error('ocorrencias:', err))
      );
    },

    /* ================================================================== */
    /* POPULAR SELECTS                                                    */
    /* ================================================================== */
    popularFiltroFuncionario() {
      const sel = $('#dashFiltroFuncionario');
      if (!sel) return;
      const atual = sel.value;
      sel.innerHTML = '<option value="">Todos os funcionários</option>' +
        this.state.funcionarios.map(f =>
          `<option value="${f.id}">${f.nome}${f.setorNome ? ' — ' + f.setorNome : ''}</option>`
        ).join('');
      sel.value = atual;
    },

    popularFiltroSetor() {
      const sel = $('#dashFiltroSetor');
      if (!sel) return;
      const atual = sel.value;
      sel.innerHTML = '<option value="">Todos os setores</option>' +
        this.state.setores.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
      sel.value = atual;
    },

    popularFiltroCID() {
      const sel = $('#dashFiltroCID');
      if (!sel) return;
      const atual = sel.value;
      const cids = [...new Set(
        this.state.ocorrencias
          .map(o => (o.cid || '').trim().toUpperCase())
          .filter(Boolean)
      )].sort();
      sel.innerHTML = '<option value="">Todos os CID</option>' +
        cids.map(c => `<option value="${c}">${c}</option>`).join('');
      sel.value = atual;
    },

    /* ================================================================== */
    /* FILTRO PRINCIPAL                                                   */
    /* ================================================================== */
    filtrarOcorrencias() {
      const { ocorrencias } = this.state;
      const f = this.state.filtro;
      const agora = new Date();

      let dataMin = null, dataMax = null;

      if (f.periodo === '30')  dataMin = new Date(agora.getTime() - 30 * 86400000);
      if (f.periodo === '90')  dataMin = new Date(agora.getTime() - 90 * 86400000);
      if (f.periodo === 'mes') {
        const y = agora.getFullYear(), m = agora.getMonth();
        dataMin = new Date(y, m, 1);
        dataMax = new Date(y, m + 1, 0);
      }
      if (f.periodo === 'ano') {
        dataMin = new Date(agora.getFullYear(), 0, 1);
        dataMax = new Date(agora.getFullYear(), 11, 31);
      }
      if (f.periodo === 'personalizado') {
        if (f.dataInicio) dataMin = new Date(f.dataInicio + 'T00:00:00');
        if (f.dataFim)    dataMax = new Date(f.dataFim + 'T23:59:59');
      }

      return ocorrencias.filter(oc => {
        if (f.funcionarioId && oc.funcionarioId !== f.funcionarioId) return false;
        if (f.setorId && oc.setorId !== f.setorId) return false;

        if (f.tipo) {
          if (f.tipo === 'horas') {
            if (!['Atraso', 'Declaração'].includes(oc.tipo)) return false;
          } else if (f.tipo === 'dias') {
            if (!['Falta', 'Atestado', 'Licença'].includes(oc.tipo)) return false;
          } else if (oc.tipo !== f.tipo) {
            return false;
          }
        }

        if (f.cid && (oc.cid || '').trim().toUpperCase() !== f.cid.toUpperCase()) return false;

        if (dataMin || dataMax) {
          const d = new Date((oc.data || '') + 'T00:00:00');
          if (dataMin && d < dataMin) return false;
          if (dataMax && d > dataMax) return false;
        }
        return true;
      });
    },

    /* ================================================================== */
    /* RENDER PRINCIPAL                                                   */
    /* ================================================================== */
    renderTudo() {
      const lista = this.filtrarOcorrencias();
      const empty = $('#dashEmpty');
      const grid  = document.getElementById('dashGrid');

      this.atualizarVisibilidadeCards();

      if (!lista.length) {
        if (empty) empty.style.display = 'block';
        if (grid)  grid.style.display  = 'none';
      } else {
        if (empty) empty.style.display = 'none';
        if (grid)  grid.style.display  = 'grid';
      }

      this.renderHero(lista);
      this.renderKPIs(lista);
      this.renderTopCIDs(lista);

      // Só renderiza o gráfico se estiver visível
      if (this.isChartVisivel('chartEvolucao'))  this.renderChartEvolucao(lista);
      if (this.isChartVisivel('chartTipos'))     this.renderChartTipos(lista);
      if (this.isChartVisivel('chartSetores'))   this.renderChartSetores(lista);
      if (this.isChartVisivel('chartMotivos'))   this.renderChartMotivos(lista);
      if (this.isChartVisivel('chartRanking'))   this.renderRankingFuncionarios(lista);
      if (this.isChartVisivel('chartDiasMes'))   this.renderChartDiasMes(lista);
    },

    isChartVisivel(id) {
      return this.state.chartsVisiveis.includes(id);
    },

    /* ================================================================== */
    /* HERO CARD                                                          */
    /* ================================================================== */
    renderHero(lista) {
      const totalHoras = lista.reduce((s, o) => s + horasPerdidas(o), 0);
      const pct = percentual(totalHoras);

      const f = this.state.filtro;
      let funcionariosBase = this.state.funcionarios.filter(x => x.status !== 'Inativo');
      if (f.funcionarioId) funcionariosBase = funcionariosBase.filter(x => x.id === f.funcionarioId);
      if (f.setorId)       funcionariosBase = funcionariosBase.filter(x => x.setorId === f.setorId);
      const ativos = funcionariosBase.length;

      const set = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };
      set('heroPct', fmtPct(pct));
      set('heroHoras', fmtHoras(totalHoras));
      set('heroOcorrencias', lista.length);
      set('heroFuncionarios', ativos);

      const bar = $('#heroBar');
      if (bar) {
        const width = Math.min(100, pct * 5);
        bar.style.width = width + '%';
      }

      const badge = $('#heroBadge');
      if (badge) {
        badge.className = 'dash-hero-badge';
        if (pct < 3) {
          badge.classList.add('ok');
          badge.innerHTML = '<i class="fas fa-circle-check"></i> Dentro do aceitável (< 3%)';
        } else if (pct < 7) {
          badge.classList.add('warn');
          badge.innerHTML = '<i class="fas fa-triangle-exclamation"></i> Atenção (3% a 7%)';
        } else {
          badge.classList.add('bad');
          badge.innerHTML = '<i class="fas fa-circle-exclamation"></i> Crítico (> 7%)';
        }
      }
    },

    /* ================================================================== */
    /* KPIs                                                               */
    /* ================================================================== */
    renderKPIs(lista) {
      const totalHoras = lista.reduce((s, o) => s + horasPerdidas(o), 0);

      const f = this.state.filtro;
      let funcionariosBase = this.state.funcionarios.filter(x => x.status !== 'Inativo');
      if (f.funcionarioId) funcionariosBase = funcionariosBase.filter(x => x.id === f.funcionarioId);
      if (f.setorId)       funcionariosBase = funcionariosBase.filter(x => x.setorId === f.setorId);
      const ativos = funcionariosBase.length;

      const mesesPeriodo = this.calcularMesesPeriodo();
      const horasDisponiveis = ativos * mesesPeriodo * HORAS_MES;
      const taxaAbsent = horasDisponiveis > 0 ? (totalHoras / horasDisponiveis) * 100 : 0;

      const qtd = (tipo) => lista.filter(o => o.tipo === tipo).length;

      const set = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };
      set('dashKpiHoras', fmtHoras(totalHoras));
      set('dashKpiFaltas', qtd('Falta'));
      set('dashKpiAtestados', qtd('Atestado'));
      set('dashKpiAtrasos', qtd('Atraso'));
      set('dashKpiFuncionarios', ativos);
      set('dashKpiAbsent', fmtPct(taxaAbsent));

      set('dashKpiHorasSub', `${lista.length} ocorrência${lista.length === 1 ? '' : 's'}`);
      set('dashKpiFaltasSub',
        `${lista.filter(o => o.tipo === 'Falta').reduce((s,o) => s + (parseInt(o.dias)||0), 0)} dias`);
      set('dashKpiAtestadosSub',
        `${lista.filter(o => o.tipo === 'Atestado').reduce((s,o) => s + (parseInt(o.dias)||0), 0)} dias`);
      set('dashKpiAtrasosSub',
        `${lista.filter(o => o.tipo === 'Atraso').reduce((s,o) => s + (parseFloat(o.horas)||0), 0).toFixed(1)}h`);
      set('dashKpiFuncionariosSub', `${this.state.setores.length} setores`);
      set('dashKpiAbsentSub', `${horasDisponiveis.toFixed(0)}h disponíveis`);
    },

    calcularMesesPeriodo() {
      const f = this.state.filtro;
      const agora = new Date();
      switch (f.periodo) {
        case '30': return 1;
        case '90': return 3;
        case 'mes': return 1;
        case 'ano': return 12;
        case 'personalizado': {
          if (!f.dataInicio || !f.dataFim) return 1;
          const ini = new Date(f.dataInicio), fim = new Date(f.dataFim);
          const dias = Math.max(1, (fim - ini) / 86400000 + 1);
          return Math.max(0.5, dias / 30);
        }
        default: return 12;
      }
    },

    /* ================================================================== */
    /* TOP 4 CIDs                                                         */
    /* ================================================================== */
    renderTopCIDs(lista) {
      const box = $('#dashCids');
      const sub = $('#dashCidsSub');
      if (!box) return;

      const mapa = {};
      lista.forEach(o => {
        const c = (o.cid || '').trim().toUpperCase();
        if (!c) return;
        mapa[c] = (mapa[c] || 0) + 1;
      });

      const entries = Object.entries(mapa).sort((a, b) => b[1] - a[1]).slice(0, 4);

      if (!entries.length) {
        box.innerHTML = `
          <div class="dash-cid-empty">
            <i class="fas fa-notes-medical"></i>
            Sem atestados com CID no período selecionado.
          </div>`;
        if (sub) sub.textContent = 'Nenhum CID encontrado';
        return;
      }

      const max = entries[0][1];
      box.innerHTML = entries.map(([cid, qtd]) => `
        <div class="dash-cid-card">
          <div class="cid-top">
            <span class="dash-cid-code">${cid}</span>
            <span class="dash-cid-count">${qtd}</span>
          </div>
          <div class="dash-cid-desc">${qtd} ocorrência${qtd === 1 ? '' : 's'} · ${((qtd/max)*100).toFixed(0)}% do total</div>
          <div class="dash-cid-bar"><span style="width:${(qtd/max)*100}%"></span></div>
        </div>
      `).join('');

      if (sub) sub.textContent = `${entries.length} CID${entries.length === 1 ? '' : 's'} em destaque`;
    },

    /* ================================================================== */
    /* CHART: EVOLUÇÃO MENSAL                                             */
    /* ================================================================== */
    renderChartEvolucao(lista) {
      const meses = this.ultimosMeses(6);
      const faltas    = meses.map(m => lista.filter(o => o.tipo === 'Falta'    && (o.data||'').startsWith(m)).length);
      const atestados = meses.map(m => lista.filter(o => o.tipo === 'Atestado' && (o.data||'').startsWith(m)).length);
      const atrasos   = meses.map(m => lista.filter(o => o.tipo === 'Atraso'   && (o.data||'').startsWith(m)).length);

      const gradient = (ctx, color) => {
        const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 300);
        g.addColorStop(0, color.replace('rgb', 'rgba').replace(')', ',.25)'));
        g.addColorStop(1, color.replace('rgb', 'rgba').replace(')', ',0)'));
        return g;
      };

      this.criarChart('chartEvolucao', 'line', {
        labels: meses.map(labelMes),
        datasets: [
          {
            label: 'Faltas', data: faltas,
            borderColor: CORES.red,
            backgroundColor: (ctx) => gradient(ctx, 'rgb(239,68,68)'),
            tension: .4, fill: true, borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6,
          },
          {
            label: 'Atestados', data: atestados,
            borderColor: CORES.purple,
            backgroundColor: (ctx) => gradient(ctx, 'rgb(139,92,246)'),
            tension: .4, fill: true, borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6,
          },
          {
            label: 'Atrasos', data: atrasos,
            borderColor: CORES.yellow,
            backgroundColor: (ctx) => gradient(ctx, 'rgb(245,158,11)'),
            tension: .4, fill: true, borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6,
          },
        ],
      }, {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, padding: 14, font: { size: 12, weight: '600' } },
          },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 12, cornerRadius: 8,
            titleFont: { size: 13, weight: '700' },
            bodyFont:  { size: 12 },
          },
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } },
        },
      });

      const sub = $('#dashEvolucaoSub');
      if (sub) sub.textContent = `${meses.length} meses`;
    },

    ultimosMeses(n) {
      const arr = [];
      const hoje = new Date();
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
      return arr;
    },

    /* ================================================================== */
    /* CHART: DISTRIBUIÇÃO POR TIPO                                       */
    /* ================================================================== */
    renderChartTipos(lista) {
      const tipos = ['Falta', 'Atestado', 'Atraso', 'Declaração', 'Licença'];
      const valores = tipos.map(t => lista.filter(o => o.tipo === t).length);
      const ativos = tipos.filter((t, i) => valores[i] > 0);
      const vAtivos = valores.filter(v => v > 0);

      this.criarChart('chartTipos', 'doughnut', {
        labels: ativos,
        datasets: [{
          data: vAtivos,
          backgroundColor: ativos.map(t => TIPO_COR[t]),
          borderWidth: 3,
          borderColor: '#fff',
          hoverOffset: 6,
        }],
      }, {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, padding: 12, font: { size: 11, weight: '600' } },
          },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 12, cornerRadius: 8,
            titleFont: { size: 13, weight: '700' },
            bodyFont:  { size: 12 },
          },
        },
        cutout: '65%',
      });
    },

    /* ================================================================== */
    /* CHART: HORAS POR SETOR                                             */
    /* ================================================================== */
    renderChartSetores(lista) {
      const mapa = {};
      lista.forEach(o => {
        const nome = o.setorNome || 'Sem setor';
        mapa[nome] = (mapa[nome] || 0) + horasPerdidas(o);
      });

      const entries = Object.entries(mapa).sort((a, b) => b[1] - a[1]).slice(0, 8);
      const labels = entries.map(e => e[0]);
      const dados  = entries.map(e => parseFloat(e[1].toFixed(1)));

      this.criarChart('chartSetores', 'bar', {
        labels,
        datasets: [{
          label: 'Horas perdidas',
          data: dados,
          backgroundColor: CORES.blue,
          hoverBackgroundColor: '#2563eb',
          borderRadius: 8,
          maxBarThickness: 44,
        }],
      }, {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 12, cornerRadius: 8,
            titleFont: { size: 13, weight: '700' },
            bodyFont:  { size: 12 },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Horas', font: { weight: '600' } },
            grid: { color: '#f1f5f9' },
          },
          x: { grid: { display: false } },
        },
      });

      const sub = $('#dashSetoresSub');
      if (sub) sub.textContent = `${labels.length} setores`;
    },

    /* ================================================================== */
    /* CHART: MOTIVOS MAIS FREQUENTES                                     */
    /* ================================================================== */
    renderChartMotivos(lista) {
      const mapa = {};
      lista.forEach(o => {
        const m = o.motivo || 'Não informado';
        mapa[m] = (mapa[m] || 0) + 1;
      });

      const entries = Object.entries(mapa).sort((a, b) => b[1] - a[1]).slice(0, 8);
      const labels = entries.map(e => e[0]);
      const dados  = entries.map(e => e[1]);

      this.criarChart('chartMotivos', 'bar', {
        labels,
        datasets: [{
          label: 'Ocorrências',
          data: dados,
          backgroundColor: CORES.purple,
          hoverBackgroundColor: '#7c3aed',
          borderRadius: 8,
          maxBarThickness: 32,
        }],
      }, {
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 12, cornerRadius: 8,
            titleFont: { size: 13, weight: '700' },
            bodyFont:  { size: 12 },
          },
        },
        scales: {
          x: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#f1f5f9' } },
          y: { grid: { display: false } },
        },
      });
    },

    /* ================================================================== */
    /* RANKING FUNCIONÁRIOS                                               */
    /* ================================================================== */
    renderRankingFuncionarios(lista) {
      const box = $('#dashRankingFuncionarios');
      if (!box) return;

      const mapa = {};
      lista.forEach(o => {
        const id = o.funcionarioId || 'sem-id';
        if (!mapa[id]) {
          mapa[id] = {
            nome: o.funcionarioNome || '—',
            setor: o.setorNome || '—',
            horas: 0,
            ocorrencias: 0,
          };
        }
        mapa[id].horas += horasPerdidas(o);
        mapa[id].ocorrencias++;
      });

      const top = Object.values(mapa).sort((a, b) => b.horas - a.horas).slice(0, 10);

      if (!top.length) {
        box.innerHTML = '<div class="dash-empty"><i class="fas fa-inbox"></i><p>Sem dados</p></div>';
        return;
      }

      box.innerHTML = top.map((f, i) => `
        <div class="dash-rank-item">
          <div class="dash-rank-pos">${i + 1}</div>
          <div class="dash-rank-info">
            <div class="dash-rank-name">${f.nome}</div>
            <div class="dash-rank-sub">${f.setor} · ${f.ocorrencias} ocorrência${f.ocorrencias === 1 ? '' : 's'}</div>
          </div>
          <div class="dash-rank-value">${fmtHoras(f.horas)}</div>
        </div>
      `).join('');
    },

    /* ================================================================== */
    /* CHART: DIAS AFASTADOS POR MÊS                                      */
    /* ================================================================== */
    renderChartDiasMes(lista) {
      const meses = this.ultimosMeses(6);
      const tiposAfast = ['Falta', 'Atestado', 'Licença'];
      const dados = meses.map(m =>
        lista
          .filter(o => tiposAfast.includes(o.tipo) && (o.data||'').startsWith(m))
          .reduce((s, o) => s + (parseInt(o.dias) || 0), 0)
      );

      this.criarChart('chartDiasMes', 'bar', {
        labels: meses.map(labelMes),
        datasets: [{
          label: 'Dias afastados',
          data: dados,
          backgroundColor: CORES.red,
          hoverBackgroundColor: '#dc2626',
          borderRadius: 8,
          maxBarThickness: 44,
        }],
      }, {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 12, cornerRadius: 8,
            titleFont: { size: 13, weight: '700' },
            bodyFont:  { size: 12 },
          },
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } },
        },
      });
    },

    /* ================================================================== */
    /* HELPER: CRIAR GRÁFICO                                              */
    /* ================================================================== */
    criarChart(canvasId, tipo, dados, options) {
      const canvas = document.getElementById(canvasId);
      if (!canvas || typeof Chart === 'undefined') return;
      if (this.state.charts[canvasId]) this.state.charts[canvasId].destroy();
      this.state.charts[canvasId] = new Chart(canvas, {
        type: tipo,
        data: dados,
        options: { ...options, animation: { duration: 500 } },
      });
    },
  };

  /* ================================================================== */
  /* ROUTER                                                             */
  /* ================================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'rh-dashboard') {
      Dashboard.init();
    }
  });

})();
