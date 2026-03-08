// 1. INICIALIZACAO 
function inicializar() { 
    console.log('Inicializando sistema...'); 
    console.log('Trocas salvas:', trocasOleo.length); 
    console.log('Manutencoes salvas:', manutencoes.length); 
    console.log('Abastecimentos:', abastecimentos.length);
    
    // Configurar data atual 
    const hoje = new Date().toISOString().split('T')[0]; 
    const dataTrocaInput = document.getElementById('dataTrocaOleo'); 
    const dataManutencaoInput = document.getElementById('dataManutencao'); 
    
    if (dataTrocaInput) dataTrocaInput.value = hoje; 
    if (dataManutencaoInput) dataManutencaoInput.value = hoje; 
    
    // Configurar eventos 
    configurarEventos(); 
    configurarAbas(); 
    
    // Carregar dados 
    carregarTabelaOleo(); 
    carregarTabelaManutencoes(); 
    carregarProgramadas(); 
} 

// 2. CONFIGURAR EVENTOS 
function configurarEventos() { 
    console.log('Configurando eventos...'); 
    
    // Botao Nova Troca de Oleo 
    const btnTrocaOleo = document.getElementById('btnNovaTrocaOleo'); 
    if (btnTrocaOleo) { 
        btnTrocaOleo.addEventListener('click', function() { 
            console.log('Abrindo modal de troca de oleo'); 
            abrirModal('modalTrocaOleo'); 
            preencherVeiculos('veiculoOleo'); 
        }); 
    }
    
    // Botao Nova Manutencao 
    const btnManutencao = document.getElementById('btnNovaManutencao'); 
    if (btnManutencao) { 
        btnManutencao.addEventListener('click', function() { 
            console.log('Abrindo modal de manutencao'); 
            abrirModal('modalManutencaoGeral'); 
            preencherVeiculos('veiculoManutencao'); 
        }); 
    } 
    
    // Botao Verificar Alertas
    const btnCheckAlertas = document.getElementById('btnCheckAlertas'); 
    if (btnCheckAlertas) { 
        btnCheckAlertas.addEventListener('click', verificarAlertas); 
    } 
    
    // Botão Fechar Alertas 
    const btnFecharAlertas = document.getElementById('btnFecharAlertas'); 
    if (btnFecharAlertas) { 
        btnFecharAlertas.addEventListener('click', function() { 
            document.getElementById('cardAlertas').style.display = 'none'; 
        }); 
    } 
    
    // Fechar Modais 
    document.querySelectorAll('.close-modal').forEach(btn => { 
        btn.addEventListener('click', fecharModais); 
    }); 
    
    // Fechar modal ao clicar fora 
    document.querySelectorAll('.modal').forEach(modal => { 
        modal.addEventListener('click', function(e) { 
            if (e.target === this) { 
                fecharModais(); 
            } 
        }); 
    }); 
    
    // Formulário Troca de Óleo 
    const formTrocaOleo = document.getElementById('formTrocaOleo'); 
    if (formTrocaOleo) { 
        formTrocaOleo.addEventListener('submit', salvarTrocaOleo); 
    } 
    
    // Formulário Manutenção Geral 
    const formManutencao = document.getElementById('formManutencaoGeral'); 
    if (formManutencao) { 
        formManutencao.addEventListener('submit', salvarManutencaoGeral); 
    } 
    
    // Filtros de busca 
    const filterOleo = document.getElementById('filterOleo'); 
    if (filterOleo) { 
        filterOleo.addEventListener('input', filtrarTabelaOleo); 
    } 
    
    const filterManutencoes = document.getElementById('filterManutencoes'); 
    if (filterManutencoes) { 
        filterManutencoes.addEventListener('input', filtrarTabelaManutencoes); 
    } 
} 

// 3. FUNÇÕES PRINCIPAIS 
function abrirModal(idModal) { 
    const modal = document.getElementById(idModal); 
    if (modal) { 
        modal.style.display = 'flex'; 
        document.body.style.overflow = 'hidden'; 
    } 
} 

function fecharModais() { 
    document.querySelectorAll('.modal').forEach(modal => { 
        modal.style.display = 'none'; 
    }); 
    document.body.style.overflow = 'auto'; 
} 

