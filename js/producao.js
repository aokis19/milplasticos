// ============================================================
// CONTROLE DE ESTOQUE - JavaScript (VERSÃO DEFINITIVA)
// ============================================================

// ========== VARIÁVEIS GLOBAIS ==========
let baiasData = [];
let filteredData = [];
let currentPage = 1;
const itemsPerPage = 6;
let currentTipo = 'todos';
let deleteIndex = -1;
let isEditando = false;

// ========== INICIALIZAÇÃO ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando Controle de Estoque...');
    iniciarAplicacao();
});

function iniciarAplicacao() {
    // Carregar dados
    carregarDados();
    
    // Configurar eventos
    configurarEventos();
    
    // Verificar status Firebase
    verificarStatusFirebase();
}

// ========== CONFIGURAR EVENTOS ==========
function configurarEventos() {
    // Formulário da Baia
    const formBaia = document.getElementById('formBaia');
    if (formBaia) {
        formBaia.addEventListener('submit', function(e) {
            e.preventDefault();
            salvarBaia();
        });
    }

    // Preview da estimativa
    const qtdBag = document.getElementById('qtdBag');
    const estimativaKg = document.getElementById('estimativaKg');
    if (qtdBag && estimativaKg) {
        qtdBag.addEventListener('input', atualizarPreview);
        estimativaKg.addEventListener('input', atualizarPreview);
        // Permitir decimais
        qtdBag.setAttribute('step', '0.1');
        estimativaKg.setAttribute('step', '0.1');
    }

    // Fechar modais
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    });

    // ESC para fechar modais
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                modal.classList.remove('active');
            });
        }
    });

    // Confirmar exclusão
    const btnConfirmar = document.getElementById('btnConfirmarExclusao');
    if (btnConfirmar) {
        btnConfirmar.addEventListener('click', function() {
            confirmarExclusao();
        });
    }
}

// ========== ATUALIZAR PREVIEW ==========
function atualizarPreview() {
    const qtd = parseFloat(document.getElementById('qtdBag')?.value) || 0;
    const kg = parseFloat(document.getElementById('estimativaKg')?.value) || 0;
    const total = qtd * kg;
    
    const preview = document.getElementById('previewEstimada');
    if (preview) {
        preview.textContent = total.toFixed(1);
    }
    
    // Atualizar campo de total visível
    const totalField = document.getElementById('totalCalculado');
    if (totalField) {
        totalField.textContent = total.toFixed(1) + ' kg';
    }
    
    return total;
}

// ========== CARREGAR DADOS ==========
function carregarDados() {
    mostrarLoading(true);
    
    try {
        const db = firebase.firestore();
        
        db.collection('baias')
            .orderBy('dataCriacao', 'desc')
            .get()
            .then((snapshot) => {
                baiasData = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    baiasData.push({
                        id: doc.id,
                        nome: data.nome || 'Sem nome',
                        tipo: data.tipo || 'moido-sujo',
                        material: data.material || 'Sem material',
                        quantidade: parseFloat(data.quantidade) || 0,
                        estimativaKg: parseFloat(data.estimativaKg) || 0,
                        totalKg: parseFloat(data.totalKg) || 0,
                        observacao: data.observacao || '',
                        dataCriacao: data.dataCriacao || new Date().toISOString(),
                        historico: data.historico || []
                    });
                });
                
                console.log('✅ Dados carregados:', baiasData.length, 'baias');
                atualizarInterface();
                mostrarLoading(false);
            })
            .catch((error) => {
                console.error('❌ Erro ao carregar:', error);
                carregarDadosLocais();
                mostrarLoading(false);
            });
    } catch (error) {
        console.error('❌ Erro no Firebase:', error);
        carregarDadosLocais();
        mostrarLoading(false);
    }
}

// ========== CARREGAR DADOS LOCAIS ==========
function carregarDadosLocais() {
    try {
        const dadosSalvos = localStorage.getItem('estoque_baias');
        if (dadosSalvos) {
            baiasData = JSON.parse(dadosSalvos);
            console.log('📁 Dados locais carregados:', baiasData.length, 'baias');
        } else {
            baiasData = [];
            console.log('📁 Nenhum dado local encontrado');
        }
        atualizarInterface();
    } catch (error) {
        console.error('❌ Erro ao carregar dados locais:', error);
        baiasData = [];
        atualizarInterface();
    }
}

