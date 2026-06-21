// Network Topology Visualizer - topology.js
// Handles canvas-based rendering and interactive animations of the MPLS/SD-WAN network topology.

class NetworkTopology {
  constructor(canvasId, tooltipId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.tooltip = document.getElementById(tooltipId);
    
    // Core Layout Coordinate Space (scaled relative to canvas dimensions)
    this.virtualWidth = 800;
    this.virtualHeight = 450;
    
    this.nodes = {
      'BR-1-CE-1': { id: 'BR-1-CE-1', name: 'BR-1-CE-1', role: 'Branch CE', x: 120, y: 130, status: 'healthy', cpu: 15, mem: 42, peers: 'OSPF: 1, BGP: 1', bgpState: 'Established' },
      'BR-2-CE-2': { id: 'BR-2-CE-2', name: 'BR-2-CE-2', role: 'Branch CE', x: 120, y: 320, status: 'healthy', cpu: 12, mem: 38, peers: 'OSPF: 1, BGP: 1', bgpState: 'Established' },
      'P-1': { id: 'P-1', name: 'P-1 (Core)', role: 'MPLS P Router', x: 380, y: 130, status: 'healthy', cpu: 8, mem: 28, peers: 'LDP: 3', labelTable: '16 Entries' },
      'P-2': { id: 'P-2', name: 'P-2 (Core)', role: 'MPLS P Router', x: 380, y: 320, status: 'healthy', cpu: 10, mem: 30, peers: 'LDP: 3', labelTable: '16 Entries' },
      'DC-PE-1': { id: 'DC-PE-1', name: 'DC-PE-1 (Hub)', role: 'Datacenter PE', x: 680, y: 130, status: 'healthy', cpu: 22, mem: 55, peers: 'BGP: 4, LDP: 2', bgpState: 'Established' },
      'DC-PE-2': { id: 'DC-PE-2', name: 'DC-PE-2 (Hub)', role: 'Datacenter PE', x: 680, y: 320, status: 'healthy', cpu: 18, mem: 50, peers: 'BGP: 4, LDP: 2', bgpState: 'Established' }
    };
    
    this.links = [
      // Primary MPLS paths
      { id: 'link-br1-p1', source: 'BR-1-CE-1', target: 'P-1', type: 'mpls', status: 'healthy', utilization: 45, latency: 25, label: 'Gi0/1 (MPLS)' },
      { id: 'link-br2-p2', source: 'BR-2-CE-2', target: 'P-2', type: 'mpls', status: 'healthy', utilization: 35, latency: 28, label: 'Gi0/1 (MPLS)' },
      { id: 'link-p1-dc1', source: 'P-1', target: 'DC-PE-1', type: 'mpls', status: 'healthy', utilization: 60, latency: 15, label: 'Gi0/2 (MPLS Core)' },
      { id: 'link-p2-dc2', source: 'P-2', target: 'DC-PE-2', type: 'mpls', status: 'healthy', utilization: 50, latency: 18, label: 'Gi0/2 (MPLS Core)' },
      { id: 'link-p1-p2', source: 'P-1', target: 'P-2', type: 'core-mesh', status: 'healthy', utilization: 20, latency: 5, label: 'Gi0/3 (Trunk)' },
      { id: 'link-dc1-dc2', source: 'DC-PE-1', target: 'DC-PE-2', type: 'core-mesh', status: 'healthy', utilization: 15, latency: 2, label: 'Gi0/4 (IBGP)' },
      
      // SD-WAN IPSec Overlays (rendered as curved dotted lines representing Internet path)
      { id: 'tunnel-br1-dc1', source: 'BR-1-CE-1', target: 'DC-PE-1', type: 'ipsec', status: 'healthy', utilization: 10, latency: 45, label: 'Tunnel10 (IPSec/Internet)' },
      { id: 'tunnel-br2-dc2', source: 'BR-2-CE-2', target: 'DC-PE-2', type: 'ipsec', status: 'healthy', utilization: 12, latency: 48, label: 'Tunnel10 (IPSec/Internet)' }
    ];
    
    this.particles = [];
    this.hoveredNode = null;
    this.hoveredLink = null;
    this.draggedNode = null;
    
    this.initEvents();
    this.resize();
    
    // Periodically spawn packet particles along links
    setInterval(() => this.spawnParticles(), 180);
  }
  
