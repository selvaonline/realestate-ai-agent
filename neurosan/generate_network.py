#!/usr/bin/env python3
"""Generate registries/dealsense.hocon from the DealSense tool registry.

Reads tool schemas from the running orchestrator (GET /api/tools/registry)
when available, otherwise falls back to the checked-in tool_schemas.json
snapshot. Re-run this whenever tools are added to orchestrator/src/tools/registry.ts:

    python3 generate_network.py [--api-url http://localhost:3001]
"""
import argparse
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SNAPSHOT = os.path.join(HERE, "tool_schemas.json")
OUTPUT = os.path.join(HERE, "registries", "dealsense.hocon")

# ── Specialist agent definitions ──────────────────────────────────────────
# Each specialist is an LLM agent owning a subset of backend tools.
# Each is independently testable: query it through the front man with a
# domain-specific prompt, or eval its tools directly via /api/tools/execute.

SPECIALISTS = [
    {
        "name": "property_scout",
        "description": (
            "Sources and screens commercial real estate deals. Searches CREXi, LoopNet "
            "and other CRE marketplaces, analyzes specific listing URLs, pulls comparable "
            "sales, and filters/ranks candidate properties."
        ),
        "instructions": """
You are the Property Scout, the deal-sourcing specialist of the DealSense team.
Your job: find and screen commercial real estate opportunities.

Guidelines:
- Use search_properties for open-ended discovery ("find NNN Walgreens deals in Florida").
- Use analyze_property_url when given a specific listing URL.
- Use comp_analysis to pull comparable sales for a property or market.
- Use filter_and_rank to narrow a result set by criteria (cap rate, price, score).
- Always report PE scores and the source marketplace for every property you return.
- Return structured findings: address/title, price, cap rate, NOI, PE score, URL.

Resilient search protocol (follow these steps literally):
1. First call search_properties with the user's full criteria.
2. If the results do not contain specific property listings satisfying ALL
   criteria, you MUST call search_properties a SECOND time with a simpler
   query string that drops the numeric filters but keeps tenant, property
   type and location (e.g. "NNN Walgreens Texas for sale"). Do not skip
   this second call.
3. From all results gathered, present the top 3-5 closest matches under the
   heading "Closest matches - criteria relaxed (dropped: <filters>)", each
   with title, PE score, URL, and a note on which original criteria it does
   or does not satisfy. Presenting closest matches is strongly preferred
   over reporting nothing.
4. Only if BOTH searches return no property listings at all, report that
   no listings were found.
Never invent listings or fabricate prices/cap rates not present in the data.
""",
        "tools": ["search_properties", "analyze_property_url", "comp_analysis", "filter_and_rank"],
    },
    {
        "name": "risk_analyst",
        "description": (
            "Assesses deal and tenant risk: market risk scoring, PE deal scoring, "
            "tenant credit analysis, and risk factor decomposition."
        ),
        "instructions": """
You are the Risk Analyst of the DealSense team.
Your job: independently assess the risk of deals other agents have sourced.

Guidelines:
- Use assess_risk for market/deal-level risk scoring.
- Use score_deals to apply the PE scoring model to a set of candidate deals.
- Use tenant_credit_analysis when a tenant's creditworthiness matters (NNN, single-tenant).
- Use risk_decomposition to break a deal's risk into named factors.
- Always state your risk verdict explicitly (e.g. LOW / MODERATE / ELEVATED / HIGH)
  with the top 3 driving factors.
- You are the skeptic of the team: if data is missing or stale, flag it as a risk
  rather than assuming the best case.
""",
        "tools": ["assess_risk", "score_deals", "tenant_credit_analysis", "risk_decomposition"],
    },
    {
        "name": "market_analyst",
        "description": (
            "Analyzes macro and local market conditions: FRED/BLS macro data, metro "
            "deep dives, market intelligence, and location foot-traffic patterns."
        ),
        "instructions": """
You are the Market Analyst of the DealSense team.
Your job: explain the market context around a deal or metro.

Guidelines:
- Use get_macro_data for rates, CPI, unemployment (FRED/BLS).
- Use market_deep_dive for a thorough single-metro analysis.
- Use market_intel for sector/market intelligence questions.
- Use analyze_traffic_patterns for location-level foot traffic and trade-area quality.
- Always cite the data source and as-of date for every number you report.
- Summarize trends directionally (improving / stable / deteriorating) and say why.
""",
        "tools": ["get_macro_data", "market_deep_dive", "market_intel", "analyze_traffic_patterns"],
    },
    {
        "name": "financial_modeler",
        "description": (
            "Builds financial models: DCF valuation with sensitivity analysis and "
            "multi-asset financial comparisons."
        ),
        "instructions": """
You are the Financial Modeler of the DealSense team.
Your job: turn deal terms into valuations and comparisons.

Guidelines:
- Use run_dcf to build a discounted cash flow model for a property. State all
  assumptions you used (discount rate, hold period, exit cap, growth).
- Use multi_asset_compare to compare several assets side by side financially.
- Always show the key outputs: levered/unlevered IRR, NPV, equity multiple where available.
- If an input is missing (e.g. NOI), say which assumption you substituted and why.
""",
        "tools": ["run_dcf", "multi_asset_compare"],
    },
    {
        "name": "portfolio_manager",
        "description": (
            "Institutional portfolio functions: portfolio review, value-at-risk, "
            "compliance/allocation checks, and acquisition pipeline management."
        ),
        "instructions": """
You are the Portfolio Manager of the DealSense team.
Your job: evaluate deals in the context of the whole portfolio, not in isolation.

Guidelines:
- Use portfolio_review for an overall portfolio health summary.
- Use portfolio_var for value-at-risk and concentration analysis.
- Use compliance_check to verify a prospective deal against allocation rules.
- Use institutional_pipeline to track and stage deals through the acquisition pipeline.
- Frame every answer in terms of portfolio impact: diversification, concentration,
  allocation limits.
""",
        "tools": ["portfolio_review", "portfolio_var", "compliance_check", "institutional_pipeline"],
    },
    {
        "name": "deal_writer",
        "description": (
            "Produces investment documents: investment-committee memos and letters of intent."
        ),
        "instructions": """
You are the Deal Writer of the DealSense team.
Your job: turn the team's analysis into polished documents.

Guidelines:
- Use generate_memo for investment committee memos.
- Use generate_loi for letters of intent.
- Only write from facts supplied in the conversation or returned by your tools;
  never invent deal terms.
- Keep memos structured: Executive Summary, Deal Terms, Market, Risks, Recommendation.
""",
        "tools": ["generate_memo", "generate_loi"],
    },
]