// ========== SALVAR DADOS ==========
function salvarDados(dados) {
    try {
        const db = firebase.firestore();
        
        // Calcular total
        const quantidade = parseFloat(dados.quantidade) || 0;
        const estimativaKg = parseFloat(dados.estimativaKg) || 0;
        const totalKg = quantidade * estimativaKg;
        
        dados.totalKg = totalKg;
        dados.quantidade = quantidade;
        dados.estimativaKg = estimativaKg;
        
        if (dados.id && !dados.id.startsWith('local_')) {
            // Atualizar
            const { id, ...dataToUpdate } = dados;
            return db.collection('baias').doc(id).update({
                ...dataToUpdate,
                dataAtualizacao: new Date().toISOString()
            });
        } else {
            // Criar
            const newData = {
                ...dados,
                dataCriacao: new Date().toISOString(),
                dataAtualizacao: new Date().toISOString()
            };
            return db.collection('baias').add(newData);
        }
    } catch (error) {
        console.error('❌ Erro ao salvar:', error);
        return Promise.reject(error);
    }
}

// ========== EXCLUIR DADOS ==========
function excluirDados(id) {
    try {
        const db = firebase.firestore();
        return db.collection('baias').doc(id).delete();
    } catch (error) {
        console.error('❌ Erro ao excluir:', error);
        return Promise.reject(error);
    }
}

// ========== VERIFICAR STATUS FIREBASE ==========
function verificarStatusFirebase() {
    const statusElement = document.getElementById('firebaseStatusEstoque');
    if (!statusElement) return;
    
    try {
        const db = firebase.firestore();
        db.collection('baias').limit(1).get()
            .then(() => {
                statusElement.className = 'firebase-status status-online';
                statusElement.innerHTML = '<span class="status-dot"></span> Online';
            })
            .catch(() => {
                statusElement.className = 'firebase-status status-offline';
                statusElement.innerHTML = '<span class="status-dot"></span> Offline';
            });
    } catch (error) {
        statusElement.className = 'firebase-status status-offline';
        statusElement.innerHTML = '<span class="status-dot"></span> Offline';
    }
}

// ========== ATUALIZAR INTERFACE ==========
function atualizarInterface() {
    atualizarResumo();
    atualizarFiltros();
    atualizarBadges();
    filtrarDados();
    salvarLocalmente();
}

// ========== SALVAR LOCALMENTE ==========
function salvarLocalmente() {
    try {
        localStorage.setItem('estoque_baias', JSON.stringify(baiasData));
    } catch (error) {
        console.error('❌ Erro ao salvar localmente:', error);
    }
}

// ========== ATUALIZAR RESUMO ==========
function atualizarResumo() {
    const totalBaias = document.getElementById('totalBaias');
    const totalEstimado = document.getElementById('totalEstimado');
    const totalBags = document.getElementById('totalBags');
    const totalMateriais = document.getElementById('totalMateriais');
    
    if (totalBaias) totalBaias.textContent = baiasData.length;
    
    if (totalEstimado) {
        const total = baiasData.reduce((sum, item) => {
            return sum + (parseFloat(item.quantidade) * parseFloat(item.estimativaKg));
        }, 0);
        totalEstimado.textContent = total.toFixed(1);
    }
    
    if (totalBags) {
        const total = baiasData.reduce((sum, item) => {
            return sum + parseFloat(item.quantidade);
        }, 0);
        totalBags.textContent = total.toFixed(1);
    }
    
    if (totalMateriais) {
        const materiais = new Set(baiasData.map(item => item.material));
        totalMateriais.textContent = materiais.size;
    }
}

// ========== ATUALIZAR BADGES ==========
function atualizarBadges() {
    const badgeSujo = document.getElementById('badgeSujo');
    const badgeLavado = document.getElementById('badgeLavado');
    const badgeTodos = document.getElementById('badgeTodos');
    
    if (badgeSujo) {
        const sujo = baiasData.filter(item => item.tipo === 'moido-sujo');
        badgeSujo.textContent = sujo.length;
    }
    
    if (badgeLavado) {
        const lavado = baiasData.filter(item => item.tipo === 'moido-lavado');
        badgeLavado.textContent = lavado.length;
    }
    
    if (badgeTodos) {
        badgeTodos.textContent = baiasData.length;
    }
}

