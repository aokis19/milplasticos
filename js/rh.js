/* ==========================================================================
   RH.JS — Arquivo unificado (com Event Delegation)
   Módulos: Hub (Setores + Funcionários)
   ========================================================================== */

(function () {
  'use strict';

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

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

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

  function fecharModais() {
    $$('.rh-modal').forEach(m => m.classList.remove('open'));
  }

  /* =======================================================================
     MÓDULO: HUB (Setores + Funcionários)
     ======================================================================= */

  const ModuloHub = {
    _initialized: false,
    _eventosBindados: false,
    state: {
      funcionarios: [],
      setores: [],
      ocorrencias: [],
      listeners: [],
    },

    init() {
      if (this._initialized) return;
      this._initialized = true;
      console.log('🧩 Inicializando ModuloHub');

      this.bindEventos();
      this.iniciarListeners();

      setTimeout(() => {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = 'none';
      }, 500);
    },

    /* ---------------- Event Delegation ---------------- */
    bindEventos() {
      if (this._eventosBindados) return;
      this._eventosBindados = true;

      /* ===== CLIQUES ===== */
      document.addEventListener('click', (e) => {
        if (e.target.closest('#btnNovoFuncionario')) {
          e.preventDefault();
          this.abrirModalFuncionario();
          return;
        }
        if (e.target.closest('#btnNovoSetor')) {
          e.preventDefault();
          this.abrirModalSetor();
          return;
        }
        if (e.target.closest('[data-close]')) {
          e.preventDefault();
          fecharModais();
          return;
        }
        if (e.target.classList.contains('rh-modal')) {
          fecharModais();
          return;
        }

        const btnEditSetor = e.target.closest('[data-action="edit-setor"]');
        if (btnEditSetor) {
          const s = this.state.setores.find(x => x.id === btnEditSetor.dataset.id);
          this.abrirModalSetor(s);
          return;
        }
        const btnDelSetor = e.target.closest('[data-action="del-setor"]');
        if (btnDelSetor) {
          this.excluirSetor(btnDelSetor.dataset.id);
          return;
        }

        const btnEditFunc = e.target.closest('[data-action="edit-func"]');
        if (btnEditFunc) {
          const f = this.state.funcionarios.find(x => x.id === btnEditFunc.dataset.id);
          this.abrirModalFuncionario(f);
          return;
        }
        const btnDelFunc = e.target.closest('[data-action="del-func"]');
        if (btnDelFunc) {
          this.excluirFuncionario(btnDelFunc.dataset.id);
          return;
        }

        const tab = e.target.closest('.rh-tab');
        if (tab) {
          $$('.rh-tab').forEach(t => t.classList.remove('active'));
          $$('.rh-tab-content').forEach(c => c.classList.remove('active'));
          tab.classList.add('active');
          const target = $(`#tab-${tab.dataset.tab}`);
          if (target) target.classList.add('active');
          return;
        }
      });

      /* ===== SUBMIT ===== */
      document.addEventListener('submit', (e) => {
        if (e.target.id === 'formFuncionario') {
          e.preventDefault();
          this.salvarFuncionario(e);
          return;
        }
        if (e.target.id === 'formSetor') {
          e.preventDefault();
          this.salvarSetor(e);
          return;
        }
      });

      /* ===== INPUT ===== */
      document.addEventListener('input', (e) => {
        if (e.target.id === 'filtroFuncionarioHub') {
          this.renderFuncionarios();
        }
      });

      /* ===== ESC ===== */
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') fecharModais();
      });
    },

    /* ---------------- SETORES ---------------- */
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
        if (id) await COL.setores.doc(id).update(dados);
        else await COL.setores.add({
          ...dados,
          criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        });
        toast('Setor salvo!');
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
      const tbody = $('#hubTabelaSetoresBody');
      const count = $('#countSetores');
      if (count) count.textContent = this.state.setores.length;
      if (!tbody) return;

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

      /* Popula o select de setores no modal de funcionário */
      const selectFunc = $('#funcSetor');
      if (selectFunc) {
        const atual = selectFunc.value;
        selectFunc.innerHTML = '<option value="">Selecione...</option>' +
          this.state.setores.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
        selectFunc.value = atual;
      }
    },

    /* ---------------- FUNCIONÁRIOS ---------------- */
    abrirModalFuncionario(func = null) {
      $('#funcionarioId').value  = func?.id || '';
      $('#funcNome').value       = func?.nome || '';
      $('#funcMatricula').value  = func?.matricula || '';
      $('#funcCargo').value      = func?.cargo || '';
      $('#funcAdmissao').value   = func?.admissao || '';
      $('#funcStatus').value     = func?.status || 'Ativo';
      $('#funcSetor').value      = func?.setorId || '';
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
        if (id) await COL.funcionarios.doc(id).update(dados);
        else await COL.funcionarios.add({
          ...dados,
          criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        });
        toast('Funcionário salvo!');
        fecharModais();
      } catch (err) {
        console.error(err);
        toast('Erro ao salvar', 'error');
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
      const grid = $('#hubGridFuncionarios');
      const count = $('#countFuncionarios');
      if (count) count.textContent = this.state.funcionarios.length;
      if (!grid) return;

      const busca = ($('#filtroFuncionarioHub')?.value || '').toLowerCase();
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
    },

    /* ---------------- Badge do card "Absenteísmo" ---------------- */
    renderBadgesCards() {
      const total = this.state.ocorrencias.length;
      const el = $('#hubBadgeAtestados');
      if (el) el.textContent = `${total} ${total === 1 ? 'registro' : 'registros'}`;
    },

    /* ---------------- Listeners Firestore ---------------- */
    iniciarListeners() {
      this.state.listeners.push(
        COL.setores.onSnapshot(snap => {
          this.state.setores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          this.renderSetores();
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
          this.renderBadgesCards();
        }, err => console.error('ocorrencias:', err))
      );
    },
  };

  /* =======================================================================
     ROUTER
     ======================================================================= */
  document.addEventListener('DOMContentLoaded', () => {
    const pagina = document.body.dataset.page;
    console.log(`📄 Página detectada: ${pagina || 'não definida'}`);

    const rotas = {
      'rh-hub': ModuloHub,
    };

    const modulo = rotas[pagina];
    if (modulo) modulo.init();
    else console.warn('⚠️ Página sem módulo:', pagina);
  });

})();
