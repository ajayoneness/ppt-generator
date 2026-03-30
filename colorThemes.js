// ── Color Themes ──────────────────────────────────────────────────────────────
// Each theme has: primary, secondary, accent, dark, light, muted, text, textLight, accent2

const COLOR_THEMES = {
  "tech-blue": {
    name: "Tech Blue",
    description: "Professional blue for tech/software projects",
    primary:    "1565C0",
    secondary:  "0D1B2A",
    accent:     "29B6F6",
    dark:       "0A0E1A",
    darkCard:   "0D1B2A",
    light:      "F0F4FF",
    lightCard:  "FFFFFF",
    cardBorder: "BBDEFB",
    muted:      "5C7A9E",
    text:       "0D1B2A",
    textLight:  "FFFFFF",
    accent2:    "00BCD4",
    chartGreen: "4CAF50",
    chartBlue:  "2196F3",
  },
  "green-nature": {
    name: "Green Nature",
    description: "Fresh green for environment/health/agri projects",
    primary:    "2E7D32",
    secondary:  "1B2A1C",
    accent:     "66BB6A",
    dark:       "0F1A10",
    darkCard:   "1B2A1C",
    light:      "F1F8F1",
    lightCard:  "FFFFFF",
    cardBorder: "C8E6C9",
    muted:      "558B5A",
    text:       "1B2A1C",
    textLight:  "FFFFFF",
    accent2:    "FF8F00",
    chartGreen: "81C784",
    chartBlue:  "26C6DA",
  },
  "purple-ai": {
    name: "Purple AI",
    description: "Deep purple for AI/ML/data science projects",
    primary:    "6A1B9A",
    secondary:  "1A0A2E",
    accent:     "CE93D8",
    dark:       "0D0616",
    darkCard:   "1A0A2E",
    light:      "F8F0FF",
    lightCard:  "FFFFFF",
    cardBorder: "E1BEE7",
    muted:      "8E6EA6",
    text:       "1A0A2E",
    textLight:  "FFFFFF",
    accent2:    "FF6090",
    chartGreen: "4CAF50",
    chartBlue:  "7C4DFF",
  },
  "orange-food": {
    name: "Orange Culinary",
    description: "Warm orange for food/culinary/recipe projects",
    primary:    "C04000",
    secondary:  "2D1B14",
    accent:     "F5A623",
    dark:       "1A1210",
    darkCard:   "2D1B14",
    light:      "FFF8F0",
    lightCard:  "FFFFFF",
    cardBorder: "E8D5C4",
    muted:      "8B7355",
    text:       "2D1B14",
    textLight:  "FFFFFF",
    accent2:    "D4553A",
    chartGreen: "4CAF50",
    chartBlue:  "2196F3",
  },
  "red-enterprise": {
    name: "Red Enterprise",
    description: "Bold red for business/finance/management projects",
    primary:    "B71C1C",
    secondary:  "1A0A0A",
    accent:     "FF7043",
    dark:       "120606",
    darkCard:   "1A0A0A",
    light:      "FFF5F5",
    lightCard:  "FFFFFF",
    cardBorder: "FFCDD2",
    muted:      "8D4040",
    text:       "1A0A0A",
    textLight:  "FFFFFF",
    accent2:    "FFC107",
    chartGreen: "4CAF50",
    chartBlue:  "2196F3",
  },
  "teal-health": {
    name: "Teal Health",
    description: "Clean teal for medical/health/biotech projects",
    primary:    "00695C",
    secondary:  "0A1A18",
    accent:     "4DB6AC",
    dark:       "041110",
    darkCard:   "0A1A18",
    light:      "F0FAFA",
    lightCard:  "FFFFFF",
    cardBorder: "B2DFDB",
    muted:      "4A7A74",
    text:       "0A1A18",
    textLight:  "FFFFFF",
    accent2:    "FF7043",
    chartGreen: "66BB6A",
    chartBlue:  "42A5F5",
  },
  "dark-minimal": {
    name: "Dark Minimal",
    description: "Sleek dark theme for any modern project",
    primary:    "37474F",
    secondary:  "1C2326",
    accent:     "90A4AE",
    dark:       "0D1517",
    darkCard:   "1C2326",
    light:      "ECEFF1",
    lightCard:  "FFFFFF",
    cardBorder: "CFD8DC",
    muted:      "607D8B",
    text:       "1C2326",
    textLight:  "FFFFFF",
    accent2:    "FF8A65",
    chartGreen: "4CAF50",
    chartBlue:  "42A5F5",
  },
  "gold-education": {
    name: "Gold Education",
    description: "Prestigious gold for education/academic projects",
    primary:    "F57F17",
    secondary:  "1A1200",
    accent:     "FFD54F",
    dark:       "110C00",
    darkCard:   "1A1200",
    light:      "FFFDE7",
    lightCard:  "FFFFFF",
    cardBorder: "FFF9C4",
    muted:      "8D6E1A",
    text:       "1A1200",
    textLight:  "FFFFFF",
    accent2:    "EF5350",
    chartGreen: "66BB6A",
    chartBlue:  "42A5F5",
  }
};

// Keyword → theme mapping for auto-selection
const THEME_KEYWORDS = {
  "tech-blue":      ["software", "web", "app", "system", "network", "security", "cloud", "iot", "blockchain", "api", "database", "frontend", "backend", "fullstack", "devops"],
  "green-nature":   ["environment", "agriculture", "plant", "eco", "nature", "farming", "crop", "water", "solar", "sustainability", "green"],
  "purple-ai":      ["ai", "machine learning", "deep learning", "neural", "nlp", "computer vision", "data science", "llm", "gpt", "bert", "transformer", "prediction", "classification", "detection"],
  "orange-food":    ["food", "recipe", "culinary", "restaurant", "cooking", "nutrition", "diet", "meal", "chef", "cuisine"],
  "red-enterprise": ["business", "finance", "management", "erp", "crm", "inventory", "sales", "marketing", "e-commerce", "retail", "supply chain"],
  "teal-health":    ["health", "medical", "hospital", "patient", "clinical", "pharmacy", "doctor", "diagnostic", "biotech", "healthcare"],
  "gold-education": ["education", "learning", "student", "university", "college", "school", "course", "exam", "library", "knowledge", "e-learning"],
  "dark-minimal":   []  // fallback
};

/**
 * Auto-selects a theme based on the project title + description keywords.
 * Falls back to "tech-blue" if no match.
 */
function autoSelectTheme(title, description) {
  const combined = (title + " " + description).toLowerCase();
  let bestTheme = "tech-blue";
  let bestScore = 0;

  for (const [themeKey, keywords] of Object.entries(THEME_KEYWORDS)) {
    const score = keywords.filter(kw => combined.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestTheme = themeKey;
    }
  }
  return bestTheme;
}

module.exports = { COLOR_THEMES, autoSelectTheme };
