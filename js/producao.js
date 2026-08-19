// ============================================================
// CONTROLE DE ESTOQUE - JavaScript Completo (CORRIGIDO)
// ============================================================

// ========== VARIÁVEIS GLOBAIS ==========
let baiasData = [];
let filteredData = [];
let currentPage = 1;
const itemsPerPage = 6;
let currentTipo = 'moido-sujo';
let deleteIndex = -1;

// ========== INICIALIZAÇÃO ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando Controle de Estoque...');
    
    // Carregar dados do Firebase
    carregarDadosEstoque();
    
    // Configurar eventos
    configurarEventos();
    
    // Atualizar status do Firebase
    verificarStatusFirebase();
});

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

    // Preview da estimativa - ACEITA DECIMAIS
    const qtdBag = document.getElementById('qtdBag');
    const estimativaKg = document.getElementById('estimativaKg');
    if (qtdBag && estimativaKg) {
        qtdBag.addEventListener('input', function() {
            atualizarPreviewEstimativa();
            calcularTotal();
        });
        estimativaKg.addEventListener('input', function() {
            atualizarPreviewEstimativa();
            calcularTotal();
        });
        // Permitir decimais
        qtdBag.setAttribute('step', '0.1');
        estimativaKg.setAttribute('step', '0.1');
    }

    // Tipo de baia - antes do nome
    const tipoBaiaSelect = document.getElementById('tipoBaiaSelect');
    if (tipoBaiaSelect) {
        tipoBaiaSelect.addEventListener('change', function() {
            document.getElementById('editTipo').value = this.value;
        });
    }

    // Fechar modal ao clicar no overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    });

    // Fechar modal com ESC
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

// ========== CALCULAR TOTAL EM TEMPO REAL ==========
function calcularTotal() {
    const qtd = parseFloat(document.getElementById('qtdBag')?.value) || 0;
    const kg = parseFloat(document.getElementById('estimativaKg')?.value) || 0;
    const total = qtd * kg;
    
    // Atualizar campo total se existir
    const totalField = document.getElementById('totalCalculado');
    if (totalField) {
        totalField.textContent = total.toFixed(1) + ' kg';
    }
    
    // Atualizar preview
    const preview = document.getElementById('previewEstimada');
    if (preview) {
        preview.textContent = total.toFixed(1);
    }
    
    return total;
}

// ========== FIREBASE - CARREGAR DADOS ==========
function carregarDadosEstoque() {
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
                        ...data,
                        dataCriacao: data.dataCriacao || new Date().toISOString(),
                        quantidade: parseFloat(data.quantidade) || 0,
                        estimativaKg: parseFloat(data.estimativaKg) || 0,
                        totalKg: parseFloat(data.totalKg) || 0,
                        historico: data.historico || []
                    });
                });
                
                console.log(`✅ ${baiasData.length} baias carregadas do Firebase`);
                atualizarTudo();
                mostrarLoading(false);
            })
            .catch((error) => {
                console.error('❌ Erro ao carregar dados:', error);
                carregarDadosLocais();
                mostrarLoading(false);
            });
    } catch (error) {
        console.error('❌ Erro ao inicializar Firebase:', error);
        carregarDadosLocais();
        mostrarLoading(false);
    }
}

// ========== DADOS LOCAIS (FALLBACK) ==========
function carregarDadosLocais() {
    try {
        const dadosSalvos = localStorage.getItem('estoque_baias');
        if (dadosSalvos) {
            baiasData = JSON.parse(dadosSalvos);
            console.log(`📁 ${baiasData.length} baias carregadas do localStorage`);
            atualizarTudo();
        } else {
            // Dados de exemplo
            baiasData = [
                {
                    id: '1',
                    nome: 'Baia A1',
                    tipo: 'moido-sujo',
                    material: 'PP',
                    quantidade: 10.5,
                    estimativaKg: 25.5,
                    totalKg: 267.75,
                    observacao: 'Material de alta qualidade',
                    dataCriacao: new Date().toISOString(),
                    historico: [
                        {
                            data: new Date().toISOString(),
                            acao: 'Criação',
                            tipo: 'moido-sujo',
                            detalhes: 'Baia criada com 10.5 bags'
                        }
                    ]
                },
                {
                    id: '2',
                    nome: 'Baia B2',
                    tipo: 'moido-lavado',
                    material: 'PEAD',
                    quantidade: 8.0,
                    estimativaKg: 30.0,
                    totalKg: 240.0,
                    observacao: 'Lavado e seco',
                    dataCriacao: new Date().toISOString(),
                    historico: [
                        {
                            data: new Date().toISOString(),
                            acao: 'Criação',
                            tipo: 'moido-lavado',
                            detalhes: 'Baia criada com 8.0 bags'
                        }
                    ]
                }
            ];
            atualizarTudo();
        }
    } catch (error) {
        console.error('❌ Erro ao carregar dados locais:', error);
        baiasData = [];
        atualizarTudo();
    }
}

