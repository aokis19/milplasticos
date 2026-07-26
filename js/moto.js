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
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.add('active');
    }

    function hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.remove('active');
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
                if (saida > entrada) {
                    total += (saida - entrada);
                } else if (saida < entrada) {
                    total += (24 - entrada) + saida;
                }
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
                    if (saidaHoras >= 13 || (saidaHoras < 5 && saidaHoras >= 0)) {
                        valorAlmoco = VALOR_ALMOCO;
                    }
                    if (saidaHoras >= 19.5 || (saidaHoras < 5 && saidaHoras >= 0)) {
                        valorJanta = VALOR_JANTA;
                    }
                }
            }
        }

        if (pernoite) {
            valorCafe = VALOR_CAFE;
        }

        return { 
            almoco: valorAlmoco, 
            janta: valorJanta, 
            cafe: valorCafe, 
            total: valorAlmoco + valorJanta + valorCafe 
        };
    }

    // ============ CARREGAR DADOS (APENAS FIREBASE) ============
    async function carregarDados() {
        const db = getDB();
        if (!db) {
            console.error('❌ Firebase não disponível');
            return;
        }

        try {
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
                    ativo: data.ativo !== false,
                    horarioEntrada: data.horarioEntrada || '08:00',
                    horarioSaida: data.horarioSaida || '17:00'
                });
            });

            const snapPonto = await db.collection('motoristas_ponto').get();
            appData.ponto = {};
            if (!snapPonto.empty) {
                snapPonto.forEach(doc => {
                    appData.ponto[doc.id] = doc.data().dados || doc.data();
                });
            }

            const snapPagamentos = await db.collection('motoristas_pagamentos')
                .orderBy('data', 'desc')
                .get();
            appData.pagamentos = [];
            snapPagamentos.forEach(doc => {
                appData.pagamentos.push({ id: doc.id, firebaseId: doc.id, ...doc.data() });
            });

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
            console.log('✅ Motorista salvo:', docId);
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
            console.log('✅ Ponto salvo:', key);
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
            const docData = { ...pagamento };
            delete docData.id;
            delete docData.firebaseId;
            
            if (pagamento.firebaseId) {
                // Atualizar existente
                await db.collection('motoristas_pagamentos').doc(pagamento.firebaseId).set({
                    ...docData,
                    dataAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                console.log('✅ Pagamento atualizado:', pagamento.firebaseId);
                return pagamento.firebaseId;
            } else {
                // Criar novo
                const docRef = await db.collection('motoristas_pagamentos').add({
                    ...docData,
                    dataRegistro: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('✅ Pagamento criado:', docRef.id);
                return docRef.id;
            }
        } catch (error) {
            console.error('❌ Erro ao salvar pagamento:', error);
            return false;
        }
    }

    async function salvarKMFB(registro) {
        const db = getDB();
        if (!db) return false;
        try {
            const docData = { ...registro };
            delete docData.id;
            delete docData.firebaseId;
            
            if (registro.firebaseId) {
                // Atualizar existente
                await db.collection('motoristas_km').doc(registro.firebaseId).set({
                    ...docData,
                    dataAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                console.log('✅ KM atualizado:', registro.firebaseId);
                return registro.firebaseId;
            } else {
                // Criar novo
                const docRef = await db.collection('motoristas_km').add({
                    ...docData,
                    dataRegistro: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('✅ KM criado:', docRef.id);
                return docRef.id;
            }
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
            console.error(`❌ Erro ao excluir de ${colecao}:`, error);
            return false;
        }
    }

    // ============ UPLOAD DE PDF ============
    async function uploadPDF(file, colecao, docId) {
        const db = getDB();
        if (!db || !file) return null;
        
        try {
            // Converte o arquivo para base64
            const base64 = await fileToBase64(file);
            
            // Salva a referência do PDF no documento
            await db.collection(colecao).doc(docId).update({
                pdfRecibo: base64,
                pdfNome: file.name,
                pdfTamanho: file.size,
                pdfDataUpload: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('✅ PDF salvo com sucesso');
            return base64;
        } catch (error) {
            console.error('❌ Erro ao fazer upload do PDF:', error);
            return null;
        }
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    // ============ MOTORISTAS ============
    function carregarSelectsMotoristas() {
        const selects = ['painelMotorista', 'pontoMotorista', 'pagMotorista', 'kmMotoristaSelect', 'kmFiltroMotorista', 'bancoMotorista'];
        const motoristasAtivos = (appData.motoristas || []).filter(m => m.ativo !== false);

        selects.forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;
            const valorAtual = select.value;
            let options = '';
            if (id === 'kmFiltroMotorista' || id === 'bancoMotorista') {
                options = '<option value="todos">Todos</option>';
            }
            options += motoristasAtivos.map(m => 
                `<option value="${m.cod || m.firebaseId}">${m.nome}</option>`
            ).join('');
            select.innerHTML = options;
            if (valorAtual) select.value = valorAtual;
        });
    }

    function carregarTabelaMotoristas() {
        const tbody = document.getElementById('tabelaMotoristas');
        if (!tbody) return;
        
        const motoristas = (appData.motoristas || []).filter(m => m.ativo !== false);
        
        tbody.innerHTML = motoristas.map(m => `
            <tr>
                <td>${m.cod || m.firebaseId}</td>
                <td><strong>${m.nome}</strong></td>
                <td>${m.funcao || '-'}</td>
                <td>${m.horarioEntrada || '08:00'} - ${m.horarioSaida || '17:00'}</td>
                <td>${formatHoras(m.jornadaBase || 8)}</td>
                <td>${m.tolerancia || 10}min</td>
                <td>${m.adNoturno ? '✅' : '❌'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="window.editarMotorista('${m.cod || m.firebaseId}')" title="Editar">✏️</button>
                    <button class="btn btn-sm btn-info" onclick="window.configurarHorarioMotorista('${m.cod || m.firebaseId}')" title="Configurar Horário">🕐</button>
                    <button class="btn btn-sm btn-danger" onclick="window.excluirMotorista('${m.cod || m.firebaseId}')" title="Excluir">🗑️</button>
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
                
                const horarioEntradaEl = document.getElementById('horarioEntrada');
                const horarioSaidaEl = document.getElementById('horarioSaida');
                if (horarioEntradaEl) horarioEntradaEl.value = m.horarioEntrada || '08:00';
                if (horarioSaidaEl) horarioSaidaEl.value = m.horarioSaida || '17:00';
            }
        } else {
            document.getElementById('modalMotoristaTitulo').innerText = 'Novo Motorista';
            ['motoristaCod', 'motoristaNome', 'motoristaFuncao'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            document.getElementById('jornadaBase').value = 8;
            document.getElementById('motoristaTolerancia').value = 10;
            document.getElementById('motoristaAdNoturno').checked = false;
            
            const horarioEntradaEl = document.getElementById('horarioEntrada');
            const horarioSaidaEl = document.getElementById('horarioSaida');
            if (horarioEntradaEl) horarioEntradaEl.value = '08:00';
            if (horarioSaidaEl) horarioSaidaEl.value = '17:00';
        }
    };

    window.editarMotorista = function(cod) {
        window.abrirModalMotorista(cod);
    };

    window.configurarHorarioMotorista = async function(cod) {
        const motorista = appData.motoristas.find(m => (m.cod == cod) || (m.firebaseId == cod));
        if (!motorista) {
            alert('Motorista não encontrado!');
            return;
        }
        
        const horarioEntrada = prompt('Horário padrão de entrada (HH:MM):', motorista.horarioEntrada || '08:00');
        if (horarioEntrada === null) return;
        
        const horarioSaida = prompt('Horário padrão de saída (HH:MM):', motorista.horarioSaida || '17:00');
        if (horarioSaida === null) return;
        
        if (horarioEntrada && horarioSaida) {
            motorista.horarioEntrada = horarioEntrada;
            motorista.horarioSaida = horarioSaida;
            motorista.jornadaBase = timeToHours(horarioSaida) - timeToHours(horarioEntrada);
            
            if (motorista.jornadaBase <= 0) {
                alert('Horário inválido! A saída deve ser depois da entrada.');
                return;
            }
            
            await salvarMotoristaFB(motorista);
            alert(`Horário configurado com sucesso!\nEntrada: ${horarioEntrada}\nSaída: ${horarioSaida}\nJornada: ${formatHoras(motorista.jornadaBase)}`);
            carregarTabelaMotoristas();
            window.atualizarPainel();
        }
    };

    window.excluirMotorista = async function(cod) {
        if (!confirm('Tem certeza que deseja excluir este motorista?')) return;
        
        const m = appData.motoristas.find(m => (m.cod == cod) || (m.firebaseId == cod));
        if (!m) return;
        
        appData.motoristas = appData.motoristas.filter(m => (m.cod != cod) && (m.firebaseId != cod));
        
        if (m?.firebaseId) {
            await excluirDoFB('motoristas', m.firebaseId);
        }
        
        carregarSelectsMotoristas();
        carregarTabelaMotoristas();
        window.atualizarPainel();
        alert('Motorista excluído com sucesso!');
    };

    window.salvarMotorista = async function() {
        const cod = document.getElementById('motoristaCod').value.trim();
        const nome = document.getElementById('motoristaNome').value.trim();
        
        if (!cod || !nome) {
            alert('Preencha código e nome do motorista!');
            return;
        }
        
        const horarioEntrada = document.getElementById('horarioEntrada')?.value || '08:00';
        const horarioSaida = document.getElementById('horarioSaida')?.value || '17:00';
        const jornadaBase = timeToHours(horarioSaida) - timeToHours(horarioEntrada);
        
        const motorista = {
            cod: cod,
            nome: nome.toUpperCase(),
            funcao: (document.getElementById('motoristaFuncao')?.value || '').toUpperCase(),
            jornadaBase: jornadaBase > 0 ? jornadaBase : parseFloat(document.getElementById('jornadaBase')?.value || 8),
            tolerancia: parseInt(document.getElementById('motoristaTolerancia')?.value || 10),
            adNoturno: document.getElementById('motoristaAdNoturno')?.checked || false,
            ativo: true,
            horarioEntrada: horarioEntrada,
            horarioSaida: horarioSaida
        };
        
        appData.motoristas = appData.motoristas.filter(m => 
            m.cod != motorista.cod && m.firebaseId != motorista.cod
        );
        appData.motoristas.push(motorista);
        
        const salvou = await salvarMotoristaFB(motorista);
        
        if (salvou) {
            window.fecharModal('modalMotorista');
            carregarSelectsMotoristas();
            carregarTabelaMotoristas();
            window.atualizarPainel();
            alert('Motorista salvo com sucesso!');
        } else {
            alert('Erro ao salvar motorista. Verifique o console.');
        }
    };

    // ============ PONTO ============
    window.updateTipo = async function(key, tipo) {
        console.log(`Alterando tipo para ${tipo} na key ${key}`);
        
        if (!appData.ponto[key]) {
            appData.ponto[key] = { 
                intervalos: [{ entrada: '', saida: '' }], 
                pernoite: false 
            };
        }
        appData.ponto[key].tipo = tipo;
        
        try {
            await salvarPontoFB(key, appData.ponto[key]);
            console.log('✅ Tipo atualizado com sucesso');
            window.carregarPonto();
        } catch (error) {
            console.error('❌ Erro ao atualizar tipo:', error);
            alert('Erro ao salvar alteração. Tente novamente.');
        }
    };

    window.togglePernoite = async function(key, checked) {
        console.log(`Alterando pernoite para ${checked} na key ${key}`);
        
        if (!appData.ponto[key]) {
            appData.ponto[key] = { 
                intervalos: [{ entrada: '', saida: '' }], 
                tipo: 'interno' 
            };
        }
        appData.ponto[key].pernoite = checked;
        
        try {
            await salvarPontoFB(key, appData.ponto[key]);
            console.log('✅ Pernoite atualizado com sucesso');
            window.carregarPonto();
        } catch (error) {
            console.error('❌ Erro ao atualizar pernoite:', error);
            alert('Erro ao salvar alteração. Tente novamente.');
        }
    };

    window.toggleFolga = async function(key, cod, mes, ano, dia, isFolga) {
        console.log(`Alterando folga para ${isFolga} na key ${key}`);
        
        if (!appData.ponto[key]) {
            appData.ponto[key] = { 
                intervalos: [{ entrada: '', saida: '' }], 
                tipo: 'interno', 
                pernoite: false 
            };
        }
        
        appData.ponto[key].folga = isFolga;
        
        try {
            await salvarPontoFB(key, appData.ponto[key]);
            console.log('✅ Folga salva com sucesso');
            window.carregarPonto();
        } catch (error) {
            console.error('❌ Erro ao salvar folga:', error);
            alert('Erro ao salvar folga. Tente novamente.');
        }
    };

    window.updateIntervaloTime = async function(inputElement) {
        const key = inputElement.dataset.key;
        const field = inputElement.dataset.field;
        const value = inputElement.value;
        
        console.log(`Atualizando ${field} para ${value} na key ${key}`);
        
        if (!appData.ponto[key]) {
            appData.ponto[key] = { 
                intervalos: [{ entrada: '', saida: '' }], 
                tipo: 'interno', 
                pernoite: false 
            };
        }
        
        if (!appData.ponto[key].intervalos || appData.ponto[key].intervalos.length === 0) {
            appData.ponto[key].intervalos = [{ entrada: '', saida: '' }];
        }
        
        if (field === 'entrada') {
            appData.ponto[key].intervalos[0].entrada = value;
        } else {
            appData.ponto[key].intervalos[0].saida = value;
        }
        
        try {
            await salvarPontoFB(key, appData.ponto[key]);
            console.log('✅ Ponto salvo com sucesso');
            window.carregarPonto();
        } catch (error) {
            console.error('❌ Erro ao salvar ponto:', error);
            alert('Erro ao salvar horário. Tente novamente.');
        }
    };

    window.salvarPontoAtual = async function() {
        try {
            // Este botão força o recarregamento e salvamento de todos os pontos visíveis
            const container = document.getElementById('pontoContainer');
            if (!container) return;
            
            const inputs = container.querySelectorAll('input[type="time"], input[type="checkbox"], select');
            for (const input of inputs) {
                const event = new Event('change', { bubbles: true });
                input.dispatchEvent(event);
            }
            
            alert('✅ Todos os registros de ponto foram salvos com sucesso!');
        } catch (error) {
            console.error('❌ Erro ao salvar ponto:', error);
            alert('Erro ao salvar registros. Tente novamente.');
        }
    };

    window.carregarPonto = function() {
        const cod = document.getElementById('pontoMotorista')?.value;
        const mesRef = parseInt(document.getElementById('pontoMes')?.value);
        const anoRef = parseInt(document.getElementById('pontoAno')?.value);
        
        if (!cod || !mesRef || !anoRef) {
            console.log('❌ Dados incompletos para carregar ponto');
            return;
        }
        
        const motorista = (appData.motoristas || []).find(m => (m.cod == cod) || (m.firebaseId == cod));
        if (!motorista) {
            console.log('❌ Motorista não encontrado:', cod);
            return;
        }

        const { diaInicio, diaFim } = getPeriodoConfig();
        const datasPeriodo = getDatasPeriodo(mesRef, anoRef, diaInicio, diaFim);

        let html = `
        <div style="margin-bottom: 15px;">
            <button class="btn btn-success" onclick="window.salvarPontoAtual()" style="margin-right: 10px;">
                💾 SALVAR TODOS OS REGISTROS DE PONTO
            </button>
            <small style="color: #666;">Clique para salvar todas as alterações do período</small>
        </div>
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead>
                    <tr>
                        <th>Dia</th>
                        <th>Data</th>
                        <th>Sem.</th>
                        <th>Folga</th>
                        <th>Tipo</th>
                        <th>Entrada</th>
                        <th>Saída</th>
                        <th>Total Horas</th>
                        <th>Saldo</th>
                        <th>Diárias</th>
                        <th>Pernoite</th>
                    </tr>
                </thead>
                <tbody>`;

        let totalPeriodoHT = 0, totalPeriodoExtras = 0, totalDiariasPeriodo = 0;

        for (const data of datasPeriodo) {
            const { dia, mes, ano } = data;
            const key = `${cod}_${ano}_${mes}_${dia}`;
            const reg = appData.ponto[key] || { 
                intervalos: [{ entrada: '', saida: '' }], 
                folga: false, 
                tipo: 'interno', 
                pernoite: false 
            };
            
            if (!reg.intervalos || reg.intervalos.length === 0) {
                reg.intervalos = [{ entrada: '', saida: '' }];
            }
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

            const entradaVal = reg.intervalos[0]?.entrada || '';
            const saidaVal = reg.intervalos[0]?.saida || '';
            
            const dataStr = `${String(dia).padStart(2,'0')}/${String(mes).padStart(2,'0')}/${ano}`;

            html += `<tr style="${isFolga ? 'background:#fff3e0' : ''}">
                <td><strong>${dia}</strong></td>
                <td>${dataStr}</td>
                <td>${getSemana(dia, mes, ano)}</td>
                <td>
                    <input type="checkbox" ${isFolga ? 'checked' : ''} 
                        onchange="window.toggleFolga('${key}','${cod}',${mes},${ano},${dia},this.checked)">
                </td>
                <td>
                    <select onchange="window.updateTipo('${key}', this.value)" class="form-control-sm">
                        <option value="interno" ${reg.tipo === 'interno' ? 'selected' : ''}>Interno</option>
                        <option value="externo" ${reg.tipo === 'externo' ? 'selected' : ''}>Externo</option>
                    </select>
                </td>
                <td>
                    <input type="time" class="form-control form-control-sm" 
                        value="${entradaVal}" 
                        data-key="${key}" 
                        data-field="entrada"
                        onchange="window.updateIntervaloTime(this)"
                        ${isFolga ? 'disabled' : ''}>
                </td>
                <td>
                    <input type="time" class="form-control form-control-sm" 
                        value="${saidaVal}" 
                        data-key="${key}" 
                        data-field="saida"
                        onchange="window.updateIntervaloTime(this)"
                        ${isFolga ? 'disabled' : ''}>
                </td>
                <td class="${totalHoras > 0 ? 'fw-bold' : ''}">
                    ${totalHoras > 0 ? formatHoras(totalHoras) : '-'}
                </td>
                <td class="${saldo > 0.05 ? 'text-success fw-bold' : (saldo < -0.05 ? 'text-danger fw-bold' : '')}">
                    ${Math.abs(saldo) > 0.05 ? formatHoras(saldo) : '-'}
                </td>
                <td>
                    ${diarias.total > 0 ? `<span class="badge bg-warning text-dark">${formatMoney(diarias.total)}</span>` : '-'}
                </td>
                <td>
                    <input type="checkbox" ${reg.pernoite ? 'checked' : ''} 
                        onchange="window.togglePernoite('${key}', this.checked)"
                        ${isFolga ? 'disabled' : ''}>
                </td>
            </tr>`;
        }

        html += `</tbody></table></div>`;
        
        const container = document.getElementById('pontoContainer');
        if (container) container.innerHTML = html;

        const totaisEl = document.getElementById('totaisPonto');
        if (totaisEl) {
            totaisEl.innerHTML = `
                <div class="alert alert-info">
                    <h5>📊 Resumo do Período</h5>
                    <div class="row">
                        <div class="col-md-4">
                            <strong>Total Horas Trabalhadas:</strong><br>
                            <span class="fs-5">${formatHoras(totalPeriodoHT)}</span>
                        </div>
                        <div class="col-md-4">
                            <strong>Total Horas Extras:</strong><br>
                            <span class="fs-5 text-success">${formatHoras(totalPeriodoExtras)}</span>
                        </div>
                        <div class="col-md-4">
                            <strong>Total Diárias:</strong><br>
                            <span class="fs-5 text-warning">${formatMoney(totalDiariasPeriodo)}</span>
                        </div>
                    </div>
                    <hr>
                    <small>🕐 Horário Padrão: ${motorista.horarioEntrada || '08:00'} - ${motorista.horarioSaida || '17:00'} (${formatHoras(motorista.jornadaBase || 8)})</small><br>
                    <small>⏱️ Tolerância: ${motorista.tolerancia || 10} minutos</small>
                </div>
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
            
            if (saldo > 0) {
                totalExtras += saldo;
            } else if (saldo < 0) {
                totalFaltas += Math.abs(saldo);
            }
            
            totalDiarias += diarias.total;
        }

        document.getElementById('statsContainer').innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${diasTrab}</div>
                <div class="stat-label">Dias Trabalhados</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${formatHoras(totalHT)}</div>
                <div class="stat-label">Horas Trabalhadas</div>
            </div>
            <div class="stat-card success">
                <div class="stat-value">${formatHoras(totalExtras)}</div>
                <div class="stat-label">Horas Extras</div>
            </div>
            <div class="stat-card danger">
                <div class="stat-value">${formatHoras(totalFaltas)}</div>
                <div class="stat-label">Faltas/Atrasos</div>
            </div>
        `;

        let totalKM = 0, valorKMTotal = 0;
        const registrosKM = (appData.registrosKM || []).filter(r => {
            const dataReg = new Date(r.data + 'T00:00:00');
            const primeiraData = new Date(datasPeriodo[0].ano, datasPeriodo[0].mes - 1, datasPeriodo[0].dia);
            const ultimaData = new Date(datasPeriodo[datasPeriodo.length - 1].ano, datasPeriodo[datasPeriodo.length - 1].mes - 1, datasPeriodo[datasPeriodo.length - 1].dia);
            ultimaData.setHours(23, 59, 59);
            return (r.codMotorista == cod || r.motorista == motorista.nome) && dataReg >= primeiraData && dataReg <= ultimaData;
        });
        
        registrosKM.forEach(r => { 
            totalKM += r.totalKM || 0; 
            valorKMTotal += (r.totalKM || 0) * VALOR_KM; 
        });

        document.getElementById('resumoFinanceiro').innerHTML = `
            <div class="stat-card warning">
                <div class="stat-value">${formatMoney(totalDiarias)}</div>
                <div class="stat-label">Total Diárias</div>
            </div>
            <div class="stat-card info">
                <div class="stat-value">${totalKM} km</div>
                <div class="stat-label">Total KM</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${formatMoney(valorKMTotal)}</div>
                <div class="stat-label">Valor KM</div>
            </div>
            <div class="stat-card success">
                <div class="stat-value">${formatMoney(totalDiarias + valorKMTotal)}</div>
                <div class="stat-label">💰 Total Geral</div>
            </div>
        `;
    };

    // ============ BANCO DE HORAS ============
    window.carregarBancoHoras = function() {
        const tbody = document.getElementById('tabelaBancoHoras');
        if (!tbody) return;
        
        const filtro = document.getElementById('bancoMotorista')?.value;
        let motoristas = appData.motoristas || [];
        
        if (filtro && filtro !== 'todos') {
            motoristas = motoristas.filter(m => (m.cod == filtro) || (m.firebaseId == filtro));
        }
        
        let html = '';
        
        motoristas.forEach(motorista => {
            const mes = new Date().getMonth() + 1;
            const ano = new Date().getFullYear();
            const { diaInicio, diaFim } = getPeriodoConfig();
            const datasPeriodo = getDatasPeriodo(mes, ano, diaInicio, diaFim);
            
            let totalExtras = 0, totalFaltas = 0;
            
            for (const data of datasPeriodo) {
                const { dia, mes: m, ano: a } = data;
                const key = `${motorista.cod || motorista.firebaseId}_${a}_${m}_${dia}`;
                const reg = appData.ponto[key];
                
                if (!reg || reg.folga) continue;
                
                const totalHoras = calcularTotalHoras(reg.intervalos);
                if (totalHoras <= 0) continue;
                
                const jornadaBase = motorista.jornadaBase || 8;
                const tolerancia = (motorista.tolerancia || 10) / 60;
                const saldo = totalHoras - jornadaBase - tolerancia;
                
                if (saldo > 0) totalExtras += saldo;
                else if (saldo < 0) totalFaltas += Math.abs(saldo);
            }
            
            const saldoFinal = totalExtras - totalFaltas;
            
            html += `
                <tr>
                    <td><strong>${motorista.nome}</strong></td>
                    <td class="text-success">${formatHoras(totalExtras)}</td>
                    <td class="text-danger">${formatHoras(totalFaltas)}</td>
                    <td class="${saldoFinal >= 0 ? 'text-success' : 'text-danger'} fw-bold">
                        ${formatHoras(saldoFinal)}
                    </td>
                    <td>${motorista.horarioEntrada || '08:00'} - ${motorista.horarioSaida || '17:00'}</td>
                    <td>${formatHoras(motorista.jornadaBase || 8)}</td>
                </tr>
            `;
        });
        
        if (!html) {
            html = '<tr><td colspan="6" class="text-center">Nenhum dado disponível</td></tr>';
        }
        
        tbody.innerHTML = html;
    };

    // ============ KM ============
    window.abrirModalKM = function(registro = null) {
        const modal = document.getElementById('modalKM');
        if (!modal) return;
        
        modal.classList.add('active');
        
        if (registro) {
            document.getElementById('modalKMTitulo').innerText = 'Editar Registro de KM';
            document.getElementById('kmData').value = registro.data || '';
            document.getElementById('kmMotoristaSelect').value = registro.codMotorista || '';
            document.getElementById('kmVeiculo').value = registro.veiculo || '';
            document.getElementById('kmInicial').value = registro.kmInicial || '';
            document.getElementById('kmFinal').value = registro.kmFinal || '';
            document.getElementById('kmDestino').value = registro.destino || '';
            document.getElementById('kmId').value = registro.id || '';
            document.getElementById('kmFirebaseId').value = registro.firebaseId || '';
        } else {
            document.getElementById('modalKMTitulo').innerText = 'Novo Registro de KM';
            document.getElementById('kmData').value = new Date().toISOString().split('T')[0];
            document.getElementById('kmVeiculo').value = '';
            document.getElementById('kmInicial').value = '';
            document.getElementById('kmFinal').value = '';
            document.getElementById('kmDestino').value = '';
            document.getElementById('kmId').value = '';
            document.getElementById('kmFirebaseId').value = '';
        }
        
        window.calcularKM();
    };

    window.editarKM = function(id) {
        const registro = (appData.registrosKM || []).find(r => r.id == id || r.firebaseId == id);
        if (registro) {
            window.abrirModalKM(registro);
        } else {
            alert('Registro não encontrado!');
        }
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
        
        if (!cod || !motorista) {
            alert('Selecione um motorista!');
            return;
        }
        
        const inicial = parseFloat(document.getElementById('kmInicial')?.value) || 0;
        const final = parseFloat(document.getElementById('kmFinal')?.value) || 0;
        
        if (final <= inicial) {
            alert('KM Final deve ser maior que KM Inicial!');
            return;
        }
        
        const id = document.getElementById('kmId')?.value;
        const firebaseId = document.getElementById('kmFirebaseId')?.value;
        
        const registro = {
            id: id ? parseInt(id) : Date.now(),
            firebaseId: firebaseId || null,
            data: document.getElementById('kmData')?.value || '',
            codMotorista: cod,
            motorista: motorista?.nome || '',
            veiculo: document.getElementById('kmVeiculo')?.value || '',
            kmInicial: inicial,
            kmFinal: final,
            totalKM: final - inicial,
            destino: document.getElementById('kmDestino')?.value || ''
        };
        
        // Se for edição, remove o registro antigo
        if (id) {
            appData.registrosKM = appData.registrosKM.filter(r => r.id != id && r.firebaseId != firebaseId);
        }
        
        appData.registrosKM.push(registro);
        const novoFirebaseId = await salvarKMFB(registro);
        
        if (novoFirebaseId) {
            registro.firebaseId = novoFirebaseId;
            window.fecharModal('modalKM');
            window.carregarKM();
            alert('Registro de KM salvo com sucesso!');
        } else {
            alert('Erro ao salvar registro de KM.');
        }
    };

    window.carregarKM = function() {
        const tbody = document.getElementById('tabelaKM');
        if (!tbody) return;
        
        const filtro = document.getElementById('kmFiltroMotorista')?.value;
        let registros = appData.registrosKM || [];
        
        if (filtro && filtro !== 'todos') {
            registros = registros.filter(r => r.codMotorista == filtro || r.motorista == filtro);
        }
        
        registros.sort((a, b) => new Date(b.data) - new Date(a.data));
        
        tbody.innerHTML = registros.map(r => `
            <tr>
                <td>${r.data}</td>
                <td>${r.motorista}</td>
                <td>${r.veiculo}</td>
                <td>${r.kmInicial}</td>
                <td>${r.kmFinal}</td>
                <td><strong>${r.totalKM} km</strong></td>
                <td>${formatMoney(r.totalKM * VALOR_KM)}</td>
                <td>${r.destino || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="window.editarKM('${r.id || r.firebaseId}')" title="Editar">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="window.excluirKM('${r.id || r.firebaseId}')" title="Excluir">🗑️</button>
                </td>
            </tr>
        `).join('');
    };

    window.excluirKM = async function(id) {
        if (!confirm('Tem certeza que deseja excluir este registro de KM?')) return;
        
        const reg = appData.registrosKM.find(r => r.id == id || r.firebaseId == id);
        if (!reg) {
            alert('Registro não encontrado!');
            return;
        }
        
        try {
            appData.registrosKM = appData.registrosKM.filter(r => r.id != id && r.firebaseId != id);
            
            if (reg?.firebaseId) {
                await excluirDoFB('motoristas_km', reg.firebaseId);
            }
            
            window.carregarKM();
            alert('Registro excluído com sucesso!');
        } catch (error) {
            console.error('Erro ao excluir:', error);
            alert('Erro ao excluir registro. Tente novamente.');
        }
    };

    // ============ PAGAMENTOS ============
    window.abrirModalPagamento = function(pagamento = null) {
        const modal = document.getElementById('modalPagamento');
        if (!modal) return;
        
        modal.classList.add('active');
        
        if (pagamento) {
            document.getElementById('modalPagamentoTitulo').innerText = 'Editar Pagamento';
            document.getElementById('pagData').value = pagamento.data || '';
            document.getElementById('pagMotorista').value = pagamento.codMotorista || '';
            document.getElementById('pagHoras').value = pagamento.horas || '';
            document.getElementById('pagValorHora').value = pagamento.valorHora || '';
            document.getElementById('pagId').value = pagamento.id || '';
            document.getElementById('pagFirebaseId').value = pagamento.firebaseId || '';
            
            // Mostrar PDF se existir
            const pdfContainer = document.getElementById('pagPdfContainer');
            if (pdfContainer) {
                if (pagamento.pdfRecibo) {
                    pdfContainer.innerHTML = `
                        <div style="margin-top: 10px;">
                            <strong>Recibo atual:</strong> ${pagamento.pdfNome || 'recibo.pdf'}
                            <button class="btn btn-sm btn-info" onclick="window.verPDF('${pagamento.firebaseId}', 'motoristas_pagamentos')">👁️ Ver</button>
                            <button class="btn btn-sm btn-danger" onclick="window.removerPDF('${pagamento.firebaseId}', 'motoristas_pagamentos')">🗑️ Remover</button>
                        </div>
                    `;
                } else {
                    pdfContainer.innerHTML = '<input type="file" id="pagPdfFile" accept=".pdf" onchange="window.previewPDF(this)">';
                }
            }
        } else {
            document.getElementById('modalPagamentoTitulo').innerText = 'Novo Pagamento';
            document.getElementById('pagData').value = new Date().toISOString().split('T')[0];
            document.getElementById('pagHoras').value = '';
            document.getElementById('pagValorHora').value = '';
            document.getElementById('pagId').value = '';
            document.getElementById('pagFirebaseId').value = '';
            
            const pdfContainer = document.getElementById('pagPdfContainer');
            if (pdfContainer) {
                pdfContainer.innerHTML = '<input type="file" id="pagPdfFile" accept=".pdf" onchange="window.previewPDF(this)">';
            }
        }
        
        window.calcPagamento();
    };

    window.editarPagamento = function(id) {
        const pagamento = (appData.pagamentos || []).find(p => p.id == id || p.firebaseId == id);
        if (pagamento) {
            window.abrirModalPagamento(pagamento);
        } else {
            alert('Pagamento não encontrado!');
        }
    };

    window.previewPDF = function(input) {
        const file = input.files[0];
        if (file && file.type === 'application/pdf') {
            const reader = new FileReader();
            reader.onload = function(e) {
                const embed = document.createElement('embed');
                embed.src = e.target.result;
                embed.type = 'application/pdf';
                embed.width = '100%';
                embed.height = '300px';
                
                const preview = document.getElementById('pdfPreview');
                if (preview) {
                    preview.innerHTML = '';
                    preview.appendChild(embed);
                }
            };
            reader.readAsDataURL(file);
        } else {
            alert('Por favor, selecione um arquivo PDF válido.');
        }
    };

    window.verPDF = function(docId, colecao) {
        const db = getDB();
        if (!db) return;
        
        db.collection(colecao).doc(docId).get().then(doc => {
            if (doc.exists && doc.data().pdfRecibo) {
                const pdfWindow = window.open('');
                pdfWindow.document.write(`<iframe src="${doc.data().pdfRecibo}" width="100%" height="100%" style="border:none;"></iframe>`);
            } else {
                alert('PDF não encontrado!');
            }
        }).catch(error => {
            console.error('Erro ao carregar PDF:', error);
            alert('Erro ao carregar PDF.');
        });
    };

    window.removerPDF = async function(docId, colecao) {
        if (!confirm('Remover o recibo em PDF?')) return;
        
        const db = getDB();
        if (!db) return;
        
        try {
            await db.collection(colecao).doc(docId).update({
                pdfRecibo: firebase.firestore.FieldValue.delete(),
                pdfNome: firebase.firestore.FieldValue.delete(),
                pdfTamanho: firebase.firestore.FieldValue.delete(),
                pdfDataUpload: firebase.firestore.FieldValue.delete()
            });
            
            alert('PDF removido com sucesso!');
            window.fecharModal('modalPagamento');
        } catch (error) {
            console.error('Erro ao remover PDF:', error);
            alert('Erro ao remover PDF.');
        }
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
        
        if (!cod || !motorista) {
            alert('Selecione um motorista!');
            return;
        }
        
        const horas = parseFloat(document.getElementById('pagHoras')?.value) || 0;
        const valorHora = parseFloat(document.getElementById('pagValorHora')?.value) || 0;
        
        if (horas <= 0 || valorHora <= 0) {
            alert('Preencha horas e valor por hora corretamente!');
            return;
        }
        
        const id = document.getElementById('pagId')?.value;
        const firebaseId = document.getElementById('pagFirebaseId')?.value;
        
        const pagamento = {
            id: id ? parseInt(id) : Date.now(),
            firebaseId: firebaseId || null,
            data: document.getElementById('pagData')?.value || '',
            codMotorista: cod,
            motorista: motorista?.nome || '',
            horas: horas,
            valorHora: valorHora,
            valorTotal: horas * valorHora
        };
        
        // Upload do PDF se existir
        const pdfFile = document.getElementById('pagPdfFile')?.files[0];
        
        // Se for edição, remove o pagamento antigo
        if (id) {
            appData.pagamentos = appData.pagamentos.filter(p => p.id != id && p.firebaseId != firebaseId);
        }
        
        appData.pagamentos.push(pagamento);
        const novoFirebaseId = await salvarPagamentoFB(pagamento);
        
        if (novoFirebaseId) {
            pagamento.firebaseId = novoFirebaseId;
            
            // Upload do PDF
            if (pdfFile) {
                const pdfUrl = await uploadPDF(pdfFile, 'motoristas_pagamentos', novoFirebaseId);
                if (pdfUrl) {
                    pagamento.pdfRecibo = pdfUrl;
                    pagamento.pdfNome = pdfFile.name;
                }
            }
            
            window.fecharModal('modalPagamento');
            window.carregarPagamentos();
            alert('Pagamento salvo com sucesso!');
        } else {
            alert('Erro ao salvar pagamento.');
        }
    };

    window.carregarPagamentos = function() {
        const tbody = document.getElementById('tabelaPagamentos');
        if (!tbody) return;
        
        const pagamentos = (appData.pagamentos || []).sort((a, b) => new Date(b.data) - new Date(a.data));
        
        tbody.innerHTML = pagamentos.map(p => `
            <tr>
                <td>${p.data}</td>
                <td>${p.motorista}</td>
                <td>${p.horas}h</td>
                <td>${formatMoney(p.valorHora)}</td>
                <td><strong>${formatMoney(p.valorTotal)}</strong></td>
                <td>
                    ${p.pdfRecibo ? `<button class="btn btn-sm btn-info" onclick="window.verPDF('${p.firebaseId}', 'motoristas_pagamentos')" title="Ver Recibo">📄</button>` : '-'}
                </td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="window.editarPagamento('${p.id || p.firebaseId}')" title="Editar">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="window.excluirPagamento('${p.id || p.firebaseId}')" title="Excluir">🗑️</button>
                </td>
            </tr>
        `).join('');
    };

    window.excluirPagamento = async function(id) {
        if (!confirm('Tem certeza que deseja excluir este pagamento?')) return;
        
        const pag = appData.pagamentos.find(p => p.id == id || p.firebaseId == id);
        if (!pag) {
            alert('Pagamento não encontrado!');
            return;
        }
        
        try {
            appData.pagamentos = appData.pagamentos.filter(p => p.id != id && p.firebaseId != id);
            
            if (pag?.firebaseId) {
                await excluirDoFB('motoristas_pagamentos', pag.firebaseId);
            }
            
            window.carregarPagamentos();
            alert('Pagamento excluído com sucesso!');
        } catch (error) {
            console.error('Erro ao excluir:', error);
            alert('Erro ao excluir pagamento. Tente novamente.');
        }
    };

    // ============ UTILITÁRIOS ============
    window.fecharModal = function(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('active');
    };

    window.gerarRelatorioPDF = function() {
        alert('Funcionalidade de relatório PDF em desenvolvimento');
    };

    // ============ INICIALIZAÇÃO ============
    async function init() {
        console.log('🚀 Iniciando aplicação...');
        showLoading();
        
        const db = getDB();
        if (!db) {
            console.error('❌ Firebase não disponível');
            hideLoading();
            alert('Erro: Firebase não está disponível. Verifique a conexão.');
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

        // Adicionar event listeners
        document.getElementById('painelMotorista')?.addEventListener('change', window.atualizarPainel);
        document.getElementById('painelMes')?.addEventListener('change', window.atualizarPainel);
        document.getElementById('painelAno')?.addEventListener('change', window.atualizarPainel);
        
        document.getElementById('pontoMotorista')?.addEventListener('change', window.carregarPonto);
        document.getElementById('pontoMes')?.addEventListener('change', window.carregarPonto);
        document.getElementById('pontoAno')?.addEventListener('change', window.carregarPonto);
        
        document.getElementById('bancoMotorista')?.addEventListener('change', window.carregarBancoHoras);
        document.getElementById('kmFiltroMotorista')?.addEventListener('change', window.carregarKM);

        document.getElementById('pagHoras')?.addEventListener('input', window.calcPagamento);
        document.getElementById('pagValorHora')?.addEventListener('input', window.calcPagamento);
        document.getElementById('kmInicial')?.addEventListener('input', window.calcularKM);
        document.getElementById('kmFinal')?.addEventListener('input', window.calcularKM);

        // Inicializar tabs
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                const tabContent = document.getElementById('tab-' + tab.dataset.tab);
                if (tabContent) tabContent.classList.add('active');
            });
        });

        // Fechar modal ao clicar fora
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal-overlay')) {
                e.target.classList.remove('active');
            }
        });

        // Carregar dados iniciais
        window.atualizarPainel();
        window.carregarPonto();
        window.carregarBancoHoras();
        window.carregarKM();
        window.carregarPagamentos();

        hideLoading();
        console.log('✅ Sistema de Motoristas inicializado com sucesso!');
    }

    // Iniciar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
