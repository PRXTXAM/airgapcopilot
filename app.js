// Dashboard App Controller - app.js
// Orchestrates user interaction, background loops, telemetry, and copilot flows.

class DashboardApp {
  constructor() {
    this.simClock = new Date(2026, 5, 22, 0, 55, 0);
    this.recoveryMode = false;
    this.recoveryTicks = 0;
    this.alertFired = false;
    
    this.init();
  }
  
  init() {
    // 1. Instantiate visual sub-systems
    window.topology = new NetworkTopology('topology-canvas', 'topology-tooltip');
    window.telemetry = new TelemetryEngine();
    window.copilot = new CopilotEngine('copilot-chat-log', 'playbook-steps-container');
    
    // 2. Populate RAG Document panel in the DOM
    this.populateRagIndex();
    
    // 3. Bind UI event elements
    this.bindEvents();
    
    // 4. Start continuously drawing topology canvas (animation frame loop)
    const runCanvas = () => {
      window.topology.updateParticles();
      window.topology.draw();
      requestAnimationFrame(runCanvas);
    };
    runCanvas();
    
    // 5. Start background telemetry updates (every 1.2 seconds)
    setInterval(() => this.systemTick(), 1200);
    
    // Trigger initial background telemetry paths
    this.updateCharts();
  }
  
