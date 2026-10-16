"""Selenium + API checks for Logbug sheet gid=1486043016."""

from __future__ import annotations

import json
import os
import sys
import time
import traceback
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

BASE = os.environ.get("E2E_BASE", "http://localhost:3000")
API = os.environ.get("E2E_API", "http://localhost:3001/api")
ADMIN_EMAIL = "admin@northstar.vn"
ADMIN_PASSWORD = "Northstar1"
LEADER_EMAIL = "thanhbinh58058@gmail.com"
LEADER_PASSWORD = "acebinh123"


@dataclass
class CaseResult:
    bug_id: str
    title: str
    status: str
    detail: str


RESULTS: list[CaseResult] = []


def record(bug_id: str, title: str, status: str, detail: str = "") -> None:
    RESULTS.append(CaseResult(bug_id, title, status, detail))
    print(f"[{status}] {bug_id} — {title}" + (f" | {detail}" if detail else ""))


def make_driver() -> webdriver.Chrome:
    options = Options()
    options.add_argument("--window-size=1440,960")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    if os.environ.get("E2E_HEADLESS", "1") == "1":
        options.add_argument("--headless=new")
    chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    if Path(chrome).exists():
        options.binary_location = chrome
    return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)


def wait(driver, timeout=25):
    return WebDriverWait(driver, timeout)


def login(driver, email: str = ADMIN_EMAIL, password: str = ADMIN_PASSWORD):
    driver.delete_all_cookies()
    driver.get(f"{BASE}/")
    try:
        wait(driver, 40).until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='email']")))
    except TimeoutException:
        body = text(driver)[:300]
        raise TimeoutException(f"Login form missing. url={driver.current_url} body={body}")
    if "Northstar" not in text(driver) and "northstar" not in driver.page_source.lower():
        raise TimeoutException(f"Wrong app on {BASE}: expected Northstar Work")
    driver.find_element(By.CSS_SELECTOR, "input[type='email']").clear()
    driver.find_element(By.CSS_SELECTOR, "input[type='email']").send_keys(email)
    driver.find_element(By.CSS_SELECTOR, "input[type='password']").clear()
    driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys(password)
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    wait(driver, 40).until(EC.url_contains("/home"))


def api(driver, script, *args):
    return driver.execute_async_script(
        """
        const done = arguments[arguments.length - 1];
        const run = async () => { """
        + script
        + """ };
        run().then(done).catch(e => done({error: String(e)}));
        """,
        *args,
    )


def text(driver):
    return driver.find_element(By.TAG_NAME, "body").text


def test_invite_reject_and_bell(driver):
    # UI: invites section has Từ chối if any; bell opens
    driver.get(f"{BASE}/home")
    time.sleep(1.5)
    body = text(driver)
    bell = driver.find_elements(By.XPATH, "//button[contains(@aria-label,'Thông báo')]")
    if not bell:
        record("1", "Lời mời trong thông báo + Từ chối", "FAIL", "Không thấy bell")
        return
    bell[0].click()
    time.sleep(0.8)
    panel = text(driver)
    has_invite_ui = "Tham gia" in panel or "Từ chối" in panel or "Lời mời" in panel or "Thông báo" in panel
    # API reject endpoint exists (404/400 for fake id is ok if routed)
    result = api(
        driver,
        f"""
        const res = await fetch('{API}/workspaces/invitations/fake-id/reject', {{method:'POST', credentials:'include'}});
        return {{status: res.status}};
        """,
    )
    ok = has_invite_ui and result.get("status") in (400, 404)
    record("1", "Lời mời trong thông báo + Từ chối", "PASS" if ok else "FAIL", f"ui={has_invite_ui} rejectStatus={result}")


