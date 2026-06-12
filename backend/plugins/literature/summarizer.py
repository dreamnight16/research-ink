from typing import Any

from backend.core.llm_router import LLMRouter


async def summarize_paper(
    paper: dict[str, Any],
    router: LLMRouter,
    classification: str = "public",
) -> str:
    prompt = f"""用中文简要总结以下论文（200字以内），包含：1)核心问题 2)方法 3)主要发现

标题: {paper.get('title', '未知')}
摘要: {paper.get('summary', '无摘要')}"""

    provider = router.select(classification=classification)
    result = await router.chat(provider, [{"role": "user", "content": prompt}])
    return result
