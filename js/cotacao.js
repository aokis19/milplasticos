// cotacao.js - Sistema de Cotações (VERSÃO FIREBASE + DASHBOARD + DADOS MANUAIS)
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
  manual:       db.collection('cot_manual'),
} : null;

// ================== DADOS GLOBAIS ==================
let produtos = [];
let cotacoes = [];
let historico = [];
let fornecedores = [];
let dadosManuais = [];
let editingId = null;
let editingFornecedorId = null;
let editingProdutoId = null;
let editingManualId = null;
let listenersAtivos = [];

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
    const produtosAntigos = JSON.parse(localStorage.getItem('produtos_cotacao') || '[]');
    for (const p of produtosAntigos) {
      const { id, ...dados } = p;
      await COL.produtos.add(dados);
    }

    const fornecedoresAntigos = JSON.parse(localStorage.getItem('fornecedores') || '[]');
    for (const f of fornecedoresAntigos) {
      const { id, ...dados } = f;
      await COL.fornecedores.add(dados);
    }

    const cotacoesAntigas = JSON.parse(localStorage.getItem('cotacoes') || '[]');
    for (const c of cotacoesAntigas) {
      const { id, ...dados } = c;
      await COL.cotacoes.add(dados);
    }

    const historicoAntigo = JSON.parse(localStorage.getItem('historico_cotacao') || '[]');
    for (const h of historicoAntigo) {
      const { id, ...dados } = h;
      await COL.historico.add(dados);
    }

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
        await COL.historico.add({
          ...dados,
          status: 'finalizado',
          dataFinalizacao: new Date().toISOString(),
          finalizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        });
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

  listenersAtivos.push(
    COL.cotacoes.onSnapshot(snap => {
      cotacoes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.dataCadastro || '').localeCompare(a.dataCadastro || ''));
      renderCotacoes();
    }, err => console.error('❌ cotacoes:', err))
  );

  listenersAtivos.push(
    COL.historico.onSnapshot(snap => {
      historico = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.dataFinalizacao || '').localeCompare(a.dataFinalizacao || ''));
      renderHistorico();
      if (document.getElementById('dashboardTab')?.classList.contains('active')) {
        if (typeof initDashboard === 'function') initDashboard();
      }
    }, err => console.error('❌ historico:', err))
  );

  listenersAtivos.push(
    COL.produtos.onSnapshot(snap => {
      produtos = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      renderProdutos();
    }, err => console.error('❌ produtos:', err))
  );

  listenersAtivos.push(
    COL.fornecedores.onSnapshot(snap => {
      fornecedores = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.nomeEmpresa || '').localeCompare(b.nomeEmpresa || ''));
      renderFornecedores();
    }, err => console.error('❌ fornecedores:', err))
  );

  listenersAtivos.push(
    COL.manual.onSnapshot(snap => {
      dadosManuais = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.mes || '').localeCompare(a.mes || ''));
      renderManualLista();
      if (document.getElementById('dashboardTab')?.classList.contains('active')) {
        if (typeof initDashboard === 'function') initDashboard();
      }
    }, err => console.error('❌ manual:', err))
  );

  console.log('👂 Listeners Firestore ativos:', listenersAtivos.length);
}

// ================== MODO TELA CHEIA DO DASHBOARD ==================
function entrarFullscreenDashboard() {
  document.body.classList.add('dashboard-fullscreen');
  setTimeout(() => {
    Object.values(chartInstances).forEach(c => { try { c.resize(); } catch(e){} });
  }, 100);
}

function sairFullscreenDashboard() {
  document.body.classList.remove('dashboard-fullscreen');
  setTimeout(() => {
    Object.values(chartInstances).forEach(c => { try { c.resize(); } catch(e){} });
  }, 100);
}

