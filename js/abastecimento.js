// abastecimento.js - Versão completa e corrigida

class GerenciadorAbastecimento { 
    constructor() { 
        this.abastecimentos = []; 
        this.veiculos = []; 
        this.editandoId = null; 
        this.filtrosAtivos = { 
            veiculo: "", 
            periodo: '30', 
            combustivel: "", 
            busca: "" 
        };

        if (document.readyState === 'loading') { 
            document.addEventListener('DOMContentLoaded', () => this.inicializar()); 
        } else { 
            this.inicializar(); 
        } 
    }

    async inicializar() { 
        console.log('Inicializando sistema de abastecimento...');
        await this.aguardarFirebase(); 
        await this.carregarVeiculos(); 
        await this.carregarAbastecimentos();

        this.inicializarEventos();
        this.configurarAbas(); 
        this.atualizarSelectVeiculos(); 
        this.atualizarTabela(); 
        this.atualizarEstatisticas(); 
        this.carregarConsumoVeiculos(); 
        this.carregarEstatisticasGerais(); 
        
        console.log(`Sistema pronto! ${this.veiculos.length} veículos, ${this.abastecimentos.length} abastecimentos`); 
    }

    aguardarFirebase() {
        return new Promise((resolve) => {
            const verificar = setInterval(() => { 
                if (window.firebaseDB) { 
                    clearInterval(verificar); 
                    console.log('Firebase conectado'); 
                    resolve(); 
                } 
            }, 100);

            setTimeout(() => { 
                clearInterval(verificar); 
                console.log('Firebase não disponível, usando localStorage');
                resolve(); 
            }, 3000); 
        }); 
    }

    configurarAbas() { 
        const tabs = document.querySelectorAll('.tab-btn'); 
        const contents = document.querySelectorAll('.tab-content');

        tabs.forEach(tab => { 
            tab.addEventListener('click', () => { 
                const tabId = tab.getAttribute('data-tab');
                tabs.forEach(t => t.classList.remove('active')); 
                contents.forEach(c => c.classList.remove('active'));
                tab.classList.add('active'); 
                const targetContent = document.getElementById(tabId); 
                if (targetContent) { 
                    targetContent.classList.add('active'); 
                }
                if (tabId === 'consumo-veiculos') { 
                    this.carregarConsumoVeiculos(); 
                } else if (tabId === 'estatisticas') { 
                    this.carregarEstatisticasGerais(); 
                }
            });
        });
    }

    async carregarVeiculos() { 
        try { 
            console.log('Carregando veículos...');
            
            if (window.firebaseDB) { 
                const snapshot = await window.firebaseDB.collection('veiculos').get(); 
                const firebaseVeiculos = []; 
                snapshot.forEach(doc => { 
                    const data = doc.data();
                    firebaseVeiculos.push({ 
                        firebaseId: doc.id,
                        id: doc.id,
                        nome: data.nome || data.modelo || 'Sem nome',
                        modelo: data.modelo || data.nome,
                        placa: data.placa || '',
                        tipoMedidor: data.tipoMedidor || 'km',
                        combustivel: data.combustivel || data.combustivelVeiculo || 'Diesel S10',
                        renavam: data.renavam || '',
                        ano: data.ano || '',
                        cor: data.cor || '',
                        status: data.status || 'Ativo'
                    }); 
                }); 
                if (firebaseVeiculos.length > 0) { 
                    this.veiculos = firebaseVeiculos; 
                    localStorage.setItem('veiculos', JSON.stringify(this.veiculos)); 
                    console.log(`${this.veiculos.length} veículos carregados do Firebase`);
                    return; 
                } 
            } 
            
            const veiculosSalvos = localStorage.getItem('veiculos'); 
            if (veiculosSalvos) { 
                this.veiculos = JSON.parse(veiculosSalvos); 
                console.log(`${this.veiculos.length} veículos do localStorage`);
                return; 
            } 
            
            this.veiculos = this.getVeiculosPadrao(); 
            localStorage.setItem('veiculos', JSON.stringify(this.veiculos)); 
            console.log(`${this.veiculos.length} veículos padrão`); 
        } catch (error) { 
            console.error('Erro ao carregar veículos:', error); 
            this.veiculos = this.getVeiculosPadrao(); 
        } 
    }
    
    getVeiculosPadrao() { 
        return [
            { id: 1, firebaseId: null, nome: 'Caminhão Mercedes 1113', modelo: 'Mercedes 1113', placa: 'ABC-1234', tipoMedidor: 'km', combustivel: 'Diesel S10' },
            { id: 2, firebaseId: null, nome: 'Empilhadeira Toyota', modelo: 'Toyota', placa: 'EMP-001', tipoMedidor: 'horas', combustivel: 'Gasolina' },
            { id: 3, firebaseId: null, nome: 'Caminhão VW Constellation', modelo: 'VW Constellation', placa: 'XYZ-5678', tipoMedidor: 'km', combustivel: 'Diesel S500' },
            { id: 4, firebaseId: null, nome: 'Trator Massey Ferguson', modelo: 'Massey Ferguson', placa: 'TRT-001', tipoMedidor: 'horas', combustivel: 'Diesel S10' }
        ]; 
    }
    
