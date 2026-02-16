/**
 * ============================================
 * PACKET ANIMATOR
 * ============================================
 * Manages animated packet flow visualization
 * 
 * Responsibilities:
 * - Create and manage transient packet objects
 * - Animate packets along NF connections
 * - Handle color coding by packet type
 * - Integrate with canvas renderer
 * - Support click detection for inspector
 */

class PacketAnimator {
    constructor() {
        // Active packets array (transient objects)
        this.packets = [];

        // Packet ID counter
        this.packetCounter = 0;

        // Animation speed (progress per frame) - slower for better visualization
        this.defaultSpeed = 0.012;

        // Animation frame ID
        this.animationFrameId = null;

        // Is animation running
        this.isRunning = false;

        // Color configuration
        this.colors = {
            request: '#3498db',      // Blue for SBI/N1 requests
            response: '#f39c12',     // Orange for responses
            error: '#e74c3c',        // Red for errors
            n4Request: '#27ae60',    // Green for N4 requests
            userPlane: '#9b59b6'     // Purple for user plane
        };

        // Click listeners for inspector
        this.clickListeners = [];

        console.log('✅ PacketAnimator initialized');
    }

    /**
     * Initialize the animator
     */
    init() {
        // Start animation loop
        this.startAnimation();

        // Add click handler to canvas
        this.setupClickHandler();

        console.log('🎬 PacketAnimator animation loop started');
    }

    /**
     * Send a packet between NFs (routes through bus if needed)
     * @param {Object} options - Packet options
     * @returns {Promise} Resolves when packet reaches destination
     */
    sendPacket(options) {
        return new Promise((resolve) => {
            const { sourceId, targetId, interface: interfaceName, direction, payload, messageId } = options;

            // Get source and target positions
            const source = window.dataStore?.getNFById(sourceId);
            const target = window.dataStore?.getNFById(targetId);

            if (!source || !target) {
                console.warn(`⚠️ Cannot animate packet: source or target not found`);
                resolve();
                return;
            }

            // Determine color based on interface and direction
            let color = this.colors.request;
            if (direction === 'response') {
                color = this.colors.response;
            } else if (interfaceName === 'N4') {
                color = this.colors.n4Request;
            } else if (options.error) {
                color = this.colors.error;
            }

            // Calculate path (may go through bus)
            const path = this.calculatePath(source, target);

            // Create packet object with path waypoints
            const packet = {
                id: `pkt-${++this.packetCounter}`,
                sourceId,
                targetId,
                sourceName: source.name,
                targetName: target.name,
                path: path,                    // Array of {x, y} waypoints
                currentSegment: 0,             // Current path segment
                segmentProgress: 0.0,          // Progress within current segment
                interface: interfaceName,
                method: options.method || (direction === 'request' ? 'POST' : '200 OK'),
                direction,
                protocol: options.protocol || 'HTTP/2',
                progress: 0.0,
                speed: options.speed || this.defaultSpeed,
                color,
                payload,
                messageId,
                onComplete: resolve,
                createdAt: Date.now()
            };

            // Set initial position
            packet.currentX = path[0].x;
            packet.currentY = path[0].y;

            // Add to active packets
            this.packets.push(packet);

            // Ensure animation is running
            if (!this.isRunning) {
                this.startAnimation();
            }
        });
    }

    /**
     * Calculate path from source to target (via bus if connected)
     * @param {Object} source - Source NF
     * @param {Object} target - Target NF
     * @returns {Array} Array of {x, y} waypoints
     */
    calculatePath(source, target) {
        const path = [];
        
        // Start at source NF center
        path.push({ x: source.position.x, y: source.position.y });

        // Check if source is connected to a bus
        const sourceBusConns = window.dataStore?.getBusConnectionsForNF(source.id) || [];
        const targetBusConns = window.dataStore?.getBusConnectionsForNF(target.id) || [];

        // Find common bus (if both connected to same bus)
        let commonBus = null;
        for (const sbc of sourceBusConns) {
            for (const tbc of targetBusConns) {
                if (sbc.busId === tbc.busId) {
                    commonBus = window.dataStore?.getBusById(sbc.busId);
                    break;
                }
            }
            if (commonBus) break;
        }

        if (commonBus) {
            // Route through the bus
            // Calculate point on bus nearest to source
            const sourceBusPoint = this.getNFBusConnectionPoint(source, commonBus);
            path.push(sourceBusPoint);

            // Calculate point on bus nearest to target  
            const targetBusPoint = this.getNFBusConnectionPoint(target, commonBus);
            
            // If horizontal bus, move along the bus line
            if (commonBus.orientation === 'horizontal') {
                // Move along horizontal bus
                if (Math.abs(sourceBusPoint.x - targetBusPoint.x) > 10) {
                    path.push({ x: targetBusPoint.x, y: sourceBusPoint.y });
                }
            } else {
                // Move along vertical bus
                if (Math.abs(sourceBusPoint.y - targetBusPoint.y) > 10) {
                    path.push({ x: sourceBusPoint.x, y: targetBusPoint.y });
                }
            }

            path.push(targetBusPoint);
        }

        // End at target NF center
        path.push({ x: target.position.x, y: target.position.y });

        return path;
    }

    /**
     * Get the point where NF connects to bus
     * @param {Object} nf - Network Function
     * @param {Object} bus - Bus object
     * @returns {Object} {x, y} connection point
     */
    getNFBusConnectionPoint(nf, bus) {
        if (bus.orientation === 'horizontal') {
            // For horizontal bus, connection is directly above/below NF
            return { x: nf.position.x, y: bus.position.y };
        } else {
            // For vertical bus, connection is directly left/right of NF
            return { x: bus.position.x, y: nf.position.y };
        }
    }

