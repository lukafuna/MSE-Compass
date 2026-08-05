"""Run a single scrape/analysis job and exit -- for triggering from an
external scheduler (e.g. a GitHub Actions cron workflow) instead of keeping
backend.scheduler's BlockingScheduler process alive 24/7.

Usage:
    python -m backend.run_scheduled_job --job daily
    python -m backend.run_scheduled_job --job bonds
"""

import argparse
import logging

from backend.scheduler import bonds_job, daily_job

JOBS = {"daily": daily_job, "bonds": bonds_job}


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--job", choices=sorted(JOBS), required=True)
    args = parser.parse_args()

    JOBS[args.job]()


if __name__ == "__main__":
    main()
