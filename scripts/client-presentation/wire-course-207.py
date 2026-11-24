"""Wire the new ScholarClone customer presentation into My Learning for tenant 6 on db3 (the 'live' host).

  python -I scripts/client-presentation/wire-course-207.py            -> DRY RUN: checks every precondition, prints the plan, writes nothing
  python -I scripts/client-presentation/wire-course-207.py --execute  -> backs up first, then one transaction, verified before COMMIT
  python -I scripts/client-presentation/wire-course-207.py --rollback <backup.json>  -> undoes exactly what --execute recorded

Owner's explicit go (2026-11-23): course 207 is theirs; add 2 link lessons to chapter 237; make the course visible; enrol the active
tenant-6 users (the same people who hold the two old Sales cards). Nothing else is touched; the old cards stay as they are.
Credentials come from the hp_erp .env (DB3_*) at run time and are never printed. Writes only to: sub_std_map (id 207), content_master
(2 new rows), lms_course_enroll (new rows). Rows are soft-deleted on rollback, never hard-deleted.
"""
import json
import re
import sys
import time
from pathlib import Path

import pymysql

ENV = Path(r"C:\Users\MILAN\Downloads\hp_erp\.env")
BACKUP_DIR = Path(r"D:\client-presentation-assets\backup")
TENANT, COURSE, CHAPTER, CREATOR = 6, 207, 237, 28
BASE = "https://g2gv0.vercel.app/module/lms/learning/client-presentation/scholarclone"
LESSONS = [
    ("Full presentation",
     "Opens the ScholarClone customer presentation in its own full-screen tab. Arrow keys move through it, P opens the presenter notes, F goes full screen.",
     BASE, 1),
    ("Five-slide version",
     "The short version for a first meeting: five slides, same look. Press M inside the presentation to switch between the short and the full version.",
     BASE + "?mode=short", 2),
]


def env():
    d = {}
    for ln in ENV.read_text(encoding="utf-8", errors="replace").splitlines():
        m = re.match(r"^\s*(DB3_[A-Z]+)\s*=\s*(.*)$", ln)
        if m:
            v = m.group(2).strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                v = v[1:-1]
            d[m.group(1)] = v
    return d


def connect():
    e = env()
    con = pymysql.connect(host=e["DB3_HOST"], port=int(e.get("DB3_PORT", "3306") or 3306), user=e["DB3_USERNAME"], password=e["DB3_PASSWORD"],
                          database=e["DB3_DATABASE"], connect_timeout=15, read_timeout=60, charset="utf8mb4", autocommit=False,
                          cursorclass=pymysql.cursors.DictCursor)
    return con, f"{e['DB3_HOST']}/{e['DB3_DATABASE']}"


def rows(cur, sql, args=()):
    cur.execute(sql, args)
    return list(cur.fetchall())


def jsonable(o):
    return json.loads(json.dumps(o, default=str))


def preconditions(cur):
    """Returns (problems, context). Any problem blocks the write."""
    problems = []
    c = rows(cur, "SELECT id, display_name, status, sub_institute_id, standard_id, deleted_at FROM sub_std_map WHERE id=%s", (COURSE,))
    if len(c) != 1 or c[0]["sub_institute_id"] != TENANT or c[0]["deleted_at"] is not None:
        problems.append("course 207 is not a live tenant-6 course")
    elif c[0]["status"] != 0:
        problems.append(f"course 207 status is {c[0]['status']}, expected 0 (hidden draft): someone changed it")
    ch = rows(cur, "SELECT id, subject_id, standard_id, sub_institute_id, deleted_at FROM chapter_master WHERE id=%s", (CHAPTER,))
    if len(ch) != 1 or ch[0]["subject_id"] != COURSE or ch[0]["sub_institute_id"] != TENANT or ch[0]["deleted_at"] is not None:
        problems.append("chapter 237 is not the live chapter of course 207")
    n = rows(cur, "SELECT COUNT(*) AS n FROM content_master WHERE subject_id=%s AND deleted_at IS NULL", (COURSE,))[0]["n"]
    if n:
        problems.append(f"course 207 already has {n} lesson(s): refusing to add more")
    e = rows(cur, "SELECT COUNT(*) AS n FROM lms_course_enroll WHERE course_id=%s AND deleted_at IS NULL", (COURSE,))[0]["n"]
    if e:
        problems.append(f"course 207 already has {e} enrolment(s): refusing to add more")
    active = {r["id"] for r in rows(cur, "SELECT id FROM tbluser WHERE sub_institute_id=%s AND deleted_at IS NULL AND status=1", (TENANT,))}
    old = {r["user_id"] for r in rows(cur, "SELECT user_id FROM lms_course_enroll WHERE course_id IN (205,206) AND sub_institute_id=%s AND deleted_at IS NULL", (TENANT,))}
    if active != old:
        problems.append(f"the active tenant-6 users ({len(active)}) are not the same people as the two old cards' learners ({len(old)}): "
                        f"only-active={sorted(active - old)} only-old-cards={sorted(old - active)}")
    return problems, {"course": c[0] if c else None, "chapter": ch[0] if ch else None, "users": sorted(active)}


