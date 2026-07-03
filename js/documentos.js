// =============================================
// DOCUMENTOS.JS - Versão Corrigida
// Carrega dados das chaves corretas
// =============================================

const db = window.firebaseDB;

let documentos = [];
let empresas = [];
let editingDocId = null;
let editingEmpresaId = null;
let alertasGlobalConfig = {
    emails: "",
    whatsapps: "",
    diasVerde: 90,
    diasAmarelo: 60,
    diasVermelho: 30
};

// ========== AGUARDAR FIREBASE ==========
function aguardarFirebasePronto() {
    return new Promise((resolve) => {
        if (window.firebaseDB) {
            console.log('✅ Firebase disponível');
            resolve();
            return;
        }
        let tentativas = 0;
        const verificar = setInterval(() => {
            tentativas++;
            if (window.firebaseDB) {
                clearInterval(verificar);
                console.log('✅ Firebase conectado');
                resolve();
            }
            if (tentativas >= 50) {
                clearInterval(verificar);
                console.warn('⚠️ Firebase não disponível');
                resolve();
            }
        }, 100);
    });
}

// ========== INICIALIZAÇÃO ==========
document.addEventListener('DOMContentLoaded', async () => {
    await aguardarFirebasePronto();
    await carregarDados();
    inicializarEventos();
    verificarAlertasAutomaticos();
    setInterval(verificarAlertasAutomaticos, 3600000);
    console.log('✅ Sistema de Documentos pronto!');
    console.log('   📄 ' + documentos.length + ' documentos');
    console.log('   🏢 ' + empresas.length + ' empresas');
});

// ========== CARREGAR DADOS (CORRIGIDO) ==========
async function carregarDados() {
    await carregarEmpresas();
    await carregarDocumentos();
    await carregarAlertasGlobais();
    renderizarTudo();
}

async function carregarEmpresas() {
    try {
        // 1. Tentar Firebase
        if (db) {
            const snapshot = await db.collection('empresas').get();
            if (!snapshot.empty) {
                empresas = [];
                snapshot.forEach(doc => {
                    empresas.push({ id: doc.id, ...doc.data() });
                });
                localStorage.setItem('empresas', JSON.stringify(empresas));
                console.log('✅ Empresas carregadas do Firebase:', empresas.length);
                return;
            }
        }
        
        // 2. Tentar localStorage - chave "empresas" (DADOS ORIGINAIS)
        const empresasSalvas = localStorage.getItem('empresas');
        if (empresasSalvas) {
            empresas = JSON.parse(empresasSalvas);
            console.log('✅ Empresas carregadas do localStorage (empresas):', empresas.length);
            return;
        }
        
        // 3. Tentar localStorage - chave "empresas_docs" (nova chave)
        const empresasDocsSalvas = localStorage.getItem('empresas_docs');
        if (empresasDocsSalvas) {
            empresas = JSON.parse(empresasDocsSalvas);
            console.log('✅ Empresas carregadas do localStorage (empresas_docs):', empresas.length);
            return;
        }
        
        // 4. Dados padrão
        empresas = [
            { id: '1', nome: 'Mil Plásticos', descricao: 'Matriz' },
            { id: '2', nome: 'Transportadora', descricao: 'Transportes' }
        ];
        localStorage.setItem('empresas', JSON.stringify(empresas));
        console.log('ℹ️ Empresas padrão criadas');
        
    } catch (error) {
        console.error('Erro ao carregar empresas:', error);
        empresas = [];
    }
}

