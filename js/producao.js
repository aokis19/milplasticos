// ============================================
// PRODUCAO.JS - Controle de Produção
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
    if (typeof window.db === 'undefined') {
        console.log('⏳ Aguardando Firebase...');
        setTimeout(inicializarSistema, 200);
        return;
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
            document.getElementById(`tab-${tabId}`).classList.add('active');
            
            if (tabId === 'materiais') {
                carregarListaMateriais();
            } else if (tabId === 'fornecedores') {
                carregarListaFornecedores();
            }
        });
    });
}

function inicializarDataAtual() {
    const dataEntrada = document.getElementById('dataEntradaFechamento');
    const folhaData = document.getElementById('folhaData');
    
    if (dataEntrada) dataEntrada.value = new Date().toISOString().split('T')[0];
    if (folhaData) folhaData.value = new Date().toISOString().split('T')[0];
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
        const q = query(collection(window.db, "materiais"), orderBy("nome"));
        const querySnapshot = await getDocs(q);
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
        const q = query(collection(window.db, "fornecedores"), orderBy("nome"));
        const querySnapshot = await getDocs(q);
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
        const q = query(collection(window.db, "fechamentos"), orderBy("dataCriacao", "desc"));
        const querySnapshot = await getDocs(q);
        
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
    
    document.querySelectorAll('.btn-editar-fechamento').forEach(btn => {
        btn.addEventListener('click', () => editarFechamento(btn.dataset.id));
    });
    
    document.querySelectorAll('.btn-excluir-fechamento').forEach(btn => {
        btn.addEventListener('click', () => excluirFechamento(btn.dataset.id));
    });
}

