// ==========================================================================
// abastecimento.js - Versão 100% Firebase (Sem localStorage)
// ==========================================================================

// Aguardar Firebase
function aguardarFirebasePronto() {
    return new Promise((resolve) => {
        const db = window.db || window.firebaseDB;
        
        if (db) {
            console.log('✅ Firebase já disponível');
            resolve(db);
            return;
        }
        
        let tentativas = 0;
        const maxTentativas = 50;
        
        const verificar = setInterval(() => {
            tentativas++;
            const db = window.db || window.firebaseDB;
            
            if (db) {
                clearInterval(verificar);
                console.log('✅ Firebase conectado após', tentativas * 100, 'ms');
                resolve(db);
                return;
            }
            
            if (tentativas >= maxTentativas) {
                clearInterval(verificar);
                console.error('❌ Firebase não disponível após 5 segundos');
                resolve(null);
            }
        }, 100);
    });
}

// ==========================================================================
// CLASSE PRINCIPAL - 100% FIREBASE
// ==========================================================================
class GerenciadorAbastecimento {
    constructor() {
        this.db = null;
        this.abastecimentos = [];
        this.veiculos = [];
        this.editandoId = null;
        this.filtrosAtivos = {
            veiculo: '',
            periodo: '30',
            combustivel: '',
            busca: ''
        };
        
        this.inicializarAsync();
    }

    async inicializarAsync() {
        this.db = await aguardarFirebasePronto();
        
        if (!this.db) {
            console.error('❌ Sistema requer Firebase para funcionar');
            this.mostrarNotificacao('Erro: Firebase não disponível. Recarregue a página.', 'error');
            return;
        }
        
        await this.inicializar();
    }

    async inicializar() {
        console.log('🚛 Inicializando sistema de abastecimento (Cloud Mode)...');
        
        await this.carregarVeiculos();
        await this.carregarAbastecimentos();
        this.inicializarEventos();
        this.configurarAbas();
        this.atualizarSelectVeiculos();
        this.atualizarTabela();
        this.atualizarEstatisticas();
        this.carregarConsumoVeiculos();
        this.carregarEstatisticasGerais();
        
        console.log('✅ Sistema de abastecimento pronto!');
        console.log('   🚗 ' + this.veiculos.length + ' veículos carregados do Firebase');
        console.log('   ⛽ ' + this.abastecimentos.length + ' abastecimentos carregados do Firebase');
    }

    // ========== CARREGAR VEÍCULOS (FIREBASE DIRETO) ==========
    async carregarVeiculos() {
        try {
            console.log('🔄 Carregando veículos do Firebase...');
            
            const snapshot = await this.db.collection('veiculos')
                .orderBy('dataCadastro', 'desc')
                .get();
            
            this.veiculos = [];
            snapshot.forEach(doc => {
                this.veiculos.push({ 
                    firebaseId: doc.id, 
                    id: doc.id, // Para compatibilidade
                    ...doc.data() 
                });
            });
            
            console.log(`✅ ${this.veiculos.length} veículos carregados do Firebase`);
            
            // Se não houver veículos, não criar dados padrão
            if (this.veiculos.length === 0) {
                console.warn('⚠️ Nenhum veículo cadastrado. Cadastre veículos primeiro.');
                this.mostrarNotificacao('Nenhum veículo encontrado. Cadastre veículos primeiro!', 'warning');
            }
            
        } catch (error) {
            console.error('❌ Erro ao carregar veículos:', error);
            this.veiculos = [];
            this.mostrarNotificacao('Erro ao carregar veículos do Firebase', 'error');
        }
    }

    // ========== CARREGAR ABASTECIMENTOS (FIREBASE DIRETO) ==========
    async carregarAbastecimentos() {
        try {
            console.log('🔄 Carregando abastecimentos do Firebase...');
            
            const snapshot = await this.db.collection('abastecimentos')
                .orderBy('data', 'desc')
                .get();
            
            this.abastecimentos = [];
            snapshot.forEach(doc => {
                this.abastecimentos.push({ 
                    firebaseId: doc.id, 
                    ...doc.data() 
                });
            });
            
            console.log(`✅ ${this.abastecimentos.length} abastecimentos carregados do Firebase`);
            
        } catch (error) {
            console.error('❌ Erro ao carregar abastecimentos:', error);
            this.abastecimentos = [];
            this.mostrarNotificacao('Erro ao carregar abastecimentos', 'error');
        }
    }

