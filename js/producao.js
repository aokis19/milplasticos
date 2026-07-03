// ============================================
// PRODUCAO.JS - Controle de Produção
// Atualizado - Usa firebase-init.js
// ============================================

let sistemaInicializado = false;
let materiaisCadastrados = [];
let fornecedoresCadastrados = [];
let folhaEditandoId = null;
let fechamentoAtualId = null;

// ============================================
// INICIALIZAÇÃO
// ============================================
function inicializarSistema() {
    if (sistemaInicializado) return;
    
    // Verificar se o Firebase está disponível via firebase-init.js
    if (typeof window.firebaseDB === 'undefined' && typeof window.db === 'undefined') {
        console.log('⏳ Aguardando Firebase...');
        setTimeout(inicializarSistema, 200);
        return;
    }

    // Usar a instância global do Firebase
    if (!window.db && window.firebaseDB) {
        window.db = window.firebaseDB;
    }

    sistemaInicializado = true;
    console.log('🚀 Sistema de Produção iniciado!');

    inicializarTabs();
    inicializarEventos();
    inicializarDataAtual();
    carregarDadosIniciais();
}

function inicializarTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const tabElement = document.getElementById(`tab-${tabId}`);
            if (tabElement) tabElement.classList.add('active');
            
            if (tabId === 'materiais') carregarListaMateriais();
            else if (tabId === 'fornecedores') carregarListaFornecedores();
        });
    });
}

function inicializarDataAtual() {
    const hoje = new Date().toISOString().split('T')[0];
    const dataEntrada = document.getElementById('dataEntradaFechamento');
    const folhaData = document.getElementById('folhaData');
    
    if (dataEntrada) dataEntrada.value = hoje;
    if (folhaData) folhaData.value = hoje;
}

function inicializarEventos() {
    console.log('📌 Inicializando eventos...');
    
    document.getElementById('btnNovoFechamento')?.addEventListener('click', abrirModalNovoFechamento);
    document.getElementById('btnCadastrarMaterial')?.addEventListener('click', abrirModalCadastroMaterial);
    document.getElementById('btnCadastrarFornecedor')?.addEventListener('click', abrirModalCadastroFornecedor);
    
    document.getElementById('btnCriarFechamento')?.addEventListener('click', criarFechamento);
    document.getElementById('btnSalvarMaterial')?.addEventListener('click', salvarMaterial);
    document.getElementById('btnSalvarFornecedor')?.addEventListener('click', salvarFornecedor);
    document.getElementById('btnSalvarFolha')?.addEventListener('click', salvarFolha);
    document.getElementById('btnAddMaterial')?.addEventListener('click', () => adicionarMaterialCard());
    
    // Fechar modais
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal')?.classList.remove('active');
        });
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) this.classList.remove('active');
        });
    });
    
    document.getElementById('btnAplicarFiltros')?.addEventListener('click', aplicarFiltros);
    document.getElementById('btnLimparFiltros')?.addEventListener('click', limparFiltros);
    document.getElementById('searchFechamentos')?.addEventListener('input', filtrarFechamentos);
    
    console.log('✅ Eventos inicializados!');
}

// ============================================
// MODAIS
// ============================================
function abrirModalNovoFechamento() {
    const modal = document.getElementById('modalNovoFechamento');
    if (modal) {
        modal.classList.add('active');
        carregarFornecedoresNoSelect();
        document.getElementById('dataEntradaFechamento').value = new Date().toISOString().split('T')[0];
        document.getElementById('pesoBrutoFechamento').value = '';
        document.getElementById('estadoMaterialFechamento').value = '';
    }
}

function abrirModalCadastroMaterial() {
    const modal = document.getElementById('modalCadastroMaterial');
    if (modal) {
        modal.classList.add('active');
        document.getElementById('novoMaterialNome').value = '';
    }
}

function abrirModalCadastroFornecedor() {
    const modal = document.getElementById('modalCadastroFornecedor');
    if (modal) {
        modal.classList.add('active');
        document.getElementById('novoFornecedorNome').value = '';
    }
}

