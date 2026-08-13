"""Systematic literature review workflow — PRISMA-inspired guided process."""

from typing import Any

WORKFLOW_STEPS = [
    {
        "step": 1,
        "title": "定义研究问题",
        "description": (
            "用 PICO 框架明确你的研究问题：Population（研究对象）、Intervention（干预/方法）、"
            "Comparison（对比基线）、Outcome（目标结果）"
        ),
        "template": {
            "population": "研究对象是什么？（如：NLP 中的 Transformer 模型）",
            "intervention": "关注的方法/干预？（如：稀疏注意力机制）",
            "comparison": "对比什么？（如：标准自注意力）",
            "outcome": "衡量什么？（如：推理速度、准确率）",
        },
        "action": "填写 PICO 框架并保存",
    },
    {
        "step": 2,
        "title": "设计检索策略",
        "description": "确定检索关键词、数据库范围、时间范围、纳入/排除标准",
        "template": {
            "keywords": "将 PICO 转化为检索词（如：sparse attention, efficient transformer）",
            "databases": ["ArXiv", "Semantic Scholar", "DBLP"],
            "year_range": "2020-2026",
            "inclusion": "英文论文、同行评审、有实验结果",
            "exclusion": "未发表预印本（可选）、非英语、纯理论无实验",
        },
        "action": "执行检索",
    },
    {
        "step": 3,
        "title": "筛选论文",
        "description": "按标题和摘要初筛，再按全文复筛。记录每一步排除的论文数量和原因",
        "stages": [
            {"name": "初步检索", "description": "从数据库中检索到的总论文数"},
            {"name": "去重后", "description": "去除重复论文后剩余数量"},
            {"name": "标题筛选", "description": "阅读标题排除明显不相关的论文"},
            {"name": "摘要筛选", "description": "阅读摘要进一步筛选"},
            {"name": "全文筛选", "description": "阅读全文最终确定纳入的论文"},
        ],
        "action": "记录每个阶段的论文数量",
    },
    {
        "step": 4,
        "title": "数据提取",
        "description": "从纳入的每篇论文中提取关键信息，建立对比表格",
        "fields": [
            "作者/年份", "方法名称", "核心创新点", "数据集",
            "评价指标", "主要结果", "代码是否开源", "局限性",
        ],
        "action": "逐篇提取数据到表格",
    },
    {
        "step": 5,
        "title": "质量评估",
        "description": "评估每篇论文的方法学质量和偏倚风险",
        "criteria": [
            "实验设计是否合理",
            "数据集是否公开可用",
            "对比基线是否公平",
            "消融实验是否充分",
            "统计显著性是否报告",
        ],
        "action": "对每篇论文进行质量评分",
    },
    {
        "step": 6,
        "title": "综合分析与写作",
        "description": "汇总提取的数据，分析趋势和空白，撰写综述",
        "sections": [
            "文献检索流程（PRISMA 流程图）",
            "纳入文献概览（数量、年份分布、发表渠道）",
            "方法分类与对比（按技术路线分组比较）",
            "关键发现与趋势",
            "研究空白与未来方向",
        ],
        "action": "撰写综述初稿",
    },
]


def get_workflow() -> list[dict[str, Any]]:
    return WORKFLOW_STEPS


def get_step(step_num: int) -> dict[str, Any] | None:
    for s in WORKFLOW_STEPS:
        if s["step"] == step_num:
            return s
    return None
