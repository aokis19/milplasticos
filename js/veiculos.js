// veiculos.js
// Gerenciador de Veículos com Firebase e Edição

class GerenciadorVeiculos {
    constructor() {
        this.veiculos = [];
        this.editandoId = null;
        this.inicializar();
    }
    
    async inicializar() {
        console.log('🚀 Inicializando módulo de veículos...');
        
        await this.aguardarFirebase();
        await this.carregarVeiculos();
        this.configurarEventos();
        this.atualizarTabela();
        
        console.log('✅ Módulo de veículos pronto!');
    }
    
    aguardarFirebase() {
        return new Promise((resolve) => {
            if (window.firebaseDB) {
                console.log('🔥 Firebase disponível');
                resolve();
                return;
            }
            
            const verificar = setInterval(() => {
                if (window.firebaseDB) {
                    clearInterval(verificar);
                    console.log('🔥 Firebase conectado');
                    resolve();
                }
            }, 100);
            
            setTimeout(() => {
                clearInterval(verificar);
                console.warn('⚠️ Firebase não disponível, usando localStorage');
                resolve();
            }, 3000);
        });
    }
    
    async carregarVeiculos() {
        try {
            let veiculosCarregados = false;
            
            // 1. Tentar carregar do Firebase
            if (window.firebaseDB) {
                try {
                    const snapshot = await window.firebaseDB.collection('veiculos').get();
                    const firebaseVeiculos = [];
                    snapshot.forEach(doc => {
                        firebaseVeiculos.push({
                            firebaseId: doc.id,
                            ...doc.data()
                        });
                    });
                    
                    if (firebaseVeiculos.length > 0) {
                        this.veiculos = firebaseVeiculos;
                        localStorage.setItem('veiculos', JSON.stringify(this.veiculos));
                        console.log(`✅ ${this.veiculos.length} veículos do Firebase`);
                        veiculosCarregados = true;
                    }
                } catch (error) {
                    console.error('Erro Firebase:', error);
                }
            }
            
            // 2. Fallback para localStorage
            if (!veiculosCarregados) {
                const salvos = localStorage.getItem('veiculos');
                if (salvos) {
                    this.veiculos = JSON.parse(salvos);
                    console.log(`💾 ${this.veiculos.length} veículos do localStorage`);
                    veiculosCarregados = true;
                }
            }
            
            // 3. Veículos padrão
            if (!veiculosCarregados || this.veiculos.length === 0) {
                this.veiculos = this.getVeiculosPadrao();
                localStorage.setItem('veiculos', JSON.stringify(this.veiculos));
                console.log(`📝 ${this.veiculos.length} veículos padrão`);
            }
            
        } catch (error) {
            console.error('Erro ao carregar veículos:', error);
            this.veiculos = this.getVeiculosPadrao();
        }
    }
    
    getVeiculosPadrao() {
        return [
            { id: 1, nome: 'Caminhão Mercedes 1113', placa: 'ABC-1234', tipoMedidor: 'km', combustivel: 'Diesel S10', status: 'Ativo' },
            { id: 2, nome: 'Empilhadeira Toyota', placa: 'EMP-001', tipoMedidor: 'horas', combustivel: 'Gasolina', status: 'Ativo' },
            { id: 3, nome: 'Caminhão VW Constellation', placa: 'XYZ-5678', tipoMedidor: 'km', combustivel: 'Diesel S500', status: 'Ativo' },
            { id: 4, nome: 'Trator Massey Ferguson', placa: 'TRT-001', tipoMedidor: 'horas', combustivel: 'Diesel S10', status: 'Ativo' }
        ];
    }
    
    async salvarNoFirebase(veiculo) {
        if (!window.firebaseDB) return null;
        
        try {
            const { firebaseId, ...dados } = veiculo;
            
            if (veiculo.firebaseId) {
                // ATUALIZAR
                await window.firebaseDB.collection('veiculos').doc(veiculo.firebaseId).update(dados);
                console.log('✅ Atualizado no Firebase:', veiculo.firebaseId);
                return veiculo.firebaseId;
            } else {
                // CRIAR NOVO
                const docRef = await window.firebaseDB.collection('veiculos').add(dados);
                console.log('✅ Salvo no Firebase:', docRef.id);
                return docRef.id;
            }
        } catch (error) {
            console.error('Erro Firebase:', error);
            return null;
        }
    }
    
