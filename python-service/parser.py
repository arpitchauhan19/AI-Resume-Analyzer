"""Resume parsing logic for the Python Resume Parser service.

This module is intentionally framework-agnostic: it knows nothing about FastAPI
and can be imported and unit-tested on its own. The public entry point is
:func:`parse_resume`, which takes raw PDF bytes and returns a structured
``dict`` matching the ``ParsedResume`` schema in ``models.py``.

Design notes
------------
* **PDF text extraction** is done with PyMuPDF (``fitz``).
* **Contact details** (email / phone) use plain regular expressions, which are
  far more reliable than NLP for these well-structured patterns.
* **Name detection** uses spaCy's ``PERSON`` named-entity recognition, with a
  heuristic fallback to the first non-empty line of the document.
* **Sections** (skills / education / experience / projects) are detected by
  scanning for common heading keywords and slicing the text between headings.

No external LLM APIs (OpenAI, Gemini, etc.) are used anywhere.
"""

from __future__ import annotations

import logging
import re
from typing import Dict, List, Optional

import fitz  # PyMuPDF

logger = logging.getLogger("resume_parser")

# ---------------------------------------------------------------------------
# spaCy model loading (lazy + cached)
# ---------------------------------------------------------------------------
# Loading the model is relatively expensive, so we load it once and reuse it.
# We do it lazily so that importing this module never crashes even if the model
# has not been downloaded yet (the error surfaces only when parsing is needed).

_NLP = None


def _get_nlp():
    """Return a cached spaCy pipeline, loading it on first use."""

    global _NLP
    if _NLP is None:
        try:
            import spacy

            _NLP = spacy.load("en_core_web_sm")
            logger.info("Loaded spaCy model 'en_core_web_sm'.")
        except Exception as exc:  # pragma: no cover - environment dependent
            raise RuntimeError(
                "spaCy model 'en_core_web_sm' is not available. Install it with:\n"
                "    python -m spacy download en_core_web_sm"
            ) from exc
    return _NLP


# ---------------------------------------------------------------------------
# Regex patterns and keyword dictionaries
# ---------------------------------------------------------------------------

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

# Matches common international / local phone formats, e.g.:
#   +1 (555) 123-4567, +91-98765-43210, 9876543210, (044) 2345 6789
PHONE_RE = re.compile(
    r"(?:(?:\+|00)\d{1,3}[\s.\-]?)?"      # optional country code
    r"(?:\(\d{1,4}\)[\s.\-]?)?"            # optional area code in parens
    r"\d{2,4}(?:[\s.\-]?\d{2,4}){1,4}"     # the main number groups
)

# Section headings we know how to recognise. Order does not matter; we detect
# any of these on a line and treat that line as a section boundary.
SECTION_KEYWORDS: Dict[str, List[str]] = {
    "skills": ["skills", "technical skills", "core competencies", "technologies"],
    "education": ["education", "academic", "qualification", "qualifications"],
    "experience": [
        "experience",
        "work experience",
        "professional experience",
        "employment",
        "work history",
    ],
    "projects": ["projects", "personal projects", "academic projects", "project work"],
}

# A curated skill dictionary used as a fallback / supplement to the free-text
# "Skills" section. This keeps results meaningful even for resumes that bury
# their skills inside prose instead of a dedicated section.
KNOWN_SKILLS: List[str] = [
    "python", "java", "javascript", "typescript", "c", "c++", "c#", "go", "rust",
    "ruby", "php", "swift", "kotlin", "scala", "r", "matlab", "sql", "nosql",
    "html", "css", "sass", "react", "redux", "next.js", "vue", "angular", "svelte",
    "node.js", "express", "fastapi", "flask", "django", "spring", "spring boot",
    "tensorflow", "pytorch", "keras", "scikit-learn", "pandas", "numpy", "spacy",
    "nltk", "opencv", "matplotlib", "mongodb", "postgresql", "mysql", "sqlite",
    "redis", "elasticsearch", "kafka", "rabbitmq", "docker", "kubernetes", "aws",
    "azure", "gcp", "git", "github", "gitlab", "ci/cd", "jenkins", "terraform",
    "linux", "bash", "graphql", "rest", "grpc", "machine learning", "deep learning",
    "nlp", "computer vision", "data science", "data analysis", "tableau", "power bi",
]


# ---------------------------------------------------------------------------
# Step 1: PDF -> text
# ---------------------------------------------------------------------------

def extract_text(pdf_bytes: bytes) -> str:
    """Extract the full plain text from a PDF given as raw bytes.

    Raises ``ValueError`` if the bytes do not represent a readable PDF.
    """

    if not pdf_bytes:
        raise ValueError("Empty file: no PDF bytes received.")

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError(f"Could not open file as PDF: {exc}") from exc

    try:
        pages_text = [page.get_text("text") for page in doc]
    finally:
        doc.close()

    text = "\n".join(pages_text).strip()
    if not text:
        raise ValueError(
            "No extractable text found. The PDF may be scanned/image-only "
            "(OCR is not supported by this service)."
        )
    return text


# ---------------------------------------------------------------------------
# Step 2: contact details (regex + spaCy)
# ---------------------------------------------------------------------------