    atualizarSelectVeiculos() { 
        const select = document.getElementById('veiculoAbastecimento'); 
        const filtroVeiculo = document.getElementById('filtroVeiculo'); 
        
        console.log('Atualizando selects com', this.veiculos.length, 'veículos');
        
        if (select) { 
            select.innerHTML = '<option value="">Selecione um veículo...</option>'; 
            this.veiculos.forEach(veiculo => { 
                const nomeVeiculo = veiculo.nome || veiculo.modelo || 'Sem nome'; 
                const medidor = veiculo.tipoMedidor || 'km'; 
                const veiculoId = veiculo.firebaseId || veiculo.id;
                select.innerHTML += `<option value="${veiculoId}">${veiculo.placa || 'SEM PLACA'} - ${nomeVeiculo} (${medidor.toUpperCase()})</option>`; 
            }); 
        } 
        
        if (filtroVeiculo) { 
            filtroVeiculo.innerHTML = '<option value="">Todos os veículos</option>'; 
            this.veiculos.forEach(veiculo => { 
                const nomeVeiculo = veiculo.nome || veiculo.modelo || 'Sem nome'; 
                const veiculoId = veiculo.firebaseId || veiculo.id;
                filtroVeiculo.innerHTML += `<option value="${veiculoId}">${veiculo.placa || 'SEM PLACA'} - ${nomeVeiculo}</option>`; 
            }); 
        } 
    }

    async carregarAbastecimentos() { 
        try { 
            if (window.firebaseDB) { 
                const snapshot = await window.firebaseDB.collection('abastecimentos').orderBy('data', 'desc').get(); 
                this.abastecimentos = []; 
                snapshot.forEach(doc => { 
                    this.abastecimentos.push({ 
                        firebaseId: doc.id, 
                        ...doc.data() 
                    }); 
                }); 
                console.log(`${this.abastecimentos.length} abastecimentos do Firebase`); 
                localStorage.setItem('abastecimentos', JSON.stringify(this.abastecimentos)); 
                return; 
            } 
            
            const abastecimentosSalvos = localStorage.getItem('abastecimentos'); 
            if (abastecimentosSalvos) {
                this.abastecimentos = JSON.parse(abastecimentosSalvos); 
                console.log(`${this.abastecimentos.length} abastecimentos do localStorage`); 
            } else { 
                this.abastecimentos = []; 
            } 
        } catch (error) { 
            console.error('Erro ao carregar abastecimentos:', error); 
            this.abastecimentos = []; 
        } 
    }

    async salvarNoFirebase(abastecimento) { 
        if (!window.firebaseDB) return null; 
        try { 
            const { firebaseId, ...dados } = abastecimento; 
            if (abastecimento.firebaseId) { 
                await window.firebaseDB.collection('abastecimentos').doc(abastecimento.firebaseId).update(dados); 
                console.log('Atualizado no Firebase'); 
                return abastecimento.firebaseId; 
            } else { 
                const docRef = await window.firebaseDB.collection('abastecimentos').add(dados); 
                console.log('Salvo no Firebase ID:', docRef.id); 
                return docRef.id; 
            } 
        } catch (error) { 
            console.error('Erro ao salvar no Firebase:', error); 
            return null; 
        } 
    }

    calcularValorTotal() { 
        const quantidade = parseFloat(document.getElementById('quantidadeLitros')?.value) || 0; 
        const preco = parseFloat(document.getElementById('precoLitro')?.value) || 0; 
        const valorTotal = quantidade * preco; 
        const valorTotalInput = document.getElementById('valorTotal'); 
        if (valorTotalInput) valorTotalInput.value = valorTotal.toFixed(2); 
    }

    calcularMediaConsumo(atual, anterior) { 
        if (!anterior) return null; 
        const veiculo = this.findVeiculoById(atual.veiculoId); 
        if (!veiculo) return null; 
        const tipo = veiculo.tipoMedidor || 'km'; 
        let distancia = 0; 
        if (tipo === 'km' && atual.odometro && anterior.odometro) { 
            distancia = atual.odometro - anterior.odometro; 
        } else if (tipo === 'horas' && atual.horimetro && anterior.horimetro) { 
            distancia = atual.horimetro - anterior.horimetro; 
        } 
        if (distancia > 0 && atual.quantidade > 0) { 
            const media = distancia / atual.quantidade; 
            return { 
                valor: parseFloat(media.toFixed(2)), 
                unidade: tipo === 'km' ? 'km/l' : 'horas/l', 
                distancia: distancia 
            }; 
        } 
        return null; 
    }

    buscarUltimoAbastecimento(veiculoId) { 
        const filtrados = this.abastecimentos 
            .filter(a => a.veiculoId == veiculoId || a.veiculold == veiculoId) 
            .sort((a, b) => new Date(b.data) - new Date(a.data)); 
        return filtrados[0] || null; 
    }

    buscarAbastecimentoAnterior(veiculoId, dataAtual) { 
        const filtrados = this.abastecimentos 
            .filter(a => (a.veiculoId == veiculoId || a.veiculold == veiculoId) && new Date(a.data) <= new Date(dataAtual)) 
            .sort((a, b) => new Date(b.data) - new Date(a.data)); 
        return filtrados[1] || null; 
    }