    // ========== ATUALIZAR SELECT DE VEÍCULOS ==========
    atualizarSelectVeiculos() {
        const select = document.getElementById('veiculoAbastecimento');
        const filtroVeiculo = document.getElementById('filtroVeiculo');
        
        if (select) {
            select.innerHTML = '<option value="">Selecione um veículo...</option>';
            this.veiculos.forEach(veiculo => {
                const nomeVeiculo = veiculo.nome || veiculo.modelo || 'Sem nome';
                const medidor = veiculo.tipoMedidor || veiculo.medidor || 'km';
                select.innerHTML += `<option value="${veiculo.firebaseId || veiculo.id}">
                    ${veiculo.placa || 'SEM PLACA'} - ${nomeVeiculo} (${medidor.toUpperCase()})
                </option>`;
            });
        }
        
        if (filtroVeiculo) {
            filtroVeiculo.innerHTML = '<option value="">Todos os veículos</option>';
            this.veiculos.forEach(veiculo => {
                const nomeVeiculo = veiculo.nome || veiculo.modelo || 'Sem nome';
                filtroVeiculo.innerHTML += `<option value="${veiculo.firebaseId || veiculo.id}">
                    ${veiculo.placa || 'SEM PLACA'} - ${nomeVeiculo}
                </option>`;
            });
        }
    }

    // ========== SALVAR NO FIREBASE ==========
    async salvarNoFirebase(abastecimento) {
        if (!this.db) {
            console.error('❌ Firebase não disponível');
            return null;
        }
        
        try {
            const { firebaseId, id, ...dados } = abastecimento;
            
            // Adicionar timestamp
            dados.ultimaAtualizacao = firebase.firestore.FieldValue.serverTimestamp();
            
            if (firebaseId) {
                // Atualizar existente
                await this.db.collection('abastecimentos').doc(firebaseId).update(dados);
                console.log('✅ Abastecimento atualizado:', firebaseId);
                return firebaseId;
            } else {
                // Criar novo
                dados.dataRegistro = firebase.firestore.FieldValue.serverTimestamp();
                const docRef = await this.db.collection('abastecimentos').add(dados);
                console.log('✅ Abastecimento criado:', docRef.id);
                return docRef.id;
            }
        } catch (error) {
            console.error('❌ Erro ao salvar no Firebase:', error);
            this.mostrarNotificacao('Erro ao salvar no Firebase', 'error');
            return null;
        }
    }

    // ========== SALVAR ABASTECIMENTO ==========
    async salvarAbastecimento(event) {
        event.preventDefault();
        
        if (!this.db) {
            this.mostrarNotificacao('Sistema offline. Tente novamente.', 'error');
            return;
        }
        
        const veiculoId = document.getElementById('veiculoAbastecimento').value;
        if (!veiculoId) { 
            this.mostrarNotificacao('Selecione um veículo!', 'error'); 
            return; 
        }
        
        const data = document.getElementById('dataAbastecimento').value;
        if (!data) { 
            this.mostrarNotificacao('Selecione a data!', 'error'); 
            return; 
        }
        
        const veiculo = this.veiculos.find(v => (v.firebaseId === veiculoId) || (v.id === veiculoId));
        if (!veiculo) { 
            this.mostrarNotificacao('Veículo não encontrado!', 'error'); 
            return; 
        }
        
        const tipo = veiculo.tipoMedidor || veiculo.medidor || 'km';
        const medidorValor = parseFloat(document.getElementById('odometro').value);
        
        if (!medidorValor || medidorValor <= 0) { 
            this.mostrarNotificacao(`Informe o ${tipo} válido!`, 'error'); 
            return; 
        }
        
        const odometro = tipo === 'km' ? medidorValor : null;
        const horimetro = tipo === 'horas' ? medidorValor : null;
        const tipoCombustivel = document.getElementById('tipoCombustivel').value;
        
        if (!tipoCombustivel) { 
            this.mostrarNotificacao('Selecione o combustível!', 'error'); 
            return; 
        }
        
        const quantidade = parseFloat(document.getElementById('quantidadeLitros').value);
        if (!quantidade || quantidade <= 0) { 
            this.mostrarNotificacao('Informe a quantidade!', 'error'); 
            return; 
        }
        
        const precoLitro = parseFloat(document.getElementById('precoLitro').value);
        if (!precoLitro || precoLitro <= 0) { 
            this.mostrarNotificacao('Informe o preço!', 'error'); 
            return; 
        }
        
        const novoAbastecimento = {
            veiculoId: veiculo.firebaseId || veiculoId,
            veiculoPlaca: veiculo.placa,
            data: data,
            odometro: odometro,
            horimetro: horimetro,
            tipoCombustivel: tipoCombustivel,
            quantidade: quantidade,
            precoLitro: precoLitro,
            valorTotal: quantidade * precoLitro,
            posto: document.getElementById('posto').value || '',
            observacoes: document.getElementById('observacoes').value || ''
        };
        
        // Manter firebaseId se estiver editando
        if (this.editandoId) {
            const existente = this.abastecimentos.find(a => (a.firebaseId === this.editandoId) || (a.id === this.editandoId));
            if (existente && existente.firebaseId) {
                novoAbastecimento.firebaseId = existente.firebaseId;
            }
        }
        
        // Calcular média de consumo
        const anterior = this.buscarAbastecimentoAnterior(veiculoId, data);
        const media = this.calcularMediaConsumo(novoAbastecimento, anterior);
        if (media && media.valor > 0) {
            novoAbastecimento.mediaConsumo = media;
            this.mostrarNotificacao(`Média: ${media.valor} ${media.unidade}`, 'success');
        }
        
        // Salvar no Firebase
        const firebaseId = await this.salvarNoFirebase(novoAbastecimento);
        
        if (firebaseId) {
            // Recarregar dados do Firebase para ter tudo atualizado
            await this.carregarAbastecimentos();
            
            this.atualizarTabela();
            this.atualizarEstatisticas();
            this.carregarConsumoVeiculos();
            this.carregarEstatisticasGerais();
            this.limparFormulario();
            this.esconderFormulario();
            
            this.mostrarNotificacao(
                this.editandoId ? '✅ Abastecimento atualizado!' : '✅ Abastecimento registrado!', 
                'success'
            );
            this.editandoId = null;
        } else {
            this.mostrarNotificacao('❌ Erro ao salvar. Tente novamente.', 'error');
        }
    }

