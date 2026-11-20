(function () {
  "use strict";

  const STORAGE_KEY = "racm303_iq_answers_v1";
  const GEMINI_KEY_STORAGE = "racm303_gemini_api_key_v1";

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  let answerStore = loadStore();

  function saveStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(answerStore));
    } catch (_) {
      /* ignore quota errors */
    }
  }

  function getGeminiKey() {
    try {
      return (localStorage.getItem(GEMINI_KEY_STORAGE) || "").trim();
    } catch (_) {
      return "";
    }
  }

  function setGeminiKey(k) {
    try {
      if (k && k.trim()) localStorage.setItem(GEMINI_KEY_STORAGE, k.trim());
      else localStorage.removeItem(GEMINI_KEY_STORAGE);
    } catch (_) {
      /* ignore */
    }
  }

  function getRubrics() {
    return (window.RACM_HS_DATA && window.RACM_HS_DATA.interactiveRubrics) || {};
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function stripTags(html) {
    return String(html || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* ---------- Normalization & Domain Concept Extraction for Diagnostic Rubric Feedback ---------- */
  const SYNONYM_GROUPS = [
    ["ใช่", "มี", "พบ", "ผิดปกติ", "yes", "true"],
    ["ไม่ใช่", "ไม่มี", "ไม่พบ", "ปกติ", "ไม่ได้", "no", "false"],
    ["ยังไม่ทราบ", "ไม่ทราบ", "ไม่แน่ใจ", "สรุปไม่ได้", "unknown"],
    ["อยู่", "อยู่ในระบบ", "อยู่ในระบบสุขภาพ"],
    ["อยู่ที่ขอบ", "ก้ำกึ่ง", "ขอบเขต", "ขึ้นกับการตีความ"],
    ["ไม่อยู่", "ไม่อยู่ในระบบ", "นอกระบบ"],
    ["บกพร่อง", "มีปัญหา", "ขาดแคลน"],
    ["ไม่บกพร่อง", "ไม่พบความบกพร่อง", "ดำเนินการแล้ว"],
    ["ระดับที่หนึ่ง", "ระดับ 1", "ปฐมภูมิ", "primary prevention", "primary"],
    ["ระดับที่สอง", "ระดับ 2", "ทุติยภูมิ", "secondary prevention", "secondary"],
    ["ระดับที่สาม", "ระดับ 3", "ตติยภูมิ", "tertiary prevention", "tertiary"],
    ["ระดับที่สี่", "ระดับ 4", "จตุรภูมิ", "quaternary prevention", "quaternary"],
    ["ก่อนเกิดปัจจัยเสี่ยง", "primordial prevention", "primordial"],
    ["ภาครัฐ", "ของรัฐ", "รัฐ"],
    ["เอกชนไม่แสวงหากำไร", "ไม่แสวงหากำไร", "มูลนิธิ", "การกุศล", "not-for-profit"],
    ["เอกชนแสวงหากำไร", "แสวงหากำไร", "เอกชน", "for-profit"],
  ];

  function normalizeShortToken(s) {
    const clean = String(s || "")
      .toLowerCase()
      .replace(/[\s"“”'‘’.,()\-–—/]/g, "")
      .trim();
    if (!clean) return "";
    for (let i = 0; i < SYNONYM_GROUPS.length; i++) {
      const grp = SYNONYM_GROUPS[i];
      for (const item of grp) {
        const normItem = item.toLowerCase().replace(/[\s"“”'‘’.,()\-–—/]/g, "");
        if (clean === normItem) return `syn_${i}`;
      }
    }
    return clean;
  }

  function matchCellValue(userVal, expectedVal) {
    const uRaw = String(userVal || "").trim();
    const eRaw = String(expectedVal || "").trim();
    if (!uRaw) return { status: "empty" };
    if (!eRaw || eRaw === "—" || eRaw === "-") return { status: "open_ok" };

    const uNorm = normalizeShortToken(uRaw);
    const eNorm = normalizeShortToken(eRaw);
    if (uNorm && uNorm === eNorm) return { status: "exact" };

    // If expected cell is a short categorical label (<= 22 chars), check substring or synonym containment
    if (eRaw.length <= 24) {
      const uLow = uRaw.toLowerCase();
      const eLow = eRaw.toLowerCase();
      // Guard against "ใช่" matching inside "ไม่ใช่" or "อยู่" matching inside "ไม่อยู่"!
      if (
        (eLow === "ใช่" && uLow.includes("ไม่ใช่")) ||
        (eLow === "ไม่ใช่" && uLow === "ใช่") ||
        (eLow === "อยู่" && (uLow.includes("ไม่อยู่") || uLow.includes("อยู่ที่ขอบ"))) ||
        (eLow === "บกพร่อง" && uLow.includes("ไม่บกพร่อง"))
      ) {
        return { status: "mismatch" };
      }
      for (const grp of SYNONYM_GROUPS) {
        if (grp.some((g) => eLow === g.toLowerCase())) {
          if (grp.some((g) => uLow === g.toLowerCase() || (g.length >= 4 && uLow.includes(g.toLowerCase())))) {
            return { status: "exact" };
          }
          return { status: "mismatch" };
        }
      }
      if (uLow.includes(eLow) || eLow.includes(uLow)) return { status: "exact" };
      return { status: "mismatch" };
    }

    // Descriptive cell: check concept overlap
    const concepts = extractKeyConceptsFromText(eRaw, "");
    if (!concepts.length) return { status: uRaw.length >= 6 ? "partial" : "brief" };
    const uLow = uRaw.toLowerCase();
    const hit = concepts.filter((c) => c.tokens.some((t) => uLow.includes(t)));
    if (hit.length >= Math.max(1, Math.ceil(concepts.length * 0.4))) return { status: "exact" };
    if (hit.length > 0) return { status: "partial" };
    return { status: "review" };
  }

  const STOP_PHRASES = new Set([
    "แนวคำตอบ",
    "แนวคำตอบหนึ่งที่สมเหตุสมผล",
    "แนวคำตอบหนึ่งที่สมเหตุสมผลคือ",
    "แนวคำตอบต่อไปนี้เป็นแนวคำตอบหนึ่งที่สมเหตุสมผล",
    "คำตอบหนึ่งที่สมเหตุสมผลคือ",
    "ตัวอย่างหนึ่งคือ",
    "ตัวอย่างเช่น",
    "คำถามนำ",
    "ส่วนที่หนึ่ง",
    "ส่วนที่สอง",
    "กล่าวคือ",
    "อย่างไรก็ตาม",
    "นอกจากนี้",
    "ในทางกลับกัน",
    "ดังนั้น",
    "เนื่องจาก",
    "เพราะเหตุใด",
  ]);

  function extractKeyConceptsFromText(plainText, rawHtml) {
    const concepts = [];
    const seen = new Set();

    const addConcept = (label, altTokens = []) => {
      const cleanLabel = String(label || "")
        .replace(/^[\d.)\s•\-–:]+/, "")
        .replace(/[\s.,;:]+$/, "")
        .trim();
      if (!cleanLabel || cleanLabel.length < 3 || cleanLabel.length > 75) return;
      if (STOP_PHRASES.has(cleanLabel)) return;
      const key = cleanLabel.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      const tokens = [key, ...altTokens.map((t) => String(t || "").toLowerCase().trim()).filter((t) => t.length >= 2)];
      // Also split "Thai (English)" into either Thai or English match
      const parenM = cleanLabel.match(/^(.+?)\s*\(([^)]+)\)$/);
      if (parenM) {
        const p1 = parenM[1].trim().toLowerCase();
        const p2 = parenM[2].trim().toLowerCase();
        if (p1.length >= 3) tokens.push(p1);
        if (p2.length >= 2) tokens.push(p2);
      }
      concepts.push({ label: cleanLabel, tokens: [...new Set(tokens)] });
    };

    // 1. Extract <strong>...</strong> anchors from HTML
    if (rawHtml) {
      const strongRe = /<(?:strong|b|em)\b[^>]*>(.*?)<\/(?:strong|b|em)>/gi;
      let m;
      while ((m = strongRe.exec(rawHtml)) !== null) {
        const st = stripTags(m[1]);
        if (st && !STOP_PHRASES.has(st)) addConcept(st);
      }
    }

    // 2. Extract "Thai phrase (English term)" pairs from plainText
    const pairRe = /([ก-๙][ก-๙\s\-–/]{2,42}?)\s*\(([A-Za-z][A-Za-z0-9\s\-–/&:.]{1,45})\)/g;
    let pm;
    while ((pm = pairRe.exec(plainText)) !== null) {
      const th = pm[1].trim().split(/\s+/).slice(-3).join(" ");
      const en = pm[2].trim();
      if (!/^\d{4}$/.test(en) && !en.toLowerCase().includes("et al")) {
        addConcept(`${th} (${en})`, [th, en]);
      }
    }

    // 3. Extract salient domain keywords & numbers present in the model answer
    const DOMAIN_TERMS = [
      ["โรค (disease)", ["เป็นโรค", "มีโรค", "ความผิดปกติในร่างกาย", "disease"]],
      ["การเจ็บป่วย (illness)", ["การเจ็บป่วย", "รู้สึกไม่สบาย", "รู้สึกป่วย", "ความกังวล", "illness"]],
      ["ภาวะที่สังคมยอมรับว่าป่วย (sickness)", ["สังคมยอมรับว่าป่วย", "ใบรับรองแพทย์", "ลาป่วย", "บทบาทผู้ป่วย", "sickness"]],
      ["สุขภาวะ (well-being)", ["สุขภาวะ", "well-being", "อยู่ดีมีสุข"]],
      ["ความเป็นอยู่ที่ดี (wellness)", ["ความเป็นอยู่ที่ดี", "wellness", "พัฒนาสุขภาพของตน"]],
      ["ความสามารถในการปรับตัว", ["ปรับตัว", "จัดการตนเอง", "adapt", "self-manage", "huber"]],
      ["ศักยภาพทางสุขภาพกับความท้าทายของชีวิต", ["ศักยภาพ", "ความท้าทาย", "bircher"]],
      ["ปัจจัยต้นน้ำเชิงโครงสร้าง", ["ต้นน้ำ", "เชิงโครงสร้าง", "นโยบาย", "การเมือง", "ฐานะทางสังคม", "structural"]],
      ["ปัจจัยปลายน้ำในชีวิตประจำวัน", ["ปลายน้ำ", "สภาพความเป็นอยู่", "ที่อยู่อาศัย", "น้ำสะอาด", "สุขาภิบาล", "intermediary"]],
      ["การป้องกันก่อนเกิดปัจจัยเสี่ยง (primordial)", ["ก่อนเกิดปัจจัยเสี่ยง", "primordial"]],
      ["การป้องกันระดับที่หนึ่ง (primary)", ["ระดับที่หนึ่ง", "ระดับ 1", "วัคซีน", "เลิกบุหรี่", "ลดปัจจัยเสี่ยง", "primary prevention"]],
      ["การป้องกันระดับที่สอง (secondary)", ["ระดับที่สอง", "ระดับ 2", "คัดกรอง", "ระยะเริ่มแรก", "ผลลบลวง", "false negative", "secondary"]],
      ["การป้องกันระดับที่สาม (tertiary)", ["ระดับที่สาม", "ระดับ 3", "ฟื้นฟู", "ภาวะแทรกซ้อน", "ความพิการ", "tertiary"]],
      ["การป้องกันระดับที่สี่ (quaternary)", ["ระดับที่สี่", "ระดับ 4", "เกินจำเป็น", "ผลบวกลวง", "false positive", "quaternary"]],
      ["การตัดสินใจร่วมกัน (shared decision-making)", ["ตัดสินใจร่วมกัน", "รับฟังความกังวล", "ประโยชน์และผลเสีย", "shared decision"]],
      ["เจตนาหลัก (primary intent)", ["เจตนาหลัก", "primary intent", "เป้าหมายหลักเพื่อสุขภาพ"]],
      ["ระบบความสัมพันธ์ทั้งมวล (พ.ร.บ. สุขภาพแห่งชาติ)", ["ความสัมพันธ์ทั้งมวล", "พ.ร.บ. สุขภาพ", "พระราชบัญญัติสุขภาพแห่งชาติ"]],
      ["หกองค์ประกอบหลักของระบบสุขภาพ (6 building blocks)", ["องค์ประกอบหลัก", "กำลังคน", "การคลัง", "สารสนเทศ", "ยาและเทคโนโลยี", "การอภิบาล", "การจัดบริการ", "building blocks"]],
      ["ระบบที่ซับซ้อนและปรับตัวได้ (CAS) และวงจรผลสะท้อนกลับ", ["ซับซ้อนและปรับตัวได้", "ผลสะท้อนกลับ", "บริบท", "feedback", "adaptive"]],
      ["ห่วงโซ่ผลลัพธ์ (ปัจจัยนำเข้า–กระบวนการ–ผลผลิต–ผลลัพธ์–ผลกระทบ)", ["ปัจจัยนำเข้า", "กระบวนการ", "ผลผลิต", "ผลลัพธ์", "ผลกระทบ", "results chain"]],
      ["เป้าหมายห้าประการ (Quintuple Aim)", ["ห้าประการ", "หมดไฟ", "คนทำงาน", "ความเหลื่อมล้ำ", "quintuple", "quadruple", "triple aim"]],
      ["กรอบ 6W (WHO, WHY, WHEN, WHAT, WHICH, WHERE)", ["who", "why", "when", "what", "which", "where", "6w"]],
      ["การดูแลฉุกเฉิน (1669 / คัดแยก)", ["1669", "ฉุกเฉิน", "คัดแยก", "triage", "จุดเกิดเหตุ"]],
      ["การดูแลระยะเฉียบพลัน (ทำให้ภาวะคงที่)", ["เฉียบพลัน", "คงที่", "พ้นวิกฤต", "acute"]],
      ["การดูแลระยะกลาง (IMC / Barthel / reablement)", ["ระยะกลาง", "imc", "บาร์เธล", "barthel", "reablement", "6 เดือน", "หกเดือน", "step-down", "step-up"]],
      ["การดูแลผู้ป่วยนอก (ไม่ค้างคืน / ODS)", ["ผู้ป่วยนอก", "ไม่ค้างคืน", "วันเดียวกลับ", "ambulatory", "ods"]],
      ["การดูแลภาวะเรื้อรัง (CCM / ผู้ป่วยเป็นนักบิน / ไตรภาคี)", ["เรื้อรัง", "จัดการตนเอง", "เชิงรุก", "ไตรภาคี", "ccm", "iccc"]],
      ["การดูแลระยะยาว (LTC / ศักยภาพทางกายและใจ / ความสามารถในการดำเนินชีวิต)", ["ระยะยาว", "ltc", "ดำเนินชีวิต", "พึ่งพิง", "ผู้ดูแล", "functional ability", "intrinsic capacity"]],
      ["การดูแลแบบประคับประคอง (บรรเทาทุกข์ 4 มิติ / ACP)", ["ประคับประคอง", "palliative", "วางแผนการดูแลล่วงหน้า", "acp", "มาตรา 12", "มอร์ฟีน", "โฮสปิซ"]],
      ["ความเป็นธรรม vs ความเท่าเทียม (equity vs equality)", ["ความเป็นธรรม", "ความเท่าเทียม", "ตามความจำเป็น", "equity", "equality"]],
      ["ภาวะที่คนยิ่งต้องการการดูแลมากกลับเข้าถึงบริการได้น้อย (inverse care law)", ["ต้องการการดูแลมาก", "สวนทางกับความจำเป็น", "inverse care", "ทิวดอร์ ฮาร์ต"]],
      ["การคุ้มครองทางการเงินและภาระค่ารักษาเกินกำลัง (CHE)", ["คุ้มครอง", "หนักเกินกำลัง", "ยากจนลง", "ร้อยละ 40", "catastrophic", "che", "จ่ายเงินสด", "oop"]],
      ["กรอบคุณภาพ STEP และแบบจำลองแผ่นเนยแข็งสวิส", ["ความปลอดภัย", "ทันเวลา", "ประสิทธิผล", "ผู้ป่วยเป็นศูนย์กลาง", "เนยแข็งสวิส", "รูรั่ว", "เกือบพลาด", "near miss", "swiss cheese", "step"]],
      ["ความครอบคลุมอย่างมีประสิทธิผล (Need–Use–Quality)", ["ความครอบคลุมอย่างมีประสิทธิผล", "effective coverage", "คุณภาพ", "ควบคุมโรคได้จริง"]],
      ["ต้นทุนค่าเสียโอกาสและประสิทธิภาพ 3 ระดับ", ["ค่าเสียโอกาส", "opportunity cost", "เชิงเทคนิค", "เชิงการผลิต", "การจัดสรรทรัพยากร", "hta"]],
      ["ธรรมาภิบาล ภาระรับผิดชอบต่อสังคม และความสอดคล้องกับบริบท", ["ธรรมาภิบาล", "ภาระรับผิดชอบต่อสังคม", "ชี้แจง", "ตรวจสอบ", "รู้ข้อมูลไม่เท่ากัน", "บริบท", "accountability", "stewardship", "relevance"]],
      ["ความยืดหยุ่นของระบบ 3 ระดับ (รองรับเบื้องต้น ปรับวิธีทำงาน ปฏิรูปโครงสร้าง)", ["รองรับวิกฤต", "ปรับวิธีทำงาน", "ปฏิรูปโครงสร้าง", "absorptive", "adaptive", "transformative", "resilience"]],
      ["กฎบัตรออตตาวา 5 กลยุทธ์ (Ottawa Charter)", ["ออตตาวา", "นโยบายสาธารณะ", "สิ่งแวดล้อมที่เอื้อ", "ชุมชนเข้มแข็ง", "ทักษะส่วนบุคคล", "ปรับระบบบริการ", "ottawa"]],
      ["ระบบคิดแบบอัตโนมัติและแบบไตร่ตรอง (System 1 & 2) และ Nudge", ["อัตโนมัติ", "ไตร่ตรอง", "system 1", "system 2", "สะกิด", "nudge", "ตีกรอบ", "ค่าเริ่มต้น", "mindspace"]],
      ["ตัวแบบ COM-B และวงล้อการปรับเปลี่ยนพฤติกรรม (BCW)", ["ความสามารถ", "โอกาส", "แรงจูงใจ", "com-b", "capability", "opportunity", "motivation", "bcw"]],
      ["ความรอบรู้ด้านสุขภาพระดับบุคคลและระดับองค์กร", ["ความรอบรู้ด้านสุขภาพ", "health literacy", "ระดับองค์กร", "teach-back"]],
      ["ระบบบริการสุขภาพปฐมภูมิ (PHC) vs บริการปฐมภูมิ (PC)", ["ระบบบริการสุขภาพปฐมภูมิ", "บริการปฐมภูมิ", "ข้ามภาคส่วน", "มีส่วนร่วมของชุมชน", "อัลมา-อตา", "อัสตานา", "phc", "primary care"]],
      ["คุณลักษณะบริการปฐมภูมิ 4 ประการ (4Cs ของ Starfield)", ["ด่านแรก", "ต่อเนื่อง", "ครอบคลุม", "ประสานงาน", "starfield", "first contact", "continuity", "comprehensiveness", "coordination"]],
      ["การจ่ายเงินล่วงหน้า การรวมกองทุน และการเฉลี่ยความเสี่ยง/เกลี่ยรายได้", ["จ่ายเงินล่วงหน้า", "รวมกองทุน", "เฉลี่ยความเสี่ยง", "เกลี่ยรายได้", "กฎของจำนวนมาก", "prepayment", "pooling"]],
      ["ตลาดประกันสมัครใจ vs ภาคบังคับ (adverse & risk selection)", ["ภาคบังคับ", "สมัครใจ", "ความเสี่ยงสูงเข้าซื้อ", "คัดกรองความเสี่ยง", "วงจรขาลง", "adverse selection", "cream skimming", "risk selection"]],
      ["สามกองทุนหลักของไทย (บัตรทอง ประกันสังคม สวัสดิการข้าราชการ)", ["บัตรทอง", "หลักประกันสุขภาพแห่งชาติ", "ประกันสังคม", "สวัสดิการข้าราชการ", "ucs", "sss", "csmbs"]],
      ["กลไกจ่ายเงินผู้ให้บริการ (FFS, Capitation, DRGs, Global Budget)", ["จ่ายตามรายการ", "เหมาจ่ายรายหัว", "กลุ่มวินิจฉัยโรคร่วม", "งบประมาณยอดรวม", "เร่งทำแต้ม", "ให้รหัสสูงเกินจริง", "ffs", "capitation", "drg", "adjrw", "global budget", "upcoding", "treadmill"]],
      ["การใช้บริการเพิ่มขึ้นเมื่อมีผู้จ่ายแทนและการสั่งบริการเกินจำเป็น (moral hazard & SID)", ["ผู้จ่ายแทน", "สั่งการตรวจรักษาเกิน", "สั่งบริการเกิน", "ร่วมจ่าย", "ด่านหน้า", "moral hazard", "sid", "gatekeeping", "co-payment"]],
    ];

    const pLow = plainText.toLowerCase();
    for (const [label, toks] of DOMAIN_TERMS) {
      if (toks.some((t) => pLow.includes(t.toLowerCase()))) {
        addConcept(label, toks);
      }
    }

    return concepts.slice(0, 8);
  }

  /* ---------- Built-In Diagnostic Evaluation (Zero-Setup, Instant, Grounded on Official Answer Key) ---------- */
  function evaluateLocally(rubric, submission) {
    const didWell = [];
    const needsAttention = [];
    const canImprove = [];

    if (rubric.kind === "table") {
      const cells = (submission && submission.cells) || {};
      const headers = rubric.headers || [];
      const qRows = rubric.rows || [];
      const aRows = rubric.answerRows || null;

      let totalFillable = 0;
      let filledCount = 0;
      const cellFeedbackMap = {};
      const correctRowLabels = [];
      const mismatchDetails = [];
      const partialDetails = [];
      const emptyRowLabels = [];

      qRows.forEach((rCells, rIdx) => {
        const rowLabel = rCells[0] || `แถวที่ ${rIdx + 1}`;
        let rowHasEmpty = false;
        let rowAllGood = true;
        let rowCheckedAny = false;

        rCells.forEach((origVal, cIdx) => {
          if (cIdx === 0 || (origVal && origVal.trim() !== "")) return;
          totalFillable++;
          const key = `${rIdx}_${cIdx}`;
          const uVal = (cells[key] || "").trim();
          const colName = headers[cIdx] || `ช่องที่ ${cIdx}`;

          if (!uVal) {
            rowHasEmpty = true;
            rowAllGood = false;
            cellFeedbackMap[key] = "empty";
            return;
          }
          filledCount++;

          if (aRows && aRows[rIdx] && aRows[rIdx][cIdx] !== undefined) {
            rowCheckedAny = true;
            const expVal = aRows[rIdx][cIdx];
            const res = matchCellValue(uVal, expVal);
            cellFeedbackMap[key] = res.status;
            if (res.status === "mismatch") {
              rowAllGood = false;
              mismatchDetails.push(
                `<strong>${escapeHtml(rowLabel)} (${escapeHtml(colName)})</strong>: ผู้เรียนกรอก <code>${escapeHtml(uVal)}</code> — แนวคำตอบคือ <strong>“${escapeHtml(expVal)}”</strong>`
              );
            } else if (res.status === "review" || res.status === "brief") {
              rowAllGood = false;
              partialDetails.push(
                `<strong>${escapeHtml(rowLabel)} (${escapeHtml(colName)})</strong>: ลองเชื่อมประเด็น <em>“${escapeHtml(expVal)}”</em> เพิ่มเติม`
              );
            }
          } else {
            cellFeedbackMap[key] = uVal.length >= 4 ? "open_ok" : "brief";
            if (uVal.length < 4) rowAllGood = false;
          }
        });

        if (rowHasEmpty) emptyRowLabels.push(rowLabel);
        else if (rowAllGood && (rowCheckedAny || filledCount > 0)) correctRowLabels.push(rowLabel);
      });

      if (filledCount === 0) {
        return {
          emptySubmission: true,
          cellFeedbackMap,
          whatDidWell: ["คุณเปิดตารางฝึกวิเคราะห์พร้อมทำแล้ว — ลองเลือกหรือพิมพ์คำตอบในช่องว่างอย่างน้อยบางแถวก่อนกดส่ง เพื่อรับคำแนะนำรายช่องได้ทันที"],
          whatNeedsAttention: [`ยังไม่ได้กรอกข้อมูลในตาราง (มีช่องให้เติมทั้งหมด ${totalFillable} ช่อง)`],
          whatCanImprove: ["เริ่มจากแถวที่มั่นใจที่สุดก่อน แล้วสังเกตความแตกต่างระหว่างแต่ละแถวตามเกณฑ์ในหัวตาราง"],
        };
      }

      if (correctRowLabels.length > 0) {
        didWell.push(
          `วิเคราะห์และเติมข้อมูลในแถว <strong>${escapeHtml(correctRowLabels.join(", "))}</strong> ได้สอดคล้องกับแนวคำตอบอย่างแม่นยำ`
        );
      } else if (filledCount > 0) {
        didWell.push(`ตั้งต้นกรอกข้อมูลแล้ว ${filledCount} จาก ${totalFillable} ช่อง ช่วยให้เห็นวิธีคิดเบื้องต้นสำหรับเทียบกับแนวคำตอบได้ชัดเจน`);
      }

      // Check concept coverage across all typed table text vs answerHtml
      const allTyped = Object.values(cells).join(" ");
      const ansConcepts = extractKeyConceptsFromText(stripTags(rubric.answerHtml), rubric.answerHtml);
      const matchedConcepts = ansConcepts.filter((c) => c.tokens.some((t) => allTyped.toLowerCase().includes(t)));
      if (matchedConcepts.length > 0) {
        didWell.push(
          `เชื่อมโยงแนวคิดสำคัญได้ดี ได้แก่ ${matchedConcepts
            .slice(0, 3)
            .map((c) => `<strong>${escapeHtml(c.label)}</strong>`)
            .join(", ")}`
        );
      }

      mismatchDetails.slice(0, 5).forEach((msg) => needsAttention.push(msg));
      if (emptyRowLabels.length > 0) {
        needsAttention.push(
          `ยังมีช่องว่างที่ยังไม่ได้กรอกในแถว <strong>${escapeHtml(emptyRowLabels.join(", "))}</strong> (${totalFillable - filledCount} ช่อง)`
        );
      }
      if (!needsAttention.length && partialDetails.length > 0) {
        partialDetails.slice(0, 3).forEach((msg) => needsAttention.push(msg));
      }
      if (!needsAttention.length) {
        needsAttention.push("ไม่พบจุดคลาดเคลื่อนในช่องจำแนกหลัก — คำตอบในตารางมีความถูกต้องครบถ้วนดีมาก");
      }

      if (partialDetails.length > 0) {
        canImprove.push(...partialDetails.slice(0, 3));
      }
      const missingConcepts = ansConcepts.filter((c) => !matchedConcepts.includes(c));
      if (missingConcepts.length > 0) {
        canImprove.push(
          `ในช่องสรุปประเด็น/เหตุผล อาจระบุคำสำคัญให้คมชัดขึ้น เช่น ${missingConcepts
            .slice(0, 3)
            .map((c) => `<strong>${escapeHtml(c.label)}</strong>`)
            .join(", ")}`
        );
      } else {
        canImprove.push("ลองเปรียบเทียบถ้อยคำในช่องสรุปของตนเองกับตารางแนวคำตอบด้านล่าง เพื่อฝึกเขียนเหตุผลให้กระชับและนำไปอภิปรายในกลุ่มย่อยได้ทันที");
      }

      return { cellFeedbackMap, whatDidWell: didWell, whatNeedsAttention: needsAttention, whatCanImprove: canImprove };
    }

    if (rubric.kind === "cloze") {
      const blanks = (submission && submission.blanks) || {};
      const cMap = rubric.clozeMap || {};
      const keys = Object.keys(cMap);
      const blankStatus = {};
      const rightNums = [];
      const wrongItems = [];
      const emptyNums = [];

      keys.forEach((k) => {
        const u = (blanks[k] || "").trim();
        const exp = cMap[k];
        if (!u) {
          blankStatus[k] = "empty";
          emptyNums.push(`(${k})`);
          return;
        }
        const uClean = u.replace(/ร้อยละ|%/g, "").trim().toLowerCase();
        const eClean = exp.replace(/ร้อยละ|%/g, "").trim().toLowerCase();
        if (uClean === eClean || (eClean.length >= 4 && (eClean.includes(uClean) || uClean.includes(eClean)) && uClean.length >= 3)) {
          blankStatus[k] = "exact";
          rightNums.push(`(${k}) ${exp}`);
        } else {
          blankStatus[k] = "mismatch";
          wrongItems.push(`ช่อง <strong>(${k})</strong> กรอก <code>${escapeHtml(u)}</code> → แนวคำตอบคือ <strong>${escapeHtml(exp)}</strong>`);
        }
      });

      if (rightNums.length === 0 && emptyNums.length === keys.length) {
        return {
          emptySubmission: true,
          blankStatus,
          whatDidWell: ["พร้อมเริ่มฝึกอ่านข้อมูลจากตารางแล้ว — ลองเติมตัวเลขและคำสำคัญในช่อง (1)–(7) ก่อนกดส่งคำตอบ"],
          whatNeedsAttention: ["ยังไม่ได้กรอกช่องว่าง (1)–(7)"],
          whatCanImprove: ["เทียบตัวเลขจากตารางสรุปผลการศึกษาด้านบนทีละแถว แล้วเติมลงในช่องว่างตามลำดับ"],
        };
      }

      if (rightNums.length > 0) {
        didWell.push(`ดึงข้อมูลจากตารางมาเติมได้ถูกต้อง ${rightNums.length}/${keys.length} ช่อง ได้แก่ <strong>${escapeHtml(rightNums.join(", "))}</strong>`);
      } else {
        didWell.push("ได้ทดลองเติมข้อมูลในย่อหน้าแล้ว ช่วยให้ตรวจสอบจุดที่ตีความคลาดเคลื่อนจากตารางได้ทันที");
      }

      wrongItems.forEach((w) => needsAttention.push(w));
      if (emptyNums.length > 0) needsAttention.push(`ยังไม่ได้เติมช่อง <strong>${emptyNums.join(", ")}</strong>`);
      if (!needsAttention.length) needsAttention.push("เติมข้อมูลครบทุกช่องและถูกต้องตรงตามตารางทั้งหมด");

      canImprove.push(
        "เมื่อเติมตัวเลขครบแล้ว สังเกตข้อคิดสำคัญว่าแม้ค่าเฉลี่ยรวมจะมาจากในภาคสุขภาพและนอกภาคสุขภาพราวครึ่งต่อครึ่ง แต่สัดส่วนจริงแตกต่างกันไปตามบริบทของแต่ละประเทศ จึงไม่ควรนำค่าเฉลี่ยระดับโลกไปใช้แบบเหมารวมโดยไม่ดูข้อมูลพื้นที่"
      );
      return { blankStatus, whatDidWell: didWell, whatNeedsAttention: needsAttention, whatCanImprove: canImprove };
    }

    if (rubric.kind === "checklist") {
      const checked = (submission && submission.checked) || [];
      const notes = ((submission && submission.notes) || "").trim();
      if (!checked.length && !notes) {
        return {
          emptySubmission: true,
          whatDidWell: ["ลองคลิกทำเครื่องหมายหน้ากิจกรรม ก.–จ. ที่คิดว่าเป็นส่วนหนึ่งของระบบสุขภาพ พร้อมเขียนเกณฑ์ที่ใช้ตัดสินสั้น ๆ ก่อนกดส่ง"],
          whatNeedsAttention: ["ยังไม่ได้เลือกรายการหรือระบุเกณฑ์การตัดสิน"],
          whatCanImprove: ["ลองถามตนเองว่าแต่ละกิจกรรมมี 'เจตนาหลัก (primary intent)' เพื่อสุขภาพโดยตรง หรือเป็นผลพลอยได้"],
        };
      }
      const coreHits = ["ก.", "ค.", "ง."].filter((x) => checked.includes(x));
      if (coreHits.length > 0) {
        didWell.push(`เลือกรายการ <strong>${coreHits.join(", ")}</strong> ซึ่งสอดคล้องกับกิจกรรมที่มีเจตนาหลักเพื่อส่งเสริมหรือคงไว้ซึ่งสุขภาพตามกรอบองค์การอนามัยโลก`);
      }
      if (checked.includes("ข.")) {
        didWell.push("สังเกตเห็นความเชื่อมโยงด้านสุขภาพของข้อ ข. (ร้านอาหารลดความเค็มเพื่อลูกค้า) ซึ่งเป็นตัวอย่างสำคัญของการเปรียบเทียบขอบเขตนิยาม WHO กับ พ.ร.บ. สุขภาพแห่งชาติ");
      }
      const missedCore = ["ก.", "ค.", "ง."].filter((x) => !checked.includes(x));
      if (missedCore.length > 0) {
        needsAttention.push(
          `ยังไม่ได้เลือกข้อ <strong>${missedCore.join(", ")}</strong> — แม้ผู้ดำเนินการจะอยู่นอกกระทรวงสาธารณสุข (เช่น ตำรวจรณรงค์สวมหมวกนิรภัย หรือแม่ดูแลลูกที่ป่วย) แต่มีเจตนาหลักเพื่อสุขภาพ จึงนับอยู่ในระบบสุขภาพตามนิยาม WHO`
        );
      }
      if (checked.includes("จ.") && !notes.includes("ความสัมพันธ์") && !notes.includes("พ.ร.บ.")) {
        needsAttention.push("ข้อ จ. (การจัดการศึกษาชั้นประถมทั่วไป) มีเจตนาหลักเพื่อการศึกษา จึงไม่อยู่ในระบบสุขภาพตามเกณฑ์เจตนาหลักของ WHO (ยกเว้นตีความกว้างตามระบบความสัมพันธ์ทั้งมวล)");
      }
      if (!notes) {
        needsAttention.push("ยังไม่ได้ระบุ 'เกณฑ์' และเหตุผลที่ใช้ตัดสินในช่องข้อความด้านล่าง");
      } else if (!needsAttention.length) {
        needsAttention.push("การจำแนกกิจกรรมสอดคล้องกับหลักคิดเรื่องขอบเขตของระบบสุขภาพเป็นอย่างดี");
      }
      canImprove.push(
        "ลองสรุปเกณฑ์เปรียบเทียบให้ชัดทั้ง 2 กรอบ คือ (1) เกณฑ์ 'เจตนาหลัก (primary intent)' ของ WHO และ (2) เกณฑ์ 'ระบบความสัมพันธ์ทั้งมวลที่เกี่ยวข้องกับสุขภาพ' ตาม พ.ร.บ. สุขภาพแห่งชาติ พ.ศ. 2550"
      );
      return { whatDidWell: didWell, whatNeedsAttention: needsAttention, whatCanImprove: canImprove };
    }

    // Open-ended Question / Reflection
    const text = String((submission && submission.text) || "").trim();
    if (!text) {
      return {
        emptySubmission: true,
        whatDidWell: ["พร้อมเริ่มฝึกคิดวิเคราะห์ (Active Recall) — ลองพิมพ์คำตอบด้วยภาษาของตนเองสั้น ๆ 2–4 ประโยคก่อนกดส่งคำตอบ"],
        whatNeedsAttention: ["ยังไม่ได้พิมพ์คำตอบในกล่องข้อความ"],
        whatCanImprove: ["ไม่ต้องกังวลว่าจะต้องเขียนสมบูรณ์แบบในครั้งแรก การลองดึงความรู้ด้วยตนเองก่อนเห็นเฉลยช่วยให้จำแม่นและเข้าใจลึกกว่าการอ่านเฉลยทันที"],
      };
    }

    const ansPlain = stripTags(rubric.answerHtml);
    const concepts = extractKeyConceptsFromText(ansPlain, rubric.answerHtml);
    const tLow = text.toLowerCase();

    const matched = [];
    const missed = [];
    concepts.forEach((c) => {
      if (c.tokens.some((tok) => tLow.includes(tok))) matched.push(c);
      else missed.push(c);
    });

    const hasReasoning = /เพราะ|เนื่องจาก|ส่งผล|ทำให้|จึง|ดังนั้น|กล่าวคือ|แตกต่าง|ต่างจาก|ขณะที่|ส่วน/.test(text);
    const hasExample = /เช่น|ตัวอย่าง|กรณี|ได้แก่|โรงพยาบาล|ผู้ป่วย|ชุมชน/.test(text);

    if (matched.length > 0) {
      didWell.push(
        `จับประเด็นและแนวคิดสำคัญของข้อนี้ได้ตรงจุด ได้แก่ ${matched
          .slice(0, 4)
          .map((c) => `<strong>${escapeHtml(c.label)}</strong>`)
          .join(", ")}`
      );
    }
    if (hasReasoning) {
      didWell.push("มีการเชื่อมโยงเหตุและผลหรือเปรียบเทียบความแตกต่าง ทำให้คำตอบมีลำดับความคิดเชิงวิเคราะห์ที่ชัดเจน");
    }
    if (hasExample) {
      didWell.push("ยกตัวอย่างสถานการณ์คลินิก/ระบบบริการหรือกรณีรูปธรรมมาประกอบได้ดี");
    }
    if (!didWell.length) {
      didWell.push("เริ่มต้นเรียบเรียงคำตอบด้วยภาษาของตนเองแล้ว ซึ่งเป็นก้าวสำคัญของการฝึกดึงความรู้ (retrieval practice)");
    }

    // Check specific contrast/trap cues in model answer ("มิใช่...", "ไม่ใช่เพียง...")
    const contrastMatch = ansPlain.match(/(?:มิใช่เพียง|มิใช่|ไม่ใช่เพียง|ต่างจาก)([^.,;]{4,55})/);
    if (text.length < 28) {
      needsAttention.push("คำตอบยังค่อนข้างสั้น อาจยังอธิบายกลไกหรือเหตุผลประกอบได้ไม่ครบทุกแง่มุมของคำถาม");
    }
    if (missed.length > 0) {
      needsAttention.push(
        `ประเด็นสำคัญในแนวคำตอบที่ยังไม่ได้กล่าวถึงหรืออาจขยายความเพิ่ม ได้แก่ ${missed
          .slice(0, 4)
          .map((c) => `<strong>${escapeHtml(c.label)}</strong>`)
          .join(", ")}`
      );
    }
    if (contrastMatch && missed.length > 0) {
      needsAttention.push(`ข้อควรระวังของข้อนี้คือการแยกความแตกต่างให้ชัดว่า <em>“มิใช่${escapeHtml(contrastMatch[1].trim())}”</em>`);
    }
    if (!needsAttention.length) {
      needsAttention.push("ครอบคลุมประเด็นหลักของแนวคำตอบได้ครบถ้วน ไม่พบจุดคลาดเคลื่อนสำคัญ");
    }

    if (!hasReasoning) {
      canImprove.push("ลองเพิ่มคำเชื่อมเชิงเหตุผล (เช่น “เพราะ… จึงส่งผลให้…” หรือ “แตกต่างกันตรงที่…”) เพื่อแสดงกลไกเชื่อมโยงให้ชัดเจนยิ่งขึ้น");
    }
    if (!hasExample && ansPlain.length > 140) {
      canImprove.push("ลองยกตัวอย่างรูปธรรมสั้น ๆ 1 ตัวอย่าง (เช่น กรณีผู้ป่วย หน่วยบริการปฐมภูมิ หรือมาตรการระดับพื้นที่) เพื่อทำให้คำตอบมีน้ำหนักในการอภิปรายกลุ่ม");
    }
    if (missed.length > 0) {
      canImprove.push(
        `ลองนำประเด็น ${missed
          .slice(0, 2)
          .map((c) => `<strong>${escapeHtml(c.label)}</strong>`)
          .join(" และ ")} จากแนวคำตอบด้านล่างมาผสานต่อท้ายคำตอบเดิมของคุณเพื่อให้สมบูรณ์ครบทุกมิติ`
      );
    } else if (!canImprove.length) {
      canImprove.push("คำตอบมีความสมบูรณ์ดีมาก ลองเทียบเคียงสำนวนและรายละเอียดปลีกย่อยกับแนวคำตอบด้านล่างเพื่อทบทวนความแม่นยำอีกครั้ง");
    }

    return { whatDidWell: didWell, whatNeedsAttention: needsAttention, whatCanImprove: canImprove };
  }

  /* ---------- Optional Live Gemini API Upgrade ---------- */
  async function evaluateWithOptionalGemini(rubric, submission, localFallback) {
    const apiKey = getGeminiKey();
    if (!apiKey || localFallback.emptySubmission) {
      return { ...localFallback, source: "rubric" };
    }

    let userSummary = "";
    if (rubric.kind === "table") {
      const qRows = rubric.rows || [];
      const headers = rubric.headers || [];
      const cells = (submission && submission.cells) || {};
      const lines = [];
      qRows.forEach((r, rIdx) => {
        const parts = [`แถว ${r[0] || rIdx + 1}:`];
        r.forEach((orig, cIdx) => {
          if (cIdx === 0 || (orig && orig.trim())) return;
          parts.push(`${headers[cIdx] || cIdx} = "${cells[`${rIdx}_${cIdx}`] || "(ว่าง)"}"`);
        });
        lines.push(parts.join(" | "));
      });
      userSummary = lines.join("\n");
    } else if (rubric.kind === "cloze") {
      userSummary = JSON.stringify((submission && submission.blanks) || {});
    } else if (rubric.kind === "checklist") {
      userSummary = `เลือก: ${((submission && submission.checked) || []).join(", ")} | เหตุผล: ${(submission && submission.notes) || ""}`;
    } else {
      userSummary = (submission && submission.text) || "";
    }

    const sysPrompt =
      "คุณคืออาจารย์แพทย์เวชศาสตร์ชุมชนและวิทยาศาสตร์ระบบสุขภาพ (RACM 303 คณะแพทยศาสตร์โรงพยาบาลรามาธิบดี มหาวิทยาลัยมหิดล) " +
      "ประเมินคำตอบของนักศึกษาแพทย์ชั้นปีที่ 3 เทียบกับแนวคำตอบอ้างอิงอย่างกัลยาณมิตร สุภาพ เข้าใจง่าย กระชับ และตรงประเด็น " +
      "ตอบเป็น JSON เท่านั้นตามโครงสร้าง {\"whatDidWell\": [\"...\"], \"whatNeedsAttention\": [\"...\"], \"whatCanImprove\": [\"...\"]} " +
      "โดยแต่ละหัวข้อมี 1-3 ข้อสั้นๆ ชัดเจน";

    const userPrompt =
      `คำถาม/โจทย์: ${rubric.prompt || rubric.sectionTitle || ""}\n\n` +
      `แนวคำตอบอ้างอิง: ${stripTags(rubric.answerHtml)}\n\n` +
      `คำตอบของนักศึกษา:\n${userSummary}`;

    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sysPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.25,
              responseMimeType: "application/json",
            },
          }),
        }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const rawTxt =
        json &&
        json.candidates &&
        json.candidates[0] &&
        json.candidates[0].content &&
        json.candidates[0].content.parts &&
        json.candidates[0].content.parts[0] &&
        json.candidates[0].content.parts[0].text;
      const parsed = JSON.parse(rawTxt);
      if (Array.isArray(parsed.whatDidWell) && Array.isArray(parsed.whatNeedsAttention) && Array.isArray(parsed.whatCanImprove)) {
        return {
          ...localFallback,
          whatDidWell: parsed.whatDidWell.map((x) => escapeHtml(x)),
          whatNeedsAttention: parsed.whatNeedsAttention.map((x) => escapeHtml(x)),
          whatCanImprove: parsed.whatCanImprove.map((x) => escapeHtml(x)),
          source: "gemini",
        };
      }
    } catch (_) {
      /* gracefully fall back to built-in rubric evaluator */
    }
    return { ...localFallback, source: "rubric" };
  }

  /* ---------- Rendering AI Feedback + Model Answer HTML ---------- */
  function buildFeedbackHtml(rubric, evalResult, mode) {
    // mode: "ai_and_key" | "key_only"
    const parts = [];
    if (mode === "ai_and_key" && evalResult) {
      const srcBadge =
        evalResult.source === "gemini"
          ? `<span class="iq-ai-badge is-live">✨ Gemini AI Feedback</span>`
          : `<span class="iq-ai-badge">✨ AI Suggestion · วิเคราะห์เทียบเกณฑ์แนวคำตอบ</span>`;
      parts.push(`
        <div class="iq-ai-panel">
          <div class="iq-ai-panel-head">
            ${srcBadge}
            <button type="button" class="iq-key-gear-btn" data-iq-open-settings title="ตั้งค่าเชื่อมต่อ Gemini API Key เพิ่มเติม (ทางเลือกเสริม)">⚙️ ตั้งค่า AI</button>
          </div>
          <div class="iq-ai-grid">
            <div class="iq-ai-col is-well">
              <div class="iq-ai-col-title">✓ What you did well · สิ่งที่ทำได้ดี</div>
              <ul>${evalResult.whatDidWell.map((x) => `<li>${x}</li>`).join("")}</ul>
            </div>
            <div class="iq-ai-col is-miss">
              <div class="iq-ai-col-title">△ What needs attention · จุดที่ยังคลาดเคลื่อน/ตกหล่น</div>
              <ul>${evalResult.whatNeedsAttention.map((x) => `<li>${x}</li>`).join("")}</ul>
            </div>
            <div class="iq-ai-col is-improve">
              <div class="iq-ai-col-title">💡 What can be improved · แนวทางพัฒนาต่อ</div>
              <ul>${evalResult.whatCanImprove.map((x) => `<li>${x}</li>`).join("")}</ul>
            </div>
          </div>
        </div>
      `);
    }

    if (rubric && rubric.answerHtml) {
      parts.push(`
        <div class="iq-model-key-box">
          <div class="iq-model-key-head">📖 เฉลยและแนวคำตอบ (Model Answer)</div>
          <div class="iq-model-key-body">${rubric.answerHtml}</div>
        </div>
      `);
    }
    return parts.join("");
  }

  /* ---------- Floating Pop-up Modal (For Side-by-Side / Slide Deck Viewing & AI Settings) ---------- */
  let modalBackdrop = null;

  function ensureModal() {
    if (modalBackdrop) return modalBackdrop;
    modalBackdrop = document.createElement("div");
    modalBackdrop.className = "iq-modal-backdrop";
    modalBackdrop.hidden = true;
    modalBackdrop.innerHTML = `
      <div class="iq-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="iqModalTitle">
        <div class="iq-modal-header">
          <h3 id="iqModalTitle">คำแนะนำ AI &amp; แนวคำตอบ</h3>
          <button type="button" class="iq-modal-close" aria-label="ปิดหน้าต่าง">✕</button>
        </div>
        <div class="iq-modal-body" id="iqModalBody"></div>
      </div>
    `;
    document.body.appendChild(modalBackdrop);

    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop || e.target.closest(".iq-modal-close")) {
        modalBackdrop.hidden = true;
      } else if (e.target.closest("[data-iq-open-settings]")) {
        openAiSettingsModal();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modalBackdrop && !modalBackdrop.hidden) {
        modalBackdrop.hidden = true;
      }
    });
    return modalBackdrop;
  }

  function openPopupFeedback(titleText, rubric, getSubmissionFn, onSaveTextFn) {
    const bd = ensureModal();
    const titleEl = bd.querySelector("#iqModalTitle");
    const bodyEl = bd.querySelector("#iqModalBody");
    titleEl.textContent = titleText || "ฝึกตอบคำถาม · AI Suggestion & แนวคำตอบ";

    const curSub = getSubmissionFn ? getSubmissionFn() : {};
    const isSimpleQ = rubric.kind === "question" || rubric.kind === "reflection";

    bodyEl.innerHTML = `
      <div class="iq-popup-prompt">${escapeHtml(rubric.prompt || rubric.sectionTitle || "")}</div>
      ${
        isSimpleQ
          ? `<div class="iq-popup-editor">
               <textarea class="iq-textarea" rows="4" placeholder="พิมพ์คำตอบของคุณที่นี่ แล้วกดรับคำแนะนำ AI…">${escapeHtml(curSub.text || "")}</textarea>
               <div class="iq-btn-row">
                 <button type="button" class="iq-btn is-ai" data-popup-submit>✨ ส่งคำตอบ &amp; รับคำแนะนำ AI</button>
                 <button type="button" class="iq-btn is-key" data-popup-key>👁 แสดงเฉพาะแนวคำตอบ</button>
               </div>
             </div>`
          : ""
      }
      <div class="iq-popup-result"></div>
    `;

    const resBox = bodyEl.querySelector(".iq-popup-result");
    const popupTa = bodyEl.querySelector("textarea.iq-textarea");

    const runEvalInPopup = async (mode) => {
      const latestSub = isSimpleQ && popupTa ? { text: popupTa.value } : getSubmissionFn();
      if (isSimpleQ && popupTa && onSaveTextFn) onSaveTextFn(popupTa.value);
      if (mode === "key_only") {
        resBox.innerHTML = buildFeedbackHtml(rubric, null, "key_only");
        return;
      }
      resBox.innerHTML = `<div class="iq-loading">กำลังวิเคราะห์คำตอบเทียบกับเกณฑ์แนวคำตอบ…</div>`;
      const localRes = evaluateLocally(rubric, latestSub);
      const finalRes = await evaluateWithOptionalGemini(rubric, latestSub, localRes);
      resBox.innerHTML = buildFeedbackHtml(rubric, finalRes, "ai_and_key");
    };

    if (popupTa && onSaveTextFn) {
      popupTa.addEventListener("input", () => onSaveTextFn(popupTa.value));
    }
    const subBtn = bodyEl.querySelector("[data-popup-submit]");
    const keyBtn = bodyEl.querySelector("[data-popup-key]");
    if (subBtn) subBtn.addEventListener("click", () => runEvalInPopup("ai_and_key"));
    if (keyBtn) keyBtn.addEventListener("click", () => runEvalInPopup("key_only"));

    // Auto-show AI evaluation if user already typed something, otherwise show ready prompt or key
    const hasContent =
      (curSub.text && curSub.text.trim()) ||
      (curSub.cells && Object.values(curSub.cells).some((v) => v && v.trim())) ||
      (curSub.blanks && Object.values(curSub.blanks).some((v) => v && v.trim())) ||
      (curSub.checked && curSub.checked.length > 0);

    if (hasContent) runEvalInPopup("ai_and_key");
    else if (!isSimpleQ) runEvalInPopup("key_only");

    bd.hidden = false;
  }

  function openAiSettingsModal() {
    const bd = ensureModal();
    const titleEl = bd.querySelector("#iqModalTitle");
    const bodyEl = bd.querySelector("#iqModalBody");
    titleEl.textContent = "⚙️ ตั้งค่าผู้ช่วยวิเคราะห์คำตอบ (AI Suggestion)";
    const curKey = getGeminiKey();
    bodyEl.innerHTML = `
      <div class="iq-settings-box">
        <p style="margin:0 0 10px;line-height:1.6">
          <strong>โหมดมาตรฐาน (ทำงานทันทีโดยไม่ต้องตั้งค่า):</strong> ระบบตรวจวิเคราะห์คำตอบรายช่องและรายประเด็นเทียบกับแนวคำตอบของคณาจารย์ผู้สอน HS1–HS6 โดยอัตโนมัติบนเบราว์เซอร์ของคุณ
        </p>
        <p style="margin:0 0 10px;line-height:1.6">
          <strong>โหมดเชื่อมต่อ Gemini API (ทางเลือกเสริม):</strong> หากต้องการให้โมเดล <code>gemini-2.5-flash</code> ช่วยเขียนคำแนะนำเพิ่มเติมแบบละเอียด สามารถวาง Gemini API Key ส่วนตัวด้านล่าง (บันทึกเฉพาะในเบราว์เซอร์เครื่องนี้เท่านั้น ไม่ส่งขึ้นเซิร์ฟเวอร์อื่น)
        </p>
        <input type="password" class="iq-api-input" id="iqGeminiKeyInput" placeholder="AIzaSy... (เว้นว่างเพื่อใช้ระบบวิเคราะห์ในตัว)" value="${escapeHtml(curKey)}">
        <div class="iq-btn-row" style="margin-top:12px">
          <button type="button" class="iq-btn is-ai" id="iqSaveKeyBtn">บันทึกการตั้งค่า</button>
          <button type="button" class="iq-btn" id="iqClearKeyBtn">ล้างค่า API Key</button>
        </div>
        <div id="iqKeyStatusMsg" style="margin-top:8px;font-size:13px;color:#0f5c54;font-weight:600"></div>
      </div>
    `;
    const inp = bodyEl.querySelector("#iqGeminiKeyInput");
    const msg = bodyEl.querySelector("#iqKeyStatusMsg");
    bodyEl.querySelector("#iqSaveKeyBtn").addEventListener("click", () => {
      setGeminiKey(inp.value);
      msg.textContent = inp.value.trim()
        ? "✓ บันทึก Gemini API Key เรียบร้อยแล้ว"
        : "✓ ใช้โหมดวิเคราะห์เทียบเกณฑ์แนวคำตอบมาตรฐานในตัว";
    });
    bodyEl.querySelector("#iqClearKeyBtn").addEventListener("click", () => {
      inp.value = "";
      setGeminiKey("");
      msg.textContent = "✓ ล้างค่า API Key และกลับสู่โหมดมาตรฐานเรียบร้อยแล้ว";
    });
    bd.hidden = false;
  }

  /* ---------- 1. Enhance Fillable Tables (table[data-wb-table-id]) ---------- */
  function enhanceFillableTable(tbl, rubrics) {
    const tblId = tbl.getAttribute("data-wb-table-id");
    const rubric = rubrics[tblId];
    if (!rubric) return;

    const savedCells = (answerStore[tblId] && answerStore[tblId].cells) || {};
    const colChoices = rubric.colChoices || {};

    const bodyRows = [...tbl.querySelectorAll("tbody tr")];
    bodyRows.forEach((tr, rIdx) => {
      const tds = [...tr.querySelectorAll("td")];
      tds.forEach((td, cIdx) => {
        if (cIdx === 0) return;
        const already = td.querySelector(".wb-cell-editor");
        const rawText = td.textContent.replace(/\s+/g, "");
        if (!already && rawText !== "") return; // Pre-filled cell — leave intact

        const cellKey = `${rIdx}_${cIdx}`;
        const choices = colChoices[String(cIdx)];

        if (!already) {
          td.classList.add("wb-fillable-td");
          td.dataset.cellKey = cellKey;
          const wrap = document.createElement("div");
          wrap.className = "wb-cell-editor";

          if (choices && choices.length) {
            const chips = document.createElement("div");
            chips.className = "wb-choice-chips";
            choices.forEach((ch) => {
              const b = document.createElement("button");
              b.type = "button";
              b.className = "wb-choice-chip";
              b.dataset.choiceVal = ch;
              b.textContent = ch;
              chips.appendChild(b);
            });
            const inp = document.createElement("input");
            inp.type = "text";
            inp.className = "wb-cell-short-input";
            inp.placeholder = "เลือกด้านบน หรือพิมพ์ระบุ…";
            wrap.append(chips, inp);
          } else {
            const ta = document.createElement("textarea");
            ta.className = "wb-cell-textarea";
            ta.rows = 2;
            ta.placeholder = "พิมพ์คำตอบ…";
            wrap.appendChild(ta);
          }

          const badge = document.createElement("div");
          badge.className = "wb-cell-feedback-badge";
          badge.hidden = true;
          wrap.appendChild(badge);

          td.replaceChildren(wrap);
        }

        // Hydrate & bind events (works both on initial prose and cloned Slide Deck slides)
        const curVal = savedCells[cellKey] || "";
        const inp = td.querySelector(".wb-cell-short-input, .wb-cell-textarea");
        const chipBtns = [...td.querySelectorAll(".wb-choice-chip")];

        const syncVisual = (val) => {
          if (inp && inp.value !== val) inp.value = val;
          chipBtns.forEach((b) => {
            b.classList.toggle("is-selected", b.dataset.choiceVal === val.trim());
          });
        };
        syncVisual(curVal);

        const persistVal = (val) => {
          if (!answerStore[tblId]) answerStore[tblId] = { cells: {} };
          if (!answerStore[tblId].cells) answerStore[tblId].cells = {};
          answerStore[tblId].cells[cellKey] = val;
          saveStore();
          syncVisual(val);
        };

        if (inp && !inp._iqBound) {
          inp._iqBound = "1";
          inp.addEventListener("input", () => {
            persistVal(inp.value);
            if (inp.tagName === "TEXTAREA") {
              inp.style.height = "auto";
              inp.style.height = `${Math.max(48, inp.scrollHeight)}px`;
            }
          });
        }
        chipBtns.forEach((b) => {
          if (b._iqBound) return;
          b._iqBound = "1";
          b.addEventListener("click", () => {
            const cur = ((answerStore[tblId] && answerStore[tblId].cells && answerStore[tblId].cells[cellKey]) || "").trim();
            const next = cur === b.dataset.choiceVal ? "" : b.dataset.choiceVal;
            persistVal(next);
          });
        });
      });
    });

    // Attach Table Action Bar + Feedback Drawer right below the table (or its .table-scroll wrapper)
    const anchorEl = tbl.closest(".table-scroll") || tbl;
    let panel = anchorEl.nextElementSibling;
    if (!panel || !panel.classList.contains("iq-table-dock") || panel.dataset.dockFor !== tblId) {
      panel = document.createElement("div");
      panel.className = "iq-table-dock";
      panel.dataset.dockFor = tblId;
      panel.innerHTML = `
        <div class="iq-btn-row is-table-actions">
          <button type="button" class="iq-btn is-ai" data-tbl-submit>✨ ส่งคำตอบตารางนี้ &amp; รับคำแนะนำ AI</button>
          <button type="button" class="iq-btn is-key" data-tbl-key>👁 แสดงเฉลยตารางนี้</button>
          <button type="button" class="iq-btn is-popup" data-tbl-popup title="เปิดดูคำแนะนำ AI และแนวคำตอบในหน้าต่าง Pop-up">⤢ Pop-up</button>
          <button type="button" class="iq-btn is-ghost" data-tbl-clear>ล้างช่องกรอก</button>
        </div>
        <div class="iq-feedback-drawer" hidden></div>
      `;
      anchorEl.insertAdjacentElement("afterend", panel);
    }

    const drawer = panel.querySelector(".iq-feedback-drawer");
    const subBtn = panel.querySelector("[data-tbl-submit]");
    const keyBtn = panel.querySelector("[data-tbl-key]");
    const popBtn = panel.querySelector("[data-tbl-popup]");
    const clrBtn = panel.querySelector("[data-tbl-clear]");

    const getSub = () => ({ cells: (answerStore[tblId] && answerStore[tblId].cells) || {} });

    const applyCellStatuses = (map) => {
      if (!map) return;
      tbl.querySelectorAll(".wb-fillable-td").forEach((td) => {
        const k = td.dataset.cellKey;
        const st = map[k];
        td.classList.remove("is-cell-exact", "is-cell-mismatch", "is-cell-partial");
        const badge = td.querySelector(".wb-cell-feedback-badge");
        if (!badge) return;
        if (st === "exact") {
          td.classList.add("is-cell-exact");
          badge.textContent = "✓ ตรงแนวคำตอบ";
          badge.hidden = false;
        } else if (st === "mismatch") {
          td.classList.add("is-cell-mismatch");
          badge.textContent = "△ ตรวจสอบกับเฉลย";
          badge.hidden = false;
        } else if (st === "partial" || st === "review") {
          td.classList.add("is-cell-partial");
          badge.textContent = "💡 ขยายความเพิ่มได้";
          badge.hidden = false;
        } else {
          badge.hidden = true;
        }
      });
    };

    if (subBtn && !subBtn._iqBound) {
      subBtn._iqBound = "1";
      subBtn.addEventListener("click", async () => {
        drawer.hidden = false;
        drawer.innerHTML = `<div class="iq-loading">กำลังตรวจวิเคราะห์ตารางเทียบกับแนวคำตอบ…</div>`;
        const localRes = evaluateLocally(rubric, getSub());
        applyCellStatuses(localRes.cellFeedbackMap);
        const finalRes = await evaluateWithOptionalGemini(rubric, getSub(), localRes);
        drawer.innerHTML = buildFeedbackHtml(rubric, finalRes, "ai_and_key");
        bindDrawerSettingsBtn(drawer);
      });
    }
    if (keyBtn && !keyBtn._iqBound) {
      keyBtn._iqBound = "1";
      keyBtn.addEventListener("click", () => {
        const showingKeyOnly = !drawer.hidden && drawer.dataset.mode === "key_only";
        if (showingKeyOnly) {
          drawer.hidden = true;
          drawer.dataset.mode = "";
        } else {
          drawer.hidden = false;
          drawer.dataset.mode = "key_only";
          drawer.innerHTML = buildFeedbackHtml(rubric, null, "key_only");
        }
      });
    }
    if (popBtn && !popBtn._iqBound) {
      popBtn._iqBound = "1";
      popBtn.addEventListener("click", () => {
        openPopupFeedback(rubric.sectionTitle || "ตารางทบทวน", rubric, getSub, null);
      });
    }
    if (clrBtn && !clrBtn._iqBound) {
      clrBtn._iqBound = "1";
      clrBtn.addEventListener("click", () => {
        delete answerStore[tblId];
        saveStore();
        tbl.querySelectorAll(".wb-fillable-td").forEach((td) => {
          td.classList.remove("is-cell-exact", "is-cell-mismatch", "is-cell-partial");
          const inp = td.querySelector(".wb-cell-short-input, .wb-cell-textarea");
          if (inp) inp.value = "";
          td.querySelectorAll(".wb-choice-chip").forEach((b) => b.classList.remove("is-selected"));
          const badge = td.querySelector(".wb-cell-feedback-badge");
          if (badge) badge.hidden = true;
        });
        drawer.hidden = true;
      });
    }
  }

  /* ---------- 2. Enhance Cloze Paragraph (p[data-cloze-id]) ---------- */
  function enhanceClozeParagraph(pEl, rubrics) {
    const cId = pEl.getAttribute("data-cloze-id");
    const rubric = rubrics[cId];
    if (!rubric) return;

    if (!pEl.querySelector(".iq-cloze-input")) {
      pEl.innerHTML = pEl.innerHTML.replace(/\.{3,}\((\d+)\)\.{3,}/g, (_, num) => {
        return `<span class="iq-cloze-slot"><span class="iq-cloze-num">(${num})</span><input type="text" class="iq-cloze-input" data-blank-num="${num}" placeholder="เติมคำ…"></span>`;
      });
    }

    const savedBlanks = (answerStore[cId] && answerStore[cId].blanks) || {};
    pEl.querySelectorAll(".iq-cloze-input").forEach((inp) => {
      const n = inp.dataset.blankNum;
      if (savedBlanks[n] !== undefined) inp.value = savedBlanks[n];
      if (!inp._iqBound) {
        inp._iqBound = "1";
        inp.addEventListener("input", () => {
          if (!answerStore[cId]) answerStore[cId] = { blanks: {} };
          answerStore[cId].blanks[n] = inp.value;
          saveStore();
        });
      }
    });

    let dock = pEl.nextElementSibling;
    if (!dock || !dock.classList.contains("iq-cloze-dock")) {
      dock = document.createElement("div");
      dock.className = "iq-cloze-dock";
      dock.innerHTML = `
        <div class="iq-btn-row">
          <button type="button" class="iq-btn is-ai" data-cloze-submit>✨ ส่งคำตอบช่องว่าง &amp; รับคำแนะนำ AI</button>
          <button type="button" class="iq-btn is-key" data-cloze-key>👁 แสดงเฉลย (1)–(7)</button>
          <button type="button" class="iq-btn is-popup" data-cloze-popup>⤢ Pop-up</button>
          <button type="button" class="iq-btn is-ghost" data-cloze-clear>ล้างคำตอบ</button>
        </div>
        <div class="iq-feedback-drawer" hidden></div>
      `;
      pEl.insertAdjacentElement("afterend", dock);
    }

    const drawer = dock.querySelector(".iq-feedback-drawer");
    const getSub = () => ({ blanks: (answerStore[cId] && answerStore[cId].blanks) || {} });

    const subBtn = dock.querySelector("[data-cloze-submit]");
    const keyBtn = dock.querySelector("[data-cloze-key]");
    const popBtn = dock.querySelector("[data-cloze-popup]");
    const clrBtn = dock.querySelector("[data-cloze-clear]");

    if (subBtn && !subBtn._iqBound) {
      subBtn._iqBound = "1";
      subBtn.addEventListener("click", async () => {
        drawer.hidden = false;
        const localRes = evaluateLocally(rubric, getSub());
        pEl.querySelectorAll(".iq-cloze-input").forEach((inp) => {
          const st = localRes.blankStatus && localRes.blankStatus[inp.dataset.blankNum];
          inp.classList.toggle("is-exact", st === "exact");
          inp.classList.toggle("is-mismatch", st === "mismatch");
        });
        const finalRes = await evaluateWithOptionalGemini(rubric, getSub(), localRes);
        drawer.innerHTML = buildFeedbackHtml(rubric, finalRes, "ai_and_key");
        bindDrawerSettingsBtn(drawer);
      });
    }
    if (keyBtn && !keyBtn._iqBound) {
      keyBtn._iqBound = "1";
      keyBtn.addEventListener("click", () => {
        drawer.hidden = !drawer.hidden && drawer.dataset.mode === "key_only";
        if (!drawer.hidden) {
          drawer.dataset.mode = "key_only";
          drawer.innerHTML = buildFeedbackHtml(rubric, null, "key_only");
        }
      });
    }
    if (popBtn && !popBtn._iqBound) {
      popBtn._iqBound = "1";
      popBtn.addEventListener("click", () => openPopupFeedback(rubric.sectionTitle, rubric, getSub, null));
    }
    if (clrBtn && !clrBtn._iqBound) {
      clrBtn._iqBound = "1";
      clrBtn.addEventListener("click", () => {
        delete answerStore[cId];
        saveStore();
        pEl.querySelectorAll(".iq-cloze-input").forEach((inp) => {
          inp.value = "";
          inp.classList.remove("is-exact", "is-mismatch");
        });
        drawer.hidden = true;
      });
    }
  }

  /* ---------- 3. Enhance Checklist (ul[data-checklist-id]) ---------- */
  function enhanceChecklist(ulEl, rubrics) {
    const chkId = ulEl.getAttribute("data-checklist-id");
    const rubric = rubrics[chkId];
    if (!rubric) return;

    const saved = answerStore[chkId] || { checked: [], notes: "" };

    [...ulEl.querySelectorAll("li")].forEach((li) => {
      if (!li.querySelector(".iq-chk-box")) {
        const txt = li.innerHTML.replace(/^\s*\[\s*\]\s*/, "");
        const codeM = stripTags(txt).match(/^([ก-ฮ]\.)/);
        const itemCode = codeM ? codeM[1] : stripTags(txt).slice(0, 4);
        li.innerHTML = `<label class="iq-chk-label"><input type="checkbox" class="iq-chk-box" data-item-code="${escapeHtml(itemCode)}"> <span>${txt}</span></label>`;
      }
      const box = li.querySelector(".iq-chk-box");
      if (box) {
        box.checked = (saved.checked || []).includes(box.dataset.itemCode);
        if (!box._iqBound) {
          box._iqBound = "1";
          box.addEventListener("change", () => {
            const cur = answerStore[chkId] || { checked: [], notes: "" };
            const set = new Set(cur.checked || []);
            if (box.checked) set.add(box.dataset.itemCode);
            else set.delete(box.dataset.itemCode);
            cur.checked = [...set];
            answerStore[chkId] = cur;
            saveStore();
          });
        }
      }
    });

    let dock = ulEl.nextElementSibling;
    if (!dock || !dock.classList.contains("iq-checklist-dock")) {
      dock = document.createElement("div");
      dock.className = "iq-checklist-dock";
      dock.innerHTML = `
        <textarea class="iq-textarea" rows="2" placeholder="ระบุเกณฑ์ที่คุณใช้ตัดสินว่ากิจกรรมใดอยู่ในระบบสุขภาพ พร้อมเหตุผลสั้น ๆ…"></textarea>
        <div class="iq-btn-row">
          <button type="button" class="iq-btn is-ai" data-chk-submit>✨ ส่งคำตอบ &amp; รับคำแนะนำ AI</button>
          <button type="button" class="iq-btn is-key" data-chk-key>👁 แนวคำตอบ</button>
          <button type="button" class="iq-btn is-popup" data-chk-popup>⤢ Pop-up</button>
        </div>
        <div class="iq-feedback-drawer" hidden></div>
      `;
      ulEl.insertAdjacentElement("afterend", dock);
    }

    const ta = dock.querySelector("textarea.iq-textarea");
    const drawer = dock.querySelector(".iq-feedback-drawer");
    if (ta) {
      ta.value = saved.notes || "";
      if (!ta._iqBound) {
        ta._iqBound = "1";
        ta.addEventListener("input", () => {
          const cur = answerStore[chkId] || { checked: [], notes: "" };
          cur.notes = ta.value;
          answerStore[chkId] = cur;
          saveStore();
        });
      }
    }

    const getSub = () => answerStore[chkId] || { checked: [], notes: "" };
    const subBtn = dock.querySelector("[data-chk-submit]");
    const keyBtn = dock.querySelector("[data-chk-key]");
    const popBtn = dock.querySelector("[data-chk-popup]");
    if (subBtn && !subBtn._iqBound) {
      subBtn._iqBound = "1";
      subBtn.addEventListener("click", async () => {
        drawer.hidden = false;
        const localRes = evaluateLocally(rubric, getSub());
        const finalRes = await evaluateWithOptionalGemini(rubric, getSub(), localRes);
        drawer.innerHTML = buildFeedbackHtml(rubric, finalRes, "ai_and_key");
        bindDrawerSettingsBtn(drawer);
      });
    }
    if (keyBtn && !keyBtn._iqBound) {
      keyBtn._iqBound = "1";
      keyBtn.addEventListener("click", () => {
        const closing = !drawer.hidden && drawer.dataset.mode === "key_only";
        drawer.hidden = closing;
        if (!closing) {
          drawer.dataset.mode = "key_only";
          drawer.innerHTML = buildFeedbackHtml(rubric, null, "key_only");
        }
      });
    }
    if (popBtn && !popBtn._iqBound) {
      popBtn._iqBound = "1";
      popBtn.addEventListener("click", () => openPopupFeedback(rubric.sectionTitle, rubric, getSub, null));
    }
  }

  /* ---------- 4. Enhance Individual Questions & Prompts ([data-qa-id]) ---------- */
  function enhanceQuestionNode(el, rubrics) {
    const qaId = el.getAttribute("data-qa-id");
    const mode = el.getAttribute("data-qa-mode") || "open"; // "open" | "compact"
    const rubric = rubrics[qaId];
    if (!rubric) return;

    const savedText = (answerStore[qaId] && answerStore[qaId].text) || "";

    let widget = el.querySelector(":scope > .iq-inline-widget");
    if (!widget) {
      // Also inject quick side-by-side pill triggers right at the end of the question prompt
      let sidePills = el.querySelector(":scope > .iq-side-pills");
      if (!sidePills) {
        sidePills = document.createElement("span");
        sidePills.className = "iq-side-pills";
        sidePills.innerHTML = `
          <button type="button" class="iq-mini-pill is-write" data-iq-toggle-box title="พิมพ์คำตอบและรับคำแนะนำ AI">${mode === "compact" ? "✍️ ลองตอบ & AI" : "✍️ ตอบ"}</button>
          <button type="button" class="iq-mini-pill is-ans" data-iq-quick-key title="แสดง/ซ่อนแนวคำตอบใต้ข้อนี้ทันที">👁 เฉลย</button>
          <button type="button" class="iq-mini-pill is-pop" data-iq-quick-pop title="เปิดหน้าต่าง Pop-up ตอบและเทียบเฉลย">⤢ Pop-up</button>
        `;
        // If el is blockquote with <p> inside, append inside last <p> or directly
        const lastP = el.tagName === "BLOCKQUOTE" ? el.querySelector("p:last-of-type") : null;
        if (lastP) lastP.appendChild(sidePills);
        else el.appendChild(sidePills);
      }

      widget = document.createElement("div");
      widget.className = "iq-inline-widget";
      const startOpen = mode === "open" || Boolean(savedText);
      widget.innerHTML = `
        <div class="iq-editor-shell"${startOpen ? "" : " hidden"}>
          <textarea class="iq-textarea" rows="2" placeholder="พิมพ์คำตอบของคุณที่นี่ แล้วกดส่งคำตอบเพื่อรับคำแนะนำ AI (บันทึกอัตโนมัติ)…"></textarea>
          <div class="iq-btn-row">
            <button type="button" class="iq-btn is-ai" data-iq-submit>✨ ส่งคำตอบ &amp; รับคำแนะนำ AI</button>
            <button type="button" class="iq-btn is-key" data-iq-key>👁 แนวคำตอบข้อนี้</button>
            <button type="button" class="iq-btn is-popup" data-iq-popup>⤢ Pop-up</button>
            <button type="button" class="iq-btn is-ghost" data-iq-clear>ล้าง</button>
          </div>
        </div>
        <div class="iq-feedback-drawer" hidden></div>
      `;
      el.appendChild(widget);
    }

    const editorShell = widget.querySelector(".iq-editor-shell");
    const ta = widget.querySelector("textarea.iq-textarea");
    const drawer = widget.querySelector(".iq-feedback-drawer");

    if (ta && ta.value !== savedText) {
      ta.value = savedText;
    }

    const saveText = (val) => {
      answerStore[qaId] = { text: val };
      saveStore();
      if (ta && ta.value !== val) ta.value = val;
    };

    if (ta && !ta._iqBound) {
      ta._iqBound = "1";
      ta.addEventListener("input", () => {
        saveText(ta.value);
        ta.style.height = "auto";
        ta.style.height = `${Math.max(58, ta.scrollHeight)}px`;
      });
    }

    const runSubmit = async () => {
      if (editorShell && editorShell.hidden) editorShell.hidden = false;
      drawer.hidden = false;
      drawer.dataset.mode = "ai_and_key";
      drawer.innerHTML = `<div class="iq-loading">กำลังวิเคราะห์คำตอบเทียบกับแนวคำตอบ…</div>`;
      const sub = { text: (ta && ta.value) || "" };
      const localRes = evaluateLocally(rubric, sub);
      const finalRes = await evaluateWithOptionalGemini(rubric, sub, localRes);
      drawer.innerHTML = buildFeedbackHtml(rubric, finalRes, "ai_and_key");
      bindDrawerSettingsBtn(drawer);
    };

    const toggleKeyInline = () => {
      const closing = !drawer.hidden && drawer.dataset.mode === "key_only";
      if (closing) {
        drawer.hidden = true;
        drawer.dataset.mode = "";
      } else {
        drawer.hidden = false;
        drawer.dataset.mode = "key_only";
        drawer.innerHTML = buildFeedbackHtml(rubric, null, "key_only");
      }
    };

    const openPopup = () => {
      const label = rubric.num ? `${rubric.docId || ""} · ข้อที่ ${rubric.num}` : rubric.sectionTitle || rubric.docId || "คำถามทบทวน";
      openPopupFeedback(label, rubric, () => ({ text: (ta && ta.value) || "" }), saveText);
    };

    const toggleBoxBtn = el.querySelector("[data-iq-toggle-box]");
    const quickKeyBtn = el.querySelector("[data-iq-quick-key]");
    const quickPopBtn = el.querySelector("[data-iq-quick-pop]");
    const subBtn = widget.querySelector("[data-iq-submit]");
    const keyBtn = widget.querySelector("[data-iq-key]");
    const popBtn = widget.querySelector("[data-iq-popup]");
    const clrBtn = widget.querySelector("[data-iq-clear]");

    if (toggleBoxBtn && !toggleBoxBtn._iqBound) {
      toggleBoxBtn._iqBound = "1";
      toggleBoxBtn.addEventListener("click", () => {
        if (editorShell) {
          editorShell.hidden = !editorShell.hidden;
          if (!editorShell.hidden && ta) ta.focus();
        }
      });
    }
    if (quickKeyBtn && !quickKeyBtn._iqBound) {
      quickKeyBtn._iqBound = "1";
      quickKeyBtn.addEventListener("click", toggleKeyInline);
    }
    if (quickPopBtn && !quickPopBtn._iqBound) {
      quickPopBtn._iqBound = "1";
      quickPopBtn.addEventListener("click", openPopup);
    }
    if (subBtn && !subBtn._iqBound) {
      subBtn._iqBound = "1";
      subBtn.addEventListener("click", runSubmit);
    }
    if (keyBtn && !keyBtn._iqBound) {
      keyBtn._iqBound = "1";
      keyBtn.addEventListener("click", toggleKeyInline);
    }
    if (popBtn && !popBtn._iqBound) {
      popBtn._iqBound = "1";
      popBtn.addEventListener("click", openPopup);
    }
    if (clrBtn && !clrBtn._iqBound) {
      clrBtn._iqBound = "1";
      clrBtn.addEventListener("click", () => {
        delete answerStore[qaId];
        saveStore();
        if (ta) {
          ta.value = "";
          ta.style.height = "";
        }
        drawer.hidden = true;
      });
    }
  }

  function bindDrawerSettingsBtn(drawer) {
    if (!drawer) return;
    drawer.querySelectorAll("[data-iq-open-settings]").forEach((b) => {
      if (b._iqBound) return;
      b._iqBound = "1";
      b.addEventListener("click", openAiSettingsModal);
    });
  }

  /* ---------- 5. Public Container Enhancer & Practice Tab Card Builder ---------- */
  function enhanceContainer(rootEl) {
    if (!rootEl) return;
    const rubrics = getRubrics();
    if (!rubrics) return;

    rootEl.querySelectorAll("table[data-wb-table-id]").forEach((tbl) => enhanceFillableTable(tbl, rubrics));
    rootEl.querySelectorAll("p[data-cloze-id]").forEach((p) => enhanceClozeParagraph(p, rubrics));
    rootEl.querySelectorAll("ul[data-checklist-id]").forEach((ul) => enhanceChecklist(ul, rubrics));
    rootEl.querySelectorAll("[data-qa-id]").forEach((el) => enhanceQuestionNode(el, rubrics));
  }

  function enhancePracticeCard(cardEl, item) {
    const rubrics = getRubrics();
    const scId = `selfcheck_${item.id}`;
    const rubric = rubrics[scId] || {
      id: scId,
      docId: item.module,
      kind: "question",
      num: item.num,
      prompt: item.question,
      answerHtml: `<div class="iq-model-prose">${item.answerHtml || ""}</div>`,
    };

    const savedText = (answerStore[scId] && answerStore[scId].text) || "";
    const ui = document.createElement("div");
    ui.className = "iq-practice-card-body";
    ui.innerHTML = `
      <textarea class="iq-textarea" rows="3" placeholder="พิมพ์คำตอบของคุณที่นี่ แล้วกดส่งคำตอบเพื่อรับคำแนะนำ AI (บันทึกอัตโนมัติ)…">${escapeHtml(savedText)}</textarea>
      <div class="iq-btn-row">
        <button type="button" class="iq-btn is-ai" data-sc-submit>✨ ส่งคำตอบ &amp; รับคำแนะนำ AI</button>
        <button type="button" class="iq-btn is-key" data-sc-key>👁 ดูแนวคำตอบ</button>
        <button type="button" class="iq-btn is-popup" data-sc-popup>⤢ Pop-up</button>
        <button type="button" class="iq-btn is-ghost" data-sc-clear>ล้าง</button>
      </div>
      <div class="iq-feedback-drawer" hidden></div>
    `;

    const ta = ui.querySelector("textarea.iq-textarea");
    const drawer = ui.querySelector(".iq-feedback-drawer");
    const saveText = (val) => {
      answerStore[scId] = { text: val };
      saveStore();
      if (ta && ta.value !== val) ta.value = val;
    };

    ta.addEventListener("input", () => saveText(ta.value));
    ui.querySelector("[data-sc-submit]").addEventListener("click", async () => {
      drawer.hidden = false;
      drawer.dataset.mode = "ai_and_key";
      drawer.innerHTML = `<div class="iq-loading">กำลังวิเคราะห์คำตอบเทียบกับแนวคำตอบ…</div>`;
      const sub = { text: ta.value };
      const localRes = evaluateLocally(rubric, sub);
      const finalRes = await evaluateWithOptionalGemini(rubric, sub, localRes);
      drawer.innerHTML = buildFeedbackHtml(rubric, finalRes, "ai_and_key");
      bindDrawerSettingsBtn(drawer);
    });
    ui.querySelector("[data-sc-key]").addEventListener("click", () => {
      const closing = !drawer.hidden && drawer.dataset.mode === "key_only";
      drawer.hidden = closing;
      if (!closing) {
        drawer.dataset.mode = "key_only";
        drawer.innerHTML = buildFeedbackHtml(rubric, null, "key_only");
      }
    });
    ui.querySelector("[data-sc-popup]").addEventListener("click", () => {
      openPopupFeedback(`${item.module} · ข้อที่ ${item.num}`, rubric, () => ({ text: ta.value }), saveText);
    });
    ui.querySelector("[data-sc-clear]").addEventListener("click", () => {
      delete answerStore[scId];
      saveStore();
      ta.value = "";
      drawer.hidden = true;
    });

    cardEl.appendChild(ui);
  }

  function toggleAllInlineAnswers(scopeEl, shouldOpen) {
    if (!scopeEl) return;
    const rubrics = getRubrics();
    scopeEl.querySelectorAll("[data-qa-id]").forEach((el) => {
      const qaId = el.getAttribute("data-qa-id");
      const r = rubrics[qaId];
      const drawer = el.querySelector(":scope > .iq-inline-widget > .iq-feedback-drawer");
      if (!drawer || !r) return;
      if (shouldOpen) {
        drawer.hidden = false;
        if (!drawer.innerHTML.trim()) {
          drawer.dataset.mode = "key_only";
          drawer.innerHTML = buildFeedbackHtml(r, null, "key_only");
        }
      } else {
        drawer.hidden = true;
      }
    });
    scopeEl.querySelectorAll(".iq-table-dock").forEach((dock) => {
      const tblId = dock.dataset.dockFor;
      const r = rubrics[tblId];
      const drawer = dock.querySelector(".iq-feedback-drawer");
      if (!drawer || !r) return;
      if (shouldOpen) {
        drawer.hidden = false;
        if (!drawer.innerHTML.trim()) {
          drawer.dataset.mode = "key_only";
          drawer.innerHTML = buildFeedbackHtml(r, null, "key_only");
        }
      } else {
        drawer.hidden = true;
      }
    });
  }

  window.RACMInteractiveQA = {
    enhanceContainer,
    enhancePracticeCard,
    toggleAllInlineAnswers,
    openAiSettingsModal,
  };
})();