// ========== SALVAR NO FIREBASE ==========
function salvarNoFirebase(dados) {
    try {
        const db = firebase.firestore();
        
        // Garantir que os números sejam float e calcular total
        const quantidade = parseFloat(dados.quantidade) || 0;
        const estimativaKg = parseFloat(dados.estimativaKg) || 0;
        const totalKg = quantidade * estimativaKg;
        
        const dadosToSave = {
            ...dados,
            quantidade: quantidade,
            estimativaKg: estimativaKg,
            totalKg: totalKg,
            historico: dados.historico || []
        };
        
        if (dados.id && !dados.id.startsWith('local_')) {
            // Atualizar existente
            const { id, ...dataToUpdate } = dadosToSave;
            return db.collection('baias').doc(id).update({
                ...dataToUpdate,
                dataAtualizacao: new Date().toISOString()
            });
        } else {
            // Criar novo
            const newData = {
                ...dadosToSave,
                dataCriacao: new Date().toISOString(),
                dataAtualizacao: new Date().toISOString()
            };
            return db.collection('baias').add(newData);
        }
    } catch (error) {
        console.error('❌ Erro ao salvar no Firebase:', error);
        return Promise.reject(error);
    }
}

// ========== EXCLUIR DO FIREBASE ==========
function excluirDoFirebase(id) {
    try {
        const db = firebase.firestore();
        return db.collection('baias').doc(id).delete();
    } catch (error) {
        console.error('❌ Erro ao excluir do Firebase:', error);
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

// ========== ATUALIZAR TUDO ==========
function atualizarTudo() {
    atualizarResumo();
    atualizarFiltros();
    filtrarEstoque();
    atualizarBadges();
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
    
    if (totalBaias) {
        totalBaias.textContent = baiasData.length;
    }
    
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
    
    // Limpar opções existentes (manter a primeira opção "Todos os materiais")
    while (filtroMaterial.options.length > 1) {
        filtroMaterial.remove(1);
    }
    
    // Adicionar novos materiais
    materiais.forEach(material => {
        if (material) {
            const option = document.createElement('option');
            option.value = material;
            option.textContent = material;
            filtroMaterial.appendChild(option);
        }
    });
}

// ========== MUDAR TIPO DE ESTOQUE ==========
window.mudarTipoEstoque = function(tipo) {
    currentTipo = tipo;
    currentPage = 1;
    
    // Atualizar tabs
    document.querySelectorAll('.tab-estoque').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tipo === tipo) {
            tab.classList.add('active');
        }
    });
    
    filtrarEstoque();
};

// ========== FILTRAR ESTOQUE ==========
window.filtrarEstoque = function() {
    const busca = document.getElementById('filtroBusca')?.value.toLowerCase() || '';
    const material = document.getElementById('filtroMaterial')?.value || '';
    
    // Filtrar por tipo
    let dados = baiasData;
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
};

// ========== LIMPAR FILTROS ==========
window.limparFiltros = function() {
    const busca = document.getElementById('filtroBusca');
    const material = document.getElementById('filtroMaterial');
    
    if (busca) busca.value = '';
    if (material) material.value = '';
    
    filtrarEstoque();
};

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
        
        // Pegar último histórico
        const ultimoHistorico = item.historico && item.historico.length > 0 
            ? item.historico[item.historico.length - 1] 
            : null;
        
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
                        <button onclick="window.editarBaia(${realIndex})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="window.verDetalhesBaia(${realIndex})" title="Detalhes">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="window.confirmarExclusaoBaia(${realIndex})" class="btn-excluir" title="Excluir">
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
                        ${ultimoHistorico ? `<span><i class="fas fa-history"></i> ${ultimoHistorico.acao}</span>` : ''}
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
    
    // Atualizar botões
    const btnAnterior = document.querySelector('.paginacao .btn:first-child');
    const btnProximo = document.querySelector('.paginacao .btn:last-child');
    
    if (btnAnterior) {
        btnAnterior.disabled = currentPage <= 1;
        btnAnterior.style.opacity = currentPage <= 1 ? '0.5' : '1';
    }
    
    if (btnProximo) {
        btnProximo.disabled = currentPage >= totalPages;
        btnProximo.style.opacity = currentPage >= totalPages ? '0.5' : '1';
    }
}

