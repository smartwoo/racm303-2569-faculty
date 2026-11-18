/* ==========================================================================
   RACM 303 (ปีการศึกษา 2569) — Faculty & Coordinator Portal Controller
   Google Calendar & Apple iCal Views · Per-Group & Per-Student Fieldwork Sync
   One-Time (.ics / .csv) Downloads & Live Hosted Subscribe (.ics / webcal://)
   ========================================================================== */
(function () {
  "use strict";

  const ROLE = "faculty";
  const PORTAL_BASE_URL = "https://smartwoo.github.io/racm303-2569-faculty";
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
    calScope: "teacher", // student | group | teacher | all
    calWeek: 1,
    practiceSub: "rapid",
    facultySub: "guides",
    myStudent: null,
    classContext: null,
    showPhotos: ROLE === "faculty",
    showSitesOverview: false,
    showZoomDrawer: false,
    visibleStudents: [],
    manualChapterId: "ALL",
    activeDocId: "HS1",
    activeFacultyDocId: "hs1-tg",
    readerFontPx: Number(localStorage.getItem("racm303_font_px")) || 16.5,
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

  /* ---------- Lazy Photo Observer ---------- */
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
      }, { rootMargin: "160px" })
    : null;

  function mountStudentPhoto(box) {
    const pid = box.dataset.photoId;
    const initials = box.dataset.initials || "นศ";
    if (!pid) {
      box.innerHTML = `<span class="avatar-monogram">${escapeHtml(initials)}</span>`;
      return;
    }
    const img = document.createElement("img");
    img.alt = box.dataset.studentName || "รูปนักศึกษา";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.src = `https://drive.google.com/thumbnail?id=${encodeURIComponent(pid)}&sz=w320`;
    img.onerror = () => {
      box.innerHTML = `<span class="avatar-monogram" title="เปิดดูรูปใน Apps Script ได้จากปุ่มด้านบน">${escapeHtml(initials)}</span>`;
    };
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
    if ($("personalStudentInput")) $("personalStudentInput").value = "";
    if ($("studioStudentInput")) $("studioStudentInput").value = "";
    if ($("schedDiscFilter")) $("schedDiscFilter").value = "";
    if ($("schedAreaFilter")) $("schedAreaFilter").value = "";
    if ($("schedTeacherFilter")) $("schedTeacherFilter").value = "";
    if ($("studioTeacherSelect")) $("studioTeacherSelect").value = "";
    updatePersonalBanner();
    refreshCalendarStudioUI();
    renderScheduleCurrent();
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

    if (syncFilters) {
      if ($("schedDiscFilter")) $("schedDiscFilter").value = String(student.disc);
      if ($("schedAreaFilter")) $("schedAreaFilter").value = student.area;
      if ($("schedTeacherFilter")) $("schedTeacherFilter").value = "";
      if ($("studioTeacherSelect")) $("studioTeacherSelect").value = "";
    }

    if ($("srnAreaSelect")) $("srnAreaSelect").value = student.area;
    if ($("srnStudentId")) $("srnStudentId").value = student.id;
    if ($("srnStudentName")) $("srnStudentName").value = student.fullName;
    updateSrnFilename();

    updatePersonalBanner();
    refreshCalendarStudioUI();
    renderScheduleCurrent();
  }

  function selectFieldworkGroupOnly(shortName) {
    state.myStudent = null;
    localStorage.removeItem("racm303_my_sid");
    if ($("personalStudentInput")) $("personalStudentInput").value = "";
    if ($("studioStudentInput")) $("studioStudentInput").value = "";
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
    summary.append(
      make("span", `Discussion ${s.disc} (${hsRot ? hsRot.room : ""})`, "personal-chip"),
      make("span", `พื้นที่: ${s.area}${site ? " · " + (site.badgeDates || site.datesTH) : ""}`, "personal-chip"),
      make("span", `อ.ที่ปรึกษา: ${s.advisor}`, "personal-chip")
    );
    if (clearBtn) clearBtn.hidden = false;
  }

  /* ---------- Primary Tab Routing ---------- */
  function switchTab(tabId, pushHash = true) {
    const validTabs = ROLE === "faculty"
      ? ["schedule", "students", "audit", "faculty-docs", "manual", "textbooks", "practice"]
      : ["schedule", "students", "manual", "textbooks", "practice"];
    if (!validTabs.includes(tabId)) tabId = "schedule";

    state.activeTab = tabId;
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      const active = btn.dataset.tab === tabId;
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.hidden = panel.id !== `panel-${tabId}`;
    });

    document.body.classList.toggle("print-students-mode", tabId === "students");

    if (pushHash) {
      history.replaceState(null, "", `#${tabId}`);
    }

    if (tabId === "schedule") renderScheduleCurrent();
    if (tabId === "students") renderStudentsView();
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

    // Update Subscribe URL (.ics over HTTPS for Google Calendar "From URL" & webcal:// for Apple Calendar)
    const relFeed = computeSubscribeRelativePath(ctx);
    const httpsFeedUrl = `${PORTAL_BASE_URL}/${relFeed}`;
    const webcalFeedUrl = httpsFeedUrl.replace(/^https:\/\//i, "webcal://");
    if ($("studioSubscribeUrlInput")) $("studioSubscribeUrlInput").value = httpsFeedUrl;
    if ($("studioWebcalLink")) $("studioWebcalLink").href = webcalFeedUrl;
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
          // Keep their fieldwork group selected, clear individual student if they want pure group mode
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

  /* ---------- Tab 1: Schedule & Calendar Controls ---------- */
  function renderZoomHubAndMilestones() {
    const msWrap = $("milestoneStrip");
    if (msWrap && !msWrap.dataset.rendered) {
      msWrap.dataset.rendered = "1";
      (SCHED.milestones || []).forEach((m) => {
        const card = make("div", null, "milestone-card");
        card.append(
          make("div", m.date, "ms-date"),
          make("div", m.title, "ms-title"),
          make("div", m.channel, "ms-channel")
        );
        msWrap.appendChild(card);
      });
    }

    const zoomList = $("zoomRoomsHubList");
    if (zoomList && !zoomList.dataset.rendered) {
      zoomList.dataset.rendered = "1";
      const rooms = (SCHED.courseMeta && SCHED.courseMeta.zoomRooms) || [];
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
  }

  function initScheduleControls() {
    renderZoomHubAndMilestones();
    initCalendarDownloadStudio();

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

    // Restore saved student after dropdowns exist
    const savedId = localStorage.getItem("racm303_my_sid");
    if (savedId) {
      const found = ROSTER.students.find((s) => s.id === savedId);
      if (found) {
        state.calScope = "student";
        applyMyStudent(found, true);
      }
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
        document.body.classList.remove("print-students-mode");
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
        const bWb = make("button", `สมุดแบบฝึกหัด (${s.wbLink})`, "btn sm");
        bWb.type = "button";
        bWb.addEventListener("click", () => openTextbookDoc(s.wbLink));
        actions.appendChild(bWb);
      }
      if (s.actionUrl) {
        const bExt = make("a", s.actionLabel || "เปิดลิงก์ส่งงาน", "btn sm primary");
        bExt.href = s.actionUrl;
        bExt.target = "_blank";
        bExt.rel = "noopener";
        actions.appendChild(bExt);
      }
      if (s.code === "SRN 1" || s.code === "SRN 2 & SLIDES") {
        const bSrn = make("button", "ตั้งชื่อไฟล์ PDF ส่ง SRN", "btn sm");
        bSrn.type = "button";
        bSrn.addEventListener("click", () => {
          switchTab("students");
          const srnEl = $("srnGeneratorBox");
          if (srnEl) srnEl.scrollIntoView({ behavior: "smooth" });
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
        <p style="margin:0 0 12px;font-size:14px;color:var(--muted)">หมายเหตุสำคัญ: เช้าวันอังคารที่ 1 ธ.ค. 2569 (HS4) กลุ่มที่ 6 ย้ายไปใช้ห้อง <strong>2C2-03</strong> ชั่วคราว และช่วงบ่าย (HS5) กลับเข้าห้อง <strong>1C1-07</strong> ตามปกติ</p>
        <div class="clean-table-wrap">
          <table class="clean-table">
            <thead>
              <tr>
                <th>กลุ่มอภิปราย</th>
                <th>HS1 (26 พ.ย. เช้า)</th>
                <th>HS2 (30 พ.ย. เช้า)</th>
                <th>HS3 (30 พ.ย. บ่าย)</th>
                <th>HS4 (1 ธ.ค. เช้า)</th>
                <th>HS5 (1 ธ.ค. บ่าย)</th>
                <th>HS6 (4 ธ.ค. เช้า)</th>
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
      const bw = make("button", `สมุดแบบฝึกหัด (${session.wbLink})`, "btn sm");
      bw.type = "button";
      bw.addEventListener("click", () => {
        closeEventModal();
        openTextbookDoc(session.wbLink);
      });
      studyRow.appendChild(bw);
    }
    if (session.actionUrl) {
      const ba = make("a", session.actionLabel || "เปิดลิงก์ส่งงาน", "btn sm primary");
      ba.href = session.actionUrl;
      ba.target = "_blank";
      ba.rel = "noopener";
      studyRow.appendChild(ba);
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

  /* ---------- Tab 2: Student Roster, Fieldwork Sites & SRN Filename Generator ---------- */
  function jumpToClassRoster(session, assignment) {
    state.classContext = {
      topic: session.title,
      date: session.dateTH,
      time: session.timeLabel,
      lecturer: assignment.lecturer || session.lecturers,
      room: assignment.room || session.room,
      type: assignment.type,
      groupId: assignment.groupId,
      label: assignment.label
    };
    if ($("studentSearchInput")) $("studentSearchInput").value = "";
    if ($("studentAreaFilter")) $("studentAreaFilter").value = assignment.type === "area" ? assignment.groupId : "";
    if ($("studentDiscFilter")) $("studentDiscFilter").value = assignment.type === "discussion" ? assignment.groupId : "";
    switchTab("students");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function initStudentsControls() {
    const areaSel = $("studentAreaFilter");
    const srnAreaSel = $("srnAreaSelect");
    (SCHED.fieldworkSites || []).forEach((s) => {
      if (areaSel) areaSel.add(new Option(`${s.shortName} · ${s.advisors} (${s.count} คน)`, s.shortName));
      if (srnAreaSel) srnAreaSel.add(new Option(`${s.shortName} (${s.hospital})`, s.shortName));
    });

    const discSel = $("studentDiscFilter");
    (SCHED.hsGroups || []).forEach((g) => {
      if (discSel) discSel.add(new Option(`Discussion กลุ่มที่ ${g.id} (${g.count} คน)`, String(g.id)));
    });

    if (areaSel) {
      areaSel.addEventListener("change", () => {
        if (areaSel.value && discSel) discSel.value = "";
        state.classContext = null;
        renderStudentsView();
      });
    }
    if (discSel) {
      discSel.addEventListener("change", () => {
        if (discSel.value && areaSel) areaSel.value = "";
        state.classContext = null;
        renderStudentsView();
      });
    }
    if ($("studentSearchInput")) {
      $("studentSearchInput").addEventListener("input", renderStudentsView);
    }
    if ($("clearStudentFiltersBtn")) {
      $("clearStudentFiltersBtn").addEventListener("click", () => {
        state.classContext = null;
        if ($("studentSearchInput")) $("studentSearchInput").value = "";
        if (areaSel) areaSel.value = "";
        if (discSel) discSel.value = "";
        renderStudentsView();
      });
    }

    const photoToggle = $("togglePhotosBtn");
    if (photoToggle) {
      photoToggle.textContent = state.showPhotos ? "ซ่อนรูปถ่าย (โหมดกะทัดรัด)" : "แสดงรูปถ่ายนักศึกษา";
      photoToggle.addEventListener("click", () => {
        state.showPhotos = !state.showPhotos;
        photoToggle.textContent = state.showPhotos ? "ซ่อนรูปถ่าย (โหมดกะทัดรัด)" : "แสดงรูปถ่ายนักศึกษา";
        renderStudentsView();
      });
    }

    const toggleSitesBtn = $("toggleSitesOverviewBtn");
    if (toggleSitesBtn) {
      toggleSitesBtn.addEventListener("click", () => {
        state.showSitesOverview = !state.showSitesOverview;
        $("sitesOverviewGrid").hidden = !state.showSitesOverview;
        toggleSitesBtn.textContent = state.showSitesOverview
          ? "ซ่อนรายละเอียด 9 พื้นที่ภาคสนาม"
          : "ดูรายละเอียดโรงพยาบาลและวันเดินทาง 9 พื้นที่";
      });
    }

    if ($("printStudentsBtn")) {
      $("printStudentsBtn").addEventListener("click", printStudentRosterOnePage);
    }

    ["srnRoundSelect", "srnAreaSelect", "srnStudentId", "srnStudentName"].forEach((id) => {
      if ($(id)) $(id).addEventListener("input", updateSrnFilename);
      if ($(id)) $(id).addEventListener("change", updateSrnFilename);
    });
    if ($("copySrnFilenameBtn")) {
      $("copySrnFilenameBtn").addEventListener("click", () => {
        const text = ($("srnFilenamePreview") && $("srnFilenamePreview").textContent) || "";
        copyTextWithFeedback(text, $("copySrnFilenameBtn"), "คัดลอกชื่อไฟล์แล้ว");
      });
    }
    updateSrnFilename();

    window.addEventListener("beforeprint", () => {
      if (state.activeTab === "students") fitPrintRoster();
    });
    window.addEventListener("afterprint", () => {
      document.querySelectorAll(".student-card h3, .student-card p").forEach((el) => el.style.removeProperty("font-size"));
    });
  }

  function updateSrnFilename() {
    const round = ($("srnRoundSelect") && $("srnRoundSelect").value) || "SRN1";
    const area = ($("srnAreaSelect") && $("srnAreaSelect").value) || "กุฉินารายณ์";
    const sid = (($("srnStudentId") && $("srnStudentId").value) || "").trim() || "6702xxx";
    const sname = (($("srnStudentName") && $("srnStudentName").value) || "").trim() || "ชื่อ-นามสกุล";
    const preview = $("srnFilenamePreview");
    if (preview) preview.textContent = `${round}_${area}_${sid}_${sname}.pdf`;
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

  function renderStudentsView() {
    const areaVal = ($("studentAreaFilter") && $("studentAreaFilter").value) || "";
    const discVal = ($("studentDiscFilter") && $("studentDiscFilter").value) || "";
    const q = (($("studentSearchInput") && $("studentSearchInput").value) || "").trim().toLocaleLowerCase("th");

    const sitesGrid = $("sitesOverviewGrid");
    if (sitesGrid && !sitesGrid.dataset.rendered) {
      sitesGrid.dataset.rendered = "1";
      (SCHED.fieldworkSites || []).forEach((site) => {
        const c = make("div", null, "site-card");
        c.dataset.siteName = site.shortName;
        c.innerHTML = `
          <div class="site-card-head">
            <h3>${site.id}. ${escapeHtml(site.shortName)}</h3>
            <span class="badge cat-SG">${site.count} คน</span>
          </div>
          <p class="site-meta"><strong>${escapeHtml(site.hospital)}</strong> (${escapeHtml(site.province)})</p>
          <p class="site-meta">อ.ที่ปรึกษา: ${escapeHtml(site.advisors)}</p>
          <p class="site-meta">ห้องกลุ่มย่อย: <strong>${escapeHtml(site.room)}</strong></p>
          <p class="site-meta">ช่วงภาคสนาม: ${escapeHtml(site.datesTH)}</p>
          <p class="site-meta">${escapeHtml(site.travelNote)}</p>`;
        const filterBtn = make("button", `กรองรายชื่อกลุ่ม ${site.shortName}`, "btn sm");
        filterBtn.type = "button";
        filterBtn.addEventListener("click", () => {
          if ($("studentAreaFilter")) $("studentAreaFilter").value = site.shortName;
          if ($("studentDiscFilter")) $("studentDiscFilter").value = "";
          state.classContext = null;
          renderStudentsView();
        });
        c.appendChild(filterBtn);
        sitesGrid.appendChild(c);
      });
    }
    if (sitesGrid) {
      sitesGrid.querySelectorAll(".site-card").forEach((c) => {
        c.classList.toggle("active-site", c.dataset.siteName === areaVal);
      });
    }

    const ctxBox = $("classContextBanner");
    if (ctxBox) {
      ctxBox.replaceChildren();
      ctxBox.hidden = !state.classContext;
      if (state.classContext) {
        const c = state.classContext;
        const left = make("div");
        left.append(
          make("h3", c.topic),
          make("p", `${c.date} · ${c.time} · ห้อง: ${c.room}`),
          make("p", `ผู้สอน: ${c.lecturer} · กลุ่ม: ${c.label}`)
        );
        const right = make("div", null, "header-actions");
        const backBtn = make("button", "กลับไปปฏิทินสอน", "btn sm");
        backBtn.type = "button";
        backBtn.addEventListener("click", () => switchTab("schedule"));
        const gasLink = make("a", "เปิดดูรูปถ่ายใน Apps Script", "btn sm teal");
        gasLink.href = buildAppsScriptDeepLink(areaVal, discVal);
        gasLink.target = "_blank";
        gasLink.rel = "noopener";
        right.append(backBtn, gasLink);
        ctxBox.append(left, right);
      }
    }

    const topGasBtn = $("openAppsScriptRosterBtn");
    if (topGasBtn) topGasBtn.href = buildAppsScriptDeepLink(areaVal, discVal);

    const list = ROSTER.students.filter((s) => {
      if (areaVal && s.area !== areaVal) return false;
      if (discVal && String(s.disc) !== discVal) return false;
      if (q) {
        const hay = `${s.id} ${s.fullName} ${s.nickname} ${s.area} ${s.advisor} discussion ${s.disc}`.toLocaleLowerCase("th");
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => (discVal ? compareTH(a.id, b.id) : compareTH(a.area, b.area) || compareTH(a.id, b.id)));
    state.visibleStudents = list;

    const selectionLabel = discVal
      ? `กลุ่มอภิปราย Discussion ${discVal}`
      : areaVal
      ? `กลุ่มพื้นที่ ${areaVal}`
      : "นักศึกษาแพทย์ชั้นปีที่ 3 ทั้งหมด";

    if ($("studentStatusText")) {
      $("studentStatusText").textContent = `${selectionLabel} · แสดง ${list.length} คน จากทั้งหมด ${ROSTER.students.length} คน`;
    }
    if ($("printStudentsBtn")) {
      $("printStudentsBtn").disabled = list.length === 0;
    }

    const printHeading = $("printHeading");
    if (printHeading) {
      printHeading.replaceChildren(make("strong", `RACM 303 (ปีการศึกษา 2569) · ${selectionLabel} · ${list.length} คน`));
      if (state.classContext) {
        printHeading.append(
          make("div", state.classContext.topic),
          make("div", `${state.classContext.date} · ${state.classContext.time} · ${state.classContext.room}`)
        );
      }
    }

    const cardsEl = $("studentCardsContainer");
    if (!cardsEl) return;
    if (photoObserver) photoObserver.disconnect();
    cardsEl.replaceChildren();

    if (!list.length) {
      cardsEl.appendChild(make("div", "ไม่พบรายชื่อนักศึกษาตามเงื่อนไขที่เลือก", "empty-state"));
      return;
    }

    let lastArea = null;
    list.forEach((s) => {
      if (!discVal && s.area !== lastArea) {
        lastArea = s.area;
        const siteObj = (SCHED.fieldworkSites || []).find((x) => x.shortName === s.area);
        const h = make("div", null, "area-group-header");
        h.append(
          make("h3", `กลุ่มพื้นที่ ${s.area}${siteObj ? " (" + siteObj.hospital + " " + siteObj.province + ")" : ""}`),
          make("p", `อาจารย์ที่ปรึกษา: ${s.advisor}${siteObj ? " · ห้อง " + siteObj.room : ""}`)
        );
        cardsEl.appendChild(h);
      }

      const card = make("article", null, "student-card");
      const initials = studentInitials(s);
      const portrait = make("div", null, `student-portrait${state.showPhotos ? "" : " compact-avatar"}`);
      portrait.dataset.photoId = s.photoId || "";
      portrait.dataset.initials = initials;
      portrait.dataset.studentName = s.fullName;
      portrait.innerHTML = `<span class="avatar-monogram">${escapeHtml(initials)}</span>`;
      if (state.showPhotos && s.photoId) {
        if (photoObserver) photoObserver.observe(portrait);
        else mountStudentPhoto(portrait);
      }

      card.appendChild(portrait);
      card.appendChild(make("h3", s.nickname || s.fullName));
      if (s.nickname) card.appendChild(make("p", s.fullName));
      card.appendChild(make("p", `รหัส: ${s.id}${s.program === "MD-M.Eng" ? " (MD-M.Eng)" : ""}`, "sid-mono"));
      card.appendChild(make("p", `พื้นที่: ${s.area}`, "s-area"));
      card.appendChild(make("p", `Discussion: กลุ่มที่ ${s.disc}`, "disc-line"));
      cardsEl.appendChild(card);
    });
  }

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

  function fitPrintRoster() {
    const layout = computePrintLayout(state.visibleStudents.length || 1);
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--pc", String(layout.cols));
    rootStyle.setProperty("--pr", `${layout.height}mm`);
    rootStyle.setProperty("--pp", `${layout.photo}mm`);
    rootStyle.setProperty("--pt", `${layout.title}pt`);
    rootStyle.setProperty("--pb", `${layout.text}pt`);
  }

  async function printStudentRosterOnePage() {
    if (!state.visibleStudents.length) return;
    document.body.classList.add("print-students-mode");
    if (state.showPhotos) {
      document.querySelectorAll("#studentCardsContainer .student-portrait").forEach((box) => {
        if (!box.querySelector("img") && box.dataset.photoId) mountStudentPhoto(box);
      });
    }
    fitPrintRoster();
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) {}
    }
    window.print();
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

  function attachProseEnhancements(proseContainer, tocContainer) {
    if (!proseContainer) return;
    if (tocContainer) {
      tocContainer.replaceChildren();
      const headings = proseContainer.querySelectorAll("h2, h3");
      headings.forEach((h, idx) => {
        if (!h.id) h.id = `sec-h-${idx}`;
        const li = document.createElement("li");
        const a = make("a", h.textContent.trim(), `toc-link${h.tagName === "H3" ? " toc-sub" : ""}`);
        a.href = `#${h.id}`;
        a.addEventListener("click", (ev) => {
          ev.preventDefault();
          h.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        li.appendChild(a);
        tocContainer.appendChild(li);
      });
    }

    proseContainer.querySelectorAll("img").forEach((img) => {
      img.loading = "lazy";
      img.classList.add("zoomable-img");
      img.addEventListener("click", () => openLightbox(img.src, img.alt || ""));
    });
  }

  function openLightbox(src, caption) {
    const lb = $("imageLightbox");
    if (!lb) return;
    $("lightboxImg").src = src;
    $("lightboxCaption").textContent = caption;
    lb.hidden = false;
  }

  /* ---------- Tab 3: 2569 Course Manual ---------- */
  function initManualControls() {
    const search = $("manualSearchInput");
    if (search) search.addEventListener("input", renderManualReader);
    ["printManualBtn", "facPrintManualBtn"].forEach((id) => {
      if ($(id)) {
        $(id).addEventListener("click", () => {
          document.body.classList.remove("print-students-mode");
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
        if (!prose) return;
        const detailsList = [...prose.querySelectorAll("details")];
        const anyClosed = detailsList.some((d) => !d.open);
        detailsList.forEach((d) => (d.open = anyClosed));
        expandAllBtn.textContent = anyClosed ? "ซ่อนแนวคำตอบทั้งหมด" : "เปิดแนวคำตอบทั้งหมด";
      });
    }
    ["printTextbookBtn", "fPrintTextbookBtn"].forEach((id) => {
      if ($(id)) {
        $(id).addEventListener("click", () => {
          document.body.classList.remove("print-students-mode");
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
        document.body.classList.remove("print-students-mode");
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
    initStudentsControls();
    initManualControls();
    initTextbooksControls();
    initPracticeControls();
    initFacultyDocsControls();

    const params = new URLSearchParams(window.location.search);
    if (params.get("page") === "students") {
      const t = params.get("type");
      const g = params.get("group") || "";
      if (t === "discussion" && $("studentDiscFilter")) $("studentDiscFilter").value = g;
      if (t === "area" && $("studentAreaFilter")) $("studentAreaFilter").value = g;
      switchTab("students", false);
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
