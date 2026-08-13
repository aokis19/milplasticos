/* ============================================================
   ESTOQUE - ESTILOS ESPECÍFICOS
   ============================================================ */

/* ========== CONTAINER ========== */
.estoque-container {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

/* ========== HEADER ========== */
.header-estoque {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 0;
  border-bottom: 2px solid var(--border, #e0e4ea);
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 15px;
}

.header-estoque h1 {
  font-size: 28px;
  font-weight: 700;
  color: #1a2a3a;
}

.header-estoque h1 i {
  color: #f1c40f;
  margin-right: 12px;
}

/* ========== BREADCRUMB ========== */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #888;
  margin-bottom: 20px;
  padding: 8px 0;
}

.breadcrumb .active {
  color: #1a2a3a;
  font-weight: 600;
}

.breadcrumb i {
  font-size: 12px;
}

/* ========== RESUMO ========== */
.estoque-resumo {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.resumo-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: 0.2s;
}

.resumo-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.resumo-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.resumo-info {
  flex: 1;
}

.resumo-label {
  display: block;
  font-size: 12px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.resumo-valor {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: #1a2a3a;
}

/* ========== TABS ========== */
.tabs-estoque {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  border-bottom: 2px solid #eef2f7;
  padding-bottom: 4px;
}

.tab-estoque {
  padding: 10px 24px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  transition: 0.2s;
  color: #888;
  border-radius: 8px 8px 0 0;
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-estoque:hover {
  color: #1a2a3a;
  background: #f5f7fa;
}

.tab-estoque.active {
  color: #1a2a3a;
  background: #fff;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
}

.tab-estoque .badge {
  background: #eef2f7;
  color: #555;
  padding: 1px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  transition: 0.2s;
}

.tab-estoque.active .badge {
  background: #1a2a3a;
  color: #fff;
}

/* ========== FILTROS ========== */
.filtros-estoque {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
  align-items: center;
  background: #fff;
  padding: 12px 16px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.filtro-group {
  flex: 1;
  min-width: 150px;
}

.filtro-group input,
.filtro-group select {
  width: 100%;
  padding: 8px 14px;
  border: 2px solid #e0e4ea;
  border-radius: 8px;
  font-size: 14px;
  transition: 0.2s;
  outline: none;
  background: #fafbfc;
}

.filtro-group input:focus,
.filtro-group select:focus {
  border-color: #1a2a3a;
  background: #fff;
}

/* ========== GRID DE BAIAS ========== */
.baias-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

/* ========== BAIA CARD ========== */
.baia-card {
  border-radius: 14px;
  padding: 18px 20px 20px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: 0.3s;
  border-left: 6px solid #ccc;
  display: flex;
  flex-direction: column;
}

.baia-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.baia-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.baia-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.baia-nome {
  font-size: 18px;
  font-weight: 700;
  color: #1a2a3a;
}

.baia-nome i {
  color: #f1c40f;
  margin-right: 6px;
}

.baia-acoes {
  display: flex;
  gap: 4px;
}

.baia-acoes button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 6px 10px;
  border-radius: 6px;
  transition: 0.2s;
  color: #555;
}

.baia-acoes button:hover {
  background: rgba(0, 0, 0, 0.05);
}

.baia-acoes .btn-excluir {
  color: #e74c3c;
}

.baia-acoes .btn-excluir:hover {
  background: #fdedec;
}

.baia-materiais {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.material-tag {
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  color: #555;
}

.baia-card table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  flex: 1;
}

.baia-card table th {
  text-align: left;
  font-weight: 600;
  color: #888;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.baia-card table td {
  padding: 5px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
}

.baia-card table tr:last-child td {
  border-bottom: none;
}

.baia-card .total-row {
  font-weight: 700;
  border-top: 2px solid rgba(0, 0, 0, 0.08);
}

.baia-card .total-row td {
  padding-top: 8px;
}

.baia-footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.baia-footer-info {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #666;
}

.baia-footer-info i {
  margin-right: 4px;
  color: #888;
}

.baia-obs {
  margin-top: 6px;
  font-size: 12px;
  color: #888;
  font-style: italic;
}

.baia-obs i {
  margin-right: 4px;
}

/* ========== PAGINAÇÃO ========== */
.paginacao {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 20px 0;
}

.paginacao span {
  font-size: 14px;
  color: #888;
  font-weight: 500;
}

/* ========== STATUS FIREBASE ========== */
.firebase-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.firebase-status .status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.firebase-status.status-online {
  background: #eafaf1;
  color: #27ae60;
}

.firebase-status.status-online .status-dot {
  background: #27ae60;
}

.firebase-status.status-offline {
  background: #fdedec;
  color: #e74c3c;
}

.firebase-status.status-offline .status-dot {
  background: #e74c3c;
}

.firebase-status.status-local {
  background: #fef9e7;
  color: #f39c12;
}

.firebase-status.status-local .status-dot {
  background: #f39c12;
}

/* ========== MODAL LARGE ========== */
.modal-lg {
  max-width: 800px;
  width: 95%;
}

.modal-sm {
  max-width: 400px;
  width: 92%;
}

/* ========== RESPONSIVO ========== */
@media (max-width: 768px) {
  .header-estoque {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .header-estoque h1 {
    font-size: 22px;
  }

  .estoque-resumo {
    grid-template-columns: repeat(2, 1fr);
  }

  .baias-grid {
    grid-template-columns: 1fr;
  }

  .filtros-estoque {
    flex-direction: column;
  }

  .filtro-group {
    min-width: 100%;
  }

  .baia-header {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .baia-acoes {
    justify-content: flex-end;
  }

  .baia-card table {
    font-size: 12px;
  }

  .modal-lg {
    max-width: 100%;
    width: 100%;
    margin: 10px;
    padding: 16px;
  }
}

@media (max-width: 480px) {
  .estoque-resumo {
    grid-template-columns: 1fr;
  }

  .tabs-estoque {
    gap: 4px;
  }

  .tab-estoque {
    padding: 8px 14px;
    font-size: 12px;
  }

  .tab-estoque .badge {
    font-size: 10px;
    padding: 0 8px;
  }
}

/* ========== ANIMAÇÕES ========== */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.baia-card {
  animation: fadeInUp 0.3s ease;
}

/* ========== SCROLLBAR ========== */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: #f0f4fa;
  border-radius: 8px;
}

::-webkit-scrollbar-thumb {
  background: #c0c8d4;
  border-radius: 8px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a0aab8;
}
