import json
import sys
from http.server import BaseHTTPRequestHandler

FLOW_STATE_SUFFIX = ":flow_state"


class handler(BaseHTTPRequestHandler):
    """POST /delete — delete conversation data and flow state."""

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body_bytes = self.rfile.read(content_length)
        try:
            body = json.loads(body_bytes) if body_bytes else {}
        except (json.JSONDecodeError, ValueError):
            body = {}

        cid = body.get("conversationId")
        if not cid:
            self._respond(400, "Missing conversationId")
            return

        store = self.context.agent.store
        try:
            store.delete_conversation(cid)
        except Exception as e:
            print(f"[delete] delete_conversation error: {e}", file=sys.stderr, flush=True)
        try:
            store.delete_conversation(cid + FLOW_STATE_SUFFIX)
        except Exception:
            pass

        self._respond(200, {"deleted": True})

    def _respond(self, status: int, body):
        if isinstance(body, str):
            payload = body.encode("utf-8")
            content_type = "text/plain"
        else:
            payload = json.dumps(body).encode("utf-8")
            content_type = "application/json"
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
