// ==========================================================================
// MOTORISTAS.JS - Controle de Motoristas (Versão 100% Firebase)
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

    // ============ COLEÇÕES DO FIRESTORE ============
    function getColecoes() {
        const db = getDB();
        if (!db) return null;
        return {
            motoristas: db.collection('motoristas'),
            ponto: db.collection('motoristas_ponto'),
            pagamentos: db.collection('motoristas_pagamentos'),
            registrosKM: db.collection('motoristas_km')
        };
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

    // ============ CARREGAR/SALVAR DADOS (APENAS FIREBASE) ============
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
                appData.motoristas.push({ id: doc.id, firebaseId: doc.id, ...doc.data() });
            });

            // Carregar ponto
            const snapPonto = await db.collection('motoristas_ponto').get();
            appData.ponto = {};
            snapPonto.forEach(doc => {
                appData.ponto[doc.id] = doc.data().dados || doc.data();
            });

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

    async function salvarMotoristaNoFirebase(motorista) {
        const db = getDB();
        if (!db) return false;
        
        try {
            const docId = String(motorista.cod);
            const { cod, ...dados } = motorista;
            await db.collection('motoristas').doc(docId).set({
                ...dados,
                cod: cod,
                ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return true;
        } catch (error) {
            console.error('❌ Erro ao salvar motorista:', error);
            return false;
        }
    }

    async function salvarPontoNoFirebase(key, dados) {
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

    async function salvarPagamentoNoFirebase(pagamento) {
        const db = getDB();
        if (!db) return false;
        
        try {
            const { id, ...dados } = pagamento;
            await db.collection('motoristas_pagamentos').doc(String(id)).set({
                ...dados,
                dataRegistro: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('❌ Erro ao salvar pagamento:', error);
            return false;
        }
    }

    async function salvarKMNoFirebase(registro) {
        const db = getDB();
        if (!db) return false;
        
        try {
            const { id, ...dados } = registro;
            await db.collection('motoristas_km').doc(String(id)).set({
                ...dados,
                dataRegistro: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('❌ Erro ao salvar KM:', error);
            return false;
        }
    }

    async function excluirDoFirebase(colecao, docId) {
        const db = getDB();
        if (!db) return false;
        
        try {
            await db.collection(colecao).doc(String(docId)).delete();
            console.log(`✅ Excluído de ${colecao}: ${docId}`);
            return true;
        } catch (error) {
            console.error(`❌ Erro ao excluir de ${colecao}:`, error);
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

    window.excluirMotorista = async function(cod) {
        if (!confirm('Excluir motorista?')) return;
        
        appData.motoristas = appData.motoristas.filter(m => m.cod !== cod);
        await excluirDoFirebase('motoristas', String(cod));
        
        carregarSelectsMotoristas();
        carregarTabelaMotoristas();
        window.atualizarPainel();
    };

    window.salvarMotorista = async function() {
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
        
        // ✅ Salvar no Firebase
        await salvarMotoristaNoFirebase(motorista);
        
        window.fecharModal('modalMotorista');
        carregarSelectsMotoristas();
        carregarTabelaMotoristas();
        window.atualizarPainel();
    };

    // ============ PONTO ============
    // (Manter funções: renderizarIntervalos, handleIntervaloChange, adicionarIntervalo, 
    //  removerIntervalo, updateTipo, togglePernoite, toggleFolga - IGUAIS)

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
        
        // ✅ Salvar no Firebase
        await salvarPontoNoFirebase(key, appData.ponto[key]);
        window.carregarPonto();
    };

    // (Outras funções de ponto seguem o mesmo padrão - trocar salvarDados() por salvarPontoNoFirebase())

    // ============ KM ============
    window.salvarKM = async function() {
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
        
        // ✅ Salvar no Firebase
        await salvarKMNoFirebase(registro);
        
        window.fecharModal('modalKM');
        window.carregarKM();
    };

    window.excluirKM = async function(id) {
        if (!confirm('Excluir registro?')) return;
        
        appData.registrosKM = appData.registrosKM.filter(r => r.id !== id);
        await excluirDoFirebase('motoristas_km', String(id));
        
        window.carregarKM();
    };

    // ============ PAGAMENTOS ============
    window.salvarPagamento = async function() {
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
        
        // ✅ Salvar no Firebase
        await salvarPagamentoNoFirebase(pagamento);
        
        window.fecharModal('modalPagamento');
        window.carregarPagamentos();
    };

    window.excluirPagamento = async function(id) {
        if (!confirm('Excluir pagamento?')) return;
        
        appData.pagamentos = appData.pagamentos.filter(p => p.id !== id);
        await excluirDoFirebase('motoristas_pagamentos', String(id));
        
        window.carregarPagamentos();
    };

    // ============ INICIALIZAÇÃO ============
    async function init() {
        showLoading();
        
        const db = getDB();
        if (!db) {
            console.error('❌ Firebase não disponível');
            hideLoading();
            alert('Sistema requer Firebase. Verifique sua conexão.');
            return;
        }
        
        // Status Firebase
        const statusEl = document.getElementById('firebaseStatus');
        if (statusEl) {
            statusEl.innerHTML = '<span class="dot"></span> Firebase Online';
            statusEl.classList.add('online');
        }
        
        // ✅ Carregar dados do Firebase
        await carregarDados();
        
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

        // Fechar modais
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal-overlay')) {
                e.target.classList.remove('active');
            }
        });

        hideLoading();
        console.log('✅ Sistema de Motoristas inicializado (100% Firebase)');
    }

    // Iniciar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
