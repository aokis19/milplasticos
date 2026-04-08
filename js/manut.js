// ============================================
// MANUT.JS - Controle de Manutenção com Múltiplos Tipos
// ============================================

// Aguardar DOM carregar
document.addEventListener('DOMContentLoaded', function() {
    // Verificar se Firebase está disponível
    if (typeof db === 'undefined') {
        console.error('Firebase não carregado. Aguarde...');
        setTimeout(arguments.callee, 500);
        return;
    }
    
    iniciarSistemaManutencao();
});

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let veiculosLista = [];
let tiposManutencaoLista = [];
let veiculoSelecionado = null;

// ============================================
// FUNÇÕES PRINCIPAIS
// ============================================

function iniciarSistemaManutencao() {
    console.log('🚀 Sistema de Manutenção iniciado');
    
    carregarVeiculos();
    carregarTiposManutencao();
    carregarHistoricoManutencoes();
    carregarProximasManutencoes();
    
    configurarEventos();
}

// ============================================
// CARREGAR DADOS DO FIRESTORE
// ============================================

async function carregarVeiculos() {
    try {
        const snapshot = await db.collection('veiculos').orderBy('nome').get();
        veiculosLista = [];
        snapshot.forEach(doc => {
            veiculosLista.push({ id: doc.id, ...doc.data() });
        });
        
        atualizarSelectVeiculos();
        renderizarListaVeiculos();
    } catch (error) {
        console.error('Erro ao carregar veículos:', error);
    }
}

