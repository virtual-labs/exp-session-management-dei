/**
 * ============================================
 * SESSION MANAGER
 * ============================================
 * Manages PDU Session lifecycle for 5G UE
 * 
 * Responsibilities:
 * - Track PDU session states (IDLE, ESTABLISHING, ACTIVE, RELEASING, RELEASED)
 * - Orchestrate session establishment/release flows
 * - Coordinate with PacketAnimator for visual feedback
 * - Validate prerequisites before session operations
 * - Emit events for UI updates
 */

class SessionManager {
    constructor() {
        // Session states enum
        this.STATES = {
            IDLE: 'IDLE',
            ESTABLISHING: 'ESTABLISHING',
            ACTIVE: 'ACTIVE',
            RELEASING: 'RELEASING',
            RELEASED: 'RELEASED'
        };

        // Active sessions map: ueId -> session object
        this.sessions = new Map();

        // Event listeners
        this.listeners = [];

        // Message counter for unique IDs
        this.messageCounter = 0;

        console.log('✅ SessionManager initialized');
    }

    /**
     * Get or create session for UE
     * @param {string} ueId - UE ID
     * @returns {Object} Session object
     */
    getSession(ueId) {
        if (!this.sessions.has(ueId)) {
            this.sessions.set(ueId, {
                ueId: ueId,
                state: this.STATES.IDLE,
                pduSessionId: null,
                assignedIP: null,
                tunnelId: null,
                upfId: null,
                createdAt: null,
                messages: []
            });
        }
        return this.sessions.get(ueId);
    }

    /**
     * Get session state for UE
     * @param {string} ueId - UE ID
     * @returns {string} Current state
     */
    getSessionState(ueId) {
        return this.getSession(ueId).state;
    }

    /**
     * Generate unique message ID
     * @returns {string} Unique message ID
     */
    generateMessageId() {
        return `msg-${Date.now()}-${++this.messageCounter}`;
    }

    /**
     * Validate prerequisites for PDU session establishment
     * @param {string} ueId - UE ID
     * @returns {Object} {valid: boolean, error: string|null, nfs: {ue, amf, smf, upf}}
     */
    validatePrerequisites(ueId) {
        const ue = window.dataStore?.getNFById(ueId);
        if (!ue || ue.type !== 'UE') {
            return { valid: false, error: 'UE not found', nfs: null };
        }

        // Check UE is registered (has subscriberImsi)
        if (!ue.config.subscriberImsi) {
            return { valid: false, error: 'UE is not registered (no IMSI configured)', nfs: null };
        }

        // Get UE's subnet
        const ueNetwork = this.getNetworkFromIP(ue.config.ipAddress);

        // Find all NFs in same subnet
        const allNFs = window.dataStore?.getAllNFs() || [];
        
        // Find AMF in same subnet (stable)
        const amf = allNFs.find(nf => 
            nf.type === 'AMF' && 
            nf.status === 'stable' &&
            this.getNetworkFromIP(nf.config.ipAddress) === ueNetwork
        );

        if (!amf) {
            return { valid: false, error: 'No stable AMF found in same subnet', nfs: null };
        }

        // Check UE can reach AMF (direct or via gNB)
        if (!this.areNFsConnected(ue.id, amf.id)) {
            return { valid: false, error: 'UE is not connected to AMF (directly or via gNB)', nfs: null };
        }

        // Find SMF in same subnet (stable) - connected directly, via bus, or in same subnet
        const smf = allNFs.find(nf => 
            nf.type === 'SMF' && 
            nf.status === 'stable' &&
            this.getNetworkFromIP(nf.config.ipAddress) === ueNetwork
        );

        if (!smf) {
            return { valid: false, error: 'No stable SMF found in same subnet', nfs: null };
        }

        // Find UPF in same subnet (stable)
        const upf = allNFs.find(nf => 
            nf.type === 'UPF' && 
            nf.status === 'stable' &&
            this.getNetworkFromIP(nf.config.ipAddress) === ueNetwork
        );

        if (!upf) {
            return { valid: false, error: 'No stable UPF found in same subnet', nfs: null };
        }

        // Check UPF has tun0 interface
        if (!upf.config.tun0Interface) {
            return { valid: false, error: 'UPF does not have tun0 interface configured', nfs: null };
        }

        return {
            valid: true,
            error: null,
            nfs: { ue, amf, smf, upf }
        };
    }