  initEvents() {
    window.addEventListener('resize', () => this.resize());
    
    const getMousePos = (evt) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.virtualWidth / rect.width;
      const scaleY = this.virtualHeight / rect.height;
      return {
        x: (evt.clientX - rect.left) * scaleX,
        y: (evt.clientY - rect.top) * scaleY,
        clientX: evt.clientX,
        clientY: evt.clientY
      };
    };
    
    this.canvas.addEventListener('mousedown', (evt) => {
      const pos = getMousePos(evt);
      
      // 1. Check Node drag start & inspect
      for (const key in this.nodes) {
        const node = this.nodes[key];
        const dist = Math.hypot(node.x - pos.x, node.y - pos.y);
        if (dist < 22) {
          this.draggedNode = node;
          if (window.app && typeof window.app.inspectDevice === 'function') {
            window.app.inspectDevice(node);
          }
          return;
        }
      }
      
      // 2. Check Link Click to toggle status (Cut / Heal)
      for (const link of this.links) {
        const s = this.nodes[link.source];
        const t = this.nodes[link.target];
        let dist = 999;
        
        if (link.type === 'ipsec') {
          const midX = (s.x + t.x) / 2;
          const midY = (s.y + t.y) / 2 - 40;
          dist = Math.min(Math.hypot(midX - pos.x, midY - pos.y), 
                          Math.hypot(((s.x+midX)/2) - pos.x, ((s.y+midY)/2 - 20) - pos.y),
                          Math.hypot(((t.x+midX)/2) - pos.x, ((t.y+midY)/2 - 20) - pos.y));
        } else {
          dist = this.distToSegment(pos, s, t);
        }
        
        if (dist < 10) {
          if (link.status === 'down') {
            link.status = 'healthy';
            if (window.copilot) {
              window.copilot.addSystemMessage(`SSH: Interface administratively UP on link [${link.label}]. Re-establishing adjacency...`);
            }
          } else {
            link.status = 'down';
            if (window.copilot) {
              window.copilot.addSystemMessage(`SYS: Interface administratively DOWN (Port Cut) on link [${link.label}]. Recalculating path convergence.`);
              setTimeout(() => {
                window.copilot.addSystemMessage(`AI NOC: Path convergence complete. Non-critical traffic steered to backup VPN tunnel.`);
              }, 1200);
            }
          }
          this.updateTooltip(evt.clientX, evt.clientY);
          return;
        }
      }
    });
    
    this.canvas.addEventListener('mousemove', (evt) => {
      const pos = getMousePos(evt);
      
      if (this.draggedNode) {
        this.draggedNode.x = Math.max(30, Math.min(this.virtualWidth - 30, pos.x));
        this.draggedNode.y = Math.max(30, Math.min(this.virtualHeight - 30, pos.y));
        this.updateTooltip(evt.clientX, evt.clientY);
        return;
      }
      
      let foundNode = null;
      let foundLink = null;
      
      // Check Node Hover
      for (const key in this.nodes) {
        const node = this.nodes[key];
        const dist = Math.hypot(node.x - pos.x, node.y - pos.y);
        if (dist < 22) {
          foundNode = node;
          break;
        }
      }
      
      // Check Link Hover if no node hovered
      if (!foundNode) {
        for (const link of this.links) {
          const s = this.nodes[link.source];
          const t = this.nodes[link.target];
          let dist = 999;
          
          if (link.type === 'ipsec') {
            const midX = (s.x + t.x) / 2;
            const midY = (s.y + t.y) / 2 - 40;
            dist = Math.min(Math.hypot(midX - pos.x, midY - pos.y), 
                            Math.hypot(((s.x+midX)/2) - pos.x, ((s.y+midY)/2 - 20) - pos.y),
                            Math.hypot(((t.x+midX)/2) - pos.x, ((t.y+midY)/2 - 20) - pos.y));
          } else {
            dist = this.distToSegment(pos, s, t);
          }
          
          if (dist < 10) {
            foundLink = link;
            break;
          }
        }
      }
      
      this.hoveredNode = foundNode;
      this.hoveredLink = foundLink;
      
      this.updateTooltip(evt.clientX, evt.clientY);
    });
    
