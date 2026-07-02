// abastecimento.js - Versão Corrigida e Única

// ========== Aguardar Firebase ==========
function aguardarFirebasePronto() {
    return new Promise((resolve) => {
        if (window.firebaseDB) {
            console.log('✅ Firebase já disponível');
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

// ========== CLASSE PRINCIPAL (ÚNICA) ==========
class GerenciadorAbastecimento {
    constructor() {
        this.abastecimentos = [];
        this.veiculos = [];
        this.editandoId = null;
        this.filtrosAtivos = {
            veiculo: '',
            periodo: '30',
            combustivel: '',
            busca: ''
        };
        
        // Aguardar DOM e Firebase antes de inicializar
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', async () => {
                await aguardarFirebasePronto();
                await this.inicializar();
            });
        } else {
            (async () => {
                await aguardarFirebasePronto();
                await this.inicializar();
            })();
        }
    }

    async inicializar() {
        console.log('🚛 Inicializando sistema de abastecimento...');
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
        console.log(`   🚗 ${this.veiculos.length} veículos carregados`);
        console.log(`   ⛽ ${this.abastecimentos.length} abastecimentos carregados`);
    }

    configurarAbas() {
        const tabs = document.querySelectorAll('.tab-btn');
        const contents = document.querySelectorAll('.tab-content');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                const targetContent = document.getElementById(tabId);
                if (targetContent) targetContent.classList.add('active');
                if (tabId === 'consumo-veiculos') this.carregarConsumoVeiculos();
                else if (tabId === 'estatisticas') this.carregarEstatisticasGerais();
            });
        });
    }

    async carregarVeiculos() {
        try {
            if (window.firebaseDB) {
                const snapshot = await window.firebaseDB.collection('veiculos').get();
                const firebaseVeiculos = [];
                snapshot.forEach(doc => {
                    firebaseVeiculos.push({ firebaseId: doc.id, ...doc.data() });
                });
                if (firebaseVeiculos.length > 0) {
                    this.veiculos = firebaseVeiculos;
                    localStorage.setItem('veiculos', JSON.stringify(this.veiculos));
                    return;
                }
            }
            const veiculosSalvos = localStorage.getItem('veiculos');
            if (veiculosSalvos) {
                this.veiculos = JSON.parse(veiculosSalvos);
                return;
            }
            this.veiculos = this.getVeiculosPadrao();
            localStorage.setItem('veiculos', JSON.stringify(this.veiculos));
        } catch (error) {
            console.error('Erro ao carregar veículos:', error);
            this.veiculos = this.getVeiculosPadrao();
        }
    }

    getVeiculosPadrao() {
        return [
            { id: 1, nome: 'Caminhão Mercedes 1113', placa: 'ABC-1234', tipoMedidor: 'km', combustivel: 'Diesel S10' },
            { id: 2, nome: 'Empilhadeira Toyota', placa: 'EMP-001', tipoMedidor: 'horas', combustivel: 'Gasolina' },
            { id: 3, nome: 'Caminhão VW Constellation', placa: 'XYZ-5678', tipoMedidor: 'km', combustivel: 'Diesel S500' },
            { id: 4, nome: 'Trator Massey Ferguson', placa: 'TRT-001', tipoMedidor: 'horas', combustivel: 'Diesel S10' }
        ];
    }

    atualizarSelectVeiculos() {
        const select = document.getElementById('veiculoAbastecimento');
        const filtroVeiculo = document.getElementById('filtroVeiculo');
        if (select) {
            select.innerHTML = '<option value="">Selecione um veículo...</option>';
            this.veiculos.forEach(veiculo => {
                const nomeVeiculo = veiculo.nome || veiculo.modelo || 'Sem nome';
                const medidor = veiculo.tipoMedidor || 'km';
                select.innerHTML += `<option value="${veiculo.id || veiculo.firebaseId}">${veiculo.placa || 'SEM PLACA'} - ${nomeVeiculo} (${medidor.toUpperCase()})</option>`;
            });
        }
        if (filtroVeiculo) {
            filtroVeiculo.innerHTML = '<option value="">Todos os veículos</option>';
            this.veiculos.forEach(veiculo => {
                const nomeVeiculo = veiculo.nome || veiculo.modelo || 'Sem nome';
                filtroVeiculo.innerHTML += `<option value="${veiculo.id || veiculo.firebaseId}">${veiculo.placa || 'SEM PLACA'} - ${nomeVeiculo}</option>`;
            });
        }
    }

    async carregarAbastecimentos() {
        try {
            if (window.firebaseDB) {
                const snapshot = await window.firebaseDB.collection('abastecimentos').orderBy('data', 'desc').get();
                this.abastecimentos = [];
                snapshot.forEach(doc => {
                    this.abastecimentos.push({ firebaseId: doc.id, ...doc.data() });
                });
                localStorage.setItem('abastecimentos', JSON.stringify(this.abastecimentos));
                return;
            }
            const abastecimentosSalvos = localStorage.getItem('abastecimentos');
            this.abastecimentos = abastecimentosSalvos ? JSON.parse(abastecimentosSalvos) : [];
        } catch (error) {
            console.error('Erro ao carregar abastecimentos:', error);
            this.abastecimentos = [];
        }
    }

    async salvarNoFirebase(abastecimento) {
        if (!window.firebaseDB) return null;
        try {
            const { firebaseId, ...dados } = abastecimento;
            if (abastecimento.firebaseId) {
                await window.firebaseDB.collection('abastecimentos').doc(abastecimento.firebaseId).update(dados);
                return abastecimento.firebaseId;
            } else {
                const docRef = await window.firebaseDB.collection('abastecimentos').add(dados);
                return docRef.id;
            }
        } catch (error) {
            console.error('Erro ao salvar no Firebase:', error);
            return null;
        }
    }

    calcularValorTotal() {
        const quantidade = parseFloat(document.getElementById('quantidadeLitros')?.value) || 0;
        const preco = parseFloat(document.getElementById('precoLitro')?.value) || 0;
        const valorTotal = quantidade * preco;
        const valorTotalInput = document.getElementById('valorTotal');
        if (valorTotalInput) valorTotalInput.value = valorTotal.toFixed(2);
    }

    // ... (TODO O RESTANTE DO CÓDIGO ORIGINAL AQUI - sem duplicar) ...
    
    // Copie todas as outras funções do seu código original:
    // calcularMediaConsumo, buscarUltimoAbastecimento, buscarAbastecimentoAnterior,
    // calcularConsumoPorVeiculo, carregarConsumoVeiculos, getClassMedia,
    // carregarEstatisticasGerais, salvarAbastecimento, editarAbastecimento,
    // excluirAbastecimento, atualizarInfoVeiculo, atualizarTabela, verDetalhes,
    // aplicarFiltrosDados, atualizarEstatisticas, mostrarNotificacao,
    // mostrarFormulario, esconderFormulario, limparFormulario,
    // aplicarFiltros, limparFiltros, filtrarTabela, exportarDados,
    // gerarRelatorioConsumo, inicializarEventos
}

// ========== INICIALIZAR (ÚNICO) ==========
let gerenciador;

window.fecharModais = () => {
    const modal = document.getElementById('modalDetalhes');
    if (modal) modal.style.display = 'none';
};

document.addEventListener('DOMContentLoaded', async () => {
    await aguardarFirebasePronto();
    gerenciador = new GerenciadorAbastecimento();
    window.gerenciador = gerenciador;
});