    // ========== EDITAR ABASTECIMENTO ==========
    editarAbastecimento(id) {
        const abast = this.abastecimentos.find(a => (a.firebaseId === id) || (a.id === id));
        if (!abast) return;
        
        const veiculo = this.veiculos.find(v => (v.firebaseId === abast.veiculoId) || (v.id === abast.veiculoId));
        if (!veiculo) return;
        
        document.getElementById('veiculoAbastecimento').value = abast.veiculoId;
        document.getElementById('dataAbastecimento').value = abast.data;
        document.getElementById('odometro').value = veiculo.tipoMedidor === 'km' ? abast.odometro : abast.horimetro;
        document.getElementById('tipoCombustivel').value = abast.tipoCombustivel;
        document.getElementById('quantidadeLitros').value = abast.quantidade;
        document.getElementById('precoLitro').value = abast.precoLitro;
        document.getElementById('valorTotal').value = abast.valorTotal.toFixed(2);
        document.getElementById('posto').value = abast.posto || '';
        document.getElementById('observacoes').value = abast.observacoes || '';
        
        this.editandoId = abast.firebaseId || abast.id;
        
        document.getElementById('formTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Abastecimento';
        document.getElementById('btnCancelarAbastecimento').textContent = 'Cancelar Edição';
        this.mostrarFormulario();
        this.atualizarInfoVeiculo();
    }

    // ========== EXCLUIR ABASTECIMENTO ==========
    async excluirAbastecimento(id) {
        if (!confirm('Excluir este abastecimento permanentemente?')) return;
        
        const abast = this.abastecimentos.find(a => (a.firebaseId === id) || (a.id === id));
        if (!abast) return;
        
        try {
            if (abast.firebaseId && this.db) {
                await this.db.collection('abastecimentos').doc(abast.firebaseId).delete();
                console.log('✅ Abastecimento excluído do Firebase:', abast.firebaseId);
            }
            
            // Recarregar do Firebase
            await this.carregarAbastecimentos();
            
            this.atualizarTabela();
            this.atualizarEstatisticas();
            this.carregarConsumoVeiculos();
            this.carregarEstatisticasGerais();
            this.mostrarNotificacao('✅ Abastecimento excluído!', 'success');
            
        } catch (error) {
            console.error('❌ Erro ao excluir:', error);
            this.mostrarNotificacao('Erro ao excluir abastecimento', 'error');
        }
    }

    // ========== MÉTODOS AUXILIARES (Mantidos como estavam) ==========
    
    calcularValorTotal() {
        const quantidade = parseFloat(document.getElementById('quantidadeLitros')?.value) || 0;
        const preco = parseFloat(document.getElementById('precoLitro')?.value) || 0;
        const valorTotal = quantidade * preco;
        const valorTotalInput = document.getElementById('valorTotal');
        if (valorTotalInput) valorTotalInput.value = valorTotal.toFixed(2);
    }

    calcularMediaConsumo(atual, anterior) {
        if (!anterior) return null;
        const veiculo = this.veiculos.find(v => (v.firebaseId === atual.veiculoId) || (v.id === atual.veiculoId));
        if (!veiculo) return null;
        
        const tipo = veiculo.tipoMedidor || veiculo.medidor || 'km';
        let distancia = 0;
        
        if (tipo === 'km' && atual.odometro && anterior.odometro) {
            distancia = atual.odometro - anterior.odometro;
        } else if (tipo === 'horas' && atual.horimetro && anterior.horimetro) {
            distancia = atual.horimetro - anterior.horimetro;
        }
        
        if (distancia > 0 && atual.quantidade > 0) {
            const media = distancia / atual.quantidade;
            return {
                valor: parseFloat(media.toFixed(2)),
                unidade: tipo === 'km' ? 'km/l' : 'horas/l',
                distancia: distancia
            };
        }
        return null;
    }

    buscarUltimoAbastecimento(veiculoId) {
        const filtrados = this.abastecimentos
            .filter(a => (a.veiculoId === veiculoId) || (a.veiculoId === veiculoId))
            .sort((a, b) => new Date(b.data) - new Date(a.data));
        return filtrados[0] || null;
    }

    buscarAbastecimentoAnterior(veiculoId, dataAtual) {
        const filtrados = this.abastecimentos
            .filter(a => (a.veiculoId === veiculoId) && new Date(a.data) < new Date(dataAtual))
            .sort((a, b) => new Date(b.data) - new Date(a.data));
        return filtrados[0] || null;
    }

    // ... (manter todos os outros métodos: atualizarTabela, verDetalhes, 
    //      carregarConsumoVeiculos, carregarEstatisticasGerais, etc.)
    // Eles já não usam localStorage, apenas manipulam this.abastecimentos e this.veiculos
    
    // ========== MÉTODOS DE INTERFACE (mantidos como estavam) ==========
    
    mostrarNotificacao(msg, tipo = 'info') {
        let n = document.getElementById('notificacao');
        if (!n) {
            n = document.createElement('div');
            n.id = 'notificacao';
            n.style.cssText = `
                position: fixed; top: 20px; right: 20px; padding: 15px 25px;
                border-radius: 8px; z-index: 10000; display: none;
                font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                transition: opacity 0.3s;
            `;
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
        
        setTimeout(() => { 
            n.style.opacity = '0'; 
            setTimeout(() => { n.style.display = 'none'; }, 300); 
        }, 3000);
    }

    mostrarFormulario() {
        const card = document.getElementById('formCard');
        if (card) { 
            card.style.display = 'block'; 
            card.scrollIntoView({ behavior: 'smooth' }); 
        }
    }

    esconderFormulario() {
        const card = document.getElementById('formCard');
        if (card) { 
            card.style.display = 'none'; 
            this.limparFormulario(); 
        }
    }

    limparFormulario() {
        document.getElementById('formAbastecimento')?.reset();
        const vi = document.getElementById('vehicleInfo');
        if (vi) vi.style.display = 'none';
        this.editandoId = null;
        document.getElementById('formTitle').innerHTML = '<i class="fas fa-plus-circle"></i> Novo Abastecimento';
        document.getElementById('btnCancelarAbastecimento').textContent = 'Cancelar';
        const dataInput = document.getElementById('dataAbastecimento');
        if (dataInput) {
            const agora = new Date();
            agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
            dataInput.value = agora.toISOString().slice(0, 16);
        }
    }

    aplicarFiltros() {
        this.filtrosAtivos.veiculo = document.getElementById('filtroVeiculo')?.value || '';
        this.filtrosAtivos.periodo = document.getElementById('filtroPeriodo')?.value || '';
        this.filtrosAtivos.combustivel = document.getElementById('filtroCombustivel')?.value || '';
        this.atualizarTabela();
        this.atualizarEstatisticas();
        this.mostrarNotificacao('Filtros aplicados!', 'success');
    }

    limparFiltros() {
        document.getElementById('filtroVeiculo').value = '';
        document.getElementById('filtroPeriodo').value = '30';
        document.getElementById('filtroCombustivel').value = '';
        document.getElementById('dataPersonalizadaGroup').style.display = 'none';
        document.getElementById('filtroDataInicio').value = '';
        document.getElementById('filtroDataFim').value = '';
        this.filtrosAtivos = { veiculo: '', periodo: '30', combustivel: '', busca: '' };
        document.getElementById('filterAbastecimentos').value = '';
        this.atualizarTabela();
        this.atualizarEstatisticas();
        this.mostrarNotificacao('Filtros removidos!', 'info');
    }

    filtrarTabela() {
        this.atualizarTabela();
    }

    // ... (manter todos os outros métodos existentes)
}

// ========== INICIALIZAÇÃO ==========
let gerenciador;

window.fecharModais = () => {
    const modal = document.getElementById('modalDetalhes');
    if (modal) modal.style.display = 'none';
};

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        gerenciador = new GerenciadorAbastecimento();
        window.gerenciador = gerenciador;
    });
} else {
    (async () => {
        gerenciador = new GerenciadorAbastecimento();
        window.gerenciador = gerenciador;
    })();
}
