// abastecimento.js - Controle de Abastecimento de Combustível

document.addEventListener('DOMContentLoaded', function() {
    console.log('abastecimento.js carregado');
    
    // Elementos principais
    const formAbastecimento = document.getElementById('formAbastecimento');
    const formCard = document.getElementById('formCard');
    const tabelaBody = document.getElementById('tabelaAbastecimentosBody');
    const btnNovoAbastecimento = document.getElementById('btnNovoAbastecimento');
    const btnFecharForm = document.getElementById('btnFecharForm');
    const btnCancelarAbastecimento = document.getElementById('btnCancelarAbastecimento');
    
    // Elementos de cálculo
    const quantidadeLitrosInput = document.getElementById('quantidadeLitros');
    const precoLitroInput = document.getElementById('precoLitro');
    const valorTotalInput = document.getElementById('valorTotal');
    
    // Filtros
    const filtroVeiculo = document.getElementById('filtroVeiculo');
    const filtroPeriodo = document.getElementById('filtroPeriodo');
    const filtroCombustivel = document.getElementById('filtroCombustivel');
    const btnAplicarFiltros = document.getElementById('btnAplicarFiltros');
    const btnLimparFiltros = document.getElementById('btnLimparFiltros');
    
    // Modal
    const modalDetalhes = document.getElementById('modalDetalhes');
    
    // Variáveis globais
    let abastecimentos = JSON.parse(localStorage.getItem('abastecimentos')) || [];
    let veiculos = JSON.parse(localStorage.getItem('veiculos')) || [];
    let abastecimentoEditando = null;
    
    // ==================== INICIALIZAÇÃO ====================
    inicializar();
    
    function inicializar() {
        console.log('Inicializando módulo de abastecimento...');
        
        // Carregar dados iniciais
        carregarVeiculosNosSelects();
        carregarAbastecimentos();
        atualizarEstatisticas();
        
        // Configurar eventos do formulário
        formAbastecimento.addEventListener('submit', salvarAbastecimento);
        
        // Configurar eventos dos botões
        btnNovoAbastecimento.addEventListener('click', mostrarFormulario);
        btnFecharForm.addEventListener('click', esconderFormulario);
        btnCancelarAbastecimento.addEventListener('click', esconderFormulario);
        
        // Configurar cálculo automático do valor total
        quantidadeLitrosInput.addEventListener('input', calcularValorTotal);
        precoLitroInput.addEventListener('input', calcularValorTotal);
        
        // Configurar seleção de veículo
        document.getElementById('veiculoAbastecimento').addEventListener('change', mostrarInfoVeiculo);
        
        // Configurar filtros
        filtroPeriodo.addEventListener('change', toggleDatasPersonalizadas);
        btnAplicarFiltros.addEventListener('click', aplicarFiltros);
        btnLimparFiltros.addEventListener('click', limparFiltros);
        
        // Configurar busca na tabela
        document.getElementById('filterAbastecimentos').addEventListener('input', filtrarTabela);
        
        // Configurar modal
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                modalDetalhes.style.display = 'none';
            });
        });
        
        // Fechar modal ao clicar fora
        modalDetalhes.addEventListener('click', function(e) {
            if (e.target === modalDetalhes) {
                modalDetalhes.style.display = 'none';
            }
        });
        
        // Configurar exportação
        document.getElementById('btnExportAbastecimento').addEventListener('click', exportarDados);
        document.getElementById('btnRelatorioConsumo').addEventListener('click', gerarRelatorioConsumo);
        
        // Preencher data atual
        const agora = new Date();
        const dataFormatada = agora.toISOString().slice(0, 16);
        document.getElementById('dataAbastecimento').value = dataFormatada;
    }
    
    // ==================== FUNÇÕES DE VEÍCULOS ====================
    
    function carregarVeiculosNosSelects() {
        console.log('Carregando veículos nos selects...', veiculos);
        
        // Select do formulário
        const selectForm = document.getElementById('veiculoAbastecimento');
        selectForm.innerHTML = '<option value="">Selecione um veículo...</option>';
        
        // Select do filtro
        const selectFiltro = document.getElementById('filtroVeiculo');
        selectFiltro.innerHTML = '<option value="">Todos os veículos</option>';
        
        if (veiculos.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Nenhum veículo cadastrado';
            selectForm.appendChild(option);
            return;
        }
        
        // Adicionar apenas veículos ativos
        veiculos.filter(v => v.status === 'Ativo').forEach(veiculo => {
            // Para o formulário
            const optionForm = document.createElement('option');
            optionForm.value = veiculo.placa;
            optionForm.textContent = `${veiculo.placa} - ${veiculo.modelo}`;
            optionForm.dataset.combustivel = veiculo.combustivel;
            optionForm.dataset.medidor = veiculo.medidor;
            selectForm.appendChild(optionForm);
            
            // Para o filtro
            const optionFiltro = document.createElement('option');
            optionFiltro.value = veiculo.placa;
            optionFiltro.textContent = `${veiculo.placa} - ${veiculo.modelo}`;
            selectFiltro.appendChild(optionFiltro);
        });
    }
    
    function mostrarInfoVeiculo() {
        const select = document.getElementById('veiculoAbastecimento');
        const selectedOption = select.options[select.selectedIndex];
        const infoDiv = document.getElementById('vehicleInfo');
        
        if (selectedOption.value) {
            document.getElementById('infoCombustivel').textContent = 
                `Combustível: ${selectedOption.dataset.combustivel}`;
            document.getElementById('infoMedidor').textContent = 
                `Medidor: ${selectedOption.dataset.medidor}`;
            document.getElementById('infoStatus').textContent = `Status: Ativo`;
            
            // Preencher automaticamente o tipo de combustível
            document.getElementById('tipoCombustivel').value = selectedOption.dataset.combustivel;
            
            infoDiv.style.display = 'block';
        } else {
            infoDiv.style.display = 'none';
        }
    }
    
    // ==================== FUNÇÕES DO FORMULÁRIO ====================
    
    function mostrarFormulario() {
        formCard.style.display = 'block';
        formCard.scrollIntoView({ behavior: 'smooth' });
        limparFormulario();
        document.getElementById('veiculoAbastecimento').focus();
    }
    
    function esconderFormulario() {
        formCard.style.display = 'none';
        abastecimentoEditando = null;
        const btnSubmit = formAbastecimento.querySelector('button[type="submit"]');
        btnSubmit.innerHTML = '<i class="fas fa-save"></i> Salvar Abastecimento';
    }
    
    function limparFormulario() {
        formAbastecimento.reset();
        document.getElementById('vehicleInfo').style.display = 'none';
        
        // Restaurar data atual
        const agora = new Date();
        const dataFormatada = agora.toISOString().slice(0, 16);
        document.getElementById('dataAbastecimento').value = dataFormatada;
        
        abastecimentoEditando = null;
        
        const btnSubmit = formAbastecimento.querySelector('button[type="submit"]');
        btnSubmit.innerHTML = '<i class="fas fa-save"></i> Salvar Abastecimento';
    }
    
    function calcularValorTotal() {
        const litros = parseFloat(quantidadeLitrosInput.value) || 0;
        const preco = parseFloat(precoLitroInput.value) || 0;
        const total = litros * preco;
        
        valorTotalInput.value = total.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    }
    
    function salvarAbastecimento(e) {
        e.preventDefault();
        console.log('Salvando abastecimento...');
        
        // Coletar dados do formulário
        const abastecimento = {
            id: abastecimentoEditando ? abastecimentoEditando.id : Date.now(),
            veiculoPlaca: document.getElementById('veiculoAbastecimento').value,
            data: document.getElementById('dataAbastecimento').value,
            odometro: parseInt(document.getElementById('odometro').value),
            tipoCombustivel: document.getElementById('tipoCombustivel').value,
            quantidadeLitros: parseFloat(document.getElementById('quantidadeLitros').value),
            precoLitro: parseFloat(document.getElementById('precoLitro').value),
            valorTotal: parseFloat(quantidadeLitrosInput.value) * parseFloat(precoLitroInput.value),
            posto: document.getElementById('posto').value.trim(),
            observacoes: document.getElementById('observacoes').value.trim(),
            dataRegistro: new Date().toISOString()
        };
        
        // Validações
        if (!abastecimento.veiculoPlaca) {
            alert('Por favor, selecione um veículo');
            return;
        }
        
        if (abastecimento.quantidadeLitros <= 0) {
            alert('A quantidade de litros deve ser maior que zero');
            return;
        }
        
        if (abastecimento.precoLitro <= 0) {
            alert('O preço por litro deve ser maior que zero');
            return;
        }
        
        // Verificar se já existe abastecimento com mesma data e veículo
        const dataExistente = abastecimentos.find(a => 
            a.veiculoPlaca === abastecimento.veiculoPlaca && 
            a.data === abastecimento.data
        );
        
        if (dataExistente && !abastecimentoEditando) {
            if (!confirm('Já existe um abastecimento para este veículo nesta data. Deseja continuar?')) {
                return;
            }
        }
        
        // Salvar ou atualizar
        if (abastecimentoEditando) {
            // Atualizar existente
            const index = abastecimentos.findIndex(a => a.id === abastecimentoEditando.id);
            abastecimentos[index] = abastecimento;
            alert('Abastecimento atualizado com sucesso!');
        } else {
            // Adicionar novo
            abastecimentos.push(abastecimento);
            alert('Abastecimento registrado com sucesso!');
        }
        
        // Salvar no localStorage
        localStorage.setItem('abastecimentos', JSON.stringify(abastecimentos));
        console.log('Abastecimentos salvos:', abastecimentos);
        
        // Atualizar interface
        carregarAbastecimentos();
        atualizarEstatisticas();
        esconderFormulario();
    }
    
    // ==================== FUNÇÕES DA TABELA ====================
    
    function carregarAbastecimentos(filtros = {}) {
        console.log('Carregando abastecimentos...');
        
        tabelaBody.innerHTML = '';
        
        // Aplicar filtros
        let abastecimentosFiltrados = [...abastecimentos];
        
        if (filtros.veiculo) {
            abastecimentosFiltrados = abastecimentosFiltrados.filter(
                a => a.veiculoPlaca === filtros.veiculo
            );
        }
        
        if (filtros.combustivel) {
            abastecimentosFiltrados = abastecimentosFiltrados.filter(
                a => a.tipoCombustivel === filtros.combustivel
            );
        }
        
        if (filtros.periodo) {
            const hoje = new Date();
            let dataLimite = new Date();
            
            switch(filtros.periodo) {
                case '7':
                    dataLimite.setDate(hoje.getDate() - 7);
                    break;
                case '30':
                    dataLimite.setDate(hoje.getDate() - 30);
                    break;
                case 'hoje':
                    dataLimite = hoje;
                    break;
                case 'personalizado':
                    if (filtros.dataInicio && filtros.dataFim) {
                        abastecimentosFiltrados = abastecimentosFiltrados.filter(a => {
                            const dataAbastecimento = new Date(a.data);
                            return dataAbastecimento >= new Date(filtros.dataInicio) && 
                                   dataAbastecimento <= new Date(filtros.dataFim);
                        });
                    }
                    break;
            }
            
            if (filtros.periodo !== 'personalizado') {
                abastecimentosFiltrados = abastecimentosFiltrados.filter(a => {
                    return new Date(a.data) >= dataLimite;
                });
            }
        }
        
        // Ordenar por data (mais recente primeiro)
        abastecimentosFiltrados.sort((a, b) => new Date(b.data) - new Date(a.data));
        
        // Atualizar contador
        document.getElementById('totalRegistros').textContent = 
            `${abastecimentosFiltrados.length} registro${abastecimentosFiltrados.length !== 1 ? 's' : ''}`;
        
        // Verificar se há dados
        if (abastecimentosFiltrados.length === 0) {
            tabelaBody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center">
                        <i class="fas fa-info-circle"></i> Nenhum abastecimento encontrado.
                    </td>
                </tr>
            `;
            return;
        }
        
        // Popular tabela
        abastecimentosFiltrados.forEach(abastecimento => {
            const veiculo = veiculos.find(v => v.placa === abastecimento.veiculoPlaca);
            const nomeVeiculo = veiculo ? `${abastecimento.veiculoPlaca} - ${veiculo.modelo}` : abastecimento.veiculoPlaca;
            
            // Formatar data
            const dataObj = new Date(abastecimento.data);
            const dataFormatada = dataObj.toLocaleDateString('pt-BR');
            const horaFormatada = dataObj.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            // Classe para o tipo de combustível
            let combustivelClass = '';
            switch(abastecimento.tipoCombustivel) {
                case 'Gasolina': combustivelClass = 'badge-gasolina'; break;
                case 'Diesel S10':
                case 'Diesel S500': combustivelClass = 'badge-diesel'; break;
                case 'Etanol': combustivelClass = 'badge-etanol'; break;
            }
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <strong>${dataFormatada}</strong><br>
                    <small>${horaFormatada}</small>
                </td>
                <td>${nomeVeiculo}</td>
                <td>${abastecimento.odometro.toLocaleString('pt-BR')}</td>
                <td>
                    <span class="badge-combustivel ${combustivelClass}">
                        ${abastecimento.tipoCombustivel}
                    </span>
                </td>
                <td><strong>${abastecimento.quantidadeLitros.toFixed(1)} L</strong></td>
                <td>R$ ${abastecimento.precoLitro.toFixed(3)}</td>
                <td><strong class="text-success">${abastecimento.valorTotal.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                })}</strong></td>
                <td>${abastecimento.posto || '-'}</td>
                <td class="actions">
                    <button class="btn-icon btn-info" onclick="verDetalhes('${abastecimento.id}')" title="Ver detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon btn-edit" onclick="editarAbastecimento('${abastecimento.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="excluirAbastecimento('${abastecimento.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tabelaBody.appendChild(tr);
        });
    }
    
    function filtrarTabela() {
        const filtro = document.getElementById('filterAbastecimentos').value.toLowerCase();
        const linhas = tabelaBody.getElementsByTagName('tr');
        
        for (let i = 0; i < linhas.length; i++) {
            const texto = linhas[i].textContent.toLowerCase();
            linhas[i].style.display = texto.includes(filtro) ? '' : 'none';
        }
    }
    
    // ==================== FUNÇÕES DE EDIÇÃO/EXCLUSÃO ====================
    
    window.editarAbastecimento = function(id) {
        const abastecimento = abastecimentos.find(a => a.id == id);
        
        if (abastecimento) {
            abastecimentoEditando = abastecimento;
            
            // Preencher formulário
            document.getElementById('veiculoAbastecimento').value = abastecimento.veiculoPlaca;
            document.getElementById('dataAbastecimento').value = abastecimento.data;
            document.getElementById('odometro').value = abastecimento.odometro;
            document.getElementById('tipoCombustivel').value = abastecimento.tipoCombustivel;
            document.getElementById('quantidadeLitros').value = abastecimento.quantidadeLitros;
            document.getElementById('precoLitro').value = abastecimento.precoLitro;
            document.getElementById('posto').value = abastecimento.posto || '';
            document.getElementById('observacoes').value = abastecimento.observacoes || '';
            
            // Calcular valor total
            calcularValorTotal();
            
            // Mostrar formulário
            mostrarFormulario();
            
            // Mudar texto do botão
            const btnSubmit = formAbastecimento.querySelector('button[type="submit"]');
            btnSubmit.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar Abastecimento';
        }
    };
    
    window.excluirAbastecimento = function(id) {
        if (confirm('Tem certeza que deseja excluir este abastecimento?')) {
            abastecimentos = abastecimentos.filter(a => a.id != id);
            localStorage.setItem('abastecimentos', JSON.stringify(abastecimentos));
            
            carregarAbastecimentos();
            atualizarEstatisticas();
            alert('Abastecimento excluído com sucesso!');
        }
    };
    
    window.verDetalhes = function(id) {
        const abastecimento = abastecimentos.find(a => a.id == id);
        const veiculo = veiculos.find(v => v.placa === abastecimento?.veiculoPlaca);
        
        if (abastecimento) {
            const dataObj = new Date(abastecimento.data);
            const dataFormatada = dataObj.toLocaleDateString('pt-BR');
            const horaFormatada = dataObj.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            document.getElementById('modalDetalhesBody').innerHTML = `
                <div class="detalhes-grid">
                    <div class="detalhe-item">
                        <label><i class="fas fa-truck"></i> Veículo</label>
                        <div class="valor">${veiculo ? `${abastecimento.veiculoPlaca} - ${veiculo.modelo}` : abastecimento.veiculoPlaca}</div>
                    </div>
                    
                    <div class="detalhe-item">
                        <label><i class="fas fa-calendar-alt"></i> Data e Hora</label>
                        <div class="valor">${dataFormatada} às ${horaFormatada}</div>
                    </div>
                    
                    <div class="detalhe-item">
                        <label><i class="fas fa-tachometer-alt"></i> Odômetro/Km</label>
                        <div class="valor">${abastecimento.odometro.toLocaleString('pt-BR')}</div>
                    </div>
                    
                    <div class="detalhe-item">
                        <label><i class="fas fa-gas-pump"></i> Combustível</label>
                        <div class="valor">${abastecimento.tipoCombustivel}</div>
                    </div>
                    
                    <div class="detalhe-item">
                        <label><i class="fas fa-oil-can"></i> Quantidade</label>
                        <div class="valor">${abastecimento.quantidadeLitros.toFixed(2)} litros</div>
                    </div>
                    
                    <div class="detalhe-item">
                        <label><i class="fas fa-tag"></i> Preço por Litro</label>
                        <div class="valor">R$ ${abastecimento.precoLitro.toFixed(3)}</div>
                    </div>
                    
                    <div class="detalhe-item">
                        <label><i class="fas fa-money-bill-wave"></i> Valor Total</label>
                        <div class="valor text-success">${abastecimento.valorTotal.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                        })}</div>
                    </div>
                    
                    <div class="detalhe-item">
                        <label><i class="fas fa-store"></i> Posto/Fornecedor</label>
                        <div class="valor">${abastecimento.posto || 'Não informado'}</div>
                    </div>
                </div>
                
                ${abastecimento.observacoes ? `
                <div class="detalhe-item full-width">
                    <label><i class="fas fa-sticky-note"></i> Observações</label>
                    <div class="valor">${abastecimento.observacoes}</div>
                </div>
                ` : ''}
            `;
            
            modalDetalhes.style.display = 'flex';
        }
    };
    
    // ==================== FUNÇÕES DE FILTRO ====================
    
    function toggleDatasPersonalizadas() {
        const dataPersonalizadaGroup = document.getElementById('dataPersonalizadaGroup');
        if (filtroPeriodo.value === 'personalizado') {
            dataPersonalizadaGroup.style.display = 'block';
        } else {
            dataPersonalizadaGroup.style.display = 'none';
        }
    }
    
    function aplicarFiltros() {
        const filtros = {
            veiculo: filtroVeiculo.value || null,
            combustivel: filtroCombustivel.value || null,
            periodo: filtroPeriodo.value || null
        };
        
        if (filtroPeriodo.value === 'personalizado') {
            filtros.dataInicio = document.getElementById('filtroDataInicio').value;
            filtros.dataFim = document.getElementById('filtroDataFim').value;
        }
        
        carregarAbastecimentos(filtros);
        atualizarEstatisticas(filtros);
    }
    
    function limparFiltros() {
        filtroVeiculo.value = '';
        filtroPeriodo.value = '30';
        filtroCombustivel.value = '';
        document.getElementById('filtroDataInicio').value = '';
        document.getElementById('filtroDataFim').value = '';
        document.getElementById('dataPersonalizadaGroup').style.display = 'none';
        document.getElementById('filterAbastecimentos').value = '';
        
        carregarAbastecimentos();
        atualizarEstatisticas();
    }
    
    // ==================== ESTATÍSTICAS ====================
    
    function atualizarEstatisticas(filtros = {}) {
        console.log('Atualizando estatísticas...');
        
        // Aplicar filtros aos dados
        let dadosFiltrados = [...abastecimentos];
        
        if (filtros.veiculo) {
            dadosFiltrados = dadosFiltrados.filter(a => a.veiculoPlaca === filtros.veiculo);
        }
        
        if (filtros.combustivel) {
            dadosFiltrados = dadosFiltrados.filter(a => a.tipoCombustivel === filtros.combustivel);
        }
        
        if (filtros.periodo) {
            const hoje = new Date();
            let dataLimite = new Date();
            
            switch(filtros.periodo) {
                case '7': dataLimite.setDate(hoje.getDate() - 7); break;
                case '30': dataLimite.setDate(hoje.getDate() - 30); break;
                case 'hoje': dataLimite = hoje; break;
                case 'personalizado':
                    if (filtros.dataInicio && filtros.dataFim) {
                        dadosFiltrados = dadosFiltrados.filter(a => {
                            const dataAbastecimento = new Date(a.data);
                            return dataAbastecimento >= new Date(filtros.dataInicio) && 
                                   dataAbastecimento <= new Date(filtros.dataFim);
                        });
                    }
                    break;
            }
            
            if (filtros.periodo !== 'personalizado') {
                dadosFiltrados = dadosFiltrados.filter(a => {
                    return new Date(a.data) >= dataLimite;
                });
            }
        }
        
        // Calcular estatísticas
        const totalAbastecimentos = dadosFiltrados.length;
        const totalLitros = dadosFiltrados.reduce((sum, a) => sum + a.quantidadeLitros, 0);
        const totalValor = dadosFiltrados.reduce((sum, a) => sum + a.valorTotal, 0);
        const mediaPreco = totalLitros > 0 ? totalValor / totalLitros : 0;
        
        // Atualizar elementos HTML
        document.getElementById('totalAbastecimentos').textContent = totalAbastecimentos;
        document.getElementById('totalLitros').textContent = totalLitros.toFixed(1) + ' L';
        document.getElementById('totalValor').textContent = totalValor.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
        document.getElementById('mediaPreco').textContent = mediaPreco.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }) + '/L';
    }
    
    // ==================== EXPORTAÇÃO E RELATÓRIOS ====================
    
    function exportarDados() {
        if (abastecimentos.length === 0) {
            alert('Não há abastecimentos para exportar.');
            return;
        }
        
        // Criar CSV
        let csv = 'Data,Veículo,Odômetro,Combustível,Litros,Preço por Litro,Valor Total,Posto\n';
        
        abastecimentos.forEach(abastecimento => {
            const dataObj = new Date(abastecimento.data);
            const dataFormatada = dataObj.toLocaleDateString('pt-BR');
            
            csv += `"${dataFormatada}","${abastecimento.veiculoPlaca}","${abastecimento.odometro}","${abastecimento.tipoCombustivel}",`;
            csv += `"${abastecimento.quantidadeLitros}","${abastecimento.precoLitro}","${abastecimento.valorTotal}","${abastecimento.posto || ''}"\n`;
        });
        
        // Criar blob e fazer download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `abastecimentos_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    function gerarRelatorioConsumo() {
        if (veiculos.length === 0) {
            alert('Não há veículos cadastrados para gerar relatório.');
            return;
        }
        
        let relatorio = '=== RELATÓRIO DE CONSUMO DE COMBUSTÍVEL ===\n\n';
        
        veiculos.forEach(veiculo => {
            const abastecimentosVeiculo = abastecimentos.filter(a => a.veiculoPlaca === veiculo.placa);
            
            if (abastecimentosVeiculo.length > 0) {
                const totalLitros = abastecimentosVeiculo.reduce((sum, a) => sum + a.quantidadeLitros, 0);
                const totalValor = abastecimentosVeiculo.reduce((sum, a) => sum + a.valorTotal, 0);
                const consumoMedio = totalLitros / abastecimentosVeiculo.length;
                
                relatorio += `Veículo: ${veiculo.placa} - ${veiculo.modelo}\n`;
                relatorio += `Total de abastecimentos: ${abastecimentosVeiculo.length}\n`;
                relatorio += `Total de litros: ${totalLitros.toFixed(2)} L\n`;
                relatorio += `Valor total gasto: R$ ${totalValor.toFixed(2)}\n`;
                relatorio += `Consumo médio por abastecimento: ${consumoMedio.toFixed(2)} L\n`;
                relatorio += '─'.repeat(50) + '\n\n';
            }
        });
        
        // Criar blob e fazer download
        const blob = new Blob([relatorio], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `relatorio_consumo_${new Date().toISOString().split('T')[0]}.txt`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});