def test_task_start_and_create_chrome(driver):
    result = api(
        driver,
        f"""
        const api='{API}';
        const ws = await (await fetch(api+'/workspaces?page=1&pageSize=10',{{credentials:'include'}})).json();
        const w = (ws.items||[]).find(x=>x.status==='ACTIVE') || (ws.items||[])[0];
        let spaces = await (await fetch(api+'/workspaces/'+w.id+'/spaces',{{credentials:'include'}})).json();
        let s = (spaces.items||[]).find(x=>!x.archivedAt);
        if (!s) {{
          const created = await (await fetch(api+'/workspaces/'+w.id+'/spaces',{{
            method:'POST', credentials:'include', headers:{{'content-type':'application/json'}},
            body: JSON.stringify({{name:'S2 '+Date.now(), icon:'BOARD', color:'BLUE', accessType:'PUBLIC', memberIds:[], statuses:['Cần làm','Đang làm','Review','Hoàn thành'], views:['LIST','KANBAN']}})
          }})).json();
          s = {{id: created.id}};
        }}
        const detail = await (await fetch(api+'/workspaces/'+w.id+'/spaces/'+s.id,{{credentials:'include'}})).json();
        const listId = detail.lists?.[0]?.id;
        const statusId = detail.statuses?.[0]?.id;
        const reporterId = detail.members?.[0]?.userId;
        const dueAt = new Date(Date.now()+86400000).toISOString();
        const startAt = new Date(Date.now()+3600000).toISOString();
        const created = await fetch(api+'/workspaces/'+w.id+'/spaces/'+s.id+'/tasks', {{
          method:'POST', credentials:'include', headers:{{'content-type':'application/json'}},
          body: JSON.stringify({{listId, title:'S2 start '+Date.now(), statusId, priority:'MEDIUM', reporterId, dueAt, startAt, storyPoints:3}})
        }});
        const task = await created.json();
        await fetch(api+'/workspaces/'+w.id+'/spaces/'+s.id+'/tasks/'+task.id, {{method:'DELETE', credentials:'include'}});
        return {{status: created.status, startAt: task.startAt, storyPoints: task.storyPoints, id: task.id}};
        """,
    )
    ok = result.get("status") in (200, 201) and result.get("startAt") and result.get("storyPoints") == 3
    record("3/5", "Task startAt + storyPoints + create rules", "PASS" if ok else "FAIL", str(result))