    /**
     * Start the animation loop
     */
    startAnimation() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.animate();
    }

    /**
     * Stop the animation loop
     */
    stopAnimation() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Main animation loop
     */
    animate() {
        if (!this.isRunning) return;

        // Update all packets
        this.updatePackets();

        // Request canvas re-render if there are packets
        if (this.packets.length > 0 && window.canvasRenderer) {
            window.canvasRenderer.render();
        }

        // Continue animation
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }

    /**
     * Update packet positions along multi-segment paths
     */
    updatePackets() {
        const completedPackets = [];

        this.packets.forEach(packet => {
            // Get current segment
            const path = packet.path;
            let seg = packet.currentSegment;
            
            // Update segment progress
            packet.segmentProgress += packet.speed;
            
            // Check if segment complete - move to next segment
            while (packet.segmentProgress >= 1.0 && seg < path.length - 1) {
                packet.segmentProgress -= 1.0;
                seg++;
                packet.currentSegment = seg;
            }
            
            // Check if packet has reached final destination
            if (seg >= path.length - 1 && packet.segmentProgress >= 1.0) {
                packet.segmentProgress = 1.0;
                packet.currentX = path[path.length - 1].x;
                packet.currentY = path[path.length - 1].y;
                completedPackets.push(packet);
            } else {
                // Calculate current position along segment (lerp)
                const segStart = path[seg];
                const segEnd = path[Math.min(seg + 1, path.length - 1)];
                
                packet.currentX = segStart.x + (segEnd.x - segStart.x) * packet.segmentProgress;
                packet.currentY = segStart.y + (segEnd.y - segStart.y) * packet.segmentProgress;
            }
            
            // Also update overall progress for UI
            const totalSegments = path.length - 1;
            packet.progress = totalSegments > 0 ? 
                (seg + packet.segmentProgress) / totalSegments : 1.0;
        });

        // Remove completed packets and call callbacks
        completedPackets.forEach(packet => {
            const index = this.packets.indexOf(packet);
            if (index > -1) {
                this.packets.splice(index, 1);
            }
            if (packet.onComplete) {
                packet.onComplete();
            }
        });

        // Stop animation if no packets
        if (this.packets.length === 0) {
            this.stopAnimation();
            // Final render to clear packets
            if (window.canvasRenderer) {
                window.canvasRenderer.render();
            }
        }
    }

    /**
     * Draw all packets on canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    drawPackets(ctx) {
        this.packets.forEach(packet => {
            this.drawPacket(ctx, packet);
        });
    }

    /**
     * Draw a single packet
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} packet - Packet object
     */
    drawPacket(ctx, packet) {
        const x = packet.currentX || packet.sourcePos.x;
        const y = packet.currentY || packet.sourcePos.y;

        // Draw packet as circle with glow
        ctx.save();

        // Glow effect
        ctx.shadowColor = packet.color;
        ctx.shadowBlur = 15;

        // Outer circle (glow)
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fillStyle = packet.color;
        ctx.globalAlpha = 0.3;
        ctx.fill();

        // Inner circle
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = packet.color;
        ctx.globalAlpha = 1.0;
        ctx.fill();

        // Direction arrow inside
        ctx.beginPath();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        
        if (packet.direction === 'request') {
            ctx.fillText('→', x, y);
        } else {
            ctx.fillText('←', x, y);
        }

        ctx.restore();

        // Draw label near packet
        ctx.save();
        ctx.font = '10px Arial';
        ctx.fillStyle = packet.color;
        ctx.textAlign = 'center';
        ctx.fillText(packet.interface, x, y - 18);
        ctx.restore();
    }

    /**
     * Setup click handler for packet inspection
     */
    setupClickHandler() {
        const canvas = document.getElementById('main-canvas');
        if (!canvas) return;

        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Check if click is on a packet
            const clickedPacket = this.getPacketAtPosition(x, y);
            if (clickedPacket) {
                this.notifyClickListeners(clickedPacket);
            }
        });
    }

    /**
     * Get packet at position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Object|null} Packet at position or null
     */
    getPacketAtPosition(x, y) {
        const clickRadius = 15;

        for (const packet of this.packets) {
            const px = packet.currentX || packet.sourcePos.x;
            const py = packet.currentY || packet.sourcePos.y;
            
            const distance = Math.sqrt(Math.pow(x - px, 2) + Math.pow(y - py, 2));
            if (distance <= clickRadius) {
                return packet;
            }
        }

        return null;
    }

    /**
     * Subscribe to packet click events
     * @param {Function} callback - Click handler
     */
    onPacketClick(callback) {
        this.clickListeners.push(callback);
    }

    /**
     * Notify click listeners
     * @param {Object} packet - Clicked packet
     */
    notifyClickListeners(packet) {
        this.clickListeners.forEach(callback => {
            try {
                callback(packet);
            } catch (e) {
                console.error('Packet click listener error:', e);
            }
        });
    }

    /**
     * Get all active packets
     * @returns {Array} Active packets
     */
    getPackets() {
        return this.packets;
    }

    /**
     * Clear all packets
     */
    clearPackets() {
        this.packets = [];
        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }
    }

    /**
     * Check if any packets are animating
     * @returns {boolean} True if animating
     */
    isAnimating() {
        return this.packets.length > 0;
    }
}

// Export for global access
window.PacketAnimator = PacketAnimator;