    calcularConsumoPorVeiculo() { 
        const consumoVeiculos = {};

        this.abastecimentos.forEach(abast => { 
            const veiculo = this.findVeiculoById(abast.veiculoId || abast.veiculold); 
            if (!veiculo) return; 
            const placa = veiculo.placa; 
            if (!consumoVeiculos[placa]) { 
                consumoVeiculos[placa] = { 
                    veiculo: veiculo, 
                    totalLitros: 0, 
                    totalDistancia: 0, 
                    medias: [], 
                    ultimaMedia: null, 
                    melhorMedia: 0, 
                    piorMedia: Infinity, 
                    abastecimentos: [] 
                }; 
            }
            consumoVeiculos[placa].abastecimentos.push({ 
                data: abast.data, 
                odometro: abast.odometro, 
                horimetro: abast.horimetro, 
                quantidade: abast.quantidade, 
                mediaConsumo: abast.mediaConsumo 
            });
        });

        for (const placa in consumoVeiculos) { 
            const dados = consumoVeiculos[placa]; 
            const veiculo = dados.veiculo; 
            const tipo = veiculo.tipoMedidor || 'km';
            dados.abastecimentos.sort((a, b) => new Date(a.data) - new Date(b.data)); 
            let ultimo = null;

            dados.abastecimentos.forEach((abast) => { 
                const kmAtual = tipo === 'km' ? abast.odometro : abast.horimetro; 
                const consumo = abast.quantidade;

                if (ultimo !== null && kmAtual > ultimo) { 
                    const distancia = kmAtual - ultimo; 
                    const media = distancia / consumo; 
                    if (media > 0 && isFinite(media)) { 
                        dados.medias.push(media); 
                        dados.totalDistancia += distancia; 
                    }
                }
                dados.totalLitros += consumo; 
                ultimo = kmAtual;

                if (abast.mediaConsumo && abast.mediaConsumo.valor > 0) { 
                    dados.ultimaMedia = abast.mediaConsumo.valor; 
                }
            });

            if (dados.medias.length > 0) { 
                dados.melhorMedia = Math.max(...dados.medias); 
                dados.piorMedia = Math.min(...dados.medias);
            } else { 
                dados.piorMedia = 0; 
            }
        }
        return consumoVeiculos;
    }

