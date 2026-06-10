"""Bridge between neuro-san coded tools and the DealSense Node orchestrator.

Every backend tool in orchestrator/src/tools/registry.ts is exposed through a
single generic CodedTool. The hocon entry for each tool passes its registry
name via args ("tool_name"), so one class serves all 20 tools and new tools
need zero new Python code — just regenerate dealsense.hocon.

Design choice (deliberate): plain HTTP API, not MCP. The orchestrator's
POST /api/tools/execute runs a tool directly with no LLM in the loop, so
tool execution costs zero tokens and each tool stays independently testable.
"""
import json
import os
from typing import Any, Dict

import aiohttp

from neuro_san.interfaces.coded_tool import CodedTool

DEFAULT_API_URL = "http://localhost:3001"
TIMEOUT_SECONDS = 180  # search/browser tools can be slow


def _is_jsonable(value: Any) -> bool:
    try:
        json.dumps(value)
        return True
    except (TypeError, ValueError):
        return False


class OrchestratorTool(CodedTool):
    """Invokes one DealSense registry tool via POST /api/tools/execute."""

    async def async_invoke(self, args: Dict[str, Any], sly_data: Dict[str, Any]) -> Any:
        args = dict(args)
        tool_name = args.pop("tool_name", None)
        if not tool_name:
            return "ERROR: hocon args must include 'tool_name'"

        # neuro-san injects runtime entries (ProgressJournal, origin chain)
        # into args alongside the LLM-provided parameters, and LLMs send
        # explicit nulls for optional params (which would defeat the
        # backend's destructuring defaults). Forward only real values.
        args.pop("origin", None)
        args = {k: v for k, v in args.items() if v is not None and _is_jsonable(v)}

        base_url = (
            sly_data.get("dealsense_api_url")
            or os.environ.get("DEALSENSE_API_URL", DEFAULT_API_URL)
        ).rstrip("/")

        payload: Dict[str, Any] = {"tool": tool_name, "args": args}
        # Org-level settings (PE weights, data sources) ride in sly_data so
        # they never enter the chat stream.
        if sly_data.get("org_settings"):
            payload["orgSettings"] = sly_data["org_settings"]

        timeout = aiohttp.ClientTimeout(total=TIMEOUT_SECONDS)
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(f"{base_url}/api/tools/execute", json=payload) as resp:
                    body = await resp.json(content_type=None)
        except Exception as exc:  # network/timeout — report, don't raise into the agent loop
            return (
                f"ERROR: could not reach DealSense orchestrator at {base_url}: {exc}. "
                "Is it running? (cd orchestrator && npm run dev)"
            )

        if not isinstance(body, dict) or not body.get("ok"):
            err = body.get("error") if isinstance(body, dict) else body
            return f"ERROR from tool '{tool_name}': {err}"

        return json.dumps(body.get("result"), default=str)