// ========== ATUALIZAR FILTROS ==========
function atualizarFiltros() {
    const filtroMaterial = document.getElementById('filtroMaterial');
    if (!filtroMaterial) return;
    
    const materiais = new Set(baiasData.map(item => item.material));
    
    while (filtroMaterial.options.length > 1) {
        filtroMaterial.remove(1);
    }
    
    materiais.forEach(material => {
        if (material) {
            const option = document.createElement('option');
            option.value = material;
            option.textContent = material;
            filtroMaterial.appendChild(option);
        }
    });
}

// ========== FILTRAR DADOS ==========
function filtrarDados() {
    const busca = document.getElementById('filtroBusca')?.value.toLowerCase() || '';
    const material = document.getElementById('filtroMaterial')?.value || '';
    
    let dados = baiasData;
    
    // Filtrar por tipo
    if (currentTipo !== 'todos') {
        dados = dados.filter(item => item.tipo === currentTipo);
    }
    
    // Filtrar por busca
    if (busca) {
        dados = dados.filter(item => {
            const nomeMatch = item.nome?.toLowerCase().includes(busca);
            const materialMatch = item.material?.toLowerCase().includes(busca);
            return nomeMatch || materialMatch;
        });
    }
    
    // Filtrar por material
    if (material) {
        dados = dados.filter(item => item.material === material);
    }
    
    filteredData = dados;
    currentPage = 1;
    renderizarBaias();
    atualizarPaginacao();
}

// ========== RENDERIZAR BAIAS ==========
function renderizarBaias() {
    const container = document.getElementById('baias-container');
    if (!container) return;
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
    const pageData = filteredData.slice(startIndex, endIndex);
    
    if (pageData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h3>Nenhuma baia encontrada</h3>
                <p>Clique em "Nova Baia" para começar a gerenciar seu estoque.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    pageData.forEach((item, index) => {
        const realIndex = startIndex + index;
        const quantidade = parseFloat(item.quantidade) || 0;
        const estimativa = parseFloat(item.estimativaKg) || 0;
        const totalKg = (quantidade * estimativa).toFixed(1);
        const tipoClass = item.tipo === 'moido-sujo' ? 'sujo' : 'lavado';
        const tipoLabel = item.tipo === 'moido-sujo' ? 'Moído Sujo' : 'Moído Lavado';
        
        html += `
            <div class="baia-card tipo-${tipoClass}">
                <div class="baia-header">
                    <div class="baia-info">
                        <h3 class="baia-nome">
                            <i class="fas fa-archive"></i>
                            ${item.nome || 'Baia sem nome'}
                        </h3>
                        <span class="baia-tipo-badge ${tipoClass}">${tipoLabel}</span>
                    </div>
                    <div class="baia-acoes">
                        <button onclick="editarBaia(${realIndex})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="verDetalhesBaia(${realIndex})" title="Detalhes">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="confirmarExclusaoBaia(${realIndex})" class="btn-excluir" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="baia-materiais">
                    <span class="material-tag">
                        <i class="fas fa-tag"></i> ${item.material || 'Sem material'}
                    </span>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th style="text-align:right;">Quantidade</th>
                            <th style="text-align:right;">Total (kg)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${item.material || 'Material'}</td>
                            <td style="text-align:right;">${quantidade.toFixed(1)} bags</td>
                            <td style="text-align:right; font-weight:600;">${totalKg}</td>
                        </tr>
                        <tr class="total-row">
                            <td colspan="2" style="text-align:right; font-weight:700;">Total Estimado</td>
                            <td style="text-align:right; font-weight:700; color:#1a2a3a;">${totalKg} kg</td>
                        </tr>
                    </tbody>
                </table>
                
                <div class="baia-footer">
                    <div class="baia-footer-info">
                        <span><i class="fas fa-calendar"></i> ${formatarData(item.dataCriacao)}</span>
                        <span><i class="fas fa-weight-scale"></i> ${estimativa.toFixed(1)} kg/bag</span>
                    </div>
                    ${item.observacao ? `
                        <div class="baia-obs">
                            <i class="fas fa-comment"></i> ${item.observacao}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ========== ATUALIZAR PAGINAÇÃO ==========
function atualizarPaginacao() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
    const pageInfo = document.getElementById('paginaInfo');
    
    if (pageInfo) {
        pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    }
}

// ========== PAGINAÇÃO ==========
function paginaAnterior() {
    if (currentPage > 1) {
        currentPage--;
        renderizarBaias();
        atualizarPaginacao();
    }
}

function proximaPagina() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
    if (currentPage < totalPages) {
        currentPage++;
        renderizarBaias();
        atualizarPaginacao();
    }
}

// ========== MUDAR TIPO ==========
function mudarTipo(tipo) {
    currentTipo = tipo;
    currentPage = 1;
    
    document.querySelectorAll('.tab-estoque').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tipo === tipo) {
            tab.classList.add('active');
        }
    });
    
    filtrarDados();
}

