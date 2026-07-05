// assets/js/main.js - Sistema Principal

document.addEventListener('DOMContentLoaded', function() {
  
  // ============================================
  // 1. CARREGAR COMPONENTES DINAMICAMENTE
  // ============================================
  
  function loadComponents() {
    // Carregar topbar
    fetch('components/topbar.html')
      .then(response => response.text())
      .then(html => {
        document.body.insertAdjacentHTML('afterbegin', html);
        initializeSidebar();
        initializeTopbar();
      })
      .catch(error => console.error('Erro ao carregar topbar:', error));
    
    // Carregar sidebar
    fetch('components/sidebar.html')
      .then(response => response.text())
      .then(html => {
        const container = document.querySelector('.container');
        if (container) {
          container.insertAdjacentHTML('afterbegin', html);
        }
        highlightActivePage();
      })
      .catch(error => console.error('Erro ao carregar sidebar:', error));
  }
  
  // ============================================
  // 2. INICIALIZAR SIDEBAR
  // ============================================
  
  function initializeSidebar() {
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const mainContent = document.querySelector('.main-content');
    
    if (!toggleBtn || !sidebar) return;
    
    function isDesktop() {
      return window.innerWidth >= 992;
    }
    
    if (isDesktop()) {
      sidebar.classList.add('active');
      if (mainContent) {
        mainContent.style.marginLeft = '250px';
        mainContent.style.width = 'calc(100% - 250px)';
      }
    }
    
    toggleBtn.addEventListener('click', function() {
      sidebar.classList.toggle('active');
      if (overlay) overlay.classList.toggle('active');
      
      if (!isDesktop()) {
        document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
      }
      
      if (mainContent) {
        if (sidebar.classList.contains('active')) {
          mainContent.style.marginLeft = '250px';
          mainContent.style.width = 'calc(100% - 250px)';
        } else {
          mainContent.style.marginLeft = '0';
          mainContent.style.width = '100%';
        }
      }
    });
    
    if (overlay) {
      overlay.addEventListener('click', function() {
        sidebar.classList.remove('active');
        this.classList.remove('active');
        document.body.style.overflow = '';
        if (mainContent) {
          mainContent.style.marginLeft = '0';
          mainContent.style.width = '100%';
        }
      });
    }
    
    document.addEventListener('click', function(e) {
      if (e.target.closest('.sidebar-menu a') && !isDesktop()) {
        sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
        if (mainContent) {
          mainContent.style.marginLeft = '0';
          mainContent.style.width = '100%';
        }
      }
    });
    
    window.addEventListener('resize', function() {
      if (isDesktop()) {
        sidebar.classList.add('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
        if (mainContent) {
          mainContent.style.marginLeft = '250px';
          mainContent.style.width = 'calc(100% - 250px)';
        }
      } else {
        sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        if (mainContent) {
          mainContent.style.marginLeft = '0';
          mainContent.style.width = '100%';
        }
      }
    });
  }
  
  // ============================================
  // 3. INICIALIZAR TOPBAR
  // ============================================
  
  function initializeTopbar() {
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function(e) {
        console.log('Buscar:', e.target.value);
      });
    }
    
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        console.log('Botão clicado:', this.title || this.textContent);
      });
    });
  }
  
  // ============================================
  // 4. MARCAR PÁGINA ATIVA
  // ============================================
  
  function highlightActivePage() {
    const currentPage = getCurrentPageName();
    const menuItems = document.querySelectorAll('.sidebar-menu a');
    
    menuItems.forEach(item => {
      item.classList.remove('active');
      const page = item.getAttribute('data-page');
      if (page === currentPage) {
        item.classList.add('active');
      }
    });
  }
  
  function getCurrentPageName() {
    const path = window.location.pathname;
    const page = path.split('/').pop().replace('.html', '');
    return page || 'dashboard';
  }
  
  // ============================================
  // 5. CARREGAR CSS/JS DA PÁGINA ATUAL (CORRIGIDO)
  // ============================================
  
  function loadPageAssets() {
    // ❌ REMOVIDO: Não carregar de /pages/ pois os arquivos estão em /assets/css/ e /js/
    // Cada HTML já carrega seus próprios CSS e JS via tags <link> e <script>
    
    // Apenas log para debug
    const currentPage = getCurrentPageName();
    console.log('📄 Página atual:', currentPage);
    console.log('   CSS e JS carregados diretamente no HTML - sem /pages/');
  }
  
  // ============================================
  // INICIALIZAR SISTEMA
  // ============================================
  
  const hasContainer = document.querySelector('.container');
  const hasMainContent = document.querySelector('.main-content');
  
  if (!hasContainer || !hasMainContent) {
    document.body.innerHTML = `
      <div class="container">
        <main class="main-content">
          ${document.body.innerHTML}
        </main>
      </div>
    `;
  }
  
  loadComponents();
  loadPageAssets();
  
  setTimeout(() => {
    document.body.classList.add('loaded');
  }, 100);
});

function navigateTo(page) {
  window.location.href = `${page}.html`;
}
// /js/main.js

// Carregar sidebar com tratamento de erro
async function carregarSidebar() {
    try {
        const response = await fetch('/components/sidebar.html');
        if (!response.ok) throw new Error('Sidebar não encontrada');
        const html = await response.text();
        document.getElementById('sidebar-container').innerHTML = html;
    } catch (error) {
        console.warn('⚠️ Sidebar não carregada:', error.message);
        // Carregar fallback ou ignorar
    }
}

// Carregar topbar com tratamento de erro
async function carregarTopbar() {
    try {
        const response = await fetch('/components/topbar.html');
        if (!response.ok) throw new Error('Topbar não encontrada');
        const html = await response.text();
        document.getElementById('topbar-container').innerHTML = html;
    } catch (error) {
        console.warn('⚠️ Topbar não carregada:', error.message);
    }
}
