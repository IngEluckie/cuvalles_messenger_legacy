from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from routers.systemTools.tasks.purge import purgeDebugLog

# Scheduler instancia única que acompaña al ciclo de vida de FastAPI.
_scheduler = AsyncIOScheduler()
_PURGE_JOB_ID = "purge_debug_log_every_3_minutes"


def start_scheduler() -> None:
    """Arranca el scheduler y agenda la depuración cada 3 minutos."""
    if not _scheduler.get_job(_PURGE_JOB_ID):
        _scheduler.add_job(
            purgeDebugLog,
            trigger=IntervalTrigger(minutes=3),
            id=_PURGE_JOB_ID,
            replace_existing=True,
        )
    if not _scheduler.running:
        _scheduler.start()


def stop_scheduler() -> None:
    """Detiene el scheduler evitando bloquear el apagado de la app."""
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
