<script>
// ========== CONFIGURAÇÃO FIREBASE ==========
const firebaseConfig = {
    apiKey: "AIzaSyD4GQv7odzKtxg36f_SSWLbQF-TmYi4xYI",
    authDomain: "system-mil.firebaseapp.com",
    projectId: "system-mil",
    storageBucket: "system-mil.firebasestorage.app",
    messagingSenderId: "138426359863",
    appId: "1:138426359863:web:ab731a7ae1b7e03f7a1fb2"
};

console.log('🚀 Central de Custos v2.1 - Inicializando...');

// ========== VARIÁVEIS GLOBAIS ==========
let db = null, usandoFirebase = false;
let periodos = [], setores = [], categorias = [], itensCusto = [], producoes = [];
let materiais = [], custosMateriais = [], custosFixos = [];
let periodoAtual = null, setorAtual = null;
let pieChart = null, barChart = null;
let nivelAtual = 'periodos';
let setoresSelecionadosGerar = new Map();
let filtroAnoAtual = 'todos';
let periodoOrigemCopia = null;
let custoFixoSelecionadoId = null;
let confirmCallback = null;
let historicoMaterialId = null;

let configCampos = {
    setorNome: 'Nome do Setor',
    setorDesc: 'Descrição',
    custoTotal: 'Custo Total',
    producaoKg: 'Produção (KG)',
    custoPorKg: 'Custo por KG'
};

const STORAGE_KEY = 'centralCustos_v11_milplasticos';
const CONFIG_KEY = 'centralCustos_config_v11';

// ========== GARANTIR REMOÇÃO DO LOADING ==========
function forceRemoveLoading() {
    const loading = document.getElementById('loadingOverlay');
    if (loading) {
        loading.classList.remove('active');
        loading.style.display = 'none';
    }
}

// Força remover loading após 5 segundos (segurança)
setTimeout(forceRemoveLoading, 5000);

// ========== TOAST SYSTEM ==========
function showToast(type, title, message, duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    
    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || '📢'}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            ${message ? `<div class="toast-message">${message.replace(/\n/g, '<br>')}</div>` : ''}
        </div>
        <div class="toast-close" onclick="this.parentElement.remove()">✕</div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ========== MODAL DE CONFIRMAÇÃO ==========
function showConfirm(title, message, icon, callback) {
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmIcon = document.getElementById('confirmIcon');
    const modalConfirm = document.getElementById('modalConfirm');
    
    if (!confirmTitle || !confirmMessage || !confirmIcon || !modalConfirm) return;
    
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmIcon.textContent = icon || '⚠️';
    modalConfirm.classList.add('active');
    confirmCallback = callback;
}

// ========== TEMA ESCURO ==========
window.toggleTheme = function() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('darkTheme', isDark);
    showToast('info', 'Tema alterado', isDark ? 'Modo escuro ativado 🌙' : 'Modo claro ativado ☀️', 2000);
};

// Inicializar tema
if (localStorage.getItem('darkTheme') === 'true') {
    document.body.classList.add('dark-theme');
}

// ========== ARMAZENAMENTO LOCAL ==========
function loadLocalData() {
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
            periodos = []; setores = []; materiais = []; custosMateriais = []; custosFixos = [];
            categorias = [
                { id: 'cat1', nome: 'Energia Elétrica', cor: '#f57c00' },
                { id: 'cat2', nome: 'Matéria-Prima', cor: '#0d904f' },
                { id: 'cat3', nome: 'Mão de Obra', cor: '#0277bd' },
                { id: 'cat4', nome: 'Manutenção', cor: '#6a1b9a' },
                { id: 'cat5', nome: 'Insumos', cor: '#c62828' }
            ];
            itensCusto = []; producoes = [];
        }
        
        const savedConfig = localStorage.getItem(CONFIG_KEY);
        if (savedConfig) {
            try {
                configCampos = { ...configCampos, ...JSON.parse(savedConfig) };
            } catch(e) {}
        }
    } catch(e) {
        console.error('Erro ao carregar dados locais:', e);
        periodos = []; setores = []; materiais = []; custosMateriais = []; custosFixos = [];
        categorias = [
            { id: 'cat1', nome: 'Energia Elétrica', cor: '#f57c00' },
            { id: 'cat2', nome: 'Matéria-Prima', cor: '#0d904f' },
            { id: 'cat3', nome: 'Mão de Obra', cor: '#0277bd' },
            { id: 'cat4', nome: 'Manutenção', cor: '#6a1b9a' },
            { id: 'cat5', nome: 'Insumos', cor: '#c62828' }
        ];
        itensCusto = []; producoes = [];
    }
}

