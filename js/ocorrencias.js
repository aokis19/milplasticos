/* ==========================================================================
   OCORRENCIAS.JS — Módulo unificado: Faltas, Atestados, Atrasos, Declarações
   Correções: filtro de período "tudo" por padrão + filtro por funcionário
              + filtro de data personalizado
   ========================================================================== */

(function () {
  'use strict';

  const db = window.db || window.firebaseDB;
  if (!db) {
    console.error('❌ Firestore não disponível em ocorrencias.js');
    return;
  }

  const COL = {
    ocorrencias:  db.collection('ocorrencias'),
    funcionarios: db.collection('funcionarios'),
    setores:      db.collection('setores'),
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
      border-radius:8px; font-weight:600; z-index:99999;
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

  const fmtDate = (str) => {
    if (!str) return '—';
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  };

  const hoje = () => new Date().toISOString().split('T')[0];

  function diffDias(inicio, fim) {
    if (!inicio || !fim) return 0;
    const d1 = new Date(inicio + 'T00:00:00');
    const d2 = new Date(fim   + 'T00:00:00');
    return Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
  }

  const TIPO_INFO = {
    Falta:        { cls: 'oc-badge-falta',      ico: 'fa-user-xmark',        cor: 'red' },
    Atestado:     { cls: 'oc-badge-atestado',   ico: 'fa-file-medical',      cor: 'purple' },
    Atraso:       { cls: 'oc-badge-atraso',     ico: 'fa-clock',             cor: 'yellow' },
    Declaração:   { cls: 'oc-badge-declaracao', ico: 'fa-file-signature',    cor: 'blue' },
    Licença:      { cls: 'oc-badge-licenca',    ico: 'fa-notes-medical',     cor: 'green' },
  };

  function badgeTipo(tipo) {
    const info = TIPO_INFO[tipo] || TIPO_INFO.Falta;
    return `<span class="oc-badge ${info.cls}"><i class="fas ${info.ico}"></i> ${tipo}</span>`;
  }

  function badgeStatus(status) {
    const map = {
      'Pendente':  'oc-status-pendente',
      'Aprovado':  'oc-status-aprovado',
      'Rejeitado': 'oc-status-rejeitado',
    };
    return `<span class="oc-status ${map[status] || 'oc-status-pendente'}">${status || 'Pendente'}</span>`;
  }

  function fecharModal() {
    $$('.oc-modal').forEach(m => m.classList.remove('open'));
  }

  /* ------------------------------------------------------------------ */
  /* Módulo principal                                                    */
  /* ------------------------------------------------------------------ */

  const ModuloOcorrencias = {
    _initialized: false,
    _bindado: false,
    state: {
      ocorrencias: [],
      funcionarios: [],
      setores: [],
      editando: null,
      listeners: [],
    },

    init() {
      if (this._initialized) return;
      this._initialized = true;
      console.log('🧩 Inicializando ModuloOcorrencias');

      this.bindEventos();
      this.iniciarListeners();

      // Mostrar o box de data personalizada se o filtro já começar com ele
      this.togglePeriodoCustom();

      setTimeout(() => {
        const ov = document.getElementById('loadingOverlay');
        if (ov) ov.style.display = 'none';
      }, 500);
    },

    /* ---------------- Eventos ---------------- */
    bindEventos() {
      if (this._bindado) return;
      this._bindado = true;

      /* Cliques */
      document.addEventListener('click', (e) => {
        if (e.target.closest('#btnNovaOcorrencia')) {
          e.preventDefault();
          this.abrirModal();
          return;
        }
        if (e.target.closest('[data-close-oc]')) {
          e.preventDefault();
          fecharModal();
          return;
        }
        if (e.target.classList.contains('oc-modal')) {
          fecharModal();
          return;
        }
        if (e.target.closest('#btnLimparFiltrosOC')) {
          e.preventDefault();
          this.limparFiltros();
          return;
        }
        const btnEdit = e.target.closest('[data-action="oc-edit"]');
        if (btnEdit) {
          const oc = this.state.ocorrencias.find(x => x.id === btnEdit.dataset.id);
          this.abrirModal(oc);
          return;
        }
        const btnDel = e.target.closest('[data-action="oc-del"]');
        if (btnDel) {
          this.excluir(btnDel.dataset.id);
          return;
        }
        const btnExport = e.target.closest('#btnExportOcorrencias');
        if (btnExport) {
          e.preventDefault();
          this.exportarCSV();
          return;
        }
      });

      /* Submit */
      document.addEventListener('submit', (e) => {
        if (e.target.id === 'formOcorrencia') {
          e.preventDefault();
          this.salvar();
        }
      });

      /* Input */
      document.addEventListener('input', (e) => {
        if (e.target.id === 'ocFiltroTexto') this.render();
        if (e.target.id === 'ocDataInicio' || e.target.id === 'ocDataFim') {
          this.calcularPreview();
        }
        if (e.target.id === 'ocHoras') this.calcularPreview();
        if (e.target.id === 'ocTipo') this.toggleCamposCondicionais();
        if (e.target.id === 'ocDataInicioFiltro' || e.target.id === 'ocDataFimFiltro') {
          this.render();
        }
      });

      /* Change */
      document.addEventListener('change', (e) => {
        const filtros = [
          'ocFiltroTipo', 'ocFiltroSetor', 'ocFiltroStatus',
          'ocFiltroFuncionario', 'ocFiltroPeriodo'
        ];
        if (filtros.includes(e.target.id)) {
          if (e.target.id === 'ocFiltroPeriodo') this.togglePeriodoCustom();
          this.render();
        }
        if (e.target.id === 'ocFuncionario') this.preencherInfoFuncionario();
        if (e.target.id === 'ocTipo') this.toggleCamposCondicionais();
      });

      /* ESC */
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') fecharModal();
      });
    },

    /* ---------------- Listeners Firestore ---------------- */
    iniciarListeners() {
      this.state.listeners.push(
        COL.funcionarios.onSnapshot(snap => {
          this.state.funcionarios = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
          this.popularSelectFuncionarios();
          this.popularFiltroFuncionario();
          this.popularFiltroSetor();
        }, err => console.error('funcionarios:', err))
      );

      this.state.listeners.push(
        COL.setores.onSnapshot(snap => {
          this.state.setores = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
          this.popularFiltroSetor();
        }, err => console.error('setores:', err))
      );

      this.state.listeners.push(
        COL.ocorrencias.onSnapshot(snap => {
          this.state.ocorrencias = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
          this.render();
          this.renderKPIs();
        }, err => console.error('ocorrencias:', err))
      );
    },

    /* ---------------- Selects ---------------- */
    popularSelectFuncionarios() {
      const sel = $('#ocFuncionario');
      if (!sel) return;
      const atual = sel.value;
      const ativos = this.state.funcionarios.filter(f => f.status !== 'Inativo');
      sel.innerHTML = '<option value="">Selecione o funcionário...</option>' +
        ativos.map(f => `<option value="${f.id}">${f.nome} — ${f.setorNome || 'sem setor'} (${f.matricula || 's/mat'})</option>`).join('');
      sel.value = atual;
    },

    popularFiltroFuncionario() {
      const sel = $('#ocFiltroFuncionario');
      if (!sel) return;
      const atual = sel.value;
      sel.innerHTML = '<option value="">Todos os funcionários</option>' +
        this.state.funcionarios.map(f =>
          `<option value="${f.id}">${f.nome}${f.setorNome ? ' — ' + f.setorNome : ''}</option>`
        ).join('');
      sel.value = atual;
    },

    popularFiltroSetor() {
      const sel = $('#ocFiltroSetor');
      if (!sel) return;
      const atual = sel.value;
      sel.innerHTML = '<option value="">Todos os setores</option>' +
        this.state.setores.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
      sel.value = atual;
    },

    preencherInfoFuncionario() {
      const id = $('#ocFuncionario')?.value;
      const box = $('#ocFuncInfo');
      if (!box) return;
      if (!id) { box.style.display = 'none'; return; }
      const f = this.state.funcionarios.find(x => x.id === id);
      if (!f) { box.style.display = 'none'; return; }
      box.style.display = 'flex';
      box.innerHTML = `
        <span><i class="fas fa-id-badge"></i> Matrícula: <strong>${f.matricula || '—'}</strong></span>
        <span><i class="fas fa-building"></i> Setor: <strong>${f.setorNome || '—'}</strong></span>
        <span><i class="fas fa-briefcase"></i> Cargo: <strong>${f.cargo || '—'}</strong></span>
        <span><i class="fas fa-circle-check"></i> Status: <strong>${f.status || 'Ativo'}</strong></span>
      `;
    },

    toggleCamposCondicionais() {
      const tipo = $('#ocTipo')?.value;
      const mostrar = (sel, on) => {
        const el = $(sel);
        if (el) el.classList.toggle('show', on);
      };
      mostrar('#ocGroupDataFim', tipo === 'Atestado' || tipo === 'Licença');
      mostrar('#ocGroupHoras',   tipo === 'Atraso' || tipo === 'Declaração');
      mostrar('#ocGroupCID',     tipo === 'Atestado');
      mostrar('#ocGroupMedico',  tipo === 'Atestado');
      this.calcularPreview();
    },

    togglePeriodoCustom() {
      const sel = $('#ocFiltroPeriodo');
      const box = $('#ocPeriodoCustom');
      if (!box || !sel) return;
      const personalizado = sel.value === 'personalizado';
      box.style.display = personalizado ? 'flex' : 'none';
    },

    calcularPreview() {
      const box = $('#ocCalcBox');
      if (!box) return;
      const tipo = $('#ocTipo')?.value;
      const inicio = $('#ocDataInicio')?.value;
      const fim = $('#ocDataFim')?.value || inicio;
      const horas = parseFloat($('#ocHoras')?.value) || 0;

      let texto = '';
      if (tipo === 'Atraso' || tipo === 'Declaração') {
        if (horas > 0) {
          texto = `⏱ <strong>${horas}h</strong> serão registradas como tempo perdido.`;
        } else {
          texto = 'Informe as horas para calcular o impacto.';
        }
      } else if (inicio) {
        const dias = diffDias(inicio, fim);
        texto = `📅 <strong>${dias} ${dias === 1 ? 'dia' : 'dias'}</strong> de afastamento (${fmtDate(inicio)} a ${fmtDate(fim)}).`;
      } else {
        texto = 'Preencha a data para ver o resumo.';
      }
      box.innerHTML = texto;
      box.style.display = 'block';
    },

    /* ---------------- Modal ---------------- */
    abrirModal(oc = null) {
      this.state.editando = oc;
      const f = $('#formOcorrencia');
      f.reset();
      $('#ocId').value = oc?.id || '';
      $('#ocModalTitle').innerHTML = oc
        ? '<i class="fas fa-pen"></i> Editar Ocorrência'
        : '<i class="fas fa-plus-circle"></i> Nova Ocorrência';

      if (oc) {
        $('#ocFuncionario').value = oc.funcionarioId || '';
        $('#ocTipo').value = oc.tipo || 'Falta';
        $('#ocDataInicio').value = oc.data || hoje();
        $('#ocDataFim').value = oc.dataFim || '';
        $('#ocHoras').value = oc.horas || '';
        $('#ocMotivo').value = oc.motivo || '';
        $('#ocCID').value = oc.cid || '';
        $('#ocMedico').value = oc.medico || '';
        $('#ocObservacoes').value = oc.observacoes || '';
        $('#ocStatus').value = oc.status || 'Pendente';
      } else {
        $('#ocDataInicio').value = hoje();
        $('#ocTipo').value = 'Falta';
        $('#ocStatus').value = 'Pendente';
      }

      this.preencherInfoFuncionario();
      this.toggleCamposCondicionais();
      this.calcularPreview();
      $('#modalOcorrencia').classList.add('open');
    },

    /* ---------------- Salvar ---------------- */
    async salvar() {
      const id = $('#ocId').value;
      const funcId = $('#ocFuncionario').value;
      const func = this.state.funcionarios.find(f => f.id === funcId);

      if (!func) return toast('Selecione um funcionário', 'error');
      const tipo = $('#ocTipo').value;
      const data = $('#ocDataInicio').value;
      if (!data) return toast('Informe a data', 'error');

      const dataFim = $('#ocDataFim').value || data;
      const dias = diffDias(data, dataFim);
      const horas = parseFloat($('#ocHoras').value) || 0;

      const dados = {
        funcionarioId: func.id,
        funcionarioNome: func.nome,
        funcionarioMatricula: func.matricula || '',
        setorId: func.setorId || '',
        setorNome: func.setorNome || '',
        tipo,
        data,
        dataFim,
        dias,
        horas: (tipo === 'Atraso' || tipo === 'Declaração') ? horas : 0,
        motivo: $('#ocMotivo').value.trim(),
        cid: $('#ocCID').value.trim(),
        medico: $('#ocMedico').value.trim(),
        observacoes: $('#ocObservacoes').value.trim(),
        status: $('#ocStatus').value,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      };

      try {
        if (id) {
          await COL.ocorrencias.doc(id).update(dados);
          toast('Ocorrência atualizada!');
        } else {
          dados.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
          await COL.ocorrencias.add(dados);
          toast('Ocorrência registrada!');
        }
        fecharModal();
      } catch (err) {
        console.error(err);
        toast('Erro ao salvar ocorrência', 'error');
      }
    },

    async excluir(id) {
      if (!confirm('Excluir esta ocorrência?')) return;
      try {
        await COL.ocorrencias.doc(id).delete();
        toast('Ocorrência excluída');
      } catch (err) {
        console.error(err);
        toast('Erro ao excluir', 'error');
      }
    },

    /* ---------------- Filtros ---------------- */
    limparFiltros() {
      ['ocFiltroTexto','ocFiltroTipo','ocFiltroSetor','ocFiltroStatus','ocFiltroFuncionario']
        .forEach(id => { const el = $('#' + id); if (el) el.value = ''; });
      const per = $('#ocFiltroPeriodo'); if (per) per.value = 'tudo';
      const di = $('#ocDataInicioFiltro'); if (di) di.value = '';
      const df = $('#ocDataFimFiltro'); if (df) df.value = '';
      this.togglePeriodoCustom();
      this.render();
    },

    /**
     * Aplica os filtros ativos e retorna as ocorrências que passam.
     * Suporta:
     *   - Período rápido: 7 / 30 / 90 / hoje / mes / tudo / personalizado
     *   - Filtro por funcionário
     *   - Filtro por setor, tipo, status, texto
     */
    getFiltradas() {
      const tipo    = $('#ocFiltroTipo')?.value || '';
      const setor   = $('#ocFiltroSetor')?.value || '';
      const status  = $('#ocFiltroStatus')?.value || '';
      const funcId  = $('#ocFiltroFuncionario')?.value || '';
      const periodo = $('#ocFiltroPeriodo')?.value || 'tudo';   // ⚠️ PADRÃO = tudo
      const texto   = ($('#ocFiltroTexto')?.value || '').toLowerCase();

      const agora = new Date();
      let dataMin = null, dataMax = null;

      if (periodo === '7')    dataMin = new Date(agora.getTime() - 7  * 86400000);
      if (periodo === '30')   dataMin = new Date(agora.getTime() - 30 * 86400000);
      if (periodo === '90')   dataMin = new Date(agora.getTime() - 90 * 86400000);
      if (periodo === 'hoje') {
        dataMin = new Date(agora.toDateString());
        dataMax = new Date(agora.toDateString());
      }
      if (periodo === 'mes') {
        const y = agora.getFullYear(), m = agora.getMonth();
        dataMin = new Date(y, m, 1);
        dataMax = new Date(y, m + 1, 0);
      }
      if (periodo === 'personalizado') {
        const di = $('#ocDataInicioFiltro')?.value;
        const df = $('#ocDataFimFiltro')?.value;
        if (di) dataMin = new Date(di + 'T00:00:00');
        if (df) dataMax = new Date(df + 'T23:59:59');
      }
      // 'tudo' → dataMin e dataMax ficam null → sem filtro de data

      return this.state.ocorrencias.filter(oc => {
        if (tipo   && oc.tipo !== tipo) return false;
        if (setor  && oc.setorId !== setor) return false;
        if (status && oc.status !== status) return false;
        if (funcId && oc.funcionarioId !== funcId) return false;
        if (texto) {
          const blob = `${oc.funcionarioNome} ${oc.funcionarioMatricula} ${oc.motivo} ${oc.observacoes}`.toLowerCase();
          if (!blob.includes(texto)) return false;
        }
        if (dataMin || dataMax) {
          const d = new Date((oc.data || '') + 'T00:00:00');
          if (dataMin && d < dataMin) return false;
          if (dataMax && d > dataMax) return false;
        }
        return true;
      });
    },

    /* ---------------- KPIs ---------------- */
    renderKPIs() {
      const todas = this.state.ocorrencias;
      const mesAtual = new Date().toISOString().slice(0, 7); // YYYY-MM
      const doMes = todas.filter(o => (o.data || '').startsWith(mesAtual));

      const qtd = (tipo) => doMes.filter(o => o.tipo === tipo).length;

      const setKpi = (id, valor) => { const el = $('#' + id); if (el) el.textContent = valor; };
      setKpi('kpiFaltas',      qtd('Falta'));
      setKpi('kpiAtestados',   qtd('Atestado'));
      setKpi('kpiAtrasos',     qtd('Atraso'));
      setKpi('kpiDeclaracoes', qtd('Declaração'));

      const diasPerdidos = doMes
        .filter(o => ['Falta', 'Atestado', 'Licença'].includes(o.tipo))
        .reduce((s, o) => s + (parseInt(o.dias) || 0), 0);
      setKpi('kpiDiasPerdidos', diasPerdidos);

      const horasPerdidas = doMes
        .filter(o => ['Atraso', 'Declaração'].includes(o.tipo))
        .reduce((s, o) => s + (parseFloat(o.horas) || 0), 0);
      setKpi('kpiHorasPerdidas', horasPerdidas.toFixed(1) + 'h');
    },

    /* ---------------- Render tabela ---------------- */
    render() {
      const tbody = $('#ocTabelaBody');
      const count = $('#ocTotalRegistros');
      if (!tbody) return;

      const lista = this.getFiltradas();
      if (count) count.textContent = `${lista.length} ${lista.length === 1 ? 'registro' : 'registros'}`;

      if (!lista.length) {
        tbody.innerHTML = `
          <tr><td colspan="10">
            <div class="oc-empty">
              <i class="fas fa-inbox"></i>
              <p>Nenhuma ocorrência encontrada com os filtros atuais.</p>
            </div>
          </td></tr>`;
        return;
      }

      tbody.innerHTML = lista.map(oc => `
        <tr>
          <td>${fmtDate(oc.data)}${oc.dataFim && oc.dataFim !== oc.data ? ` <small style="color:#64748b">→ ${fmtDate(oc.dataFim)}</small>` : ''}</td>
          <td class="cell-func">
            ${oc.funcionarioNome || '—'}
            <small>${oc.funcionarioMatricula || ''} ${oc.setorNome ? '· ' + oc.setorNome : ''}</small>
          </td>
          <td>${badgeTipo(oc.tipo)}</td>
          <td>${oc.tipo === 'Atraso' || oc.tipo === 'Declaração'
              ? (oc.horas ? oc.horas + 'h' : '—')
              : ((oc.dias || 0) + ' ' + (oc.dias === 1 ? 'dia' : 'dias'))}</td>
          <td>${oc.motivo || '—'}</td>
          <td>${oc.cid || '—'}</td>
          <td>${badgeStatus(oc.status)}</td>
          <td>${oc.observacoes ? `<span title="${oc.observacoes}">${oc.observacoes.slice(0, 30)}${oc.observacoes.length > 30 ? '…' : ''}</span>` : '—'}</td>
          <td>
            <div class="oc-actions">
              <button data-action="oc-edit" data-id="${oc.id}" title="Editar"><i class="fas fa-pen"></i></button>
              <button class="del" data-action="oc-del" data-id="${oc.id}" title="Excluir"><i class="fas fa-trash"></i></button>
            </div>
          </td>
        </tr>
      `).join('');
    },

    /* ---------------- Exportar CSV ---------------- */
    exportarCSV() {
      const lista = this.getFiltradas();
      if (!lista.length) return toast('Nada para exportar', 'error');

      const headers = ['Data','Data Fim','Dias','Horas','Funcionário','Matrícula','Setor','Tipo','Motivo','CID','Médico','Status','Observações'];
      const linhas = lista.map(o => [
        o.data, o.dataFim || '', o.dias || 0, o.horas || 0,
        o.funcionarioNome, o.funcionarioMatricula, o.setorNome,
        o.tipo, o.motivo || '', o.cid || '', o.medico || '',
        o.status || '', (o.observacoes || '').replace(/[\r\n;]/g, ' ')
      ]);

      const csv = [headers, ...linhas]
        .map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
        .join('\r\n');

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ocorrencias_${hoje()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast(`${lista.length} registros exportados`);
    },
  };

  /* ------------------------------------------------------------------ */
  /* Router                                                              */
  /* ------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'rh-ocorrencias') {
      ModuloOcorrencias.init();
    }
  });

})();