// ========== ABRIR MODAL ==========
function abrirModalBaia() {
    const modal = document.getElementById('modalBaia');
    const form = document.getElementById('formBaia');
    
    if (!modal) return;
    
    form.reset();
    document.getElementById('editBaiaIndex').value = '-1';
    document.getElementById('previewEstimada').textContent = '0,0';
    document.getElementById('totalCalculado').textContent = '0,0 kg';
    document.getElementById('qtdBag').value = '';
    document.getElementById('estimativaKg').value = '';
    document.getElementById('qtdBag').step = '0.1';
    document.getElementById('estimativaKg').step = '0.1';
    
    // Definir tipo padrão
    const tipoSelect = document.getElementById('tipoBaiaSelect');
    if (tipoSelect) {
        tipoSelect.value = currentTipo !== 'todos' ? currentTipo : 'moido-sujo';
    }
    
    document.getElementById('modalBaiaTitulo').textContent = 'Nova Baia';
    document.getElementById('btnSalvarBaia').innerHTML = '<i class="fas fa-save"></i> Salvar';
    isEditando = false;
    
    modal.classList.add('active');
    document.getElementById('tipoBaiaSelect')?.focus();
}

// ========== FECHAR MODAL ==========
function fecharModalBaia() {
    const modal = document.getElementById('modalBaia');
    if (modal) modal.classList.remove('active');
}

// ========== SALVAR BAIA ==========
function salvarBaia() {
    const editIndex = parseInt(document.getElementById('editBaiaIndex').value);
    const tipo = document.getElementById('tipoBaiaSelect').value;
    const nome = document.getElementById('baiaNome').value.trim();
    const material = document.getElementById('materialNome').value.trim();
    const quantidade = parseFloat(document.getElementById('qtdBag').value) || 0;
    const estimativaKg = parseFloat(document.getElementById('estimativaKg').value) || 0;
    const observacao = document.getElementById('baiaObs').value.trim();
    const totalKg = quantidade * estimativaKg;
    
    // Validações
    if (!tipo) {
        alert('Selecione o tipo da baia.');
        return;
    }
    
    if (!nome) {
        alert('Preencha o nome da baia.');
        document.getElementById('baiaNome').focus();
        return;
    }
    
    if (!material) {
        alert('Preencha o material.');
        document.getElementById('materialNome').focus();
        return;
    }
    
    if (quantidade <= 0) {
        alert('Informe uma quantidade válida.');
        document.getElementById('qtdBag').focus();
        return;
    }
    
    if (estimativaKg <= 0) {
        alert('Informe uma estimativa válida.');
        document.getElementById('estimativaKg').focus();
        return;
    }
    
    const dados = {
        tipo: tipo,
        nome: nome,
        material: material,
        quantidade: quantidade,
        estimativaKg: estimativaKg,
        totalKg: totalKg,
        observacao: observacao
    };
    
    mostrarLoading(true);
    
    if (editIndex >= 0 && editIndex < baiasData.length) {
        // EDITAR
        const item = baiasData[editIndex];
        dados.id = item.id;
        dados.historico = item.historico || [];
        dados.historico.push({
            data: new Date().toISOString(),
            acao: 'Atualização',
            tipo: tipo,
            detalhes: `Quantidade: ${quantidade.toFixed(1)} bags, Estimativa: ${estimativaKg.toFixed(1)} kg/bag, Total: ${totalKg.toFixed(1)} kg`
        });
        
        salvarDados(dados)
            .then(() => {
                baiasData[editIndex] = { ...item, ...dados };
                atualizarInterface();
                fecharModalBaia();
                mostrarLoading(false);
                mostrarNotificacao('Baia atualizada!', 'success');
            })
            .catch((error) => {
                console.error('Erro ao atualizar:', error);
                baiasData[editIndex] = { ...item, ...dados };
                atualizarInterface();
                fecharModalBaia();
                mostrarLoading(false);
                mostrarNotificacao('Baia atualizada localmente', 'warning');
            });
    } else {
        // CRIAR
        dados.historico = [{
            data: new Date().toISOString(),
            acao: 'Criação',
            tipo: tipo,
            detalhes: `Quantidade: ${quantidade.toFixed(1)} bags, Estimativa: ${estimativaKg.toFixed(1)} kg/bag, Total: ${totalKg.toFixed(1)} kg`
        }];
        
        salvarDados(dados)
            .then((docRef) => {
                dados.id = docRef.id;
                baiasData.unshift(dados);
                atualizarInterface();
                fecharModalBaia();
                mostrarLoading(false);
                mostrarNotificacao('Baia criada com sucesso!', 'success');
            })
            .catch((error) => {
                console.error('Erro ao criar:', error);
                dados.id = 'local_' + Date.now();
                baiasData.unshift(dados);
                atualizarInterface();
                fecharModalBaia();
                mostrarLoading(false);
                mostrarNotificacao('Baia criada localmente', 'warning');
            });
    }
}

