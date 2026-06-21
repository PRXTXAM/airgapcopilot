// Telemetry Simulation Engine - telemetry.js
// Simulates background network metrics and handles telemetry changes during fault scenarios.

class TelemetryEngine {
  constructor() {
    this.historyLength = 40;
    
    // Core telemetry history arrays
    this.metrics = {
      latency: Array(this.historyLength).fill(25),
      loss: Array(this.historyLength).fill(0),
      bgpStress: Array(this.historyLength).fill(2),
      tunnelHealth: Array(this.historyLength).fill(99),
      utilization: Array(this.historyLength).fill(45)
    };
    
    this.activeScenario = null;
    this.scenarioProgress = 0; // Ticks elapsed since scenario start
    this.timeToImpact = null; // in seconds
    
    // Background noise fluctuation limits
    this.baselines = {
      latency: 25,
      loss: 0,
      bgpStress: 2,
      tunnelHealth: 99,
      utilization: 45
    };
  }
  
  setScenario(scenarioName) {
    this.activeScenario = scenarioName;
    this.scenarioProgress = 0;
    this.timeToImpact = null;
    
    if (!scenarioName) {
      // Clear indicators
      this.baselines = { latency: 25, loss: 0, bgpStress: 2, tunnelHealth: 99, utilization: 45 };
    }
  }
  
  tick(topology) {
    this.scenarioProgress++;
    
    // 1. Update Telemetry metrics based on current active scenario
    if (this.activeScenario === 'congestion') {
      this.simulateCongestion(topology);
    } else if (this.activeScenario === 'bgp_flap') {
      this.simulateBgpFlap(topology);
    } else if (this.activeScenario === 'mpls_failure') {
      this.simulateMplsFailure(topology);
    } else if (this.activeScenario === 'policy_drift') {
      this.simulatePolicyDrift(topology);
    } else {
      this.simulateNormalBackground(topology);
    }
    
    // 2. Shift history and push new values
    this.pushMetric('latency', this.baselines.latency + (Math.random() - 0.5) * 2);
    this.pushMetric('loss', Math.max(0, this.baselines.loss + (Math.random() - 0.5) * 0.1));
    this.pushMetric('bgpStress', Math.max(0, this.baselines.bgpStress + Math.floor(Math.random() * 3 - 1)));
    this.pushMetric('tunnelHealth', Math.max(0, Math.min(100, this.baselines.tunnelHealth + (Math.random() - 0.5) * 1)));
    this.pushMetric('utilization', Math.max(0, Math.min(100, this.baselines.utilization + (Math.random() - 0.5) * 4)));
  }
  
  pushMetric(key, val) {
    this.metrics[key].shift();
    // Round to 1 decimal place
    this.metrics[key].push(Math.round(val * 10) / 10);
  }
  
  simulateNormalBackground(topology) {
    // Reset nodes & links to healthy
    for (const key in topology.nodes) {
      const node = topology.nodes[key];
      node.status = 'healthy';
      node.cpu = Math.round(10 + Math.random() * 5);
      node.mem = Math.round(30 + Math.random() * 5);
      if (node.bgpState) node.bgpState = 'Established';
    }
    
    topology.links.forEach(link => {
      link.status = 'healthy';
      if (link.type === 'mpls') {
        link.utilization = Math.round(35 + Math.random() * 10);
        link.latency = Math.round(15 + Math.random() * 5);
      } else if (link.type === 'ipsec') {
        link.utilization = Math.round(8 + Math.random() * 4);
        link.latency = Math.round(42 + Math.random() * 5);
      }
    });
  }
  
  simulateCongestion(topology) {
    // Stage 1: Gradual ramp up of utilization on Branch-1 primary link
    const step = this.scenarioProgress;
    
    const branchLink = topology.links.find(l => l.id === 'link-br1-p1');
    const branch = topology.nodes['BR-1-CE-1'];
    
    if (step < 25) {
      // Escalation Phase
      branchLink.utilization = Math.round(50 + (step * 1.8));
      this.baselines.utilization = branchLink.utilization;
      
      branchLink.latency = Math.round(25 + (step * 2.5));
      this.baselines.latency = branchLink.latency;
      
      branch.cpu = Math.round(15 + (step * 2.2));
      
      if (branchLink.utilization > 75) {
        branchLink.status = 'warning';
        branch.status = 'warning';
        
        // Calculate dynamic Time-to-impact (SLA breach at 90% utilization)
        const ticksLeft = Math.max(0, (90 - branchLink.utilization) / 1.8);
        this.timeToImpact = Math.round(ticksLeft * 12); // 12 seconds per tick
      }
    } else {
      // Saturation Phase (SLA Breach)
      branchLink.utilization = Math.round(92 + (Math.random() - 0.5) * 2);
      this.baselines.utilization = branchLink.utilization;
      
      branchLink.latency = Math.round(88 + (Math.random() - 0.5) * 5);
      this.baselines.latency = branchLink.latency;
      
      branchLink.status = 'error';
      branch.status = 'warning';
      branch.cpu = Math.round(75 + Math.random() * 5);
      
      this.timeToImpact = 0; // Breach occurred
    }
  }
  
