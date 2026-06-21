// Offline LLM NOC Copilot Engine - copilot.js
// Simulates quantized on-premises LLM inference with retrieval-augmented generation (RAG).

class CopilotEngine {
  constructor(chatContainerId, playbookContainerId) {
    this.chatContainer = document.getElementById(chatContainerId);
    this.playbookContainer = document.getElementById(playbookContainerId);
    this.history = [];
    
    // Playbook tracking
    this.activePlaybook = null;
    this.currentStepIndex = 0;
    
    // Pre-canned RAG-based LLM responses for injected scenarios
    this.responses = {
      congestion: {
        issue: "Preemptive Link Congestion Buildup",
        confidence: 94,
        leadTime: "3 minutes 12 seconds",
        rootCause: "Surge in bulk TCP backup sync traffic crossing the primary MPLS circuit (interface Gi0/1 on BR-1-CE-1). Queue depths on default-class queues are expanding exponentially.",
        affected: "Branch-1 VoIP calls (SLA jitter bounds) and real-time database transactions.",
        runbookId: "runbook-link-congestion",
        playbook: [
          { label: "Configure egress traffic shaping on BR-1-CE-1 interface Gi0/1 (limit to 85% capacity)", cmd: "BR-1-CE-1# configure terminal\nBR-1-CE-1(config)# policy-map SHAPE-EDGE\nBR-1-CE-1(config-pmap)# class class-default\nBR-1-CE-1(config-pmap-c)# shape average 8500000" },
          { label: "Steer bulk backup TCP flows to secondary broadband tunnel (Tunnel10)", cmd: "SD-WAN-CTRL-1# config transaction\nSD-WAN-CTRL-1(config)# policy app-route-policy BULK-STEERING\nSD-WAN-CTRL-1(config-policy)# vpn 10 class default action backup path Tunnel10" },
          { label: "Verify queue size recovery and confirm SLA jitter stabilizes < 10ms", cmd: "BR-1-CE-1# show policy-map interface GigabitEthernet0/1" }
        ]
      },
      bgp_flap: {
        issue: "Downstream OSPF/BGP Route Flapping & Convergence Stress",
        confidence: 89,
        leadTime: "2 minutes 15 seconds",
        rootCause: "Intermittent link flap on MPLS circuit PE-CE path. High count of BGP updates (advertisements/withdrawals) is overloading the Core P-1 control plane.",
        affected: "Branch-1 primary routing path, downstream Hub routing tables.",
        runbookId: "runbook-bgp-flap",
        playbook: [
          { label: "Enable route dampening parameters on Core Router P-1", cmd: "P-1# configure terminal\nP-1(config)# router bgp 65001\nP-1(config-router)# bgp dampening 15 750 2000 60" },
          { label: "Shut down primary flapping interface Gi0/1 on BR-1-CE-1 to force clean failover", cmd: "BR-1-CE-1# configure terminal\nBR-1-CE-1(config)# interface GigabitEthernet0/1\nBR-1-CE-1(config-if)# shutdown" },
          { label: "Confirm BGP session reconvergence via IPSec Tunnel10 overlay", cmd: "BR-1-CE-1# show ip bgp summary" }
        ]
      },
      mpls_failure: {
        issue: "MPLS Underlay Failure (Interface Frame Corruption)",
        confidence: 91,
        leadTime: "1 minute 45 seconds",
        rootCause: "Physical layer degradation (fiber attenuation) on interface Gi0/2 connecting Core P-1 to DC-PE-1. CRC errors climbing by 420 errors/sec.",
        affected: "MPLS label forwarding plane (LFIB), global branch transit path.",
        runbookId: "runbook-tunnel-degrade",
        playbook: [
          { label: "Set SD-WAN dynamic steering policy to prioritize critical VoIP/Data DSCP (EF/CS5) over MPLS underlay", cmd: "SD-WAN-CTRL-1# config transaction\nSD-WAN-CTRL-1(config)# class VOICE queue 1\nSD-WAN-CTRL-1(config-class)# match dscp ef" },
          { label: "Divert standard TCP payloads to Broadband tunnels to mitigate packet drops", cmd: "SD-WAN-CTRL-1(config)# vpn 10 class default action primary path Tunnel10" },
          { label: "Initiate optical diagnostics report on DC-PE-1 interface GigabitEthernet0/2", cmd: "DC-PE-1# show controllers local-loopback transceiver details" }
        ]
      },
      policy_drift: {
        issue: "SD-WAN Central Controller Configuration Drift",
        confidence: 96,
        leadTime: "Instant (Policy Violation)",
        rootCause: "Direct manual running-configuration edit detected on PE router DC-PE-1 bypasses central controller template mapping (VLAN mismatch on sub-interface Gi0/4).",
        affected: "Centralized provisioning, SD-WAN policy synchronization compliance score.",
        runbookId: "runbook-controller-drift",
        playbook: [
          { label: "Generate config diff comparison: DC-PE-1 local running-config vs Controller Template", cmd: "SD-WAN-CTRL-1# show running-config diff local-vs-controller router DC-PE-1" },
          { label: "Execute override synchronization (Force Template Sync Push) to DC-PE-1", cmd: "SD-WAN-CTRL-1# controller templates commit-override device DC-PE-1 template-id PE-STANDARD-V3" },
          { label: "Verify configuration compliance health returns to 100%", cmd: "SD-WAN-CTRL-1# show policy compliance-check device DC-PE-1" }
        ]
      }
    };
  }
  