def extract_email(text: str) -> Optional[str]:
    """Return the first email address found, or ``None``."""

    match = EMAIL_RE.search(text)
    return match.group(0) if match else None


def extract_phone(text: str) -> Optional[str]:
    """Return the first plausible phone number found, or ``None``.

    We require at least 8 digits in the matched span to avoid picking up
    things like years, zip codes or short numeric IDs.
    """

    for candidate in PHONE_RE.finditer(text):
        raw = candidate.group(0).strip()
        digits = re.sub(r"\D", "", raw)
        if 8 <= len(digits) <= 15:
            return re.sub(r"\s{2,}", " ", raw)
    return None


def extract_name(text: str) -> Optional[str]:
    """Best-effort full-name extraction.

    Strategy:
    1. Run spaCy NER on the first chunk of the document and return the first
       ``PERSON`` entity (names almost always appear near the top).
    2. Fall back to the first non-empty line that looks like a name
       (1-4 capitalized words, no digits / "@").
    """

    header = "\n".join(
        line.strip() for line in text.splitlines() if line.strip()
    )[:600]

    try:
        nlp = _get_nlp()
        doc = nlp(header)
        for ent in doc.ents:
            if ent.label_ == "PERSON":
                # An entity may span a line break (e.g. "Jane Doe\nSoftware");
                # keep only the first physical line and cap at 4 words.
                candidate = ent.text.split("\n", 1)[0].strip()
                if candidate and len(candidate.split()) <= 4:
                    return candidate
    except Exception as exc:  # pragma: no cover - model issues
        logger.warning("spaCy name detection failed, using fallback: %s", exc)

    for line in header.splitlines():
        words = line.split()
        if (
            1 <= len(words) <= 4
            and "@" not in line
            and not any(ch.isdigit() for ch in line)
            and all(w[0].isupper() for w in words if w)
        ):
            return line.strip()
    return None


# ---------------------------------------------------------------------------
# Step 3: section-based extraction
# ---------------------------------------------------------------------------

def _split_into_sections(text: str) -> Dict[str, str]:
    """Slice the resume text into sections keyed by canonical section name.

    A line is treated as a heading if, after stripping/lowercasing, it matches
    one of the keywords in :data:`SECTION_KEYWORDS` (and is short enough to be
    a heading rather than a sentence). Everything between two headings is the
    body of the first heading's section.
    """

    lines = text.splitlines()
    sections: Dict[str, List[str]] = {}
    current: Optional[str] = None

    def match_heading(line: str) -> Optional[str]:
        cleaned = re.sub(r"[^a-z ]", "", line.strip().lower()).strip()
        if not cleaned or len(cleaned.split()) > 4:
            return None
        for canonical, keywords in SECTION_KEYWORDS.items():
            if cleaned in keywords:
                return canonical
        return None

    for line in lines:
        heading = match_heading(line)
        if heading:
            current = heading
            sections.setdefault(current, [])
            continue
        if current is not None and line.strip():
            sections[current].append(line.strip())

    return {key: "\n".join(value).strip() for key, value in sections.items()}


def _clean_items(block: str) -> List[str]:
    """Turn a free-text section block into a list of clean line items."""

    items: List[str] = []
    for raw in block.splitlines():
        line = raw.strip(" \t-•*·●▪◦").strip()
        if line:
            items.append(line)
    return items


def extract_skills(text: str, sections: Dict[str, str]) -> List[str]:
    """Extract skills from the dedicated section plus a known-skills scan."""

    found: List[str] = []

    # 1. Parse the dedicated "Skills" section if present (comma/newline lists).
    skills_block = sections.get("skills", "")
    if skills_block:
        for chunk in re.split(r"[\n,;|•]", skills_block):
            token = chunk.strip(" \t-:·●▪◦").strip()
            if token and len(token) <= 40:
                found.append(token)

    # 2. Supplement with dictionary matches anywhere in the document.
    lowered = text.lower()
    for skill in KNOWN_SKILLS:
        pattern = r"(?<![a-zA-Z0-9+#.])" + re.escape(skill) + r"(?![a-zA-Z0-9+#.])"
        if re.search(pattern, lowered):
            found.append(skill)

    # Deduplicate case-insensitively while preserving order.
    seen = set()
    unique: List[str] = []
    for skill in found:
        key = skill.lower()
        if key not in seen:
            seen.add(key)
            unique.append(skill)
    return unique


def extract_section_items(sections: Dict[str, str], name: str) -> List[str]:
    """Return cleaned line items for a given canonical section name."""

    return _clean_items(sections.get(name, ""))


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def parse_resume(pdf_bytes: bytes) -> dict:
    """Parse a resume PDF (as bytes) into a structured dictionary.

    The returned dict matches the ``ParsedResume`` Pydantic model.
    """

    text = extract_text(pdf_bytes)
    sections = _split_into_sections(text)

    return {
        "contact": {
            "name": extract_name(text),
            "email": extract_email(text),
            "phone": extract_phone(text),
        },
        "skills": extract_skills(text, sections),
        "education": extract_section_items(sections, "education"),
        "experience": extract_section_items(sections, "experience"),
        "projects": extract_section_items(sections, "projects"),
        "full_text": text,
    }
