-- Success Rates Database Schema

-- Faculties (PEF, AF, etc.)
CREATE TABLE IF NOT EXISTS faculties (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  last_scraped TEXT
);

-- Semesters (LS 2024/2025, etc.)
CREATE TABLE IF NOT EXISTS semesters (
  id INTEGER PRIMARY KEY,
  faculty_id INTEGER REFERENCES faculties(id),
  name TEXT NOT NULL,
  year INTEGER,
  last_scraped TEXT
);

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  predmet_id TEXT,
  last_scraped TEXT
);

-- Success Rates (one row per course-semester-term combination)
CREATE TABLE IF NOT EXISTS success_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER REFERENCES courses(id),
  semester_id INTEGER REFERENCES semesters(id),
  term_name TEXT,
  grade_a INTEGER DEFAULT 0,
  grade_b INTEGER DEFAULT 0,
  grade_c INTEGER DEFAULT 0,
  grade_d INTEGER DEFAULT 0,
  grade_e INTEGER DEFAULT 0,
  grade_f INTEGER DEFAULT 0,
  grade_fn INTEGER DEFAULT 0,
  source_url TEXT,
  scraped_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code);
CREATE INDEX IF NOT EXISTS idx_success_rates_course ON success_rates(course_id);
CREATE INDEX IF NOT EXISTS idx_success_rates_semester ON success_rates(semester_id);
