import pytest
from backend.plugins.term_advisor.advisor import (
    parse_advisor_text,
    create_plan,
    AdvisorTask,
    PlannedTask,
    ResearchPlan,
    TaskPhase,
)
from backend.plugins.term_advisor.plugin import TermAdvisorPlugin


def test_parse_simple_instruction():
    text = "You go look at Transformer applications in NLP, then do a literature review"
    tasks = parse_advisor_text(text)
    assert len(tasks) >= 1
    assert any("Transformer" in t.keywords for t in tasks)
    assert any("综述" in t.action for t in tasks)


def test_parse_identifies_keywords():
    text = "先调研diffusion model在图像生成方面的最新进展，重点关注DDPM和Stable Diffusion"
    tasks = parse_advisor_text(text)
    keywords = {kw for t in tasks for kw in t.keywords}
    assert any("diffusion" in kw.lower() for kw in keywords)


def test_parse_empty_returns_fallback():
    tasks = parse_advisor_text("")
    assert len(tasks) == 0


def test_create_plan_from_tasks():
    tasks = parse_advisor_text(
        "先对Transformer做文献综述，然后实现一个改进的注意力机制，最后做实验对比基线"
    )
    plan = create_plan(tasks, "Transformer改进研究")
    assert isinstance(plan, ResearchPlan)
    assert plan.title == "Transformer改进研究"
    assert len(plan.tasks) >= 2
    assert plan.total_days_min > 0
    assert plan.total_days_max >= plan.total_days_min


def test_plan_has_timeline():
    tasks = parse_advisor_text("Implement a diffusion model and run experiments")
    plan = create_plan(tasks)
    assert len(plan.timeline) == len(plan.tasks)
    for entry in plan.timeline:
        assert entry["start_day"] >= 1
        assert entry["end_day"] >= entry["start_day"]


def test_plan_tasks_have_subtasks():
    tasks = parse_advisor_text("Do a literature review on graph neural networks")
    plan = create_plan(tasks)
    assert len(plan.tasks) == 1
    assert len(plan.tasks[0].subtasks) >= 2
    assert len(plan.tasks[0].resources) >= 1


def test_plan_tasks_have_phases():
    tasks = parse_advisor_text(
        "Research attention mechanisms. Implement a new attention variant. Run experiments."
    )
    plan = create_plan(tasks)
    phases = [t.phase for t in plan.tasks]
    assert any(p == TaskPhase.RESEARCH for p in phases)
    assert any(p == TaskPhase.IMPLEMENT for p in phases)
    assert any(p == TaskPhase.EXPERIMENT for p in phases)


def test_same_phase_tasks_depend_on_previous():
    tasks = [
        AdvisorTask(action="文献综述", keywords=["Transformer"]),
        AdvisorTask(action="调研", keywords=["Attention"]),
        AdvisorTask(action="了解", keywords=["NLP"]),
    ]
    plan = create_plan(tasks)
    research_tasks = [t for t in plan.tasks if t.phase == TaskPhase.RESEARCH]
    if len(research_tasks) >= 2:
        assert research_tasks[-1].depends_on


def test_plugin_has_required_methods():
    plugin = TermAdvisorPlugin()
    assert plugin.name == "term_advisor"
    assert plugin.display_name == "读懂导师"
    assert hasattr(plugin, "on_load")
    assert hasattr(plugin, "on_unload")
    assert hasattr(plugin, "get_routes")
