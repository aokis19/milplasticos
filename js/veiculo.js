// ==========================================================================
// /js/veiculo.js - Versão Cloud (Completa)
// 100% Firebase - Sem localStorage
// ==========================================================================

console.log('🚗 Sistema de Veículos - Modo Cloud');

// ============ REFERÊNCIA DO FIREBASE ============
function getDB() {
    return window.db || window.firebaseDB || null;
}

// ============ INICIALIZAÇÃO ============
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 Inicializando veículos...');
    
    const formVeiculo = document.getElementById('formVeiculo');
    
    if (formVeiculo) {
        formVeiculo.addEventListener('submit', async function(e) {
            e.preventDefault();
            await salvarVeiculo();
        });
    }
    
    // Botão limpar
    document.getElementById('btnLimpar')?.addEventListener('click', function() {
        formVeiculo?.reset();
        document.getElementById('placa')?.focus();
    });
    
    // Filtro de busca
    document.getElementById('filterInput')?.addEventListener('input', function(e) {
        filtrarVeiculos(e.target.value);
    });
    
    // Carregar veículos
    carregarVeiculos();
});

// ============ CARREGAR VEÍCULOS ============
async function carregarVeiculos() {
    console.log('🔄 Buscando veículos do Firebase...');
    
    const db = getDB();
    if (!db) {
        console.error('❌ Firebase não disponível');
        return;
    }
    
    try {
        const snapshot = await db.collection('veiculos')
            .orderBy('dataCadastro', 'desc')
            .get();
        
        const veiculos = [];
        snapshot.forEach(doc => {
            veiculos.push({ id: doc.id, firebaseId: doc.id, ...doc.data() });
        });
        
        console.log(`✅ ${veiculos.length} veículos carregados do Firebase`);
        
        // Armazenar em cache na memória para filtro
        window._veiculosCache = veiculos;
        
        atualizarTabela(veiculos);
        
        // Atualizar badge
        const badge = document.getElementById('totalVeiculos');
        if (badge) badge.textContent = `${veiculos.length} veículos`;
        
    } catch (error) {
        console.error('❌ Erro ao carregar veículos:', error);
    }
}

// ============ SALVAR VEÍCULO ============
async function salvarVeiculo() {
    const db = getDB();
    if (!db) {
        alert('❌ Sistema sem conexão');
        return;
    }
    
    const placa = document.getElementById('placa')?.value?.toUpperCase();
    const modelo = document.getElementById('modelo')?.value;
    const renavam = document.getElementById('renavam')?.value;
    
    if (!placa || !modelo || !renavam) {
        alert('❌ Preencha todos os campos obrigatórios!');
        return;
    }
    
    const veiculo = {
        placa: placa,
        modelo: modelo,
        renavam: renavam,
        ano: document.getElementById('ano')?.value || null,
        cor: document.getElementById('cor')?.value || null,
        medidor: document.getElementById('medidor')?.value || 'Km',
        combustivel: document.getElementById('combustivel')?.value || 'Diesel S10',
        status: document.getElementById('status')?.value || 'Ativo',
        dataCadastro: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        const docRef = await db.collection('veiculos').add(veiculo);
        console.log('✅ Veículo salvo no Firebase com ID:', docRef.id);
        
        document.getElementById('formVeiculo')?.reset();
        await carregarVeiculos();
        
        alert('✅ Veículo cadastrado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao salvar:', error);
        alert('❌ Erro ao salvar veículo');
    }
}

// ============ EXCLUIR VEÍCULO ============
async function excluirVeiculo(id, placa) {
    if (!confirm(`Tem certeza que deseja excluir o veículo ${placa}?`)) return;
    
    const db = getDB();
    if (!db) {
        alert('❌ Sistema sem conexão');
        return;
    }
    
    try {
        await db.collection('veiculos').doc(id).delete();
        console.log('✅ Veículo excluído:', id);
        
        await carregarVeiculos();
        alert('✅ Veículo excluído com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao excluir:', error);
        alert('❌ Erro ao excluir veículo');
    }
}

