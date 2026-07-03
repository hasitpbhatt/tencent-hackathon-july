"""EdgeOne Makers handler — POST /stream.

Conversation turn endpoint (streaming). Each request resumes or starts
a CrewAI Flow and streams agent output via SSE.
"""

import os
os.environ.setdefault('CREWAI_DISABLE_VERSION_CHECK', 'true')

import asyncio

from crewai.flow.async_feedback.types import HumanFeedbackPending
from crewai.types.streaming import FlowStreamingOutput, StreamChunkType
from crewai.utilities.streaming import (
    create_async_chunk_generator,
    create_streaming_state,
    register_cleanup,
    signal_end,
    signal_error,
)

from ._lib.flow import TurnFlow, bind_collapse_llm
from ._lib.llm import init_llm
from ._lib.logger import create_logger
from ._lib.persistence import get_persistence, has_pending, load_pending_from_store, sync_pending_to_store

logger = create_logger("stream")


async def _stream_resume(flow, feedback: str) -> FlowStreamingOutput:
    """Wrap resume_async in the same streaming infrastructure as kickoff_async.

    CrewAI's resume_async() doesn't return a streaming iterator, but the
    underlying Crew still emits LLMStreamChunkEvent to the event bus.
    This helper subscribes to those events — same pattern as kickoff_async
    (flow.py:2151-2193).
    """
    result_holder: list = []
    task_info = {"index": 0, "name": "", "id": "", "agent_role": "", "agent_id": ""}
    state = create_streaming_state(task_info, result_holder, use_async=True)
    output_holder: list = []

    async def run():
        try:
            result = await flow.resume_async(feedback)
            result_holder.append(result)
        except Exception as e:
            if isinstance(e, HumanFeedbackPending):
                result_holder.append(e)
            else:
                signal_error(state, e, is_async=True)
        finally:
            signal_end(state, is_async=True)

    streaming = FlowStreamingOutput(
        async_iterator=create_async_chunk_generator(state, run, output_holder)
    )
    register_cleanup(streaming, state)
    output_holder.append(streaming)
    return streaming


HIDDEN_AGENTS = {"Product Reviewer", "Product Designer"}


