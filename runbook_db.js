// Local RAG Knowledge Base - Mock Vector Database
// Contains network configurations, operating procedures, and historical tickets.

const RUNBOOKS = [
  {
    id: "runbook-bgp-flap",
    title: "SOP-NOC-402: BGP Routing Instability and Flapping Mitigation",
    category: "Routing & Protocols",
    lastUpdated: "2026-03-12",
    tags: ["bgp", "routing", "convergence", "ospf"],
    content: `Objective: Standard Operating Procedure for responding to BGP Route Flapping and downstream path convergence stress.
1. Identification:
   - Identify affected peers via Syslog entries containing "%BGP-5-ADJCHANGE" or BGP state changes from ESTABLISHED to ACTIVE/IDLE.
   - Monitor route convergence stress: look for a surge in route updates (advertisements/withdrawals) exceeding 50 updates/min.
2. Immediate Remediation:
   - Check if dampening is enabled on the edge routers. If not, apply dampening config to prevent route propagation.
   - If convergence stress threatens Hub performance, isolate the flapping branch by shutting down the primary sub-interface and forcing OSPF/BGP traffic through the secondary IPSec Tunnel.
3. Command Sequence (Local CE Router):
   - 'router bgp <asn>' -> 'bgp dampening'
   - 'interface GigabitEthernet0/1' -> 'shutdown' (to force clean failover if flap is persistent).`
  },
  {
    id: "runbook-tunnel-degrade",
    title: "SOP-NOC-210: SD-WAN IPSec Tunnel Health Degradation",
    category: "SD-WAN & VPN",
    lastUpdated: "2026-05-18",
    tags: ["sd-wan", "ipsec", "jitter", "packet-loss"],
    content: `Objective: Diagnostics and repair steps for IPSec Tunnel degradation running over MPLS underlays.
1. Indicators:
   - SLA Probe violations: Latency > 150ms, Jitter > 30ms, or Packet Loss > 2% over a 5-minute rolling window.
   - Rekey anomalies: Failed IKE Phase 2 renegotiations in syslog.
2. Automated Workflow:
   - The SD-WAN controller monitors real-time SLA metrics. If underlay MPLS quality falls below Class-of-Service constraints, the controller initiates dynamic steering.
   - Non-critical traffic (Web, Guest, Backups) should be routed to secondary Internet broadband tunnels if available.
   - Critical traffic (Voice, Payment Processing) must be prioritized using QoS marking (DSCP EF / CS5).
3. Verification:
   - Check 'show sdwan tunnel slab' to trace telemetry trends.`
  },
  {
    id: "runbook-link-congestion",
    title: "SOP-NOC-105: Hub-Spoke Interface Congestion and Traffic Shaping",
    category: "Traffic Engineering",
    lastUpdated: "2026-01-20",
    tags: ["qos", "congestion", "shaping", "interface"],
    content: `Objective: Actions for preemptive congestion management on bottleneck hub-spoke links.
1. Precursors:
   - Interface utilization exceeding 85% for more than 3 consecutive polling intervals.
   - Queue depth increasing on high-priority queues.
2. Remediation Strategy:
   - Apply strict egress traffic shaping to limit bulk data downloads.
   - Trigger dynamic traffic draining. Re-route low-priority backup sync tasks to off-peak hours (22:00 - 06:00).
   - Configure Policy-Based Routing (PBR) on the Branch CE to route bulk TCP flows over secondary lower-cost transport.`
  },
  {
    id: "runbook-controller-drift",
    title: "SOP-NOC-501: SD-WAN Controller Policy Drift and Misconfiguration",
    category: "Configuration Compliance",
    lastUpdated: "2026-04-05",
    tags: ["controller", "policy", "drift", "compliance"],
    content: `Objective: Resolving differences between local device running-configs and central SD-WAN policy templates.
1. Root Cause:
   - Policy drift usually occurs due to direct out-of-band manual configuration adjustments on Branch CE routers or local PE switches bypassing the central controller.
2. Corrective Actions:
   - Run a config comparison: 'show sdwan policy-comparison local-vs-controller'.
   - Trigger a policy synchronization from the central controller dashboard (Force Sync).
   - Commit changes via central dashboard to prevent local configuration overrides during the next scheduled polling window.`
  },
  {
    id: "metadata-topology",
    title: "REF-NOC-001: Enterprise Multi-Site Topology Schema",
    category: "Topology Map",
    lastUpdated: "2026-06-01",
    tags: ["topology", "device-roles", "interfaces"],
    content: `MPLS Core Network Mapping:
- Datacenter Hub: DC-HUB-PE-1 & DC-HUB-PE-2. Hosts high-performance edge routers (PE) connected to the core MPLS.
- Branch-1 (Large Branch): BR-1-CE-1. Connected via primary MPLS link and backup IPSec tunnel over Internet.
- Branch-2 (Remote Office): BR-2-CE-2. Connected via dual IPSec tunnels over MPLS and Broadband.
- MPLS Core: P-1 & P-2. Core forwarding routers handling label switching (LDP/RSVP-TE).
- Controllers: SD-WAN-CTRL-1 (Primary) and SD-WAN-CTRL-2 (Secondary). Located in DC network space.`
  }
];

function searchRAG(query) {
  if (!query) return [];
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (terms.length === 0) return [];
  
  return RUNBOOKS.map(doc => {
    let score = 0;
    terms.forEach(term => {
      if (doc.title.toLowerCase().includes(term)) score += 3;
      if (doc.content.toLowerCase().includes(term)) score += 1;
      doc.tags.forEach(tag => {
        if (tag.toLowerCase().includes(term)) score += 2;
      });
    });
    return { doc, score };
  })
  .filter(item => item.score > 0)
  .sort((a, b) => b.score - a.score)
  .map(item => item.doc);
}

// Export for browser context
window.RUNBOOKS = RUNBOOKS;
window.searchRAG = searchRAG;