// ============ EDITAR VEÍCULO ============
async function editarVeiculo(id) {
    const db = getDB();
    if (!db) return;
    
    try {
        const doc = await db.collection('veiculos').doc(id).get();
        if (!doc.exists) return;
        
        const veiculo = doc.data();
        
        document.getElementById('placa').value = veiculo.placa || '';
        document.getElementById('modelo').value = veiculo.modelo || '';
        document.getElementById('renavam').value = veiculo.renavam || '';
        document.getElementById('ano').value = veiculo.ano || '';
        document.getElementById('cor').value = veiculo.cor || '';
        document.getElementById('medidor').value = veiculo.medidor || 'Km';
        document.getElementById('combustivel').value = veiculo.combustivel || 'Diesel S10';
        document.getElementById('status').value = veiculo.status || 'Ativo';
        
        // Mudar formulário para modo edição
        const form = document.getElementById('formVeiculo');
        if (form) {
            form.dataset.editId = id;
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Atualizar Veículo';
        }
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        console.error('❌ Erro ao carregar veículo para edição:', error);
    }
}

// ============ ATUALIZAR VEÍCULO ============
async function atualizarVeiculo(id) {
    const db = getDB();
    if (!db) return;
    
    const veiculo = {
        placa: document.getElementById('placa')?.value?.toUpperCase(),
        modelo: document.getElementById('modelo')?.value,
        renavam: document.getElementById('renavam')?.value,
        ano: document.getElementById('ano')?.value || null,
        cor: document.getElementById('cor')?.value || null,
        medidor: document.getElementById('medidor')?.value || 'Km',
        combustivel: document.getElementById('combustivel')?.value || 'Diesel S10',
        status: document.getElementById('status')?.value || 'Ativo',
        ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await db.collection('veiculos').doc(id).update(veiculo);
        console.log('✅ Veículo atualizado:', id);
        
        document.getElementById('formVeiculo')?.reset();
        const form = document.getElementById('formVeiculo');
        if (form) {
            form.dataset.editId = '';
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Cadastrar Veículo';
        }
        
        await carregarVeiculos();
        alert('✅ Veículo atualizado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao atualizar:', error);
        alert('❌ Erro ao atualizar veículo');
    }
}

// ============ ATUALIZAR TABELA ============
function atualizarTabela(veiculos) {
    const tbody = document.getElementById('tabelaBody');
    if (!tbody) {
        console.error('❌ Elemento tabelaBody não encontrado');
        return;
    }
    
    if (!veiculos || veiculos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem;">
                    <i class="fas fa-truck" style="font-size: 2rem; opacity: 0.3; display: block; margin-bottom: 0.5rem;"></i>
                    <span style="opacity: 0.6;">Nenhum veículo cadastrado</span>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = veiculos.map(veiculo => `
        <tr>
            <td><strong>${veiculo.placa || '-'}</strong></td>
            <td>${veiculo.modelo || '-'}</td>
            <td>${veiculo.renavam || '-'}</td>
            <td>${veiculo.ano || '-'}</td>
            <td>${veiculo.medidor || '-'}</td>
            <td>
                <span class="badge badge-info">
                    <i class="fas fa-gas-pump"></i> ${veiculo.combustivel || '-'}
                </span>
            </td>
            <td>
                <span class="badge ${getStatusClass(veiculo.status)}">
                    ${veiculo.status || 'Ativo'}
                </span>
            </td>
            <td style="white-space: nowrap;">
                <button class="btn btn-sm btn-outline" onclick="editarVeiculo('${veiculo.id}')" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="excluirVeiculo('${veiculo.id}', '${veiculo.placa}')" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ============ FILTRAR VEÍCULOS ============
function filtrarVeiculos(termo) {
    const veiculos = window._veiculosCache || [];
    
    if (!termo || termo.trim() === '') {
        atualizarTabela(veiculos);
        return;
    }
    
    const termoLower = termo.toLowerCase();
    const filtrados = veiculos.filter(v => 
        (v.placa && v.placa.toLowerCase().includes(termoLower)) ||
        (v.modelo && v.modelo.toLowerCase().includes(termoLower)) ||
        (v.renavam && v.renavam.toLowerCase().includes(termoLower)) ||
        (v.combustivel && v.combustivel.toLowerCase().includes(termoLower))
    );
    
    atualizarTabela(filtrados);
}

// ============ AUXILIAR ============
function getStatusClass(status) {
    switch (status) {
        case 'Ativo': return 'badge-success';
        case 'Manutenção': return 'badge-warning';
        case 'Inativo': return 'badge-danger';
        default: return 'badge-info';
    }
}

// ============ EXPORTAR FUNÇÕES GLOBAIS ============
window.carregarVeiculos = carregarVeiculos;
window.excluirVeiculo = excluirVeiculo;
window.editarVeiculo = editarVeiculo;
window.atualizarVeiculo = atualizarVeiculo;

console.log('✅ Sistema de Veículos pronto (100% Firebase)');
