#!/usr/bin/env python3
"""Level-1 evals: exercise each DealSense backend tool directly (no LLM).

These prove each unit of capability works independently of any agent —
the "test each one individually" half of the multi-agent eval story.

    python3 evals/run_tool_evals.py [--api-url http://localhost:3001] [--external]

By default, cases tagged with external requirements (web search, FRED keys)
are skipped; pass --external to include them.
"""
import argparse
import json
import os
import sys

import requests

HERE = os.path.dirname(os.path.abspath(__file__))


def run_case(api_url: str, case: dict) -> tuple[bool, str]:
    resp = requests.post(
        f"{api_url}/api/tools/execute",
        json={"tool": case["tool"], "args": case["args"]},
        timeout=180,
    )
    body = resp.json()
    expect = case.get("expect", {})

    if "ok" in expect and body.get("ok") != expect["ok"]:
        return False, f"expected ok={expect['ok']}, got ok={body.get('ok')} error={body.get('error')}"

    result = body.get("result")
    for key in expect.get("result_keys", []):
        if not isinstance(result, dict) or key not in result:
            return False, f"missing result key '{key}'"

    needle = expect.get("contains")
    if needle and needle.lower() not in json.dumps(result, default=str).lower():
        return False, f"result does not contain '{needle}'"

    return True, "ok"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api-url", default=os.environ.get("DEALSENSE_API_URL", "http://localhost:3001"))
    ap.add_argument("--external", action="store_true", help="also run cases needing web/API keys")
    ap.add_argument("--only", help="run only the named case")
    args = ap.parse_args()

    with open(os.path.join(HERE, "tool_cases.json")) as f:
        cases = json.load(f)["cases"]

    passed = failed = skipped = 0
    for case in cases:
        if args.only and case["name"] != args.only:
            continue
        if case.get("requires") and not args.external:
            print(f"SKIP {case['name']} (requires {','.join(case['requires'])}; use --external)")
            skipped += 1
            continue
        try:
            ok, msg = run_case(args.api_url, case)
        except Exception as exc:
            ok, msg = False, str(exc)
        status = "PASS" if ok else "FAIL"
        print(f"{status} {case['name']} [{case['tool']}] {'' if ok else '— ' + msg}")
        passed += ok
        failed += not ok

    print(f"\n{passed} passed, {failed} failed, {skipped} skipped")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
