#!/usr/bin/env python3
"""Run the nightly MLB scorer for the applicable Owners Club week."""

import argparse
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path


SEASON_NUMBER = 32
SEASON_START = date(2026, 3, 30)
REGULAR_SEASON_WEEKS = 18
FINALIZATION_GRACE_DAYS = 7


def scheduled_week(run_date):
    if run_date < SEASON_START:
        return None
    week = ((run_date - SEASON_START).days // 7) + 1
    if week <= REGULAR_SEASON_WEEKS:
        return week
    season_end = SEASON_START + timedelta(days=REGULAR_SEASON_WEEKS * 7 - 1)
    if run_date <= season_end + timedelta(days=FINALIZATION_GRACE_DAYS):
        return REGULAR_SEASON_WEEKS
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", type=date.fromisoformat, default=date.today())
    parser.add_argument("--week", type=int)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    week = args.week or scheduled_week(args.date)
    if week is None:
        print(f"No Season {SEASON_NUMBER} scoring update is scheduled for {args.date}.")
        return
    if week not in (17, 18):
        print(f"Week {week} is outside the automated matchup catalog; skipping.")
        return

    start = SEASON_START + timedelta(days=(week - 1) * 7)
    command = [
        sys.executable,
        str(Path(__file__).with_name("sync_mlb_game_week.py")),
        "--season", str(SEASON_NUMBER),
        "--game", str(week),
        "--week", str(week),
        "--start", start.isoformat(),
    ]
    if args.dry_run:
        command.append("--dry-run")
    subprocess.run(command, check=True)


if __name__ == "__main__":
    main()