    /**
     * Check if two NFs are connected (directly, via bus, or both on same bus)
     * @param {string} nfId1 - First NF ID
     * @param {string} nfId2 - Second NF ID
     * @returns {boolean} True if connected
     */
    areNFsConnected(nfId1, nfId2) {
        // Check direct connections
        const connections = window.dataStore?.getConnectionsForNF(nfId1) || [];
        const hasDirectConnection = connections.some(conn => 
            conn.sourceId === nfId2 || conn.targetId === nfId2
        );
        if (hasDirectConnection) return true;

        // Check if both are on the same bus
        const busConnections1 = window.dataStore?.getBusConnectionsForNF(nfId1) || [];
        const busConnections2 = window.dataStore?.getBusConnectionsForNF(nfId2) || [];
        
        // Check if they share any bus
        for (const bc1 of busConnections1) {
            for (const bc2 of busConnections2) {
                if (bc1.busId === bc2.busId) {
                    return true;
                }
            }
        }

        // Check indirect connection via gNB (for UE)
        const nf1 = window.dataStore?.getNFById(nfId1);
        const nf2 = window.dataStore?.getNFById(nfId2);
        
        if (nf1?.type === 'UE' || nf2?.type === 'UE') {
            // Check if UE is connected to gNB, and gNB is connected to AMF
            const ueId = nf1?.type === 'UE' ? nfId1 : nfId2;
            const otherId = nf1?.type === 'UE' ? nfId2 : nfId1;
            
            const ueConns = connections;
            for (const conn of ueConns) {
                const gnbId = conn.sourceId === ueId ? conn.targetId : conn.sourceId;
                const gnb = window.dataStore?.getNFById(gnbId);
                if (gnb?.type === 'gNB') {
                    // Check if gNB is connected to the other NF
                    if (this.areNFsConnected(gnbId, otherId)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Get network from IP address
     * @param {string} ip - IP address
     * @returns {string} Network prefix (e.g., "192.168.1")
     */
    getNetworkFromIP(ip) {
        if (!ip) return '';
        const parts = ip.split('.');
        if (parts.length !== 4) return '';
        return `${parts[0]}.${parts[1]}.${parts[2]}`;
    }

    /**
     * Establish PDU Session
     * @param {string} ueId - UE ID
     * @returns {Promise<boolean>} Success status
     */
    async establishPDUSession(ueId) {
        const session = this.getSession(ueId);

        // Check current state
        if (session.state === this.STATES.ACTIVE) {
            console.log(`ℹ️ PDU session already active for UE ${ueId}`);
            if (window.logEngine) {
                window.logEngine.addLog(ueId, 'WARNING', 'PDU session already active');
            }
            return true;
        }

        if (session.state === this.STATES.ESTABLISHING) {
            console.log(`ℹ️ PDU session establishment already in progress for UE ${ueId}`);
            return false;
        }

        // Validate prerequisites
        const validation = this.validatePrerequisites(ueId);
        if (!validation.valid) {
            console.error(`❌ PDU session validation failed: ${validation.error}`);
            if (window.logEngine) {
                window.logEngine.addLog(ueId, 'ERROR', `PDU session establishment failed: ${validation.error}`);
            }
            return false;
        }

        const { ue, amf, smf, upf } = validation.nfs;

        // Update state to ESTABLISHING
        session.state = this.STATES.ESTABLISHING;
        this.notifyListeners('stateChange', { ueId, state: session.state });

        console.log(`📡 Starting PDU session establishment for ${ue.name}`);

        try {
            // Generate session ID
            session.pduSessionId = Math.floor(Math.random() * 255) + 1;

            // Step 1: UE → AMF: N1 PDU Session Establishment Request
            await this.sendN1EstablishmentRequest(ue, amf, session);

            // Step 2: AMF → SMF: Nsmf_PDUSession_Create
            await this.sendNsmfPDUSessionCreate(amf, smf, ue, session);

            // Step 3: SMF → UPF: N4 Session Establishment
            const n4Response = await this.sendN4SessionEstablishment(smf, upf, ue, session);

            // Step 4: UPF allocates IP and responds
            session.assignedIP = n4Response.ueIp;
            session.tunnelId = n4Response.tunnelId;
            session.upfId = upf.id;

            // Step 5: SMF → AMF: PDU Session Accept
            await this.sendPDUSessionAccept(smf, amf, ue, session);

            // Step 6: AMF → UE: N1 PDU Session Accept
            await this.sendN1SessionAccept(amf, ue, session);

            // Update UE config with PDU session info
            ue.config.pduSession = {
                sessionId: session.pduSessionId,
                upfId: upf.id,
                assignedIP: session.assignedIP,
                status: 'established',
                establishedAt: Date.now()
            };
            ue.config.pduSessionState = this.STATES.ACTIVE;

            // Create tun interface for UE
            const ueNum = ue.name.match(/\d+/)?.[0] || '1';
            ue.config.tunInterface = {
                name: `tun_ue${ueNum}`,
                ipAddress: session.assignedIP,
                netmask: '255.255.255.0',
                destination: session.assignedIP,
                gateway: upf.config.tun0Interface?.gatewayIP || '10.0.0.1',
                mtu: 1500,
                flags: 'UP,POINTOPOINT,RUNNING,NOARP,MULTICAST',
                createdAt: Date.now()
            };

            window.dataStore?.updateNF(ueId, ue);

            // Update state to ACTIVE
            session.state = this.STATES.ACTIVE;
            session.createdAt = Date.now();
            this.notifyListeners('stateChange', { ueId, state: session.state });

            // Re-render canvas to show IP label
            if (window.canvasRenderer) {
                window.canvasRenderer.render();
            }

            console.log(`✅ PDU session established for ${ue.name}: IP ${session.assignedIP}`);

            if (window.logEngine) {
                window.logEngine.addLog(ueId, 'SUCCESS', `PDU session ACTIVE`, {
                    sessionId: session.pduSessionId,
                    assignedIP: session.assignedIP,
                    tunnelId: session.tunnelId,
                    upf: upf.name
                });
            }

            return true;

        } catch (error) {
            console.error(`❌ PDU session establishment failed:`, error);
            session.state = this.STATES.IDLE;
            this.notifyListeners('stateChange', { ueId, state: session.state });

            if (window.logEngine) {
                window.logEngine.addLog(ueId, 'ERROR', `PDU session establishment failed: ${error.message}`);
            }

            return false;
        }
    }

    /**
     * Release PDU Session
     * @param {string} ueId - UE ID
     * @returns {Promise<boolean>} Success status
     */
    async releasePDUSession(ueId) {
        const session = this.getSession(ueId);

        if (session.state !== this.STATES.ACTIVE) {
            console.log(`ℹ️ No active PDU session to release for UE ${ueId}`);
            if (window.logEngine) {
                window.logEngine.addLog(ueId, 'WARNING', 'No active PDU session to release');
            }
            return false;
        }

        const ue = window.dataStore?.getNFById(ueId);
        if (!ue) return false;

        const validation = this.validatePrerequisites(ueId);
        if (!validation.valid) {
            // Still try to release locally
            this.cleanupSession(ueId);
            return true;
        }

        const { amf, smf, upf } = validation.nfs;

        // Update state to RELEASING
        session.state = this.STATES.RELEASING;
        this.notifyListeners('stateChange', { ueId, state: session.state });

        console.log(`📡 Starting PDU session release for ${ue.name}`);

        try {
            // Step 1: UE → AMF: N1 PDU Session Release Request
            await this.sendN1ReleaseRequest(ue, amf, session);

            // Step 2: AMF → SMF: Nsmf_PDUSession_Release
            await this.sendNsmfPDUSessionRelease(amf, smf, ue, session);

            // Step 3: SMF → UPF: N4 Session Release
            await this.sendN4SessionRelease(smf, upf, ue, session);

            // Step 4: SMF → AMF: Release Confirmation
            await this.sendReleaseConfirmation(smf, amf, ue, session);

            // Step 5: AMF → UE: N1 Release Complete
            await this.sendN1ReleaseComplete(amf, ue, session);

            // Cleanup session
            this.cleanupSession(ueId);

            console.log(`✅ PDU session released for ${ue.name}`);

            return true;

        } catch (error) {
            console.error(`❌ PDU session release failed:`, error);
            // Still cleanup on error
            this.cleanupSession(ueId);
            return false;
        }
    }

    /**
     * Cleanup session and UE config
     * @param {string} ueId - UE ID
     */
    cleanupSession(ueId) {
        const session = this.getSession(ueId);
        const ue = window.dataStore?.getNFById(ueId);

        // Free IP from UPF if allocated
        if (session.upfId && session.assignedIP) {
            const upf = window.dataStore?.getNFById(session.upfId);
            if (upf?.config.tun0Interface?.assignedIPs) {
                upf.config.tun0Interface.assignedIPs = 
                    upf.config.tun0Interface.assignedIPs.filter(a => a.ueId !== ueId);
                window.dataStore?.updateNF(session.upfId, upf);
            }
        }

        // Clear UE PDU session config
        if (ue) {
            delete ue.config.pduSession;
            delete ue.config.tunInterface;
            ue.config.pduSessionState = this.STATES.RELEASED;
            window.dataStore?.updateNF(ueId, ue);
        }

        // Reset session
        session.state = this.STATES.RELEASED;
        session.pduSessionId = null;
        session.assignedIP = null;
        session.tunnelId = null;
        session.upfId = null;
        session.createdAt = null;

        this.notifyListeners('stateChange', { ueId, state: session.state });

        // Re-render canvas
        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }

        if (window.logEngine) {
            window.logEngine.addLog(ueId, 'SUCCESS', 'PDU session RELEASED');
        }
    }

    // ==========================================
    // PDU Session Establishment Message Flows
    // ==========================================

    async sendN1EstablishmentRequest(ue, amf, session) {
        const messageId = this.generateMessageId();
        const payload = {
            messageType: 'PDU_SESSION_ESTABLISHMENT_REQUEST',
            supi: `imsi-${ue.config.subscriberImsi}`,
            pduSessionId: session.pduSessionId,
            requestType: 'INITIAL_REQUEST',
            snssai: { sst: ue.config.subscriberSst || 1 },
            dnn: ue.config.subscriberDnn || '5G-Lab'
        };

        if (window.logEngine) {
            window.logEngine.addLog(ue.id, 'INFO', 'N1: PDU Session Establishment Request → AMF', {
                messageId,
                interface: 'N1',
                direction: 'request',
                json: payload
            });
        }

        await this.animatePacket(ue.id, amf.id, 'N1', 'request', payload, messageId);
        await this.delay(800);
    }

    async sendNsmfPDUSessionCreate(amf, smf, ue, session) {
        const messageId = this.generateMessageId();
        const payload = {
            supi: `imsi-${ue.config.subscriberImsi}`,
            pduSessionId: session.pduSessionId,
            dnn: ue.config.subscriberDnn || '5G-Lab',
            snssai: { sst: ue.config.subscriberSst || 1 },
            requestType: 'INITIAL_REQUEST',
            servingNfId: amf.id,
            anType: '3GPP_ACCESS'
        };

        if (window.logEngine) {
            window.logEngine.addLog(amf.id, 'INFO', 'Nsmf_PDUSession_Create (HTTP/2 POST) → SMF', {
                messageId,
                interface: 'Nsmf_PDUSession',
                method: 'POST',
                direction: 'request',
                json: payload
            });
        }

        await this.animatePacket(amf.id, smf.id, 'Nsmf_PDUSession', 'request', payload, messageId);
        await this.delay(400);
    }

    async sendN4SessionEstablishment(smf, upf, ue, session) {
        const messageId = this.generateMessageId();
        const requestPayload = {
            pduSessionId: session.pduSessionId,
            ueIpAllocation: true,
            qos: {
                '5qi': 9,
                arp: { priorityLevel: 1, preemptCap: 'NOT_PREEMPT', preemptVuln: 'NOT_PREEMPTABLE' }
            },
            createFar: { forwardingParameters: { destinationInterface: 'ACCESS' } },
            createPdr: { pdi: { sourceInterface: 'CORE' } }
        };

        if (window.logEngine) {
            window.logEngine.addLog(smf.id, 'INFO', 'N4 Session Establishment Request → UPF', {
                messageId,
                interface: 'N4',
                protocol: 'PFCP',
                direction: 'request',
                json: requestPayload
            });
        }

        await this.animatePacket(smf.id, upf.id, 'N4', 'request', requestPayload, messageId);
        await this.delay(1200);

        // Allocate UE IP from UPF
        const assignedIP = this.allocateUEIP(upf, ue);
        const tunnelId = `gtp-${1000 + Math.floor(Math.random() * 9000)}`;

        const responseMessageId = this.generateMessageId();
        const responsePayload = {
            status: 'SUCCESS',
            cause: 'REQUEST_ACCEPTED',
            ueIp: assignedIP,
            tunnelId: tunnelId,
            f_teid: {
                teid: Math.floor(Math.random() * 4294967295),
                ipv4Address: upf.config.ipAddress
            }
        };

        if (window.logEngine) {
            window.logEngine.addLog(upf.id, 'SUCCESS', 'N4 Session Establishment Response → SMF', {
                messageId: responseMessageId,
                interface: 'N4',
                direction: 'response',
                json: responsePayload
            });
        }

        await this.animatePacket(upf.id, smf.id, 'N4', 'response', responsePayload, responseMessageId);
        await this.delay(800);

        return { ueIp: assignedIP, tunnelId };
    }

    async sendPDUSessionAccept(smf, amf, ue, session) {
        const messageId = this.generateMessageId();
        const payload = {
            pduSessionId: session.pduSessionId,
            pduSessionType: 'IPV4',
            sscMode: 'SSC_MODE_1',
            sessionAmbr: { uplink: '100 Mbps', downlink: '100 Mbps' },
            allocatedIpAddress: session.assignedIP,
            qosFlowsSetupList: [{
                qfi: 1,
                '5qi': 9,
                arp: { priorityLevel: 1 }
            }]
        };

        if (window.logEngine) {
            window.logEngine.addLog(smf.id, 'INFO', 'PDU Session Accept → AMF', {
                messageId,
                interface: 'Nsmf_PDUSession',
                direction: 'response',
                json: payload
            });
        }

        await this.animatePacket(smf.id, amf.id, 'Nsmf_PDUSession', 'response', payload, messageId);
        await this.delay(800);
    }

    async sendN1SessionAccept(amf, ue, session) {
        const messageId = this.generateMessageId();
        const payload = {
            messageType: 'PDU_SESSION_ESTABLISHMENT_ACCEPT',
            pduSessionId: session.pduSessionId,
            pduSessionType: 'IPV4',
            sscMode: 'SSC_MODE_1',
            pduAddress: session.assignedIP,
            dnn: ue.config.subscriberDnn || '5G-Lab',
            qosRules: [{ qri: 1, qfi: 1, dqrBit: true }]
        };

        if (window.logEngine) {
            window.logEngine.addLog(amf.id, 'INFO', 'N1: PDU Session Establishment Accept → UE', {
                messageId,
                interface: 'N1',
                direction: 'response',
                json: payload
            });
        }

        await this.animatePacket(amf.id, ue.id, 'N1', 'response', payload, messageId);
        await this.delay(800);
    }

    // ==========================================
    // PDU Session Release Message Flows
    // ==========================================

    async sendN1ReleaseRequest(ue, amf, session) {
        const messageId = this.generateMessageId();
        const payload = {
            messageType: 'PDU_SESSION_RELEASE_REQUEST',
            pduSessionId: session.pduSessionId,
            cause: 'REGULAR_DEACTIVATION'
        };

        if (window.logEngine) {
            window.logEngine.addLog(ue.id, 'INFO', 'N1: PDU Session Release Request → AMF', {
                messageId,
                interface: 'N1',
                direction: 'request',
                json: payload
            });
        }

        await this.animatePacket(ue.id, amf.id, 'N1', 'request', payload, messageId);
        await this.delay(800);
    }

    async sendNsmfPDUSessionRelease(amf, smf, ue, session) {
        const messageId = this.generateMessageId();
        const payload = {
            supi: `imsi-${ue.config.subscriberImsi}`,
            pduSessionId: session.pduSessionId,
            cause: 'REL_DUE_TO_UE_INITIATED'
        };

        if (window.logEngine) {
            window.logEngine.addLog(amf.id, 'INFO', 'Nsmf_PDUSession_Release (HTTP/2 POST) → SMF', {
                messageId,
                interface: 'Nsmf_PDUSession',
                method: 'POST',
                direction: 'request',
                json: payload
            });
        }

        await this.animatePacket(amf.id, smf.id, 'Nsmf_PDUSession', 'request', payload, messageId);
        await this.delay(400);
    }

    async sendN4SessionRelease(smf, upf, ue, session) {
        const messageId = this.generateMessageId();
        const payload = {
            pduSessionId: session.pduSessionId,
            cause: 'SESSION_CONTEXT_DELETED',
            releaseTunnelId: session.tunnelId
        };

        if (window.logEngine) {
            window.logEngine.addLog(smf.id, 'INFO', 'N4 Session Release Request → UPF', {
                messageId,
                interface: 'N4',
                protocol: 'PFCP',
                direction: 'request',
                json: payload
            });
        }

        await this.animatePacket(smf.id, upf.id, 'N4', 'request', payload, messageId);
        await this.delay(400);

        // UPF confirms release
        const responseMessageId = this.generateMessageId();
        const responsePayload = {
            status: 'SUCCESS',
            cause: 'REQUEST_ACCEPTED',
            freedIp: session.assignedIP,
            freedTunnelId: session.tunnelId
        };

        if (window.logEngine) {
            window.logEngine.addLog(upf.id, 'SUCCESS', 'N4 Session Release Response → SMF', {
                messageId: responseMessageId,
                interface: 'N4',
                direction: 'response',
                json: responsePayload
            });
        }

        await this.animatePacket(upf.id, smf.id, 'N4', 'response', responsePayload, responseMessageId);
        await this.delay(800);
    }

    async sendReleaseConfirmation(smf, amf, ue, session) {
        const messageId = this.generateMessageId();
        const payload = {
            pduSessionId: session.pduSessionId,
            status: 'RELEASED'
        };

        if (window.logEngine) {
            window.logEngine.addLog(smf.id, 'INFO', 'PDU Session Release Confirmation → AMF', {
                messageId,
                interface: 'Nsmf_PDUSession',
                direction: 'response',
                json: payload
            });
        }

        await this.animatePacket(smf.id, amf.id, 'Nsmf_PDUSession', 'response', payload, messageId);
        await this.delay(800);
    }

    async sendN1ReleaseComplete(amf, ue, session) {
        const messageId = this.generateMessageId();
        const payload = {
            messageType: 'PDU_SESSION_RELEASE_COMPLETE',
            pduSessionId: session.pduSessionId
        };

        if (window.logEngine) {
            window.logEngine.addLog(amf.id, 'INFO', 'N1: PDU Session Release Complete → UE', {
                messageId,
                interface: 'N1',
                direction: 'response',
                json: payload
            });
        }

        await this.animatePacket(amf.id, ue.id, 'N1', 'response', payload, messageId);
        await this.delay(800);
    }

    // ==========================================
    // Helper Methods
    // ==========================================

    /**
     * Allocate UE IP from UPF's tun0 pool
     * @param {Object} upf - UPF NF
     * @param {Object} ue - UE NF
     * @returns {string} Allocated IP
     */
    allocateUEIP(upf, ue) {
        const tun0 = upf.config.tun0Interface;
        if (!tun0) return '10.0.0.2';

        // Find next available IP
        let nextIP = tun0.nextAvailableIP || 2;
        while (nextIP <= 14) {
            const candidateIP = `10.0.0.${nextIP}`;
            const isAssigned = (tun0.assignedIPs || []).some(a => a.ip === candidateIP);
            if (!isAssigned) {
                tun0.assignedIPs = tun0.assignedIPs || [];
                tun0.assignedIPs.push({
                    ueId: ue.id,
                    ueName: ue.name,
                    ip: candidateIP,
                    assignedAt: Date.now()
                });
                tun0.nextAvailableIP = nextIP + 1;
                window.dataStore?.updateNF(upf.id, upf);
                return candidateIP;
            }
            nextIP++;
        }

        return '10.0.0.2'; // Fallback
    }

    /**
     * Animate packet between NFs
     * @param {string} sourceId - Source NF ID
     * @param {string} targetId - Target NF ID
     * @param {string} interfaceName - Interface name
     * @param {string} direction - 'request' or 'response'
     * @param {Object} payload - JSON payload
     * @param {string} messageId - Message ID for inspector linking
     */
    async animatePacket(sourceId, targetId, interfaceName, direction, payload, messageId) {
        if (window.packetAnimator) {
            await window.packetAnimator.sendPacket({
                sourceId,
                targetId,
                interface: interfaceName,
                direction,
                payload,
                messageId
            });
        }
    }

    /**
     * Helper delay function
     * @param {number} ms - Milliseconds
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Subscribe to session events
     * @param {Function} callback - Event handler
     */
    subscribe(callback) {
        this.listeners.push(callback);
    }

    /**
     * Notify listeners of events
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    notifyListeners(event, data) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (e) {
                console.error('Session listener error:', e);
            }
        });
    }
}

// Export for global access
window.SessionManager = SessionManager;