    window.addEventListener('mouseup', () => {
      this.draggedNode = null;
    });
    
    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredNode = null;
      this.hoveredLink = null;
      this.tooltip.style.display = 'none';
    });
  }
  
  distToSegment(p, v, w) {
    const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }
  
  resize() {
    const container = this.canvas.parentElement;
    this.canvas.width = container.clientWidth * window.devicePixelRatio;
    this.canvas.height = container.clientHeight * window.devicePixelRatio;
    this.canvas.style.width = container.clientWidth + 'px';
    this.canvas.style.height = container.clientHeight + 'px';
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }
  
  updateTooltip(clientX, clientY) {
    if (this.hoveredNode) {
      const node = this.hoveredNode;
      let html = `<div class="tooltip-title">${node.name} (${node.role})</div>`;
      html += `<div class="tooltip-row"><span>Status:</span><span style="color:${this.getStatusColor(node.status)}">${node.status.toUpperCase()}</span></div>`;
      html += `<div class="tooltip-row"><span>CPU Core Usage:</span><span class="tooltip-val">${node.cpu}%</span></div>`;
      html += `<div class="tooltip-row"><span>RAM Usage:</span><span class="tooltip-val">${node.mem}%</span></div>`;
      if (node.bgpState) html += `<div class="tooltip-row"><span>BGP Session:</span><span class="tooltip-val">${node.bgpState}</span></div>`;
      if (node.labelTable) html += `<div class="tooltip-row"><span>MPLS LFIB:</span><span class="tooltip-val">${node.labelTable}</span></div>`;
      
      this.tooltip.innerHTML = html;
      this.tooltip.style.left = (clientX + 15) + 'px';
      this.tooltip.style.top = (clientY + 15) + 'px';
      this.tooltip.style.display = 'block';
    } else if (this.hoveredLink) {
      const link = this.hoveredLink;
      let html = `<div class="tooltip-title">${link.label}</div>`;
      html += `<div class="tooltip-row"><span>Health Status:</span><span style="color:${this.getStatusColor(link.status)}">${link.status.toUpperCase()}</span></div>`;
      html += `<div class="tooltip-row"><span>Throughput Util:</span><span class="tooltip-val">${link.utilization}%</span></div>`;
      html += `<div class="tooltip-row"><span>One-Way Delay:</span><span class="tooltip-val">${link.latency} ms</span></div>`;
      
      this.tooltip.innerHTML = html;
      this.tooltip.style.left = (clientX + 15) + 'px';
      this.tooltip.style.top = (clientY + 15) + 'px';
      this.tooltip.style.display = 'block';
    } else {
      this.tooltip.style.display = 'none';
    }
  }
  
  getStatusColor(status) {
    if (status === 'healthy') return '#10b981';
    if (status === 'warning' || status === 'degraded') return '#f59e0b';
    return '#ef4444';
  }
  
  spawnParticles() {
    const mpls1Down = this.links.find(l => l.id === 'link-br1-p1').status === 'down';
    const mpls2Down = this.links.find(l => l.id === 'link-br2-p2').status === 'down';
    
    this.links.forEach(link => {
      if (link.status === 'down') return;
      
      // Dynamic steering visual flow adjust
      if (link.id === 'tunnel-br1-dc1' && mpls1Down) {
        link.utilization = 75;
      } else if (link.id === 'tunnel-br1-dc1' && !mpls1Down && window.telemetry && window.telemetry.activeScenario !== 'bgp_flap') {
        link.utilization = 10;
      }
      
      if (link.id === 'tunnel-br2-dc2' && mpls2Down) {
        link.utilization = 70;
      } else if (link.id === 'tunnel-br2-dc2' && !mpls2Down) {
        link.utilization = 12;
      }
      
      const spawnChance = link.utilization / 100;
      if (Math.random() > spawnChance * 1.5 + 0.15) return;
      
      let color = '#10b981'; // green
      let size = 2;
      let speed = 0.008 + Math.random() * 0.004;
      
      if (link.status === 'warning') {
        color = Math.random() > 0.6 ? '#f59e0b' : '#10b981';
        speed = 0.005;
      } else if (link.status === 'degraded') {
        color = Math.random() > 0.5 ? '#ef4444' : '#f59e0b';
        speed = 0.004;
      }
      
      if (Math.random() < 0.1) {
        color = '#3b82f6';
        size = 2.5;
      }
      
      this.particles.push({
        linkId: link.id,
        progress: 0,
        speed: speed,
        color: color,
        size: size,
        curved: link.type === 'ipsec'
      });
    });
  }
  
  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.progress += p.speed;
      
      // Packet loss simulation - drop packets mid-flight
      const link = this.links.find(l => l.id === p.linkId);
      if (link && link.status === 'degraded' && p.progress > 0.4 && p.progress < 0.6) {
        if (Math.random() < 0.02) { // 2% chance to drop mid-transit visually
          p.color = '#ef4444';
          p.size = 3.5;
          p.speed = 0.001; // halt/fade
        }
      }
      
      if (p.progress >= 1 || (p.color === '#ef4444' && Math.random() > 0.9)) {
        this.particles.splice(i, 1);
      }
    }
  }
  
  draw() {
    const scaleX = this.canvas.width / window.devicePixelRatio / this.virtualWidth;
    const scaleY = this.canvas.height / window.devicePixelRatio / this.virtualHeight;
    
    this.ctx.clearRect(0, 0, this.virtualWidth, this.virtualHeight);
    
    // 1. Draw Grid Lines (Background decoration)
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
    this.ctx.lineWidth = 1;
    for (let x = 0; x < this.virtualWidth; x += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.virtualHeight);
      this.ctx.stroke();
    }
    for (let y = 0; y < this.virtualHeight; y += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.virtualWidth, y);
      this.ctx.stroke();
    }
    
    // 2. Draw Links
    this.links.forEach(link => {
      const s = this.nodes[link.source];
      const t = this.nodes[link.target];
      
      this.ctx.beginPath();
      if (link.type === 'ipsec') {
        // Draw curved dashed line representing tunnels
        this.ctx.strokeStyle = link.status === 'healthy' ? 'rgba(168, 85, 247, 0.4)' : 
                               link.status === 'warning' ? 'rgba(245, 158, 11, 0.6)' : 'rgba(239, 68, 68, 0.6)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([4, 4]);
        
        this.ctx.moveTo(s.x, s.y);
        const ctrlX = (s.x + t.x) / 2;
        const ctrlY = (s.y + t.y) / 2 - 40; // curve upwards
        this.ctx.quadraticCurveTo(ctrlX, ctrlY, t.x, t.y);
        this.ctx.stroke();
        this.ctx.setLineDash([]); // Reset
      } else {
        // Draw straight line for MPLS circuits
        let glowColor = 'rgba(0, 240, 255, 0.08)';
        if (link.status === 'warning') {
          this.ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
          glowColor = 'rgba(245, 158, 11, 0.15)';
        } else if (link.status === 'degraded' || link.status === 'down') {
          this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
          glowColor = 'rgba(239, 68, 68, 0.15)';
        } else {
          this.ctx.strokeStyle = 'rgba(30, 41, 59, 0.8)';
        }
        
        // Draw Outer Glow for warning/critical links
        if (link.status !== 'healthy') {
          this.ctx.lineWidth = 6;
          this.ctx.strokeStyle = glowColor;
          this.ctx.moveTo(s.x, s.y);
          this.ctx.lineTo(t.x, t.y);
          this.ctx.stroke();
          this.ctx.beginPath();
        }
        
        this.ctx.strokeStyle = link.status === 'healthy' ? 'rgba(30, 41, 59, 0.8)' : 
                               link.status === 'warning' ? '#f59e0b' : '#ef4444';
        this.ctx.lineWidth = 2;
        this.ctx.moveTo(s.x, s.y);
        this.ctx.lineTo(t.x, t.y);
        this.ctx.stroke();
      }
      
      // Hover overlay
      if (this.hoveredLink === link) {
        this.ctx.beginPath();
        this.ctx.lineWidth = 8;
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
        if (link.type === 'ipsec') {
          this.ctx.moveTo(s.x, s.y);
          const ctrlX = (s.x + t.x) / 2;
          const ctrlY = (s.y + t.y) / 2 - 40;
          this.ctx.quadraticCurveTo(ctrlX, ctrlY, t.x, t.y);
        } else {
          this.ctx.moveTo(s.x, s.y);
          this.ctx.lineTo(t.x, t.y);
        }
        this.ctx.stroke();
      }
    });
    
    // 3. Draw Particles (packets)
    this.particles.forEach(p => {
      const link = this.links.find(l => l.id === p.linkId);
      if (!link) return;
      
      const s = this.nodes[link.source];
      const t = this.nodes[link.target];
      let px, py;
      
      if (p.curved) {
        // Quadratic bezier interpolation for curved tunnels
        const ctrlX = (s.x + t.x) / 2;
        const ctrlY = (s.y + t.y) / 2 - 40;
        const mt = 1 - p.progress;
        px = mt * mt * s.x + 2 * mt * p.progress * ctrlX + p.progress * p.progress * t.x;
        py = mt * mt * s.y + 2 * mt * p.progress * ctrlY + p.progress * p.progress * t.y;
      } else {
        // Linear interpolation
        px = s.x + (t.x - s.x) * p.progress;
        py = s.y + (t.y - s.y) * p.progress;
      }
      
      this.ctx.beginPath();
      this.ctx.arc(px, py, p.size, 0, 2 * Math.PI);
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 6;
      this.ctx.fill();
      this.ctx.shadowBlur = 0; // Reset
    });
    
    // 4. Draw Nodes
    for (const key in this.nodes) {
      const node = this.nodes[key];
      
      // Node Base Shape (Outer Circle)
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, 20, 0, 2 * Math.PI);
      
      let fillStyle = '#0d0d16';
      let strokeStyle = 'rgba(255, 255, 255, 0.15)';
      let shadowColor = 'transparent';
      let shadowBlur = 0;
      
      if (node.status === 'healthy') {
        strokeStyle = 'rgba(16, 185, 129, 0.4)'; // Emerald
      } else if (node.status === 'warning') {
        strokeStyle = '#f59e0b'; // Amber
        shadowColor = 'rgba(245, 158, 11, 0.4)';
        shadowBlur = 10;
      } else if (node.status === 'degraded' || node.status === 'down') {
        strokeStyle = '#ef4444'; // Rose
        shadowColor = 'rgba(239, 68, 68, 0.5)';
        shadowBlur = 12;
      }
      
      this.ctx.fillStyle = fillStyle;
      this.ctx.strokeStyle = strokeStyle;
      this.ctx.lineWidth = 2.5;
      
      if (shadowBlur > 0) {
        this.ctx.shadowColor = shadowColor;
        this.ctx.shadowBlur = shadowBlur;
      }
      this.ctx.fill();
      this.ctx.shadowBlur = 0; // Reset
      this.ctx.stroke();
      
      // Inner details based on role
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, 14, 0, 2 * Math.PI);
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      this.ctx.fill();
      
      // Hover/Drag Highlight Ring
      if (this.hoveredNode === node || this.draggedNode === node) {
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, 25, 0, 2 * Math.PI);
        this.ctx.strokeStyle = this.draggedNode === node ? '#a855f7' : 'rgba(0, 240, 255, 0.35)';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
      }
      
      // Draw Node Name Label
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '700 9px "JetBrains Mono", monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(node.name, node.x, node.y - 26);
      
      // Draw Sub-label (Role)
      this.ctx.fillStyle = 'rgba(156, 163, 175, 0.8)';
      this.ctx.font = '500 7px "Inter", sans-serif';
      this.ctx.fillText(node.role, node.x, node.y + 30);
      
      // Draw Inner Icon Letter (C for CE, P for P router, H for PE Hub)
      this.ctx.fillStyle = node.status === 'healthy' ? 'rgba(255, 255, 255, 0.5)' : strokeStyle;
      this.ctx.font = '800 10px "Inter", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      let icon = 'C';
      if (node.role.includes('PE')) icon = 'PE';
      if (node.role.includes('P Router')) icon = 'P';
      this.ctx.fillText(icon, node.x, node.y);
      this.ctx.textBaseline = 'alphabetic'; // Reset
    }
  }
}

// Bind to window for app.js access
window.NetworkTopology = NetworkTopology;
