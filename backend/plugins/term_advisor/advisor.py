import re
from dataclasses import dataclass, field
from enum import StrEnum


class TaskPhase(StrEnum):
    RESEARCH = "调研阶段"
    DESIGN = "设计阶段"
    IMPLEMENT = "实现阶段"
    EXPERIMENT = "实验阶段"
    WRITE = "写作阶段"


PHASE_ORDER = {
    TaskPhase.RESEARCH: 1,
    TaskPhase.DESIGN: 2,
    TaskPhase.IMPLEMENT: 3,
    TaskPhase.EXPERIMENT: 4,
    TaskPhase.WRITE: 5,
}

PHASE_ESTIMATES = {
    TaskPhase.RESEARCH: (3, 7),
    TaskPhase.DESIGN: (2, 5),
    TaskPhase.IMPLEMENT: (5, 14),
    TaskPhase.EXPERIMENT: (3, 10),
    TaskPhase.WRITE: (3, 7),
}

EXPANSION_TEMPLATES: dict[str, list[str]] = {
    "文献综述": [
        "确定检索关键词组合与数据库范围",
        "按时间线或子领域分类整理文献",
        "提取每篇论文的核心贡献与不足",
        "构建对比表格，定位研究空白",
        "撰写综述初稿并标注引文",
    ],
    "调研": [
        "收集该方向代表性论文（近3年）",
        "梳理主流方法的技术路线与演进",
        "比较各方法在标准基准上的性能",
        "标注可直接复现的开源实现",
    ],
    "实现": [
        "选择基线模型/框架，搭建最小可运行版本",
        "复现论文核心指标，验证与原文一致性",
        "实现自己的改进模块",
        "单元测试 + 集成测试",
    ],
    "复现": [
        "仔细阅读论文方法部分，列出所有超参数",
        "查找官方或社区实现的代码仓库",
        "搭建相同或相近的实验环境",
        "运行基线实验，对比论文报告数据",
        "记录复现过程中的差异与发现",
    ],
    "对比分析": [
        "确定对比维度（性能、效率、可扩展性等）",
        "收集各方法的公平对比数据",
        "绘制对比图表",
        "分析各方法的适用场景与局限性",
    ],
    "改进": [
        "明确现有方法的瓶颈",
        "提出改进假设并设计验证方案",
        "逐步消融实验确认改进来源",
        "与基线全面对比",
    ],
    "实验": [
        "设计实验表格，确定自变量与因变量",
        "准备数据集与评估脚本",
        "运行完整实验矩阵",
        "统计分析 + 可视化",
    ],
    "了解": [
        "阅读该领域1-2篇综述或入门文章",
        "梳理核心概念与术语",
        "列出关键论文清单",
    ],
}

ACTION_TO_PHASE: dict[str, TaskPhase] = {
    "文献综述": TaskPhase.RESEARCH,
    "调研": TaskPhase.RESEARCH,
    "了解": TaskPhase.RESEARCH,
    "设计": TaskPhase.DESIGN,
    "实现": TaskPhase.IMPLEMENT,
    "复现": TaskPhase.IMPLEMENT,
    "改进": TaskPhase.IMPLEMENT,
    "对比分析": TaskPhase.EXPERIMENT,
    "实验": TaskPhase.EXPERIMENT,
    "写作": TaskPhase.WRITE,
}


@dataclass
class AdvisorTask:
    action: str
    keywords: list[str] = field(default_factory=list)
    priority: str = "normal"


@dataclass
class PlannedTask:
    index: int
    action: str
    keywords: list[str]
    phase: TaskPhase
    estimated_days_min: int
    estimated_days_max: int
    depends_on: list[int] = field(default_factory=list)
    subtasks: list[str] = field(default_factory=list)
    resources: list[str] = field(default_factory=list)
    milestone: str = ""


@dataclass
class ResearchPlan:
    title: str
    tasks: list[PlannedTask]
    total_days_min: int
    total_days_max: int
    timeline: list[dict] = field(default_factory=list)