// ========== EDITAR BAIA ==========
function editarBaia(index) {
    const item = filteredData[index];
    if (!item) return;
    
    const realIndex = baiasData.findIndex(b => b.id === item.id);
    if (realIndex === -1) return;
    
    // Preencher formulário
    document.getElementById('editBaiaIndex').value = realIndex;
    document.getElementById('tipoBaiaSelect').value = item.tipo || 'moido-sujo';
    document.getElementById('baiaNome').value = item.nome || '';
    document.getElementById('materialNome').value = item.material || '';
    document.getElementById('qtdBag').value = item.quantidade || 0;
    document.getElementById('estimativaKg').value = item.estimativaKg || 0;
    document.getElementById('baiaObs').value = item.observacao || '';
    document.getElementById('qtdBag').step = '0.1';
    document.getElementById('estimativaKg').step = '0.1';
    
    const totalKg = (parseFloat(item.quantidade) || 0) * (parseFloat(item.estimativaKg) || 0);
    document.getElementById('previewEstimada').textContent = totalKg.toFixed(1);
    document.getElementById('totalCalculado').textContent = totalKg.toFixed(1) + ' kg';
    
    document.getElementById('modalBaiaTitulo').textContent = 'Editar Baia';
    document.getElementById('btnSalvarBaia').innerHTML = '<i class="fas fa-save"></i> Atualizar';
    isEditando = true;
    
    document.getElementById('modalBaia').classList.add('active');
}

