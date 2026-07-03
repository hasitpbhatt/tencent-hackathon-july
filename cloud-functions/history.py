import json
import sys
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    """POST /history — retrieve conversation messages."""

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body_bytes = self.rfile.read(content_length)
        try:
            body = json.loads(body_bytes) if body_bytes else {}
        except (json.JSONDecodeError, ValueError):
            body = {}

        cid = body.get("conversationId")
        if not cid:
            self._respond(200, {"messages": []})
            return

        try:
            store = self.context.agent.store
            messages = store.get_messages(cid, limit=100, order="asc")
            items = [
                {"role": m.role, "content": m.content, "metadata": m.metadata}
                for m in messages
            ]
            self._respond(200, {"messages": items})
        except Exception as e:
            print(f"[history] error: {e}", file=sys.stderr, flush=True)
            self._respond(200, {"messages": []})

    def _respond(self, status: int, body: dict):
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