function saveLocalData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            periodos, setores, categorias, itensCusto, producoes,
            materiais, custosMateriais, custosFixos
        }));
    } catch(e) {
        console.error('Erro ao salvar dados locais:', e);
    }
}

function saveConfig() {
    try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(configCampos));
    } catch(e) {}
}

// ========== INICIALIZAÇÃO ==========
async function inicializarSistema() {
    try {
        loadLocalData();
        
        // Tentar Firebase
        try {
            if (typeof firebase !== 'undefined') {
                firebase.initializeApp(firebaseConfig);
                db = firebase.firestore();
                usandoFirebase = true;
                
                const statusEl = document.getElementById('firebaseStatus');
                if (statusEl) {
                    statusEl.innerHTML = '<span class="status-dot"></span> 🔥 Firebase';
                    statusEl.className = 'firebase-status status-firebase';
                }
                
                await carregarDadosFirebase();
            }
        } catch (e) {
            console.log('Firebase não disponível, usando armazenamento local:', e.message);
            usandoFirebase = false;
            
            const statusEl = document.getElementById('firebaseStatus');
            if (statusEl) {
                statusEl.innerHTML = '<span class="status-dot"></span> 💾 Local';
                statusEl.className = 'firebase-status status-local';
            }
        }
        
        // Renderizar a tela
        renderizarTela();
        
        // Configurar listeners
        configurarListeners();
        
        console.log('✅ Central de Custos inicializada com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        renderizarTela(); // Tenta renderizar mesmo com erro
    } finally {
        // SEMPRE remove o loading
        forceRemoveLoading();
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
        
        periodos = snaps[0].docs.map(d => ({ id: d.id, ...d.data() }));
        setores = snaps[1].docs.map(d => ({ id: d.id, ...d.data() }));
        categorias = snaps[2].docs.map(d => ({ id: d.id, ...d.data() }));
        itensCusto = snaps[3].docs.map(d => ({ id: d.id, ...d.data() }));
        producoes = snaps[4].docs.map(d => ({ id: d.id, ...d.data() }));
        materiais = snaps[5].docs.map(d => ({ id: d.id, ...d.data() }));
        custosMateriais = snaps[6].docs.map(d => ({ id: d.id, ...d.data() }));
        custosFixos = snaps[7].docs.map(d => ({ id: d.id, ...d.data() }));
        
        saveLocalData();
        console.log('✅ Dados carregados do Firebase com sucesso!');
    } catch (e) { 
        console.error('Erro ao carregar Firebase:', e);
        usandoFirebase = false;
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
    } catch (e) { 
        console.error('Erro ao salvar no Firebase:', e); 
    }
}

async function excluirFB(col, id) {
    if (!usandoFirebase || !db || !id) return;
    try { 
        await db.collection(col).doc(id).delete(); 
    } catch (e) { 
        console.error('Erro ao excluir:', e); 
    }
}

// ========== FUNÇÕES UTILITÁRIAS ==========
function formatMoney(v) { 
    return 'R$ ' + (parseFloat(v) || 0).toFixed(2).replace('.', ','); 
}

function formatNumber(n, d) { 
    return (parseFloat(n) || 0).toFixed(d || 2).replace('.', ','); 
}

function getNomeMes(m) {
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return meses[(parseInt(m) || 1) - 1] || '';
}

function getSetoresDoPeriodo() {
    if (!periodoAtual) return [];
    return setores.filter(s => s.periodoId === periodoAtual.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
}

function getSetoresFinais(periodoId) {
    return setores.filter(s => s.periodoId === periodoId && s.produtoFinal === true);
}

function calcularCustosSetor(setorId) {
    const itens = itensCusto.filter(i => i.setorId === setorId);
    const totalCusto = itens.reduce((s, i) => s + ((parseFloat(i.valorTotal) || 0) * (parseFloat(i.percentual) || 0) / 100), 0);
    const prods = producoes.filter(p => p.setorId === setorId);
    const totalKg = prods.reduce((s, p) => s + (parseFloat(p.kg) || 0), 0);
    const custoPorKg = totalKg > 0 ? totalCusto / totalKg : 0;
    return { totalCusto, totalKg, custoPorKg, qtdItens: itens.length };
}

function getCustoPorKgSetor(setorId) {
    const { totalCusto, totalKg } = calcularCustosSetor(setorId);
    return totalKg > 0 ? totalCusto / totalKg : 0;
}

function calcularResumoPeriodo() {
    if (!periodoAtual) return { 
        custoTotalGeral: 0, producaoTotalGeral: 0, custoPorKgGeral: 0, 
        qtdSetores: 0, qtdProdutosFinais: 0, setoresFinais: [] 
    };
    
    const sets = getSetoresDoPeriodo();
    let custoTotalGeral = 0, producaoTotalGeral = 0;
    
    sets.forEach(s => { 
        custoTotalGeral += calcularCustosSetor(s.id).totalCusto; 
    });
    
    const setoresFinais = getSetoresFinais(periodoAtual.id);
    const detalhesFinais = [];
    
    setoresFinais.forEach(sf => {
        const { totalCusto, totalKg, custoPorKg } = calcularCustosSetor(sf.id);
        producaoTotalGeral += totalKg;
        detalhesFinais.push({ setor: sf, custo: totalCusto, producao: totalKg, custoPorKg });
    });
    
    return {
        custoTotalGeral, 
        producaoTotalGeral,
        custoPorKgGeral: producaoTotalGeral > 0 ? custoTotalGeral / producaoTotalGeral : 0,
        qtdSetores: sets.length, 
        qtdProdutosFinais: setoresFinais.length, 
        setoresFinais: detalhesFinais
    };
}

function getHistoricoMaterial(materialId) {
    return custosMateriais
        .filter(cm => cm.materialId === materialId)
        .sort((a, b) => {
            if (a.ano !== b.ano) return b.ano - a.ano;
            return b.mes - a.mes;
        });
}

// ========== RENDERIZAÇÃO PRINCIPAL ==========
function renderizarTela() {
    try {
        if (nivelAtual === 'periodos') renderizarPeriodos();
        else if (nivelAtual === 'setores') renderizarSetores();
        else if (nivelAtual === 'analise') renderizarAnalise();
        else if (nivelAtual === 'materiais') renderizarMateriais();
        else if (nivelAtual === 'historicoMaterial') renderizarHistoricoMaterial();
        else {
            nivelAtual = 'periodos';
            renderizarPeriodos();
        }
        atualizarBreadcrumb();
    } catch (error) {
        console.error('Erro ao renderizar:', error);
        const container = document.getElementById('conteudoDinamico');
        if (container) {
            container.innerHTML = '<div style="text-align:center;padding:2rem;"><p>Erro ao carregar. Recarregue a página.</p></div>';
        }
        nivelAtual = 'periodos';
        periodoAtual = null;
        setorAtual = null;
    }
}

// ========== HOME - PERÍODOS ==========
function renderizarPeriodos() {
    const container = document.getElementById('conteudoDinamico');
    if (!container) return;
    
    const anosDisponiveis = [...new Set(periodos.map(p => p.ano))].sort((a, b) => b - a);
    
    let periodosFiltrados = [...periodos];
    if (filtroAnoAtual !== 'todos') {
        periodosFiltrados = periodosFiltrados.filter(p => p.ano === parseInt(filtroAnoAtual));
    }
    
    const periodosOrdenados = periodosFiltrados.sort((a, b) => {
        if (a.ano !== b.ano) return b.ano - a.ano;
        return b.mes - a.mes;
    });

    let html = `
        <div class="card">
            <div class="card-header">
                <span class="card-title"><i class="fas fa-calendar-alt"></i> Períodos de Análise</span>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <div class="filtro-ano">
                        <label style="font-size: 0.8rem; font-weight: 500;">Ano:</label>
                        <select id="filtroAno" onchange="window.mudarFiltroAno(this.value)">
                            <option value="todos" ${filtroAnoAtual === 'todos' ? 'selected' : ''}>Todos</option>
                            ${anosDisponiveis.map(a => `<option value="${a}" ${filtroAnoAtual == a ? 'selected' : ''}>${a}</option>`).join('')}
                        </select>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="window.abrirModalPeriodo()">
                        <i class="fas fa-plus"></i> Novo
                    </button>
                </div>
            </div>`;

    if (periodosOrdenados.length === 0) {
        html += '<div style="text-align:center;padding:3rem;"><i class="fas fa-calendar-times" style="font-size:3rem;color:var(--text-light);margin-bottom:1rem;display:block;"></i><p style="color:var(--text-light);">Nenhum período encontrado. Clique em "Novo" para começar!</p></div>';
    } else {
        html += '<div class="periodos-grid" id="periodosGrid"></div>';
    }
    
    html += '</div>';

    // Custos Fixos
    html += `
        <div class="card">
            <div class="card-header">
                <span class="card-title"><i class="fas fa-thumbtack" style="color:var(--warning);"></i> Custos Fixos</span>
                <button class="btn btn-warning btn-sm" onclick="window.abrirModalCustoFixo()"><i class="fas fa-plus"></i> Novo</button>
            </div>`;

    if (custosFixos.length === 0) {
        html += '<div style="text-align:center;padding:2rem;"><p style="color:var(--text-light);">Nenhum custo fixo cadastrado.</p></div>';
    } else {
        html += '<div class="custos-fixos-grid" id="custosFixosGrid"></div>';
    }
    
    html += '</div>';

    // Materiais
    html += `
        <div class="card">
            <div class="card-header">
                <span class="card-title"><i class="fas fa-boxes"></i> Materiais</span>
                <button class="btn btn-teal" onclick="window.abrirModalMaterial()"><i class="fas fa-plus"></i> Novo</button>
            </div>`;

    if (materiais.length === 0) {
        html += '<div style="text-align:center;padding:2rem;"><p style="color:var(--text-light);">Nenhum material cadastrado.</p></div>';
    } else {
        html += '<div class="materiais-grid" id="materiaisGrid"></div>';
    }
    
    html += '</div>';

    container.innerHTML = html;

    // Popular grids
    if (periodosOrdenados.length > 0) {
        const grid = document.getElementById('periodosGrid');
        if (grid) {
            periodosOrdenados.forEach(per => {
                const backup = periodoAtual;
                periodoAtual = per;
                const resumo = calcularResumoPeriodo();
                periodoAtual = backup;
                
                const div = document.createElement('div');
                div.className = 'periodo-card';
                div.onclick = () => window.selecionarPeriodo(per.id);
                div.innerHTML = `
                    <div class="acoes">
                        <button class="btn btn-info btn-xs" onclick="event.stopPropagation(); window.abrirCopiarPeriodo('${per.id}')" title="Copiar período completo">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn btn-outline btn-xs" onclick="event.stopPropagation(); window.editarPeriodo('${per.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-xs" onclick="event.stopPropagation(); window.excluirPeriodo('${per.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="periodo-titulo">
                        <i class="fas fa-calendar-check"></i> ${getNomeMes(per.mes)}/${per.ano}
                    </div>
                    <div class="periodo-obs">${per.obs || 'Sem descrição'}</div>
                    <div class="periodo-stats">
                        <div class="periodo-stat">
                            <span class="label">Setores</span>
                            <span class="valor">${resumo.qtdSetores}</span>
                        </div>
                        <div class="periodo-stat">
                            <span class="label">Produtos Finais</span>
                            <span class="valor">${resumo.qtdProdutosFinais}</span>
                        </div>
                        <div class="periodo-stat">
                            <span class="label">Custo Total</span>
                            <span class="valor money">${formatMoney(resumo.custoTotalGeral)}</span>
                        </div>
                        <div class="periodo-stat">
                            <span class="label">Produção Total</span>
                            <span class="valor">${formatNumber(resumo.producaoTotalGeral, 0)} kg</span>
                        </div>
                        <div class="periodo-stat">
                            <span class="label">Custo/KG</span>
                            <span class="valor money" style="color:var(--warning);">${formatMoney(resumo.custoPorKgGeral)}/kg</span>
                        </div>
                    </div>
                `;
                grid.appendChild(div);
            });
        }
    }

    if (custosFixos.length > 0) {
        const grid = document.getElementById('custosFixosGrid');
        if (grid) {
            custosFixos.forEach(cf => {
                const cat = categorias.find(c => c.id === cf.categoriaId);
                const div = document.createElement('div');
                div.className = 'custo-fixo-item';
                div.innerHTML = `
                    <div>
                        <div class="cf-nome">
                            <i class="fas fa-thumbtack" style="color:var(--warning);font-size:0.7rem;"></i> ${cf.nome}
                        </div>
                        <div class="cf-categoria">${cat ? cat.nome : 'Sem categoria'}</div>
                    </div>
                    <div class="cf-valor">${formatMoney(cf.valor)}</div>
                    <div>
                        <button class="btn btn-outline btn-xs" onclick="window.editarCustoFixo('${cf.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-xs" onclick="window.excluirCustoFixo('${cf.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                grid.appendChild(div);
            });
        }
    }

    if (materiais.length > 0) {
        const grid = document.getElementById('materiaisGrid');
        if (grid) {
            materiais.forEach(mat => {
                const historico = getHistoricoMaterial(mat.id);
                const ultimo = historico[0];
                const div = document.createElement('div');
                div.className = 'material-card';
                div.onclick = () => window.abrirHistoricoMaterial(mat.id);
                div.innerHTML = `
                    <div class="acoes">
                        <button class="btn btn-outline btn-xs" onclick="event.stopPropagation(); window.editarMaterial('${mat.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-xs" onclick="event.stopPropagation(); window.excluirMaterial('${mat.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="material-nome">
                        <i class="fas fa-cube"></i> ${mat.nome}
                    </div>
                    <div class="material-desc">${mat.descricao || ''}</div>
                    ${ultimo ? 
                        `<div class="material-ultimo"><strong>${formatMoney(ultimo.custoKgFinal)}/kg</strong> (${getNomeMes(ultimo.mes)}/${ultimo.ano})</div>` 
                        : '<div class="material-ultimo">Sem custos registrados</div>'}
                    <div style="font-size:0.7rem;margin-top:0.5rem;">${historico.length} registro(s)</div>
                `;
                grid.appendChild(div);
            });
        }
    }
}

// ========== FILTRO ANO ==========
window.mudarFiltroAno = function(ano) {
    filtroAnoAtual = ano;
    nivelAtual = 'periodos';
    periodoAtual = null;
    setorAtual = null;
    renderizarTela();
};

// ========== COPIAR PERÍODO ==========
window.abrirCopiarPeriodo = function(periodoId) {
    periodoOrigemCopia = periodoId;
    const per = periodos.find(p => p.id === periodoId);
    if (!per) {
        showToast('error', 'Erro', 'Período não encontrado!');
        return;
    }
    
    document.getElementById('copiarOrigem').value = `${getNomeMes(per.mes)}/${per.ano} - ${per.obs || 'Sem descrição'}`;
    
    const proxMes = (per.mes % 12) + 1;
    const proxAno = per.mes === 12 ? per.ano + 1 : per.ano;
    document.getElementById('copiarMes').value = proxMes;
    document.getElementById('copiarAno').value = proxAno;
    
    document.getElementById('modalCopiarPeriodo').classList.add('active');
};

window.copiarPeriodo = async function() {
    if (!periodoOrigemCopia) {
        showToast('error', 'Erro', 'Nenhum período de origem selecionado!');
        return;
    }
    
    const perOrigem = periodos.find(p => p.id === periodoOrigemCopia);
    if (!perOrigem) {
        showToast('error', 'Erro', 'Período de origem não encontrado!');
        return;
    }

    const novoMes = parseInt(document.getElementById('copiarMes').value);
    const novoAno = parseInt(document.getElementById('copiarAno').value);
    
    const existe = periodos.find(p => p.mes === novoMes && p.ano === novoAno);
    if (existe) {
        showToast('error', 'Erro ao copiar', `Já existe um período em ${getNomeMes(novoMes)}/${novoAno}!`);
        return;
    }
    
    document.getElementById('loadingOverlay').classList.add('active');
    
    try {
        const novoPeriodo = {
            mes: novoMes,
            ano: novoAno,
            obs: `Copiado de ${getNomeMes(perOrigem.mes)}/${perOrigem.ano}`,
            createdAt: new Date().toISOString(),
            id: 'per_' + Date.now()
        };
        
        periodos.push(novoPeriodo);
        await salvarFB('custos_periodos', novoPeriodo);
        
        const setoresOrigem = setores.filter(s => s.periodoId === periodoOrigemCopia);
        let setoresCopiados = 0, itensCopiados = 0, producoesCopiadas = 0;
        
        for (const s of setoresOrigem) {
            const novoSetorId = 'set_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            const novoSetor = {
                periodoId: novoPeriodo.id,
                nome: s.nome,
                descricao: s.descricao || '',
                ordem: s.ordem || 1,
                produtoFinal: s.produtoFinal || false,
                createdAt: new Date().toISOString(),
                id: novoSetorId
            };
            
            setores.push(novoSetor);
            setoresCopiados++;
            await salvarFB('custos_setores', novoSetor);
            
            const itensSetor = itensCusto.filter(i => i.setorId === s.id);
            for (const item of itensSetor) {
                const novoItem = {
                    setorId: novoSetorId,
                    tipo: item.tipo || 'normal',
                    categoriaId: item.categoriaId || null,
                    custoFixoId: item.custoFixoId || null,
                    nome: item.nome,
                    valorTotal: parseFloat(item.valorTotal) || 0,
                    percentual: parseFloat(item.percentual) || 100,
                    obs: item.obs || '',
                    createdAt: new Date().toISOString(),
                    id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
                };
                
                itensCusto.push(novoItem);
                itensCopiados++;
                await salvarFB('custos_itens', novoItem);
            }
            
            const prodsSetor = producoes.filter(p => p.setorId === s.id);
            for (const prod of prodsSetor) {
                const novaProd = {
                    setorId: novoSetorId,
                    produto: prod.produto,
                    kg: parseFloat(prod.kg) || 0,
                    data: prod.data,
                    createdAt: new Date().toISOString(),
                    id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
                };
                
                producoes.push(novaProd);
                producoesCopiadas++;
                await salvarFB('custos_producoes', novaProd);
            }
        }
        
        saveLocalData();
        window.fecharModal('modalCopiarPeriodo');
        
        showToast('success', 
            '✅ Período copiado com sucesso!',
            `${getNomeMes(novoMes)}/${novoAno} criado com:\n📋 ${setoresCopiados} setor(es)\n💰 ${itensCopiados} item(ns)\n🏭 ${producoesCopiadas} produção(ões)`,
            6000
        );
        
        renderizarTela();
        
    } catch (error) {
        console.error('Erro ao copiar período:', error);
        showToast('error', '❌ Erro ao copiar', 'Ocorreu um erro. Tente novamente.');
    } finally {
        forceRemoveLoading();
    }
};

// ========== RENDERIZAR SETORES ==========
function renderizarSetores() {
    if (!periodoAtual) { 
        window.navegarPara('periodos'); 
        return; 
    }
    
    const sets = getSetoresDoPeriodo();
    const resumo = calcularResumoPeriodo();
    const container = document.getElementById('conteudoDinamico');
    if (!container) return;

    container.innerHTML = `
        <div class="resumo-agregado">
            <h3><i class="fas fa-chart-pie"></i> Fechamento: ${getNomeMes(periodoAtual.mes)}/${periodoAtual.ano}</h3>
            <div class="stats-grid">
                <div style="background:rgba(255,255,255,0.08);border-radius:8px;padding:1rem;text-align:center;">
                    <div style="font-size:1.5rem;font-weight:700;color:#4fc3f7;">${resumo.qtdSetores}</div>
                    <div style="font-size:0.72rem;opacity:0.7;">Setores</div>
                </div>
                <div style="background:rgba(255,255,255,0.08);border-radius:8px;padding:1rem;text-align:center;">
                    <div style="font-size:1.5rem;font-weight:700;color:#4fc3f7;">${formatMoney(resumo.custoTotalGeral)}</div>
                    <div style="font-size:0.72rem;opacity:0.7;">Custo Total</div>
                </div>
                <div style="background:rgba(255,255,255,0.08);border-radius:8px;padding:1rem;text-align:center;">
                    <div style="font-size:1.5rem;font-weight:700;color:#4fc3f7;">${formatNumber(resumo.producaoTotalGeral,0)} kg</div>
                    <div style="font-size:0.72rem;opacity:0.7;">Produção Total</div>
                </div>
                <div style="background:rgba(255,152,0,0.2);border:1px solid rgba(255,152,0,0.3);border-radius:8px;padding:1rem;text-align:center;">
                    <div style="font-size:1.5rem;font-weight:700;color:#ffb74d;">${formatMoney(resumo.custoPorKgGeral)}/kg</div>
                    <div style="font-size:0.72rem;opacity:0.7;">🏁 Custo por KG</div>
                </div>
            </div>
        </div>
        <div class="card">
            <div class="card-header">
                <span class="card-title"><i class="fas fa-industry"></i> Setores</span>
                <div style="display:flex;gap:0.5rem;">
                    <button class="btn btn-primary btn-sm" onclick="window.abrirModalSetor()">
                        <i class="fas fa-plus"></i> Novo
                    </button>
                    <button class="btn btn-purple btn-sm" onclick="window.gerarPDFCentralCustos()">
                        <i class="fas fa-file-pdf"></i> PDF
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="window.navegarPara('periodos')">
                        <i class="fas fa-arrow-left"></i> Voltar
                    </button>
                </div>
            </div>
            <div class="setores-grid" id="setoresGrid"></div>
        </div>
    `;

    const grid = document.getElementById('setoresGrid');
    if (!grid) return;
    
    if (sets.length === 0) {
        grid.innerHTML = '<div style="text-align:center;padding:2rem;grid-column:1/-1;"><p style="color:var(--text-light);">Nenhum setor cadastrado.</p></div>';
        return;
    }
    
    sets.forEach(setor => {
        const isFinal = setor.produtoFinal === true;
        const { totalCusto, totalKg, custoPorKg } = calcularCustosSetor(setor.id);
        
        const div = document.createElement('div');
        div.className = `setor-card ${isFinal ? 'produto-final' : ''}`;
        div.onclick = () => window.selecionarSetor(setor.id);
        div.innerHTML = `
            <div class="setor-acoes">
                <button class="btn btn-outline btn-xs" onclick="event.stopPropagation(); window.editarSetor('${setor.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger btn-xs" onclick="event.stopPropagation(); window.excluirSetor('${setor.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="setor-nome">
                ${setor.nome} 
                <span class="badge ${isFinal ? 'badge-orange' : 'badge-green'}">
                    ${isFinal ? '🏁 FINAL' : 'Etapa ' + (setor.ordem || 1)}
                </span>
            </div>
            <div class="setor-desc">${setor.descricao || ''}</div>
            <div class="setor-info">
                <div>
                    <div class="info-label">Custo</div>
                    <div class="info-valor money">${formatMoney(totalCusto)}</div>
                </div>
                <div>
                    <div class="info-label">Produção</div>
                    <div class="info-valor">${formatNumber(totalKg, 0)} kg</div>
                </div>
                <div style="grid-column:1/-1;">
                    <div class="info-label">Custo Médio/KG</div>
                    <div class="info-valor" style="color:${totalKg > 0 ? (isFinal ? '#e65100' : 'var(--teal)') : 'var(--text-light)'};">
                        ${totalKg > 0 ? formatMoney(custoPorKg) + '/kg' : 'Sem produção registrada'}
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(div);
    });
}

// ========== RENDERIZAR ANÁLISE ==========
function renderizarAnalise() {
    if (!setorAtual) { 
        window.navegarPara('setores'); 
        return; 
    }
    
    const { totalCusto, totalKg, custoPorKg } = calcularCustosSetor(setorAtual.id);
    const container = document.getElementById('conteudoDinamico');
    if (!container) return;

    container.innerHTML = `
        <div class="stats-grid" style="margin-bottom:1.5rem;">
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-dollar-sign"></i></div>
                <div class="stat-value">${formatMoney(totalCusto)}</div>
                <div class="stat-label">Custo Total</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-weight-hanging"></i></div>
                <div class="stat-value">${formatNumber(totalKg, 0)} kg</div>
                <div class="stat-label">Produção</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                <div class="stat-value">${totalKg > 0 ? formatMoney(custoPorKg) + '/kg' : 'N/A'}</div>
                <div class="stat-label">Custo Médio/KG</div>
            </div>
        </div>
        <div class="card">
            <div class="card-header">
                <span class="card-title"><i class="fas fa-chart-pie"></i> Distribuição - ${setorAtual.nome}</span>
                <button class="btn btn-outline btn-sm" onclick="window.navegarPara('setores')">
                    <i class="fas fa-arrow-left"></i> Voltar
                </button>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:1rem;">
                <div style="flex:1;min-width:250px;"><canvas id="pieChart" style="max-height:250px;"></canvas></div>
                <div style="flex:1;min-width:250px;"><canvas id="barChart" style="max-height:250px;"></canvas></div>
            </div>
        </div>
        <div style="display:grid;gap:1.5rem;grid-template-columns:repeat(auto-fit,minmax(350px,1fr));margin-top:1.5rem;">
            <div class="card">
                <div class="card-header">
                    <span class="card-title">Categorias</span>
                    <button class="btn btn-success btn-sm" onclick="window.abrirModalCategoria()">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                <div id="categoriasList"></div>
            </div>
            <div class="card">
                <div class="card-header">
                    <span class="card-title">Itens</span>
                    <button class="btn btn-primary btn-sm" onclick="window.abrirModalItemCusto()">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                <div id="itensCustoList"></div>
            </div>
        </div>
        <div class="card" style="margin-top:1.5rem;">
            <div class="card-header">
                <span class="card-title">Produção</span>
                <button class="btn btn-info btn-sm" onclick="window.abrirModalProducao()">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
            <div id="producaoList"></div>
        </div>
        <div class="card" style="margin-top:1.5rem;">
            <div class="card-header">
                <span class="card-title">Detalhamento</span>
            </div>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Categoria</th>
                            <th>Item</th>
                            <th>Tipo</th>
                            <th>Valor</th>
                            <th>%</th>
                            <th>Aplicado</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody id="tabelaCustos"></tbody>
                </table>
            </div>
        </div>
    `;

    carregarCategoriasLista();
    carregarItensCustoLista();
    carregarTabelaCustos();
    carregarProducoesLista();
    setTimeout(atualizarGraficos, 150);
}

// ========== CONTINUA NO PRÓXIMO ARQUIVO DEVIDO AO TAMANHO... ==========
// Devido ao limite de caracteres, continuo com as demais funções

// ========== CONFIGURAR LISTENERS ==========
function configurarListeners() {
    // Botão de confirmação
    const confirmBtn = document.getElementById('confirmBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
            if (typeof confirmCallback === 'function') {
                confirmCallback();
            }
            window.fecharModal('modalConfirm');
            confirmCallback = null;
        });
    }

    // Fechar modais ao clicar fora
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('active');
        }
    });

    // Listeners para inputs do gerar custo
    document.addEventListener('input', function(e) {
        if (['gerarCustoImposto', 'gerarCustoMargem', 'gerarCustoValorAtual'].includes(e.target.id)) {
            if (typeof window.atualizarResumoGerarCusto === 'function') {
                window.atualizarResumoGerarCusto();
            }
        }
        if (e.target.id && e.target.id.startsWith('valor_setor_')) {
            if (typeof window.atualizarResumoGerarCusto === 'function') {
                window.atualizarResumoGerarCusto();
            }
        }
    });
}

// ========== INICIAR SISTEMA ==========
// Inicia quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarSistema);
} else {
    // DOM já está pronto
    inicializarSistema();
}

// Garantia extra: remove loading após 8 segundos no máximo
setTimeout(forceRemoveLoading, 8000);

console.log('📋 Script da Central de Custos carregado. Aguardando inicialização...');
</script>