function abrirModalFolha(fechamentoId, folhaId = null) {
    const modal = document.getElementById('modalFolha');
    if (!modal) return;
    
    fechamentoAtualId = fechamentoId;
    folhaEditandoId = folhaId;
    
    document.getElementById('fechamentoAtualId').value = fechamentoId;
    document.getElementById('modalFolhaTitulo').textContent = folhaId ? 'Editar Folha' : 'Nova Folha';
    document.getElementById('folhaData').value = new Date().toISOString().split('T')[0];
    document.getElementById('folhaDescricao').value = '';
    
    const materiaisList = document.getElementById('materiaisList');
    if (materiaisList) materiaisList.innerHTML = '';
    
    if (folhaId) {
        carregarFolhaParaEdicao(fechamentoId, folhaId);
    } else {
        adicionarMaterialCard();
    }
    
    modal.classList.add('active');
}

// ============================================
// CARREGAR DADOS
// ============================================
async function carregarDadosIniciais() {
    await carregarMateriais();
    await carregarFornecedores();
    await carregarFechamentos();
    await atualizarEstatisticas();
}

async function carregarMateriais() {
    try {
        const db = window.db || window.firebaseDB;
        if (!db) return;
        
        const q = db.collection("materiais").orderBy("nome");
        const querySnapshot = await q.get();
        materiaisCadastrados = [];
        querySnapshot.forEach((doc) => {
            materiaisCadastrados.push({ 
                id: doc.id, 
                nome: doc.data().nome,
                dataCriacao: doc.data().dataCriacao || new Date().toISOString()
            });
        });
    } catch (error) {
        console.error("Erro ao carregar materiais:", error);
    }
}

async function carregarFornecedores() {
    try {
        const db = window.db || window.firebaseDB;
        if (!db) return;
        
        const q = db.collection("fornecedores").orderBy("nome");
        const querySnapshot = await q.get();
        fornecedoresCadastrados = [];
        querySnapshot.forEach((doc) => {
            fornecedoresCadastrados.push({ 
                id: doc.id, 
                nome: doc.data().nome,
                dataCriacao: doc.data().dataCriacao || new Date().toISOString()
            });
        });
    } catch (error) {
        console.error("Erro ao carregar fornecedores:", error);
    }
}

function carregarFornecedoresNoSelect() {
    const select = document.getElementById('fechamentoFornecedor');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione um fornecedor...</option>';
    fornecedoresCadastrados.forEach(forn => {
        const option = document.createElement('option');
        option.value = forn.nome;
        option.textContent = forn.nome;
        select.appendChild(option);
    });
}

