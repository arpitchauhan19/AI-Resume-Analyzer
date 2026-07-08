# AI Resume Analyzer

> Upload a resume, parse it into structured data, and score it against any job description with a built-in **ATS (Applicant Tracking System) engine** — no external LLM APIs required.

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white">
  <img alt="Express" src="https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white">
  <img alt="MongoDB" src="https://img.shields.io/badge/MongoDB-8-47A248?logo=mongodb&logoColor=white">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-blue">
</p>

**AI Resume Analyzer** is a production-style, microservice full-stack application that turns a raw resume PDF into actionable, recruiter-grade insights. A Python (FastAPI) microservice extracts structured data **on-device**, an Express backend orchestrates uploads and runs a purpose-built **ATS scoring engine**, and a modern React dashboard visualizes the results — score, skill match, completeness, matched/missing keywords, and concrete suggestions.

Built to demonstrate clean service boundaries, REST API design, deterministic NLP parsing, and real deployment — without depending on any paid LLM API.

---

## Table of Contents

- [🚀 Live Demo](#-live-demo)
- [🌟 Project Highlights](#-project-highlights)
- [✨ Features](#-features)
- [🧱 Tech Stack](#-tech-stack)
- [🏗️ Architecture](#️-architecture)
- [📸 Screenshots](#-screenshots)
- [⚙️ Installation](#️-installation)
- [📂 Repository Structure](#-repository-structure)
- [🔌 API Endpoints](#-api-endpoints)
- [🔐 Environment Variables](#-environment-variables)
- [🛣️ Future Improvements](#️-future-improvements)
- [📄 License](#-license)

---

## 🚀 Live Demo

| Service      | Live URL                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------- |
| 🖥️ Frontend  | [ai-resume-frontend-fv7v.onrender.com](https://ai-resume-frontend-fv7v.onrender.com)         |
| ⚙️ Backend   | [ai-resume-backend-m3tv.onrender.com](https://ai-resume-backend-m3tv.onrender.com)           |
| 🧠 Parser    | [ai-resume-parser-fhdr.onrender.com](https://ai-resume-parser-fhdr.onrender.com)             |

> [!NOTE]
> The backend and parser are hosted on Render's free tier and may take **~30–60 seconds to wake** from cold start on the first request. Subsequent requests are fast.

---

## 🌟 Project Highlights

- 🧩 **Microservice architecture** — three independently deployable services with clean HTTP boundaries.
- ⚛️ **React + Express + FastAPI** — a polyglot stack combining a modern SPA, a Node REST API, and a Python NLP service.
- 📄 **Resume parsing** — deterministic PDF extraction with PyMuPDF + spaCy + regex (no LLM, fully on-device).
- 🎯 **ATS keyword analysis** — synonym-aware normalization, false-positive-safe matching, and a transparent 0–100 score.
- 🔗 **REST APIs** — well-structured endpoints for upload, parsing, and analysis.
- ☁️ **Render deployment** — all three services deployed and wired together in production.

---

## ✨ Features

| Feature                       | Description                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| 📤 **Resume Upload**          | Drag-and-drop / file-picker upload of a resume PDF from the React UI.                         |
| 📄 **PDF Resume Parsing**     | Extracts contact details, skills, education, experience, and projects (PyMuPDF + spaCy + regex). |
| 🎯 **ATS Score Analysis**     | Computes a real **0–100 ATS score** for a resume against a given job description.             |
| 🧠 **Skill Match**            | Measures how many JD keywords are explicitly backed by your resume's skills.                  |
| ✅ **Resume Completeness**    | Flags missing standard sections (name, email, phone, skills, education, experience, projects). |
| 🔎 **Missing Keyword Detection** | Surfaces exactly which job keywords your resume is missing.                                |
| 💡 **Keyword Suggestions**    | Generates human-readable tips to close gaps before applying.                                 |
| 🐍 **FastAPI Parser**         | Dedicated Python microservice for fast, deterministic PDF parsing.                            |
| 🔌 **Express REST API**       | Node/Express backend orchestrating uploads, parsing, and ATS scoring.                         |
| ⚛️ **Modern React UI**        | Animated score ring, progress bars, keyword tags, light/dark theming.                        |
| 📱 **Responsive Design**      | Works cleanly across desktop, tablet, and mobile viewports.                                   |

---

## 🧱 Tech Stack

### Frontend
- **React 19** + **Vite 8**
- **React Router 7** for routing
- **Axios** for API calls
- Hand-rolled CSS design system (no UI framework) with light/dark theming

### Backend (API + ATS Engine)
- **Node.js** + **Express 4**
- **Multer** for file uploads
- **Axios + form-data** to forward files to the parser
- **Helmet**, **CORS**, **Morgan** for security & logging

### Parser
- **Python 3.9+** + **FastAPI** + **Uvicorn**
- **PyMuPDF** for PDF text extraction
- **spaCy** (`en_core_web_sm`) for NLP / name detection
- **Pydantic** for schema validation

### Database
- **MongoDB** + **Mongoose** for upload metadata (optional / best-effort — the backend runs fine without it)

### Deployment
- **Render** — separate services for frontend (static site), backend (web service), and parser (web service)
- Environment-driven configuration with production-safe validation (no hardcoded localhost)

---

## 🏗️ Architecture

The system is split into three independently runnable services and flows in one direction from a raw PDF to an actionable dashboard:

```
              Resume PDF
                  │
                  ▼
           React Frontend            (Vite SPA · upload + dashboard)
                  │  POST /api/upload
                  ▼
           Express Backend           (REST API · orchestration)
                  │  forward file → POST /parse
                  ▼
        FastAPI Resume Parser        (PyMuPDF + spaCy + regex)
                  │
                  ▼
       Structured Resume JSON        (contact, skills, education, ...)
                  │  POST /api/ats/analyze
                  ▼
             ATS Engine              (keyword match · skill match · scoring)
                  │
                  ▼
              Dashboard              (score, matched/missing keywords, tips)
```

> [!TIP]
> Upload metadata is persisted to **MongoDB** on a best-effort basis. If the database is unavailable, parsing and ATS analysis still work — persistence is simply skipped.

**Request flow:**

1. The user uploads a resume PDF in the React app → `POST /api/upload`.
2. Express stores upload metadata (if MongoDB is available) and forwards the file to the Python parser's `POST /parse`.
3. The parser returns structured resume JSON, which Express relays back to the frontend dashboard.
4. On the dashboard, the user pastes a **job description** → `POST /api/ats/analyze`.
5. The Express **ATS engine** scores the parsed resume against the job description and returns the score, matched/missing keywords, completeness, and suggestions.

> The ATS engine (`backend/src/services/atsService.js`) is pure, dependency-free, and modular — keyword extraction, normalization, matching, skill match, completeness, scoring, and suggestions are each isolated, testable functions.

---

## 📸 Screenshots

| Landing Page | Upload Flow |
| --- | --- |
| ![Landing page](docs/screenshots/landing.png) | ![Upload resume](docs/screenshots/upload.png) |

| Dashboard — Parsed Insights | ATS Match — Score & Keywords |
| --- | --- |
| ![Dashboard](docs/screenshots/dashboard.png) | ![ATS match results](docs/screenshots/ats-match.png) |

---

## ⚙️ Installation

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+
- **MongoDB** (optional — the backend runs without it; upload metadata persistence is skipped if unavailable)

Clone the repository:

```bash
git clone https://github.com/<your-username>/AI-Resume-Analyzer.git
cd AI-Resume-Analyzer
```

You'll run **three** services. Open three terminals (one per service).

### 1. Python Parser

```bash
cd python-service

# Create & activate a virtual environment
python -m venv venv
# Windows (PowerShell)
venv\Scripts\Activate.ps1
# macOS / Linux
# source venv/bin/activate

pip install -r requirements.txt

# One-time: download the spaCy English model
python -m spacy download en_core_web_sm

# Run on http://localhost:8000
uvicorn app:app --reload --port 8000
```

### 2. Express Backend

```bash
cd backend

npm install

# Configure environment
cp .env.example .env   # Windows: copy .env.example .env

# Run on http://localhost:5000
npm run dev
```

### 3. React Frontend

```bash
cd frontend

npm install

# Configure environment (optional in dev; required for production builds)
cp .env.example .env   # Windows: copy .env.example .env

# Run the Vite dev server on http://localhost:5173
npm run dev
```

Then open **http://localhost:5173** in your browser.

---

## 📂 Repository Structure

```
AI-Resume-Analyzer/
│
├── frontend/              # React + Vite client (pages, components, lib/api.js, hooks, styles)
├── backend/              # Express API + ATS engine (server.js, app.js, config, controllers,
│                          #   services/atsService.js, routes, middleware, models)
├── python-service/       # FastAPI resume parser (app.py, parser.py, models.py, requirements.txt)
├── docs/screenshots/     # README screenshots (landing, upload, dashboard, ats-match)
└── README.md             # You are here
```

<details>
<summary>Expand for the detailed per-service layout</summary>

```
AI-Resume-Analyzer/
│
├── frontend/                     # React + Vite client
│   └── src/
│       ├── pages/                # LandingPage, UploadResume, LoadingAnalysis, Dashboard
│       ├── components/           # Card, StatCard, CircularScore, ProgressBar, icons, ...
│       ├── lib/api.js            # Axios client (uploadResume, analyzeAts, getErrorMessage)
│       ├── hooks/                # useTheme
│       └── styles/               # Design-system CSS (global, ui, Dashboard, ...)
│
├── backend/                      # Express API + ATS engine
│   └── src/
│       ├── server.js             # HTTP server bootstrap
│       ├── app.js                # Express app, middleware, route mounting
│       ├── config/               # env.js, db.js
│       ├── controllers/          # healthController, uploadController, atsController
│       ├── services/             # uploadService, parserService, atsService  ← ATS engine
│       ├── routes/               # health, upload, ats route definitions
│       ├── middleware/           # multer upload, ApiError, errorHandler, notFound
│       └── models/               # Upload (Mongoose schema)
│
└── python-service/               # FastAPI resume parser microservice
    ├── app.py                    # FastAPI app + POST /parse route
    ├── parser.py                 # Core extraction logic (PyMuPDF + spaCy + regex)
    ├── models.py                 # Pydantic schemas
    └── requirements.txt          # Pinned Python dependencies
```

</details>

---

## 🔌 API Endpoints

### Express Backend (`http://localhost:5000`)

| Method | Endpoint            | Description                                                                 |
| ------ | ------------------- | --------------------------------------------------------------------------- |
| `GET`  | `/api/health`       | Liveness probe → `{ "status": "ok" }`                                       |
| `POST` | `/api/upload`       | Upload a resume PDF (multipart field `resume`); returns parsed resume JSON   |
| `POST` | `/api/ats/analyze`  | Score a parsed resume against a job description (ATS engine)                 |

**`POST /api/ats/analyze`**

Request body:

```json
{
  "resume": { "contact": { "...": "..." }, "skills": ["..."], "...": "..." },
  "jobDescription": "Backend engineer with Node.js, Express, PostgreSQL, Docker..."
}
```

Response:

```json
{
  "success": true,
  "atsScore": 72,
  "skillMatch": 60,
  "matchedKeywords": ["node", "express", "restapi"],
  "missingKeywords": ["postgresql", "docker", "aws"],
  "resumeCompleteness": 86,
  "suggestions": ["Incorporate these job-description keywords: postgresql, docker, aws.", "..."]
}
```

### Python Parser Service (`http://localhost:8000`)

| Method | Endpoint   | Description                                                   |
| ------ | ---------- | ------------------------------------------------------------- |
| `GET`  | `/`        | Service metadata                                              |
| `GET`  | `/health`  | Liveness probe → `{ "status": "healthy" }`                    |
| `POST` | `/parse`   | Accept a PDF (multipart field `file`); return structured JSON |
| `GET`  | `/docs`    | Interactive Swagger UI                                        |

---

## 🔐 Environment Variables

Backend (`backend/.env` — see `backend/.env.example`):

| Variable             | Default (development only)                       | Description                                   |
| -------------------- | ------------------------------------------------ | --------------------------------------------- |
| `PORT`               | `5000`                                           | Port the Express server listens on            |
| `NODE_ENV`           | `development`                                    | `development` \| `production`                 |
| `MONGODB_URI`        | `mongodb://127.0.0.1:27017/ai-resume-analyzer`   | MongoDB connection string (optional/best-effort) |
| `CORS_ORIGIN`        | `http://localhost:5173`                          | Comma-separated allowed origins — **required in production** |
| `MAX_UPLOAD_SIZE`    | `5242880` (5 MB)                                 | Max upload size in bytes                       |
| `UPLOAD_DIR`         | `src/uploads`                                    | Where uploaded files are stored                |
| `PARSER_SERVICE_URL` | `http://localhost:8000`                          | Base URL of the Python parser service — **required in production** |
| `PARSER_TIMEOUT_MS`  | `30000`                                          | Timeout for parser requests (ms); positive number |

Frontend (`frontend/.env` — see `frontend/.env.example`):

| Variable        | Default (development only) | Description                                              |
| --------------- | -------------------------- | -------------------------------------------------------- |
| `VITE_API_URL`  | `http://localhost:5000`    | Base URL of the Express API — **required for production builds** |

### Production deployment

The localhost defaults above exist purely for local development. They are
**not** used when the services run in production:

- **Backend** — when `NODE_ENV=production`, the server validates its config on
  startup and **refuses to boot** with a clear error unless `PARSER_SERVICE_URL`
  and `CORS_ORIGIN` are set explicitly. This stops a deployed backend from
  silently calling `localhost` services that don't exist.
- **Frontend** — Vite inlines `VITE_API_URL` at **build time**, so it must be
  provided before `npm run build` (e.g. `VITE_API_URL=https://api.example.com npm run build`).
  A production build with `VITE_API_URL` unset fails loudly at runtime instead
  of shipping a bundle hard-coded to `http://localhost:5000`.

---

## 🛣️ Future Improvements

- **OCR support** for scanned / image-only PDFs (e.g. Tesseract).
- **DOCX parsing** in addition to PDF.
- **Semantic matching** using embeddings so synonyms and related skills count toward the score (not just exact keywords).
- **Multi-resume comparison** and history powered by the existing MongoDB layer.
- **Authentication & user accounts** to save analyses over time.
- **Exportable reports** (PDF/JSON) of the ATS analysis.
- **Unit & integration test suites** across all three services + CI pipeline.
- **Dockerized deployment** with `docker-compose` for one-command startup.
- **Configurable scoring weights** and an extensible skills dictionary via the UI.

---

## 📄 License

This project is licensed under the **MIT License** — you are free to use, modify, and distribute it with attribution.

---

<p align="center">
  <sub>Built with ⚛️ React, ⚙️ Express, and 🐍 FastAPI — deployed on Render.</sub>
</p>