    async salvarVeiculo(veiculo) {
        // Validações
        if (!veiculo.nome || !veiculo.placa) {
            this.mostrarMensagem('Preencha nome e placa!', 'error');
            return false;
        }
        
        try {
            // Se não tem ID, criar um
            if (!veiculo.id && !veiculo.firebaseId) {
                veiculo.id = Date.now();
            }
            
            // Salvar no Firebase
            const firebaseId = await this.salvarNoFirebase(veiculo);
            if (firebaseId) {
                veiculo.firebaseId = firebaseId;
            }
            
            // Atualizar array local
            if (this.editandoId) {
                const index = this.veiculos.findIndex(v => v.id === this.editandoId || v.firebaseId === this.editandoId);
                if (index !== -1) {
                    this.veiculos[index] = veiculo;
                }
            } else {
                this.veiculos.push(veiculo);
            }
            
            // Salvar no localStorage
            localStorage.setItem('veiculos', JSON.stringify(this.veiculos));
            
            // Atualizar interface
            this.atualizarTabela();
            this.fecharModal();
            this.limparFormulario();
            
            const msg = this.editandoId ? 'Veículo atualizado com sucesso!' : 'Veículo cadastrado com sucesso!';
            this.mostrarMensagem(msg, 'success');
            
            this.editandoId = null;
            return true;
            
        } catch (error) {
            console.error('Erro ao salvar:', error);
            this.mostrarMensagem('Erro ao salvar veículo!', 'error');
            return false;
        }
    }
    
    async excluirVeiculo(id) {
        if (!confirm('Tem certeza que deseja excluir este veículo?')) return;
        
        const veiculo = this.veiculos.find(v => v.id == id || v.firebaseId == id);
        if (!veiculo) return;
        
        try {
            // Excluir do Firebase
            if (window.firebaseDB && veiculo.firebaseId) {
                await window.firebaseDB.collection('veiculos').doc(veiculo.firebaseId).delete();
                console.log('🗑️ Excluído do Firebase');
            }
            
            // Excluir do array local
            this.veiculos = this.veiculos.filter(v => v.id != id && v.firebaseId != id);
            localStorage.setItem('veiculos', JSON.stringify(this.veiculos));
            
            this.atualizarTabela();
            this.mostrarMensagem('Veículo excluído com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao excluir:', error);
            this.mostrarMensagem('Erro ao excluir veículo!', 'error');
        }
    }
    
    editarVeiculo(id) {
        const veiculo = this.veiculos.find(v => v.id == id || v.firebaseId == id);
        if (!veiculo) return;
        
        // Preencher formulário
        document.getElementById('nomeVeiculo').value = veiculo.nome || '';
        document.getElementById('placaVeiculo').value = veiculo.placa || '';
        document.getElementById('renavamVeiculo').value = veiculo.renavam || '';
        document.getElementById('anoVeiculo').value = veiculo.ano || '';
        document.getElementById('corVeiculo').value = veiculo.cor || '';
        document.getElementById('tipoMedidor').value = veiculo.tipoMedidor || 'km';
        document.getElementById('combustivelVeiculo').value = veiculo.combustivel || '';
        document.getElementById('statusVeiculo').value = veiculo.status || 'Ativo';
        
        // Guardar ID para edição
        this.editandoId = veiculo.id || veiculo.firebaseId;
        
        // Alterar título do modal
        const modalTitle = document.querySelector('#modalVeiculo .modal-header h3');
        if (modalTitle) {
            modalTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Veículo';
        }
        
        // Alterar texto do botão
        const submitBtn = document.querySelector('#formVeiculo button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Atualizar Veículo';
        }
        
        // Abrir modal
        this.abrirModal();
    }
    
    limparFormulario() {
        document.getElementById('formVeiculo')?.reset();
        this.editandoId = null;
        
        // Restaurar título do modal
        const modalTitle = document.querySelector('#modalVeiculo .modal-header h3');
        if (modalTitle) {
            modalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Novo Veículo';
        }
        
        // Restaurar texto do botão
        const submitBtn = document.querySelector('#formVeiculo button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Cadastrar Veículo';
        }
    }
    
