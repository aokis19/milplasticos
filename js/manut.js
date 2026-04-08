// ============================================
// MANUT.JS - Controle de Manutenção com Múltiplos Tipos
// Versão corrigida - Sem conflitos com sidebar/topbar
// ============================================

(function() {
    'use strict';
    
    // Aguardar DOM e Firebase estarem prontos
    let inicializado = false;
    
    function aguardarInicializacao() {
        if (inicializado) return;
        
        // Verificar se Firebase está disponível
        if (typeof db === 'undefined') {
            console.log('Aguardando Firebase...');
            setTimeout(aguardarInicializacao, 500);
            return;
        }
        
        // Verificar se elementos principais existem
        const sidebar = document.getElementById('sidebar-container');
        const topbar = document.getElementById('topbar-container');
        
        if (sidebar && topbar) {
            console.log('✅ Sistema de Manutenção iniciado');
            inicializado = true;
            iniciarSistemaManutencao();
        } else {
            console.log('Aguardando sidebar/topbar...');
            setTimeout(aguardarInicializacao, 300);
        }
    }
    
    // Iniciar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', aguardarInicializacao);
    } else {
        aguardarInicializacao();
    }
    
    // ============================================
    // VARIÁVEIS GLOBAIS
    // ============================================
    let veiculosLista = [];
    let tiposManutencaoLista = [];
    
    // ============================================
    // FUNÇÕES PRINCIPAIS
    // ============================================
    
    async function iniciarSistemaManutencao() {
        await carregarVeiculos();
        await carregarTiposManutencao();
        await carregarHistoricoManutencoes();
        await carregarProximasManutencoes();
        configurarEventos();
        
        // Disparar evento para indicar que o sistema está pronto
        document.dispatchEvent(new CustomEvent('manutencaoPronto'));
    }
    
    // ============================================
    // FUNÇÃO PARA MOSTRAR ALERTA
    // ============================================
    function mostrarAlerta(mensagem, tipo) {
        // Verificar se existe o container de alertas
        let alertaContainer = document.getElementById('alertasContainer');
        
        if (!alertaContainer) {
            // Criar container se não existir
            alertaContainer = document.createElement('div');
            alertaContainer.id = 'alertasContainer';
            alertaContainer.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999;';
            document.body.appendChild(alertaContainer);
        }
        
        const alerta = document.createElement('div');
        alerta.className = `alerta-flutuante alerta-${tipo}`;
        alerta.innerHTML = `<i class="fas ${tipo === 'sucesso' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${mensagem}`;
        alerta.style.cssText = `
            background: ${tipo === 'sucesso' ? '#27ae60' : '#e74c3c'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            margin-bottom: 10px;
            font-weight: bold;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            animation: fadeInOut 3s ease forwards;
        `;
        
        alertaContainer.appendChild(alerta);
        setTimeout(() => alerta.remove(), 3000);
    }
    
    function formatarNumero(valor) {
        return Math.round(valor);
    }
    
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
    
    // ============================================
    // CARREGAR DADOS
    // ============================================
    
    async function carregarVeiculos() {
        try {
            const snapshot = await db.collection('veiculos').orderBy('nome').get();
            veiculosLista = [];
            snapshot.forEach(doc => {
                veiculosLista.push({ id: doc.id, ...doc.data() });
            });
            
            atualizarSelects();
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
            const tbody = document.getElementById('historicoBody');
            if (!tbody) return;
            
            const snapshot = await db.collection('manutencoes').orderBy('data', 'desc').limit(100).get();
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
                    <td>${formatarNumero(manut.kmAtual)} ${unidade}</td>
                    <td>${formatarNumero(manut.proximaManutencao)} ${unidade}</td>
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
            
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
        }
    }
    
    async function carregarProximasManutencoes() {
        try {
            const container = document.getElementById('proximasBody');
            if (!container) return;
            
            const tiposSnapshot = await db.collection('tiposManutencao').where('ativo', '==', true).get();
            const proximas = [];
            
            for (const tipoDoc of tiposSnapshot.docs) {
                const tipo = tipoDoc.data();
                const veiculo = veiculosLista.find(v => v.id === tipo.veiculoId);
                if (!veiculo) continue;
                
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
                            Próxima: ${formatarNumero(p.proximoKm)} ${p.unidade} | 
                            Intervalo: ${p.intervalo} ${p.unidade} |
                            Última: ${p.ultimaData}
                        </div>
                    </div>
                `).join('');
            }
            
        } catch (error) {
            console.error('Erro ao carregar próximas:', error);
        }
    }
    
    // ============================================
    // FUNÇÕES DE UI
    // ============================================
    
    function atualizarSelects() {
        const veiculoSelect = document.getElementById('veiculoSelect');
        const configVeiculoSelect = document.getElementById('configVeiculoSelect');
        
        const options = '<option value="">Selecione...</option>' + 
            veiculosLista.map(v => `<option value="${v.id}" data-unidade="${v.unidade || 'KM'}">${v.nome} (${v.unidade || 'KM'})</option>`).join('');
        
        if (veiculoSelect) veiculoSelect.innerHTML = options;
        if (configVeiculoSelect) configVeiculoSelect.innerHTML = options;
    }
    
    async function carregarTiposPorVeiculo(veiculoId) {
        const tipoSelect = document.getElementById('tipoSelect');
        if (!tipoSelect) return;
        
        const tipos = tiposManutencaoLista.filter(t => t.veiculoId === veiculoId);
        
        tipoSelect.innerHTML = '<option value="">Selecione o tipo...</option>';
        tipos.forEach(t => {
            tipoSelect.innerHTML += `<option value="${t.id}" data-intervalo="${t.intervalo}">${t.nome} (a cada ${t.intervalo} ${t.unidade})</option>`;
        });
    }
    
    function renderizarListaVeiculos() {
        const container = document.getElementById('veiculosList');
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
    // CRUD
    // ============================================
    
    async function adicionarVeiculo(nome, unidade) {
        try {
            await db.collection('veiculos').add({
                nome: nome,
                unidade: unidade,
                dataCriacao: new Date().toISOString(),
                ativo: true
            });
            await carregarVeiculos();
            mostrarAlerta('Veículo cadastrado com sucesso!', 'sucesso');
        } catch (error) {
            console.error('Erro:', error);
            mostrarAlerta('Erro ao cadastrar veículo!', 'erro');
        }
    }
    
    async function excluirVeiculo(veiculoId) {
        if (!confirm('Excluir este veículo e TODOS os registros?')) return;
        
        try {
            const tipos = await db.collection('tiposManutencao').where('veiculoId', '==', veiculoId).get();
            for (const tipo of tipos.docs) {
                const manutencoes = await db.collection('manutencoes').where('tipoId', '==', tipo.id).get();
                for (const manut of manutencoes.docs) await manut.ref.delete();
                await tipo.ref.delete();
            }
            await db.collection('veiculos').doc(veiculoId).delete();
            
            await carregarVeiculos();
            await carregarHistoricoManutencoes();
            await carregarProximasManutencoes();
            mostrarAlerta('Veículo excluído!', 'sucesso');
        } catch (error) {
            mostrarAlerta('Erro ao excluir!', 'erro');
        }
    }
    
    async function adicionarTipo(veiculoId, nome, intervalo) {
        try {
            const veiculo = veiculosLista.find(v => v.id === veiculoId);
            await db.collection('tiposManutencao').add({
                veiculoId: veiculoId,
                nome: nome,
                intervalo: parseInt(intervalo),
                unidade: veiculo?.unidade || 'KM',
                ativo: true,
                dataCriacao: new Date().toISOString()
            });
            
            await carregarTiposManutencao();
            await carregarVeiculos();
            await carregarProximasManutencoes();
            mostrarAlerta('Tipo adicionado!', 'sucesso');
        } catch (error) {
            mostrarAlerta('Erro ao adicionar tipo!', 'erro');
        }
    }
    
    async function removerTipo(tipoId) {
        if (!confirm('Remover este tipo e todos os registros?')) return;
        
        try {
            const manutencoes = await db.collection('manutencoes').where('tipoId', '==', tipoId).get();
            for (const manut of manutencoes.docs) await manut.ref.delete();
            await db.collection('tiposManutencao').doc(tipoId).delete();
            
            await carregarTiposManutencao();
            await carregarVeiculos();
            await carregarHistoricoManutencoes();
            await carregarProximasManutencoes();
            mostrarAlerta('Tipo removido!', 'sucesso');
        } catch (error) {
            mostrarAlerta('Erro ao remover tipo!', 'erro');
        }
    }
    
    async function registrarManutencao(veiculoId, tipoId, data, kmAtual, observacoes) {
        try {
            const tipo = tiposManutencaoLista.find(t => t.id === tipoId);
            if (!tipo) throw new Error('Tipo não encontrado');
            
            await db.collection('manutencoes').add({
                veiculoId: veiculoId,
                tipoId: tipoId,
                tipoNome: tipo.nome,
                data: data,
                kmAtual: parseInt(kmAtual),
                proximaManutencao: parseInt(kmAtual) + tipo.intervalo,
                intervalo: tipo.intervalo,
                observacoes: observacoes,
                dataRegistro: new Date().toISOString()
            });
            
            await carregarHistoricoManutencoes();
            await carregarProximasManutencoes();
            mostrarAlerta('Manutenção registrada!', 'sucesso');
        } catch (error) {
            mostrarAlerta('Erro ao registrar!', 'erro');
        }
    }
    
    async function excluirManutencao(id) {
        if (!confirm('Excluir este registro?')) return;
        try {
            await db.collection('manutencoes').doc(id).delete();
            await carregarHistoricoManutencoes();
            await carregarProximasManutencoes();
            mostrarAlerta('Registro excluído!', 'sucesso');
        } catch (error) {
            mostrarAlerta('Erro ao excluir!', 'erro');
        }
    }
    
    // ============================================
    // MODAIS
    // ============================================
    
    function abrirModalTipos(veiculoId, veiculoNome) {
        const modal = document.getElementById('modalConfigTipos');
        if (!modal) return;
        
        document.getElementById('configVeiculoSelect').value = veiculoId;
        
        const tipos = tiposManutencaoLista.filter(t => t.veiculoId === veiculoId);
        const container = document.getElementById('tiposList');
        
        if (container) {
            container.innerHTML = tipos.map((tipo, idx) => `
                <div class="tipo-item" data-id="${tipo.id}">
                    <div class="tipo-info">
                        <strong>${tipo.nome}</strong>
                        <span>Intervalo: ${tipo.intervalo} ${tipo.unidade}</span>
                    </div>
                    <button class="btn-remover-tipo btn-sm" data-id="${tipo.id}">
                        <i class="fas fa-trash"></i> Remover
                    </button>
                </div>
            `).join('');
            
            if (tipos.length === 0) {
                container.innerHTML = '<p class="text-muted">Nenhum tipo configurado. Clique em "Adicionar" para começar.</p>';
            }
        }
        
        modal.classList.add('active');
        
        document.querySelectorAll('.btn-remover-tipo').forEach(btn => {
            btn.addEventListener('click', () => removerTipo(btn.dataset.id));
        });
    }
    
    function fecharModais() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.remove('active');
        });
    }
    
    // ============================================
    // EVENTOS
    // ============================================
    
    function configurarEventos() {
        // Botões principais
        const btnNovaManutencao = document.getElementById('btnNovaManutencao');
        if (btnNovaManutencao) {
            btnNovaManutencao.addEventListener('click', () => {
                document.getElementById('modalManutencao').classList.add('active');
                document.getElementById('formManutencao').reset();
            });
        }
        
        const btnConfigurarTipos = document.getElementById('btnConfigurarTipos');
        if (btnConfigurarTipos) {
            btnConfigurarTipos.addEventListener('click', () => {
                document.getElementById('modalConfigTipos').classList.add('active');
            });
        }
        
        const btnNovoVeiculo = document.getElementById('btnNovoVeiculo');
        if (btnNovoVeiculo) {
            btnNovoVeiculo.addEventListener('click', () => {
                document.getElementById('modalNovoVeiculo').classList.add('active');
            });
        }
        
        // Fechar modais
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', fecharModais);
        });
        
        // Select veículo carrega tipos
        const veiculoSelect = document.getElementById('veiculoSelect');
        if (veiculoSelect) {
            veiculoSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    carregarTiposPorVeiculo(e.target.value);
                }
            });
        }
        
        // Submit form manutenção
        const formManutencao = document.getElementById('formManutencao');
        if (formManutencao) {
            formManutencao.addEventListener('submit', async (e) => {
                e.preventDefault();
                const veiculoId = document.getElementById('veiculoSelect').value;
                const tipoId = document.getElementById('tipoSelect').value;
                const data = document.getElementById('dataManutencao').value;
                const km = document.getElementById('kmAtual').value;
                const obs = document.getElementById('obsManutencao').value;
                
                if (!veiculoId || !tipoId || !data || !km) {
                    mostrarAlerta('Preencha todos os campos!', 'erro');
                    return;
                }
                
                await registrarManutencao(veiculoId, tipoId, data, km, obs);
                fecharModais();
                formManutencao.reset();
            });
        }
        
        // Salvar novo veículo
        const salvarNovoVeiculo = document.getElementById('salvarNovoVeiculo');
        if (salvarNovoVeiculo) {
            salvarNovoVeiculo.addEventListener('click', async () => {
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
        
        // Adicionar tipo
        const btnAddTipo = document.getElementById('btnAddTipo');
        if (btnAddTipo) {
            btnAddTipo.addEventListener('click', () => {
                const veiculoId = document.getElementById('configVeiculoSelect').value;
                if (!veiculoId) {
                    mostrarAlerta('Selecione um veículo!', 'erro');
                    return;
                }
                
                const nome = prompt('Nome do tipo de manutenção:', 'Ex: Troca Óleo Motor');
                if (nome) {
                    const intervalo = prompt('Intervalo (KM/Horas):', '200');
                    if (intervalo) {
                        adicionarTipo(veiculoId, nome, intervalo);
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
                const tabContent = document.getElementById(`tab-${tabId}`);
                if (tabContent) tabContent.classList.add('active');
            });
        });
    }
    
})();
