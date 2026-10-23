"""
FELEMAYE · trade job poller (runs on the studio PC only)

The Studio Console's "Run trade bot" button only inserts a row in public.trade_jobs.
This poller claims queued jobs and hands each one to your existing Playwright trade
script, which reads EIN / CDTFA permit / NY Certificate of Authority files from the
local credentials folder. Nothing sensitive leaves this machine.

Hard rules (enforced by the contract below, not optional):
  • Never solves or bypasses a CAPTCHA, bot check or 2FA. The script must stop and
    report {"status": "needs_review", "note": "..."}; you finish that step by hand.
  • Never submits on its own unless your script is already set to stop at the final
    "Submit" for your approval.

Setup (PC):
  pip install requests python-dotenv
  .env next to this file (never commit it):
      SUPABASE_URL=https://afejhlfwymwagstyfnse.supabase.co
      SUPABASE_SERVICE_KEY=...            # service role, PC only
      TRADE_BOT_CMD=python trade_apply.py # your Playwright script
  python trade_job_poller.py              # Ctrl+C to stop

"assist" jobs (2026-10-23d, the console's "Prefill on my PC"): the poller downloads the shared answers library,
then runs TRADE_ASSIST_CMD (default: python trade_assist.py) which opens the form in a visible browser, filled in,
and waits while you review and submit it yourself. One form at a time.

Script contract: it is called as  TRADE_BOT_CMD --job <id> --vendor <vendor_id> --kind <apply|discover|status_check>
and prints ONE JSON line on stdout as its last line:
  {"status": "done" | "needs_review" | "failed", "note": "short human text", ...anything else}
"""
import json, os, shlex, socket, subprocess, sys, time
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv

load_dotenv()
URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
CMD = os.environ.get("TRADE_BOT_CMD", "python trade_apply.py")
ASSIST = os.environ.get("TRADE_ASSIST_CMD", "python trade_assist.py")
POLL = int(os.environ.get("TRADE_POLL_SECONDS", "30"))
WORKER = "pc:" + socket.gethostname()
H = {"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json"}


def now():
    return datetime.now(timezone.utc).isoformat()


def claim():
    r = requests.post(f"{URL}/rest/v1/rpc/claim_trade_job", headers=H, json={"p_worker": WORKER}, timeout=30)
    r.raise_for_status()
    rows = r.json()
    return rows[0] if rows else None


def patch(job_id, body):
    r = requests.patch(f"{URL}/rest/v1/trade_jobs?id=eq.{job_id}", headers=H, json=body, timeout=30)
    r.raise_for_status()


def answers_file():
    r = requests.get(f"{URL}/rest/v1/trade_form_answers?select=field_key,label,answer,match_terms,sensitive", headers=H, timeout=30)
    r.raise_for_status()
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".trade_answers.json")
    json.dump(r.json(), open(path, "w", encoding="utf-8"))
    return path


def run(job):
    patch(job["id"], {"status": "running"})
    if job["kind"] == "assist":
        url = (job.get("payload") or {}).get("url") or ""
        args = shlex.split(ASSIST) + ["--job", job["id"], "--vendor", job["vendor_id"] or "", "--url", url, "--answers", answers_file()]
    else:
        args = shlex.split(CMD) + ["--job", job["id"], "--vendor", job["vendor_id"] or "", "--kind", job["kind"]]
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=25 * 60)
        last = (p.stdout.strip().splitlines() or ["{}"])[-1]
        res = json.loads(last) if last.startswith("{") else {"status": "failed", "note": last[:300]}
    except subprocess.TimeoutExpired:
        res = {"status": "needs_review", "note": "Timed out after 20 min — check the browser window."}
    except Exception as e:  # noqa: BLE001
        res = {"status": "failed", "note": str(e)[:300]}
    status = res.get("status") if res.get("status") in ("done", "needs_review", "failed") else "needs_review"
    patch(job["id"], {"status": status, "result": res, "error": res.get("note") if status == "failed" else None, "finished_at": now()})
    print(f"[{now()}] {job['kind']} {job['vendor_id']} → {status}: {res.get('note', '')}")


def main():
    print(f"Polling trade_jobs every {POLL}s as {WORKER}. Ctrl+C to stop.")
    while True:
        try:
            job = claim()
            if job:
                run(job)
                continue
        except requests.RequestException as e:
            print("network:", e, file=sys.stderr)
        time.sleep(POLL)


if __name__ == "__main__":
    main()
