// ============================================
// MANUT.JS - Controle de Manutenção com Múltiplos Tipos
// ============================================

(function() {
    'use strict';
    
    let inicializado = false;
    let veiculosLista = [];
    let tiposManutencaoLista = [];
    
    function mostrarAlerta(mensagem, tipo) {
        let alertaContainer = document.querySelector('.alertas-container');
        if (!alertaContainer) {
            alertaContainer = document.createElement('div');
            alertaContainer.className = 'alertas-container';
            document.body.appendChild(alertaContainer);
        }
        
        const alerta = document.createElement('div');
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
        alerta.innerHTML = `<i class="fas ${tipo === 'sucesso' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${mensagem}`;
        alertaContainer.appendChild(alerta);
        setTimeout(() => alerta.remove(), 3000);
    }
    
    function formatarNumero(valor) {
        return Math.round(valor);
    }
    
    function calcularStatus(kmAtual, proximaManutencao, intervalo) {
        const diferenca = proximaManutencao - kmAtual;
        if (diferenca <= 0) return { texto: 'Atrasada', classe: 'status-atrasada' };
        if (diferenca <= intervalo * 0.1) return { texto: 'Urgente', classe: 'status-urgente' };
        if (diferenca <= intervalo * 0.2) return { texto: 'Próximo', classe: 'status-proximo' };
        return { texto: 'OK', classe: 'status-ok' };
    }
    
    async function carregarVeiculos() {
        try {
            const snapshot = await db.collection('veiculos').orderBy('nome').get();
            veiculosLista = [];
            snapshot.forEach(doc => veiculosLista.push({ id: doc.id, ...doc.data() }));
            
            const veiculoSelect = document.getElementById('veiculoSelect');
            const configVeiculoSelect = document.getElementById('configVeiculoSelect');
            const options = '<option value="">Selecione...</option>' + 
                veiculosLista.map(v => `<option value="${v.id}">${v.nome} (${v.unidade || 'KM'})</option>`).join('');
            
            if (veiculoSelect) veiculoSelect.innerHTML = options;
            if (configVeiculoSelect) configVeiculoSelect.innerHTML = options;
            
            renderizarListaVeiculos();
        } catch (error) {
            console.error('Erro ao carregar veículos:', error);
        }
    }
    
    async function carregarTiposManutencao() {
        try {
            const snapshot = await db.collection('tiposManutencao').get();
            tiposManutencaoLista = [];
            snapshot.forEach(doc => tiposManutencaoLista.push({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Erro ao carregar tipos:', error);
        }
    }
    
    async function carregarHistoricoManutencoes() {
        const tbody = document.getElementById('historicoBody');
        if (!tbody) return;
        
        try {
            const snapshot = await db.collection('manutencoes').orderBy('data', 'desc').limit(100).get();
            tbody.innerHTML = '';
            
            if (snapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Nenhuma manutenção registrada</td></tr>';
                return;
            }
            
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
                    <td><button class="btn-excluir-manutencao btn-sm" data-id="${doc.id}"><i class="fas fa-trash"></i></button></td>
                `;
            }
            
            document.querySelectorAll('.btn-excluir-manutencao').forEach(btn => {
                btn.addEventListener('click', () => excluirManutencao(btn.dataset.id));
            });
        } catch (error) {
            console.error('Erro:', error);
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Erro ao carregar histórico</td></tr>';
        }
    }
    
    async function carregarProximasManutencoes() {
        const container = document.getElementById('proximasBody');
        if (!container) return;
        
        try {
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
                container.innerHTML = '<p style="text-align:center;color:#999;">Nenhuma manutenção programada</p>';
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
            
            const totalSpan = document.getElementById('totalProgramadas');
            if (totalSpan) totalSpan.textContent = `${proximas.length} programadas`;
            
        } catch (error) {
            console.error('Erro:', error);
            container.innerHTML = '<p style="text-align:center;color:#999;">Erro ao carregar próximas manutenções</p>';
        }
    }
    
    function renderizarListaVeiculos() {
        const container = document.getElementById('veiculosList');
        if (!container) return;
        
        if (veiculosLista.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#999;">Nenhum veículo cadastrado. Clique em "Novo Veículo" para começar.</p>';
            return;
        }
        
        container.innerHTML = '';
        for (const veic of veiculosLista) {
            const tipos = tiposManutencaoLista.filter(t => t.veiculoId === veic.id);
            
            const card = document.createElement('div');
            card.className = 'veiculo-card';
            card.innerHTML = `
                <div class="veiculo-header">
                    <h4><i class="fas fa-truck"></i> ${veic.nome} <small style="color:#666;">(${veic.unidade || 'KM'})</small></h4>
                    <div>
                        <button class="btn-config-tipos btn-sm btn-warning" data-id="${veic.id}" data-nome="${veic.nome}">
                            <i class="fas fa-cog"></i> Tipos
                        </button>
                        <button class="btn-excluir-veiculo btn-sm btn-danger" data-id="${veic.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="veiculo-body">
                    <small>Tipos de manutenção configurados:</small>
                    <div class="tipos-list">
                        ${tipos.map(t => `<span class="tipo-tag">${t.nome} (a cada ${t.intervalo} ${veic.unidade || 'KM'})</span>`).join('') || '<span style="color:#999;">Nenhum tipo configurado</span>'}
                    </div>
                </div>
            `;
            container.appendChild(card);
        }
        
        document.querySelectorAll('.btn-config-tipos').forEach(btn => {
            btn.addEventListener('click', () => abrirModalTipos(btn.dataset.id, btn.dataset.nome));
        });
        document.querySelectorAll('.btn-excluir-veiculo').forEach(btn => {
            btn.addEventListener('click', () => excluirVeiculo(btn.dataset.id));
        });
    }
    
    async function carregarTiposPorVeiculo(veiculoId) {
        const tipoSelect = document.getElementById('tipoSelect');
        if (!tipoSelect) return;
        
        const tipos = tiposManutencaoLista.filter(t => t.veiculoId === veiculoId);
        tipoSelect.innerHTML = '<option value="">Selecione o tipo...</option>';
        tipos.forEach(t => {
            tipoSelect.innerHTML += `<option value="${t.id}">${t.nome} (a cada ${t.intervalo} ${t.unidade})</option>`;
        });
    }
    
    async function adicionarVeiculo(nome, unidade) {
        try {
            await db.collection('veiculos').add({ nome, unidade, ativo: true, dataCriacao: new Date().toISOString() });
            await carregarVeiculos();
            mostrarAlerta('Veículo cadastrado com sucesso!', 'sucesso');
        } catch (error) {
            mostrarAlerta('Erro ao cadastrar veículo!', 'erro');
        }
    }
    
    async function excluirVeiculo(veiculoId) {
        if (!confirm('⚠️ Excluir este veículo e TODOS os registros de manutenção?')) return;
        
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
                veiculoId, nome, intervalo: parseInt(intervalo),
                unidade: veiculo?.unidade || 'KM', ativo: true,
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
                veiculoId, tipoId, tipoNome: tipo.nome, data,
                kmAtual: parseInt(kmAtual),
                proximaManutencao: parseInt(kmAtual) + tipo.intervalo,
                intervalo: tipo.intervalo, observacoes,
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
    
    function abrirModalTipos(veiculoId, veiculoNome) {
        const modal = document.getElementById('modalConfigTipos');
        if (!modal) return;
        
        document.getElementById('configVeiculoSelect').value = veiculoId;
        
        const tipos = tiposManutencaoLista.filter(t => t.veiculoId === veiculoId);
        const container = document.getElementById('tiposList');
        
        if (tipos.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#999;">Nenhum tipo configurado. Clique em "Adicionar" para começar.</p>';
        } else {
            container.innerHTML = tipos.map(tipo => `
                <div class="tipo-item">
                    <div class="tipo-info">
                        <strong>${tipo.nome}</strong>
                        <span>Intervalo: ${tipo.intervalo} ${tipo.unidade}</span>
                    </div>
                    <button class="btn-remover-tipo btn-sm btn-danger" data-id="${tipo.id}">
                        <i class="fas fa-trash"></i> Remover
                    </button>
                </div>
            `).join('');
        }
        
        modal.classList.add('active');
        
        document.querySelectorAll('.btn-remover-tipo').forEach(btn => {
            btn.addEventListener('click', () => removerTipo(btn.dataset.id));
        });
    }
    
    function fecharModais() {
        document.querySelectorAll('.modal-overlay').forEach(modal => modal.classList.remove('active'));
    }
    
    function iniciarSistema() {
        if (inicializado) return;
        if (typeof db === 'undefined') {
            setTimeout(iniciarSistema, 500);
            return;
        }
        
        inicializado = true;
        console.log('✅ Sistema de Manutenção iniciado');
        
        carregarVeiculos();
        carregarTiposManutencao();
        carregarHistoricoManutencoes();
        carregarProximasManutencoes();
        
        // Eventos
        document.getElementById('btnNovaManutencao')?.addEventListener('click', () => {
            document.getElementById('modalManutencao').classList.add('active');
            document.getElementById('formManutencao').reset();
            document.getElementById('dataManutencao').value = new Date().toISOString().split('T')[0];
        });
        
        document.getElementById('btnConfigurarTipos')?.addEventListener('click', () => {
            document.getElementById('modalConfigTipos').classList.add('active');
        });
        
        document.getElementById('btnCheckAlertas')?.addEventListener('click', () => {
            carregarProximasManutencoes();
            document.querySelector('.tab-btn[data-tab="proximas"]').click();
            mostrarAlerta('Alertas atualizados!', 'sucesso');
        });
        
        document.getElementById('btnNovoVeiculo')?.addEventListener('click', () => {
            document.getElementById('modalNovoVeiculo').classList.add('active');
        });
        
        document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', fecharModais));
        
        document.getElementById('veiculoSelect')?.addEventListener('change', (e) => {
            if (e.target.value) carregarTiposPorVeiculo(e.target.value);
        });
        
        document.getElementById('formManutencao')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await registrarManutencao(
                document.getElementById('veiculoSelect').value,
                document.getElementById('tipoSelect').value,
                document.getElementById('dataManutencao').value,
                document.getElementById('kmAtual').value,
                document.getElementById('obsManutencao').value
            );
            fecharModais();
            e.target.reset();
        });
        
        document.getElementById('salvarNovoVeiculo')?.addEventListener('click', async () => {
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
        
        document.getElementById('btnAddTipo')?.addEventListener('click', () => {
            const veiculoId = document.getElementById('configVeiculoSelect').value;
            if (!veiculoId) {
                mostrarAlerta('Selecione um veículo primeiro!', 'erro');
                return;
            }
            const nome = prompt('Nome do tipo de manutenção:', 'Ex: Troca Óleo Motor');
            if (nome) {
                const intervalo = prompt('Intervalo (KM/Horas):', '200');
                if (intervalo) adicionarTipo(veiculoId, nome, intervalo);
            }
        });
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`tab-${tabId}`)?.classList.add('active');
            });
        });
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciarSistema);
    } else {
        iniciarSistema();
    }
})();
