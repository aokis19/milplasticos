/* ===================================================================
   RH — Dashboard, Funcionários, Setores e Ocorrências
   =================================================================== */

const db = window.db || firebase.firestore();

// Coleções
const COL = {
  setores:      db.collection("setores"),
  funcionarios: db.collection("funcionarios"),
  ocorrencias:  db.collection("ocorrencias"),
};

// Cache em memória (para reatividade rápida)
let state = {
  setores: [],
  funcionarios: [],
  ocorrencias: [],
  charts: {},
};

/* ---------- Helpers ---------- */
const $  = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];

function toast(msg, tipo = "success") {
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.cssText = `
    position:fixed; bottom:20px; right:20px; padding:.75rem 1.25rem;
    background:${tipo === "error" ? "#ef4444" : "#10b981"}; color:#fff;
    border-radius:8px; font-weight:600; z-index:9999;
    box-shadow:0 10px 25px rgba(0,0,0,.2); font-size:.875rem;`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function fmtDate(str) {
  if (!str) return "—";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

/* ===================================================================
   1. SETORES
   =================================================================== */
function abrirModalSetor(setor = null) {
  $("#setorId").value = setor?.id || "";
  $("#setorNome").value = setor?.nome || "";
  $("#setorDescricao").value = setor?.descricao || "";
  $("#modalSetorTitle").innerHTML = setor
    ? '<i class="fas fa-pen"></i> Editar Setor'
    : '<i class="fas fa-building"></i> Novo Setor';
  $("#modalSetor").classList.add("open");
}

async function salvarSetor(e) {
  e.preventDefault();
  const id = $("#setorId").value;
  const dados = {
    nome: $("#setorNome").value.trim(),
    descricao: $("#setorDescricao").value.trim(),
    criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
  };
  try {
    if (id) await COL.setores.doc(id).update(dados);
    else    await COL.setores.add(dados);
    toast("Setor salvo com sucesso!");
    fecharModais();
  } catch (err) {
    console.error(err);
    toast("Erro ao salvar setor", "error");
  }
}

async function excluirSetor(id) {
  if (!confirm("Excluir este setor?")) return;
  await COL.setores.doc(id).delete();
  toast("Setor excluído");
}

function renderSetores() {
  const tbody = $("#tabelaSetoresBody");
  const selectFunc = $("#funcSetor");

  // Select do modal funcionário
  selectFunc.innerHTML = '<option value="">Selecione...</option>' +
    state.setores.map(s => `<option value="${s.id}">${s.nome}</option>`).join("");

  if (!state.setores.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="rh-empty"><i class="fas fa-building"></i>Nenhum setor cadastrado</td></tr>';
    return;
  }

  tbody.innerHTML = state.setores.map(s => {
    const qtdFunc = state.funcionarios.filter(f => f.setorId === s.id).length;
    return `
      <tr>
        <td><strong>${s.nome}</strong></td>
        <td>${s.descricao || "—"}</td>
        <td>${qtdFunc}</td>
        <td style="text-align:right;">
          <button class="rh-btn rh-btn-secondary rh-btn-icon" onclick="editarSetor('${s.id}')">
            <i class="fas fa-pen"></i>
          </button>
          <button class="rh-btn rh-btn-danger rh-btn-icon" onclick="excluirSetor('${s.id}')">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>`;
  }).join("");
}

window.editarSetor = (id) => abrirModalSetor(state.setores.find(s => s.id === id));
window.excluirSetor = excluirSetor;

/* ===================================================================
   2. FUNCIONÁRIOS
   =================================================================== */
function abrirModalFuncionario(func = null) {
  $("#funcionarioId").value = func?.id || "";
  $("#funcNome").value      = func?.nome || "";
  $("#funcMatricula").value = func?.matricula || "";
  $("#funcCargo").value     = func?.cargo || "";
  $("#funcAdmissao").value  = func?.admissao || "";
  $("#funcStatus").value    = func?.status || "Ativo";
  $("#funcSetor").value     = func?.setorId || "";
  $("#modalFuncionarioTitle").innerHTML = func
    ? '<i class="fas fa-pen"></i> Editar Funcionário'
    : '<i class="fas fa-user-plus"></i> Novo Funcionário';
  $("#modalFuncionario").classList.add("open");
}

async function salvarFuncionario(e) {
  e.preventDefault();
  const id = $("#funcionarioId").value;
  const setorId = $("#funcSetor").value;
  const setor = state.setores.find(s => s.id === setorId);

  const dados = {
    nome:      $("#funcNome").value.trim(),
    matricula: $("#funcMatricula").value.trim(),
    cargo:     $("#funcCargo").value.trim(),
    admissao:  $("#funcAdmissao").value,
    status:    $("#funcStatus").value,
    setorId,
    setorNome: setor?.nome || "",
  };
  try {
    if (id) await COL.funcionarios.doc(id).update(dados);
    else    await COL.funcionarios.add({ ...dados, criadoEm: firebase.firestore.FieldValue.serverTimestamp() });
    toast("Funcionário salvo!");
    fecharModais();
  } catch (err) {
    console.error(err);
    toast("Erro ao salvar", "error");
  }
}

async function excluirFuncionario(id) {
  if (!confirm("Excluir este funcionário?")) return;
  await COL.funcionarios.doc(id).delete();
  toast("Funcionário excluído");
}

function renderFuncionarios() {
  const grid = $("#gridFuncionarios");
  const busca = $("#filtroFuncionario").value.toLowerCase();

  // Select modal ocorrência
  $("#ocorFuncionario").innerHTML = '<option value="">Selecione...</option>' +
    state.funcionarios.map(f =>
      `<option value="${f.id}">${f.nome} — ${f.setorNome || "sem setor"}</option>`
    ).join("");

  const lista = state.funcionarios.filter(f =>
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
    const inicial = (f.nome || "?").charAt(0).toUpperCase();
    return `
      <div class="rh-func-card">
        <div class="rh-func-actions">
          <button onclick="editarFuncionario('${f.id}')"><i class="fas fa-pen"></i></button>
          <button class="del" onclick="excluirFuncionario('${f.id}')"><i class="fas fa-trash"></i></button>
        </div>
        <div class="rh-func-avatar">${inicial}</div>
        <div class="rh-func-name">${f.nome}</div>
        <div class="rh-func-cargo">${f.cargo || "—"}</div>
        <div class="rh-func-meta">
          <span>Setor <strong>${f.setorNome || "—"}</strong></span>
          <span>Matrícula <strong>${f.matricula || "—"}</strong></span>
        </div>
      </div>`;
  }).join("");
}

window.editarFuncionario = (id) => abrirModalFuncionario(state.funcionarios.find(f => f.id === id));
window.excluirFuncionario = excluirFuncionario;

/* ===================================================================
   3. OCORRÊNCIAS
   =================================================================== */
function abrirModalOcorrencia(ocor = null) {
  $("#ocorrenciaId").value = ocor?.id || "";
  $("#ocorFuncionario").value = ocor?.funcionarioId || "";
  $("#ocorTipo").value = ocor?.tipo || "";
  $("#ocorData").value = ocor?.data || new Date().toISOString().slice(0,10);
  $("#ocorDias").value = ocor?.dias || 1;
  $("#ocorCid").value = ocor?.cid || "";
  $("#ocorObservacao").value = ocor?.observacao || "";
  $("#modalOcorrenciaTitle").innerHTML = ocor
    ? '<i class="fas fa-pen"></i> Editar Ocorrência'
    : '<i class="fas fa-file-medical"></i> Nova Ocorrência';
  $("#modalOcorrencia").classList.add("open");
}

async function salvarOcorrencia(e) {
  e.preventDefault();
  const id = $("#ocorrenciaId").value;
  const funcId = $("#ocorFuncionario").value;
  const func = state.funcionarios.find(f => f.id === funcId);

  const dados = {
    funcionarioId: funcId,
    nomeFuncionario: func?.nome || "",
    setorId: func?.setorId || "",
    setorNome: func?.setorNome || "",
    tipo: $("#ocorTipo").value,
    data: $("#ocorData").value,
    dias: Number($("#ocorDias").value) || 1,
    cid: $("#ocorCid").value.trim(),
    observacao: $("#ocorObservacao").value.trim(),
  };
  try {
    if (id) await COL.ocorrencias.doc(id).update(dados);
    else    await COL.ocorrencias.add({ ...dados, criadoEm: firebase.firestore.FieldValue.serverTimestamp() });
    toast("Ocorrência salva!");
    fecharModais();
  } catch (err) {
    console.error(err);
    toast("Erro ao salvar ocorrência", "error");
  }
}

async function excluirOcorrencia(id) {
  if (!confirm("Excluir esta ocorrência?")) return;
  await COL.ocorrencias.doc(id).delete();
  toast("Ocorrência excluída");
}

function badgeTipo(tipo) {
  const mapa = {
    "Atestado":   ["badge-atestado",   "fa-file-medical"],
    "Falta":      ["badge-falta",      "fa-user-xmark"],
    "Declaração": ["badge-declaracao", "fa-file-signature"],
    "Licença":    ["badge-licenca",    "fa-notes-medical"],
  };
  const [cls, ico] = mapa[tipo] || ["badge-atestado", "fa-circle"];
  return `<span class="badge-tipo ${cls}"><i class="fas ${ico}"></i> ${tipo}</span>`;
}

function renderOcorrencias() {
  const tbody = $("#tabelaOcorrenciasBody");
  const busca = $("#filtroOcorrencia").value.toLowerCase();
  const tipo  = $("#filtroTipoOcorrencia").value;

  const lista = state.ocorrencias
    .filter(o =>
      (!tipo || o.tipo === tipo) &&
      (!busca ||
        o.nomeFuncionario?.toLowerCase().includes(busca) ||
        o.setorNome?.toLowerCase().includes(busca))
    )
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="rh-empty"><i class="fas fa-inbox"></i>Nenhuma ocorrência registrada</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(o => `
    <tr>
      <td><strong>${o.nomeFuncionario}</strong></td>
      <td>${o.setorNome || "—"}</td>
      <td>${badgeTipo(o.tipo)}</td>
      <td>${fmtDate(o.data)}</td>
      <td>${o.dias}</td>
      <td>${o.observacao || "—"}</td>
      <td style="text-align:right;">
        <button class="rh-btn rh-btn-secondary rh-btn-icon" onclick="editarOcorrencia('${o.id}')">
          <i class="fas fa-pen"></i>
        </button>
        <button class="rh-btn rh-btn-danger rh-btn-icon" onclick="excluirOcorrencia('${o.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>`).join("");
}

window.editarOcorrencia = (id) => abrirModalOcorrencia(state.ocorrencias.find(o => o.id === id));
window.excluirOcorrencia = excluirOcorrencia;

/* ===================================================================
   4. DASHBOARD / GRÁFICOS
   =================================================================== */
function destruirChart(key) {
  if (state.charts[key]) { state.charts[key].destroy(); delete state.charts[key]; }
}

function renderDashboard() {
  const ocs = state.ocorrencias;

  // ---- KPIs ----
  $("#kpiTotal").textContent     = ocs.length;
  $("#kpiAtestado").textContent  = ocs.filter(o => o.tipo === "Atestado").length;
  $("#kpiFalta").textContent     = ocs.filter(o => o.tipo === "Falta").length;
  $("#kpiDeclaracao").textContent= ocs.filter(o => o.tipo === "Declaração").length;

  // ---- Por Setor ----
  const porSetor = {};
  ocs.forEach(o => { const k = o.setorNome || "Sem setor"; porSetor[k] = (porSetor[k] || 0) + 1; });
  destruirChart("setor");
  state.charts.setor = new Chart($("#chartSetor"), {
    type: "bar",
    data: {
      labels: Object.keys(porSetor),
      datasets: [{
        data: Object.values(porSetor),
        backgroundColor: "#6366f1",
        borderRadius: 8,
        barThickness: 42,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#64748b" } },
        y: { beginAtZero: true, ticks: { color: "#64748b", precision: 0 }, grid: { color: "#f1f5f9" } },
      },
    },
  });

  // ---- Por Tipo ----
  const porTipo = {};
  ocs.forEach(o => { porTipo[o.tipo] = (porTipo[o.tipo] || 0) + 1; });
  destruirChart("tipo");
  state.charts.tipo = new Chart($("#chartTipo"), {
    type: "doughnut",
    data: {
      labels: Object.keys(porTipo),
      datasets: [{
        data: Object.values(porTipo),
        backgroundColor: ["#3b82f6", "#ef4444", "#a855f7", "#10b981"],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "65%",
      plugins: { legend: { position: "bottom", labels: { color: "#64748b", padding: 14, usePointStyle: true } } },
    },
  });

  // ---- Por Dia da Semana ----
  const dias = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  const porDia = Array(7).fill(0);
  ocs.forEach(o => {
    if (!o.data) return;
    const d = new Date(o.data + "T00:00:00").getDay();
    porDia[d]++;
  });
  destruirChart("dia");
  state.charts.dia = new Chart($("#chartDia"), {
    type: "bar",
    data: {
      labels: ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"],
      datasets: [{ data: porDia, backgroundColor: "#06b6d4", borderRadius: 6, barThickness: 30 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#64748b" } },
        y: { beginAtZero: true, ticks: { color: "#64748b", precision: 0 }, grid: { color: "#f1f5f9" } },
      },
    },
  });

  // ---- Por Mês ----
  const mesesLabel = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const porMes = Array(12).fill(0);
  ocs.forEach(o => {
    if (!o.data) return;
    const m = new Date(o.data + "T00:00:00").getMonth();
    porMes[m]++;
  });
  destruirChart("mes");
  state.charts.mes = new Chart($("#chartMes"), {
    type: "bar",
    data: {
      labels: mesesLabel,
      datasets: [{ data: porMes, backgroundColor: "#10b981", borderRadius: 6 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 10 } } },
        y: { beginAtZero: true, ticks: { color: "#64748b", precision: 0 }, grid: { color: "#f1f5f9" } },
      },
    },
  });

  // ---- Top Funcionários ----
  const porFunc = {};
  ocs.forEach(o => {
    const k = o.nomeFuncionario || "—";
    porFunc[k] = (porFunc[k] || 0) + 1;
  });
  const ranking = Object.entries(porFunc).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = ranking[0]?.[1] || 1;
  $("#rankFuncionarios").innerHTML = ranking.length
    ? ranking.map(([nome, qtd], i) => `
        <div class="rh-rank-item">
          <div class="rh-rank-pos">${i + 1}</div>
          <div class="rh-rank-name">${nome}</div>
          <div class="rh-rank-bar"><span style="width:${(qtd / max) * 100}%"></span></div>
          <div class="rh-rank-count">${qtd}</div>
        </div>`).join("")
    : '<div class="rh-empty" style="padding:1rem;"><i class="fas fa-trophy"></i>Sem dados</div>';
}

/* ===================================================================
   5. SINCRONIZAÇÃO EM TEMPO REAL (Firestore onSnapshot)
   =================================================================== */
function iniciarListeners() {
  COL.setores.onSnapshot(snap => {
    state.setores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSetores();
    renderFuncionarios();
    renderDashboard();
  });

  COL.funcionarios.onSnapshot(snap => {
    state.funcionarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderFuncionarios();
    renderSetores();
  });

  COL.ocorrencias.onSnapshot(snap => {
    state.ocorrencias = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderOcorrencias();
    renderDashboard();
  });
}

/* ===================================================================
   6. NAVEGAÇÃO ENTRE TABS
   =================================================================== */
function initTabs() {
  $$(".rh-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $$(".rh-tab").forEach(t => t.classList.remove("active"));
      $$(".rh-tab-content").forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      $(`#tab-${tab.dataset.tab}`).classList.add("active");
    });
  });
}