async function carregarFechamentos() {
    const container = document.getElementById('listaFechamentos');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Carregando fechamentos...</div>';
    
    try {
        const db = window.db || window.firebaseDB;
        if (!db) {
            container.innerHTML = '<div class="error">Firebase não disponível</div>';
            return;
        }
        
        const q = db.collection("fechamentos").orderBy("dataCriacao", "desc");
        const querySnapshot = await q.get();
        
        if (querySnapshot.empty) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <p>Nenhum fechamento encontrado</p>
                    <small>Clique em "Novo Fechamento" para começar</small>
                </div>
            `;
            return;
        }

        let html = '';
        querySnapshot.forEach((docSnap) => {
            html += criarCardFechamento(docSnap.id, docSnap.data());
        });
        
        container.innerHTML = html;
        adicionarEventosCardsFechamento();
        
    } catch (error) {
        container.innerHTML = '<div class="error">Erro ao carregar fechamentos</div>';
    }
}

function criarCardFechamento(id, fechamento) {
    const totalFolhas = fechamento.folhas?.length || 0;
    const consolidado = consolidarMateriais(fechamento.folhas || []);
    let pesoTotal = 0;
    Object.values(consolidado).forEach(p => pesoTotal += p);
    
    const statusClass = fechamento.finalizado ? 'status-finalizado' : (fechamento.concluido ? 'status-concluido' : 'status-aberto');
    const statusText = fechamento.finalizado ? '✓ Finalizado' : (fechamento.concluido ? '✓ Concluído' : '📝 Em aberto');
    
    return `
        <div class="fechamento-card" data-id="${id}">
            <div class="fechamento-header">
                <span class="fechamento-titulo">
                    <i class="fas fa-folder"></i> ${fechamento.nome || 'Sem nome'}
                </span>
                <span class="fechamento-status ${statusClass}">${statusText}</span>
            </div>
            <div class="fechamento-info">
                <div class="fechamento-info-item">
                    <i class="fas fa-truck"></i>
                    <span>${fechamento.fornecedor || 'N/A'}</span>
                </div>
                <div class="fechamento-info-item">
                    <i class="fas fa-calendar"></i>
                    <span>${fechamento.dataEntrada ? new Date(fechamento.dataEntrada).toLocaleDateString('pt-BR') : 'N/A'}</span>
                </div>
                <div class="fechamento-info-item">
                    <i class="fas fa-weight-hanging"></i>
                    <span>Bruto: ${formatarPeso(fechamento.pesoBruto || 0)} kg</span>
                </div>
                <div class="fechamento-info-item">
                    <i class="fas fa-tag"></i>
                    <span>${fechamento.estadoMaterial || 'N/A'}</span>
                </div>
                <div class="fechamento-info-item">
                    <i class="fas fa-file-alt"></i>
                    <span>${totalFolhas} folha(s)</span>
                </div>
                <div class="fechamento-info-item">
                    <i class="fas fa-weight-hanging"></i>
                    <span>Total: ${formatarPeso(pesoTotal)} kg</span>
                </div>
            </div>
            <div class="folhas-container" id="folhas-${id}">
                ${criarFolhasHTML(fechamento.folhas, id)}
            </div>
            <div class="fechamento-actions">
                ${!fechamento.finalizado && !fechamento.concluido ? `
                    <button class="btn btn-sm btn-primary btn-abrir-folha" data-id="${id}">
                        <i class="fas fa-plus"></i> Nova Folha
                    </button>
                    <button class="btn btn-sm btn-success btn-finalizar-fechamento" data-id="${id}">
                        <i class="fas fa-check-circle"></i> Finalizar Carga
                    </button>
                ` : ''}
                ${fechamento.finalizado && !fechamento.concluido ? `
                    <button class="btn btn-sm btn-danger btn-gerar-pdf" data-id="${id}">
                        <i class="fas fa-file-pdf"></i> Gerar PDF e Concluir
                    </button>
                ` : ''}
                ${fechamento.concluido ? `
                    <button class="btn btn-sm btn-info btn-ver-pdf" data-id="${id}">
                        <i class="fas fa-eye"></i> Ver PDF
                    </button>
                ` : ''}
                ${!fechamento.concluido ? `
                    <button class="btn btn-sm btn-warning btn-editar-fechamento" data-id="${id}">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                ` : ''}
                <button class="btn btn-sm btn-secondary btn-excluir-fechamento" data-id="${id}">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </div>
        </div>
    `;
}

function consolidarMateriais(folhas) {
    const consolidado = {};
    folhas.forEach(folha => {
        folha.materiais?.forEach(mat => {
            if (consolidado[mat.nome]) {
                consolidado[mat.nome] += mat.pesoTotal || 0;
            } else {
                consolidado[mat.nome] = mat.pesoTotal || 0;
            }
        });
    });
    return consolidado;
}

function criarFolhasHTML(folhas, fechamentoId) {
    if (!folhas || folhas.length === 0) {
        return '<div class="folha-vazia">Nenhuma folha adicionada</div>';
    }
    
    return folhas.map((folha, idx) => {
        let materiaisStr = '';
        folha.materiais?.forEach(mat => {
            const pesosStr = mat.pesos?.map(p => formatarPeso(p)).join(' + ') || '0';
            materiaisStr += `${mat.nome}: ${pesosStr} = ${formatarPeso(mat.pesoTotal)}kg; `;
        });
        
        return `
            <div class="folha-item">
                <div class="folha-header">
                    <span class="folha-data">
                        <i class="fas fa-calendar"></i> Folha ${idx + 1} - ${new Date(folha.data).toLocaleDateString('pt-BR')}
                    </span>
                    ${folha.descricao ? `<span class="folha-descricao">${folha.descricao}</span>` : ''}
                </div>
                <div class="folha-materiais">${materiaisStr}</div>
                <div class="folha-actions">
                    <button class="btn btn-xs btn-primary btn-editar-folha" data-fechamento="${fechamentoId}" data-folha-id="${folha.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-xs btn-danger btn-excluir-folha" data-fechamento="${fechamentoId}" data-folha-id="${folha.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function adicionarEventosCardsFechamento() {
    document.querySelectorAll('.btn-abrir-folha').forEach(btn => {
        btn.addEventListener('click', () => abrirModalFolha(btn.dataset.id, null));
    });
    
    document.querySelectorAll('.btn-editar-folha').forEach(btn => {
        btn.addEventListener('click', () => abrirModalFolha(btn.dataset.fechamento, btn.dataset.folhaId));
    });
    
    document.querySelectorAll('.btn-excluir-folha').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('Excluir esta folha?')) {
                await excluirFolha(btn.dataset.fechamento, btn.dataset.folhaId);
            }
        });
    });
    
    document.querySelectorAll('.btn-finalizar-fechamento').forEach(btn => {
        btn.addEventListener('click', () => finalizarFechamento(btn.dataset.id));
    });
    
    document.querySelectorAll('.btn-gerar-pdf').forEach(btn => {
        btn.addEventListener('click', () => gerarPDFFechamento(btn.dataset.id));
    });
    
    document.querySelectorAll('.btn-ver-pdf').forEach(btn => {
        btn.addEventListener('click', () => visualizarPDF(btn.dataset.id));
    });
    
    document.querySelectorAll('.btn-excluir-fechamento').forEach(btn => {
        btn.addEventListener('click', () => excluirFechamento(btn.dataset.id));
    });
}