// ============================================
// CRUD OPERATIONS
// ============================================
async function criarFechamento() {
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

        await addDoc(collection(window.db, "fechamentos"), {
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
    if (!confirm('Finalizar esta carga? Após finalizar, não será possível adicionar mais folhas.')) return;
    
    try {
        const fechamentoRef = doc(window.db, "fechamentos", id);
        await updateDoc(fechamentoRef, { 
            finalizado: true,
            status: 'finalizado',
            dataFinalizacao: new Date().toISOString()
        });
        
        mostrarAlerta('Carga finalizada! Agora você pode gerar o PDF.', 'sucesso');
        await carregarFechamentos();
        await atualizarEstatisticas();
    } catch (error) {
        mostrarAlerta('Erro ao finalizar: ' + error.message, 'erro');
    }
}

async function salvarMaterial() {
    const nome = document.getElementById('novoMaterialNome').value.trim();
    if (!nome) { mostrarAlerta('Digite o nome do material', 'erro'); return; }

    try {
        await addDoc(collection(window.db, "materiais"), { 
            nome: nome,
            dataCriacao: new Date().toISOString()
        });
        
        mostrarAlerta('Material cadastrado com sucesso!', 'sucesso');
        document.getElementById('modalCadastroMaterial').classList.remove('active');
        await carregarMateriais();
    } catch (error) {
        mostrarAlerta('Erro ao cadastrar material: ' + error.message, 'erro');
    }
}

async function salvarFornecedor() {
    const nome = document.getElementById('novoFornecedorNome').value.trim();
    if (!nome) { mostrarAlerta('Digite o nome do fornecedor', 'erro'); return; }

    try {
        await addDoc(collection(window.db, "fornecedores"), { 
            nome: nome,
            dataCriacao: new Date().toISOString()
        });
        
        mostrarAlerta('Fornecedor cadastrado com sucesso!', 'sucesso');
        document.getElementById('modalCadastroFornecedor').classList.remove('active');
        await carregarFornecedores();
    } catch (error) {
        mostrarAlerta('Erro ao cadastrar fornecedor: ' + error.message, 'erro');
    }
}

// ============================================
// LISTAS DE MATERIAIS E FORNECEDORES
// ============================================
async function carregarListaMateriais() {
    const container = document.getElementById('listaMateriaisCadastrados');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Carregando materiais...</div>';
    
    try {
        await carregarMateriais();
        
        if (materiaisCadastrados.length === 0) {
            container.innerHTML = `<div class="empty-state"><i class="fas fa-box-open"></i><p>Nenhum material cadastrado</p></div>`;
            document.getElementById('totalMateriais').textContent = '0 materiais';
            return;
        }

        let html = '';
        materiaisCadastrados.forEach(mat => {
            html += `
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
            `;
        });
        
        container.innerHTML = html;
        document.getElementById('totalMateriais').textContent = `${materiaisCadastrados.length} materiais`;
        
        document.querySelectorAll('.btn-excluir-material').forEach(btn => {
            btn.addEventListener('click', () => excluirMaterial(btn.dataset.id));
        });
        
    } catch (error) {
        container.innerHTML = '<div class="error">Erro ao carregar materiais</div>';
    }
}

async function carregarListaFornecedores() {
    const container = document.getElementById('listaFornecedoresCadastrados');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Carregando fornecedores...</div>';
    
    try {
        await carregarFornecedores();
        
        if (fornecedoresCadastrados.length === 0) {
            container.innerHTML = `<div class="empty-state"><i class="fas fa-truck"></i><p>Nenhum fornecedor cadastrado</p></div>`;
            document.getElementById('totalFornecedores').textContent = '0 fornecedores';
            return;
        }

        let html = '';
        fornecedoresCadastrados.forEach(forn => {
            html += `
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
            `;
        });
        
        container.innerHTML = html;
        document.getElementById('totalFornecedores').textContent = `${fornecedoresCadastrados.length} fornecedores`;
        
        document.querySelectorAll('.btn-excluir-fornecedor').forEach(btn => {
            btn.addEventListener('click', () => excluirFornecedor(btn.dataset.id));
        });
        
    } catch (error) {
        container.innerHTML = '<div class="error">Erro ao carregar fornecedores</div>';
    }
}

async function excluirMaterial(id) {
    if (!confirm('Excluir este material?')) return;
    try {
        await deleteDoc(doc(window.db, "materiais", id));
        mostrarAlerta('Material excluído!', 'sucesso');
        await carregarListaMateriais();
        await carregarMateriais();
    } catch (error) {
        mostrarAlerta('Erro ao excluir material', 'erro');
    }
}

async function excluirFornecedor(id) {
    if (!confirm('Excluir este fornecedor?')) return;
    try {
        await deleteDoc(doc(window.db, "fornecedores", id));
        mostrarAlerta('Fornecedor excluído!', 'sucesso');
        await carregarListaFornecedores();
        await carregarFornecedores();
    } catch (error) {
        mostrarAlerta('Erro ao excluir fornecedor', 'erro');
    }
}

// ============================================
// MATERIAIS E PESOS
// ============================================
function adicionarMaterialCard(materialNome = '', pesos = []) {
    const materiaisList = document.getElementById('materiaisList');
    if (!materiaisList) return;
    
    const cardId = 'material_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    
    const cardDiv = document.createElement('div');
    cardDiv.className = 'material-card-item';
    cardDiv.dataset.id = cardId;
    
    let selectOptions = '<option value="">Selecione um material...</option>';
    materiaisCadastrados.forEach(mat => {
        const selected = mat.nome === materialNome ? 'selected' : '';
        selectOptions += `<option value="${mat.nome}" ${selected}>${mat.nome}</option>`;
    });
    
    cardDiv.innerHTML = `
        <div class="material-header">
            <select class="form-control material-select" data-card="${cardId}" style="flex: 1;">
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
        <div class="material-total" id="total-${cardId}">
            Total do Material: 0,00 kg
        </div>
    `;
    
    materiaisList.appendChild(cardDiv);
    
    const pesosList = document.getElementById(`pesos-${cardId}`);
    if (pesos && pesos.length > 0) {
        pesos.forEach(peso => adicionarCampoPeso(pesosList, cardId, peso));
    } else {
        adicionarCampoPeso(pesosList, cardId, '');
    }
    
    const select = cardDiv.querySelector('.material-select');
    const btnRemover = cardDiv.querySelector('.btn-remover-material');
    const btnAddPeso = cardDiv.querySelector('.btn-add-peso');
    
    if (select) select.addEventListener('change', calcularSomaFolha);
    if (btnRemover) {
        btnRemover.addEventListener('click', () => {
            cardDiv.remove();
            calcularSomaFolha();
        });
    }
    if (btnAddPeso) {
        btnAddPeso.addEventListener('click', () => adicionarCampoPeso(pesosList, cardId, ''));
    }
    
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
    
    const input = pesoDiv.querySelector('.peso-input');
    const btnRemover = pesoDiv.querySelector('.btn-remover-peso');
    
    if (input) input.addEventListener('input', calcularSomaFolha);
    if (btnRemover) {
        btnRemover.addEventListener('click', () => {
            pesoDiv.remove();
            calcularSomaFolha();
        });
    }
}

async function calcularSomaFolha() {
    let somaTotalGeral = 0;
    const cards = document.querySelectorAll('.material-card-item');
    
    cards.forEach(card => {
        const cardId = card.dataset.id;
        const pesos = card.querySelectorAll('.peso-input');
        let somaMaterial = 0;
        
        pesos.forEach(input => {
            somaMaterial += parseFloat(input.value) || 0;
        });
        
        somaTotalGeral += somaMaterial;
        
        const totalSpan = document.getElementById(`total-${cardId}`);
        if (totalSpan) {
            totalSpan.textContent = `Total do Material: ${formatarPeso(somaMaterial)} kg`;
        }
    });
    
    const somaMateriaisSpan = document.getElementById('somaMateriais');
    if (somaMateriaisSpan) {
        somaMateriaisSpan.textContent = formatarPeso(somaTotalGeral);
    }
    
    const fechamentoId = document.getElementById('fechamentoAtualId')?.value;
    let pesoBalancao = 0;
    
    if (fechamentoId) {
        try {
            const fechamentoRef = doc(window.db, "fechamentos", fechamentoId);
            const fechamentoSnap = await getDoc(fechamentoRef);
            if (fechamentoSnap.exists()) {
                pesoBalancao = fechamentoSnap.data().pesoBruto || 0;
            }
        } catch (error) {
            console.error('Erro ao buscar peso:', error);
        }
    }
    
    const comparativoDiv = document.getElementById('comparativoDiv');
    if (comparativoDiv) {
        const diferenca = somaTotalGeral - pesoBalancao;
        
        let html = `<strong>📊 Comparativo</strong><br>`;
        html += `Peso Bruto: ${formatarPeso(pesoBalancao)} kg<br>`;
        html += `Soma Total: ${formatarPeso(somaTotalGeral)} kg<br>`;
        
        if (pesoBalancao > 0) {
            const diferencaPercentual = (Math.abs(diferenca) / pesoBalancao) * 100;
            html += `Diferença: ${diferenca >= 0 ? '+' : ''}${formatarPeso(Math.abs(diferenca))} kg (${diferencaPercentual.toFixed(1)}%)<br>`;
            
            comparativoDiv.className = 'comparativo-box';
            if (diferencaPercentual <= 5) {
                comparativoDiv.classList.add('verde');
                html += '✅ COMPATÍVEL: Dentro da tolerância de 5%';
            } else {
                comparativoDiv.classList.add('vermelho');
                html += '❌ INCOMPATÍVEL: Variação superior a 5%';
            }
        } else {
            comparativoDiv.className = 'comparativo-box amarelo';
            html += '⚠️ Peso bruto não informado no fechamento';
        }
        
        comparativoDiv.innerHTML = html;
    }
}

// ============================================
// SALVAR E CARREGAR FOLHA
// ============================================
async function salvarFolha() {
    const fechamentoId = document.getElementById('fechamentoAtualId')?.value;
    const folhaData = document.getElementById('folhaData')?.value;
    const folhaDescricao = document.getElementById('folhaDescricao')?.value || '';
    
    if (!fechamentoId) { mostrarAlerta('Fechamento não identificado', 'erro'); return; }
    if (!folhaData) { mostrarAlerta('Selecione a data da pesagem', 'erro'); return; }
    
    const cards = document.querySelectorAll('.material-card-item');
    const materiais = [];
    
    cards.forEach(card => {
        const select = card.querySelector('.material-select');
        const materialNome = select?.value || '';
        const pesos = card.querySelectorAll('.peso-input');
        
        let somaMaterial = 0;
        const pesosLista = [];
        
        pesos.forEach(input => {
            const peso = parseFloat(input.value) || 0;
            if (peso > 0) {
                somaMaterial += peso;
                pesosLista.push(peso);
            }
        });
        
        if (materialNome && somaMaterial > 0) {
            materiais.push({
                nome: materialNome,
                pesoTotal: somaMaterial,
                pesos: pesosLista
            });
        }
    });
    
    if (materiais.length === 0) { mostrarAlerta('Adicione pelo menos um material com peso', 'erro'); return; }
    
    try {
        const fechamentoRef = doc(window.db, "fechamentos", fechamentoId);
        const fechamentoSnap = await getDoc(fechamentoRef);
        const fechamento = fechamentoSnap.data();
        const pesoBalancao = fechamento.pesoBruto || 0;
        
        const novaFolha = {
            id: folhaEditandoId || Date.now().toString(),
            data: folhaData,
            descricao: folhaDescricao,
            pesoBalancao: pesoBalancao,
            materiais: materiais,
            dataCriacao: new Date().toISOString()
        };
        
        let folhasAtuais = fechamento.folhas || [];
        
        if (folhaEditandoId) {
            const index = folhasAtuais.findIndex(f => f.id === folhaEditandoId);
            if (index !== -1) folhasAtuais[index] = novaFolha;
        } else {
            folhasAtuais.push(novaFolha);
        }
        
        await updateDoc(fechamentoRef, { folhas: folhasAtuais });
        
        mostrarAlerta('Folha salva com sucesso!', 'sucesso');
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
    try {
        const fechamentoRef = doc(window.db, "fechamentos", fechamentoId);
        const fechamentoSnap = await getDoc(fechamentoRef);
        
        if (fechamentoSnap.exists()) {
            const folha = fechamentoSnap.data().folhas?.find(f => f.id === folhaId);
            
            if (folha) {
                document.getElementById('folhaData').value = folha.data || '';
                document.getElementById('folhaDescricao').value = folha.descricao || '';
                
                const materiaisList = document.getElementById('materiaisList');
                if (materiaisList) {
                    materiaisList.innerHTML = '';
                    
                    if (folha.materiais && folha.materiais.length > 0) {
                        folha.materiais.forEach(mat => {
                            adicionarMaterialCard(mat.nome, mat.pesos || []);
                        });
                    }
                }
                
                await calcularSomaFolha();
            }
        }
    } catch (error) {
        mostrarAlerta('Erro ao carregar folha para edição', 'erro');
    }
}

async function excluirFolha(fechamentoId, folhaId) {
    try {
        const fechamentoRef = doc(window.db, "fechamentos", fechamentoId);
        const fechamentoSnap = await getDoc(fechamentoRef);
        
        if (fechamentoSnap.exists()) {
            const fechamento = fechamentoSnap.data();
            const folhasAtuais = (fechamento.folhas || []).filter(f => f.id !== folhaId);
            
            await updateDoc(fechamentoRef, { folhas: folhasAtuais });
            
            mostrarAlerta('Folha excluída com sucesso!', 'sucesso');
            await carregarFechamentos();
            await atualizarEstatisticas();
        }
    } catch (error) {
        mostrarAlerta('Erro ao excluir folha', 'erro');
    }
}

// ============================================
// PDF
// ============================================
async function gerarPDFFechamento(fechamentoId) {
    try {
        const fechamentoRef = doc(window.db, "fechamentos", fechamentoId);
        const fechamentoSnap = await getDoc(fechamentoRef);
        
        if (!fechamentoSnap.exists()) {
            mostrarAlerta('Fechamento não encontrado', 'erro');
            return;
        }
        
        const fechamento = fechamentoSnap.data();
        const folhas = fechamento.folhas || [];
        
        if (folhas.length === 0) {
            mostrarAlerta('Nenhuma folha para gerar PDF', 'erro');
            return;
        }
        
        // Consolidar todos os materiais de todas as folhas
        const consolidado = {};
        const todosPesos = [];
        
        folhas.forEach(folha => {
            folha.materiais?.forEach(mat => {
                if (consolidado[mat.nome]) {
                    consolidado[mat.nome].pesoTotal += mat.pesoTotal || 0;
                    consolidado[mat.nome].pesos.push(...(mat.pesos || []));
                } else {
                    consolidado[mat.nome] = {
                        pesoTotal: mat.pesoTotal || 0,
                        pesos: [...(mat.pesos || [])]
                    };
                }
                todosPesos.push(...(mat.pesos || []));
            });
        });
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        
        // Cabeçalho
        pdf.setFillColor(44, 62, 80);
        pdf.rect(0, 0, 210, 40, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(18);
        pdf.setFont("helvetica", "bold");
        pdf.text('MIL PLÁSTICOS', 15, 20);
        pdf.setFontSize(11);
        pdf.text('Relatório de Produção - Consolidado', 15, 30);
        
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.text(`Fechamento: ${fechamento.nome || 'N/A'}`, 15, 55);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.text(`Fornecedor: ${fechamento.fornecedor || 'N/A'}`, 15, 65);
        pdf.text(`Data de Entrada: ${fechamento.dataEntrada ? new Date(fechamento.dataEntrada).toLocaleDateString('pt-BR') : 'N/A'}`, 15, 72);
        pdf.text(`Estado do Material: ${fechamento.estadoMaterial || 'N/A'}`, 15, 79);
        pdf.text(`Peso Bruto: ${formatarPeso(fechamento.pesoBruto || 0)} kg`, 15, 86);
        pdf.text(`Total de Folhas: ${folhas.length}`, 15, 93);
        
        // Linha separadora
        pdf.setDrawColor(200, 200, 200);
        pdf.line(15, 100, 195, 100);
        
        let y = 110;
        
        // Título dos materiais
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(44, 62, 80);
        pdf.text('MATERIAIS CONSOLIDADOS', 15, y);
        y += 10;
        
        let somaTotalGeral = 0;
        
        // Listar cada material com seus pesos individuais
        for (const [nome, dados] of Object.entries(consolidado)) {
            if (y > 260) {
                pdf.addPage();
                y = 20;
            }
            
            pdf.setFontSize(11);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(52, 73, 94);
            pdf.text(`${nome}`, 15, y);
            y += 7;
            
            pdf.setFontSize(9);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(80, 80, 80);
            
            // Mostrar todos os pesos individuais
            if (dados.pesos && dados.pesos.length > 0) {
                const pesosStr = dados.pesos.map(p => formatarPeso(p)).join(' + ');
                pdf.text(`Pesos: ${pesosStr} = ${formatarPeso(dados.pesoTotal)} kg`, 25, y);
            } else {
                pdf.text(`Peso Total: ${formatarPeso(dados.pesoTotal)} kg`, 25, y);
            }
            y += 7;
            
            somaTotalGeral += dados.pesoTotal;
            
            if (y > 260) {
                pdf.addPage();
                y = 20;
            }
        }
        
        y += 5;
        
        // Linha separadora
        pdf.setDrawColor(200, 200, 200);
        pdf.line(15, y, 195, y);
        y += 10;
        
        // Resumo
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(44, 62, 80);
        pdf.text('RESUMO', 15, y);
        y += 8;
        
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Peso Bruto (Balança): ${formatarPeso(fechamento.pesoBruto || 0)} kg`, 15, y);
        y += 7;
        pdf.text(`Soma Total dos Materiais: ${formatarPeso(somaTotalGeral)} kg`, 15, y);
        y += 7;
        
        const diferenca = somaTotalGeral - (fechamento.pesoBruto || 0);
        const diferencaPercentual = (fechamento.pesoBruto || 0) > 0 ? (Math.abs(diferenca) / fechamento.pesoBruto) * 100 : 0;
        
        pdf.text(`Diferença: ${diferenca >= 0 ? '+' : ''}${formatarPeso(Math.abs(diferenca))} kg (${diferencaPercentual.toFixed(1)}%)`, 15, y);
        y += 10;
        
        if ((fechamento.pesoBruto || 0) > 0) {
            if (diferencaPercentual <= 5) {
                pdf.setTextColor(40, 167, 69);
                pdf.text('✓ COMPATÍVEL: Dentro da tolerância de 5%', 15, y);
            } else {
                pdf.setTextColor(220, 53, 69);
                pdf.text('✗ INCOMPATÍVEL: Variação superior a 5%', 15, y);
            }
        }
        
        // Rodapé
        pdf.setTextColor(150, 150, 150);
        pdf.setFontSize(8);
        pdf.text(`Documento gerado em ${new Date().toLocaleString('pt-BR')}`, 15, 280);
        pdf.text('Sistema Mil Plásticos - Controle de Produção', 15, 287);
        
        const pdfBase64 = pdf.output('datauristring');
        
        // Salvar PDF no Firebase e marcar como concluído
        await updateDoc(fechamentoRef, { 
            pdfGerado: pdfBase64, 
            concluido: true, 
            status: 'concluido',
            dataConclusao: new Date().toISOString()
        });
        
        // Abrir PDF
        window.open(pdfBase64);
        
        mostrarAlerta('PDF gerado e fechamento concluído!', 'sucesso');
        await carregarFechamentos();
        await atualizarEstatisticas();
        
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        mostrarAlerta('Erro ao gerar PDF: ' + error.message, 'erro');
    }
}

function visualizarPDF(id) {
    mostrarAlerta('Funcionalidade em desenvolvimento', 'info');
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================
function formatarPeso(valor) {
    return (Math.round(valor * 100) / 100).toFixed(2);
}

function mostrarAlerta(mensagem, tipo = 'erro') {
    const alerta = document.getElementById('alertaFlutuante');
    const mensagemSpan = document.getElementById('mensagemAlerta');
    if (!alerta || !mensagemSpan) return;
    
    mensagemSpan.textContent = mensagem;
    alerta.className = 'alerta-flutuante show';
    alerta.classList.add(tipo);
    
    setTimeout(() => alerta.classList.remove('show'), 4000);
}

async function atualizarEstatisticas() {
    try {
        const q = query(collection(window.db, "fechamentos"));
        const querySnapshot = await getDocs(q);
        
        let totalFechamentos = 0;
        let totalFolhas = 0;
        let totalPeso = 0;
        let fechamentosAbertos = 0;
        
        querySnapshot.forEach((doc) => {
            const fechamento = doc.data();
            totalFechamentos++;
            
            if (!fechamento.finalizado && !fechamento.concluido) fechamentosAbertos++;
            
            const folhas = fechamento.folhas || [];
            totalFolhas += folhas.length;
            
            folhas.forEach(folha => {
                folha.materiais?.forEach(mat => totalPeso += mat.pesoTotal || 0);
            });
        });
        
        document.getElementById('totalFechamentos').textContent = totalFechamentos;
        document.getElementById('totalFolhas').textContent = totalFolhas;
        document.getElementById('totalPeso').textContent = formatarPeso(totalPeso) + ' kg';
        document.getElementById('fechamentosAbertos').textContent = fechamentosAbertos;
        document.getElementById('totalRegistros').textContent = `${totalFechamentos} registros`;
        
    } catch (error) {
        console.error('Erro ao atualizar estatísticas:', error);
    }
}

async function excluirFechamento(id) {
    if (!confirm('Excluir este fechamento e todas as folhas?')) return;
    
    try {
        await deleteDoc(doc(window.db, "fechamentos", id));
        mostrarAlerta('Fechamento excluído!', 'sucesso');
        await carregarFechamentos();
        await atualizarEstatisticas();
    } catch (error) {
        mostrarAlerta('Erro ao excluir fechamento', 'erro');
    }
}

function editarFechamento(id) {
    mostrarAlerta('Funcionalidade em desenvolvimento', 'info');
}

function aplicarFiltros() {
    carregarFechamentos();
}

function limparFiltros() {
    document.getElementById('filtroFornecedor').value = '';
    document.getElementById('filtroStatus').value = '';
    document.getElementById('filtroPeriodo').value = '30';
    carregarFechamentos();
}

function filtrarFechamentos() {
    // Implementar filtro de busca
}

// ============================================
// INICIAR SISTEMA
// ============================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(inicializarSistema, 100));
} else {
    setTimeout(inicializarSistema, 100);
}

window.addEventListener('firebaseReady', inicializarSistema);