    carregarConsumoVeiculos() { 
        const tbody = document.getElementById('tabelaConsumoVeiculosBody'); 
        if (!tbody) return;

        const consumoVeiculos = this.calcularConsumoPorVeiculo(); 
        const veiculosArray = Object.values(consumoVeiculos);

        if (veiculosArray.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center">Nenhum dado de consumo disponível</td></tr>';
            document.getElementById('totalVeiculosConsumo').textContent = '0 veículos';
            return;
        }

        veiculosArray.sort((a, b) => {
            const mediaA = a.medias.length > 0 ? a.medias.reduce((s, m) => s + m, 0) / a.medias.length : 0;
            const mediaB = b.medias.length > 0 ? b.medias.reduce((s, m) => s + m, 0) / b.medias.length : 0;
            return mediaB - mediaA;
        });

        let html = '';
        veiculosArray.forEach(dados => {
            const veiculo = dados.veiculo;
            const tipo = veiculo.tipoMedidor || 'km';
            const unidade = tipo === 'km' ? 'km' : 'horas';
            const mediaGeral = dados.medias.length > 0 ? (dados.medias.reduce((s, m) => s + m, 0) / dados.medias.length).toFixed(2) : 'N/D';
            const mediaClass = this.getClassMedia(parseFloat(mediaGeral), tipo);

            html += `
                <tr>
                    <td><strong>${veiculo.nome || veiculo.modelo || '-'}</strong></td>
                    <td>${veiculo.placa || '-'}</td>
                    <td>${tipo.toUpperCase()}</td>
                    <td>${veiculo.combustivel || '-'}</td>
                    <td>${dados.totalLitros.toFixed(2)} L</td>
                    <td>${dados.totalDistancia.toFixed(0)} ${unidade}</td>
                    <td><span class="${mediaClass}">${mediaGeral} ${tipo === 'km' ? 'km/l' : 'horas/l'}</span></td>
                    <td><span class="${this.getClassMedia(dados.ultimaMedia, tipo)}">${dados.ultimaMedia ? dados.ultimaMedia.toFixed(2) + ' ' + (tipo === 'km' ? 'km/l' : 'horas/l') : '-'}</span></td>
                    <td><span class="${this.getClassMedia(dados.melhorMedia, tipo)}">${dados.melhorMedia > 0 ? dados.melhorMedia.toFixed(2) + ' ' + (tipo === 'km' ? 'km/l' : 'horas/l') : '-'}</span></td>
                    <td><span class="${this.getClassMedia(dados.piorMedia, tipo)}">${dados.piorMedia > 0 && dados.piorMedia !== Infinity ? dados.piorMedia.toFixed(2) + ' ' + (tipo === 'km' ? 'km/l' : 'horas/l') : '-'}</span></td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        document.getElementById('totalVeiculosConsumo').textContent = `${veiculosArray.length} veículos`;

        const filterConsumo = document.getElementById('filterConsumo');
        if (filterConsumo) {
            filterConsumo.oninput = () => {
                const busca = filterConsumo.value.toLowerCase();
                const linhas = tbody.querySelectorAll('tr');
                linhas.forEach(linha => {
                    const texto = linha.textContent.toLowerCase();
                    linha.style.display = texto.includes(busca) ? '' : 'none';
                });
            };
        }
    }

    getClassMedia(media, tipo) { 
        if (!media || media === 0) return ""; 
        if (tipo === 'km') { 
            if (media >= 4) return 'media-boa'; 
            if (media >= 2.5) return 'media-media'; 
            return 'media-ruim'; 
        } else { 
            if (media >= 2.5) return 'media-boa'; 
            if (media >= 1.5) return 'media-media'; 
            return 'media-ruim'; 
        } 
    }

    carregarEstatisticasGerais() {
        const container = document.getElementById('estatisticasContainer');
        if (!container) return;

        const consumoVeiculos = this.calcularConsumoPorVeiculo();
        const veiculosArray = Object.values(consumoVeiculos);

        let totalLitros = 0, totalDistancia = 0, totalGasto = 0, todasMedias = [];

        veiculosArray.forEach(dados => {
            totalLitros += dados.totalLitros;
            totalDistancia += dados.totalDistancia;
            todasMedias = [...todasMedias, ...dados.medias];
        });

        totalGasto = this.abastecimentos.reduce((acc, a) => acc + (a.valorTotal || 0), 0);

        const melhorVeiculo = veiculosArray.length > 0 ? veiculosArray.reduce((best, curr) => {
            const bestMedia = best.medias.length > 0 ? best.medias.reduce((s, m) => s + m, 0) / best.medias.length : 0;
            const currMedia = curr.medias.length > 0 ? curr.medias.reduce((s, m) => s + m, 0) / curr.medias.length : 0;
            return currMedia > bestMedia ? curr : best;
        }, veiculosArray[0]) : null;

        const piorVeiculo = veiculosArray.length > 0 ? veiculosArray.reduce((worst, curr) => {
            const worstMedia = worst.medias.length > 0 ? worst.medias.reduce((s, m) => s + m, 0) / worst.medias.length : Infinity;
            const currMedia = curr.medias.length > 0 ? curr.medias.reduce((s, m) => s + m, 0) / curr.medias.length : Infinity;
            return currMedia < worstMedia ? curr : worst;
        }, veiculosArray[0]) : null;

        const consumoMedio = totalLitros > 0 ? (totalDistancia / totalLitros).toFixed(2) : 'N/D';

        container.innerHTML = `
            <div class="stat-card-consumo">
                <h3><i class="fas fa-chart-line"></i> Resumo Geral</h3>
                <div class="stat-item"><span class="stat-label">Total de Abastecimentos:</span><span class="stat-value">${this.abastecimentos.length}</span></div>
                <div class="stat-item"><span class="stat-label">Total de Litros:</span><span class="stat-value">${totalLitros.toFixed(2)} L</span></div>
                <div class="stat-item"><span class="stat-label">Total de KM/Horas:</span><span class="stat-value">${totalDistancia.toFixed(0)}</span></div>
                <div class="stat-item"><span class="stat-label">Total Gasto:</span><span class="stat-value">R$ ${totalGasto.toFixed(2)}</span></div>
                <div class="stat-item"><span class="stat-label">Consumo Médio da Frota:</span><span class="stat-value ${this.getClassMedia(parseFloat(consumoMedio), 'km')}">${consumoMedio} ${totalDistancia > 0 ? 'km/l' : '-'}</span></div>
            </div>
            <div class="stat-card-consumo">
                <h3><i class="fas fa-trophy"></i> Melhor e Pior</h3>
                <div class="stat-item"><span class="stat-label">Melhor Veículo:</span><span class="stat-value">${melhorVeiculo ? `${melhorVeiculo.veiculo.placa} - ${melhorVeiculo.veiculo.nome}` : '-'}</span></div>
                <div class="stat-item"><span class="stat-label">Média do Melhor:</span><span class="stat-value media-boa">${melhorVeiculo && melhorVeiculo.medias.length > 0 ? (melhorVeiculo.medias.reduce((s, m) => s + m, 0) / melhorVeiculo.medias.length).toFixed(2) + ' ' + (melhorVeiculo.veiculo.tipoMedidor === 'km' ? 'km/l' : 'horas/l') : '-'}</span></div>
                <div class="stat-item"><span class="stat-label">Pior Veículo:</span><span class="stat-value">${piorVeiculo ? `${piorVeiculo.veiculo.placa} - ${piorVeiculo.veiculo.nome}` : '-'}</span></div>
                <div class="stat-item"><span class="stat-label">Média do Pior:</span><span class="stat-value media-ruim">${piorVeiculo && piorVeiculo.medias.length > 0 ? (piorVeiculo.medias.reduce((s, m) => s + m, 0) / piorVeiculo.medias.length).toFixed(2) + ' ' + (piorVeiculo.veiculo.tipoMedidor === 'km' ? 'km/l' : 'horas/l') : '-'}</span></div>
            </div>
            <div class="stat-card-consumo">
                <h3><i class="fas fa-chart-bar"></i> Estatísticas por Tipo</h3>
                <div class="stat-item"><span class="stat-label">Veículos com Medidor KM:</span><span class="stat-value">${this.veiculos.filter(v => v.tipoMedidor === 'km').length}</span></div>
                <div class="stat-item"><span class="stat-label">Veículos com Medidor Horas:</span><span class="stat-value">${this.veiculos.filter(v => v.tipoMedidor === 'horas').length}</span></div>
            </div>
        `;
    }

    async salvarAbastecimento(event) { 
        event.preventDefault(); 
        const veiculoId = document.getElementById('veiculoAbastecimento').value; 
        if (!veiculoId) { this.mostrarNotificacao('Selecione um veículo!', 'error'); return; } 
        
        const data = document.getElementById('dataAbastecimento').value; 
        if (!data) { this.mostrarNotificacao('Selecione a data!', 'error'); return; }

        const veiculo = this.findVeiculoById(veiculoId);
        if (!veiculo) { this.mostrarNotificacao('Veículo não encontrado!', 'error'); return; }

        const tipo = veiculo.tipoMedidor || 'km';
        const medidorValor = parseFloat(document.getElementById('odometro').value);

        if (!medidorValor || medidorValor <= 0) { 
            this.mostrarNotificacao(`Informe o ${tipo} válido!`, 'error'); 
            return; 
        }

        const odometro = tipo === 'km' ? medidorValor : null;
        const horimetro = tipo === 'horas' ? medidorValor : null;
        const tipoCombustivel = document.getElementById('tipoCombustivel').value;

        if (!tipoCombustivel) { 
            this.mostrarNotificacao('Selecione o combustível!', 'error'); 
            return; 
        }

        const quantidade = parseFloat(document.getElementById('quantidadeLitros').value);
        if (!quantidade || quantidade <= 0) { 
            this.mostrarNotificacao('Informe a quantidade!', 'error'); 
            return; 
        }

        const precoLitro = parseFloat(document.getElementById('precoLitro').value);
        if (!precoLitro || precoLitro <= 0) { 
            this.mostrarNotificacao('Informe o preço!', 'error'); 
            return; 
        }

        const novoAbastecimento = {
            id: this.editandoId || Date.now(),
            veiculoId: veiculoId,
            veiculoPlaca: veiculo.placa,
            data: data,
            odometro: odometro,
            horimetro: horimetro,
            tipoCombustivel: tipoCombustivel,
            quantidade: quantidade,
            precoLitro: precoLitro,
            valorTotal: quantidade * precoLitro,
            posto: document.getElementById('posto').value,
            observacoes: document.getElementById('observacoes').value,
            dataRegistro: new Date().toISOString()
        };

        if (this.editandoId) { 
            const existente = this.abastecimentos.find(a => a.id === this.editandoId); 
            if (existente && existente.firebaseId) novoAbastecimento.firebaseId = existente.firebaseId; 
        }

        const anterior = this.buscarAbastecimentoAnterior(veiculoId, data); 
        const media = this.calcularMediaConsumo(novoAbastecimento, anterior); 
        if (media && media.valor > 0) { 
            novoAbastecimento.mediaConsumo = media; 
            this.mostrarNotificacao(`Média: ${media.valor} ${media.unidade}`, 'success'); 
        }

        const firebaseId = await this.salvarNoFirebase(novoAbastecimento); 
        if (firebaseId) novoAbastecimento.firebaseId = firebaseId;

        if (this.editandoId) { 
            const index = this.abastecimentos.findIndex(a => a.id === this.editandoId); 
            if (index !== -1) this.abastecimentos[index] = novoAbastecimento; 
        } else { 
            this.abastecimentos.push(novoAbastecimento); 
        }

        localStorage.setItem('abastecimentos', JSON.stringify(this.abastecimentos));
        this.atualizarTabela(); 
        this.atualizarEstatisticas(); 
        this.carregarConsumoVeiculos(); 
        this.carregarEstatisticasGerais(); 
        this.limparFormulario(); 
        this.esconderFormulario();
        this.mostrarNotificacao(this.editandoId ? 'Abastecimento atualizado!' : 'Abastecimento registrado!', 'success'); 
        this.editandoId = null; 
    }

    editarAbastecimento(id) {
        const abast = this.abastecimentos.find(a => a.id == id);
        if (!abast) return;

        const veiculo = this.findVeiculoById(abast.veiculoId || abast.veiculold);
        if (!veiculo) return;

        document.getElementById('veiculoAbastecimento').value = abast.veiculoId || abast.veiculold;
        document.getElementById('dataAbastecimento').value = abast.data;
        document.getElementById('odometro').value = veiculo.tipoMedidor === 'km' ? abast.odometro : abast.horimetro;
        document.getElementById('tipoCombustivel').value = abast.tipoCombustivel;
        document.getElementById('quantidadeLitros').value = abast.quantidade;
        document.getElementById('precoLitro').value = abast.precoLitro;
        document.getElementById('valorTotal').value = abast.valorTotal.toFixed(2);
        document.getElementById('posto').value = abast.posto || '';
        document.getElementById('observacoes').value = abast.observacoes || '';

        this.editandoId = abast.id;
        document.getElementById('formTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Abastecimento';
        document.getElementById('btnCancelarAbastecimento').textContent = 'Cancelar Edição';
        this.mostrarFormulario();
        this.atualizarInfoVeiculo();
    }

    async excluirAbastecimento(id) { 
        if (!confirm('Excluir este abastecimento?')) return; 
        const abast = this.abastecimentos.find(a => a.id == id); 
        if (!abast) return; 
        
        if (abast.firebaseId && window.firebaseDB) { 
            await window.firebaseDB.collection('abastecimentos').doc(abast.firebaseId).delete(); 
        }
        
        this.abastecimentos = this.abastecimentos.filter(a => a.id != id); 
        localStorage.setItem('abastecimentos', JSON.stringify(this.abastecimentos)); 
        this.atualizarTabela(); 
        this.atualizarEstatisticas(); 
        this.carregarConsumoVeiculos(); 
        this.carregarEstatisticasGerais(); 
        this.mostrarNotificacao('Abastecimento excluído!', 'success'); 
    }

    atualizarInfoVeiculo() { 
        const veiculoId = document.getElementById('veiculoAbastecimento').value; 
        const info = document.getElementById('vehicleInfo'); 
        if (!veiculoId || !info) return;

        const veiculo = this.findVeiculoById(veiculoId);
        if (veiculo) { 
            document.getElementById('infoCombustivel').textContent = `Combustível: ${veiculo.combustivel || 'Não definido'}`;
            document.getElementById('infoMedidor').textContent = `Medidor: ${(veiculo.tipoMedidor || 'km').toUpperCase()}`;
            const ultimo = this.buscarUltimoAbastecimento(veiculoId);
            if (ultimo) { 
                const marcacao = veiculo.tipoMedidor === 'km' ? ultimo.odometro : ultimo.horimetro; 
                document.getElementById('infoStatus').innerHTML = `Última: <strong>${marcacao}</strong> ${(veiculo.tipoMedidor)}`;
            } else { 
                document.getElementById('infoStatus').innerHTML = 'Primeiro abastecimento'; 
            } 
            info.style.display = 'block';
        } 
    }

    atualizarTabela() { 
        const tbody = document.getElementById('tabelaAbastecimentosBody'); 
        if (!tbody) return; 
        
        let dados = this.aplicarFiltrosDados(); 
        if (dados.length === 0) { 
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhum abastecimento encontrado</td></tr>'; 
            document.getElementById('totalRegistros').textContent = '0 registros'; 
            return; 
        }
        
        dados.sort((a, b) => new Date(b.data) - new Date(a.data)); 
        let html = '';
        
        dados.forEach(abast => { 
            const veiculo = this.findVeiculoById(abast.veiculoId || abast.veiculold); 
            if (!veiculo) return; 
            
            const data = new Date(abast.data); 
            const dataFmt = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); 
            const tipo = veiculo.tipoMedidor || 'km'; 
            const medidor = tipo === 'km' ? abast.odometro : abast.horimetro; 
            const mediaHtml = abast.mediaConsumo ? `<br><small style="color:#28a745;">${abast.mediaConsumo.valor} ${abast.mediaConsumo.unidade}</small>` : '';
            
            html += `
                <tr>
                    <td>${dataFmt}</td>
                    <td><strong>${veiculo.nome || veiculo.modelo}</strong><br><small>${veiculo.placa}</small></td>
                    <td>${medidor} ${tipo.toUpperCase()}${mediaHtml}</td>
                    <td>${abast.tipoCombustivel}</td>
                    <td>${abast.quantidade.toFixed(2)} L</td>
                    <td>R$ ${abast.precoLitro.toFixed(3)}</td>
                    <td><strong>R$ ${abast.valorTotal.toFixed(2)}</strong></td>
                    <td>${abast.posto || '~'}</td>
                    <td>
                        <button class="btn-icon" onclick="gerenciador.verDetalhes(${abast.id})"><i class="fas fa-eye"></i></button>
                        <button class="btn-icon" onclick="gerenciador.editarAbastecimento(${abast.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon text-danger" onclick="gerenciador.excluirAbastecimento(${abast.id})"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        document.getElementById('totalRegistros').textContent = `${dados.length} registros`;
    }

    verDetalhes(id) { 
        const abast = this.abastecimentos.find(a => a.id == id); 
        if (!abast) return;
        
        const veiculo = this.findVeiculoById(abast.veiculoId || abast.veiculold);
        const modal = document.getElementById('modalDetalhes'); 
        const body = document.getElementById('modalDetalhesBody'); 
        if (!modal || !body) return;
        
        const data = new Date(abast.data); 
        const dataFmt = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); 
        const tipo = veiculo?.tipoMedidor || 'km'; 
        const medidor = tipo === 'km' ? abast.odometro : abast.horimetro; 
        
        let mediaHtml = '';
        if (abast.mediaConsumo) {
            mediaHtml = `
                <div class="detail-item"><strong>Média:</strong><span>${abast.mediaConsumo.valor} ${abast.mediaConsumo.unidade}</span></div>
                <div class="detail-item"><strong>Distância:</strong><span>${abast.mediaConsumo.distancia} ${tipo}</span></div>
            `;
        }
        
        body.innerHTML = `
            <div class="details-container">
                <div class="detail-item"><strong>Veículo:</strong><span>${veiculo?.nome || 'Desconhecido'} - ${veiculo?.placa || '-'}</span></div>
                <div class="detail-item"><strong>Data:</strong><span>${dataFmt}</span></div>
                <div class="detail-item"><strong>${tipo.toUpperCase()}:</strong><span>${medidor}</span></div>
                <div class="detail-item"><strong>Combustível:</strong><span>${abast.tipoCombustivel}</span></div>
                <div class="detail-item"><strong>Quantidade:</strong><span>${abast.quantidade.toFixed(2)} L</span></div>
                <div class="detail-item"><strong>Preço/L:</strong><span>R$ ${abast.precoLitro.toFixed(3)}</span></div>
                <div class="detail-item"><strong>Valor Total:</strong><span>R$ ${abast.valorTotal.toFixed(2)}</span></div>
                ${abast.posto ? `<div class="detail-item"><strong>Posto:</strong><span>${abast.posto}</span></div>` : ''}
                ${mediaHtml}
            </div>
            <div class="form-actions" style="margin-top:20px;">
                <button class="btn btn-warning" onclick="gerenciador.editarAbastecimento(${abast.id}); fecharModais();"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn btn-danger" onclick="gerenciador.excluirAbastecimento(${abast.id}); fecharModais();"><i class="fas fa-trash"></i> Excluir</button>
                <button class="btn btn-secondary" onclick="fecharModais()"><i class="fas fa-times"></i> Fechar</button>
            </div>
        `;
        
        modal.style.display = 'block'; 
        const closeBtn = modal.querySelector('.close-modal'); 
        if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none'; 
        window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    }

    aplicarFiltrosDados() { 
        let dados = [...this.abastecimentos];

        if (this.filtrosAtivos.veiculo) { 
            dados = dados.filter(a => a.veiculoId == this.filtrosAtivos.veiculo || a.veiculold == this.filtrosAtivos.veiculo); 
        }

        if (this.filtrosAtivos.periodo && this.filtrosAtivos.periodo !== 'personalizado') { 
            const hoje = new Date(); 
            let limite = new Date(); 
            switch(this.filtrosAtivos.periodo) { 
                case '7': limite.setDate(hoje.getDate() - 7); break; 
                case '30': limite.setDate(hoje.getDate() - 30); break; 
                case 'hoje': limite.setHours(0,0,0,0); break; 
            } 
            dados = dados.filter(a => new Date(a.data) >= limite); 
        }

        if (this.filtrosAtivos.combustivel) { 
            dados = dados.filter(a => a.tipoCombustivel === this.filtrosAtivos.combustivel); 
        }

        if (this.filtrosAtivos.busca) { 
            const busca = this.filtrosAtivos.busca.toLowerCase(); 
            dados = dados.filter(a => { 
                const v = this.findVeiculoById(a.veiculoId || a.veiculold);
                return v?.nome?.toLowerCase().includes(busca) || 
                       v?.placa?.toLowerCase().includes(busca) || 
                       (a.posto && a.posto.toLowerCase().includes(busca)); 
            }); 
        }
        
        if (this.filtrosAtivos.periodo === 'personalizado') { 
            const inicio = document.getElementById('filtroDataInicio')?.value; 
            const fim = document.getElementById('filtroDataFim')?.value; 
            if (inicio && fim) { 
                dados = dados.filter(a => new Date(a.data) >= new Date(inicio) && new Date(a.data) <= new Date(fim + 'T23:59:59')); 
            } 
        } 
        return dados; 
    }

    atualizarEstatisticas() { 
        const dados = this.aplicarFiltrosDados(); 
        const total = dados.length; 
        const valor = dados.reduce((s, a) => s + (a.valorTotal || 0), 0); 
        const litros = dados.reduce((s, a) => s + (a.quantidade || 0), 0); 
        const precoMedio = litros > 0 ? valor / litros : 0; 
        
        document.getElementById('totalAbastecimentos').textContent = total; 
        document.getElementById('totalValor').textContent = `R$ ${valor.toFixed(2)}`; 
        document.getElementById('totalLitros').textContent = `${litros.toFixed(2)} L`; 
        document.getElementById('mediaPreco').textContent = `R$ ${precoMedio.toFixed(3)}/L`; 
    }

    mostrarNotificacao(msg, tipo = 'info') {
        let n = document.getElementById('notificacao'); 
        if (!n) { 
            n = document.createElement('div'); 
            n.id = 'notificacao'; 
            document.body.appendChild(n); 
        } 
        const cores = { success: '#d4edda', error: '#f8d7da', info: '#d1ecf1', warning: '#fff3cd'}; 
        n.style.backgroundColor = cores[tipo] || cores.info; 
        n.style.color = tipo === 'success' ? '#155724' : tipo === 'error' ? '#721c24' : '#0c5460'; 
        n.textContent = msg; 
        n.style.display = 'block'; 
        setTimeout(() => { 
            n.style.opacity = '0'; 
            setTimeout(() => { 
                n.style.display = 'none'; 
                n.style.opacity = '1'; 
            }, 300); 
        }, 3000); 
    }

    mostrarFormulario() { 
        const card = document.getElementById('formCard'); 
        if (card) { 
            card.style.display = 'block'; 
            card.scrollIntoView({ behavior: 'smooth' }); 
        } 
    }

    esconderFormulario() { 
        const card = document.getElementById('formCard'); 
        if (card) { 
            card.style.display = 'none'; 
            this.limparFormulario(); 
        } 
    }

    limparFormulario() { 
        document.getElementById('formAbastecimento')?.reset(); 
        const vehicleInfo = document.getElementById('vehicleInfo');
        if (vehicleInfo) vehicleInfo.style.display = 'none'; 
        this.editandoId = null; 
        
        const formTitle = document.getElementById('formTitle');
        if (formTitle) formTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Novo Abastecimento';
        
        const btnCancelar = document.getElementById('btnCancelarAbastecimento');
        if (btnCancelar) btnCancelar.textContent = 'Cancelar';

        const dataInput = document.getElementById('dataAbastecimento'); 
        if (dataInput) { 
            const agora = new Date(); 
            agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset()); 
            dataInput.value = agora.toISOString().slice(0, 16); 
        } 
    }

