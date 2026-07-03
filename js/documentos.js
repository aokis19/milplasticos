// =============================================
// DOCUMENTOS.JS - Sistema de Documentos e Licenças
// Com sistema de alertas automáticos
// =============================================

// ========== CONFIGURAÇÃO ==========
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
            console.log('✅ Firebase já disponível para Documentos');
            resolve();
            return;
        }
        
        let tentativas = 0;
        const maxTentativas = 50;
        
        const verificar = setInterval(() => {
            tentativas++;
            
            if (window.firebaseDB) {
                clearInterval(verificar);
                console.log('✅ Firebase conectado após', tentativas * 100, 'ms');
                resolve();
                return;
            }
            
            if (tentativas >= maxTentativas) {
                clearInterval(verificar);
                console.warn('⚠️ Firebase não disponível - usando localStorage');
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
    
    // Verificar alertas a cada 1 hora
    setInterval(verificarAlertasAutomaticos, 3600000);
    
    console.log('✅ Sistema de Documentos inicializado!');
    console.log('   📄 ' + documentos.length + ' documentos carregados');
    console.log('   🏢 ' + empresas.length + ' empresas carregadas');
});

// ========== CARREGAR DADOS ==========
async function carregarDados() {
    await carregarEmpresas();
    await carregarDocumentos();
    await carregarAlertasGlobais();
    renderizarTudo();
}

async function carregarEmpresas() {
    try {
        if (db) {
            const snapshot = await db.collection('empresas').get();
            empresas = [];
            snapshot.forEach(doc => {
                empresas.push({ id: doc.id, ...doc.data() });
            });
            if (empresas.length > 0) {
                localStorage.setItem('empresas_docs', JSON.stringify(empresas));
                return;
            }
        }
        
        const salvo = localStorage.getItem('empresas_docs');
        if (salvo) {
            empresas = JSON.parse(salvo);
        } else {
            // Empresas padrão
            empresas = [
                { id: 1, nome: 'Mil Plásticos', descricao: 'Matriz' },
                { id: 2, nome: 'Transportadora XYZ', descricao: 'Transporte de cargas' }
            ];
            localStorage.setItem('empresas_docs', JSON.stringify(empresas));
        }
    } catch (error) {
        console.error('Erro ao carregar empresas:', error);
        empresas = [];
    }
}

async function carregarDocumentos() {
    try {
        if (db) {
            const snapshot = await db.collection('documentos').get();
            documentos = [];
            snapshot.forEach(doc => {
                documentos.push({ id: doc.id, ...doc.data() });
            });
            localStorage.setItem('documentos', JSON.stringify(documentos));
            return;
        }
        
        const salvo = localStorage.getItem('documentos');
        documentos = salvo ? JSON.parse(salvo) : [];
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
        
        const salvo = localStorage.getItem('alertas_globais');
        if (salvo) {
            alertasGlobalConfig = { ...alertasGlobalConfig, ...JSON.parse(salvo) };
        }
    } catch (error) {
        console.error('Erro ao carregar alertas globais:', error);
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
    localStorage.setItem('empresas_docs', JSON.stringify(empresas));
    if (db) {
        try {
            for (const emp of empresas) {
                const { id, ...dados } = emp;
                await db.collection('empresas').doc(id.toString()).set(dados, { merge: true });
            }
        } catch (error) {
            console.error('Erro ao salvar empresas no Firebase:', error);
        }
    }
}

async function salvarAlertasGlobais() {
    const emails = document.getElementById('alertasEmails').value;
    const whatsapps = document.getElementById('alertasWhatsapps').value;
    
    alertasGlobalConfig = {
        ...alertasGlobalConfig,
        emails: emails,
        whatsapps: whatsapps
    };
    
    localStorage.setItem('alertas_globais', JSON.stringify(alertasGlobalConfig));
    
    if (db) {
        try {
            await db.collection('configuracoes').doc('alertas_globais').set(alertasGlobalConfig, { merge: true });
        } catch (error) {
            console.error('Erro ao salvar alertas globais:', error);
        }
    }
    
    mostrarNotificacao('Configurações de alerta salvas com sucesso!', 'success');
    fecharModalAlertas();
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
    if (diasRestantes === null) return { status: 'normal', classe: '', texto: 'Sem data' };
    if (diasRestantes < 0) return { status: 'vencido', classe: 'vencido', texto: 'VENCIDO', icone: '🔴' };
    if (diasRestantes <= alertasGlobalConfig.diasVermelho) return { status: 'urgente', classe: 'urgente', texto: 'URGENTE', icone: '🔴' };
    if (diasRestantes <= alertasGlobalConfig.diasAmarelo) return { status: 'atencao', classe: 'atencao', texto: 'ATENÇÃO', icone: '🟡' };
    if (diasRestantes <= alertasGlobalConfig.diasVerde) return { status: 'ok', classe: '', texto: 'OK', icone: '🟢' };
    return { status: 'normal', classe: '', texto: 'Em dia', icone: '✅' };
}

function formatarDias(dias) {
    if (dias === null) return 'Sem data de validade';
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
    
    if (empresas.length === 0 && documentos.length === 0) {
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
                    <button class="btn-icon" onclick="editarEmpresa('${empresa.id}')" title="Editar empresa">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete" onclick="excluirEmpresa('${empresa.id}')" title="Excluir empresa">
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
            html += '<p style="color: #999; padding: 10px 0;">Nenhum documento cadastrado para esta empresa.</p>';
        }
    });
    
    // Documentos sem empresa
    const docsSemEmpresa = docsPorEmpresa['sem_empresa'] || [];
    if (docsSemEmpresa.length > 0) {
        html += `
            <div class="empresas-header">
                <h2>
                    <i class="fas fa-question-circle"></i>
                    Sem Empresa Definida
                    <span class="empresa-badge">${docsSemEmpresa.length} documento(s)</span>
                </h2>
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
                      diasRestantes <= alertasGlobalConfig.diasVermelho ? 'negativo' :
                      diasRestantes <= alertasGlobalConfig.diasAmarelo ? 'alerta' : 'positivo';
    
    return `
        <div class="documento-card ${status.classe}">
            <div class="documento-header">
                <span class="documento-categoria ${doc.categoria || 'licenca'}">
                    ${getCategoriaNome(doc.categoria)}
                </span>
                <span class="status-badge ${getStatusClasse(doc.status)}">
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
                        <span class="documento-dias ${diasClass}">
                            ${formatarDias(diasRestantes)}
                        </span>
                    ` : '<span class="documento-dias">Sem data</span>'}
                </div>
                
                ${doc.responsavel || doc.contato ? `
                    <div class="documento-contatos">
                        ${doc.responsavel ? `<span><i class="fas fa-user"></i> ${escapeHtml(doc.responsavel)}</span>` : ''}
                        ${doc.contato ? `<span style="margin-left: 10px;"><i class="fas fa-phone"></i> ${escapeHtml(doc.contato)}</span>` : ''}
                    </div>
                ` : ''}
                
                <div class="documento-actions">
                    <button class="btn-icon" onclick="verDetalhesDocumento('${doc.id}')" title="Ver detalhes">
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

function getCategoriaNome(categoria) {
    const nomes = {
        'licenca': 'Licença',
        'alvara': 'Alvará',
        'certificado': 'Certificado',
        'seguro': 'Seguro',
        'veiculo': 'Doc. Veicular',
        'outros': 'Outros'
    };
    return nomes[categoria] || 'Documento';
}

function getStatusClasse(status) {
    const classes = {
        'ativo': 'status-ativo',
        'pendente': 'status-pendente',
        'arquivado': 'status-arquivado'
    };
    return classes[status] || 'status-ativo';
}

// ========== ATUALIZAR SELECTS ==========
function atualizarSelectEmpresas() {
    const select = document.getElementById('docOrigem');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione a empresa...</option>';
    empresas.forEach(empresa => {
        select.innerHTML += `<option value="${empresa.id}">${escapeHtml(empresa.nome)}</option>`;
    });
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
        
        // Alertas individuais
        document.getElementById('alertaVerde').value = doc.alertas?.diasVerde || '';
        document.getElementById('alertaAmarelo').value = doc.alertas?.diasAmarelo || '';
        document.getElementById('alertaVermelho').value = doc.alertas?.diasVermelho || '';
        
        document.getElementById('notificarEmail').checked = doc.notificarEmail || false;
        document.getElementById('emailNotificacao').value = doc.emailNotificacao || '';
        document.getElementById('notificarWhatsapp').checked = doc.notificarWhatsapp || false;
        document.getElementById('whatsappNotificacao').value = doc.whatsappNotificacao || '';
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
    editingDocId = null;
}

function abrirModalEmpresa(empresa = null) {
    const modal = document.getElementById('modalEmpresa');
    if (!modal) return;
    
    if (empresa) {
        editingEmpresaId = empresa.id;
        document.getElementById('empresaNome').value = empresa.nome || '';
        document.getElementById('empresaDescricao').value = empresa.descricao || '';
    } else {
        editingEmpresaId = null;
        document.getElementById('formEmpresa').reset();
    }
    
    modal.style.display = 'block';
}

function fecharModalEmpresa() {
    const modal = document.getElementById('modalEmpresa');
    if (modal) modal.style.display = 'none';
    editingEmpresaId = null;
}

function abrirModalAlertas() {
    const modal = document.getElementById('modalAlertasGlobais');
    if (!modal) return;
    
    document.getElementById('alertasEmails').value = alertasGlobalConfig.emails || '';
    document.getElementById('alertasWhatsapps').value = alertasGlobalConfig.whatsapps || '';
    
    modal.style.display = 'block';
}

function fecharModalAlertas() {
    const modal = document.getElementById('modalAlertasGlobais');
    if (modal) modal.style.display = 'none';
}

function fecharModalDetalhes() {
    const modal = document.getElementById('modalDetalhes');
    if (modal) modal.style.display = 'none';
}

// Fechar modais ao clicar fora
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
};

// ========== CRUD DOCUMENTOS ==========
async function salvarDocumento(event) {
    event.preventDefault();
    
    const origem = document.getElementById('docOrigem').value;
    const categoria = document.getElementById('docCategoria').value;
    const nome = document.getElementById('docNome').value;
    const descricao = document.getElementById('docDescricao').value;
    const dataEmissao = document.getElementById('docDataEmissao').value;
    const dataValidade = document.getElementById('docDataValidade').value;
    const responsavel = document.getElementById('docResponsavel').value;
    const contato = document.getElementById('docContato').value;
    
    if (!nome || !dataValidade) {
        mostrarNotificacao('Preencha os campos obrigatórios!', 'error');
        return;
    }
    
    const documento = {
        id: editingDocId || gerarId(),
        origem: origem,
        categoria: categoria,
        nome: nome,
        descricao: descricao,
        dataEmissao: dataEmissao,
        dataValidade: dataValidade,
        responsavel: responsavel,
        contato: contato,
        status: 'ativo',
        alertas: {
            diasVerde: parseInt(document.getElementById('alertaVerde').value) || alertasGlobalConfig.diasVerde,
            diasAmarelo: parseInt(document.getElementById('alertaAmarelo').value) || alertasGlobalConfig.diasAmarelo,
            diasVermelho: parseInt(document.getElementById('alertaVermelho').value) || alertasGlobalConfig.diasVermelho
        },
        notificarEmail: document.getElementById('notificarEmail').checked,
        emailNotificacao: document.getElementById('emailNotificacao').value,
        notificarWhatsapp: document.getElementById('notificarWhatsapp').checked,
        whatsappNotificacao: document.getElementById('whatsappNotificacao').value,
        dataAtualizacao: new Date().toISOString()
    };
    
    if (editingDocId) {
        const index = documentos.findIndex(d => d.id === editingDocId);
        if (index !== -1) {
            documentos[index] = documento;
        }
    } else {
        documentos.push(documento);
    }
    
    await salvarDocumentos();
    renderizarTudo();
    fecharModalDocumento();
    mostrarNotificacao(editingDocId ? 'Documento atualizado!' : 'Documento registrado!', 'success');
    editingDocId = null;
}

function editarDocumento(id) {
    const doc = documentos.find(d => d.id === id);
    if (doc) {
        abrirModalDocumento(doc);
    }
}

async function excluirDocumento(id) {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return;
    
    documentos = documentos.filter(d => d.id !== id);
    await salvarDocumentos();
    renderizarTudo();
    mostrarNotificacao('Documento excluído!', 'success');
}

function verDetalhesDocumento(id) {
    const doc = documentos.find(d => d.id === id);
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
                <strong>Nome do Documento</strong>
                <span style="font-size: 18px; font-weight: bold;">${escapeHtml(doc.nome)}</span>
            </div>
            <div class="detail-item">
                <strong>Categoria</strong>
                <span>${getCategoriaNome(doc.categoria)}</span>
            </div>
            <div class="detail-item">
                <strong>Status</strong>
                <span>${status.icone} ${status.texto}</span>
            </div>
            <div class="detail-item">
                <strong>Empresa</strong>
                <span>${empresa ? escapeHtml(empresa.nome) : 'Não definida'}</span>
            </div>
            <div class="detail-item">
                <strong>Data de Emissão</strong>
                <span>${formatarData(doc.dataEmissao)}</span>
            </div>
            <div class="detail-item">
                <strong>Data de Validade</strong>
                <span>${formatarData(doc.dataValidade)}</span>
            </div>
            <div class="detail-item">
                <strong>Dias Restantes</strong>
                <span>${diasRestantes !== null ? formatarDias(diasRestantes) : 'N/A'}</span>
            </div>
            ${doc.responsavel ? `
                <div class="detail-item">
                    <strong>Responsável</strong>
                    <span>${escapeHtml(doc.responsavel)}</span>
                </div>
            ` : ''}
            ${doc.contato ? `
                <div class="detail-item">
                    <strong>Contato</strong>
                    <span>${escapeHtml(doc.contato)}</span>
                </div>
            ` : ''}
            ${doc.descricao ? `
                <div class="detail-item full-width">
                    <strong>Descrição</strong>
                    <span>${escapeHtml(doc.descricao)}</span>
                </div>
            ` : ''}
        </div>
        <div class="form-footer" style="margin-top: 20px;">
            <button class="btn btn-primary" onclick="editarDocumento('${doc.id}'); fecharModalDetalhes();">
                <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn btn-danger" onclick="excluirDocumento('${doc.id}'); fecharModalDetalhes();">
                <i class="fas fa-trash"></i> Excluir
            </button>
            <button class="btn btn-secondary" onclick="fecharModalDetalhes();">
                <i class="fas fa-times"></i> Fechar
            </button>
        </div>
    `;
    
    modal.style.display = 'block';
}

// ========== CRUD EMPRESAS ==========
async function salvarEmpresa(event) {
    event.preventDefault();
    
    const nome = document.getElementById('empresaNome').value;
    const descricao = document.getElementById('empresaDescricao').value;
    
    if (!nome) {
        mostrarNotificacao('Informe o nome da empresa!', 'error');
        return;
    }
    
    if (editingEmpresaId) {
        const index = empresas.findIndex(e => e.id === editingEmpresaId);
        if (index !== -1) {
            empresas[index].nome = nome;
            empresas[index].descricao = descricao;
        }
    } else {
        empresas.push({
            id: gerarId(),
            nome: nome,
            descricao: descricao
        });
    }
    
    await salvarEmpresas();
    renderizarTudo();
    fecharModalEmpresa();
    mostrarNotificacao(editingEmpresaId ? 'Empresa atualizada!' : 'Empresa cadastrada!', 'success');
    editingEmpresaId = null;
}

function editarEmpresa(id) {
    const empresa = empresas.find(e => e.id === id);
    if (empresa) {
        abrirModalEmpresa(empresa);
    }
}

async function excluirEmpresa(id) {
    if (!confirm('Tem certeza que deseja excluir esta empresa? Os documentos vinculados não serão excluídos.')) return;
    
    empresas = empresas.filter(e => e.id !== id);
    await salvarEmpresas();
    renderizarTudo();
    mostrarNotificacao('Empresa excluída!', 'success');
}

// ========== SISTEMA DE ALERTAS ==========
function verificarAlertasAutomaticos() {
    console.log('🔔 Verificando alertas de documentos...');
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    let alertasEncontrados = [];
    
    documentos.forEach(doc => {
        if (!doc.dataValidade) return;
        
        const diasRestantes = calcularDiasRestantes(doc.dataValidade);
        if (diasRestantes === null) return;
        
        const alertasDoc = doc.alertas || {};
        const diasVermelho = alertasDoc.diasVermelho || alertasGlobalConfig.diasVermelho || 30;
        const diasAmarelo = alertasDoc.diasAmarelo || alertasGlobalConfig.diasAmarelo || 60;
        const diasVerde = alertasDoc.diasVerde || alertasGlobalConfig.diasVerde || 90;
        
        let nivelAlerta = null;
        
        if (diasRestantes < 0) {
            nivelAlerta = 'vencido';
        } else if (diasRestantes <= diasVermelho) {
            nivelAlerta = 'vermelho';
        } else if (diasRestantes <= diasAmarelo) {
            nivelAlerta = 'amarelo';
        } else if (diasRestantes <= diasVerde) {
            nivelAlerta = 'verde';
        }
        
        if (nivelAlerta) {
            alertasEncontrados.push({
                documento: doc,
                diasRestantes: diasRestantes,
                nivel: nivelAlerta
            });
        }
    });
    
    if (alertasEncontrados.length > 0) {
        console.log(`⚠️ ${alertasEncontrados.length} documento(s) precisam de atenção!`);
        dispararNotificacoesAlertas(alertasEncontrados);
        mostrarNotificacaoAlerta(alertasEncontrados);
    } else {
        console.log('✅ Todos os documentos estão em dia!');
    }
    
    return alertasEncontrados;
}

function dispararNotificacoesAlertas(alertas) {
    // Verificar se temos configurações de notificação
    if (!alertasGlobalConfig.emails && !alertasGlobalConfig.whatsapps) {
        console.log('ℹ️ Nenhum contato configurado para alertas globais.');
    }
    
    alertas.forEach(alerta => {
        const doc = alerta.documento;
        const empresa = empresas.find(e => e.id == doc.origem);
        
        // Verificar notificações individuais do documento
        if (doc.notificarEmail && doc.emailNotificacao) {
            enviarEmailAlerta(doc.emailNotificacao, doc, alerta, empresa);
        } else if (alertasGlobalConfig.emails) {
            // Usar emails globais
            const emails = alertasGlobalConfig.emails.split(',').map(e => e.trim());
            emails.forEach(email => {
                if (email) enviarEmailAlerta(email, doc, alerta, empresa);
            });
        }
        
        if (doc.notificarWhatsapp && doc.whatsappNotificacao) {
            enviarWhatsappAlerta(doc.whatsappNotificacao, doc, alerta, empresa);
        } else if (alertasGlobalConfig.whatsapps) {
            // Usar whatsapps globais
            const whatsapps = alertasGlobalConfig.whatsapps.split(',').map(w => w.trim());
            whatsapps.forEach(whatsapp => {
                if (whatsapp) enviarWhatsappAlerta(whatsapp, doc, alerta, empresa);
            });
        }
    });
}

function enviarEmailAlerta(email, doc, alerta, empresa) {
    const assunto = `🚨 Alerta de Documento: ${doc.nome} - ${alerta.nivel.toUpperCase()}`;
    const mensagem = `
        Documento: ${doc.nome}
        Empresa: ${empresa ? empresa.nome : 'Não definida'}
        Validade: ${formatarData(doc.dataValidade)}
        Status: ${formatarDias(alerta.diasRestantes)}
        Categoria: ${getCategoriaNome(doc.categoria)}
        
        ${alerta.diasRestantes < 0 ? 
            '⚠️ Este documento está VENCIDO! Tome as providências imediatamente.' : 
            `⚠️ Este documento vencerá em ${alerta.diasRestantes} dias.`
        }
        
        Sistema de Documentos - Mil Plásticos
    `;
    
    console.log(`📧 Simulando envio de email para: ${email}`);
    console.log(`   Assunto: ${assunto}`);
    console.log(`   Mensagem: ${mensagem}`);
    
    // Aqui você integraria com um serviço de email real (SendGrid, SMTP, etc.)
    // Por enquanto, vamos salvar no localStorage como registro
    registrarLogAlerta('email', email, doc, alerta);
}

function enviarWhatsappAlerta(whatsapp, doc, alerta, empresa) {
    const mensagem = `🚨 *Alerta de Documento - Mil Plásticos*%0A%0A` +
        `*Documento:* ${doc.nome}%0A` +
        `*Empresa:* ${empresa ? empresa.nome : 'Não definida'}%0A` +
        `*Validade:* ${formatarData(doc.dataValidade)}%0A` +
        `*Status:* ${formatarDias(alerta.diasRestantes)}%0A` +
        `${alerta.diasRestantes < 0 ? '⚠️ DOCUMENTO VENCIDO!' : `⚠️ Vence em ${alerta.diasRestantes} dias`}`;
    
    console.log(`📱 Simulando envio de WhatsApp para: ${whatsapp}`);
    console.log(`   Mensagem: ${decodeURIComponent(mensagem)}`);
    
    // Aqui você integraria com a API do WhatsApp Business
    registrarLogAlerta('whatsapp', whatsapp, doc, alerta);
}

function registrarLogAlerta(tipo, destinatario, doc, alerta) {
    const logs = JSON.parse(localStorage.getItem('logs_alertas') || '[]');
    logs.push({
        data: new Date().toISOString(),
        tipo: tipo,
        destinatario: destinatario,
        documento: doc.nome,
        documentoId: doc.id,
        nivel: alerta.nivel,
        diasRestantes: alerta.diasRestantes
    });
    
    // Manter apenas os últimos 100 logs
    if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
    }
    
    localStorage.setItem('logs_alertas', JSON.stringify(logs));
}