// 4. SALVAR TROCA DE ÓLEO 
function salvarTrocaOleo(e) { 
    e.preventDefault(); 
    console.log('Salvando troca de óleo...'); 
    
    // Coletar dados 
    const troca = { 
        id: Date.now(), // ID único 
        veiculoPlaca: document.getElementById('veiculoOleo').value, 
        data: document.getElementById('dataTrocaOleo').value, 
        kmTroca: parseInt(document.getElementById('kmTrocaOleo').value) || 0, 
        tipoOleo: document.getElementById('tipoOleo').value, 
        marcaOleo: document.getElementById('marcaOleo').value.trim(), 
        viscosidadeOleo: document.getElementById('viscosidadeOleo').value.trim(), 
        quantidadeOleo: parseFloat(document.getElementById('quantidadeOleo').value) || 0, 
        intervaloProxima: parseInt(document.getElementById('intervaloProximaOleo').value) || 10000, 
        observacoes: document.getElementById('observacoesOleo').value.trim(), 
        dataRegistro: new Date().toISOString(), 
        filtros: [] 
    }; 
    
    // Coletar filtros 
    if (document.getElementById('filtroOleo').checked) { 
        troca.filtros.push({ 
            tipo: 'filtro_oleo', 
            modelo: document.getElementById('modeloFiltroOleo').value.trim() 
        }); 
    } 
    
    if (document.getElementById('filtroAr').checked) { 
        troca.filtros.push({ 
            tipo: 'filtro_ar', 
            modelo: document.getElementById('modeloFiltroAr').value.trim() 
        }); 
    } 
    
    if (document.getElementById('filtroCombustivel').checked) { 
        troca.filtros.push({ 
            tipo: 'filtro_combustivel', 
            modelo: document.getElementById('modeloFiltroCombustivel').value.trim() 
        }); 
    } 
    
    if (document.getElementById('filtroArCondicionado').checked) { 
        troca.filtros.push({ 
            tipo: 'filtro_ar_condicionado', 
            modelo: document.getElementById('modeloFiltroArCondicionado').value.trim() 
        }); 
    } 
    
    // Validações 
    if (!troca.veiculoPlaca) { 
        alert('Selecione um veículo'); 
        return; 
    } 
    
    if (troca.kmTroca <= 0) { 
        alert('Informe o KM/Hora da troca'); 
        return; 
    } 
    
    if (!troca.tipoOleo) { 
        alert('Selecione o tipo de óleo'); 
        return; 
    } 
    
    if (troca.intervaloProxima <= 0) { 
        alert('Informe o intervalo para próxima troca'); 
        return; 
    } 
    
    // Salvar no array 
    trocasOleo.push(troca); 
    
    // Salvar no localStorage 
    localStorage.setItem('trocasOleo', JSON.stringify(trocasOleo)); 
    console.log('Troca salva:', troca); 
    alert('Troca de óleo registrada com sucesso!'); 
    
    // Limpar formulário 
    e.target.reset(); 
    document.getElementById('dataTrocaOleo').value = new Date().toISOString().split('T')[0]; 
    document.getElementById('intervaloProximaOleo').value = 10000; 
    
    // Fechar modal 
    fecharModais(); 
    
    // Atualizar interface 
    carregarTabelaOleo(); 
    carregarProgramadas(); 
} 

// 5. SALVAR MANUTENÇÃO GERAL 
function salvarManutencaoGeral(e) { 
    e.preventDefault(); 
    console.log('Salvando manutenção...'); 
    
    // Coletar dados 
    const manutencao = { 
        id: Date.now(), // ID único 
        veiculoPlaca: document.getElementById('veiculoManutencao').value, 
        tipo: document.getElementById('tipoManutencao').value, 
        data: document.getElementById('dataManutencao').value, 
        km: parseInt(document.getElementById('kmManutencao').value) || 0, 
        descricao: document.getElementById('descricaoManutencao').value.trim(), 
        custo: parseFloat(document.getElementById('custoManutencao').value) || 0, 
        fornecedor: document.getElementById('fornecedorManutencao').value.trim(), 
        garantiaMeses: parseInt(document.getElementById('garantiaManutencao').value) || 0, 
        observacoes: document.getElementById('observacoesManutencao').value.trim(), 
        dataRegistro: new Date().toISOString() 
    }; 
    
    // Calcular data de garantia 
    if (manutencao.garantiaMeses > 0) { 
        const dataManutencao = new Date(manutencao.data); 
        dataManutencao.setMonth(dataManutencao.getMonth() + manutencao.garantiaMeses); 
        manutencao.dataGarantia = dataManutencao.toISOString().split('T')[0]; 
    } 
    
    // Validações 
    if (!manutencao.veiculoPlaca) { 
        alert('Selecione um veículo'); 
        return; 
    } 
    
    if (!manutencao.tipo) { 
        alert('Selecione o tipo de manutenção'); 
        return; 
    } 
    
    if (!manutencao.descricao) { 
        alert('Informe a descrição da manutenção'); 
        return; 
    } 
    
    // Salvar no array 
    manutencoes.push(manutencao); 
    
    // Salvar no localStorage 
    localStorage.setItem('manutencoes', JSON.stringify(manutencoes)); 
    console.log('Manutenção salva:', manutencao); 
    alert('Manutenção registrada com sucesso!'); 
    
    // Limpar formulário 
    e.target.reset(); 
    document.getElementById('dataManutencao').value = new Date().toISOString().split('T')[0]; 
    
    // Fechar modal 
    fecharModais(); 
    
    // Atualizar interface 
    carregarTabelaManutencoes(); 
} 