    aplicarFiltros() {
        this.filtrosAtivos.veiculo = document.getElementById('filtroVeiculo')?.value || "";
        this.filtrosAtivos.periodo = document.getElementById('filtroPeriodo')?.value || "";
        this.filtrosAtivos.combustivel = document.getElementById('filtroCombustivel')?.value || "";
        this.atualizarTabela();
        this.atualizarEstatisticas();
        this.mostrarNotificacao('Filtros aplicados!', 'success');
    }

    limparFiltros() {
        const filtroVeiculo = document.getElementById('filtroVeiculo');
        const filtroPeriodo = document.getElementById('filtroPeriodo');
        const filtroCombustivel = document.getElementById('filtroCombustivel');
        const dataPersonalizadaGroup = document.getElementById('dataPersonalizadaGroup');
        const filtroDataInicio = document.getElementById('filtroDataInicio');
        const filtroDataFim = document.getElementById('filtroDataFim');
        const filterAbastecimentos = document.getElementById('filterAbastecimentos');
        
        if (filtroVeiculo) filtroVeiculo.value = "";
        if (filtroPeriodo) filtroPeriodo.value = '30';
        if (filtroCombustivel) filtroCombustivel.value = "";
        if (dataPersonalizadaGroup) dataPersonalizadaGroup.style.display = 'none';
        if (filtroDataInicio) filtroDataInicio.value = "";
        if (filtroDataFim) filtroDataFim.value = "";
        if (filterAbastecimentos) filterAbastecimentos.value = "";
        
        this.filtrosAtivos = { veiculo: "", periodo: '30', combustivel: "", busca: "" };
        this.atualizarTabela();
        this.atualizarEstatisticas();
        this.mostrarNotificacao('Filtros removidos!', 'info');
    }

