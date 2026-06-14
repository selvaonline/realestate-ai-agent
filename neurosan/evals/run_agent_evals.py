#!/usr/bin/env python3
"""Level-2 evals: end-to-end queries through the neuro-san agent network.

Verifies (a) the supervisor routes to the right specialists and
(b) the final answer contains what it should. Requires both servers running:

    1. cd orchestrator && npm run dev                 # backend tools on :3001
    2. cd neurosan && <server start, see README>      # neuro-san on :8080

    python3 evals/run_agent_evals.py [--ns-url http://localhost:8080] [--agent dealsense]
"""
import argparse
import json
import os
import sys

import requests

HERE = os.path.dirname(os.path.abspath(__file__))


def chat(ns_url: str, agent: str, text: str, timeout: int = 600) -> tuple[str, set]:
    """Returns (final_answer_text, set of agent/tool names that actually executed)."""
    resp = requests.post(
        f"{ns_url}/api/v1/{agent}/streaming_chat",
        # MAXIMAL filter includes origin metadata, needed for routing assertions
        json={"user_message": {"text": text}, "chat_filter": {"chat_filter_type": "MAXIMAL"}},
        stream=True,
        timeout=timeout,
    )
    resp.raise_for_status()
    invoked, final_text = set(), ""
    for line in resp.iter_lines(decode_unicode=True):
        if not line:
            continue
        try:
            msg = json.loads(line).get("response", {})
        except json.JSONDecodeError:
            continue
        # origin is the call chain of the agent that produced this message;
        # collecting every hop gives the set of agents that actually ran.
        for hop in msg.get("origin") or []:
            name = hop.get("tool") if isinstance(hop, dict) else str(hop)
            if name:
                invoked.add(name)
        if msg.get("type") == "AGENT_FRAMEWORK" and msg.get("text"):
            final_text = msg["text"]
    return final_text, invoked


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ns-url", default=os.environ.get("NEURO_SAN_URL", "http://localhost:8080"))
    ap.add_argument("--agent", default="dealsense")
    ap.add_argument("--only", help="run only the named case")
    args = ap.parse_args()

    with open(os.path.join(HERE, "agent_cases.json")) as f:
        cases = json.load(f)["cases"]

    passed = failed = 0
    for case in cases:
        if args.only and case["name"] != args.only:
            continue
        print(f"--- {case['name']}: {case['query'][:70]}")
        try:
            answer, invoked = chat(args.ns_url, args.agent, case["query"])
        except Exception as exc:
            print(f"FAIL {case['name']} — request error: {exc}")
            failed += 1
            continue

        problems = []
        for agent_name in case.get("expect_agents", []):
            if agent_name not in invoked:
                problems.append(f"specialist '{agent_name}' was never invoked")
        for kw in case.get("expect_keywords", []):
            if kw.lower() not in answer.lower():
                problems.append(f"answer missing keyword '{kw}'")
        if not answer:
            problems.append("empty final answer")

        if problems:
            print(f"FAIL {case['name']} — " + "; ".join(problems))
            failed += 1
        else:
            print(f"PASS {case['name']}")
            passed += 1
        print(f"    answer: {answer[:200].replace(chr(10), ' ')}")

    print(f"\n{passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
