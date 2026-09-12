/* ==========================================================================
   RHDASHBOARD.JS — Dashboard de RH com Chart.js + filtros avançados
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

  const HORAS_MES = 220;
  const HORAS_DIA = 8;

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

  const fmtHoras = (h) => h < 1 ? `${(h * 60).toFixed(0)}min` : `${h.toFixed(1).replace('.', ',')}h`;
  const fmtPct   = (p) => `${p.toFixed(2).replace('.', ',')}%`;

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
        filtro.dataInicio = e.target.value; this.renderTudo();
      });
      $('#dashDataFim')?.addEventListener('change', (e) => {
        filtro.dataFim = e.target.value; this.renderTudo();
      });

      $('#btnLimparFiltros')?.addEventListener('click', () => this.limparFiltros());
      $('#btnAtualizarDash')?.addEventListener('click', () => this.renderTudo());
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
      ['dashFiltroPeriodo','dashFiltroFuncionario','dashFiltroSetor','dashFiltroTipo','dashFiltroCID'].forEach(id => {
        const el = $('#' + id);
        if (el) el.value = id === 'dashFiltroPeriodo' ? 'ano' : '';
      });
      const di = $('#dashDataInicio'), df = $('#dashDataFim');
      if (di) di.value = '';
      if (df) df.value = '';
      this.togglePeriodoCustom();
      this.renderTudo();
    },

    /* ---------------- Listeners Firestore ---------------- */
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

    /* ---------------- Popular selects ---------------- */
    popularFiltroFuncionario() {
      const sel = $('#dashFiltroFuncionario');
      if (!sel) return;
      const atual = sel.value;
      sel.innerHTML = '<option value="">Todos os funcionários</option>' +
        this.state.funcionarios.map(f => `<option value="${f.id}">${f.nome}${f.setorNome ? ' — ' + f.setorNome : ''}</option>`).join('');
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
      const cids = [...new Set(this.state.ocorrencias.map(o => (o.cid || '').trim()).filter(Boolean))]
        .sort();
      sel.innerHTML = '<option value="">Todos os CID</option>' +
        cids.map(c => `<option value="${c}">${c}</option>`).join('');
      sel.value = atual;
    },

    /* ---------------- Filtro principal ---------------- */
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

        if (f.cid && (oc.cid || '').trim() !== f.cid) return false;

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
      const cids  = $('#dashCids');

      if (!lista.length) {
        if (empty) empty.style.display = 'block';
        if (grid)  grid.style.display  = 'none';
      } else {
        if (empty) empty.style.display = 'none';
        if (grid)  grid.style.display  = 'grid';
      }

      this.renderKPIs(lista);
      this.renderTopCIDs(lista);
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

      // Funcionários considerados (respeitando o filtro)
      const f = this.state.filtro;
      let funcionariosBase = this.state.funcionarios.filter(x => x.status !== 'Inativo');
      if (f.funcionarioId) funcionariosBase = funcionariosBase.filter(x => x.id === f.funcionarioId);
      if (f.setorId) funcionariosBase = funcionariosBase.filter(x => x.setorId === f.setorId);
      const ativos = funcionariosBase.length;

      // Horas disponíveis: número de meses do período × 220h × funcionários
      const mesesPeriodo = this.calcularMesesPeriodo();
      const horasDisponiveis = ativos * mesesPeriodo * HORAS_MES;
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

      set('dashKpiPctSub', `${lista.length} ocorrência${lista.length === 1 ? '' : 's'}`);
      set('dashKpiFaltasSub', `${lista.filter(o => o.tipo === 'Falta').reduce((s,o) => s + (parseInt(o.dias)||0), 0)} dias`);
      set('dashKpiAtestadosSub', `${lista.filter(o => o.tipo === 'Atestado').reduce((s,o) => s + (parseInt(o.dias)||0), 0)} dias`);
      set('dashKpiAtrasosSub', `${lista.filter(o => o.tipo === 'Atraso').reduce((s,o) => s + (parseFloat(o.horas)||0), 0).toFixed(1)}h`);
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

    /* ---------------- Top 4 CIDs ---------------- */
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
        box.innerHTML = '<div class="dash-cid-empty">Sem atestados com CID no período selecionado.</div>';
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

    /* ---------------- Evolução mensal ---------------- */
    renderChartEvolucao(lista) {
      const meses = this.ultimosMeses(6);
      const faltas = meses.map(m => lista.filter(o => o.tipo === 'Falta' && (o.data||'').startsWith(m)).length);
      const atestados = meses.map(m => lista.filter(o => o.tipo === 'Atestado' && (o.data||'').startsWith(m)).length);
      const atrasos = meses.map(m => lista.filter(o => o.tipo === 'Atraso' && (o.data||'').startsWith(m)).length);

      this.criarChart('chartEvolucao', 'line', {
        labels: meses.map(labelMes),
        datasets: [
          { label: 'Faltas',    data: faltas,    borderColor: CORES.red,    backgroundColor: 'rgba(239,68,68,.1)',  tension: .35, fill: true, borderWidth: 2, pointRadius: 4 },
          { label: 'Atestados', data: atestados, borderColor: CORES.purple, backgroundColor: 'rgba(139,92,246,.1)', tension: .35, fill: true, borderWidth: 2, pointRadius: 4 },
          { label: 'Atrasos',   data: atrasos,   borderColor: CORES.yellow, backgroundColor: 'rgba(245,158,11,.1)', tension: .35, fill: true, borderWidth: 2, pointRadius: 4 },
        ],
      }, {
        responsive: true, maintainAspectRatio: false,
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

    /* ---------------- Distribuição por tipo ---------------- */
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
          borderWidth: 2,
          borderColor: '#fff',
        }],
      }, {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } } },
        cutout: '65%',
      });
    },

    /* ---------------- Setores ---------------- */
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
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, title: { display: true, text: 'Horas' } } },
      });

      const sub = $('#dashSetoresSub');
      if (sub) sub.textContent = `${labels.length} setores`;
    },

    /* ---------------- Motivos ---------------- */
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
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
      });
    },

    /* ---------------- Ranking ---------------- */
    renderRankingFuncionarios(lista) {
      const box = $('#dashRankingFuncionarios');
      if (!box) return;

      const mapa = {};
      lista.forEach(o => {
        const id = o.funcionarioId || 'sem-id';
        if (!mapa[id]) mapa[id] = { nome: o.funcionarioNome || '—', setor: o.setorNome || '—', horas: 0, ocorrencias: 0 };
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

    /* ---------------- Dias afastados por mês ---------------- */
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
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      });
    },

    /* ---------------- Helper: criar gráfico ---------------- */
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

  /* ------------------------------------------------------------------ */
  /* Router                                                              */
  /* ------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'rh-dashboard') {
      Dashboard.init();
    }
  });

})();
