/* ==========================================================================
   RACM 303 (ปีการศึกษา 2569) — Student Portal Controller
   Google Calendar & Apple iCal Views · Per-Group & Per-Student Fieldwork Sync
   One-Time (.ics / .csv) Downloads & Live Hosted Subscribe (.ics / webcal://)
   ========================================================================== */
(function () {
  "use strict";

  const ROLE = "faculty";
  const PORTAL_BASE_URL = "https://smartwoo.github.io/racm303-2569-faculty";
  const RAMED_COURSE_URL = "https://elearning.ra.mahidol.ac.th/ramed/course/view.php?id=398";
  const RAMED_ASSIGN_INDEX_URL = "https://elearning.ra.mahidol.ac.th/ramed/mod/assign/index.php?id=398";
  const RAMED_LOGIN_URL = "https://elearning.ra.mahidol.ac.th/ramed/login/index.php";
  const RAMED_BASE_PREFIX = "https://elearning.ra.mahidol.ac.th/ramed/";
  const GOOGLE_FORM_URL = "https://forms.gle/1Gsg2SmSfuuEwmcE9";
  const SCHED = window.RACM_SCHEDULE_DATA || {};
  const ROSTER = window.RACM_ROSTER_DATA || { students: [], courseTeachers: [] };
  const MANUAL = window.RACM_MANUAL_DATA || { chapters: [] };
  const HS = window.RACM_HS_DATA || { docs: [], rapidReview: [], glossary: [], selfCheck: [] };
  const FACULTY = window.RACM_FACULTY_DATA || { docs: [], links: [] };

  const $ = (id) => document.getElementById(id);
  const compareTH = (a, b) => String(a || "").localeCompare(String(b || ""), "th", { numeric: true });

  const WEEK_BOUNDS = [
    { week: 1, start: "2026-11-23", end: "2026-11-29", label: "สัปดาห์ที่ 1 · 23–29 พ.ย. 2569 (เปิดรายวิชา · HS1 · EP1–3)" },
    { week: 2, start: "2026-11-30", end: "2026-12-06", label: "สัปดาห์ที่ 2 · 30 พ.ย. – 6 ธ.ค. 2569 (HS2–HS6 · EP4–9)" },
    { week: 3, start: "2026-12-07", end: "2026-12-13", label: "สัปดาห์ที่ 3 · 7–13 ธ.ค. 2569 (สอบ EP · เดินทางสู่ภาคสนามตามกลุ่ม)" },
    { week: 4, start: "2026-12-14", end: "2026-12-20", label: "สัปดาห์ที่ 4 · 14–20 ธ.ค. 2569 (ฝึกปฏิบัติงานภาคสนาม 9 พื้นที่)" },
    { week: 5, start: "2026-12-21", end: "2026-12-27", label: "สัปดาห์ที่ 5 · 21–27 ธ.ค. 2569 (สอบ HS · สังเคราะห์ข้อมูลภาคสนาม)" },
    { week: 6, start: "2026-12-28", end: "2027-01-03", label: "สัปดาห์ที่ 6 · 28 ธ.ค. 2569 – 3 ม.ค. 2570 (นำเสนอภาคสนาม & ปิดรายวิชา)" }
  ];

  const TH_MONTHS_SHORT = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const TH_DOW_SHORT = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];
  const TH_DOW_FULL = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];

  const CAT_NAMES = {
    HS: "วิทยาศาสตร์ระบบสุขภาพ (HS)",
    EP: "ระบาดวิทยาคลินิกและชุมชน (EP)",
    SG: "กลุ่มย่อย & ภาคสนาม",
    PANEL: "เสวนา / ปฏิบัติการเชิงระบบ",
    EXAM: "การสอบ & กำหนดส่งงาน",
    HOLIDAY: "วันหยุดราชการ",
    STAFF: "เตรียมความพร้อมภาควิชาฯ"
  };

  const state = {
    activeTab: "schedule",
    schedSub: "month", // month | week | daily | spec
    calScope: "student", // student | group | teacher | all
    calWeek: 1,
    practiceSub: "rapid",
    facultySub: "guides",
    myStudent: null,
    discContext: null,
    fieldContext: null,
    showPhotos: true,
    calSideTab: "milestones",
    showCalSidebar: true,
    showSitesOverview: true,
    showZoomDrawer: false,
    visibleDiscStudents: [],
    visibleFieldStudents: [],
    submittedMap: JSON.parse(localStorage.getItem("racm303_submitted_map") || "{}"),
    pinnedRamedUrl: localStorage.getItem("racm303_moodle_course_url") || "",
    ramedPinged: false,
    inspectedPdfBytes: null,
    inspectedPdfOrigName: "",
    manualChapterId: "ALL",
    activeDocId: "HS1",
    activeFacultyDocId: "hs1-tg",
    readerFontPx: Number(localStorage.getItem("racm303_font_px")) || 16.5,
    readerViewMode: "scroll", // scroll | deck | sorter
    sorterZoomPct: Number(localStorage.getItem("racm303_sorter_zoom")) || 100,
    canvasZoomPct: Number(localStorage.getItem("racm303_canvas_zoom")) || 100,
    masteredCards: new Set(JSON.parse(localStorage.getItem("racm303_mastered_fc") || "[]")),
    fcShuffleSeed: null
  };

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function make(tag, text, cls) {
    const el = document.createElement(tag);
    if (text !== undefined && text !== null) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }

  function getSiteIdByAreaName(areaName) {
    const found = (SCHED.fieldworkSites || []).find((x) => x.shortName === areaName);
    return found ? found.id : 1;
  }

  /* ---------- Date & Time Helpers ---------- */
  function parseISODate(iso) {
    const [y, m, d] = String(iso).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  function formatISODate(dt) {
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function addDaysISO(iso, delta) {
    const dt = parseISODate(iso);
    dt.setUTCDate(dt.getUTCDate() + delta);
    return formatISODate(dt);
  }

  function formatThaiShortDate(iso, forceMonth) {
    const [y, m, d] = String(iso).split("-").map(Number);
    if (forceMonth || d === 1 || (m === 11 && d === 25)) {
      return `${d} ${TH_MONTHS_SHORT[m]}${y === 2027 ? " 70" : ""}`;
    }
    return String(d);
  }

  function timeToMinutes(hhmm) {
    const [h, m] = String(hhmm || "09:00").split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  function to12HourAmPm(hhmm) {
    const [hRaw, mRaw] = String(hhmm || "09:00").split(":").map(Number);
    const h = Number.isFinite(hRaw) ? hRaw : 9;
    const m = Number.isFinite(mRaw) ? mRaw : 0;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  function isoToUsDate(iso) {
    const [y, m, d] = String(iso).split("-");
    return `${m}/${d}/${y}`;
  }

  function copyTextWithFeedback(text, btn, doneLabel = "คัดลอกแล้ว ✓") {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      if (!btn) return;
      const prev = btn.textContent;
      btn.textContent = doneLabel;
      setTimeout(() => {
        btn.textContent = prev;
      }, 1500);
    });
  }

  /* ---------- Synced Apps Script Portrait Loader ---------- */
  function studentInitials(s) {
    const parts = String(s.name || "").trim().split(/\s+/);
    const a = parts[0] ? [...parts[0]][0] : "น";
    const b = parts[1] ? [...parts[1]][0] : "";
    return (a + b).toUpperCase();
  }

  const photoObserver = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          photoObserver.unobserve(entry.target);
          mountStudentPhoto(entry.target);
        });
      }, { rootMargin: "220px" })
    : null;

  function mountStudentPhoto(box) {
    const sid = box.dataset.studentId || "";
    const pid = box.dataset.photoId || "";
    const initials = box.dataset.initials || "นศ";
    if (!sid && !pid) {
      box.innerHTML = `<span class="avatar-monogram">${escapeHtml(initials)}</span>`;
      return;
    }
    const img = document.createElement("img");
    img.alt = box.dataset.studentName || "รูปนักศึกษา";
    img.loading = "lazy";
    img.decoding = "async";
    if (sid) {
      img.src = `assets/photos/${encodeURIComponent(sid)}.jpg`;
      img.onerror = () => {
        if (pid && !img.dataset.triedDrive) {
          img.dataset.triedDrive = "1";
          img.referrerPolicy = "no-referrer";
          img.src = `https://drive.google.com/thumbnail?id=${encodeURIComponent(pid)}&sz=w320`;
          return;
        }
        box.innerHTML = `<span class="avatar-monogram" title="เปิดดูรูปใน Apps Script ได้จากปุ่มด้านบน">${escapeHtml(initials)}</span>`;
      };
    } else {
      img.referrerPolicy = "no-referrer";
      img.src = `https://drive.google.com/thumbnail?id=${encodeURIComponent(pid)}&sz=w320`;
      img.onerror = () => {
        box.innerHTML = `<span class="avatar-monogram" title="เปิดดูรูปใน Apps Script ได้จากปุ่มด้านบน">${escapeHtml(initials)}</span>`;
      };
    }
    box.replaceChildren(img);
  }

  /* ---------- Student Lookup & Personalization Sync ---------- */
  function findStudentByQuery(rawVal) {
    const q = String(rawVal || "").trim().toLocaleLowerCase("th");
    if (!q) return null;
    const m = q.match(/^(\d{7})\b/);
    if (m) {
      const byId = ROSTER.students.find((s) => s.id === m[1]);
      if (byId) return byId;
    }
    return (
      ROSTER.students.find(
        (s) =>
          q.startsWith(s.id) ||
          s.fullName.toLocaleLowerCase("th") === q ||
          s.name.toLocaleLowerCase("th") === q ||
          `${s.id} — ${s.fullName}`.toLocaleLowerCase("th") === q
      ) || null
    );
  }

  function clearAllPersonalization() {
    state.myStudent = null;
    localStorage.removeItem("racm303_my_sid");
    ["personalStudentInput", "studioStudentInput", "subStudentQuickInput", "schedDiscFilter", "schedAreaFilter", "schedTeacherFilter", "studioTeacherSelect"].forEach((id) => {
      if ($(id)) $(id).value = "";
    });
    updatePersonalBanner();
    refreshCalendarStudioUI();
    if (state.activeTab === "schedule") renderScheduleCurrent();
    if (state.activeTab === "discussion") renderDiscussionView();
    if (state.activeTab === "fieldwork") renderFieldworkView();
    if (state.activeTab === "submissions") renderSubmissionsView();
  }

  function initPersonalizer() {
    const list = $("studentLookupList");
    const input = $("personalStudentInput");
    if (list) {
      ROSTER.students.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = `${s.id} — ${s.fullName}`;
        opt.label = `กลุ่มพื้นที่ ${s.area} · Discussion ${s.disc}`;
        list.appendChild(opt);
      });
    }

    const bindStudentInput = (el) => {
      if (!el) return;
      el.addEventListener("change", () => {
        const found = findStudentByQuery(el.value);
        if (found) {
          state.calScope = "student";
          applyMyStudent(found, true);
        }
      });
      el.addEventListener("input", () => {
        const val = el.value.trim();
        const m = val.match(/^(\d{7})\b/);
        if (m) {
          const found = ROSTER.students.find((s) => s.id === m[1]);
          if (found) {
            state.calScope = "student";
            applyMyStudent(found, true);
          }
        }
      });
    };

    bindStudentInput(input);
    bindStudentInput($("studioStudentInput"));
    bindStudentInput($("subStudentQuickInput"));

    ["clearPersonalBtn", "studioClearSelectionBtn"].forEach((id) => {
      const btn = $(id);
      if (btn) btn.addEventListener("click", clearAllPersonalization);
    });
  }

  function applyMyStudent(student, syncFilters) {
    state.myStudent = student;
    localStorage.setItem("racm303_my_sid", student.id);
    const formatted = `${student.id} — ${student.fullName}`;
    if ($("personalStudentInput")) $("personalStudentInput").value = formatted;
    if ($("studioStudentInput")) $("studioStudentInput").value = formatted;
    if ($("subStudentQuickInput")) $("subStudentQuickInput").value = formatted;

    if (syncFilters) {
      if ($("schedDiscFilter")) $("schedDiscFilter").value = String(student.disc);
      if ($("schedAreaFilter")) $("schedAreaFilter").value = student.area;
      if ($("schedTeacherFilter")) $("schedTeacherFilter").value = "";
      if ($("studioTeacherSelect")) $("studioTeacherSelect").value = "";
      if ($("discGroupSelect") && !$("discGroupSelect").value) $("discGroupSelect").value = String(student.disc);
      if ($("fieldAreaSelect") && !$("fieldAreaSelect").value) $("fieldAreaSelect").value = student.area;
    }

    if ($("srnAreaSelect")) $("srnAreaSelect").value = student.area;
    if ($("srnStudentId")) $("srnStudentId").value = student.id;
    if ($("srnStudentName")) $("srnStudentName").value = student.fullName;
    updateSrnFilename();

    updatePersonalBanner();
    refreshCalendarStudioUI();
    if (state.activeTab === "schedule") renderScheduleCurrent();
    if (state.activeTab === "discussion") renderDiscussionView();
    if (state.activeTab === "fieldwork") renderFieldworkView();
    if (state.activeTab === "submissions") renderSubmissionsView();
  }

  function selectFieldworkGroupOnly(shortName) {
    state.myStudent = null;
    localStorage.removeItem("racm303_my_sid");
    if ($("personalStudentInput")) $("personalStudentInput").value = "";
    if ($("studioStudentInput")) $("studioStudentInput").value = "";
    if ($("subStudentQuickInput")) $("subStudentQuickInput").value = "";
    if ($("schedDiscFilter")) $("schedDiscFilter").value = "";
    if ($("schedTeacherFilter")) $("schedTeacherFilter").value = "";
    if ($("studioTeacherSelect")) $("studioTeacherSelect").value = "";
    if ($("schedAreaFilter")) $("schedAreaFilter").value = shortName || "";
    state.calScope = shortName ? "group" : "all";
    updatePersonalBanner();
    refreshCalendarStudioUI();
    renderScheduleCurrent();
  }

  function updatePersonalBanner() {
    const summary = $("personalSummary");
    const clearBtn = $("clearPersonalBtn");
    if (!summary) return;
    summary.replaceChildren();
    if (!state.myStudent) {
      summary.appendChild(
        make("span", "พิมพ์รหัส 7 หลักหรือชื่อ เพื่อผูกห้อง Discussion กลุ่มภาคสนาม และดาวน์โหลดปฏิทินส่วนตัว (.ics / .csv)")
      );
      if (clearBtn) clearBtn.hidden = true;
      return;
    }
    const s = state.myStudent;
    const site = (SCHED.fieldworkSites || []).find((x) => x.shortName === s.area);
    const hsRot = (SCHED.hsRotation || []).find((x) => x.group === s.disc);

    const discChip = make("button", `Discussion ${s.disc} (${hsRot ? hsRot.room : ""}) ↗`, "personal-chip");
    discChip.type = "button";
    discChip.style.cursor = "pointer";
    discChip.title = "คลิกเพื่อดูรายชื่อสมาชิกกลุ่ม Discussion ของฉัน";
    discChip.addEventListener("click", () => {
      if ($("discGroupSelect")) $("discGroupSelect").value = String(s.disc);
      switchTab("discussion");
    });

    const areaChip = make("button", `พื้นที่: ${s.area}${site ? " · " + (site.badgeDates || site.datesTH) : ""} ↗`, "personal-chip");
    areaChip.type = "button";
    areaChip.style.cursor = "pointer";
    areaChip.title = "คลิกเพื่อดูข้อมูลและสมาชิกกลุ่มพื้นที่ภาคสนามของฉัน";
    areaChip.addEventListener("click", () => {
      if ($("fieldAreaSelect")) $("fieldAreaSelect").value = s.area;
      switchTab("fieldwork");
    });

    summary.append(
      discChip,
      areaChip,
      make("span", `อ.ที่ปรึกษา: ${s.advisor}`, "personal-chip")
    );
    if (clearBtn) clearBtn.hidden = false;
  }

  /* ---------- Primary Tab Routing ---------- */
  function normalizeTabId(rawTab) {
    if (rawTab === "students") return "fieldwork";
    if (rawTab === "srn" || rawTab === "elearning") return "submissions";
    return rawTab;
  }

  function switchTab(tabId, pushHash = true) {
    tabId = normalizeTabId(tabId);
    const validTabs = ROLE === "faculty"
      ? ["schedule", "discussion", "fieldwork", "submissions", "audit", "faculty-docs", "manual", "textbooks", "practice"]
      : ["schedule", "discussion", "fieldwork", "submissions", "manual", "textbooks", "practice"];
    if (!validTabs.includes(tabId)) tabId = "schedule";

    state.activeTab = tabId;
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      const active = btn.dataset.tab === tabId;
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.hidden = panel.id !== `panel-${tabId}`;
    });

    document.body.classList.toggle("print-students-mode", tabId === "discussion" || tabId === "fieldwork");
    document.body.classList.toggle("print-disc-mode", tabId === "discussion");

    if (pushHash) {
      history.replaceState(null, "", `#${tabId}`);
    }

    if (tabId === "schedule") renderScheduleCurrent();
    if (tabId === "discussion") renderDiscussionView();
    if (tabId === "fieldwork") renderFieldworkView();
    if (tabId === "submissions") renderSubmissionsView();
    if (tabId === "manual") renderManualReader();
    if (tabId === "textbooks") renderTextbookReader();
    if (tabId === "practice") renderPracticeCurrent();
    if (ROLE === "faculty" && tabId === "audit" && typeof renderAuditView === "function") renderAuditView();
    if (ROLE === "faculty" && tabId === "faculty-docs" && typeof renderFacultyDocsView === "function") renderFacultyDocsView();
  }

  /* ---------- Per-Session Group Assignments & Fieldwork Personalization ---------- */
  function getSessionAssignments(session) {
    if (session.hsModule) {
      const mod = session.hsModule;
      return (SCHED.hsRotation || []).map((rot) => {
        const cell = rot[mod] || {};
        return {
          type: "discussion",
          groupId: String(rot.group),
          label: `Discussion กลุ่มที่ ${rot.group} (${rot.count} คน)`,
          shortGroup: String(rot.group),
          lecturer: cell.instructor || "",
          room: cell.room || rot.room,
          highlightRoom: !!cell.highlightRoom,
          facultyFlag: cell.facultyFlag || ""
        };
      });
    }
    if (session.isFieldGroupSession) {
      const allowed = session.allowedSites || null;
      return (SCHED.fieldworkSites || [])
        .filter((site) => !allowed || allowed.includes(site.id))
        .map((site) => {
          let extra = "";
          if (session.code === "SG3" && ["เพชรบูรณ์ 2", "อุบลรัตน์", "อุ้มผาง"].includes(site.shortName)) {
            extra = " (อ.ที่ปรึกษา Online)";
          } else if (session.code === "SG4" && site.shortName === "เพชรบูรณ์ 2") {
            extra = " (อ.ที่ปรึกษา Online)";
          }
          let roomLabel = site.room;
          if (session.code === "FIELD") {
            roomLabel = `${site.hospital} ${site.province}`;
          } else if (session.code === "TRAVEL") {
            roomLabel = `จุดนัดหมายการเดินทาง กลุ่ม${site.shortName} (${site.departShortTH || ""})`;
          } else if (session.code === "RETURN") {
            roomLabel = `${site.hospital} ${site.province} → กรุงเทพฯ / CNMI`;
          }
          return {
            type: "area",
            groupId: site.shortName,
            label: `กลุ่มพื้นที่ ${site.shortName} (${site.count} คน)`,
            shortGroup: site.shortName,
            lecturer: site.advisors + extra,
            room: roomLabel,
            highlightRoom: false,
            facultyFlag: ""
          };
        });
    }
    return [];
  }

  function sessionMatchesTeacher(session, teacherKey, assignments) {
    if (!teacherKey) return true;
    if (String(session.lecturers || "").includes(teacherKey)) return true;
    return assignments.some((a) => String(a.lecturer || "").includes(teacherKey));
  }

  function getActivePersonalContext() {
    const discVal = ($("schedDiscFilter") && $("schedDiscFilter").value) || (state.myStudent ? String(state.myStudent.disc) : "");
    const areaVal = ($("schedAreaFilter") && $("schedAreaFilter").value) || (state.myStudent ? state.myStudent.area : "");
    const teacherVal = ($("schedTeacherFilter") && $("schedTeacherFilter").value) || "";
    const siteObj = areaVal ? (SCHED.fieldworkSites || []).find((x) => x.shortName === areaVal) : null;
    return { discVal, areaVal, teacherVal, siteObj };
  }

  function resolveEffectiveSessionDetails(session, ctx) {
    const assignments = getSessionAssignments(session);
    let title = session.title || "";
    let room = session.room || "";
    let lecturer = session.lecturers || "";
    let personalLabel = "";
    let startISO = session.dateISO;
    let endISO = session.endDateISO || session.dateISO;

    if (session.hsModule && ctx.discVal) {
      const m = assignments.find((a) => a.shortGroup === ctx.discVal);
      if (m) {
        title = `${session.title} [กลุ่ม ${ctx.discVal} · ห้อง ${m.room.split(" ")[0]}]`;
        room = `${m.room} (${m.label})`;
        lecturer = m.lecturer;
        personalLabel = `ห้อง ${m.room.split(" ")[0]}`;
      }
    } else if (session.isFieldGroupSession && ctx.areaVal && ctx.siteObj) {
      const site = ctx.siteObj;
      const m = assignments.find((a) => a.shortGroup === ctx.areaVal);
      if (m) {
        room = m.room;
        lecturer = m.lecturer;
        personalLabel = site.room.split(" ")[0];
      }
      if (session.code === "FIELD") {
        startISO = site.startDateISO || session.dateISO;
        endISO = site.endDateISO || session.endDateISO || session.dateISO;
        title = `ฝึกปฏิบัติงานภาคสนาม · ${site.hospital} ${site.province} (${site.datesTH})`;
        personalLabel = site.shortName;
      } else if (session.code === "TRAVEL") {
        title = `ออกเดินทางสู่พื้นที่ภาคสนาม · กลุ่ม ${site.hospital} ${site.province} (${site.departShortTH || session.timeLabel})`;
        personalLabel = `เดินทาง · ${site.shortName}`;
      } else if (session.code === "RETURN") {
        title = `เดินทางกลับจากภาคสนาม · กลุ่ม ${site.hospital} ${site.province} (${site.returnShortTH || ""})`;
        personalLabel = `เดินทางกลับ · ${site.shortName}`;
      } else {
        title = `${session.title.replace(/\s*\(เฉพาะ 4 กลุ่ม[^)]*\)|\s*\(4 กลุ่ม[^)]*\)/g, "")} [กลุ่ม${site.shortName} · ห้อง ${site.room.split(" ")[0]}]`;
      }
    } else if (ctx.teacherVal && assignments.length) {
      const tm = assignments.find((a) => String(a.lecturer).includes(ctx.teacherVal));
      if (tm) {
        room = `${tm.room} (${tm.label})`;
        lecturer = tm.lecturer;
        personalLabel = `${tm.shortGroup} · ${tm.room.split(" ")[0]}`;
      }
    }

    const isAllDay = session.code === "FIELD" || session.category === "HOLIDAY" || session.category === "STAFF";
    return { assignments, title, room, lecturer, personalLabel, startISO, endISO, isAllDay };
  }

  function getFilteredSessions(ignoreWeekDropdown = false) {
    const weekVal = ignoreWeekDropdown ? "" : (($("schedWeekFilter") && $("schedWeekFilter").value) || "");
    const catVal = ($("schedCatFilter") && $("schedCatFilter").value) || "";
    const ctx = getActivePersonalContext();
    const q = (($("schedSearchInput") && $("schedSearchInput").value) || "").trim().toLocaleLowerCase("th");

    return (SCHED.sessions || []).filter((s) => {
      if (ROLE === "student" && s.studentVisible === false) return false;
      if (weekVal && String(s.week) !== weekVal) return false;
      if (catVal && s.category !== catVal) return false;

      const assignments = getSessionAssignments(s);
      if (!sessionMatchesTeacher(s, ctx.teacherVal, assignments)) return false;

      if (ctx.areaVal && s.allowedSites && ctx.siteObj) {
        if (!s.allowedSites.includes(ctx.siteObj.id)) return false;
      }

      if (q) {
        const zoomHay = s.zoom ? `zoom ${s.zoom.id} ${s.zoom.pass} ${s.zoom.url}` : "";
        const hay = [
          s.code,
          s.title,
          s.objectives,
          s.lecturers,
          s.room,
          s.dateTH,
          zoomHay,
          ROLE === "faculty" ? (s.facultyNote || "") : "",
          ...assignments.map((a) => `${a.label} ${a.lecturer} ${a.room}`)
        ]
          .join(" ")
          .toLocaleLowerCase("th");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  /* ---------- Calendar Personalize, Download & Subscribe Studio ---------- */
  function computeSubscribeRelativePath(ctx) {
    if (ROLE === "faculty" && ctx.teacherVal) {
      const idx = (ROSTER.courseTeachers || []).findIndex((t) => t.key === ctx.teacherVal);
      if (idx >= 0) {
        return `calendars/teacher_${String(idx + 1).padStart(2, "0")}.ics`;
      }
    }
    if (ctx.discVal && ctx.siteObj && ROLE === "student") {
      return `calendars/d${ctx.discVal}_g${ctx.siteObj.id}.ics`;
    }
    if (ctx.discVal && ctx.siteObj && state.myStudent) {
      return `calendars/d${ctx.discVal}_g${ctx.siteObj.id}.ics`;
    }
    if (ctx.siteObj) {
      return `calendars/group_${ctx.siteObj.id}_${ctx.siteObj.slug}.ics`;
    }
    return "calendars/all.ics";
  }

  function refreshCalendarStudioUI() {
    const ctx = getActivePersonalContext();
    const sessionsToExport = getSessionsForExport();

    // Update scope tabs visual state
    document.querySelectorAll("[data-cal-scope]").forEach((btn) => {
      btn.setAttribute("aria-selected", btn.dataset.calScope === state.calScope ? "true" : "false");
    });

    if ($("calScopeStudentPane")) $("calScopeStudentPane").hidden = state.calScope !== "student";
    if ($("calScopeGroupPane")) $("calScopeGroupPane").hidden = state.calScope !== "group";
    if ($("calScopeTeacherPane")) $("calScopeTeacherPane").hidden = state.calScope !== "teacher";
    if ($("calScopeAllPane")) $("calScopeAllPane").hidden = state.calScope !== "all";

    if ($("studioClearSelectionBtn")) {
      $("studioClearSelectionBtn").hidden = !(state.myStudent || ctx.areaVal || ctx.discVal);
    }
    if ($("studioClearTeacherBtn")) {
      $("studioClearTeacherBtn").hidden = !ctx.teacherVal;
    }

    // Highlight active fieldwork group pill
    document.querySelectorAll(".cal-group-pill").forEach((pill) => {
      pill.classList.toggle("is-selected", pill.dataset.areaName === ctx.areaVal);
    });

    // Update summary box & dynamic CTA button labels
    const sumBox = $("calTargetSummaryBox");
    const dlIcsBtn = $("studioDownloadIcsBtn");
    const dlCsvBtn = $("studioDownloadCsvBtn");
    const topIcsBtn = $("exportIcsBtn");
    const topCsvBtn = $("exportGcalCsvBtn");

    let shortTarget = "ตารางรวมทั้งรายวิชา";
    if (state.myStudent && ctx.siteObj) {
      const s = state.myStudent;
      const site = ctx.siteObj;
      shortTarget = `${s.id} (${site.shortName})`;
      if (sumBox) {
        sumBox.innerHTML =
          `<strong>ตารางเฉพาะตัวนักศึกษา:</strong> ${escapeHtml(s.fullName)} (<code>${escapeHtml(s.id)}</code>) · Discussion ${s.disc} · กลุ่ม <strong>${escapeHtml(site.hospital)} ${escapeHtml(site.province)}</strong><br>` +
          `<strong>เวลาลงภาคสนามของกลุ่มนี้:</strong> ออกเดินทาง ${escapeHtml(site.departShortTH || "")} · ระยะฝึก <strong>${escapeHtml(site.datesTH)}</strong> · ${site.hasFri11Dec ? "มีเรียนกลุ่มย่อย 5–6 วันศุกร์ที่ 11 ธ.ค." : "ไม่มีเรียนวันศุกร์ที่ 11 ธ.ค. (อยู่ระหว่างภาคสนาม)"} · รวม <strong>${sessionsToExport.length} รายการ</strong> (พร้อมลิงก์ Zoom)`;
      }
    } else if (ctx.teacherVal) {
      const tObj = (ROSTER.courseTeachers || []).find((t) => t.key === ctx.teacherVal);
      shortTarget = `อ.${ctx.teacherVal}`;
      if (sumBox) {
        sumBox.innerHTML =
          `<strong>ปฏิทินภาระงานอาจารย์:</strong> ${escapeHtml(tObj ? tObj.label : ctx.teacherVal)}<br>` +
          `คัดเฉพาะคาบบรรยาย กลุ่มอภิปราย HS และกลุ่มที่ปรึกษาภาคสนามของท่าน รวม <strong>${sessionsToExport.length} รายการ</strong> (พร้อมฝังลิงก์ Zoom ครบทุกคาบออนไลน์)`;
      }
    } else if (ctx.siteObj) {
      const site = ctx.siteObj;
      shortTarget = `กลุ่ม${site.shortName}`;
      if (sumBox) {
        sumBox.innerHTML =
          `<strong>ตารางเฉพาะกลุ่มภาคสนาม:</strong> <strong>${escapeHtml(site.hospital)} ${escapeHtml(site.province)}</strong> (${site.count} คน · ห้องกลุ่มย่อย <code>${escapeHtml(site.room.split(" ")[0])}</code> · อ.ที่ปรึกษา: ${escapeHtml(site.advisors)})<br>` +
          `<strong>เวลาลงภาคสนามของกลุ่มนี้:</strong> ออกเดินทาง ${escapeHtml(site.departShortTH || "")} · ระยะฝึก <strong>${escapeHtml(site.datesTH)}</strong> · ${site.hasFri11Dec ? "รวมคาบกลุ่มย่อย 5–6 วันศุกร์ที่ 11 ธ.ค. แล้ว" : "ตัดคาบวันศุกร์ที่ 11 ธ.ค. ออกอัตโนมัติ (กลุ่มนี้เดินทางแล้ว)"} · รวม <strong>${sessionsToExport.length} รายการ</strong>`;
      }
    } else if (ctx.discVal) {
      shortTarget = `Discussion ${ctx.discVal}`;
      if (sumBox) {
        sumBox.innerHTML = `<strong>กรองเฉพาะกลุ่มอภิปราย Discussion ${escapeHtml(ctx.discVal)}:</strong> รวม <strong>${sessionsToExport.length} รายการ</strong> (เลือกกลุ่มพื้นที่ภาคสนามเพิ่มเติมด้านบนเพื่อผูกวันเดินทางภาคสนามได้)`;
      }
    } else {
      if (sumBox) {
        sumBox.innerHTML =
          ROLE === "faculty"
            ? `<strong>กำลังเลือก: ตารางรวมทั้งรายวิชา (${sessionsToExport.length} รายการ)</strong> — เลือกชื่ออาจารย์หรือกลุ่มภาคสนามด้านบนเพื่อแยกดาวน์โหลดเฉพาะภาระงานของท่านหรือเฉพาะกลุ่มได้ทันที`
            : `<strong>กำลังเลือก: ตารางรวมทั้งชั้นปี 169 คน (${sessionsToExport.length} รายการ)</strong> — พิมพ์รหัสนักศึกษาหรือคลิกเลือกกลุ่มภาคสนามด้านบน เพื่อให้ระบบปรับวันเดินทางไป-กลับภาคสนามและห้องเรียนเฉพาะของตัวเองอัตโนมัติ`;
      }
    }

    if (dlIcsBtn) dlIcsBtn.textContent = `ดาวน์โหลด .ics (${shortTarget})`;
    if (dlCsvBtn) dlCsvBtn.textContent = `ดาวน์โหลด .csv (${shortTarget})`;
    if (topIcsBtn) topIcsBtn.textContent = `ดาวน์โหลด iCal .ics (${shortTarget})`;
    if (topCsvBtn) topCsvBtn.textContent = `ดาวน์โหลด Google .csv (${shortTarget})`;
    if ($("sideDlIcsQuickBtn")) $("sideDlIcsQuickBtn").textContent = `ดาวน์โหลดไฟล์ .ics (${shortTarget})`;
    if ($("sideDlCsvQuickBtn")) $("sideDlCsvQuickBtn").textContent = `ดาวน์โหลดไฟล์ .csv (${shortTarget})`;
    if ($("calSideSyncTargetLabel")) {
      $("calSideSyncTargetLabel").textContent = `กำลังซิงค์: ${shortTarget} (${sessionsToExport.length} คาบ · พร้อมลิงก์ Zoom)`;
    }

    // Update Subscribe URL (.ics over HTTPS for Google Calendar "From URL" & webcal:// for Apple Calendar)
    const relFeed = computeSubscribeRelativePath(ctx);
    const httpsFeedUrl = `${PORTAL_BASE_URL}/${relFeed}`;
    const webcalFeedUrl = httpsFeedUrl.replace(/^https:\/\//i, "webcal://");
    if ($("studioSubscribeUrlInput")) $("studioSubscribeUrlInput").value = httpsFeedUrl;
    if ($("studioWebcalLink")) $("studioWebcalLink").href = webcalFeedUrl;
    if ($("sideWebcalQuickLink")) $("sideWebcalQuickLink").href = webcalFeedUrl;
  }

  function initCalendarDownloadStudio() {
    // Render 9 Fieldwork Group quick-select pills
    const grid = $("studioGroupPillsGrid");
    if (grid && !grid.dataset.rendered) {
      grid.dataset.rendered = "1";
      (SCHED.fieldworkSites || []).forEach((site) => {
        const pill = make("button", null, "cal-group-pill");
        pill.type = "button";
        pill.dataset.areaName = site.shortName;
        pill.innerHTML = `<strong>${site.id}. ${escapeHtml(site.shortName)} (${site.count} คน)</strong><small>${escapeHtml(site.badgeDates || site.datesTH)}</small>`;
        pill.addEventListener("click", () => {
          selectFieldworkGroupOnly(site.shortName);
        });
        grid.appendChild(pill);
      });
    }

    // Faculty studio teacher dropdown
    const studioTeacher = $("studioTeacherSelect");
    if (studioTeacher && !studioTeacher.dataset.rendered) {
      studioTeacher.dataset.rendered = "1";
      (ROSTER.courseTeachers || []).forEach((t) => {
        studioTeacher.add(new Option(t.label, t.key));
      });
      studioTeacher.addEventListener("change", () => {
        const val = studioTeacher.value;
        if ($("schedTeacherFilter")) $("schedTeacherFilter").value = val;
        if (val) {
          state.myStudent = null;
          if ($("schedAreaFilter")) $("schedAreaFilter").value = "";
          if ($("schedDiscFilter")) $("schedDiscFilter").value = "";
          state.calScope = "teacher";
        }
        updatePersonalBanner();
        refreshCalendarStudioUI();
        renderScheduleCurrent();
      });
    }

    if ($("studioClearTeacherBtn")) {
      $("studioClearTeacherBtn").addEventListener("click", clearAllPersonalization);
    }

    // Scope mode switching buttons
    document.querySelectorAll("[data-cal-scope]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextScope = btn.dataset.calScope;
        state.calScope = nextScope;
        if (nextScope === "all") {
          clearAllPersonalization();
          state.calScope = "all";
        } else if (nextScope === "group" && state.myStudent) {
          const areaKeep = state.myStudent.area;
          selectFieldworkGroupOnly(areaKeep);
        }
        refreshCalendarStudioUI();
      });
    });

    if ($("studioDownloadIcsBtn")) $("studioDownloadIcsBtn").addEventListener("click", downloadScheduleIcs);
    if ($("studioDownloadCsvBtn")) $("studioDownloadCsvBtn").addEventListener("click", downloadScheduleGoogleCsv);
    if ($("studioCopySubUrlBtn")) {
      $("studioCopySubUrlBtn").addEventListener("click", () => {
        const urlEl = $("studioSubscribeUrlInput");
        if (urlEl && urlEl.value) {
          copyTextWithFeedback(urlEl.value, $("studioCopySubUrlBtn"), "คัดลอกลิงก์ .ics แล้ว ✓");
        }
      });
    }
  }

  /* ---------- Tab 1: Schedule & Calendar Controls + Side-Tab Inspector ---------- */
  function findSessionForMilestone(m) {
    const sessions = SCHED.sessions || [];
    const dStr = String(m.date || "");
    const tStr = String(m.title || "");
    if (dStr.includes("8 ธ.ค.")) {
      return sessions.find((s) => s.dateISO === "2026-12-08" && s.category === "EXAM") || sessions.find((s) => s.dateISO === "2026-12-08");
    }
    if (dStr.includes("22 ธ.ค.")) {
      return sessions.find((s) => s.dateISO === "2026-12-22" && s.category === "EXAM") || sessions.find((s) => s.dateISO === "2026-12-22");
    }
    if (dStr.includes("29 ธ.ค.")) {
      return sessions.find((s) => s.dateISO === "2026-12-29");
    }
    if (dStr.includes("30 ธ.ค.") && tStr.includes("4A")) {
      return sessions.find((s) => s.dateISO === "2026-12-30" && s.category !== "EXAM") || sessions.find((s) => s.dateISO === "2026-12-30");
    }
    return null;
  }

  function renderZoomHubAndMilestones() {
    const msWrap = $("milestoneStrip");
    if (msWrap && !msWrap.dataset.rendered) {
      msWrap.dataset.rendered = "1";
      (SCHED.milestones || []).forEach((m) => {
        const card = make("div", null, `milestone-card ms-type-${m.type || "info"}`);
        card.setAttribute("role", "button");
        card.tabIndex = 0;

        let actionHint = "ดูในปฏิทิน →";
        if (m.type === "deadline") actionHint = "เปิดหน้าส่งงาน →";
        else if (m.type === "fieldwork") actionHint = "ดู 9 พื้นที่ภาคสนาม →";

        const activateMilestone = () => {
          if (m.type === "deadline") {
            if ($("srnRoundSelect")) {
              $("srnRoundSelect").value = String(m.title).includes("SRN 1") ? "SRN1" : "SRN2";
              updateSrnFilename();
            }
            switchTab("submissions");
            return;
          }
          if (m.type === "fieldwork") {
            switchTab("fieldwork");
            return;
          }
          const matched = findSessionForMilestone(m);
          if (matched) {
            state.calWeek = Number(matched.week) || 1;
            if ($("schedWeekFilter") && $("schedWeekFilter").value) {
              $("schedWeekFilter").value = String(state.calWeek);
            }
            state.schedSub = "week";
            syncSegButtons();
            renderScheduleCurrent();
            openEventModal(matched);
          }
        };

        card.addEventListener("click", activateMilestone);
        card.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            activateMilestone();
          }
        });

        const topRow = make("div", null, "ms-top-row");
        topRow.append(make("span", m.date, "ms-date"), make("span", actionHint, "ms-action-hint"));

        card.append(
          topRow,
          make("div", m.title, "ms-title"),
          make("div", m.channel, "ms-channel")
        );
        msWrap.appendChild(card);
      });
    }

    const rooms = (SCHED.courseMeta && SCHED.courseMeta.zoomRooms) || [];
    const zoomList = $("zoomRoomsHubList");
    if (zoomList && !zoomList.dataset.rendered) {
      zoomList.dataset.rendered = "1";
      rooms.forEach((zr) => {
        const card = make("div", null, "zoom-room-card");
        const info = make("div", null, "zoom-room-info");
        info.appendChild(make("strong", zr.label));
        info.appendChild(make("div", `Meeting ID: ${zr.id}  ·  Passcode: ${zr.pass}`, "zoom-room-meta"));

        const acts = make("div", null, "header-actions");
        const joinLink = make("a", "เข้าห้องเรียน Zoom ↗", "btn sm primary");
        joinLink.href = zr.url;
        joinLink.target = "_blank";
        joinLink.rel = "noopener";

        const copyBtn = make("button", "คัดลอกลิงก์ & รหัส", "btn sm");
        copyBtn.type = "button";
        copyBtn.addEventListener("click", () =>
          copyTextWithFeedback(`${zr.label}\nZoom Link: ${zr.url}\nMeeting ID: ${zr.id}\nPasscode: ${zr.pass}`, copyBtn)
        );

        acts.append(joinLink, copyBtn);
        card.append(info, acts);
        zoomList.appendChild(card);
      });
    }

    const sideZoomList = $("calSideZoomList");
    if (sideZoomList && !sideZoomList.dataset.rendered) {
      sideZoomList.dataset.rendered = "1";
      rooms.forEach((zr) => {
        const card = make("div", null, "side-zoom-card");
        card.appendChild(make("strong", zr.label, "side-zoom-title"));
        card.appendChild(make("div", `ID: ${zr.id} · Pass: ${zr.pass}`, "side-zoom-meta"));
        const acts = make("div", null, "side-zoom-actions");
        const joinLink = make("a", "เข้า Zoom ↗", "btn sm primary");
        joinLink.href = zr.url;
        joinLink.target = "_blank";
        joinLink.rel = "noopener";
        const copyBtn = make("button", "คัดลอก", "btn sm");
        copyBtn.type = "button";
        copyBtn.addEventListener("click", () =>
          copyTextWithFeedback(`${zr.label}\nZoom Link: ${zr.url}\nMeeting ID: ${zr.id}\nPasscode: ${zr.pass}`, copyBtn)
        );
        acts.append(joinLink, copyBtn);
        card.appendChild(acts);
        sideZoomList.appendChild(card);
      });
    }
  }

  function syncCalSideTabs() {
    document.querySelectorAll("[data-side-tab]").forEach((btn) => {
      btn.setAttribute("aria-selected", btn.dataset.sideTab === state.calSideTab ? "true" : "false");
    });
    if ($("calSideMilestonesPane")) $("calSideMilestonesPane").hidden = state.calSideTab !== "milestones";
    if ($("calSideZoomPane")) $("calSideZoomPane").hidden = state.calSideTab !== "zoom";
    if ($("calSideSyncPane")) $("calSideSyncPane").hidden = state.calSideTab !== "sync";
  }

  function initScheduleControls() {
    renderZoomHubAndMilestones();
    initCalendarDownloadStudio();

    document.querySelectorAll("[data-side-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.calSideTab = btn.dataset.sideTab || "milestones";
        syncCalSideTabs();
      });
    });

    const toggleSidebarBtn = $("toggleCalSidebarBtn");
    if (toggleSidebarBtn) {
      toggleSidebarBtn.addEventListener("click", () => {
        state.showCalSidebar = !state.showCalSidebar;
        toggleSidebarBtn.setAttribute("aria-expanded", state.showCalSidebar ? "true" : "false");
        if ($("calSideInspector")) $("calSideInspector").hidden = !state.showCalSidebar;
        if ($("calWorkspaceSplit")) {
          $("calWorkspaceSplit").classList.toggle("is-sidebar-collapsed", !state.showCalSidebar);
        }
      });
    }

    if ($("sideDlIcsQuickBtn")) $("sideDlIcsQuickBtn").addEventListener("click", downloadScheduleIcs);
    if ($("sideDlCsvQuickBtn")) $("sideDlCsvQuickBtn").addEventListener("click", downloadScheduleGoogleCsv);
    if ($("sideOpenFullStudioBtn")) {
      $("sideOpenFullStudioBtn").addEventListener("click", () => {
        const disc = $("calStudioDisclosure");
        if (disc) {
          disc.open = true;
          disc.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }

    const teacherSel = $("schedTeacherFilter");
    if (teacherSel) {
      ROSTER.courseTeachers.forEach((t) => {
        teacherSel.add(new Option(t.label, t.key));
      });
    }
    const discSel = $("schedDiscFilter");
    if (discSel) {
      (SCHED.hsGroups || []).forEach((g) => {
        discSel.add(new Option(`Discussion ${g.id} (${g.defaultRoom.split(" ")[0]})`, String(g.id)));
      });
    }
    const areaSel = $("schedAreaFilter");
    if (areaSel) {
      (SCHED.fieldworkSites || []).forEach((s) => {
        areaSel.add(new Option(`${s.shortName} (${s.badgeDates || s.hospital})`, s.shortName));
      });
    }

    if ($("schedWeekFilter")) {
      $("schedWeekFilter").addEventListener("change", () => {
        const w = Number($("schedWeekFilter").value);
        if (w >= 1 && w <= 6) state.calWeek = w;
        renderScheduleCurrent();
      });
    }

    if ($("schedAreaFilter")) {
      $("schedAreaFilter").addEventListener("change", () => {
        const val = $("schedAreaFilter").value;
        if (state.myStudent && val !== state.myStudent.area) {
          state.myStudent = null;
          localStorage.removeItem("racm303_my_sid");
          if ($("personalStudentInput")) $("personalStudentInput").value = "";
          if ($("studioStudentInput")) $("studioStudentInput").value = "";
          state.calScope = val ? "group" : "all";
          updatePersonalBanner();
        } else if (!state.myStudent && val) {
          state.calScope = "group";
        }
        refreshCalendarStudioUI();
        renderScheduleCurrent();
      });
    }

    if ($("schedTeacherFilter")) {
      $("schedTeacherFilter").addEventListener("change", () => {
        const val = $("schedTeacherFilter").value;
        if ($("studioTeacherSelect")) $("studioTeacherSelect").value = val;
        if (val && ROLE === "faculty") state.calScope = "teacher";
        refreshCalendarStudioUI();
        renderScheduleCurrent();
      });
    }

    ["schedCatFilter", "schedDiscFilter"].forEach((id) => {
      const el = $(id);
      if (el) {
        el.addEventListener("change", () => {
          refreshCalendarStudioUI();
          renderScheduleCurrent();
        });
      }
    });

    if ($("schedSearchInput")) {
      $("schedSearchInput").addEventListener("input", renderScheduleCurrent);
    }
    if ($("resetSchedFiltersBtn")) {
      $("resetSchedFiltersBtn").addEventListener("click", () => {
        ["schedWeekFilter", "schedCatFilter", "schedTeacherFilter", "schedDiscFilter", "schedAreaFilter", "schedSearchInput"].forEach((id) => {
          if ($(id)) $(id).value = "";
        });
        if ($("studioTeacherSelect")) $("studioTeacherSelect").value = "";
        if (state.myStudent) {
          if ($("schedDiscFilter")) $("schedDiscFilter").value = String(state.myStudent.disc);
          if ($("schedAreaFilter")) $("schedAreaFilter").value = state.myStudent.area;
        }
        state.calWeek = 1;
        refreshCalendarStudioUI();
        renderScheduleCurrent();
      });
    }

    document.querySelectorAll("[data-sched-sub]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.schedSub = btn.dataset.schedSub;
        syncSegButtons();
        renderScheduleCurrent();
      });
    });

    if ($("calPrevBtn")) {
      $("calPrevBtn").addEventListener("click", () => {
        if (state.schedSub === "month") state.schedSub = "week";
        state.calWeek = Math.max(1, state.calWeek - 1);
        if ($("schedWeekFilter") && $("schedWeekFilter").value) $("schedWeekFilter").value = String(state.calWeek);
        syncSegButtons();
        renderScheduleCurrent();
      });
    }
    if ($("calNextBtn")) {
      $("calNextBtn").addEventListener("click", () => {
        if (state.schedSub === "month") state.schedSub = "week";
        state.calWeek = Math.min(6, state.calWeek + 1);
        if ($("schedWeekFilter") && $("schedWeekFilter").value) $("schedWeekFilter").value = String(state.calWeek);
        syncSegButtons();
        renderScheduleCurrent();
      });
    }
    if ($("calStartWeekBtn")) {
      $("calStartWeekBtn").addEventListener("click", () => {
        state.calWeek = 1;
        if ($("schedWeekFilter")) $("schedWeekFilter").value = "";
        renderScheduleCurrent();
      });
    }

    const zoomDrawerBtn = $("toggleZoomDrawerBtn");
    const zoomDrawer = $("zoomSyncDrawer");
    if (zoomDrawerBtn && zoomDrawer) {
      zoomDrawerBtn.addEventListener("click", () => {
        state.showZoomDrawer = !state.showZoomDrawer;
        zoomDrawer.hidden = !state.showZoomDrawer;
        zoomDrawerBtn.setAttribute("aria-expanded", state.showZoomDrawer ? "true" : "false");
      });
    }

    if ($("exportIcsBtn")) $("exportIcsBtn").addEventListener("click", downloadScheduleIcs);
    if ($("exportGcalCsvBtn")) $("exportGcalCsvBtn").addEventListener("click", downloadScheduleGoogleCsv);
    if ($("printScheduleBtn")) {
      $("printScheduleBtn").addEventListener("click", () => {
        document.body.classList.remove("print-students-mode", "print-disc-mode");
        window.print();
      });
    }

    const modal = $("calendarEventModal");
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeEventModal();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !modal.hidden) closeEventModal();
      });
    }

    syncCalSideTabs();
    refreshCalendarStudioUI();
  }

  function syncSegButtons() {
    document.querySelectorAll("[data-sched-sub]").forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.schedSub === state.schedSub ? "true" : "false")
    );
  }

  function updateScheduleStatusBar(sessionsCount) {
    const statusEl = $("schedStatusText");
    const titleEl = $("calPeriodTitle");
    const ctx = getActivePersonalContext();
    const weekVal = ($("schedWeekFilter") && $("schedWeekFilter").value) || "";

    if (titleEl) {
      if (state.schedSub === "week") {
        const wb = WEEK_BOUNDS.find((w) => w.week === state.calWeek) || WEEK_BOUNDS[0];
        titleEl.textContent = wb.label;
      } else if (state.schedSub === "spec") {
        titleEl.textContent = "ตารางหมุนเวียนกลุ่มอภิปราย HS1–HS6 และสัดส่วนข้อสอบ";
      } else if (weekVal) {
        const wb = WEEK_BOUNDS.find((w) => String(w.week) === weekVal);
        titleEl.textContent = wb ? wb.label : "พฤศจิกายน – ธันวาคม 2569";
      } else {
        titleEl.textContent = "พฤศจิกายน – ธันวาคม 2569 (ปฏิทินรายวิชาครบ 6 สัปดาห์)";
      }
    }

    if ($("calPrevBtn")) $("calPrevBtn").disabled = state.schedSub === "week" && state.calWeek <= 1;
    if ($("calNextBtn")) $("calNextBtn").disabled = state.schedSub === "week" && state.calWeek >= 6;

    if (statusEl) {
      const parts = [
        `พบ ${sessionsCount} คาบกิจกรรม`,
        ctx.teacherVal ? `อาจารย์: ${ctx.teacherVal}` : "",
        ctx.discVal ? `Discussion ${ctx.discVal}` : "",
        ctx.areaVal ? `กลุ่มพื้นที่ ${ctx.areaVal}` : "",
        "คลิกที่คาบเรียนเพื่อดูรายละเอียด ลิงก์ Zoom หรือเพิ่มเข้าปฏิทิน"
      ].filter(Boolean);
      statusEl.textContent = parts.join(" · ");
    }
  }

  function renderScheduleCurrent() {
    if ($("schedMonthWrap")) $("schedMonthWrap").hidden = state.schedSub !== "month";
    if ($("schedWeekWrap")) $("schedWeekWrap").hidden = state.schedSub !== "week";
    if ($("schedDailyWrap")) $("schedDailyWrap").hidden = state.schedSub !== "daily";
    if ($("schedSpecWrap")) $("schedSpecWrap").hidden = state.schedSub !== "spec";

    if (state.schedSub === "month") renderScheduleMonth();
    else if (state.schedSub === "week") renderScheduleWeek();
    else if (state.schedSub === "daily") renderScheduleDaily();
    else if (state.schedSub === "spec") renderScheduleSpec();
  }

  /* ---------- View 1: Month Calendar Matrix (Google Calendar / Apple iCal Style) ---------- */
  function expandSessionsByDate(sessions, ctx) {
    const map = new Map();
    sessions.forEach((s) => {
      const eff = resolveEffectiveSessionDetails(s, ctx);
      let cur = eff.startISO;
      const last = eff.endISO || eff.startISO;
      let guard = 0;
      while (cur <= last && guard < 20) {
        if (!map.has(cur)) map.set(cur, []);
        map.get(cur).push({ session: s, eff, isSpanContinuation: cur !== eff.startISO });
        cur = addDaysISO(cur, 1);
        guard++;
      }
    });
    return map;
  }

  function renderScheduleMonth() {
    const wrap = $("schedMonthContent");
    if (!wrap) return;
    const ctx = getActivePersonalContext();
    const sessions = getFilteredSessions(false);
    updateScheduleStatusBar(sessions.length);

    const byDate = expandSessionsByDate(sessions, ctx);
    const weekFilterVal = ($("schedWeekFilter") && $("schedWeekFilter").value) || "";
    const visibleWeeks = weekFilterVal
      ? WEEK_BOUNDS.filter((wb) => String(wb.week) === weekFilterVal)
      : WEEK_BOUNDS;

    const shell = make("div", null, "cal-month-shell");
    const minWrap = make("div", null, "cal-month-min");

    const head = make("div", null, "cal-dow-header");
    head.appendChild(make("div", "สัปดาห์", "cal-dow-cell"));
    TH_DOW_FULL.forEach((dName) => head.appendChild(make("div", dName, "cal-dow-cell")));
    minWrap.appendChild(head);

    visibleWeeks.forEach((wb) => {
      const row = make("div", null, "cal-month-row");
      const wCell = make("div", null, "cal-week-num");
      wCell.title = `คลิกเพื่อเปิดตารางรายสัปดาห์ที่ ${wb.week}`;
      wCell.innerHTML = `<span>W${wb.week}</span><small style="font-size:10px;opacity:0.8">รายชั่วโมง</small>`;
      wCell.addEventListener("click", () => {
        state.calWeek = wb.week;
        state.schedSub = "week";
        syncSegButtons();
        renderScheduleCurrent();
      });
      row.appendChild(wCell);

      for (let dIdx = 0; dIdx < 7; dIdx++) {
        const iso = addDaysISO(wb.start, dIdx);
        const isOutside = iso < "2026-11-24" || iso > "2026-12-30";
        const cell = make("div", null, `cal-day-cell${dIdx >= 5 ? " is-weekend" : ""}${isOutside ? " is-outside" : ""}`);

        const dayHead = make("div", null, "cal-day-head");
        const isMonthStart = iso.endsWith("-01") || iso === "2026-11-25";
        const dNum = make("span", formatThaiShortDate(iso, dIdx === 0), `cal-day-num${isMonthStart ? " is-month-start" : ""}`);
        dayHead.appendChild(dNum);
        cell.appendChild(dayHead);

        const evWrap = make("div", null, "cal-day-events");
        const dayItems = byDate.get(iso) || [];
        dayItems.forEach(({ session: s, eff }) => {
          const chip = make("button", null, `cal-chip cat-${s.category}${eff.isAllDay ? " is-allday" : ""}`);
          chip.type = "button";
          const shortTime = eff.isAllDay ? "ทั้งวัน" : (s.startTime || "");
          let labelTitle = "";
          if (s.code === "FIELD") {
            labelTitle = ctx.areaVal ? `ภาคสนาม: ${ctx.areaVal}` : "ฝึกภาคสนาม (9 กลุ่ม)";
          } else if (s.code === "TRAVEL") {
            labelTitle = ctx.areaVal ? `ออกเดินทาง (${ctx.areaVal})` : eff.title;
          } else if (s.code === "RETURN") {
            labelTitle = ctx.areaVal ? `เดินทางกลับ (${ctx.areaVal})` : eff.title;
          } else {
            labelTitle = `${s.code}: ${s.title.replace(/^\*?HS\d:\s*|^EP\d.*:\s*/i, "")}`;
          }
          chip.title = `${s.timeLabel} · ${eff.title}${eff.personalLabel ? " (" + eff.personalLabel + ")" : ""}`;

          chip.appendChild(make("span", shortTime, "chip-time"));
          chip.appendChild(make("span", labelTitle, "chip-title"));
          if (s.zoom) {
            chip.appendChild(make("span", "Zoom", "chip-zoom"));
          }
          chip.addEventListener("click", () => openEventModal(s));
          evWrap.appendChild(chip);
        });

        cell.appendChild(evWrap);
        row.appendChild(cell);
      }

      minWrap.appendChild(row);
    });

    shell.appendChild(minWrap);
    wrap.replaceChildren(shell);
  }

  /* ---------- View 2: Week Time-Grid View (08:00–18:00 / Dynamic 24:00 for Evening Travel) ---------- */
  function renderScheduleWeek() {
    const wrap = $("schedWeekContent");
    if (!wrap) return;

    const weekDropdownVal = Number(($("schedWeekFilter") && $("schedWeekFilter").value) || 0);
    if (weekDropdownVal >= 1 && weekDropdownVal <= 6) {
      state.calWeek = weekDropdownVal;
    }

    const wb = WEEK_BOUNDS.find((w) => w.week === state.calWeek) || WEEK_BOUNDS[0];
    const ctx = getActivePersonalContext();
    const allFiltered = getFilteredSessions(true);
    const byDate = expandSessionsByDate(allFiltered, ctx);

    const weekSet = new Set();
    let maxEndMin = 18 * 60;
    for (let i = 0; i < 7; i++) {
      (byDate.get(addDaysISO(wb.start, i)) || []).forEach((x) => {
        weekSet.add(x.session.id);
        if (!x.eff.isAllDay) {
          maxEndMin = Math.max(maxEndMin, timeToMinutes(x.session.endTime || "12:00"));
        }
      });
    }
    updateScheduleStatusBar(weekSet.size);

    const HOUR_START = 8;
    const HOUR_END = maxEndMin > 18 * 60 ? Math.min(24, Math.ceil(maxEndMin / 60)) : 18;
    const HOUR_PX = 56;

    const shell = make("div", null, "cal-week-shell");
    const minWrap = make("div", null, "cal-week-min");

    const head = make("div", null, "cal-week-head");
    head.appendChild(make("div", `W${wb.week}`, "cal-gutter-label"));
    for (let i = 0; i < 7; i++) {
      const iso = addDaysISO(wb.start, i);
      const hc = make("div", null, "cal-week-head-cell");
      hc.innerHTML = `<span class="wd-name">${TH_DOW_SHORT[i]}</span><span class="wd-num">${escapeHtml(formatThaiShortDate(iso, true))}</span>`;
      head.appendChild(hc);
    }
    minWrap.appendChild(head);

    const allDayRow = make("div", null, "cal-allday-row");
    allDayRow.appendChild(make("div", "ตลอดวัน", "cal-gutter-label"));
    for (let i = 0; i < 7; i++) {
      const iso = addDaysISO(wb.start, i);
      const adCell = make("div", null, "cal-allday-cell");
      (byDate.get(iso) || [])
        .filter((x) => x.eff.isAllDay)
        .forEach(({ session: s, eff }) => {
          const chip = make("button", null, `cal-chip is-allday cat-${s.category}`);
          chip.type = "button";
          const txt = s.code === "FIELD" && ctx.areaVal ? `ฝึกภาคสนาม (${ctx.areaVal})` : eff.title;
          chip.appendChild(make("span", txt, "chip-title"));
          chip.addEventListener("click", () => openEventModal(s));
          adCell.appendChild(chip);
        });
      allDayRow.appendChild(adCell);
    }
    minWrap.appendChild(allDayRow);

    const body = make("div", null, "cal-timegrid-body");
    const gutter = make("div", null, "cal-time-gutter");
    for (let h = HOUR_START; h < HOUR_END; h++) {
      gutter.appendChild(make("div", `${String(h).padStart(2, "0")}:00`, "cal-hour-tick"));
    }
    body.appendChild(gutter);

    for (let i = 0; i < 7; i++) {
      const iso = addDaysISO(wb.start, i);
      const col = make("div", null, `cal-day-col${i >= 5 ? " is-weekend" : ""}`);
      col.style.height = `${(HOUR_END - HOUR_START) * HOUR_PX}px`;
      (byDate.get(iso) || [])
        .filter((x) => !x.eff.isAllDay)
        .forEach(({ session: s, eff }) => {
          const sMin = Math.max(HOUR_START * 60, timeToMinutes(s.startTime || "09:00"));
          const eMin = Math.min(HOUR_END * 60, Math.max(sMin + 30, timeToMinutes(s.endTime || "12:00")));
          const topPx = ((sMin - HOUR_START * 60) / 60) * HOUR_PX;
          const heightPx = Math.max(30, ((eMin - sMin) / 60) * HOUR_PX - 2);

          const block = make("button", null, `cal-timed-event cat-${s.category}`);
          block.type = "button";
          block.style.top = `${topPx}px`;
          block.style.height = `${heightPx}px`;
          block.title = `${s.timeLabel} · ${eff.title} · ${eff.room}`;

          const timeLine = `${s.startTime}–${s.endTime}${s.zoom ? " · 🎥 Zoom" : ""}`;
          block.appendChild(make("span", timeLine, "ev-time"));
          block.appendChild(make("span", `${s.code}: ${eff.title}`, "ev-title"));
          if (heightPx >= 58) {
            block.appendChild(make("span", eff.personalLabel || eff.room, "ev-room"));
          }
          block.addEventListener("click", () => openEventModal(s));
          col.appendChild(block);
        });
      body.appendChild(col);
    }

    minWrap.appendChild(body);
    shell.appendChild(minWrap);
    wrap.replaceChildren(shell);
  }

  /* ---------- View 3: Detailed Agenda / Daily Cards ---------- */
  function renderScheduleDaily() {
    const sessions = getFilteredSessions(false);
    updateScheduleStatusBar(sessions.length);

    const listEl = $("scheduleSessionsContainer");
    if (!listEl) return;
    listEl.replaceChildren();

    if (!sessions.length) {
      listEl.appendChild(make("div", "ไม่พบคาบเรียนที่ตรงกับตัวกรอง ลองกด “ล้างตัวกรอง” เพื่อดูตารางทั้งหมด", "empty-state"));
      return;
    }

    const ctx = getActivePersonalContext();
    let lastWeek = null;
    let lastDate = "";

    sessions.forEach((s) => {
      const eff = resolveEffectiveSessionDetails(s, ctx);
      if (s.week !== lastWeek) {
        lastWeek = s.week;
        lastDate = "";
        const wg = (SCHED.masterGrid || []).find((w) => w.week === s.week);
        listEl.appendChild(make("div", `สัปดาห์ที่ ${s.week}${wg ? " · " + wg.range : ""}`, "week-divider"));
      }
      const dateHeadingText = s.code === "FIELD" && ctx.siteObj ? `ช่วงฝึกภาคสนาม (${ctx.siteObj.datesTH})` : s.dateTH;
      if (dateHeadingText !== lastDate) {
        lastDate = dateHeadingText;
        listEl.appendChild(make("h3", dateHeadingText, "day-heading"));
      }

      const card = make("article", null, "session-card");
      const main = make("div", null, "session-main");

      const timeCol = make("div", s.code === "FIELD" && ctx.siteObj ? ctx.siteObj.badgeDates || s.timeLabel : s.timeLabel, "session-time");
      timeCol.appendChild(make("small", `${s.code} · ${s.checkIn || ""}`));
      main.appendChild(timeCol);

      const bodyCol = make("div", null, "session-topic");
      const badges = make("div", null, "session-badges");
      badges.append(
        make("span", CAT_NAMES[s.category] || s.category, `badge cat-${s.category}`),
        make("span", s.format, "badge")
      );
      if (s.zoom) {
        badges.appendChild(make("span", `Zoom ID: ${s.zoom.id}`, "badge cat-EP"));
      }
      bodyCol.appendChild(badges);
      bodyCol.appendChild(make("h3", eff.title));
      if (s.objectives) {
        bodyCol.appendChild(make("p", s.objectives, "session-objectives"));
      }

      const assignments = eff.assignments;
      const visibleAssignments = ctx.teacherVal
        ? assignments.filter((a) => String(a.lecturer).includes(ctx.teacherVal))
        : assignments;

      if (s.hsModule && ctx.discVal) {
        const myA = assignments.find((a) => a.shortGroup === ctx.discVal);
        if (myA) {
          const pbox = make("div", null, "personal-match-box");
          pbox.innerHTML = `<div><strong>ห้องเรียนของคุณ (${escapeHtml(myA.label)}):</strong> ห้อง <strong>${escapeHtml(myA.room)}</strong> · อาจารย์ประจำกลุ่ม: ${escapeHtml(myA.lecturer)}</div>`;
          const btn = make("button", `ดูรายชื่อกลุ่ม ${myA.shortGroup}`, "btn sm");
          btn.type = "button";
          btn.addEventListener("click", () => jumpToClassRoster(s, myA));
          pbox.appendChild(btn);
          bodyCol.appendChild(pbox);
        }
      } else if (s.isFieldGroupSession && ctx.areaVal) {
        const myA = assignments.find((a) => a.shortGroup === ctx.areaVal);
        if (myA) {
          const pbox = make("div", null, "personal-match-box");
          pbox.innerHTML = `<div><strong>กลุ่มพื้นที่ของคุณ (${escapeHtml(myA.shortGroup)}):</strong> ${escapeHtml(myA.room)} · อ.ที่ปรึกษา: ${escapeHtml(myA.lecturer)}</div>`;
          const btn = make("button", `ดูรายชื่อ ${myA.shortGroup}`, "btn sm");
          btn.type = "button";
          btn.addEventListener("click", () => jumpToClassRoster(s, myA));
          pbox.appendChild(btn);
          bodyCol.appendChild(pbox);
        }
      }

      if (s.zoom) {
        const zBox = make("div", null, "zoom-inline-box");
        const zMeta = make("div", null, "zoom-inline-meta");
        zMeta.innerHTML = `<strong>ห้องเรียนออนไลน์ Zoom:</strong> Meeting ID <code>${escapeHtml(s.zoom.id)}</code> · Passcode <code>${escapeHtml(s.zoom.pass)}</code>`;
        const zActs = make("div", null, "header-actions");
        const zJoin = make("a", "เข้าร่วมห้องเรียน Zoom ↗", "btn sm primary");
        zJoin.href = s.zoom.url;
        zJoin.target = "_blank";
        zJoin.rel = "noopener";
        const zCopy = make("button", "คัดลอกลิงก์", "btn sm");
        zCopy.type = "button";
        zCopy.addEventListener("click", () => copyTextWithFeedback(s.zoom.url, zCopy));
        zActs.append(zJoin, zCopy);
        zBox.append(zMeta, zActs);
        bodyCol.appendChild(zBox);
      }

      const meta = make("div", null, "session-meta");
      meta.appendChild(make("span", `ผู้สอน: ${eff.lecturer}`));
      const roomSpan = make("span", `ห้อง/สถานที่: ${eff.room}`, "room-pill");
      bodyCol.append(meta, roomSpan);

      if (ROLE === "faculty" && s.facultyNote) {
        bodyCol.appendChild(make("div", `[บันทึกสำหรับอาจารย์/ผู้ประสานงาน] ${s.facultyNote}`, "faculty-flag-box"));
      }

      const actions = make("div", null, "session-actions");
      if (s.conciseLink) {
        const bConcise = make("button", `อ่านฉบับย่อ (${s.hsModule || s.docLink})`, "btn sm teal");
        bConcise.type = "button";
        bConcise.addEventListener("click", () => openTextbookDoc(s.conciseLink));
        actions.appendChild(bConcise);
      }
      if (s.docLink) {
        const bDoc = make("button", `อ่านฉบับเต็ม ${s.docLink}`, s.conciseLink ? "btn sm" : "btn sm teal");
        bDoc.type = "button";
        bDoc.addEventListener("click", () => openTextbookDoc(s.docLink));
        actions.appendChild(bDoc);
      }
      if (s.wbLink) {
        const bWb = make("button", `Worksheet (${s.wbLink.replace("-WB", "")})`, "btn sm");
        bWb.type = "button";
        bWb.addEventListener("click", () => openTextbookDoc(s.wbLink));
        actions.appendChild(bWb);
      }
      if (s.actionUrl) {
        const bExt = make("a", s.actionLabel || "เปิดลิงก์ส่งงาน ↗", "btn sm primary");
        bExt.href = s.actionUrl;
        bExt.target = "_blank";
        bExt.rel = "noopener";
        actions.appendChild(bExt);
      }
      if (s.code === "SRN 2 & SLIDES") {
        const bRamed = make("a", "ส่ง SRN 2 ในห้องวิชา id=398 ↗", "btn sm primary");
        bRamed.href = getActiveRamedTargetUrl();
        bRamed.target = "_blank";
        bRamed.rel = "noopener";
        actions.appendChild(bRamed);
      }
      if (s.code === "SRN 1" || s.code === "SRN 2 & SLIDES") {
        const bSrn = make("button", "เตรียมไฟล์ & ศูนย์การส่งงาน (E-learning)", "btn sm teal");
        bSrn.type = "button";
        bSrn.addEventListener("click", () => {
          if ($("srnRoundSelect")) {
            $("srnRoundSelect").value = s.code === "SRN 1" ? "SRN1" : "SRN2";
            updateSrnFilename();
          }
          switchTab("submissions");
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
        actions.appendChild(bSrn);
      }

      const gcalSingle = make("a", "+ Google Calendar", "btn sm");
      gcalSingle.href = buildGoogleCalendarTemplateUrl(s);
      gcalSingle.target = "_blank";
      gcalSingle.rel = "noopener";
      actions.appendChild(gcalSingle);

      const icsSingle = make("button", "บันทึก .ics คาบนี้", "btn sm");
      icsSingle.type = "button";
      icsSingle.addEventListener("click", () => downloadSingleSessionIcs(s));
      actions.appendChild(icsSingle);

      if (!assignments.length && s.category !== "HOLIDAY" && s.category !== "STAFF") {
        const bAll = make("button", "ดูรายชื่อทั้งชั้น (169 คน)", "btn sm");
        bAll.type = "button";
        bAll.addEventListener("click", () =>
          jumpToClassRoster(s, { type: "all", groupId: "", label: "นักศึกษาแพทย์ชั้นปีที่ 3 ทั้งชั้น (169 คน)", lecturer: s.lecturers, room: s.room })
        );
        actions.appendChild(bAll);
      }

      bodyCol.appendChild(actions);
      main.appendChild(bodyCol);
      card.appendChild(main);

      if (visibleAssignments.length > 0) {
        const details = make("details", null, "assignments");
        details.open = Boolean(ctx.teacherVal);
        const kindText = s.hsModule ? "กลุ่มอภิปราย Discussion" : "กลุ่มพื้นที่ภาคสนาม";
        details.appendChild(
          make("summary", `ดูรายละเอียดแยกตาม${kindText} (${visibleAssignments.length} กลุ่ม) · อาจารย์ · ห้องเรียน · รายชื่อนักศึกษา`)
        );
        visibleAssignments.forEach((item) => {
          const isMine =
            (item.type === "discussion" && ctx.discVal === item.shortGroup) ||
            (item.type === "area" && ctx.areaVal === item.shortGroup);
          const row = make("div", null, `assignment-row${isMine ? " is-my-group" : ""}`);
          row.appendChild(make("div", item.label, "assignment-group"));
          const lecDiv = make("div", item.lecturer, "assignment-lecturer");
          if (ROLE === "faculty" && item.facultyFlag) {
            lecDiv.appendChild(make("div", `[${item.facultyFlag}]`, "faculty-flag-box"));
          }
          row.appendChild(lecDiv);
          row.appendChild(make("div", item.room, `room-pill${item.highlightRoom ? " highlight" : ""}`));
          const rBtn = make("button", "ดูรายชื่อ", "btn sm");
          rBtn.type = "button";
          rBtn.addEventListener("click", () => jumpToClassRoster(s, item));
          row.appendChild(rBtn);
          details.appendChild(row);
        });
        card.appendChild(details);
      }

      listEl.appendChild(card);
    });
  }

  /* ---------- View 4: HS1–HS6 Rotation & Exam Table Spec ---------- */
  function renderScheduleSpec() {
    const wrap = $("schedSpecContent");
    if (!wrap) return;
    updateScheduleStatusBar((SCHED.sessions || []).filter((s) => ROLE === "faculty" || s.studentVisible !== false).length);
    if (wrap.dataset.rendered) return;
    wrap.dataset.rendered = "1";

    const rotRows = (SCHED.hsRotation || [])
      .map(
        (r) => `
      <tr>
        <td><strong>กลุ่มที่ ${r.group}</strong> (${r.count} คน)<br><small>ห้องหลัก ${escapeHtml(r.room)}</small></td>
        <td>${escapeHtml(r.HS1.instructor)}</td>
        <td>${escapeHtml(r.HS2.instructor)}</td>
        <td>${escapeHtml(r.HS3.instructor)}</td>
        <td>${escapeHtml(r.HS4.instructor)}<br><small><strong>ห้อง ${escapeHtml(r.HS4.room)}</strong></small></td>
        <td>${escapeHtml(r.HS5.instructor)}</td>
        <td>${escapeHtml(r.HS6.instructor)}</td>
      </tr>`
      )
      .join("");

    const hsSpecRows = ((SCHED.tableSpec && SCHED.tableSpec.hs) || [])
      .map(
        (x) => `<tr><td><strong>${escapeHtml(x.code)}</strong></td><td>${escapeHtml(x.title)}</td><td>${escapeHtml(x.date)}</td><td><strong>${escapeHtml(x.weight)}</strong></td></tr>`
      )
      .join("");

    const epSpecRows = ((SCHED.tableSpec && SCHED.tableSpec.ep) || [])
      .map(
        (x) => `<tr><td><strong>${escapeHtml(x.code)}</strong></td><td>${escapeHtml(x.title)}</td><td>${escapeHtml(x.date)}</td><td><strong>${escapeHtml(x.weight)}</strong></td></tr>`
      )
      .join("");

    wrap.innerHTML = `
      <div class="data-card">
        <h3>ตารางหมุนเวียนอาจารย์ประจำกลุ่มอภิปราย HS1–HS6 (6 กลุ่มย่อย · 169 คน)</h3>
        <p style="margin:0 0 12px;font-size:14px;color:var(--muted)">เวลาเรียนระบบสุขภาพ: ช่วงเช้า <strong>08.30–12.00 น.</strong> (บรรยาย 08.30–09.30 · กลุ่มย่อย 09.40–12.00) และช่วงบ่าย <strong>13.30–17.00 น.</strong> (บรรยาย 13.30–14.30 · กลุ่มย่อย 14.40–17.00) · หมายเหตุ: เช้าวันอังคารที่ 1 ธ.ค. 2569 (HS4) กลุ่มที่ 6 ย้ายไปใช้ห้อง <strong>2C2-03</strong> ชั่วคราว และช่วงบ่าย (HS5) กลับเข้าห้อง <strong>1C1-07</strong> ตามปกติ</p>
        <div class="clean-table-wrap">
          <table class="clean-table">
            <thead>
              <tr>
                <th>กลุ่มอภิปราย</th>
                <th>HS1 (26 พ.ย. 08.30–12.00)</th>
                <th>HS2 (30 พ.ย. 08.30–12.00)</th>
                <th>HS3 (30 พ.ย. 13.30–17.00)</th>
                <th>HS4 (1 ธ.ค. 08.30–12.00)</th>
                <th>HS5 (1 ธ.ค. 13.30–17.00)</th>
                <th>HS6 (4 ธ.ค. 08.30–12.00)</th>
              </tr>
            </thead>
            <tbody>${rotRows}</tbody>
          </table>
        </div>
      </div>
      <div class="data-card">
        <h3>สัดส่วนเนื้อหาการสอบภาคทฤษฎีระบบสุขภาพ (HS1–HS6 · สอบ อ. 22 ธ.ค. 2569 แบบ Open Note 1 แผ่น A4 ลายมือ)</h3>
        <div class="clean-table-wrap">
          <table class="clean-table">
            <thead><tr><th>รหัส</th><th>หัวข้อบทเรียน</th><th>วันเรียน</th><th>น้ำหนัก</th></tr></thead>
            <tbody>${hsSpecRows}</tbody>
          </table>
        </div>
      </div>
      <div class="data-card">
        <h3>สัดส่วนเนื้อหาการสอบภาคทฤษฎีระบาดวิทยา (EP1–EP9 · สอบ อ. 8 ธ.ค. 2569)</h3>
        <div class="clean-table-wrap">
          <table class="clean-table">
            <thead><tr><th>รหัส</th><th>หัวข้อบทเรียน</th><th>วันเรียน</th><th>น้ำหนัก</th></tr></thead>
            <tbody>${epSpecRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  /* ---------- Interactive Calendar Event Detail Popover Modal ---------- */
  function openEventModal(session) {
    const modal = $("calendarEventModal");
    const card = $("calendarEventModalCard");
    if (!modal || !card) return;

    const ctx = getActivePersonalContext();
    const eff = resolveEffectiveSessionDetails(session, ctx);
    card.replaceChildren();

    const top = make("div", null, "cal-modal-top");
    const badges = make("div", null, "session-badges");
    badges.append(
      make("span", CAT_NAMES[session.category] || session.category, `badge cat-${session.category}`),
      make("span", session.code, "badge"),
      make("span", session.format || "", "badge")
    );
    const closeBtn = make("button", "×", "cal-modal-close");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "ปิดหน้าต่างรายละเอียด");
    closeBtn.addEventListener("click", closeEventModal);
    top.append(badges, closeBtn);
    card.appendChild(top);

    const h3 = make("h3", eff.title);
    h3.id = "calModalTitle";
    card.appendChild(h3);

    const dateLine = session.code === "FIELD" && ctx.siteObj ? ctx.siteObj.datesTH : `${session.dateTH} · ${session.timeLabel}`;
    const details = make("div", null, "cal-modal-detail-list");
    details.innerHTML = `
      <div><strong>วัน-เวลา:</strong> ${escapeHtml(dateLine)}${session.checkIn ? " (" + escapeHtml(session.checkIn) + ")" : ""}</div>
      <div><strong>สถานที่ / ห้องเรียน:</strong> <span class="room-pill">${escapeHtml(eff.room)}</span></div>
      <div><strong>อาจารย์ผู้สอน / วิทยากร:</strong> ${escapeHtml(eff.lecturer)}</div>
    `;
    card.appendChild(details);

    if (session.zoom) {
      const zBox = make("div", null, "zoom-inline-box");
      const zMeta = make("div", null, "zoom-inline-meta");
      zMeta.innerHTML = `<strong>ลิงก์เข้าห้องเรียน Zoom:</strong><br>Meeting ID: <code>${escapeHtml(session.zoom.id)}</code> · Passcode: <code>${escapeHtml(session.zoom.pass)}</code>`;
      const zActs = make("div", null, "header-actions");
      const zJoin = make("a", "เข้าร่วมประชุม Zoom ↗", "btn sm primary");
      zJoin.href = session.zoom.url;
      zJoin.target = "_blank";
      zJoin.rel = "noopener";
      const zCopy = make("button", "คัดลอกลิงก์ Zoom", "btn sm");
      zCopy.type = "button";
      zCopy.addEventListener("click", () => copyTextWithFeedback(session.zoom.url, zCopy));
      zActs.append(zJoin, zCopy);
      zBox.append(zMeta, zActs);
      card.appendChild(zBox);
    }

    if (session.objectives) {
      const objP = make("p", session.objectives, "session-objectives");
      objP.style.marginTop = "10px";
      card.appendChild(objP);
    }

    if (ROLE === "faculty" && session.facultyNote) {
      card.appendChild(make("div", `[บันทึกผู้ประสานงาน] ${session.facultyNote}`, "faculty-flag-box"));
    }

    const studyRow = make("div", null, "session-actions");
    if (session.conciseLink) {
      const bc = make("button", `อ่านบทเรียนฉบับย่อ (${session.hsModule || session.docLink})`, "btn sm teal");
      bc.type = "button";
      bc.addEventListener("click", () => {
        closeEventModal();
        openTextbookDoc(session.conciseLink);
      });
      studyRow.appendChild(bc);
    }
    if (session.docLink) {
      const bd = make("button", `อ่านฉบับเต็ม (${session.docLink})`, session.conciseLink ? "btn sm" : "btn sm teal");
      bd.type = "button";
      bd.addEventListener("click", () => {
        closeEventModal();
        openTextbookDoc(session.docLink);
      });
      studyRow.appendChild(bd);
    }
    if (session.wbLink) {
      const bw = make("button", `Worksheet (${session.wbLink.replace("-WB", "")})`, "btn sm");
      bw.type = "button";
      bw.addEventListener("click", () => {
        closeEventModal();
        openTextbookDoc(session.wbLink);
      });
      studyRow.appendChild(bw);
    }
    if (session.actionUrl) {
      const ba = make("a", session.actionLabel || "เปิดลิงก์ส่งงาน ↗", "btn sm primary");
      ba.href = session.actionUrl;
      ba.target = "_blank";
      ba.rel = "noopener";
      studyRow.appendChild(ba);
    }
    if (session.code === "SRN 2 & SLIDES") {
      const br = make("a", "ส่ง SRN 2 ในห้องวิชา id=398 ↗", "btn sm primary");
      br.href = getActiveRamedTargetUrl();
      br.target = "_blank";
      br.rel = "noopener";
      studyRow.appendChild(br);
    }
    if (session.code === "SRN 1" || session.code === "SRN 2 & SLIDES") {
      const bs = make("button", "เตรียมไฟล์ & ศูนย์การส่งงาน (E-learning)", "btn sm teal");
      bs.type = "button";
      bs.addEventListener("click", () => {
        closeEventModal();
        if ($("srnRoundSelect")) {
          $("srnRoundSelect").value = session.code === "SRN 1" ? "SRN1" : "SRN2";
          updateSrnFilename();
        }
        switchTab("submissions");
      });
      studyRow.appendChild(bs);
    }
    if (studyRow.childElementCount > 0) card.appendChild(studyRow);

    const footer = make("div", null, "cal-modal-footer");
    const leftExport = make("div", null, "header-actions");
    const gcalBtn = make("a", "+ เพิ่มเข้า Google Calendar ทันที ↗", "btn sm cal-gcal-btn");
    gcalBtn.href = buildGoogleCalendarTemplateUrl(session);
    gcalBtn.target = "_blank";
    gcalBtn.rel = "noopener";

    const icsBtn = make("button", "ดาวน์โหลดเฉพาะคาบนี้ (.ics)", "btn sm cal-ics-btn");
    icsBtn.type = "button";
    icsBtn.addEventListener("click", () => downloadSingleSessionIcs(session));

    leftExport.append(gcalBtn, icsBtn);

    const viewAgendaBtn = make("button", "ดูในมุมมองกำหนดการเต็ม", "btn sm");
    viewAgendaBtn.type = "button";
    viewAgendaBtn.addEventListener("click", () => {
      closeEventModal();
      state.schedSub = "daily";
      syncSegButtons();
      renderScheduleCurrent();
    });

    footer.append(leftExport, viewAgendaBtn);
    card.appendChild(footer);

    modal.hidden = false;
  }

  function closeEventModal() {
    const modal = $("calendarEventModal");
    if (modal) modal.hidden = true;
  }

  /* ---------- Dual-Format Calendar Downloads: iCalendar (.ics) & Google Calendar (.csv) ---------- */
  function escapeIcsText(str) {
    return String(str == null ? "" : str)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  function buildEventDescriptionAndLocation(session, eff) {
    const descParts = [];
    if (session.zoom) {
      descParts.push(
        `🎥 ลิงก์เข้าห้องเรียน Zoom: ${session.zoom.url}`,
        `Meeting ID: ${session.zoom.id} | Passcode: ${session.zoom.pass}`,
        ""
      );
    }
    if (session.actionUrl) {
      descParts.push(`🔗 ลิงก์ส่งงาน/แบบฟอร์ม: ${session.actionUrl}`, "");
    }
    if (session.objectives) {
      descParts.push(`วัตถุประสงค์: ${session.objectives}`);
    }
    descParts.push(
      `อาจารย์ผู้สอน: ${eff.lecturer}`,
      `สถานที่/ห้องเรียน: ${eff.room}`,
      `รูปแบบ: ${session.format || ""}${session.checkIn ? " (" + session.checkIn + ")" : ""}`
    );

    const locationStr = session.zoom
      ? `${eff.room} | Zoom: ${session.zoom.url}`
      : eff.room;

    return {
      description: descParts.filter((x) => x !== undefined).join("\n").trim(),
      location: locationStr
    };
  }

  function getSessionsForExport() {
    const ctx = getActivePersonalContext();
    return (SCHED.sessions || []).filter((s) => {
      if (ROLE === "student" && s.studentVisible === false) return false;
      if (!s.dateISO) return false;
      const assignments = getSessionAssignments(s);
      if (!sessionMatchesTeacher(s, ctx.teacherVal, assignments)) return false;
      if (ctx.areaVal && s.allowedSites && ctx.siteObj) {
        if (!s.allowedSites.includes(ctx.siteObj.id)) return false;
      } else if (!ctx.areaVal && !ctx.teacherVal && (s.code === "TRAVEL" || s.code === "RETURN")) {
        // In unfiltered whole-class mode, keep w4-fieldwork and avoid duplicating all 9 travel batches unless filtering
        return true;
      }
      return true;
    });
  }

  function buildIcsCalendarString(sessions, calName) {
    const ctx = getActivePersonalContext();
    const stamp = "20261118T070000Z";
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Ramathibodi Community Medicine//RACM 303 2569//TH",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeIcsText(calName)}`,
      "X-WR-TIMEZONE:Asia/Bangkok",
      "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
      "X-PUBLISHED-TTL:PT12H",
      "BEGIN:VTIMEZONE",
      "TZID:Asia/Bangkok",
      "BEGIN:STANDARD",
      "DTSTART:19700101T000000",
      "TZOFFSETFROM:+0700",
      "TZOFFSETTO:+0700",
      "TZNAME:+07",
      "END:STANDARD",
      "END:VTIMEZONE"
    ];

    sessions.forEach((s) => {
      const eff = resolveEffectiveSessionDetails(s, ctx);
      const { description, location } = buildEventDescriptionAndLocation(s, eff);
      const summary = `[RACM 303] ${eff.title}`;

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${s.id}@racm303-2569.mahidol.ac.th`);
      lines.push(`DTSTAMP:${stamp}`);

      if (eff.isAllDay) {
        const dStart = eff.startISO.replace(/-/g, "");
        const dEndExclusive = addDaysISO(eff.endISO || eff.startISO, 1).replace(/-/g, "");
        lines.push(`DTSTART;VALUE=DATE:${dStart}`);
        lines.push(`DTEND;VALUE=DATE:${dEndExclusive}`);
      } else {
        const dStart = eff.startISO.replace(/-/g, "");
        const dEnd = (eff.endISO || eff.startISO).replace(/-/g, "");
        const tStart = (s.startTime || "09:00").replace(":", "") + "00";
        const tEnd = (s.endTime || "12:00").replace(":", "") + "00";
        lines.push(`DTSTART;TZID=Asia/Bangkok:${dStart}T${tStart}`);
        lines.push(`DTEND;TZID=Asia/Bangkok:${dEnd}T${tEnd}`);
      }

      lines.push(`SUMMARY:${escapeIcsText(summary)}`);
      lines.push(`LOCATION:${escapeIcsText(location)}`);
      lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
      if (s.zoom && s.zoom.url) {
        lines.push(`URL:${s.zoom.url}`);
        lines.push(`X-GOOGLE-CONFERENCE:${s.zoom.url}`);
      } else if (s.actionUrl) {
        lines.push(`URL:${s.actionUrl}`);
      }

      if (!eff.isAllDay && s.category !== "HOLIDAY") {
        const alarmTrigger = s.code === "TRAVEL" ? "-PT60M" : "-PT15M";
        lines.push(
          "BEGIN:VALARM",
          `TRIGGER:${alarmTrigger}`,
          "ACTION:DISPLAY",
          `DESCRIPTION:${escapeIcsText("แจ้งเตือนกำหนดการ " + summary)}`,
          "END:VALARM"
        );
      }

      lines.push("END:VEVENT");
    });

    lines.push("END:VCALENDAR");
    return lines.join("\r\n") + "\r\n";
  }

  function getExportFilenameSuffix() {
    const ctx = getActivePersonalContext();
    if (state.myStudent) return `_${state.myStudent.id}_${state.myStudent.area.replace(/\s+/g, "")}`;
    if (ctx.teacherVal) return `_${ctx.teacherVal.replace(/\s+/g, "_")}`;
    if (ctx.siteObj) return `_กลุ่ม${ctx.siteObj.shortName.replace(/\s+/g, "")}`;
    if (ctx.discVal) return `_Disc${ctx.discVal}`;
    return "";
  }

  function getActiveCalendarDisplayName() {
    const ctx = getActivePersonalContext();
    if (state.myStudent) {
      return `RACM 303 (2569) · ${state.myStudent.fullName} (${state.myStudent.area})`;
    }
    if (ctx.teacherVal) {
      return `RACM 303 (2569) · อาจารย์ ${ctx.teacherVal}`;
    }
    if (ctx.siteObj) {
      return `RACM 303 (2569) · กลุ่ม ${ctx.siteObj.hospital}`;
    }
    return "RACM 303 (ปีการศึกษา 2569)";
  }

  function triggerBlobDownload(content, mimeType, filename) {
    const blob = new Blob([content], { type: mimeType });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function downloadScheduleIcs() {
    const sessions = getSessionsForExport();
    const ics = buildIcsCalendarString(sessions, getActiveCalendarDisplayName());
    triggerBlobDownload(ics, "text/calendar;charset=utf-8", `RACM303_2569_Calendar${getExportFilenameSuffix()}.ics`);
  }

  function downloadSingleSessionIcs(session) {
    const ics = buildIcsCalendarString([session], `RACM 303 · ${session.code}`);
    triggerBlobDownload(ics, "text/calendar;charset=utf-8", `RACM303_2569_${session.id}.ics`);
  }

  function csvCell(val) {
    const s = String(val == null ? "" : val).replace(/"/g, '""');
    return `"${s}"`;
  }

  function downloadScheduleGoogleCsv() {
    const sessions = getSessionsForExport();
    const ctx = getActivePersonalContext();
    const header = [
      "Subject",
      "Start Date",
      "Start Time",
      "End Date",
      "End Time",
      "All Day Event",
      "Description",
      "Location",
      "Private"
    ].join(",");

    const rows = [header];
    sessions.forEach((s) => {
      const eff = resolveEffectiveSessionDetails(s, ctx);
      const { description, location } = buildEventDescriptionAndLocation(s, eff);
      const subject = `[RACM 303] ${eff.title}`;
      const startDate = isoToUsDate(eff.startISO);
      const endDate = isoToUsDate(eff.endISO || eff.startISO);
      const startTime = eff.isAllDay ? "" : to12HourAmPm(s.startTime || "09:00");
      const endTime = eff.isAllDay ? "" : to12HourAmPm(s.endTime || "12:00");
      const allDay = eff.isAllDay ? "True" : "False";

      rows.push(
        [
          csvCell(subject),
          csvCell(startDate),
          csvCell(startTime),
          csvCell(endDate),
          csvCell(endTime),
          csvCell(allDay),
          csvCell(description),
          csvCell(location),
          csvCell("False")
        ].join(",")
      );
    });

    const csvContent = "\uFEFF" + rows.join("\r\n") + "\r\n";
    triggerBlobDownload(
      csvContent,
      "text/csv;charset=utf-8",
      `RACM303_2569_GoogleCalendar${getExportFilenameSuffix()}.csv`
    );
  }

  function buildGoogleCalendarTemplateUrl(session) {
    const ctx = getActivePersonalContext();
    const eff = resolveEffectiveSessionDetails(session, ctx);
    const { description, location } = buildEventDescriptionAndLocation(session, eff);

    let datesParam = "";
    if (eff.isAllDay) {
      const d1 = eff.startISO.replace(/-/g, "");
      const d2 = addDaysISO(eff.endISO || eff.startISO, 1).replace(/-/g, "");
      datesParam = `${d1}/${d2}`;
    } else {
      const d1 = eff.startISO.replace(/-/g, "");
      const d2 = (eff.endISO || eff.startISO).replace(/-/g, "");
      const t1 = (session.startTime || "09:00").replace(":", "") + "00";
      const t2 = (session.endTime || "12:00").replace(":", "") + "00";
      datesParam = `${d1}T${t1}/${d2}T${t2}`;
    }

    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: `[RACM 303] ${eff.title}`,
      dates: datesParam,
      ctz: "Asia/Bangkok",
      location: location,
      details: description
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  /* ---------- Roster Navigation Helper from Schedule Sessions ---------- */
  function jumpToClassRoster(session, assignment) {
    const ctxPayload = {
      topic: session.title,
      date: session.dateTH,
      time: session.timeLabel,
      lecturer: assignment.lecturer || session.lecturers,
      room: assignment.room || session.room,
      type: assignment.type,
      groupId: assignment.groupId,
      label: assignment.label
    };

    if (assignment.type === "discussion") {
      state.discContext = ctxPayload;
      if ($("discSearchInput")) $("discSearchInput").value = "";
      if ($("discGroupSelect")) $("discGroupSelect").value = assignment.groupId || "";
      switchTab("discussion");
    } else {
      state.fieldContext = ctxPayload;
      if ($("fieldSearchInput")) $("fieldSearchInput").value = "";
      if ($("fieldAreaSelect")) $("fieldAreaSelect").value = assignment.type === "area" ? (assignment.groupId || "") : "";
      switchTab("fieldwork");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function buildAppsScriptDeepLink(areaVal, discVal) {
    const base = ROSTER.appsScriptUrl;
    if (!base) return "#";
    const params = new URLSearchParams({ page: "students" });
    if (discVal) {
      params.set("type", "discussion");
      params.set("group", discVal);
    } else if (areaVal) {
      params.set("type", "area");
      params.set("group", areaVal);
    }
    return `${base}?${params.toString()}`;
  }

  function syncPhotoToggleButtons() {
    const label = state.showPhotos ? "ซ่อนรูปถ่าย (โหมดกะทัดรัด)" : "แสดงรูปถ่ายนักศึกษา";
    ["discTogglePhotosBtn", "fieldTogglePhotosBtn"].forEach((id) => {
      if ($(id)) $(id).textContent = label;
    });
  }

  function renderStudentCardElement(s, mode) {
    const card = make("article", null, "student-card");
    if (state.myStudent && state.myStudent.id === s.id) {
      card.classList.add("is-my-student");
    }
    const siteId = getSiteIdByAreaName(s.area);
    const initials = studentInitials(s);
    const portrait = make("div", null, `student-portrait${state.showPhotos ? "" : " compact-avatar"}`);
    portrait.dataset.studentId = s.id || "";
    portrait.dataset.photoId = s.photoId || "";
    portrait.dataset.initials = initials;
    portrait.dataset.studentName = s.fullName;
    portrait.innerHTML = `<span class="avatar-monogram">${escapeHtml(initials)}</span>`;
    if (state.showPhotos && (s.id || s.photoId)) {
      if (photoObserver) photoObserver.observe(portrait);
      else mountStudentPhoto(portrait);
    }

    card.appendChild(portrait);
    card.appendChild(make("h3", s.nickname || s.fullName));
    if (s.nickname) card.appendChild(make("p", s.fullName));
    card.appendChild(make("p", `รหัส: ${s.id}${s.program === "MD-M.Eng" ? " (MD-M.Eng)" : ""}`, "sid-mono"));

    const pillWrap = make("div", null, "s-area area-sub-pill-wrap");
    pillWrap.innerHTML = `<span class="area-sub-pill area-site-${siteId}"><i class="area-dot"></i>${siteId}. ${escapeHtml(s.area)}</span>`;

    if (mode === "discussion") {
      const rot = (SCHED.hsRotation || []).find((r) => r.group === s.disc);
      card.appendChild(make("p", `Discussion กลุ่มที่ ${s.disc}${rot ? " · ห้อง " + rot.room : ""}`, "disc-room-line"));
      card.appendChild(pillWrap);
    } else {
      card.appendChild(pillWrap);
      card.appendChild(make("p", `Discussion: กลุ่มที่ ${s.disc}`, "disc-line"));
    }
    return card;
  }

  function buildDiscSiteBreakdownHtml(groupStudents) {
    const counts = new Map();
    groupStudents.forEach((st) => {
      counts.set(st.area, (counts.get(st.area) || 0) + 1);
    });
    return (SCHED.fieldworkSites || [])
      .filter((site) => counts.get(site.shortName))
      .map(
        (site) =>
          `<span class="area-sub-pill sm area-site-${site.id}" title="${escapeHtml(site.hospital)} ${escapeHtml(site.province)}"><i class="area-dot"></i>${site.id}.${escapeHtml(site.shortName)} (${counts.get(site.shortName)})</span>`
      )
      .join("");
  }

  /* ---------- Tab 2: Separated Discussion Group Roster (HS1–HS6 · 6 Groups) ---------- */
  const HS_SLOTS_META = [
    { mod: "HS1", label: "HS1 · พฤ. 26 พ.ย. (08.30–12.00)", docId: "HS1" },
    { mod: "HS2", label: "HS2 · จ. 30 พ.ย. (08.30–12.00)", docId: "HS2" },
    { mod: "HS3", label: "HS3 · จ. 30 พ.ย. (13.30–17.00)", docId: "HS3" },
    { mod: "HS4", label: "HS4 · อ. 1 ธ.ค. (08.30–12.00)", docId: "HS4" },
    { mod: "HS5", label: "HS5 · อ. 1 ธ.ค. (13.30–17.00)", docId: "HS5" },
    { mod: "HS6", label: "HS6 · ศ. 4 ธ.ค. (08.30–12.00)", docId: "HS6" }
  ];

  function initDiscussionControls() {
    const discSel = $("discGroupSelect");
    if (discSel) {
      (SCHED.hsGroups || []).forEach((g) => {
        discSel.add(new Option(`กลุ่มอภิปราย Discussion ที่ ${g.id} · ห้อง ${g.defaultRoom.split(" ")[0]} (${g.count} คน)`, String(g.id)));
      });
      discSel.addEventListener("change", () => {
        state.discContext = null;
        renderDiscussionView();
      });
    }

    const areaSubSel = $("discAreaSubFilter");
    if (areaSubSel) {
      (SCHED.fieldworkSites || []).forEach((site) => {
        areaSubSel.add(new Option(`${site.id}. ${site.shortName} (${site.hospital} ${site.province})`, site.shortName));
      });
      areaSubSel.addEventListener("change", renderDiscussionView);
    }

    if ($("discSearchInput")) {
      $("discSearchInput").addEventListener("input", renderDiscussionView);
    }

    if ($("discClearFiltersBtn")) {
      $("discClearFiltersBtn").addEventListener("click", () => {
        state.discContext = null;
        if ($("discSearchInput")) $("discSearchInput").value = "";
        if (discSel) discSel.value = "";
        if (areaSubSel) areaSubSel.value = "";
        renderDiscussionView();
      });
    }

    if ($("discTogglePhotosBtn")) {
      $("discTogglePhotosBtn").addEventListener("click", () => {
        state.showPhotos = !state.showPhotos;
        syncPhotoToggleButtons();
        renderDiscussionView();
      });
    }

    ["discPrintBtn", "discPrintTopBtn"].forEach((id) => {
      if ($(id)) $(id).addEventListener("click", () => printRosterOnePage("discussion"));
    });

    syncPhotoToggleButtons();
  }

  function renderDiscussionOverviewCards(activeDiscVal) {
    const grid = $("discOverviewGrid");
    if (!grid) return;

    if (!grid.dataset.rendered) {
      grid.dataset.rendered = "1";
      (SCHED.hsGroups || []).forEach((g) => {
        const rot = (SCHED.hsRotation || []).find((r) => r.group === g.id) || {};
        const groupMembers = ROSTER.students.filter((st) => st.disc === g.id);
        const siteMixHtml = buildDiscSiteBreakdownHtml(groupMembers);
        const card = make("div", null, "disc-card");
        card.dataset.discId = String(g.id);
        card.setAttribute("role", "button");
        card.tabIndex = 0;

        const roomNote = g.id === 6 ? "ห้องหลัก 1C1-07 (ยกเว้น HS4 เช้า 1 ธ.ค. ใช้ห้อง 2C2-03)" : g.defaultRoom;
        const instructorsPreview = ["HS1", "HS2", "HS3", "HS4", "HS5", "HS6"]
          .map((m) => `${m}: ${(rot[m] && rot[m].instructor) || "-"}`)
          .slice(0, 3)
          .join(" · ");

        card.innerHTML = `
          <div class="disc-card-head">
            <h3>กลุ่มที่ ${g.id}</h3>
            <span class="badge cat-HS">${g.count} คน</span>
          </div>
          <p class="disc-meta"><strong>ห้องเรียน:</strong> ${escapeHtml(roomNote)}</p>
          <p class="disc-meta">${escapeHtml(instructorsPreview)} ฯลฯ</p>
          <div class="disc-site-mix">${siteMixHtml}</div>
          <div class="disc-card-foot" data-disc-foot="${g.id}">คลิกเพื่อดูสมาชิกกลุ่มที่ ${g.id} &amp; ตารางอาจารย์ HS1–HS6 →</div>
        `;

        const selectGroup = () => {
          const sel = $("discGroupSelect");
          if (!sel) return;
          sel.value = sel.value === String(g.id) ? "" : String(g.id);
          state.discContext = null;
          renderDiscussionView();
        };
        card.addEventListener("click", selectGroup);
        card.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            selectGroup();
          }
        });
        grid.appendChild(card);
      });
    }

    const myDisc = state.myStudent ? String(state.myStudent.disc) : "";
    grid.querySelectorAll(".disc-card").forEach((c) => {
      const id = c.dataset.discId;
      const isSelected = id === activeDiscVal;
      const isMine = myDisc && id === myDisc;
      c.classList.toggle("active-disc", isSelected);
      const foot = c.querySelector("[data-disc-foot]");
      if (foot) {
        if (isSelected) {
          foot.textContent = `✓ กำลังแสดงสมาชิกกลุ่มที่ ${id} (คลิกซ้ำเพื่อดูครบทั้ง 6 กลุ่ม)`;
        } else if (isMine) {
          foot.textContent = `★ กลุ่ม Discussion ของฉัน · คลิกเพื่อดูสมาชิกและอาจารย์ HS1–HS6`;
        } else {
          foot.textContent = `คลิกเพื่อดูสมาชิกกลุ่มที่ ${id} & ตารางอาจารย์ HS1–HS6 →`;
        }
      }
    });
  }

  function renderDiscussionAreaLegendBar(discVal, activeAreaVal) {
    const bar = $("discAreaLegendBar");
    if (!bar) return;
    bar.replaceChildren();

    const scoped = ROSTER.students.filter((s) => !discVal || String(s.disc) === discVal);
    const counts = new Map();
    scoped.forEach((s) => counts.set(s.area, (counts.get(s.area) || 0) + 1));

    const allBtn = make(
      "button",
      `ทุกพื้นที่ (${scoped.length})`,
      `area-filter-pill area-all${!activeAreaVal ? " is-active" : ""}`
    );
    allBtn.type = "button";
    allBtn.addEventListener("click", () => {
      if ($("discAreaSubFilter")) $("discAreaSubFilter").value = "";
      renderDiscussionView();
    });
    bar.appendChild(allBtn);

    (SCHED.fieldworkSites || []).forEach((site) => {
      const cnt = counts.get(site.shortName) || 0;
      const pill = make(
        "button",
        null,
        `area-filter-pill area-site-${site.id}${activeAreaVal === site.shortName ? " is-active" : ""}${cnt === 0 ? " is-zero" : ""}`
      );
      pill.type = "button";
      pill.title = `คลิกเพื่อกรองเฉพาะสมาชิกกลุ่มพื้นที่ ${site.hospital} ${site.province}`;
      pill.innerHTML = `<i class="area-dot"></i><span>${site.id}. ${escapeHtml(site.shortName)}</span><strong class="pill-cnt">${cnt}</strong>`;
      pill.addEventListener("click", () => {
        const sel = $("discAreaSubFilter");
        if (!sel) return;
        sel.value = sel.value === site.shortName ? "" : site.shortName;
        renderDiscussionView();
      });
      bar.appendChild(pill);
    });
  }

  function renderDiscussionRotationBanner(activeDiscVal) {
    const box = $("discRotationDetailBox");
    if (!box) return;
    if (!activeDiscVal) {
      box.hidden = true;
      box.replaceChildren();
      return;
    }

    const rot = (SCHED.hsRotation || []).find((r) => String(r.group) === activeDiscVal);
    if (!rot) {
      box.hidden = true;
      return;
    }

    box.hidden = false;
    box.replaceChildren();

    const head = make("div", null, "section-header");
    head.style.marginBottom = "4px";
    const left = make("div");
    left.append(
      make("h3", `ตารางหมุนเวียนอาจารย์และห้องเรียนประจำกลุ่มอภิปรายที่ ${rot.group} (${rot.count} คน · ห้องหลัก ${rot.room})`),
      make(
        "p",
        rot.group === 6
          ? "หมายเหตุสำคัญ: เช้าวันอังคารที่ 1 ธ.ค. 2569 (HS4) กลุ่มที่ 6 ย้ายไปเรียนที่ห้อง 2C2-03 ชั่วคราว และช่วงบ่าย (HS5) กลับมาใช้ห้อง 1C1-07 ตามปกติ"
          : `สมาชิกกลุ่มอภิปรายที่ ${rot.group} ใช้ห้อง ${rot.room} ชั้น 1 อาคารพรีคลินิก ตลอดทั้งคาบ HS1–HS6`
      )
    );
    const showAllBtn = make("button", "ดูสมาชิกครบทั้ง 6 กลุ่ม (169 คน)", "btn sm");
    showAllBtn.type = "button";
    showAllBtn.addEventListener("click", () => {
      if ($("discGroupSelect")) $("discGroupSelect").value = "";
      state.discContext = null;
      renderDiscussionView();
    });
    head.append(left, showAllBtn);
    box.appendChild(head);

    const slotsGrid = make("div", null, "disc-rot-slots");
    HS_SLOTS_META.forEach((slotMeta) => {
      const cell = rot[slotMeta.mod] || {};
      const slot = make("div", null, "disc-rot-slot");
      slot.appendChild(make("span", slotMeta.label, "slot-code"));
      slot.appendChild(make("span", cell.instructor || "-", "slot-inst"));
      slot.appendChild(
        make("span", `ห้อง ${cell.room || rot.room}`, `slot-room${cell.highlightRoom ? " room-changed" : ""}`)
      );
      const readBtn = make("button", `เปิดบทเรียน ${slotMeta.mod} →`, "btn sm");
      readBtn.type = "button";
      readBtn.style.marginTop = "6px";
      readBtn.addEventListener("click", () => openTextbookDoc(slotMeta.docId));
      slot.appendChild(readBtn);
      slotsGrid.appendChild(slot);
    });
    box.appendChild(slotsGrid);
  }

  function renderDiscussionView() {
    const discVal = ($("discGroupSelect") && $("discGroupSelect").value) || "";
    const areaSubVal = ($("discAreaSubFilter") && $("discAreaSubFilter").value) || "";
    const q = (($("discSearchInput") && $("discSearchInput").value) || "").trim().toLocaleLowerCase("th");

    renderDiscussionOverviewCards(discVal);
    renderDiscussionRotationBanner(discVal);
    renderDiscussionAreaLegendBar(discVal, areaSubVal);

    const ctxBox = $("discContextBanner");
    if (ctxBox) {
      ctxBox.replaceChildren();
      ctxBox.hidden = !state.discContext;
      if (state.discContext) {
        const c = state.discContext;
        const left = make("div");
        left.append(
          make("h3", c.topic),
          make("p", `${c.date} · ${c.time} · ห้อง: ${c.room}`),
          make("p", `อาจารย์ประจำกลุ่ม: ${c.lecturer} · ${c.label}`)
        );
        const right = make("div", null, "header-actions");
        const backBtn = make("button", "กลับไปปฏิทินสอน", "btn sm");
        backBtn.type = "button";
        backBtn.addEventListener("click", () => switchTab("schedule"));
        const gasLink = make("a", "เปิดดูรูปถ่ายใน Apps Script ↗", "btn sm teal");
        gasLink.href = buildAppsScriptDeepLink("", discVal || c.groupId);
        gasLink.target = "_blank";
        gasLink.rel = "noopener";
        right.append(backBtn, gasLink);
        ctxBox.append(left, right);
      }
    }

    const gasTop = $("openAppsScriptDiscBtn");
    if (gasTop) gasTop.href = buildAppsScriptDeepLink("", discVal || "1");

    const list = ROSTER.students.filter((s) => {
      if (discVal && String(s.disc) !== discVal) return false;
      if (areaSubVal && s.area !== areaSubVal) return false;
      if (q) {
        const hay = `${s.id} ${s.fullName} ${s.nickname} discussion กลุ่มที่ ${s.disc} ${s.area}`.toLocaleLowerCase("th");
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => a.disc - b.disc || compareTH(a.id, b.id));
    state.visibleDiscStudents = list;

    const rotObj = discVal ? (SCHED.hsRotation || []).find((r) => String(r.group) === discVal) : null;
    const baseLabel = discVal
      ? `สมาชิกกลุ่มอภิปราย Discussion ที่ ${discVal}${rotObj ? " (ห้องหลัก " + rotObj.room + ")" : ""}`
      : "สมาชิกกลุ่มอภิปราย Discussion ทั้ง 6 กลุ่มย่อย";
    const selectionLabel = areaSubVal ? `${baseLabel} · เฉพาะสังกัดพื้นที่ ${areaSubVal}` : baseLabel;

    if ($("discStatusText")) {
      $("discStatusText").textContent = `${selectionLabel} · แสดง ${list.length} คน จากทั้งหมด ${ROSTER.students.length} คน`;
    }
    ["discPrintBtn", "discPrintTopBtn"].forEach((id) => {
      if ($(id)) $(id).disabled = list.length === 0;
    });

    const printHeading = $("discPrintHeading");
    if (printHeading) {
      printHeading.replaceChildren(make("strong", `RACM 303 (ปีการศึกษา 2569) · ${selectionLabel} · ${list.length} คน`));
      if (state.discContext) {
        printHeading.append(
          make("div", state.discContext.topic),
          make("div", `${state.discContext.date} · ${state.discContext.time} · ห้อง ${state.discContext.room} · อาจารย์: ${state.discContext.lecturer}`)
        );
      } else if (rotObj) {
        const instSummary = HS_SLOTS_META.map((m) => `${m.mod}: ${(rotObj[m.mod] && rotObj[m.mod].instructor) || "-"}`).join(" | ");
        printHeading.appendChild(make("div", instSummary));
      }
    }

    const cardsEl = $("discCardsContainer");
    if (!cardsEl) return;
    if (photoObserver) photoObserver.disconnect();
    cardsEl.replaceChildren();

    if (!list.length) {
      cardsEl.appendChild(make("div", "ไม่พบรายชื่อสมาชิกกลุ่ม Discussion ที่ตรงกับเงื่อนไขที่เลือก", "empty-state"));
      return;
    }

    let lastDisc = null;
    list.forEach((s) => {
      if (!discVal && s.disc !== lastDisc) {
        lastDisc = s.disc;
        const gMeta = (SCHED.hsGroups || []).find((g) => g.id === s.disc);
        const rMeta = (SCHED.hsRotation || []).find((r) => r.group === s.disc);
        const groupMembers = list.filter((st) => st.disc === s.disc);
        const h = make("div", null, "area-group-header");
        const instLine = rMeta
          ? HS_SLOTS_META.map((m) => `${m.mod}: ${(rMeta[m.mod] && rMeta[m.mod].instructor) || "-"}`).join(" · ")
          : "";
        const leftCol = make("div", null, "area-group-title-col");
        leftCol.append(
          make("h3", `กลุ่มอภิปราย Discussion ที่ ${s.disc} (${gMeta ? gMeta.count : ""} คน · ห้อง ${gMeta ? gMeta.defaultRoom : ""})`),
          make("p", `อาจารย์ประจำกลุ่มหมุนเวียน — ${instLine}`)
        );
        const mixRow = make("div", null, "disc-header-site-pills");
        mixRow.innerHTML = buildDiscSiteBreakdownHtml(groupMembers);
        h.append(leftCol, mixRow);
        cardsEl.appendChild(h);
      }
      cardsEl.appendChild(renderStudentCardElement(s, "discussion"));
    });
  }

  /* ---------- Tab 3: Separated 9 Fieldwork Sites & Community Hospital Roster ---------- */
  function initFieldworkControls() {
    const areaSel = $("fieldAreaSelect");
    if (areaSel) {
      (SCHED.fieldworkSites || []).forEach((s) => {
        areaSel.add(new Option(`${s.id}. ${s.shortName} (${s.hospital} ${s.province}) · ${s.advisors} (${s.count} คน)`, s.shortName));
      });
      areaSel.addEventListener("change", () => {
        state.fieldContext = null;
        renderFieldworkView();
      });
    }

    if ($("fieldSearchInput")) {
      $("fieldSearchInput").addEventListener("input", renderFieldworkView);
    }

    if ($("fieldClearFiltersBtn")) {
      $("fieldClearFiltersBtn").addEventListener("click", () => {
        state.fieldContext = null;
        if ($("fieldSearchInput")) $("fieldSearchInput").value = "";
        if (areaSel) areaSel.value = "";
        renderFieldworkView();
      });
    }

    if ($("fieldTogglePhotosBtn")) {
      $("fieldTogglePhotosBtn").addEventListener("click", () => {
        state.showPhotos = !state.showPhotos;
        syncPhotoToggleButtons();
        renderFieldworkView();
      });
    }

    const toggleSitesBtn = $("toggleSitesOverviewBtn");
    if (toggleSitesBtn) {
      toggleSitesBtn.addEventListener("click", () => {
        state.showSitesOverview = !state.showSitesOverview;
        if ($("sitesOverviewGrid")) $("sitesOverviewGrid").hidden = !state.showSitesOverview;
        toggleSitesBtn.textContent = state.showSitesOverview
          ? "ซ่อนการ์ดข้อมูล 9 พื้นที่"
          : "แสดงการ์ดข้อมูล 9 พื้นที่ภาคสนาม";
      });
    }

    ["fieldPrintBtn", "fieldPrintTopBtn"].forEach((id) => {
      if ($(id)) $(id).addEventListener("click", () => printRosterOnePage("fieldwork"));
    });

    syncPhotoToggleButtons();
  }

  function renderFieldworkView() {
    const areaVal = ($("fieldAreaSelect") && $("fieldAreaSelect").value) || "";
    const q = (($("fieldSearchInput") && $("fieldSearchInput").value) || "").trim().toLocaleLowerCase("th");

    const sitesGrid = $("sitesOverviewGrid");
    if (sitesGrid && !sitesGrid.dataset.rendered) {
      sitesGrid.dataset.rendered = "1";
      sitesGrid.hidden = !state.showSitesOverview;
      (SCHED.fieldworkSites || []).forEach((site) => {
        const c = make("div", null, "site-card");
        c.dataset.siteName = site.shortName;
        const friBadge = site.hasFri11Dec
          ? `<span class="badge cat-HS">ศ. 11 ธ.ค. มีเรียนกลุ่มย่อย 5–6</span>`
          : `<span class="badge">เดินทาง พฤ. 10 ธ.ค. (ไม่มีเรียน 11 ธ.ค.)</span>`;
        const staffLine =
          ROLE === "faculty" && site.staffRef
            ? `<p class="site-meta"><strong>เจ้าหน้าที่ประสานงาน:</strong> ${escapeHtml(site.staffRef)}</p>`
            : "";

        c.innerHTML = `
          <div class="site-card-head">
            <h3>${site.id}. ${escapeHtml(site.shortName)}</h3>
            <span class="badge cat-SG">${site.count} คน</span>
          </div>
          <p class="site-meta"><strong>${escapeHtml(site.hospital)}</strong> (${escapeHtml(site.province)})</p>
          <p class="site-meta"><strong>อ.ที่ปรึกษา:</strong> ${escapeHtml(site.advisors)}</p>
          <p class="site-meta"><strong>ห้องประชุมกลุ่มย่อย:</strong> ${escapeHtml(site.room)}</p>
          <p class="site-meta"><strong>ช่วงฝึกภาคสนาม:</strong> ${escapeHtml(site.datesTH)}</p>
          <p class="site-meta">${escapeHtml(site.travelNote)}</p>
          ${staffLine}
          <div style="margin-top:6px">${friBadge}</div>
        `;

        const actRow = make("div", null, "header-actions");
        actRow.style.marginTop = "10px";

        const filterBtn = make("button", `ดูรายชื่อกลุ่ม ${site.shortName}`, "btn sm primary");
        filterBtn.type = "button";
        filterBtn.addEventListener("click", () => {
          const sel = $("fieldAreaSelect");
          if (sel) sel.value = sel.value === site.shortName ? "" : site.shortName;
          state.fieldContext = null;
          renderFieldworkView();
          const target = $("fieldCardsContainer");
          if (target && sel && sel.value) target.scrollIntoView({ behavior: "smooth", block: "start" });
        });

        const icsLink = make("a", "ปฏิทิน .ics กลุ่มนี้", "btn sm teal");
        icsLink.href = `calendars/group_${site.id}_${site.slug}.ics`;
        icsLink.setAttribute("download", `RACM303_2569_group_${site.id}_${site.slug}.ics`);

        actRow.append(filterBtn, icsLink);
        c.appendChild(actRow);
        sitesGrid.appendChild(c);
      });
    }

    if (sitesGrid) {
      sitesGrid.hidden = !state.showSitesOverview;
      sitesGrid.querySelectorAll(".site-card").forEach((c) => {
        c.classList.toggle("active-site", c.dataset.siteName === areaVal);
      });
    }

    const ctxBox = $("fieldContextBanner");
    if (ctxBox) {
      ctxBox.replaceChildren();
      ctxBox.hidden = !state.fieldContext;
      if (state.fieldContext) {
        const c = state.fieldContext;
        const left = make("div");
        left.append(
          make("h3", c.topic),
          make("p", `${c.date} · ${c.time} · ห้อง/สถานที่: ${c.room}`),
          make("p", `ผู้สอน/อ.ที่ปรึกษา: ${c.lecturer} · ${c.label}`)
        );
        const right = make("div", null, "header-actions");
        const backBtn = make("button", "กลับไปปฏิทินสอน", "btn sm");
        backBtn.type = "button";
        backBtn.addEventListener("click", () => switchTab("schedule"));
        const gasLink = make("a", "เปิดดูรูปถ่ายใน Apps Script ↗", "btn sm teal");
        gasLink.href = buildAppsScriptDeepLink(areaVal, "");
        gasLink.target = "_blank";
        gasLink.rel = "noopener";
        right.append(backBtn, gasLink);
        ctxBox.append(left, right);
      }
    }

    const topGasBtn = $("openAppsScriptFieldBtn");
    if (topGasBtn) topGasBtn.href = buildAppsScriptDeepLink(areaVal, "");

    const siteOrder = new Map((SCHED.fieldworkSites || []).map((s, idx) => [s.shortName, idx]));
    const list = ROSTER.students.filter((s) => {
      if (areaVal && s.area !== areaVal) return false;
      if (q) {
        const hay = `${s.id} ${s.fullName} ${s.nickname} ${s.area} ${s.advisor}`.toLocaleLowerCase("th");
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      const oa = siteOrder.has(a.area) ? siteOrder.get(a.area) : 99;
      const ob = siteOrder.has(b.area) ? siteOrder.get(b.area) : 99;
      return oa - ob || compareTH(a.id, b.id);
    });
    state.visibleFieldStudents = list;

    const activeSiteObj = areaVal ? (SCHED.fieldworkSites || []).find((x) => x.shortName === areaVal) : null;
    const selectionLabel = activeSiteObj
      ? `กลุ่มพื้นที่ ${activeSiteObj.shortName} (${activeSiteObj.hospital} ${activeSiteObj.province})`
      : "นักศึกษาแพทย์ชั้นปีที่ 3 ทั้ง 9 พื้นที่ภาคสนาม";

    if ($("fieldStatusText")) {
      $("fieldStatusText").textContent = `${selectionLabel} · แสดง ${list.length} คน จากทั้งหมด ${ROSTER.students.length} คน`;
    }
    ["fieldPrintBtn", "fieldPrintTopBtn"].forEach((id) => {
      if ($(id)) $(id).disabled = list.length === 0;
    });

    const printHeading = $("fieldPrintHeading");
    if (printHeading) {
      printHeading.replaceChildren(make("strong", `RACM 303 (ปีการศึกษา 2569) · ${selectionLabel} · ${list.length} คน`));
      if (state.fieldContext) {
        printHeading.append(
          make("div", state.fieldContext.topic),
          make("div", `${state.fieldContext.date} · ${state.fieldContext.time} · ${state.fieldContext.room}`)
        );
      } else if (activeSiteObj) {
        printHeading.appendChild(
          make("div", `อาจารย์ที่ปรึกษา: ${activeSiteObj.advisors} · ห้องกลุ่มย่อย: ${activeSiteObj.room} · ช่วงฝึก: ${activeSiteObj.datesTH}`)
        );
      }
    }

    const cardsEl = $("fieldCardsContainer");
    if (!cardsEl) return;
    if (photoObserver) photoObserver.disconnect();
    cardsEl.replaceChildren();

    if (!list.length) {
      cardsEl.appendChild(make("div", "ไม่พบรายชื่อนักศึกษาในกลุ่มพื้นที่ภาคสนามตามเงื่อนไขที่เลือก", "empty-state"));
      return;
    }

    let lastArea = null;
    list.forEach((s) => {
      if (!areaVal && s.area !== lastArea) {
        lastArea = s.area;
        const siteObj = (SCHED.fieldworkSites || []).find((x) => x.shortName === s.area);
        const h = make("div", null, "area-group-header");
        h.append(
          make("h3", `${siteObj ? siteObj.id + ". " : ""}กลุ่มพื้นที่ ${s.area}${siteObj ? " (" + siteObj.hospital + " " + siteObj.province + " · " + siteObj.count + " คน)" : ""}`),
          make("p", `อาจารย์ที่ปรึกษา: ${s.advisor}${siteObj ? " · ห้อง " + siteObj.room + " · " + siteObj.datesTH : ""}`)
        );
        cardsEl.appendChild(h);
      }
      cardsEl.appendChild(renderStudentCardElement(s, "fieldwork"));
    });
  }

  /* ---------- Shared 1-Page A4 Auto-Fit Roster Printing ---------- */
  function computePrintLayout(count) {
    const cols = count <= 20 ? 4 : count <= 40 ? 5 : count <= 60 ? 6 : Math.ceil(Math.sqrt(count * 0.76));
    const rows = Math.max(1, Math.ceil(count / cols));
    const height = Math.min(58, (250 - (rows - 1) * 1.5) / rows);
    return {
      cols,
      rows,
      height,
      photo: state.showPhotos ? height * 0.54 : height * 0.28,
      title: Math.min(10.5, height * 0.23),
      text: Math.min(8, height * 0.18)
    };
  }

  function fitPrintRoster(mode) {
    const targetMode = mode || (state.activeTab === "discussion" ? "discussion" : "fieldwork");
    const list = targetMode === "discussion" ? state.visibleDiscStudents : state.visibleFieldStudents;
    const layout = computePrintLayout((list && list.length) || 1);
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--pc", String(layout.cols));
    rootStyle.setProperty("--pr", `${layout.height}mm`);
    rootStyle.setProperty("--pp", `${layout.photo}mm`);
    rootStyle.setProperty("--pt", `${layout.title}pt`);
    rootStyle.setProperty("--pb", `${layout.text}pt`);
  }

  async function printRosterOnePage(mode) {
    const targetMode = mode === "discussion" ? "discussion" : "fieldwork";
    const list = targetMode === "discussion" ? state.visibleDiscStudents : state.visibleFieldStudents;
    if (!list || !list.length) return;

    document.body.classList.add("print-students-mode");
    document.body.classList.toggle("print-disc-mode", targetMode === "discussion");

    const containerSelector = targetMode === "discussion" ? "#discCardsContainer" : "#fieldCardsContainer";
    if (state.showPhotos) {
      document.querySelectorAll(`${containerSelector} .student-portrait`).forEach((box) => {
        if (!box.querySelector("img") && (box.dataset.studentId || box.dataset.photoId)) mountStudentPhoto(box);
      });
    }
    fitPrintRoster(targetMode);
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) {}
    }
    window.print();
  }

  /* ---------- Tab 4: Separated Submissions Hub & RAMED E-learning Backend Integration ---------- */
  const COURSE_DELIVERABLES = [
    {
      id: "srn1",
      code: "SRN 1",
      scopeBadge: "งานเดี่ยว · PDF ≤ 5 หน้า A4",
      title: "บันทึกการเรียนรู้สะท้อนคิด ครั้งที่ 1 (Self-Reflection Note 1)",
      dueTH: "วันพุธที่ 9 ธันวาคม 2569 · ภายในเวลา 17.00 น.",
      dueISO: "2026-12-09T17:00:00+07:00",
      sessionId: "w3-d3-srn1",
      backendType: "ramed",
      backendLabel: ROLE === "faculty" ? "ตรวจ SRN 1 ในห้องวิชา id=398 ↗" : "ส่งในห้องวิชา RACM 303 (id=398) ↗",
      prereq: "เงื่อนไขก่อนส่ง: ต้องทำแบบประเมินการเรียนการสอนภาคทฤษฎี (Online) ให้เรียบร้อยก่อนอัปโหลดไฟล์ PDF · อาจารย์ที่ปรึกษาตรวจประเมินตามฟอร์ม 1A และให้ Feedback ระหว่างฝึกภาคสนาม",
      manualChapterId: "man-ch-11",
      manualBtnLabel: "เกณฑ์การเขียน SRN (บทที่ 11)",
      srnRound: "SRN1"
    },
    {
      id: "srn2",
      code: "SRN 2",
      scopeBadge: "งานเดี่ยว · PDF ≤ 5 หน้า A4",
      title: "บันทึกการเรียนรู้สะท้อนคิด ครั้งที่ 2 (Self-Reflection Note 2)",
      dueTH: "วันพุธที่ 30 ธันวาคม 2569 · ภายในเวลา 17.00 น.",
      dueISO: "2026-12-30T17:00:00+07:00",
      sessionId: "w6-d3-srn2",
      backendType: "ramed",
      backendLabel: ROLE === "faculty" ? "ตรวจ SRN 2 ในห้องวิชา id=398 ↗" : "ส่งในห้องวิชา RACM 303 (id=398) ↗",
      prereq: "เงื่อนไขก่อนส่ง: ทำแบบประเมินพฤติกรรมเพื่อนร่วมกลุ่ม (Peer Evaluation) และแบบประเมินรายวิชาออนไลน์ให้ครบถ้วนก่อนส่งงานในระบบ E-learning",
      manualChapterId: "man-ch-11",
      manualBtnLabel: "เกณฑ์ SRN & กำหนดส่ง (บทที่ 11)",
      srnRound: "SRN2"
    },
    {
      id: "field_slides",
      code: "SLIDES 3A & 4A",
      scopeBadge: "งานกลุ่ม · 9 พื้นที่ภาคสนาม",
      title: "ไฟล์สไลด์นำเสนอการเรียนรู้ภาคสนาม 2 เรื่อง (ระบบสุขภาพ ฟอร์ม 3A & ระบาดวิทยา ฟอร์ม 4A)",
      dueTH: "วันพุธที่ 30 ธันวาคม 2569 · ภายในเวลา 17.00 น. (ลงไฟล์หน้าห้อง 2C2-03 เวลา 08.00–08.30 น. วันนำเสนอ)",
      dueISO: "2026-12-30T17:00:00+07:00",
      sessionId: "w6-d3-srn2",
      backendType: "gform",
      backendLabel: "ส่งสไลด์ทาง Google Form ปี 2569 ↗",
      prereq: "อ. 29 ธ.ค. 69 นำเสนอระบบสุขภาพ (พูด ≤ 10 นาที + อภิปราย 20 นาที) · พ. 30 ธ.ค. 69 นำเสนอระบาดวิทยา (พูด ≤ 7 นาที + อภิปราย 18 นาที) ณ ห้อง 2C2-03",
      manualChapterId: "man-ch-16",
      manualBtnLabel: "เกณฑ์นำเสนอ 3A & 4A (บทที่ 16–17)",
      srnRound: null
    },
    {
      id: "health_survey",
      code: "HEALTH SURVEY",
      scopeBadge: "งานกลุ่ม · 9 พื้นที่ภาคสนาม",
      title: "แบบสอบถามและฐานข้อมูลการสำรวจปัญหาสุขภาพชุมชน (Health Survey)",
      dueTH: "วันพุธที่ 30 ธันวาคม 2569 · ภายในเวลา 17.00 น.",
      dueISO: "2026-12-30T17:00:00+07:00",
      sessionId: "w6-d3-srn2",
      backendType: "gform",
      backendLabel: "ส่ง Health Survey ทาง Google Form ↗",
      prereq: "รวบรวมไฟล์แบบสอบถาม (Questionnaire) และชุดข้อมูลจากการศึกษาเชิงปริมาณของกลุ่มพื้นที่ภาคสนาม ส่งพร้อมสไลด์นำเสนอภายในเวลา 17.00 น.",
      manualChapterId: "man-ch-17",
      manualBtnLabel: "แนวทางระบาดวิทยาภาคสนาม (บทที่ 17)",
      srnRound: null
    }
  ];

  function getActiveRamedTargetUrl() {
    return state.pinnedRamedUrl || RAMED_COURSE_URL;
  }

  function isValidRamedUrl(rawUrl) {
    try {
      const u = new URL(String(rawUrl || "").trim());
      return u.protocol === "https:" && u.hostname === "elearning.ra.mahidol.ac.th" && u.pathname.startsWith("/ramed/");
    } catch (_) {
      return false;
    }
  }

  function syncPinnedRamedCourseUI() {
    const pinnedBtn = $("openPinnedRamedCourseBtn");
    const clearBtn = $("clearRamedCustomUrlBtn");
    const input = $("ramedCustomCourseUrlInput");
    const feedback = $("ramedPinFeedback");

    const validPinned = isValidRamedUrl(state.pinnedRamedUrl) ? state.pinnedRamedUrl : "";
    state.pinnedRamedUrl = validPinned;

    if (input && document.activeElement !== input) {
      input.value = validPinned;
    }
    if (pinnedBtn) {
      pinnedBtn.hidden = !validPinned;
      pinnedBtn.href = validPinned || RAMED_COURSE_URL;
    }
    if (clearBtn) {
      clearBtn.hidden = !validPinned;
    }
    if (feedback && validPinned) {
      feedback.textContent = `✓ ปักหมุดลิงก์ย่อยเรียบร้อยแล้ว: ${validPinned}`;
    }
  }

  async function checkRamedBackendReachability() {
    const badge = $("ramedBackendStatusBadge");
    if (!badge || state.ramedPinged) return;
    state.ramedPinged = true;

    if (typeof fetch !== "function") {
      badge.className = "elearning-status-pill is-online";
      badge.textContent = "● เชื่อมต่อห้องวิชา 3/2569 RACM 303 (course/view.php?id=398) พร้อมใช้งาน";
      return;
    }

    badge.className = "elearning-status-pill is-checking";
    badge.textContent = "● กำลังตรวจสอบการเชื่อมต่อห้องวิชา id=398…";

    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 6500) : null;
    try {
      await fetch(RAMED_COURSE_URL, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        signal: ctrl ? ctrl.signal : undefined
      });
      if (timer) clearTimeout(timer);
      badge.className = "elearning-status-pill is-online";
      badge.textContent = "● เชื่อมต่อห้องวิชาออนไลน์แล้ว (3/2569 RACM 303 · id=398)";
    } catch (_) {
      if (timer) clearTimeout(timer);
      badge.className = "elearning-status-pill is-checking";
      badge.textContent = "● ลิงก์ห้องวิชา id=398 พร้อมใช้งาน (คลิกเข้าสู่ระบบตามสิทธิ์ Login)";
    }
  }

  function sanitizeFilenamePart(str) {
    return String(str || "")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ");
  }

  function updateSrnFilename() {
    const round = ($("srnRoundSelect") && $("srnRoundSelect").value) || "SRN1";
    const area = sanitizeFilenamePart(($("srnAreaSelect") && $("srnAreaSelect").value) || "กุฉินารายณ์");
    const sid = sanitizeFilenamePart(($("srnStudentId") && $("srnStudentId").value) || "") || "6702xxx";
    const sname = sanitizeFilenamePart(($("srnStudentName") && $("srnStudentName").value) || "") || "ชื่อ-นามสกุล";
    const finalName = `${round}_${area}_${sid}_${sname}.pdf`;
    const preview = $("srnFilenamePreview");
    if (preview) preview.textContent = finalName;
    if ($("downloadRenamedPdfBtn") && state.inspectedPdfBytes) {
      $("downloadRenamedPdfBtn").textContent = `ดาวน์โหลด "${finalName}"`;
    }
    return finalName;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  async function inspectSrnPdfFile(file) {
    const resBox = $("srnPdfCheckResult");
    const dlBtn = $("downloadRenamedPdfBtn");
    if (!file || !resBox) return;

    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const headAscii = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(1024, bytes.length)));

      if (!headAscii.includes("%PDF-")) {
        state.inspectedPdfBytes = null;
        state.inspectedPdfOrigName = "";
        if (dlBtn) dlBtn.hidden = true;
        resBox.hidden = false;
        resBox.className = "pdf-check-result is-error";
        resBox.innerHTML = `<strong>✗ ไฟล์ "${escapeHtml(file.name)}" ไม่ใช่ไฟล์ PDF มาตรฐาน</strong><br>กรุณาบันทึกหรือ Export เอกสารจาก Word / Google Docs / Goodnotes เป็นนามสกุล <code>.pdf</code> ก่อนส่งขึ้นระบบ RAMED E-learning`;
        return;
      }

      const fullLatin1 = new TextDecoder("latin1").decode(bytes);
      const pageMatches = fullLatin1.match(/\/Type\s*\/Page\b(?!s)/g);
      const estPages = pageMatches ? pageMatches.length : null;
      const sizeStr = formatFileSize(bytes.length);
      const targetName = updateSrnFilename();

      state.inspectedPdfBytes = bytes;
      state.inspectedPdfOrigName = file.name;
      if (dlBtn) {
        dlBtn.hidden = false;
        dlBtn.textContent = `ดาวน์โหลด "${targetName}"`;
      }

      resBox.hidden = false;
      if (estPages && estPages > 5) {
        resBox.className = "pdf-check-result is-warn";
        resBox.innerHTML =
          `<strong>⚠ ตรวจพบความยาวประมาณ ${estPages} หน้า (ขนาด ${escapeHtml(sizeStr)})</strong><br>` +
          `คู่มือรายวิชากำหนดความยาว SRN <strong>ไม่เกิน 5 หน้ากระดาษ A4</strong> — แนะนำให้ปรับลดจำนวนหน้าก่อนอัปโหลด หรือกดปุ่มด้านบนเพื่อบันทึกเป็นชื่อ <code>${escapeHtml(targetName)}</code>`;
      } else {
        const pageInfo = estPages ? `จำนวน ${estPages} หน้า (ผ่านเกณฑ์ ≤ 5 หน้า A4)` : "รูปแบบ PDF มาตรฐาน";
        resBox.className = "pdf-check-result is-ok";
        resBox.innerHTML =
          `<strong>✓ ไฟล์ PDF พร้อมส่ง · ${escapeHtml(pageInfo)} · ขนาด ${escapeHtml(sizeStr)}</strong><br>` +
          `กดปุ่ม <strong>ดาวน์โหลด "${escapeHtml(targetName)}"</strong> เพื่อรับไฟล์ที่ตั้งชื่อถูกต้องครบถ้วน แล้วลากวางในหน้าต่าง RAMED E-learning ได้ทันที`;
      }
    } catch (_) {
      resBox.hidden = false;
      resBox.className = "pdf-check-result is-error";
      resBox.textContent = "ไม่สามารถอ่านไฟล์ที่เลือกได้ กรุณาลองเลือกไฟล์ .pdf อีกครั้ง";
    }
  }

  function openManualChapter(chapterId) {
    state.manualChapterId = chapterId || "ALL";
    if ($("manualSearchInput")) $("manualSearchInput").value = "";
    switchTab("manual");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function computeDeadlineCountdownBadge(dueISO, isSubmitted) {
    if (isSubmitted) {
      return { text: "✓ บันทึกว่าส่งเรียบร้อยแล้ว", cls: "badge cat-HS" };
    }
    const now = Date.now();
    const due = new Date(dueISO).getTime();
    if (!Number.isFinite(due)) return { text: "กำหนดส่งตามตาราง", cls: "badge" };
    const diffMs = due - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffMs < 0) {
      return { text: "ปิดรับตามกำหนดเวลาแล้ว", cls: "badge" };
    }
    if (diffDays <= 3) {
      return { text: `ด่วน · เหลืออีก ${Math.max(0, diffDays)} วัน`, cls: "badge cat-EXAM" };
    }
    return { text: `กำหนดส่งในอีก ${diffDays} วัน`, cls: "badge cat-SG" };
  }

  function renderDeliverablesCards() {
    const grid = $("deliverablesCardsGrid");
    if (!grid) return;
    grid.replaceChildren();

    COURSE_DELIVERABLES.forEach((d) => {
      const isDone = Boolean(state.submittedMap[d.id]);
      const card = make("article", null, `deliverable-card${isDone ? " is-submitted" : ""}`);

      const head = make("div", null, "deliverable-head");
      const badges = make("div", null, "session-badges");
      badges.append(
        make("span", d.code, `badge ${d.backendType === "ramed" ? "cat-EXAM" : "cat-SG"}`),
        make("span", d.scopeBadge, "badge")
      );
      const cd = computeDeadlineCountdownBadge(d.dueISO, isDone);
      head.append(badges, make("span", cd.text, cd.cls));
      card.appendChild(head);

      card.appendChild(make("h4", d.title, "deliverable-title"));
      card.appendChild(make("p", `กำหนดส่ง: ${d.dueTH}`, "deliverable-due"));
      card.appendChild(make("p", d.prereq, "deliverable-meta"));

      const actions = make("div", null, "header-actions");
      const backendLink = make("a", d.backendLabel, "btn sm primary");
      backendLink.href = d.backendType === "ramed" ? getActiveRamedTargetUrl() : GOOGLE_FORM_URL;
      backendLink.target = "_blank";
      backendLink.rel = "noopener";
      actions.appendChild(backendLink);

      if (d.srnRound) {
        const prepBtn = make("button", `ตั้งชื่อ & ตรวจไฟล์ ${d.code}`, "btn sm teal");
        prepBtn.type = "button";
        prepBtn.addEventListener("click", () => {
          if ($("srnRoundSelect")) {
            $("srnRoundSelect").value = d.srnRound;
            updateSrnFilename();
          }
          const box = $("srnGeneratorBox");
          if (box) box.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        actions.appendChild(prepBtn);
      }

      const rubricBtn = make("button", d.manualBtnLabel, "btn sm");
      rubricBtn.type = "button";
      rubricBtn.addEventListener("click", () => openManualChapter(d.manualChapterId));
      actions.appendChild(rubricBtn);

      const matchedSession = (SCHED.sessions || []).find((s) => s.id === d.sessionId);
      if (matchedSession) {
        const icsBtn = make("button", "+ เตือนในปฏิทิน (.ics)", "btn sm");
        icsBtn.type = "button";
        icsBtn.addEventListener("click", () => downloadSingleSessionIcs(matchedSession));
        actions.appendChild(icsBtn);
      }
      card.appendChild(actions);

      const foot = make("div", null, "deliverable-foot");
      const checkLabel = make("label", null, "deliverable-check-label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = isDone;
      cb.addEventListener("change", () => {
        if (cb.checked) state.submittedMap[d.id] = new Date().toISOString();
        else delete state.submittedMap[d.id];
        localStorage.setItem("racm303_submitted_map", JSON.stringify(state.submittedMap));
        renderDeliverablesCards();
      });
      checkLabel.append(
        cb,
        make("span", ROLE === "faculty" ? "ทำเครื่องหมายตรวจ/ติดตามงานชิ้นนี้แล้ว" : "ทำเครื่องหมายว่าส่งงานชิ้นนี้เรียบร้อยแล้ว")
      );

      const channelSpan = make(
        "span",
        d.backendType === "ramed" ? "ห้องวิชา: .../ramed/course/view.php?id=398" : "ระบบรับงานกลุ่ม: forms.gle/1Gsg2SmSfuuEwmcE9"
      );
      channelSpan.style.fontSize = "12px";
      channelSpan.style.color = "var(--muted)";
      foot.append(checkLabel, channelSpan);
      card.appendChild(foot);

      grid.appendChild(card);
    });
  }

  function initSubmissionsControls() {
    const srnAreaSel = $("srnAreaSelect");
    if (srnAreaSel) {
      (SCHED.fieldworkSites || []).forEach((s) => {
        srnAreaSel.add(new Option(`${s.shortName} (${s.hospital})`, s.shortName));
      });
    }

    ["srnRoundSelect", "srnAreaSelect", "srnStudentId", "srnStudentName"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", updateSrnFilename);
      el.addEventListener("change", updateSrnFilename);
    });

    if ($("copySrnFilenameBtn")) {
      $("copySrnFilenameBtn").addEventListener("click", () => {
        const text = updateSrnFilename();
        copyTextWithFeedback(text, $("copySrnFilenameBtn"), "คัดลอกชื่อไฟล์แล้ว ✓");
      });
    }

    if ($("copyAndLaunchRamedBtn")) {
      $("copyAndLaunchRamedBtn").addEventListener("click", () => {
        const text = updateSrnFilename();
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).catch(() => {});
        }
        window.open(getActiveRamedTargetUrl(), "_blank", "noopener");
      });
    }

    if ($("openRamedPopupWorkspaceBtn")) {
      $("openRamedPopupWorkspaceBtn").addEventListener("click", () => {
        window.open(
          getActiveRamedTargetUrl(),
          "ramedBackendWindow",
          "width=1120,height=840,menubar=no,toolbar=yes,location=yes,status=yes,resizable=yes,scrollbars=yes,noopener"
        );
      });
    }

    if ($("saveRamedCustomUrlBtn")) {
      $("saveRamedCustomUrlBtn").addEventListener("click", () => {
        const raw = (($("ramedCustomCourseUrlInput") && $("ramedCustomCourseUrlInput").value) || "").trim();
        const fb = $("ramedPinFeedback");
        if (!isValidRamedUrl(raw)) {
          if (fb) {
            fb.style.color = "var(--crimson)";
            fb.textContent = "กรุณาวางลิงก์ที่ขึ้นต้นด้วย https://elearning.ra.mahidol.ac.th/ramed/ เท่านั้น";
          }
          return;
        }
        state.pinnedRamedUrl = raw;
        localStorage.setItem("racm303_moodle_course_url", raw);
        if (fb) fb.style.color = "var(--teal-deep)";
        syncPinnedRamedCourseUI();
        renderDeliverablesCards();
      });
    }

    if ($("clearRamedCustomUrlBtn")) {
      $("clearRamedCustomUrlBtn").addEventListener("click", () => {
        state.pinnedRamedUrl = "";
        localStorage.removeItem("racm303_moodle_course_url");
        if ($("ramedCustomCourseUrlInput")) $("ramedCustomCourseUrlInput").value = "";
        if ($("ramedPinFeedback")) $("ramedPinFeedback").textContent = "กลับไปใช้หน้าหลักห้องวิชา 3/2569 RACM 303 (course/view.php?id=398) แล้ว";
        syncPinnedRamedCourseUI();
        renderDeliverablesCards();
      });
    }

    const pickPdfBtn = $("pickSrnPdfBtn");
    const pdfInput = $("srnPdfFileInput");
    const dropzone = $("srnPdfDropzone");
    const dlRenamedBtn = $("downloadRenamedPdfBtn");

    if (pickPdfBtn && pdfInput) {
      pickPdfBtn.addEventListener("click", () => pdfInput.click());
      pdfInput.addEventListener("change", () => {
        if (pdfInput.files && pdfInput.files[0]) {
          inspectSrnPdfFile(pdfInput.files[0]);
        }
      });
    }

    if (dropzone) {
      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("is-dragover");
      });
      dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("is-dragover");
      });
      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("is-dragover");
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          inspectSrnPdfFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (dlRenamedBtn) {
      dlRenamedBtn.addEventListener("click", () => {
        if (!state.inspectedPdfBytes) return;
        const targetName = updateSrnFilename();
        triggerBlobDownload(state.inspectedPdfBytes, "application/pdf", targetName);
      });
    }

    window.addEventListener("beforeprint", () => {
      if (state.activeTab === "discussion" || state.activeTab === "fieldwork") {
        fitPrintRoster(state.activeTab);
      }
    });
    window.addEventListener("afterprint", () => {
      document.querySelectorAll(".student-card h3, .student-card p").forEach((el) => el.style.removeProperty("font-size"));
    });

    syncPinnedRamedCourseUI();
    updateSrnFilename();
  }

  function renderSubmissionsView() {
    syncPinnedRamedCourseUI();
    updateSrnFilename();
    renderDeliverablesCards();
    checkRamedBackendReachability();
  }


  /* ---------- Reader Utilities (Font Size & Lightbox & TOC) ---------- */
  function applyReaderFontSize(px) {
    const clamped = Math.min(21, Math.max(14, px));
    state.readerFontPx = clamped;
    localStorage.setItem("racm303_font_px", String(clamped));
    document.documentElement.style.setProperty("--reader-size", `${clamped}px`);
  }

  function wireFontButtons() {
    applyReaderFontSize(state.readerFontPx);
    document.querySelectorAll("[data-font-delta]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = Number(btn.dataset.fontDelta);
        if (d === 0) applyReaderFontSize(16.5);
        else applyReaderFontSize(state.readerFontPx + d);
      });
    });
  }

  /* ---------- Keynote-Style Slide Sorter, Slide Deck & Zoom In/Out Engine ---------- */
  const lbState = {
    gallery: [],
    index: 0,
    zoom: 100,
    panX: 0,
    panY: 0,
    dragging: false,
    startX: 0,
    startY: 0,
    wired: false
  };

  let activeDeckKeyHandler = null;

  function applyLightboxTransform() {
    const img = $("lightboxImg");
    if (!img) return;
    const scale = lbState.zoom / 100;
    img.style.transform = `translate(${lbState.panX}px, ${lbState.panY}px) scale(${scale})`;
    img.style.cursor = lbState.zoom > 100 ? (lbState.dragging ? "grabbing" : "grab") : "zoom-in";
    const pctBtn = $("lbZoomResetBtn");
    if (pctBtn) pctBtn.textContent = `${lbState.zoom}%`;
    const slider = $("lbZoomRange");
    if (slider) slider.value = String(lbState.zoom);
  }

  function setLightboxZoom(nextPct) {
    const clamped = Math.min(350, Math.max(50, Math.round(nextPct / 25) * 25));
    lbState.zoom = clamped;
    if (clamped <= 100) {
      lbState.panX = 0;
      lbState.panY = 0;
    }
    applyLightboxTransform();
  }

  function showLightboxAt(idx) {
    if (!lbState.gallery.length) return;
    const n = lbState.gallery.length;
    lbState.index = ((idx % n) + n) % n;
    const item = lbState.gallery[lbState.index];
    const img = $("lightboxImg");
    const cap = $("lightboxCaption");
    if (img) img.src = item.src;
    if (cap) cap.textContent = item.caption || "";
    lbState.zoom = 100;
    lbState.panX = 0;
    lbState.panY = 0;
    applyLightboxTransform();

    const counter = $("lbGalleryCounter");
    const prevBtn = $("lbPrevImgBtn");
    const nextBtn = $("lbNextImgBtn");
    const hasMulti = n > 1;
    if (counter) {
      counter.hidden = !hasMulti;
      counter.textContent = `ภาพ ${lbState.index + 1} / ${n}`;
    }
    if (prevBtn) prevBtn.hidden = !hasMulti;
    if (nextBtn) nextBtn.hidden = !hasMulti;
  }

  function ensureLightboxControls() {
    const lb = $("imageLightbox");
    if (!lb || lbState.wired) return;
    lbState.wired = true;

    const inner = lb.querySelector(".lightbox-inner");
    const img = $("lightboxImg");
    if (!inner || !img) return;

    let stage = inner.querySelector(".lightbox-stage");
    if (!stage) {
      stage = make("div", null, "lightbox-stage");
      img.replaceWith(stage);
      stage.appendChild(img);
    }

    const hud = make("div", null, "lightbox-hud");
    hud.innerHTML = `
      <div class="lb-nav-group">
        <button type="button" class="btn sm" id="lbPrevImgBtn" title="ภาพก่อนหน้า (←)">‹ ภาพก่อนหน้า</button>
        <span class="lb-counter-pill" id="lbGalleryCounter">ภาพ 1 / 1</span>
        <button type="button" class="btn sm" id="lbNextImgBtn" title="ภาพถัดไป (→)">ภาพถัดไป ›</button>
      </div>
      <div class="lb-zoom-group" role="group" aria-label="ซูมย่อ-ขยายภาพอินโฟกราฟิก">
        <button type="button" class="btn sm" id="lbZoomOutBtn" title="ซูมออก (−)">−</button>
        <input type="range" id="lbZoomRange" min="50" max="350" step="25" value="100" aria-label="แถบซูมภาพ">
        <button type="button" class="btn sm" id="lbZoomInBtn" title="ซูมเข้า (+)">+</button>
        <button type="button" class="btn sm" id="lbZoomResetBtn" title="คลิกเพื่อรีเซ็ตขนาด 100%">100%</button>
      </div>
    `;
    inner.insertBefore(hud, stage);

    $("lbPrevImgBtn")?.addEventListener("click", () => showLightboxAt(lbState.index - 1));
    $("lbNextImgBtn")?.addEventListener("click", () => showLightboxAt(lbState.index + 1));
    $("lbZoomOutBtn")?.addEventListener("click", () => setLightboxZoom(lbState.zoom - 25));
    $("lbZoomInBtn")?.addEventListener("click", () => setLightboxZoom(lbState.zoom + 25));
    $("lbZoomResetBtn")?.addEventListener("click", () => setLightboxZoom(100));
    $("lbZoomRange")?.addEventListener("input", (e) => setLightboxZoom(Number(e.target.value)));

    img.addEventListener("click", (e) => {
      e.stopPropagation();
      if (lbState.zoom === 100) setLightboxZoom(175);
      else if (lbState.zoom >= 175 && !lbState.dragging) setLightboxZoom(100);
    });

    stage.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        setLightboxZoom(lbState.zoom + (e.deltaY < 0 ? 25 : -25));
      },
      { passive: false }
    );

    stage.addEventListener("pointerdown", (e) => {
      if (lbState.zoom <= 100) return;
      lbState.dragging = true;
      lbState.startX = e.clientX - lbState.panX;
      lbState.startY = e.clientY - lbState.panY;
      if (stage.setPointerCapture) {
        try { stage.setPointerCapture(e.pointerId); } catch (_) {}
      }
      applyLightboxTransform();
    });

    stage.addEventListener("pointermove", (e) => {
      if (!lbState.dragging) return;
      lbState.panX = e.clientX - lbState.startX;
      lbState.panY = e.clientY - lbState.startY;
      applyLightboxTransform();
    });

    const stopDrag = () => {
      if (!lbState.dragging) return;
      lbState.dragging = false;
      applyLightboxTransform();
    };
    stage.addEventListener("pointerup", stopDrag);
    stage.addEventListener("pointercancel", stopDrag);

    document.addEventListener("keydown", (e) => {
      if (lb.hidden) return;
      if (e.key === "ArrowLeft" && lbState.gallery.length > 1) {
        e.preventDefault();
        showLightboxAt(lbState.index - 1);
      } else if (e.key === "ArrowRight" && lbState.gallery.length > 1) {
        e.preventDefault();
        showLightboxAt(lbState.index + 1);
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setLightboxZoom(lbState.zoom + 25);
      } else if (e.key === "-") {
        e.preventDefault();
        setLightboxZoom(lbState.zoom - 25);
      } else if (e.key === "0") {
        e.preventDefault();
        setLightboxZoom(100);
      }
    });
  }

  function openLightbox(src, caption, gallery) {
    const lb = $("imageLightbox");
    if (!lb) return;
    ensureLightboxControls();
    if (Array.isArray(gallery) && gallery.length) {
      lbState.gallery = gallery;
      const foundIdx = gallery.findIndex((g) => g.src === src);
      showLightboxAt(foundIdx >= 0 ? foundIdx : 0);
    } else {
      lbState.gallery = [{ src, caption }];
      showLightboxAt(0);
    }
    lb.hidden = false;
  }

  function wireInteractiveProseChildren(rootEl, gallery, onAnchorJump) {
    if (!rootEl) return;
    rootEl.querySelectorAll('a[href^="#"]').forEach((link) => {
      if (link._anchorWired) return;
      link._anchorWired = true;
      link.addEventListener("click", (ev) => {
        const rawHref = link.getAttribute("href") || "";
        if (rawHref.length <= 1) return;
        const targetId = decodeURIComponent(rawHref.slice(1));
        if (typeof onAnchorJump === "function" && onAnchorJump(targetId)) {
          ev.preventDefault();
        }
      });
    });

    rootEl.querySelectorAll("img").forEach((img) => {
      img.loading = "lazy";
      img.classList.add("zoomable-img");
      if (img._lbWired) return;
      img._lbWired = true;
      const fig = img.closest ? img.closest("figure") : null;
      const figCap = fig && fig.querySelector ? fig.querySelector("figcaption") : null;
      const capText = (figCap && figCap.textContent && figCap.textContent.trim()) || img.alt || "";
      img.addEventListener("click", () => openLightbox(img.src, capText, gallery));
    });

    const isIOSDevice =
      typeof navigator !== "undefined" &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent || "") ||
        (navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints) > 1));

    rootEl.querySelectorAll(".macos-pdf-card").forEach((card) => {
      if (card._pdfWired) return;
      card._pdfWired = true;

      const localUrl = card.dataset.pdfLocal || "";
      const driveId = card.dataset.pdfDriveId || "";
      const toggleBtn = card.querySelector("[data-pdf-toggle]");
      const closeBtn = card.querySelector("[data-pdf-close]");
      const viewerShell = card.querySelector("[data-pdf-viewer]");
      const frameWrap = card.querySelector("[data-pdf-frame-wrap]");
      const modeBtns = [...card.querySelectorAll("[data-pdf-mode]")];
      let activeMode = isIOSDevice && driveId ? "drive" : "local";

      const syncPdfFrame = () => {
        modeBtns.forEach((b) => {
          b.setAttribute("aria-pressed", b.dataset.pdfMode === activeMode ? "true" : "false");
        });
        if (!frameWrap || !viewerShell || viewerShell.hidden) return;
        const src =
          activeMode === "drive" && driveId
            ? `https://drive.google.com/file/d/${encodeURIComponent(driveId)}/preview`
            : `${localUrl}#view=FitH`;
        let iframe = frameWrap.querySelector("iframe");
        if (!iframe) {
          iframe = document.createElement("iframe");
          iframe.className = "macos-pdf-iframe";
          iframe.title = "ระเบียบการฝึกปฏิบัติงานนอกสถานที่ พ.ศ. 2561 (PDF)";
          iframe.loading = "lazy";
          iframe.setAttribute("allow", "autoplay");
          frameWrap.replaceChildren(iframe);
        }
        if (iframe.getAttribute("src") !== src) {
          iframe.setAttribute("src", src);
        }
      };

      const setViewerOpen = (open) => {
        if (!viewerShell || !toggleBtn) return;
        viewerShell.hidden = !open;
        toggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
        toggleBtn.textContent = open ? "ซ่อนหน้าต่างดู PDF" : "เปิดดู PDF (View PDF)";
        if (open) syncPdfFrame();
      };

      if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
          setViewerOpen(viewerShell ? viewerShell.hidden : false);
        });
      }
      if (closeBtn) {
        closeBtn.addEventListener("click", () => setViewerOpen(false));
      }
      modeBtns.forEach((b) => {
        b.addEventListener("click", () => {
          activeMode = b.dataset.pdfMode || "local";
          syncPdfFrame();
        });
      });
    });
  }

  function extractSlidesFromProse(proseContainer) {
    const blocks = [];
    const topChildren = [...(proseContainer.children || [])];
    if (!topChildren.length) return [];

    topChildren.forEach((child) => {
      const tag = String(child.tagName || "").toUpperCase();
      if (tag === "HR") return;
      if (tag === "SECTION" && child.children && child.children.length) {
        const secId = child.id || "";
        [...child.children].forEach((sub) => {
          if (String(sub.tagName || "").toUpperCase() === "HR") return;
          blocks.push({ node: sub, sectionId: secId });
        });
      } else {
        blocks.push({ node: child, sectionId: "" });
      }
    });

    if (!blocks.length) return [];

    const h2Count = blocks.filter((b) => String(b.node.tagName || "").toUpperCase() === "H2").length;
    const splitOnH3 = h2Count <= 22;

    const rawChunks = [];
    let currentH2Title = "";
    let cur = null;

    blocks.forEach(({ node, sectionId }) => {
      const tag = String(node.tagName || "").toUpperCase();
      if (tag === "H1" || tag === "H2") {
        currentH2Title = (node.textContent || "").trim();
        cur = {
          eyebrow: "",
          title: currentH2Title,
          headingId: node.id || sectionId || "",
          allIds: new Set([node.id, sectionId].filter(Boolean)),
          onlyH2Heading: true,
          nodes: [node]
        };
        rawChunks.push(cur);
      } else if (tag === "H3" && splitOnH3) {
        const h3Title = (node.textContent || "").trim();
        if (cur && cur.onlyH2Heading && cur.nodes.length === 1) {
          cur.eyebrow = currentH2Title;
          cur.title = h3Title;
          if (node.id) {
            cur.headingId = node.id;
            cur.allIds.add(node.id);
          }
          cur.onlyH2Heading = false;
          cur.nodes.push(node);
        } else {
          cur = {
            eyebrow: currentH2Title,
            title: h3Title,
            headingId: node.id || sectionId || "",
            allIds: new Set([node.id, sectionId].filter(Boolean)),
            onlyH2Heading: false,
            nodes: [node]
          };
          rawChunks.push(cur);
        }
      } else {
        if (!cur) {
          cur = {
            eyebrow: "",
            title: "บทนำและภาพรวมเอกสาร",
            headingId: node.id || sectionId || "",
            allIds: new Set([node.id, sectionId].filter(Boolean)),
            onlyH2Heading: false,
            nodes: []
          };
          rawChunks.push(cur);
        }
        if (node.id) cur.allIds.add(node.id);
        if (sectionId) cur.allIds.add(sectionId);
        cur.onlyH2Heading = false;
        cur.nodes.push(node);
      }
    });

    return rawChunks.map((ch, idx) => {
      let imgSrc = "";
      let imgAlt = "";
      let imgCount = 0;
      let tableCount = 0;
      let tableHeaders = [];
      let hasPdf = false;
      let takeaway = "";

      ch.nodes.forEach((n) => {
        if (!n.querySelectorAll) return;
        n.querySelectorAll("h2, h3, [id]").forEach((idEl) => {
          if (idEl.id) ch.allIds.add(idEl.id);
        });
        const imgs = String(n.tagName || "").toUpperCase() === "IMG" ? [n] : [...n.querySelectorAll("img")];
        imgCount += imgs.length;
        if (!imgSrc && imgs[0]) {
          imgSrc = imgs[0].getAttribute("src") || imgs[0].src || "";
          imgAlt = imgs[0].getAttribute("alt") || imgs[0].alt || "";
        }
        const tbls = String(n.tagName || "").toUpperCase() === "TABLE" ? [n] : [...n.querySelectorAll("table")];
        tableCount += tbls.length;
        if (!tableHeaders.length && tbls[0]) {
          tableHeaders = [...tbls[0].querySelectorAll("th")]
            .slice(0, 4)
            .map((th) => (th.textContent || "").trim())
            .filter(Boolean);
        }
        if (
          (n.classList && n.classList.contains("macos-pdf-card")) ||
          (n.querySelector && n.querySelector(".macos-pdf-card"))
        ) {
          hasPdf = true;
        }
        if (!takeaway) {
          const tag = String(n.tagName || "").toUpperCase();
          if (tag === "P" || tag === "BLOCKQUOTE" || tag === "UL" || tag === "OL") {
            const strong = n.querySelector ? n.querySelector("strong") : null;
            const rawTxt = ((strong && strong.textContent.length > 24 ? strong.textContent : n.textContent) || "")
              .replace(/\s+/g, " ")
              .trim();
            if (rawTxt.length > 14) {
              takeaway = rawTxt.length > 165 ? `${rawTxt.slice(0, 165)}…` : rawTxt;
            }
          }
        }
      });

      const html = ch.nodes.map((n) => n.outerHTML || "").join("\n");
      return {
        index: idx,
        numLabel: String(idx + 1).padStart(2, "0"),
        eyebrow: ch.eyebrow,
        title: ch.title || `ส่วนที่ ${idx + 1}`,
        headingId: ch.headingId,
        allIds: ch.allIds,
        html,
        imgSrc,
        imgAlt,
        imgCount,
        tableCount,
        tableHeaders,
        hasPdf,
        takeaway
      };
    });
  }

  function attachProseEnhancements(proseContainer, tocContainer) {
    if (!proseContainer) return;

    const headings = [...proseContainer.querySelectorAll("h2, h3")];
    headings.forEach((h, idx) => {
      if (!h.id) h.id = `sec-h-${idx}`;
    });

    // Build gallery list of all figures in this document for Lightbox Prev/Next
    const docGallery = [...proseContainer.querySelectorAll("img")].map((img) => {
      const fig = img.closest ? img.closest("figure") : null;
      const figCap = fig && fig.querySelector ? fig.querySelector("figcaption") : null;
      return {
        src: img.src || img.getAttribute("src") || "",
        caption: (figCap && figCap.textContent && figCap.textContent.trim()) || img.alt || ""
      };
    });

    const flashTargetEl = (el) => {
      if (!el || !el.classList) return;
      el.classList.remove("anchor-flash");
      void el.offsetWidth;
      el.classList.add("anchor-flash");
    };

    // Controller hook for TOC & internal section links across Scroll, Slide Deck, and Slide Sorter
    let jumpToIdHandler = (targetId) => {
      if (!targetId) return false;
      const escId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(targetId) : targetId;
      const targetEl = proseContainer.querySelector(`#${escId}`) || document.getElementById(targetId);
      if (!targetEl) return false;
      const parentDetails = targetEl.closest ? targetEl.closest("details") : null;
      if (parentDetails && !parentDetails.open) parentDetails.open = true;
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      flashTargetEl(targetEl);
      return true;
    };

    wireInteractiveProseChildren(proseContainer, docGallery, (id) => jumpToIdHandler(id));

    const paper = proseContainer.parentElement;
    const toolbar = paper && paper.querySelector ? paper.querySelector(".reader-toolbar") : null;
    const slides = paper && paper.classList && paper.classList.contains("reader-paper")
      ? extractSlidesFromProse(proseContainer)
      : [];

    let jumpToHeadingHandler = (h) => {
      if (h && h.id) jumpToIdHandler(h.id);
      else if (h) h.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    if (tocContainer) {
      tocContainer.replaceChildren();
      headings.forEach((h) => {
        const li = document.createElement("li");
        const a = make("a", h.textContent.trim(), `toc-link${h.tagName === "H3" ? " toc-sub" : ""}`);
        a.href = `#${h.id}`;
        a.addEventListener("click", (ev) => {
          ev.preventDefault();
          jumpToHeadingHandler(h);
        });
        li.appendChild(a);
        tocContainer.appendChild(li);
      });
    }

    if (!paper || !toolbar || !slides.length) return;

    // Ensure sibling Slide Sorter & Slide Deck stage containers exist inside .reader-paper
    let sorterStage = paper.querySelector(".reader-sorter-stage");
    if (!sorterStage) {
      sorterStage = make("div", null, "reader-sorter-stage");
      sorterStage.hidden = true;
      paper.appendChild(sorterStage);
    }
    let deckStage = paper.querySelector(".reader-deck-stage");
    if (!deckStage) {
      deckStage = make("div", null, "reader-deck-stage");
      deckStage.hidden = true;
      paper.appendChild(deckStage);
    }

    // Ensure toolbar has Segmented View Switcher + Slide Sorter / Canvas Zoom Bar
    let navSuite = toolbar.querySelector(".reader-nav-zoom-suite");
    if (!navSuite) {
      navSuite = make("div", null, "reader-nav-zoom-suite");
      navSuite.innerHTML = `
        <div class="cal-segmented reader-mode-seg" role="group" aria-label="มุมมองการอ่านและเลื่อนสไลด์">
          <button type="button" class="cal-seg-btn" data-rmode="scroll" aria-pressed="true" title="เลื่อนอ่านต่อเนื่องขึ้น-ลง">☰ เลื่อนอ่าน</button>
          <button type="button" class="cal-seg-btn" data-rmode="deck" aria-pressed="false" title="เลื่อนดูทีละสไลด์ซ้าย-ขวา (ปุ่มลูกศร ← / → หรือปัดนิ้ว)">▣ ทีละสไลด์</button>
          <button type="button" class="cal-seg-btn" data-rmode="sorter" aria-pressed="false" title="มุมมองตารางรวมทุกสไลด์พร้อมย่อ-ขยาย (Slide Sorter)">⊞ Slide Sorter</button>
        </div>
        <div class="reader-zoom-cluster" role="group" aria-label="ซูมย่อ-ขยายหน้ากระดาษและ Slide Sorter">
          <button type="button" class="reader-zoom-btn" data-rzoom-step="-1" title="ซูมออก (Zoom Out)">−</button>
          <input type="range" class="reader-zoom-slider" min="50" max="160" step="10" value="100" aria-label="ปรับระดับซูมย่อ-ขยาย">
          <button type="button" class="reader-zoom-btn" data-rzoom-step="1" title="ซูมเข้า (Zoom In)">+</button>
          <button type="button" class="reader-zoom-pct" data-rzoom-reset title="คลิกเพื่อรีเซ็ตระดับซูม 100%">100%</button>
        </div>
      `;
      const fontCtrl = toolbar.querySelector(".font-Controls");
      if (fontCtrl) toolbar.insertBefore(navSuite, fontCtrl);
      else toolbar.appendChild(navSuite);
    }

    let activeSlideIdx = 0;
    let sorterFilter = "all"; // all | img | table

    const modeBtns = [...navSuite.querySelectorAll("[data-rmode]")];
    const zoomSlider = navSuite.querySelector(".reader-zoom-slider");
    const zoomPctBtn = navSuite.querySelector("[data-rzoom-reset]");

    const getActiveZoom = () => (state.readerViewMode === "sorter" ? state.sorterZoomPct : state.canvasZoomPct);

    const applyZoomStyles = () => {
      const mode = state.readerViewMode;
      const pct = getActiveZoom();
      if (zoomSlider) {
        zoomSlider.min = mode === "sorter" ? "50" : "70";
        zoomSlider.max = mode === "sorter" ? "160" : "150";
        zoomSlider.value = String(pct);
      }
      if (zoomPctBtn) zoomPctBtn.textContent = `${pct}%`;

      if (mode === "sorter") {
        proseContainer.style.zoom = "";
        // Map 50%..160% -> 155px..495px column min-width (5-6 cols zoomed out -> 1-2 large cards zoomed in)
        const colPx = Math.round(155 + ((pct - 50) / 110) * 340);
        const fontScale = (0.80 + ((pct - 50) / 110) * 0.34).toFixed(3);
        sorterStage.style.setProperty("--sorter-col-min", `${colPx}px`);
        sorterStage.style.setProperty("--sorter-scale", fontScale);
        const colHint = sorterStage.querySelector("[data-sorter-zoom-hint]");
        if (colHint) {
          const densityLabel =
            pct <= 65 ? "ภาพรวมมุมสูง (5–6 คอลัมน์)" :
            pct <= 85 ? "ย่อกะทัดรัด (4 คอลัมน์)" :
            pct <= 115 ? "มาตรฐาน (3 คอลัมน์)" :
            pct <= 135 ? "การ์ดใหญ่ (2 คอลัมน์)" : "ขยายเต็มการ์ด (1–2 คอลัมน์)";
          colHint.textContent = `ระดับซูม ${pct}% · ${densityLabel}`;
        }
      } else if (mode === "deck") {
        proseContainer.style.zoom = "";
        const deckCanvas = deckStage.querySelector(".deck-slide-canvas");
        if (deckCanvas) deckCanvas.style.zoom = pct === 100 ? "" : String(pct / 100);
      } else {
        proseContainer.style.zoom = pct === 100 ? "" : String(pct / 100);
      }
    };

    const setZoomValue = (nextVal) => {
      if (state.readerViewMode === "sorter") {
        const clamped = Math.min(160, Math.max(50, Math.round(nextVal / 10) * 10));
        state.sorterZoomPct = clamped;
        localStorage.setItem("racm303_sorter_zoom", String(clamped));
      } else {
        const clamped = Math.min(150, Math.max(70, Math.round(nextVal / 10) * 10));
        state.canvasZoomPct = clamped;
        localStorage.setItem("racm303_canvas_zoom", String(clamped));
      }
      applyZoomStyles();
    };

    const renderSorterStage = () => {
      sorterStage.replaceChildren();

      const imgSlidesCount = slides.filter((s) => s.imgCount > 0).length;
      const tblSlidesCount = slides.filter((s) => s.tableCount > 0).length;

      const headBar = make("div", null, "sorter-head-bar");
      const filterRow = make("div", null, "sorter-filter-pills");

      const makeFilterPill = (key, label, count) => {
        const b = make("button", `${label} (${count})`, `sorter-filter-pill${sorterFilter === key ? " is-active" : ""}`);
        b.type = "button";
        b.addEventListener("click", () => {
          sorterFilter = key;
          renderSorterStage();
          applyZoomStyles();
        });
        return b;
      };

      filterRow.appendChild(makeFilterPill("all", "ทุกสไลด์", slides.length));
      if (imgSlidesCount > 0) filterRow.appendChild(makeFilterPill("img", "🖼 มีภาพอินโฟกราฟิก", imgSlidesCount));
      if (tblSlidesCount > 0) filterRow.appendChild(makeFilterPill("table", "📊 มีตารางสรุป", tblSlidesCount));

      const rightInfo = make("span", "", "sorter-zoom-hint");
      rightInfo.setAttribute("data-sorter-zoom-hint", "1");
      headBar.append(filterRow, rightInfo);
      sorterStage.appendChild(headBar);

      const visibleSlides = slides.filter((s) => {
        if (sorterFilter === "img") return s.imgCount > 0;
        if (sorterFilter === "table") return s.tableCount > 0;
        return true;
      });

      const grid = make("div", null, "sorter-cards-grid");
      visibleSlides.forEach((s) => {
        const card = make(
          "article",
          null,
          `sorter-slide-card${s.index === activeSlideIdx ? " is-current-slide" : ""}`
        );
        card.dataset.slideIdx = String(s.index);
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", `เปิดสไลด์ที่ ${s.index + 1}: ${s.title}`);

        const topMeta = make("div", null, "sorter-card-top");
        const numPill = make("span", s.numLabel, "sorter-num-pill");
        const badgesWrap = make("div", null, "sorter-media-badges");
        if (s.imgCount > 0) badgesWrap.appendChild(make("span", `🖼 ${s.imgCount}`, "sorter-mini-badge is-img"));
        if (s.tableCount > 0) badgesWrap.appendChild(make("span", `📊 ${s.tableCount}`, "sorter-mini-badge is-tbl"));
        if (s.hasPdf) badgesWrap.appendChild(make("span", "PDF", "sorter-mini-badge is-pdf"));
        topMeta.append(numPill, badgesWrap);
        card.appendChild(topMeta);

        if (s.eyebrow && s.eyebrow !== s.title) {
          card.appendChild(make("div", s.eyebrow, "sorter-eyebrow"));
        }
        card.appendChild(make("h4", s.title, "sorter-card-title"));

        const bodyBox = make("div", null, "sorter-card-preview");
        if (s.imgSrc) {
          const thumbWrap = make("div", null, "sorter-thumb-wrap");
          const thumbImg = document.createElement("img");
          thumbImg.src = s.imgSrc;
          thumbImg.alt = s.imgAlt || s.title;
          thumbImg.loading = "lazy";
          const zoomImgBtn = make("button", "🔍 ขยายภาพ", "sorter-zoom-img-btn");
          zoomImgBtn.type = "button";
          zoomImgBtn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            openLightbox(s.imgSrc, s.imgAlt || s.title, docGallery);
          });
          thumbWrap.append(thumbImg, zoomImgBtn);
          bodyBox.appendChild(thumbWrap);
          if (s.takeaway) {
            bodyBox.appendChild(make("p", s.takeaway, "sorter-takeaway compact"));
          }
        } else if (s.tableHeaders.length) {
          const tblStrip = make("div", null, "sorter-tbl-preview");
          s.tableHeaders.forEach((th) => tblStrip.appendChild(make("span", th, "sorter-th-chip")));
          bodyBox.appendChild(tblStrip);
          if (s.takeaway) bodyBox.appendChild(make("p", s.takeaway, "sorter-takeaway"));
        } else if (s.takeaway) {
          bodyBox.appendChild(make("p", s.takeaway, "sorter-takeaway"));
        }
        card.appendChild(bodyBox);

        const foot = make("div", null, "sorter-card-foot");
        const openDeckSpan = make("span", "▶ ซูมเข้าสไลด์นี้", "sorter-open-hint");
        const scrollJumpBtn = make("button", "¶ อ่านจุดนี้", "sorter-scroll-jump-btn");
        scrollJumpBtn.type = "button";
        scrollJumpBtn.title = "สลับไปโหมดเลื่อนอ่านต่อเนื่องตรงหัวข้อนี้";
        scrollJumpBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          activeSlideIdx = s.index;
          switchReaderMode("scroll");
          const targetEl = s.headingId ? document.getElementById(s.headingId) : null;
          if (targetEl) targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        foot.append(openDeckSpan, scrollJumpBtn);
        card.appendChild(foot);

        const activateCard = () => {
          activeSlideIdx = s.index;
          switchReaderMode("deck");
          paper.scrollIntoView({ behavior: "smooth", block: "start" });
        };
        card.addEventListener("click", activateCard);
        card.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            activateCard();
          }
        });

        grid.appendChild(card);
      });

      sorterStage.appendChild(grid);
    };

    const renderDeckSlide = (idx, direction = 0) => {
      if (!slides.length) return;
      activeSlideIdx = Math.min(slides.length - 1, Math.max(0, idx));
      const s = slides[activeSlideIdx];
      deckStage.replaceChildren();

      const buildDeckNavBar = (isBottom) => {
        const bar = make("div", null, `deck-nav-bar${isBottom ? " is-bottom" : ""}`);
        const prevBtn = make("button", "‹ สไลด์ก่อนหน้า", "btn sm");
        prevBtn.type = "button";
        prevBtn.disabled = activeSlideIdx === 0;
        prevBtn.addEventListener("click", () => {
          renderDeckSlide(activeSlideIdx - 1, -1);
          if (isBottom) deckStage.scrollIntoView({ behavior: "smooth", block: "start" });
        });

        const jumpSel = document.createElement("select");
        jumpSel.className = "deck-slide-select";
        jumpSel.setAttribute("aria-label", "เลือกสไลด์ที่ต้องการเปิด");
        slides.forEach((sl) => {
          const mediaTag = sl.imgCount ? " 🖼" : sl.tableCount ? " 📊" : "";
          const opt = new Option(
            `สไลด์ ${sl.numLabel} / ${String(slides.length).padStart(2, "0")}${mediaTag} — ${sl.title.slice(0, 58)}`,
            String(sl.index)
          );
          if (sl.index === activeSlideIdx) opt.selected = true;
          jumpSel.add(opt);
        });
        jumpSel.addEventListener("change", () => {
          const next = Number(jumpSel.value);
          renderDeckSlide(next, next > activeSlideIdx ? 1 : -1);
        });

        const midGroup = make("div", null, "deck-mid-controls");
        const toSorterBtn = make("button", "⊞ ดูรวม Slide Sorter", "btn sm");
        toSorterBtn.type = "button";
        toSorterBtn.title = "ซูมออกเพื่อดูตารางรวมทุกสไลด์ (Slide Sorter)";
        toSorterBtn.addEventListener("click", () => {
          paper.classList.remove("is-deck-theater");
          switchReaderMode("sorter");
        });

        const isTheater = paper.classList.contains("is-deck-theater");
        const theaterBtn = make("button", isTheater ? "✕ ออกจากเต็มจอ" : "⛶ เต็มจอ", "btn sm");
        theaterBtn.type = "button";
        theaterBtn.addEventListener("click", () => {
          paper.classList.toggle("is-deck-theater");
          renderDeckSlide(activeSlideIdx, 0);
        });

        midGroup.append(jumpSel, toSorterBtn, theaterBtn);

        const nextBtn = make("button", "สไลด์ถัดไป ›", "btn sm primary");
        nextBtn.type = "button";
        nextBtn.disabled = activeSlideIdx === slides.length - 1;
        nextBtn.addEventListener("click", () => {
          renderDeckSlide(activeSlideIdx + 1, 1);
          if (isBottom) deckStage.scrollIntoView({ behavior: "smooth", block: "start" });
        });

        bar.append(prevBtn, midGroup, nextBtn);
        return bar;
      };

      const progressTrack = make("div", null, "deck-progress-track");
      const progressFill = make("div", null, "deck-progress-fill");
      progressFill.style.width = `${((activeSlideIdx + 1) / slides.length) * 100}%`;
      progressTrack.appendChild(progressFill);

      const slideCard = make(
        "div",
        null,
        `deck-slide-card${direction > 0 ? " anim-next" : direction < 0 ? " anim-prev" : ""}`
      );
      if (s.eyebrow && s.eyebrow !== s.title) {
        const crumb = make("div", `${s.eyebrow}  ·  สไลด์ ${s.numLabel} / ${String(slides.length).padStart(2, "0")}`, "deck-slide-eyebrow");
        slideCard.appendChild(crumb);
      }
      const canvas = make("div", null, "editorial-prose deck-slide-canvas");
      canvas.innerHTML = s.html;
      wireInteractiveProseChildren(canvas, docGallery, (id) => jumpToIdHandler(id));
      slideCard.appendChild(canvas);

      // Swipe Left / Right support on touch devices (iPad / iPhone)
      let touchStartX = 0;
      let touchStartY = 0;
      slideCard.addEventListener(
        "touchstart",
        (ev) => {
          if (!ev.touches || !ev.touches[0]) return;
          touchStartX = ev.touches[0].clientX;
          touchStartY = ev.touches[0].clientY;
        },
        { passive: true }
      );
      slideCard.addEventListener(
        "touchend",
        (ev) => {
          if (!ev.changedTouches || !ev.changedTouches[0]) return;
          const dx = ev.changedTouches[0].clientX - touchStartX;
          const dy = ev.changedTouches[0].clientY - touchStartY;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx < 0 && activeSlideIdx < slides.length - 1) renderDeckSlide(activeSlideIdx + 1, 1);
            else if (dx > 0 && activeSlideIdx > 0) renderDeckSlide(activeSlideIdx - 1, -1);
          }
        },
        { passive: true }
      );

      // Horizontal Filmstrip Scrubber
      const filmstrip = make("div", null, "deck-filmstrip");
      slides.forEach((sl) => {
        const chip = make(
          "button",
          `${sl.numLabel}${sl.imgCount ? " 🖼" : ""}`,
          `deck-film-chip${sl.index === activeSlideIdx ? " is-active" : ""}`
        );
        chip.type = "button";
        chip.title = sl.title;
        chip.addEventListener("click", () => {
          renderDeckSlide(sl.index, sl.index > activeSlideIdx ? 1 : -1);
        });
        filmstrip.appendChild(chip);
      });

      deckStage.append(buildDeckNavBar(false), progressTrack, slideCard, filmstrip, buildDeckNavBar(true));
      applyZoomStyles();

      // Highlight matching TOC item
      if (tocContainer) {
        tocContainer.querySelectorAll(".toc-link").forEach((a) => {
          const hid = (a.getAttribute("href") || "").replace(/^#/, "");
          a.classList.toggle("is-active-toc", s.allIds.has(hid));
        });
      }
    };

    const switchReaderMode = (nextMode) => {
      state.readerViewMode = nextMode;
      if (nextMode !== "deck") {
        paper.classList.remove("is-deck-theater");
      }
      modeBtns.forEach((b) => {
        b.setAttribute("aria-pressed", b.dataset.rmode === nextMode ? "true" : "false");
      });

      proseContainer.hidden = nextMode !== "scroll";
      deckStage.hidden = nextMode !== "deck";
      sorterStage.hidden = nextMode !== "sorter";

      if (nextMode === "sorter") {
        renderSorterStage();
        applyZoomStyles();
        const curCard = sorterStage.querySelector(`[data-slide-idx="${activeSlideIdx}"]`);
        if (curCard && curCard.scrollIntoView) {
          setTimeout(() => curCard.scrollIntoView({ behavior: "smooth", block: "nearest" }), 30);
        }
      } else if (nextMode === "deck") {
        renderDeckSlide(activeSlideIdx, 0);
      } else {
        applyZoomStyles();
      }
    };

    // Re-bind toolbar events cleanly onto the latest document's slides closure
    navSuite._onModeClick = switchReaderMode;
    navSuite._onZoomStep = (dir) => {
      const curPct = getActiveZoom();
      if (state.readerViewMode === "sorter" && dir > 0 && curPct >= 160) {
        switchReaderMode("deck");
        return;
      }
      if (state.readerViewMode === "deck" && dir < 0 && curPct <= 70) {
        switchReaderMode("sorter");
        return;
      }
      setZoomValue(curPct + dir * 15);
    };
    navSuite._onZoomInput = (val) => setZoomValue(val);
    navSuite._onZoomReset = () => setZoomValue(100);

    if (!navSuite._eventsWired) {
      navSuite._eventsWired = true;
      modeBtns.forEach((b) => {
        b.addEventListener("click", () => navSuite._onModeClick && navSuite._onModeClick(b.dataset.rmode));
      });
      navSuite.querySelectorAll("[data-rzoom-step]").forEach((b) => {
        b.addEventListener("click", () => navSuite._onZoomStep && navSuite._onZoomStep(Number(b.dataset.rzoomStep)));
      });
      if (zoomSlider) {
        zoomSlider.addEventListener("input", (e) => navSuite._onZoomInput && navSuite._onZoomInput(Number(e.target.value)));
      }
      if (zoomPctBtn) {
        zoomPctBtn.addEventListener("click", () => navSuite._onZoomReset && navSuite._onZoomReset());
      }
      paper.addEventListener(
        "wheel",
        (e) => {
          if (!e.altKey) return;
          e.preventDefault();
          if (navSuite._onZoomStep) navSuite._onZoomStep(e.deltaY < 0 ? 1 : -1);
        },
        { passive: false }
      );
    }

    // Wire TOC sidebar & internal section links to respect active view mode
    jumpToIdHandler = (targetId) => {
      if (!targetId) return false;
      const escId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(targetId) : targetId;
      const matchedSlide = slides.find((sl) => sl.allIds.has(targetId));
      if (state.readerViewMode === "deck" && matchedSlide) {
        renderDeckSlide(matchedSlide.index, matchedSlide.index > activeSlideIdx ? 1 : matchedSlide.index < activeSlideIdx ? -1 : 0);
        const inDeckTarget = deckStage.querySelector(`#${escId}`);
        if (inDeckTarget) {
          const parentDetails = inDeckTarget.closest ? inDeckTarget.closest("details") : null;
          if (parentDetails && !parentDetails.open) parentDetails.open = true;
          inDeckTarget.scrollIntoView({ behavior: "smooth", block: "start" });
          flashTargetEl(inDeckTarget);
        } else {
          paper.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return true;
      }
      if (state.readerViewMode === "sorter" && matchedSlide) {
        activeSlideIdx = matchedSlide.index;
        renderSorterStage();
        applyZoomStyles();
        const card = sorterStage.querySelector(`[data-slide-idx="${matchedSlide.index}"]`);
        if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      }
      const targetEl = proseContainer.querySelector(`#${escId}`) || document.getElementById(targetId);
      if (!targetEl) return false;
      const parentDetails = targetEl.closest ? targetEl.closest("details") : null;
      if (parentDetails && !parentDetails.open) parentDetails.open = true;
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      flashTargetEl(targetEl);
      return true;
    };

    jumpToHeadingHandler = (h) => {
      if (h && h.id) jumpToIdHandler(h.id);
    };

    // Global keyboard Left / Right arrow handler for active Slide Deck
    paper._deckKeyListener = (e) => {
      if (state.readerViewMode !== "deck" || deckStage.hidden) return;
      const panel = paper.closest ? paper.closest(".tab-panel") : null;
      if (panel && panel.hidden) return;
      if ($("imageLightbox") && !$("imageLightbox").hidden) return;
      const tag = String((e.target && e.target.tagName) || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "ArrowRight") {
        if (activeSlideIdx < slides.length - 1) {
          e.preventDefault();
          renderDeckSlide(activeSlideIdx + 1, 1);
        }
      } else if (e.key === "ArrowLeft") {
        if (activeSlideIdx > 0) {
          e.preventDefault();
          renderDeckSlide(activeSlideIdx - 1, -1);
        }
      } else if (e.key === "Escape" && paper.classList.contains("is-deck-theater")) {
        e.preventDefault();
        paper.classList.remove("is-deck-theater");
        renderDeckSlide(activeSlideIdx, 0);
      }
    };

    if (!activeDeckKeyHandler) {
      activeDeckKeyHandler = (ev) => {
        document.querySelectorAll(".reader-paper").forEach((rp) => {
          if (rp._deckKeyListener) rp._deckKeyListener(ev);
        });
      };
      document.addEventListener("keydown", activeDeckKeyHandler);
    }

    switchReaderMode(state.readerViewMode || "scroll");
  }

  /* ---------- Tab 3: 2569 Course Manual ---------- */
  function initManualControls() {
    const search = $("manualSearchInput");
    if (search) search.addEventListener("input", renderManualReader);
    ["printManualBtn", "facPrintManualBtn"].forEach((id) => {
      if ($(id)) {
        $(id).addEventListener("click", () => {
          document.body.classList.remove("print-students-mode", "print-disc-mode");
          window.print();
        });
      }
    });
  }

  function renderManualReader() {
    const picker = $("manualChapterList");
    const prose = $("manualProseContainer");
    if (!picker || !prose) return;

    const chapters = MANUAL.chapters || [];
    if (!picker.dataset.rendered) {
      picker.dataset.rendered = "1";
      const allLi = document.createElement("li");
      const allBtn = make("button", "อ่านครบทั้งเล่มต่อเนื่อง (บทที่ 1–17 & ภาคผนวก)", "doc-picker-btn");
      allBtn.type = "button";
      allBtn.dataset.chId = "ALL";
      allBtn.addEventListener("click", () => {
        state.manualChapterId = "ALL";
        renderManualReader();
      });
      allLi.appendChild(allBtn);
      picker.appendChild(allLi);

      chapters.forEach((ch) => {
        const li = document.createElement("li");
        const btn = make("button", ch.title, "doc-picker-btn");
        btn.type = "button";
        btn.dataset.chId = ch.id;
        btn.addEventListener("click", () => {
          state.manualChapterId = ch.id;
          renderManualReader();
          prose.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        li.appendChild(btn);
        picker.appendChild(li);
      });
    }

    picker.querySelectorAll(".doc-picker-btn").forEach((b) => {
      b.setAttribute("aria-current", b.dataset.chId === state.manualChapterId ? "true" : "false");
    });

    const q = (($("manualSearchInput") && $("manualSearchInput").value) || "").trim().toLocaleLowerCase("th");
    const selected = state.manualChapterId === "ALL" ? chapters : chapters.filter((c) => c.id === state.manualChapterId);
    const filtered = q
      ? selected.filter((c) => `${c.title} ${c.html.replace(/<[^>]+>/g, " ")}`.toLocaleLowerCase("th").includes(q))
      : selected;

    if (!filtered.length) {
      prose.innerHTML = `<div class="empty-state">ไม่พบหัวข้อในคู่มือที่ตรงกับคำค้นหา “${escapeHtml(q)}”</div>`;
      return;
    }

    const intro = state.manualChapterId === "ALL" && !q && MANUAL.introHtml ? MANUAL.introHtml + "<hr class='doc-divider'>" : "";
    prose.innerHTML = intro + filtered.map((c) => `<section id="${escapeHtml(c.id)}">${c.html}</section>`).join("<hr class='doc-divider'>");
    attachProseEnhancements(prose, null);
  }

  /* ---------- Tab 4: HS1–HS6 Guided Learning Textbooks, Concise Summaries & Workbooks ---------- */
  function openTextbookDoc(docId) {
    state.activeDocId = docId;
    switchTab("textbooks");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function initTextbooksControls() {
    const expandAllBtn = $("toggleAllAnswersBtn");
    if (expandAllBtn) {
      expandAllBtn.addEventListener("click", () => {
        const prose = $("textbookProseContainer");
        const scope = (prose && prose.parentElement) || prose;
        if (!scope) return;
        const detailsList = [...scope.querySelectorAll("details")];
        const anyClosed = detailsList.some((d) => !d.open);
        detailsList.forEach((d) => (d.open = anyClosed));
        expandAllBtn.textContent = anyClosed ? "ซ่อนแนวคำตอบทั้งหมด" : "เปิดแนวคำตอบทั้งหมด";
      });
    }
    ["printTextbookBtn", "fPrintTextbookBtn"].forEach((id) => {
      if ($(id)) {
        $(id).addEventListener("click", () => {
          document.body.classList.remove("print-students-mode", "print-disc-mode");
          window.print();
        });
      }
    });
  }

  function renderTextbookReader() {
    const picker = $("textbookDocList");
    const toc = $("textbookHeadingToc");
    const prose = $("textbookProseContainer");
    const metaTitle = $("activeTextbookMeta");
    const gdocBtn = $("activeTextbookGdocBtn");
    const mdBtn = $("activeTextbookMdBtn");
    if (!picker || !prose) return;

    const docs = HS.docs || [];
    if (!picker.dataset.rendered) {
      picker.dataset.rendered = "1";
      docs.forEach((doc) => {
        const li = document.createElement("li");
        const btn = make("button", `${doc.badge} · ${doc.title}`, "doc-picker-btn");
        btn.type = "button";
        btn.dataset.docId = doc.id;
        btn.addEventListener("click", () => {
          state.activeDocId = doc.id;
          renderTextbookReader();
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
        li.appendChild(btn);
        picker.appendChild(li);
      });
    }

    picker.querySelectorAll(".doc-picker-btn").forEach((b) => {
      b.setAttribute("aria-current", b.dataset.docId === state.activeDocId ? "true" : "false");
    });

    const current = docs.find((d) => d.id === state.activeDocId) || docs[0];
    if (!current) return;

    if (metaTitle) {
      metaTitle.textContent = `${current.badge} — ${current.sessionInfo || current.subtitle || ""}`;
    }
    if (mdBtn) {
      if (current.mdPath) {
        mdBtn.href = current.mdPath;
        mdBtn.hidden = false;
      } else {
        mdBtn.hidden = true;
      }
    }
    if (gdocBtn) {
      if (current.docUrl) {
        gdocBtn.href = current.docUrl;
        gdocBtn.hidden = false;
      } else {
        gdocBtn.hidden = true;
      }
    }

    prose.innerHTML = current.html;
    attachProseEnhancements(prose, toc);
  }

  /* ---------- Tab 5: Rapid Review, 111 Flashcards & 82 Self-Check Q&A ---------- */
  function initPracticeControls() {
    document.querySelectorAll("[data-practice-sub]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.practiceSub = btn.dataset.practiceSub;
        document.querySelectorAll("[data-practice-sub]").forEach((b) =>
          b.setAttribute("aria-pressed", b.dataset.practiceSub === state.practiceSub ? "true" : "false")
        );
        renderPracticeCurrent();
      });
    });

    ["practiceModuleFilter", "practiceSearchInput"].forEach((id) => {
      if ($(id)) $(id).addEventListener("input", renderPracticeCurrent);
      if ($(id)) $(id).addEventListener("change", renderPracticeCurrent);
    });

    if ($("shuffleFlashcardsBtn")) {
      $("shuffleFlashcardsBtn").addEventListener("click", () => {
        state.fcShuffleSeed = Date.now();
        renderFlashcards();
      });
    }
  }

  function renderPracticeCurrent() {
    $("practiceRapidWrap").hidden = state.practiceSub !== "rapid";
    $("practiceFlashcardsWrap").hidden = state.practiceSub !== "flashcards";
    $("practiceQaWrap").hidden = state.practiceSub !== "qa";
    if ($("shuffleFlashcardsBtn")) $("shuffleFlashcardsBtn").hidden = state.practiceSub !== "flashcards";

    if (state.practiceSub === "rapid") renderRapidReview();
    if (state.practiceSub === "flashcards") renderFlashcards();
    if (state.practiceSub === "qa") renderSelfCheckQa();
  }

  function renderRapidReview() {
    const mod = ($("practiceModuleFilter") && $("practiceModuleFilter").value) || "";
    const q = (($("practiceSearchInput") && $("practiceSearchInput").value) || "").trim().toLocaleLowerCase("th");
    const container = $("practiceRapidWrap");
    if (!container) return;

    const items = (HS.rapidReview || []).filter((r) => {
      if (mod && r.module !== mod) return false;
      if (q && !`${r.module} ${r.moduleTitle} ${r.html}`.toLocaleLowerCase("th").includes(q)) return false;
      return true;
    });

    if ($("practiceStatusText")) {
      $("practiceStatusText").textContent = `ตารางทบทวนเร็ว (High-Yield Rapid Review) · แสดง ${items.length} บทเรียน`;
    }

    container.innerHTML = items.length
      ? items
          .map(
            (r) => `
        <article class="data-card editorial-prose">
          <h3><span class="badge cat-HS" style="margin-right:8px">${escapeHtml(r.module)}</span>${escapeHtml(r.moduleTitle)}</h3>
          ${r.html}
        </article>`
          )
          .join("")
      : `<div class="empty-state">ไม่พบตารางทบทวนเร็วที่ตรงกับคำค้นหา</div>`;
  }

  function renderFlashcards() {
    const mod = ($("practiceModuleFilter") && $("practiceModuleFilter").value) || "";
    const q = (($("practiceSearchInput") && $("practiceSearchInput").value) || "").trim().toLocaleLowerCase("th");
    const grid = $("flashcardsGrid");
    if (!grid) return;

    let cards = (HS.glossary || []).filter((g) => {
      if (mod && g.module !== mod) return false;
      if (q && !`${g.termTH} ${g.termEN} ${g.definition}`.toLocaleLowerCase("th").includes(q)) return false;
      return true;
    });

    if (state.fcShuffleSeed) {
      cards = [...cards].sort((a, b) => ((a.id.charCodeAt(4) * 31 + state.fcShuffleSeed) % 97) - ((b.id.charCodeAt(4) * 31 + state.fcShuffleSeed) % 97));
    }

    const masteredCount = (HS.glossary || []).filter((g) => state.masteredCards.has(g.id)).length;
    if ($("practiceStatusText")) {
      $("practiceStatusText").textContent = `บัตรคำศัพท์สำคัญ ${cards.length} คำ · จำแม่นแล้ว ${masteredCount} / ${(HS.glossary || []).length} คำ`;
    }

    grid.replaceChildren();
    if (!cards.length) {
      grid.appendChild(make("div", "ไม่พบคำศัพท์ที่ตรงกับเงื่อนไข", "empty-state"));
      return;
    }

    cards.forEach((g) => {
      const card = make("article", null, `flashcard${state.masteredCards.has(g.id) ? " is-mastered" : ""}`);
      const top = make("div");
      const headRow = make("div", null, "fc-top");
      headRow.append(
        make("span", g.module, "badge cat-HS"),
        make("span", state.masteredCards.has(g.id) ? "จำแม่นแล้ว" : "คลิกเพื่อพลิกดูนิยาม", "badge")
      );
      top.append(headRow, make("h3", g.termTH || g.termFull, "fc-term-th"));
      if (g.termEN) top.appendChild(make("p", g.termEN, "fc-term-en"));

      const def = make("div", g.definition, "fc-def");
      def.hidden = true;
      top.appendChild(def);

      const actions = make("div", null, "fc-actions");
      const flipBtn = make("button", "ดูความหมาย", "btn sm");
      flipBtn.type = "button";
      flipBtn.addEventListener("click", () => {
        def.hidden = !def.hidden;
        card.classList.toggle("is-flipped", !def.hidden);
        flipBtn.textContent = def.hidden ? "ดูความหมาย" : "ซ่อนความหมาย";
      });

      const masterBtn = make("button", state.masteredCards.has(g.id) ? "จำได้แล้ว ✓" : "ทำเครื่องหมายว่าจำได้", "btn sm teal");
      masterBtn.type = "button";
      masterBtn.addEventListener("click", () => {
        if (state.masteredCards.has(g.id)) state.masteredCards.delete(g.id);
        else state.masteredCards.add(g.id);
        localStorage.setItem("racm303_mastered_fc", JSON.stringify([...state.masteredCards]));
        renderFlashcards();
      });

      actions.append(flipBtn, masterBtn);
      card.append(top, actions);
      grid.appendChild(card);
    });
  }

  function renderSelfCheckQa() {
    const mod = ($("practiceModuleFilter") && $("practiceModuleFilter").value) || "";
    const q = (($("practiceSearchInput") && $("practiceSearchInput").value) || "").trim().toLocaleLowerCase("th");
    const wrap = $("practiceQaWrap");
    if (!wrap) return;

    const items = (HS.selfCheck || []).filter((item) => {
      if (mod && item.module !== mod) return false;
      if (q && !`${item.question} ${item.answerHtml}`.toLocaleLowerCase("th").includes(q)) return false;
      return true;
    });

    if ($("practiceStatusText")) {
      $("practiceStatusText").textContent = `คลังคำถามทบทวนตนเอง (Active Recall Q&A) · แสดง ${items.length} ข้อ จากทั้งหมด ${(HS.selfCheck || []).length} ข้อ`;
    }

    wrap.replaceChildren();
    if (!items.length) {
      wrap.appendChild(make("div", "ไม่พบโจทย์คำถามที่ตรงกับคำค้นหา", "empty-state"));
      return;
    }

    items.forEach((item) => {
      const card = make("article", null, "qa-card");
      card.appendChild(make("span", `${item.module} · ข้อที่ ${item.num}`, "badge cat-HS"));
      card.appendChild(make("h3", item.question, "qa-question"));

      const scratch = make("textarea", null, "qa-scratch");
      scratch.placeholder = "ลองพิมพ์ร่างคำตอบด้วยตนเองสั้นๆ ก่อนเปิดดูแนวคำตอบ (Retrieval Practice)…";
      card.appendChild(scratch);

      const ansBox = make("div", null, "qa-answer");
      ansBox.innerHTML = item.answerHtml;
      ansBox.hidden = true;

      const btn = make("button", "ดูแนวคำตอบ", "btn sm teal");
      btn.type = "button";
      btn.addEventListener("click", () => {
        ansBox.hidden = !ansBox.hidden;
        btn.textContent = ansBox.hidden ? "ดูแนวคำตอบ" : "ซ่อนแนวคำตอบ";
      });

      card.append(btn, ansBox);
      wrap.appendChild(card);
    });
  }

  /* ---------- Faculty Tab 6: Schedule Audit, Apps Script Sync & Sign-Off ---------- */
  function renderAuditView() {
    const wrap = $("auditContentContainer");
    if (!wrap || wrap.dataset.rendered) return;
    wrap.dataset.rendered = "1";

    const items = SCHED.auditItems || [];
    const auditCards = items
      .map(
        (a, idx) => `
      <div class="audit-card">
        <h4>${idx + 1}. ${escapeHtml(a.session)}</h4>
        <p><strong>ประเด็นที่พบ:</strong> ${escapeHtml(a.issue)}</p>
        <p><strong>ข้อเสนอดำเนินการ:</strong> ${escapeHtml(a.action)}</p>
      </div>`
      )
      .join("");

    const reconRows = (ROSTER.appsScriptReconciliation || [])
      .map(
        (r) => `
      <tr>
        <td><strong>${escapeHtml(r.rows)}</strong><br><small>${escapeHtml(r.topic)}</small></td>
        <td>${escapeHtml(r.inSheetV1)}</td>
        <td><strong>${escapeHtml(r.revisedFix)}</strong></td>
      </tr>`
      )
      .join("");

    const fixedBlocks = (SCHED.fixedSummary || [])
      .map(
        (f) => `
      <div class="data-card">
        <h3>${escapeHtml(f.title)}</h3>
        <ul>${f.items.map((li) => `<li>${escapeHtml(li)}</li>`).join("")}</ul>
      </div>`
      )
      .join("");

    wrap.innerHTML = `
      <div class="data-card" style="border-color:var(--amber-line);background:#fffdf8">
        <h3>ส่วนที่ 1: ประเด็น [รอยืนยัน] ก่อนประกาศใช้ตารางสอนและคู่มือปีการศึกษา 2569 (${items.length} รายการ)</h3>
        <div class="audit-grid">${auditCards}</div>
      </div>

      <div class="data-card">
        <div class="section-header" style="margin-bottom:12px">
          <div>
            <h3 style="margin:0">ส่วนที่ 2: การเชื่อมโยงและอัปเดตฐานข้อมูล Google Apps Script (schedule-racm303-v1)</h3>
            <p style="margin:4px 0 0;font-size:14px;color:var(--muted)">เปรียบเทียบข้อมูลในชีต <code>schedule-racm303-v1</code> กับตารางฉบับปรับปรุง พร้อมไฟล์ CSV โครงสร้าง 16 คอลัมน์ที่อัปเดตลิงก์ Zoom และยืนยัน อ. นพ.ปวินท์ วันที่ 1 ธ.ค. 2569 เรียบร้อยแล้ว</p>
          </div>
          <div class="header-actions">
            <a class="btn teal sm" href="${escapeHtml(ROSTER.revisedCsvPath)}" download>ดาวน์โหลด CSV อัปเดตชีต (v2)</a>
            <a class="btn sm" href="${escapeHtml(ROSTER.appsScriptSheetUrl)}" target="_blank" rel="noopener">เปิด Google Sheet ต้นฉบับ</a>
            <a class="btn sm" href="${escapeHtml(ROSTER.appsScriptUrl)}" target="_blank" rel="noopener">เปิด Apps Script Web App</a>
          </div>
        </div>
        <div class="clean-table-wrap">
          <table class="clean-table">
            <thead>
              <tr>
                <th>แถวข้อมูล / คาบเรียน</th>
                <th>ข้อมูลเดิมใน schedule-racm303-v1</th>
                <th>ข้อมูลที่ปรับปรุงแล้วในพอร์ทัลและไฟล์ CSV (v2)</th>
              </tr>
            </thead>
            <tbody>${reconRows}</tbody>
          </table>
        </div>
      </div>

      <div class="data-card editorial-prose">
        <h3>ส่วนที่ 3: รายการตรวจสอบก่อนลงนามประกาศใช้คู่มือรายวิชา RACM 303 ปีการศึกษา 2569</h3>
        ${MANUAL.verifySection ? MANUAL.verifySection.html : ""}
      </div>

      ${fixedBlocks}`;
  }

  /* ---------- Faculty Tab 7: Teacher Guides, Revision Notes & Canonical Drive Directory ---------- */
  function initFacultyDocsControls() {
    if (FACULTY.docs && FACULTY.docs[0]) {
      state.activeFacultyDocId = FACULTY.docs[0].id;
    }
    document.querySelectorAll("[data-fac-sub]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.facultySub = btn.dataset.facSub;
        document.querySelectorAll("[data-fac-sub]").forEach((b) =>
          b.setAttribute("aria-pressed", b.dataset.facSub === state.facultySub ? "true" : "false")
        );
        renderFacultyDocsView();
      });
    });
    if ($("printAuditBtn")) {
      $("printAuditBtn").addEventListener("click", () => {
        document.body.classList.remove("print-students-mode", "print-disc-mode");
        window.print();
      });
    }
  }

  function renderFacultyDocsView() {
    const guidesWrap = $("facultyGuidesReaderWrap");
    const linksWrap = $("facultyLinksDirectoryWrap");
    if (!guidesWrap || !linksWrap) return;

    guidesWrap.hidden = state.facultySub !== "guides";
    linksWrap.hidden = state.facultySub !== "links";

    if (state.facultySub === "guides") {
      const picker = $("facultyDocList");
      const toc = $("facultyDocToc");
      const prose = $("facultyProseContainer");
      const docs = FACULTY.docs || [];

      if (picker && !picker.dataset.rendered) {
        picker.dataset.rendered = "1";
        docs.forEach((d) => {
          const li = document.createElement("li");
          const b = make("button", d.title, "doc-picker-btn");
          b.type = "button";
          b.dataset.fdocId = d.id;
          b.addEventListener("click", () => {
            state.activeFacultyDocId = d.id;
            renderFacultyDocsView();
          });
          li.appendChild(b);
          picker.appendChild(li);
        });
      }
      if (picker) {
        picker.querySelectorAll(".doc-picker-btn").forEach((b) =>
          b.setAttribute("aria-current", b.dataset.fdocId === state.activeFacultyDocId ? "true" : "false")
        );
      }
      const cur = docs.find((d) => d.id === state.activeFacultyDocId) || docs[0];
      if (cur && prose) {
        prose.innerHTML = cur.html;
        attachProseEnhancements(prose, toc);
      }
    } else if (!linksWrap.dataset.rendered) {
      linksWrap.dataset.rendered = "1";
      const groups = new Map();
      (FACULTY.links || []).forEach((l) => {
        const cat = l.category || "ลิงก์เอกสาร";
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat).push(l);
      });
      let html = "";
      groups.forEach((items, cat) => {
        html += `<div class="data-card"><h3>${escapeHtml(cat)}</h3><div class="links-grid">`;
        items.forEach((it) => {
          html += `
            <div class="link-card">
              <div>
                <h4>${escapeHtml(it.title)}</h4>
                <p>${escapeHtml(it.note || "")}</p>
              </div>
              <div><a class="btn sm primary" href="${escapeHtml(it.url)}" target="_blank" rel="noopener">เปิดลิงก์ต้นฉบับ</a></div>
            </div>`;
        });
        html += `</div></div>`;
      });
      linksWrap.innerHTML = html;
    }
  }

  /* ---------- Bootstrap ---------- */
  function init() {
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    const lb = $("imageLightbox");
    if (lb) {
      lb.addEventListener("click", (e) => {
        if (e.target === lb || e.target.id === "closeLightboxBtn") lb.hidden = true;
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !lb.hidden) lb.hidden = true;
      });
    }

    wireFontButtons();
    initPersonalizer();
    initScheduleControls();
    initDiscussionControls();
    initFieldworkControls();
    initSubmissionsControls();
    initManualControls();
    initTextbooksControls();
    initPracticeControls();
    if (ROLE === "faculty" && typeof initFacultyDocsControls === "function") {
      initFacultyDocsControls();
    }

    const params = new URLSearchParams(window.location.search);
    const moodleParam = params.get("moodle_url");
    if (moodleParam && isValidRamedUrl(moodleParam)) {
      state.pinnedRamedUrl = moodleParam.trim();
      localStorage.setItem("racm303_moodle_course_url", state.pinnedRamedUrl);
      syncPinnedRamedCourseUI();
    }

    // Restore saved student after all <select> dropdowns are populated
    const savedId = localStorage.getItem("racm303_my_sid");
    if (savedId) {
      const found = ROSTER.students.find((s) => s.id === savedId);
      if (found) {
        state.calScope = "student";
        applyMyStudent(found, true);
      }
    }

    if (params.get("page") === "students") {
      const t = params.get("type");
      const g = params.get("group") || "";
      if (t === "discussion") {
        if ($("discGroupSelect")) $("discGroupSelect").value = g;
        switchTab("discussion", false);
        return;
      }
      if ($("fieldAreaSelect")) $("fieldAreaSelect").value = g;
      switchTab("fieldwork", false);
      return;
    }

    if (params.get("page") === "submissions" || params.get("page") === "elearning") {
      switchTab("submissions", false);
      return;
    }

    const hash = (window.location.hash || "").replace(/^#/, "");
    switchTab(hash || "schedule", false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
