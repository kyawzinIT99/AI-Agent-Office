import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from backend.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

scheduler = BackgroundScheduler()


def _scheduled_run():
    from backend.services.report_service import run_and_persist
    logger.info("Scheduled crew run starting...")
    run_and_persist()


def start_scheduler():
    scheduler.add_job(
        _scheduled_run,
        trigger=CronTrigger(hour=settings.scheduler_hour, minute=settings.scheduler_minute),
        id="daily_crew_run",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        f"Scheduler started — daily run at "
        f"{settings.scheduler_hour:02d}:{settings.scheduler_minute:02d} UTC"
    )


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