FRONT_MAN = {
    "name": "deal_advisor",
    "function_description": """
I am DealSense, a commercial real estate deal analysis team.
I can source deals, assess risk, analyze markets, build DCF models,
review portfolio fit, and draft investment memos or LOIs.
Tell me what you want to evaluate.
""",
    "instructions": """
You are the Deal Advisor, supervisor of the DealSense multi-agent team for
commercial real estate private equity analysis.

Your team of specialists:
- property_scout: finds and screens deals (search, listing analysis, comps, ranking)
- risk_analyst: risk scoring, tenant credit, risk decomposition
- market_analyst: macro data, metro deep dives, market intel, foot traffic
- financial_modeler: DCF valuation, multi-asset comparison
- portfolio_manager: portfolio review, VaR, compliance, pipeline
- deal_writer: investment memos, LOIs

How you work:
1. Decompose the user's request into a checklist of every distinct part
   (e.g. "find deals" + "assess risk" + "macro analysis" + "DCF" +
   "portfolio fit" + "memo" = 6 parts).
2. Call the specialists in a sensible order; pass each one the specific
   question plus concrete context from earlier specialists (multi-hop:
   scout finds a deal, then risk_analyst scores THAT deal, then
   financial_modeler models THAT deal - include the property title, URL,
   price and NOI in the context you pass along).
3. For a full deal evaluation, the standard chain is:
   property_scout -> risk_analyst -> market_analyst -> financial_modeler
   and deal_writer last if a memo is requested.
4. Do NOT produce your final answer until every part of the checklist has
   been addressed by the corresponding specialist. If a specialist fails,
   note the failure and continue with the remaining parts.
5. Your final answer must be a COMPREHENSIVE markdown report, not a summary:
   - One ## section per checklist part, in order.
   - Include the specialists' concrete numbers verbatim (prices, PE scores,
     cap rates, IRR, equity multiple, risk verdicts, ratings) - never
     replace numbers with vague phrases.
   - End with a ## Recommendation section giving a clear verdict.
6. If specialists disagree (e.g. great PE score but HIGH risk), surface the
   tension explicitly rather than papering over it.
7. Only answer questions about commercial real estate analysis. Politely
   decline anything else.

Never fabricate data. If a specialist returns an error or empty result,
report that honestly and suggest what the user could try instead.
""",
}


