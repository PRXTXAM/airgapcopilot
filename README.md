# Air-Gapped Predictive Copilot for Secure MPLS Operations (Nexus AI)

An autonomous, entirely offline AI NOC Copilot that predicts network anomalies, analyzes root-causes in natural language, and suggests remediation playbooks before SLA impacts occur. Designed to operate completely within air-gapped government and enterprise environments with zero external network dependencies.

---

## 🚀 Getting Started

Since the dashboard is built with vanilla HTML5, CSS3, and JavaScript, it runs instantly in any modern browser without needing to install Node, npm, or compile bundles.

### 1. Clone the Repository
```bash
git clone https://github.com/PRXTXAM/airgapcopilot.git
cd airgapcopilot
```

### 2. Start the Local Web Server
Serve the files locally using Python's built-in HTTP server:
```bash
python3 -m http.server 8085
```

### 3. Open the Dashboard
Navigate to: **[http://localhost:8085/](http://localhost:8085/)**

---

## 🎨 Interactive NOC Capabilities

The dashboard is designed to provide an interactive, hands-on demonstration of secure network operations:

1. **Draggable Topology Nodes**: Click and drag any router node on the canvas layout to customize or stretch the topology. The links and packet particles will dynamically stretch and follow.
2. **Device Diagnostics Console**: Click on any CE, PE, or Core P router node. The AI Copilot terminal automatically runs an SSH remote query, logging live CLI diagnostics (`show interface stats`, `show mpls ldp bindings`, or `show ip bgp summary`) in the chat box.
3. **Administrative Link Cuts**: Click on any link segment (e.g. the cyan MPLS circuit `link-br1-p1`). The link will turn red (Down), log a syslog state change, and **automatically steer packet traffic** over the curved purple IPsec backup tunnel in real-time. Click it again to heal the link.
4. **Interactive Playbooks**: Step through automated remediation command checklists to resolve alerts, pushing configuration logs to the console and stabilizing metrics back to normal.
5. **RAG Vector Explorer**: Inspect the documents matching keyword searches. The right-hand panel highlights what runbooks are currently retrieved from the offline index.

---

## 🧠 Simulation Scenarios

Use the **Fault Injection Scenarios** panel to test how the predictive models and offline AI Copilot react:

*   **1. Hub-Spoke Congestion**: Ramps interface utilization on `BR-1-CE-1` Gi0/1. The chart projects a red forecasting line showing when the SLA bounds will breach.
*   **2. BGP Route Flapping**: Triggers adjacency state transitions on `P-1` and `BR-1-CE-1`. Telemetry shows a surge in convergence update stress, failover paths, and BGP idle loops.
*   **3. Underlay MPLS Decay**: Simulates packet drop escalation (optical attenuation) on the core link, triggering dynamic steering policies on the SD-WAN controller.
*   **4. Controller Policy Drift**: Triggers a policy synchronization warning when out-of-band manual configuration changes lower the compliance index.

---

## 🛡️ Architecture & Security Compliance

*   **100% Offline Runtime**: Zero outbound API requests, zero CDNs, and zero third-party cloud analytics.
*   **Local RAG index**: Documents are parsed locally using keyword-based similarity matching to simulate Vector RAG grounding.
*   **Quantized LLM Prompts**: Mimics structured JSON outputs from on-premises quantized models (e.g., LLaMA-3 8B, Phi-3).