function mostrarNotificacaoAlerta(alertas) {
    const vencidos = alertas.filter(a => a.nivel === 'vencido').length;
    const urgentes = alertas.filter(a => a.nivel === 'vermelho').length;
    const atencao = alertas.filter(a => a.nivel === 'amarelo').length;
    
    let mensagem = '🔔 Documentos que precisam de atenção:\n';
    if (vencidos > 0) mensagem += `🔴 ${vencidos} vencido(s)\n`;
    if (urgentes > 0) mensagem += `🔴 ${urgentes} urgente(s)\n`;
    if (atencao > 0) mensagem += `🟡 ${atencao} em atenção\n`;
    
    // Notificação visual no sistema
    mostrarNotificacao(mensagem.replace(/\n/g, ' | '), 'warning', 8000);
    
    // Se houver documentos vencidos, mostrar alerta mais chamativo
    if (vencidos > 0) {
        console.warn('🚨 ATENÇÃO: Existem documentos VENCIDOS que precisam de ação imediata!');
    }
}

// ========== NOTIFICAÇÕES ==========
function mostrarNotificacao(msg, tipo = 'info', duracao = 3000) {
    let n = document.getElementById('notificacao');
    if (!n) {
        n = document.createElement('div');
        n.id = 'notificacao';
        document.body.appendChild(n);
    }
    
    const cores = {
        success: '#d4edda',
        error: '#f8d7da',
        info: '#d1ecf1',
        warning: '#fff3cd'
    };
    
    const coresTexto = {
        success: '#155724',
        error: '#721c24',
        info: '#0c5460',
        warning: '#856404'
    };
    
    n.style.backgroundColor = cores[tipo] || cores.info;
    n.style.color = coresTexto[tipo] || coresTexto.info;
    n.textContent = msg;
    n.style.display = 'block';
    n.style.opacity = '1';
    
    clearTimeout(n.timeout);
    n.timeout = setTimeout(() => {
        n.style.opacity = '0';
        setTimeout(() => {
            n.style.display = 'none';
            n.style.opacity = '1';
        }, 300);
    }, duracao);
}

// ========== INICIALIZAR EVENTOS ==========
function inicializarEventos() {
    // Formulário de Documento
    const formDocumento = document.getElementById('formDocumento');
    if (formDocumento) {
        formDocumento.addEventListener('submit', salvarDocumento);
    }
    
    // Formulário de Empresa
    const formEmpresa = document.getElementById('formEmpresa');
    if (formEmpresa) {
        formEmpresa.addEventListener('submit', salvarEmpresa);
    }
    
    // Botões principais
    document.getElementById('addDocumentoBtn')?.addEventListener('click', () => abrirModalDocumento());
    document.getElementById('addEmpresaBtn')?.addEventListener('click', () => abrirModalEmpresa());
    document.getElementById('configAlertasBtn')?.addEventListener('click', () => abrirModalAlertas());
    
    console.log('✅ Eventos inicializados!');
}
