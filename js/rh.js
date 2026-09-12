/* ===================================================================
   RH Dashboard — Visão geral com filtros (Ano / Setor / Tipo / Mês)
   =================================================================== */

const db = window.db || window.firebaseDB;
const COL = {
  ocorrencias:  db.collection("ocorrencias"),
  funcionarios: db.collection("funcionarios"),
  setores:      db.collection("setores"),
};

// Estado global
const D = {
  ocorrencias: [],
  setores: [],
  filtradas: [],
  charts: {},
  initialized: false,
};

/* ---------- Helpers ---------- */
const $  = (s) => document.querySelector(s);

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const DIAS  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function destruirChart(k) {
  if (D.charts[k]) { D.charts[k].destroy(); delete D.charts[k]; }
}

/* ===================================================================
   FILTROS
   =================================================================== */
function aplicarFiltros() {
  const ano    = $("#filtroAno").value;
  const setor  = $("#filtroSetor").value;
  const tipo   = $("#filtroTipo").value;
  const mes    = $("#filtroMes").value;

  D.filtradas = D.ocorrencias.filter(o => {
    if (ano   && String(o.ano) !== String(ano)) return false;
    if (setor && o.setorId !== setor) return false;
    if (tipo  && o.tipo !== tipo) return false;
    if (mes   && String(o.mes) !== String(mes)) return false;
    return true;
  });

  renderKPIs();
  renderGraficos();
}

function popularFiltros() {
  // Anos — extrai das ocorrências
  const anos = [...new Set(D.ocorrencias.map(o => o.ano).filter(Boolean))].sort((a,b) => b - a);
  $("#filtroAno").innerHTML = '<option value="">Todos</option>' +
    anos.map(a => `<option value="${a}">${a}</option>`).join("");

  // Setores
  $("#filtroSetor").innerHTML = '<option value="">Todos</option>' +
    D.setores.map(s => `<option value="${s.id}">${s.nome}</option>`).join("");
}

function limparFiltros() {
  $("#filtroAno").value = "";
  $("#filtroSetor").value = "";
  $("#filtroTipo").value = "";
  $("#filtroMes").value = "";
  aplicarFiltros();
}

/* ===================================================================
   KPIs
   =================================================================== */
function renderKPIs() {
  const ocs = D.filtradas;
  const total = ocs.length;

  $("#kpiTotal").textContent = total;

  const atestado   = ocs.filter(o => o.tipo === "Atestado");
  const falta      = ocs.filter(o => o.tipo === "Falta");
  const declaracao = ocs.filter(o => o.tipo === "Declaração");

  const somaDias = arr => arr.reduce((s, o) => s + (Number(o.dias) || 0), 0);

  $("#kpiAtestado").textContent   = atestado.length;
  $("#kpiFalta").textContent      = falta.length;
  $("#kpiDeclaracao").textContent = declaracao.length;

  $("#kpiAtestadoDias").textContent   = `${somaDias(atestado)} dias`;
  $("#kpiFaltaDias").textContent      = `${somaDias(falta)} dias`;
  $("#kpiDeclaracaoDias").textContent = `${somaDias(declaracao)} dias`;

  const totalDias = somaDias(ocs);
  $("#kpiDias").textContent  = totalDias;
  $("#kpiMedia").textContent = total ? `média ${(totalDias / total).toFixed(1)} dias/evento` : "média 0 dias/evento";

  // Período aplicado
  const partes = [];
  if ($("#filtroAno").value)   partes.push($("#filtroAno").value);
  if ($("#filtroMes").value)   partes.push(MESES[Number($("#filtroMes").value) - 1]);
  if ($("#filtroSetor").value) {
    const s = D.setores.find(x => x.id === $("#filtroSetor").value);
    if (s) partes.push(s.nome);
  }
  $("#kpiPeriodo").textContent = partes.length ? partes.join(" · ") : "Todos os registros";
}

/* ===================================================================
   GRÁFICOS
   =================================================================== */