/* ===================================================================
   7. MODAIS — abrir/fechar
   =================================================================== */
function fecharModais() {
  $$(".rh-modal").forEach(m => m.classList.remove("open"));
}
$$("[data-close]").forEach(btn => btn.addEventListener("click", fecharModais));
$$(".rh-modal").forEach(m => m.addEventListener("click", e => { if (e.target === m) fecharModais(); }));

/* ===================================================================
   8. INIT
   =================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initTabs();

  // Botões de novo
  $("#btnNovoSetor").onclick      = () => abrirModalSetor();
  $("#btnNovoSetorTab").onclick   = () => abrirModalSetor();
  $("#btnNovoFuncionario").onclick= () => abrirModalFuncionario();
  $("#btnNovaOcorrencia").onclick = () => abrirModalOcorrencia();

  // Forms
  $("#formSetor").addEventListener("submit", salvarSetor);
  $("#formFuncionario").addEventListener("submit", salvarFuncionario);
  $("#formOcorrencia").addEventListener("submit", salvarOcorrencia);

  // Filtros
  $("#filtroFuncionario").addEventListener("input", renderFuncionarios);
  $("#filtroOcorrencia").addEventListener("input", renderOcorrencias);
  $("#filtroTipoOcorrencia").addEventListener("change", renderOcorrencias);

  // Real-time
  iniciarListeners();
});
