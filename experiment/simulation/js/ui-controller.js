/**
 * ============================================
 * UI CONTROLLER
 * ============================================
 * Manages all user interface interactions and updates
 * 
 * Responsibilities:
 * - Handle button clicks
 * - Manage modals
 * - Update configuration panel
 * - Display logs in UI
 * - Handle connection mode (source/destination selection)
 * - File save/load operations
 */

class UIController {
    constructor() {
        this.connectionMode = 'idle'; // 'idle', 'selecting-source', 'selecting-destination'
        this.selectedSourceNF = null;
        this.selectedDestinationNF = null;
        this.iperf3Servers = new Map(); // Track active iperf3 servers: nfId -> { server, output, intervalId }
        
        // PDU Session Mode state
        this.pduSessionMode = false;
        this.pduCurrentStep = 0;
        this.pduSessionData = null;

        console.log('✅ UIController initialized');
    }

    /**
     * Initialize all UI components and event listeners
     */
    init() {
        console.log('🎮 Initializing UI...');

        // Setup all button handlers
        this.setupAddNFButton();
        this.setupClearButton();
        this.setupValidateButton();
        this.setupConnectionButtons();
        this.setupNFPalette();
        this.setupNFPanelToggle();
        this.setupConfigPanelToggle();
        this.setupDeployCoreButton();
        this.setupDockerTerminalButton();
        this.setupHelpPanel();
    
        
        // Initialize PDU Session Mode
        this.setupPDUSessionMode();

        // Initialize log panel
        this.initializeLogPanel();

        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();

        console.log('✅ UI initialized');
    }

    /**
     * Setup Docker main terminal button (header)
     * Opens the DockerTerminal from `js/docker.js` for controlling NFs.
     */
    setupDockerTerminalButton() {
        const btn = document.getElementById('btn-docker-terminal');
        if (!btn) return;

        btn.addEventListener('click', () => {
            // Check if docker terminal is available
            if (!window.dockerTerminal) {
                console.error('❌ window.dockerTerminal is not defined');
                console.error('Available window properties:', Object.keys(window).filter(k => k.includes('docker') || k.includes('terminal')));
                alert('Docker terminal is not available.\n\nPlease try refreshing the page.\n\nIf the issue persists, check the browser console for errors.');
                return;
            }

            // Check if openTerminal method exists
            if (typeof window.dockerTerminal.openTerminal !== 'function') {
                console.error('❌ window.dockerTerminal.openTerminal is not a function');
                console.error('window.dockerTerminal type:', typeof window.dockerTerminal);
                console.error('window.dockerTerminal keys:', Object.keys(window.dockerTerminal));
                alert('Docker terminal is not properly initialized.\n\nPlease refresh the page and try again.');
                return;
            }

            // Open the terminal
            try {
                window.dockerTerminal.openTerminal();
                console.log('✅ Docker terminal opened successfully');
            } catch (error) {
                console.error('❌ Error opening Docker terminal:', error);
                alert('Failed to open Docker terminal: ' + error.message);
            }
        });

        console.log('✅ Docker terminal button setup complete');
    }