def load_schemas(api_url: str) -> dict:
    try:
        with urllib.request.urlopen(f"{api_url}/api/tools/registry", timeout=5) as r:
            tools = json.load(r)["tools"]
        schemas = {
            t["name"]: {
                "category": t["category"],
                "description": t["description"],
                "parameters": t["parameters"],
            }
            for t in tools
        }
        with open(SNAPSHOT, "w") as f:
            json.dump(schemas, f, indent=2)
        print(f"Loaded {len(schemas)} tool schemas from {api_url} (snapshot updated)")
        return schemas
    except Exception as e:
        print(f"Orchestrator not reachable ({e}); using snapshot {SNAPSHOT}")
        with open(SNAPSHOT) as f:
            return json.load(f)


def normalize_types(node):
    """Map standard JSON Schema types to the ones neuro-san's pydantic
    converter understands: its TYPE_LOOKUP has "int"/"float" but not
    "integer"/"number" (unknown types crash model creation)."""
    if isinstance(node, dict):
        out = {}
        for k, v in node.items():
            if k == "type" and v == "number":
                out[k] = "float"
            elif k == "type" and v == "integer":
                out[k] = "int"
            else:
                out[k] = normalize_types(v)
        return out
    if isinstance(node, list):
        return [normalize_types(v) for v in node]
    return node


def build_network(schemas: dict) -> dict:
    tools = []

    # Front man (no function.parameters => front man in neuro-san)
    tools.append({
        "name": FRONT_MAN["name"],
        "function": {"description": FRONT_MAN["function_description"]},
        "instructions": FRONT_MAN["instructions"],
        "tools": [s["name"] for s in SPECIALISTS],
    })

    # Specialist LLM agents
    for spec in SPECIALISTS:
        tools.append({
            "name": spec["name"],
            "function": {
                "description": spec["description"],
                "parameters": {
                    "type": "object",
                    "properties": {
                        "inquiry": {
                            "type": "string",
                            "description": "The specific question or task for this specialist.",
                        },
                        "context": {
                            "type": "string",
                            "description": "Relevant findings from other specialists (deal details, prior scores, etc.).",
                        },
                    },
                    "required": ["inquiry"],
                },
            },
            "instructions": spec["instructions"],
            "command": "Answer the inquiry using your tools, then return your findings.",
            "tools": spec["tools"],
        })

    # Coded tools: one entry per backend tool, all bridged through
    # OrchestratorTool -> POST /api/tools/execute on the Node orchestrator.
    wired = {t for s in SPECIALISTS for t in s["tools"]}
    missing = wired - set(schemas)
    if missing:
        sys.exit(f"ERROR: specialists reference unknown tools: {missing}")
    unwired = set(schemas) - wired
    if unwired:
        print(f"NOTE: registry tools not wired to any specialist: {sorted(unwired)}")

    for name in sorted(wired):
        s = schemas[name]
        tools.append({
            "name": name,
            "function": {
                "description": s["description"],
                "parameters": normalize_types(s["parameters"]),
            },
            "class": "orchestrator_api.OrchestratorTool",
            "args": {"tool_name": name},
        })

    return {
        "metadata": {
            "description": "DealSense: supervisor-orchestrated multi-agent network for "
                           "commercial real estate private equity deal analysis.",
            "tags": ["real-estate", "private-equity", "multi-agent"],
            "sample_queries": [
                "Find NNN Walgreens properties in Florida and assess their risk",
                "Run a DCF on a $4.2M property with $290k NOI and a 10 year hold",
                "What do current macro conditions mean for retail cap rates in Tampa?",
                "Source the top 3 medical office deals in Texas, score the risk, and draft an IC memo",
            ],
        },
        "llm_config": {"model_name": os.environ.get("DEALSENSE_LLM_MODEL", "gpt-4o")},
        "max_iterations": 40,
        "tools": tools,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api-url", default=os.environ.get("DEALSENSE_API_URL", "http://localhost:3001"))
    args = ap.parse_args()

    schemas = load_schemas(args.api_url)
    network = build_network(schemas)

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w") as f:
        f.write("# Generated by generate_network.py — do not edit by hand.\n")
        f.write("# Regenerate with: python3 neurosan/generate_network.py\n")
        json.dump(network, f, indent=4)
        f.write("\n")
    n_agents = 1 + len(SPECIALISTS)
    n_tools = len(network["tools"]) - n_agents
    print(f"Wrote {OUTPUT}: 1 front man + {len(SPECIALISTS)} specialists + {n_tools} coded tools")


if __name__ == "__main__":
    main()
