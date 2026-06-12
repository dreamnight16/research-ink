"""Lightweight async task scheduler with cron-like recurring jobs."""

import asyncio
import logging
import time
from collections.abc import Callable, Coroutine
from typing import Any

logger = logging.getLogger(__name__)

TaskFunc = Callable[[], Coroutine[Any, Any, None]]


class ScheduledTask:
    def __init__(self, name: str, func: TaskFunc, interval_seconds: int):
        self.name = name
        self._func = func
        self.interval = interval_seconds
        self.last_run: float = 0
        self.running = False
        self.error_count = 0

    async def execute(self) -> None:
        try:
            self.running = True
            await self._func()
            self.last_run = time.time()
            self.error_count = 0
        except Exception:
            self.error_count += 1
            logger.exception("Scheduled task %s failed (error #%d)", self.name, self.error_count)
        finally:
            self.running = False

    @property
    def due(self) -> bool:
        if self.running:
            return False
        if self.last_run == 0:
            return True  # Never run — due immediately
        return (time.time() - self.last_run) >= self.interval

    def status(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "interval": self.interval,
            "last_run": self.last_run,
            "running": self.running,
            "error_count": self.error_count,
        }


MAX_TASK_EXECUTION_SECONDS = 600
MAX_LOOP_RESTARTS = 3

class TaskScheduler:
    def __init__(self, tick_interval: float = 5.0):
        self._tasks: dict[str, ScheduledTask] = {}
        self._tick = tick_interval
        self._running = False
        self._loop_task: asyncio.Task | None = None
        self._active_tasks: set[asyncio.Task] = set()
        self._loop_restarts = 0

    def add(self, name: str, func: TaskFunc, interval_seconds: int) -> ScheduledTask:
        task = ScheduledTask(name, func, interval_seconds)
        self._tasks[name] = task
        return task

    def remove(self, name: str) -> None:
        self._tasks.pop(name, None)

    def get(self, name: str) -> ScheduledTask | None:
        return self._tasks.get(name)

    def list_tasks(self) -> list[dict[str, Any]]:
        return [t.status() for t in self._tasks.values()]

    async def start(self) -> None:
        self._running = True
        self._loop_restarts = 0
        self._loop_task = asyncio.create_task(self._loop())
        logger.info("Scheduler started with %d tasks", len(self._tasks))

    async def stop(self) -> None:
        self._running = False
        for t in list(self._active_tasks):
            t.cancel()
        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
        logger.info("Scheduler stopped")

    async def _loop(self) -> None:
        while self._running:
            try:
                for task in list(self._tasks.values()):
                    if task.due:
                        t = asyncio.create_task(
                            asyncio.wait_for(task.execute(), timeout=MAX_TASK_EXECUTION_SECONDS)
                        )
                        self._active_tasks.add(t)
                        t.add_done_callback(self._active_tasks.discard)
                await asyncio.sleep(self._tick)
            except asyncio.CancelledError:
                raise
            except Exception:
                self._loop_restarts += 1
                logger.exception(
                    "Scheduler loop crashed (restart %d/%d)",
                    self._loop_restarts, MAX_LOOP_RESTARTS,
                )
                if self._loop_restarts > MAX_LOOP_RESTARTS:
                    logger.critical("Scheduler loop exceeded max restarts, giving up")
                    self._running = False
                    return
                await asyncio.sleep(self._tick)

    async def run_once(self, name: str) -> bool:
        task = self._tasks.get(name)
        if not task:
            return False
        await asyncio.wait_for(task.execute(), timeout=MAX_TASK_EXECUTION_SECONDS)
        return True
