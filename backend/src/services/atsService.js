/**
 * ATS (Applicant Tracking System) Engine.
 *
 * Pure, dependency-free scoring logic that compares a *parsed resume* (the
 * structured JSON produced by the Python FastAPI parser) against a free-text
 * *job description* and reports how well the resume would perform against a
 * keyword-driven ATS.
 *
 * The module is intentionally side-effect free: every helper is a small, pure
 * function so the pieces can be unit-tested in isolation and recombined. The
 * single public entry point is {@link analyzeResume}.
 *
 * Parsed resume shape (from the parser service):
 *   {
 *     contact:    { name, email, phone },
 *     skills:     string[],
 *     education:  string[],
 *     experience: string[],
 *     projects:   string[],
 *     full_text:  string
 *   }
 */

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/**
 * Relative contribution of each signal to the final ATS score. Must sum to 1.
 * - keywordMatch: how many JD keywords appear anywhere in the resume.
 * - skillMatch:   how many JD keywords are backed by an explicit resume skill.
 * - completeness: whether the resume has all the sections ATS parsers expect.
 */
const SCORE_WEIGHTS = {
  keywordMatch: 0.45,
  skillMatch: 0.35,
  completeness: 0.2,
};

/**
 * Very common English words (plus generic job-posting filler) that carry no
 * signal as ATS keywords. Kept small and focused rather than exhaustive.
 */
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "for", "of",
  "to", "in", "on", "at", "by", "with", "from", "as", "is", "are", "was",
  "were", "be", "been", "being", "this", "that", "these", "those", "it",
  "its", "we", "you", "your", "our", "they", "their", "he", "she", "his",
  "her", "i", "me", "my", "us", "will", "shall", "can", "could", "would",
  "should", "may", "might", "must", "do", "does", "did", "have", "has",
  "had", "not", "no", "yes", "so", "than", "too", "very", "just", "into",
  "over", "under", "about", "more", "most", "some", "any", "all", "each",
  "who", "whom", "which", "what", "when", "where", "why", "how", "up",
  "down", "out", "off", "again", "once", "here", "there", "such", "only",
  "own", "same", "other", "while", "during", "per", "via",
  // Generic job-posting filler that would otherwise dominate keyword lists.
  "experience", "experiences", "work", "working", "role", "responsibilities",
  "responsibility", "requirements", "required", "preferred", "ability",
  "able", "team", "teams", "company", "candidate", "candidates", "job",
  "position", "looking", "join", "including", "etc", "years", "year",
  "strong", "good", "excellent", "knowledge", "skills", "skill", "plus",
]);

// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------

/**
 * Lowercase + strip surrounding punctuation/whitespace from a token-ish string.
 * Keeps internal characters that are meaningful to tech terms (`.`, `+`, `#`,
 * `-`) so things like `node.js`, `c++`, `c#` and `ci-cd` survive.
 *
 * @param {string} value
 * @returns {string}
 */