async function carregarTiposManutencao() {
    try {
        const snapshot = await db.collection('tiposManutencao').get();
        tiposManutencaoLista = [];
        snapshot.forEach(doc => {
            tiposManutencaoLista.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error('Erro ao carregar tipos:', error);
    }
}

async function carregarHistoricoManutencoes() {
    try {
        const snapshot = await db.collection('manutencoes').orderBy('data', 'desc').limit(100).get();
        const tbody = document.getElementById('tabelaOleoBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        for (const doc of snapshot.docs) {
            const manut = doc.data();
            const veiculo = veiculosLista.find(v => v.id === manut.veiculoId);
            const tipo = tiposManutencaoLista.find(t => t.id === manut.tipoId);
            
            if (!veiculo) continue;
            
            const status = calcularStatus(manut.kmAtual, manut.proximaManutencao, manut.intervalo);
            const unidade = veiculo.unidade || 'KM';
            
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${new Date(manut.data).toLocaleDateString('pt-BR')}</td>
                <td>${veiculo.nome}</td>
                <td>${tipo ? tipo.nome : manut.tipoNome || 'N/A'}</td>
                <td>${manut.kmAtual} ${unidade}</td>
                <td>${manut.proximaManutencao} ${unidade}</td>
                <td><span class="status-badge ${status.classe}">${status.texto}</span></td>
                <td>
                    <button class="btn-excluir-manutencao btn-sm" data-id="${doc.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
        }
        
        // Eventos excluir
        document.querySelectorAll('.btn-excluir-manutencao').forEach(btn => {
            btn.addEventListener('click', () => excluirManutencao(btn.dataset.id));
        });
        
        const totalSpan = document.getElementById('totalTrocasOleo');
        if (totalSpan) totalSpan.textContent = `${snapshot.size} registros`;
        
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
    }
}

async function carregarProximasManutencoes() {
    try {
        const container = document.getElementById('programadasContainer');
        if (!container) return;
        
        // Buscar todos os tipos ativos
        const tiposSnapshot = await db.collection('tiposManutencao').where('ativo', '==', true).get();
        const proximas = [];
        
        for (const tipoDoc of tiposSnapshot.docs) {
            const tipo = tipoDoc.data();
            const veiculo = veiculosLista.find(v => v.id === tipo.veiculoId);
            if (!veiculo) continue;
            
            // Buscar última manutenção deste tipo
            const ultimaSnap = await db.collection('manutencoes')
                .where('veiculoId', '==', tipo.veiculoId)
                .where('tipoId', '==', tipoDoc.id)
                .orderBy('data', 'desc')
                .limit(1)
                .get();
            
            let proximoKm = tipo.intervalo;
            let ultimaData = 'Nunca';
            let ultimoKm = 0;
            
            if (!ultimaSnap.empty) {
                const ultima = ultimaSnap.docs[0].data();
                proximoKm = ultima.kmAtual + tipo.intervalo;
                ultimaData = new Date(ultima.data).toLocaleDateString('pt-BR');
                ultimoKm = ultima.kmAtual;
            }
            
            const status = calcularStatus(ultimoKm, proximoKm, tipo.intervalo);
            const unidade = veiculo.unidade || 'KM';
            
            proximas.push({
                veiculoNome: veiculo.nome,
                tipoNome: tipo.nome,
                proximoKm: proximoKm,
                intervalo: tipo.intervalo,
                unidade: unidade,
                ultimaData: ultimaData,
                status: status
            });
        }
        
        // Ordenar por mais próximo
        proximas.sort((a, b) => a.proximoKm - b.proximoKm);
        
        if (proximas.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#999;">Nenhuma manutenção programada.</p>';
        } else {
            container.innerHTML = proximas.map(p => `
                <div class="programada-item">
                    <div class="programada-header">
                        <strong>${p.veiculoNome}</strong> - ${p.tipoNome}
                        <span class="status-badge ${p.status.classe}">${p.status.texto}</span>
                    </div>
                    <div class="programada-info">
                        Próxima: ${p.proximoKm} ${p.unidade} | 
                        Intervalo: ${p.intervalo} ${p.unidade} |
                        Última: ${p.ultimaData}
                    </div>
                </div>
            `).join('');
        }
        
        const totalSpan = document.getElementById('totalProgramadas');
        if (totalSpan) totalSpan.textContent = `${proximas.length} programadas`;
        
    } catch (error) {
        console.error('Erro ao carregar próximas:', error);
    }
}

// ============================================
// FUNÇÕES DE CÁLCULO
// ============================================

function calcularStatus(kmAtual, proximaManutencao, intervalo) {
    const diferenca = proximaManutencao - kmAtual;
    
    if (diferenca <= 0) {
        return { texto: 'Atrasada', classe: 'status-atrasada' };
    } else if (diferenca <= intervalo * 0.1) {
        return { texto: 'Urgente', classe: 'status-urgente' };
    } else if (diferenca <= intervalo * 0.2) {
        return { texto: 'Próximo', classe: 'status-proximo' };
    } else {
        return { texto: 'OK', classe: 'status-ok' };
    }
}

function formatarNumero(valor) {
    return Math.round(valor);
}

// ============================================
// CRUD - VEÍCULOS
// ============================================

async function adicionarVeiculo(nome, unidade = 'KM') {
    try {
        const docRef = await db.collection('veiculos').add({
            nome: nome,
            unidade: unidade,
            dataCriacao: new Date().toISOString(),
            ativo: true
        });
        await carregarVeiculos();
        mostrarAlerta('Veículo cadastrado com sucesso!', 'sucesso');
        return docRef.id;
    } catch (error) {
        console.error('Erro ao adicionar veículo:', error);
        mostrarAlerta('Erro ao cadastrar veículo!', 'erro');
    }
}

async function excluirVeiculo(veiculoId) {
    if (!confirm('Excluir este veículo e TODOS os registros de manutenção?')) return;
    
    try {
        // Excluir tipos de manutenção
        const tipos = await db.collection('tiposManutencao').where('veiculoId', '==', veiculoId).get();
        for (const tipo of tipos.docs) {
            // Excluir registros de manutenção deste tipo
            const manutencoes = await db.collection('manutencoes').where('tipoId', '==', tipo.id).get();
            for (const manut of manutencoes.docs) {
                await manut.ref.delete();
            }
            await tipo.ref.delete();
        }
        
        // Excluir veículo
        await db.collection('veiculos').doc(veiculoId).delete();
        
        await carregarVeiculos();
        await carregarHistoricoManutencoes();
        await carregarProximasManutencoes();
        mostrarAlerta('Veículo excluído!', 'sucesso');
    } catch (error) {
        console.error('Erro ao excluir veículo:', error);
        mostrarAlerta('Erro ao excluir veículo!', 'erro');
    }
}

function renderizarListaVeiculos() {
    const container = document.getElementById('veiculosContainer');
    if (!container) return;
    
    if (veiculosLista.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#999;">Nenhum veículo cadastrado.</p>';
        return;
    }
    
    container.innerHTML = '';
    for (const veic of veiculosLista) {
        const tipos = tiposManutencaoLista.filter(t => t.veiculoId === veic.id);
        
        const card = document.createElement('div');
        card.className = 'veiculo-card';
        card.innerHTML = `
            <div class="veiculo-header">
                <h4><i class="fas fa-truck"></i> ${veic.nome}</h4>
                <div>
                    <button class="btn-config-tipos btn-sm" data-id="${veic.id}" data-nome="${veic.nome}">
                        <i class="fas fa-cog"></i> Tipos
                    </button>
                    <button class="btn-excluir-veiculo btn-sm" data-id="${veic.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="veiculo-body">
                <small>Tipos de manutenção:</small>
                <div class="tipos-list">
                    ${tipos.map(t => `<span class="tipo-tag">${t.nome} (${t.intervalo} ${veic.unidade || 'KM'})</span>`).join('') || '<span class="text-muted">Nenhum tipo configurado</span>'}
                </div>
            </div>
        `;
        container.appendChild(card);
    }
    
    // Eventos dos botões
    document.querySelectorAll('.btn-config-tipos').forEach(btn => {
        btn.addEventListener('click', () => abrirModalTipos(btn.dataset.id, btn.dataset.nome));
    });
    document.querySelectorAll('.btn-excluir-veiculo').forEach(btn => {
        btn.addEventListener('click', () => excluirVeiculo(btn.dataset.id));
    });
}

// ============================================
// CRUD - TIPOS DE MANUTENÇÃO
// ============================================

async function adicionarTipoManutencao(veiculoId, nome, intervalo) {
    try {
        const veiculo = veiculosLista.find(v => v.id === veiculoId);
        const unidade = veiculo?.unidade || 'KM';
        
        await db.collection('tiposManutencao').add({
            veiculoId: veiculoId,
            nome: nome,
            intervalo: parseInt(intervalo),
            unidade: unidade,
            ativo: true,
            dataCriacao: new Date().toISOString()
        });
        
        await carregarTiposManutencao();
        await carregarVeiculos();
        await carregarProximasManutencoes();
        mostrarAlerta('Tipo de manutenção adicionado!', 'sucesso');
    } catch (error) {
        console.error('Erro ao adicionar tipo:', error);
        mostrarAlerta('Erro ao adicionar tipo!', 'erro');
    }
}

async function removerTipoManutencao(tipoId) {
    if (!confirm('Remover este tipo de manutenção e todos os registros relacionados?')) return;
    
    try {
        // Excluir registros de manutenção deste tipo
        const manutencoes = await db.collection('manutencoes').where('tipoId', '==', tipoId).get();
        for (const manut of manutencoes.docs) {
            await manut.ref.delete();
        }
        
        await db.collection('tiposManutencao').doc(tipoId).delete();
        
        await carregarTiposManutencao();
        await carregarVeiculos();
        await carregarHistoricoManutencoes();
        await carregarProximasManutencoes();
        mostrarAlerta('Tipo removido!', 'sucesso');
    } catch (error) {
        console.error('Erro ao remover tipo:', error);
        mostrarAlerta('Erro ao remover tipo!', 'erro');
    }
}

function abrirModalTipos(veiculoId, veiculoNome) {
    const modal = document.getElementById('modalConfigTipos');
    if (!modal) return;
    
    document.getElementById('configVeiculoId').value = veiculoId;
    document.getElementById('configVeiculoNome').textContent = veiculoNome;
    
    const tipos = tiposManutencaoLista.filter(t => t.veiculoId === veiculoId);
    const container = document.getElementById('tiposManutencaoList');
    
    if (container) {
        container.innerHTML = tipos.map((tipo, idx) => `
            <div class="tipo-item" data-id="${tipo.id}">
                <div class="tipo-info">
                    <strong>${tipo.nome}</strong>
                    <span>Intervalo: ${tipo.intervalo} ${tipo.unidade}</span>
                </div>
                <button class="btn-remover-tipo btn-sm" data-id="${tipo.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
        
        if (tipos.length === 0) {
            container.innerHTML = '<p class="text-muted">Nenhum tipo configurado. Clique em "Adicionar" para começar.</p>';
        }
    }
    
    modal.classList.add('active');
    
    // Eventos dos botões remover
    document.querySelectorAll('.btn-remover-tipo').forEach(btn => {
        btn.addEventListener('click', () => removerTipoManutencao(btn.dataset.id));
    });
}

// ============================================
// CRUD - MANUTENÇÕES
// ============================================

async function registrarManutencao(veiculoId, tipoId, data, kmAtual, observacoes = '') {
    try {
        const tipo = tiposManutencaoLista.find(t => t.id === tipoId);
        if (!tipo) throw new Error('Tipo não encontrado');
        
        const proximaManutencao = parseInt(kmAtual) + tipo.intervalo;
        
        await db.collection('manutencoes').add({
            veiculoId: veiculoId,
            tipoId: tipoId,
            tipoNome: tipo.nome,
            data: data,
            kmAtual: parseInt(kmAtual),
            proximaManutencao: proximaManutencao,
            intervalo: tipo.intervalo,
            observacoes: observacoes,
            dataRegistro: new Date().toISOString()
        });
        
        await carregarHistoricoManutencoes();
        await carregarProximasManutencoes();
        mostrarAlerta('Manutenção registrada com sucesso!', 'sucesso');
        
    } catch (error) {
        console.error('Erro ao registrar manutenção:', error);
        mostrarAlerta('Erro ao registrar manutenção!', 'erro');
    }
}

async function excluirManutencao(manutencaoId) {
    if (!confirm('Excluir este registro de manutenção?')) return;
    
    try {
        await db.collection('manutencoes').doc(manutencaoId).delete();
        await carregarHistoricoManutencoes();
        await carregarProximasManutencoes();
        mostrarAlerta('Registro excluído!', 'sucesso');
    } catch (error) {
        console.error('Erro ao excluir manutenção:', error);
        mostrarAlerta('Erro ao excluir registro!', 'erro');
    }
}

// ============================================
// EVENTOS E UI
// ============================================

function atualizarSelectVeiculos() {
    const selectVeiculo = document.getElementById('veiculoOleo');
    const selectVeiculoManut = document.getElementById('veiculoManutencao');
    
    const options = '<option value="">Selecione...</option>' + 
        veiculosLista.map(v => `<option value="${v.id}" data-unidade="${v.unidade || 'KM'}">${v.nome} (${v.unidade || 'KM'})</option>`).join('');
    
    if (selectVeiculo) selectVeiculo.innerHTML = options;
    if (selectVeiculoManut) selectVeiculoManut.innerHTML = options;
}

async function carregarTiposPorVeiculo(veiculoId, selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    const tipos = tiposManutencaoLista.filter(t => t.veiculoId === veiculoId);
    
    select.innerHTML = '<option value="">Selecione o tipo...</option>';
    tipos.forEach(t => {
        select.innerHTML += `<option value="${t.id}" data-intervalo="${t.intervalo}">${t.nome} (a cada ${t.intervalo} ${t.unidade})</option>`;
    });
}

function abrirModalNovaManutencao() {
    const modal = document.getElementById('modalTrocaOleo');
    if (!modal) return;
    
    document.getElementById('formTrocaOleo').reset();
    document.getElementById('trocaId').value = '';
    document.getElementById('modalTrocaTitulo').innerHTML = '<i class="fas fa-oil-can"></i> Nova Troca de Óleo';
    modal.classList.add('active');
}

function abrirModalNovaManutencaoGeral() {
    const modal = document.getElementById('modalManutencaoGeral');
    if (!modal) return;
    
    document.getElementById('formManutencaoGeral').reset();
    document.getElementById('manutencaoId').value = '';
    document.getElementById('modalManutencaoTitulo').innerHTML = '<i class="fas fa-tools"></i> Nova Manutenção';
    modal.classList.add('active');
}

function abrirModalNovoVeiculo() {
    const modal = document.getElementById('modalNovoVeiculo');
    if (modal) modal.classList.add('active');
}

function fecharModais() {
    document.querySelectorAll('.modal-overlay, .modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

function configurarEventos() {
    // Botões principais
    const btnNovaTroca = document.getElementById('btnNovaTrocaOleo');
    if (btnNovaTroca) btnNovaTroca.addEventListener('click', abrirModalNovaManutencao);
    
    const btnNovaManutencao = document.getElementById('btnNovaManutencao');
    if (btnNovaManutencao) btnNovaManutencao.addEventListener('click', abrirModalNovaManutencaoGeral);
    
    const btnNovoVeiculo = document.getElementById('btnNovoVeiculo');
    if (btnNovoVeiculo) btnNovoVeiculo.addEventListener('click', abrirModalNovoVeiculo);
    
    const btnCheckAlertas = document.getElementById('btnCheckAlertas');
    if (btnCheckAlertas) btnCheckAlertas.addEventListener('click', carregarProximasManutencoes);
    
    // Fechar modais
    document.querySelectorAll('.close-modal, .modal-close').forEach(btn => {
        btn.addEventListener('click', fecharModais);
    });
    
    // Submit forms
    const formTrocaOleo = document.getElementById('formTrocaOleo');
    if (formTrocaOleo) {
        formTrocaOleo.addEventListener('submit', async (e) => {
            e.preventDefault();
            const veiculoId = document.getElementById('veiculoOleo').value;
            const tipoId = document.getElementById('tipoOleoSelect')?.value;
            const data = document.getElementById('dataTrocaOleo').value;
            const km = document.getElementById('kmTrocaOleo').value;
            const obs = document.getElementById('observacoesOleo').value;
            
            if (!tipoId) {
                mostrarAlerta('Selecione o tipo de manutenção!', 'erro');
                return;
            }
            
            await registrarManutencao(veiculoId, tipoId, data, km, obs);
            fecharModais();
        });
    }
    
    // Select veículo para carregar tipos
    const veiculoSelect = document.getElementById('veiculoOleo');
    if (veiculoSelect) {
        veiculoSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                carregarTiposPorVeiculo(e.target.value, 'tipoOleoSelect');
            }
        });
    }
    
    // Form novo veículo
    const salvarVeiculoBtn = document.getElementById('salvarNovoVeiculoBtn');
    if (salvarVeiculoBtn) {
        salvarVeiculoBtn.addEventListener('click', async () => {
            const nome = document.getElementById('novoVeiculoNome').value.trim();
            const unidade = document.getElementById('novoVeiculoUnidade').value;
            if (nome) {
                await adicionarVeiculo(nome, unidade);
                fecharModais();
                document.getElementById('novoVeiculoNome').value = '';
            } else {
                mostrarAlerta('Digite o nome do veículo!', 'erro');
            }
        });
    }
    
    // Form adicionar tipo
    const addTipoBtn = document.getElementById('btnAddTipoManutencao');
    if (addTipoBtn) {
        addTipoBtn.addEventListener('click', () => {
            const veiculoId = document.getElementById('configVeiculoId').value;
            const nome = prompt('Nome do tipo de manutenção:', 'Ex: Troca Óleo Motor');
            if (nome) {
                const intervalo = prompt('Intervalo (KM/Horas):', '200');
                if (intervalo) {
                    adicionarTipoManutencao(veiculoId, nome, intervalo);
                }
            }
        });
    }
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            const tabContent = document.getElementById(tabId);
            if (tabContent) tabContent.classList.add('active');
        });
    });
}

function mostrarAlerta(mensagem, tipo) {
    const alertaDiv = document.createElement('div');
    alertaDiv.className = `alerta-flutuante alerta-${tipo}`;
    alertaDiv.innerHTML = `<i class="fas ${tipo === 'sucesso' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${mensagem}`;
    alertaDiv.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; padding: 12px 20px;
        background: ${tipo === 'sucesso' ? '#27ae60' : '#e74c3c'}; color: white;
        border-radius: 8px; z-index: 9999; font-weight: bold;
        animation: fadeInOut 3s ease;
    `;
    document.body.appendChild(alertaDiv);
    setTimeout(() => alertaDiv.remove(), 3000);
}

// Adicionar CSS dinâmico para os novos elementos
const style = document.createElement('style');
style.textContent = `
    .status-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: bold; }
    .status-ok { background: #d4edda; color: #155724; }
    .status-proximo { background: #fff3cd; color: #856404; }
    .status-urgente { background: #f8d7da; color: #721c24; }
    .status-atrasada { background: #f8d7da; color: #721c24; }
    
    .veiculo-card { background: white; border-radius: 8px; padding: 15px; margin-bottom: 15px; border: 1px solid #ddd; }
    .veiculo-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 10px; }
    .veiculo-body { margin-top: 10px; }
    .tipos-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .tipo-tag { background: #e8f4fd; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; }
    
    .programada-item { background: #f8f9fa; border-radius: 8px; padding: 12px; margin-bottom: 10px; border-left: 3px solid #3498db; }
    .programada-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px; }
    .programada-info { font-size: 0.85rem; color: #666; }
    
    .tipo-item { display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f8f9fa; margin-bottom: 8px; border-radius: 6px; }
    .tipo-info { display: flex; gap: 15px; flex-wrap: wrap; }
    
    .btn-sm { padding: 5px 10px; font-size: 0.75rem; border-radius: 4px; cursor: pointer; border: none; }
    .btn-config-tipos { background: #f39c12; color: white; }
    .btn-excluir-veiculo { background: #e74c3c; color: white; }
    .btn-remover-tipo { background: #e74c3c; color: white; }
    .btn-excluir-manutencao { background: #e74c3c; color: white; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; }
    
    @keyframes fadeInOut { 0% { opacity: 0; transform: translateX(100%); } 15% { opacity: 1; transform: translateX(0); } 85% { opacity: 1; transform: translateX(0); } 100% { opacity: 0; transform: translateX(100%); } }
`;
document.head.appendChild(style);
