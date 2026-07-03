// =============================================
// DOCUMENTOS.JS - Sistema Completo
// Com visualização e download de PDFs
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
    verificarAlertas();
    
    console.log('✅ Sistema de Documentos pronto!');
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
            if (!snapshot.empty) {
                empresas = [];
                snapshot.forEach(doc => {
                    empresas.push({ id: String(doc.id), ...doc.data() });
                });
                localStorage.setItem('empresas', JSON.stringify(empresas));
                console.log('✅ Empresas do Firebase:', empresas.length);
                return;
            }
        }
        
        const empresasSalvas = localStorage.getItem('empresas');
        if (empresasSalvas) {
            empresas = JSON.parse(empresasSalvas);
            empresas = empresas.map(e => ({ ...e, id: String(e.id) }));
            console.log('✅ Empresas do localStorage:', empresas.length);
            return;
        }
        
        empresas = [];
        console.log('ℹ️ Nenhuma empresa encontrada');
        
    } catch (error) {
        console.error('Erro ao carregar empresas:', error);
        empresas = [];
    }
}

async function carregarDocumentos() {
    try {
        if (db) {
            const snapshot = await db.collection('documentos').get();
            if (!snapshot.empty) {
                documentos = [];
                snapshot.forEach(doc => {
                    documentos.push({ id: doc.id, ...doc.data() });
                });
                localStorage.setItem('documentos', JSON.stringify(documentos));
                console.log('✅ Documentos do Firebase:', documentos.length);
                return;
            }
        }
        
        const docsSalvos = localStorage.getItem('documentos');
        if (docsSalvos) {
            documentos = JSON.parse(docsSalvos);
            console.log('✅ Documentos do localStorage:', documentos.length);
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
        const salvo = localStorage.getItem('alertasGlobalConfig');
        if (salvo) {
            alertasGlobalConfig = { ...alertasGlobalConfig, ...JSON.parse(salvo) };
        }
    } catch (error) {
        console.error('Erro ao carregar alertas:', error);
    }
}

// ========== ENCONTRAR EMPRESA (FLEXÍVEL) ==========
function encontrarEmpresa(origem) {
    if (!origem) return null;
    
    const origemStr = String(origem).trim();
    
    // 1. Buscar por ID exato
    let empresa = empresas.find(e => String(e.id) === origemStr);
    if (empresa) return empresa;
    
    // 2. Buscar por nome exato (case insensitive)
    empresa = empresas.find(e => 
        e.nome && e.nome.toLowerCase().trim() === origemStr.toLowerCase().trim()
    );
    if (empresa) return empresa;
    
    // 3. Buscar por nome parcial
    empresa = empresas.find(e => 
        e.nome && (
            e.nome.toLowerCase().includes(origemStr.toLowerCase()) ||
            origemStr.toLowerCase().includes(e.nome.toLowerCase())
        )
    );
    
    return empresa || null;
}

// ========== SALVAR DADOS ==========
async function salvarDocumentos() {
    localStorage.setItem('documentos', JSON.stringify(documentos));
    if (db) {
        try {
            for (const doc of documentos) {
                const { id, ...dados } = doc;
                await db.collection('documentos').doc(String(id)).set(dados, { merge: true });
            }
        } catch (error) {
            console.error('Erro ao salvar no Firebase:', error);
        }
    }
}

async function salvarEmpresas() {
    localStorage.setItem('empresas', JSON.stringify(empresas));
    localStorage.setItem('empresas_docs', JSON.stringify(empresas));
    
    if (db) {
        try {
            for (const emp of empresas) {
                const { id, ...dados } = emp;
                await db.collection('empresas').doc(String(id)).set(dados, { merge: true });
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
    return String(Date.now());
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

function getCategoriaNome(cat) {
    const nomes = {
        licenca: 'Licença',
        alvara: 'Alvará',
        certificado: 'Certificado',
        seguro: 'Seguro',
        veiculo: 'Doc. Veicular',
        outros: 'Outros'
    };
    return nomes[cat] || 'Documento';
}

function formatarTamanho(bytes) {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

// ========== RENDERIZAÇÃO ==========
function renderizarTudo() {
    const container = document.getElementById('empresasContainer');
    const emptyState = document.getElementById('emptyDocumentos');
    
    if (!container) {
        console.error('❌ Container "empresasContainer" não encontrado!');
        return;
    }
    
    console.log('🔄 Renderizando...');
    console.log('   Documentos:', documentos.length);
    console.log('   Empresas:', empresas.length);
    
    if (documentos.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    
    const docsPorEmpresa = {};
    const docsSemEmpresa = [];
    
    documentos.forEach(doc => {
        const empresa = encontrarEmpresa(doc.origem);
        
        if (empresa) {
            const key = empresa.id;
            if (!docsPorEmpresa[key]) {
                docsPorEmpresa[key] = {
                    empresa: empresa,
                    docs: []
                };
            }
            docsPorEmpresa[key].docs.push(doc);
        } else {
            docsSemEmpresa.push(doc);
        }
    });
    
    console.log('   Grupos de empresas:', Object.keys(docsPorEmpresa).length);
    console.log('   Documentos sem empresa:', docsSemEmpresa.length);
    
    let html = '';
    
    // Renderizar empresas com documentos
    Object.values(docsPorEmpresa).forEach(grupo => {
        const empresa = grupo.empresa;
        const docs = grupo.docs;
        
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
            <div class="documentos-grid">
                ${docs.map(doc => renderizarCardDocumento(doc)).join('')}
            </div>
        `;
    });
    
    // Documentos sem empresa
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
    
    console.log('✅ Renderização concluída');
}

function renderizarCardDocumento(doc) {
    const diasRestantes = calcularDiasRestantes(doc.dataValidade);
    const status = getStatusDocumento(diasRestantes);
    const empresa = encontrarEmpresa(doc.origem);
    const diasClass = diasRestantes === null ? '' : 
                      diasRestantes < 0 ? 'negativo' : 
                      diasRestantes <= (alertasGlobalConfig.diasVermelho || 30) ? 'negativo' :
                      diasRestantes <= (alertasGlobalConfig.diasAmarelo || 60) ? 'alerta' : 'positivo';
    
    // Verificar se tem anexo PDF
    const temAnexo = doc.anexo && doc.anexo.base64 && doc.anexo.base64.length > 50;
    const nomeAnexo = doc.anexo?.nome || 'Documento PDF';
    const tamanhoAnexo = doc.anexo?.tamanho ? formatarTamanho(doc.anexo.tamanho) : '';
    
    return `
        <div class="documento-card ${status.classe}">
            <div class="documento-header">
                <span class="documento-categoria ${doc.categoria || 'outros'}">
                    ${getCategoriaNome(doc.categoria)}
                </span>
                <span class="status-badge ${status.status === 'vencido' ? 'status-pendente' : 'status-ativo'}">
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
                
                ${temAnexo ? `
                    <div class="documento-preview" onclick="visualizarPDF('${doc.id}')" title="Clique para visualizar o PDF">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <i class="fas fa-file-pdf" style="color:#e74c3c;font-size:24px;"></i>
                            <div>
                                <div style="font-size:12px;font-weight:bold;color:#333;">${escapeHtml(nomeAnexo)}</div>
                                ${tamanhoAnexo ? `<div style="font-size:10px;color:#999;">${tamanhoAnexo}</div>` : ''}
                            </div>
                        </div>
                        <div style="display:flex;gap:8px;">
                            <button class="btn-icon" onclick="event.stopPropagation(); baixarPDF('${doc.id}')" title="Baixar PDF">
                                <i class="fas fa-download"></i>
                            </button>
                            <i class="fas fa-chevron-right" style="color:#999;"></i>
                        </div>
                    </div>
                ` : ''}
                
                <div class="documento-actions">
                    <button class="btn-icon" onclick="verDetalhes('${doc.id}')" title="Ver detalhes">
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

function atualizarSelectEmpresas() {
    const select = document.getElementById('docOrigem');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione a empresa...</option>';
    empresas.forEach(empresa => {
        select.innerHTML += `<option value="${empresa.id}">${escapeHtml(empresa.nome)}</option>`;
    });
}

// ========== VISUALIZAR E BAIXAR PDF ==========
function visualizarPDF(docId) {
    const doc = documentos.find(d => d.id == docId);
    if (!doc || !doc.anexo || !doc.anexo.base64 || doc.anexo.base64.length < 50) {
        mostrarNotificacao('PDF não encontrado!', 'error');
        return;
    }
    
    const nomePDF = doc.anexo.nome || doc.nome || 'documento.pdf';
    
    const novaJanela = window.open('', '_blank');
    novaJanela.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${escapeHtml(nomePDF)}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { background: #525659; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .container { width: 100%; max-width: 900px; background: white; box-shadow: 0 0 20px rgba(0,0,0,0.5); }
                .header { background: #323639; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; }
                .header h3 { font-size: 14px; font-weight: normal; }
                .btn-download { background: #3498db; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; text-decoration: none; }
                .btn-download:hover { background: #2980b9; }
                embed { width: 100%; height: calc(100vh - 50px); border: none; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h3>📄 ${escapeHtml(nomePDF)}</h3>
                    <a class="btn-download" href="${doc.anexo.base64}" download="${escapeHtml(nomePDF)}">📥 Baixar</a>
                </div>
                <embed src="${doc.anexo.base64}" type="application/pdf" width="100%" height="100%">
            </div>
        </body>
        </html>
    `);
}

function baixarPDF(docId) {
    const doc = documentos.find(d => d.id == docId);
    if (!doc || !doc.anexo || !doc.anexo.base64 || doc.anexo.base64.length < 50) {
        mostrarNotificacao('PDF não encontrado!', 'error');
        return;
    }
    
    const link = document.createElement('a');
    link.href = doc.anexo.base64;
    link.download = doc.anexo.nome || doc.nome || 'documento.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    mostrarNotificacao('📥 PDF baixado com sucesso!', 'success');
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
    
    // Manter o anexo existente se estiver editando
    if (editingDocId) {
        const docExistente = documentos.find(d => d.id == editingDocId);
        if (docExistente && docExistente.anexo) {
            doc.anexo = docExistente.anexo;
        }
    }
    
    if (!doc.nome || !doc.categoria) {
        mostrarNotificacao('Preencha os campos obrigatórios!', 'error');
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
    document.getElementById('modalDocumento').style.display = 'none';
    mostrarNotificacao(editingDocId ? 'Documento atualizado!' : 'Documento registrado!', 'success');
    editingDocId = null;
}

function editarDocumento(id) {
    const doc = documentos.find(d => d.id == id);
    if (!doc) return;
    
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
    
    document.getElementById('modalDocumento').style.display = 'block';
}

async function excluirDocumento(id) {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return;
    
    documentos = documentos.filter(d => d.id != id);
    await salvarDocumentos();
    renderizarTudo();
    mostrarNotificacao('Documento excluído!', 'success');
}

function verDetalhes(id) {
    const doc = documentos.find(d => d.id == id);
    if (!doc) return;
    
    const modal = document.getElementById('modalDetalhes');
    const body = document.getElementById('modalDetalhesBody');
    if (!modal || !body) return;
    
    const empresa = encontrarEmpresa(doc.origem);
    const diasRestantes = calcularDiasRestantes(doc.dataValidade);
    const status = getStatusDocumento(diasRestantes);
    const temAnexo = doc.anexo && doc.anexo.base64 && doc.anexo.base64.length > 50;
    
    body.innerHTML = `
        <div class="details-container">
            <div class="detail-item full-width">
                <strong>Nome do Documento</strong>
                <span style="font-size:18px;font-weight:bold;">${escapeHtml(doc.nome)}</span>
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
            ${diasRestantes !== null ? `
                <div class="detail-item">
                    <strong>Dias Restantes</strong>
                    <span>${formatarDias(diasRestantes)}</span>
                </div>
            ` : ''}
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
            ${temAnexo ? `
                <div class="detail-item full-width">
                    <strong>Anexo</strong>
                    <span>
                        📄 ${escapeHtml(doc.anexo.nome || 'PDF')} 
                        ${doc.anexo.tamanho ? '(' + formatarTamanho(doc.anexo.tamanho) + ')' : ''}
                    </span>
                </div>
            ` : ''}
        </div>
        <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end;border-top:1px solid #e9ecef;padding-top:15px;">
            ${temAnexo ? `
                <button class="btn btn-secondary" onclick="visualizarPDF('${doc.id}')">
                    <i class="fas fa-eye"></i> Ver PDF
                </button>
                <button class="btn btn-secondary" onclick="baixarPDF('${doc.id}')">
                    <i class="fas fa-download"></i> Baixar PDF
                </button>
            ` : ''}
            <button class="btn btn-primary" onclick="editarDocumento('${doc.id}');document.getElementById('modalDetalhes').style.display='none';">
                <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn btn-danger" onclick="if(confirm('Excluir este documento?')){excluirDocumento('${doc.id}');document.getElementById('modalDetalhes').style.display='none';}">
                <i class="fas fa-trash"></i> Excluir
            </button>
            <button class="btn btn-secondary" onclick="document.getElementById('modalDetalhes').style.display='none';">
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
    document.getElementById('modalEmpresa').style.display = 'none';
    mostrarNotificacao(editingEmpresaId ? 'Empresa atualizada!' : 'Empresa cadastrada!', 'success');
    editingEmpresaId = null;
}

function editarEmpresa(id) {
    const emp = empresas.find(e => e.id == id);
    if (!emp) return;
    
    editingEmpresaId = emp.id;
    document.getElementById('empresaNome').value = emp.nome || '';
    document.getElementById('empresaDescricao').value = emp.descricao || '';
    
    document.getElementById('modalEmpresa').style.display = 'block';
}

async function excluirEmpresa(id) {
    if (!confirm('Excluir esta empresa? Os documentos vinculados NÃO serão excluídos.')) return;
    
    empresas = empresas.filter(e => e.id != id);
    await salvarEmpresas();
    renderizarTudo();
    mostrarNotificacao('Empresa excluída!', 'success');
}

// ========== ALERTAS ==========
function verificarAlertas() {
    let alertas = [];
    
    documentos.forEach(doc => {
        if (!doc.dataValidade) return;
        const diasRestantes = calcularDiasRestantes(doc.dataValidade);
        if (diasRestantes === null) return;
        
        if (diasRestantes < 0) {
            alertas.push({ doc, diasRestantes, nivel: 'vencido' });
        } else if (diasRestantes <= (alertasGlobalConfig.diasVermelho || 30)) {
            alertas.push({ doc, diasRestantes, nivel: 'vermelho' });
        } else if (diasRestantes <= (alertasGlobalConfig.diasAmarelo || 60)) {
            alertas.push({ doc, diasRestantes, nivel: 'amarelo' });
        }
    });
    
    return alertas;
}

// ========== NOTIFICAÇÕES ==========
function mostrarNotificacao(msg, tipo = 'info') {
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
        setTimeout(() => { n.style.display = 'none'; }, 300);
    }, 3000);
}

// ========== EVENTOS ==========
function inicializarEventos() {
    document.getElementById('formDocumento')?.addEventListener('submit', salvarDocumento);
    document.getElementById('formEmpresa')?.addEventListener('submit', salvarEmpresa);
    
    document.getElementById('addDocumentoBtn')?.addEventListener('click', () => {
        editingDocId = null;
        document.getElementById('modalDocumentoTitulo').innerHTML = '<i class="fas fa-plus-circle"></i> Registrar Documento';
        document.getElementById('formDocumento').reset();
        document.getElementById('modalDocumento').style.display = 'block';
    });
    
    document.getElementById('addEmpresaBtn')?.addEventListener('click', () => {
        editingEmpresaId = null;
        document.getElementById('formEmpresa').reset();
        document.getElementById('modalEmpresa').style.display = 'block';
    });
    
    document.getElementById('configAlertasBtn')?.addEventListener('click', () => {
        const alertas = verificarAlertas();
        if (alertas.length > 0) {
            mostrarNotificacao(`🔔 ${alertas.length} documento(s) precisam de atenção!`, 'warning');
        } else {
            mostrarNotificacao('✅ Todos os documentos estão em dia!', 'success');
        }
    });
    
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };
    
    console.log('✅ Eventos inicializados');
}

// ========== TORNAR FUNÇÕES GLOBAIS ==========
window.editarDocumento = editarDocumento;
window.excluirDocumento = excluirDocumento;
window.verDetalhes = verDetalhes;
window.editarEmpresa = editarEmpresa;
window.excluirEmpresa = excluirEmpresa;
window.encontrarEmpresa = encontrarEmpresa;
window.visualizarPDF = visualizarPDF;
window.baixarPDF = baixarPDF;