// ============================================
// CRUD OPERATIONS
// ============================================
async function criarFechamento() {
    const db = window.db || window.firebaseDB;
    if (!db) { mostrarAlerta('Firebase não disponível', 'erro'); return; }
    
    const dataEntrada = document.getElementById('dataEntradaFechamento').value;
    const fornecedor = document.getElementById('fechamentoFornecedor').value;
    const pesoBruto = parseFloat(document.getElementById('pesoBrutoFechamento')?.value) || 0;
    const estadoMaterial = document.getElementById('estadoMaterialFechamento')?.value;

    if (!dataEntrada) { mostrarAlerta('Selecione a data de entrada', 'erro'); return; }
    if (!fornecedor) { mostrarAlerta('Selecione um fornecedor', 'erro'); return; }
    if (!estadoMaterial) { mostrarAlerta('Selecione o estado do material', 'erro'); return; }

    try {
        const dataFormatada = new Date(dataEntrada).toLocaleDateString('pt-BR');
        const nomeAutomatico = `${fornecedor} - ${dataFormatada}`;

        await db.collection("fechamentos").add({
            nome: nomeAutomatico,
            dataEntrada: dataEntrada,
            fornecedor: fornecedor,
            pesoBruto: pesoBruto,
            estadoMaterial: estadoMaterial,
            folhas: [],
            status: 'aberto',
            finalizado: false,
            concluido: false,
            dataCriacao: new Date().toISOString()
        });
        
        mostrarAlerta('Fechamento criado com sucesso!', 'sucesso');
        document.getElementById('modalNovoFechamento').classList.remove('active');
        await carregarFechamentos();
        await atualizarEstatisticas();
    } catch (error) {
        mostrarAlerta('Erro ao criar fechamento: ' + error.message, 'erro');
    }
}

async function finalizarFechamento(id) {
    const db = window.db || window.firebaseDB;
    if (!db) return;
    
    if (!confirm('Finalizar esta carga?')) return;
    
    try {
        await db.collection("fechamentos").doc(id).update({ 
            finalizado: true,
            status: 'finalizado',
            dataFinalizacao: new Date().toISOString()
        });
        
        mostrarAlerta('Carga finalizada!', 'sucesso');
        await carregarFechamentos();
        await atualizarEstatisticas();
    } catch (error) {
        mostrarAlerta('Erro ao finalizar: ' + error.message, 'erro');
    }
}

async function salvarMaterial() {
    const db = window.db || window.firebaseDB;
    if (!db) return;
    
    const nome = document.getElementById('novoMaterialNome').value.trim();
    if (!nome) { mostrarAlerta('Digite o nome do material', 'erro'); return; }

    try {
        await db.collection("materiais").add({ 
            nome: nome,
            dataCriacao: new Date().toISOString()
        });
        
        mostrarAlerta('Material cadastrado!', 'sucesso');
        document.getElementById('modalCadastroMaterial').classList.remove('active');
        await carregarMateriais();
    } catch (error) {
        mostrarAlerta('Erro ao cadastrar material', 'erro');
    }
}

async function salvarFornecedor() {
    const db = window.db || window.firebaseDB;
    if (!db) return;
    
    const nome = document.getElementById('novoFornecedorNome').value.trim();
    if (!nome) { mostrarAlerta('Digite o nome do fornecedor', 'erro'); return; }

    try {
        await db.collection("fornecedores").add({ 
            nome: nome,
            dataCriacao: new Date().toISOString()
        });
        
        mostrarAlerta('Fornecedor cadastrado!', 'sucesso');
        document.getElementById('modalCadastroFornecedor').classList.remove('active');
        await carregarFornecedores();
    } catch (error) {
        mostrarAlerta('Erro ao cadastrar fornecedor', 'erro');
    }
}