    capturarDadosFormulario() {
        const veiculo = {
            nome: document.getElementById('nomeVeiculo')?.value,
            placa: document.getElementById('placaVeiculo')?.value.toUpperCase(),
            renavam: document.getElementById('renavamVeiculo')?.value,
            ano: document.getElementById('anoVeiculo')?.value,
            cor: document.getElementById('corVeiculo')?.value,
            tipoMedidor: document.getElementById('tipoMedidor')?.value,
            combustivel: document.getElementById('combustivelVeiculo')?.value,
            status: document.getElementById('statusVeiculo')?.value,
            dataCadastro: new Date().toISOString()
        };
        
        // Se for edição, manter o ID original
        if (this.editandoId) {
            const veiculoExistente = this.veiculos.find(v => v.id == this.editandoId || v.firebaseId == this.editandoId);
            if (veiculoExistente) {
                veiculo.id = veiculoExistente.id;
                if (veiculoExistente.firebaseId) {
                    veiculo.firebaseId = veiculoExistente.firebaseId;
                }
            }
        }
        
        if (!veiculo.nome || !veiculo.placa) {
            this.mostrarMensagem('Preencha nome e placa!', 'error');
            return;
        }
        
        this.salvarVeiculo(veiculo);
    }
    
    atualizarTabela() {
        const tbody = document.getElementById('tabelaVeiculosBody');
        if (!tbody) return;
        
        if (this.veiculos.length === 0) {
            tbody.innerHTML = '发展<td colspan="8" class="text-center">Nenhum veículo cadastrado</td></tr>';
            document.getElementById('totalVeiculos').textContent = '0 veículos';
            return;
        }
        
        let html = '';
        this.veiculos.forEach(veiculo => {
            // Status com cor
            let statusClass = '';
            let statusText = veiculo.status || 'Ativo';
            if (statusText === 'Ativo') statusClass = 'status-ativo';
            else if (statusText === 'Manutenção') statusClass = 'status-manutencao';
            else statusClass = 'status-inativo';
            
            html += `
                <tr>
                    <td>${veiculo.placa || '-'}</td>
                    <td>${veiculo.nome || '-'}</td>
                    <td>${veiculo.renavam || '-'}</td>
                    <td>${veiculo.ano || '-'}</td>
                    <td>${(veiculo.tipoMedidor || 'km').toUpperCase()}</td>
                    <td>${veiculo.combustivel || '-'}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td class="actions">
                        <button class="btn-icon btn-edit" onclick="gerenciador.editarVeiculo('${veiculo.id || veiculo.firebaseId}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-delete" onclick="gerenciador.excluirVeiculo('${veiculo.id || veiculo.firebaseId}')" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                 </tr>
            `;
        });
        
        tbody.innerHTML = html;
        document.getElementById('totalVeiculos').textContent = `${this.veiculos.length} veículos`;
        
        // Atualizar selects de veículos em outras páginas
        this.atualizarSelectsGlobais();
    }
    
    atualizarSelectsGlobais() {
        // Atualizar selects em outras páginas via evento
        const event = new CustomEvent('veiculosAtualizados', { detail: { veiculos: this.veiculos } });
        window.dispatchEvent(event);
    }
    
