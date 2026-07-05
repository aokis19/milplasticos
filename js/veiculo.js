// /js/veiculo.js - Versão Cloud

console.log('🚗 Sistema de Veículos - Modo Cloud');

// Aguardar DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 Inicializando veículos...');
    
    const formVeiculo = document.getElementById('formVeiculo');
    
    if (formVeiculo) {
        formVeiculo.addEventListener('submit', async function(e) {
            e.preventDefault();
            await salvarVeiculo();
        });
    }
    
    // Carregar veículos diretamente do Firebase
    carregarVeiculos();
});

// Carregar veículos DIRETO do Firebase
async function carregarVeiculos() {
    console.log('🔄 Buscando veículos do Firebase...');
    
    const db = window.db || window.firebaseDB;
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
            veiculos.push({ id: doc.id, ...doc.data() });
        });
        
        console.log(`✅ ${veiculos.length} veículos carregados do Firebase`);
        
        atualizarTabela(veiculos);
        
        // Atualizar badge
        const badge = document.getElementById('totalVeiculos');
        if (badge) badge.textContent = `${veiculos.length} veículos`;
        
    } catch (error) {
        console.error('❌ Erro ao carregar veículos:', error);
    }
}

// Salvar veículo DIRETO no Firebase
async function salvarVeiculo() {
    const db = window.db || window.firebaseDB;
    if (!db) {
        alert('❌ Sistema sem conexão');
        return;
    }
    
    const veiculo = {
        placa: document.getElementById('placa').value.toUpperCase(),
        modelo: document.getElementById('modelo').value,
        renavam: document.getElementById('renavam').value,
        ano: document.getElementById('ano').value || null,
        cor: document.getElementById('cor').value || null,
        medidor: document.getElementById('medidor').value,
        combustivel: document.getElementById('combustivel').value,
        status: document.getElementById('status').value || 'Ativo',
        dataCadastro: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await db.collection('veiculos').add(veiculo);
        console.log('✅ Veículo salvo no Firebase');
        
        document.getElementById('formVeiculo').reset();
        await carregarVeiculos(); // Recarregar do Firebase
        
        alert('✅ Veículo cadastrado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao salvar:', error);
        alert('❌ Erro ao salvar veículo');
    }
}

// Outras funções permanecem similares...
// (atualizarTabela, excluirVeiculo, etc. - todas usando Firebase direto)