// ================== INICIALIZAÇÃO ==================
async function init() {
  console.log('🚀 Inicializando sistema de cotações (Firebase + Dashboard + Manuais)...');

  if (!COL) {
    console.error('❌ Firestore não disponível. Abortando init.');
    return;
  }

  await migrarLocalStorageParaFirestore();
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

      if (btn.dataset.tab === 'dashboard') {
        entrarFullscreenDashboard();
        setTimeout(() => {
          if (typeof initDashboard === 'function') initDashboard();
        }, 50);
      } else {
        sairFullscreenDashboard();
      }
    });
  });

  // Botão flutuante de sair do fullscreen
  document.getElementById('btnSairFullscreen')?.addEventListener('click', () => {
    sairFullscreenDashboard();
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const firstBtn = document.querySelector('.tab-btn[data-tab="cotacoes"]');
    if (firstBtn) firstBtn.classList.add('active');
    document.getElementById('cotacoesTab')?.classList.add('active');
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
  document.getElementById('formManual')?.addEventListener('submit', salvarManual);

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

  // Limpar todos os manuais
  document.getElementById('limparManualBtn')?.addEventListener('click', async () => {
    if (confirm('Excluir TODOS os registros manuais? Esta ação não afeta as cotações reais.')) {
      try {
        const snap = await COL.manual.get();
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        toast('Registros manuais excluídos!');
      } catch (err) {
        console.error(err);
        toast('Erro ao limpar registros manuais', 'error');
      }
    }
  });

  // Atalho ESC para sair do modo tela cheia
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('dashboard-fullscreen')) {
      sairFullscreenDashboard();
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      const firstBtn = document.querySelector('.tab-btn[data-tab="cotacoes"]');
      if (firstBtn) firstBtn.classList.add('active');
      document.getElementById('cotacoesTab')?.classList.add('active');
    }
  });

  console.log('✅ Sistema de cotações pronto (Firestore + Dashboard + Manuais)!');
}

// =====================================================
// ============== DASHBOARD DE COMPRAS =================
// =====================================================
let chartInstances = {};

// Estado do dashboard (filtro dinâmico + modo R$/%)
const dashState = {
  filtroFornecedor: null,      // nome do fornecedor clicado (ou null)
  filtroProduto: null,         // nome do produto clicado (ou null)
  modoFornecedores: 'valor',   // 'valor' | 'pct'
  modoProdutos: 'valor',       // 'valor' | 'pct'
};

function destroyCharts() {
  Object.values(chartInstances).forEach(c => { try { c.destroy(); } catch(e){} });
  chartInstances = {};
}

function getPeriodoDias() {
  const v = document.getElementById('dashPeriodo')?.value || '90';
  return v === 'all' ? 99999 : parseInt(v);
}

function filtrarPorPeriodo(lista, campoData = 'dataFinalizacao') {
  const dias = getPeriodoDias();
  if (dias >= 99999) return lista;
  const limite = new Date();
  limite.setDate(limite.getDate() - dias);
  return lista.filter(i => {
    const d = new Date(i[campoData] || i.dataCotacao || i.dataCadastro);
    return d >= limite;
  });
}