// 6. CARREGAR TABELA DE ÓLEO 
function carregarTabelaOleo() { 
    const tbody = document.getElementById('tabelaOleoBody'); 
    if (!tbody) return; 
    
    tbody.innerHTML = ''; 
    
    if (trocasOleo.length === 0) { 
        // Mostrar mensagem se não houver dados 
        tbody.innerHTML = ` 
        <tr> 
            <td colspan="8" class="text-center"> 
                <i class="fas fa-info-circle"></i> Nenhuma troca de óleo registrada. 
            </td> 
        </tr>`; 
        document.getElementById('totalTrocasOleo').textContent = '0 trocas'; 
        return; 
    } 
    
    // Ordenar por data (mais recente primeiro) 
    trocasOleo.sort((a, b) => new Date(b.data) - new Date(a.data)); 
    
    // Carregar veículos para obter nomes 
    let veiculos = []; 
    try { 
        veiculos = JSON.parse(localStorage.getItem('veiculos')) || []; 
    } catch (e) { 
        console.log('Erro ao carregar veículos:', e); 
    } 
    
    // Preencher tabela com dados reais 
    trocasOleo.forEach(troca => { 
        // Encontrar veículo 
        const veiculo = veiculos.find(v => v.placa === troca.veiculoPlaca); 
        const nomeVeiculo = veiculo ? `${troca.veiculoPlaca} - ${veiculo.modelo}` : troca.veiculoPlaca; 
        
        // Formatar data 
        const dataFormatada = new Date(troca.data).toLocaleDateString('pt-BR'); 
        
        // Obter KM atual do veículo (usando a nova função corrigida)
        const kmAtual = obterKmAtualVeiculo(troca.veiculoPlaca);
        const proximaKm = troca.kmTroca + troca.intervaloProxima; 
        const kmRestantes = proximaKm - kmAtual; 
        
        // Status da próxima troca 
        let proximaInfo = '-'; 
        let statusClass = ''; 
        
        if (kmRestantes <= 0) { 
            proximaInfo = `<span class="text-danger">Vencida há ${Math.abs(kmRestantes).toLocaleString('pt-BR')} KM</span>`; 
            statusClass = 'status-atrasada'; 
        } else if (kmRestantes <= 1000) { 
            proximaInfo = `<span class="text-warning">${kmRestantes.toLocaleString('pt-BR')} KM</span>`; 
            statusClass = 'status-proxima'; 
        } else { 
            proximaInfo = `<span class="text-success">${kmRestantes.toLocaleString('pt-BR')} KM</span>`; 
            statusClass = 'status-ok'; 
        } 
        
        // Filtros 
        const filtrosInfo = troca.filtros && troca.filtros.length > 0 
            ? troca.filtros.map(f => { 
                const tipos = { 
                    'filtro_oleo': 'Óleo', 
                    'filtro_ar': 'Ar', 
                    'filtro_combustivel': 'Combustível', 
                    'filtro_ar_condicionado': 'Ar Cond.' 
                }; 
                return `${tipos[f.tipo] || f.tipo}${f.modelo ? ` (${f.modelo})` : ''}`; 
            }).join(', ') 
            : '-'; 
        
        const tr = document.createElement('tr'); 
        tr.innerHTML = ` 
            <td>${dataFormatada}</td> 
            <td><strong>${nomeVeiculo}</strong></td> 
            <td>${troca.kmTroca.toLocaleString('pt-BR')}</td> 
            <td>${troca.tipoOleo}${troca.marcaOleo ? ` - ${troca.marcaOleo}` : ''}${troca.viscosidadeOleo ? ` (${troca.viscosidadeOleo})` : ''}</td> 
            <td>${filtrosInfo}</td> 
            <td class="${statusClass}">${proximaInfo}</td> 
            <td><span class="text-muted">N/A</span></td> 
            <td class="actions"> 
                <button class="btn-icon btn-info" onclick="verDetalhesTroca(${troca.id})" title="Ver detalhes"> 
                    <i class="fas fa-eye"></i> 
                </button> 
                <button class="btn-icon btn-delete" onclick="excluirTrocaOleo(${troca.id})" title="Excluir"> 
                    <i class="fas fa-trash"></i> 
                </button> 
            </td> 
        `; 
        tbody.appendChild(tr); 
    }); 
    
    // Atualizar contador 
    document.getElementById('totalTrocasOleo').textContent = `${trocasOleo.length} troca${trocasOleo.length !== 1 ? 's' : ''}`; 
} 