    filtrarTabela() { 
        this.atualizarTabela(); 
    }

    exportarDados() {
        const dados = this.aplicarFiltrosDados();
        if (dados.length === 0) { 
            this.mostrarNotificacao('Não há dados para exportar!', 'warning'); 
            return; 
        }

        const exportData = dados.map(a => { 
            const v = this.findVeiculoById(a.veiculoId || a.veiculold);
            return { 
                Data: new Date(a.data).toLocaleString('pt-BR'), 
                Veículo: v?.nome || 'Desconhecido', 
                Placa: v?.placa || '-', 
                Medição: a.odometro || a.horimetro || '-', 
                Combustível: a.tipoCombustivel, 
                Litros: a.quantidade.toFixed(2), 
                'Preço/L': a.precoLitro.toFixed(3), 
                Total: a.valorTotal.toFixed(2), 
                Posto: a.posto || '-', 
                'Média': a.mediaConsumo ? `${a.mediaConsumo.valor} ${a.mediaConsumo.unidade}` : ''
            };
        });

        const headers = Object.keys(exportData[0]); 
        const csv = [headers.join(';'), ...exportData.map(row => headers.map(h => row[h]).join(';'))].join('\n'); 
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }); 
        const link = document.createElement('a'); 
        link.href = URL.createObjectURL(blob); 
        link.download = `abastecimentos_${new Date().toISOString().slice(0,10)}.csv`; 
        link.click(); 
        URL.revokeObjectURL(link.href); 
        this.mostrarNotificacao(`${dados.length} registros exportados!`, 'success'); 
    }

    gerarRelatorioConsumo() { 
        const dados = this.aplicarFiltrosDados(); 
        if (dados.length === 0) { 
            this.mostrarNotificacao('Não há dados para gerar relatório!', 'warning'); 
            return; 
        }

        const relatorio = {}; 
        dados.forEach(a => { 
            const veiculoId = a.veiculoId || a.veiculold;
            if (!relatorio[veiculoId]) { 
                const v = this.findVeiculoById(veiculoId); 
                relatorio[veiculoId] = { veiculo: v, total: 0, litros: 0, gasto: 0, medias: [] }; 
            } 
            relatorio[veiculoId].total++; 
            relatorio[veiculoId].litros += a.quantidade; 
            relatorio[veiculoId].gasto += a.valorTotal; 
            if (a.mediaConsumo) relatorio[veiculoId].medias.push(a.mediaConsumo.valor); 
        });

        let texto = 'RELATÓRIO DE CONSUMO\n==========================\n\n'; 
        Object.values(relatorio).forEach(r => { 
            if (!r.veiculo) return; 
            const media = r.medias.length > 0 ? (r.medias.reduce((a,b)=>a+b,0)/r.medias.length).toFixed(2) : 'N/D'; 
            texto += `${r.veiculo.nome} (${r.veiculo.placa})\n`; 
            texto += `  Medidor: ${(r.veiculo.tipoMedidor || 'km').toUpperCase()}\n`; 
            texto += `  Abastecimentos: ${r.total}\n`; 
            texto += `  Litros: ${r.litros.toFixed(2)} L\n`; 
            texto += `  Gasto: R$ ${r.gasto.toFixed(2)}\n`; 
            texto += `  Média: ${media} ${r.veiculo.tipoMedidor === 'km' ? 'km/l' : 'horas/l'}\n`; 
            texto += '----------------------------------------\n'; 
        }); 
        alert(texto); 
    }

    inicializarEventos() {
        const form = document.getElementById('formAbastecimento'); 
        if (form) form.addEventListener('submit', (e) => this.salvarAbastecimento(e));

        const qtd = document.getElementById('quantidadeLitros'); 
        const preco = document.getElementById('precoLitro'); 
        if (qtd && preco) { 
            qtd.addEventListener('input', () => this.calcularValorTotal()); 
            preco.addEventListener('input', () => this.calcularValorTotal()); 
        }

        const veiculoSelect = document.getElementById('veiculoAbastecimento'); 
        if (veiculoSelect) veiculoSelect.addEventListener('change', () => this.atualizarInfoVeiculo());

        const btnNovo = document.getElementById('btnNovoAbastecimento');
        if (btnNovo) btnNovo.addEventListener('click', () => { this.limparFormulario(); this.mostrarFormulario(); });

        const btnCancelar = document.getElementById('btnCancelarAbastecimento');
        if (btnCancelar) btnCancelar.addEventListener('click', () => this.esconderFormulario());

        const btnFecharForm = document.getElementById('btnFecharForm');
        if (btnFecharForm) btnFecharForm.addEventListener('click', () => this.esconderFormulario());

        const btnAplicarFiltros = document.getElementById('btnAplicarFiltros');
        if (btnAplicarFiltros) btnAplicarFiltros.addEventListener('click', () => this.aplicarFiltros());

        const btnLimparFiltros = document.getElementById('btnLimparFiltros');
        if (btnLimparFiltros) btnLimparFiltros.addEventListener('click', () => this.limparFiltros());

        const filtroPeriodo = document.getElementById('filtroPeriodo');
        if (filtroPeriodo) {
            filtroPeriodo.addEventListener('change', (e) => { 
                const grupo = document.getElementById('dataPersonalizadaGroup'); 
                if (grupo) grupo.style.display = e.target.value === 'personalizado' ? 'flex' : 'none'; 
            });
        }

        const filterAbastecimentos = document.getElementById('filterAbastecimentos');
        if (filterAbastecimentos) {
            filterAbastecimentos.addEventListener('input', (e) => { 
                this.filtrosAtivos.busca = e.target.value; 
                this.filtrarTabela(); 
            });
        }

        const btnExport = document.getElementById('btnExportAbastecimento');
        if (btnExport) btnExport.addEventListener('click', () => this.exportarDados());
        
        const btnRelatorio = document.getElementById('btnRelatorioConsumo');
        if (btnRelatorio) btnRelatorio.addEventListener('click', () => this.gerarRelatorioConsumo());

        const dataInput = document.getElementById('dataAbastecimento'); 
        if (dataInput) { 
            const agora = new Date(); 
            agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset()); 
            dataInput.value = agora.toISOString().slice(0, 16); 
        } 
    }

    // Método auxiliar para encontrar veículo por ID (firebaseId ou id numérico)
    findVeiculoById(id) {
        if (!id) return null;
        return this.veiculos.find(v => v.firebaseId === id || v.id == id);
    }
}

let gerenciador; 

window.fecharModais = () => { 
    const modal = document.getElementById('modalDetalhes'); 
    if (modal) modal.style.display = 'none'; 
};

document.addEventListener('DOMContentLoaded', () => {
    gerenciador = new GerenciadorAbastecimento(); 
    window.gerenciador = gerenciador; 
});
