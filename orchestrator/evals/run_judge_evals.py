#!/usr/bin/env python3
"""Judge-grade e2e evals for the DealSense multi-agent system.

Orchestrator-agnostic: exercises the full stack (Express front door ->
orchestrator -> tools) through the same SSE event contract the UI uses.

Dimensions covered (what an evaluator asks of a multi-agent system):
  routing       — does the supervisor delegate to the right specialist?
  faithfulness  — do numbers in the answer come from tool outputs verbatim?
  completeness  — are ALL parts of a multi-intent request addressed?
  honesty       — off-topic refused; missing data admitted, not fabricated
  resilience    — failed strict search retried with relaxed criteria
  latency       — every case has a time budget (warn at 1x, fail at 2x)

Usage:
    python3 evals/run_judge_evals.py
    python3 evals/run_judge_evals.py --only honesty_refusal
    python3 evals/run_judge_evals.py --skip completeness_multi_intent
"""
import argparse
import json
import os
import re
import sys
import time

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
SPECIALISTS = {"property_scout", "risk_analyst", "market_analyst",
               "financial_modeler", "portfolio_manager", "deal_writer"}


def run_query(api_url: str, orch: str, query: str, timeout_s: int):
    """Run one query, collect events from the SSE stream. Returns a result dict."""
    r = requests.post(f"{api_url}/api/{orch}/run", json={"query": query}, timeout=30)
    r.raise_for_status()
    run_id = r.json()["runId"]

    out = {
        "specialists": [], "tool_calls": {}, "tool_results": [],
        "answer_html": "", "ok": None, "duration_s": None,
    }
    t0 = time.time()
    resp = requests.get(f"{api_url}/events/{run_id}", stream=True, timeout=timeout_s + 60)
    for line in resp.iter_lines(decode_unicode=True):
        if time.time() - t0 > timeout_s * 2:
            break
        if not line or not line.startswith("data:"):
            continue
        try:
            ev = json.loads(line[5:])
        except json.JSONDecodeError:
            continue
        k = ev.get("kind")
        if k == "ns_hop":
            t = ev.get("target")
            if ev.get("targetType") == "specialist" and t not in out["specialists"]:
                out["specialists"].append(t)
            elif ev.get("targetType") == "tool":
                out["tool_calls"][t] = out["tool_calls"].get(t, 0) + 1
        elif k == "agent_step" and ev.get("type") == "tool_result":
            out["tool_results"].append({"tool": ev.get("toolName"), "result": ev.get("toolResult") or ""})
        elif k == "answer_chunk":
            out["answer_html"] += ev.get("text", "")
        elif k == "run_finished":
            out["ok"] = ev.get("ok")
            break
    out["duration_s"] = round(time.time() - t0, 1)
    out["answer"] = " ".join(re.sub(r"<[^>]+>", " ", out["answer_html"]).split())
    return out


# ── Per-dimension checks: return list of problem strings (empty = pass) ────

def check_routing(case, res):
    return [f"specialist '{s}' not invoked (got {res['specialists']})"
            for s in case.get("expect_specialists", []) if s not in res["specialists"]]


def check_faithfulness_dcf(case, res):
    problems = []
    dcf = next((t for t in res["tool_results"] if t["tool"] == "run_dcf"), None)
    if not dcf:
        return ["run_dcf tool result never appeared in stream"]
    # extract figures from the tool's own output
    irr = re.search(r'"irr"\s*:\s*"([\d.]+%)"', dcf["result"])
    em = re.search(r'"equityMultiple"\s*:\s*"([\d.]+x)"', dcf["result"])
    if not irr:
        return [f"could not parse irr from tool output: {dcf['result'][:120]}"]
    if irr.group(1) not in res["answer"]:
        problems.append(f"answer does not contain tool-reported IRR {irr.group(1)} — possible hallucination")
    if em and em.group(1) not in res["answer"]:
        problems.append(f"answer does not contain tool-reported equity multiple {em.group(1)}")
    # no OTHER percentage presented as 'IRR' that contradicts the tool
    claimed = re.findall(r"IRR[^.%]{0,40}?([\d.]+%)", res["answer"], re.I)
    for c in claimed:
        if irr and c != irr.group(1) and abs(float(c.rstrip('%')) - float(irr.group(1).rstrip('%'))) > 0.05:
            problems.append(f"answer claims IRR {c}, tool said {irr.group(1)}")
    return problems


def check_completeness(case, res):
    problems = []
    hit = [s for s in case.get("expect_specialists", []) if s in res["specialists"]]
    need = case.get("min_specialists", len(case.get("expect_specialists", [])))
    if len(hit) < need:
        problems.append(f"only {len(hit)}/{need} required specialists ran: {hit}")
    for kw in case.get("expect_keywords", []):
        if kw.lower() not in res["answer"].lower():
            problems.append(f"answer missing '{kw}'")
    return problems


def check_refusal(case, res):
    problems = []
    if res["specialists"]:
        problems.append(f"off-topic query should invoke NO specialists, got {res['specialists']}")
    if not res["answer"]:
        problems.append("no answer produced")
    return problems


def check_honesty(case, res):
    ans = res["answer"].lower()
    if any(kw in ans for kw in case.get("expect_any_keywords", [])):
        return []
    return ["answer neither asked for missing inputs nor disclosed assumptions — "
            f"possible fabrication: {res['answer'][:160]}"]


def check_resilience(case, res):
    return [f"{tool} called {res['tool_calls'].get(tool, 0)}x, expected >= {n}"
            for tool, n in case.get("min_tool_calls", {}).items()
            if res["tool_calls"].get(tool, 0) < n]


CHECKS = {
    "routing": check_routing,
    "faithfulness_dcf": check_faithfulness_dcf,
    "completeness": check_completeness,
    "refusal": check_refusal,
    "honesty": check_honesty,
    "resilience": check_resilience,
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api-url", default=os.environ.get("DEALSENSE_API_URL", "http://localhost:3001"))
    ap.add_argument("--orch", choices=["lg"], default="lg")
    ap.add_argument("--only", help="run only the named case")
    ap.add_argument("--skip", action="append", default=[], help="case name to skip (repeatable)")
    args = ap.parse_args()

    with open(os.path.join(HERE, "judge_cases.json")) as f:
        cases = json.load(f)["cases"]

    passed = failed = skipped = 0
    for case in cases:
        if args.only and case["name"] != args.only:
            continue
        if case["name"] in args.skip:
            print(f"SKIP {case['name']}")
            skipped += 1
            continue
        budget = case.get("budget_s", 300)
        print(f"--- {case['name']} [{case['type']}] ({args.orch})")

        if case["type"] == "parity":
            print(f"SKIP {case['name']} (parity requires multiple orchestrators)")
            skipped += 1
            continue
        try:
            res = run_query(args.api_url, args.orch, case["query"], budget)
        except Exception as exc:
            print(f"FAIL {case['name']} — {exc}"); failed += 1; continue
        problems = CHECKS[case["type"]](case, res)
        if res["duration_s"] > budget * 2:
            problems.append(f"latency {res['duration_s']}s exceeds 2x budget ({budget}s)")
        elif res["duration_s"] > budget:
            print(f"  WARN latency {res['duration_s']}s over budget {budget}s")
        print(f"  agents={res['specialists']} tools={res['tool_calls']} {res['duration_s']}s")

        if problems:
            print(f"FAIL {case['name']} — " + "; ".join(problems)); failed += 1
        else:
            print(f"PASS {case['name']}"); passed += 1

    print(f"\n{passed} passed, {failed} failed, {skipped} skipped")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