// 7. CARREGAR TABELA DE MANUTENÇÕES 
function carregarTabelaManutencoes() { 
    const tbody = document.getElementById('tabelaManutencoesBody'); 
    if (!tbody) return; 
    
    tbody.innerHTML = ''; 
    
    if (manutencoes.length === 0) { 
        tbody.innerHTML = ` 
        <tr> 
            <td colspan="8" class="text-center"> 
                <i class="fas fa-info-circle"></i> Nenhuma manutenção registrada. 
            </td> 
        </tr>`; 
        document.getElementById('totalManutencoes').textContent = '0 manutenções'; 
        return; 
    } 
    
    // Ordenar por data 
    manutencoes.sort((a, b) => new Date(b.data) - new Date(a.data)); 
    
    // Carregar veiculos 
    let veiculos = []; 
    try { 
        veiculos = JSON.parse(localStorage.getItem('veiculos')) || []; 
    } catch (e) { 
        console.log('Erro ao carregar veiculos:', e); 
    } 
    
    // Preencher tabela 
    manutencoes.forEach(manutencao => { 
        const veiculo = veiculos.find(v => v.placa === manutencao.veiculoPlaca); 
        const nomeVeiculo = veiculo ? `${manutencao.veiculoPlaca} - ${veiculo.modelo}` : manutencao.veiculoPlaca; 
        const dataFormatada = new Date(manutencao.data).toLocaleDateString('pt-BR'); 
        
        // Traduzir tipo 
        const tipoTraduzido = { 
            'pneus': 'Pneus', 
            'freios': 'Freios', 
            'suspensao': 'Suspensão', 
            'motor': 'Motor', 
            'bateria': 'Bateria', 
            'eletrica': 'Elétrica', 
            'ar condicionado': 'Ar Condicionado', 
            'corpo': 'Funilaria/Pintura', 
            'preventiva': 'Preventiva', 
            'corretiva': 'Corretiva', 
            'outros': 'Outros' 
        }[manutencao.tipo] || manutencao.tipo; 
        
        // Garantia 
        let garantiaInfo = 'Sem garantia'; 
        let garantiaClass = ''; 
        
        if (manutencao.dataGarantia) { 
            const hoje = new Date(); 
            const dataGarantia = new Date(manutencao.dataGarantia); 
            const diasRestantes = Math.ceil((dataGarantia - hoje) / (1000 * 60 * 60 * 24)); 
            
            if (diasRestantes <= 0) { 
                garantiaInfo = '<span class="text-danger">Vencida</span>'; 
                garantiaClass = 'status-atrasada'; 
            } else if (diasRestantes <= 30) { 
                garantiaInfo = `<span class="text-warning">${diasRestantes} dias</span>`; 
                garantiaClass = 'status-proxima'; 
            } else { 
                garantiaInfo = `${dataGarantia.toLocaleDateString('pt-BR')}`; 
                garantiaClass = 'status-ok'; 
            } 
        } 
        
        const tr = document.createElement('tr'); 
        tr.innerHTML = ` 
            <td>${dataFormatada}</td> 
            <td><strong>${nomeVeiculo}</strong></td> 
            <td>${tipoTraduzido}</td> 
            <td>${manutencao.descricao.length > 50 ? manutencao.descricao.substring(0, 50) + '...' : manutencao.descricao}</td> 
            <td>${manutencao.custo > 0 ? manutencao.custo.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : '-'}</td> 
            <td class="${garantiaClass}">${garantiaInfo}</td> 
            <td><span class="text-muted">N/A</span></td> 
            <td class="actions"> 
                <button class="btn-icon btn-info" onclick="verDetalhesManutencao(${manutencao.id})" title="Ver detalhes"> 
                    <i class="fas fa-eye"></i> 
                </button> 
                <button class="btn-icon btn-delete" onclick="excluirManutencao(${manutencao.id})" title="Excluir"> 
                    <i class="fas fa-trash"></i> 
                </button> 
            </td> 
        `; 
        tbody.appendChild(tr); 
    }); 
    
    document.getElementById('totalManutencoes').textContent = `${manutencoes.length} manutenção${manutencoes.length !== 1 ? 'ões' : ''}`; 
} 

// 8. FUNÇÕES GLOBAIS PARA DELETAR 
window.excluirTrocaOleo = function(id) { 
    console.log('Excluindo troca ID:', id); 
    
    if (!confirm('Tem certeza que deseja excluir esta troca de óleo?')) { 
        return; 
    } 
    
    // Remover do array 
    trocasOleo = trocasOleo.filter(troca => troca.id !== id); 
    
    // Salvar no localStorage 
    localStorage.setItem('trocasOleo', JSON.stringify(trocasOleo)); 
    
    console.log('Troca excluída. Total restante:', trocasOleo.length); 
    alert('Troca de óleo excluída com sucesso!'); 
    
    // Atualizar interface 
    carregarTabelaOleo(); 
    carregarProgramadas(); 
}; 

window.excluirManutencao = function(id) { 
    console.log('Excluindo manutencao ID:', id); 
    
    if (!confirm('Tem certeza que deseja excluir esta manutenção?')) { 
        return; 
    } 
    
    // Remover do array 
    manutencoes = manutencoes.filter(manutencao => manutencao.id !== id); 
    
    // Salvar no localStorage 
    localStorage.setItem('manutencoes', JSON.stringify(manutencoes)); 
    
    console.log('Manutenção excluída. Total restante:', manutencoes.length); 
    alert('Manutenção excluída com sucesso!'); 
    
    // Atualizar interface 
    carregarTabelaManutencoes(); 
}; 