def parse_advisor_text(text: str) -> list[AdvisorTask]:
    if not text or not text.strip():
        return []

    sentences = re.split(r"[。；;.，、]\s*", text)
    tasks: list[AdvisorTask] = []

    action_keywords = {
        # Chinese
        "综述": "文献综述",
        "调研": "调研",
        "实现": "实现",
        "复现": "复现",
        "对比": "对比分析",
        "改进": "改进",
        "实验": "实验",
        # English
        "review": "文献综述",
        "literature review": "文献综述",
        "survey": "调研",
        "investigate": "调研",
        "implement": "实现",
        "reproduce": "复现",
        "compare": "对比分析",
        "improve": "改进",
        "experiment": "实验",
    }

    # English stopwords to filter from keywords
    stopwords = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
                 "of", "with", "from", "by", "is", "are", "was", "were", "be", "been",
                 "being", "have", "has", "had", "do", "does", "did", "will", "would",
                 "could", "should", "may", "might", "can", "shall", "you", "your",
                 "first", "then", "finally", "also", "just", "about", "that", "this",
                 "these", "those", "it", "its", "they", "them", "their", "we", "our",
                 "how", "what", "when", "where", "which", "who", "whom", "why",
                 "go", "look", "see", "check", "focus", "make", "get", "use", "try",
                 "need", "want", "think", "let", "like", "take", "give", "find", "tell",
                 "start", "begin", "work", "run", "put", "set", "keep", "show", "ask",
                 "into", "onto", "than", "as", "if", "so", "no", "not", "all", "one",
                 "two", "three", "much", "many", "more", "most", "some", "any", "very",
                 "new", "good", "well", "better", "best", "here", "there", "now", "out"}

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence or len(sentence) < 4:
            continue

        sentence_lower = sentence.lower()
        action = "了解"
        found_keywords: list[str] = []

        # Check multi-word keywords first (longest match)
        sorted_kw = sorted(action_keywords.items(), key=lambda x: -len(x[0]))
        for kw, act in sorted_kw:
            if kw in sentence_lower:
                action = act
                break

        # Extract English technical terms (multi-word, uppercase-starting)
        english_terms = re.findall(r"[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*", sentence)
        found_keywords.extend(english_terms)

        # Also extract lowercase multi-word technical phrases
        lower_terms = re.findall(r"[a-z]{3,}(?:\s+[a-z]{3,})+", sentence_lower)
        lower_terms = [
            " ".join(t.split())
            for t in lower_terms
            if " ".join(t.split()) not in stopwords
            and len(" ".join(t.split()).split()) >= 2
        ]
        found_keywords.extend(lower_terms[:3])

        # Extract Chinese technical terms
        chinese_terms = re.findall(
            r"[一-鿿]{2,8}(?:模型|方法|算法|网络|系统|框架|机制|理论|定理|公式|"
            r"数据|实验|训练|推理|生成|识别|分类|预测|优化)?",
            sentence,
        )
        stop_terms = {"的方法", "在此基础", "首先需要", "然后进行", "最后", "在此基础上"}
        chinese_terms = [t for t in chinese_terms if t not in stop_terms]
        found_keywords.extend(chinese_terms[:3])

        # Deduplicate while preserving order
        seen = set()
        unique_kw = []
        for kw in found_keywords:
            kw_lower = kw.lower()
            if kw_lower not in seen and kw_lower not in stopwords and len(kw) >= 2:
                seen.add(kw_lower)
                unique_kw.append(kw)
        found_keywords = unique_kw[:5]

        tasks.append(AdvisorTask(action=action, keywords=found_keywords))

    if not tasks:
        tasks.append(AdvisorTask(action="了解", keywords=[text[:20]]))

    return tasks


