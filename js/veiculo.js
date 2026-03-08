// veiculo.js - Gerencia o cadastro de veículos

document.addEventListener('DOMContentLoaded', function() {
    console.log('veiculo.js carregado');
    
    // Elementos do formulário
    const formVeiculo = document.getElementById('formVeiculo');
    const btnLimpar = document.getElementById('btnLimpar');
    const tabelaBody = document.getElementById('tabelaBody');
    const filterInput = document.getElementById('filterInput');
    const totalVeiculos = document.getElementById('totalVeiculos');
    
    // Modal de confirmação
    const modal = document.getElementById('confirmModal');
    const btnCancelar = document.getElementById('btnCancelar');
    const btnConfirmarExcluir = document.getElementById('btnConfirmarExcluir');
    
    // Variáveis globais
    let veiculos = JSON.parse(localStorage.getItem('veiculos')) || [];
    let veiculoParaExcluir = null;
    
    // ==================== INICIALIZAÇÃO ====================
    inicializar();
    
    function inicializar() {
        // Carregar veículos salvos
        carregarVeiculos();
        atualizarContador();
        
        // Configurar máscara da placa
        const placaInput = document.getElementById('placa');
        placaInput.addEventListener('input', formatarPlaca);
        
        // Event Listeners
        formVeiculo.addEventListener('submit', salvarVeiculo);
        btnLimpar.addEventListener('click', limparFormulario);
        filterInput.addEventListener('input', filtrarTabela);
        
        // Modal events
        btnCancelar.addEventListener('click', fecharModal);
        btnConfirmarExcluir.addEventListener('click', confirmarExclusao);
        
        // Fechar modal ao clicar fora
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                fecharModal();
            }
        });
    }
    
    // ==================== FUNÇÕES DO FORMULÁRIO ====================
    
    function formatarPlaca(e) {
        let valor = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        
        if (valor.length > 3) {
            valor = valor.substring(0, 3) + '-' + valor.substring(3, 7);
        }
        
        e.target.value = valor;
    }
    
    function validarPlaca(placa) {
        const regexPlaca = /^[A-Z]{3}-?\d[A-Z]\d{2}$|^[A-Z]{3}-?\d{4}$/;
        return regexPlada.test(placa.replace('-', ''));
    }
    
    function validarRenavam(renavam) {
        return /^\d{11}$/.test(renavam);
    }
    
    function salvarVeiculo(e) {
        e.preventDefault(); // IMPEDIR ENVIO PADRÃO DO FORMULÁRIO
        console.log('Tentando salvar veículo...');
        
        // Coletar dados do formulário
        const veiculo = {
            id: Date.now(), // ID único baseado no timestamp
            placa: document.getElementById('placa').value.trim(),
            modelo: document.getElementById('modelo').value.trim(),
            renavam: document.getElementById('renavam').value.trim(),
            ano: document.getElementById('ano').value,
            cor: document.getElementById('cor').value.trim(),
            medidor: document.getElementById('medidor').value,
            combustivel: document.getElementById('combustivel').value,
            status: document.getElementById('status').value,
            dataCadastro: new Date().toLocaleString('pt-BR')
        };
        
        // Validações
        if (!veiculo.placa) {
            alert('Por favor, informe a placa do veículo');
            document.getElementById('placa').focus();
            return;
        }
        
        if (!veiculo.modelo) {
            alert('Por favor, informe o modelo do veículo');
            document.getElementById('modelo').focus();
            return;
        }
        
        if (!veiculo.renavam || !validarRenavam(veiculo.renavam)) {
            alert('Renavam inválido! Deve conter 11 dígitos.');
            document.getElementById('renavam').focus();
            return;
        }
        
        // Verificar se placa já existe
        const placaExistente = veiculos.find(v => v.placa === veiculo.placa);
        if (placaExistente) {
            if (confirm('Já existe um veículo com esta placa. Deseja atualizar?')) {
                // Atualizar veículo existente
                const index = veiculos.findIndex(v => v.placa === veiculo.placa);
                veiculos[index] = veiculo;
                alert('Veículo atualizado com sucesso!');
            } else {
                return;
            }
        } else {
            // Adicionar novo veículo
            veiculos.push(veiculo);
            alert('Veículo cadastrado com sucesso!');
        }
        
        // Salvar no localStorage
        localStorage.setItem('veiculos', JSON.stringify(veiculos));
        console.log('Veículos salvos no localStorage:', veiculos);
        
        // Atualizar interface
        carregarVeiculos();
        limparFormulario();
        atualizarContador();
    }
    
    function limparFormulario() {
        formVeiculo.reset();
        document.getElementById('placa').focus();
        
        // Limpar mensagens de erro
        document.querySelectorAll('.error-message').forEach(el => {
            el.textContent = '';
        });
    }
    
    // ==================== FUNÇÕES DA TABELA ====================
    
    function carregarVeiculos() {
        tabelaBody.innerHTML = '';
        
        if (veiculos.length === 0) {
            tabelaBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        <i class="fas fa-info-circle"></i> Nenhum veículo cadastrado ainda.
                    </td>
                </tr>
            `;
            return;
        }
        
        veiculos.forEach(veiculo => {
            const tr = document.createElement('tr');
            
            // Determinar classe de status
            let statusClass = '';
            switch(veiculo.status) {
                case 'Ativo': statusClass = 'status-active'; break;
                case 'Manutenção': statusClass = 'status-warning'; break;
                case 'Inativo': statusClass = 'status-inactive'; break;
            }
            
            tr.innerHTML = `
                <td><strong>${veiculo.placa}</strong></td>
                <td>${veiculo.modelo}</td>
                <td>${veiculo.renavam}</td>
                <td>${veiculo.ano || '-'}</td>
                <td>${veiculo.medidor}</td>
                <td>${veiculo.combustivel}</td>
                <td><span class="status-badge ${statusClass}">${veiculo.status}</span></td>
                <td class="actions">
                    <button class="btn-icon btn-edit" onclick="editarVeiculo('${veiculo.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="abrirModalExclusao('${veiculo.id}', '${veiculo.placa}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tabelaBody.appendChild(tr);
        });
    }
    
    function filtrarTabela() {
        const filtro = filterInput.value.toLowerCase();
        const linhas = tabelaBody.getElementsByTagName('tr');
        
        for (let i = 0; i < linhas.length; i++) {
            const texto = linhas[i].textContent.toLowerCase();
            linhas[i].style.display = texto.includes(filtro) ? '' : 'none';
        }
    }
    
    function atualizarContador() {
        totalVeiculos.textContent = `${veiculos.length} veículo${veiculos.length !== 1 ? 's' : ''}`;
    }
    
    // ==================== FUNÇÕES DE EDIÇÃO/EXCLUSÃO ====================
    
    window.editarVeiculo = function(id) {
        const veiculo = veiculos.find(v => v.id == id);
        
        if (veiculo) {
            document.getElementById('placa').value = veiculo.placa;
            document.getElementById('modelo').value = veiculo.modelo;
            document.getElementById('renavam').value = veiculo.renavam;
            document.getElementById('ano').value = veiculo.ano || '';
            document.getElementById('cor').value = veiculo.cor || '';
            document.getElementById('medidor').value = veiculo.medidor;
            document.getElementById('combustivel').value = veiculo.combustivel;
            document.getElementById('status').value = veiculo.status;
            
            // Rolar para o formulário
            document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
            
            // Mudar texto do botão
            const btnSubmit = formVeiculo.querySelector('button[type="submit"]');
            btnSubmit.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar Veículo';
            btnSubmit.dataset.editId = id;
        }
    };
    
    window.abrirModalExclusao = function(id, placa) {
        veiculoParaExcluir = id;
        document.getElementById('placaExcluir').textContent = placa;
        modal.style.display = 'flex';
    };
    
    function fecharModal() {
        modal.style.display = 'none';
        veiculoParaExcluir = null;
    }
    
    function confirmarExclusao() {
        if (veiculoParaExcluir) {
            veiculos = veiculos.filter(v => v.id != veiculoParaExcluir);
            localStorage.setItem('veiculos', JSON.stringify(veiculos));
            
            carregarVeiculos();
            atualizarContador();
            fecharModal();
            
            alert('Veículo excluído com sucesso!');
        }
    }
    
    // ==================== EXPORTAÇÃO ====================
    
    document.getElementById('btnExport')?.addEventListener('click', function() {
        if (veiculos.length === 0) {
            alert('Não há veículos para exportar.');
            return;
        }
        
        // Criar CSV
        let csv = 'Placa,Modelo,Renavam,Ano,Cor,Medidor,Combustivel,Status\n';
        
        veiculos.forEach(veiculo => {
            csv += `"${veiculo.placa}","${veiculo.modelo}","${veiculo.renavam}","${veiculo.ano || ''}","${veiculo.cor || ''}","${veiculo.medidor}","${veiculo.combustivel}","${veiculo.status}"\n`;
        });
        
        // Criar blob e fazer download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `veiculos_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});