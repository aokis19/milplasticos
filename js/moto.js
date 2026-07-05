// ==========================================================================
// MOTORISTAS.JS - Controle de Motoristas (Versão Firebase)
// Sistema de Ponto, KM e Pagamentos - Cloud Only
// ==========================================================================

(function() {
    'use strict';

    console.log('👨‍✈️ Inicializando sistema de Motoristas (Cloud Mode)...');

    // ============ CONFIGURAÇÃO ============
    const VALOR_KM = 0.10;
    const VALOR_ALMOCO = 35.00;
    const VALOR_JANTA = 35.00;
    const VALOR_CAFE = 18.00;

    // ============ ESTADO DA APLICAÇÃO (MEMÓRIA) ============
    let appData = { 
        motoristas: [], 
        ponto: {}, 
        pagamentos: [], 
        registrosKM: [] 
    };

    // ============ REFERÊNCIA DO FIREBASE ============
    function getDB() {
        return window.db || window.firebaseDB || null;
    }

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

    // ============ CARREGAR DADOS (APENAS FIREBASE) ============
    async function carregarDados() {
        const db = getDB();
        if (!db) {
            console.error('❌ Firebase não disponível');
            return;
        }

        try {
            // Carregar motoristas
            const snapMotoristas = await db.collection('motoristas').get();
            appData.motoristas = [];
            snapMotoristas.forEach(doc => {
                const data = doc.data();
                appData.motoristas.push({ 
                    id: doc.id, 
                    firebaseId: doc.id, 
                    cod: data.cod || data.codigo || doc.id,
                    nome: data.nome || '',
                    funcao: data.funcao || '',
                    jornadaBase: data.jornadaBase || 8,
                    tolerancia: data.tolerancia || 10,
                    adNoturno: data.adNoturno || false,
                    ativo: data.ativo !== false
                });
            });

            // Carregar ponto
            const snapPonto = await db.collection('motoristas_ponto').get();
            appData.ponto = {};
            if (!snapPonto.empty) {
                snapPonto.forEach(doc => {
                    appData.ponto[doc.id] = doc.data().dados || doc.data();
                });
            }

            // Carregar pagamentos
            const snapPagamentos = await db.collection('motoristas_pagamentos')
                .orderBy('data', 'desc')
                .get();
            appData.pagamentos = [];
            snapPagamentos.forEach(doc => {
                appData.pagamentos.push({ id: doc.id, firebaseId: doc.id, ...doc.data() });
            });

            // Carregar registros KM
            const snapKM = await db.collection('motoristas_km')
                .orderBy('data', 'desc')
                .get();
            appData.registrosKM = [];
            snapKM.forEach(doc => {
                appData.registrosKM.push({ id: doc.id, firebaseId: doc.id, ...doc.data() });
            });

            console.log('✅ Dados carregados do Firebase:');
            console.log('   👨‍✈️ ' + appData.motoristas.length + ' motoristas');
            console.log('   📅 ' + Object.keys(appData.ponto).length + ' registros de ponto');
            console.log('   💰 ' + appData.pagamentos.length + ' pagamentos');
            console.log('   🚛 ' + appData.registrosKM.length + ' registros KM');

        } catch (error) {
            console.error('❌ Erro ao carregar dados:', error);
        }
    }

    // ============ SALVAR NO FIREBASE ============
    async function salvarMotoristaFB(motorista) {
        const db = getDB();
        if (!db) return false;
        try {
            const docId = motorista.firebaseId || String(motorista.cod);
            const { firebaseId, id, ...dados } = motorista;
            await db.collection('motoristas').doc(docId).set({
                ...dados,
                ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return true;
        } catch (error) {
            console.error('❌ Erro ao salvar motorista:', error);
            return false;
        }
    }

    async function salvarPontoFB(key, dados) {
        const db = getDB();
        if (!db) return false;
        try {
            await db.collection('motoristas_ponto').doc(key).set({
                dados: dados,
                ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return true;
        } catch (error) {
            console.error('❌ Erro ao salvar ponto:', error);
            return false;
        }
    }

    async function salvarPagamentoFB(pagamento) {
        const db = getDB();
        if (!db) return false;
        try {
            const { id, firebaseId, ...dados } = pagamento;
            const docRef = await db.collection('motoristas_pagamentos').add({
                ...dados,
                dataRegistro: firebase.firestore.FieldValue.serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error('❌ Erro ao salvar pagamento:', error);
            return false;
        }
    }

    async function salvarKMFB(registro) {
        const db = getDB();
        if (!db) return false;
        try {
            const { id, firebaseId, ...dados } = registro;
            const docRef = await db.collection('motoristas_km').add({
                ...dados,
                dataRegistro: firebase.firestore.FieldValue.serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error('❌ Erro ao salvar KM:', error);
            return false;
        }
    }

    async function excluirDoFB(colecao, docId) {
        const db = getDB();
        if (!db) return false;
        try {
            await db.collection(colecao).doc(String(docId)).delete();
            console.log(`✅ Excluído de ${colecao}: ${docId}`);
            return true;
        } catch (error) {
            console.error(`❌ Erro ao excluir:`, error);
            return false;
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
            options += motoristasAtivos.map(m => `<option value="${m.cod || m.firebaseId}">${m.nome}</option>`).join('');
            select.innerHTML = options;
        });
    }

    function carregarTabelaMotoristas() {
        const tbody = document.getElementById('tabelaMotoristas');
        if (!tbody) return;
        tbody.innerHTML = (appData.motoristas || []).filter(m => m.ativo !== false).map(m => `
            <tr>
                <td>${m.cod || m.firebaseId}</td>
                <td><strong>${m.nome}</strong></td>
                <td>${m.funcao || '-'}</td>
                <td>${m.jornadaBase || 8}h</td>
                <td>${m.tolerancia || 10}min</td>
                <td>${m.adNoturno ? '✅' : '❌'}</td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="window.editarMotorista('${m.cod || m.firebaseId}')">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="window.excluirMotorista('${m.cod || m.firebaseId}')">🗑️</button>
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
            const m = (appData.motoristas || []).find(m => (m.cod == cod) || (m.firebaseId == cod));
            if (m) {
                document.getElementById('motoristaCod').value = m.cod || '';
                document.getElementById('motoristaNome').value = m.nome || '';
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

    window.excluirMotorista = async function(cod) {
        if (!confirm('Excluir motorista?')) return;
        const m = appData.motoristas.find(m => (m.cod == cod) || (m.firebaseId == cod));
        appData.motoristas = appData.motoristas.filter(m => (m.cod != cod) && (m.firebaseId != cod));
        if (m?.firebaseId) await excluirDoFB('motoristas', m.firebaseId);
        carregarSelectsMotoristas();
        carregarTabelaMotoristas();
        window.atualizarPainel();
    };

    window.salvarMotorista = async function() {
        const motorista = {
            cod: document.getElementById('motoristaCod').value,
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
        
        // Remover duplicado e adicionar
        appData.motoristas = appData.motoristas.filter(m => m.cod != motorista.cod && m.firebaseId != motorista.cod);
        appData.motoristas.push(motorista);
        
        await salvarMotoristaFB(motorista);
        
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

    window.handleIntervaloChange = async function(e) {
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
        await salvarPontoFB(key, appData.ponto[key]);
        window.carregarPonto();
    };

    window.adicionarIntervalo = async function(key) {
        if (!appData.ponto[key]) appData.ponto[key] = { intervalos: [{ entrada: '', saida: '' }], tipo: 'interno', pernoite: false };
        if (!appData.ponto[key].intervalos) appData.ponto[key].intervalos = [{ entrada: '', saida: '' }];
        appData.ponto[key].intervalos.push({ entrada: '', saida: '' });
        await salvarPontoFB(key, appData.ponto[key]);
        window.carregarPonto();
    };

    window.removerIntervalo = async function(key, idx) {
        if (appData.ponto[key]?.intervalos?.length > 1) {
            appData.ponto[key].intervalos.splice(idx, 1);
            await salvarPontoFB(key, appData.ponto[key]);
            window.carregarPonto();
        }
    };

    window.updateTipo = async function(key, tipo) {
        if (!appData.ponto[key]) appData.ponto[key] = { intervalos: [], pernoite: false };
        appData.ponto[key].tipo = tipo;
        await salvarPontoFB(key, appData.ponto[key]);
        window.carregarPonto();
    };

    window.togglePernoite = async function(key, checked) {
        if (!appData.ponto[key]) appData.ponto[key] = { intervalos: [], tipo: 'interno' };
        appData.ponto[key].pernoite = checked;
        await salvarPontoFB(key, appData.ponto[key]);
        window.carregarPonto();
    };

    window.toggleFolga = async function(key, cod, mes, ano, dia, isFolga) {
        if (!appData.ponto[key]) appData.ponto[key] = { intervalos: [{ entrada: '', saida: '' }], tipo: 'interno', pernoite: false };
        appData.ponto[key].folga = isFolga;
        await salvarPontoFB(key, appData.ponto[key]);
        window.carregarPonto();
    };

    window.carregarPonto = function() {
        const cod = document.getElementById('pontoMotorista')?.value;
        const mesRef = parseInt(document.getElementById('pontoMes')?.value);
        const anoRef = parseInt(document.getElementById('pontoAno')?.value);
        if (!cod || !mesRef || !anoRef) return;
        
        const motorista = (appData.motoristas || []).find(m => (m.cod == cod) || (m.firebaseId == cod));
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
        const container = document.getElementById('pontoContainer');
        if (container) container.innerHTML = html;

        document.querySelectorAll('.intervalo-entrada, .intervalo-saida').forEach(input => {
            input.removeEventListener('change', window.handleIntervaloChange);
            input.addEventListener('change', window.handleIntervaloChange);
        });

        const totaisEl = document.getElementById('totaisPonto');
        if (totaisEl) {
            totaisEl.innerHTML = `
                <div class="stat-card"><div class="stat-value">${formatHoras(totalPeriodoHT)}</div><div class="stat-label">Total Horas Período</div></div>
                <div class="stat-card success"><div class="stat-value">${formatHoras(totalPeriodoExtras)}</div><div class="stat-label">Total Extras</div></div>
                <div class="stat-card warning"><div class="stat-value">${formatMoney(totalDiariasPeriodo)}</div><div class="stat-label">Total Diárias</div></div>
            `;
        }
    };

    // ============ PAINEL ============
    window.atualizarPainel = function() {
        const mes = parseInt(document.getElementById('painelMes')?.value);
        const ano = parseInt(document.getElementById('painelAno')?.value);
        const cod = document.getElementById('painelMotorista')?.value;
        if (!cod || !mes || !ano) return;
        
        const motorista = (appData.motoristas || []).find(m => (m.cod == cod) || (m.firebaseId == cod));
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
            return (r.codMotorista == cod || r.motorista == motorista.nome) && dataReg >= primeiraData && dataReg <= ultimaData;
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
        document.getElementById('modalKM')?.classList.add('active');
        const kmData = document.getElementById('kmData');
        if (kmData) kmData.value = new Date().toISOString().split('T')[0];
    };

    window.calcularKM = function() {
        const inicial = parseFloat(document.getElementById('kmInicial')?.value) || 0;
        const final = parseFloat(document.getElementById('kmFinal')?.value) || 0;
        const total = final - inicial;
        const totalEl = document.getElementById('kmTotalCalc');
        const valorEl = document.getElementById('kmValorCalc');
        if (totalEl) totalEl.innerText = total > 0 ? total + ' km' : '0 km';
        if (valorEl) valorEl.innerText = formatMoney(total * VALOR_KM);
    };

    window.salvarKM = async function() {
        const cod = document.getElementById('kmMotoristaSelect')?.value;
        const motorista = (appData.motoristas || []).find(m => (m.cod == cod) || (m.firebaseId == cod));
        const inicial = parseFloat(document.getElementById('kmInicial')?.value) || 0;
        const final = parseFloat(document.getElementById('kmFinal')?.value) || 0;
        
        const registro = {
            id: Date.now(),
            data: document.getElementById('kmData')?.value || '',
            codMotorista: cod,
            motorista: motorista?.nome || '',
            veiculo: document.getElementById('kmVeiculo')?.value || '',
            kmInicial: inicial,
            kmFinal: final,
            totalKM: final - inicial,
            destino: document.getElementById('kmDestino')?.value || ''
        };
        
        appData.registrosKM.push(registro);
        await salvarKMFB(registro);
        window.fecharModal('modalKM');
        window.carregarKM();
    };

    window.carregarKM = function() {
        const tbody = document.getElementById('tabelaKM');
        if (!tbody) return;
        const filtro = document.getElementById('kmFiltroMotorista')?.value;
        let registros = appData.registrosKM || [];
        if (filtro && filtro !== 'todos') registros = registros.filter(r => r.codMotorista == filtro || r.motorista == filtro);
        
        tbody.innerHTML = registros.map(r => `
            <tr>
                <td>${r.data}</td><td>${r.motorista}</td><td>${r.veiculo}</td>
                <td>${r.kmInicial}</td><td>${r.kmFinal}</td><td>${r.totalKM} km</td>
                <td>${r.destino || '-'}</td>
                <td><button class="btn btn-danger btn-sm" onclick="window.excluirKM(${r.id})">🗑️</button></td>
            </tr>
        `).join('');
    };

    window.excluirKM = async function(id) {
        if (!confirm('Excluir registro?')) return;
        const reg = appData.registrosKM.find(r => r.id == id);
        appData.registrosKM = appData.registrosKM.filter(r => r.id != id);
        if (reg?.firebaseId) await excluirDoFB('motoristas_km', reg.firebaseId);
        window.carregarKM();
    };

    // ============ PAGAMENTOS ============
    window.abrirModalPagamento = function() {
        document.getElementById('modalPagamento')?.classList.add('active');
        const pagData = document.getElementById('pagData');
        if (pagData) pagData.value = new Date().toISOString().split('T')[0];
    };

    window.calcPagamento = function() {
        const horas = parseFloat(document.getElementById('pagHoras')?.value) || 0;
        const valor = parseFloat(document.getElementById('pagValorHora')?.value) || 0;
        const totalEl = document.getElementById('pagValorTotal');
        if (totalEl) totalEl.innerText = formatMoney(horas * valor);
    };

    window.salvarPagamento = async function() {
        const cod = document.getElementById('pagMotorista')?.value;
        const motorista = (appData.motoristas || []).find(m => (m.cod == cod) || (m.firebaseId == cod));
        const horas = parseFloat(document.getElementById('pagHoras')?.value) || 0;
        const valorHora = parseFloat(document.getElementById('pagValorHora')?.value) || 0;
        
        const pagamento = {
            id: Date.now(),
            data: document.getElementById('pagData')?.value || '',
            codMotorista: cod,
            motorista: motorista?.nome || '',
            horas: horas,
            valorHora: valorHora,
            valorTotal: horas * valorHora
        };
        
        appData.pagamentos.push(pagamento);
        await salvarPagamentoFB(pagamento);
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

    window.excluirPagamento = async function(id) {
        if (!confirm('Excluir pagamento?')) return;
        const pag = appData.pagamentos.find(p => p.id == id);
        appData.pagamentos = appData.pagamentos.filter(p => p.id != id);
        if (pag?.firebaseId) await excluirDoFB('motoristas_pagamentos', pag.firebaseId);
        window.carregarPagamentos();
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
    async function init() {
        showLoading();
        
        const db = getDB();
        if (!db) {
            console.error('❌ Firebase não disponível');
            hideLoading();
            return;
        }
        
        const statusEl = document.getElementById('firebaseStatus');
        if (statusEl) {
            statusEl.innerHTML = '<span class="dot"></span> Firebase Online';
        }
        
        await carregarDados();
        
        carregarSelectsMotoristas();
        carregarTabelaMotoristas();

        const hoje = new Date();
        const painelMes = document.getElementById('painelMes');
        const pontoMes = document.getElementById('pontoMes');
        const kmFiltroMes = document.getElementById('kmFiltroMes');
        const painelAno = document.getElementById('painelAno');
        const pontoAno = document.getElementById('pontoAno');
        const kmFiltroAno = document.getElementById('kmFiltroAno');
        
        if (painelMes) painelMes.value = hoje.getMonth() + 1;
        if (pontoMes) pontoMes.value = hoje.getMonth() + 1;
        if (kmFiltroMes) kmFiltroMes.value = hoje.getMonth() + 1;
        if (painelAno) painelAno.value = hoje.getFullYear();
        if (pontoAno) pontoAno.value = hoje.getFullYear();
        if (kmFiltroAno) kmFiltroAno.value = hoje.getFullYear();

        window.atualizarPainel();
        window.carregarPonto();
        window.carregarBancoHoras();
        window.carregarKM();
        window.carregarPagamentos();

        document.getElementById('pagHoras')?.addEventListener('input', window.calcPagamento);
        document.getElementById('pagValorHora')?.addEventListener('input', window.calcPagamento);
        document.getElementById('kmInicial')?.addEventListener('input', window.calcularKM);
        document.getElementById('kmFinal')?.addEventListener('input', window.calcularKM);

        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('tab-' + tab.dataset.tab)?.classList.add('active');
            });
        });

        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal-overlay')) {
                e.target.classList.remove('active');
            }
        });

        hideLoading();
        console.log('✅ Sistema de Motoristas inicializado');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