    /**
     * Setup Help side panel toggle
     */
    setupHelpPanel() {
        const openBtn = document.getElementById('btn-help-panel');
        const closeBtn = document.getElementById('btn-close-help-panel');
        const modal = document.getElementById('help-modal');
        const modalCloseBtn = document.getElementById('help-close');

        if (openBtn && modal) {
            openBtn.addEventListener('click', () => {
                modal.style.display = 'flex';
            });
        }

        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });
        }
    }

    // ==========================================
    // NF PALETTE SETUP
    // ==========================================

    /**
     * Setup NF palette in left sidebar
     */
    setupNFPalette() {
        const palette = document.querySelector('.nf-palette');
        if (!palette) return;

        const nfTypes = ['NRF', 'AMF', 'SMF', 'UPF', 'AUSF', 'UDM', 'PCF', 'NSSF', 'UDR', 'gNB', 'UE'];

        nfTypes.forEach(type => {
            const nfDef = window.nfDefinitions?.[type] || {
                name: type,
                color: '#95a5a6'
            };

            const item = document.createElement('div');
            item.className = 'nf-palette-item';
            item.dataset.type = type;

            item.innerHTML = `
                <div class="nf-icon-small" style="background: ${nfDef.color}">
                    ${type[0]}
                </div>
                <div class="nf-label">
                    <div class="nf-name">${type}</div>
                    <div class="nf-desc">${nfDef.name || type}</div>
                </div>
            `;

            // Click to add NF
            item.addEventListener('click', () => {
                console.log('🖱️ Palette item clicked:', type);
                this.createNFFromPalette(type);
            });

            palette.appendChild(item);
        });
    }

    /**
     * Create NF from palette click - NEW WORKFLOW: Show config first
     * @param {string} type - NF type
     */
    createNFFromPalette(type) {
        console.log('🖱️ Palette item clicked:', type);
        // NEW: Show configuration panel first, don't create NF yet
        this.showNFConfigurationForNewNF(type);
    }

    // ==========================================
    // ADD NF BUTTON & MODAL
    // ==========================================

    /**
     * Setup Add NF button and modal
     */
    setupAddNFButton() {
        const addNFBtn = document.getElementById('btn-add-nf');
        if (!addNFBtn) {
            console.error('❌ Add NF button not found');
            return;
        }

        addNFBtn.addEventListener('click', () => {
            console.log('🖱️ Add NF button clicked');
            this.showAddNFModal();
        });

        // Setup modal
        this.setupAddNFModal();
    }

    /**
     * Setup Add NF modal
     */
    setupAddNFModal() {
        const modal = document.getElementById('add-nf-modal');
        const modalCancel = document.getElementById('modal-cancel');
        const nfGrid = document.getElementById('nf-grid');

        if (!modal || !nfGrid) return;

        // Create NF selection buttons
        const nfTypes = ['NRF', 'AMF', 'SMF', 'UPF', 'AUSF', 'UDM', 'PCF', 'NSSF', 'UDR', 'gNB', 'ext-dn', 'UE'];

        nfGrid.innerHTML = '';

        nfTypes.forEach(type => {
            const nfDef = window.nfDefinitions?.[type] || {
                name: type,
                color: '#95a5a6'
            };

            const btn = document.createElement('button');
            btn.className = 'nf-select-btn';
            btn.dataset.type = type;

            btn.innerHTML = `
                <div class="nf-icon" style="background: ${nfDef.color}">
                    ${type[0]}
                </div>
                <div class="nf-label">${type}</div>
            `;

            // Click handler - NEW WORKFLOW: Show config first
            btn.addEventListener('click', () => {
                console.log('🖱️ Modal: Selected NF type:', type);

                // NEW: Show configuration panel first, don't create NF yet
                this.showNFConfigurationForNewNF(type);

                // Close modal
                modal.style.display = 'none';
            });

            nfGrid.appendChild(btn);
        });

        // Cancel button
        if (modalCancel) {
            modalCancel.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    /**
     * Show Add NF modal
     */
    showAddNFModal() {
        const modal = document.getElementById('add-nf-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    // ==========================================
    // CONNECTION BUTTONS (Source/Destination)
    // ==========================================

    /**
     * Setup connection control buttons
     */
    setupConnectionButtons() {
        const btnSource = document.getElementById('btn-select-source');
        const btnDestination = document.getElementById('btn-select-destination');
        const btnCancel = document.getElementById('btn-cancel-connection');

        if (!btnSource || !btnDestination || !btnCancel) {
            console.error('❌ Connection buttons not found');
            return;
        }

        // Select Source button
        btnSource.addEventListener('click', () => {
            console.log('🖱️ Select Source clicked');
            this.enterSourceSelectionMode();
        });

        // Select Destination button
        btnDestination.addEventListener('click', () => {
            console.log('🖱️ Select Destination clicked');
            if (this.selectedSourceNF) {
                // Simplified: Just enter destination mode - user can click NF or Bus
                this.enterDestinationSelectionMode();
                console.log('💡 You can now click on an NF or Bus Line to connect!');
            } else {
                alert('Please select a source NF first!');
            }
        });

        // Cancel button
        btnCancel.addEventListener('click', () => {
            console.log('🖱️ Connection cancelled');
            this.cancelConnectionMode();
        });

        // Listen to canvas clicks for connection mode
        this.setupConnectionModeListener();
    }

    /**
     * Enter bus selection mode
     */
    enterBusSelectionMode() {
        this.connectionMode = 'selecting-bus';

        const btnDestination = document.getElementById('btn-select-destination');
        btnDestination.classList.add('active');
        btnDestination.style.background = '#27ae60';

        this.showCanvasMessage(`Select a SERVICE BUS to connect ${this.selectedSourceNF.name}`);
    }

    /**
     * Select bus and create connection
         */
    selectBus(bus) {
        console.log('✅ Bus selected as destination:', bus.name);

        if (this.selectedSourceNF) {
            // NF to Bus connection
            console.log('🔗 Creating NF-to-Bus connection:', this.selectedSourceNF.name, '→', bus.name);
            if (window.busManager) {
                const connection = window.busManager.connectNFToBus(this.selectedSourceNF.id, bus.id);
                if (connection) {
                    console.log('✅ NF-to-Bus connection created successfully!');
                }
            }
        } else if (this.selectedSourceBus) {
            // Bus to Bus connection
            console.log('🔗 Creating Bus-to-Bus connection:', this.selectedSourceBus.name, '→', bus.name);
            if (window.busManager) {
                const connection = window.busManager.connectBusToBus(this.selectedSourceBus.id, bus.id);
                if (connection) {
                    console.log('✅ Bus-to-Bus connection created successfully!');
                }
            }
        } else {
            console.error('❌ No source selected!');
            alert('Error: No source selected');
        }

        this.cancelConnectionMode();
    }

    /**
     * Setup listener for connection mode canvas clicks
     */
    setupConnectionModeListener() {
        if (window.dataStore) {
            window.dataStore.subscribe((event, data) => {
                if (event === 'nf-added') {
                    this.updateLogNFFilter();
                }
            });
        }

        const canvas = document.getElementById('main-canvas');
        if (canvas) {
            canvas.addEventListener('click', (e) => {
                if (this.connectionMode === 'idle') return;

                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const clickedNF = window.canvasRenderer?.getNFAtPosition(x, y);
                const clickedBus = this.getBusAtPosition(x, y);

                console.log('🖱️ Canvas click in connection mode:', this.connectionMode);
                console.log('🖱️ Clicked NF:', clickedNF?.name || 'none');
                console.log('🖱️ Clicked Bus:', clickedBus?.name || 'none');

                if (this.connectionMode === 'selecting-source') {
                    // In source mode, allow clicking either NF or Bus
                    if (clickedNF) {
                        console.log('🔗 Selecting NF as source...');
                        this.selectSourceNF(clickedNF);
                    } else if (clickedBus) {
                        console.log('🚌 Selecting Bus as source...');
                        this.selectSourceBus(clickedBus);
                    } else {
                        console.log('❌ Please click on an NF or Bus Line');
                    }
                } else if (this.connectionMode === 'selecting-destination') {
                    // In destination mode, allow clicking either NF or Bus
                    if (clickedNF) {
                        console.log('🔗 Connecting to NF...');
                        this.selectDestinationNF(clickedNF);
                    } else if (clickedBus) {
                        console.log(' Connecting to Bus...');
                        this.selectBus(clickedBus);
                    } else {
                        console.log('❌ Please click on an NF or Bus Line');
                    }
                } else if (this.connectionMode === 'selecting-bus' && clickedBus) {
                    // Keep this for backward compatibility
                    console.log(' Bus click detected, calling selectBus...');
                    this.selectBus(clickedBus);
                }
            });
        }
    }
    /**
     * Enter source selection mode
     */
    enterSourceSelectionMode() {
        this.connectionMode = 'selecting-source';
        this.selectedSourceNF = null;
        this.selectedSourceBus = null; // NEW: Clear bus source
        this.selectedDestinationNF = null;

        // Update UI
        const btnSource = document.getElementById('btn-select-source');
        const btnDestination = document.getElementById('btn-select-destination');
        const btnCancel = document.getElementById('btn-cancel-connection');

        btnSource.classList.add('active');
        btnSource.style.background = '#3498db';
        btnDestination.disabled = true;
        btnCancel.style.display = 'block';

        // Show canvas message
        // this.showCanvasMessage('Click an NF or BUS LINE to set as SOURCE');
    }

    /**
     * Enter destination selection mode
     */
    enterDestinationSelectionMode() {
        this.connectionMode = 'selecting-destination';

        // Update UI
        const btnSource = document.getElementById('btn-select-source');
        const btnDestination = document.getElementById('btn-select-destination');

        btnSource.classList.remove('active');
        btnSource.style.background = '';
        btnDestination.classList.add('active');
        btnDestination.style.background = '#4caf50';

        // // Show canvas message
        // const sourceName = this.selectedSourceNF?.name || this.selectedSourceBus?.name || 'source';
        // this.showCanvasMessage(`Click on an NF or BUS LINE to connect from ${sourceName}`);
    }

    /**
     * Select source NF
     * @param {Object} nf - Selected NF
     */
    selectSourceNF(nf) {
        console.log('✅ Source selected:', nf.name);
        this.selectedSourceNF = nf;

        // Enable destination button
        const btnDestination = document.getElementById('btn-select-destination');
        btnDestination.disabled = false;

        // Auto-switch to destination mode
        this.enterDestinationSelectionMode();
    }

    /**
     * Select source Bus
     * @param {Object} bus - Selected Bus
     */
    selectSourceBus(bus) {
        console.log('✅ Bus source selected:', bus.name);
        this.selectedSourceBus = bus;
        this.selectedSourceNF = null; // Clear NF selection

        // Enable destination button
        const btnDestination = document.getElementById('btn-select-destination');
        btnDestination.disabled = false;

        // Auto-switch to destination mode
        this.enterDestinationSelectionMode();
    }

    /**
     * Select destination NF and create connection
     * @param {Object} nf - Selected NF
     */
    selectDestinationNF(nf) {
        console.log('✅ NF selected as destination:', nf.name);
        this.selectedDestinationNF = nf;

        if (this.selectedSourceNF) {
            // NF to NF connection (standard)
            console.log('🔗 Creating NF-to-NF connection:', this.selectedSourceNF.name, '→', nf.name);
            if (window.connectionManager) {
                // Create manual connection (with visual line)
                const connection = window.connectionManager.createManualConnection(
                    this.selectedSourceNF.id,
                    this.selectedDestinationNF.id
                );

                if (connection) {
                    console.log('✅ NF-to-NF connection created successfully');
                }
            }
        } else if (this.selectedSourceBus) {
            // Bus to NF connection
            console.log('🔗 Creating Bus-to-NF connection:', this.selectedSourceBus.name, '→', nf.name);
            if (window.busManager) {
                const connection = window.busManager.connectBusToNF(this.selectedSourceBus.id, nf.id);
                if (connection) {
                    console.log('✅ Bus-to-NF connection created successfully');
                }
            }
        } else {
            console.error('❌ No source selected!');
            alert('Error: No source selected');
        }

        // Reset connection mode
        this.cancelConnectionMode();
    }

    /**
     * Cancel connection mode
     */
    cancelConnectionMode() {
        this.connectionMode = 'idle';
        this.selectedSourceNF = null;
        this.selectedSourceBus = null; // NEW: Clear bus source
        this.selectedDestinationNF = null;

        // Update UI
        const btnSource = document.getElementById('btn-select-source');
        const btnDestination = document.getElementById('btn-select-destination');
        const btnCancel = document.getElementById('btn-cancel-connection');

        btnSource.classList.remove('active');
        btnSource.style.background = '';
        btnDestination.classList.remove('active');
        btnDestination.style.background = '';
        btnDestination.disabled = true;
        btnCancel.style.display = 'none';

        // Hide canvas message
        this.hideCanvasMessage();
    }

    /**
     * Show canvas message
     * @param {string} message - Message to display
     */
    showCanvasMessage(message) {
        const msgElement = document.getElementById('canvas-message');
        if (msgElement) {
            msgElement.textContent = message;
            msgElement.classList.add('show');
        }
    }

    /**
     * Hide canvas message
     */
    hideCanvasMessage() {
        const msgElement = document.getElementById('canvas-message');
        if (msgElement) {
            msgElement.classList.remove('show');
        }
    }

    // ==========================================
    // SAVE / LOAD / CLEAR BUTTONS
    // ==========================================



    /**
     * Setup Clear button
     */
    setupClearButton() {
        const clearBtn = document.getElementById('btn-clear');
        if (!clearBtn) return;

        clearBtn.addEventListener('click', () => {
            console.log('🗑️ Clear clicked');
            this.clearTopology();
        });
    }

    /**
     * Clear entire topology
     */
    clearTopology() {
        if (!confirm('Are you sure you want to clear the entire topology? This cannot be undone.')) {
            return;
        }

        // Clear data
        if (window.dataStore) {
            window.dataStore.clearAll();
        }

        // Clear logs
        if (window.logEngine) {
            window.logEngine.clearAllLogs();
        }

        // Clear log UI
        const logContent = document.getElementById('log-content');
        if (logContent) {
            logContent.innerHTML = '';
        }

        // Re-render canvas
        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }

        console.log('✅ Topology cleared');
        alert('Topology cleared successfully!');
        // Full refresh ensures complete re-initialization of all managers and UI state
        window.location.reload();
    }

    /**
     * Setup Validate button
     */
    setupValidateButton() {
        const validateBtn = document.getElementById('btn-validate');
        if (!validateBtn) return;

        validateBtn.addEventListener('click', () => {
            console.log('✓ Validate clicked');
            this.validateTopology();
        });
    }

    /**
     * Validate topology
     */
    validateTopology() {
        const allNFs = window.dataStore?.getAllNFs() || [];
        const allConnections = window.dataStore?.getAllConnections() || [];

        if (allNFs.length === 0) {
            alert('Topology is empty. Add some Network Functions first.');
            return;
        }

        let report = '═══════════════════════════════════\n';
        report += '5G TOPOLOGY VALIDATION REPORT\n';
        report += '═══════════════════════════════════\n\n';

        // Check for NRF
        const hasNRF = allNFs.some(nf => nf.type === 'NRF');
        if (!hasNRF) {
            report += '❌ CRITICAL: NRF is missing!\n';
            report += '   NRF is required as the central registry.\n\n';
        } else {
            report += '✅ NRF exists\n\n';
        }

        // Check each NF
        report += 'NETWORK FUNCTIONS:\n';
        report += '─────────────────────────────────\n';
        allNFs.forEach(nf => {
            const connections = window.dataStore.getConnectionsForNF(nf.id);
            report += `${nf.name} (${nf.type}): ${connections.length} connections\n`;
        });

        report += '\n';
        report += `Total NFs: ${allNFs.length}\n`;
        report += `Total Connections: ${allConnections.length}\n`;

        report += '\n═══════════════════════════════════\n';
        report += hasNRF ? 'STATUS: ✅ VALID' : 'STATUS: ❌ INVALID';
        report += '\n═══════════════════════════════════';

        alert(report);
        console.log(report);
    }

    /**
     * Setup Help button
     */
   

    // ==========================================
    // NF PANEL TOGGLE
    // ==========================================

    /**
     * Setup NF panel toggle
     */
    setupNFPanelToggle() {
        const toggleBtn = document.getElementById('btn-toggle-nf');
        
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleNFPanel());
            console.log('✅ NF panel toggle initialized');
        } else {
            console.warn('⚠️ NF panel toggle button not found');
        }
    }

    /**
     * Toggle NF panel visibility
     */
    toggleNFPanel() {
        const nfPanel = document.getElementById('nf-sidebar');
        
        if (!nfPanel) return;

        nfPanel.classList.toggle('collapsed');
        console.log('📋 NF panel toggled:', nfPanel.classList.contains('collapsed') ? 'Collapsed' : 'Expanded');
        
        // Trigger canvas resize
        if (window.canvasRenderer) {
            setTimeout(() => window.canvasRenderer.resizeCanvas(), 300);
        }
    }

    // ==========================================
    // CONFIGURATION PANEL
    // ==========================================

    /**
     * Show NF configuration panel for NEW NF (before creation)
     * @param {string} nfType - NF type to configure
     */
    showNFConfigurationForNewNF(nfType) {
        const configForm = document.getElementById('config-form');
        if (!configForm) return;

        // Block re-deployment: show warning in config panel if NF already exists (except UE)
        if (nfType !== 'UE') {
            const existing = window.dataStore?.getAllNFs().find(n => n.type === nfType);
            if (existing) {
                configForm.innerHTML = `
                    <div style="background:#2d1b1b;border:1px solid #e74c3c;border-radius:6px;padding:16px;text-align:center;">
                        <div style="font-size:28px;margin-bottom:8px;">🚫</div>
                        <div style="color:#e74c3c;font-weight:bold;font-size:14px;margin-bottom:8px;">Already Deployed</div>
                        <div style="color:#ccc;font-size:12px;margin-bottom:12px;">
                            <strong>${existing.name}</strong> is already running.<br>
                            Each NF can only be deployed once.
                        </div>
                        <div style="color:#95a5a6;font-size:11px;">
                            Remove the existing ${nfType} first to deploy a new one.
                        </div>
                    </div>
                `;
                return;
            }
        }

        // Get NF definition for defaults
        const nfDef = window.nfManager?.getNFDefinition(nfType) || { name: nfType, color: '#95a5a6' };

        // Generate unique default values automatically
        const count = (window.nfManager?.nfCounters[nfType] || 0) + 1;
        const defaultName = `${nfType}-${count}`;
        
        // Get next available unique IP and port
        const defaultIP = this.getNextAvailableIP();
        const defaultPort = this.getNextAvailablePort();
        const globalProtocol = window.globalHTTPProtocol || 'HTTP/2';

        // UE Configuration: Show subscriber information form
        if (nfType === 'UE') {
            // Get default subscriber configuration from UDR store
            const subscribers = window.dataStore?.getSubscribers() || [];
            let defaultIMSI = '001010000000101';
            let defaultKey = 'fec86ba6eb707ed08905757b1bb44b8f';
            let defaultOpc = 'C42449363BBAD02B66D16BC975D77CC1';
            let defaultDnn = '5G-Lab';
            let defaultSst = 1;
            
            // Initialize default subscribers if not present
            if (subscribers.length === 0) {
                if (window.dataStore?.setSubscribers) {
                    window.dataStore.setSubscribers([
                        { imsi: '001010000000101', key: 'fec86ba6eb707ed08905757b1bb44b8f', opc: 'C42449363BBAD02B66D16BC975D77CC1', dnn: '5G-Lab', nssai_sst: 1 },
                        { imsi: '001010000000102', key: 'fec86ba6eb707ed08905757b1bb44b8f', opc: 'C42449363BBAD02B66D16BC975D77CC1', dnn: '5G-Lab', nssai_sst: 1 }
                    ]);
                }
            }
            
            // Find first available subscriber that's not assigned to any UE
            const updatedSubscribers = window.dataStore?.getSubscribers() || [];
            const allUEs = window.dataStore?.getAllNFs().filter(n => n.type === 'UE') || [];
            const usedIMSI = new Set(allUEs.map(ue => ue.config.subscriberImsi).filter(Boolean));
            const availableSubscriber = updatedSubscribers.find(sub => !usedIMSI.has(sub.imsi));
            
            if (availableSubscriber) {
                defaultIMSI = availableSubscriber.imsi;
                defaultKey = availableSubscriber.key;
                defaultOpc = availableSubscriber.opc;
                defaultDnn = availableSubscriber.dnn;
                defaultSst = availableSubscriber.nssai_sst;
            }
            
            configForm.innerHTML = `
                <h4>📱 Configure New UE</h4>
                
                <div class="form-group">
                    <label>IMSI (International Mobile Subscriber Identity) *</label>
                    <input type="text" id="config-imsi" value="${defaultIMSI}" placeholder="001010000000101" required>
                    <small style="color: #95a5a6; font-size: 11px; display: block; margin-top: 4px;">
                        15-digit unique subscriber identifier
                    </small>
                </div>
                
                <div class="form-group">
                    <label>Key (K) *</label>
                    <input type="text" id="config-key" value="${defaultKey}" placeholder="fec86ba6eb707ed08905757b1bb44b8f" required>
                    <small style="color: #95a5a6; font-size: 11px; display: block; margin-top: 4px;">
                        128-bit authentication key (32 hex characters)
                    </small>
                </div>
                
                <div class="form-group">
                    <label>OPc (Operator Code) *</label>
                    <input type="text" id="config-opc" value="${defaultOpc}" placeholder="C42449363BBAD02B66D16BC975D77CC1" required>
                    <small style="color: #95a5a6; font-size: 11px; display: block; margin-top: 4px;">
                        128-bit operator variant key (32 hex characters)
                    </small>
                </div>
                
                <div class="form-group">
                    <label>DNN (Data Network Name) *</label>
                    <input type="text" id="config-dnn" value="${defaultDnn}" placeholder="5G-Lab" required>
                    <small style="color: #95a5a6; font-size: 11px; display: block; margin-top: 4px;">
                        Network slice identifier (e.g., internet, 5G-Lab)
                    </small>
                </div>
                
                <div class="form-group">
                    <label>NSSAI SST (Slice/Service Type) *</label>
                    <input type="number" id="config-sst" value="${defaultSst}" min="1" max="255" required>
                    <small style="color: #95a5a6; font-size: 11px; display: block; margin-top: 4px;">
                        1=eMBB, 2=URLLC, 3=MIoT (typically 1)
                    </small>
                </div>
                
                <button class="btn btn-success btn-block" id="btn-start-nf" data-nf-type="${nfType}">
                    🚀 Start UE
                </button>
                <button class="btn btn-secondary btn-block" id="btn-cancel-nf">Cancel</button>
            `;
        } else {
            // Standard configuration for other NF types
            configForm.innerHTML = `
                <h4>Configure New ${nfType}</h4>
                
                <div class="form-group">
                    <label>IP Address *</label>
                    <input type="text" id="config-ip" value="${defaultIP}" required>
                </div>
                
                <div class="form-group">
                    <label>Port *</label>
                    <input type="number" id="config-port" value="${defaultPort}" required>
                </div>
                
                <div class="form-group">
                    <label>🌐 HTTP Protocol (Global Setting)</label>
                    <select id="config-http-protocol">
                        <option value="HTTP/1" ${globalProtocol === 'HTTP/1' ? 'selected' : ''}>HTTP/1.1</option>
                        <option value="HTTP/2" ${globalProtocol === 'HTTP/2' ? 'selected' : ''}>HTTP/2</option>
                    </select>
                    <small style="color: #95a5a6; font-size: 11px; display: block; margin-top: 4px;">
                        ⚠️ Changing this will update ALL Network Functions in topology
                    </small>
                </div>
                
                <button class="btn btn-success btn-block" id="btn-start-nf" data-nf-type="${nfType}">
                    🚀 Start Network Function
                </button>
                <button class="btn btn-secondary btn-block" id="btn-cancel-nf">Cancel</button>
            `;
        }

        // Protocol change event listener
        const protocolSelect = document.getElementById('config-http-protocol');
        if (protocolSelect) {
            protocolSelect.addEventListener('change', (e) => {
                const newProtocol = e.target.value;
                const currentProtocol = window.globalHTTPProtocol || 'HTTP/2';

                if (newProtocol !== currentProtocol) {
                    const allNFs = window.dataStore?.getAllNFs() || [];
                    const confirmMsg = `⚠️ GLOBAL PROTOCOL CHANGE\n\n` +
                        `This will change HTTP protocol for ALL ${allNFs.length} Network Functions from ${currentProtocol} to ${newProtocol}.\n\n` +
                        `All NFs will use ${newProtocol} for Service-Based Interfaces.\n\n` +
                        `Do you want to continue?`;

                    if (confirm(confirmMsg)) {
                        if (window.nfManager) {
                            const updateCount = window.nfManager.updateGlobalProtocol(newProtocol);
                            alert(`✅ Success!\n\nUpdated ${updateCount} Network Functions to ${newProtocol}`);
                        }
                    } else {
                        protocolSelect.value = currentProtocol;
                    }
                }
            });
        }

        // Start button handler
        const startBtn = document.getElementById('btn-start-nf');
        startBtn.addEventListener('click', () => {
            this.startNewNetworkFunction(nfType);
        });

        // Cancel button handler
        const cancelBtn = document.getElementById('btn-cancel-nf');
        cancelBtn.addEventListener('click', () => {
            this.hideNFConfigPanel();
        });
    }

    /**
     * Show NF configuration panel
     * @param {Object} nf - Network Function to configure
     */
    showNFConfigPanel(nf) {
        const configForm = document.getElementById('config-form');
        if (!configForm) return;

        // UE Configuration: Show subscriber information instead of network details
        if (nf.type === 'UE') {
            const imsi = nf.config.subscriberImsi || '001010000000101';
            const key = nf.config.subscriberKey || 'fec86ba6eb707ed08905757b1bb44b8f';
            const opc = nf.config.subscriberOpc || 'C42449363BBAD02B66D16BC975D77CC1';
            const dnn = nf.config.subscriberDnn || '5G-Lab';
            const sst = nf.config.subscriberSst || 1;
            
            configForm.innerHTML = `
                <h4>📱 ${nf.name} - Subscriber Configuration</h4>
                
                <div class="form-group">
                    <label>UE Type</label>
                    <input type="text" value="${nf.type}" disabled>
                </div>
                
                <div class="form-group">
                    <label>IMSI (International Mobile Subscriber Identity)</label>
                    <input type="text" id="config-imsi" value="${imsi}" placeholder="001010000000101">
                    <small style="color: #95a5a6; font-size: 11px; display: block; margin-top: 4px;">
                        15-digit unique subscriber identifier
                    </small>
                </div>
                
                <div class="form-group">
                    <label>Key (K)</label>
                    <input type="text" id="config-key" value="${key}" placeholder="fec86ba6eb707ed08905757b1bb44b8f">
                    <small style="color: #95a5a6; font-size: 11px; display: block; margin-top: 4px;">
                        128-bit authentication key (32 hex characters)
                    </small>
                </div>
                
                <div class="form-group">
                    <label>OPc (Operator Code)</label>
                    <input type="text" id="config-opc" value="${opc}" placeholder="C42449363BBAD02B66D16BC975D77CC1">
                    <small style="color: #95a5a6; font-size: 11px; display: block; margin-top: 4px;">
                        128-bit operator variant key (32 hex characters)
                    </small>
                </div>
                
                <div class="form-group">
                    <label>DNN (Data Network Name)</label>
                    <input type="text" id="config-dnn" value="${dnn}" placeholder="5G-Lab">
                    <small style="color: #95a5a6; font-size: 11px; display: block; margin-top: 4px;">
                        Network slice identifier (e.g., internet, 5G-Lab)
                    </small>
                </div>
                
                <div class="form-group">
                    <label>NSSAI SST (Slice/Service Type)</label>
                    <input type="number" id="config-sst" value="${sst}" min="1" max="255">
                    <small style="color: #95a5a6; font-size: 11px; display: block; margin-top: 4px;">
                        1=eMBB, 2=URLLC, 3=MIoT (typically 1)
                    </small>
                </div>
                
                <button class="btn btn-primary btn-block" id="btn-save-config">Save Subscriber Info</button>
                

                
                <div class="form-group" style="margin-top: 15px;">
                    <h4>📋 Validation & Testing</h4>
                    <button class="btn btn-info btn-block" id="btn-validate-ue">
                        ✓ Validate UE Against UDR
                    </button>
                    <button class="btn btn-success btn-block" id="btn-collect-logs" style="margin-top: 10px;">
                        📊 Collect Network Logs
                    </button>
                </div>
                
                <button class="btn btn-danger btn-block" id="btn-delete-nf" style="margin-top: 15px;">Delete UE</button>
                
                
                <button class="btn btn-terminal btn-block" id="btn-open-terminal">
                    💻 Open Command Prompt
                </button>
                
            `;
        } else {
            // Standard configuration for other NF types
            configForm.innerHTML = `
                <h4>${nf.name} Configuration</h4>
                
                <div class="form-group">
                    <label>NF Type</label>
                    <input type="text" value="${nf.type}" disabled>
                </div>
                
                <div class="form-group">
                    <label>IP Address</label>
                    <input type="text" id="config-ip" value="${nf.config.ipAddress}">
                </div>
                
                <div class="form-group">
                    <label>Port</label>
                    <input type="number" id="config-port" value="${nf.config.port}">
                </div>
                
                
                <div class="form-group">
                    <label>🌐 HTTP Protocol (Global Setting)</label>
                    <select id="config-http-protocol">
                        <option value="HTTP/1" ${nf.config.httpProtocol === 'HTTP/1' ? 'selected' : ''}>HTTP/1.1</option>
                        <option value="HTTP/2" ${nf.config.httpProtocol === 'HTTP/2' ? 'selected' : ''}>HTTP/2</option>
                    </select>
                    <small style="color: #95a5a6; font-size: 11px; display: block; margin-top: 4px;">
                        ⚠️ Changing this will update ALL Network Functions in topology
                    </small>
                </div>
                
                
                <button class="btn btn-primary btn-block" id="btn-save-config">Save Changes</button>
                <button class="btn btn-danger btn-block" id="btn-delete-nf">Delete NF</button>

            ${nf.type === 'UDR' ? `
            <div class="form-group">
                <h4>UDR Subscriber Management</h4>
                <button class="btn btn-info btn-block" id="btn-show-subs">Show Subscriber Info</button>
            </div>
            ` : ''}
            
            ${nf.type === 'gNB' ? `
            <div class="form-group">
                <h4>Student Triggers</h4>
                <button class="btn btn-info btn-block" id="btn-trigger-ngap">Trigger NGAP Flow</button>
                <button class="btn btn-info btn-block" id="btn-trigger-gtpu">Trigger GTP-U Packet</button>
            </div>
            ` : ''}
            
            
            <button class="btn btn-terminal btn-block" id="btn-open-terminal">
                💻 Open Command Prompt
            </button>
            
        `;
        }

        // Protocol change event listener (only for non-UE types)
        const protocolSelect = document.getElementById('config-http-protocol');
        if (protocolSelect) {
            protocolSelect.addEventListener('change', (e) => {
                const newProtocol = e.target.value;

                // Show confirmation dialog
                const currentProtocol = window.globalHTTPProtocol || 'HTTP/2';
                if (newProtocol !== currentProtocol) {
                    const allNFs = window.dataStore?.getAllNFs() || [];
                    const confirmMsg = `⚠️ GLOBAL PROTOCOL CHANGE\n\n` +
                        `This will change HTTP protocol for ALL ${allNFs.length} Network Functions from ${currentProtocol} to ${newProtocol}.\n\n` +
                        `All NFs will use ${newProtocol} for Service-Based Interfaces.\n\n` +
                        `Do you want to continue?`;

                    if (confirm(confirmMsg)) {
                        // Update global protocol
                        if (window.nfManager) {
                            const updateCount = window.nfManager.updateGlobalProtocol(newProtocol);
                            alert(`✅ Success!\n\nUpdated ${updateCount} Network Functions to ${newProtocol}`);

                            // Refresh config panel to show updated value
                            this.showNFConfigPanel(nf);
                        }
                    } else {
                        // Revert selection
                        protocolSelect.value = currentProtocol;
                    }
                }
            });
        }

        // Save button handler
        const saveBtn = document.getElementById('btn-save-config');
        saveBtn.addEventListener('click', () => {
            this.saveNFConfig(nf.id);
        });

        // Delete button handler
        const deleteBtn = document.getElementById('btn-delete-nf');
        deleteBtn.addEventListener('click', () => {
            this.deleteNF(nf.id);
        });

        // UE: Validation and Log Collection
        if (nf.type === 'UE') {
            const btnValidate = document.getElementById('btn-validate-ue');
            if (btnValidate) {
                btnValidate.addEventListener('click', () => {
                    this.validateUEAgainstUDR(nf.id);
                });
            }

            const btnCollectLogs = document.getElementById('btn-collect-logs');
            if (btnCollectLogs) {
                btnCollectLogs.addEventListener('click', () => {
                    this.collectNetworkLogs(nf.id);
                });
            }

            // PDU Session control buttons
            const btnEstablish = document.getElementById('btn-establish-pdu');
            if (btnEstablish) {
                btnEstablish.addEventListener('click', async () => {
                    btnEstablish.disabled = true;
                    btnEstablish.textContent = '⏳ Establishing...';
                    
                    try {
                        if (window.sessionManager) {
                            const success = await window.sessionManager.establishPDUSession(nf.id);
                            if (success) {
                                // Refresh the config panel to show updated status
                                const updatedNF = window.dataStore?.getNFById(nf.id);
                                if (updatedNF) {
                                    this.showNFConfigPanel(updatedNF);
                                }
                            }
                        }
                    } catch (error) {
                        console.error('PDU session establishment error:', error);
                        btnEstablish.disabled = false;
                        btnEstablish.textContent = '📶 Establish PDU Session';
                    }
                });
            }

            const btnRelease = document.getElementById('btn-release-pdu');
            if (btnRelease) {
                btnRelease.addEventListener('click', async () => {
                    btnRelease.disabled = true;
                    btnRelease.textContent = '⏳ Releasing...';
                    
                    try {
                        if (window.sessionManager) {
                            const success = await window.sessionManager.releasePDUSession(nf.id);
                            if (success) {
                                // Refresh the config panel to show updated status
                                const updatedNF = window.dataStore?.getNFById(nf.id);
                                if (updatedNF) {
                                    this.showNFConfigPanel(updatedNF);
                                }
                            }
                        }
                    } catch (error) {
                        console.error('PDU session release error:', error);
                        btnRelease.disabled = false;
                        btnRelease.textContent = '🔌 Release PDU Session';
                    }
                });
            }
        }

        // UDR: Show Subscriber Info
        if (nf.type === 'UDR') {
            const btnSubs = document.getElementById('btn-show-subs');
            if (btnSubs) {
                btnSubs.onclick = () => {
                    const store = window.dataStore;
                    const current = store.getSubscribers();
                    // Pre-populate two records if empty
                    if (current.length === 0) {
                        store.setSubscribers([
                            { imsi: '001010000000101', key: 'fec86ba6eb707ed08905757b1bb44b8f', opc: 'C42449363BBAD02B66D16BC975D77CC1', dnn: '5G-Lab', nssai_sst: 1 },
                            { imsi: '001010000000102', key: 'fec86ba6eb707ed08905757b1bb44b8f', opc: 'C42449363BBAD02B66D16BC975D77CC1', dnn: '5G-Lab', nssai_sst: 1 }
                        ]);
                    }
                    const list = store.getSubscribers();
                    const lines = list.map((s, i) => `${i+1}) IMSI=${s.imsi} DNN=${s.dnn} SST=${s.nssai_sst}`).join('\n');
                    const choiceStr = prompt(`Subscribers:\n\n${lines}\n\nEnter 1 or 2 to edit, or IMSI to add:`, '1');
                    if (!choiceStr) return;
                    let sub = null;
                    if (choiceStr === '1' || choiceStr === '2') {
                        sub = list[parseInt(choiceStr,10)-1];
                    } else {
                        sub = { imsi: choiceStr, key: '', opc: '', dnn: '5G-Lab', nssai_sst: 1 };
                    }
                    const imsi = prompt('IMSI:', sub.imsi) || sub.imsi;
                    const key = prompt('Key (hex16/32):', sub.key) || sub.key;
                    const opc = prompt('OPC (hex32):', sub.opc) || sub.opc;
                    const dnn = prompt('DNN:', sub.dnn) || sub.dnn;
                    const sst = parseInt(prompt('NSSAI SST:', String(sub.nssai_sst)) || String(sub.nssai_sst), 10) || sub.nssai_sst;
                    store.upsertSubscriber(imsi, { key, opc, dnn, nssai_sst: sst });
                    alert('✅ Subscriber saved. UDR/MySQL store updated.');
                };
            }
        }

        // Student trigger button handlers (only available for gNB)
        if (nf.type === 'gNB') {
            const btnNgap = document.getElementById('btn-trigger-ngap');
            const btnGtpu = document.getElementById('btn-trigger-gtpu');

            if (btnNgap) {
                btnNgap.onclick = () => {
                    const amf = window.dataStore.getAllNFs().find(x => x.type === 'AMF');
                    if (!amf) return alert('Please add and connect an AMF to see NGAP flows.');
                    // Use logEngine (exists globally)
                    if (window.logEngine && typeof window.logEngine.simulateNGAP === 'function') {
                        window.logEngine.simulateNGAP(nf, amf);
                    } else {
                        alert('NGAP simulator not available.');
                    }
                };
            }

            if (btnGtpu) {
                btnGtpu.onclick = () => {
                    const upf = window.dataStore.getAllNFs().find(x => x.type === 'UPF');
                    if (!upf) return alert('Please add and connect a UPF to see GTP-U flows.');
                    if (window.logEngine && typeof window.logEngine.simulateGTPU === 'function') {
                        window.logEngine.simulateGTPU(nf, upf);
                    } else {
                        alert('GTP-U simulator not available.');
                    }
                };
            }
        }

        // UE registration happens automatically when UE becomes stable
        // No manual button needed

        // Ping troubleshooting handlers
        this.setupPingTroubleshootingHandlers(nf.id);
    }

    /**
     * Start new Network Function with IP conflict prevention
     * @param {string} nfType - NF type
     */
    startNewNetworkFunction(nfType) {
        // Block re-deployment: only one instance of each NF type allowed (except UE)
        if (nfType !== 'UE') {
            const existing = window.dataStore?.getAllNFs().find(n => n.type === nfType);
            if (existing) {
                alert(`❌ Already Deployed!\n\n${nfType} is already running as ${existing.name}.\n\nEach network function can only be deployed once.\nRemove the existing ${nfType} before deploying a new one.`);
                return;
            }
        }

        // UE: Handle subscriber information
        if (nfType === 'UE') {
            const imsi = document.getElementById('config-imsi')?.value;
            const key = document.getElementById('config-key')?.value;
            const opc = document.getElementById('config-opc')?.value;
            const dnn = document.getElementById('config-dnn')?.value;
            const sst = parseInt(document.getElementById('config-sst')?.value);

            if (!imsi || !key || !opc || !dnn || !sst) {
                alert('Please fill all subscriber fields');
                return;
            }

            // Validate IMSI (15 digits)
            if (!/^\d{15}$/.test(imsi)) {
                alert('❌ Invalid IMSI!\n\nIMSI must be exactly 15 digits.');
                return;
            }

            // Validate Key (32 hex characters)
            if (!/^[0-9a-fA-F]{32}$/.test(key)) {
                alert('❌ Invalid Key!\n\nKey must be exactly 32 hexadecimal characters.');
                return;
            }

            // Validate OPc (32 hex characters)
            if (!/^[0-9a-fA-F]{32}$/.test(opc)) {
                alert('❌ Invalid OPc!\n\nOPc must be exactly 32 hexadecimal characters.');
                return;
            }

            // Check for duplicate IMSI - ensure no other UE has the same IMSI
            const allUEs = window.dataStore?.getAllNFs().filter(n => n.type === 'UE') || [];
            const duplicateUE = allUEs.find(ue => ue.config.subscriberImsi === imsi);
            if (duplicateUE) {
                alert(`❌ Duplicate IMSI Detected!\n\nIMSI ${imsi} is already assigned to ${duplicateUE.name}.\n\nEach UE must have a unique IMSI number.`);
                return;
            }

            // Validate IMSI exists in UDR subscriber database
            const subscribers = window.dataStore?.getSubscribers() || [];
            const subscriber = subscribers.find(s => s.imsi === imsi);
            if (!subscriber) {
                alert(`❌ IMSI Not Found in UDR!\n\nIMSI ${imsi} is not registered in the UDR/MySQL subscriber database.\n\nPlease register this subscriber in UDR first before creating the UE.`);
                return;
            }

            // Validate that UE configuration matches subscriber profile
            if (subscriber.dnn && subscriber.dnn !== dnn) {
                alert(`❌ DNN Mismatch!\n\nUE DNN (${dnn}) does not match subscriber profile DNN (${subscriber.dnn}).\n\nPlease update UE configuration to match the subscriber profile.`);
                return;
            }

            if (subscriber.nssai_sst && subscriber.nssai_sst !== sst) {
                alert(`❌ NSSAI SST Mismatch!\n\nUE SST (${sst}) does not match subscriber profile SST (${subscriber.nssai_sst}).\n\nPlease update UE configuration to match the subscriber profile.`);
                return;
            }

            console.log('🚀 Starting new UE with subscriber info:', { imsi, dnn, sst });

            // Calculate position with proper spacing
            const position = this.calculateNFPositionWithSpacing(nfType);

            // Create UE with automatic unique IP/port
            if (window.nfManager) {
                const nf = window.nfManager.createNetworkFunction(nfType, position);

                if (nf) {
                    // Set subscriber configuration
                    nf.config.subscriberImsi = imsi;
                    nf.config.subscriberKey = key;
                    nf.config.subscriberOpc = opc;
                    nf.config.subscriberDnn = dnn;
                    nf.config.subscriberSst = sst;

                    // Update in data store
                    window.dataStore.updateNF(nf.id, nf);

                    console.log('✅ UE started successfully:', nf.name);

                    // Log UE creation with subscriber info
                    if (window.logEngine) {
                        window.logEngine.addLog(nf.id, 'SUCCESS',
                            `${nf.name} created with subscriber profile`, {
                            IMSI: imsi,
                            DNN: dnn,
                            NSSAI_SST: sst,
                            IP: nf.config.ipAddress,
                            Subnet: window.nfManager?.getNetworkFromIP(nf.config.ipAddress) + '.0/24'
                        });
                    }

                    // Re-render canvas
                    if (window.canvasRenderer) {
                        window.canvasRenderer.render();
                    }

                    // Show config panel for the new UE
                    this.showNFConfigPanel(nf);
                }
            }
            return;
        }

        // Standard NF configuration
        const ipAddress = document.getElementById('config-ip')?.value;
        const port = parseInt(document.getElementById('config-port')?.value);
        const httpProtocol = document.getElementById('config-http-protocol')?.value;

        if (!ipAddress || !port) {
            alert('Please fill all required fields');
            return;
        }

        // Validate IP address format
        if (!this.isValidIP(ipAddress)) {
            alert('❌ Invalid IP address format!\n\nPlease enter a valid IP address (e.g., 192.168.1.20)');
            return;
        }

        // Check for IP conflicts
        if (!window.nfManager?.isIPAddressAvailable(ipAddress)) {
            alert(`❌ IP Conflict Detected!\n\nIP address ${ipAddress} is already in use by another service.\n\nPlease choose a different IP address.`);
            return;
        }

        // Check for port conflicts
        if (!window.nfManager?.isPortAvailable(port)) {
            alert(`❌ Port Conflict Detected!\n\nPort ${port} is already in use by another service.\n\nPlease choose a different port number.`);
            return;
        }

        console.log('🚀 Starting new NF:', { nfType, ipAddress, port, httpProtocol });

        // Calculate position with proper spacing
        const position = this.calculateNFPositionWithSpacing(nfType);

        // Create NF with automatic unique IP/port (will be overridden)
        if (window.nfManager) {
            const nf = window.nfManager.createNetworkFunction(nfType, position);

            if (nf) {
                // Override with user-specified configuration
                nf.config.ipAddress = ipAddress;
                nf.config.port = port;
                nf.config.httpProtocol = httpProtocol;

                // Update in data store
                window.dataStore.updateNF(nf.id, nf);

                console.log('✅ NF started successfully:', nf.name);

                // Log service creation with network info
                if (window.logEngine) {
                    window.logEngine.addLog(nf.id, 'SUCCESS',
                        `${nf.name} created successfully`, {
                        ipAddress: ipAddress,
                        port: port,
                        subnet: window.nfManager?.getNetworkFromIP(ipAddress) + '.0/24',
                        protocol: httpProtocol,
                        status: 'starting',
                        note: 'Service will be stable in 5 seconds'
                    });
                }

                // Auto-connect to bus if applicable
                this.autoConnectToBusIfApplicable(nf);

                // Clear configuration panel
                this.hideNFConfigPanel();

                // Re-render canvas
                if (window.canvasRenderer) {
                    window.canvasRenderer.render();
                }
            } else {
                // NF creation failed (e.g., UE limit reached)
                console.warn('⚠️ NF creation failed for type:', nfType);
                // Don't clear the config panel so user can try a different NF type
                return;
            }
        } else {
            console.error('❌ NFManager not available');
            alert('Error: NFManager not available');
        }
    }

    /**
     * Calculate NF position with proper spacing
     * @param {string} nfType - NF type
     * @returns {Object} {x, y} position
     */
    calculateNFPositionWithSpacing(nfType) {
        const allNFs = window.dataStore?.getAllNFs() || [];

        // Grid layout with better spacing
        const nfsPerRow = 6;  // More NFs per row
        const nfWidth = 60;   // Smaller width for better fit
        const nfHeight = 80;  // Height including label
        const marginX = 40;   // Horizontal spacing
        const marginY = 60;   // Vertical spacing
        const startX = 120;   // Start position X
        const startY = 120;   // Start position Y

        const totalNFs = allNFs.length;
        const row = Math.floor(totalNFs / nfsPerRow);
        const col = totalNFs % nfsPerRow;

        return {
            x: startX + col * (nfWidth + marginX),
            y: startY + row * (nfHeight + marginY)
        };
    }

    /**
     * Auto-connect NF to bus line if applicable
     * @param {Object} nf - Network Function
     */
    autoConnectToBusIfApplicable(nf) {
        // Don't auto-connect UPF, gNB, and UE as per requirement
        const excludedTypes = ['UPF', 'gNB', 'UE'];

        if (excludedTypes.includes(nf.type)) {
            console.log(`🚫 Skipping auto-connect for ${nf.type} (excluded type)`);
            return;
        }

        // Find available bus lines
        const allBuses = window.dataStore?.getAllBuses() || [];

        if (allBuses.length === 0) {
            console.log('ℹ️ No bus lines available for auto-connect');
            return;
        }

        // Connect to the first available bus (or you can add logic to choose the best bus)
        const targetBus = allBuses[0];

        if (window.busManager) {
            console.log(`🔗 Auto-connecting ${nf.name} to ${targetBus.name}`);
            const connection = window.busManager.connectNFToBus(nf.id, targetBus.id);

            if (connection) {
                
                // Add log for auto-connection
                if (window.logEngine) {
                    window.logEngine.addLog(nf.id, 'INFO',
                        `Auto-connected to ${targetBus.name} service bus`, {
                        busId: targetBus.id,
                        interfaceName: connection.interfaceName,
                        autoConnect: true
                    });
                }
            }
        }
    }

    /**
     * Hide NF configuration panel
     */
    hideNFConfigPanel() {
        const configForm = document.getElementById('config-form');
        if (configForm) {
            configForm.innerHTML = '<p class="hint">Select a Network Function type to configure and start it</p>';
        }
    }

    /**
     * Save NF configuration with IP conflict prevention
     * @param {string} nfId - NF ID
     */
    saveNFConfig(nfId) {
        const nf = window.dataStore.getNFById(nfId);
        if (!nf) return;

        // UE: Save subscriber information
        if (nf.type === 'UE') {
            const imsi = document.getElementById('config-imsi')?.value;
            const key = document.getElementById('config-key')?.value;
            const opc = document.getElementById('config-opc')?.value;
            const dnn = document.getElementById('config-dnn')?.value;
            const sst = parseInt(document.getElementById('config-sst')?.value);

            if (!imsi || !key || !opc || !dnn || !sst) {
                alert('Please fill all subscriber fields');
                return;
            }

            // Validate IMSI (15 digits)
            if (!/^\d{15}$/.test(imsi)) {
                alert('❌ Invalid IMSI!\n\nIMSI must be exactly 15 digits.');
                return;
            }

            // Validate Key (32 hex characters)
            if (!/^[0-9a-fA-F]{32}$/.test(key)) {
                alert('❌ Invalid Key!\n\nKey must be exactly 32 hexadecimal characters.');
                return;
            }

            // Validate OPc (32 hex characters)
            if (!/^[0-9a-fA-F]{32}$/.test(opc)) {
                alert('❌ Invalid OPc!\n\nOPc must be exactly 32 hexadecimal characters.');
                return;
            }

            // Check for duplicate IMSI - ensure no other UE has the same IMSI
            const allUEs = window.dataStore?.getAllNFs().filter(n => n.type === 'UE' && n.id !== nfId) || [];
            const duplicateUE = allUEs.find(ue => ue.config.subscriberImsi === imsi);
            if (duplicateUE) {
                alert(`❌ Duplicate IMSI Detected!\n\nIMSI ${imsi} is already assigned to ${duplicateUE.name}.\n\nEach UE must have a unique IMSI number.`);
                return;
            }

            // Validate IMSI exists in UDR subscriber database
            const subscribers = window.dataStore?.getSubscribers() || [];
            const subscriber = subscribers.find(s => s.imsi === imsi);
            if (!subscriber) {
                alert(`❌ IMSI Not Found in UDR!\n\nIMSI ${imsi} is not registered in the UDR/MySQL subscriber database.\n\nPlease register this subscriber in UDR first before configuring the UE.`);
                return;
            }

            // Validate that UE configuration matches subscriber profile
            if (subscriber.dnn && subscriber.dnn !== dnn) {
                alert(`❌ DNN Mismatch!\n\nUE DNN (${dnn}) does not match subscriber profile DNN (${subscriber.dnn}).\n\nPlease update UE configuration to match the subscriber profile.`);
                return;
            }

            if (subscriber.nssai_sst && subscriber.nssai_sst !== sst) {
                alert(`❌ NSSAI SST Mismatch!\n\nUE SST (${sst}) does not match subscriber profile SST (${subscriber.nssai_sst}).\n\nPlease update UE configuration to match the subscriber profile.`);
                return;
            }

            // Update subscriber configuration
            nf.config.subscriberImsi = imsi;
            nf.config.subscriberKey = key;
            nf.config.subscriberOpc = opc;
            nf.config.subscriberDnn = dnn;
            nf.config.subscriberSst = sst;

            window.dataStore.updateNF(nfId, nf);

            // Log configuration change
            if (window.logEngine) {
                window.logEngine.addLog(nfId, 'SUCCESS',
                    `Subscriber information updated`, {
                    IMSI: imsi,
                    DNN: dnn,
                    NSSAI_SST: sst,
                    Key: key.substring(0, 8) + '...',
                    OPc: opc.substring(0, 8) + '...'
                });
            }

            alert('✅ Subscriber information saved successfully!');
            
            // Re-render canvas
            if (window.canvasRenderer) {
                window.canvasRenderer.render();
            }
            return;
        }

        // Standard NF configuration
        const ipAddress = document.getElementById('config-ip')?.value;
        const port = parseInt(document.getElementById('config-port')?.value);
        const httpProtocol = document.getElementById('config-http-protocol')?.value;

        if (!ipAddress || !port) {
            alert('Please fill all required fields');
            return;
        }

        // Validate IP address format
        if (!this.isValidIP(ipAddress)) {
            alert('❌ Invalid IP address format!\n\nPlease enter a valid IP address (e.g., 192.168.1.20)');
            return;
        }

        // Check for IP conflicts (excluding current NF)
        if (nf.config.ipAddress !== ipAddress) {
            if (!window.nfManager?.isIPAddressAvailable(ipAddress)) {
                alert(`❌ IP Conflict Detected!\n\nIP address ${ipAddress} is already in use by another service.\n\nPlease choose a different IP address.`);
                return;
            }
        }

        // Check for port conflicts (excluding current NF)
        if (nf.config.port !== port) {
            if (!window.nfManager?.isPortAvailable(port)) {
                alert(`❌ Port Conflict Detected!\n\nPort ${port} is already in use by another service.\n\nPlease choose a different port number.`);
                return;
            }
        }

        // Update NF
        const oldIP = nf.config.ipAddress;
        const oldPort = nf.config.port;

        nf.config.ipAddress = ipAddress;
        nf.config.port = port;
        nf.config.httpProtocol = httpProtocol;

        window.dataStore.updateNF(nfId, nf);

        // Log configuration change
        if (window.logEngine) {
            const changes = [];
            if (oldIP !== ipAddress) changes.push(`IP: ${oldIP} → ${ipAddress}`);
            if (oldPort !== port) changes.push(`Port: ${oldPort} → ${port}`);
            
            if (changes.length > 0) {
                window.logEngine.addLog(nfId, 'INFO',
                    `Configuration updated: ${changes.join(', ')}`, {
                    previousIP: oldIP,
                    newIP: ipAddress,
                    previousPort: oldPort,
                    newPort: port,
                    subnet: window.nfManager?.getNetworkFromIP(ipAddress) + '.0/24'
                });
            }
        }

        // Re-render
        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }

        alert('✅ Configuration saved successfully!\n\n' + 
              `IP: ${ipAddress}\n` +
              `Port: ${port}\n` +
              `Subnet: ${window.nfManager?.getNetworkFromIP(ipAddress)}.0/24`);
        console.log('✅ NF config saved:', nf.name);
    }

    /**
     * Delete NF
     * @param {string} nfId - NF ID
     */
    deleteNF(nfId) {
        const nf = window.dataStore.getNFById(nfId);
        if (!nf) return;

        if (!confirm(`Are you sure you want to delete ${nf.name}?`)) {
            return;
        }

        if (window.nfManager) {
            window.nfManager.deleteNetworkFunction(nfId);
        }

        this.hideNFConfigPanel();
    }

    // ==========================================
    // LOG PANEL
    // ==========================================

    /**
     * Initialize log panel
     */
    initializeLogPanel() {
        console.log('📋 Initializing log panel...');

        // Subscribe to log engine
        if (window.logEngine) {
            window.logEngine.subscribe((logEntry) => {
                if (logEntry.type) return; // Skip event objects
                this.appendLogToUI(logEntry);
            });
        }

        // Setup log controls
        const filterNF = document.getElementById('log-filter-nf');
        const filterLevel = document.getElementById('log-filter-level');
        const clearBtn = document.getElementById('btn-clear-logs');
        const exportBtn = document.getElementById('btn-export-logs');
        const toggleBtn = document.getElementById('btn-toggle-logs');

        if (filterNF) {
            filterNF.addEventListener('change', () => this.filterLogs());
        }

        if (filterLevel) {
            filterLevel.addEventListener('change', () => this.filterLogs());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                const logContent = document.getElementById('log-content');
                if (logContent) {
                    logContent.innerHTML = '';
                }
                if (window.logEngine) {
                    window.logEngine.clearAllLogs();
                }
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportLogs());
        }

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleLogPanel());
        }

        console.log('✅ Log panel initialized');
    }

    /**
     * Append log entry to UI
     * @param {Object} logEntry - Log entry object
     */
    appendLogToUI(logEntry) {
        const logContent = document.getElementById('log-content');
        if (!logContent) return;

        const nf = window.dataStore?.getNFById(logEntry.nfId);
        const nfName = nf?.name || logEntry.nfId;

        const logDiv = document.createElement('div');
        logDiv.className = `log-entry ${logEntry.level}`;
        logDiv.dataset.nfId = logEntry.nfId;
        logDiv.dataset.level = logEntry.level;

        const time = new Date(logEntry.timestamp).toLocaleTimeString();

        logDiv.innerHTML = `
            <span class="log-timestamp">[${time}]</span>
            <span class="log-nf-name">${nfName}</span>
            <span class="log-level">${logEntry.level}</span>
            <span class="log-message">${this.escapeHtml(logEntry.message)}</span>
        `;

        // Add details if present
        if (logEntry.details && Object.keys(logEntry.details).length > 0) {
            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'log-details';

            Object.entries(logEntry.details).forEach(([key, value]) => {
                const detailLine = document.createElement('div');
                detailLine.textContent = `${key}: ${JSON.stringify(value)}`;
                detailsDiv.appendChild(detailLine);
            });

            logDiv.appendChild(detailsDiv);
        }

        logContent.appendChild(logDiv);

        // Auto-scroll to bottom
        logContent.scrollTop = logContent.scrollHeight;

        // Limit displayed logs
        while (logContent.children.length > 500) {
            logContent.removeChild(logContent.firstChild);
        }
    }

    /**
     * Filter logs based on selected filters
     */
    filterLogs() {
        const filterNF = document.getElementById('log-filter-nf')?.value || 'all';
        const filterLevel = document.getElementById('log-filter-level')?.value || 'all';
        const logContent = document.getElementById('log-content');

        if (!logContent) return;

        const allLogEntries = logContent.querySelectorAll('.log-entry');

        allLogEntries.forEach(entry => {
            let show = true;

            if (filterNF !== 'all' && entry.dataset.nfId !== filterNF) {
                show = false;
            }

            if (filterLevel !== 'all' && entry.dataset.level !== filterLevel) {
                show = false;
            }

            entry.style.display = show ? 'flex' : 'none';
        });
    }

    /**
     * Update NF filter dropdown in log panel
     */
    updateLogNFFilter() {
        const select = document.getElementById('log-filter-nf');
        if (!select) return;

        const currentValue = select.value;

        // Clear options except "All NFs"
        while (select.options.length > 1) {
            select.remove(1);
        }

        // Add option for each NF
        const allNFs = window.dataStore?.getAllNFs() || [];
        allNFs.forEach(nf => {
            const option = document.createElement('option');
            option.value = nf.id;
            option.textContent = `${nf.name} (${nf.type})`;
            select.appendChild(option);
        });

        // Restore previous selection if valid
        if (currentValue && [...select.options].some(opt => opt.value === currentValue)) {
            select.value = currentValue;
        }
    }

    /**
     * Export logs
     */
    exportLogs() {
        if (!window.logEngine) return;

        const format = prompt('Export format (json/csv/txt):', 'txt');

        if (!format) return;

        let content, filename, mimeType;

        if (format.toLowerCase() === 'json') {
            content = window.logEngine.exportLogsAsJSON();
            filename = `5g-logs-${Date.now()}.json`;
            mimeType = 'application/json';
        } else if (format.toLowerCase() === 'csv') {
            content = window.logEngine.exportLogsAsCSV();
            filename = `5g-logs-${Date.now()}.csv`;
            mimeType = 'text/csv';
        } else if (format.toLowerCase() === 'txt') {
            content = window.logEngine.exportLogsAsText();
            filename = `5g-logs-${Date.now()}.txt`;
            mimeType = 'text/plain';
        } else {
            alert('Invalid format. Use "json", "csv", or "txt"');
            return;
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        console.log(`✅ Logs exported as ${filename}`);
    }

    // ==========================================
    // DEPLOY CORE BUTTON
    // ==========================================

    /**
     * Setup Deploy Core button
     */
    setupDeployCoreButton() {
        const deployBtn = document.getElementById('btn-deploy-core');
        if (!deployBtn) return;

        deployBtn.addEventListener('click', () => {
            console.log('🚀 Deploy Core clicked');
            this.deployCoreSequence();
        });
    }

        /**
     * Execute step-by-step deployment of Core Topology
     */
    async deployCoreSequence() {
        if (!confirm('⚠️ This will CLEAR the current topology and deploy the 5G Core Network.\n\nAre you sure you want to proceed?')) {
            return;
        }

        console.log('🚀 Starting One-Click Core Deployment...');
        
        // 1. Fetch Logs first
        let logsData = { logs: [] };
        try {
            // Fix: path needs to be relative to index.html location
            const response = await fetch('../5g-logs.json'); 
            if (response.ok) {
                logsData = await response.json();
                console.log('📄 Loaded logs:', logsData.logs.length, 'entries');
                
                // Debug: check if we have gNB logs
                const gnbLogs = logsData.logs.filter(l => l.nfId && l.nfId.toLowerCase().includes('gnb'));
                console.log('📄 gNB logs found:', gnbLogs.length);
            } else {
                console.warn('⚠️ Could not load 5g-logs.json - Status:', response.status);
            }
        } catch (e) {
            console.error('❌ Error loading logs:', e);
        }

        // 2. Clear existing topology
        if (window.dataStore) {
            window.dataStore.clearAll();
        }
        if (window.logEngine) {
            window.logEngine.clearAllLogs();
            window.logEngine.addLog('system', 'INFO', 'Starting 5G Core Deployment Sequence...');
        }

        const topology = this.getCoreOneClickTopology();
        const STEP_DELAY = 1500; // Increased delay as requested
        const LOG_DELAY = 100;

        // Helper to sleep
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        // Helper to find logs for a specific NF type/name
        // We map the static IDs from logs to the dynamic sequence
        const getLogsForType = (type, name) => {
            return logsData.logs.filter(log => {
                if (!log.nfId) return false;
                if (log.nfId === 'system') return false;

                // Robust matching:
                // 1. Try generic type prefix (e.g. 'nrf-', 'gnb-')
                if (log.nfId.toLowerCase().startsWith(type.toLowerCase() + '-')) return true;
                
                // 2. Try matching by name if available in log details or ID
                if (name && log.nfId.toLowerCase().includes(name.toLowerCase())) return true;

                return false;
            });
        };

        // 3. Deploy Buses first (Immediate)
        if (topology.buses && topology.buses.length > 0) {
            console.log('🚌 Deploying Buses...');
            topology.buses.forEach(bus => {
                if (window.dataStore) window.dataStore.addBus(bus);
                if (window.logEngine) window.logEngine.addLog('system', 'INFO', `Deployed ${bus.name}`);
            });
            if (window.canvasRenderer) window.canvasRenderer.render();
            await sleep(1000);
        }

        // 4. Deploy NFs & Simultaneous Bus Connections
        if (topology.nfs && topology.nfs.length > 0) {
            for (const nf of topology.nfs) {
                try {
                    console.log('📦 Deploying NF:', nf.name);
                    
                    // Add NF
                    if (window.dataStore) window.dataStore.addNF(nf);

                    // Find and Add Simultaneous Bus Connection
                    const busConn = topology.busConnections ? topology.busConnections.find(bc => bc.nfId === nf.id) : null;
                    if (busConn) {
                        if (window.dataStore) window.dataStore.addBusConnection(busConn);
                        console.log('🔌 Auto-connected to bus:', nf.name);
                    }

                    // Render update
                    if (window.canvasRenderer) window.canvasRenderer.render();

                    // Play relevant logs for this NF
                    const validLogs = getLogsForType(nf.type, nf.name);
                    // Sort by timestamp to ensure sequence
                    validLogs.sort((a, b) => a.timestamp - b.timestamp);

                    if (validLogs.length > 0) {
                        for (const log of validLogs) {
                            if (window.logEngine) {
                                // Use the log's original data
                                window.logEngine.addLog(nf.id, log.level || 'INFO', log.message, log.details);
                            }
                            await sleep(LOG_DELAY); // Check tiny delay between logs for effect
                        }
                    } else {
                        // Fallback log if no logs found in file
                        if (window.logEngine) window.logEngine.addLog(nf.id, 'INFO', `${nf.name} deployed`, { type: nf.type });
                    }

                    // Wait for the main step delay before next NF
                    await sleep(STEP_DELAY);

                    // 5. Deploy Direct Connections relevant to this NF (Outgoing)
                    // We do this AFTER the NF is fully established (simulated by delay)
                    if (topology.connections) {
                        // Find connections where this NF is the Source
                        const relevantConnections = topology.connections.filter(c => c.sourceId === nf.id);
                        
                        if (relevantConnections.length > 0) {
                            for (const conn of relevantConnections) {
                                // Fix: Use getNFById instead of non-existent getNF
                                // Also handle cases where target might be a bus (unlikely for direct connection) or not yet exists
                                const source = window.dataStore ? window.dataStore.getNFById(conn.sourceId) : null;
                                const target = window.dataStore ? window.dataStore.getNFById(conn.targetId) : null;
                                
                                // Only add if both exist. 
                                // Note: In strict ordered deployment, target should exist IF it was earlier in the list.
                                // If target is later in the list (e.g. circular dependency), we skip for now. 
                                // But one-click.json is usually ordered topologically.
                                if (source && target) {
                                    if (window.dataStore) window.dataStore.addConnection(conn);
                                    if (window.canvasRenderer) window.canvasRenderer.render();
                                    await sleep(500); // Small delay for connection animation
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('❌ Error deploying NF:', nf.name, err);
                    // Continue to next NF despite error
                }
            }
        }

        // Final Message
        console.log('✅ Core Deployment Completed');
        if (window.logEngine) window.logEngine.addLog('system', 'SUCCESS', '5G Core Deployment Completed Successfully');
        alert('✅ 5G Core Deployment Completed!');
    }

    /**
     * Get the One-Click Topology Data
     * @returns {Object} topology data
     */
    getCoreOneClickTopology() {
        return {
  "nfs": [
    {
      "id": "nrf-1766128434061-h6d5p",
      "type": "NRF",
      "name": "NRF-1",
      "position": { "x": 119, "y": 38 },
      "color": "#9b59b6",
      "icon": "simulation/images/icons/nrf.svg",
      "status": "stable",
      "statusTimestamp": 1766128439071,
      "config": { "ipAddress": "192.168.1.10", "port": 8080, "capacity": 1000, "load": 0, "httpProtocol": "HTTP/2" }
    },
    {
      "id": "amf-1766128437620-qzum8",
      "type": "AMF",
      "name": "AMF-1",
      "position": { "x": 274, "y": 222 },
      "color": "#3498db",
      "icon": "simulation/images/icons/amf.svg",
      "status": "stable",
      "statusTimestamp": 1766128442627,
      "config": { "ipAddress": "192.168.1.11", "port": 8081, "capacity": 1000, "load": 0, "httpProtocol": "HTTP/2" }
    },
    {
      "id": "smf-1766128441444-aeu8d",
      "type": "SMF",
      "name": "SMF-1",
      "position": { "x": 395, "y": 228 },
      "color": "#00bcd4",
      "icon": "simulation/images/icons/smf.svg",
      "status": "stable",
      "statusTimestamp": 1766128446455,
      "config": { "ipAddress": "192.168.1.12", "port": 8082, "capacity": 1000, "load": 0, "httpProtocol": "HTTP/2" }
    },
    {
      "id": "upf-1766128444987-c07tk",
      "type": "UPF",
      "name": "UPF-1",
      "position": { "x": 400, "y": 341 },
      "color": "#4caf50",
      "icon": "simulation/images/icons/upf.svg",
      "status": "stable",
      "statusTimestamp": 1766128449995,
      "config": {
        "ipAddress": "192.168.1.13", "port": 8083, "capacity": 1000, "load": 0, "httpProtocol": "HTTP/2",
        "tun0Interface": { "interfaceName": "tun0", "network": "10.0.0.0/28", "gatewayIP": "10.0.0.1", "assignedIPs": [{"ueId": "ue-1766128703062-jvfa8", "ueName": "UE-1", "ip": "10.0.0.2", "assignedAt": 1766128715355}], "nextAvailableIP": 3, "name": "tun0", "ipAddress": "10.0.0.1", "netmask": "255.255.255.0" }
      }
    },
    {
      "id": "ausf-1766128449684-e9u2o",
      "type": "AUSF",
      "name": "AUSF-1",
      "position": { "x": 510, "y": 225 },
      "color": "#ff9800",
      "icon": "simulation/images/icons/ausf.svg",
      "status": "stable",
      "statusTimestamp": 1766128454697,
      "config": { "ipAddress": "192.168.1.14", "port": 8084, "capacity": 1000, "load": 0, "httpProtocol": "HTTP/2" }
    },
    {
      "id": "ext-dn-1766128453002-votm4",
      "type": "ext-dn",
      "name": "ext-dn-1",
      "position": { "x": 539, "y": 342 },
      "color": "#27ae60",
      "icon": null,
      "status": "stable",
      "statusTimestamp": 1766128458017,
      "config": { "ipAddress": "192.168.1.15", "port": 80, "capacity": 1000, "load": 0, "httpProtocol": "HTTP/2" }
    },
    {
      "id": "udm-1766128464413-gtx9n",
      "type": "UDM",
      "name": "UDM-1",
      "position": { "x": 461, "y": 36 },
      "color": "#ff5722",
      "icon": "simulation/images/icons/udm.svg",
      "status": "stable",
      "statusTimestamp": 1766128469426,
      "config": { "ipAddress": "192.168.1.16", "port": 8085, "capacity": 1000, "load": 0, "httpProtocol": "HTTP/2" }
    },
    {
      "id": "pcf-1766128475142-4f0sr",
      "type": "PCF",
      "name": "PCF-1",
      "position": { "x": 234, "y": 35 },
      "color": "#e91e63",
      "icon": "simulation/images/icons/pcf.svg",
      "status": "stable",
      "statusTimestamp": 1766128480152,
      "config": { "ipAddress": "192.168.1.17", "port": 8086, "capacity": 1000, "load": 0, "httpProtocol": "HTTP/2" }
    },
    {
      "id": "nssf-1766128667614-7q082",
      "type": "NSSF",
      "name": "NSSF-1",
      "position": { "x": 336, "y": 38 },
      "color": "#ffc107",
      "icon": "simulation/images/icons/nssf.svg",
      "status": "stable",
      "statusTimestamp": 1766128672619,
      "config": { "ipAddress": "192.168.1.18", "port": 8087, "capacity": 1000, "load": 0, "httpProtocol": "HTTP/2" }
    },
    {
      "id": "udr-1766128679032-4s7yw",
      "type": "UDR",
      "name": "UDR-1",
      "position": { "x": 577, "y": 35 },
      "color": "#009688",
      "icon": "simulation/images/icons/udr.svg",
      "status": "stable",
      "statusTimestamp": 1766128684042,
      "config": { "ipAddress": "192.168.1.19", "port": 8088, "capacity": 1000, "load": 0, "httpProtocol": "HTTP/2" }
    },
    {
      "id": "mysql-1766128680036-dkm7t",
      "type": "MySQL",
      "name": "MySQL-1",
      "position": { "x": 726, "y": 36 },
      "color": "#d35400",
      "icon": "simulation/images/icons/mysql.svg",
      "status": "stable",
      "statusTimestamp": 1766128685048,
      "config": { "ipAddress": "192.168.1.20", "port": 3306, "capacity": 1000, "load": 0, "httpProtocol": "HTTP/2" }
    },
    {
      "id": "gnb-1766128695901-tfruy",
      "type": "gNB",
      "name": "gNB-1",
      "position": { "x": 182, "y": 342 },
      "color": "#8e44ad",
      "icon": "simulation/images/icons/gnb.svg",
      "status": "stable",
      "statusTimestamp": 1766128700906,
      "config": { "ipAddress": "192.168.1.21", "port": 8089, "capacity": 1000, "load": 0, "httpProtocol": "HTTP/2" }
    },
    {
      "id": "ue-1766128703062-jvfa8",
      "type": "UE",
      "name": "UE-1",
      "position": { "x": 33, "y": 342 },
      "color": "#16a085",
      "icon": "simulation/images/icons/ue.svg",
      "status": "stable",
      "statusTimestamp": 1766128708071,
      "config": {
        "ipAddress": "192.168.1.22", "port": 8090, "capacity": 1000, "load": 0, "httpProtocol": "HTTP/2",
        "subscriberImsi": "001010000000101", "subscriberKey": "fec86ba6eb707ed08905757b1bb44b8f", "subscriberOpc": "C42449363BBAD02B66D16BC975D77CC1", "subscriberDnn": "5G-Lab", "subscriberSst": 1,
        "pduSession": { "sessionId": "pdu-1766128715355-g2o13", "upfId": "upf-1766128444987-c07tk", "assignedIP": "10.0.0.2", "status": "established", "establishedAt": 1766128715355 },
        "tunInterface": { "name": "tun_ue1", "ipAddress": "10.0.0.2", "netmask": "255.255.255.0", "destination": "10.0.0.2", "gateway": "10.0.0.1", "mtu": 1500, "flags": "UP,POINTOPOINT,RUNNING,NOARP,MULTICAST", "ipv6": "fe80::c47f:2307:2819:ddb2", "createdAt": 1766128715356 }
      }
    }
  ],
  "connections": [
    { "id": "conn-1766128454666-vzsm9", "sourceId": "upf-1766128444987-c07tk", "targetId": "smf-1766128441444-aeu8d", "interfaceName": "N4", "protocol": "HTTP/2", "status": "connected", "createdAt": 1766128454666, "isManual": true, "showVisual": true },
    { "id": "conn-1766128461769-ims3q", "sourceId": "ext-dn-1766128453002-votm4", "targetId": "upf-1766128444987-c07tk", "interfaceName": "N6", "protocol": "HTTP/2", "status": "connected", "createdAt": 1766128461769, "isManual": true, "showVisual": true },
    { "id": "conn-1766128474214-tb5jo", "sourceId": "udm-1766128464413-gtx9n", "targetId": "nrf-1766128434061-h6d5p", "interfaceName": "Nnrf_NFManagement", "protocol": "HTTP/2", "status": "connected", "createdAt": 1766128474214, "isManual": true, "showVisual": true },
    { "id": "conn-1766128688242-beruw", "sourceId": "mysql-1766128680036-dkm7t", "targetId": "udr-1766128679032-4s7yw", "interfaceName": "SQL/REST API", "protocol": "HTTP/2", "status": "connected", "createdAt": 1766128688242, "isManual": true, "showVisual": true },
    { "id": "conn-1766128704364-zvi4l", "sourceId": "gnb-1766128695901-tfruy", "targetId": "amf-1766128437620-qzum8", "interfaceName": "N2", "protocol": "HTTP/2", "status": "connected", "createdAt": 1766128704364, "isManual": true, "showVisual": true },
    { "id": "conn-1766128704368-gv5tb", "sourceId": "gnb-1766128695901-tfruy", "targetId": "upf-1766128444987-c07tk", "interfaceName": "N3", "protocol": "HTTP/2", "status": "connected", "createdAt": 1766128704368, "isManual": true, "showVisual": true },
    { "id": "conn-1766128712118-5dz4x", "sourceId": "ue-1766128703062-jvfa8", "targetId": "gnb-1766128695901-tfruy", "interfaceName": "Radio", "protocol": "HTTP/2", "status": "connected", "createdAt": 1766128712118, "isManual": true, "showVisual": true },
    { "id": "conn-1766128712126-zjnme", "sourceId": "ue-1766128703062-jvfa8", "targetId": "amf-1766128437620-qzum8", "interfaceName": "N1", "protocol": "HTTP/2", "status": "connected", "createdAt": 1766128712126, "isManual": true, "showVisual": true }
  ],
  "buses": [
    {
      "id": "bus-1766128427686-ph5nr",
      "name": "Service Bus",
      "orientation": "horizontal",
      "position": { "x": 110, "y": 152 },
      "length": 600,
      "thickness": 8,
      "color": "#3498db",
      "type": "service-bus",
      "connections": ["nrf-1766128434061-h6d5p", "amf-1766128437620-qzum8", "smf-1766128441444-aeu8d", "ausf-1766128449684-e9u2o", "udm-1766128464413-gtx9n", "pcf-1766128475142-4f0sr", "nssf-1766128667614-7q082", "udr-1766128679032-4s7yw"]
    }
  ],
  "busConnections": [
    { "id": "bus-conn-1766128434066-3k5q3", "nfId": "nrf-1766128434061-h6d5p", "busId": "bus-1766128427686-ph5nr", "type": "bus-connection", "interfaceName": "Nnrf", "protocol": "HTTP/2", "status": "connected", "createdAt": 1766128434066 },
    { "id": "bus-conn-1766128437625-c4qqr", "nfId": "amf-1766128437620-qzum8", "busId": "bus-1766128427686-ph5nr", "type": "bus-connection", "interfaceName": "Namf", "protocol": "HTTP/2", "status": "connected", "createdAt": 1766128437625 },
    { "id": "bus-conn-1766128441448-bg2yp", "nfId": "smf-1766128441444-aeu8d", "busId": "bus-1766128427686-ph5nr", "type": "bus-connection", "interfaceName": "Nsmf", "protocol": "HTTP/2", "status": "connected", "createdAt": 1766128441448 },
    { "id": "bus-conn-1766128449690-3z327", "nfId": "ausf-1766128449684-e9u2o", "busId": "bus-1766128427686-ph5nr", "type": "bus-connection", "interfaceName": "Nausf", "protocol": "HTTP/2", "status": "connected", "createdAt": 1766128449690 },
    { "id": "bus-conn-1766128464421-0g6wj", "nfId": "udm-1766128464413-gtx9n", "busId": "bus-1766128427686-ph5nr", "type": "bus-connection", "interfaceName": "Nudm", "protocol": "HTTP/2", "status": "connected", "createdAt": 1766128464421 },
    { "id": "bus-conn-1766128475150-7tf37", "nfId": "pcf-1766128475142-4f0sr", "busId": "bus-1766128427686-ph5nr", "type": "bus-connection", "interfaceName": "Npcf", "protocol": "HTTP/2", "status": "connected", "createdAt": 1766128475150 },
    { "id": "bus-conn-1766128667621-v1b2g", "nfId": "nssf-1766128667614-7q082", "busId": "bus-1766128427686-ph5nr", "type": "bus-connection", "interfaceName": "Nnssf", "protocol": "HTTP/2", "status": "connected", "createdAt": 1766128667621 },
    { "id": "bus-conn-1766128679039-fl8n5", "nfId": "udr-1766128679032-4s7yw", "busId": "bus-1766128427686-ph5nr", "type": "bus-connection", "interfaceName": "Nudr", "protocol": "HTTP/2", "status": "connected", "createdAt": 1766128679039 }
  ]
};
    }



    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Toggle log panel visibility
     */
    toggleLogPanel() {
        const logPanel = document.getElementById('log-panel');
        const toggleIcon = document.getElementById('toggle-icon');

        if (!logPanel || !toggleIcon) return;

        const isCollapsed = logPanel.classList.contains('collapsed');

        if (isCollapsed) {
            // Show logs
            logPanel.classList.remove('collapsed');
            toggleIcon.textContent = '▼';
            console.log('📋 Log panel expanded');
        } else {
            // Hide logs
            logPanel.classList.add('collapsed');
            toggleIcon.textContent = '▲';
            console.log('📋 Log panel collapsed');
        }

        // Trigger canvas resize after panel toggle animation completes
        setTimeout(() => {
            if (window.canvasRenderer) {
                window.canvasRenderer.resizeCanvas();
            }
        }, 350); // Wait for CSS transition to complete (300ms + buffer)
    }

    /**
     * Setup configuration panel toggle
     */
    setupConfigPanelToggle() {
        const toggleBtn = document.getElementById('btn-toggle-config');
        
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleConfigPanel());
            console.log('✅ Config panel toggle initialized');
        } else {
            console.warn('⚠️ Config panel toggle button not found');
        }
    }

    /**
     * Toggle configuration panel visibility
     */
    toggleConfigPanel() {
        const sidebar = document.querySelector('.sidebar-right');
        const toggleIcon = document.getElementById('config-toggle-icon');

        if (!sidebar || !toggleIcon) return;

        const isCollapsed = sidebar.classList.contains('collapsed');

        if (isCollapsed) {
            // Show config panel
            sidebar.classList.remove('collapsed');
            toggleIcon.textContent = '◀';
            console.log('⚙️ Config panel expanded');
        } else {
            // Hide config panel
            sidebar.classList.add('collapsed');
            toggleIcon.textContent = '▶';
            console.log('⚙️ Config panel collapsed');
        }

        // Trigger canvas resize after panel toggle animation completes
        setTimeout(() => {
            if (window.canvasRenderer) {
                window.canvasRenderer.resizeCanvas();
            }
        }, 350); // Wait for CSS transition to complete (300ms + buffer)
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + L to toggle logs
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                this.toggleLogPanel();
            }

            // Ctrl/Cmd + K to toggle config panel
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.toggleConfigPanel();
            }

            // F1 or Ctrl/Cmd + H to show help
            if (e.key === 'F1' || ((e.ctrlKey || e.metaKey) && e.key === 'h')) {
                e.preventDefault();
                this.showHelpModal();
            }
        });

        console.log('⌨️ Keyboard shortcuts initialized (Ctrl+L: Toggle logs, Ctrl+K: Toggle config, F1/Ctrl+H: Help)');
    }




    /**
     * Setup ping troubleshooting handlers
     * @param {string} nfId - NF ID
     */
    setupPingTroubleshootingHandlers(nfId) {
        const terminalBtn = document.getElementById('btn-open-terminal');
        const pingHistoryBtn = document.getElementById('btn-ping-history');

        if (terminalBtn) {
            terminalBtn.addEventListener('click', () => {
                this.openWindowsTerminal(nfId);
            });
        }

        if (pingHistoryBtn) {
            pingHistoryBtn.addEventListener('click', () => {
                this.showPingHistory(nfId);
            });
        }
    }

    /**
     * Execute ping to specific target IP
     * @param {string} nfId - Source NF ID
     */
    async executePingTarget(nfId) {
        const targetIP = document.getElementById('ping-target-ip')?.value?.trim();
        
        if (!targetIP) {
            alert('Please enter a target IP address');
            return;
        }

        // Validate IP format
        if (!this.isValidIP(targetIP)) {
            alert('Please enter a valid IP address (e.g., 192.168.1.20)');
            return;
        }

        const nf = window.dataStore?.getNFById(nfId);
        if (!nf) return;

        // Check if ping is already active
        if (window.pingManager && window.pingManager.isPingActive(nfId)) {
            alert('Ping is already in progress. Please wait for it to complete.');
            return;
        }

        console.log(`🏓 Executing ping from ${nf.name} to ${targetIP}`);

        // Disable button during ping
        const btn = document.getElementById('btn-ping-target');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '🏓 Pinging...';
        }

        try {
            if (window.pingManager) {
                await window.pingManager.executePing(nfId, targetIP, 4);
            } else {
                console.error('❌ PingManager not available');
                alert('Ping functionality not available');
            }
        } catch (error) {
            console.error('❌ Ping error:', error);
            if (window.logEngine) {
                window.logEngine.addLog(nfId, 'ERROR', `Ping failed: ${error.message}`);
            }
        } finally {
            // Re-enable button
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🏓 Ping Target IP';
            }
        }
    }

    /**
     * Execute ping to all network services
     * @param {string} nfId - Source NF ID
     */
    async executePingNetwork(nfId) {
        const nf = window.dataStore?.getNFById(nfId);
        if (!nf) return;

        // Check if ping is already active
        if (window.pingManager && window.pingManager.isPingActive(nfId)) {
            alert('Ping is already in progress. Please wait for it to complete.');
            return;
        }

        console.log(`📡 Executing network ping from ${nf.name}`);

        // Disable button during ping
        const btn = document.getElementById('btn-ping-network');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '📡 Scanning Network...';
        }

        try {
            if (window.pingManager) {
                await window.pingManager.pingNetworkServices(nfId);
            } else {
                console.error('❌ PingManager not available');
                alert('Ping functionality not available');
            }
        } catch (error) {
            console.error('❌ Network ping error:', error);
            if (window.logEngine) {
                window.logEngine.addLog(nfId, 'ERROR', `Network ping failed: ${error.message}`);
            }
        } finally {
            // Re-enable button
            if (btn) {
                btn.disabled = false;
                btn.textContent = '📡 Ping Network Services';
            }
        }
    }

    /**
     * Show ping history for NF
     * @param {string} nfId - NF ID
     */
    showPingHistory(nfId) {
        const nf = window.dataStore?.getNFById(nfId);
        if (!nf) return;

        if (!window.pingManager) {
            alert('Ping functionality not available');
            return;
        }

        const history = window.pingManager.getPingHistory(nfId);
        
        if (history.length === 0) {
            alert(`No ping history available for ${nf.name}\n\nExecute some ping commands first to see history.`);
            return;
        }

        let historyText = `═══════════════════════════════════\n`;
        historyText += `PING HISTORY FOR ${nf.name}\n`;
        historyText += `═══════════════════════════════════\n\n`;

        history.slice(-10).forEach((entry, index) => {
            const timestamp = new Date(entry.timestamp).toLocaleString();
            historyText += `${index + 1}. ${timestamp}\n`;
            historyText += `   Target: ${entry.targetIP}\n`;
            historyText += `   Result: ${entry.summary.received}/${entry.summary.sent} packets received (${entry.summary.lossPercentage}% loss)\n\n`;
        });

        historyText += `═══════════════════════════════════\n`;
        historyText += `Total ping sessions: ${history.length}\n`;
        historyText += `Showing last ${Math.min(10, history.length)} sessions\n`;
        historyText += `═══════════════════════════════════`;

        alert(historyText);
    }

    /**
     * Open Windows-style terminal for NF
     * @param {string} nfId - NF ID
     */
    openWindowsTerminal(nfId) {
        const nf = window.dataStore?.getNFById(nfId);
        if (!nf) return;

        // Terminal constraints: allow at most two windows (UE + ext-dn combo)
        const openWindows = Array.from(document.querySelectorAll('.windows-terminal-window'));
        const typesOpen = new Set(openWindows.map(w => w.dataset.terminalType));
        const isUEorExt = nf.type === 'UE' || nf.type === 'ext-dn';
        if (isUEorExt) {
            if (typesOpen.size >= 2) {
                alert('Only two terminals allowed at once: one UE and one ext-dn.');
                return;
            }
            if (typesOpen.size === 1) {
                const existing = [...typesOpen][0];
                if (existing === nf.type) {
                    alert(`Second terminal must be the other type (${nf.type === 'UE' ? 'ext-dn' : 'UE'}).`);
                    return;
                }
            }
        }

        // Create terminal modal
        this.createTerminalModal(nf);
    }

    /**
     * Create Windows-style terminal modal
     * @param {Object} nf - Network Function
     */
    createTerminalModal(nf) {
        // Unique modal per NF
        const modalId = `windows-terminal-modal-${nf.id}`;
        if (document.getElementById(modalId)) {
            // Focus existing by bringing to front
            const existing = document.getElementById(modalId);
            existing.style.zIndex = String(2000 + Date.now() % 1000);
            return;
        }

        // Create terminal modal
        const terminalModal = document.createElement('div');
        terminalModal.id = modalId;
        terminalModal.className = 'windows-terminal-modal';
        
        terminalModal.innerHTML = `
            <div class="windows-terminal-window" data-terminal-type="${nf.type}" style="position:absolute; left: 10vw; top: 10vh;">
                <div class="windows-terminal-titlebar">
                    <div class="terminal-title">
                        <span class="terminal-icon">⬛</span>
                        Command Prompt - ${nf.name} (${nf.config.ipAddress})
                    </div>
                    <div class="terminal-controls">
                        <button class="terminal-btn close" id="terminal-close">×</button>
                    </div>
                </div>
                <div class="windows-terminal-content" id="terminal-content">
                    
                    <div class="terminal-output" id="terminal-output">
                        <div class="terminal-input-line terminal-active-input">
                            <span class="terminal-prompt">C:\\${nf.name}></span>
                            <input type="text" id="terminal-input" class="terminal-input" autocomplete="off" spellcheck="false">
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(terminalModal);

        // Setup terminal functionality
        this.setupWindowsTerminal(nf, terminalModal);

        // Show terminal with animation
        setTimeout(() => {
            terminalModal.classList.add('show');
        }, 10);

        // Focus on input
        const input = document.getElementById('terminal-input');
        if (input) {
            input.focus();
        }
    }

    /**
     * Setup Windows terminal functionality
     * @param {Object} nf - Network Function
     * @param {HTMLElement} terminalModal - Terminal modal element
     */
    setupWindowsTerminal(nf, terminalModal) {
        const win = terminalModal.querySelector('.windows-terminal-window');
        const input = terminalModal.querySelector('#terminal-input');
        const output = terminalModal.querySelector('#terminal-output');
        const closeBtn = terminalModal.querySelector('#terminal-close');
        
        let commandHistory = [];
        let historyIndex = -1;
        let tabState = { lastInput: null, showedList: false };

        const nfCommands = [
            'help',
            'ipconfig',
            'ifconfig',
            'ip addr',
            'systeminfo',
            'netstat',
            'cls',
            'clear',
            'exit',
            'ping ',
            'ping subnet',
            'iperf3 -s',
            'iperf3 -B ',
        ];

        const lcpFn = (strings) => {
            if (!strings.length) return '';
            let prefix = strings[0];
            for (let i = 1; i < strings.length; i++) {
                while (!strings[i].startsWith(prefix)) {
                    prefix = prefix.slice(0, -1);
                    if (!prefix) return '';
                }
            }
            return prefix;
        };

        // Close button - cleanup iperf3 server if running
        closeBtn.addEventListener('click', () => {
            // Stop iperf3 server if running
            if (this.iperf3Servers.has(nf.id)) {
                this.iperf3Servers.delete(nf.id);
            }
            
            terminalModal.classList.remove('show');
            setTimeout(() => {
                terminalModal.remove();
            }, 300);
        });

        // Make window draggable by titlebar
        const titlebar = terminalModal.querySelector('.windows-terminal-titlebar');
        let dragging = false, dx = 0, dy = 0;
        titlebar.addEventListener('mousedown', (e) => {
            dragging = true;
            dx = e.clientX - win.offsetLeft;
            dy = e.clientY - win.offsetTop;
            document.body.style.userSelect = 'none';
        });
        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            win.style.left = `${e.clientX - dx}px`;
            win.style.top = `${e.clientY - dy}px`;
        });
        document.addEventListener('mouseup', () => {
            dragging = false;
            document.body.style.userSelect = '';
        });

        // Resizer (bottom-right)
        let resizer = win.querySelector('.terminal-resizer');
        if (!resizer) {
            resizer = document.createElement('div');
            resizer.className = 'terminal-resizer';
            win.appendChild(resizer);
        }
        let resizing = false, sw = 0, sh = 0, sx = 0, sy = 0;
        resizer.addEventListener('mousedown', (e) => {
            resizing = true;
            sw = win.offsetWidth;
            sh = win.offsetHeight;
            sx = e.clientX;
            sy = e.clientY;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!resizing) return;
            const w = Math.max(600, sw + (e.clientX - sx));
            const h = Math.max(380, sh + (e.clientY - sy));
            win.style.width = `${w}px`;
            win.style.height = `${h}px`;
        });
        document.addEventListener('mouseup', () => {
            resizing = false;
        });

        // Input handling
        input.addEventListener('keydown', async (e) => {
            // Handle Ctrl+C to stop iperf3 server
            if (e.ctrlKey && e.key === 'c' && this.iperf3Servers.has(nf.id)) {
                e.preventDefault();
                this.stopIperf3Server(nf, output);
                input.value = '';
                return;
            }

            if (e.key === 'Tab') {
                e.preventDefault();
                const currentVal = input.value;
                const matches = nfCommands.filter(c => c.startsWith(currentVal) && c !== currentVal);

                if (matches.length === 0) return;

                if (matches.length === 1) {
                    input.value = matches[0];
                    tabState = { lastInput: null, showedList: false };
                    return;
                }

                let lcp = matches[0];
                for (let i = 1; i < matches.length; i++) {
                    while (!matches[i].startsWith(lcp)) lcp = lcp.slice(0, -1);
                }

                if (lcp.length > currentVal.length) {
                    input.value = lcp;
                    tabState = { lastInput: null, showedList: false };
                    return;
                }

                if (tabState.lastInput === currentVal) return;

                this.addTerminalLine(output, `C:\\${nf.name}>${currentVal}`, 'command');
                const splitPoint = lcp.lastIndexOf(' ') + 1;
                const options = [...new Set(
                    matches.map(m => {
                        const token = m.slice(splitPoint);
                        const end = token.indexOf(' ');
                        return end === -1 ? token : token.slice(0, end);
                    })
                )].filter(Boolean);
                this.addTerminalLine(output, options.join('    '), 'info');
                tabState = { lastInput: currentVal, showedList: true };
                return;
            }

            if (e.key !== 'Tab') {
                tabState = { lastInput: null, showedList: false };
            }

            if (e.key === 'Enter') {
                const command = input.value.trim();
                if (command) {
                    // Add to history
                    commandHistory.push(command);
                    historyIndex = commandHistory.length;

                    this.addTerminalLine(output, `C:\\${nf.name}>${command}`, 'command');

                    const promptLine = output.querySelector('.terminal-active-input');
                    if (promptLine) promptLine.style.display = 'none';

                    input.value = '';

                    await this.processWindowsCommand(nf, command, output);

                    if (promptLine) promptLine.style.display = 'flex';
                    input.focus();
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (historyIndex > 0) {
                    historyIndex--;
                    input.value = commandHistory[historyIndex];
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (historyIndex < commandHistory.length - 1) {
                    historyIndex++;
                    input.value = commandHistory[historyIndex];
                } else {
                    historyIndex = commandHistory.length;
                    input.value = '';
                }
            }
        });

        // Initial welcome message
        this.addTerminalLine(output, `Connected to ${nf.name} (${nf.config.ipAddress})`, 'info');
        this.addTerminalLine(output, 'Type "help" for available commands.', 'info');
        this.addTerminalLine(output, '', 'blank');
    }

    /**
     * Process Windows command
     * @param {Object} nf - Network Function
     * @param {string} command - Command to process
     * @param {HTMLElement} output - Output element
     */
    async processWindowsCommand(nf, command, output) {
        const cmd = command.toLowerCase().trim();
        const args = command.split(' ');

        if (cmd === 'help' || cmd === '?') {
            this.showWindowsHelp(output);
        } else if (cmd === 'ipconfig') {
            this.showIPConfig(nf, output);
        } else if (cmd.startsWith('ping ')) {
            const target = args[1];
            if (target) {
                await this.executeWindowsPing(nf, target, output);
            } else {
                this.addTerminalLine(output, 'Usage: ping <hostname or IP address>', 'error');
            }
        } else if (cmd === 'ping subnet') {
            await this.executeWindowsPingSubnet(nf, output);
        } else if (cmd === 'cls' || cmd === 'clear') {
            const activeInputLine = output.querySelector('.terminal-active-input');
            output.innerHTML = '';
            if (activeInputLine) {
                output.appendChild(activeInputLine);
            }
        } else if (cmd === 'exit') {
            const closeBtn = document.getElementById('terminal-close');
            if (closeBtn) closeBtn.click();
        } else if (cmd === 'systeminfo') {
            this.showSystemInfo(nf, output);
        } else if (cmd === 'netstat') {
            this.showNetstat(nf, output);
        } else if (cmd === 'ifconfig' || cmd === 'ip addr') {
            this.showIfConfig(nf, output);
        } else if (cmd.startsWith('iperf3 ')) {
            await this.processIperf3Command(nf, command, output);
        } else if (cmd === '') {
            // Empty command, just show prompt
        } else {
            this.addTerminalLine(output, `'${command}' is not recognized as an internal or external command,`, 'error');
            this.addTerminalLine(output, 'operable program or batch file.', 'error');
        }

        this.addTerminalLine(output, '', 'blank');
    }

    /**
     * Add line to terminal output
     * @param {HTMLElement} output - Output element
     * @param {string} text - Text to add
     * @param {string} type - Line type (command, info, error, success, blank)
     */
    addTerminalLine(output, text, type = 'normal') {
        const line = document.createElement('div');
        line.className = `terminal-line terminal-${type}`;
        line.innerHTML = text || '&nbsp;';

        const activeInputLine = output.querySelector('.terminal-active-input');
        if (activeInputLine) {
            output.insertBefore(line, activeInputLine);
        } else {
            output.appendChild(line);
        }
        
        // Auto-scroll to bottom
        output.scrollTop = output.scrollHeight;
    }

    /**
     * Show Windows help
     * @param {HTMLElement} output - Output element
     */
    showWindowsHelp(output) {
        const helpText = [
            'Quick Procedures:',
            '',
            '  ping <IP>        - Test connectivity to an IP',
            '  ping subnet      - Ping all NFs in the subnet',
            '  ipconfig         - Show network config',
            '  ifconfig         - Show interfaces (Linux style)',
            '  netstat          - Show network connections',
            '  systeminfo       - Show system info',
            '  iperf3 -s        - Start iperf3 server (ext-dn only)',
            '  iperf3 -B <UE_IP> -c <EXT_DN_IP> - Run iperf3 client (UE only)',
            '  cls              - Clear screen',
            '  exit             - Close terminal',
            '',
        ];

        helpText.forEach(line => {
            this.addTerminalLine(output, line, 'info');
        });

        
    }

    /**
     * Show IP configuration
     * @param {Object} nf - Network Function
     * @param {HTMLElement} output - Output element
     */
    showIPConfig(nf, output) {
        const lines = [
            'Windows IP Configuration',
            '',
            'Ethernet adapter Local Area Connection:',
            '',
            `   Connection-specific DNS Suffix  . : 5g.local`,
            `   IPv4 Address. . . . . . . . . . . : ${nf.config.ipAddress}`,
            `   Subnet Mask . . . . . . . . . . . : 255.255.255.0`,
            `   Default Gateway . . . . . . . . . : 192.168.1.1`,
            `   DNS Servers . . . . . . . . . . . : 8.8.8.8`,
            `                                       8.8.4.4`,
            ''
        ];

        lines.forEach(line => {
            this.addTerminalLine(output, line, 'info');
        });

        // Show ogstun interface for UPF
        if (nf.type === 'UPF' && nf.config.ogstunInterface) {
            const ogstun = nf.config.ogstunInterface;
            const tunLines = [
                'Tunnel adapter ogstun (tun0):',
                '',
                `   Connection-specific DNS Suffix  . : `,
                `   IPv4 Address. . . . . . . . . . . : ${ogstun.ipAddress}`,
                `   Subnet Mask . . . . . . . . . . . : ${ogstun.netmask}`,
                `   Default Gateway . . . . . . . . . : ${ogstun.gatewayIP}`,
                `   MTU . . . . . . . . . . . . . . . : ${ogstun.mtu}`,
                `   Flags . . . . . . . . . . . . . . : ${ogstun.flags}`,
                `   IPv6 Address. . . . . . . . . . . : ${ogstun.ipv6}`,
                ''
            ];
            tunLines.forEach(line => {
                this.addTerminalLine(output, line, 'info');
            });
        }

        // Show tun interface for UE
        if (nf.type === 'UE' && nf.config.tunInterface) {
            const tun = nf.config.tunInterface;
            const tunLines = [
                `Tunnel adapter ${tun.name}:`,
                '',
                `   Connection-specific DNS Suffix  . : `,
                `   IPv4 Address. . . . . . . . . . . : ${tun.ipAddress}`,
                `   Subnet Mask . . . . . . . . . . . : ${tun.netmask}`,
                `   Default Gateway . . . . . . . . . : ${tun.gateway}`,
                `   MTU . . . . . . . . . . . . . . . : ${tun.mtu}`,
                `   Flags . . . . . . . . . . . . . . : ${tun.flags}`,
                `   IPv6 Address. . . . . . . . . . . : ${tun.ipv6}`,
                `   Destination . . . . . . . . . . . : ${tun.destination}`,
                ''
            ];
            tunLines.forEach(line => {
                this.addTerminalLine(output, line, 'info');
            });
        }
    }

    /**
     * Show Linux-style ifconfig output
     * @param {Object} nf - Network Function
     * @param {HTMLElement} output - Output element
     */
    showIfConfig(nf, output) {
        // Show eth0 interface (main IP)
        const eth0Lines = [
            `eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500`,
            `        inet ${nf.config.ipAddress}  netmask 255.255.255.0  broadcast ${this.getBroadcastIP(nf.config.ipAddress)}`,
            `        inet6 fe80::${Math.floor(Math.random() * 65535).toString(16).padStart(4, '0')}:${Math.floor(Math.random() * 65535).toString(16).padStart(4, '0')}:${Math.floor(Math.random() * 65535).toString(16).padStart(4, '0')}:${Math.floor(Math.random() * 65535).toString(16).padStart(4, '0')}  prefixlen 64  scopeid 0x20<link>`,
            `        ether ${this.generateMACAddress()}  txqueuelen 1000  (Ethernet)`,
            `        RX packets ${Math.floor(Math.random() * 10000) + 1000}  bytes ${Math.floor(Math.random() * 1000000) + 100000} (${(Math.random() * 100).toFixed(1)} KB)`,
            `        RX errors 0  dropped 0  overruns 0  frame 0`,
            `        TX packets ${Math.floor(Math.random() * 10000) + 1000}  bytes ${Math.floor(Math.random() * 1000000) + 100000} (${(Math.random() * 100).toFixed(1)} KB)`,
            `        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0`,
            ''
        ];
        eth0Lines.forEach(line => {
            this.addTerminalLine(output, line, 'info');
        });

        // Show tun0 interface for UPF (when connected to ext-dn)
        if (nf.type === 'UPF' && nf.config.tun0Interface) {
            const tun0 = nf.config.tun0Interface;
            const flagsValue = 4305; // UP,POINTOPOINT,RUNNING,NOARP,MULTICAST
            const tun0Lines = [
                `tun0: flags=${flagsValue}<UP,POINTOPOINT,RUNNING,NOARP,MULTICAST>  mtu 1500`,
                `        inet ${tun0.ipAddress}  netmask ${tun0.netmask}  destination ${tun0.ipAddress}`,
                `        inet6 fe80::${Math.floor(Math.random() * 65535).toString(16).padStart(4, '0')}:${Math.floor(Math.random() * 65535).toString(16).padStart(4, '0')}:${Math.floor(Math.random() * 65535).toString(16).padStart(4, '0')}:${Math.floor(Math.random() * 65535).toString(16).padStart(4, '0')}  prefixlen 64  scopeid 0x20<link>`,
                `        unspec 00-00-00-00-00-00-00-00-00-00-00-00-00-00-00-00  txqueuelen 500  (UNSPEC)`,
                `        RX packets ${Math.floor(Math.random() * 100)}  bytes ${Math.floor(Math.random() * 10000)} (${(Math.random() * 10).toFixed(1)} KB)`,
                `        RX errors 0  dropped 0  overruns 0  frame 0`,
                `        TX packets ${Math.floor(Math.random() * 100) + 5}  bytes ${Math.floor(Math.random() * 1000) + 300} (${(Math.random() * 1).toFixed(1)} KB)`,
                `        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0`,
                ''
            ];
            tun0Lines.forEach(line => {
                this.addTerminalLine(output, line, 'info');
            });
        }

        // Show tun_ue interface for UE (when PDU session is established)
        if (nf.type === 'UE' && nf.config.tunInterface && nf.config.pduSession) {
            const tun = nf.config.tunInterface;
            const flagsValue = 4305; // UP,POINTOPOINT,RUNNING,NOARP,MULTICAST
            const tunLines = [
                `${tun.name}: flags=${flagsValue}<UP,POINTOPOINT,RUNNING,NOARP,MULTICAST>  mtu ${tun.mtu}`,
                `        inet ${tun.ipAddress}  netmask ${tun.netmask}  destination ${tun.destination}`,
                `        inet6 ${tun.ipv6}  prefixlen 64  scopeid 0x20<link>`,
                `        unspec 00-00-00-00-00-00-00-00-00-00-00-00-00-00-00-00  txqueuelen 500  (UNSPEC)`,
                `        RX packets ${Math.floor(Math.random() * 100)}  bytes ${Math.floor(Math.random() * 10000)} (${(Math.random() * 10).toFixed(1)} KB)`,
                `        RX errors 0  dropped 0  overruns 0  frame 0`,
                `        TX packets ${Math.floor(Math.random() * 100) + 5}  bytes ${Math.floor(Math.random() * 1000) + 300} (${(Math.random() * 1).toFixed(1)} KB)`,
                `        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0`,
                ''
            ];
            tunLines.forEach(line => {
                this.addTerminalLine(output, line, 'info');
            });
        }
    }

    /**
     * Generate MAC address
     * @returns {string} MAC address
     */
    generateMACAddress() {
        const parts = [];
        for (let i = 0; i < 6; i++) {
            parts.push(Math.floor(Math.random() * 256).toString(16).padStart(2, '0'));
        }
        return parts.join(':');
    }

    /**
     * Get broadcast IP from IP address
     * @param {string} ip - IP address
     * @returns {string} Broadcast IP
     */
    getBroadcastIP(ip) {
        const parts = ip.split('.');
        return `${parts[0]}.${parts[1]}.${parts[2]}.255`;
    }

    /**
     * Execute Windows-style ping with subnet restrictions
     * @param {Object} nf - Network Function
     * @param {string} target - Target IP or hostname
     * @param {HTMLElement} output - Output element
     */
    async executeWindowsPing(nf, target, output) {
        // Validate IP
        if (!this.isValidIP(target)) {
            this.addTerminalLine(output, `Ping request could not find host ${target}. Please check the name and try again.`, 'error');
            return;
        }

        // SPECIAL CASE: UE can ping its gateway (10.0.0.1) via tun interface
        if (nf.type === 'UE' && nf.config.tunInterface && target === nf.config.tunInterface.gateway) {
            this.addTerminalLine(output, `Pinging ${target} (UPF Gateway) with 32 bytes of data:`, 'info');
            this.addTerminalLine(output, '', 'blank');
            
            // Simulate successful ping to gateway
            for (let i = 0; i < 4; i++) {
                await this.delay(500);
                const time = Math.floor(Math.random() * 10) + 1;
                this.addTerminalLine(output, `Reply from ${target}: bytes=32 time=${time}ms TTL=64`, 'success');
            }
            
            this.addTerminalLine(output, '', 'blank');
            this.addTerminalLine(output, `Ping statistics for ${target}:`, 'info');
            this.addTerminalLine(output, `    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),`, 'info');
            this.addTerminalLine(output, `Approximate round trip times in milli-seconds:`, 'info');
            this.addTerminalLine(output, `    Minimum = 1ms, Maximum = 10ms, Average = 5ms`, 'info');
            return;
        }

        // SPECIAL CASE: UE can ping other IPs in 10.0.0.0/24 network via tun interface
        if (nf.type === 'UE' && nf.config.tunInterface) {
            const tunNetwork = this.getNetworkFromIP(nf.config.tunInterface.ipAddress);
            const targetNetwork = this.getNetworkFromIP(target);
            
            if (tunNetwork === targetNetwork) {
                // UE can ping within ogstun network
                this.addTerminalLine(output, `Pinging ${target} via ${nf.config.tunInterface.name} with 32 bytes of data:`, 'info');
                this.addTerminalLine(output, '', 'blank');
                
                // Use ping manager for realistic ping
                if (window.pingManager) {
                    await window.pingManager.executePing(nf.id, target, 4);
                }
                return;
            }
        }

        // Check subnet restriction FIRST
        const sourceNetwork = this.getNetworkFromIP(nf.config.ipAddress);
        const targetNetwork = this.getNetworkFromIP(target);
        
        if (sourceNetwork !== targetNetwork) {
            this.addTerminalLine(output, `Pinging ${target} with 32 bytes of data:`, 'info');
            this.addTerminalLine(output, '', 'blank');
            this.addTerminalLine(output, `PING: transmit failed. General failure.`, 'error');
            this.addTerminalLine(output, '', 'blank');
            this.addTerminalLine(output, `Network Error: Cannot reach ${target}`, 'error');
            this.addTerminalLine(output, `Source subnet: ${sourceNetwork}.0/24`, 'error');
            this.addTerminalLine(output, `Target subnet: ${targetNetwork}.0/24`, 'error');
            this.addTerminalLine(output, `Reason: Cross-subnet communication not allowed`, 'error');
            this.addTerminalLine(output, '', 'blank');
            this.addTerminalLine(output, `Ping statistics for ${target}:`, 'info');
            this.addTerminalLine(output, `    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss),`, 'info');
            return;
        }

        // Initial ping message
        this.addTerminalLine(output, `Pinging ${target} with 32 bytes of data:`, 'info');
        this.addTerminalLine(output, '', 'blank');

        // Check if target is reachable (same subnet)
        const isReachable = this.isTargetReachable(nf, target);
        const results = [];

        // Send 4 ping packets with 0.5 second delays
        for (let i = 1; i <= 4; i++) {
            await this.delay(500); // 0.5 second delay

            if (isReachable) {
                const responseTime = this.generateResponseTime();
                const ttl = 255;
                
                results.push({
                    sequence: i,
                    time: responseTime,
                    ttl: ttl,
                    success: true
                });

                this.addTerminalLine(output, 
                    `Reply from ${target}: bytes=32 time=${responseTime}ms TTL=${ttl}`, 
                    'success'
                );
            } else {
                await this.delay(500); // Additional delay for timeout
                
                results.push({
                    sequence: i,
                    success: false,
                    timeout: true
                });

                this.addTerminalLine(output, 'Request timed out.', 'error');
            }
        }

        // Show statistics after final delay
        await this.delay(500);
        this.showPingStatistics(target, results, output);
    }

    /**
     * Execute ping subnet with detailed subnet information
     * @param {Object} nf - Network Function
     * @param {HTMLElement} output - Output element
     */
    async executeWindowsPingSubnet(nf, output) {
        const sourceNetwork = this.getNetworkFromIP(nf.config.ipAddress);
        const allNFs = window.dataStore?.getAllNFs() || [];
        
        // Find services in the same subnet only
        const sameSubnetServices = allNFs.filter(otherNf => 
            otherNf.id !== nf.id && 
            this.getNetworkFromIP(otherNf.config.ipAddress) === sourceNetwork
        );

        // Show subnet scan header
        this.addTerminalLine(output, `Subnet Scan: ${sourceNetwork}.0/24`, 'info');
        this.addTerminalLine(output, `Source: ${nf.name} (${nf.config.ipAddress})`, 'info');
        this.addTerminalLine(output, `Restriction: Only same-subnet services can be pinged`, 'info');
        this.addTerminalLine(output, '', 'blank');

        if (sameSubnetServices.length === 0) {
            this.addTerminalLine(output, `No other services found in subnet ${sourceNetwork}.0/24`, 'error');
            this.addTerminalLine(output, `Add more services with IPs in range ${sourceNetwork}.1-${sourceNetwork}.254`, 'info');
            return;
        }

        this.addTerminalLine(output, `Found ${sameSubnetServices.length} services in subnet ${sourceNetwork}.0/24:`, 'info');
        
        // List all services in subnet first
        sameSubnetServices.forEach(targetNf => {
            const statusIcon = targetNf.status === 'stable' ? '✅' : '⚠️';
            this.addTerminalLine(output, `  ${statusIcon} ${targetNf.name} (${targetNf.config.ipAddress}) [${targetNf.status.toUpperCase()}]`, 'info');
        });
        
        this.addTerminalLine(output, '', 'blank');
        this.addTerminalLine(output, 'Starting connectivity tests...', 'info');
        this.addTerminalLine(output, '', 'blank');

        // Test each service
        for (const targetNf of sameSubnetServices) {
            const statusInfo = targetNf.status === 'stable' ? 'STABLE' : targetNf.status.toUpperCase();
            this.addTerminalLine(output, `Testing ${targetNf.name} (${targetNf.config.ipAddress}) [${statusInfo}]`, 'info');
            await this.executeWindowsPing(nf, targetNf.config.ipAddress, output);
            this.addTerminalLine(output, '', 'blank');
            await this.delay(200);
        }

        // Summary
        this.addTerminalLine(output, '═══════════════════════════════════════', 'info');
        this.addTerminalLine(output, `Subnet scan completed for ${sourceNetwork}.0/24`, 'success');
        this.addTerminalLine(output, `Total services tested: ${sameSubnetServices.length}`, 'info');
        this.addTerminalLine(output, `Stable services: ${sameSubnetServices.filter(nf => nf.status === 'stable').length}`, 'info');
        this.addTerminalLine(output, `Unstable services: ${sameSubnetServices.filter(nf => nf.status !== 'stable').length}`, 'info');
        this.addTerminalLine(output, '═══════════════════════════════════════', 'info');
    }

    /**
     * Show ping statistics
     * @param {string} target - Target IP
     * @param {Array} results - Ping results
     * @param {HTMLElement} output - Output element
     */
    showPingStatistics(target, results, output) {
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        const lossPercentage = Math.round((failed.length / results.length) * 100);

        this.addTerminalLine(output, '', 'blank');
        this.addTerminalLine(output, `Ping statistics for ${target}:`, 'info');
        this.addTerminalLine(output, 
            `    Packets: Sent = ${results.length}, Received = ${successful.length}, Lost = ${failed.length} (${lossPercentage}% loss),`, 
            'info'
        );

        if (successful.length > 0) {
            const times = successful.map(r => r.time);
            const min = Math.min(...times);
            const max = Math.max(...times);
            const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);

            this.addTerminalLine(output, 'Approximate round trip times in milli-seconds:', 'info');
            this.addTerminalLine(output, 
                `    Minimum = ${min}ms, Maximum = ${max}ms, Average = ${avg}ms`, 
                'info'
            );
        }
    }

    /**
     * Show directory listing
     * @param {HTMLElement} output - Output element
     */
   

    /**
     * Show system information
     * @param {Object} nf - Network Function
     * @param {HTMLElement} output - Output element
     */
    showSystemInfo(nf, output) {
        const uptime = window.nfManager?.getServiceUptime(nf) || 'Unknown';
        const lines = [
            'Host Name:                 ' + nf.name,
            'Network Card:              5G Service Interface',
            '                          Connection Name: Local Area Connection',
            `                          IP Address:      ${nf.config.ipAddress}`,
            `                          Port:            ${nf.config.port}`,
            `                          Protocol:        ${nf.config.httpProtocol}`,
            `System Up Time:            ${uptime}`,
            `Service Status:            ${nf.status.toUpperCase()}`,
            ''
        ];

        lines.forEach(line => {
            this.addTerminalLine(output, line, 'info');
        });
    }

    /**
     * Show network statistics
     * @param {Object} nf - Network Function
     * @param {HTMLElement} output - Output element
     */
    showNetstat(nf, output) {
        const connections = window.dataStore?.getConnectionsForNF(nf.id) || [];
        const busConnections = window.dataStore?.getBusConnectionsForNF(nf.id) || [];
        
        this.addTerminalLine(output, 'Active Connections', 'info');
        this.addTerminalLine(output, '', 'blank');
        this.addTerminalLine(output, '  Proto  Local Address          Foreign Address        State', 'info');

        // Show direct connections
        connections.forEach(conn => {
            const otherNfId = conn.sourceId === nf.id ? conn.targetId : conn.sourceId;
            const otherNf = window.dataStore?.getNFById(otherNfId);
            if (otherNf) {
                this.addTerminalLine(output, 
                    `  TCP    ${nf.config.ipAddress}:${nf.config.port}         ${otherNf.config.ipAddress}:${otherNf.config.port}         ESTABLISHED`, 
                    'info'
                );
            }
        });

        // Show bus connections
        busConnections.forEach(busConn => {
            const bus = window.dataStore?.getBusById(busConn.busId);
            if (bus) {
                this.addTerminalLine(output, 
                    `  TCP    ${nf.config.ipAddress}:${nf.config.port}         ${bus.name}:BUS            ESTABLISHED`, 
                    'info'
                );
            }
        });

        if (connections.length === 0 && busConnections.length === 0) {
            this.addTerminalLine(output, '  No active connections.', 'info');
        }

        this.addTerminalLine(output, '', 'blank');
    }

    /**
     * Helper methods for terminal functionality
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    isTargetReachable(sourceNf, targetIP) {
        const allNFs = window.dataStore?.getAllNFs() || [];
        const targetNf = allNFs.find(nf => nf.config.ipAddress === targetIP);
        
        if (!targetNf) {
            return Math.random() < 0.1; // 10% success for unknown IPs
        }

        const sourceNetwork = this.getNetworkFromIP(sourceNf.config.ipAddress);
        const targetNetwork = this.getNetworkFromIP(targetIP);
        
        if (sourceNetwork !== targetNetwork) {
            return Math.random() < 0.2; // 20% success for different networks
        }

        // Check if both services are stable
        if (sourceNf.status !== 'stable' || targetNf.status !== 'stable') {
            return Math.random() < 0.3; // 30% success if not both stable
        }

        return Math.random() < 0.9; // 90% success for stable same-network services
    }

    getNetworkFromIP(ip) {
        const parts = ip.split('.');
        return `${parts[0]}.${parts[1]}.${parts[2]}`;
    }

    generateResponseTime() {
        const baseTime = Math.random() * 50 + 1;
        const variation = (Math.random() - 0.5) * 10;
        return Math.max(1, Math.round(baseTime + variation));
    }

    /**
     * Get next available IP address automatically
     * @returns {string} Next available IP address
     */
    getNextAvailableIP() {
        const allNFs = window.dataStore?.getAllNFs() || [];
        const usedIPs = new Set(allNFs.map(nf => nf.config.ipAddress));
        
        // Define subnets in priority order
        const subnets = [
            '192.168.1', // Core network functions
            '192.168.2', // User plane functions  
            '192.168.3', // Edge services
            '192.168.4'  // Additional services
        ];

        // Find next available IP in priority order
        for (const subnet of subnets) {
            for (let host = 10; host <= 254; host++) {
                const ip = `${subnet}.${host}`;
                if (!usedIPs.has(ip)) {
                    console.log(`🌐 Auto-assigned next available IP: ${ip}`);
                    return ip;
                }
            }
        }

        // Fallback if all subnets are full
        const randomSubnet = Math.floor(Math.random() * 254) + 1;
        const randomHost = Math.floor(Math.random() * 244) + 10;
        const fallbackIP = `192.168.${randomSubnet}.${randomHost}`;
        
        console.warn(`⚠️ Using fallback IP: ${fallbackIP}`);
        return fallbackIP;
    }

    /**
     * Get next available port number automatically
     * @returns {number} Next available port number
     */
    getNextAvailablePort() {
        const allNFs = window.dataStore?.getAllNFs() || [];
        const usedPorts = new Set(allNFs.map(nf => nf.config.port));
        
        // Find next available port starting from 8080
        for (let port = 8080; port <= 9999; port++) {
            if (!usedPorts.has(port)) {
                console.log(`🔌 Auto-assigned next available port: ${port}`);
                return port;
            }
        }

        // Fallback if all ports are used
        const randomPort = Math.floor(Math.random() * 1000) + 8000;
        console.warn(`⚠️ Using fallback port: ${randomPort}`);
        return randomPort;
    }

    /**
     * Validate IP address format
     * @param {string} ip - IP address to validate
     * @returns {boolean} True if valid IP
     */
    isValidIP(ip) {
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip);
    }

    /**
     * Process iperf3 command
     * @param {Object} nf - Network Function
     * @param {string} command - Full iperf3 command
     * @param {HTMLElement} output - Output element
     */
    async processIperf3Command(nf, command, output) {
        const args = command.split(' ').filter(arg => arg.trim());
        const cmd = args[0].toLowerCase();
        
        // Server mode: iperf3 -s
        if (args.includes('-s') || args.includes('--server')) {
            if (nf.type !== 'ext-dn') {
                this.addTerminalLine(output, 'Error: iperf3 server can only run on ext-dn terminals', 'error');
                return;
            }
            
            // Check if server is already running
            if (this.iperf3Servers.has(nf.id)) {
                this.addTerminalLine(output, 'iperf3 server is already running on port 5201', 'error');
                this.addTerminalLine(output, 'Use Ctrl+C to stop the server', 'info');
                return;
            }
            
            await this.startIperf3Server(nf, output);
            return;
        }
        
        // Client mode: iperf3 -B <UE_IP> -c <EXT_DN_IP> [-R]
        if (args.includes('-c') || args.includes('--client')) {
            if (nf.type !== 'UE') {
                this.addTerminalLine(output, 'Error: iperf3 client can only run on UE terminals', 'error');
                return;
            }
            
            await this.startIperf3Client(nf, args, output);
            return;
        }
        
        // Help or invalid
        this.addTerminalLine(output, 'iperf3: missing or invalid option', 'error');
        this.addTerminalLine(output, 'Usage:', 'info');
        this.addTerminalLine(output, '  Server: iperf3 -s', 'info');
        this.addTerminalLine(output, '  Client: iperf3 -B <UE_IP> -c <EXT_DN_IP> [-R]', 'info');
    }

    /**
     * Start iperf3 server on ext-dn
     * @param {Object} nf - ext-dn Network Function
     * @param {HTMLElement} output - Output element
     */
    async startIperf3Server(nf, output) {
        this.addTerminalLine(output, '-----------------------------------------------------------', 'info');
        this.addTerminalLine(output, 'Server listening on 5201', 'info');
        this.addTerminalLine(output, '-----------------------------------------------------------', 'info');
        this.addTerminalLine(output, '', 'blank');
        
        // Store server state
        this.iperf3Servers.set(nf.id, {
            nf: nf,
            output: output,
            isRunning: true,
            currentTest: null
        });
        
        // Note: Server runs until Ctrl+C (handled separately)
        // The server will handle incoming connections when client connects
    }

    /**
     * Start iperf3 client on UE
     * @param {Object} nf - UE Network Function
     * @param {Array} args - Command arguments
     * @param {HTMLElement} output - Output element
     */
    async startIperf3Client(nf, args, output) {
        // Parse arguments
        const bindIndex = args.indexOf('-B');
        const clientIndex = args.indexOf('-c');
        const reverseFlag = args.includes('-R') || args.includes('--reverse');
        
        if (bindIndex === -1 || clientIndex === -1) {
            this.addTerminalLine(output, 'Error: Missing required arguments', 'error');
            this.addTerminalLine(output, 'Usage: iperf3 -B <UE_IP> -c <EXT_DN_IP> [-R]', 'error');
            return;
        }
        
        const ueIP = args[bindIndex + 1];
        const extDNIP = args[clientIndex + 1];
        
        if (!ueIP || !extDNIP) {
            this.addTerminalLine(output, 'Error: Missing IP addresses', 'error');
            return;
        }
        
        if (!this.isValidIP(ueIP) || !this.isValidIP(extDNIP)) {
            this.addTerminalLine(output, 'Error: Invalid IP address format', 'error');
            return;
        }
        
        // Find ext-dn NF
        const allNFs = window.dataStore?.getAllNFs() || [];
        const extDN = allNFs.find(n => n.type === 'ext-dn' && n.config.ipAddress === extDNIP);
        
        if (!extDN) {
            this.addTerminalLine(output, `Error: ext-dn with IP ${extDNIP} not found`, 'error');
            return;
        }
        
        // Check if server is running on ext-dn
        if (!this.iperf3Servers.has(extDN.id)) {
            this.addTerminalLine(output, `Error: iperf3 server is not running on ${extDNIP}`, 'error');
            this.addTerminalLine(output, 'Please start the server first: iperf3 -s', 'error');
            return;
        }
        
        // Get UE's tun interface IP if PDU session is established
        const ueTunIP = nf.config.tunInterface?.ipAddress;
        if (!ueTunIP) {
            this.addTerminalLine(output, 'Error: UE does not have PDU session established', 'error');
            this.addTerminalLine(output, 'Please register UE and establish PDU session first', 'error');
            return;
        }
        
        // Validate that provided UE IP matches tun interface IP
        if (ueIP !== ueTunIP) {
            this.addTerminalLine(output, `Warning: Provided UE IP (${ueIP}) does not match tun interface IP (${ueTunIP})`, 'error');
            this.addTerminalLine(output, `Using tun interface IP: ${ueTunIP}`, 'info');
        }
        
        // Start the test
        await this.executeIperf3Test(nf, extDN, ueTunIP, extDNIP, reverseFlag, output);
    }

    /**
     * Execute iperf3 test between UE and ext-dn
     * @param {Object} ue - UE Network Function
     * @param {Object} extDN - ext-dn Network Function
     * @param {string} ueIP - UE IP address (from tun interface)
     * @param {string} extDNIP - ext-dn IP address
     * @param {boolean} reverse - True for downlink test
     * @param {HTMLElement} output - UE terminal output
     */
    async executeIperf3Test(ue, extDN, ueIP, extDNIP, reverse, output) {
        // Get ext-dn terminal output
        const extDNModal = document.getElementById(`windows-terminal-modal-${extDN.id}`);
        const extDNOutput = extDNModal?.querySelector('#terminal-output');
        
        if (!extDNOutput) {
            this.addTerminalLine(output, 'Error: ext-dn terminal not found', 'error');
            return;
        }
        
        // Update server state
        const serverState = this.iperf3Servers.get(extDN.id);
        serverState.currentTest = { ue, ueIP, extDNIP, reverse, startTime: Date.now() };
        
        // Generate random port for connection
        const clientPort = Math.floor(Math.random() * 50000) + 10000;
        const serverPort = 5201;
        
        // Client output
        this.addTerminalLine(output, `Connecting to host ${extDNIP}, port ${serverPort}`, 'info');
        
        // Server output
        this.addTerminalLine(extDNOutput, `Accepted connection from ${ue.config.ipAddress}, port ${clientPort}`, 'info');
        
        // Simulate connection delay
        await this.delay(300);
        
        // Client connection established
        this.addTerminalLine(output, `[  5] local ${ueIP} port ${clientPort} connected to ${extDNIP} port ${serverPort}`, 'info');
        
        if (reverse) {
            this.addTerminalLine(output, 'Reverse mode, remote host ' + extDNIP + ' is sending', 'info');
        }
        
        // Server connection established
        this.addTerminalLine(extDNOutput, `[  5] local ${extDNIP} port ${serverPort} connected to ${ue.config.ipAddress} port ${clientPort}`, 'info');
        
        this.addTerminalLine(output, '', 'blank');
        this.addTerminalLine(extDNOutput, '', 'blank');
        
        // Header
        if (reverse) {
            // Server sends in reverse mode
            this.addTerminalLine(extDNOutput, '[ ID] Interval           Transfer     Bitrate         Retr  Cwnd', 'info');
            this.addTerminalLine(output, '[ ID] Interval           Transfer     Bitrate', 'info');
        } else {
            // Client sends in normal mode
            this.addTerminalLine(extDNOutput, '[ ID] Interval           Transfer     Bitrate', 'info');
            this.addTerminalLine(output, '[ ID] Interval           Transfer     Bitrate         Retr  Cwnd', 'info');
        }
        
        // Run test for 10 seconds with 1-second intervals
        const testDuration = 10;
        let totalTransfer = 0;
        let totalBitrate = 0;
        
        for (let i = 0; i < testDuration; i++) {
            await this.delay(1000); // 1 second delay per interval
            
            // Generate realistic throughput values
            const baseBitrate = reverse ? 45 : 20; // Downlink typically higher
            const variance = Math.random() * 10 - 5; // ±5 Mbits/sec variance
            const bitrate = Math.max(5, baseBitrate + variance); // Minimum 5 Mbits/sec
            
            const transfer = (bitrate * 1.0) / 8; // MBytes for 1 second
            totalTransfer += transfer;
            totalBitrate += bitrate;
            
            const transferStr = transfer >= 1 ? `${transfer.toFixed(2)} MBytes` : `${(transfer * 1024).toFixed(0)} KBytes`;
            const bitrateStr = `${bitrate.toFixed(1)} Mbits/sec`;
            
            const interval = `[  5]   ${i.toFixed(2)}-${(i + 1).toFixed(2)}  sec`;
            
            if (reverse) {
                // Server sends
                const cwnd = `${(100 + i * 20 + Math.random() * 50).toFixed(0)} KBytes`;
                this.addTerminalLine(extDNOutput, `${interval}  ${transferStr.padStart(10)}  ${bitrateStr.padStart(12)}    0    ${cwnd}`, 'info');
                // Client receives
                this.addTerminalLine(output, `${interval}  ${transferStr.padStart(10)}  ${bitrateStr.padStart(12)}`, 'info');
            } else {
                // Client sends
                const cwnd = `${(100 + i * 20 + Math.random() * 50).toFixed(0)} KBytes`;
                this.addTerminalLine(output, `${interval}  ${transferStr.padStart(10)}  ${bitrateStr.padStart(12)}    0    ${cwnd}`, 'info');
                // Server receives
                this.addTerminalLine(extDNOutput, `${interval}  ${transferStr.padStart(10)}  ${bitrateStr.padStart(12)}`, 'info');
            }
        }
        
        // Final summary line
        await this.delay(500);
        
        const avgBitrate = totalBitrate / testDuration;
        const totalTransferStr = `${totalTransfer.toFixed(1)} MBytes`;
        const avgBitrateStr = `${avgBitrate.toFixed(1)} Mbits/sec`;
        
        this.addTerminalLine(output, '- - - - - - - - - - - - - - - - - - - - - - - - -', 'info');
        this.addTerminalLine(extDNOutput, '- - - - - - - - - - - - - - - - - - - - - - - - -', 'info');
        
        if (reverse) {
            // Server summary (sender)
            this.addTerminalLine(extDNOutput, `[  5]   0.00-${testDuration.toFixed(2)}  sec  ${totalTransferStr.padStart(10)}  ${avgBitrateStr.padStart(12)}    0             sender`, 'info');
            // Client summary (receiver)
            this.addTerminalLine(output, `[  5]   0.00-${testDuration.toFixed(2)}  sec  ${totalTransferStr.padStart(10)}  ${avgBitrateStr.padStart(12)}    0             sender`, 'info');
            this.addTerminalLine(output, `[  5]   0.00-${testDuration.toFixed(2)}  sec  ${(totalTransfer * 0.95).toFixed(1)} MBytes  ${(avgBitrate * 0.95).toFixed(1)} Mbits/sec                  receiver`, 'info');
            // Server also shows receiver stats
            this.addTerminalLine(extDNOutput, `[  5]   0.00-${testDuration.toFixed(2)}  sec  ${(totalTransfer * 0.95).toFixed(1)} MBytes  ${(avgBitrate * 0.95).toFixed(1)} Mbits/sec                  receiver`, 'info');
        } else {
            // Client summary (sender)
            this.addTerminalLine(output, `[  5]   0.00-${testDuration.toFixed(2)}  sec  ${totalTransferStr.padStart(10)}  ${avgBitrateStr.padStart(12)}    0             sender`, 'info');
            this.addTerminalLine(output, `[  5]   0.00-${testDuration.toFixed(2)}  sec  ${(totalTransfer * 0.95).toFixed(1)} MBytes  ${(avgBitrate * 0.95).toFixed(1)} Mbits/sec                  receiver`, 'info');
            // Server summary (receiver)
            this.addTerminalLine(extDNOutput, `[  5]   0.00-${testDuration.toFixed(2)}  sec  ${totalTransferStr.padStart(10)}  ${avgBitrateStr.padStart(12)}                  receiver`, 'info');
        }
        
        // Server returns to listening
        await this.delay(500);
        this.addTerminalLine(extDNOutput, '', 'blank');
        this.addTerminalLine(extDNOutput, '-----------------------------------------------------------', 'info');
        this.addTerminalLine(extDNOutput, 'Server listening on 5201', 'info');
        this.addTerminalLine(extDNOutput, '-----------------------------------------------------------', 'info');
        
        // Client done
        this.addTerminalLine(output, '', 'blank');
        this.addTerminalLine(output, 'iperf Done.', 'info');
        
        // Clear current test
        serverState.currentTest = null;
    }

    /**
     * Stop iperf3 server
     * @param {Object} nf - Network Function (ext-dn)
     * @param {HTMLElement} output - Output element
     */
    stopIperf3Server(nf, output) {
        if (!this.iperf3Servers.has(nf.id)) {
            this.addTerminalLine(output, 'No iperf3 server is running', 'error');
            return;
        }
        
        const serverState = this.iperf3Servers.get(nf.id);
        
        // If test is running, wait for it to complete
        if (serverState.currentTest) {
            this.addTerminalLine(output, 'Test in progress. Please wait for test to complete.', 'info');
            return;
        }
        
        // Stop server
        this.iperf3Servers.delete(nf.id);
        this.addTerminalLine(output, '', 'blank');
        this.addTerminalLine(output, '^C', 'info');
        this.addTerminalLine(output, '', 'blank');
        this.addTerminalLine(output, 'iperf3 server stopped', 'info');
    }

    /**
     * Delay helper function
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Validate UE against UDR subscriber information
     * @param {string} ueId - UE ID
     */
    validateUEAgainstUDR(ueId) {
        const ue = window.dataStore?.getNFById(ueId);
        if (!ue || ue.type !== 'UE') {
            alert('Error: UE not found');
            return;
        }

        // Get subscriber information from UDR
        const subscribers = window.dataStore?.getSubscribers() || [];
        const ueImsi = ue.config.subscriberImsi;

        if (!ueImsi) {
            alert('❌ Validation Failed!\n\nUE does not have IMSI configured.\n\nPlease configure subscriber information first.');
            return;
        }

        // Find matching subscriber in UDR
        const subscriber = subscribers.find(s => s.imsi === ueImsi);

        if (!subscriber) {
            alert('❌ Validation Failed!\n\n' +
                  `UE IMSI: ${ueImsi}\n` +
                  'Status: Not found in UDR/MySQL subscriber database\n\n' +
                  'Please ensure the subscriber is registered in UDR.');
            
            if (window.logEngine) {
                window.logEngine.addLog(ueId, 'ERROR',
                    'UE validation failed: Subscriber not found in UDR', {
                    ueImsi: ueImsi,
                    reason: 'Subscriber not registered in UDR/MySQL'
                });
            }
            return;
        }

        // Validate all parameters
        const mismatches = [];
        
        if (ue.config.subscriberKey && ue.config.subscriberKey !== subscriber.key) {
            mismatches.push('Key');
        }
        
        if (ue.config.subscriberOpc && ue.config.subscriberOpc !== subscriber.opc) {
            mismatches.push('OPc');
        }
        
        if (ue.config.subscriberDnn && ue.config.subscriberDnn !== subscriber.dnn) {
            mismatches.push('DNN');
        }
        
        if (ue.config.subscriberSst && ue.config.subscriberSst !== subscriber.nssai_sst) {
            mismatches.push('NSSAI SST');
        }

        if (mismatches.length > 0) {
            alert('⚠️ Validation Warning!\n\n' +
                  `UE IMSI: ${ueImsi}\n` +
                  `Status: Found in UDR but parameters mismatch\n\n` +
                  `Mismatched parameters: ${mismatches.join(', ')}\n\n` +
                  'Please update UE configuration to match UDR subscriber data.');
            
            if (window.logEngine) {
                window.logEngine.addLog(ueId, 'WARNING',
                    'UE validation warning: Parameter mismatches detected', {
                    ueImsi: ueImsi,
                    mismatches: mismatches,
                    udrSubscriber: {
                        key: subscriber.key.substring(0, 8) + '...',
                        opc: subscriber.opc.substring(0, 8) + '...',
                        dnn: subscriber.dnn,
                        nssai_sst: subscriber.nssai_sst
                    }
                });
            }
            return;
        }

        // Validation successful
        alert('✅ Validation Successful!\n\n' +
              `UE IMSI: ${ueImsi}\n` +
              `Status: All parameters match UDR subscriber data\n\n` +
              `DNN: ${subscriber.dnn}\n` +
              `NSSAI SST: ${subscriber.nssai_sst}\n\n` +
              'UE is ready for network registration and testing.');
        
        if (window.logEngine) {
            window.logEngine.addLog(ueId, 'SUCCESS',
                'UE validation successful: All parameters match UDR', {
                ueImsi: ueImsi,
                dnn: subscriber.dnn,
                nssai_sst: subscriber.nssai_sst,
                validationStatus: 'PASSED'
            });
        }
    }

    /**
     * Collect network logs (NGAP, NAS, GTP-U, PDU Session)
     * @param {string} ueId - UE ID
     */
    collectNetworkLogs(ueId) {
        const ue = window.dataStore?.getNFById(ueId);
        if (!ue || ue.type !== 'UE') {
            alert('Error: UE not found');
            return;
        }

        // Check if UE is registered and has PDU session
        if (!ue.config.pduSession) {
            alert('⚠️ Log Collection Unavailable!\n\n' +
                  'UE must be registered and have an active PDU session to collect logs.\n\n' +
                  'Please:\n' +
                  '1. Register UE with AMF (NAS registration)\n' +
                  '2. Establish PDU session\n' +
                  '3. Ensure GTP tunnel is active');
            return;
        }

        // Collect logs from log engine
        const allLogs = [];
        const allNFs = window.dataStore?.getAllNFs() || [];
        
        // Find related NFs
        const gNB = allNFs.find(n => n.type === 'gNB');
        const amf = allNFs.find(n => n.type === 'AMF');
        const upf = allNFs.find(n => n.type === 'UPF' && n.id === ue.config.pduSession?.upfId);
        const smf = allNFs.find(n => n.type === 'SMF');

        // Collect NGAP logs (gNB <-> AMF)
        if (gNB && amf && window.logEngine) {
            const ngapLogs = window.logEngine.logs.get(gNB.id) || [];
            const amfLogs = window.logEngine.logs.get(amf.id) || [];
            
            ngapLogs.forEach(log => {
                if (log.message.includes('NGAP') || log.message.includes('NG Setup')) {
                    allLogs.push({ ...log, category: 'NGAP', source: gNB.name });
                }
            });
            
            amfLogs.forEach(log => {
                if (log.message.includes('NGAP') || log.message.includes('NG Setup')) {
                    allLogs.push({ ...log, category: 'NGAP', source: amf.name });
                }
            });
        }

        // Collect NAS logs (UE <-> AMF)
        if (window.logEngine) {
            const ueLogs = window.logEngine.logs.get(ueId) || [];
            const amfLogs = amf ? (window.logEngine.logs.get(amf.id) || []) : [];
            
            ueLogs.forEach(log => {
                if (log.message.includes('NAS') || log.message.includes('Registration') || 
                    log.message.includes('SUCI') || log.message.includes('Authentication')) {
                    allLogs.push({ ...log, category: 'NAS', source: ue.name });
                }
            });
            
            amfLogs.forEach(log => {
                if (log.message.includes('NAS') || log.message.includes('Registration') || 
                    log.message.includes('SUCI') || log.message.includes('Authentication')) {
                    allLogs.push({ ...log, category: 'NAS', source: amf.name });
                }
            });
        }

        // Collect GTP-U logs (gNB <-> UPF)
        if (gNB && upf && window.logEngine) {
            const gnbLogs = window.logEngine.logs.get(gNB.id) || [];
            const upfLogs = window.logEngine.logs.get(upf.id) || [];
            
            gnbLogs.forEach(log => {
                if (log.message.includes('GTP-U') || log.message.includes('GTP') || 
                    log.message.includes('tunnel') || log.message.includes('N3')) {
                    allLogs.push({ ...log, category: 'GTP-U', source: gNB.name });
                }
            });
            
            upfLogs.forEach(log => {
                if (log.message.includes('GTP-U') || log.message.includes('GTP') || 
                    log.message.includes('tunnel') || log.message.includes('N3')) {
                    allLogs.push({ ...log, category: 'GTP-U', source: upf.name });
                }
            });
        }

        // Collect PDU Session logs
        if (window.logEngine) {
            const ueLogs = window.logEngine.logs.get(ueId) || [];
            const smfLogs = smf ? (window.logEngine.logs.get(smf.id) || []) : [];
            const upfLogs = upf ? (window.logEngine.logs.get(upf.id) || []) : [];
            
            ueLogs.forEach(log => {
                if (log.message.includes('PDU') || log.message.includes('session') || 
                    log.message.includes('tun_ue') || log.message.includes('10.0.0.')) {
                    allLogs.push({ ...log, category: 'PDU Session', source: ue.name });
                }
            });
            
            smfLogs.forEach(log => {
                if (log.message.includes('PDU') || log.message.includes('session')) {
                    allLogs.push({ ...log, category: 'PDU Session', source: smf.name });
                }
            });
            
            upfLogs.forEach(log => {
                if (log.message.includes('PDU') || log.message.includes('session') || 
                    log.message.includes('tun0') || log.message.includes('ogstun')) {
                    allLogs.push({ ...log, category: 'PDU Session', source: upf.name });
                }
            });
        }

        // Sort logs by timestamp
        allLogs.sort((a, b) => a.timestamp - b.timestamp);

        if (allLogs.length === 0) {
            alert('⚠️ No Logs Available!\n\n' +
                  'No network logs found for this UE.\n\n' +
                  'Please ensure:\n' +
                  '1. UE is registered with AMF\n' +
                  '2. PDU session is established\n' +
                  '3. Network functions are connected and operational');
            return;
        }

        // Format and display logs
        let logReport = '═══════════════════════════════════════════════════════\n';
        logReport += `NETWORK LOG COLLECTION REPORT\n`;
        logReport += `UE: ${ue.name} (${ue.config.subscriberImsi || 'N/A'})\n`;
        logReport += `Timestamp: ${new Date().toLocaleString()}\n`;
        logReport += `═══════════════════════════════════════════════════════\n\n`;

        // Group by category
        const categories = ['NGAP', 'NAS', 'GTP-U', 'PDU Session'];
        categories.forEach(category => {
            const categoryLogs = allLogs.filter(log => log.category === category);
            if (categoryLogs.length > 0) {
                logReport += `\n[${category} LOGS] (${categoryLogs.length} entries)\n`;
                logReport += '─────────────────────────────────────────────────────\n';
                categoryLogs.forEach(log => {
                    const time = new Date(log.timestamp).toLocaleTimeString();
                    logReport += `[${time}] ${log.source} | ${log.level} | ${log.message}\n`;
                    if (log.details && Object.keys(log.details).length > 0) {
                        Object.entries(log.details).forEach(([key, value]) => {
                            logReport += `  └─ ${key}: ${value}\n`;
                        });
                    }
                });
                logReport += '\n';
            }
        });

        logReport += '═══════════════════════════════════════════════════════\n';
        logReport += `Total Logs Collected: ${allLogs.length}\n`;
        logReport += '═══════════════════════════════════════════════════════\n';

        // Display in alert (or could be exported to file)
        const logWindow = window.open('', '_blank', 'width=800,height=600');
        if (logWindow) {
            logWindow.document.write(`<pre style="font-family: monospace; padding: 20px;">${logReport}</pre>`);
            logWindow.document.close();
        } else {
            // Fallback to alert if popup blocked
            alert(logReport.substring(0, 2000) + (logReport.length > 2000 ? '\n\n... (truncated, see console for full report)' : ''));
            console.log('═══════════════════════════════════════════════════════');
            console.log('NETWORK LOG COLLECTION REPORT');
            console.log('═══════════════════════════════════════════════════════');
            console.log(logReport);
        }

        // Log the collection event
        if (window.logEngine) {
            window.logEngine.addLog(ueId, 'SUCCESS',
                'Network logs collected successfully', {
                totalLogs: allLogs.length,
                categories: categories.filter(cat => allLogs.some(log => log.category === cat)),
                reportGenerated: true
            });
        }
    }

    /**
     * Get bus at position (for clicking)
     */
    getBusAtPosition(x, y) {
        const allBuses = window.dataStore?.getAllBuses() || [];

        for (const bus of allBuses) {
            const tolerance = 30; // Increased for easier clicking

            if (bus.orientation === 'horizontal') {
                if (x >= bus.position.x &&
                    x <= bus.position.x + bus.length &&
                    Math.abs(y - bus.position.y) <= tolerance) {
                    return bus;
                }
            } else {
                if (y >= bus.position.y &&
                    y <= bus.position.y + bus.length &&
                    Math.abs(x - bus.position.x) <= tolerance) {
                    return bus;
                }
            }
        }

        return null;
    }

    /**
     * Get PDU session status HTML for UE config panel
     * @param {Object} nf - UE Network Function
     * @returns {string} HTML string for session status
     */
    getSessionStatusHTML(nf) {
        const state = nf.config?.pduSessionState || 'IDLE';
        const statusIcons = {
            'IDLE': '⚪',
            'ESTABLISHING': '🔄',
            'ACTIVE': '🟢',
            'RELEASING': '🔄',
            'RELEASED': '🔴'
        };
        const statusLabels = {
            'IDLE': 'No Session',
            'ESTABLISHING': 'Establishing...',
            'ACTIVE': 'Session Active',
            'RELEASING': 'Releasing...',
            'RELEASED': 'Session Released'
        };
        return `${statusIcons[state] || '⚪'} ${statusLabels[state] || 'Unknown'}`;
    }

    // ==========================================
    // PDU SESSION MODE
    // ==========================================

    /**
     * Setup PDU Session Mode UI handlers
     */
    setupPDUSessionMode() {
        // Main toggle button
        const btnPDU = document.getElementById('btn-pdu-session');
        if (btnPDU) {
            btnPDU.addEventListener('click', () => this.togglePDUMode());
        }

        // Close buttons
        document.getElementById('btn-close-pdu-messages')?.addEventListener('click', () => this.togglePDUMode(false));
        document.getElementById('btn-close-pdu-process')?.addEventListener('click', () => this.togglePDUMode(false));

        // Step buttons
        for (let i = 1; i <= 7; i++) {
            const btn = document.getElementById(`btn-step-${i}`);
            if (btn) {
                btn.addEventListener('click', () => this.executePDUStep(i));
            }
        }

        // Reset button
        document.getElementById('btn-reset-pdu-steps')?.addEventListener('click', () => this.resetPDUSteps());

        console.log('📡 PDU Session Mode handlers initialized');
    }

    /**
     * Toggle PDU Session Mode
     * @param {boolean|null} forceState - Optional force state
     */
    togglePDUMode(forceState = null) {
        this.pduSessionMode = forceState !== null ? forceState : !this.pduSessionMode;

        const btnPDU = document.getElementById('btn-pdu-session');
        const normalLeftSidebar = document.getElementById('nf-sidebar');
        const normalRightSidebar = document.getElementById('config-sidebar');
        const pduMessagesPanel = document.getElementById('pdu-messages-panel');
        const pduProcessPanel = document.getElementById('pdu-process-panel');

        if (this.pduSessionMode) {
            // Enter PDU mode
            btnPDU?.classList.add('active');
            normalLeftSidebar?.classList.add('hidden');
            normalRightSidebar?.classList.add('hidden');
            pduMessagesPanel?.classList.remove('hidden');
            pduProcessPanel?.classList.remove('hidden');

            // Validate and prepare
            this.preparePDUSession();

            console.log('📡 Entered PDU Session Mode');
        } else {
            // Exit PDU mode
            btnPDU?.classList.remove('active');
            normalLeftSidebar?.classList.remove('hidden');
            normalRightSidebar?.classList.remove('hidden');
            pduMessagesPanel?.classList.add('hidden');
            pduProcessPanel?.classList.add('hidden');

            console.log('📡 Exited PDU Session Mode');
        }
    }

    /**
     * Prepare PDU session by validating topology
     */
    preparePDUSession() {
        // Find UE
        const allNFs = window.dataStore?.getAllNFs() || [];
        const ue = allNFs.find(nf => nf.type === 'UE' && nf.status === 'stable');

        if (!ue) {
            this.showPDUError('No registered UE found. Please add and register a UE first.');
            return;
        }

        // Validate using session manager
        if (window.sessionManager) {
            const validation = window.sessionManager.validatePrerequisites(ue.id);
            if (!validation.valid) {
                this.showPDUError(`Validation failed: ${validation.error}`);
                return;
            }

            // Store NF references for step execution
            this.pduSessionData = {
                ueId: ue.id,
                ue: validation.nfs.ue,
                amf: validation.nfs.amf,
                smf: validation.nfs.smf,
                upf: validation.nfs.upf,
                pduSessionId: Math.floor(Math.random() * 255) + 1,
                assignedIP: null,
                tunnelId: null
            };

            // Reset steps and enable step 1
            this.resetPDUSteps();
            document.getElementById('btn-step-1')?.removeAttribute('disabled');

            console.log('✅ PDU Session topology validated:', this.pduSessionData);
        }
    }

    /**
     * Show error in PDU messages panel
     */
    showPDUError(message) {
        const content = document.getElementById('pdu-messages-content');
        if (content) {
            content.innerHTML = `
                <div class="pdu-message-card" style="border-left-color: #e74c3c;">
                    <div class="pdu-message-header" style="background: rgba(231, 76, 60, 0.15);">
                        <span class="pdu-message-step" style="color: #e74c3c;">❌ Error</span>
                    </div>
                    <div class="pdu-message-body">
                        <p style="color: #e74c3c;">${message}</p>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Execute a PDU session step
     * @param {number} stepNum - Step number (1-6)
     */
    async executePDUStep(stepNum) {
        if (!this.pduSessionData) {
            this.showPDUError('No valid PDU session data. Please reset and try again.');
            return;
        }

        const btn = document.getElementById(`btn-step-${stepNum}`);
        if (!btn || btn.disabled || btn.classList.contains('completed')) return;

        // Mark as active
        btn.classList.add('active');

        try {
            // Execute the step
            await this.executeStep(stepNum);

            // Mark as completed
            btn.classList.remove('active');
            btn.classList.add('completed');
            btn.querySelector('.step-check').textContent = '✓';

            // Enable next step
            if (stepNum < 7) {
                const nextBtn = document.getElementById(`btn-step-${stepNum + 1}`);
                nextBtn?.removeAttribute('disabled');
            }

            this.pduCurrentStep = stepNum;

        } catch (error) {
            btn.classList.remove('active');
            console.error(`Step ${stepNum} failed:`, error);
            this.addPDUMessage(stepNum, 'Error', 'Error', { error: error.message }, true);
        }
    }

    /**
     * Execute the actual step logic
     * @param {number} stepNum - Step number
     */
    async executeStep(stepNum) {
        const { ue, amf, smf, upf, pduSessionId } = this.pduSessionData;

        switch (stepNum) {
            case 1: // UE → AMF: N1 PDU Session Establishment Request
                const payload1 = {
                    messageType: 'PDU_SESSION_ESTABLISHMENT_REQUEST',
                    supi: `imsi-${ue.config.subscriberImsi}`,
                    pduSessionId: pduSessionId,
                    requestType: 'INITIAL_REQUEST',
                    snssai: { sst: ue.config.subscriberSst || 1 },
                    dnn: ue.config.subscriberDnn || '5G-Lab'
                };
                this.addPDUMessage(1, ue.name, amf.name, payload1, false);
                await window.packetAnimator?.sendPacket({
                    sourceId: ue.id, targetId: amf.id,
                    interface: 'N1', direction: 'request', payload: payload1
                });
                break;

            case 2: // AMF → SMF: Nsmf_PDUSession_Create
                const payload2 = {
                    supi: `imsi-${ue.config.subscriberImsi}`,
                    pduSessionId: pduSessionId,
                    dnn: ue.config.subscriberDnn || '5G-Lab',
                    snssai: { sst: ue.config.subscriberSst || 1 },
                    requestType: 'INITIAL_REQUEST',
                    servingNfId: amf.id,
                    anType: '3GPP_ACCESS'
                };
                this.addPDUMessage(2, amf.name, smf.name, payload2, false);
                await window.packetAnimator?.sendPacket({
                    sourceId: amf.id, targetId: smf.id,
                    interface: 'Nsmf', direction: 'request', payload: payload2
                });
                break;

            case 3: // SMF → UPF: N4 Session Establishment
                const payload3 = {
                    pduSessionId: pduSessionId,
                    ueIpAllocation: true,
                    qos: { '5qi': 9, arp: { priorityLevel: 1 } },
                    createFar: { forwardingParameters: { destinationInterface: 'ACCESS' } },
                    createPdr: { pdi: { sourceInterface: 'CORE' } }
                };
                this.addPDUMessage(3, smf.name, upf.name, payload3, false);
                await window.packetAnimator?.sendPacket({
                    sourceId: smf.id, targetId: upf.id,
                    interface: 'N4', direction: 'request', payload: payload3
                });
                break;

            case 4: // UPF → SMF: N4 Response (UE IP Allocated)
                // Allocate IP
                this.pduSessionData.assignedIP = window.sessionManager?.allocateUEIP(upf, ue) || '10.0.0.2';
                this.pduSessionData.tunnelId = `gtp-${1000 + Math.floor(Math.random() * 9000)}`;
                
                const payload4 = {
                    status: 'SUCCESS',
                    cause: 'REQUEST_ACCEPTED',
                    ueIp: this.pduSessionData.assignedIP,
                    tunnelId: this.pduSessionData.tunnelId,
                    f_teid: { teid: Math.floor(Math.random() * 4294967295), ipv4Address: upf.config.ipAddress }
                };
                this.addPDUMessage(4, upf.name, smf.name, payload4, true);
                await window.packetAnimator?.sendPacket({
                    sourceId: upf.id, targetId: smf.id,
                    interface: 'N4', direction: 'response', payload: payload4
                });
                break;

            case 5: // SMF → AMF: PDU Session Accept
                const payload5 = {
                    pduSessionId: pduSessionId,
                    pduSessionType: 'IPV4',
                    sscMode: 'SSC_MODE_1',
                    allocatedIpAddress: this.pduSessionData.assignedIP,
                    qosFlowsSetupList: [{ qfi: 1, '5qi': 9 }]
                };
                this.addPDUMessage(5, smf.name, amf.name, payload5, true);
                await window.packetAnimator?.sendPacket({
                    sourceId: smf.id, targetId: amf.id,
                    interface: 'Nsmf', direction: 'response', payload: payload5
                });
                break;

            case 6: // AMF -> SMF (Update / Status)
                // 6. AMF -> SMF: Update SM Context (Status OK / Handover ready)
                const payload6 = {
                    pduSessionId: pduSessionId,
                    status: 'Active',
                    n2SmInfo: {
                        pduSessionId: pduSessionId,
                        n3TunnelInfo: { teid: Math.floor(Math.random() * 99999), ip: upf.config.ipAddress }
                    },
                    result: 'SUCCESS'
                };
                this.addPDUMessage(6, amf.name, smf.name, payload6, true);
                await window.packetAnimator?.sendPacket({
                    sourceId: amf.id, targetId: smf.id,
                    interface: 'Nsmf', direction: 'request', payload: payload6 // Assuming request direction for ACK/Update
                });
                break;
            
            case 7: // AMF -> UE: N1 PDU Session Establishment Accept
                // 7. AMF -> UE: N1 PDU Session Establishment Accept
                const payload7 = {
                    messageType: 'PDU_SESSION_ESTABLISHMENT_ACCEPT',
                    pduSessionId: pduSessionId,
                    pduSessionType: 'IPV4',
                    pduAddress: this.pduSessionData.assignedIP,
                    dnn: ue.config.subscriberDnn || '5G-Lab',
                    qosRules: [{ qri: 1, qfi: 1, dqrBit: true }]
                };
                this.addPDUMessage(7, amf.name, ue.name, payload7, true);
                await window.packetAnimator?.sendPacket({
                    sourceId: amf.id, targetId: ue.id,
                    interface: 'N1', direction: 'response', payload: payload7
                });

                // Finalize session
                this.finalizePDUSession();
                break;
        }
    }

    /**
     * Finalize PDU session after all steps complete
     */
    finalizePDUSession() {
        const { ue, upf } = this.pduSessionData;

        // Update UE config
        ue.config.pduSession = {
            sessionId: this.pduSessionData.pduSessionId,
            upfId: upf.id,
            assignedIP: this.pduSessionData.assignedIP,
            status: 'established',
            establishedAt: Date.now()
        };
        ue.config.pduSessionState = 'ACTIVE';

        // Create tun interface
        const ueNum = ue.name.match(/\d+/)?.[0] || '1';
        ue.config.tunInterface = {
            name: `tun_ue${ueNum}`,
            ipAddress: this.pduSessionData.assignedIP,
            netmask: '255.255.255.0',
            gateway: upf.config.tun0Interface?.gatewayIP || '10.0.0.1'
        };

        window.dataStore?.updateNF(ue.id, ue);

        // Add final success message
        this.addPDUMessage('✅', 'Session', 'ACTIVE', {
            status: 'PDU Session Established Successfully!',
            assignedIP: this.pduSessionData.assignedIP,
            tunnelId: this.pduSessionData.tunnelId
        }, false);

        // Re-render canvas to show IP
        window.canvasRenderer?.render();

        console.log('✅ PDU Session fully established!');
    }

    /**
     * Add message to PDU messages panel
     */
    addPDUMessage(step, source, target, payload, isResponse) {
        const content = document.getElementById('pdu-messages-content');
        if (!content) return;

        // Remove hint if present
        const hint = content.querySelector('.pdu-hint');
        if (hint) hint.remove();

        const card = document.createElement('div');
        card.className = `pdu-message-card ${isResponse ? 'response' : ''}`;
        card.innerHTML = `
            <div class="pdu-message-header">
                <span class="pdu-message-step">Step ${step}</span>
                <span class="pdu-message-flow">${source} → ${target}</span>
            </div>
            <div class="pdu-message-body">
                <pre>${JSON.stringify(payload, null, 2)}</pre>
            </div>
        `;

        content.appendChild(card);
        content.scrollTop = content.scrollHeight;
    }

    /**
     * Reset all PDU steps
     */
    resetPDUSteps() {
        // Reset all step buttons
        for (let i = 1; i <= 6; i++) {
            const btn = document.getElementById(`btn-step-${i}`);
            if (btn) {
                btn.classList.remove('completed', 'active');
                btn.querySelector('.step-check').textContent = '○';
                if (i > 1) {
                    btn.setAttribute('disabled', 'true');
                }
            }
        }

        // Clear messages
        const content = document.getElementById('pdu-messages-content');
        if (content) {
            content.innerHTML = '<p class="pdu-hint">Click step buttons on the right to see message flows</p>';
        }

        this.pduCurrentStep = 0;

        // Re-validate
        if (this.pduSessionMode) {
            this.preparePDUSession();
        }
    }
}