// ========== VER DETALHES ==========
function verDetalhesBaia(index) {
    const item = filteredData[index];
    if (!item) return;
    
    const modal = document.getElementById('modalDetalhesBaia');
    const conteudo = document.getElementById('detalhesBaiaConteudo');
    
    if (!modal || !conteudo) return;
    
    document.getElementById('detalhesBaiaTitulo').textContent = `Detalhes - ${item.nome || 'Baia'}`;
    
    const quantidade = parseFloat(item.quantidade) || 0;
    const estimativa = parseFloat(item.estimativaKg) || 0;
    const totalKg = (quantidade * estimativa).toFixed(1);
    const tipoLabel = item.tipo === 'moido-sujo' ? 'Moído Sujo' : 'Moído Lavado';
    
    // Gerar histórico
    let historicoHtml = '';
    if (item.historico && item.historico.length > 0) {
        const historicoFiltrado = item.historico.filter(h => h.tipo === item.tipo);
        if (historicoFiltrado.length > 0) {
            historicoHtml = `
                <div style="margin-top:16px;">
                    <h4 style="color:#1a2a3a; margin-bottom:8px;">
                        <i class="fas fa-history"></i> Histórico
                    </h4>
                    <div style="background:#f8f9fc; border-radius:8px; padding:12px; max-height:200px; overflow-y:auto;">
                        ${historicoFiltrado.slice().reverse().map(h => `
                            <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #eef2f7; font-size:13px;">
                                <span><strong>${h.acao}</strong> - ${h.detalhes}</span>
                                <span style="color:#888; font-size:11px;">${formatarDataCompleta(h.data)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }
    
    conteudo.innerHTML = `
        <div style="display:grid; gap:16px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div style="background:#f8f9fc; padding:12px 16px; border-radius:8px;">
                    <span style="font-size:12px; color:#888; display:block;">Nome</span>
                    <span style="font-size:16px; font-weight:600;">${item.nome || '-'}</span>
                </div>
                <div style="background:#f8f9fc; padding:12px 16px; border-radius:8px;">
                    <span style="font-size:12px; color:#888; display:block;">Tipo</span>
                    <span style="font-size:16px; font-weight:600;">${tipoLabel}</span>
                </div>
                <div style="background:#f8f9fc; padding:12px 16px; border-radius:8px;">
                    <span style="font-size:12px; color:#888; display:block;">Material</span>
                    <span style="font-size:16px; font-weight:600;">${item.material || '-'}</span>
                </div>
                <div style="background:#f8f9fc; padding:12px 16px; border-radius:8px;">
                    <span style="font-size:12px; color:#888; display:block;">Quantidade</span>
                    <span style="font-size:16px; font-weight:600;">${quantidade.toFixed(1)} bags</span>
                </div>
                <div style="background:#f8f9fc; padding:12px 16px; border-radius:8px;">
                    <span style="font-size:12px; color:#888; display:block;">Estimativa</span>
                    <span style="font-size:16px; font-weight:600;">${estimativa.toFixed(1)} kg/bag</span>
                </div>
                <div style="background:#eafaf1; padding:12px 16px; border-radius:8px; border:2px solid #27ae60;">
                    <span style="font-size:12px; color:#27ae60; display:block;">Total</span>
                    <span style="font-size:20px; font-weight:700; color:#27ae60;">${totalKg} kg</span>
                </div>
            </div>
            ${item.observacao ? `
                <div style="background:#f8f9fc; padding:12px 16px; border-radius:8px;">
                    <span style="font-size:12px; color:#888; display:block;">Observação</span>
                    <span style="font-size:14px;">${item.observacao}</span>
                </div>
            ` : ''}
            <div style="background:#f8f9fc; padding:12px 16px; border-radius:8px; display:flex; gap:16px; flex-wrap:wrap;">
                <div>
                    <span style="font-size:12px; color:#888; display:block;">Criação</span>
                    <span style="font-size:14px;">${formatarDataCompleta(item.dataCriacao)}</span>
                </div>
            </div>
            ${historicoHtml}
        </div>
    `;
    
    window._detalheBaiaIndex = index;
    modal.classList.add('active');
}

// ========== CONFIRMAR EXCLUSÃO ==========
function confirmarExclusaoBaia(index) {
    const item = filteredData[index];
    if (!item) return;
    
    const realIndex = baiasData.findIndex(b => b.id === item.id);
    if (realIndex === -1) return;
    
    deleteIndex = realIndex;
    
    document.getElementById('confirmacaoMensagem').textContent = 
        `Tem certeza que deseja excluir a baia "${item.nome}"?`;
    document.getElementById('modalConfirmacao').classList.add('active');
}

// ========== CONFIRMAR EXCLUSÃO ==========
function confirmarExclusao() {
    if (deleteIndex === -1) return;
    
    const item = baiasData[deleteIndex];
    if (!item) return;
    
    mostrarLoading(true);
    
    if (item.id && !item.id.startsWith('local_')) {
        excluirDados(item.id)
            .then(() => {
                baiasData.splice(deleteIndex, 1);
                atualizarInterface();
                fecharModal('modalConfirmacao');
                mostrarLoading(false);
                mostrarNotificacao('Baia excluída!', 'success');
                deleteIndex = -1;
            })
            .catch((error) => {
                console.error('Erro ao excluir:', error);
                baiasData.splice(deleteIndex, 1);
                atualizarInterface();
                fecharModal('modalConfirmacao');
                mostrarLoading(false);
                mostrarNotificacao('Baia excluída localmente', 'warning');
                deleteIndex = -1;
            });
    } else {
        baiasData.splice(deleteIndex, 1);
        atualizarInterface();
        fecharModal('modalConfirmacao');
        mostrarLoading(false);
        mostrarNotificacao('Baia excluída!', 'success');
        deleteIndex = -1;
    }
}

// ========== FUNÇÕES UTILITÁRIAS ==========

function formatarData(data) {
    if (!data) return '-';
    try {
        return new Date(data).toLocaleDateString('pt-BR');
    } catch {
        return '-';
    }
}

function formatarDataCompleta(data) {
    if (!data) return '-';
    try {
        return new Date(data).toLocaleString('pt-BR');
    } catch {
        return '-';
    }
}

function fecharModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

function mostrarLoading(ativo) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.toggle('active', ativo);
    }
}