  clearChat() {
    this.chatContainer.innerHTML = '';
    this.history = [];
    this.clearPlaybook();
  }
  
  clearPlaybook() {
    this.playbookContainer.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.75rem; text-align: center; padding: 1rem 0;">No active incident playbook recommended.</div>';
    this.activePlaybook = null;
    this.currentStepIndex = 0;
  }
  
  addSystemMessage(text) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble assistant';
    bubble.innerHTML = `<div class="copilot-meta"><span>SYSTEM STATUS MESSAGE</span><span>${new Date().toLocaleTimeString()}</span></div><div style="font-family:'JetBrains Mono', monospace; font-size:0.75rem; color:var(--accent-cyan);">${text}</div>`;
    this.chatContainer.appendChild(bubble);
    this.scrollToBottom();
  }
  
  addUserMessage(text) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user';
    bubble.textContent = text;
    this.chatContainer.appendChild(bubble);
    this.scrollToBottom();
  }
  
  triggerAlert(scenarioName) {
    const alertData = this.responses[scenarioName];
    if (!alertData) return;
    
    // Play warning sound or visual flash
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble assistant alert';
    
    // Search vector database (RAG simulation)
    const runbook = window.RUNBOOKS.find(r => r.id === alertData.runbookId);
    let ragSnippetHtml = '';
    if (runbook) {
      ragSnippetHtml = `
        <div class="copilot-sec-title">RAG Context Retrieved</div>
        <div class="copilot-pills">
          <span class="copilot-pill-tag">${runbook.title}</span>
        </div>
      `;
      // Highlight document in RAG explorer
      const docCard = document.getElementById(runbook.id);
      if (docCard) {
        docCard.classList.add('highlighted');
        docCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
    
    bubble.innerHTML = `
      <div class="chat-alert-header">
        <span class="logo-glow" style="background-color: var(--error); box-shadow: 0 0 8px var(--error);"></span>
        <span>PREDICTIVE INCIDENT DETECTED [CONFIDENCE: ${alertData.confidence}%]</span>
      </div>
      <div class="copilot-meta">
        <span>MODEL: Phi-3 3.8B (Quantized)</span>
        <span>EST. IMPACT: ${alertData.leadTime}</span>
      </div>
      <div class="structured-copilot">
        <div class="copilot-sec-title">Predicted Issue</div>
        <div class="copilot-sec-body" style="color: #fff; font-weight: 600;">${alertData.issue}</div>
        
        <div class="copilot-sec-title">Probable Root Cause</div>
        <div class="copilot-sec-body">${alertData.rootCause}</div>
        
        <div class="copilot-sec-title">Affected Scope</div>
        <div class="copilot-sec-body">${alertData.affected}</div>
        
        ${ragSnippetHtml}
        
        <div style="margin-top: 0.5rem; font-size: 0.7rem; color: var(--accent-purple); font-weight: 600; font-family:'JetBrains Mono', monospace;">
          Recommended playbook available. Click "Initialize Remediation Playbook" in the sidebar.
        </div>
      </div>
    `;
    
    this.chatContainer.appendChild(bubble);
    this.scrollToBottom();
    
    // Load Playbook checklist
    this.loadPlaybook(scenarioName);
  }
  
  loadPlaybook(scenarioName) {
    const playbookData = this.responses[scenarioName];
    if (!playbookData) return;
    
    this.activePlaybook = playbookData;
    this.currentStepIndex = 0;
    
    let stepsHtml = '';
    playbookData.playbook.forEach((step, idx) => {
      stepsHtml += `
        <div class="playbook-step ${idx === 0 ? 'active' : ''}" id="pb-step-${idx}">
          <span class="step-indicator">${idx + 1}</span>
          <span>${step.label}</span>
        </div>
      `;
    });
    
    this.playbookContainer.innerHTML = `
      <div class="playbook-header">
        <span>PLAYBOOK: ${playbookData.issue}</span>
        <span style="color: var(--accent-cyan)">STEP 1 / ${playbookData.playbook.length}</span>
      </div>
      <div class="playbook-steps">
        ${stepsHtml}
      </div>
      <button class="btn-playbook-run" id="btn-run-step" onclick="window.copilot.runNextPlaybookStep()">
        Execute Step 1
      </button>
    `;
  }
  
  runNextPlaybookStep() {
    if (!this.activePlaybook || this.currentStepIndex >= this.activePlaybook.playbook.length) return;
    
    const idx = this.currentStepIndex;
    const step = this.activePlaybook.playbook[idx];
    
    // Change step status to active console push
    const btn = document.getElementById('btn-run-step');
    btn.disabled = true;
    btn.textContent = `Pushed config command...`;
    
    // Render console log push in chat to show what configuration is applied
    const consoleMsg = document.createElement('div');
    consoleMsg.className = 'chat-bubble assistant';
    consoleMsg.innerHTML = `
      <div class="copilot-meta"><span>SSH CONFIG PUSH - SECURE OUT-OF-BAND</span><span>${new Date().toLocaleTimeString()}</span></div>
      <pre style="font-family:'JetBrains Mono', monospace; font-size:0.7rem; background:rgba(0,0,0,0.4); padding:0.5rem; border-radius:4px; border:1px solid rgba(255,255,255,0.05); color:#a7f3d0; white-space:pre-wrap;">${step.cmd}</pre>
    `;
    this.chatContainer.appendChild(consoleMsg);
    this.scrollToBottom();
    
    setTimeout(() => {
      // Mark step completed
      const stepEl = document.getElementById(`pb-step-${idx}`);
      if (stepEl) {
        stepEl.classList.remove('active');
        stepEl.classList.add('completed');
      }
      
      this.currentStepIndex++;
      
      if (this.currentStepIndex < this.activePlaybook.playbook.length) {
        // Next step
        const nextIdx = this.currentStepIndex;
        const nextStepEl = document.getElementById(`pb-step-${nextIdx}`);
        if (nextStepEl) {
          nextStepEl.classList.add('active');
        }
        
        const headerEl = this.playbookContainer.querySelector('.playbook-header span:last-child');
        headerEl.textContent = `STEP ${nextIdx + 1} / ${this.activePlaybook.playbook.length}`;
        
        btn.disabled = false;
        btn.textContent = `Execute Step ${nextIdx + 1}`;
      } else {
        // Playbook finished! Trigger recovery
        btn.textContent = "Remediation Complete";
        btn.style.borderColor = "var(--success)";
        btn.style.color = "var(--success)";
        btn.style.background = "rgba(16, 185, 129, 0.08)";
        
        this.addSystemMessage("Playbook execution completed successfully. Applying convergence sweep and monitoring metrics path...");
        
        // Trigger recovery loop in main app
        if (window.app) {
          window.app.triggerRecovery();
        }
      }
    }, 1500);
  }
  
  respondToQuery(query) {
    this.addUserMessage(query);
    
    // Typing indicator
    const typingBubble = document.createElement('div');
    typingBubble.className = 'chat-bubble assistant';
    typingBubble.innerHTML = `
      <div class="typing-indicator">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;
    this.chatContainer.appendChild(typingBubble);
    this.scrollToBottom();
    
    setTimeout(() => {
      // Remove typing bubble
      this.chatContainer.removeChild(typingBubble);
      
      // Look up inside local RAG vector db
      const searchResults = window.searchRAG(query);
      
      let answer = '';
      let docBadgeHtml = '';
      
      if (searchResults.length > 0) {
        const topDoc = searchResults[0];
        docBadgeHtml = `
          <div class="copilot-sec-title">RAG Context Retrieved</div>
          <div class="copilot-pills">
            <span class="copilot-pill-tag">${topDoc.title}</span>
          </div>
        `;
        
        // Formulate answer based on RAG context
        if (query.toLowerCase().includes('bgp') || query.toLowerCase().includes('flap') || query.toLowerCase().includes('routing')) {
          answer = `Based on local context in **${topDoc.title}**, route flapping causes significant control-plane CPU stress. Check for syslog events like \`%BGP-5-ADJCHANGE\` to identify unstable interfaces. Remediation involves enabling route dampening (e.g. \`bgp dampening\`) or shutting down the failing circuit to force overlay failover.`;
        } else if (query.toLowerCase().includes('tunnel') || query.toLowerCase().includes('loss') || query.toLowerCase().includes('ipsec')) {
          answer = `According to **${topDoc.title}**, SD-WAN monitoring will trigger dynamic steering if loss exceeds 2% or jitter exceeds 30ms. Critical traffic like voice is prioritized via DSCP QoS configurations, while bulk flows are routed to secondary tunnel connections.`;
        } else if (query.toLowerCase().includes('congestion') || query.toLowerCase().includes('bandwidth') || query.toLowerCase().includes('utilization')) {
          answer = `Referring to **${topDoc.title}**, preemptive congestion actions include traffic shaping policies (limiting default class sizes to ~85% link capacity) or diverting bulk data streams to secondary Broadband underlays during peak hours.`;
        } else if (query.toLowerCase().includes('drift') || query.toLowerCase().includes('policy') || query.toLowerCase().includes('compliance')) {
          answer = `As detailed in **${topDoc.title}**, configuration drift is caused by out-of-band config changes. We run \`show running-config diff local-vs-controller\` to find disparities and force template synchronization.`;
        } else {
          answer = `RAG search returned document **${topDoc.title}**. The runbook outlines diagnostics procedures including parameter verification, CLI status checks, and playbook execution for stabilizing the network interface state.`;
        }
      } else {
        // Generic offline AI assistant answers
        answer = "I've searched the local air-gapped vector store, but found no matches. As an offline NOC Assistant, I can help troubleshoot MPLS underlays, BGP convergence flaps, IPsec tunnel health drift, or policy synchronization queries. Please refine your query keywords.";
      }
      
      const responseBubble = document.createElement('div');
      responseBubble.className = 'chat-bubble assistant';
      responseBubble.innerHTML = `
        <div class="copilot-meta"><span>LOCAL COPILOT INFERENCE</span><span>${new Date().toLocaleTimeString()}</span></div>
        <div class="structured-copilot">
          <div class="copilot-sec-body">${answer}</div>
          ${docBadgeHtml}
        </div>
      `;
      
      this.chatContainer.appendChild(responseBubble);
      this.scrollToBottom();
      
      // Clear highlighted RAG elements and highlight the matched one
      document.querySelectorAll('.rag-doc-card').forEach(el => el.classList.remove('highlighted'));
      if (searchResults.length > 0) {
        const topEl = document.getElementById(searchResults[0].id);
        if (topEl) {
          topEl.classList.add('highlighted');
          topEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
      
    }, 1200);
  }
  
  scrollToBottom() {
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }
}

// Bind to window
window.CopilotEngine = CopilotEngine;
