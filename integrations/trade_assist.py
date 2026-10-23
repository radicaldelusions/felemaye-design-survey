"""
FELEMAYE · trade_assist.py — opens one vendor trade application on this PC, filled in, for you to review and submit.

Called by trade_job_poller.py for jobs of kind "assist" (the console's "Prefill on my PC" button):
    python trade_assist.py --job <id> --vendor <vendor_id> --url <form url> --answers <answers.json>

What it does
  1. Opens a visible Chromium window (a persistent profile in ./.trade_browser, so sites you've logged into stay
     logged in) at the vendor's trade form.
  2. Fills every field it can match by label / name / placeholder, from two sources:
       • answers.json     — the shared answers library from the console (company, website, business type…)
       • credentials/trade_profile.json on this PC — EIN, seller's permit no., phone, street, ZIP, and file paths
         for the resale certificate / EIN letter. These values never leave this machine.
  3. Outlines anything still empty and required in yellow, shows a banner with the count, and waits.
  4. You review, adjust, tick any CAPTCHA, and press the site's Submit button yourself. Close the tab when done.
It never presses Submit, never touches a CAPTCHA, and never accepts terms on your behalf.

Prints one JSON line at the end for the poller:
  {"status": "needs_review", "note": "...", "filled": 14, "missing": ["Showroom preference"], "url": "..."}

Setup (PC):  pip install playwright && python -m playwright install chromium
credentials/trade_profile.json example (keep it out of any cloud folder):
  {"ein": "..", "seller_permit": "..", "phone": "..", "street": "..", "zip": "..",
   "files": {"resale_cert": "C:/Users/felem/credentials/CDTFA-230.pdf", "ein_letter": "C:/Users/felem/credentials/CP575.pdf"}}
"""
import argparse, json, os, re, sys, time

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
PROFILE = os.environ.get("TRADE_PROFILE", os.path.join(HERE, "credentials", "trade_profile.json"))
FILE_TERMS = {"resale_cert": ["resale", "tax exempt", "exemption", "certificate", "seller"], "ein_letter": ["ein", "w-9", "w9", "tax id", "irs"]}


def norm(s):
    return re.sub(r"[^a-z0-9 ]+", " ", (s or "").lower()).strip()


def load_answers(path):
    rows = json.load(open(path, encoding="utf-8")) if path and os.path.exists(path) else []
    local = json.load(open(PROFILE, encoding="utf-8")) if os.path.exists(PROFILE) else {}
    out = []
    for r in rows:
        val = local.get(r["field_key"]) if r.get("sensitive") else r.get("answer")
        if val:
            out.append({"key": r["field_key"], "terms": [norm(t) for t in (r.get("match_terms") or [])] + [norm(r.get("label"))], "value": str(val)})
    return out, local.get("files", {})


DESCRIBE = """el => {
  const lab = el.labels && el.labels[0] ? el.labels[0].innerText : '';
  const aria = el.getAttribute('aria-label') || '';
  const by = el.getAttribute('aria-labelledby'); const byTxt = by ? (document.getElementById(by)||{}).innerText || '' : '';
  const wrap = el.closest('label, .field, .form-group, .form-field, li, div');
  const near = wrap ? (wrap.innerText || '').slice(0, 120) : '';
  return {tag: el.tagName.toLowerCase(), type: (el.type||'').toLowerCase(), name: el.name||'', id: el.id||'',
          ph: el.placeholder||'', label: lab || aria || byTxt || near, required: el.required || el.getAttribute('aria-required')==='true',
          value: el.value||'', visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)};
}"""


def best(answers, d):
    hay = " ".join(norm(x) for x in (d["label"], d["name"], d["id"], d["ph"]))
    hit, score = None, 0
    for a in answers:
        for t in a["terms"]:
            if t and t in hay and len(t) > score:
                hit, score = a, len(t)
    return hit


def run(url, answers, files):
    filled, missing = 0, []
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(os.path.join(HERE, ".trade_browser"), headless=False, viewport={"width": 1280, "height": 900})
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(2500)
        for el in page.query_selector_all("input, select, textarea"):
            try:
                d = el.evaluate(DESCRIBE)
            except Exception:
                continue
            if not d["visible"] or d["type"] in ("hidden", "submit", "button", "image", "reset", "password", "search"):
                continue
            if d["type"] == "file":
                hay = norm(d["label"] + " " + d["name"])
                for k, terms in FILE_TERMS.items():
                    if files.get(k) and os.path.exists(files[k]) and any(t in hay for t in terms):
                        el.set_input_files(files[k]); filled += 1; break
                else:
                    if d["required"]: missing.append(d["label"].strip()[:60] or d["name"])
                continue
            if d["type"] in ("checkbox", "radio"):
                if d["required"]: missing.append((d["label"].strip() or d["name"])[:60])   # terms, consent: yours to tick
                continue
            if d["value"]:
                continue
            a = best(answers, d)
            if not a:
                if d["required"]: missing.append((d["label"].strip() or d["name"] or d["ph"])[:60])
                continue
            try:
                if d["tag"] == "select":
                    opts = el.evaluate("s => Array.from(s.options).map(o => [o.value, o.text])")
                    want = norm(a["value"])
                    pick = next((v for v, t in opts if norm(t) == want), None) or next((v for v, t in opts if want and (want in norm(t) or norm(t) in want) and norm(t)), None)
                    if pick is None:
                        missing.append((d["label"].strip() or d["name"])[:60]); continue
                    el.select_option(pick)
                else:
                    el.fill(a["value"])
                filled += 1
            except Exception:
                missing.append((d["label"].strip() or d["name"])[:60])
        page.evaluate("""m => {
          document.querySelectorAll('input,select,textarea').forEach(e => { if ((e.required || e.getAttribute('aria-required')==='true') && !e.value) e.style.outline = '3px solid #F2C14E' });
          const b = document.createElement('div'); b.textContent = m;
          b.style.cssText = 'position:fixed;z-index:2147483647;left:12px;right:12px;top:12px;padding:12px 16px;background:#1F1E1B;color:#F4EFE4;font:14px/1.5 system-ui;box-shadow:0 8px 24px rgba(0,0,0,.3)';
          document.body.appendChild(b); setTimeout(() => b.remove(), 15000);
        }""", f"FELEMAYE prefill: {filled} fields filled, {len(missing)} left (outlined). Review, adjust, and press Submit yourself. Close this tab when done.")
        try:
            page.wait_for_event("close", timeout=20 * 60 * 1000)
        except Exception:
            pass
        ctx.close()
    return filled, [m for m in dict.fromkeys(missing) if m]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--job"); ap.add_argument("--vendor"); ap.add_argument("--url", required=True); ap.add_argument("--answers")
    a = ap.parse_args()
    try:
        answers, files = load_answers(a.answers)
        filled, missing = run(a.url, answers, files)
        print(json.dumps({"status": "needs_review", "note": f"Prefilled {filled}; {len(missing)} left for you" + (": " + ", ".join(missing[:6]) if missing else ""), "filled": filled, "missing": missing, "url": a.url}))
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"status": "failed", "note": str(e)[:300], "url": a.url}))
        sys.exit(0)