async def handler(context):
    """POST /stream — conversation turn (streaming)."""

    conversation_id = getattr(context, "conversation_id", None)
    body = context.request.body or {}

    user_message = (body.get("user_message") or "").strip()
    locale = body.get("locale", "English")
    if not user_message:
        return {"status_code": 400, "body": "Missing user_message"}

    try:
        init_llm(context.env)
        bind_collapse_llm()
    except Exception as e:
        logger.error(str(e))
        return {"status_code": 500, "body": {"error": str(e)}}

    store = context.store
    cid = conversation_id
    persistence = get_persistence()

    is_new = body.get("is_new", False)
    is_resume = has_pending(cid)
    if not is_resume and not is_new:
        is_resume = await load_pending_from_store(cid, store)

    async def gen():
        pending_writes: list[asyncio.Task] = []

        def fire_save(role: str, content: str, metadata: dict | None = None):
            async def _save():
                try:
                    await store.append_message(cid, role, content, metadata=metadata or {})
                except Exception as e:
                    logger.error("store write failed:", str(e))
            pending_writes.append(asyncio.create_task(_save()))

        try:
            fire_save("user", user_message)

            yield context.utils.sse({"type": "flow_start"})

            if is_resume:
                pending = persistence.load_pending_feedback(cid)
                pending_state = pending[0] if pending else {}

                flow = TurnFlow.from_pending(cid, persistence=persistence)

                if pending_state.get("latest_prd") or pending_state.get("latest_design"):
                    yield context.utils.sse({"type": "phase", "phase": "iterate"})
                elif pending_state.get("_pm_ready") or pending_state.get("rounds", 0) >= 3:
                    yield context.utils.sse({"type": "phase", "phase": "draft"})
                else:
                    yield context.utils.sse({"type": "phase", "phase": "discover"})

                if flow.state.rounds <= 3 and not flow.state.latest_prd:
                    flow.state.qa_history = (
                        flow.state.qa_history + f"\nBoss: {user_message}"
                    ).strip()

                streaming = await _stream_resume(flow, user_message)
            else:
                flow = TurnFlow(persistence=persistence)

                yield context.utils.sse({"type": "phase", "phase": "discover"})
                streaming = await flow.kickoff_async(inputs={
                    "id": cid,
                    "product_name": user_message,
                    "locale": locale,
                })

            # ── Shared streaming loop ──
            prev_agent = ""
            current_content_buffer: list[str] = []
            agent_contents: list[str] = []
            # Write-step multi-doc tracking: accumulate hidden agent text
            write_buffers: dict[str, str] = {}
            write_hidden_last: str = ""

            def _flush_prev_agent():
                nonlocal prev_agent
                if prev_agent and current_content_buffer:
                    content = "".join(current_content_buffer)
                    if prev_agent not in HIDDEN_AGENTS:
                        agent_contents.append(content)
                        fire_save("assistant", content, {"agent": prev_agent})
                    else:
                        write_buffers[prev_agent] = (write_buffers.get(prev_agent, "") + content).strip()
                    current_content_buffer.clear()

            for chunk in streaming:
                agent_role = (chunk.agent_role or "").strip()

                if agent_role and agent_role != prev_agent:
                    _flush_prev_agent()
                    prev_agent = agent_role
                    if agent_role not in HIDDEN_AGENTS:
                        yield context.utils.sse({"type": "agent_start", "agent": agent_role})

                if chunk.chunk_type == StreamChunkType.TEXT:
                    text = chunk.content or ""
                    current_content_buffer.append(text)
                    if agent_role and agent_role not in HIDDEN_AGENTS:
                        yield context.utils.sse({
                            "type": "chunk",
                            "agent": agent_role,
                            "content": text,
                        })

            # Flush remaining buffer
            _flush_prev_agent()

            # Save Designer's Design Spec if collected (hidden agent)
            if "Product Designer" in write_buffers:
                fire_save("assistant", write_buffers["Product Designer"], {"agent": "Product Designer"})

            # ── Parse options from the last visible agent ──
            is_finalize = any(k in user_message for k in ("确认完成", "finalize", "looks good"))
            if not is_finalize:
                options = None
                for content in reversed(agent_contents):
                    options = _parse_options(content)
                    if options:
                        break
                if options:
                    options["canFinish"] = bool(flow.state.latest_prd)
                    yield context.utils.sse({"type": "options", **options})

            if pending_writes:
                await asyncio.gather(*pending_writes, return_exceptions=True)

            await sync_pending_to_store(cid, store)
            yield context.utils.sse({"type": "done", "status": "completed"})

        except Exception as e:
            logger.error("stream error:", str(e))
            import traceback
            logger.error("traceback:", traceback.format_exc())
            yield context.utils.sse({"type": "error", "message": str(e)})
            await sync_pending_to_store(cid, store)
            yield context.utils.sse({"type": "done", "status": "error"})
            if pending_writes:
                await asyncio.gather(*pending_writes, return_exceptions=True)

    return context.utils.stream_sse(gen())


def _parse_options(text: str) -> dict | None:
    """Parse A/B/C/D options from agent output. Returns structured data or None."""
    import re
    choices = []

    for line in text.strip().split("\n"):
        match = re.match(r'^([A-D])\.\s*(.+)', line.strip())
        if match:
            choices.append({"key": match.group(1), "text": match.group(2).strip()})

    if choices:
        return {"choices": choices}

    parts = re.split(r'\s*\b([A-D])\.\s+', text.strip())
    i = 1
    while i + 1 < len(parts):
        key = parts[i]
        value = parts[i + 1].strip()
        if value:
            choices.append({"key": key, "text": value})
        i += 2

    if choices:
        return {"choices": choices}
    return None