// 9. FUNÇÕES GLOBAIS PARA VER DETALHES 
window.verDetalhesTroca = function(id) { 
    const troca = trocasOleo.find(t => t.id === id); 
    if (!troca) return; 
    
    const veiculos = JSON.parse(localStorage.getItem('veiculos')) || []; 
    const veiculo = veiculos.find(v => v.placa === troca.veiculoPlaca); 
    const dataFormatada = new Date(troca.data).toLocaleDateString('pt-BR'); 
    
    // Calcular KM atual para mostrar nos detalhes
    const kmAtual = obterKmAtualVeiculo(troca.veiculoPlaca);
    const proximaKm = troca.kmTroca + troca.intervaloProxima;
    const kmRestantes = proximaKm - kmAtual;
    
    let html = ` 
        <h4><i class="fas fa-oil-can"></i> Detalhes da Troca de Óleo</h4> 
        <div class="detalhes-grid"> 
            <div class="detalhe-item"> 
                <label>Veículo:</label> 
                <div><strong>${veiculo ? `${troca.veiculoPlaca} - ${veiculo.modelo}` : troca.veiculoPlaca}</strong></div> 
            </div> 
            <div class="detalhe-item"> 
                <label>Data:</label> 
                <div>${dataFormatada}</div> 
            </div> 
            <div class="detalhe-item"> 
                <label>KM da Troca:</label> 
                <div>${troca.kmTroca.toLocaleString('pt-BR')}</div> 
            </div> 
            <div class="detalhe-item"> 
                <label>KM Atual (Estimado):</label> 
                <div>${kmAtual.toLocaleString('pt-BR')}</div> 
            </div> 
            <div class="detalhe-item"> 
                <label>Tipo de Óleo:</label> 
                <div>${troca.tipoOleo}</div> 
            </div> 
            ${troca.marcaOleo ? `<div class="detalhe-item"><label>Marca:</label><div>${troca.marcaOleo}</div></div>` : ''} 
            ${troca.viscosidadeOleo ? `<div class="detalhe-item"><label>Viscosidade:</label><div>${troca.viscosidadeOleo}</div></div>` : ''} 
            ${troca.quantidadeOleo > 0 ? `<div class="detalhe-item"><label>Quantidade:</label><div>${troca.quantidadeOleo}L</div></div>` : ''} 
            <div class="detalhe-item"> 
                <label>Intervalo Próxima:</label> 
                <div>${troca.intervaloProxima.toLocaleString('pt-BR')} KM</div> 
            </div> 
            <div class="detalhe-item"> 
                <label>Próxima Troca em:</label> 
                <div>${proximaKm.toLocaleString('pt-BR')} KM</div> 
            </div> 
            <div class="detalhe-item"> 
                <label>KM Restantes:</label> 
                <div>${kmRestantes > 0 ? kmRestantes.toLocaleString('pt-BR') + ' KM' : '<span class="text-danger">Vencida</span>'}</div> 
            </div> 
        </div> 
    `; 
    
    if (troca.filtros && troca.filtros.length > 0) { 
        html += `<div class="detalhe-item"><label>Filtros Trocados:</label><div>`; 
        troca.filtros.forEach(filtro => { 
            const tipos = { 
                'filtro_oleo': 'Filtro de Óleo', 
                'filtro_ar': 'Filtro de Ar', 
                'filtro_combustivel': 'Filtro de Combustível', 
                'filtro_ar_condicionado': 'Filtro de Ar Condicionado' 
            }; 
            html += `${tipos[filtro.tipo] || filtro.tipo}${filtro.modelo ? ` (${filtro.modelo})` : ''}<br>`; 
        }); 
        html += `</div></div>`; 
    } 
    
    if (troca.observacoes) { 
        html += `<div class="detalhe-item"><label>Observações:</label><div>${troca.observacoes}</div></div>`; 
    } 
    
    html += ` 
        <div class="form-actions" style="margin-top: 20px;"> 
            <button class="btn btn-danger" onclick="excluirTrocaOleo(${troca.id}); fecharModais();"> 
                <i class="fas fa-trash"></i> Excluir 
            </button> 
            <button class="btn btn-secondary" onclick="fecharModais()"> 
                <i class="fas fa-times"></i> Fechar 
            </button> 
        </div> 
    `; 
    
    document.getElementById('modalDetalhesBody').innerHTML = html; 
    document.getElementById('modalDetalhes').style.display = 'flex'; 
}; 