function mostrarNotificacao(mensagem, tipo = 'info') {
    const cores = {
        success: '#27ae60',
        warning: '#f39c12',
        info: '#3498db',
        error: '#e74c3c'
    };
    
    const notificacao = document.createElement('div');
    notificacao.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 14px 20px;
        background: ${cores[tipo] || cores.info};
        color: #fff;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        z-index: 99999;
        font-size: 14px;
        max-width: 350px;
        transform: translateX(120%);
        transition: transform 0.3s ease;
        cursor: pointer;
    `;
    
    const icons = {
        success: '✅',
        warning: '⚠️',
        info: 'ℹ️',
        error: '❌'
    };
    
    notificacao.innerHTML = `${icons[tipo] || 'ℹ️'} ${mensagem}`;
    document.body.appendChild(notificacao);
    
    setTimeout(() => notificacao.style.transform = 'translateX(0)', 100);
    
    setTimeout(() => {
        notificacao.style.transform = 'translateX(120%)';
        setTimeout(() => {
            if (notificacao.parentNode) {
                document.body.removeChild(notificacao);
            }
        }, 300);
    }, 3000);
    
    notificacao.addEventListener('click', function() {
        this.style.transform = 'translateX(120%)';
        setTimeout(() => {
            if (this.parentNode) {
                this.parentNode.removeChild(this);
            }
        }, 300);
    });
}

// ========== EXPORTAR FUNÇÕES GLOBAIS ==========
window.abrirModalBaia = abrirModalBaia;
window.fecharModalBaia = fecharModalBaia;
window.editarBaia = editarBaia;
window.verDetalhesBaia = verDetalhesBaia;
window.confirmarExclusaoBaia = confirmarExclusaoBaia;
window.filtrarDados = filtrarDados;
window.mudarTipo = mudarTipo;
window.paginaAnterior = paginaAnterior;
window.proximaPagina = proximaPagina;
window.fecharModal = fecharModal;
window.limparFiltros = function() {
    document.getElementById('filtroBusca').value = '';
    document.getElementById('filtroMaterial').value = '';
    filtrarDados();
};

// ========== FUNÇÕES PDF E EXPORT ==========
window.gerarPDFEstoque = function() {
    if (baiasData.length === 0) {
        alert('Não há dados para gerar PDF.');
        return;
    }
    mostrarNotificacao('Gerando PDF...', 'info');
    // Implementação do PDF aqui
};

window.exportarDados = function() {
    if (baiasData.length === 0) {
        alert('Não há dados para exportar.');
        return;
    }
    const dados = {
        exportadoEm: new Date().toISOString(),
        totalBaias: baiasData.length,
        dados: baiasData
    };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estoque_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    mostrarNotificacao('Dados exportados!', 'success');
};

window.importarDados = function() {
    document.getElementById('modalImportar').classList.add('active');
};

window.confirmarImportar = function() {
    const input = document.getElementById('arquivoImportar');
    if (!input.files || !input.files[0]) {
        alert('Selecione um arquivo JSON.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const dados = JSON.parse(e.target.result);
            if (!dados.dados || !Array.isArray(dados.dados)) {
                alert('Arquivo inválido.');
                return;
            }
            
            if (!confirm(`Importar ${dados.dados.length} baias?`)) return;
            
            const novasBaias = dados.dados.map(item => ({
                ...item,
                id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
            }));
            
            baiasData = novasBaias;
            atualizarInterface();
            fecharModal('modalImportar');
            mostrarNotificacao(`${novasBaias.length} baias importadas!`, 'success');
        } catch (error) {
            alert('Erro ao importar: ' + error.message);
        }
    };
    reader.readAsText(input.files[0]);
};

console.log('✅ Controle de Estoque pronto!');