def create_plan(tasks: list[AdvisorTask], title: str = "") -> ResearchPlan:
    planned: list[PlannedTask] = []

    def _expand(action: str, keywords: list[str]) -> tuple[list[str], list[str]]:
        template = EXPANSION_TEMPLATES.get(action, EXPANSION_TEMPLATES["了解"])
        subtasks = list(template)

        # Customize subtasks with keywords
        if keywords:
            subtasks.append(f"重点关注: {', '.join(keywords[:5])}")

        resources = _suggest_resources(action, keywords)
        return subtasks, resources

    def _suggest_resources(action: str, keywords: list[str]) -> list[str]:
        resource_list: list[str] = []
        kw_str = " ".join(keywords[:3]) if keywords else ""

        if action in ("文献综述", "调研", "了解"):
            if kw_str:
                resource_list.append(f"在 ArXiv / Semantic Scholar 搜索: {kw_str}")
            resource_list.append("查阅相关领域的综述论文 (Survey/Review)")
            resource_list.append("查看顶级会议的 Tutorial 或 Workshop")

        if action in ("实现", "复现"):
            resource_list.append("在 GitHub 搜索开源实现 (Papers with Code)")
            resource_list.append("查阅官方文档与 API 参考")

        if action in ("实验", "对比分析"):
            resource_list.append("确认标准基准数据集与评估指标")
            resource_list.append("查找已有 baseline 结果作为参考")

        if action == "改进":
            resource_list.append("列出当前 SOTA 方法的已知局限性")
            resource_list.append("收集相关改进思路的论文")

        return resource_list

    # Assign phases and dependencies
    prev_phase_idx: dict[TaskPhase, int] = {}

    for i, task in enumerate(tasks):
        phase = ACTION_TO_PHASE.get(task.action, TaskPhase.RESEARCH)
        est_min, est_max = PHASE_ESTIMATES[phase]
        subtasks, resources = _expand(task.action, task.keywords)

        deps: list[int] = []
        for p in TaskPhase:
            if PHASE_ORDER[p] < PHASE_ORDER[phase] and p in prev_phase_idx:
                deps.append(prev_phase_idx[p])

        milestone = (
            f"{phase.value}: {task.action} — "
            f"{', '.join(task.keywords[:2]) if task.keywords else '开始'}"
        )
        planned_task = PlannedTask(
            index=i + 1,
            action=task.action,
            keywords=task.keywords,
            phase=phase,
            estimated_days_min=est_min,
            estimated_days_max=est_max,
            depends_on=deps,
            subtasks=subtasks,
            resources=resources,
            milestone=milestone,
        )
        planned.append(planned_task)
        prev_phase_idx[phase] = i + 1

    # Sequential dependency for same-phase tasks
    for i in range(1, len(planned)):
        if (
            planned[i].phase == planned[i - 1].phase
            and planned[i - 1].index not in planned[i].depends_on
        ):
            planned[i].depends_on.append(planned[i - 1].index)

    # Calculate total (critical path estimate)
    # Group by phase, sum max per distinct phase, then sum max times across phases
    total_min = sum(
        max((t.estimated_days_min for t in planned if t.phase == p), default=0)
        for p in TaskPhase
        if any(t.phase == p for t in planned)
    )
    total_max = sum(
        max((t.estimated_days_max for t in planned if t.phase == p), default=0)
        for p in TaskPhase
        if any(t.phase == p for t in planned)
    )

    # Build timeline (accumulated days)
    timeline: list[dict] = []
    cumulative = 0
    seen_phases: set[TaskPhase] = set()
    for t in planned:
        if t.phase not in seen_phases:
            seen_phases.add(t.phase)
            cumulative = 0
        start_day = cumulative + 1
        end_day = cumulative + t.estimated_days_max
        timeline.append({
            "task_index": t.index,
            "action": t.action,
            "phase": t.phase.value,
            "start_day": start_day,
            "end_day": end_day,
        })
        cumulative = end_day

    return ResearchPlan(
        title=title or "研究计划",
        tasks=planned,
        total_days_min=total_min,
        total_days_max=total_max,
        timeline=timeline,
    )