window.verDetalhesManutencao = function(id) { 
    const manutencao = manutencoes.find(m => m.id === id); 
    if (!manutencao) return; 
    
    const veiculos = JSON.parse(localStorage.getItem('veiculos')) || []; 
    const veiculo = veiculos.find(v => v.placa === manutencao.veiculoPlaca); 
    const dataFormatada = new Date(manutencao.data).toLocaleDateString('pt-BR'); 
    
    const tipoTraduzido = { 
        'pneus': 'Pneus', 
        'freios': 'Freios', 
        'suspensao': 'Suspensão', 
        'motor': 'Motor', 
        'bateria': 'Bateria', 
        'eletrica': 'Elétrica', 
        'ar_condicionado': 'Ar Condicionado', 
        'corpo': 'Funilaria/Pintura', 
        'preventiva': 'Preventiva', 
        'corretiva': 'Corretiva', 
        'outros': 'Outros' 
    }[manutencao.tipo] || manutencao.tipo; 
    
    let html = ` 
        <h4><i class="fas fa-tools"></i> Detalhes da Manutenção</h4> 
        <div class="detalhes-grid"> 
            <div class="detalhe-item"> 
                <label>Veículo:</label> 
                <div><strong>${veiculo ? `${manutencao.veiculoPlaca} - ${veiculo.modelo}` : manutencao.veiculoPlaca}</strong></div> 
            </div> 
            <div class="detalhe-item"> 
                <label>Tipo:</label> 
                <div>${tipoTraduzido}</div> 
            </div> 
            <div class="detalhe-item"> 
                <label>Data:</label> 
                <div>${dataFormatada}</div> 
            </div> 
            ${manutencao.km > 0 ? `<div class="detalhe-item"><label>KM/Hora:</label><div>${manutencao.km.toLocaleString('pt-BR')}</div></div>` : ''} 
            ${manutencao.custo > 0 ? `<div class="detalhe-item"><label>Custo:</label><div>${manutencao.custo.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</div></div>` : ''} 
            ${manutencao.fornecedor ? `<div class="detalhe-item"><label>Fornecedor:</label><div>${manutencao.fornecedor}</div></div>` : ''} 
            ${manutencao.dataGarantia ? `<div class="detalhe-item"><label>Garantia até:</label><div>${new Date(manutencao.dataGarantia).toLocaleDateString('pt-BR')} (${manutencao.garantiaMeses} meses)</div></div>` : ''} 
        </div> 
        <div class="detalhe-item"> 
            <label>Descrição:</label> 
            <div>${manutencao.descricao}</div> 
        </div> 
    `; 
    
    if (manutencao.observacoes) { 
        html += `<div class="detalhe-item"><label>Observações:</label><div>${manutencao.observacoes}</div></div>`; 
    } 
    
    html += ` 
        <div class="form-actions" style="margin-top: 20px;"> 
            <button class="btn btn-danger" onclick="excluirManutencao(${manutencao.id}); fecharModais();"> 
                <i class="fas fa-trash"></i> Excluir 
            </button> 
            <button class="btn btn-secondary" onclick="fecharModais()"> 
                <i class="fas fa-times"></i> Fechar 
            </button> 
        </div> 
    `; 
    
    document.getElementById('modalDetalhesBody').innerHTML = html; 
    document.getElementById('modalDetalhes').style.display = 'flex'; 
}; 

// 10. FUNÇÕES AUXILIARES 
function preencherVeiculos(idSelect) { 
    const select = document.getElementById(idSelect); 
    if (!select) return; 
    
    try { 
        const veiculos = JSON.parse(localStorage.getItem('veiculos')) || []; 
        select.innerHTML = '<option value="">Selecione um veículo...</option>'; 
        
        if (veiculos.length === 0) { 
            const option = document.createElement('option'); 
            option.value = ""; 
            option.textContent = 'Nenhum veículo cadastrado'; 
            select.appendChild(option); 
            return; 
        } 
        
        veiculos.forEach(veiculo => { 
            const option = document.createElement('option'); 
            option.value = veiculo.placa; 
            option.textContent = `${veiculo.placa} - ${veiculo.modelo}`; 
            select.appendChild(option); 
        }); 
    } catch (e) { 
        console.error('Erro ao carregar veículos:', e); 
    } 
} 

// FUNÇÃO CORRIGIDA: Obter KM atual do veículo
function obterKmAtualVeiculo(placaVeiculo) {
    // 1. Tentar obter do localStorage de KM por veículo
    const kmSalvo = localStorage.getItem(`km_atual_${placaVeiculo}`);
    
    if (kmSalvo) {
        return parseInt(kmSalvo);
    }
    
    // 2. Se não tiver KM salvo, usar o último abastecimento registrado
    const abastVeiculo = abastecimentos.filter(a => a.veiculoPlaca === placaVeiculo);
    
    if (abastVeiculo.length > 0) {
        // Ordenar por data (mais recente primeiro) e pegar o último
        abastVeiculo.sort((a, b) => new Date(b.data) - new Date(a.data));
        // CORREÇÃO: Verificar tanto 'odometro' quanto 'kmAtual'
        const ultimoAbast = abastVeiculo[0];
        return ultimoAbast.odometro || ultimoAbast.kmAtual || 0;
    }
    
    // 3. Se não houver abastecimentos, buscar a última troca de óleo
    const trocasVeiculo = trocasOleo.filter(t => t.veiculoPlaca === placaVeiculo);
    
    if (trocasVeiculo.length > 0) {
        // Ordenar por data (mais recente primeiro)
        trocasVeiculo.sort((a, b) => new Date(b.data) - new Date(a.data));
        // Retornar o KM da última troca (como mínimo)
        return trocasVeiculo[0].kmTroca;
    }
    
    // 4. Se nada for encontrado, retornar 0
    return 0;
}

// FUNÇÃO CORRIGIDA: carregarProgramadas() - MOSTRA APENAS ÚLTIMA TROCA POR VEÍCULO
function carregarProgramadas() { 
    const container = document.getElementById('programadasContainer'); 
    if (!container) return; 
    
    container.innerHTML = ""; 
    
    if (trocasOleo.length === 0) { 
        container.innerHTML = '<div class="text-center">Nenhuma manutenção programada</div>'; 
        document.getElementById('totalProgramadas').textContent = '0 programadas'; 
        return; 
    } 
    
    // 1. Agrupar por veículo e pegar apenas a última troca de cada
    const trocasPorVeiculo = {};
    
    trocasOleo.forEach(troca => {
        if (!trocasPorVeiculo[troca.veiculoPlaca] || 
            new Date(troca.data) > new Date(trocasPorVeiculo[troca.veiculoPlaca].data)) {
            trocasPorVeiculo[troca.veiculoPlaca] = troca;
        }
    });
    
    // 2. Converter para array
    const ultimasTrocas = Object.values(trocasPorVeiculo);
    
    // 3. Ordenar por data mais recente
    ultimasTrocas.sort((a, b) => new Date(b.data) - new Date(a.data));
    
    // 4. Filtrar apenas as que estão próximas (≤ 2000 KM)
    const trocasProximas = ultimasTrocas.filter(troca => {
        const kmAtual = obterKmAtualVeiculo(troca.veiculoPlaca);
        const proximaKm = troca.kmTroca + troca.intervaloProxima;
        const kmRestantes = proximaKm - kmAtual;
        return kmRestantes <= 2000;
    });
    
    let totalProgramadas = trocasProximas.length;
    
    // 5. Preencher cards
    trocasProximas.forEach(troca => { 
        const kmAtual = obterKmAtualVeiculo(troca.veiculoPlaca);
        const proximaKm = troca.kmTroca + troca.intervaloProxima; 
        const kmRestantes = proximaKm - kmAtual; 
        
        const veiculos = JSON.parse(localStorage.getItem('veiculos')) || []; 
        const veiculo = veiculos.find(v => v.placa === troca.veiculoPlaca); 
        
        let classe = 'normal'; 
        if (kmRestantes <= 0) { 
            classe = 'urgente'; 
        } else if (kmRestantes <= 500) { 
            classe = 'proximo'; 
        } 
        
        const card = document.createElement('div'); 
        card.className = `programada-card ${classe}`; 
        card.innerHTML = ` 
            <div class="programada-header"> 
                <div class="programada-veiculo">${troca.veiculoPlaca}</div> 
                <span class="programada-tipo">Troca de Óleo</span> 
            </div> 
            <div class="programada-detalhes"> 
                ${kmRestantes <= 0 ? 
                    `VENCIDA há ${Math.abs(kmRestantes).toLocaleString('pt-BR')} KM` : 
                    `Próxima em ${kmRestantes.toLocaleString('pt-BR')} KM`} 
            </div> 
            <div class="programada-km"> 
                <span>Última: ${troca.kmTroca.toLocaleString('pt-BR')} KM</span><br> 
                <span>Próxima: ${proximaKm.toLocaleString('pt-BR')} KM</span> 
            </div> 
            <div class="programada-acoes"> 
                <button class="btn btn-sm btn-primary" onclick="verDetalhesTroca(${troca.id})"> 
                    <i class="fas fa-eye"></i> Detalhes 
                </button> 
                <button class="btn btn-sm btn-success" onclick="abrirModal('modalTrocaOleo'); document.getElementById('veiculoOleo').value='${troca.veiculoPlaca}';"> 
                    <i class="fas fa-check"></i> Registrar 
                </button> 
            </div> 
        `; 
        container.appendChild(card); 
    }); 
    
    document.getElementById('totalProgramadas').textContent = `${totalProgramadas} programada${totalProgramadas !== 1 ? 's' : ''}`; 
} 

function verificarAlertas() { 
    const alertas = []; 
    
    // Agrupar por veículo para pegar apenas a última troca
    const trocasPorVeiculo = {};
    trocasOleo.forEach(troca => {
        if (!trocasPorVeiculo[troca.veiculoPlaca] || 
            new Date(troca.data) > new Date(trocasPorVeiculo[troca.veiculoPlaca].data)) {
            trocasPorVeiculo[troca.veiculoPlaca] = troca;
        }
    });
    
    // Verificar trocas de óleo vencidas ou próximas 
    Object.values(trocasPorVeiculo).forEach(troca => { 
        const kmAtual = obterKmAtualVeiculo(troca.veiculoPlaca);
        const proximaKm = troca.kmTroca + troca.intervaloProxima; 
        const kmRestantes = proximaKm - kmAtual; 
        const veiculos = JSON.parse(localStorage.getItem('veiculos')) || []; 
        const veiculo = veiculos.find(v => v.placa === troca.veiculoPlaca); 
        const nomeVeiculo = veiculo ? `${troca.veiculoPlaca} - ${veiculo.modelo}` : troca.veiculoPlaca; 
        
        if (kmRestantes <= 0) { 
            alertas.push({ 
                tipo: 'urgente', 
                texto: `${nomeVeiculo} - Troca de óleo VENCIDA há ${Math.abs(kmRestantes).toLocaleString('pt-BR')} KM`, 
                id: troca.id 
            }); 
        } else if (kmRestantes <= 500) { 
            alertas.push({ 
                tipo: 'warning', 
                texto: `${nomeVeiculo} - Troca de óleo em ${kmRestantes.toLocaleString('pt-BR')} KM`, 
                id: troca.id 
            }); 
        } 
    }); 
    
    exibirAlertas(alertas); 
} 

function exibirAlertas(alertas) { 
    const container = document.getElementById('alertasContainer'); 
    const card = document.getElementById('cardAlertas'); 
    if (!container || !card) return; 
    
    container.innerHTML = ''; 
    
    if (alertas.length === 0) { 
        container.innerHTML = '<div class="alerta-item info">Nenhum alerta no momento</div>'; 
        card.style.display = 'block'; 
        return; 
    } 
    
    alertas.forEach(alerta => { 
        const div = document.createElement('div'); 
        div.className = `alerta-item ${alerta.tipo}`; 
        div.innerHTML = ` 
            <div class="alerta-info"> 
                <div class="alerta-descricao">${alerta.texto}</div> 
            </div> 
            <div class="alerta-acoes"> 
                <button class="btn-icon btn-sm btn-primary" onclick="verDetalhesTroca(${alerta.id})" title="Ver detalhes"> 
                    <i class="fas fa-eye"></i> 
                </button> 
            </div> 
        `; 
        container.appendChild(div); 
    }); 
    
    card.style.display = 'block'; 
} 

function filtrarTabelaOleo() { 
    const filtro = document.getElementById('filterOleo').value.toLowerCase(); 
    const linhas = document.querySelectorAll('#tabelaOleoBody tr'); 
    linhas.forEach(linha => { 
        const texto = linha.textContent.toLowerCase(); 
        linha.style.display = texto.includes(filtro) ? '' : 'none'; 
    }); 
} 

function filtrarTabelaManutencoes() { 
    const filtro = document.getElementById('filterManutencoes').value.toLowerCase(); 
    const linhas = document.querySelectorAll('#tabelaManutencoesBody tr'); 
    linhas.forEach(linha => { 
        const texto = linha.textContent.toLowerCase(); 
        linha.style.display = texto.includes(filtro) ? '' : 'none'; 
    }); 
} 

function configurarAbas() { 
    const tabs = document.querySelectorAll('.tab-btn'); 
    const contents = document.querySelectorAll('.tab-content'); 
    
    tabs.forEach(tab => { 
        tab.addEventListener('click', function() { 
            tabs.forEach(t => t.classList.remove('active')); 
            contents.forEach(c => c.classList.remove('active')); 
            this.classList.add('active'); 
            const tabId = this.getAttribute('data-tab'); 
            document.getElementById(tabId).classList.add('active'); 
        }); 
    }); 
} 

// Adicionar função global para fechar modais 
window.fecharModais = fecharModais; 

// Função para atualizar KM do veículo (pode ser usada por um formulário)
window.atualizarKmVeiculo = function(placa, novoKm) {
    if (!placa || !novoKm) {
        alert('Informe a placa e o KM atual');
        return;
    }
    
    localStorage.setItem(`km_atual_${placa}`, novoKm.toString());
    console.log(`KM atualizado para ${placa}: ${novoKm}`);
    
    // Atualizar interface
    if (typeof carregarTabelaOleo === 'function') carregarTabelaOleo();
    if (typeof carregarProgramadas === 'function') carregarProgramadas();
    if (typeof carregarTabelaManutencoes === 'function') carregarTabelaManutencoes();
    
    alert(`KM atual do veículo ${placa} atualizado para ${novoKm}`);
};

// 11. VARIÁVEIS GLOBAIS E INICIALIZAÇÃO
// Declaração das variáveis globais
let trocasOleo = [];
let manutencoes = [];
let abastecimentos = [];

// Carregar dados do localStorage
try {
    trocasOleo = JSON.parse(localStorage.getItem('trocasOleo')) || [];
} catch (e) {
    console.log('Erro ao carregar trocas de óleo:', e);
    trocasOleo = [];
}

try {
    manutencoes = JSON.parse(localStorage.getItem('manutencoes')) || [];
} catch (e) {
    console.log('Erro ao carregar manutenções:', e);
    manutencoes = [];
}

try {
    abastecimentos = JSON.parse(localStorage.getItem('abastecimentos')) || [];
} catch (e) {
    console.log('Erro ao carregar abastecimentos:', e);
    abastecimentos = [];
}

// Inicializar sistema quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', inicializar);

// Função para teste rápido - definir KM manualmente
window.definirKmAtual = function(placa, km) {
    localStorage.setItem(`km_atual_${placa}`, km.toString());
    console.log(`KM definido para ${placa}: ${km}`);
    carregarTabelaOleo();
    carregarProgramadas();
    alert(`KM atual do veículo ${placa} definido para ${km}`);
};