def main():
    execute = "--execute" in sys.argv
    if "--rollback" in sys.argv:
        return rollback(Path(sys.argv[sys.argv.index("--rollback") + 1]))
    con, host = connect()
    cur = con.cursor()
    print("host:", host)
    problems, ctx = preconditions(cur)
    print("active tenant-6 users to enrol:", len(ctx["users"]))
    for p in problems:
        print("BLOCKED:", p)
    if problems:
        con.rollback(); con.close(); return 1
    print("preconditions: all pass")
    print("plan: INSERT 2 lessons into chapter 237:", ", ".join(f"'{t}' -> {u}" for t, _, u, _ in LESSONS))
    print("plan: UPDATE sub_std_map id 207 status 0 -> 1")
    print(f"plan: INSERT {len(ctx['users'])} lms_course_enroll rows (status 'enrolled') for course 207")
    if not execute:
        print("DRY RUN: nothing written. Re-run with --execute to apply.")
        con.rollback(); con.close(); return 0

    # Backup first (the rows that exist now, plus the ids we are about to create are added after).
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d_%H%M%S")
    bpath = BACKUP_DIR / f"db3-course207-{stamp}.json"
    backup = {"host": host, "stamp": stamp, "course_before": jsonable(rows(cur, "SELECT * FROM sub_std_map WHERE id=%s", (COURSE,))),
              "chapter_before": jsonable(rows(cur, "SELECT * FROM chapter_master WHERE id=%s", (CHAPTER,))), "users": ctx["users"],
              "inserted_lessons": [], "inserted_enrolments": []}
    bpath.write_text(json.dumps(backup, indent=1), encoding="utf-8")
    print("backup written:", bpath)

    try:
        std = ctx["chapter"]["standard_id"]
        for title, desc, url, order in LESSONS:
            cur.execute(
                "INSERT INTO content_master (standard_id, subject_id, chapter_id, title, description, file_type, url, sort_order, show_hide, content_category, sub_institute_id, created_by, created_at, updated_at) "
                "VALUES (%s,%s,%s,%s,%s,'link',%s,%s,1,'Interactive deck',%s,%s,NOW(),NOW())",
                (std, COURSE, CHAPTER, title, desc, url, order, TENANT, CREATOR))
            backup["inserted_lessons"].append(cur.lastrowid)
        cur.execute("UPDATE sub_std_map SET status=1, updated_at=NOW() WHERE id=%s AND sub_institute_id=%s AND status=0", (COURSE, TENANT))
        if cur.rowcount != 1:
            raise RuntimeError(f"course status update touched {cur.rowcount} rows, expected 1")
        for uid in ctx["users"]:
            cur.execute("INSERT INTO lms_course_enroll (sub_institute_id, user_id, course_id, status, start_date, created_at, updated_at) VALUES (%s,%s,%s,'enrolled',CURDATE(),NOW(),NOW())",
                        (TENANT, uid, COURSE))
            backup["inserted_enrolments"].append(cur.lastrowid)
        # Verify inside the transaction before committing.
        nl = rows(cur, "SELECT COUNT(*) AS n FROM content_master WHERE subject_id=%s AND chapter_id=%s AND deleted_at IS NULL AND file_type='link'", (COURSE, CHAPTER))[0]["n"]
        ne = rows(cur, "SELECT COUNT(*) AS n FROM lms_course_enroll WHERE course_id=%s AND deleted_at IS NULL", (COURSE,))[0]["n"]
        st = rows(cur, "SELECT status FROM sub_std_map WHERE id=%s", (COURSE,))[0]["status"]
        if (nl, ne, st) != (len(LESSONS), len(ctx["users"]), 1):
            raise RuntimeError(f"verification failed: lessons={nl} enrolments={ne} status={st}")
        bpath.write_text(json.dumps(backup, indent=1), encoding="utf-8")
        con.commit()
        print("COMMITTED. lessons", backup["inserted_lessons"], "| enrolments", len(backup["inserted_enrolments"]), "| status 1")
    except Exception as ex:  # noqa: BLE001 - any failure rolls the whole transaction back
        con.rollback()
        print("ROLLED BACK, nothing was changed:", ex)
        con.close(); return 1

    # Read back with a fresh connection.
    con.close()
    con2, _ = connect()
    c2 = con2.cursor()
    print("read-back:", jsonable(rows(c2, "SELECT id, display_name, status FROM sub_std_map WHERE id=%s", (COURSE,))))
    print("read-back:", jsonable(rows(c2, "SELECT id, title, file_type, content_category, sort_order, url FROM content_master WHERE subject_id=%s AND deleted_at IS NULL ORDER BY sort_order", (COURSE,))))
    print("read-back enrolled users:", rows(c2, "SELECT COUNT(*) AS n FROM lms_course_enroll WHERE course_id=%s AND deleted_at IS NULL", (COURSE,))[0]["n"])
    con2.rollback(); con2.close()
    print("To undo: python -I scripts/client-presentation/wire-course-207.py --rollback", bpath)
    return 0


def rollback(path):
    b = json.loads(path.read_text(encoding="utf-8"))
    con, host = connect()
    cur = con.cursor()
    try:
        for i in b["inserted_lessons"]:
            cur.execute("UPDATE content_master SET deleted_at=NOW() WHERE id=%s AND subject_id=%s AND deleted_at IS NULL", (i, COURSE))
        for i in b["inserted_enrolments"]:
            cur.execute("UPDATE lms_course_enroll SET deleted_at=NOW() WHERE id=%s AND course_id=%s AND deleted_at IS NULL", (i, COURSE))
        before = b["course_before"][0]
        cur.execute("UPDATE sub_std_map SET status=%s, updated_at=%s WHERE id=%s", (before["status"], before["updated_at"], COURSE))
        con.commit()
        print("rolled back on", host, ": lessons and enrolments soft-deleted, course 207 status restored to", before["status"])
    except Exception as ex:  # noqa: BLE001
        con.rollback(); print("rollback failed, nothing changed:", ex); return 1
    finally:
        con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