function renderGraficos() {
  const ocs = D.filtradas;

  /* ---------- Por Setor (barras H) ---------- */
  const porSetor = {};
  ocs.forEach(o => {
    const k = o.setorNome || "Sem setor";
    porSetor[k] = (porSetor[k] || 0) + 1;
  });
  const setorOrd = Object.entries(porSetor).sort((a,b) => b[1] - a[1]);

  destruirChart("setor");
  D.charts.setor = new Chart($("#chartSetor"), {
    type: "bar",
    data: {
      labels: setorOrd.map(x => x[0]),
      datasets: [{
        data: setorOrd.map(x => x[1]),
        backgroundColor: "#6366f1",
        borderRadius: 8,
        barThickness: 38,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { color: "#64748b", precision: 0 }, grid: { color: "#f1f5f9" } },
        y: { ticks: { color: "#334155", font: { size: 12 } }, grid: { display: false } },
      },
    },
  });

  /* ---------- Por Tipo (rosca) ---------- */
  const porTipo = {};
  ocs.forEach(o => { porTipo[o.tipo] = (porTipo[o.tipo] || 0) + 1; });

  destruirChart("tipo");
  D.charts.tipo = new Chart($("#chartTipo"), {
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
      plugins: {
        legend: { position: "bottom", labels: { color: "#64748b", padding: 14, usePointStyle: true } },
      },
    },
  });

  /* ---------- Por Dia da Semana ---------- */
  const porDia = Array(7).fill(0);
  ocs.forEach(o => {
    const d = (typeof o.diaSemana === "number")
      ? o.diaSemana
      : (o.data ? new Date(o.data + "T00:00:00").getDay() : null);
    if (d !== null && d >= 0 && d < 7) porDia[d]++;
  });

  destruirChart("dia");
  D.charts.dia = new Chart($("#chartDia"), {
    type: "bar",
    data: {
      labels: DIAS,
      datasets: [{ data: porDia, backgroundColor: "#06b6d4", borderRadius: 6, barThickness: 28 }],
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

  /* ---------- Por Mês ---------- */
  const porMes = Array(12).fill(0);
  ocs.forEach(o => {
    const m = (typeof o.mes === "number")
      ? o.mes - 1
      : (o.data ? new Date(o.data + "T00:00:00").getMonth() : null);
    if (m !== null && m >= 0 && m < 12) porMes[m]++;
  });

  destruirChart("mes");
  D.charts.mes = new Chart($("#chartMes"), {
    type: "bar",
    data: {
      labels: MESES,
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

  /* ---------- Top CID ---------- */
  renderTopCID(ocs);

  /* ---------- Top Funcionários ---------- */
  renderTopFuncionarios(ocs);
}

/* ===================================================================
   TOP CID
   =================================================================== */
function renderTopCID(ocs) {
  const container = $("#listaCid");

  // Considera apenas ocorrências com CID preenchido
  const porCid = {};
  ocs.forEach(o => {
    const cid = (o.cid || "").trim().toUpperCase();
    if (!cid) return;
    porCid[cid] = (porCid[cid] || 0) + 1;
  });

  const ranking = Object.entries(porCid).sort((a,b) => b[1] - a[1]).slice(0, 10);

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
  `).join("");
}

/* ===================================================================
   TOP FUNCIONÁRIOS
   =================================================================== */
function renderTopFuncionarios(ocs) {
  const container = $("#rankFuncionarios");
  const porFunc = {};
  ocs.forEach(o => {
    const k = o.nomeFuncionario || "—";
    porFunc[k] = (porFunc[k] || 0) + 1;
  });

  const ranking = Object.entries(porFunc).sort((a,b) => b[1] - a[1]).slice(0, 10);

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
  `).join("");
}

/* ===================================================================
   TELA CHEIA
   =================================================================== */
function toggleFullscreen() {
  const btn = $("#btnFullscreen");
  const page = $("#dbPage");

  if (!document.fullscreenElement) {
    // Entra em fullscreen do navegador + aplica classe
    const el = document.documentElement;
    (el.requestFullscreen?.() || el.webkitRequestFullscreen?.() || el.msRequestFullscreen?.());

    page.classList.add("fullscreen");
    document.body.classList.add("db-locked");
    btn.innerHTML = '<i class="fas fa-compress"></i> Sair';

    // Esconde sidebar/topbar se existirem
    document.querySelectorAll(".sidebar, .topbar, #sidebar-container, #topbar-container")
      .forEach(el => el.style.display = "none");

    // Ajusta grid para fullscreen (mais colunas)
    ajustarLayoutFullscreen(true);

  } else {
    sairFullscreen();
  }
}

function sairFullscreen() {
  if (document.fullscreenElement) {
    (document.exitFullscreen?.() || document.webkitExitFullscreen?.() || document.msExitFullscreen?.());
  }
  const page = $("#dbPage");
  page.classList.remove("fullscreen");
  document.body.classList.remove("db-locked");

  document.querySelectorAll(".sidebar, .topbar, #sidebar-container, #topbar-container")
    .forEach(el => el.style.display = "");

  $("#btnFullscreen").innerHTML = '<i class="fas fa-expand"></i> Tela Cheia';
  ajustarLayoutFullscreen(false);

  // Redimensiona gráficos após sair
  setTimeout(() => Object.values(D.charts).forEach(c => c.resize()), 300);
}

function ajustarLayoutFullscreen(on) {
  // Em fullscreen, expandimos grids para mais colunas
  const grids = document.querySelectorAll(".db-grid");
  grids.forEach(g => {
    if (on) {
      g.style.gridTemplateColumns = g.classList.contains("triple")
        ? "1fr 1fr 1fr 1fr"
        : "1fr 1fr 1fr";
    } else {
      g.style.gridTemplateColumns = "";
    }
  });
  // Redimensiona gráficos
  setTimeout(() => Object.values(D.charts).forEach(c => c.resize()), 200);
}

// Detecta saída do fullscreen via ESC
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) sairFullscreen();
});

/* ===================================================================
   SINCRONIZAÇÃO EM TEMPO REAL
   =================================================================== */
function iniciarListeners() {
  COL.setores.onSnapshot(snap => {
    D.setores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    popularFiltros();
    aplicarFiltros();
  }, err => console.error("setores:", err));

  COL.ocorrencias.onSnapshot(snap => {
    D.ocorrencias = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    popularFiltros();
    aplicarFiltros();
  }, err => console.error("ocorrencias:", err));
}

/* ===================================================================
   INIT
   =================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  // Botão fullscreen
  $("#btnFullscreen").addEventListener("click", toggleFullscreen);

  // Voltar
  $("#btnVoltarRH").addEventListener("click", () => {
    window.location.href = "/html/rh.html";
  });

  // Atualizar (força re-render)
  $("#btnAtualizar").addEventListener("click", () => {
    aplicarFiltros();
    Object.values(D.charts).forEach(c => c.resize());
  });

  // Filtros
  ["filtroAno","filtroSetor","filtroTipo","filtroMes"].forEach(id => {
    $("#" + id).addEventListener("change", aplicarFiltros);
  });
  $("#btnLimparFiltros").addEventListener("click", limparFiltros);

  // Firebase
  iniciarListeners();
});
