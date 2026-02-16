/**
 * ============================================
 * MESSAGE INSPECTOR
 * ============================================
 * JSON request/response inspection panel
 * 
 * Responsibilities:
 * - Display SBI message details
 * - Show JSON payloads with syntax highlighting
 * - Link with packets and log entries
 * - Collapsible panel management
 */

class MessageInspector {
    constructor() {
        // Current displayed message
        this.currentMessage = null;

        // Panel element reference
        this.panel = null;

        // Is panel visible
        this.isVisible = false;

        console.log('✅ MessageInspector initialized');
    }

    /**
     * Initialize the inspector panel
     */
    init() {
        // Create panel if not exists
        this.createPanel();

        // Setup event listeners
        this.setupEventListeners();

        console.log('🔍 MessageInspector panel ready');
    }

    /**
     * Create the inspector panel HTML
     */
    createPanel() {
        // Check if panel already exists
        if (document.getElementById('message-inspector-panel')) {
            this.panel = document.getElementById('message-inspector-panel');
            return;
        }

        // Create panel element
        const panel = document.createElement('div');
        panel.id = 'message-inspector-panel';
        panel.className = 'message-inspector-panel';
        panel.innerHTML = `
            <div class="inspector-header">
                <h3>📨 Message Inspector</h3>
                <div class="inspector-controls">
                    <button id="btn-inspector-copy" class="btn-small" title="Copy JSON">📋 Copy</button>
                    <button id="btn-inspector-close" class="btn-small" title="Close">✕</button>
                </div>
            </div>
            <div class="inspector-content" id="inspector-content">
                <div class="inspector-placeholder">
                    <p>Click on a packet or log entry to inspect message details</p>
                </div>
            </div>
        `;

        // Append to body
        document.body.appendChild(panel);
        this.panel = panel;

        // Setup panel controls
        this.setupPanelControls();
    }

