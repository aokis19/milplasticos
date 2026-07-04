// =============================================
// CUSTO.JS - Central de Custos (Corrigido)
// Usa Firebase centralizado + SyncSystem
// =============================================
(function () {
// Usar Firebase já inicializado pelo firebase-init.js
let db = window.firebaseDB || null;
let usandoFirebase = !!db;
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
// ========== FUNÇÕES DE ARMAZENAMENTO ==========
function loadLocalData() {
// Tentar Firebase primeiro
if (usandoFirebase && db) {
carregarDadosFirebase().then(() => {
document.getElementById('loadingOverlay').classList.remove('active');
}).catch(() => {
carregarLocalStorageFallback();
document.getElementById('loadingOverlay').classList.remove('active');
});
} else {
carregarLocalStorageFallback();
document.getElementById('loadingOverlay').classList.remove('active');
}
const savedConfig = localStorage.getItem(CONFIG_KEY);
if (savedConfig) configCampos = { ...configCampos, ...JSON.parse(savedConfig) };
}
function carregarLocalStorageFallback() {
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
inicializarDadosPadrao();
}
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
// Salvar no SyncSystem (que salva no Firebase)
if (window.SyncSystem && window.SyncSystem.salvarModulo) {
window.SyncSystem.salvarModulo('centralCustos', dados).catch(() => {});
}
// Backup local
const json = JSON.stringify(dados);
const tamanhoEmMB = new Blob([json]).size / (1024 * 1024);
if (tamanhoEmMB > 4) {
const compactado = compactarDados(dados);
localStorage.setItem(STORAGE_KEY, JSON.stringify(compactado));
} else {
localStorage.setItem(STORAGE_KEY, json);
}
} catch (e) {
console.error('Erro ao salvar:', e);
}
}
function compactarDados(dados) {
return {
periodos: dados.periodos.map(p => ({ id: p.id, mes: p.mes, ano: p.ano, obs: p.obs || '' })),
setores: dados.setores.map(s => ({ id: s.id, periodoId: s.periodoId, nome: s.nome, descricao: s.descricao || '', ordem: s.ordem, produtoFinal: s.produtoFinal || false, tipo: s.tipo || 'custo' })),
categorias: dados.categorias.map(c => ({ id: c.id, nome: c.nome, cor: c.cor })),
itensCusto: dados.itensCusto.map(i => ({ id: i.id, setorId: i.setorId, categoriaId: i.categoriaId, nome: i.nome, valorTotal: i.valorTotal, percentual: i.percentual, tipo: i.tipo || 'normal', custoFixoId: i.custoFixoId || null, obs: i.obs || '' })),
producoes: dados.producoes.map(p => ({ id: p.id, setorId: p.setorId, produto: p.produto, kg: p.kg, data: p.data })),
materiais: dados.materiais.map(m => ({ id: m.id, nome: m.nome, descricao: m.descricao || '' })),
custosMateriais: dados.custosMateriais.map(c => ({ id: c.id, materialId: c.materialId, periodoId: c.periodoId, mes: c.mes, ano: c.ano, custoKgFinal: c.custoKgFinal, subtotal: c.subtotal, imposto: c.imposto, valorImposto: c.valorImposto, margem: c.margem, precoSugerido: c.precoSugerido, valorAtual: c.valorAtual, setoresDetalhes: c.setoresDetalhes, insumos: c.insumos, setoresUtilizados: c.setoresUtilizados })),
custosFixos: dados.custosFixos.map(c => ({ id: c.id, periodoId: c.periodoId, categoriaId: c.categoriaId, nome: c.nome, valor: c.valor }))
};
}
function saveConfig() { localStorage.setItem(CONFIG_KEY, JSON.stringify(configCampos)); }
// Inicializar
loadLocalData();
// Status Firebase
function atualizarStatusFirebase() {
const statusEl = document.getElementById('firebaseStatus');
if (!statusEl) return;
if (usandoFirebase && db) {
statusEl.innerHTML = '<span class="status-dot"></span> Firebase ';
statusEl.className = 'firebase-status status-firebase';
} else {
statusEl.innerHTML = '<span class="status-dot"></span> Local';
statusEl.className = 'firebase-status status-local';
}
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
const fbPeriodos = snaps[0].docs.map(d => ({ id: d.id, ...d.data() }));
const fbSetores = snaps[1].docs.map(d => ({ id: d.id, ...d.data() }));
const fbCategorias = snaps[2].docs.map(d => ({ id: d.id, ...d.data() }));
const fbItens = snaps[3].docs.map(d => ({ id: d.id, ...d.data() }));
const fbProducoes = snaps[4].docs.map(d => ({ id: d.id, ...d.data() }));
const fbMateriais = snaps[5].docs.map(d => ({ id: d.id, ...d.data() }));
const fbCustosMat = snaps[6].docs.map(d => ({ id: d.id, ...d.data() }));
const fbCustosFixos = snaps[7].docs.map(d => ({ id: d.id, ...d.data() }));
// Se Firebase tem mais dados, usar Firebase
if (fbPeriodos.length >= periodos.length) {
periodos = fbPeriodos;
setores = fbSetores;
if (fbCategorias.length > 0) categorias = fbCategorias;
itensCusto = fbItens;
producoes = fbProducoes;
materiais = fbMateriais;
custosMateriais = fbCustosMat;
custosFixos = fbCustosFixos;
console.log(' Dados carregados do Firebase');
}
saveLocalData();
renderizarTela();
atualizarStatusFirebase();
} catch (e) {
console.error('Erro ao carregar Firebase:', e);
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
try { await db.collection(col).doc(id).delete(); } catch (e) {}
}
// ========== UTILITÁRIOS ==========
function formatMoney(v) { return 'R$ ' + (v || 0).toFixed(2).replace('.', ','); }
function formatMoneySimples(v) { return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatNumber(n, d = 2) { return (n || 0).toFixed(d).replace('.', ','); }
function getNomeMes(m) { return ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][m - 1] || ''; }
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
function calcularResumoPeriodo(periodoIdParam, excluirSetores = null) {
const pid = periodoIdParam || (periodoAtual ? periodoAtual.id : null);
const excluir = excluirSetores || setoresExcluidosResumo;
if (!pid) return { custoTotalGeral: 0, producaoTotalGeral: 0, custoPorKgGeral: 0, qtdSetores: 0, setoresFinais: [], qtdProdutosFinais: 0 };
const sets = getSetoresDoPeriodo(pid);
const setsAtivos = sets.filter(s => !excluir.has(s.id));
let custoTotalGeral = 0;
setsAtivos.forEach(s => { const { totalCusto } = calcularCustosSetor(s.id); custoTotalGeral += totalCusto; });
const setsFinais = setsAtivos.filter(s => s.produtoFinal === true);
let producaoTotalGeral = 0;
const detalhesFinais = [];
setsFinais.forEach(sf => {
const { totalCusto, totalKg, custoPorKg } = calcularCustosSetor(sf.id);
producaoTotalGeral += totalKg;
detalhesFinais.push({ setor: sf, custo: totalCusto, producao: totalKg, custoPorKg });
});
return { custoTotalGeral, producaoTotalGeral, custoPorKgGeral: producaoTotalGeral > 0 ? custoTotalGeral / producaoTotalGeral : 0, qtdSetores: setsAtivos.length, qtdProdutosFinais: setsFinais.length, setoresFinais: detalhesFinais };
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
return { custoTotal, producaoTotal, custoPorKg: producaoTotal > 0 ? custoTotal / producaoTotal : 0, qtdSetores, qtdPeriodos: periodosSelecionadosResumo.size };
}
// ========== RENDERIZAÇÃO PRINCIPAL ==========
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
if (filtroAnoAtual !== 'todos') periodosFiltrados = periodosFiltrados.filter(p => p.ano === parseInt(filtroAnoAtual));
const periodosOrdenados = periodosFiltrados.sort((a, b) => { if (a.ano !== b.ano) return b.ano - a.ano; return b.mes - a.mes; });
const resumoConsolidado = calcularResumoConsolidado();
container.innerHTML = `
${resumoConsolidado ? `
<div class="resumo-consolidado">
<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
<h3 style="margin:0;"><i class="fas fa-layer-group"></i> Resumo Consolidado</h3>
<button class="btn btn-purple btn-sm" onclick="window.abrirGraficoConsolidado()"><i class="fas fa-chart-bar"></i> Ver Gráfico</button>
</div>
<div class="periodos-selecionados-tags">
${Array.from(periodosSelecionadosResumo).map(pid => {
const per = periodos.find(p => p.id === pid);
if (!per) return '';
return `<span class="periodo-tag">${getNomeMes(per.mes)}/${per.ano} <span class="remover-tag" onclick="window.removerPeriodoResumo('${pid}')">×</span></span>`;
}).join('')}
<span class="btn-selecionar-todos" onclick="window.limparSelecaoResumo()">Limpar</span>
</div>
<div class="stats-grid-resumo">
<div class="stat-resumo"><div class="sr-valor">${resumoConsolidado.qtdPeriodos}</div><div class="sr-label">Períodos</div></div>
<div class="stat-resumo"><div class="sr-valor">${resumoConsolidado.qtdSetores}</div><div class="sr-label">Setores</div></div>
<div class="stat-resumo"><div class="sr-valor">${formatMoney(resumoConsolidado.custoTotal)}</div><div class="sr-label">Custo Total</div></div>
<div class="stat-resumo"><div class="sr-valor">${formatNumber(resumoConsolidado.producaoTotal, 0)} kg</div><div class="sr-label">Produção Total</div></div>
<div class="stat-resumo destaque"><div class="sr-valor">${formatMoney(resumoConsolidado.custoPorKg)}/kg</div><div class="sr-label">Custo Médio/KG</div></div>
</div>
</div>
` : ''}
<div class="card">
<div class="card-header">
<span class="card-title"><i class="fas fa-calendar-alt"></i> Períodos</span>
<div style="display:flex;gap:0.5rem;align-items:center;">
<select id="filtroAno" onchange="window.mudarFiltroAno(this.value)" style="padding:0.3rem 0.5rem;border-radius:6px;border:1px solid #ddd;font-size:0.8rem;">
<option value="todos" ${filtroAnoAtual === 'todos' ? 'selected' : ''}>Todos</option>
${anosDisponiveis.map(a => `<option value="${a}" ${filtroAnoAtual == a ? 'selected' : ''}>${a}</option>`).join('')}
</select>
<button class="btn btn-primary btn-sm" onclick="window.abrirModalPeriodo()"><i class="fas fa-plus"></i> Novo</button>
</div>
</div>
${periodosOrdenados.length === 0 ? '<div style="text-align:center;padding:2rem;"><p>Nenhum período cadastrado.</p></div>' : `<div class="periodos-grid" id="periodosGrid"></div>`}
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
<div class="periodo-check"><input type="checkbox" ${isSelecionado ? 'checked' : ''} onchange="window.togglePeriodoResumo('${per.id}', this.checked)"></div>
<div class="acoes">
<button class="btn btn-purple btn-xs" onclick="event.stopPropagation();window.abrirGraficoMensal('${per.id}')"><i class="fas fa-chart-bar"></i></button>
<button class="btn btn-info btn-xs" onclick="event.stopPropagation();window.abrirCopiarPeriodo('${per.id}')"><i class="fas fa-copy"></i></button>
<button class="btn btn-outline btn-xs" onclick="event.stopPropagation();window.editarPeriodo('${per.id}')"><i class="fas fa-edit"></i></button>
<button class="btn btn-danger btn-xs" onclick="event.stopPropagation();window.excluirPeriodo('${per.id}')"><i class="fas fa-trash"></i></button>
</div>
<div class="periodo-titulo" onclick="window.selecionarPeriodo('${per.id}')"><i class="fas fa-calendar-check"></i> ${getNomeMes(per.mes)}/${per.ano}</div>
<div class="periodo-obs">${per.obs || 'Sem descrição'}</div>
<div class="periodo-stats">
<div class="periodo-stat"><span class="label">Setores</span><span class="valor">${resumo.qtdSetores}</span></div>
<div class="periodo-stat"><span class="label">Custo Total</span><span class="valor money">${formatMoney(resumo.custoTotalGeral)}</span></div>
<div class="periodo-stat"><span class="label">Produção</span><span class="valor">${formatNumber(resumo.producaoTotalGeral, 0)} kg</span></div>
<div class="periodo-stat"><span class="label">Custo/KG</span><span class="valor money">${formatMoney(resumo.custoPorKgGeral)}/kg</span></div>
</div>
`;
grid.appendChild(div);
});
}
}
// ========== NAVEGAÇÃO ==========
window.navegarPara = function (nivel) {
if (nivel === 'periodos') { periodoAtual = null; setorAtual = null; nivelAtual = 'periodos'; }
else if (nivel === 'setores') { setorAtual = null; nivelAtual = 'setores'; }
else if (nivel === 'materiais') { nivelAtual = 'materiais'; }
renderizarTela();
};
window.selecionarPeriodo = function (id) {
periodoAtual = periodos.find(p => p.id === id);
setorAtual = null;
nivelAtual = 'setores';
setoresExcluidosResumo.clear();
renderizarTela();
};
function atualizarBreadcrumb() {
const bc = document.getElementById('breadcrumb');
let html = `<span class="breadcrumb-item ${nivelAtual === 'periodos' ? 'active' : ''}" onclick="window.navegarPara('periodos')"><i class="fas fa-home"></i> Home</span>`;
if (periodoAtual) {
html += `<span class="breadcrumb-sep"><i class="fas fa-chevron-right"></i></span><span class="breadcrumb-item ${nivelAtual === 'setores' ? 'active' : ''}" onclick="window.navegarPara('setores')">${getNomeMes(periodoAtual.mes)}/${periodoAtual.ano}</span>`;
}
bc.innerHTML = html;
}
// ========== MODAIS ==========
window.fecharModal = function (id) {
document.getElementById(id).classList.remove('active');
if (id === 'modalGraficoMensal' && graficoMensalChart) { graficoMensalChart.destroy(); graficoMensalChart = null; }
if (id === 'modalGraficoConsolidado' && graficoConsolidadoChart) { graficoConsolidadoChart.destroy(); graficoConsolidadoChart = null; }
};
document.addEventListener('click', function (e) {
if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('active');
});
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
if (confirm('Excluir período?')) {
setores.filter(s => s.periodoId === id).forEach(s => {
itensCusto = itensCusto.filter(i => i.setorId !== s.id);
producoes = producoes.filter(p => p.setorId !== s.id);
});
setores = setores.filter(s => s.periodoId !== id);
custosFixos = custosFixos.filter(cf => cf.periodoId !== id);
periodos = periodos.filter(p => p.id !== id);
periodosSelecionadosResumo.delete(id);
await excluirFB('custos_periodos', id);
saveLocalData();
if (periodoAtual && periodoAtual.id === id) { periodoAtual = null; nivelAtual = 'periodos'; }
renderizarTela();
}
};
// ========== CRUD SETORES ==========
window.abrirModalSetor = function (id = null) {
if (!periodoAtual) { alert('Selecione um período!'); return; }
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
}
} else {
document.getElementById('modalSetorTitulo').innerHTML = '<i class="fas fa-plus"></i> Novo Setor';
document.getElementById('setorEditId').value = '';
document.getElementById('setorNome').value = '';
document.getElementById('setorDescricao').value = '';
document.getElementById('setorOrdem').value = '1';
document.getElementById('setorProdutoFinal').checked = false;
document.getElementById('setorTipo').value = 'custo';
}
};
window.salvarSetor = async function () {
if (!periodoAtual) { alert('Nenhum período selecionado!'); return; }
const nome = document.getElementById('setorNome').value.trim();
if (!nome) { alert('Digite o nome!'); return; }
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
if (editId) {
s.id = editId;
const idx = setores.findIndex(x => x.id === editId);
if (idx !== -1) setores[idx] = { ...setores[idx], ...s };
} else {
s.id = 'set_' + Date.now();
setores.push(s);
}
await salvarFB('custos_setores', s);
saveLocalData();
window.fecharModal('modalSetor');
renderizarTela();
};
window.editarSetor = (id) => window.abrirModalSetor(id);
window.excluirSetor = async function (id) {
if (!confirm('Excluir setor?')) return;
itensCusto = itensCusto.filter(i => i.setorId !== id);
producoes = producoes.filter(p => p.setorId !== id);
setores = setores.filter(s => s.id !== id);
setoresExcluidosResumo.delete(id);
await excluirFB('custos_setores', id);
saveLocalData();
if (setorAtual && setorAtual.id === id) setorAtual = null;
renderizarTela();
};
// ========== INICIALIZAÇÃO ==========
function init() {
atualizarStatusFirebase();
renderizarTela();
document.getElementById('loadingOverlay').classList.remove('active');
}
// Aguardar Firebase estar pronto
if (window.firebaseDB) {
db = window.firebaseDB;
usandoFirebase = true;
init();
} else {
// Tentar novamente
let tentativas = 0;
const check = setInterval(() => {
tentativas++;
if (window.firebaseDB) {
db = window.firebaseDB;
usandoFirebase = true;
clearInterval(check);
init();
} else if (tentativas > 30) {
clearInterval(check);
init();
}
}, 200);
}
// Expor funções globais
window.mudarFiltroAno = function (v) { filtroAnoAtual = v; renderizarTela(); };
window.togglePeriodoResumo = function (pid, checked) { if (checked) periodosSelecionadosResumo.add(pid); else periodosSelecionadosResumo.delete(pid); renderizarTela(); };
window.removerPeriodoResumo = function (pid) { periodosSelecionadosResumo.delete(pid); renderizarTela(); };
window.limparSelecaoResumo = function () { periodosSelecionadosResumo.clear(); renderizarTela(); };
window.toggleSetorResumo = function (sid, checked) { if (checked) setoresExcluidosResumo.add(sid); else setoresExcluidosResumo.delete(sid); renderizarTela(); };
window.limparSetoresExcluidos = function () { setoresExcluidosResumo.clear(); renderizarTela(); };
// =============================================
// SINCRONIZAÇÃO COM FIREBASE CENTRALIZADO (NOVO)
// Garante que dados sejam compartilhados entre navegadores
// =============================================
// Sobrescrever saveLocalData para também salvar no Firebase centralizado
const originalSaveLocalData = saveLocalData;
saveLocalData = function() {
// Chama a função original primeiro
originalSaveLocalData();
// Depois salva no Firebase centralizado
try {
const dados = {
periodos, setores, categorias, itensCusto, producoes,
materiais, custosMateriais, custosFixos
};
// Tentar via SyncSystem (se disponível)
if (window.SyncSystem && window.SyncSystem.salvarModulo) {
window.SyncSystem.salvarModulo('centralCustos', dados).catch(() => {});
}
// Backup direto no Firebase também
if (db && usandoFirebase) {
db.collection('centralCustos').doc('dados_completos').set(dados).catch(() => {});
}
} catch(e) {
// Silencioso - não atrapalha o funcionamento normal
}
};
// Função para carregar dados do Firebase ao iniciar
async function sincronizarDoFirebase() {
console.log(' Verificando dados no Firebase...');
// Opção 1: Via SyncSystem
if (window.SyncSystem && window.SyncSystem.carregarModulo) {
try {
const dadosRemotos = await window.SyncSystem.carregarModulo('centralCustos');
if (dadosRemotos && dadosRemotos.periodos && dadosRemotos.periodos.length > 0) {
const dadosLocais = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
const qtdLocal = dadosLocais.periodos?.length || 0;
const qtdRemoto = dadosRemotos.periodos?.length || 0;
console.log(` Local: ${qtdLocal} períodos | Firebase: ${qtdRemoto} períodos`);
// Usar a fonte com mais dados
if (qtdRemoto > qtdLocal) {
periodos = dadosRemotos.periodos || [];
setores = dadosRemotos.setores || [];
categorias = dadosRemotos.categorias || [];
itensCusto = dadosRemotos.itensCusto || [];
producoes = dadosRemotos.producoes || [];
materiais = dadosRemotos.materiais || [];
custosMateriais = dadosRemotos.custosMateriais || [];
custosFixos = dadosRemotos.custosFixos || [];
originalSaveLocalData();
console.log(' Dados atualizados do Firebase (SyncSystem)');
return true;
} else if (qtdLocal > qtdRemoto) {
// Local tem mais - enviar para Firebase
const dados = { periodos, setores, categorias, itensCusto, producoes, materiais, custosMateriais, custosFixos };
await window.SyncSystem.salvarModulo('centralCustos', dados);
console.log(' Dados locais enviados para Firebase');
}
}
} catch(e) {
console.log(' SyncSystem indisponível, tentando Firebase direto...');
}
}
// Opção 2: Via Firebase direto
if (db && usandoFirebase) {
try {
const doc = await db.collection('centralCustos').doc('dados_completos').get();
if (doc.exists) {
const fbData = doc.data();
const dadosLocais = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
const qtdLocal = dadosLocais.periodos?.length || 0;
const qtdRemoto = fbData.periodos?.length || 0;
console.log(` Local: ${qtdLocal} períodos | Firebase direto: ${qtdRemoto} períodos`);
if (qtdRemoto > qtdLocal) {
periodos = fbData.periodos || [];
setores = fbData.setores || [];
categorias = fbData.categorias || [];
itensCusto = fbData.itensCusto || [];
producoes = fbData.producoes || [];
materiais = fbData.materiais || [];
custosMateriais = fbData.custosMateriais || [];
custosFixos = fbData.custosFixos || [];
originalSaveLocalData();
console.log(' Dados atualizados do Firebase direto');
return true;
} else if (qtdLocal > qtdRemoto) {
const dados = { periodos, setores, categorias, itensCusto, producoes, materiais, custosMateriais, custosFixos };
await db.collection('centralCustos').doc('dados_completos').set(dados);
console.log(' Dados locais enviados para Firebase direto');
}
} else {
// Firebase vazio - enviar dados locais
const dados = { periodos, setores, categorias, itensCusto, producoes, materiais, custosMateriais, custosFixos };
if (dados.periodos && dados.periodos.length > 0) {
await db.collection('centralCustos').doc('dados_completos').set(dados);
console.log(' Dados iniciais enviados para Firebase');
}
}
} catch(e) {
console.log(' Firebase direto indisponível:', e.message);
}
}
return false;
}
// Executar sincronização 2 segundos após carregar a página
setTimeout(async () => {
const sincronizou = await sincronizarDoFirebase();
if (sincronizou) {
renderizarTela();
}
document.getElementById('loadingOverlay')?.classList.remove('active');
}, 2000);
})();