// ---------- CÁLCULOS ----------
function calcularKPIs() {
  const histReal = filtrarPorPeriodo([...historico]);
  const manualFiltrado = filtrarPorPeriodo([...dadosManuais]);

  // Combina histórico real + dados manuais
  let hist = [...histReal, ...manualFiltrado];

  // Aplica filtros dinâmicos (fornecedor + produto)
  if (dashState.filtroFornecedor) {
    hist = hist.filter(i => (i.fornecedor || 'N/A') === dashState.filtroFornecedor);
  }
  if (dashState.filtroProduto) {
    hist = hist.filter(i => (i.produto || 'N/A') === dashState.filtroProduto);
  }

  const cots = filtrarPorPeriodo([...cotacoes], 'dataCadastro');

  const totalCotacoes = cots.length + hist.length;
  const pedidosGerados = hist.length;

  const pedidosExecutados = hist.filter(i =>
    i.origem === 'manual' ? i.status === 'executado' : true
  ).length;

  const valorTotal = hist.reduce((s, i) => {
    const sub = (i.quantidade || 0) * (i.valorUnitario || 0);
    return s + sub + (i.valorFrete || 0) + (i.valorIPI || 0) + (i.valorICMS || 0);
  }, 0);

  const ticketMedio = pedidosGerados > 0 ? valorTotal / pedidosGerados : 0;
  const taxaConversao = totalCotacoes > 0 ? (pedidosGerados / totalCotacoes) * 100 : 0;

  // Tempo médio (mantido internamente para uso no PDF, se precisar)
  let somaDias = 0, countDias = 0;
  hist.forEach(i => {
    if (i.origem === 'manual' && i.diasCompra !== undefined) {
      somaDias += parseInt(i.diasCompra) || 0;
      countDias++;
      return;
    }
    if (i.dataCotacao && i.dataFinalizacao) {
      const d1 = new Date(i.dataCotacao);
      const d2 = new Date(i.dataFinalizacao);
      const dias = Math.max(0, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
      somaDias += dias; countDias++;
    }
  });
  const tempoMedio = countDias > 0 ? (somaDias / countDias).toFixed(1) : 0;

  // Economia (mantido internamente para uso no PDF, se precisar)
  const porProduto = {};
  hist.forEach(i => {
    const k = (i.produto || '').toLowerCase();
    if (!porProduto[k]) porProduto[k] = [];
    const sub = (i.quantidade || 0) * (i.valorUnitario || 0);
    porProduto[k].push(sub + (i.valorFrete || 0) + (i.valorIPI || 0) + (i.valorICMS || 0));
  });
  let economia = 0;
  Object.values(porProduto).forEach(vals => {
    if (vals.length > 1) {
      const melhor = Math.min(...vals);
      const media = vals.reduce((a,b)=>a+b,0) / vals.length;
      economia += (media - melhor);
    }
  });

  return { totalCotacoes, pedidosGerados, pedidosExecutados, valorTotal, ticketMedio, taxaConversao, tempoMedio, economia };
}

// ---------- RENDER KPI CARDS (sem Economia e sem Tempo Médio) ----------
function renderKPIs() {
  const k = calcularKPIs();
  const fmt = v => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(v||0);

  const cards = [
    { label:'Total de Cotações',    value: k.totalCotacoes,                icon:'fa-file-invoice',  cor:'blue' },
    { label:'Pedidos Gerados',      value: k.pedidosGerados,               icon:'fa-shopping-cart', cor:'green' },
    { label:'Pedidos Executados',   value: k.pedidosExecutados,            icon:'fa-check-double',  cor:'success' },
    { label:'Valor Total Comprado', value: fmt(k.valorTotal),              icon:'fa-dollar-sign',   cor:'orange' },
    { label:'Ticket Médio',         value: fmt(k.ticketMedio),             icon:'fa-receipt',       cor:'purple' },
    { label:'Taxa de Conversão',    value: k.taxaConversao.toFixed(1)+'%', icon:'fa-percentage',    cor:'green' },
  ];

  const grid = document.getElementById('kpiGrid');
  if (!grid) return;

  grid.innerHTML = cards.map(c => `
    <div class="kpi-card ${c.cor}">
      <div class="kpi-icon ${c.cor}"><i class="fas ${c.icon}"></i></div>
      <div class="kpi-info">
        <div class="kpi-value">${c.value}</div>
        <div class="kpi-label">${c.label}</div>
      </div>
    </div>
  `).join('');
}

// ---------- GRÁFICOS ----------
function renderGraficos() {
  destroyCharts();

  const histReal = filtrarPorPeriodo([...historico]);
  const manualFiltrado = filtrarPorPeriodo([...dadosManuais]);

  // Combina tudo
  let hist = [...histReal, ...manualFiltrado];

  // Aplica filtros dinâmicos (fornecedor + produto)
  if (dashState.filtroFornecedor) {
    hist = hist.filter(i => (i.fornecedor || 'N/A') === dashState.filtroFornecedor);
  }
  if (dashState.filtroProduto) {
    hist = hist.filter(i => (i.produto || 'N/A') === dashState.filtroProduto);
  }

  const fmt = v => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(v||0);

  /* ---------- 1) Evolução mensal ---------- */
  const porMes = {};
  hist.forEach(i => {
    const d = new Date(i.dataFinalizacao || i.dataCotacao);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const sub = (i.quantidade||0)*(i.valorUnitario||0) + (i.valorFrete||0)+(i.valorIPI||0)+(i.valorICMS||0);
    porMes[key] = (porMes[key]||0) + sub;
  });
  const meses = Object.keys(porMes).sort();

  const elEvolucao = document.getElementById('chartEvolucao');
  if (elEvolucao) {
    chartInstances.evolucao = new Chart(elEvolucao, {
      type:'line',
      data:{
        labels: meses.map(m => { const [a,b]=m.split('-'); return `${b}/${a}`; }),
        datasets:[{
          label:'Valor Comprado (R$)',
          data: meses.map(m => porMes[m]),
          borderColor:'#3498db', backgroundColor:'rgba(52,152,219,0.15)',
          fill:true, tension:0.35, pointRadius:4, pointBackgroundColor:'#3498db'
        }]
      },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} } }
    });
  }

  /* ---------- 2) Top 5 Fornecedores (CLICÁVEL + toggle R$ / %) ---------- */
  const porForn = {};
  hist.forEach(i => {
    const sub = (i.quantidade||0)*(i.valorUnitario||0)+(i.valorFrete||0)+(i.valorIPI||0)+(i.valorICMS||0);
    porForn[i.fornecedor||'N/A'] = (porForn[i.fornecedor||'N/A']||0)+sub;
  });
  const topForn = Object.entries(porForn).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const totalForn = topForn.reduce((s,f)=>s+f[1],0);

  const elForn = document.getElementById('chartFornecedores');
  if (elForn) {
    const isPct = dashState.modoFornecedores === 'pct';
    const dadosForn = isPct
      ? topForn.map(f => totalForn > 0 ? +((f[1]/totalForn)*100).toFixed(2) : 0)
      : topForn.map(f => f[1]);

    const labelsLegenda = topForn.map((f, i) => {
      if (!isPct) return f[0];
      return `${f[0]} — ${dadosForn[i].toFixed(1).replace('.', ',')}%`;
    });

    chartInstances.fornecedores = new Chart(elForn, {
      type:'doughnut',
      data:{
        labels: labelsLegenda,
        datasets:[{
          data: dadosForn,
          backgroundColor:['#3498db','#27ae60','#f39c12','#9b59b6','#e74c3c'],
          borderWidth: 2,
          borderColor: '#fff',
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        onClick: (evt, elements) => {
          if (!elements.length) return;
          const idx = elements[0].index;
          const fornecedor = topForn[idx][0];

          if (dashState.filtroFornecedor === fornecedor) {
            limparFiltroFornecedor();
          } else {
            dashState.filtroFornecedor = fornecedor;
            atualizarChipFiltroFornecedor();
            renderKPIs();
            renderGraficos();
            toast(`Filtrando por: ${fornecedor}`);
          }
        },
        onHover: (evt, elements) => {
          evt.native.target.style.cursor = elements.length ? 'pointer' : 'default';
        },
        plugins:{
          legend:{ position:'right', labels:{ font:{size:11} } },
          tooltip:{
            callbacks:{
              label: c => {
                const val = c.raw;
                const total = dadosForn.reduce((a,b)=>a+b,0);
                const pct = total > 0 ? ((val/total)*100).toFixed(1).replace('.', ',') : '0';
                return isPct
                  ? `${topForn[c.dataIndex][0]}: ${pct}%`
                  : `${topForn[c.dataIndex][0]}: ${fmt(val)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  /* ---------- 3) Top 10 Insumos (CLICÁVEL + toggle R$ / %) ---------- */
  const porProd = {};
  hist.forEach(i => {
    const sub = (i.quantidade||0)*(i.valorUnitario||0)+(i.valorFrete||0)+(i.valorIPI||0)+(i.valorICMS||0);
    porProd[i.produto||'N/A'] = (porProd[i.produto||'N/A']||0)+sub;
  });
  const topProd = Object.entries(porProd).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const totalProd = topProd.reduce((s,p)=>s+p[1],0);

  const elProd = document.getElementById('chartProdutos');
  if (elProd) {
    const isPct = dashState.modoProdutos === 'pct';
    const dadosProd = isPct
      ? topProd.map(p => totalProd > 0 ? +((p[1]/totalProd)*100).toFixed(2) : 0)
      : topProd.map(p => p[1]);

    // Plugin que desenha o valor/percentual no final de cada barra
    const pluginValorBarra = {
      id: 'pluginValorBarra',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
        ctx.save();
        ctx.font = 'bold 11px Segoe UI, sans-serif';
        ctx.fillStyle = '#2c3e50';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        meta.data.forEach((bar, i) => {
          const valor = chart.data.datasets[0].data[i];
          const txt = isPct
            ? `${valor.toFixed(1).replace('.', ',')}%`
            : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(valor);
          ctx.fillText(txt, bar.x + 6, bar.y);
        });
        ctx.restore();
      }
    };

    // Cores: destacar o produto selecionado
    const coresBarras = topProd.map(p => {
      const nomeProd = p[0];
      if (dashState.filtroProduto === nomeProd) return '#f39c12'; // laranja = selecionado
      return '#27ae60';
    });

    chartInstances.produtos = new Chart(elProd, {
      type:'bar',
      data:{
        labels: topProd.map(p=>p[0].length>25?p[0].slice(0,25)+'…':p[0]),
        datasets:[{
          label: isPct ? 'Participação (%)' : 'Valor (R$)',
          data: dadosProd,
          backgroundColor: coresBarras,
          borderRadius:6
        }]
      },
      options:{
        indexAxis:'y',
        responsive:true,
        maintainAspectRatio:false,
        layout: { padding: { right: 60 } },
        onClick: (evt, elements) => {
          if (!elements.length) return;
          const idx = elements[0].index;
          const produto = topProd[idx][0];

          if (dashState.filtroProduto === produto) {
            limparFiltroProduto();
          } else {
            dashState.filtroProduto = produto;
            atualizarChipFiltroProduto();
            renderKPIs();
            renderGraficos();
            toast(`Filtrando por insumo: ${produto}`);
          }
        },
        onHover: (evt, elements) => {
          evt.native.target.style.cursor = elements.length ? 'pointer' : 'default';
        },
        plugins:{
          legend:{display:false},
          tooltip:{
            callbacks:{
              label: c => {
                const val = c.raw;
                const pct = totalProd > 0 ? ((topProd[c.dataIndex][1]/totalProd)*100).toFixed(1).replace('.', ',') : '0';
                return isPct
                  ? `${pct}%`
                  : `${fmt(val)} (${pct}%)`;
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero:true,
            ticks: isPct
              ? { callback: v => v + '%' }
              : { callback: v => new Intl.NumberFormat('pt-BR',{notation:'compact'}).format(v) }
          }
        }
      },
      plugins: [pluginValorBarra]
    });
  }

  /* ---------- 4) Meta vs. Realizado ---------- */
  const elMeta = document.getElementById('chartMeta');
  if (elMeta && meses.length > 0) {
    const ultimo = porMes[meses[meses.length-1]];
    const meta = ultimo * 0.90;
    chartInstances.meta = new Chart(elMeta, {
      type:'bar',
      data:{
        labels:['Mês Atual','Meta Próximo Mês'],
        datasets:[{ data:[ultimo, meta],
          backgroundColor:['#3498db','#27ae60'], borderRadius:8 }]
      },
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false},
          tooltip:{ callbacks:{ label: c => fmt(c.raw) } } } }
    });
  }
}

// ---------- Filtro de fornecedor (chip visual) ----------
function atualizarChipFiltroFornecedor() {
  const box = document.getElementById('filtroAtivoFornecedor');
  const nome = document.getElementById('filtroAtivoFornecedorNome');
  if (!box || !nome) return;
  if (dashState.filtroFornecedor) {
    nome.textContent = dashState.filtroFornecedor;
    box.style.display = 'flex';
  } else {
    box.style.display = 'none';
  }
}

function limparFiltroFornecedor() {
  dashState.filtroFornecedor = null;
  atualizarChipFiltroFornecedor();
  renderKPIs();
  renderGraficos();
  toast('Filtro de fornecedor removido');
}

/* ---------- Filtro de produto (chip visual) ---------- */
function atualizarChipFiltroProduto() {
  const box = document.getElementById('filtroAtivoProduto');
  const nome = document.getElementById('filtroAtivoProdutoNome');
  if (!box || !nome) return;
  if (dashState.filtroProduto) {
    nome.textContent = dashState.filtroProduto;
    box.style.display = 'flex';
  } else {
    box.style.display = 'none';
  }
}

function limparFiltroProduto() {
  dashState.filtroProduto = null;
  atualizarChipFiltroProduto();
  renderKPIs();
  renderGraficos();
  toast('Filtro de insumo removido');
}

/* ---------- Bind dos toggles R$ / % ---------- */
function bindTogglesModo() {
  document.querySelectorAll('.chart-toggle-mode').forEach(box => {
    if (box.dataset.bound) return;
    box.dataset.bound = '1';

    const target = box.dataset.target; // 'fornecedores' | 'produtos'
    box.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        box.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode;
        if (target === 'fornecedores') dashState.modoFornecedores = mode;
        if (target === 'produtos')     dashState.modoProdutos = mode;
        renderGraficos();
      });
    });
  });
}

// ---------- PDF RESUMO EXECUTIVO ----------
function gerarPDFDashboard() {
  const loading = document.getElementById('pdfLoading');
  if (loading) loading.style.display = 'flex';

  setTimeout(() => {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('portrait','mm','a4');
      const W = 210, M = 15;
      const k = calcularKPIs();
      const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);

      doc.setFillColor(52,152,219);
      doc.rect(0,0,W,28,'F');
      doc.setTextColor(255,255,255);
      doc.setFontSize(18); doc.setFont('helvetica','bold');
      doc.text('Relatorio Executivo de Compras', W/2, 14, {align:'center'});
      doc.setFontSize(9); doc.setFont('helvetica','normal');
      doc.text('Mil Plasticos - Central de Cotacoes', W/2, 21, {align:'center'});

      doc.setTextColor(80,80,80);
      doc.setFontSize(9);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, M, 36);

      // Informa filtros ativos
      let yFiltros = 41;
      if (dashState.filtroFornecedor || dashState.filtroProduto) {
        doc.setTextColor(52,152,219);
        doc.setFont('helvetica','bold');
        if (dashState.filtroFornecedor) {
          doc.text(`Filtro fornecedor: ${dashState.filtroFornecedor}`, M, yFiltros);
          yFiltros += 5;
        }
        if (dashState.filtroProduto) {
          doc.text(`Filtro insumo: ${dashState.filtroProduto}`, M, yFiltros);
          yFiltros += 5;
        }
        doc.setFont('helvetica','normal');
      }

      const linhas = [
        ['Total de Cotacoes', String(k.totalCotacoes)],
        ['Pedidos Gerados', String(k.pedidosGerados)],
        ['Pedidos Executados', String(k.pedidosExecutados)],
        ['Valor Total Comprado', fmt(k.valorTotal)],
        ['Ticket Medio', fmt(k.ticketMedio)],
        ['Taxa de Conversao', k.taxaConversao.toFixed(1)+'%'],
      ];

      doc.autoTable({
        startY: yFiltros + 1,
        head: [['Indicador','Valor']],
        body: linhas,
        theme:'striped',
        headStyles:{ fillColor:[44,62,80], textColor:255, fontStyle:'bold' },
        styles:{ fontSize:10, cellPadding:3 },
        columnStyles:{ 0:{fontStyle:'bold', cellWidth:100}, 1:{halign:'right'} }
      });

      const yMeta = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.setTextColor(44,62,80);
      doc.text('Meta para o Proximo Mes', M, yMeta);

      const meta = k.valorTotal * 0.90;
      doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60);
      doc.text(`- Reduzir custo em 10% -> Meta: ${fmt(meta)}`, M+3, yMeta+7);
      doc.text(`- Economia potencial: ${fmt(k.valorTotal - meta)}`, M+3, yMeta+13);
      doc.text(`- Foco: negociacao com Top 5 fornecedores`, M+3, yMeta+19);

      doc.setDrawColor(200); doc.line(M, 280, W-M, 280);
      doc.setFontSize(8); doc.setTextColor(150);
      doc.text('Mil Plasticos - Sistema de Cotacoes', M, 286);
      doc.text(`Pagina ${doc.internal.getCurrentPageInfo().pageNumber}`, W-M, 286, {align:'right'});

      doc.save('relatorio_compras.pdf');
    } catch(e) {
      console.error(e);
      alert('Erro ao gerar PDF');
    }
    if (loading) loading.style.display = 'none';
  }, 400);
}

// ---------- INIT DASHBOARD ----------
function initDashboard() {
  renderKPIs();
  renderGraficos();
  bindTogglesModo();
  atualizarChipFiltroFornecedor();
  atualizarChipFiltroProduto();

  const periodoEl = document.getElementById('dashPeriodo');
  const atualizarEl = document.getElementById('dashAtualizarBtn');
  const pdfEl = document.getElementById('dashPdfBtn');
  const manualEl = document.getElementById('dashManualBtn');
  const limparFiltroEl = document.getElementById('limparFiltroFornecedor');
  const limparFiltroProdEl = document.getElementById('limparFiltroProduto');

  if (periodoEl && !periodoEl.dataset.bound) {
    periodoEl.addEventListener('change', () => {
      renderKPIs(); renderGraficos();
    });
    periodoEl.dataset.bound = '1';
  }
  if (atualizarEl && !atualizarEl.dataset.bound) {
    atualizarEl.addEventListener('click', () => {
      renderKPIs(); renderGraficos();
      toast('Dashboard atualizado!');
    });
    atualizarEl.dataset.bound = '1';
  }
  if (pdfEl && !pdfEl.dataset.bound) {
    pdfEl.addEventListener('click', gerarPDFDashboard);
    pdfEl.dataset.bound = '1';
  }
  if (manualEl && !manualEl.dataset.bound) {
    manualEl.addEventListener('click', abrirModalManual);
    manualEl.dataset.bound = '1';
  }
  if (limparFiltroEl && !limparFiltroEl.dataset.bound) {
    limparFiltroEl.addEventListener('click', limparFiltroFornecedor);
    limparFiltroEl.dataset.bound = '1';
  }
  if (limparFiltroProdEl && !limparFiltroProdEl.dataset.bound) {
    limparFiltroProdEl.addEventListener('click', limparFiltroProduto);
    limparFiltroProdEl.dataset.bound = '1';
  }
}

// =====================================================
// ========= DADOS MANUAIS (HISTÓRICO RETROATIVO) ======
// =====================================================

function abrirModalManual() {
  editingManualId = null;
  const form = document.getElementById('formManual');
  if (form) form.reset();

  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
  const mesEl = document.getElementById('manualMes');
  if (mesEl) mesEl.value = mesAtual;

  document.getElementById('modalManual').style.display = 'block';
  renderManualLista();
}

function fecharModalManual() {
  document.getElementById('modalManual').style.display = 'none';
}

async function salvarManual(event) {
  if (event) event.preventDefault();

  const mes = document.getElementById('manualMes')?.value;
  if (!mes) { alert('Informe o mês de referência'); return; }

  const fornecedor = document.getElementById('manualFornecedor')?.value?.trim();
  if (!fornecedor) { alert('Informe o fornecedor'); return; }

  const produto = document.getElementById('manualProduto')?.value?.trim();
  if (!produto) { alert('Informe o produto'); return; }

  const quantidade = parseFloat(document.getElementById('manualQuantidade')?.value) || 0;
  const valorUnitario = parseFloat(document.getElementById('manualValorUnitario')?.value) || 0;
  const frete = parseFloat(document.getElementById('manualFrete')?.value) || 0;
  const icms = parseFloat(document.getElementById('manualICMS')?.value) || 0;
  const ipi = parseFloat(document.getElementById('manualIPI')?.value) || 0;
  const dias = parseInt(document.getElementById('manualDias')?.value) || 0;
  const status = document.getElementById('manualStatus')?.value || 'executado';

  const subtotal = quantidade * valorUnitario;
  const valorICMS = subtotal * (icms / 100);
  const valorIPI = subtotal * (ipi / 100);

  const [ano, m] = mes.split('-');
  const ultimoDia = new Date(parseInt(ano), parseInt(m), 0).getDate();
  const dataFinalizacao = `${mes}-${String(ultimoDia).padStart(2,'0')}T12:00:00.000Z`;
  const dataCotacao = new Date(new Date(dataFinalizacao).getTime() - dias * 86400000).toISOString().split('T')[0];

  const dados = {
    mes: mes,
    fornecedor: fornecedor,
    produto: produto,
    quantidade: quantidade,
    valorUnitario: valorUnitario,
    valorFrete: frete,
    aliquotaICMS: icms,
    valorICMS: valorICMS,
    aliquotaIPI: ipi,
    valorIPI: valorIPI,
    diasCompra: dias,
    status: status,
    dataCotacao: dataCotacao,
    dataFinalizacao: dataFinalizacao,
    origem: 'manual',
  };

  try {
    if (editingManualId) {
      await COL.manual.doc(editingManualId).update({
        ...dados,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
      toast('Registro manual atualizado!');
    } else {
      await COL.manual.add({
        ...dados,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
      toast('Registro manual salvo!');
    }
    document.getElementById('formManual').reset();
    const hoje = new Date();
    document.getElementById('manualMes').value = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
    editingManualId = null;
  } catch (err) {
    console.error(err);
    toast('Erro ao salvar registro manual', 'error');
  }
}

function renderManualLista() {
  const container = document.getElementById('manualLista');
  const countEl = document.getElementById('manualCount');
  if (!container) return;

  if (countEl) countEl.textContent = dadosManuais.length;

  if (dadosManuais.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#999;font-size:12px;padding:15px;">Nenhum registro manual cadastrado ainda.</p>';
    return;
  }

  const fmt = v => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(v||0);

  container.innerHTML = dadosManuais.map(m => {
    const subtotal = (m.quantidade||0) * (m.valorUnitario||0);
    const total = subtotal + (m.valorFrete||0) + (m.valorIPI||0) + (m.valorICMS||0);
    const [ano, mes] = (m.mes || '').split('-');
    const mesLabel = `${mes}/${ano}`;
    const statusLabel = m.status === 'executado' ? '✅ Executado' : '📋 Gerado';

    return `<div style="background:#f8f9fa;border-radius:8px;padding:10px 12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:12px;">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;color:#2c3e50;">${m.produto} <span style="color:#999;font-weight:400;">• ${mesLabel}</span></div>
        <div style="color:#666;font-size:11px;margin-top:2px;">
          ${m.fornecedor} • ${m.quantidade} un × ${fmt(m.valorUnitario)} = <strong>${fmt(total)}</strong> • ${statusLabel}
        </div>
      </div>
      <div style="display:flex;gap:4px;">
        <button class="btn-icon" onclick="editarManual('${m.id}')" title="Editar"><i class="fas fa-edit"></i></button>
        <button class="btn-icon delete" onclick="excluirManual('${m.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

function editarManual(id) {
  const m = dadosManuais.find(x => String(x.id) === String(id));
  if (!m) return;

  editingManualId = id;
  document.getElementById('manualMes').value = m.mes || '';
  document.getElementById('manualFornecedor').value = m.fornecedor || '';
  document.getElementById('manualProduto').value = m.produto || '';
  document.getElementById('manualQuantidade').value = m.quantidade || '';
  document.getElementById('manualValorUnitario').value = m.valorUnitario || '';
  document.getElementById('manualFrete').value = m.valorFrete || 0;
  document.getElementById('manualICMS').value = m.aliquotaICMS || 18;
  document.getElementById('manualIPI').value = m.aliquotaIPI || 5;
  document.getElementById('manualDias').value = m.diasCompra || 0;
  document.getElementById('manualStatus').value = m.status || 'executado';

  document.getElementById('modalManual').style.display = 'block';
}

async function excluirManual(id) {
  if (!confirm('Excluir este registro manual?')) return;
  try {
    await COL.manual.doc(id).delete();
    toast('Registro excluído!');
  } catch (err) {
    console.error(err);
    toast('Erro ao excluir', 'error');
  }
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', init);