async function carregarDocumentos() {
    try {
        // 1. Tentar Firebase
        if (db) {
            const snapshot = await db.collection('documentos').get();
            if (!snapshot.empty) {
                documentos = [];
                snapshot.forEach(doc => {
                    documentos.push({ id: doc.id, ...doc.data() });
                });
                localStorage.setItem('documentos', JSON.stringify(documentos));
                console.log('✅ Documentos carregados do Firebase:', documentos.length);
                return;
            }
        }
        
        // 2. Tentar localStorage (DADOS ORIGINAIS)
        const docsSalvos = localStorage.getItem('documentos');
        if (docsSalvos) {
            documentos = JSON.parse(docsSalvos);
            console.log('✅ Documentos carregados do localStorage:', documentos.length);
            return;
        }
        
        documentos = [];
        console.log('ℹ️ Nenhum documento encontrado');
        
    } catch (error) {
        console.error('Erro ao carregar documentos:', error);
        documentos = [];
    }
}

async function carregarAlertasGlobais() {
    try {
        if (db) {
            const doc = await db.collection('configuracoes').doc('alertas_globais').get();
            if (doc.exists) {
                alertasGlobalConfig = { ...alertasGlobalConfig, ...doc.data() };
                return;
            }
        }
        const salvo = localStorage.getItem('alertasGlobalConfig');
        if (salvo) {
            alertasGlobalConfig = { ...alertasGlobalConfig, ...JSON.parse(salvo) };
        }
    } catch (error) {
        console.error('Erro ao carregar alertas:', error);
    }
}

// ========== SALVAR DADOS ==========
async function salvarDocumentos() {
    localStorage.setItem('documentos', JSON.stringify(documentos));
    if (db) {
        try {
            for (const doc of documentos) {
                const { id, ...dados } = doc;
                await db.collection('documentos').doc(id.toString()).set(dados, { merge: true });
            }
        } catch (error) {
            console.error('Erro ao salvar no Firebase:', error);
        }
    }
}

async function salvarEmpresas() {
    // Salvar em AMBAS as chaves para compatibilidade
    localStorage.setItem('empresas', JSON.stringify(empresas));
    localStorage.setItem('empresas_docs', JSON.stringify(empresas));
    
    if (db) {
        try {
            for (const emp of empresas) {
                const { id, ...dados } = emp;
                await db.collection('empresas').doc(id.toString()).set(dados, { merge: true });
            }
        } catch (error) {
            console.error('Erro ao salvar empresas:', error);
        }
    }
}

// ========== UTILITÁRIOS ==========
function formatarData(dataStr) {
    if (!dataStr) return "";
    try {
        const d = new Date(dataStr + 'T00:00:00');
        return d.toLocaleDateString('pt-BR');
    } catch {
        return dataStr;
    }
}

function gerarId() {
    return Date.now().toString();
}

function calcularDiasRestantes(dataValidade) {
    if (!dataValidade) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const validade = new Date(dataValidade + 'T00:00:00');
    validade.setHours(0, 0, 0, 0);
    return Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
}

function getStatusDocumento(diasRestantes) {
    if (diasRestantes === null) return { status: 'normal', classe: '', texto: 'Sem data', icone: '⚪' };
    if (diasRestantes < 0) return { status: 'vencido', classe: 'vencido', texto: 'VENCIDO', icone: '🔴' };
    if (diasRestantes <= (alertasGlobalConfig.diasVermelho || 30)) return { status: 'urgente', classe: 'urgente', texto: 'URGENTE', icone: '🔴' };
    if (diasRestantes <= (alertasGlobalConfig.diasAmarelo || 60)) return { status: 'atencao', classe: 'atencao', texto: 'ATENÇÃO', icone: '🟡' };
    if (diasRestantes <= (alertasGlobalConfig.diasVerde || 90)) return { status: 'ok', classe: '', texto: 'OK', icone: '🟢' };
    return { status: 'normal', classe: '', texto: 'Em dia', icone: '✅' };
}

