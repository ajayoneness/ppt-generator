const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

// ── Icon helpers ──────────────────────────────────────────────────────────────
function renderIconSvg(IconComponent, color = "#000000", size = 256) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
}

async function iconToBase64Png(IconComponent, color, size = 256) {
  const svg = renderIconSvg(IconComponent, color, size);
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + pngBuffer.toString("base64");
}

// Shadow factories — never reuse objects
const makeShadow     = () => ({ type: "outer", color: "000000", blur: 6,  offset: 2, angle: 135, opacity: 0.12 });
const makeShadowDark = () => ({ type: "outer", color: "000000", blur: 8,  offset: 3, angle: 135, opacity: 0.25 });

/**
 * Pick the most relevant icon for a given text string using keyword matching.
 * Falls back to `fallback` icon if no keywords match.
 */
function pickIcon(text, icons, fallback, _usedInSlot) {
  const t = (text || "").toLowerCase();

  if (/brain|ai|ml|model|neural|deep.learn|intelligen|predict|classif|nlp|llm|gpt|bert/.test(t)) return icons.brain;
  if (/camera|image|photo|vision|detect|face|scan|video|visual|recogni|ocr|frame/.test(t))      return icons.camera;
  if (/cog|setting|config|process|engine|automat|workflow|pipeline|system|mechanism/.test(t))   return icons.cogs;
  if (/chart|stat|analytic|report|graph|metric|dashboard|visuali|insight|result|performance/.test(t)) return icons.chart;
  if (/book|learn|edu|course|study|knowledge|paper|document|content|material|curriculum/.test(t)) return icons.book;
  if (/bulb|idea|innovat|smart|suggest|recommend|propos|solution|creative|feature/.test(t))      return icons.lightbulb;
  if (/check|valid|test|pass|verif|approv|qualit|review|audit|certif/.test(t))                  return icons.check;
  if (/server|backend|host|cloud|infra|devops|deploy|scalab|container|docker|k8s|vm/.test(t))   return icons.server;
  if (/code|develop|program|software|app|web|api|frontend|interface|portal|platform|site/.test(t)) return icons.code;
  if (/database|data|storage|sql|mongo|redis|cache|store|warehouse|table|record/.test(t))       return icons.database;
  if (/flask|lab|research|experiment|science|test|trial|prototype/.test(t))                     return icons.flask;
  if (/gallery|screenshot|media|render|display|ui|ux|design|layout|screen/.test(t))             return icons.image;
  if (/rocket|launch|deploy|fast|perform|speed|optim|boost|efficien|scale/.test(t))             return icons.rocket;
  if (/grad|education|student|degree|universit|academ|teach|train|certif|skill/.test(t))        return icons.grad;
  if (/clipboard|task|list|report|note|plan|schedule|manag|track|monitor|log/.test(t))          return icons.clipboard;
  if (/search|find|query|filter|index|retriev|locat|browse|discover|fetch/.test(t))             return icons.search;
  if (/layer|stack|tier|level|architec|structur|hierarchy|frame|build/.test(t))                 return icons.layer;
  if (/star|rating|award|top|best|featured|premium|priorit|highlight/.test(t))                  return icons.star;
  if (/heart|health|medical|care|wellness|patient|clinic|hospital|therapy|diagnos/.test(t))     return icons.heart;
  if (/project|manage|plan|coordinat|team|collaborat|agile|scrum|board|sprint/.test(t))         return icons.project;
  if (/network|connect|graph|topolog|wifi|iot|sensor|device|node|mesh|protocol|mqtt/.test(t))   return icons.network;
  if (/chip|hardware|micro|embed|raspberry|arduino|fpga|circuit|processor|gpio/.test(t))        return icons.chip;
  if (/shield|secur|protect|encrypt|auth|firewall|vpn|privacy|access|permiss|login/.test(t))    return icons.shield;
  if (/food|recipe|nutri|meal|diet|cook|ingredient|restaurant|menu|calor/.test(t))              return icons.heart;
  if (/user|person|profile|account|member|customer|client|admin|role/.test(t))                  return icons.grad;
  if (/payment|pay|invoice|billing|transact|financ|money|wallet|subscript/.test(t))             return icons.chart;
  if (/notif|alert|message|email|chat|communicat|send|push|inbox/.test(t))                      return icons.lightbulb;
  if (/upload|download|file|export|import|transfer|backup|restore|sync/.test(t))                return icons.server;
  if (/map|location|geo|gps|route|track|address|spatial/.test(t))                               return icons.network;

  return fallback || icons.brain;
}

/**
 * Same as pickIcon but guarantees uniqueness within a slide.
 * Pass a fresh `Set` per slide; used icons are tracked in it.
 * Falls back through _fallbackPool to find an unused icon.
 */
function pickIconUnique(text, icons, fallbackPool, usedSet) {
  const chosen = pickIcon(text, icons, null);
  if (chosen && !usedSet.has(chosen)) { usedSet.add(chosen); return chosen; }
  // Rotate through fallback pool to find an unused one
  for (const ico of fallbackPool) {
    if (!usedSet.has(ico)) { usedSet.add(ico); return ico; }
  }
  // All icons used — just return the keyword match (repeat is unavoidable)
  const fallback = chosen || fallbackPool[0];
  usedSet.add(fallback);
  return fallback;
}

const TITLE_FONT = "Trebuchet MS";
const BODY_FONT  = "Calibri";