    /**
     * Setup panel control buttons
     */
    setupPanelControls() {
        const closeBtn = document.getElementById('btn-inspector-close');
        const copyBtn = document.getElementById('btn-inspector-copy');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyToClipboard());
        }
    }

    /**
     * Setup event listeners for packets and logs
     */
    setupEventListeners() {
        // Listen for packet clicks
        if (window.packetAnimator) {
            window.packetAnimator.onPacketClick((packet) => {
                this.showPacketDetails(packet);
            });
        }

        // Listen for log entry clicks (setup via delegation)
        const logContent = document.getElementById('log-content');
        if (logContent) {
            logContent.addEventListener('click', (e) => {
                const logEntry = e.target.closest('.log-entry');
                if (logEntry && logEntry.dataset.messageId) {
                    this.showLogDetails(logEntry);
                }
            });
        }
    }

    /**
     * Show packet details in inspector
     * @param {Object} packet - Packet object
     */
    showPacketDetails(packet) {
        this.currentMessage = {
            type: 'packet',
            source: packet.sourceName,
            target: packet.targetName,
            interface: packet.interface,
            method: packet.method,
            direction: packet.direction,
            protocol: packet.protocol,
            payload: packet.payload,
            messageId: packet.messageId,
            timestamp: new Date(packet.createdAt).toLocaleTimeString()
        };

        this.renderMessage();
        this.show();
    }

    /**
     * Show log entry details in inspector
     * @param {HTMLElement} logEntry - Log entry element
     */
    showLogDetails(logEntry) {
        // Try to find associated message data
        const messageId = logEntry.dataset.messageId;
        const nfId = logEntry.dataset.nfId;

        // Get message from log engine if available
        let payload = null;
        let messageData = null;

        // Try to parse from log details
        const detailsElement = logEntry.querySelector('.log-details');
        if (detailsElement) {
            try {
                // Look for json field in details
                const text = detailsElement.textContent;
                const jsonMatch = text.match(/json:\s*(\{[\s\S]*?\})/);
                if (jsonMatch) {
                    payload = JSON.parse(jsonMatch[1]);
                }
            } catch (e) {
                // Can't parse, use raw
            }
        }

        // Get source from log
        const nfNameElement = logEntry.querySelector('.log-nf-name');
        const source = nfNameElement ? nfNameElement.textContent : 'Unknown';

        // Get message text
        const messageElement = logEntry.querySelector('.log-message');
        const message = messageElement ? messageElement.textContent : '';

        // Parse interface and direction from message
        let interfaceName = 'SBI';
        let direction = 'request';
        let target = 'Unknown';

        if (message.includes('→')) {
            const parts = message.split('→');
            if (parts.length > 1) {
                target = parts[1].trim();
            }
            direction = 'request';
        } else if (message.includes('←')) {
            direction = 'response';
        }

        if (message.includes('N1:')) {
            interfaceName = 'N1';
        } else if (message.includes('N4')) {
            interfaceName = 'N4';
        } else if (message.includes('Nsmf')) {
            interfaceName = 'Nsmf_PDUSession';
        }

        this.currentMessage = {
            type: 'log',
            source: source,
            target: target,
            interface: interfaceName,
            method: direction === 'request' ? 'POST' : '200 OK',
            direction: direction,
            protocol: 'HTTP/2',
            payload: payload,
            messageId: messageId,
            raw: message
        };

        this.renderMessage();
        this.show();
    }

    /**
     * Show message from external call
     * @param {Object} messageData - Message data object
     */
    showMessage(messageData) {
        this.currentMessage = messageData;
        this.renderMessage();
        this.show();
    }

    /**
     * Render current message in panel
     */
    renderMessage() {
        const content = document.getElementById('inspector-content');
        if (!content || !this.currentMessage) return;

        const msg = this.currentMessage;
        const directionIcon = msg.direction === 'request' ? '→' : '←';
        const directionClass = msg.direction === 'request' ? 'direction-request' : 'direction-response';

        let payloadHtml = '<p class="no-payload">No payload data</p>';
        if (msg.payload) {
            payloadHtml = `<pre class="json-payload">${this.formatJSON(msg.payload)}</pre>`;
        }

        content.innerHTML = `
            <div class="inspector-message">
                <div class="message-header ${directionClass}">
                    <span class="message-flow">
                        <strong>${msg.source}</strong>
                        <span class="direction-arrow">${directionIcon}</span>
                        <strong>${msg.target}</strong>
                    </span>
                </div>
                
                <div class="message-meta">
                    <div class="meta-row">
                        <span class="meta-label">Interface:</span>
                        <span class="meta-value interface-badge">${msg.interface}</span>
                    </div>
                    <div class="meta-row">
                        <span class="meta-label">Method/Status:</span>
                        <span class="meta-value">${msg.method}</span>
                    </div>
                    <div class="meta-row">
                        <span class="meta-label">Protocol:</span>
                        <span class="meta-value">${msg.protocol}</span>
                    </div>
                    <div class="meta-row">
                        <span class="meta-label">Direction:</span>
                        <span class="meta-value ${directionClass}">${msg.direction.toUpperCase()}</span>
                    </div>
                    ${msg.messageId ? `
                    <div class="meta-row">
                        <span class="meta-label">Message ID:</span>
                        <span class="meta-value mono">${msg.messageId}</span>
                    </div>
                    ` : ''}
                </div>

                <div class="message-payload">
                    <h4>${msg.direction === 'request' ? 'Request' : 'Response'} Payload (JSON)</h4>
                    ${payloadHtml}
                </div>
            </div>
        `;
    }

    /**
     * Format JSON with syntax highlighting
     * @param {Object} obj - Object to format
     * @returns {string} Formatted HTML
     */
    formatJSON(obj) {
        const json = JSON.stringify(obj, null, 2);
        
        // Syntax highlighting
        return json
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, (match) => {
                let cls = 'json-string';
                if (/:$/.test(match)) {
                    cls = 'json-key';
                    match = match.slice(0, -1); // Remove colon
                    return `<span class="${cls}">${match}</span>:`;
                }
                return `<span class="${cls}">${match}</span>`;
            })
            .replace(/\b(true|false)\b/g, '<span class="json-boolean">$1</span>')
            .replace(/\b(null)\b/g, '<span class="json-null">$1</span>')
            .replace(/\b(\d+)\b/g, '<span class="json-number">$1</span>');
    }

    /**
     * Show the inspector panel
     */
    show() {
        if (this.panel) {
            this.panel.classList.add('visible');
            this.isVisible = true;
        }
    }

    /**
     * Hide the inspector panel
     */
    hide() {
        if (this.panel) {
            this.panel.classList.remove('visible');
            this.isVisible = false;
        }
    }

    /**
     * Toggle panel visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Copy current message JSON to clipboard
     */
    copyToClipboard() {
        if (!this.currentMessage || !this.currentMessage.payload) {
            alert('No JSON payload to copy');
            return;
        }

        const json = JSON.stringify(this.currentMessage.payload, null, 2);
        
        navigator.clipboard.writeText(json).then(() => {
            const copyBtn = document.getElementById('btn-inspector-copy');
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✓ Copied!';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 2000);
            }
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy to clipboard');
        });
    }
}

// Export for global access
window.MessageInspector = MessageInspector;