  simulateBgpFlap(topology) {
    const step = this.scenarioProgress;
    const p1 = topology.nodes['P-1'];
    const br1 = topology.nodes['BR-1-CE-1'];
    const link = topology.links.find(l => l.id === 'link-br1-p1');
    const backupTunnel = topology.links.find(l => l.id === 'tunnel-br1-dc1');
    
    // Flapping occurs between ticks 5 and 20
    if (step > 4 && step < 22) {
      p1.status = 'warning';
      br1.status = 'warning';
      
      // Simulate Flaps (alternating states)
      const isUp = Math.floor(step / 3) % 2 === 0;
      
      if (isUp) {
        br1.bgpState = 'Active';
        link.status = 'warning';
        this.baselines.bgpStress = 50 + Math.floor(Math.random() * 20);
      } else {
        br1.bgpState = 'Idle';
        link.status = 'down';
        this.baselines.bgpStress = 85 + Math.floor(Math.random() * 15);
      }
      
      // Secondary tunnel handles some overflow
      backupTunnel.utilization = Math.round(20 + step * 1.5);
      
      const ticksLeft = Math.max(0, 22 - step);
      this.timeToImpact = Math.round(ticksLeft * 12);
    } else if (step >= 22) {
      // Route flap dampening kicks in / complete failure of primary link
      br1.bgpState = 'Idle';
      link.status = 'down';
      p1.status = 'healthy';
      br1.status = 'warning';
      
      // All traffic failed-over to IPSec backup tunnel (SD-WAN automatic traffic steering)
      backupTunnel.status = 'healthy';
      backupTunnel.utilization = 75; // high load on backup tunnel
      backupTunnel.latency = 65;
      
      this.baselines.bgpStress = 10; // stabilized but failed
      this.baselines.latency = 65; // increased due to VPN overhead
      this.timeToImpact = 0;
    }
  }
  
  simulateMplsFailure(topology) {
    const step = this.scenarioProgress;
    const coreLink = topology.links.find(l => l.id === 'link-p1-dc1');
    const p1 = topology.nodes['P-1'];
    
    if (step < 20) {
      // Intermittent packet drop rates ramp up
      this.baselines.loss = step * 0.45;
      coreLink.status = 'warning';
      p1.status = 'warning';
      
      // Tunnel health degrades
      this.baselines.tunnelHealth = 99 - (step * 2.8);
      
      // SLA Warning trigger
      if (this.baselines.loss > 3.0) {
        coreLink.status = 'degraded';
      }
      
      const ticksLeft = Math.max(0, 15 - step);
      this.timeToImpact = Math.max(0, Math.round(ticksLeft * 12));
    } else {
      // Critical degradation
      this.baselines.loss = 9.2 + Math.random();
      coreLink.status = 'error';
      p1.status = 'degraded';
      this.baselines.tunnelHealth = 35 + (Math.random() - 0.5) * 5;
      this.timeToImpact = 0;
    }
  }
  
  simulatePolicyDrift(topology) {
    const step = this.scenarioProgress;
    
    // Slow degradation of controller metrics
    if (step < 30) {
      this.baselines.tunnelHealth = 99 - (step * 1.2); // Representing compliance score
      
      if (this.baselines.tunnelHealth < 80) {
        // Drifting parameters
        const dc = topology.nodes['DC-PE-1'];
        dc.status = 'warning';
        dc.bgpState = 'Configuration Drift';
      }
      
      const ticksLeft = Math.max(0, 25 - step);
      this.timeToImpact = Math.round(ticksLeft * 12);
    } else {
      this.baselines.tunnelHealth = 62;
      const dc = topology.nodes['DC-PE-1'];
      dc.status = 'warning';
      dc.bgpState = 'Drift: Out of Sync';
      this.timeToImpact = 0;
    }
  }
  
  // Renders a high-fidelity SVG path string for a metric history
  getSvgPath(key, width, height, maxVal) {
    const data = this.metrics[key];
    if (!data || data.length === 0) return '';
    
    const points = data.map((val, index) => {
      const x = (index / (this.historyLength - 1)) * width;
      // Invert Y axis for screen space
      const y = height - (val / maxVal) * height * 0.8 - height * 0.1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    
    return 'M ' + points.join(' L ');
  }
  
  // Generates predictive forecasting overlay paths
  getForecastPath(key, width, height, maxVal) {
    if (!this.activeScenario || this.timeToImpact === 0) return '';
    
    const data = this.metrics[key];
    const lastVal = data[data.length - 1];
    const startIndex = data.length - 1;
    
    // Starting coordinates
    const startX = (startIndex / (this.historyLength - 1)) * width;
    const startY = height - (lastVal / maxVal) * height * 0.8 - height * 0.1;
    
    // Forecast trend projection
    let futureVal = lastVal;
    
    if (this.activeScenario === 'congestion' && key === 'utilization') {
      futureVal = Math.min(100, lastVal + 18);
    } else if (this.activeScenario === 'congestion' && key === 'latency') {
      futureVal = Math.min(150, lastVal + 25);
    } else if (this.activeScenario === 'mpls_failure' && key === 'loss') {
      futureVal = Math.min(20, lastVal + 4.5);
    } else if (this.activeScenario === 'mpls_failure' && key === 'tunnelHealth') {
      futureVal = Math.max(10, lastVal - 28);
    } else if (this.activeScenario === 'bgp_flap' && key === 'bgpStress') {
      futureVal = Math.min(100, lastVal + 35);
    } else {
      return '';
    }
    
    const endX = width;
    const endY = height - (futureVal / maxVal) * height * 0.8 - height * 0.1;
    
    return `M ${startX.toFixed(1)},${startY.toFixed(1)} L ${endX.toFixed(1)},${endY.toFixed(1)}`;
  }
}

// Bind to window
window.TelemetryEngine = TelemetryEngine;
