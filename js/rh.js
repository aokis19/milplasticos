  /* =======================================================================
     MÓDULO: HUB (página rh.html)
     ======================================================================= */

  const ModuloHub = {
    state: {
      funcionarios: [],
      setores: [],
      ocorrencias: [],
      listeners: [],
    },

    init() {
      console.log('🧩 Inicializando ModuloHub');
      this.initTabs();
      this.bindEventos();
      this.initModais();
      this.iniciarListeners();
    },

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

    bindEventos() {
      // Botões de cadastro
      $('#btnNovoFuncionario')?.addEventListener('click', () => this.abrirModalFuncionario());
      $('#btnNovoSetor')?.addEventListener('click', () => this.abrirModalSetor());

      // Forms
      $('#formFuncionario')?.addEventListener('submit', e => this.salvarFuncionario(e));
      $('#formSetor')?.addEventListener('submit', e => this.salvarSetor(e));

      // Busca
      $('#filtroFuncionarioHub')?.addEventListener('input', () => this.renderFuncionarios());
    },

    initModais() {
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

    /* ---------- Setores ---------- */
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
      if (tbody) {
        if (!this.state.setores.length) {
          tbody.innerHTML = '<tr><td colspan="4" class="rh-empty"><i class="fas fa-building"></i>Nenhum setor cadastrado</td></tr>';
        } else {
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

          tbody.querySelectorAll('[data-action="edit-setor"]').forEach(btn =>
            btn.addEventListener('click', () => {
              const s = this.state.setores.find(x => x.id === btn.dataset.id);
              this.abrirModalSetor(s);
            })
          );
          tbody.querySelectorAll('[data-action="del-setor"]').forEach(btn =>
            btn.addEventListener('click', () => this.excluirSetor(btn.dataset.id))
          );
        }
      }

      // Popula select do modal funcionário
      const selectFunc = $('#funcSetor');
      if (selectFunc) {
        const atual = selectFunc.value;
        selectFunc.innerHTML = '<option value="">Selecione...</option>' +
          this.state.setores.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
        selectFunc.value = atual;
      }
    },

    /* ---------- Funcionários ---------- */
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

    /* ---------- KPIs do hub ---------- */
    renderKPIs() {
      const totalFunc = this.state.funcionarios.length;
      const ativos = this.state.funcionarios.filter(f => f.status === 'Ativo').length;
      const setores = this.state.setores.length;

      // Mês atual
      const hoje = new Date();
      const mesAtual = hoje.getMonth() + 1;
      const anoAtual = hoje.getFullYear();
      const ocsMes = this.state.ocorrencias.filter(o =>
        Number(o.mes) === mesAtual && Number(o.ano) === anoAtual
      );
      const diasMes = ocsMes.reduce((s, o) => s + (Number(o.dias) || 0), 0);

      const set = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };
      set('hubKpiFunc', ativos);
      set('hubKpiFuncSub', `${totalFunc} cadastrados`);
      set('hubKpiSetores', setores);
      set('hubKpiOcor', ocsMes.length);
      set('hubKpiOcorSub', `${MESES[mesAtual-1]} ${anoAtual}`);
      set('hubKpiDias', diasMes);

      // Badges dos cards
      const atestados = this.state.ocorrencias.filter(o => o.tipo === 'Atestado').length;
      const faltas    = this.state.ocorrencias.filter(o => o.tipo === 'Falta').length;
      const atrasos   = this.state.ocorrencias.filter(o => o.tipo === 'Atraso').length;

      const fmt = n => `${n} ${n === 1 ? 'registro' : 'registros'}`;
      set('hubBadgeAtestados', fmt(atestados));
      set('hubBadgeFaltas',    fmt(faltas));
      set('hubBadgeAtrasos',   fmt(atrasos));
    },

    /* ---------- Listeners ---------- */
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
          this.renderKPIs();
        }, err => console.error('funcionarios:', err))
      );

      this.state.listeners.push(
        COL.ocorrencias.onSnapshot(snap => {
          this.state.ocorrencias = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          this.renderKPIs();
        }, err => console.error('ocorrencias:', err))
      );
    },
  };