async function excluirFechamento(id) {
    const db = window.db || window.firebaseDB;
    if (!db) return;
    
    if (!confirm('Excluir este fechamento?')) return;
    
    try {
        await db.collection("fechamentos").doc(id).delete();
        mostrarAlerta('Fechamento excluído!', 'sucesso');
        await carregarFechamentos();
        await atualizarEstatisticas();
    } catch (error) {
        mostrarAlerta('Erro ao excluir', 'erro');
    }
}

async function excluirMaterial(id) {
    const db = window.db || window.firebaseDB;
    if (!db || !confirm('Excluir este material?')) return;
    
    try {
        await db.collection("materiais").doc(id).delete();
        mostrarAlerta('Material excluído!', 'sucesso');
        await carregarListaMateriais();
        await carregarMateriais();
    } catch (error) {
        mostrarAlerta('Erro ao excluir material', 'erro');
    }
}

async function excluirFornecedor(id) {
    const db = window.db || window.firebaseDB;
    if (!db || !confirm('Excluir este fornecedor?')) return;
    
    try {
        await db.collection("fornecedores").doc(id).delete();
        mostrarAlerta('Fornecedor excluído!', 'sucesso');
        await carregarListaFornecedores();
        await carregarFornecedores();
    } catch (error) {
        mostrarAlerta('Erro ao excluir fornecedor', 'erro');
    }
}

