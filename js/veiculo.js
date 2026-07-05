// /js/veiculo.js
// Sistema de Cadastro de Veículos

console.log('🚗 Script veiculo.js carregado');

// Aguardar o DOM carregar completamente
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM carregado - Inicializando sistema de veículos');
    
    // Referências aos elementos
    const formVeiculo = document.getElementById('formVeiculo');
    const tabelaBody = document.getElementById('tabelaBody');
    const filterInput = document.getElementById('filterInput');
    const totalVeiculos = document.getElementById('totalVeiculos');
    const btnLimpar = document.getElementById('btnLimpar');
    
    // Verificar se os elementos existem
    if (!formVeiculo) {
        console.error('❌ Elemento formVeiculo não encontrado');
        return;
    }
    
    // Carregar veículos ao iniciar
    carregarVeiculos();
    
    // Evento de submit do formulário
    formVeiculo.addEventListener('submit', async function(e) {
        e.preventDefault();
        await salvarVeiculo();
    });
    
    // Evento de limpar formulário
    if (btnLimpar) {
        btnLimpar.addEventListener('click', limparFormulario);
    }
    
    // Evento de filtro
    if (filterInput) {
        filterInput.addEventListener('input', filtrarVeiculos);
    }
});

// Função para carregar veículos
async function carregarVeiculos() {
    try {
        // Verificar se o Firestore está disponível
        const db = window.db || window.firebaseDB;
        
        if (!db) {
            console.error('❌ Firestore não disponível');
            return;
        }
        
        console.log('🔄 Buscando veículos no Firestore...');
        
        const snapshot = await db.collection('veiculos')
            .orderBy('dataCadastro', 'desc')
            .get();
        
        const veiculos = [];
        snapshot.forEach(doc => {
            veiculos.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log(`✅ ${veiculos.length} veículos encontrados`);
        
        // Atualizar tabela
        atualizarTabela(veiculos);
        
        // Atualizar contador
        const totalElement = document.getElementById('totalVeiculos');
        if (totalElement) {
            totalElement.textContent = `${veiculos.length} veículos`;
        }
        
        // Armazenar em cache para filtro
        window._veiculosCache = veiculos;
        
    } catch (error) {
        console.error('❌ Erro ao carregar veículos:', error);
        alert('Erro ao carregar veículos. Verifique o console.');
    }
}

// Função para salvar veículo
async function salvarVeiculo() {
    try {
        const db = window.db || window.firebaseDB;
        
        if (!db) {
            console.error('❌ Firestore não disponível');
            return;
        }
        
        // Coletar dados do formulário
        const veiculo = {
            placa: document.getElementById('placa').value.toUpperCase(),
            modelo: document.getElementById('modelo').value,
            renavam: document.getElementById('renavam').value,
            ano: document.getElementById('ano').value || null,
            cor: document.getElementById('cor').value || null,
            medidor: document.getElementById('medidor').value,
            combustivel: document.getElementById('combustivel').value,
            status: document.getElementById('status').value || 'Ativo',
            dataCadastro: firebase.firestore.FieldValue.serverTimestamp(),
            ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        console.log('💾 Salvando veículo:', veiculo);
        
        // Salvar no Firestore
        const docRef = await db.collection('veiculos').add(veiculo);
        
        console.log('✅ Veículo salvo com ID:', docRef.id);
        
        // Limpar formulário
        limparFormulario();
        
        // Recarregar lista
        await carregarVeiculos();
        
        alert('✅ Veículo cadastrado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao salvar veículo:', error);
        alert('Erro ao salvar veículo. Verifique o console.');
    }
}

// Função para atualizar tabela
function atualizarTabela(veiculos) {
    const tabelaBody = document.getElementById('tabelaBody');
    
    if (!tabelaBody) {
        console.error('❌ Elemento tabelaBody não encontrado');
        return;
    }
    
    if (veiculos.length === 0) {
        tabelaBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem;">
                    <i class="fas fa-truck" style="font-size: 2rem; opacity: 0.3;"></i>
                    <p style="margin-top: 0.5rem; opacity: 0.6;">Nenhum veículo cadastrado</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tabelaBody.innerHTML = veiculos.map(veiculo => `
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
            <td>
                <button class="btn btn-sm btn-danger" onclick="excluirVeiculo('${veiculo.id}', '${veiculo.placa}')" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Função para filtrar veículos
function filtrarVeiculos() {
    const termo = document.getElementById('filterInput').value.toLowerCase();
    const veiculos = window._veiculosCache || [];
    
    const filtrados = veiculos.filter(v => 
        (v.placa && v.placa.toLowerCase().includes(termo)) ||
        (v.modelo && v.modelo.toLowerCase().includes(termo)) ||
        (v.renavam && v.renavam.toLowerCase().includes(termo))
    );
    
    atualizarTabela(filtrados);
}

// Função para excluir veículo
async function excluirVeiculo(id, placa) {
    if (!confirm(`Tem certeza que deseja excluir o veículo ${placa}?`)) {
        return;
    }
    
    try {
        const db = window.db || window.firebaseDB;
        
        if (!db) {
            console.error('❌ Firestore não disponível');
            return;
        }
        
        await db.collection('veiculos').doc(id).delete();
        
        console.log('✅ Veículo excluído:', id);
        
        // Recarregar lista
        await carregarVeiculos();
        
        alert('✅ Veículo excluído com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao excluir veículo:', error);
        alert('Erro ao excluir veículo.');
    }
}

// Função para limpar formulário
function limparFormulario() {
    document.getElementById('formVeiculo').reset();
    document.getElementById('placa').focus();
}

// Função auxiliar para classe de status
function getStatusClass(status) {
    switch (status) {
        case 'Ativo': return 'badge-success';
        case 'Manutenção': return 'badge-warning';
        case 'Inativo': return 'badge-danger';
        default: return 'badge-info';
    }
}

// Expor funções globalmente
window.excluirVeiculo = excluirVeiculo;
window.carregarVeiculos = carregarVeiculos;