    configurarEventos() {
        // Botão novo veículo
        const btnNovo = document.getElementById('btnNovoVeiculo');
        if (btnNovo) {
            btnNovo.addEventListener('click', () => {
                this.limparFormulario();
                this.abrirModal();
            });
        }
        
        // Formulário
        const form = document.getElementById('formVeiculo');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.capturarDadosFormulario();
            });
        }
        
        // Botão fechar modal
        const closeBtn = document.querySelector('#modalVeiculo .close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.fecharModal());
        }
        
        // Fechar ao clicar fora
        const modal = document.getElementById('modalVeiculo');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.fecharModal();
            });
        }
        
        // Filtro de busca
        const filterInput = document.getElementById('filterInput');
        if (filterInput) {
            filterInput.addEventListener('input', () => this.filtrarTabela());
        }
        
        // Botões de relatório e exportar
        document.getElementById('btnRelatorio')?.addEventListener('click', () => this.gerarRelatorio());
        document.getElementById('btnExport')?.addEventListener('click', () => this.exportarDados());
    }
    
    filtrarTabela() {
        const filtro = document.getElementById('filterInput')?.value.toLowerCase() || '';
        const tbody = document.getElementById('tabelaVeiculosBody');
        if (!tbody) return;
        
        const filtrados = this.veiculos.filter(v => 
            v.placa?.toLowerCase().includes(filtro) ||
            v.nome?.toLowerCase().includes(filtro) ||
            v.combustivel?.toLowerCase().includes(filtro)
        );
        
        if (filtrados.length === 0) {
            tbody.innerHTML = '发展<td colspan="8" class="text-center">Nenhum veículo encontrado</td></tr>';
            return;
        }
        
        let html = '';
        filtrados.forEach(veiculo => {
            let statusClass = '';
            let statusText = veiculo.status || 'Ativo';
            if (statusText === 'Ativo') statusClass = 'status-ativo';
            else if (statusText === 'Manutenção') statusClass = 'status-manutencao';
            else statusClass = 'status-inativo';
            
            html += `
                <tr>
                    <td>${veiculo.placa || '-'}</td>
                    <td>${veiculo.nome || '-'}</td>
                    <td>${veiculo.renavam || '-'}</td>
                    <td>${veiculo.ano || '-'}</td>
                    <td>${(veiculo.tipoMedidor || 'km').toUpperCase()}</td>
                    <td>${veiculo.combustivel || '-'}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td class="actions">
                        <button class="btn-icon btn-edit" onclick="gerenciador.editarVeiculo('${veiculo.id || veiculo.firebaseId}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-delete" onclick="gerenciador.excluirVeiculo('${veiculo.id || veiculo.firebaseId}')" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                 </tr>
            `;
        });
        
        tbody.innerHTML = html;
    }
    
    abrirModal() {
        const modal = document.getElementById('modalVeiculo');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }
    
    fecharModal() {
        const modal = document.getElementById('modalVeiculo');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            this.limparFormulario();
        }
    }
    
    mostrarMensagem(msg, tipo) {
        let notificacao = document.getElementById('notificacao');
        if (!notificacao) {
            notificacao = document.createElement('div');
            notificacao.id = 'notificacao';
            notificacao.style.cssText = 'position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:8px;z-index:9999;background:white;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
            document.body.appendChild(notificacao);
        }
        
        const cores = {
            success: { bg: '#d4edda', text: '#155724' },
            error: { bg: '#f8d7da', text: '#721c24' },
            info: { bg: '#d1ecf1', text: '#0c5460' },
            warning: { bg: '#fff3cd', text: '#856404' }
        };
        
        const cor = cores[tipo] || cores.info;
        notificacao.style.backgroundColor = cor.bg;
        notificacao.style.color = cor.text;
        notificacao.textContent = msg;
        notificacao.style.display = 'block';
        
        setTimeout(() => {
            notificacao.style.opacity = '0';
            setTimeout(() => {
                notificacao.style.display = 'none';
                notificacao.style.opacity = '1';
            }, 300);
        }, 3000);
    }
    
    gerarRelatorio() {
        const total = this.veiculos.length;
        const ativos = this.veiculos.filter(v => v.status === 'Ativo').length;
        const manutencao = this.veiculos.filter(v => v.status === 'Manutenção').length;
        const inativos = this.veiculos.filter(v => v.status === 'Inativo').length;
        const km = this.veiculos.filter(v => v.tipoMedidor === 'km').length;
        const horas = this.veiculos.filter(v => v.tipoMedidor === 'horas').length;
        
        const relatorio = `
📊 RELATÓRIO DE VEÍCULOS
========================
Total de veículos: ${total}
✅ Ativos: ${ativos}
🔧 Em Manutenção: ${manutencao}
❌ Inativos: ${inativos}

📏 POR TIPO DE MEDIDOR:
- KM: ${km} veículos
- Horas: ${horas} veículos

⛽ POR COMBUSTÍVEL:
- Diesel S10: ${this.veiculos.filter(v => v.combustivel === 'Diesel S10').length}
- Diesel S500: ${this.veiculos.filter(v => v.combustivel === 'Diesel S500').length}
- Gasolina: ${this.veiculos.filter(v => v.combustivel === 'Gasolina').length}
- Etanol: ${this.veiculos.filter(v => v.combustivel === 'Etanol').length}
        `;
        
        alert(relatorio);
        console.log(relatorio);
    }
    
    exportarDados() {
        if (this.veiculos.length === 0) {
            this.mostrarMensagem('Nenhum veículo para exportar!', 'warning');
            return;
        }
        
        const dadosExport = this.veiculos.map(v => ({
            Placa: v.placa,
            Modelo: v.nome,
            Renavam: v.renavam,
            Ano: v.ano,
            Cor: v.cor,
            Medidor: v.tipoMedidor,
            Combustível: v.combustivel,
            Status: v.status,
            'Data Cadastro': v.dataCadastro ? new Date(v.dataCadastro).toLocaleDateString('pt-BR') : '-'
        }));
        
        const headers = Object.keys(dadosExport[0]);
        const csv = [
            headers.join(';'),
            ...dadosExport.map(row => headers.map(h => row[h]).join(';'))
        ].join('\n');
        
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `veiculos_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        
        this.mostrarMensagem(`${this.veiculos.length} veículos exportados!`, 'success');
    }
}

// Inicializar
let gerenciador;
document.addEventListener('DOMContentLoaded', () => {
    gerenciador = new GerenciadorVeiculos();
    window.gerenciador = gerenciador;
});