// ── Build a complete 15-slide PPT ─────────────────────────────────────────────
async function buildPPT(pptData, C, outputPath, screenshotImages = null, onProgress = null) {
  // Load icons once
  const { FaBrain, FaCamera, FaCogs, FaChartBar, FaBookOpen,
          FaLightbulb, FaCheckCircle, FaServer, FaCode,
          FaDatabase, FaFlask, FaImage, FaRocket,
          FaGraduationCap, FaClipboardCheck, FaSearch,
          FaLayerGroup, FaStar, FaHeart, FaProjectDiagram,
          FaNetworkWired, FaMicrochip, FaShieldAlt } = require("react-icons/fa");
  const { MdOutlineFoodBank } = require("react-icons/md");

  const accentHex  = "#" + C.accent;
  const whiteHex   = "#FFFFFF";
  const primaryHex = "#" + C.primary;

  // Pre-render icons
  const icons = {
    brain:     await iconToBase64Png(FaBrain,          whiteHex),
    camera:    await iconToBase64Png(FaCamera,         whiteHex),
    cogs:      await iconToBase64Png(FaCogs,           whiteHex),
    chart:     await iconToBase64Png(FaChartBar,       whiteHex),
    book:      await iconToBase64Png(FaBookOpen,       accentHex),
    lightbulb: await iconToBase64Png(FaLightbulb,      whiteHex),
    check:     await iconToBase64Png(FaCheckCircle,    whiteHex),
    server:    await iconToBase64Png(FaServer,         whiteHex),
    code:      await iconToBase64Png(FaCode,           whiteHex),
    database:  await iconToBase64Png(FaDatabase,       whiteHex),
    flask:     await iconToBase64Png(FaFlask,          whiteHex),
    image:     await iconToBase64Png(FaImage,          whiteHex),
    rocket:    await iconToBase64Png(FaRocket,         accentHex),
    grad:      await iconToBase64Png(FaGraduationCap,  accentHex),
    clipboard: await iconToBase64Png(FaClipboardCheck, whiteHex),
    search:    await iconToBase64Png(FaSearch,         whiteHex),
    layer:     await iconToBase64Png(FaLayerGroup,     whiteHex),
    star:      await iconToBase64Png(FaStar,           accentHex),
    heart:     await iconToBase64Png(FaHeart,          accentHex),
    project:   await iconToBase64Png(FaProjectDiagram, accentHex),
    network:   await iconToBase64Png(FaNetworkWired,   whiteHex),
    chip:      await iconToBase64Png(FaMicrochip,      whiteHex),
    shield:    await iconToBase64Png(FaShieldAlt,      whiteHex),
  };

  // Static fallback pool (used only when keyword matching returns nothing)
  const _fallbackPool = [icons.brain, icons.camera, icons.cogs, icons.code,
                         icons.database, icons.server, icons.layer, icons.network,
                         icons.chip, icons.shield, icons.search, icons.flask];

  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "AI PPT Generator";
  pres.title  = pptData.presentation.title;

  // Auto-report progress after each slide is added
  if (onProgress) {
    let _slideCount = 0;
    const _origAddSlide = pres.addSlide.bind(pres);
    pres.addSlide = (...args) => {
      const sl = _origAddSlide(...args);
      onProgress(++_slideCount);
      return sl;
    };
  }

  const slides = pptData.presentation.slides;

  // ───────────────────────────────────────────────────
  // SLIDE 1 — TITLE
  // ───────────────────────────────────────────────────
  {
    const d = slides.find(s => s.type === "title");
    const sl = pres.addSlide();
    sl.background = { color: C.dark };
    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0,     w: 10, h: 0.06, fill: { color: C.accent } });
    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.565, w: 10, h: 0.06, fill: { color: C.accent } });

    sl.addImage({ data: pickIcon(d.title + " " + (pptData.presentation.techBadges || []).join(" "), icons, icons.project), x: 4.5, y: 0.55, w: 1, h: 1 });

    sl.addText(d.title, {
      x: 0.8, y: 1.65, w: 8.4, h: 1.5,
      fontFace: TITLE_FONT, fontSize: 30, color: C.textLight,
      bold: true, align: "center", lineSpacingMultiple: 1.15, margin: 0
    });

    sl.addText(d.tagline, {
      x: 1.2, y: 3.25, w: 7.6, h: 0.45,
      fontFace: BODY_FONT, fontSize: 12.5, color: C.accent,
      italic: true, align: "center", margin: 0
    });

    // Tech badges
    const badges = (pptData.presentation.techBadges || []).slice(0, 6);
    if (badges.length > 0) {
      const bW = 1.25, bGap = 0.15;
      const total = badges.length * bW + (badges.length - 1) * bGap;
      const startX = (10 - total) / 2;
      badges.forEach((badge, i) => {
        const bx = startX + i * (bW + bGap);
        sl.addShape(pres.shapes.RECTANGLE, {
          x: bx, y: 3.82, w: bW, h: 0.34,
          fill: { color: C.primary, transparency: 20 },
          line: { color: C.accent, width: 0.5 }
        });
        sl.addText(badge, {
          x: bx, y: 3.82, w: bW, h: 0.34,
          fontFace: BODY_FONT, fontSize: 10, color: C.accent,
          bold: true, align: "center", valign: "middle", margin: 0
        });
      });
    }

    sl.addText(d.studentInfo || "Presented by: [Your Name]  |  Under the Guidance of: [Guide Name]", {
      x: 1, y: 4.4, w: 8, h: 0.85,
      fontFace: BODY_FONT, fontSize: 10.5, color: "B8A090",
      align: "center", lineSpacingMultiple: 1.35, margin: 0
    });
  }

  // ───────────────────────────────────────────────────
  // SLIDE 2 — ABSTRACT
  // ───────────────────────────────────────────────────
  {
    const d = slides.find(s => s.type === "abstract");
    const sl = pres.addSlide();
    sl.background = { color: C.light };
    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.06, h: 5.625, fill: { color: C.primary } });

    sl.addText(d.title, {
      x: 0.6, y: 0.3, w: 4, h: 0.55,
      fontFace: TITLE_FONT, fontSize: 30, color: C.primary, bold: true, margin: 0
    });
    sl.addText(d.content, {
      x: 0.6, y: 0.95, w: 5.2, h: 2.5,
      fontFace: BODY_FONT, fontSize: 12, color: C.text,
      lineSpacingMultiple: 1.4, valign: "top", margin: 0
    });

    (d.stats || []).forEach((st, i) => {
      const cy = 0.35 + i * 1.25;
      sl.addShape(pres.shapes.RECTANGLE, {
        x: 6.3, y: cy, w: 3.2, h: 1.05,
        fill: { color: C.lightCard }, shadow: makeShadow(),
        line: { color: C.cardBorder, width: 0.5 }
      });
      sl.addShape(pres.shapes.RECTANGLE, { x: 6.3, y: cy, w: 0.06, h: 1.05, fill: { color: C.accent } });
      sl.addImage({ data: pickIcon(st.label, icons, _fallbackPool[i % _fallbackPool.length]), x: 6.55, y: cy + 0.2, w: 0.45, h: 0.45 });
      sl.addText(st.num, {
        x: 7.15, y: cy + 0.08, w: 2.1, h: 0.5,
        fontFace: TITLE_FONT, fontSize: 22, color: C.primary, bold: true, margin: 0
      });
      sl.addText(st.label, {
        x: 7.15, y: cy + 0.58, w: 2.1, h: 0.35,
        fontFace: BODY_FONT, fontSize: 10.5, color: C.muted, margin: 0
      });
    });

    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.35, w: 10, h: 0.275, fill: { color: C.primary, transparency: 10 } });
    sl.addText("Department of Computer Science & Engineering", {
      x: 0.6, y: 5.35, w: 8, h: 0.275,
      fontFace: BODY_FONT, fontSize: 9, color: C.muted, valign: "middle", margin: 0
    });
  }

  // ───────────────────────────────────────────────────
  // SLIDE 3 — INTRODUCTION
  // ───────────────────────────────────────────────────
  {
    const d = slides.find(s => s.type === "introduction");
    const sl = pres.addSlide();
    sl.background = { color: C.light };
    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.06, h: 5.625, fill: { color: C.primary } });
    sl.addText(d.title, {
      x: 0.6, y: 0.3, w: 5, h: 0.55,
      fontFace: TITLE_FONT, fontSize: 30, color: C.primary, bold: true, margin: 0
    });

    // Problem Statement card
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0.6, y: 1.0, w: 4.25, h: 3.1, fill: { color: C.lightCard }, shadow: makeShadow(),
      line: { color: C.cardBorder, width: 0.5 }
    });
    sl.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.0, w: 4.25, h: 0.45, fill: { color: C.secondary } });
    sl.addText(d.problemStatement.heading, {
      x: 0.8, y: 1.0, w: 3.8, h: 0.45,
      fontFace: TITLE_FONT, fontSize: 14, color: C.textLight, bold: true, valign: "middle", margin: 0
    });
    sl.addText(d.problemStatement.points.map(p => ({ text: p, options: { bullet: true, breakLine: true } })), {
      x: 0.8, y: 1.6, w: 3.85, h: 2.35,
      fontFace: BODY_FONT, fontSize: 11.5, color: C.text,
      lineSpacingMultiple: 1.3, valign: "top", paraSpaceAfter: 6
    });

    // Objectives card
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 5.15, y: 1.0, w: 4.35, h: 3.1, fill: { color: C.lightCard }, shadow: makeShadow(),
      line: { color: C.cardBorder, width: 0.5 }
    });
    sl.addShape(pres.shapes.RECTANGLE, { x: 5.15, y: 1.0, w: 4.35, h: 0.45, fill: { color: C.primary } });
    sl.addText(d.objectives.heading, {
      x: 5.35, y: 1.0, w: 4, h: 0.45,
      fontFace: TITLE_FONT, fontSize: 14, color: C.textLight, bold: true, valign: "middle", margin: 0
    });
    sl.addText(d.objectives.points.map(p => ({ text: p, options: { bullet: true, breakLine: true } })), {
      x: 5.35, y: 1.6, w: 3.95, h: 2.35,
      fontFace: BODY_FONT, fontSize: 11.5, color: C.text,
      lineSpacingMultiple: 1.3, valign: "top", paraSpaceAfter: 6
    });

    // Scope bar
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0.6, y: 4.35, w: 8.9, h: 0.65,
      fill: { color: C.accent, transparency: 85 }, line: { color: C.accent, width: 0.5 }
    });
    sl.addText("Scope: " + d.scope, {
      x: 0.8, y: 4.35, w: 8.5, h: 0.65,
      fontFace: BODY_FONT, fontSize: 10.5, color: C.text, valign: "middle", margin: 0
    });
    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.35, w: 10, h: 0.275, fill: { color: C.primary, transparency: 10 } });
  }

  // ───────────────────────────────────────────────────
  // SLIDE 4 — LITERATURE SURVEY
  // ───────────────────────────────────────────────────
  {
    const d = slides.find(s => s.type === "literature");
    const sl = pres.addSlide();
    sl.background = { color: C.light };
    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.06, h: 5.625, fill: { color: C.primary } });
    sl.addText(d.title, {
      x: 0.6, y: 0.3, w: 5, h: 0.5,
      fontFace: TITLE_FONT, fontSize: 28, color: C.primary, bold: true, margin: 0
    });

    (d.papers || []).slice(0, 4).forEach((p, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const cx = 0.6 + col * 4.55, cy = 0.95 + row * 1.85;
      sl.addShape(pres.shapes.RECTANGLE, {
        x: cx, y: cy, w: 4.25, h: 1.65, fill: { color: C.lightCard }, shadow: makeShadow(),
        line: { color: C.cardBorder, width: 0.5 }
      });
      sl.addShape(pres.shapes.RECTANGLE, { x: cx, y: cy, w: 4.25, h: 0.05, fill: { color: C.accent } });
      sl.addText(p.author, {
        x: cx + 0.15, y: cy + 0.12, w: 3.9, h: 0.28,
        fontFace: TITLE_FONT, fontSize: 10.5, color: C.primary, bold: true, margin: 0
      });
      sl.addText(p.title, {
        x: cx + 0.15, y: cy + 0.37, w: 3.9, h: 0.25,
        fontFace: BODY_FONT, fontSize: 9.5, color: C.accent, italic: true, margin: 0
      });
      sl.addText(p.finding, {
        x: cx + 0.15, y: cy + 0.65, w: 3.9, h: 0.5,
        fontFace: BODY_FONT, fontSize: 9.5, color: C.text, lineSpacingMultiple: 1.2, margin: 0
      });
      sl.addShape(pres.shapes.RECTANGLE, {
        x: cx + 0.15, y: cy + 1.22, w: 3.9, h: 0.3,
        fill: { color: C.accent2, transparency: 85 }
      });
      sl.addText("Gap: " + p.gap, {
        x: cx + 0.25, y: cy + 1.22, w: 3.7, h: 0.3,
        fontFace: BODY_FONT, fontSize: 9, color: C.accent2, bold: true, valign: "middle", margin: 0
      });
    });

    sl.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 4.75, w: 8.9, h: 0.55, fill: { color: C.secondary } });
    sl.addText("Research Gap: " + d.researchGap, {
      x: 0.8, y: 4.75, w: 8.5, h: 0.55,
      fontFace: BODY_FONT, fontSize: 11, color: C.textLight, bold: true, valign: "middle", margin: 0
    });
  }

  // ───────────────────────────────────────────────────
  // SLIDE 5 — PROPOSED SYSTEM (dark)
  // ───────────────────────────────────────────────────
  {
    const d = slides.find(s => s.type === "proposed");
    const sl = pres.addSlide();
    sl.background = { color: C.dark };
    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0,     w: 10, h: 0.06, fill: { color: C.accent } });
    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.565, w: 10, h: 0.06, fill: { color: C.accent } });

    sl.addText(d.title, {
      x: 0.6, y: 0.35, w: 8, h: 0.55,
      fontFace: TITLE_FONT, fontSize: 30, color: C.textLight, bold: true, margin: 0
    });
    sl.addText(d.subtitle, {
      x: 0.6, y: 0.9, w: 8, h: 0.35,
      fontFace: BODY_FONT, fontSize: 12, color: C.accent, italic: true, margin: 0
    });

    const usedIconsSlide5 = new Set();
    (d.features || []).slice(0, 4).forEach((f, i) => {
      const cx = 0.5 + i * 2.35;
      sl.addShape(pres.shapes.RECTANGLE, {
        x: cx, y: 1.55, w: 2.1, h: 3.4, fill: { color: C.darkCard },
        shadow: makeShadowDark(), line: { color: C.muted, width: 0.3 }
      });
      sl.addShape(pres.shapes.OVAL, { x: cx + 0.65, y: 1.8, w: 0.8, h: 0.8, fill: { color: C.primary } });
      sl.addImage({ data: pickIconUnique(f.title + " " + f.desc, icons, _fallbackPool, usedIconsSlide5), x: cx + 0.8, y: 1.95, w: 0.5, h: 0.5 });
      sl.addText(f.title, {
        x: cx + 0.1, y: 2.75, w: 1.9, h: 0.5,
        fontFace: TITLE_FONT, fontSize: 12.5, color: C.accent, bold: true, align: "center", margin: 0
      });
      sl.addText(f.desc, {
        x: cx + 0.1, y: 3.25, w: 1.9, h: 1.5,
        fontFace: BODY_FONT, fontSize: 10, color: "B8A090",
        lineSpacingMultiple: 1.3, align: "center", valign: "top", margin: 0
      });
    });
  }

  // ───────────────────────────────────────────────────
  // SLIDE 6 — REQUIREMENTS
  // ───────────────────────────────────────────────────
  {
    const d = slides.find(s => s.type === "requirements");
    const sl = pres.addSlide();
    sl.background = { color: C.light };
    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.06, h: 5.625, fill: { color: C.primary } });
    sl.addText(d.title, {
      x: 0.6, y: 0.3, w: 5, h: 0.5,
      fontFace: TITLE_FONT, fontSize: 28, color: C.primary, bold: true, margin: 0
    });

    // Hardware card
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0.6, y: 0.95, w: 4.2, h: 2.05, fill: { color: C.lightCard },
      shadow: makeShadow(), line: { color: C.cardBorder, width: 0.5 }
    });
    sl.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 0.95, w: 4.2, h: 0.4, fill: { color: C.secondary } });
    sl.addText("Hardware Requirements", {
      x: 0.8, y: 0.95, w: 3.8, h: 0.4,
      fontFace: TITLE_FONT, fontSize: 12.5, color: C.textLight, bold: true, valign: "middle", margin: 0
    });
    sl.addText((d.hardware || []).map(h => ({ text: h, options: { bullet: true, breakLine: true } })), {
      x: 0.8, y: 1.45, w: 3.8, h: 1.45,
      fontFace: BODY_FONT, fontSize: 11, color: C.text, paraSpaceAfter: 4
    });

    // Software card
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 5.2, y: 0.95, w: 4.3, h: 2.05, fill: { color: C.lightCard },
      shadow: makeShadow(), line: { color: C.cardBorder, width: 0.5 }
    });
    sl.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 0.95, w: 4.3, h: 0.4, fill: { color: C.primary } });
    sl.addText("Software Requirements", {
      x: 5.4, y: 0.95, w: 3.9, h: 0.4,
      fontFace: TITLE_FONT, fontSize: 12.5, color: C.textLight, bold: true, valign: "middle", margin: 0
    });
    sl.addText((d.software || []).map(s => ({ text: s, options: { bullet: true, breakLine: true } })), {
      x: 5.4, y: 1.45, w: 3.9, h: 1.45,
      fontFace: BODY_FONT, fontSize: 11, color: C.text, paraSpaceAfter: 4
    });

    // Tech Stack grid
    sl.addText("Technology Stack", {
      x: 0.6, y: 3.2, w: 4, h: 0.4,
      fontFace: TITLE_FONT, fontSize: 16, color: C.primary, bold: true, margin: 0
    });
    (d.techStack || []).slice(0, 8).forEach((t, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const tx = 0.6 + col * 2.32, ty = 3.7 + row * 0.8;
      sl.addShape(pres.shapes.RECTANGLE, {
        x: tx, y: ty, w: 2.1, h: 0.65, fill: { color: C.lightCard },
        shadow: makeShadow(), line: { color: C.cardBorder, width: 0.5 }
      });
      sl.addShape(pres.shapes.RECTANGLE, { x: tx, y: ty, w: 0.05, h: 0.65, fill: { color: C.accent } });
      sl.addText(t.name, {
        x: tx + 0.15, y: ty + 0.05, w: 1.8, h: 0.3,
        fontFace: TITLE_FONT, fontSize: 11, color: C.text, bold: true, margin: 0
      });
      sl.addText(t.cat, {
        x: tx + 0.15, y: ty + 0.35, w: 1.8, h: 0.25,
        fontFace: BODY_FONT, fontSize: 9, color: C.muted, margin: 0
      });
    });
  }

  // ───────────────────────────────────────────────────
  // SLIDE 7 — ARCHITECTURE
  // ───────────────────────────────────────────────────
  {
    const d = slides.find(s => s.type === "architecture");
    const sl = pres.addSlide();
    sl.background = { color: C.light };
    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.06, h: 5.625, fill: { color: C.primary } });
    sl.addText(d.title, {
      x: 0.6, y: 0.3, w: 5, h: 0.5,
      fontFace: TITLE_FONT, fontSize: 28, color: C.primary, bold: true, margin: 0
    });

    const layerColors = [C.accent, "5D4037", C.primary, C.secondary, "1B5E20", C.accent];
    const layerTextColors = [C.dark, "FFFFFF", "FFFFFF", "FFFFFF", "FFFFFF", C.dark];
    const layerW = 1.25, layerH = 1.6, layerGap = 0.22;
    const layers = (d.layers || []).slice(0, 6);
    const layerStartX = (10 - (layers.length * layerW + (layers.length - 1) * layerGap)) / 2;
    const layerY = 1.15;

    const usedIconsSlide7 = new Set();
    layers.forEach((l, i) => {
      const lx = layerStartX + i * (layerW + layerGap);
      sl.addShape(pres.shapes.RECTANGLE, {
        x: lx, y: layerY, w: layerW, h: layerH,
        fill: { color: layerColors[i] || C.primary }, shadow: makeShadow()
      });
      sl.addImage({ data: pickIconUnique(l.label, icons, _fallbackPool, usedIconsSlide7), x: lx + (layerW - 0.4) / 2, y: layerY + 0.2, w: 0.4, h: 0.4 });
      sl.addText(l.label, {
        x: lx + 0.05, y: layerY + 0.7, w: layerW - 0.1, h: 0.8,
        fontFace: BODY_FONT, fontSize: 10, color: layerTextColors[i] || "FFFFFF",
        bold: true, align: "center", valign: "middle", lineSpacingMultiple: 1.15, margin: 0
      });
      if (i < layers.length - 1) {
        const arrowX = lx + layerW;
        sl.addShape(pres.shapes.RECTANGLE, {
          x: arrowX + 0.03, y: layerY + layerH / 2 - 0.04, w: layerGap - 0.06, h: 0.08,
          fill: { color: C.accent }
        });
      }
    });

    (d.detailBoxes || []).slice(0, 3).forEach((box, i) => {
      const dx = 0.6 + i * 3.1;
      sl.addShape(pres.shapes.RECTANGLE, {
        x: dx, y: 3.15, w: 2.85, h: 1.95, fill: { color: C.lightCard },
        shadow: makeShadow(), line: { color: C.cardBorder, width: 0.5 }
      });
      sl.addShape(pres.shapes.RECTANGLE, { x: dx, y: 3.15, w: 2.85, h: 0.05, fill: { color: C.primary } });
      sl.addText(box.title, {
        x: dx + 0.12, y: 3.3, w: 2.6, h: 0.35,
        fontFace: TITLE_FONT, fontSize: 12, color: C.primary, bold: true, margin: 0
      });
      sl.addText(box.items, {
        x: dx + 0.12, y: 3.7, w: 2.6, h: 1.25,
        fontFace: BODY_FONT, fontSize: 10, color: C.text, lineSpacingMultiple: 1.3, margin: 0
      });
    });
  }

  // ───────────────────────────────────────────────────
  // SLIDE 8 — MODULES
  // ───────────────────────────────────────────────────
  {
    const d = slides.find(s => s.type === "modules");
    const sl = pres.addSlide();
    sl.background = { color: C.light };
    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.06, h: 5.625, fill: { color: C.primary } });
    sl.addText(d.title, {
      x: 0.6, y: 0.3, w: 5, h: 0.5,
      fontFace: TITLE_FONT, fontSize: 28, color: C.primary, bold: true, margin: 0
    });

    const usedIconsSlide8 = new Set();
    (d.modules || []).slice(0, 6).forEach((m, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const mx = 0.5 + col * 3.1, my = 1.0 + row * 2.15;
      sl.addShape(pres.shapes.RECTANGLE, {
        x: mx, y: my, w: 2.85, h: 1.95, fill: { color: C.lightCard },
        shadow: makeShadow(), line: { color: C.cardBorder, width: 0.5 }
      });
      sl.addShape(pres.shapes.OVAL, { x: mx + 0.15, y: my + 0.15, w: 0.55, h: 0.55, fill: { color: C.primary } });
      sl.addImage({ data: pickIconUnique(m.name + " " + m.desc, icons, _fallbackPool, usedIconsSlide8), x: mx + 0.25, y: my + 0.25, w: 0.35, h: 0.35 });
      sl.addText(m.name, {
        x: mx + 0.85, y: my + 0.18, w: 1.85, h: 0.45,
        fontFace: TITLE_FONT, fontSize: 12, color: C.text, bold: true, valign: "middle", margin: 0
      });
      sl.addText(m.desc, {
        x: mx + 0.15, y: my + 0.85, w: 2.55, h: 0.95,
        fontFace: BODY_FONT, fontSize: 10, color: C.muted, lineSpacingMultiple: 1.3, margin: 0
      });
    });
  }

  // ───────────────────────────────────────────────────
  // SLIDE 9 — CORE TECHNOLOGY / MODELS
  // ───────────────────────────────────────────────────
  {
    const d = slides.find(s => s.type === "technology");
    const sl = pres.addSlide();
    sl.background = { color: C.light };
    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.06, h: 5.625, fill: { color: C.primary } });
    sl.addText(d.title, {
      x: 0.6, y: 0.3, w: 5, h: 0.5,
      fontFace: TITLE_FONT, fontSize: 28, color: C.primary, bold: true, margin: 0
    });

    // Dataset banner
    sl.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 0.9, w: 8.9, h: 0.75, fill: { color: C.secondary } });
    sl.addImage({ data: icons.database, x: 0.8, y: 1.02, w: 0.4, h: 0.4 });
    sl.addText(d.datasetOrCore.name, {
      x: 1.35, y: 0.95, w: 3, h: 0.35,
      fontFace: TITLE_FONT, fontSize: 14, color: C.accent, bold: true, margin: 0
    });
    sl.addText(d.datasetOrCore.stats, {
      x: 1.35, y: 1.28, w: 7.5, h: 0.3,
      fontFace: BODY_FONT, fontSize: 10, color: "B8A090", margin: 0
    });

    // 3 model/approach cards
    (d.models || []).slice(0, 3).forEach((m, i) => {
      const mx = 0.6 + i * 3.1;
      const borderColor = m.selected ? C.accent : C.cardBorder;
      sl.addShape(pres.shapes.RECTANGLE, {
        x: mx, y: 1.9, w: 2.85, h: 3.2, fill: { color: C.lightCard },
        shadow: makeShadow(), line: { color: borderColor, width: m.selected ? 1.5 : 0.5 }
      });
      sl.addShape(pres.shapes.RECTANGLE, {
        x: mx, y: 1.9, w: 2.85, h: 0.5,
        fill: { color: m.selected ? C.primary : "5D4037" }
      });
      sl.addText(m.name + (m.selected ? "  ★" : ""), {
        x: mx + 0.1, y: 1.9, w: 2.65, h: 0.5,
        fontFace: TITLE_FONT, fontSize: 14, color: C.textLight, bold: true, valign: "middle", margin: 0
      });
      sl.addText(m.acc, {
        x: mx + 0.15, y: 2.55, w: 2.55, h: 0.55,
        fontFace: TITLE_FONT, fontSize: 28, color: C.primary, bold: true, align: "center", margin: 0
      });
      sl.addText("Performance", {
        x: mx + 0.15, y: 3.05, w: 2.55, h: 0.25,
        fontFace: BODY_FONT, fontSize: 9.5, color: C.muted, align: "center", margin: 0
      });
      sl.addShape(pres.shapes.RECTANGLE, {
        x: mx + 0.15, y: 3.4, w: 2.55, h: 0.3,
        fill: { color: C.accent, transparency: 85 }
      });
      sl.addText("Parameters: " + m.params, {
        x: mx + 0.25, y: 3.4, w: 2.35, h: 0.3,
        fontFace: BODY_FONT, fontSize: 9.5, color: C.text, valign: "middle", margin: 0
      });
      sl.addText(m.pros, {
        x: mx + 0.15, y: 3.85, w: 2.55, h: 1.1,
        fontFace: BODY_FONT, fontSize: 9.5, color: C.text, lineSpacingMultiple: 1.3, margin: 0
      });
    });
  }

  // ───────────────────────────────────────────────────
  // SLIDE 10 — SCREENSHOTS / DEMO
  // ───────────────────────────────────────────────────
  {
    const d = slides.find(s => s.type === "screenshots");
    const sl = pres.addSlide();
    sl.background = { color: C.light };
    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.06, h: 5.625, fill: { color: C.primary } });
    sl.addText(d.title, {
      x: 0.6, y: 0.3, w: 6, h: 0.5,
      fontFace: TITLE_FONT, fontSize: 28, color: C.primary, bold: true, margin: 0
    });

    (d.screenshots || []).slice(0, 4).forEach((title, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const sx = 0.6 + col * 4.55, sy = 1.0 + row * 2.15;
      const capturedImg = screenshotImages && screenshotImages[i]; // base64 PNG or null

      if (capturedImg) {
        // Real screenshot from YouTube — fill the card area with the image
        sl.addImage({
          data: capturedImg,
          x: sx, y: sy, w: 4.25, h: 1.65,
          sizing: { type: "cover", w: 4.25, h: 1.65 }
        });
        // Subtle shadow border over the image
        sl.addShape(pres.shapes.RECTANGLE, {
          x: sx, y: sy, w: 4.25, h: 1.65,
          fill: { type: "none" },
          shadow: makeShadow(),
          line: { color: C.cardBorder, width: 0.5 }
        });
      } else {
        // Placeholder
        sl.addShape(pres.shapes.RECTANGLE, {
          x: sx, y: sy, w: 4.25, h: 1.65, fill: { color: "E8E0D8" },
          shadow: makeShadow(), line: { color: C.cardBorder, width: 0.5 }
        });
        sl.addText("[Insert Screenshot]", {
          x: sx, y: sy + 0.45, w: 4.25, h: 0.5,
          fontFace: BODY_FONT, fontSize: 14, color: C.muted, align: "center", valign: "middle", margin: 0
        });
      }

      // Label bar at the bottom of every card
      sl.addShape(pres.shapes.RECTANGLE, {
        x: sx, y: sy + 1.65 - 0.35, w: 4.25, h: 0.35,
        fill: { color: C.secondary, transparency: capturedImg ? 25 : 15 }
      });
      sl.addText(title, {
        x: sx + 0.1, y: sy + 1.65 - 0.35, w: 4.05, h: 0.35,
        fontFace: BODY_FONT, fontSize: 10, color: C.textLight, valign: "middle", margin: 0
      });
    });

  }

  // ───────────────────────────────────────────────────
  // SLIDE 11 — TESTING
  // ───────────────────────────────────────────────────
  {
    const d = slides.find(s => s.type === "testing");
    const sl = pres.addSlide();
    sl.background = { color: C.light };
    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.06, h: 5.625, fill: { color: C.primary } });
    sl.addText(d.title, {
      x: 0.6, y: 0.3, w: 5, h: 0.5,
      fontFace: TITLE_FONT, fontSize: 28, color: C.primary, bold: true, margin: 0
    });

    (d.strategies || []).slice(0, 4).forEach((st, i) => {
      const sx = 0.5 + i * 2.35;
      sl.addShape(pres.shapes.RECTANGLE, {
        x: sx, y: 0.95, w: 2.1, h: 0.85, fill: { color: C.lightCard },
        shadow: makeShadow(), line: { color: C.cardBorder, width: 0.5 }
      });
      sl.addShape(pres.shapes.RECTANGLE, { x: sx, y: 0.95, w: 2.1, h: 0.04, fill: { color: C.accent } });
      sl.addText(st.name, {
        x: sx + 0.1, y: 1.05, w: 1.9, h: 0.3,
        fontFace: TITLE_FONT, fontSize: 11, color: C.text, bold: true, margin: 0
      });
      sl.addText(st.desc, {
        x: sx + 0.1, y: 1.35, w: 1.9, h: 0.35,
        fontFace: BODY_FONT, fontSize: 9.5, color: C.muted, margin: 0
      });
    });

    sl.addText("Test Cases", {
      x: 0.6, y: 2.05, w: 3, h: 0.35,
      fontFace: TITLE_FONT, fontSize: 14, color: C.primary, bold: true, margin: 0
    });

    const tableHeader = [[
      { text: "Test ID",        options: { fill: { color: C.secondary }, color: "FFFFFF", bold: true, fontFace: BODY_FONT, fontSize: 10, align: "center" } },
      { text: "Test Case",      options: { fill: { color: C.secondary }, color: "FFFFFF", bold: true, fontFace: BODY_FONT, fontSize: 10 } },
      { text: "Expected Result",options: { fill: { color: C.secondary }, color: "FFFFFF", bold: true, fontFace: BODY_FONT, fontSize: 10 } },
      { text: "Status",         options: { fill: { color: C.secondary }, color: "FFFFFF", bold: true, fontFace: BODY_FONT, fontSize: 10, align: "center" } }
    ]];

    const testRows = (d.testCases || []).slice(0, 7).map((tc, ri) => {
      const bgColor = ri % 2 === 0 ? "FFF8F0" : "FFFFFF";
      return [tc.id, tc.case, tc.expected, tc.status].map((cell, ci) => ({
        text: cell,
        options: {
          fill: { color: bgColor }, color: C.text, fontFace: BODY_FONT, fontSize: 9.5,
          align: (ci === 0 || ci === 3) ? "center" : "left"
        }
      }));
    });

    sl.addTable([...tableHeader, ...testRows], {
      x: 0.5, y: 2.45, w: 9.0,
      colW: [0.8, 2.8, 3.2, 0.8],
      border: { pt: 0.5, color: C.cardBorder },
      rowH: [0.35, ...Array(testRows.length).fill(0.32)]
    });
  }

  // ───────────────────────────────────────────────────
  // SLIDE 12 — RESULTS
  // ───────────────────────────────────────────────────
  {
    const d = slides.find(s => s.type === "results");
    const sl = pres.addSlide();
    sl.background = { color: C.light };
    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.06, h: 5.625, fill: { color: C.primary } });
    sl.addText(d.title, {
      x: 0.6, y: 0.3, w: 5, h: 0.5,
      fontFace: TITLE_FONT, fontSize: 28, color: C.primary, bold: true, margin: 0
    });

    sl.addChart(pres.charts.BAR, [{
      name: "Performance",
      labels: d.chartData.labels,
      values: d.chartData.values
    }], {
      x: 0.5, y: 0.95, w: 5.5, h: 3.0,
      barDir: "col",
      chartColors: [C.primary],
      showTitle: false, showValue: true,
      dataLabelPosition: "outEnd",
      dataLabelColor: C.text, dataLabelFontSize: 10,
      catAxisLabelColor: C.text, catAxisLabelFontSize: 10,
      valAxisLabelColor: C.muted,
      valGridLine: { color: "E8D5C4", size: 0.5 },
      catGridLine: { style: "none" },
      showLegend: false,
      chartArea: { fill: { color: "FFFFFF" }, roundedCorners: true }
    });

    const metricColors = [C.primary, C.accent2, "1B5E20", C.accent];
    (d.metrics || []).slice(0, 4).forEach((m, i) => {
      const my = 0.95 + i * 0.78;
      sl.addShape(pres.shapes.RECTANGLE, {
        x: 6.4, y: my, w: 3.1, h: 0.62, fill: { color: C.lightCard },
        shadow: makeShadow(), line: { color: C.cardBorder, width: 0.5 }
      });
      sl.addShape(pres.shapes.RECTANGLE, { x: 6.4, y: my, w: 0.06, h: 0.62, fill: { color: metricColors[i] } });
      sl.addText(m.value, {
        x: 6.6, y: my + 0.05, w: 1.3, h: 0.5,
        fontFace: TITLE_FONT, fontSize: 20, color: metricColors[i], bold: true, valign: "middle", margin: 0
      });
      sl.addText(m.label, {
        x: 7.95, y: my + 0.05, w: 1.4, h: 0.5,
        fontFace: BODY_FONT, fontSize: 11, color: C.text, valign: "middle", margin: 0
      });
    });

    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 4.2, w: 9.0, h: 1.1, fill: { color: C.lightCard },
      shadow: makeShadow(), line: { color: C.accent, width: 0.5 }
    });
    sl.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 4.2, w: 0.06, h: 1.1, fill: { color: C.accent } });
    sl.addText("Key Findings", {
      x: 0.75, y: 4.25, w: 2, h: 0.3,
      fontFace: TITLE_FONT, fontSize: 13, color: C.primary, bold: true, margin: 0
    });
    sl.addText(d.keyFindings, {
      x: 0.75, y: 4.55, w: 8.5, h: 0.7,
      fontFace: BODY_FONT, fontSize: 10.5, color: C.text, lineSpacingMultiple: 1.3, margin: 0
    });
  }

  // ───────────────────────────────────────────────────
  // SLIDE 13 — CONCLUSION (dark)
  // ───────────────────────────────────────────────────
  {
    const d = slides.find(s => s.type === "conclusion");
    const sl = pres.addSlide();
    sl.background = { color: C.dark };
    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0,     w: 10, h: 0.06, fill: { color: C.accent } });
    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.565, w: 10, h: 0.06, fill: { color: C.accent } });
    sl.addText(d.title, {
      x: 0.6, y: 0.35, w: 8, h: 0.55,
      fontFace: TITLE_FONT, fontSize: 28, color: C.textLight, bold: true, margin: 0
    });

    // Achievements card
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 0.6, y: 1.1, w: 4.2, h: 3.6, fill: { color: C.darkCard },
      shadow: makeShadowDark(), line: { color: C.muted, width: 0.3 }
    });
    sl.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.1, w: 4.2, h: 0.45, fill: { color: C.primary } });
    sl.addImage({ data: icons.check, x: 0.75, y: 1.16, w: 0.3, h: 0.3 });
    sl.addText("Achievements", {
      x: 1.15, y: 1.1, w: 3.5, h: 0.45,
      fontFace: TITLE_FONT, fontSize: 14, color: C.textLight, bold: true, valign: "middle", margin: 0
    });
    sl.addText((d.achievements || []).map(a => ({ text: a, options: { bullet: true, breakLine: true } })), {
      x: 0.8, y: 1.7, w: 3.8, h: 2.85,
      fontFace: BODY_FONT, fontSize: 11, color: "B8A090",
      lineSpacingMultiple: 1.25, paraSpaceAfter: 6
    });

    // Future scope card
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 5.2, y: 1.1, w: 4.3, h: 3.6, fill: { color: C.darkCard },
      shadow: makeShadowDark(), line: { color: C.muted, width: 0.3 }
    });
    sl.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 1.1, w: 4.3, h: 0.45, fill: { color: "1B5E20" } });
    sl.addImage({ data: icons.lightbulb, x: 5.35, y: 1.16, w: 0.3, h: 0.3 });
    sl.addText("Future Scope", {
      x: 5.75, y: 1.1, w: 3.6, h: 0.45,
      fontFace: TITLE_FONT, fontSize: 14, color: C.textLight, bold: true, valign: "middle", margin: 0
    });
    sl.addText((d.futureScope || []).map(f => ({ text: f, options: { bullet: true, breakLine: true } })), {
      x: 5.4, y: 1.7, w: 3.9, h: 2.85,
      fontFace: BODY_FONT, fontSize: 11, color: "B8A090",
      lineSpacingMultiple: 1.25, paraSpaceAfter: 6
    });
  }

  // ───────────────────────────────────────────────────
  // SLIDE 14 — REFERENCES
  // ───────────────────────────────────────────────────
  {
    const d = slides.find(s => s.type === "references");
    const sl = pres.addSlide();
    sl.background = { color: C.light };
    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.06, h: 5.625, fill: { color: C.primary } });
    sl.addText(d.title, {
      x: 0.6, y: 0.3, w: 5, h: 0.5,
      fontFace: TITLE_FONT, fontSize: 28, color: C.primary, bold: true, margin: 0
    });

    (d.refs || []).slice(0, 7).forEach((ref, i) => {
      const ry = 0.95 + i * 0.62;
      sl.addShape(pres.shapes.RECTANGLE, {
        x: 0.5, y: ry, w: 9.0, h: 0.52,
        fill: { color: i % 2 === 0 ? "FFF8F0" : "FFFFFF" },
        line: { color: C.cardBorder, width: 0.3 }
      });
      sl.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: ry, w: 0.05, h: 0.52, fill: { color: C.accent } });
      sl.addText(ref, {
        x: 0.7, y: ry, w: 8.6, h: 0.52,
        fontFace: BODY_FONT, fontSize: 9.5, color: C.text, valign: "middle", margin: 0
      });
    });
  }

  // ───────────────────────────────────────────────────
  // SLIDE 15 — THANK YOU (dark)
  // ───────────────────────────────────────────────────
  {
    const d = slides.find(s => s.type === "thankyou");
    const sl = pres.addSlide();
    sl.background = { color: C.dark };
    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0,     w: 10, h: 0.06, fill: { color: C.accent } });
    sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.565, w: 10, h: 0.06, fill: { color: C.accent } });

    sl.addImage({ data: pickIcon(pptData.presentation.title, icons, icons.heart), x: 4.5, y: 1.2, w: 1.0, h: 1.0 });
    sl.addText(d.title || "Thank You!", {
      x: 1, y: 2.35, w: 8, h: 1.0,
      fontFace: TITLE_FONT, fontSize: 48, color: C.textLight,
      bold: true, align: "center", margin: 0
    });
    sl.addText(d.projectTitle || pptData.presentation.title, {
      x: 1.5, y: 3.35, w: 7, h: 0.4,
      fontFace: BODY_FONT, fontSize: 14, color: C.accent, italic: true, align: "center", margin: 0
    });
    if (d.closingLine) {
      sl.addText(d.closingLine, {
        x: 2, y: 3.85, w: 6, h: 0.4,
        fontFace: BODY_FONT, fontSize: 11, color: "B8A090", italic: true, align: "center", margin: 0
      });
    }
    sl.addShape(pres.shapes.RECTANGLE, {
      x: 3.5, y: 4.35, w: 3, h: 0.03, fill: { color: C.accent }
    });
    sl.addText("Questions & Answers", {
      x: 2, y: 4.5, w: 6, h: 0.4,
      fontFace: BODY_FONT, fontSize: 12, color: C.muted, italic: true, align: "center", margin: 0
    });
  }

  // ── Save ─────────────────────────────────────────────
  await pres.writeFile({ fileName: outputPath });
  return outputPath;
}

module.exports = { buildPPT };