function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    // Drop any leading/trailing chars that aren't alphanumeric or a tech symbol.
    .replace(/^[^a-z0-9.+#-]+|[^a-z0-9.+#-]+$/g, "")
    // Then strip leading/trailing sentence punctuation (`.` / `-`) that would
    // otherwise survive (e.g. "experience." -> "experience"), while keeping
    // meaningful trailing symbols like in "c++" and "c#" and mid-token dots
    // like "node.js".
    .replace(/^[.-]+|[.-]+$/g, "");
}

// ---------------------------------------------------------------------------
// Synonym / canonicalization layer
// ---------------------------------------------------------------------------

/**
 * Ordered canonicalization rules. Each rule rewrites a family of equivalent
 * skill spellings — differing only by case, punctuation, spacing, a common
 * abbreviation, or an "s" plural — into ONE canonical token consisting solely
 * of `[a-z0-9]`. Downstream, tokenization and {@link containsKeyword} then
 * treat every variant as the same term, without any change to the scoring.
 *
 * Order matters: multi-word and dotted-suffix forms are collapsed BEFORE the
 * bare abbreviations, so e.g. "node.js" is resolved before a standalone "js"
 * rule could ever see it.
 *
 * False positives are avoided in two ways:
 * 1. Word boundaries (`\b`) and explicit look-arounds keep a rule from firing
 *    inside an unrelated word (e.g. the standalone "js"/"ts" rules never touch
 *    the ".js" of "vue.js", and never match inside "artifacts").
 * 2. No blanket transformations are applied: only the enumerated variants are
 *    rewritten. In particular nothing maps "java", so "java" and "javascript"
 *    stay distinct tokens and never match each other.
 */
const CANONICAL_RULES = [
  // --- Multi-word terms -> single canonical token (also folds the "s" plural).
  [/\brest(?:ful)?\s*api(?:s)?\b/gi, " restapi "], // REST API / REST APIs / RESTful API
  [/\bmongo\s*db\b/gi, " mongodb "], //              Mongo DB / MongoDB
  [/\bmachine\s*learning\b/gi, " ml "], //           Machine Learning / ML
  [/\bartificial\s*intelligence\b/gi, " ai "], //    Artificial Intelligence / AI
  [/\bc\s*sharp\b/gi, " csharp "], //                C Sharp / CSharp

  // --- Punctuation-bearing language names.
  [/\bc\s*\+\+/gi, " cpp "], //                      C++ / CPP (bare "cpp" already canonical)
  [/\bc#/gi, " csharp "], //                         C#

  // --- ".js"/"js" framework suffixes -> the bare framework name.
  [/\breact(?:\.js|js)\b/gi, " react "], //          React.js / Reactjs -> react
  [/\bnode(?:\.js|js)\b/gi, " node "], //            Node.js / Nodejs   -> node
  [/\bexpress(?:\.js|js)\b/gi, " express "], //      Express.js / Expressjs -> express

  // --- Standalone abbreviations ONLY (never the ".js" suffix of another word).
  [/(?<![a-z0-9.#+])js(?![a-z0-9.#+])/gi, " javascript "], // JS -> javascript
  [/(?<![a-z0-9.#+])ts(?![a-z0-9.#+])/gi, " typescript "], // TS -> typescript
];

/**
 * Apply the {@link CANONICAL_RULES} to a text blob. Lower-cases the input
 * (case-insensitive matching) and returns a string in which every recognised
 * skill variant has been replaced by its canonical, punctuation-free token.
 *
 * This is the single "synonym layer" applied to BOTH sides of every comparison
 * (job-description keywords and resume text/skills), which is what makes the
 * matching case-, punctuation- and (where appropriate) plural-insensitive.
 *
 * @param {string} text
 * @returns {string}
 */
function canonicalize(text) {
  let out = String(text || "").toLowerCase();
  for (const [pattern, replacement] of CANONICAL_RULES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * Split arbitrary text into a list of normalized, meaningful tokens.
 * Drops stopwords, pure numbers and very short noise tokens.
 *
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  // Canonicalize variants (React.js -> react, REST APIs -> restapi, JS ->
  // javascript, ...) BEFORE splitting so keyword extraction/matching operates
  // on canonical tokens. `canonicalize` also lower-cases the text.
  return canonicalize(text)
    // Split on anything that isn't a "word" character or a tech-term symbol.
    .split(/[^a-z0-9.+#-]+/)
    .map(normalize)
    .filter((token) => {
      if (token.length < 2) return false; // drop single chars / empties
      if (STOPWORDS.has(token)) return false;
      if (/^\d+$/.test(token)) return false; // drop bare numbers
      return true;
    });
}

/**
 * Flatten the parsed resume into one normalized text blob used for "does this
 * keyword appear anywhere in the resume" checks. Falls back to `full_text` and
 * also folds in every structured section so matching works even when the
 * parser did not provide raw text.
 *
 * @param {object} resume
 * @returns {string}
 */
function buildResumeText(resume) {
  const { contact = {}, skills = [], education = [], experience = [], projects = [], full_text = "" } = resume || {};

  const parts = [
    full_text,
    contact.name,
    contact.email,
    contact.phone,
    ...arr(skills),
    ...arr(education),
    ...arr(experience),
    ...arr(projects),
  ];

  // Canonicalize the whole resume blob so canonical JD keywords (e.g. "react",
  // "restapi") match their variant spellings in the resume. `canonicalize`
  // also lower-cases the text.
  return canonicalize(parts.filter(Boolean).join(" "));
}

/** Coerce a value into an array of strings (defensive against bad input). */
function arr(value) {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (value == null) return [];
  return [String(value)];
}

// ---------------------------------------------------------------------------
// Keyword extraction & matching
// ---------------------------------------------------------------------------

/**
 * Extract a ranked, de-duplicated list of keywords from a job description.
 * Keywords are ordered by frequency (most-emphasized terms first) so callers
 * can surface the most important misses, then trimmed to `limit`.
 *
 * @param {string} jobDescription
 * @param {number} [limit=40]
 * @returns {string[]}
 */
function extractKeywords(jobDescription, limit = 40) {
  const counts = new Map();
  for (const token of tokenize(jobDescription)) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

/**
 * Determine whether a keyword is present in a text blob, tolerating word
 * boundaries so `java` does not match inside `javascript`. Regex special
 * characters in the keyword are escaped first.
 *
 * @param {string} keyword - already normalized
 * @param {string} haystack - lowercased text
 * @returns {boolean}
 */
function containsKeyword(keyword, haystack) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // \b is unreliable around symbols like + or #, so anchor on non-word chars
  // (or string boundaries) ourselves.
  const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
  return pattern.test(haystack);
}

/**
 * Partition JD keywords into those found in the resume vs. those missing.
 *
 * @param {string[]} keywords
 * @param {string} resumeText
 * @returns {{ matched: string[], missing: string[] }}
 */
function matchKeywords(keywords, resumeText) {
  const matched = [];
  const missing = [];
  for (const keyword of keywords) {
    if (containsKeyword(keyword, resumeText)) matched.push(keyword);
    else missing.push(keyword);
  }
  return { matched, missing };
}

/**
 * Compute the skill-match percentage: of the JD keywords, how many are backed
 * by an *explicit* entry in the resume's `skills` array (a stronger signal than
 * appearing somewhere in prose).
 *
 * @param {string[]} resumeSkills
 * @param {string[]} keywords
 * @returns {{ percent: number, matched: string[], missing: string[] }}
 */
function computeSkillMatch(resumeSkills, keywords) {
  // Canonicalize the explicit skills blob with the same synonym layer so, e.g.,
  // a resume skill "React.js" satisfies a JD keyword "react".
  const skillBlob = canonicalize(arr(resumeSkills).map(normalize).join(" "));
  const matched = [];
  const missing = [];

  for (const keyword of keywords) {
    if (skillBlob && containsKeyword(keyword, skillBlob)) matched.push(keyword);
    else missing.push(keyword);
  }

  const percent = keywords.length
    ? Math.round((matched.length / keywords.length) * 100)
    : 0;

  return { percent, matched, missing };
}

// ---------------------------------------------------------------------------
// Completeness
// ---------------------------------------------------------------------------

/**
 * Score how "complete" the resume is from an ATS standpoint. Each expected
 * section contributes equally; ATS parsers reward resumes that clearly expose
 * contact details and standard sections.
 *
 * @param {object} resume
 * @returns {{ percent: number, sections: Record<string, boolean>, missing: string[] }}
 */
function computeResumeCompleteness(resume) {
  const { contact = {}, skills = [], education = [], experience = [], projects = [] } = resume || {};

  const sections = {
    name: Boolean(contact.name && String(contact.name).trim()),
    email: Boolean(contact.email && String(contact.email).trim()),
    phone: Boolean(contact.phone && String(contact.phone).trim()),
    skills: arr(skills).length > 0,
    education: arr(education).length > 0,
    experience: arr(experience).length > 0,
    projects: arr(projects).length > 0,
  };

  const keys = Object.keys(sections);
  const present = keys.filter((k) => sections[k]).length;
  const percent = Math.round((present / keys.length) * 100);
  const missing = keys.filter((k) => !sections[k]);

  return { percent, sections, missing };
}

// ---------------------------------------------------------------------------
// Scoring & suggestions
// ---------------------------------------------------------------------------

/**
 * Blend the individual signals into a single 0-100 ATS score using
 * {@link SCORE_WEIGHTS}.
 *
 * @param {object} parts
 * @param {number} parts.keywordMatchPercent
 * @param {number} parts.skillMatchPercent
 * @param {number} parts.completenessPercent
 * @returns {number} Integer 0-100.
 */
function computeAtsScore({ keywordMatchPercent, skillMatchPercent, completenessPercent }) {
  const raw =
    keywordMatchPercent * SCORE_WEIGHTS.keywordMatch +
    skillMatchPercent * SCORE_WEIGHTS.skillMatch +
    completenessPercent * SCORE_WEIGHTS.completeness;

  return clamp(Math.round(raw), 0, 100);
}

/** Clamp a number into the inclusive [min, max] range. */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Produce human-readable, actionable suggestions based on the computed gaps.
 *
 * @param {object} ctx
 * @param {number} ctx.atsScore
 * @param {number} ctx.skillMatchPercent
 * @param {string[]} ctx.missingKeywords
 * @param {{ missing: string[] }} ctx.completeness
 * @returns {string[]}
 */
function generateSuggestions({ atsScore, skillMatchPercent, missingKeywords, completeness }) {
  const suggestions = [];

  // Section completeness gaps map to specific, friendly advice.
  const sectionAdvice = {
    name: "Add your full name to the contact section so the ATS can identify you.",
    email: "Include a professional email address in your contact details.",
    phone: "Add a phone number so recruiters can reach you.",
    skills: "Add a dedicated Skills section listing your core technologies.",
    education: "Include an Education section with your degree(s) and institution(s).",
    experience: "Add a Work Experience section detailing your roles and impact.",
    projects: "Showcase relevant projects to strengthen your profile.",
  };
  for (const section of completeness.missing) {
    if (sectionAdvice[section]) suggestions.push(sectionAdvice[section]);
  }

  // Missing keywords: surface the highest-priority ones (already frequency-sorted).
  if (missingKeywords.length) {
    const top = missingKeywords.slice(0, 8).join(", ");
    suggestions.push(
      `Incorporate these job-description keywords where you genuinely have the experience: ${top}.`
    );
  }

  if (skillMatchPercent < 50) {
    suggestions.push(
      "Your explicit skills cover less than half of the role's keywords. Align your Skills section with the job description's required technologies."
    );
  }

  if (atsScore >= 80) {
    suggestions.push("Strong match. Tailor the summary to the role for an extra edge.");
  } else if (atsScore >= 60) {
    suggestions.push("Decent match. Closing the keyword gaps above should push your score higher.");
  } else {
    suggestions.push("Significant gaps detected. Prioritize the missing keywords and sections above before applying.");
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze a parsed resume against a job description and return ATS metrics.
 *
 * @param {object} resume - Parsed resume JSON (see module header for shape).
 * @param {string} jobDescription - Raw job description text.
 * @returns {{
 *   atsScore: number,
 *   skillMatch: number,
 *   matchedKeywords: string[],
 *   missingKeywords: string[],
 *   resumeCompleteness: number,
 *   suggestions: string[]
 * }}
 */
function analyzeResume(resume, jobDescription) {
  const safeResume = resume && typeof resume === "object" ? resume : {};

  // 1. Pull the keywords that define the role.
  const keywords = extractKeywords(jobDescription);

  // 2. Keyword presence anywhere in the resume.
  const resumeText = buildResumeText(safeResume);
  const { matched: matchedKeywords, missing: missingKeywords } = matchKeywords(keywords, resumeText);
  const keywordMatchPercent = keywords.length
    ? Math.round((matchedKeywords.length / keywords.length) * 100)
    : 0;

  // 3. Stronger signal: keywords explicitly listed as skills.
  const skill = computeSkillMatch(safeResume.skills, keywords);

  // 4. Structural completeness of the resume.
  const completeness = computeResumeCompleteness(safeResume);

  // 5. Blend into a single score.
  const atsScore = computeAtsScore({
    keywordMatchPercent,
    skillMatchPercent: skill.percent,
    completenessPercent: completeness.percent,
  });

  // 6. Turn gaps into advice.
  const suggestions = generateSuggestions({
    atsScore,
    skillMatchPercent: skill.percent,
    missingKeywords,
    completeness,
  });

  return {
    atsScore,
    skillMatch: skill.percent,
    matchedKeywords,
    missingKeywords,
    resumeCompleteness: completeness.percent,
    suggestions,
  };
}

module.exports = {
  analyzeResume,
  // Exposed for unit testing / reuse; not required by callers.
  extractKeywords,
  matchKeywords,
  computeSkillMatch,
  computeResumeCompleteness,
  computeAtsScore,
  generateSuggestions,
  tokenize,
  normalize,
  canonicalize,
};
