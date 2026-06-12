"""Research gap analysis — given a set of papers, identify unexplored directions."""

from typing import Any

GAP_TEMPLATES = [
    ("数据集偏差", "现有工作多基于 {dataset_hint}，对其他领域/语言/模态的泛化性研究不足"),
    ("规模上限", "当前方法在 {scale_hint} 上的表现已验证，但更大规模场景下的可行性未知"),
    ("理论缺失", "实验结果良好但缺乏严格的理论保证，如收敛性证明或泛化界"),
    ("效率瓶颈", "现有方法的推理/训练开销较大，轻量化版本的研究尚不充分"),
    ("跨领域迁移", "方法在 {domain_a} 上效果显著，但能否迁移到 {domain_b} 缺乏验证"),
    ("鲁棒性", "对噪声、对抗样本、分布偏移的鲁棒性分析不足"),
    ("公平性", "模型在不同人口统计维度上的公平性评估缺失"),
    ("多模态融合", "当前方法仅处理 {modality} 模态，与其他模态的融合未被探索"),
    ("可解释性", "模型决策过程不透明，缺乏可解释性分析"),
    ("实时性", "当前方法延迟过高，无法满足 {latency_scenario} 等实时场景需求"),
]


def analyze_gaps(papers: list[dict[str, Any]], field: str = "") -> list[dict[str, Any]]:
    """Analyze a set of papers and suggest potential research gaps."""
    if not papers:
        return _default_gaps("general")

    titles = [p.get("title", "") for p in papers[:10]]
    summaries = [p.get("summary", "") for p in papers[:10]]
    all_text = " ".join(titles + summaries).lower()

    gaps: list[dict[str, Any]] = []

    # Heuristic-based gap detection
    checks = [
        ("theory", "理论分析", "theorem", "proof", "convergence", "bound", "guarantee"),
        ("efficiency", "效率优化", "efficient", "lightweight", "pruning", "quantization", "distillation", "加速", "轻量"),
        ("robustness", "鲁棒性", "robust", "adversarial", "noise", "perturbation", "鲁棒"),
        ("fairness", "公平性", "fairness", "bias", "demographic", "公平"),
        ("multimodal", "多模态", "multimodal", "cross-modal", "vision-language", "audio", "video"),
        ("interpretability", "可解释性", "interpretable", "explainable", "saliency", "attention map", "可解释"),
        ("reproducibility", "可复现性", "code", "open-source", "reproducible", "开源", "复现"),
    ]

    for check_id, name, *keywords in checks:
        found = any(kw.lower() in all_text for kw in keywords)
        if not found:
            gaps.append({
                "direction": name,
                "confidence": "high",
                "reason": f"所选论文未涉及{name}方面的讨论，这是一个潜在的研究空白",
            })
        else:
            gaps.append({
                "direction": name,
                "confidence": "medium",
                "reason": f"部分论文涉及{name}，但深度可能不足，可进一步挖掘",
            })

    # Add field-specific gaps
    field_gaps = _field_specific_gaps(field or _guess_field(all_text))
    gaps.extend(field_gaps)

    # Sort by confidence
    gaps.sort(key=lambda g: 0 if g["confidence"] == "high" else 1)

    return gaps[:8]


def _guess_field(text: str) -> str:
    if any(kw in text for kw in ["transformer", "attention", "language model", "llm", "nlp", "bert", "gpt"]):
        return "nlp"
    if any(kw in text for kw in ["image", "cnn", "convolution", "segmentation", "detection", "vision"]):
        return "cv"
    if any(kw in text for kw in ["graph", "gnn", "node", "edge"]):
        return "graph"
    if any(kw in text for kw in ["reinforcement", "rl", "policy", "reward"]):
        return "rl"
    return "general"


def _field_specific_gaps(field: str) -> list[dict[str, Any]]:
    field_gaps = {
        "nlp": [
            {"direction": "低资源语言", "confidence": "high", "reason": "NLP 研究集中在英语和少数高资源语言，低资源语言场景下的方法严重不足"},
            {"direction": "长文本推理", "confidence": "high", "reason": "现有模型在长文档推理、多跳问答上仍有明显退化"},
        ],
        "cv": [
            {"direction": "3D 视觉", "confidence": "high", "reason": "2D 方法趋于饱和，3D 重建/理解/生成的精度和效率仍有巨大空间"},
            {"direction": "视频理解", "confidence": "high", "reason": "从图像到视频的迁移在时序建模和计算效率上挑战显著"},
        ],
        "graph": [
            {"direction": "动态图", "confidence": "high", "reason": "大多数 GNN 方法假设静态图，现实场景中图结构往往随时间演化"},
            {"direction": "异构图扩展性", "confidence": "medium", "reason": "异构图神经网络在大规模场景下的训练效率有待提升"},
        ],
        "rl": [
            {"direction": "离线 RL", "confidence": "high", "reason": "在线 RL 在真实场景中成本过高，离线 RL 的策略评估和外推仍是开放问题"},
            {"direction": "多智能体协调", "confidence": "high", "reason": "多智能体场景下的信用分配、通信效率和涌现行为研究不足"},
        ],
        "general": [
            {"direction": "跨领域泛化", "confidence": "high", "reason": "多数方法针对特定领域设计，跨领域时性能急剧下降"},
            {"direction": "数据效率", "confidence": "high", "reason": "现有方法依赖大规模标注数据，少样本/零样本场景仍是挑战"},
        ],
    }
    return field_gaps.get(field, field_gaps["general"])


def _default_gaps(field: str) -> list[dict[str, Any]]:
    return [
        {"direction": "请先提供论文列表", "confidence": "low",
         "reason": "需要至少一篇论文作为分析起点"},
        *_field_specific_gaps(field),
    ]