function formatarDias(dias) {
    if (dias === null) return 'Sem data';
    if (dias < 0) return `Vencido há ${Math.abs(dias)} dias`;
    if (dias === 0) return 'Vence hoje!';
    if (dias === 1) return 'Vence amanhã';
    return `Vence em ${dias} dias`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== RENDERIZAÇÃO ==========
function renderizarTudo() {
    const container = document.getElementById('empresasContainer');
    const emptyState = document.getElementById('emptyDocumentos');
    
    if (!container) return;
    
    if (documentos.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    
    let html = '';
    
    // Agrupar documentos por empresa
    const docsPorEmpresa = {};
    documentos.forEach(doc => {
        const empresaId = doc.origem || 'sem_empresa';
        if (!docsPorEmpresa[empresaId]) {
            docsPorEmpresa[empresaId] = [];
        }
        docsPorEmpresa[empresaId].push(doc);
    });
    
    // Renderizar empresas com seus documentos
    empresas.forEach(empresa => {
        const docs = docsPorEmpresa[empresa.id] || [];
        
        html += `
            <div class="empresas-header">
                <h2>
                    <i class="fas fa-building"></i>
                    ${escapeHtml(empresa.nome)}
                    <span class="empresa-badge">${docs.length} documento(s)</span>
                </h2>
                <div>
                    <button class="btn-icon" onclick="editarEmpresa('${empresa.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete" onclick="excluirEmpresa('${empresa.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        
        if (docs.length > 0) {
            html += '<div class="documentos-grid">';
            docs.forEach(doc => {
                html += renderizarCardDocumento(doc);
            });
            html += '</div>';
        } else {
            html += '<p style="color:#999;padding:10px 0;">Nenhum documento desta empresa.</p>';
        }
    });
    
    // Documentos sem empresa
    const docsSemEmpresa = docsPorEmpresa['sem_empresa'] || [];
    if (docsSemEmpresa.length > 0) {
        html += `
            <div class="empresas-header">
                <h2><i class="fas fa-question-circle"></i> Sem Empresa Definida
                <span class="empresa-badge">${docsSemEmpresa.length} doc(s)</span></h2>
            </div>
            <div class="documentos-grid">
                ${docsSemEmpresa.map(doc => renderizarCardDocumento(doc)).join('')}
            </div>
        `;
    }
    
    container.innerHTML = html;
    atualizarSelectEmpresas();
}

function renderizarCardDocumento(doc) {
    const diasRestantes = calcularDiasRestantes(doc.dataValidade);
    const status = getStatusDocumento(diasRestantes);
    const empresa = empresas.find(e => e.id == doc.origem);
    const diasClass = diasRestantes === null ? '' : 
                      diasRestantes < 0 ? 'negativo' : 
                      diasRestantes <= (alertasGlobalConfig.diasVermelho || 30) ? 'negativo' :
                      diasRestantes <= (alertasGlobalConfig.diasAmarelo || 60) ? 'alerta' : 'positivo';
    
    return `
        <div class="documento-card ${status.classe}">
            <div class="documento-header">
                <span class="documento-categoria ${doc.categoria || 'licenca'}">
                    ${getCategoriaNome(doc.categoria)}
                </span>
                <span class="status-badge status-${status.status === 'vencido' ? 'pendente' : 'ativo'}">
                    ${status.icone} ${status.texto}
                </span>
            </div>
            <div class="documento-body">
                <div class="documento-nome">${escapeHtml(doc.nome)}</div>
                ${empresa ? `<div class="documento-origem"><i class="fas fa-building"></i> ${escapeHtml(empresa.nome)}</div>` : ''}
                ${doc.descricao ? `<div class="documento-descricao">${escapeHtml(doc.descricao)}</div>` : ''}
                
                <div class="documento-info">
                    <div class="documento-validade">
                        <i class="fas fa-calendar-alt"></i>
                        <span>Validade: ${formatarData(doc.dataValidade)}</span>
                    </div>
                    ${diasRestantes !== null ? `
                        <span class="documento-dias ${diasClass}">${formatarDias(diasRestantes)}</span>
                    ` : '<span class="documento-dias">Sem data</span>'}
                </div>
                
                ${doc.responsavel || doc.contato ? `
                    <div class="documento-contatos">
                        ${doc.responsavel ? `<span><i class="fas fa-user"></i> ${escapeHtml(doc.responsavel)}</span>` : ''}
                        ${doc.contato ? `<span style="margin-left:10px;"><i class="fas fa-phone"></i> ${escapeHtml(doc.contato)}</span>` : ''}
                    </div>
                ` : ''}
                
                <div class="documento-actions">
                    <button class="btn-icon" onclick="verDetalhesDocumento('${doc.id}')" title="Detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="editarDocumento('${doc.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete" onclick="excluirDocumento('${doc.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function getCategoriaNome(cat) {
    const nomes = { licenca: 'Licença', alvara: 'Alvará', certificado: 'Certificado', seguro: 'Seguro', veiculo: 'Doc. Veicular', outros: 'Outros' };
    return nomes[cat] || 'Documento';
}

function atualizarSelectEmpresas() {
    const select = document.getElementById('docOrigem');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione a empresa...</option>';
    empresas.forEach(empresa => {
        select.innerHTML += `<option value="${empresa.id}">${escapeHtml(empresa.nome)}</option>`;
    });
}

// ========== CRUD DOCUMENTOS ==========
async function salvarDocumento(event) {
    event.preventDefault();
    
    const doc = {
        id: editingDocId || gerarId(),
        origem: document.getElementById('docOrigem').value,
        categoria: document.getElementById('docCategoria').value,
        nome: document.getElementById('docNome').value,
        descricao: document.getElementById('docDescricao').value,
        dataEmissao: document.getElementById('docDataEmissao').value,
        dataValidade: document.getElementById('docDataValidade').value,
        responsavel: document.getElementById('docResponsavel').value,
        contato: document.getElementById('docContato').value,
        status: 'ativo',
        dataAtualizacao: new Date().toISOString()
    };
    
    if (!doc.nome) {
        mostrarNotificacao('Informe o nome do documento!', 'error');
        return;
    }
    
    if (editingDocId) {
        const index = documentos.findIndex(d => d.id == editingDocId);
        if (index !== -1) documentos[index] = doc;
    } else {
        documentos.push(doc);
    }
    
    await salvarDocumentos();
    renderizarTudo();
    fecharModalDocumento();
    mostrarNotificacao(editingDocId ? 'Documento atualizado!' : 'Documento registrado!', 'success');
    editingDocId = null;
}

function editarDocumento(id) {
    const doc = documentos.find(d => d.id == id);
    if (doc) abrirModalDocumento(doc);
}

async function excluirDocumento(id) {
    if (!confirm('Excluir este documento?')) return;
    documentos = documentos.filter(d => d.id != id);
    await salvarDocumentos();
    renderizarTudo();
    mostrarNotificacao('Documento excluído!', 'success');
}

// ========== CRUD EMPRESAS ==========
async function salvarEmpresa(event) {
    event.preventDefault();
    
    const nome = document.getElementById('empresaNome').value;
    if (!nome) {
        mostrarNotificacao('Informe o nome da empresa!', 'error');
        return;
    }
    
    if (editingEmpresaId) {
        const index = empresas.findIndex(e => e.id == editingEmpresaId);
        if (index !== -1) {
            empresas[index].nome = nome;
            empresas[index].descricao = document.getElementById('empresaDescricao').value;
        }
    } else {
        empresas.push({
            id: gerarId(),
            nome: nome,
            descricao: document.getElementById('empresaDescricao').value
        });
    }
    
    await salvarEmpresas();
    renderizarTudo();
    fecharModalEmpresa();
    mostrarNotificacao(editingEmpresaId ? 'Empresa atualizada!' : 'Empresa cadastrada!', 'success');
    editingEmpresaId = null;
}

function editarEmpresa(id) {
    const emp = empresas.find(e => e.id == id);
    if (emp) abrirModalEmpresa(emp);
}

async function excluirEmpresa(id) {
    if (!confirm('Excluir esta empresa? Os documentos não serão excluídos.')) return;
    empresas = empresas.filter(e => e.id != id);
    await salvarEmpresas();
    renderizarTudo();
    mostrarNotificacao('Empresa excluída!', 'success');
}

// ========== MODAIS ==========
function abrirModalDocumento(doc = null) {
    const modal = document.getElementById('modalDocumento');
    if (!modal) return;
    
    if (doc) {
        editingDocId = doc.id;
        document.getElementById('modalDocumentoTitulo').innerHTML = '<i class="fas fa-edit"></i> Editar Documento';
        document.getElementById('docOrigem').value = doc.origem || '';
        document.getElementById('docCategoria').value = doc.categoria || '';
        document.getElementById('docNome').value = doc.nome || '';
        document.getElementById('docDescricao').value = doc.descricao || '';
        document.getElementById('docDataEmissao').value = doc.dataEmissao || '';
        document.getElementById('docDataValidade').value = doc.dataValidade || '';
        document.getElementById('docResponsavel').value = doc.responsavel || '';
        document.getElementById('docContato').value = doc.contato || '';
    } else {
        editingDocId = null;
        document.getElementById('modalDocumentoTitulo').innerHTML = '<i class="fas fa-plus-circle"></i> Registrar Documento';
        document.getElementById('formDocumento').reset();
    }
    
    modal.style.display = 'block';
}

function fecharModalDocumento() {
    const modal = document.getElementById('modalDocumento');
    if (modal) modal.style.display = 'none';
}

function abrirModalEmpresa(emp = null) {
    const modal = document.getElementById('modalEmpresa');
    if (!modal) return;
    
    if (emp) {
        editingEmpresaId = emp.id;
        document.getElementById('empresaNome').value = emp.nome || '';
        document.getElementById('empresaDescricao').value = emp.descricao || '';
    } else {
        editingEmpresaId = null;
        document.getElementById('formEmpresa').reset();
    }
    
    modal.style.display = 'block';
}

function fecharModalEmpresa() {
    const modal = document.getElementById('modalEmpresa');
    if (modal) modal.style.display = 'none';
}

function verDetalhesDocumento(id) {
    const doc = documentos.find(d => d.id == id);
    if (!doc) return;
    
    const modal = document.getElementById('modalDetalhes');
    const body = document.getElementById('modalDetalhesBody');
    if (!modal || !body) return;
    
    const empresa = empresas.find(e => e.id == doc.origem);
    const diasRestantes = calcularDiasRestantes(doc.dataValidade);
    const status = getStatusDocumento(diasRestantes);
    
    body.innerHTML = `
        <div class="details-container">
            <div class="detail-item full-width">
                <strong>Nome</strong>
                <span style="font-size:18px;font-weight:bold;">${escapeHtml(doc.nome)}</span>
            </div>
            <div class="detail-item"><strong>Categoria</strong><span>${getCategoriaNome(doc.categoria)}</span></div>
            <div class="detail-item"><strong>Status</strong><span>${status.icone} ${status.texto}</span></div>
            <div class="detail-item"><strong>Empresa</strong><span>${empresa ? escapeHtml(empresa.nome) : 'Não definida'}</span></div>
            <div class="detail-item"><strong>Emissão</strong><span>${formatarData(doc.dataEmissao)}</span></div>
            <div class="detail-item"><strong>Validade</strong><span>${formatarData(doc.dataValidade)}</span></div>
            ${diasRestantes !== null ? `<div class="detail-item"><strong>Dias</strong><span>${formatarDias(diasRestantes)}</span></div>` : ''}
            ${doc.responsavel ? `<div class="detail-item"><strong>Responsável</strong><span>${escapeHtml(doc.responsavel)}</span></div>` : ''}
            ${doc.contato ? `<div class="detail-item"><strong>Contato</strong><span>${escapeHtml(doc.contato)}</span></div>` : ''}
            ${doc.descricao ? `<div class="detail-item full-width"><strong>Descrição</strong><span>${escapeHtml(doc.descricao)}</span></div>` : ''}
        </div>
        <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end;">
            <button class="btn btn-primary" onclick="editarDocumento('${doc.id}');document.getElementById('modalDetalhes').style.display='none';">
                <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn btn-danger" onclick="excluirDocumento('${doc.id}');document.getElementById('modalDetalhes').style.display='none';">
                <i class="fas fa-trash"></i> Excluir
            </button>
            <button class="btn btn-secondary" onclick="document.getElementById('modalDetalhes').style.display='none';">
                <i class="fas fa-times"></i> Fechar
            </button>
        </div>
    `;
    
    modal.style.display = 'block';
}

// ========== ALERTAS ==========
function verificarAlertasAutomaticos() {
    console.log('🔔 Verificando alertas...');
    let alertasEncontrados = [];
    
    documentos.forEach(doc => {
        if (!doc.dataValidade) return;
        const diasRestantes = calcularDiasRestantes(doc.dataValidade);
        if (diasRestantes === null) return;
        
        let nivel = null;
        if (diasRestantes < 0) nivel = 'vencido';
        else if (diasRestantes <= (alertasGlobalConfig.diasVermelho || 30)) nivel = 'vermelho';
        else if (diasRestantes <= (alertasGlobalConfig.diasAmarelo || 60)) nivel = 'amarelo';
        
        if (nivel) {
            alertasEncontrados.push({ documento: doc, diasRestantes, nivel });
        }
    });
    
    if (alertasEncontrados.length > 0) {
        console.warn(`⚠️ ${alertasEncontrados.length} documento(s) precisam de atenção!`);
    }
    
    return alertasEncontrados;
}

// ========== NOTIFICAÇÕES ==========
function mostrarNotificacao(msg, tipo = 'info', duracao = 3000) {
    let n = document.getElementById('notificacao');
    if (!n) {
        n = document.createElement('div');
        n.id = 'notificacao';
        n.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px 25px;border-radius:8px;z-index:2000;box-shadow:0 4px 15px rgba(0,0,0,0.15);transition:opacity 0.3s;font-weight:500;font-size:14px;max-width:400px;';
        document.body.appendChild(n);
    }
    
    const cores = { success: '#d4edda', error: '#f8d7da', info: '#d1ecf1', warning: '#fff3cd' };
    const coresTexto = { success: '#155724', error: '#721c24', info: '#0c5460', warning: '#856404' };
    
    n.style.backgroundColor = cores[tipo] || cores.info;
    n.style.color = coresTexto[tipo] || coresTexto.info;
    n.textContent = msg;
    n.style.display = 'block';
    n.style.opacity = '1';
    
    clearTimeout(n.timeout);
    n.timeout = setTimeout(() => {
        n.style.opacity = '0';
        setTimeout(() => { n.style.display = 'none'; }, 300);
    }, duracao);
}

// ========== EVENTOS ==========
function inicializarEventos() {
    document.getElementById('formDocumento')?.addEventListener('submit', salvarDocumento);
    document.getElementById('formEmpresa')?.addEventListener('submit', salvarEmpresa);
    document.getElementById('addDocumentoBtn')?.addEventListener('click', () => abrirModalDocumento());
    document.getElementById('addEmpresaBtn')?.addEventListener('click', () => abrirModalEmpresa());
    document.getElementById('configAlertasBtn')?.addEventListener('click', () => {
        // Função para configurar alertas (implementar se necessário)
        mostrarNotificacao('Configuração de alertas em desenvolvimento', 'info');
    });
    
    // Fechar modais ao clicar fora
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };
    
    console.log('✅ Eventos inicializados');
}

// Tornar funções globais
window.editarDocumento = editarDocumento;
window.excluirDocumento = excluirDocumento;
window.verDetalhesDocumento = verDetalhesDocumento;
window.editarEmpresa = editarEmpresa;
window.excluirEmpresa = excluirEmpresa;