  bindEvents() {
    // Bind global reset on key ESC
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.resetDashboard();
      }
    });
  }
  
  populateRagIndex() {
    const container = document.getElementById('rag-documents-index');
    container.innerHTML = `
      <div class="rag-header-desc">
        Local vector database files synced inside the air-gapped boundary. These documents are dynamically retrieved based on semantic similarity search queries.
      </div>
    `;
    
    window.RUNBOOKS.forEach(doc => {
      const card = document.createElement('article');
      card.className = 'rag-doc-card';
      card.id = doc.id;
      card.innerHTML = `
        <div class="rag-doc-title">
          <span>${doc.title}</span>
          <span style="font-size:0.6rem; color:var(--accent-cyan); font-family:monospace;">${doc.category}</span>
        </div>
        <div class="rag-doc-meta">
          TAGS: ${doc.tags.map(t => '#' + t).join(' ')} | UPDATED: ${doc.lastUpdated}
        </div>
        <pre class="rag-doc-excerpt">${doc.content}</pre>
      `;
      container.appendChild(card);
    });
  }
  
  switchTab(tabName) {
    // Buttons
    document.getElementById('btn-tab-copilot').classList.toggle('active', tabName === 'copilot');
    document.getElementById('btn-tab-rag').classList.toggle('active', tabName === 'rag');
    
    // Content divs
    document.getElementById('content-tab-copilot').classList.toggle('active', tabName === 'copilot');
    document.getElementById('content-tab-rag').classList.toggle('active', tabName === 'rag');
  }
  
  triggerScenario(scenarioName) {
    // Clear highlights on other buttons
    document.querySelectorAll('.btn-scenario').forEach(btn => btn.classList.remove('active'));
    
    // Toggle active state
    if (window.telemetry.activeScenario === scenarioName) {
      this.resetDashboard();
    } else {
      this.resetDashboard(); // Clean slate first
      
      window.telemetry.setScenario(scenarioName);
      document.getElementById(`btn-scen-${scenarioName}`).classList.add('active');
      this.alertFired = false;
      
      // Post system announcement
      window.copilot.addSystemMessage(`SCENARIO INJECTED: Preparing telemetry changes for [${scenarioName.toUpperCase()}]. AI Copilot listening for anomalous signals...`);
    }
  }
  
  systemTick() {
    // Increment clock by 12 seconds
    this.simClock.setSeconds(this.simClock.getSeconds() + 12);
    const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    document.getElementById('sim-clock-display').textContent = `CLOCK: ` + this.simClock.toLocaleString('sv-SE').replace('T', ' ');
    
    if (this.recoveryMode) {
      this.handleRecoveryTick();
    }
    
    // Update telemetry engine metrics
    window.telemetry.tick(window.topology);
    
    // Update live indicators and SVG charts
    this.updateKpiCards();
    this.updateCharts();
    
    // Check if anomaly is climbing and fire predictive AI Copilot alert
    if (window.telemetry.activeScenario && !this.alertFired) {
      const step = window.telemetry.scenarioProgress;
      if (step > 6) { // Fire alert early as values start drifting
        this.alertFired = true;
        window.copilot.triggerAlert(window.telemetry.activeScenario);
        this.switchTab('copilot'); // Auto switch to Copilot tab
      }
    }
  }
  
  updateKpiCards() {
    const lat = window.telemetry.metrics.latency[window.telemetry.metrics.latency.length - 1];
    const loss = window.telemetry.metrics.loss[window.telemetry.metrics.loss.length - 1];
    const bgp = window.telemetry.metrics.bgpStress[window.telemetry.metrics.bgpStress.length - 1];
    const health = window.telemetry.metrics.tunnelHealth[window.telemetry.metrics.tunnelHealth.length - 1];
    
    // Text values
    document.getElementById('kpi-val-latency').textContent = `${lat.toFixed(1)} ms`;
    document.getElementById('kpi-val-loss').textContent = `${loss.toFixed(1)}%`;
    document.getElementById('kpi-val-bgp').textContent = `${bgp.toFixed(1)} updates`;
    document.getElementById('kpi-val-tunnel').textContent = `${health.toFixed(1)}%`;
    
    // Classes & indicators
    const latCard = document.getElementById('kpi-latency');
    const lossCard = document.getElementById('kpi-loss');
    const bgpCard = document.getElementById('kpi-bgp');
    const healthCard = document.getElementById('kpi-tunnel');
    
    // Latency
    const latTrend = document.getElementById('kpi-trend-latency');
    if (lat > 75) {
      latCard.className = 'kpi-card error';
      latTrend.className = 'kpi-trend up';
      latTrend.textContent = '+HIGH';
    } else if (lat > 40) {
      latCard.className = 'kpi-card warning';
      latTrend.className = 'kpi-trend up';
      latTrend.textContent = '+DRIFT';
    } else {
      latCard.className = 'kpi-card success';
      latTrend.className = 'kpi-trend stable';
      latTrend.textContent = 'STABLE';
    }
    
    // Loss
    const lossTrend = document.getElementById('kpi-trend-loss');
    if (loss > 2.0) {
      lossCard.className = 'kpi-card error';
      lossTrend.className = 'kpi-trend up';
      lossTrend.textContent = '+LOSS';
    } else if (loss > 0.3) {
      lossCard.className = 'kpi-card warning';
      lossTrend.className = 'kpi-trend up';
      lossTrend.textContent = 'JITTER';
    } else {
      lossCard.className = 'kpi-card success';
      lossTrend.className = 'kpi-trend stable';
      lossTrend.textContent = '0.0%';
    }
    
    // BGP Route Stability
    const bgpTrend = document.getElementById('kpi-trend-bgp');
    if (bgp > 30) {
      bgpCard.className = 'kpi-card error';
      bgpTrend.className = 'kpi-trend up';
      bgpTrend.textContent = 'FLAPPING';
    } else if (bgp > 5) {
      bgpCard.className = 'kpi-card warning';
      bgpTrend.className = 'kpi-trend up';
      bgpTrend.textContent = 'STRESS';
    } else {
      bgpCard.className = 'kpi-card success';
      bgpTrend.className = 'kpi-trend stable';
      bgpTrend.textContent = 'STABLE';
    }
    
    // Tunnel Compliance Health
    const healthTrend = document.getElementById('kpi-trend-tunnel');
    if (health < 75) {
      healthCard.className = 'kpi-card error';
      healthTrend.className = 'kpi-trend up';
      healthTrend.textContent = 'CRITICAL';
    } else if (health < 90) {
      healthCard.className = 'kpi-card warning';
      healthTrend.className = 'kpi-trend up';
      healthTrend.textContent = 'DRIFT';
    } else {
      healthCard.className = 'kpi-card success';
      healthTrend.className = 'kpi-trend stable';
      healthTrend.textContent = 'HEALTHY';
    }
  }
  
  updateCharts() {
    const lat = window.telemetry.metrics.latency[window.telemetry.metrics.latency.length - 1];
    const loss = window.telemetry.metrics.loss[window.telemetry.metrics.loss.length - 1];
    const util = window.telemetry.metrics.utilization[window.telemetry.metrics.utilization.length - 1];
    
    // Update live text labels
    document.getElementById('val-utilization').textContent = `${util.toFixed(1)}%`;
    document.getElementById('val-latency').textContent = `${lat.toFixed(1)} ms`;
    document.getElementById('val-loss').textContent = `${loss.toFixed(1)}%`;
    
    // Redraw SVG paths
    document.getElementById('path-utilization').setAttribute('d', window.telemetry.getSvgPath('utilization', 400, 100, 100));
    document.getElementById('forecast-utilization').setAttribute('d', window.telemetry.getForecastPath('utilization', 400, 100, 100));
    
    document.getElementById('path-latency').setAttribute('d', window.telemetry.getSvgPath('latency', 400, 100, 150));
    document.getElementById('forecast-latency').setAttribute('d', window.telemetry.getForecastPath('latency', 400, 100, 150));
    
    document.getElementById('path-loss').setAttribute('d', window.telemetry.getSvgPath('loss', 400, 100, 15));
    document.getElementById('forecast-loss').setAttribute('d', window.telemetry.getForecastPath('loss', 400, 100, 15));
    
    // Draw utilization shaded area
    const utilPath = window.telemetry.getSvgPath('utilization', 400, 100, 100);
    if (utilPath) {
      const areaPath = utilPath + ' L 400,90 L 0,90 Z';
      document.getElementById('path-utilization-area').setAttribute('d', areaPath);
    }
    
    // Update active route display label on Topology card
    const routeLabel = document.getElementById('topology-active-path');
    const timerBadge = document.getElementById('predictive-timer-badge');
    
    if (window.telemetry.activeScenario) {
      if (window.telemetry.timeToImpact !== null) {
        if (window.telemetry.timeToImpact > 0) {
          const mins = Math.floor(window.telemetry.timeToImpact / 60);
          const secs = window.telemetry.timeToImpact % 60;
          timerBadge.style.display = 'block';
          timerBadge.style.color = 'var(--warning)';
          timerBadge.style.backgroundColor = 'rgba(245,158,11,0.06)';
          timerBadge.textContent = `EST. IMPACT: -0${mins}:${secs < 10 ? '0' + secs : secs}`;
        } else {
          timerBadge.style.display = 'block';
          timerBadge.style.color = 'var(--error)';
          timerBadge.style.backgroundColor = 'rgba(239,68,68,0.08)';
          timerBadge.textContent = `SLA BREACH DETECTED`;
        }
      }
      
      if (window.telemetry.activeScenario === 'bgp_flap') {
        routeLabel.textContent = window.telemetry.scenarioProgress >= 22 ? 
          'PATH: SECURE IPSEC TUNNEL10 (FAILOVER)' : 'PATH: UNSTABLE MPLS CORE (CONVERGING)';
        routeLabel.style.color = window.telemetry.scenarioProgress >= 22 ? 'var(--accent-purple)' : 'var(--warning)';
      } else if (window.telemetry.activeScenario === 'congestion') {
        routeLabel.textContent = 'PATH: PRIMARY MPLS (CONGESTED)';
        routeLabel.style.color = 'var(--error)';
      } else {
        routeLabel.textContent = 'PATH: INJECTED FAULT RUNNING';
        routeLabel.style.color = 'var(--warning)';
      }
    } else {
      timerBadge.style.display = 'none';
      routeLabel.textContent = 'PATH: PRIMARY MPLS (ACTIVE)';
      routeLabel.style.color = 'var(--success)';
    }
  }
  
  triggerRecovery() {
    this.recoveryMode = true;
    this.recoveryTicks = 0;
    
    // Remove highlights from buttons
    document.querySelectorAll('.btn-scenario').forEach(btn => btn.classList.remove('active'));
    
    window.copilot.addSystemMessage("Initiating automated configuration synchronization. Re-routing traffic to normalized pathways...");
  }
  
  handleRecoveryTick() {
    this.recoveryTicks++;
    
    // Linearly interpolate baseline metrics back to normal over 6 ticks (approx 7.2 seconds)
    const factor = this.recoveryTicks / 6;
    
    if (factor >= 1) {
      this.recoveryMode = false;
      window.telemetry.setScenario(null); // Clear telemetry scenario
      window.topology.links.forEach(l => l.status = 'healthy');
      
      // Restore links properties
      window.topology.links.find(l => l.id === 'link-br1-p1').utilization = 45;
      window.topology.links.find(l => l.id === 'tunnel-br1-dc1').utilization = 10;
      
      window.copilot.addSystemMessage("SYS: Network status reporting healthy. Convergence thresholds cleared. AI Copilot in telemetry standby.");
      window.copilot.clearPlaybook();
      this.alertFired = false;
    } else {
      // Shift parameters back dynamically
      window.telemetry.baselines.latency = window.telemetry.baselines.latency * (1 - factor) + 25 * factor;
      window.telemetry.baselines.loss = window.telemetry.baselines.loss * (1 - factor) + 0 * factor;
      window.telemetry.baselines.bgpStress = window.telemetry.baselines.bgpStress * (1 - factor) + 2 * factor;
      window.telemetry.baselines.tunnelHealth = window.telemetry.baselines.tunnelHealth * (1 - factor) + 99 * factor;
      window.telemetry.baselines.utilization = window.telemetry.baselines.utilization * (1 - factor) + 45 * factor;
      
      // Update specific link states
      window.topology.links.forEach(link => {
        if (link.status === 'error' || link.status === 'down') {
          link.status = 'warning';
        }
      });
    }
  }
  
  sendChatInput() {
    const field = document.getElementById('copilot-input-field');
    const query = field.value.trim();
    if (!query) return;
    
    field.value = '';
    
    // Parse manual clear command
    if (query.toLowerCase() === '/clear' || query.toLowerCase() === 'clear') {
      window.copilot.clearChat();
      return;
    }
    
    window.copilot.respondToQuery(query);
  }
  
  sendQuickQuery(query) {
    this.switchTab('copilot');
    window.copilot.respondToQuery(query);
  }
  
  inspectDevice(node) {
    if (!window.copilot) return;
    
    this.switchTab('copilot');
    
    const timestamp = new Date().toLocaleTimeString();
    const sshHeader = `SSH REMOTE DIAGNOSTICS: ${node.name}`;
    
    let diagOutput = '';
    if (node.role.includes('Branch CE')) {
      diagOutput = `${node.name}# show interfaces gigabitethernet 0/1 stats
GigabitEthernet0/1 is up, line protocol is up
  Hardware is CEF-capable WAN Edge interface
  MTU 1500 bytes, BW 100000 Kbit/sec, DLY 10000 usec
  Encapsulation ARPA, loopback not set
  Keepalive set (10 sec)
  5-minute input rate: ${node.cpu * 1200} bits/sec, 42 packets/sec
  5-minute output rate: ${node.mem * 950} bits/sec, 38 packets/sec
  Last clearing of "show interface" counters: never
  Input queue: 0/75/0/0 (size/max/drops/flushes); Total output drops: 0
  Queueing strategy: Class-Based Weighted Fair Queueing (CBWFQ)
  BGP Session State: ${node.bgpState || 'Established'}`;
    } else if (node.role.includes('MPLS P Router')) {
      diagOutput = `${node.name}# show mpls ldp bindings
  LIB Local Label Database - Label Distribution Protocol
  Active LDP Peers: ${node.peers}
  Binding prefix 10.10.1.0/24: Local label: 16  Remote peer P-2: 18
  Binding prefix 10.20.2.0/24: Local label: 17  Remote peer DC-PE-1: 19
  Binding prefix 10.30.3.0/24: Local label: 22  Remote peer DC-PE-2: 24
  CPU Utilization: ${node.cpu}% (5s average)
  LFIB Entry Table Size: ${node.labelTable || '16 Entries'}
  Buffer queues: Healthy, drops: 0`;
    } else { // PE Hub
      diagOutput = `${node.name}# show ip bgp vrf MPLS-VPN summary
BGP router identifier 172.16.100.1, local AS number 65000
BGP table version is 284, main routing table version 284
Neighbor        V    AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd
10.0.1.1        4 65001   12450   12451      284    0    0 04:12:05        4
10.0.2.1        4 65002   12448   12449      284    0    0 04:12:02        4
${node.name} Memory Usage: ${node.mem}% (Active allocations: VRF default, VPN-v4)`;
    }
    
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble assistant';
    bubble.style.borderLeft = '3px solid var(--accent-purple)';
    bubble.innerHTML = `
      <div class="copilot-meta"><span>${sshHeader}</span><span>${timestamp}</span></div>
      <pre style="font-family:'JetBrains Mono', monospace; font-size:0.7rem; background:rgba(0,0,0,0.55); padding:0.65rem; border-radius:6px; border:1px solid rgba(168,85,247,0.25); color:#a7f3d0; white-space:pre-wrap; overflow-x:auto;">${diagOutput}</pre>
    `;
    
    const chatLog = document.getElementById('copilot-chat-log');
    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;
  }
  
  resetDashboard() {
    window.telemetry.setScenario(null);
    this.recoveryMode = false;
    this.alertFired = false;
    document.querySelectorAll('.btn-scenario').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.rag-doc-card').forEach(el => el.classList.remove('highlighted'));
    
    window.copilot.clearChat();
    window.copilot.addSystemMessage("System indicators reinitialized. Air-gapped prediction pipelines online.");
    
    // Force healthy node states
    window.telemetry.simulateNormalBackground(window.topology);
  }
}

// Instantiate on page load
window.addEventListener('load', () => {
  window.app = new DashboardApp();
});