// ========== PAGINAÇÃO ==========
window.paginaAnterior = function() {
    if (currentPage > 1) {
        currentPage--;
        renderizarBaias();
        atualizarPaginacao();
        document.querySelector('.baias-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

window.proximaPagina = function() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
    if (currentPage < totalPages) {
        currentPage++;
        renderizarBaias();
        atualizarPaginacao();
        document.querySelector('.baias-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

// ========== ABRIR MODAL BAIAS ==========
window.abrirModalBaia = function() {
    const modal = document.getElementById('modalBaia');
    const titulo = document.getElementById('modalBaiaTitulo');
    const form = document.getElementById('formBaia');
    const btnSalvar = document.getElementById('btnSalvarBaia');
    
    if (!modal) return;
    
    // Resetar formulário
    form.reset();
    document.getElementById('editBaiaIndex').value = '-1';
    document.getElementById('editTipo').value = currentTipo === 'todos' ? 'moido-sujo' : currentTipo;
    document.getElementById('previewEstimada').textContent = '0,0';
    
    // Resetar select de tipo
    const tipoSelect = document.getElementById('tipoBaiaSelect');
    if (tipoSelect) {
        tipoSelect.value = currentTipo === 'todos' ? 'moido-sujo' : currentTipo;
    }
    
    // Garantir que aceita decimais
    document.getElementById('qtdBag').step = '0.1';
    document.getElementById('estimativaKg').step = '0.1';
    document.getElementById('qtdBag').value = '';
    document.getElementById('estimativaKg').value = '';
    
    // Limpar total calculado
    const totalField = document.getElementById('totalCalculado');
    if (totalField) totalField.textContent = '0,0 kg';
    
    if (titulo) titulo.textContent = 'Nova Baia';
    if (btnSalvar) btnSalvar.innerHTML = '<i class="fas fa-save"></i> Salvar';
    
    modal.classList.add('active');
    document.getElementById('tipoBaiaSelect')?.focus();
};

// ========== FECHAR MODAL BAIAS ==========
window.fecharModalBaia = function() {
    const modal = document.getElementById('modalBaia');
    if (modal) modal.classList.remove('active');
};

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
        alert('Por favor, selecione o tipo da baia (Sujo ou Lavado).');
        document.getElementById('tipoBaiaSelect').focus();
        return;
    }
    
    if (!nome) {
        alert('Por favor, preencha o nome da baia.');
        document.getElementById('baiaNome').focus();
        return;
    }
    
    if (!material) {
        alert('Por favor, preencha o material.');
        document.getElementById('materialNome').focus();
        return;
    }
    
    if (quantidade <= 0) {
        alert('Por favor, informe uma quantidade válida.');
        document.getElementById('qtdBag').focus();
        return;
    }
    
    if (estimativaKg <= 0) {
        alert('Por favor, informe uma estimativa válida.');
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
        // Editar existente
        const item = baiasData[editIndex];
        dados.id = item.id;
        
        // Adicionar ao histórico
        dados.historico = item.historico || [];
        dados.historico.push({
            data: new Date().toISOString(),
            acao: 'Atualização',
            tipo: tipo,
            detalhes: `Quantidade: ${quantidade.toFixed(1)} bags, Estimativa: ${estimativaKg.toFixed(1)} kg/bag, Total: ${totalKg.toFixed(1)} kg`
        });
        
        salvarNoFirebase(dados)
            .then(() => {
                baiasData[editIndex] = { ...item, ...dados };
                atualizarTudo();
                fecharModalBaia();
                mostrarLoading(false);
                mostrarNotificacao('Baia atualizada com sucesso!', 'success');
            })
            .catch((error) => {
                console.error('❌ Erro ao atualizar:', error);
                baiasData[editIndex] = { ...item, ...dados };
                atualizarTudo();
                fecharModalBaia();
                mostrarLoading(false);
                mostrarNotificacao('Baia atualizada localmente (erro no Firebase)', 'warning');
            });
    } else {
        // Nova baia
        dados.historico = [
            {
                data: new Date().toISOString(),
                acao: 'Criação',
                tipo: tipo,
                detalhes: `Quantidade: ${quantidade.toFixed(1)} bags, Estimativa: ${estimativaKg.toFixed(1)} kg/bag, Total: ${totalKg.toFixed(1)} kg`
            }
        ];
        
        salvarNoFirebase(dados)
            .then((docRef) => {
                dados.id = docRef.id;
                baiasData.unshift(dados);
                atualizarTudo();
                fecharModalBaia();
                mostrarLoading(false);
                mostrarNotificacao('Baia criada com sucesso!', 'success');
            })
            .catch((error) => {
                console.error('❌ Erro ao criar:', error);
                dados.id = 'local_' + Date.now();
                baiasData.unshift(dados);
                atualizarTudo();
                fecharModalBaia();
                mostrarLoading(false);
                mostrarNotificacao('Baia criada localmente (erro no Firebase)', 'warning');
            });
    }
}

// ========== EDITAR BAIA ==========
window.editarBaia = function(index) {
    const item = filteredData[index];
    if (!item) return;
    
    const realIndex = baiasData.findIndex(b => b.id === item.id);
    if (realIndex === -1) return;
    
    const modal = document.getElementById('modalBaia');
    const titulo = document.getElementById('modalBaiaTitulo');
    const btnSalvar = document.getElementById('btnSalvarBaia');
    
    // Preencher formulário
    document.getElementById('editBaiaIndex').value = realIndex;
    document.getElementById('tipoBaiaSelect').value = item.tipo || 'moido-sujo';
    document.getElementById('editTipo').value = item.tipo || 'moido-sujo';
    document.getElementById('baiaNome').value = item.nome || '';
    document.getElementById('materialNome').value = item.material || '';
    document.getElementById('qtdBag').value = item.quantidade || 0;
    document.getElementById('estimativaKg').value = item.estimativaKg || 0;
    document.getElementById('baiaObs').value = item.observacao || '';
    
    // Garantir que aceita decimais
    document.getElementById('qtdBag').step = '0.1';
    document.getElementById('estimativaKg').step = '0.1';
    
    // Calcular e mostrar total
    const totalKg = (parseFloat(item.quantidade) || 0) * (parseFloat(item.estimativaKg) || 0);
    document.getElementById('previewEstimada').textContent = totalKg.toFixed(1);
    
    const totalField = document.getElementById('totalCalculado');
    if (totalField) totalField.textContent = totalKg.toFixed(1) + ' kg';
    
    if (titulo) titulo.textContent = 'Editar Baia';
    if (btnSalvar) btnSalvar.innerHTML = '<i class="fas fa-save"></i> Atualizar';
    
    if (modal) modal.classList.add('active');
    document.getElementById('tipoBaiaSelect')?.focus();
};

// ========== VER DETALHES DA BAIA ==========
window.verDetalhesBaia = function(index) {
    const item = filteredData[index];
    if (!item) return;
    
    const modal = document.getElementById('modalDetalhesBaia');
    const titulo = document.getElementById('detalhesBaiaTitulo');
    const conteudo = document.getElementById('detalhesBaiaConteudo');
    
    if (!modal || !conteudo) return;
    
    if (titulo) titulo.textContent = `Detalhes - ${item.nome || 'Baia'}`;
    
    const quantidade = parseFloat(item.quantidade) || 0;
    const estimativa = parseFloat(item.estimativaKg) || 0;
    const totalKg = (quantidade * estimativa).toFixed(1);
    const tipoLabel = item.tipo === 'moido-sujo' ? 'Moído Sujo' : 'Moído Lavado';
    
    // Gerar histórico filtrado por tipo
    let historicoHtml = '';
    if (item.historico && item.historico.length > 0) {
        // Filtrar histórico pelo tipo da baia
        const historicoFiltrado = item.historico.filter(h => h.tipo === item.tipo);
        
        if (historicoFiltrado.length > 0) {
            historicoHtml = `
                <div style="margin-top:16px;">
                    <h4 style="color:#1a2a3a; margin-bottom:8px;">
                        <i class="fas fa-history"></i> Histórico de Movimentações (${tipoLabel})
                    </h4>
                    <div style="background:#f8f9fc; border-radius:8px; padding:12px; max-height:200px; overflow-y:auto;">
                        ${historicoFiltrado.slice().reverse().map(h => `
                            <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #eef2f7; font-size:13px;">
                                <span>
                                    <strong>${h.acao}</strong> 
                                    <span style="color:#666; font-size:11px;">${h.tipo === 'moido-sujo' ? '🟡 Sujo' : '🔵 Lavado'}</span>
                                    - ${h.detalhes}
                                </span>
                                <span style="color:#888; font-size:11px;">${formatarDataCompleta(h.data)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            historicoHtml = `
                <div style="margin-top:16px; text-align:center; color:#888; padding:20px;">
                    <i class="fas fa-history" style="font-size:24px; display:block; margin-bottom:8px;"></i>
                    Nenhum histórico encontrado para este tipo.
                </div>
            `;
        }
    } else {
        historicoHtml = `
            <div style="margin-top:16px; text-align:center; color:#888; padding:20px;">
                <i class="fas fa-history" style="font-size:24px; display:block; margin-bottom:8px;"></i>
                Nenhum histórico registrado.
            </div>
        `;
    }
    
    conteudo.innerHTML = `
        <div style="display:grid; gap:16px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div style="background:#f8f9fc; padding:12px 16px; border-radius:8px;">
                    <span style="font-size:12px; color:#888; display:block;">Nome da Baia</span>
                    <span style="font-size:16px; font-weight:600; color:#1a2a3a;">${item.nome || '-'}</span>
                </div>
                <div style="background:#f8f9fc; padding:12px 16px; border-radius:8px;">
                    <span style="font-size:12px; color:#888; display:block;">Tipo</span>
                    <span style="font-size:16px; font-weight:600; color:#1a2a3a;">${tipoLabel}</span>
                </div>
                <div style="background:#f8f9fc; padding:12px 16px; border-radius:8px;">
                    <span style="font-size:12px; color:#888; display:block;">Material</span>
                    <span style="font-size:16px; font-weight:600; color:#1a2a3a;">${item.material || '-'}</span>
                </div>
                <div style="background:#f8f9fc; padding:12px 16px; border-radius:8px;">
                    <span style="font-size:12px; color:#888; display:block;">Quantidade (Bags)</span>
                    <span style="font-size:16px; font-weight:600; color:#1a2a3a;">${quantidade.toFixed(1)}</span>
                </div>
                <div style="background:#f8f9fc; padding:12px 16px; border-radius:8px;">
                    <span style="font-size:12px; color:#888; display:block;">Estimativa (kg/Bag)</span>
                    <span style="font-size:16px; font-weight:600; color:#1a2a3a;">${estimativa.toFixed(1)}</span>
                </div>
                <div style="background:#eafaf1; padding:12px 16px; border-radius:8px; border:2px solid #27ae60;">
                    <span style="font-size:12px; color:#27ae60; display:block;">Total Estimado</span>
                    <span style="font-size:20px; font-weight:700; color:#27ae60;">${totalKg} kg</span>
                </div>
            </div>
            ${item.observacao ? `
                <div style="background:#f8f9fc; padding:12px 16px; border-radius:8px;">
                    <span style="font-size:12px; color:#888; display:block;">Observação</span>
                    <span style="font-size:14px; color:#1a2a3a;">${item.observacao}</span>
                </div>
            ` : ''}
            <div style="background:#f8f9fc; padding:12px 16px; border-radius:8px; display:flex; gap:16px; flex-wrap:wrap;">
                <div>
                    <span style="font-size:12px; color:#888; display:block;">Data de Criação</span>
                    <span style="font-size:14px; color:#1a2a3a;">${formatarDataCompleta(item.dataCriacao)}</span>
                </div>
                <div>
                    <span style="font-size:12px; color:#888; display:block;">ID</span>
                    <span style="font-size:12px; color:#888;">${item.id || '-'}</span>
                </div>
            </div>
            ${historicoHtml}
        </div>
    `;
    
    window._detalheBaiaIndex = index;
    modal.classList.add('active');
};

// ========== CONFIRMAR EXCLUSÃO ==========
window.confirmarExclusaoBaia = function(index) {
    const item = filteredData[index];
    if (!item) return;
    
    const realIndex = baiasData.findIndex(b => b.id === item.id);
    if (realIndex === -1) return;
    
    deleteIndex = realIndex;
    
    const modal = document.getElementById('modalConfirmacao');
    const mensagem = document.getElementById('confirmacaoMensagem');
    
    if (modal && mensagem) {
        mensagem.textContent = `Tem certeza que deseja excluir a baia "${item.nome}"? Esta ação não pode ser desfeita.`;
        modal.classList.add('active');
    }
};

// ========== CONFIRMAR EXCLUSÃO ==========
function confirmarExclusao() {
    if (deleteIndex === -1) return;
    
    const item = baiasData[deleteIndex];
    if (!item) return;
    
    mostrarLoading(true);
    
    if (item.id && !item.id.startsWith('local_')) {
        excluirDoFirebase(item.id)
            .then(() => {
                baiasData.splice(deleteIndex, 1);
                atualizarTudo();
                fecharModal('modalConfirmacao');
                mostrarLoading(false);
                mostrarNotificacao('Baia excluída com sucesso!', 'success');
                deleteIndex = -1;
            })
            .catch((error) => {
                console.error('❌ Erro ao excluir:', error);
                baiasData.splice(deleteIndex, 1);
                atualizarTudo();
                fecharModal('modalConfirmacao');
                mostrarLoading(false);
                mostrarNotificacao('Baia excluída localmente (erro no Firebase)', 'warning');
                deleteIndex = -1;
            });
    } else {
        baiasData.splice(deleteIndex, 1);
        atualizarTudo();
        fecharModal('modalConfirmacao');
        mostrarLoading(false);
        mostrarNotificacao('Baia excluída!', 'success');
        deleteIndex = -1;
    }
}

// ========== GERAR PDF DO ESTOQUE ==========
window.gerarPDFEstoque = function() {
    if (baiasData.length === 0) {
        alert('Não há dados para gerar o PDF.');
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape', 'mm', 'a4');
        
        doc.setFontSize(20);
        doc.setTextColor(26, 42, 58);
        doc.text('Controle de Estoque - Mil Plásticos', 20, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 20, 28);
        
        const totalBags = baiasData.reduce((sum, i) => sum + parseFloat(i.quantidade), 0);
        const totalKg = baiasData.reduce((sum, i) => sum + (parseFloat(i.quantidade) * parseFloat(i.estimativaKg)), 0);
        
        doc.setFontSize(11);
        doc.setTextColor(26, 42, 58);
        doc.text(`Total de Baias: ${baiasData.length}`, 20, 38);
        doc.text(`Total de Bags: ${totalBags.toFixed(1)}`, 80, 38);
        doc.text(`Total Estimado: ${totalKg.toFixed(1)} kg`, 140, 38);
        
        const tableData = baiasData.map(item => [
            item.nome || '-',
            item.material || '-',
            item.tipo === 'moido-sujo' ? 'Moído Sujo' : 'Moído Lavado',
            (parseFloat(item.quantidade) || 0).toFixed(1),
            (parseFloat(item.estimativaKg) || 0).toFixed(1),
            ((parseFloat(item.quantidade) || 0) * (parseFloat(item.estimativaKg) || 0)).toFixed(1) + ' kg'
        ]);
        
        doc.autoTable({
            startY: 45,
            head: [['Baia', 'Material', 'Tipo', 'Bags', 'kg/Bag', 'Total']],
            body: tableData,
            theme: 'striped',
            headStyles: {
                fillColor: [26, 42, 58],
                textColor: [255, 255, 255],
                fontSize: 10,
                fontStyle: 'bold'
            },
            bodyStyles: {
                fontSize: 9
            },
            columnStyles: {
                0: { cellWidth: 35 },
                1: { cellWidth: 30 },
                2: { cellWidth: 30 },
                3: { cellWidth: 25, halign: 'center' },
                4: { cellWidth: 25, halign: 'center' },
                5: { cellWidth: 30, halign: 'right' }
            }
        });
        
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(
                `Página ${i} de ${pageCount} - Mil Plásticos`,
                20,
                doc.internal.pageSize.height - 10
            );
        }
        
        doc.save('controle_estoque.pdf');
        mostrarNotificacao('PDF gerado com sucesso!', 'success');
    } catch (error) {
        console.error('❌ Erro ao gerar PDF:', error);
        alert('Erro ao gerar PDF. Verifique o console para mais detalhes.');
    }
};

// ========== GERAR PDF DA BAIA ==========
window.gerarPDFBaia = function() {
    const index = window._detalheBaiaIndex;
    if (index === undefined) {
        alert('Selecione uma baia primeiro.');
        return;
    }
    
    const item = filteredData[index];
    if (!item) return;
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('portrait', 'mm', 'a4');
        const quantidade = parseFloat(item.quantidade) || 0;
        const estimativa = parseFloat(item.estimativaKg) || 0;
        const totalKg = (quantidade * estimativa).toFixed(1);
        const tipoLabel = item.tipo === 'moido-sujo' ? 'Moído Sujo' : 'Moído Lavado';
        
        doc.setFontSize(22);
        doc.setTextColor(26, 42, 58);
        doc.text('Detalhes da Baia', 20, 25);
        
        doc.setDrawColor(200, 200, 200);
        doc.line(20, 30, 190, 30);
        
        doc.setFontSize(12);
        doc.setTextColor(26, 42, 58);
        
        const dados = [
            ['Nome da Baia', item.nome || '-'],
            ['Tipo', tipoLabel],
            ['Material', item.material || '-'],
            ['Quantidade (Bags)', quantidade.toFixed(1)],
            ['Estimativa (kg/Bag)', estimativa.toFixed(1)],
            ['Total Estimado', `${totalKg} kg`],
            ['Data de Criação', formatarDataCompleta(item.dataCriacao)],
            ['Observação', item.observacao || 'Nenhuma']
        ];
        
        let y = 45;
        dados.forEach(([label, value]) => {
            doc.setFont('helvetica', 'bold');
            doc.text(label + ':', 20, y);
            doc.setFont('helvetica', 'normal');
            doc.text(String(value), 65, y);
            y += 10;
        });
        
        // Histórico filtrado por tipo
        if (item.historico && item.historico.length > 0) {
            const historicoFiltrado = item.historico.filter(h => h.tipo === item.tipo);
            
            if (historicoFiltrado.length > 0) {
                y += 5;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.text(`Histórico de Movimentações (${tipoLabel}):`, 20, y);
                y += 6;
                
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                historicoFiltrado.slice().reverse().forEach(h => {
                    doc.text(`• ${h.acao}: ${h.detalhes}`, 25, y);
                    y += 5;
                    doc.setTextColor(150, 150, 150);
                    doc.text(`  ${formatarDataCompleta(h.data)}`, 28, y);
                    doc.setTextColor(26, 42, 58);
                    y += 6;
                });
            }
        }
        
        doc.setDrawColor(39, 174, 96);
        doc.setFillColor(234, 250, 241);
        doc.rect(20, y + 5, 170, 15, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(39, 174, 96);
        doc.text(`Total Estimado: ${totalKg} kg`, 25, y + 16);
        
        doc.save(`baia_${item.nome || 'sem_nome'}.pdf`);
        mostrarNotificacao('PDF da baia gerado com sucesso!', 'success');
    } catch (error) {
        console.error('❌ Erro ao gerar PDF da baia:', error);
        alert('Erro ao gerar PDF. Verifique o console para mais detalhes.');
    }
};

// ========== EXPORTAR DADOS ==========
window.exportarDados = function() {
    if (baiasData.length === 0) {
        alert('Não há dados para exportar.');
        return;
    }
    
    try {
        const dados = {
            exportadoEm: new Date().toISOString(),
            totalBaias: baiasData.length,
            dados: baiasData
        };
        
        const json = JSON.stringify(dados, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `estoque_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        mostrarNotificacao('Dados exportados com sucesso!', 'success');
    } catch (error) {
        console.error('❌ Erro ao exportar:', error);
        alert('Erro ao exportar dados.');
    }
};

// ========== IMPORTAR DADOS ==========
window.importarDados = function() {
    const modal = document.getElementById('modalImportar');
    if (modal) {
        document.getElementById('arquivoImportar').value = '';
        modal.classList.add('active');
    }
};

// ========== CONFIRMAR IMPORTAR ==========
window.confirmarImportar = function() {
    const input = document.getElementById('arquivoImportar');
    if (!input || !input.files || input.files.length === 0) {
        alert('Por favor, selecione um arquivo JSON.');
        return;
    }
    
    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const dados = JSON.parse(e.target.result);
            
            if (!dados.dados || !Array.isArray(dados.dados)) {
                alert('Arquivo inválido. Certifique-se de que é um arquivo JSON exportado do sistema.');
                return;
            }
            
            if (dados.dados.length === 0) {
                alert('O arquivo não contém dados para importar.');
                return;
            }
            
            const confirmar = confirm(
                `Este arquivo contém ${dados.dados.length} baias.\n` +
                `Data de exportação: ${new Date(dados.exportadoEm).toLocaleString('pt-BR')}\n\n` +
                `Deseja importar estes dados? (Os dados atuais serão substituídos)`
            );
            
            if (!confirmar) return;
            
            mostrarLoading(true);
            
            const novasBaias = dados.dados.map(item => ({
                ...item,
                id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                quantidade: parseFloat(item.quantidade) || 0,
                estimativaKg: parseFloat(item.estimativaKg) || 0,
                totalKg: parseFloat(item.quantidade) * parseFloat(item.estimativaKg) || 0,
                historico: item.historico || []
            }));
            
            baiasData = novasBaias;
            atualizarTudo();
            fecharModal('modalImportar');
            mostrarLoading(false);
            
            mostrarNotificacao(`${novasBaias.length} baias importadas com sucesso!`, 'success');
        } catch (error) {
            console.error('❌ Erro ao importar:', error);
            alert('Erro ao importar arquivo. Certifique-se de que é um JSON válido.');
        }
    };
    
    reader.onerror = function() {
        alert('Erro ao ler o arquivo.');
    };
    
    reader.readAsText(file);
};

// ========== FUNÇÕES UTILITÁRIAS ==========

function formatarData(data) {
    if (!data) return '-';
    try {
        const d = new Date(data);
        return d.toLocaleDateString('pt-BR');
    } catch {
        return '-';
    }
}

function formatarDataCompleta(data) {
    if (!data) return '-';
    try {
        const d = new Date(data);
        return d.toLocaleString('pt-BR');
    } catch {
        return '-';
    }
}

function atualizarPreviewEstimativa() {
    const qtd = parseFloat(document.getElementById('qtdBag')?.value) || 0;
    const kg = parseFloat(document.getElementById('estimativaKg')?.value) || 0;
    const preview = document.getElementById('previewEstimada');
    const totalField = document.getElementById('totalCalculado');
    const total = qtd * kg;
    
    if (preview) {
        preview.textContent = total.toFixed(1);
    }
    
    if (totalField) {
        totalField.textContent = total.toFixed(1) + ' kg';
    }
}

window.fecharModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
};

function mostrarLoading(ativo) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        if (ativo) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }
}

function mostrarNotificacao(mensagem, tipo = 'info') {
    const notificacao = document.createElement('div');
    notificacao.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 16px 24px;
        background: ${tipo === 'success' ? '#27ae60' : tipo === 'warning' ? '#f39c12' : '#3498db'};
        color: #fff;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        z-index: 99999;
        font-family: 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: 500;
        max-width: 400px;
        transform: translateX(120%);
        transition: transform 0.4s ease;
        cursor: pointer;
    `;
    
    const icon = tipo === 'success' ? '✅' : tipo === 'warning' ? '⚠️' : 'ℹ️';
    notificacao.innerHTML = `${icon} ${mensagem}`;
    
    document.body.appendChild(notificacao);
    
    setTimeout(() => {
        notificacao.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        notificacao.style.transform = 'translateX(120%)';
        setTimeout(() => {
            if (notificacao.parentNode) {
                document.body.removeChild(notificacao);
            }
        }, 400);
    }, 4000);
    
    notificacao.addEventListener('click', function() {
        this.style.transform = 'translateX(120%)';
        setTimeout(() => {
            if (this.parentNode) {
                this.parentNode.removeChild(this);
            }
        }, 400);
    });
}

// ========== EXPORTAR FUNÇÕES GLOBAIS ==========
window.carregarDadosEstoque = carregarDadosEstoque;
window.filtrarEstoque = filtrarEstoque;
window.limparFiltros = limparFiltros;
window.mudarTipoEstoque = mudarTipoEstoque;
window.abrirModalBaia = abrirModalBaia;
window.fecharModalBaia = fecharModalBaia;
window.editarBaia = editarBaia;
window.verDetalhesBaia = verDetalhesBaia;
window.confirmarExclusaoBaia = confirmarExclusaoBaia;
window.gerarPDFEstoque = gerarPDFEstoque;
window.gerarPDFBaia = gerarPDFBaia;
window.exportarDados = exportarDados;
window.importarDados = importarDados;
window.confirmarImportar = confirmarImportar;
window.paginaAnterior = paginaAnterior;
window.proximaPagina = proximaPagina;
window.fecharModal = fecharModal;
window.limparFiltros = limparFiltros;

console.log('✅ Controle de Estoque inicializado com sucesso!');
console.log(`📊 ${baiasData.length} baias carregadas`);