def test_status_transitions(driver):
    result = api(
        driver,
        f"""
        const api='{API}';
        const ws = await (await fetch(api+'/workspaces?page=1&pageSize=10',{{credentials:'include'}})).json();
        const w = (ws.items||[]).find(x=>x.status==='ACTIVE') || (ws.items||[])[0];
        const spaceCreated = await (await fetch(api+'/workspaces/'+w.id+'/spaces',{{
          method:'POST', credentials:'include', headers:{{'content-type':'application/json'}},
          body: JSON.stringify({{name:'S2tr '+Date.now(), icon:'BOARD', color:'BLUE', accessType:'PUBLIC', memberIds:[], statuses:['Cần làm','Đang làm','Review','Hoàn thành'], views:['LIST']}})
        }})).json();
        const s={{id:spaceCreated.id}};
        const detail = await (await fetch(api+'/workspaces/'+w.id+'/spaces/'+s.id,{{credentials:'include'}})).json();
        const by = Object.fromEntries((detail.statuses||[]).map(st => [st.name, st.id]));
        const todo = by['Cần làm'];
        const doing = by['Đang làm'];
        const review = by['Review'];
        const done = by['Hoàn thành'];
        if (!todo || !doing || !review || !done) return {{error:'missing statuses', statuses: detail.statuses}};
        const listId = detail.lists?.[0]?.id;
        const reporterId = detail.members?.[0]?.userId;
        const dueAt = new Date(Date.now()+86400000).toISOString();
        const task = await (await fetch(api+'/workspaces/'+w.id+'/spaces/'+s.id+'/tasks', {{
          method:'POST', credentials:'include', headers:{{'content-type':'application/json'}},
          body: JSON.stringify({{listId, title:'S2 flow '+Date.now(), statusId: todo, priority:'LOW', reporterId, dueAt}})
        }})).json();
        const noAssignee = await fetch(api+'/workspaces/'+w.id+'/spaces/'+s.id+'/tasks/'+task.id, {{
          method:'PATCH', credentials:'include', headers:{{'content-type':'application/json'}},
          body: JSON.stringify({{statusId: doing}})
        }});
        await fetch(api+'/workspaces/'+w.id+'/spaces/'+s.id+'/tasks/'+task.id, {{
          method:'PATCH', credentials:'include', headers:{{'content-type':'application/json'}},
          body: JSON.stringify({{assigneeId: reporterId}})
        }});
        await fetch(api+'/workspaces/'+w.id+'/spaces/'+s.id+'/tasks/'+task.id, {{
          method:'PATCH', credentials:'include', headers:{{'content-type':'application/json'}},
          body: JSON.stringify({{statusId: doing}})
        }});
        const noAttach = await fetch(api+'/workspaces/'+w.id+'/spaces/'+s.id+'/tasks/'+task.id, {{
          method:'PATCH', credentials:'include', headers:{{'content-type':'application/json'}},
          body: JSON.stringify({{statusId: review}})
        }});
        const fd = new FormData(); fd.append('file', new Blob(['x'],{{type:'text/plain'}}), 'a.txt');
        await fetch(api+'/workspaces/'+w.id+'/spaces/'+s.id+'/tasks/'+task.id+'/attachments', {{method:'POST', credentials:'include', body: fd}});
        await fetch(api+'/workspaces/'+w.id+'/spaces/'+s.id+'/tasks/'+task.id, {{
          method:'PATCH', credentials:'include', headers:{{'content-type':'application/json'}},
          body: JSON.stringify({{statusId: review}})
        }});
        const noCheck = await fetch(api+'/workspaces/'+w.id+'/spaces/'+s.id+'/tasks/'+task.id, {{
          method:'PATCH', credentials:'include', headers:{{'content-type':'application/json'}},
          body: JSON.stringify({{statusId: done}})
        }});
        const check = await (await fetch(api+'/workspaces/'+w.id+'/spaces/'+s.id+'/tasks/'+task.id+'/checks', {{
          method:'POST', credentials:'include', headers:{{'content-type':'application/json'}},
          body: JSON.stringify({{title:'done item'}})
        }})).json();
        await fetch(api+'/workspaces/'+w.id+'/spaces/'+s.id+'/tasks/'+task.id+'/checks/'+check.id, {{
          method:'PATCH', credentials:'include', headers:{{'content-type':'application/json'}},
          body: JSON.stringify({{done:true}})
        }});
        const toDone = await fetch(api+'/workspaces/'+w.id+'/spaces/'+s.id+'/tasks/'+task.id, {{
          method:'PATCH', credentials:'include', headers:{{'content-type':'application/json'}},
          body: JSON.stringify({{statusId: done}})
        }});
        const finalTask = await toDone.json();
        await fetch(api+'/workspaces/'+w.id+'/spaces/'+s.id+'/tasks/'+task.id, {{method:'DELETE', credentials:'include'}});
        return {{
          noAssignee: noAssignee.status,
          noAttach: noAttach.status,
          noCheck: noCheck.status,
          done: toDone.status,
          completedAt: finalTask.completedAt || null
        }};
        """,
    )
    ok = (
        result.get("noAssignee", 0) >= 400
        and result.get("noAttach", 0) >= 400
        and result.get("noCheck", 0) >= 400
        and result.get("done") in (200, 201)
        and bool(result.get("completedAt"))
    )
    record("4", "Board ràng buộc chuyển trạng thái", "PASS" if ok else "FAIL", str(result))


def test_reports_export(driver):
    driver.get(f"{BASE}/reports")
    time.sleep(2.5)
    body = text(driver)
    has_export = "Xuất Excel" in body or "Xuất PDF" in body
    has_report = "Báo cáo" in body or "Tiến độ" in body or "Năng suất" in body
    record("7", "Báo cáo charts + export", "PASS" if has_report and has_export else "FAIL", f"export={has_export} report={has_report}")


