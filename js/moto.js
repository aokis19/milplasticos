// =============================================
// MOTORISTAS.JS - Controle de Motoristas
// Sistema de Ponto, KM e Pagamentos
// =============================================

(function() {
    'use strict';

    // ============ CONFIGURAÇÃO ============
    const STORAGE_KEY = 'controleMotoristas_systemmil_v2';
    const VALOR_KM = 0.10;
    const VALOR_ALMOCO = 35.00;
    const VALOR_JANTA = 35.00;
    const VALOR_CAFE = 18.00;

    let appData = { motoristas: [], ponto: {}, pagamentos: [], registrosKM: [] };

    // ============ FUNÇÕES AUXILIARES ============
    function timeToHours(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h + m / 60;
    }

    function formatHoras(horas) {
        if (isNaN(horas) || horas === undefined) return '0,0h';
        const h = Math.floor(Math.abs(horas));
        const m = Math.round((Math.abs(horas) - h) * 60);
        return (horas < 0 ? '-' : '') + h + ',' + String(m).padStart(2, '0') + 'h';
    }

    function formatMoney(valor) {
        return 'R$ ' + valor.toFixed(2).replace('.', ',');
    }

    function getDiasNoMes(mes, ano) {
        return new Date(ano, mes, 0).getDate();
    }

    function getSemana(dia, mes, ano) {
        const dias = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
        return dias[new Date(ano, mes - 1, dia).getDay()];
    }

    function showLoading() {
        document.getElementById('loadingOverlay')?.classList.add('active');
    }

    function hideLoading() {
        document.getElementById('loadingOverlay')?.classList.remove('active');
    }

    function getPeriodoConfig() {
        const diaInicio = parseInt(document.getElementById('periodoDiaInicio')?.value || 20);
        const diaFim = parseInt(document.getElementById('periodoDiaFim')?.value || 21);
        return { diaInicio, diaFim };
    }

    function getDatasPeriodo(mesRef, anoRef, diaInicio, diaFim) {
        const datas = [];
        const diasNoMes = getDiasNoMes(mesRef, anoRef);
        const diaInicioAjustado = Math.min(diaInicio, diasNoMes);

        for (let dia = diaInicioAjustado; dia <= diasNoMes; dia++) {
            datas.push({ dia, mes: mesRef, ano: anoRef });
        }

        let mesSeguinte = mesRef + 1;
        let anoSeguinte = anoRef;
        if (mesSeguinte > 12) { mesSeguinte = 1; anoSeguinte++; }
        
        const diasNoMesSeguinte = getDiasNoMes(mesSeguinte, anoSeguinte);
        const diaFimAjustado = Math.min(diaFim, diasNoMesSeguinte);

        for (let dia = 1; dia <= diaFimAjustado; dia++) {
            datas.push({ dia, mes: mesSeguinte, ano: anoSeguinte });
        }

        return datas;
    }

    function calcularTotalHoras(intervalos) {
        if (!intervalos || intervalos.length === 0) return 0;
        let total = 0;
        for (const intervalo of intervalos) {
            if (intervalo.entrada && intervalo.saida) {
                const entrada = timeToHours(intervalo.entrada);
                const saida = timeToHours(intervalo.saida);
                if (saida > entrada) total += (saida - entrada);
                else if (saida < entrada) total += (24 - entrada) + saida;
            }
        }
        return total;
    }

    function calcularDiarias(intervalos, tipo, pernoite) {
        let valorAlmoco = 0, valorJanta = 0, valorCafe = 0;

        if (tipo === 'externo' && intervalos && intervalos.length > 0) {
            for (const intervalo of intervalos) {
                if (intervalo.saida) {
                    const saidaHoras = timeToHours(intervalo.saida);
                    if (saidaHoras >= 13 || (saidaHoras < 5 && saidaHoras >= 0)) valorAlmoco = VALOR_ALMOCO;
                    if (saidaHoras >= 19.5 || (saidaHoras < 5 && saidaHoras >= 0)) valorJanta = VALOR_JANTA;
                }
            }
        }

        if (pernoite) valorCafe = VALOR_CAFE;

        return { almoco: valorAlmoco, janta: valorJanta, cafe: valorCafe, total: valorAlmoco + valorJanta + valorCafe };
    }

    // ============ CARREGAR/SALVAR DADOS ============
    function carregarDados() {
        if (window.SyncSystem) {
            appData = window.SyncSystem.getData();
            console.log('✅ Dados carregados via SyncSystem');
        } else {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                try {
                    appData = JSON.parse(data);
                } catch (e) {
                    appData = { motoristas: [], ponto: {}, pagamentos: [], registrosKM: [] };
                }
            }
            console.warn('⚠️ SyncSystem não encontrado - usando localStorage');
        }
        
        if (!appData.registrosKM) appData.registrosKM = [];
        if (!appData.ponto) appData.ponto = {};
        if (!appData.pagamentos) appData.pagamentos = [];
    }

    function salvarDados() {
        if (window.SyncSystem) {
            window.SyncSystem.updateData(appData, 'motoristas');
        } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        }
    }

    // ============ MOTORISTAS ============
    function carregarSelectsMotoristas() {
        const selects = ['painelMotorista', 'pontoMotorista', 'pagMotorista', 'kmMotoristaSelect', 'kmFiltroMotorista', 'bancoMotorista'];
        const motoristasAtivos = (appData.motoristas || []).filter(m => m.ativo !== false);

        selects.forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;
            let options = '';
            if (id === 'kmFiltroMotorista' || id === 'bancoMotorista') options = '<option value="todos">Todos</option>';
            options += motoristasAtivos.map(m => `<option value="${m.cod}">${m.nome}</option>`).join('');
            select.innerHTML = options;
        });
    }

    function carregarTabelaMotoristas() {
        const tbody = document.getElementById('tabelaMotoristas');
        if (!tbody) return;
        tbody.innerHTML = (appData.motoristas || []).filter(m => m.ativo !== false).map(m => `
            <tr>
                <td>${m.cod}</td>
                <td><strong>${m.nome}</strong></td>
                <td>${m.funcao || '-'}</td>
                <td>${m.jornadaBase || 8}h</td>
                <td>${m.tolerancia || 10}min</td>
                <td>${m.adNoturno ? '✅' : '❌'}</td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="window.editarMotorista(${m.cod})">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="window.excluirMotorista(${m.cod})">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    window.abrirModalMotorista = function(cod = null) {
        const modal = document.getElementById('modalMotorista');
        if (!modal) return;
        modal.classList.add('active');
        
        if (cod) {
            document.getElementById('modalMotoristaTitulo').innerText = 'Editar Motorista';
            const m = (appData.motoristas || []).find(m => m.cod === cod);
            if (m) {
                document.getElementById('motoristaCod').value = m.cod;
                document.getElementById('motoristaNome').value = m.nome;
                document.getElementById('motoristaFuncao').value = m.funcao || '';
                document.getElementById('jornadaBase').value = m.jornadaBase || 8;
                document.getElementById('motoristaTolerancia').value = m.tolerancia || 10;
                document.getElementById('motoristaAdNoturno').checked = m.adNoturno || false;
            }
        } else {
            document.getElementById('modalMotoristaTitulo').innerText = 'Novo Motorista';
            ['motoristaCod', 'motoristaNome', 'motoristaFuncao'].forEach(id => document.getElementById(id).value = '');
            document.getElementById('jornadaBase').value = 8;
            document.getElementById('motoristaTolerancia').value = 10;
            document.getElementById('motoristaAdNoturno').checked = false;
        }
    };

    window.editarMotorista = function(cod) {
        window.abrirModalMotorista(cod);
    };

    window.excluirMotorista = function(cod) {
        if (confirm('Excluir motorista?')) {
            appData.motoristas = appData.motoristas.filter(m => m.cod !== cod);
            salvarDados();
            carregarSelectsMotoristas();
            carregarTabelaMotoristas();
            window.atualizarPainel();
        }
    };

    window.salvarMotorista = function() {
        const motorista = {
            cod: parseInt(document.getElementById('motoristaCod').value),
            nome: document.getElementById('motoristaNome').value.toUpperCase(),
            funcao: document.getElementById('motoristaFuncao').value.toUpperCase(),
            jornadaBase: parseFloat(document.getElementById('jornadaBase').value),
            tolerancia: parseInt(document.getElementById('motoristaTolerancia').value),
            adNoturno: document.getElementById('motoristaAdNoturno').checked,
            ativo: true
        };
        
        if (!motorista.cod || !motorista.nome) {
            alert('Preencha código e nome!');
            return;
        }
        
        appData.motoristas = (appData.motoristas || []).filter(m => m.cod !== motorista.cod);
        appData.motoristas.push(motorista);
        salvarDados();
        window.fecharModal('modalMotorista');
        carregarSelectsMotoristas();
        carregarTabelaMotoristas();
        window.atualizarPainel();
    };

    // ============ PONTO ============
    function renderizarIntervalos(key, intervalos) {
        if (!intervalos) intervalos = [{ entrada: '', saida: '' }];
        let html = `<div class="intervalos-container" data-key="${key}">`;
        intervalos.forEach((intervalo, idx) => {
            html += `<div class="intervalo-row" data-idx="${idx}">
                <span class="intervalo-label">${idx === 0 ? '📥' : '⏱️'}</span>
                <input type="time" class="intervalo-entrada" value="${intervalo.entrada || ''}">
                <span>→</span>
                <input type="time" class="intervalo-saida" value="${intervalo.saida || ''}">
                ${idx > 0 ? `<button class="btn-remove-intervalo" onclick="window.removerIntervalo('${key}', ${idx})">✖</button>` : ''}
            </div>`;
        });
        html += `<button class="btn-add-intervalo" onclick="window.adicionarIntervalo('${key}')">+ Adicionar Intervalo</button></div>`;
        return html;
    }

    window.handleIntervaloChange = function(e) {
        const container = e.target.closest('.intervalos-container');
        const row = e.target.closest('.intervalo-row');
        if (!container || !row) return;
        const key = container.dataset.key;
        const idx = parseInt(row.dataset.idx);
        if (!appData.ponto[key]) appData.ponto[key] = { intervalos: [], tipo: 'interno', pernoite: false };
        if (!appData.ponto[key].intervalos) appData.ponto[key].intervalos = [];
        if (!appData.ponto[key].intervalos[idx]) appData.ponto[key].intervalos[idx] = {};
        appData.ponto[key].intervalos[idx].entrada = row.querySelector('.intervalo-entrada').value;
        appData.ponto[key].intervalos[idx].saida = row.querySelector('.intervalo-saida').value;
        salvarDados();
        window.carregarPonto();
    };

    window.adicionarIntervalo = function(key) {
        if (!appData.ponto[key]) appData.ponto[key] = { intervalos: [{ entrada: '', saida: '' }], tipo: 'interno', pernoite: false };
        if (!appData.ponto[key].intervalos) appData.ponto[key].intervalos = [{ entrada: '', saida: '' }];
        appData.ponto[key].intervalos.push({ entrada: '', saida: '' });
        salvarDados();
        window.carregarPonto();
    };

    window.removerIntervalo = function(key, idx) {
        if (appData.ponto[key]?.intervalos?.length > 1) {
            appData.ponto[key].intervalos.splice(idx, 1);
            salvarDados();
            window.carregarPonto();
        }
    };

    window.updateTipo = function(key, tipo) {
        if (!appData.ponto[key]) appData.ponto[key] = { intervalos: [], pernoite: false };
        appData.ponto[key].tipo = tipo;
        salvarDados();
        window.carregarPonto();
    };

    window.togglePernoite = function(key, checked) {
        if (!appData.ponto[key]) appData.ponto[key] = { intervalos: [], tipo: 'interno' };
        appData.ponto[key].pernoite = checked;
        salvarDados();
        window.carregarPonto();
    };

    window.toggleFolga = function(key, cod, mes, ano, dia, isFolga) {
        if (!appData.ponto[key]) appData.ponto[key] = { intervalos: [{ entrada: '', saida: '' }], tipo: 'interno', pernoite: false };
        appData.ponto[key].folga = isFolga;
        salvarDados();
        window.carregarPonto();
    };

    window.carregarPonto = function() {
        const cod = parseInt(document.getElementById('pontoMotorista').value);
        const mesRef = parseInt(document.getElementById('pontoMes').value);
        const anoRef = parseInt(document.getElementById('pontoAno').value);
        const motorista = (appData.motoristas || []).find(m => m.cod === cod);
        if (!motorista) return;

        const { diaInicio, diaFim } = getPeriodoConfig();
        const datasPeriodo = getDatasPeriodo(mesRef, anoRef, diaInicio, diaFim);

        let html = `<table><thead><tr><th>Dia</th><th>Data</th><th>Sem.</th><th>Folga</th><th>Tipo</th><th>Intervalos</th><th>Total Horas</th><th>Saldo</th><th>Diárias</th><th>Pernoite</th></tr></thead><tbody>`;
        let totalPeriodoHT = 0, totalPeriodoExtras = 0, totalDiariasPeriodo = 0;

        for (const data of datasPeriodo) {
            const { dia, mes, ano } = data;
            const key = `${cod}_${ano}_${mes}_${dia}`;
            const reg = appData.ponto[key] || { intervalos: [{ entrada: '', saida: '' }], folga: false, tipo: 'interno', pernoite: false };
            if (!reg.intervalos || reg.intervalos.length === 0) reg.intervalos = [{ entrada: '', saida: '' }];
            if (!reg.tipo) reg.tipo = 'interno';
            if (reg.pernoite === undefined) reg.pernoite = false;

            const isFolga = reg.folga || getSemana(dia, mes, ano) === 'DOM';
            let totalHoras = 0, saldo = 0;

            if (!isFolga) {
                totalHoras = calcularTotalHoras(reg.intervalos);
                const jornadaBase = motorista.jornadaBase || 8;
                const toleranciaHoras = (motorista.tolerancia || 10) / 60;
                saldo = totalHoras - jornadaBase - toleranciaHoras;
                if (totalHoras > 0) {
                    totalPeriodoHT += totalHoras;
                    if (saldo > 0) totalPeriodoExtras += saldo;
                }
            }

            const diarias = calcularDiarias(reg.intervalos, reg.tipo, reg.pernoite);
            if (diarias.total > 0) totalDiariasPeriodo += diarias.total;

            const intervalosHtml = renderizarIntervalos(key, reg.intervalos);
            const dataStr = `${String(dia).padStart(2,'0')}/${String(mes).padStart(2,'0')}/${ano}`;

            html += `<tr data-key="${key}" style="${isFolga ? 'background:#fff3e0' : ''}">
                <td><strong>${dia}</strong></td><td>${dataStr}</td><td>${getSemana(dia, mes, ano)}</td>
                <td><input type="checkbox" ${isFolga ? 'checked' : ''} onchange="window.toggleFolga('${key}',${cod},${mes},${ano},${dia},this.checked)"></td>
                <td><select onchange="window.updateTipo('${key}', this.value)" style="font-size:0.7rem;padding:0.2rem">
                    <option value="interno" ${reg.tipo === 'interno' ? 'selected' : ''}>Interno</option>
                    <option value="externo" ${reg.tipo === 'externo' ? 'selected' : ''}>Externo</option>
                </select></td>
                <td>${intervalosHtml}</td>
                <td class="total-horas" id="total-${key}">${totalHoras > 0 ? formatHoras(totalHoras) : '-'}</td>
                <td class="${saldo > 0.05 ? 'text-success' : (saldo < -0.05 ? 'text-danger' : '')}">${Math.abs(saldo) > 0.05 ? formatHoras(saldo) : '-'}</td>
                <td>${diarias.total > 0 ? `<span class="badge badge-info">${formatMoney(diarias.total)}</span>` : '-'}</td>
                <td><input type="checkbox" ${reg.pernoite ? 'checked' : ''} onchange="window.togglePernoite('${key}', this.checked)"></td>
            </tr>`;
        }

        html += `</tbody></table>`;
        document.getElementById('pontoContainer').innerHTML = html;

        document.querySelectorAll('.intervalo-entrada, .intervalo-saida').forEach(input => {
            input.removeEventListener('change', window.handleIntervaloChange);
            input.addEventListener('change', window.handleIntervaloChange);
        });

        document.getElementById('totaisPonto').innerHTML = `
            <div class="stat-card"><div class="stat-value">${formatHoras(totalPeriodoHT)}</div><div class="stat-label">Total Horas Período</div></div>
            <div class="stat-card success"><div class="stat-value">${formatHoras(totalPeriodoExtras)}</div><div class="stat-label">Total Extras</div></div>
            <div class="stat-card warning"><div class="stat-value">${formatMoney(totalDiariasPeriodo)}</div><div class="stat-label">Total Diárias</div></div>
        `;
    };

    window.salvarPonto = function() {
        salvarDados();
        alert('✅ Registros salvos!');
    };

    // ============ PAINEL ============
    window.atualizarPainel = function() {
        const mes = parseInt(document.getElementById('painelMes').value);
        const ano = parseInt(document.getElementById('painelAno').value);
        const cod = parseInt(document.getElementById('painelMotorista').value);
        const motorista = (appData.motoristas || []).find(m => m.cod === cod);
        if (!motorista) return;

        const { diaInicio, diaFim } = getPeriodoConfig();
        const datasPeriodo = getDatasPeriodo(mes, ano, diaInicio, diaFim);

        let totalHT = 0, totalExtras = 0, totalFaltas = 0, diasTrab = 0, totalDiarias = 0;

        for (const data of datasPeriodo) {
            const { dia, mes: m, ano: a } = data;
            const key = `${cod}_${a}_${m}_${dia}`;
            const reg = appData.ponto[key];
            if (!reg || reg.folga) continue;
            const totalHoras = calcularTotalHoras(reg.intervalos);
            if (totalHoras <= 0) continue;
            const jornadaBase = motorista.jornadaBase || 8;
            const tolerancia = (motorista.tolerancia || 10) / 60;
            const saldo = totalHoras - jornadaBase - tolerancia;
            const diarias = calcularDiarias(reg.intervalos, reg.tipo || 'interno', reg.pernoite || false);
            totalHT += totalHoras;
            diasTrab++;
            if (saldo > 0) totalExtras += saldo;
            else if (saldo < 0) totalFaltas += Math.abs(saldo);
            totalDiarias += diarias.total;
        }

        document.getElementById('statsContainer').innerHTML = `
            <div class="stat-card"><div class="stat-value">${diasTrab}</div><div class="stat-label">Dias Trabalhados</div></div>
            <div class="stat-card"><div class="stat-value">${formatHoras(totalHT)}</div><div class="stat-label">Horas Trabalhadas</div></div>
            <div class="stat-card success"><div class="stat-value">${formatHoras(totalExtras)}</div><div class="stat-label">Horas Extras</div></div>
            <div class="stat-card danger"><div class="stat-value">${formatHoras(totalFaltas)}</div><div class="stat-label">Faltas/Atrasos</div></div>
        `;

        let totalKM = 0, valorKMTotal = 0;
        const registrosKM = (appData.registrosKM || []).filter(r => {
            const dataReg = new Date(r.data + 'T00:00:00');
            const primeiraData = new Date(datasPeriodo[0].ano, datasPeriodo[0].mes - 1, datasPeriodo[0].dia);
            const ultimaData = new Date(datasPeriodo[datasPeriodo.length - 1].ano, datasPeriodo[datasPeriodo.length - 1].mes - 1, datasPeriodo[datasPeriodo.length - 1].dia);
            ultimaData.setHours(23, 59, 59);
            return r.codMotorista === cod && dataReg >= primeiraData && dataReg <= ultimaData;
        });
        registrosKM.forEach(r => { totalKM += r.totalKM || 0; valorKMTotal += (r.totalKM || 0) * VALOR_KM; });

        document.getElementById('resumoFinanceiro').innerHTML = `
            <div class="stat-card warning"><div class="stat-value">${formatMoney(totalDiarias)}</div><div class="stat-label">Total Diárias</div></div>
            <div class="stat-card info"><div class="stat-value">${totalKM} km</div><div class="stat-label">Total KM</div></div>
            <div class="stat-card"><div class="stat-value">${formatMoney(valorKMTotal)}</div><div class="stat-label">Valor KM</div></div>
            <div class="stat-card success"><div class="stat-value">${formatMoney(totalDiarias + valorKMTotal)}</div><div class="stat-label">💰 Total Geral</div></div>
        `;
    };

    // ============ BANCO DE HORAS ============
    window.carregarBancoHoras = function() {
        const tbody = document.getElementById('tabelaBancoHoras');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Funcionalidade em desenvolvimento</td></tr>';
    };

    // ============ KM ============
    window.abrirModalKM = function() {
        document.getElementById('modalKM').classList.add('active');
        document.getElementById('kmData').value = new Date().toISOString().split('T')[0];
    };

    window.calcularKM = function() {
        const inicial = parseFloat(document.getElementById('kmInicial').value) || 0;
        const final = parseFloat(document.getElementById('kmFinal').value) || 0;
        const total = final - inicial;
        document.getElementById('kmTotalCalc').innerText = total > 0 ? total + ' km' : '0 km';
        document.getElementById('kmValorCalc').innerText = formatMoney(total * VALOR_KM);
    };

    window.salvarKM = function() {
        const cod = parseInt(document.getElementById('kmMotoristaSelect').value);
        const motorista = (appData.motoristas || []).find(m => m.cod === cod);
        const inicial = parseFloat(document.getElementById('kmInicial').value) || 0;
        const final = parseFloat(document.getElementById('kmFinal').value) || 0;
        
        const registro = {
            id: Date.now(),
            data: document.getElementById('kmData').value,
            codMotorista: cod,
            motorista: motorista?.nome || '',
            veiculo: document.getElementById('kmVeiculo').value,
            kmInicial: inicial,
            kmFinal: final,
            totalKM: final - inicial,
            destino: document.getElementById('kmDestino').value
        };
        
        appData.registrosKM.push(registro);
        salvarDados();
        window.fecharModal('modalKM');
        window.carregarKM();
    };

    window.carregarKM = function() {
        const tbody = document.getElementById('tabelaKM');
        if (!tbody) return;
        const filtro = document.getElementById('kmFiltroMotorista')?.value;
        let registros = appData.registrosKM || [];
        if (filtro && filtro !== 'todos') registros = registros.filter(r => r.codMotorista == filtro);
        
        tbody.innerHTML = registros.map(r => `
            <tr>
                <td>${r.data}</td><td>${r.motorista}</td><td>${r.veiculo}</td>
                <td>${r.kmInicial}</td><td>${r.kmFinal}</td><td>${r.totalKM} km</td>
                <td>${r.destino || '-'}</td>
                <td><button class="btn btn-danger btn-sm" onclick="window.excluirKM(${r.id})">🗑️</button></td>
            </tr>
        `).join('');
    };

    window.excluirKM = function(id) {
        if (confirm('Excluir registro?')) {
            appData.registrosKM = appData.registrosKM.filter(r => r.id !== id);
            salvarDados();
            window.carregarKM();
        }
    };

    // ============ PAGAMENTOS ============
    window.abrirModalPagamento = function() {
        document.getElementById('modalPagamento').classList.add('active');
        document.getElementById('pagData').value = new Date().toISOString().split('T')[0];
    };

    window.calcPagamento = function() {
        const horas = parseFloat(document.getElementById('pagHoras').value) || 0;
        const valor = parseFloat(document.getElementById('pagValorHora').value) || 0;
        document.getElementById('pagValorTotal').innerText = formatMoney(horas * valor);
    };

    window.salvarPagamento = function() {
        const cod = parseInt(document.getElementById('pagMotorista').value);
        const motorista = (appData.motoristas || []).find(m => m.cod === cod);
        const horas = parseFloat(document.getElementById('pagHoras').value) || 0;
        const valorHora = parseFloat(document.getElementById('pagValorHora').value) || 0;
        
        const pagamento = {
            id: Date.now(),
            data: document.getElementById('pagData').value,
            codMotorista: cod,
            motorista: motorista?.nome || '',
            horas: horas,
            valorHora: valorHora,
            valorTotal: horas * valorHora
        };
        
        appData.pagamentos.push(pagamento);
        salvarDados();
        window.fecharModal('modalPagamento');
        window.carregarPagamentos();
    };

    window.carregarPagamentos = function() {
        const tbody = document.getElementById('tabelaPagamentos');
        if (!tbody) return;
        tbody.innerHTML = (appData.pagamentos || []).map(p => `
            <tr>
                <td>${p.data}</td><td>${p.motorista}</td><td>${p.horas}h</td>
                <td>${formatMoney(p.valorHora)}</td><td><strong>${formatMoney(p.valorTotal)}</strong></td>
                <td><button class="btn btn-danger btn-sm" onclick="window.excluirPagamento(${p.id})">🗑️</button></td>
            </tr>
        `).join('');
    };

    window.excluirPagamento = function(id) {
        if (confirm('Excluir pagamento?')) {
            appData.pagamentos = appData.pagamentos.filter(p => p.id !== id);
            salvarDados();
            window.carregarPagamentos();
        }
    };

    // ============ UTILITÁRIOS ============
    window.fecharModal = function(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('active');
    };

    window.gerarRelatorioPDF = function() {
        alert('Funcionalidade de PDF em desenvolvimento');
    };

    // ============ INICIALIZAÇÃO ============
    function init() {
        showLoading();
        
        // Status Firebase
        if (window.SyncSystem) {
            const status = window.SyncSystem.getStatus();
            const statusEl = document.getElementById('firebaseStatus');
            if (statusEl) {
                statusEl.innerHTML = '<span class="dot"></span> Firebase Online';
                statusEl.classList.add('online');
            }
        }
        
        carregarDados();
        carregarSelectsMotoristas();
        carregarTabelaMotoristas();

        const hoje = new Date();
        document.getElementById('painelMes').value = hoje.getMonth() + 1;
        document.getElementById('pontoMes').value = hoje.getMonth() + 1;
        document.getElementById('kmFiltroMes').value = hoje.getMonth() + 1;
        document.getElementById('painelAno').value = hoje.getFullYear();
        document.getElementById('pontoAno').value = hoje.getFullYear();
        document.getElementById('kmFiltroAno').value = hoje.getFullYear();

        window.atualizarPainel();
        window.carregarPonto();
        window.carregarBancoHoras();
        window.carregarKM();
        window.carregarPagamentos();

        // Eventos
        document.getElementById('pagHoras')?.addEventListener('input', window.calcPagamento);
        document.getElementById('pagValorHora')?.addEventListener('input', window.calcPagamento);
        document.getElementById('kmInicial')?.addEventListener('input', window.calcularKM);
        document.getElementById('kmFinal')?.addEventListener('input', window.calcularKM);

        // Tabs
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('tab-' + tab.dataset.tab)?.classList.add('active');
            });
        });

        // Fechar modais ao clicar fora
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal-overlay')) {
                e.target.classList.remove('active');
            }
        });

        hideLoading();
        console.log('✅ Sistema de Motoristas inicializado');
    }

    // Aguardar DOM + SyncSystem
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
