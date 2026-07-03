// =============================================
// DATA-LOADER.JS - Carregamento Centralizado
// Todos os módulos usam este script para dados
// =============================================

(function() {
    'use strict';

    // Aguardar SyncSystem estar pronto
    function aguardarSyncSystem() {
        return new Promise((resolve) => {
            if (window.SyncSystem) {
                resolve();
                return;
            }
            
            let tentativas = 0;
            const check = setInterval(() => {
                tentativas++;
                if (window.SyncSystem) {
                    clearInterval(check);
                    resolve();
                }
                if (tentativas > 100) {
                    clearInterval(check);
                    console.error('❌ SyncSystem não carregou');
                    resolve();
                }
            }, 100);
        });
    }

    // ========== API PÚBLICA ==========
    window.DataLoader = {
        // Carregar dados de qualquer módulo
        load: async function(moduleName) {
            await aguardarSyncSystem();
            return await window.SyncSystem.carregarModulo(moduleName);
        },

        // Salvar dados de qualquer módulo
        save: async function(moduleName, data) {
            await aguardarSyncSystem();
            return await window.SyncSystem.salvarModulo(moduleName, data);
        },

        // Adicionar item
        add: async function(moduleName, item) {
            await aguardarSyncSystem();
            const data = await this.load(moduleName);
            data.push(item);
            await this.save(moduleName, data);
            return item;
        },

        // Atualizar item
        update: async function(moduleName, id, newData) {
            await aguardarSyncSystem();
            const data = await this.load(moduleName);
            const index = data.findIndex(item => String(item.id) === String(id));
            if (index !== -1) {
                data[index] = { ...data[index], ...newData };
                await this.save(moduleName, data);
                return true;
            }
            return false;
        },

        // Excluir item
        delete: async function(moduleName, id) {
            await aguardarSyncSystem();
            const data = await this.load(moduleName);
            const filtered = data.filter(item => String(item.id) !== String(id));
            await this.save(moduleName, filtered);
            
            // Também excluir do Firebase diretamente
            if (window.SyncSystem.deleteModuleItem) {
                await window.SyncSystem.deleteModuleItem(moduleName, id);
            }
            
            return filtered;
        },

        // Sincronizar tudo
        syncAll: async function() {
            await aguardarSyncSystem();
            if (window.SyncSystem.forceSync) {
                await window.SyncSystem.forceSync();
            }
        }
    };

    console.log('✅ DataLoader centralizado pronto');
})();