def test_leader_board_list_projects(driver):
    login(driver, LEADER_EMAIL, LEADER_PASSWORD)
    driver.get(f"{BASE}/home?tab=board")
    time.sleep(2.5)
    body = text(driver)
    has_search = bool(
        driver.find_elements(
            By.CSS_SELECTOR,
            "input[placeholder*='ìm'], input[placeholder*='task'], input[placeholder*='Task'], input[type='search']",
        )
    )
    has_filter = "Người thực hiện" in body or "Ưu tiên" in body or "Lọc" in body
    record("4/6", "Board/List filter+search UI", "PASS" if (has_search or has_filter) else "FAIL", f"search={has_search} filter={has_filter}")

    driver.get(f"{BASE}/home?tab=projects")
    time.sleep(2.5)
    body = text(driver)
    ok_projects = "Dự án" in body or "Space" in body or "List" in body or "Sprint" in body
    record("2", "Dự án list screen", "PASS" if ok_projects else "FAIL", body[:120].replace("\n", " "))

    driver.get(f"{BASE}/home?tab=backlog")
    time.sleep(2)
    body = text(driver)
    ok_backlog = "Backlog" in body or "Story" in body or "Thêm công việc" in body or "Ưu tiên" in body
    record("6", "Backlog UI", "PASS" if ok_backlog else "FAIL", body[:100].replace("\n", " "))


def test_workspace_actions(driver):
    login(driver)  # admin
    driver.get(f"{BASE}/workspaces")
    time.sleep(1.5)
    links = driver.find_elements(By.CSS_SELECTOR, "a[href^='/workspaces/']")
    links = [el for el in links if el.get_attribute("href") and el.get_attribute("href").count("/") >= 4]
    if links:
        driver.execute_script("arguments[0].click();", links[0])
        time.sleep(1.8)
        body = text(driver)
        has_archive = "Lưu trữ" in body or "Tạo Space" in body or "Space" in body or "Cấu trúc" in body
        record("ws", "Workspace detail", "PASS" if has_archive else "FAIL", body[:100].replace("\n", " "))
    else:
        record("ws", "Workspace detail", "SKIP", "no workspace link")


def main() -> int:
    print(f"Sheet2 E2E base={BASE}")
    driver = make_driver()
    try:
        login(driver)
        for fn in [
            test_invite_reject_and_bell,
            test_task_start_and_create_chrome,
            test_status_transitions,
            test_reports_export,
            test_leader_board_list_projects,
            test_workspace_actions,
        ]:
            try:
                fn(driver)
            except Exception as exc:
                record(fn.__name__, "EXCEPTION", "FAIL", f"{exc}\n{traceback.format_exc()[-400:]}")
    finally:
        driver.quit()

    out = Path(__file__).resolve().parent
    summary = {
        "pass": sum(1 for r in RESULTS if r.status == "PASS"),
        "fail": sum(1 for r in RESULTS if r.status == "FAIL"),
        "skip": sum(1 for r in RESULTS if r.status == "SKIP"),
        "total": len(RESULTS),
    }
    report = {"ranAt": datetime.now(timezone.utc).isoformat(), "summary": summary, "results": [asdict(r) for r in RESULTS]}
    (out / "report-sheet2.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = ["# Sheet2 Selenium Report", "", f"PASS {summary['pass']} / FAIL {summary['fail']} / SKIP {summary['skip']}", ""]
    for r in RESULTS:
        lines.append(f"- **{r.status}** `{r.bug_id}` {r.title}: {(r.detail or '')[:160]}")
    (out / "report-sheet2.md").write_text("\n".join(lines) + "\n", encoding="utf-8-sig")
    print(json.dumps(summary, ensure_ascii=False))
    return 0 if summary["fail"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
