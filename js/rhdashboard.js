/* ==========================================================================
   RHDASHBOARD.JS — Dashboard de RH com Chart.js
   Consome: ocorrencias, funcionarios, setores
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

  /* ------------------------------------------------------------------ */
  /* Constantes                                                          */
  /* ------------------------------------------------------------------ */
  const HORAS_MES = 220;
  const HORAS_DIA = 8;

  const CORES = {
    red:    '#ef4444',
    purple: '#8b5cf6',
    yellow: '#f59e0b',
    blue:   '#3b82f6',
    green:  '#10b981',
    gray:   '#94a3b8',
  };

  const TIPO_COR = {
    'Falta':      CORES.red,
    'Atestado':   CORES.purple,
    'Atraso':     CORES.yellow,
    'Declaração': CORES.blue,
    'Licença':    CORES.green,
  };

  /* ------------------------------------------------------------------ */
  /* Cálculos                                                            */
  /* ------------------------------------------------------------------ */

  function horasPerdidas(oc) {
    if (!oc) return 0;
    if (oc.tipo === 'Atraso' || oc.tipo === 'Declaração') {
      return parseFloat(oc.horas) || 0;
    }
    return (parseInt(oc.dias) || 0) * HORAS_DIA;
  }

  function percentual(horas) {
    return (horas / HORAS_MES) * 100;
  }

  function fmtHoras(h) {
    if (h < 1) return `${(h * 60).toFixed(0)}min`;
    return `${h.toFixed(1).replace('.', ',')}h`;
  }

  function fmtPct(p) {
    return `${p.toFixed(2).replace('.', ',')}%`;
  }

  function labelMes(ym) {
    const [y, m] = ym.split('-');
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${nomes[parseInt(m) - 1]}/${y.slice(2)}`;
  }

  /* ------------------------------------------------------------------ */
  /* Dashboard                                                           */
  /* ------------------------------------------------------------------ */

  const Dashboard = {
    state: {
      ocorrencias: [],
      funcionarios: [],
      setores: [],
      filtroPeriodo: 'ano',
      filtroSetor: '',
      charts: {},
      listeners: [],
    },

    init() {
      console.log('📊 Inicializando Dashboard');
      this.bindEventos();
      this.iniciarListeners();

      setTimeout(() => {
        const ov = document.getElementById('loadingOverlay');
        if (ov) ov.style.display = 'none';
      }, 500);
    },

    bindEventos() {
      $('#dashFiltroPeriodo')?.addEventListener('change', (e) => {
        this.state.filtroPeriodo = e.target.value;
        this.renderTudo();
      });
      $('#dashFiltroSetor')?.addEventListener('change', (e) => {
        this.state.filtroSetor = e.target.value;
        this.renderTudo();
      });
      $('#btnAtualizarDash')?.addEventListener('click', () => this.renderTudo());
    },

    iniciarListeners() {
      this.state.listeners.push(
        COL.funcionarios.onSnapshot(snap => {
          this.state.funcionarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          this.popularFiltroSetor();
          this.renderTudo();
        }, err => console.error('funcionarios:', err))
      );

      this.state.listeners.push(
        COL.setores.onSnapshot(snap => {
          this.state.setores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          this.popularFiltroSetor();
        }, err => console.error('setores:', err))
      );

      this.state.listeners.push(
        COL.ocorrencias.onSnapshot(snap => {
          this.state.ocorrencias = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
          this.renderTudo();
        }, err => console.error('ocorrencias:', err))
      );
    },

    popularFiltroSetor() {
      const sel = $('#dashFiltroSetor');
      if (!sel) return;
      const atual = sel.value;
      sel.innerHTML = '<option value="">Todos os setores</option>' +
        this.state.setores.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
      sel.value = atual;
    },

    /* ---------------- Filtro por período ---------------- */
    filtrarOcorrencias() {
      const todas = this.state.ocorrencias;
      const agora = new Date();
      const setorFiltro = this.state.filtroSetor;
      const periodo = this.state.filtroPeriodo;

      let dataMin = null, dataMax = null;

      if (periodo === '30')  dataMin = new Date(agora.getTime() - 30 * 86400000);
      if (periodo === '90')  dataMin = new Date(agora.getTime() - 90 * 86400000);
      if (periodo === 'mes') {
        const y = agora.getFullYear(), m = agora.getMonth();
        dataMin = new Date(y, m, 1);
        dataMax = new Date(y, m + 1, 0);
      }
      if (periodo === 'ano') {
        dataMin = new Date(agora.getFullYear(), 0, 1);
        dataMax = new Date(agora.getFullYear(), 11, 31);
      }

      return todas.filter(oc => {
        if (setorFiltro && oc.setorId !== setorFiltro) return false;
        if (dataMin || dataMax) {
          const d = new Date((oc.data || '') + 'T00:00:00');
          if (dataMin && d < dataMin) return false;
          if (dataMax && d > dataMax) return false;
        }
        return true;
      });
    },

    /* ---------------- Render principal ---------------- */
    renderTudo() {
      const lista = this.filtrarOcorrencias();
      const empty = $('#dashEmpty');
      const grid  = document.querySelector('.dash-grid');
      const kpis  = $('#dashKpis');

      if (!lista.length) {
        if (empty) empty.style.display = 'block';
        if (grid)  grid.style.display  = 'none';
      } else {
        if (empty) empty.style.display = 'none';
        if (grid)  grid.style.display  = 'grid';
      }
      if (kpis) kpis.style.display = 'grid';

      this.renderKPIs(lista);
      this.renderChartEvolucao(lista);
      this.renderChartTipos(lista);
      this.renderChartSetores(lista);
      this.renderChartMotivos(lista);
      this.renderRankingFuncionarios(lista);
      this.renderChartDiasMes(lista);
    },

    /* ---------------- KPIs ---------------- */
    renderKPIs(lista) {
      const totalHoras = lista.reduce((s, o) => s + horasPerdidas(o), 0);
      const pct = percentual(totalHoras);
      const ativos = this.state.funcionarios.filter(f => f.status !== 'Inativo').length;

      const diasUteis = 22 * (this.state.filtroPeriodo === 'ano' ? 12 : 1);
      const horasDisponiveis = ativos * diasUteis * HORAS_DIA;
      const taxaAbsent = horasDisponiveis > 0 ? (totalHoras / horasDisponiveis) * 100 : 0;

      const qtd = (tipo) => lista.filter(o => o.tipo === tipo).length;

      const set = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };
      set('dashKpiPct', fmtPct(pct));
      set('dashKpiHoras', fmtHoras(totalHoras));
      set('dashKpiFaltas', qtd('Falta'));
      set('dashKpiAtestados', qtd('Atestado'));
      set('dashKpiAtrasos', qtd('Atraso'));
      set('dashKpiFuncionarios', ativos);
      set('dashKpiAbsent', fmtPct(taxaAbsent));

      set('dashKpiPctSub', `${lista.length} ocorrências no período`);
      set('dashKpiFaltasSub', `${lista.filter(o => o.tipo === 'Falta').reduce((s,o) => s + (o.dias||0), 0)} dias`);
      set('dashKpiAtestadosSub', `${lista.filter(o => o.tipo === 'Atestado').reduce((s,o) => s + (o.dias||0), 0)} dias`);
      set('dashKpiAtrasosSub', `${lista.filter(o => o.tipo === 'Atraso').reduce((s,o) => s + (parseFloat(o.horas)||0), 0).toFixed(1)}h`);
      set('dashKpiFuncionariosSub', `${this.state.setores.length} setores`);
      set('dashKpiAbsentSub', `${horasDisponiveis.toFixed(0)}h disponíveis`);
    },

    /* ---------------- Chart: Evolução mensal ---------------- */
    renderChartEvolucao(lista) {
      const meses = this.ultimosMeses(6);
      const dados = {
        Falta:    meses.map(m => lista.filter(o => o.tipo === 'Falta' && (o.data||'').startsWith(m)).length),
        Atestado: meses.map(m => lista.filter(o => o.tipo === 'Atestado' && (o.data||'').startsWith(m)).length),
        Atraso:   meses.map(m => lista.filter(o => o.tipo === 'Atraso' && (o.data||'').startsWith(m)).length),
      };

      this.criarChart('chartEvolucao', 'line', {
        labels: meses.map(labelMes),
        datasets: [
          { label: 'Faltas',    data: dados.Falta,    borderColor: CORES.red,    backgroundColor: 'rgba(239,68,68,.1)',  tension: .35, fill: true, borderWidth: 2, pointRadius: 4 },
          { label: 'Atestados', data: dados.Atestado, borderColor: CORES.purple, backgroundColor: 'rgba(139,92,246,.1)', tension: .35, fill: true, borderWidth: 2, pointRadius: 4 },
          { label: 'Atrasos',   data: dados.Atraso,   borderColor: CORES.yellow, backgroundColor: 'rgba(245,158,11,.1)', tension: .35, fill: true, borderWidth: 2, pointRadius: 4 },
        ],
      }, {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { boxWidth: 12, padding: 12 } } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
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

    /* ---------------- Chart: Tipos ---------------- */
    renderChartTipos(lista) {
      const tipos = ['Falta', 'Atestado', 'Atraso', 'Declaração', 'Licença'];
      const valores = tipos.map(t => lista.filter(o => o.tipo === t).length);
      const ativos = tipos.filter((t, i) => valores[i] > 0);
      const valoresAtivos = valores.filter(v => v > 0);

      this.criarChart('chartTipos', 'doughnut', {
        labels: ativos,
        datasets: [{
          data: valoresAtivos,
          backgroundColor: ativos.map(t => TIPO_COR[t]),
          borderWidth: 2,
          borderColor: '#fff',
        }],
      }, {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } },
        },
        cutout: '65%',
      });
    },

    /* ---------------- Chart: Setores ---------------- */
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
          borderRadius: 6,
          maxBarThickness: 40,
        }],
      }, {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, title: { display: true, text: 'Horas' } } },
      });

      const sub = $('#dashSetoresSub');
      if (sub) sub.textContent = `${labels.length} setores`;
    },

    /* ---------------- Chart: Motivos ---------------- */
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
          borderRadius: 6,
          maxBarThickness: 30,
        }],
      }, {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
      });
    },

    /* ---------------- Ranking funcionários ---------------- */
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

      const top = Object.values(mapa)
        .sort((a, b) => b.horas - a.horas)
        .slice(0, 10);

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

    /* ---------------- Chart: Dias afastados ---------------- */
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
          borderRadius: 6,
          maxBarThickness: 40,
        }],
      }, {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      });
    },

    /* ---------------- Helper: criar/atualizar gráfico ---------------- */
    criarChart(canvasId, tipo, dados, options) {
      const canvas = document.getElementById(canvasId);
      if (!canvas || typeof Chart === 'undefined') return;

      if (this.state.charts[canvasId]) {
        this.state.charts[canvasId].destroy();
      }

      this.state.charts[canvasId] = new Chart(canvas, {
        type: tipo,
        data: dados,
        options: {
          ...options,
          animation: { duration: 500 },
        },
      });
    },
  };

  /* ------------------------------------------------------------------ */
  /* Router                                                              */
  /* ------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'rh-dashboard') {
      Dashboard.init();
    }
  });

})();