// ============================================
// LISTAS
// ============================================
async function carregarListaMateriais() {
    const container = document.getElementById('listaMateriaisCadastrados');
    if (!container) return;
    
    await carregarMateriais();
    
    if (materiaisCadastrados.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-box-open"></i><p>Nenhum material cadastrado</p></div>`;
        document.getElementById('totalMateriais').textContent = '0 materiais';
        return;
    }

    container.innerHTML = materiaisCadastrados.map(mat => `
        <div class="cadastro-card">
            <div class="cadastro-info">
                <i class="fas fa-box"></i>
                <div class="cadastro-detalhes">
                    <h4>${mat.nome}</h4>
                    <small>${new Date(mat.dataCriacao).toLocaleDateString('pt-BR')}</small>
                </div>
            </div>
            <button class="btn-icon btn-excluir-material" data-id="${mat.id}">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
    
    document.getElementById('totalMateriais').textContent = `${materiaisCadastrados.length} materiais`;
    
    document.querySelectorAll('.btn-excluir-material').forEach(btn => {
        btn.addEventListener('click', () => excluirMaterial(btn.dataset.id));
    });
}

async function carregarListaFornecedores() {
    const container = document.getElementById('listaFornecedoresCadastrados');
    if (!container) return;
    
    await carregarFornecedores();
    
    if (fornecedoresCadastrados.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-truck"></i><p>Nenhum fornecedor cadastrado</p></div>`;
        document.getElementById('totalFornecedores').textContent = '0 fornecedores';
        return;
    }

    container.innerHTML = fornecedoresCadastrados.map(forn => `
        <div class="cadastro-card">
            <div class="cadastro-info">
                <i class="fas fa-truck"></i>
                <div class="cadastro-detalhes">
                    <h4>${forn.nome}</h4>
                    <small>${new Date(forn.dataCriacao).toLocaleDateString('pt-BR')}</small>
                </div>
            </div>
            <button class="btn-icon btn-excluir-fornecedor" data-id="${forn.id}">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
    
    document.getElementById('totalFornecedores').textContent = `${fornecedoresCadastrados.length} fornecedores`;
    
    document.querySelectorAll('.btn-excluir-fornecedor').forEach(btn => {
        btn.addEventListener('click', () => excluirFornecedor(btn.dataset.id));
    });
}

// ============================================
// MATERIAIS E PESOS (mantido igual)
// ============================================
function adicionarMaterialCard(materialNome = '', pesos = []) {
    const materiaisList = document.getElementById('materiaisList');
    if (!materiaisList) return;
    
    const cardId = 'material_' + Date.now();
    const cardDiv = document.createElement('div');
    cardDiv.className = 'material-card-item';
    cardDiv.dataset.id = cardId;
    
    let selectOptions = '<option value="">Selecione um material...</option>';
    materiaisCadastrados.forEach(mat => {
        selectOptions += `<option value="${mat.nome}" ${mat.nome === materialNome ? 'selected' : ''}>${mat.nome}</option>`;
    });
    
    cardDiv.innerHTML = `
        <div class="material-header">
            <select class="form-control material-select" data-card="${cardId}" style="flex:1;">
                ${selectOptions}
            </select>
            <button type="button" class="btn btn-sm btn-danger btn-remover-material" data-card="${cardId}">
                <i class="fas fa-trash"></i> Remover
            </button>
        </div>
        <div class="pesos-container" data-card="${cardId}">
            <div class="pesos-list" id="pesos-${cardId}"></div>
            <button type="button" class="btn btn-sm btn-success btn-add-peso" data-card="${cardId}">
                <i class="fas fa-plus"></i> Adicionar Peso
            </button>
        </div>
        <div class="material-total" id="total-${cardId}">Total do Material: 0,00 kg</div>
    `;
    
    materiaisList.appendChild(cardDiv);
    
    const pesosList = document.getElementById(`pesos-${cardId}`);
    if (pesos.length > 0) {
        pesos.forEach(p => adicionarCampoPeso(pesosList, cardId, p));
    } else {
        adicionarCampoPeso(pesosList, cardId, '');
    }
    
    cardDiv.querySelector('.material-select')?.addEventListener('change', calcularSomaFolha);
    cardDiv.querySelector('.btn-remover-material')?.addEventListener('click', () => {
        cardDiv.remove();
        calcularSomaFolha();
    });
    cardDiv.querySelector('.btn-add-peso')?.addEventListener('click', () => adicionarCampoPeso(pesosList, cardId, ''));
    
    calcularSomaFolha();
}

function adicionarCampoPeso(container, cardId, valorInicial = '') {
    const pesoDiv = document.createElement('div');
    pesoDiv.className = 'peso-item';
    pesoDiv.innerHTML = `
        <input type="number" class="form-control peso-input" step="0.01" min="0" 
               placeholder="Peso em kg" value="${valorInicial}" data-card="${cardId}">
        <button type="button" class="btn btn-sm btn-warning btn-remover-peso">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(pesoDiv);
    pesoDiv.querySelector('.peso-input')?.addEventListener('input', calcularSomaFolha);
    pesoDiv.querySelector('.btn-remover-peso')?.addEventListener('click', () => {
        pesoDiv.remove();
        calcularSomaFolha();
    });
}

async function calcularSomaFolha() {
    const db = window.db || window.firebaseDB;
    let somaTotalGeral = 0;
    
    document.querySelectorAll('.material-card-item').forEach(card => {
        const cardId = card.dataset.id;
        let somaMaterial = 0;
        card.querySelectorAll('.peso-input').forEach(input => {
            somaMaterial += parseFloat(input.value) || 0;
        });
        somaTotalGeral += somaMaterial;
        const totalSpan = document.getElementById(`total-${cardId}`);
        if (totalSpan) totalSpan.textContent = `Total do Material: ${formatarPeso(somaMaterial)} kg`;
    });
    
    const somaSpan = document.getElementById('somaMateriais');
    if (somaSpan) somaSpan.textContent = formatarPeso(somaTotalGeral);
    
    // Comparativo
    const fechamentoId = document.getElementById('fechamentoAtualId')?.value;
    let pesoBalancao = 0;
    
    if (fechamentoId && db) {
        try {
            const snap = await db.collection("fechamentos").doc(fechamentoId).get();
            if (snap.exists) pesoBalancao = snap.data().pesoBruto || 0;
        } catch(e) {}
    }
    
    const compDiv = document.getElementById('comparativoDiv');
    if (compDiv) {
        const dif = somaTotalGeral - pesoBalancao;
        let html = `<strong>📊 Comparativo</strong><br>Peso Bruto: ${formatarPeso(pesoBalancao)} kg<br>Soma Total: ${formatarPeso(somaTotalGeral)} kg<br>`;
        
        if (pesoBalancao > 0) {
            const perc = (Math.abs(dif) / pesoBalancao) * 100;
            html += `Diferença: ${dif >= 0 ? '+' : ''}${formatarPeso(Math.abs(dif))} kg (${perc.toFixed(1)}%)<br>`;
            compDiv.className = 'comparativo-box ' + (perc <= 5 ? 'verde' : 'vermelho');
            html += perc <= 5 ? '✅ COMPATÍVEL' : '❌ INCOMPATÍVEL';
        } else {
            compDiv.className = 'comparativo-box amarelo';
            html += '⚠️ Peso bruto não informado';
        }
        compDiv.innerHTML = html;
    }
}

// ============================================
// SALVAR FOLHA
// ============================================
async function salvarFolha() {
    const db = window.db || window.firebaseDB;
    if (!db) { mostrarAlerta('Firebase não disponível', 'erro'); return; }
    
    const fechamentoId = document.getElementById('fechamentoAtualId')?.value;
    const folhaData = document.getElementById('folhaData')?.value;
    const folhaDescricao = document.getElementById('folhaDescricao')?.value || '';
    
    if (!fechamentoId || !folhaData) {
        mostrarAlerta('Preencha os campos obrigatórios', 'erro');
        return;
    }
    
    const materiais = [];
    document.querySelectorAll('.material-card-item').forEach(card => {
        const nome = card.querySelector('.material-select')?.value;
        if (!nome) return;
        
        let soma = 0;
        const pesos = [];
        card.querySelectorAll('.peso-input').forEach(input => {
            const p = parseFloat(input.value) || 0;
            if (p > 0) { soma += p; pesos.push(p); }
        });
        
        if (soma > 0) materiais.push({ nome, pesoTotal: soma, pesos });
    });
    
    if (materiais.length === 0) { mostrarAlerta('Adicione pelo menos um material', 'erro'); return; }
    
    try {
        const snap = await db.collection("fechamentos").doc(fechamentoId).get();
        const fechamento = snap.data();
        
        const novaFolha = {
            id: folhaEditandoId || Date.now().toString(),
            data: folhaData,
            descricao: folhaDescricao,
            materiais: materiais,
            dataCriacao: new Date().toISOString()
        };
        
        let folhas = fechamento.folhas || [];
        if (folhaEditandoId) {
            folhas = folhas.map(f => f.id === folhaEditandoId ? novaFolha : f);
        } else {
            folhas.push(novaFolha);
        }
        
        await db.collection("fechamentos").doc(fechamentoId).update({ folhas });
        
        mostrarAlerta('Folha salva!', 'sucesso');
        document.getElementById('modalFolha')?.classList.remove('active');
        folhaEditandoId = null;
        fechamentoAtualId = null;
        
        await carregarFechamentos();
        await atualizarEstatisticas();
    } catch (error) {
        mostrarAlerta('Erro ao salvar folha: ' + error.message, 'erro');
    }
}

async function carregarFolhaParaEdicao(fechamentoId, folhaId) {
    const db = window.db || window.firebaseDB;
    if (!db) return;
    
    try {
        const snap = await db.collection("fechamentos").doc(fechamentoId).get();
        if (snap.exists) {
            const folha = snap.data().folhas?.find(f => f.id === folhaId);
            if (folha) {
                document.getElementById('folhaData').value = folha.data || '';
                document.getElementById('folhaDescricao').value = folha.descricao || '';
                document.getElementById('materiaisList').innerHTML = '';
                folha.materiais?.forEach(mat => adicionarMaterialCard(mat.nome, mat.pesos || []));
                calcularSomaFolha();
            }
        }
    } catch(e) {}
}

async function excluirFolha(fechamentoId, folhaId) {
    const db = window.db || window.firebaseDB;
    if (!db) return;
    
    try {
        const snap = await db.collection("fechamentos").doc(fechamentoId).get();
        if (snap.exists) {
            const folhas = (snap.data().folhas || []).filter(f => f.id !== folhaId);
            await db.collection("fechamentos").doc(fechamentoId).update({ folhas });
            mostrarAlerta('Folha excluída!', 'sucesso');
            await carregarFechamentos();
            await atualizarEstatisticas();
        }
    } catch(e) {}
}

// ============================================
// PDF (mantido igual)
// ============================================
async function gerarPDFFechamento(fechamentoId) {
    const db = window.db || window.firebaseDB;
    if (!db) return;
    
    try {
        const snap = await db.collection("fechamentos").doc(fechamentoId).get();
        if (!snap.exists) { mostrarAlerta('Fechamento não encontrado', 'erro'); return; }
        
        const fechamento = snap.data();
        const folhas = fechamento.folhas || [];
        if (folhas.length === 0) { mostrarAlerta('Nenhuma folha para gerar PDF', 'erro'); return; }
        
        const consolidado = {};
        folhas.forEach(folha => {
            folha.materiais?.forEach(mat => {
                if (consolidado[mat.nome]) {
                    consolidado[mat.nome].pesoTotal += mat.pesoTotal || 0;
                    consolidado[mat.nome].pesos.push(...(mat.pesos || []));
                } else {
                    consolidado[mat.nome] = { pesoTotal: mat.pesoTotal || 0, pesos: [...(mat.pesos || [])] };
                }
            });
        });
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        
        pdf.setFillColor(44, 62, 80);
        pdf.rect(0, 0, 210, 40, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(18);
        pdf.text('MIL PLÁSTICOS', 15, 20);
        pdf.setFontSize(11);
        pdf.text('Relatório de Produção', 15, 30);
        
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(10);
        pdf.text(`Fechamento: ${fechamento.nome || 'N/A'}`, 15, 50);
        pdf.text(`Fornecedor: ${fechamento.fornecedor || 'N/A'}`, 15, 57);
        pdf.text(`Peso Bruto: ${formatarPeso(fechamento.pesoBruto || 0)} kg`, 15, 64);
        pdf.text(`Total de Folhas: ${folhas.length}`, 15, 71);
        
        let y = 85;
        let somaTotalGeral = 0;
        
        for (const [nome, dados] of Object.entries(consolidado)) {
            if (y > 260) { pdf.addPage(); y = 20; }
            pdf.setFontSize(11);
            pdf.text(`${nome}: ${formatarPeso(dados.pesoTotal)} kg`, 15, y);
            y += 7;
            somaTotalGeral += dados.pesoTotal;
        }
        
        y += 5;
        pdf.line(15, y, 195, y);
        y += 10;
        pdf.setFontSize(12);
        pdf.text(`Soma Total: ${formatarPeso(somaTotalGeral)} kg`, 15, y);
        
        const pdfBase64 = pdf.output('datauristring');
        
        await db.collection("fechamentos").doc(fechamentoId).update({ 
            pdfGerado: pdfBase64, 
            concluido: true, 
            status: 'concluido',
            dataConclusao: new Date().toISOString()
        });
        
        window.open(pdfBase64);
        mostrarAlerta('PDF gerado!', 'sucesso');
        await carregarFechamentos();
        await atualizarEstatisticas();
    } catch(e) {
        mostrarAlerta('Erro ao gerar PDF', 'erro');
    }
}

function visualizarPDF(id) {
    mostrarAlerta('Funcionalidade em desenvolvimento', 'info');
}

// ============================================
// UTILITÁRIOS
// ============================================
function formatarPeso(valor) {
    return (Math.round(valor * 100) / 100).toFixed(2);
}

function mostrarAlerta(mensagem, tipo = 'erro') {
    const alerta = document.getElementById('alertaFlutuante');
    const msg = document.getElementById('mensagemAlerta');
    if (!alerta || !msg) return;
    msg.textContent = mensagem;
    alerta.className = 'alerta-flutuante show ' + tipo;
    setTimeout(() => alerta.classList.remove('show'), 4000);
}

async function atualizarEstatisticas() {
    const db = window.db || window.firebaseDB;
    if (!db) return;
    
    try {
        const snap = await db.collection("fechamentos").get();
        let total = 0, folhas = 0, peso = 0, abertos = 0;
        
        snap.forEach(doc => {
            const f = doc.data();
            total++;
            if (!f.finalizado && !f.concluido) abertos++;
            (f.folhas || []).forEach(folha => {
                folhas++;
                folha.materiais?.forEach(m => peso += m.pesoTotal || 0);
            });
        });
        
        document.getElementById('totalFechamentos').textContent = total;
        document.getElementById('totalFolhas').textContent = folhas;
        document.getElementById('totalPeso').textContent = formatarPeso(peso) + ' kg';
        document.getElementById('fechamentosAbertos').textContent = abertos;
        document.getElementById('totalRegistros').textContent = total + ' registros';
    } catch(e) {}
}

function aplicarFiltros() { carregarFechamentos(); }
function limparFiltros() {
    document.getElementById('filtroFornecedor').value = '';
    document.getElementById('filtroStatus').value = '';
    document.getElementById('filtroPeriodo').value = '30';
    carregarFechamentos();
}
function filtrarFechamentos() {}

// ============================================
// INICIAR
// ============================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(inicializarSistema, 100));
} else {
    setTimeout(inicializarSistema, 100);
}
