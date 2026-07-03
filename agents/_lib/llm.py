"""LLM singletons — streaming (for Crews) + non-streaming (for @human_feedback collapse)."""

from crewai import LLM
from .logger import create_logger

logger = create_logger("llm")

_llm = None
_collapse_llm = None


def init_llm(context_env):
    global _llm, _collapse_llm
    if _llm is not None:
        return _llm

    env = context_env or {}
    api_key = env.get("AI_GATEWAY_API_KEY", "")
    base_url = env.get("AI_GATEWAY_BASE_URL", "")
    model_id = env.get("AI_GATEWAY_MODEL") or "@makers/deepseek-v4-flash"
    if not api_key or not base_url:
        raise RuntimeError("Missing AI_GATEWAY_API_KEY or AI_GATEWAY_BASE_URL")

    model = f"openai/{model_id}"

    # DeepSeek models support thinking/reasoning; disable via extra_body
    extra_body = None
    if "deepseek" in model.lower():
        extra_body = {"thinking": {"type": "disabled"}}

    logger.log("Initializing LLM...")
    _llm = LLM(
        model=model,
        api_key=api_key,
        base_url=base_url,
        temperature=0,
        timeout=300,
        stream=True,
        extra_body=extra_body,
    )
    _collapse_llm = LLM(
        model=model,
        api_key=api_key,
        base_url=base_url,
        temperature=0,
        timeout=60,
        stream=False,
        extra_body=extra_body,
    )
    return _llm


def get_llm():
    if _llm is None:
        raise RuntimeError("Call init_llm() first.")
    return _llm


def get_collapse_llm():
    if _collapse_llm is None:
        raise RuntimeError("Call init_llm() first.")
    return _collapse_llm
