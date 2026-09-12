/* ==========================================================================
   RH.JS — Arquivo unificado (Página RH + Dashboard)
   Central de Custos — Sistema Mil
   --------------------------------------------------------------------------
   Detecta a página via <body data-page="rh|dashboard"> e inicializa
   o módulo correto.

   MÓDULOS:
   - Helpers .......... funções utilitárias compartilhadas
   - ModuloRH ......... cadastro de setores, funcionários e ocorrências
   - ModuloDashboard .. KPIs, gráficos, filtros, fullscreen, top CID
   ========================================================================== */

(function () {
  'use strict';

  /* =======================================================================
     HELPERS COMPARTILHADOS
     ======================================================================= */

  const db = window.db || window.firebaseDB;
  if (!db) {
    console.error('❌ Firestore não disponível. Verifique firebase-init.js');
    return;
  }

  const COL = {
    setores:      db.collection('setores'),
    funcionarios: db.collection('funcionarios'),
    ocorrencias:  db.collection('ocorrencias'),
  };

  const $  = (s, ctx = document) => ctx.querySelector(s);
  const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];

  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const DIAS  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  function toast(msg, tipo = 'success') {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = `
      position:fixed; bottom:20px; right:20px; padding:.75rem 1.25rem;
      background:${tipo === 'error' ? '#ef4444' : '#10b981'}; color:#fff;
      border-radius:8px; font-weight:600; z-index:9999;
      box-shadow:0 10px 25px rgba(0,0,0,.2); font-size:.875rem;
      font-family:'Segoe UI',system-ui,sans-serif;
      transition:opacity .3s, transform .3s;
    `;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  function fmtDate(str) {
    if (!str) return '—';
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  }

  function badgeTipo(tipo) {
    const mapa = {
      'Atestado':   ['badge-atestado',   'fa-file-medical'],
      'Falta':      ['badge-falta',      'fa-user-xmark'],
      'Declaração': ['badge-declaracao', 'fa-file-signature'],
      'Licença':    ['badge-licenca',    'fa-notes-medical'],
    };
    const [cls, ico] = mapa[tipo] || ['badge-atestado', 'fa-circle'];
    return `<span class="badge-tipo ${cls}"><i class="fas ${ico}"></i> ${tipo}</span>`;
  }

  function fecharModais() {
    $$('.rh-modal').forEach(m => m.classList.remove('open'));
  }

  /* =======================================================================
     MÓDULO: PÁGINA RH
     ======================================================================= */

  const ModuloRH = {
    state: {
      setores: [],
      funcionarios: [],
      ocorrencias: [],
      listeners: [],
    },

    init() {
      console.log('🧩 Inicializando ModuloRH');
      this.initTabs();
      this.bindEventos();
      this.initModais();
      this.iniciarListeners();
    },

    /* ---------- Tabs ---------- */
    initTabs() {
      $$('.rh-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          $$('.rh-tab').forEach(t => t.classList.remove('active'));
          $$('.rh-tab-content').forEach(c => c.classList.remove('active'));
          tab.classList.add('active');
          const target = $(`#tab-${tab.dataset.tab}`);
          if (target) target.classList.add('active');
        });
      });
    },

    /* ---------- Eventos ---------- */
    bindEventos() {
      // Botões "novo"
      $('#btnNovoSetor')?.addEventListener('click', () => this.abrirModalSetor());
      $('#btnNovoSetorTab')?.addEventListener('click', () => this.abrirModalSetor());
      $('#btnNovoFuncionario')?.addEventListener('click', () => this.abrirModalFuncionario());
      $('#btnNovaOcorrencia')?.addEventListener('click', () => this.abrirModalOcorrencia());

      // Forms
      $('#formSetor')?.addEventListener('submit', e => this.salvarSetor(e));
      $('#formFuncionario')?.addEventListener('submit', e => this.salvarFuncionario(e));
      $('#formOcorrencia')?.addEventListener('submit', e => this.salvarOcorrencia(e));

      // Filtros
      $('#filtroFuncionario')?.addEventListener('input', () => this.renderFuncionarios());
      $('#filtroOcorrencia')?.addEventListener('input', () => this.renderOcorrencias());
      $('#filtroTipoOcorrencia')?.addEventListener('change', () => this.renderOcorrencias());

      // Fechar modais (clique no X, botão cancelar, backdrop)
      $$('[data-close]').forEach(btn =>
        btn.addEventListener('click', () => fecharModais())
      );
      $$('.rh-modal').forEach(m =>
        m.addEventListener('click', e => { if (e.target === m) fecharModais(); })
      );
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') fecharModais();
      });
    },

    initModais() {
      // nada extra — mantido por clareza
    },

    /* ===================================================================
       SETORES
       =================================================================== */
    abrirModalSetor(setor = null) {
      $('#setorId').value = setor?.id || '';
      $('#setorNome').value = setor?.nome || '';
      $('#setorDescricao').value = setor?.descricao || '';
      $('#modalSetorTitle').innerHTML = setor
        ? '<i class="fas fa-pen"></i> Editar Setor'
        : '<i class="fas fa-building"></i> Novo Setor';
      $('#modalSetor').classList.add('open');
    },

    async salvarSetor(e) {
      e.preventDefault();
      const id = $('#setorId').value;
      const dados = {
        nome: $('#setorNome').value.trim(),
        descricao: $('#setorDescricao').value.trim(),
      };
      if (!dados.nome) return toast('Informe o nome do setor', 'error');

      try {
        if (id) {
          await COL.setores.doc(id).update(dados);
        } else {
          await COL.setores.add({
            ...dados,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          });
        }
        toast('Setor salvo com sucesso!');
        fecharModais();
      } catch (err) {
        console.error(err);
        toast('Erro ao salvar setor', 'error');
      }
    },

    async excluirSetor(id) {
      if (!confirm('Excluir este setor?')) return;
      try {
        await COL.setores.doc(id).delete();
        toast('Setor excluído');
      } catch (err) {
        console.error(err);
        toast('Erro ao excluir', 'error');
      }
    },

    renderSetores() {
      const tbody = $('#tabelaSetoresBody');
      if (!tbody) return;

      // Popula select do modal funcionário
      const selectFunc = $('#funcSetor');
      if (selectFunc) {
        selectFunc.innerHTML = '<option value="">Selecione...</option>' +
          this.state.setores.map(s =>
            `<option value="${s.id}">${s.nome}</option>`
          ).join('');
      }

      if (!this.state.setores.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="rh-empty"><i class="fas fa-building"></i>Nenhum setor cadastrado</td></tr>';
        return;
      }

      tbody.innerHTML = this.state.setores.map(s => {
        const qtd = this.state.funcionarios.filter(f => f.setorId === s.id).length;
        return `
          <tr>
            <td><strong>${s.nome}</strong></td>
            <td>${s.descricao || '—'}</td>
            <td>${qtd}</td>
            <td style="text-align:right;">
              <button class="rh-btn rh-btn-secondary rh-btn-icon" data-action="edit-setor" data-id="${s.id}">
                <i class="fas fa-pen"></i>
              </button>
              <button class="rh-btn rh-btn-danger rh-btn-icon" data-action="del-setor" data-id="${s.id}">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>`;
      }).join('');

      // Bind botões de ação
      tbody.querySelectorAll('[data-action="edit-setor"]').forEach(btn =>
        btn.addEventListener('click', () => {
          const s = this.state.setores.find(x => x.id === btn.dataset.id);
          this.abrirModalSetor(s);
        })
      );
      tbody.querySelectorAll('[data-action="del-setor"]').forEach(btn =>
        btn.addEventListener('click', () => this.excluirSetor(btn.dataset.id))
      );
    },

    /* ===================================================================
       FUNCIONÁRIOS
       =================================================================== */
    abrirModalFuncionario(func = null) {
      $('#funcionarioId').value = func?.id || '';
      $('#funcNome').value      = func?.nome || '';
      $('#funcMatricula').value = func?.matricula || '';
      $('#funcCargo').value     = func?.cargo || '';
      $('#funcAdmissao').value  = func?.admissao || '';
      $('#funcStatus').value    = func?.status || 'Ativo';
      $('#funcSetor').value     = func?.setorId || '';
      $('#modalFuncionarioTitle').innerHTML = func
        ? '<i class="fas fa-pen"></i> Editar Funcionário'
        : '<i class="fas fa-user-plus"></i> Novo Funcionário';
      $('#modalFuncionario').classList.add('open');
    },

    async salvarFuncionario(e) {
      e.preventDefault();
      const id = $('#funcionarioId').value;
      const setorId = $('#funcSetor').value;
      const setor = this.state.setores.find(s => s.id === setorId);

      const dados = {
        nome:      $('#funcNome').value.trim(),
        matricula: $('#funcMatricula').value.trim(),
        cargo:     $('#funcCargo').value.trim(),
        admissao:  $('#funcAdmissao').value,
        status:    $('#funcStatus').value,
        setorId,
        setorNome: setor?.nome || '',
      };
      if (!dados.nome || !dados.matricula || !setorId) {
        return toast('Preencha os campos obrigatórios', 'error');
      }

      try {
        if (id) {
          await COL.funcionarios.doc(id).update(dados);
        } else {
          await COL.funcionarios.add({
            ...dados,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          });
        }
        toast('Funcionário salvo!');
        fecharModais();
      } catch (err) {
        console.error(err);
        toast('Erro ao salvar funcionário', 'error');
      }
    },

    async excluirFuncionario(id) {
      if (!confirm('Excluir este funcionário?')) return;
      try {
        await COL.funcionarios.doc(id).delete();
        toast('Funcionário excluído');
      } catch (err) {
        console.error(err);
        toast('Erro ao excluir', 'error');
      }
    },

    renderFuncionarios() {
      const grid = $('#gridFuncionarios');
      if (!grid) return;

      const busca = ($('#filtroFuncionario')?.value || '').toLowerCase();

      // Popula select do modal ocorrência
      const selectOcor = $('#ocorFuncionario');
      if (selectOcor) {
        selectOcor.innerHTML = '<option value="">Selecione...</option>' +
          this.state.funcionarios.map(f =>
            `<option value="${f.id}">${f.nome} — ${f.setorNome || 'sem setor'}</option>`
          ).join('');
      }

      const lista = this.state.funcionarios.filter(f =>
        !busca ||
        f.nome?.toLowerCase().includes(busca) ||
        f.setorNome?.toLowerCase().includes(busca) ||
        f.matricula?.toLowerCase().includes(busca)
      );

      if (!lista.length) {
        grid.innerHTML = '<div class="rh-empty" style="grid-column:1/-1;"><i class="fas fa-users"></i>Nenhum funcionário encontrado</div>';
        return;
      }

      grid.innerHTML = lista.map(f => {
        const inicial = (f.nome || '?').charAt(0).toUpperCase();
        return `
          <div class="rh-func-card">
            <div class="rh-func-actions">
              <button data-action="edit-func" data-id="${f.id}"><i class="fas fa-pen"></i></button>
              <button class="del" data-action="del-func" data-id="${f.id}"><i class="fas fa-trash"></i></button>
            </div>
            <div class="rh-func-avatar">${inicial}</div>
            <div class="rh-func-name">${f.nome}</div>
            <div class="rh-func-cargo">${f.cargo || '—'}</div>
            <div class="rh-func-meta">
              <span>Setor <strong>${f.setorNome || '—'}</strong></span>
              <span>Matrícula <strong>${f.matricula || '—'}</strong></span>
            </div>
          </div>`;
      }).join('');

      grid.querySelectorAll('[data-action="edit-func"]').forEach(btn =>
        btn.addEventListener('click', () => {
          const f = this.state.funcionarios.find(x => x.id === btn.dataset.id);
          this.abrirModalFuncionario(f);
        })
      );
      grid.querySelectorAll('[data-action="del-func"]').forEach(btn =>
        btn.addEventListener('click', () => this.excluirFuncionario(btn.dataset.id))
      );
    },

    /* ===================================================================
       OCORRÊNCIAS
       =================================================================== */
    abrirModalOcorrencia(ocor = null) {
      $('#ocorrenciaId').value   = ocor?.id || '';
      $('#ocorFuncionario').value = ocor?.funcionarioId || '';
      $('#ocorTipo').value       = ocor?.tipo || '';
      $('#ocorData').value       = ocor?.data || new Date().toISOString().slice(0,10);
      $('#ocorDias').value       = ocor?.dias || 1;
      $('#ocorCid').value        = ocor?.cid || '';
      $('#ocorObservacao').value = ocor?.observacao || '';
      $('#modalOcorrenciaTitle').innerHTML = ocor
        ? '<i class="fas fa-pen"></i> Editar Ocorrência'
        : '<i class="fas fa-file-medical"></i> Nova Ocorrência';
      $('#modalOcorrencia').classList.add('open');
    },

    async salvarOcorrencia(e) {
      e.preventDefault();
      const id = $('#ocorrenciaId').value;
      const funcId = $('#ocorFuncionario').value;
      const func = this.state.funcionarios.find(f => f.id === funcId);

      const dataStr = $('#ocorData').value;
      const dt = new Date(dataStr + 'T00:00:00');

      const dados = {
        funcionarioId:   funcId,
        nomeFuncionario: func?.nome || '',
        setorId:         func?.setorId || '',
        setorNome:       func?.setorNome || '',
        tipo:            $('#ocorTipo').value,
        data:            dataStr,
        ano:             dt.getFullYear(),
        mes:             dt.getMonth() + 1,
        diaSemana:       dt.getDay(),
        dias:            Number($('#ocorDias').value) || 1,
        cid:             $('#ocorCid').value.trim().toUpperCase(),
        observacao:      $('#ocorObservacao').value.trim(),
      };

      if (!dados.funcionarioId || !dados.tipo || !dados.data) {
        return toast('Preencha os campos obrigatórios', 'error');
      }

      try {
        if (id) {
          await COL.ocorrencias.doc(id).update(dados);
        } else {
          await COL.ocorrencias.add({
            ...dados,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          });
        }
        toast('Ocorrência salva!');
        fecharModais();
      } catch (err) {
        console.error(err);
        toast('Erro ao salvar ocorrência', 'error');
      }
    },

    async excluirOcorrencia(id) {
      if (!confirm('Excluir esta ocorrência?')) return;
      try {
        await COL.ocorrencias.doc(id).delete();
        toast('Ocorrência excluída');
      } catch (err) {
        console.error(err);
        toast('Erro ao excluir', 'error');
      }
    },

    renderOcorrencias() {
      const tbody = $('#tabelaOcorrenciasBody');
      if (!tbody) return;

      const busca = ($('#filtroOcorrencia')?.value || '').toLowerCase();
      const tipo  = $('#filtroTipoOcorrencia')?.value || '';

      const lista = this.state.ocorrencias
        .filter(o =>
          (!tipo || o.tipo === tipo) &&
          (!busca ||
            o.nomeFuncionario?.toLowerCase().includes(busca) ||
            o.setorNome?.toLowerCase().includes(busca))
        )
        .sort((a, b) => (b.data || '').localeCompare(a.data || ''));

      if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="rh-empty"><i class="fas fa-inbox"></i>Nenhuma ocorrência registrada</td></tr>';
        return;
      }

      tbody.innerHTML = lista.map(o => `
        <tr>
          <td><strong>${o.nomeFuncionario}</strong></td>
          <td>${o.setorNome || '—'}</td>
          <td>${badgeTipo(o.tipo)}</td>
          <td>${fmtDate(o.data)}</td>
          <td>${o.dias}</td>
          <td>${o.observacao || '—'}</td>
          <td style="text-align:right;">
            <button class="rh-btn rh-btn-secondary rh-btn-icon" data-action="edit-ocor" data-id="${o.id}">
              <i class="fas fa-pen"></i>
            </button>
            <button class="rh-btn rh-btn-danger rh-btn-icon" data-action="del-ocor" data-id="${o.id}">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>`).join('');

      tbody.querySelectorAll('[data-action="edit-ocor"]').forEach(btn =>
        btn.addEventListener('click', () => {
          const o = this.state.ocorrencias.find(x => x.id === btn.dataset.id);
          this.abrirModalOcorrencia(o);
        })
      );
      tbody.querySelectorAll('[data-action="del-ocor"]').forEach(btn =>
        btn.addEventListener('click', () => this.excluirOcorrencia(btn.dataset.id))
      );
    },

    /* ===================================================================
       LISTENERS (Firestore realtime)
       =================================================================== */
    iniciarListeners() {
      this.state.listeners.push(
        COL.setores.onSnapshot(snap => {
          this.state.setores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          this.renderSetores();
          this.renderFuncionarios();
        }, err => console.error('setores:', err))
      );

      this.state.listeners.push(
        COL.funcionarios.onSnapshot(snap => {
          this.state.funcionarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          this.renderFuncionarios();
          this.renderSetores();
        }, err => console.error('funcionarios:', err))
      );

      this.state.listeners.push(
        COL.ocorrencias.onSnapshot(snap => {
          this.state.ocorrencias = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          this.renderOcorrencias();
        }, err => console.error('ocorrencias:', err))
      );
    },
  };

  /* =======================================================================
     MÓDULO: DASHBOARD
     ======================================================================= */

  const ModuloDashboard = {
    state: {
      ocorrencias: [],
      setores: [],
      filtradas: [],
      charts: {},
      listeners: [],
    },

    init() {
      console.log('🧩 Inicializando ModuloDashboard');
      this.bindEventos();
      this.iniciarListeners();
    },

    /* ---------- Eventos ---------- */
    bindEventos() {
      $('#btnFullscreen')?.addEventListener('click', () => this.toggleFullscreen());
      $('#btnVoltarRH')?.addEventListener('click', () => {
        window.location.href = '/html/rh.html';
      });
      $('#btnAtualizar')?.addEventListener('click', () => {
        this.aplicarFiltros();
        Object.values(this.state.charts).forEach(c => c.resize());
      });

      // Filtros
      ['filtroAno','filtroSetor','filtroTipo','filtroMes'].forEach(id => {
        $('#' + id)?.addEventListener('change', () => this.aplicarFiltros());
      });
      $('#btnLimparFiltros')?.addEventListener('click', () => this.limparFiltros());

      // Fullscreen: detecta saída via ESC
      document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) this.sairFullscreen();
      });
    },

    /* ===================================================================
       FILTROS
       =================================================================== */
    aplicarFiltros() {
      const ano   = $('#filtroAno')?.value || '';
      const setor = $('#filtroSetor')?.value || '';
      const tipo  = $('#filtroTipo')?.value || '';
      const mes   = $('#filtroMes')?.value || '';

      this.state.filtradas = this.state.ocorrencias.filter(o => {
        if (ano   && String(o.ano) !== String(ano)) return false;
        if (setor && o.setorId !== setor) return false;
        if (tipo  && o.tipo !== tipo) return false;
        if (mes   && String(o.mes) !== String(mes)) return false;
        return true;
      });

      this.renderKPIs();
      this.renderGraficos();
    },

    limparFiltros() {
      ['filtroAno','filtroSetor','filtroTipo','filtroMes'].forEach(id => {
        const el = $('#' + id);
        if (el) el.value = '';
      });
      this.aplicarFiltros();
    },

    popularFiltros() {
      // Anos
      const selAno = $('#filtroAno');
      if (selAno) {
        const atual = selAno.value;
        const anos = [...new Set(this.state.ocorrencias.map(o => o.ano).filter(Boolean))]
          .sort((a, b) => b - a);
        selAno.innerHTML = '<option value="">Todos</option>' +
          anos.map(a => `<option value="${a}">${a}</option>`).join('');
        selAno.value = atual;
      }

      // Setores
      const selSetor = $('#filtroSetor');
      if (selSetor) {
        const atual = selSetor.value;
        selSetor.innerHTML = '<option value="">Todos</option>' +
          this.state.setores.map(s =>
            `<option value="${s.id}">${s.nome}</option>`
          ).join('');
        selSetor.value = atual;
      }
    },

    /* ===================================================================
       KPIs
       =================================================================== */
    renderKPIs() {
      const ocs = this.state.filtradas;
      const total = ocs.length;

      const set = (id, val) => { const el = $('#' + id); if (el) el.textContent = val; };

      set('kpiTotal', total);

      const atestado   = ocs.filter(o => o.tipo === 'Atestado');
      const falta      = ocs.filter(o => o.tipo === 'Falta');
      const declaracao = ocs.filter(o => o.tipo === 'Declaração');
      const somaDias = arr => arr.reduce((s, o) => s + (Number(o.dias) || 0), 0);

      set('kpiAtestado',   atestado.length);
      set('kpiFalta',      falta.length);
      set('kpiDeclaracao', declaracao.length);

      set('kpiAtestadoDias',   `${somaDias(atestado)} dias`);
      set('kpiFaltaDias',      `${somaDias(falta)} dias`);
      set('kpiDeclaracaoDias', `${somaDias(declaracao)} dias`);

      const totalDias = somaDias(ocs);
      set('kpiDias',  totalDias);
      set('kpiMedia', total
        ? `média ${(totalDias / total).toFixed(1)} dias/evento`
        : 'média 0 dias/evento');

      // Período aplicado
      const partes = [];
      const ano = $('#filtroAno')?.value;
      const mes = $('#filtroMes')?.value;
      const setorId = $('#filtroSetor')?.value;
      if (ano) partes.push(ano);
      if (mes) partes.push(MESES[Number(mes) - 1]);
      if (setorId) {
        const s = this.state.setores.find(x => x.id === setorId);
        if (s) partes.push(s.nome);
      }
      set('kpiPeriodo', partes.length ? partes.join(' · ') : 'Todos os registros');
    },

    /* ===================================================================
       GRÁFICOS
       =================================================================== */
    destruirChart(k) {
      if (this.state.charts[k]) {
        this.state.charts[k].destroy();
        delete this.state.charts[k];
      }
    },

    renderGraficos() {
      const ocs = this.state.filtradas;

      /* ---------- Por Setor ---------- */
      const porSetor = {};
      ocs.forEach(o => {
        const k = o.setorNome || 'Sem setor';
        porSetor[k] = (porSetor[k] || 0) + 1;
      });
      const setorOrd = Object.entries(porSetor).sort((a, b) => b[1] - a[1]);

      this.destruirChart('setor');
      const canvasSetor = $('#chartSetor');
      if (canvasSetor) {
        this.state.charts.setor = new Chart(canvasSetor, {
          type: 'bar',
          data: {
            labels: setorOrd.map(x => x[0]),
            datasets: [{
              data: setorOrd.map(x => x[1]),
              backgroundColor: '#6366f1',
              borderRadius: 8,
              barThickness: 38,
            }],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { beginAtZero: true, ticks: { color: '#64748b', precision: 0 }, grid: { color: '#f1f5f9' } },
              y: { ticks: { color: '#334155', font: { size: 12 } }, grid: { display: false } },
            },
          },
        });
      }

      /* ---------- Por Tipo ---------- */
      const porTipo = {};
      ocs.forEach(o => { porTipo[o.tipo] = (porTipo[o.tipo] || 0) + 1; });

      this.destruirChart('tipo');
      const canvasTipo = $('#chartTipo');
      if (canvasTipo) {
        this.state.charts.tipo = new Chart(canvasTipo, {
          type: 'doughnut',
          data: {
            labels: Object.keys(porTipo),
            datasets: [{
              data: Object.values(porTipo),
              backgroundColor: ['#3b82f6', '#ef4444', '#a855f7', '#10b981'],
              borderWidth: 0,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: '#64748b', padding: 14, usePointStyle: true },
              },
            },
          },
        });
      }

      /* ---------- Por Dia da Semana ---------- */
      const porDia = Array(7).fill(0);
      ocs.forEach(o => {
        const d = (typeof o.diaSemana === 'number')
          ? o.diaSemana
          : (o.data ? new Date(o.data + 'T00:00:00').getDay() : null);
        if (d !== null && d >= 0 && d < 7) porDia[d]++;
      });

      this.destruirChart('dia');
      const canvasDia = $('#chartDia');
      if (canvasDia) {
        this.state.charts.dia = new Chart(canvasDia, {
          type: 'bar',
          data: {
            labels: DIAS,
            datasets: [{
              data: porDia,
              backgroundColor: '#06b6d4',
              borderRadius: 6,
              barThickness: 28,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#64748b' } },
              y: { beginAtZero: true, ticks: { color: '#64748b', precision: 0 }, grid: { color: '#f1f5f9' } },
            },
          },
        });
      }

      /* ---------- Por Mês ---------- */
      const porMes = Array(12).fill(0);
      ocs.forEach(o => {
        const m = (typeof o.mes === 'number')
          ? o.mes - 1
          : (o.data ? new Date(o.data + 'T00:00:00').getMonth() : null);
        if (m !== null && m >= 0 && m < 12) porMes[m]++;
      });

      this.destruirChart('mes');
      const canvasMes = $('#chartMes');
      if (canvasMes) {
        this.state.charts.mes = new Chart(canvasMes, {
          type: 'bar',
          data: {
            labels: MESES,
            datasets: [{
              data: porMes,
              backgroundColor: '#10b981',
              borderRadius: 6,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } },
              y: { beginAtZero: true, ticks: { color: '#64748b', precision: 0 }, grid: { color: '#f1f5f9' } },
            },
          },
        });
      }

      /* ---------- Top CID ---------- */
      this.renderTopCID(ocs);

      /* ---------- Top Funcionários ---------- */
      this.renderTopFuncionarios(ocs);
    },

    renderTopCID(ocs) {
      const container = $('#listaCid');
      if (!container) return;

      const porCid = {};
      ocs.forEach(o => {
        const cid = (o.cid || '').trim().toUpperCase();
        if (!cid) return;
        porCid[cid] = (porCid[cid] || 0) + 1;
      });

      const ranking = Object.entries(porCid).sort((a, b) => b[1] - a[1]).slice(0, 10);

      if (!ranking.length) {
        container.innerHTML = '<div class="db-empty"><i class="fas fa-stethoscope"></i>Nenhum CID registrado no período</div>';
        return;
      }

      const max = ranking[0][1];
      container.innerHTML = ranking.map(([cid, qtd]) => `
        <div class="db-cid-item">
          <div class="db-cid-code">${cid}</div>
          <div class="db-cid-bar"><span style="width:${(qtd / max) * 100}%"></span></div>
          <div class="db-cid-count">${qtd}</div>
        </div>
      `).join('');
    },

    renderTopFuncionarios(ocs) {
      const container = $('#rankFuncionarios');
      if (!container) return;

      const porFunc = {};
      ocs.forEach(o => {
        const k = o.nomeFuncionario || '—';
        porFunc[k] = (porFunc[k] || 0) + 1;
      });

      const ranking = Object.entries(porFunc).sort((a, b) => b[1] - a[1]).slice(0, 10);

      if (!ranking.length) {
        container.innerHTML = '<div class="db-empty"><i class="fas fa-users"></i>Nenhum funcionário no período</div>';
        return;
      }

      container.innerHTML = ranking.map(([nome, qtd], i) => `
        <div class="db-rank-item">
          <div class="db-rank-pos">${i + 1}</div>
          <div class="db-rank-name">${nome}</div>
          <div class="db-rank-count">${qtd}</div>
        </div>
      `).join('');
    },

    /* ===================================================================
       FULLSCREEN
       =================================================================== */
    toggleFullscreen() {
      if (!document.fullscreenElement) {
        this.entrarFullscreen();
      } else {
        this.sairFullscreen();
      }
    },

    entrarFullscreen() {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (req) req.call(el).catch(err => console.warn('Fullscreen bloqueado:', err));

      $('#dbPage')?.classList.add('fullscreen');
      document.body.classList.add('db-locked');

      const btn = $('#btnFullscreen');
      if (btn) btn.innerHTML = '<i class="fas fa-compress"></i> Sair';

      document.querySelectorAll('.sidebar, .topbar, #sidebar-container, #topbar-container')
        .forEach(el => el.style.display = 'none');

      this.ajustarLayoutFullscreen(true);
    },

    sairFullscreen() {
      if (document.fullscreenElement) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
        if (exit) exit.call(document);
      }

      $('#dbPage')?.classList.remove('fullscreen');
      document.body.classList.remove('db-locked');

      document.querySelectorAll('.sidebar, .topbar, #sidebar-container, #topbar-container')
        .forEach(el => el.style.display = '');

      const btn = $('#btnFullscreen');
      if (btn) btn.innerHTML = '<i class="fas fa-expand"></i> Tela Cheia';

      this.ajustarLayoutFullscreen(false);
      setTimeout(() => Object.values(this.state.charts).forEach(c => c.resize()), 300);
    },

    ajustarLayoutFullscreen(on) {
      document.querySelectorAll('.db-grid').forEach(g => {
        if (on) {
          g.style.gridTemplateColumns = g.classList.contains('triple')
            ? '1fr 1fr 1fr 1fr'
            : '1fr 1fr 1fr';
        } else {
          g.style.gridTemplateColumns = '';
        }
      });
      setTimeout(() => Object.values(this.state.charts).forEach(c => c.resize()), 200);
    },

    /* ===================================================================
       LISTENERS
       =================================================================== */
    iniciarListeners() {
      this.state.listeners.push(
        COL.setores.onSnapshot(snap => {
          this.state.setores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          this.popularFiltros();
          this.aplicarFiltros();
        }, err => console.error('setores:', err))
      );

      this.state.listeners.push(
        COL.ocorrencias.onSnapshot(snap => {
          this.state.ocorrencias = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          this.popularFiltros();
          this.aplicarFiltros();
        }, err => console.error('ocorrencias:', err))
      );
    },
  };

  /* =======================================================================
     ROUTER SIMPLES — decide qual módulo inicializar
     ======================================================================= */
  document.addEventListener('DOMContentLoaded', () => {
    const pagina = document.body.dataset.page;
    console.log(`📄 Página detectada: ${pagina || 'não definida'}`);

    if (pagina === 'rh') {
      ModuloRH.init();
    } else if (pagina === 'dashboard') {
      ModuloDashboard.init();
    } else {
      console.warn('⚠️ Defina <body data-page="rh"> ou <body data-page="dashboard">');
    }
  });

})();
