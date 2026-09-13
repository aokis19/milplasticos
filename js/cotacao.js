// cotacao.js - Sistema de Cotações (VERSÃO FIREBASE)
// Mil Plásticos

// ================== FIRESTORE ==================
const db = window.db || window.firebaseDB;
if (!db) {
  console.error('❌ Firestore não disponível em cotacao.js. Verifique firebase-init.js');
}

const COL = db ? {
  produtos:     db.collection('cot_produtos'),
  cotacoes:     db.collection('cot_cotacoes'),
  historico:    db.collection('cot_historico'),
  fornecedores: db.collection('cot_fornecedores'),
} : null;

// ================== DADOS GLOBAIS ==================
let produtos = [];
let cotacoes = [];
let historico = [];
let fornecedores = [];
let editingId = null;
let editingFornecedorId = null;
let editingProdutoId = null;
let listenersAtivos = []; // armazena os unsubscribe dos onSnapshot

// ================== UTILITÁRIOS ==================
function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

function formatarData(dataStr) {
  if (!dataStr) return '';
  try { const d = new Date(dataStr + 'T00:00:00'); return d.toLocaleDateString('pt-BR'); } catch { return dataStr; }
}

function formatarDataHora(dataStr) {
  if (!dataStr) return '';
  try { const d = new Date(dataStr); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR'); } catch { return dataStr; }
}

function toast(msg, tipo = 'success') {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `
    position:fixed; bottom:20px; right:20px; padding:.75rem 1.25rem;
    background:${tipo === 'error' ? '#ef4444' : '#10b981'}; color:#fff;
    border-radius:8px; font-weight:600; z-index:99999;
    box-shadow:0 10px 25px rgba(0,0,0,.2); font-size:.875rem;
    font-family:'Segoe UI',system-ui,sans-serif;
    transition:opacity .3s, transform .3s;
  `;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ================== MIGRAÇÃO localStorage → Firestore ==================
// Executa uma única vez: se houver dados antigos no localStorage,
// envia para o Firestore e limpa o localStorage.
async function migrarLocalStorageParaFirestore() {
  if (!COL) return;

  const chaves = ['produtos_cotacao', 'cotacoes', 'historico_cotacao', 'fornecedores'];
  const temDadosAntigos = chaves.some(k => {
    try { return JSON.parse(localStorage.getItem(k) || 'null')?.length > 0; }
    catch { return false; }
  });

  if (!temDadosAntigos) return;

  console.log('🔄 Migrando dados antigos do localStorage para o Firestore...');

  try {
    // Produtos
    const produtosAntigos = JSON.parse(localStorage.getItem('produtos_cotacao') || '[]');
    for (const p of produtosAntigos) {
      const { id, ...dados } = p; // descarta id antigo; Firestore gera o novo
      await COL.produtos.add(dados);
    }

    // Fornecedores
    const fornecedoresAntigos = JSON.parse(localStorage.getItem('fornecedores') || '[]');
    for (const f of fornecedoresAntigos) {
      const { id, ...dados } = f;
      await COL.fornecedores.add(dados);
    }

    // Cotações ativas
    const cotacoesAntigas = JSON.parse(localStorage.getItem('cotacoes') || '[]');
    for (const c of cotacoesAntigas) {
      const { id, ...dados } = c;
      await COL.cotacoes.add(dados);
    }

    // Histórico
    const historicoAntigo = JSON.parse(localStorage.getItem('historico_cotacao') || '[]');
    for (const h of historicoAntigo) {
      const { id, ...dados } = h;
      await COL.historico.add(dados);
    }

    // Limpa o localStorage
    chaves.forEach(k => localStorage.removeItem(k));
    console.log('✅ Migração concluída. localStorage limpo.');
    toast('Dados migrados para o Firestore com sucesso!');
  } catch (err) {
    console.error('❌ Erro na migração:', err);
    toast('Erro ao migrar dados antigos. Os dados foram mantidos no localStorage.', 'error');
  }
}

// ================== RENDERIZAÇÃO ==================
function renderCotacoes() {
  const container = document.getElementById('cotacoesContainer');
  const empty = document.getElementById('emptyState');
  if (!container) return;

  const ativas = cotacoes.filter(c => c.status !== "finalizado");

  console.log('📊 Renderizando cotações ativas:', ativas.length);

  if (ativas.length === 0) {
    container.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  container.innerHTML = ativas.map(cot => {
    const total = (cot.quantidade || 0) * (cot.valorUnitario || 0);
    const totalComImpostos = total + (cot.valorFrete || 0) + (cot.valorIPI || 0) + (cot.valorICMS || 0);

    return `<div class="table-row" data-id="${cot.id}">
      <div class="checkbox-column"><input type="checkbox" class="select-cotacao" value="${cot.id}"></div>
      <div><strong>${cot.produto || '-'}</strong></div>
      <div>${cot.fornecedor || '-'}</div>
      <div>${cot.uf || '-'}</div>
      <div>${cot.quantidade || 0}</div>
      <div>${formatarMoeda(cot.valorUnitario)}</div>
      <div>${formatarMoeda(total)}</div>
      <div><strong>${formatarMoeda(totalComImpostos)}</strong></div>
      <div>${cot.dataEntrega ? formatarData(cot.dataEntrega) : '-'}</div>
      <div>
        <span class="status-badge status-ativo">Ativo</span>
      </div>
      <div class="actions">
        <button class="btn-icon edit-cotacao" data-id="${cot.id}" title="Editar"><i class="fas fa-edit"></i></button>
        <button class="btn-icon delete delete-cotacao" data-id="${cot.id}" title="Excluir"><i class="fas fa-trash"></i></button>
        <button class="btn-icon view-cotacao" data-id="${cot.id}" title="Ver detalhes"><i class="fas fa-eye"></i></button>
      </div>
    </div>`;
  }).join('');
}

function renderHistorico() {
  const container = document.getElementById('historicoContainer');
  if (!container) return;

  const filtroProd = document.getElementById('filtroProduto')?.value?.toLowerCase() || '';
  const filtroForn = document.getElementById('filtroFornecedor')?.value?.toLowerCase() || '';
  const periodo = document.getElementById('filtroPeriodo')?.value || 'todos';

  let lista = [...historico];
  if (filtroProd) lista = lista.filter(i => (i.produto || '').toLowerCase().includes(filtroProd));
  if (filtroForn) lista = lista.filter(i => (i.fornecedor || '').toLowerCase().includes(filtroForn));

  if (periodo !== 'todos') {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - parseInt(periodo));
    lista = lista.filter(i => new Date(i.dataFinalizacao || i.dataCotacao) >= dataLimite);
  }

  if (lista.length === 0) {
    container.innerHTML = '<div class="empty-state" style="display:block;"><i class="fas fa-history"></i><h3>Nenhum histórico encontrado</h3></div>';
    return;
  }

  container.innerHTML = lista.map(item => {
    const total = (item.quantidade || 0) * (item.valorUnitario || 0);
    const totalComImpostos = total + (item.valorFrete || 0) + (item.valorIPI || 0) + (item.valorICMS || 0);

    return `<div class="historico-item">
      <div class="historico-item-header">
        <div class="historico-produto"><i class="fas fa-box"></i> ${item.produto || '-'}</div>
        <div class="historico-data">${formatarDataHora(item.dataFinalizacao || item.dataCotacao)}</div>
      </div>
      <div class="historico-detalhes">
        <div><strong>Fornecedor:</strong> ${item.fornecedor || '-'}</div>
        <div><strong>Qtd:</strong> ${item.quantidade || 0}</div>
        <div><strong>Valor Unit.:</strong> ${formatarMoeda(item.valorUnitario)}</div>
        <div><strong>Subtotal:</strong> ${formatarMoeda(total)}</div>
        <div><strong>ICMS:</strong> ${item.aliquotaICMS || 0}% (${formatarMoeda(item.valorICMS || 0)})</div>
        <div><strong>IPI:</strong> ${item.aliquotaIPI || 0}% (${formatarMoeda(item.valorIPI || 0)})</div>
        <div><strong>Frete:</strong> ${formatarMoeda(item.valorFrete || 0)}</div>
        <div><strong>Total c/ Impostos:</strong> ${formatarMoeda(totalComImpostos)}</div>
      </div>
    </div>`;
  }).join('');
}

function renderProdutos() {
  const container = document.getElementById('produtosContainer');
  const empty = document.getElementById('emptyProdutos');
  if (!container) return;

  if (produtos.length === 0) {
    container.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  container.innerHTML = produtos.map(p => `
    <div class="produto-card">
      <h3>${p.nome}</h3>
      <p><i class="fas fa-barcode"></i> Código: ${p.codigo || '-'}</p>
      <p><i class="fas fa-tag"></i> Categoria: ${p.categoria || '-'}</p>
      <p><i class="fas fa-ruler"></i> Unidade: ${p.unidadePadrao || 'un'}</p>
      <p><i class="fas fa-file-invoice"></i> NCM: ${p.ncm || '-'}</p>
      <div class="produto-actions">
        <button class="btn-icon btn-editar-produto" data-id="${p.id}"><i class="fas fa-edit"></i></button>
        <button class="btn-icon delete btn-excluir-produto" data-id="${p.id}"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

function renderFornecedores() {
  const container = document.getElementById('fornecedoresContainer');
  const empty = document.getElementById('emptyFornecedores');
  if (!container) return;

  if (fornecedores.length === 0) {
    container.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  container.innerHTML = fornecedores.map(f => `
    <div class="fornecedor-card">
      <h3>${f.nomeEmpresa}</h3>
      <p><i class="fas fa-id-card"></i> CNPJ: ${f.cnpj || '-'}</p>
      <p><i class="fas fa-id-card"></i> IE: ${f.ie || '-'}</p>
      <p><i class="fas fa-phone"></i> ${f.telefone || '-'}</p>
      <p><i class="fas fa-envelope"></i> ${f.email || '-'}</p>
      <p><i class="fas fa-map-marker-alt"></i> UF: ${f.uf || '-'}</p>
      <div class="fornecedor-actions">
        <button class="btn-icon btn-editar-fornecedor" data-id="${f.id}"><i class="fas fa-edit"></i></button>
        <button class="btn-icon delete btn-excluir-fornecedor" data-id="${f.id}"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

// ================== COMPARATIVO ==================
function compararSelecionados() {
  const selecionados = document.querySelectorAll('.select-cotacao:checked');

  console.log('📋 Selecionados:', selecionados.length);

  if (selecionados.length < 2) {
    alert('Selecione pelo menos 2 cotações para comparar');
    return;
  }

  const ids = Array.from(selecionados).map(cb => String(cb.value));

  console.log('📋 IDs selecionados:', ids);
  console.log('📋 Cotações disponíveis:', cotacoes.map(c => ({ id: String(c.id), produto: c.produto, status: c.status })));

  const itens = cotacoes.filter(c => ids.includes(String(c.id)) && c.status !== "finalizado");

  console.log('📋 Itens encontrados:', itens.length);

  if (itens.length < 2) {
    alert('Selecione pelo menos 2 cotações ativas');
    return;
  }

  const modal = document.getElementById('modalComparativo');
  const body = document.getElementById('comparativoBody');

  let html = `
    <div class="comparativo-container">
      <div class="resumo-cards">
        <div class="resumo-card total">
          <div class="resumo-icon total"><i class="fas fa-file-invoice"></i></div>
          <div>
            <div class="resumo-label">Cotações Comparadas</div>
            <div class="resumo-value">${itens.length}</div>
          </div>
        </div>
        <div class="resumo-card total">
          <div class="resumo-icon total"><i class="fas fa-boxes"></i></div>
          <div>
            <div class="resumo-label">Produtos</div>
            <div class="resumo-value">${new Set(itens.map(i => i.produto)).size}</div>
          </div>
        </div>
        <div class="resumo-card total">
          <div class="resumo-icon total"><i class="fas fa-truck"></i></div>
          <div>
            <div class="resumo-label">Fornecedores</div>
            <div class="resumo-value">${new Set(itens.map(i => i.fornecedor)).size}</div>
          </div>
        </div>
      </div>

      <div class="comparativo-tabela">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Produto</th>
              <th>Fornecedor</th>
              <th>UF</th>
              <th>Qtd</th>
              <th>Valor Unit.</th>
              <th>Subtotal</th>
              <th>ICMS</th>
              <th>IPI</th>
              <th>Frete</th>
              <th>Total c/ Imp.</th>
              <th>Entrega</th>
              <th>Finalizar</th>
            </tr>
          </thead>
          <tbody>
  `;

  let menorTotal = Infinity;
  let menorId = null;

  itens.forEach(item => {
    const total = (item.quantidade || 0) * (item.valorUnitario || 0);
    const totalComImpostos = total + (item.valorFrete || 0) + (item.valorIPI || 0) + (item.valorICMS || 0);
    if (totalComImpostos < menorTotal) {
      menorTotal = totalComImpostos;
      menorId = String(item.id);
    }
  });

  itens.forEach((item, idx) => {
    const total = (item.quantidade || 0) * (item.valorUnitario || 0);
    const totalComImpostos = total + (item.valorFrete || 0) + (item.valorIPI || 0) + (item.valorICMS || 0);
    const isMelhor = String(item.id) === String(menorId);

    html += `
      <tr class="${isMelhor ? 'melhor-preco' : ''}" data-id="${item.id}">
        <td>${idx + 1}</td>
        <td><strong>${item.produto || '-'}</strong></td>
        <td>${item.fornecedor || '-'}</td>
        <td>${item.uf || '-'}</td>
        <td>${item.quantidade || 0}</td>
        <td>${formatarMoeda(item.valorUnitario)}</td>
        <td>${formatarMoeda(total)}</td>
        <td>${item.aliquotaICMS || 0}%<br><small>${formatarMoeda(item.valorICMS || 0)}</small></td>
        <td>${item.aliquotaIPI || 0}%<br><small>${formatarMoeda(item.valorIPI || 0)}</small></td>
        <td>${formatarMoeda(item.valorFrete || 0)}</td>
        <td><strong>${formatarMoeda(totalComImpostos)}</strong> ${isMelhor ? '🏆' : ''}</td>
        <td>${item.dataEntrega ? formatarData(item.dataEntrega) : '-'}</td>
        <td>
          <input type="checkbox" class="finalizar-cotacao" value="${item.id}" ${isMelhor ? 'checked' : ''}>
        </td>
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>

      <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;">
        <button class="btn btn-success" onclick="gerarPDFComparativo()">
          <i class="fas fa-file-pdf"></i> Gerar PDF
        </button>
        <button class="btn btn-primary" onclick="finalizarCotacoesSelecionadas()">
          <i class="fas fa-check-circle"></i> Finalizar Selecionadas
        </button>
        <button class="btn btn-secondary" onclick="document.getElementById('modalComparativo').style.display='none'">
          <i class="fas fa-times"></i> Fechar
        </button>
      </div>
    </div>
  `;

  body.innerHTML = html;
  modal.style.display = 'block';
}

// ================== PDF DO COMPARATIVO ==================
function gerarPDFComparativo() {
  const loading = document.getElementById('pdfLoading');
  loading.style.display = 'flex';

  setTimeout(() => {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = 297;
      const margin = 15;
      let y = margin;

      doc.setFillColor(52, 152, 219);
      doc.rect(0, 0, pageWidth, 30, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('📊 Comparativo de Cotações', pageWidth / 2, 18, { align: 'center' });

      doc.setTextColor(50, 50, 50);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, margin, 38);

      y = 45;

      const table = document.querySelector('.comparativo-tabela table');
      if (table) {
        const rows = table.querySelectorAll('tbody tr');
        const headers = table.querySelectorAll('thead th');

        const colWidths = [8, 28, 25, 15, 15, 20, 22, 20, 20, 20, 28, 25, 15];
        let x = margin;

        doc.setFillColor(44, 62, 80);
        doc.rect(margin, y - 4, pageWidth - (margin * 2), 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');

        headers.forEach((th, i) => {
          if (i < colWidths.length && th.textContent.trim() !== 'Finalizar') {
            doc.text(th.textContent.trim(), x + 1, y + 3);
            x += colWidths[i];
          }
        });

        y += 8;
        doc.setTextColor(50, 50, 50);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);

        rows.forEach((row, rowIdx) => {
          const cells = row.querySelectorAll('td');
          x = margin;

          if (rowIdx % 2 === 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(margin, y - 3, pageWidth - (margin * 2), 6, 'F');
          }

          const isMelhor = row.classList.contains('melhor-preco');
          if (isMelhor) {
            doc.setFillColor(212, 237, 218);
            doc.rect(margin, y - 3, pageWidth - (margin * 2), 6, 'F');
          }

          cells.forEach((cell, i) => {
            if (i < colWidths.length && i !== 12) {
              const text = cell.textContent.trim().replace(/\s+/g, ' ');
              doc.setTextColor(isMelhor ? 0 : 50, isMelhor ? 100 : 50, isMelhor ? 0 : 50);
              doc.text(text, x + 1, y + 3);
              x += colWidths[i];
            }
          });

          y += 7;

          if (y > 190) {
            doc.addPage();
            y = margin + 10;
          }
        });
      }

      doc.setDrawColor(200, 200, 200);
      doc.line(margin, 190, pageWidth - margin, 190);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Mil Plásticos - Sistema de Cotações', margin, 197);
      doc.text(`Página ${doc.internal.getCurrentPageInfo().pageNumber}`, pageWidth - margin, 197, { align: 'right' });

      doc.save('comparativo_cotacoes.pdf');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
    }

    loading.style.display = 'none';
  }, 500);
}

// ================== FINALIZAR COTAÇÕES ==================
async function finalizarCotacoesSelecionadas() {
  const checkboxes = document.querySelectorAll('.finalizar-cotacao:checked');
  if (checkboxes.length === 0) {
    alert('Selecione pelo menos uma cotação para finalizar');
    return;
  }

  const ids = Array.from(checkboxes).map(cb => String(cb.value));
  const itensParaFinalizar = cotacoes.filter(c => ids.includes(String(c.id)));

  if (itensParaFinalizar.length === 0) {
    alert('Nenhuma cotação encontrada para finalizar');
    return;
  }

  const nomes = itensParaFinalizar.map(item => `${item.produto} - ${item.fornecedor}`).join('\n');

  if (confirm(`Deseja finalizar as seguintes cotações?\n\n${nomes}`)) {
    try {
      for (const item of itensParaFinalizar) {
        const { id, ...dados } = item;
        // Adiciona ao histórico
        await COL.historico.add({
          ...dados,
          status: 'finalizado',
          dataFinalizacao: new Date().toISOString(),
          finalizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        });
        // Remove da coleção de cotações ativas
        await COL.cotacoes.doc(id).delete();
      }
      document.getElementById('modalComparativo').style.display = 'none';
      toast(`${itensParaFinalizar.length} cotação(ões) finalizada(s) com sucesso!`);
    } catch (err) {
      console.error(err);
      toast('Erro ao finalizar cotações', 'error');
    }
  }
}

async function finalizarSelecionadosDireto() {
  const selecionados = document.querySelectorAll('.select-cotacao:checked');
  if (selecionados.length === 0) {
    alert('Selecione pelo menos uma cotação para finalizar');
    return;
  }

  const ids = Array.from(selecionados).map(cb => String(cb.value));
  const itensParaFinalizar = cotacoes.filter(c => ids.includes(String(c.id)) && c.status !== "finalizado");

  if (itensParaFinalizar.length === 0) {
    alert('Nenhuma cotação ativa selecionada');
    return;
  }

  const nomes = itensParaFinalizar.map(item => `${item.produto} - ${item.fornecedor}`).join('\n');

  if (confirm(`Deseja finalizar as seguintes cotações?\n\n${nomes}`)) {
    try {
      for (const item of itensParaFinalizar) {
        const { id, ...dados } = item;
        await COL.historico.add({
          ...dados,
          status: 'finalizado',
          dataFinalizacao: new Date().toISOString(),
          finalizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        });
        await COL.cotacoes.doc(id).delete();
      }
      toast(`${itensParaFinalizar.length} cotação(ões) finalizada(s) com sucesso!`);
    } catch (err) {
      console.error(err);
      toast('Erro ao finalizar cotações', 'error');
    }
  }
}

// ================== MODAIS ==================
function abrirModalCotacao(id = null) {
  editingId = id;
  const modal = document.getElementById('modalCotacao');
  const form = document.getElementById('formCotacao');
  form.reset();

  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('cotacaoData').value = hoje;

  if (id) {
    const cot = cotacoes.find(c => String(c.id) === String(id));
    if (cot) {
      document.getElementById('cotacaoProduto').value = cot.produto || '';
      document.getElementById('cotacaoFornecedor').value = cot.fornecedor || '';
      document.getElementById('cotacaoUF').value = cot.uf || '';
      document.getElementById('cotacaoQuantidade').value = cot.quantidade || '';
      document.getElementById('cotacaoValorUnitario').value = cot.valorUnitario || '';
      document.getElementById('cotacaoData').value = cot.dataCotacao || '';
      document.getElementById('cotacaoDataEntrega').value = cot.dataEntrega || '';
      document.getElementById('cotacaoObservacoes').value = cot.observacoes || '';
      document.getElementById('cotacaoAliquotaICMS').value = cot.aliquotaICMS || 18;
      document.getElementById('cotacaoAliquotaIPI').value = cot.aliquotaIPI || 5;
      document.getElementById('cotacaoValorFrete').value = cot.valorFrete || 0;
      document.getElementById('cotacaoPrazoPagamento').value = cot.prazoPagamento || '';
      document.getElementById('cotacaoCondicaoPagamento').value = cot.condicaoPagamento || '';
    }
  }

  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function fecharModalCotacao() {
  document.getElementById('modalCotacao').style.display = 'none';
  document.body.style.overflow = 'auto';
}

// ================== COTAÇÕES CRUD ==================
async function salvarCotacao(event) {
  if (event) event.preventDefault();

  const produto = document.getElementById('cotacaoProduto')?.value?.trim();
  if (!produto) { alert('Digite o nome do produto'); return; }

  const fornecedor = document.getElementById('cotacaoFornecedor')?.value?.trim();
  if (!fornecedor) { alert('Digite o nome do fornecedor'); return; }

  const qtd = parseFloat(document.getElementById('cotacaoQuantidade')?.value) || 0;
  if (qtd <= 0) { alert('Digite uma quantidade válida'); return; }

  const vu = parseFloat(document.getElementById('cotacaoValorUnitario')?.value) || 0;
  if (vu <= 0) { alert('Digite um valor unitário válido'); return; }

  const aliquotaICMS = parseFloat(document.getElementById('cotacaoAliquotaICMS')?.value) || 0;
  const aliquotaIPI = parseFloat(document.getElementById('cotacaoAliquotaIPI')?.value) || 0;
  const valorFrete = parseFloat(document.getElementById('cotacaoValorFrete')?.value) || 0;

  const subtotal = qtd * vu;
  const valorICMS = subtotal * (aliquotaICMS / 100);
  const valorIPI = subtotal * (aliquotaIPI / 100);

  const cotacaoData = {
    produto: produto,
    fornecedor: fornecedor,
    uf: document.getElementById('cotacaoUF')?.value || '',
    dataCotacao: document.getElementById('cotacaoData')?.value || '',
    quantidade: qtd,
    valorUnitario: vu,
    dataEntrega: document.getElementById('cotacaoDataEntrega')?.value || '',
    observacoes: document.getElementById('cotacaoObservacoes')?.value || '',
    aliquotaICMS: aliquotaICMS,
    valorICMS: valorICMS,
    aliquotaIPI: aliquotaIPI,
    valorIPI: valorIPI,
    valorFrete: valorFrete,
    prazoPagamento: document.getElementById('cotacaoPrazoPagamento')?.value || '',
    condicaoPagamento: document.getElementById('cotacaoCondicaoPagamento')?.value || '',
    status: "ativo",
  };

  console.log('💾 Salvando cotação:', cotacaoData);

  try {
    if (editingId) {
      await COL.cotacoes.doc(editingId).update({
        ...cotacaoData,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await COL.cotacoes.add({
        ...cotacaoData,
        dataCadastro: new Date().toISOString(),
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    fecharModalCotacao();
    toast('Cotação salva com sucesso!');
  } catch (err) {
    console.error(err);
    toast('Erro ao salvar cotação', 'error');
  }
}

// ================== PRODUTOS CRUD ==================
async function salvarProduto(event) {
  if (event) event.preventDefault();
  const nome = document.getElementById('produtoNome')?.value?.trim();
  if (!nome) { alert('Nome obrigatório'); return; }

  const prodData = {
    nome: nome,
    codigo: document.getElementById('produtoCodigo')?.value || '',
    categoria: document.getElementById('produtoCategoria')?.value || '',
    unidadePadrao: document.getElementById('produtoUnidade')?.value || 'un',
    ncm: document.getElementById('produtoNCM')?.value || '',
    descricao: document.getElementById('produtoDescricao')?.value || ''
  };

  try {
    if (editingProdutoId) {
      await COL.produtos.doc(editingProdutoId).update({
        ...prodData,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await COL.produtos.add({
        ...prodData,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    document.getElementById('modalProduto').style.display = 'none';
    toast('Produto salvo com sucesso!');
  } catch (err) {
    console.error(err);
    toast('Erro ao salvar produto', 'error');
  }
}

function editarProduto(id) {
  const prod = produtos.find(p => String(p.id) === String(id));
  if (!prod) return;

  editingProdutoId = id;
  document.getElementById('produtoNome').value = prod.nome || '';
  document.getElementById('produtoCodigo').value = prod.codigo || '';
  document.getElementById('produtoCategoria').value = prod.categoria || '';
  document.getElementById('produtoUnidade').value = prod.unidadePadrao || 'un';
  document.getElementById('produtoNCM').value = prod.ncm || '';
  document.getElementById('produtoDescricao').value = prod.descricao || '';
  document.getElementById('modalProduto').style.display = 'block';
}

// ================== FORNECEDORES CRUD ==================
async function salvarFornecedor(event) {
  if (event) event.preventDefault();
  const nome = document.getElementById('fornecedorNome')?.value?.trim();
  if (!nome) { alert('Nome obrigatório'); return; }

  const fornData = {
    nomeEmpresa: nome,
    cnpj: document.getElementById('fornecedorCNPJ')?.value || '',
    ie: document.getElementById('fornecedorIE')?.value || '',
    telefone: document.getElementById('fornecedorTelefone')?.value || '',
    email: document.getElementById('fornecedorEmail')?.value || '',
    uf: document.getElementById('fornecedorUF')?.value || ''
  };

  try {
    if (editingFornecedorId) {
      await COL.fornecedores.doc(editingFornecedorId).update({
        ...fornData,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await COL.fornecedores.add({
        ...fornData,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    document.getElementById('modalFornecedor').style.display = 'none';
    toast('Fornecedor salvo com sucesso!');
  } catch (err) {
    console.error(err);
    toast('Erro ao salvar fornecedor', 'error');
  }
}

function editarFornecedor(id) {
  const forn = fornecedores.find(f => String(f.id) === String(id));
  if (!forn) return;

  editingFornecedorId = id;
  document.getElementById('fornecedorNome').value = forn.nomeEmpresa || '';
  document.getElementById('fornecedorCNPJ').value = forn.cnpj || '';
  document.getElementById('fornecedorIE').value = forn.ie || '';
  document.getElementById('fornecedorTelefone').value = forn.telefone || '';
  document.getElementById('fornecedorEmail').value = forn.email || '';
  document.getElementById('fornecedorUF').value = forn.uf || '';
  document.getElementById('modalFornecedor').style.display = 'block';
}

// ================== LISTENERS FIRESTORE ==================
function iniciarListeners() {
  if (!COL) return;

  // Cotações ativas
  listenersAtivos.push(
    COL.cotacoes.onSnapshot(snap => {
      cotacoes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.dataCadastro || '').localeCompare(a.dataCadastro || ''));
      renderCotacoes();
    }, err => console.error('❌ cotacoes:', err))
  );

  // Histórico
  listenersAtivos.push(
    COL.historico.onSnapshot(snap => {
      historico = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.dataFinalizacao || '').localeCompare(a.dataFinalizacao || ''));
      renderHistorico();
    }, err => console.error('❌ historico:', err))
  );

  // Produtos
  listenersAtivos.push(
    COL.produtos.onSnapshot(snap => {
      produtos = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      renderProdutos();
    }, err => console.error('❌ produtos:', err))
  );

  // Fornecedores
  listenersAtivos.push(
    COL.fornecedores.onSnapshot(snap => {
      fornecedores = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.nomeEmpresa || '').localeCompare(b.nomeEmpresa || ''));
      renderFornecedores();
    }, err => console.error('❌ fornecedores:', err))
  );

  console.log('👂 Listeners Firestore ativos:', listenersAtivos.length);
}

// ================== INICIALIZAÇÃO ==================
async function init() {
  console.log('🚀 Inicializando sistema de cotações (Firebase)...');

  if (!COL) {
    console.error('❌ Firestore não disponível. Abortando init.');
    return;
  }

  // Migração única (se houver dados antigos no localStorage)
  await migrarLocalStorageParaFirestore();

  // Listeners em tempo real — os dados chegam automaticamente
  iniciarListeners();

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab + 'Tab';
      const tab = document.getElementById(tabId);
      if (tab) tab.classList.add('active');
    });
  });

  // Eventos dos botões principais
  document.getElementById('addCotacaoBtn')?.addEventListener('click', () => abrirModalCotacao());
  document.getElementById('addProdutoBtn')?.addEventListener('click', () => {
    editingProdutoId = null;
    document.getElementById('formProduto')?.reset();
    document.getElementById('modalProduto').style.display = 'block';
  });
  document.getElementById('addFornecedorBtn')?.addEventListener('click', () => {
    editingFornecedorId = null;
    document.getElementById('formFornecedor')?.reset();
    document.getElementById('modalFornecedor').style.display = 'block';
  });

  // Botões de ação
  document.getElementById('compararSelecionadosBtn')?.addEventListener('click', compararSelecionados);
  document.getElementById('finalizarSelecionadosBtn')?.addEventListener('click', finalizarSelecionadosDireto);

  // Forms
  document.getElementById('formCotacao')?.addEventListener('submit', salvarCotacao);
  document.getElementById('formProduto')?.addEventListener('submit', salvarProduto);
  document.getElementById('formFornecedor')?.addEventListener('submit', salvarFornecedor);

  // Eventos de clique para editar/excluir (delegação)
  document.addEventListener('click', async function(e) {
    const editCot = e.target.closest('.edit-cotacao');
    if (editCot) {
      abrirModalCotacao(editCot.dataset.id);
    }

    const viewCot = e.target.closest('.view-cotacao');
    if (viewCot) {
      const id = viewCot.dataset.id;
      const cot = cotacoes.find(c => String(c.id) === String(id));
      if (cot) {
        const total = (cot.quantidade || 0) * (cot.valorUnitario || 0);
        const totalComImpostos = total + (cot.valorFrete || 0) + (cot.valorIPI || 0) + (cot.valorICMS || 0);
        alert(
          `📋 DETALHES DA COTAÇÃO\n\n` +
          `Produto: ${cot.produto}\n` +
          `Fornecedor: ${cot.fornecedor}\n` +
          `UF: ${cot.uf || '-'}\n` +
          `Quantidade: ${cot.quantidade}\n` +
          `Valor Unitário: ${formatarMoeda(cot.valorUnitario)}\n` +
          `Subtotal: ${formatarMoeda(total)}\n` +
          `ICMS: ${cot.aliquotaICMS || 0}% (${formatarMoeda(cot.valorICMS || 0)})\n` +
          `IPI: ${cot.aliquotaIPI || 0}% (${formatarMoeda(cot.valorIPI || 0)})\n` +
          `Frete: ${formatarMoeda(cot.valorFrete || 0)}\n` +
          `TOTAL COM IMPOSTOS: ${formatarMoeda(totalComImpostos)}\n` +
          `Prazo Pagamento: ${cot.prazoPagamento || '-'}\n` +
          `Condição Pagamento: ${cot.condicaoPagamento || '-'}\n` +
          `Data Entrega: ${cot.dataEntrega ? formatarData(cot.dataEntrega) : '-'}\n` +
          `Status: ${cot.status || 'Ativo'}`
        );
      }
    }

    const delCot = e.target.closest('.delete-cotacao');
    if (delCot) {
      if (confirm('Excluir esta cotação permanentemente?')) {
        try {
          await COL.cotacoes.doc(delCot.dataset.id).delete();
          toast('Cotação excluída com sucesso!');
        } catch (err) {
          console.error(err);
          toast('Erro ao excluir cotação', 'error');
        }
      }
    }

    const editProd = e.target.closest('.btn-editar-produto');
    if (editProd) {
      editarProduto(editProd.dataset.id);
    }

    const delProd = e.target.closest('.btn-excluir-produto');
    if (delProd) {
      if (confirm('Excluir este produto?')) {
        try {
          await COL.produtos.doc(delProd.dataset.id).delete();
          toast('Produto excluído com sucesso!');
        } catch (err) {
          console.error(err);
          toast('Erro ao excluir produto', 'error');
        }
      }
    }

    const editForn = e.target.closest('.btn-editar-fornecedor');
    if (editForn) {
      editarFornecedor(editForn.dataset.id);
    }

    const delForn = e.target.closest('.btn-excluir-fornecedor');
    if (delForn) {
      if (confirm('Excluir este fornecedor?')) {
        try {
          await COL.fornecedores.doc(delForn.dataset.id).delete();
          toast('Fornecedor excluído com sucesso!');
        } catch (err) {
          console.error(err);
          toast('Erro ao excluir fornecedor', 'error');
        }
      }
    }
  });

  // Selecionar todos
  document.getElementById('selecionarTodos')?.addEventListener('change', function() {
    document.querySelectorAll('.select-cotacao').forEach(cb => cb.checked = this.checked);
  });

  // Filtros do histórico
  document.getElementById('filtroProduto')?.addEventListener('input', renderHistorico);
  document.getElementById('filtroFornecedor')?.addEventListener('input', renderHistorico);
  document.getElementById('filtroPeriodo')?.addEventListener('change', renderHistorico);

  // Limpar histórico
  document.getElementById('limparHistoricoBtn')?.addEventListener('click', async () => {
    if (confirm('Deseja realmente limpar TODO o histórico de compras?')) {
      try {
        const snap = await COL.historico.get();
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        toast('Histórico limpo com sucesso!');
      } catch (err) {
        console.error(err);
        toast('Erro ao limpar histórico', 'error');
      }
    }
  });

  console.log('✅ Sistema de cotações pronto (Firestore)!');
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', init);
