# Flight Operations Training Management Dashboard - PRD

## Original Problem Statement
Dashboard jadwal praktik terbang siswa. Database: Instruktur, Siswa, Pesawat, Stage (PPL/CPL/IR/FIC/ME), Pesawat Diasuransikan.
Operating Certificate 91-026 PPI Curug.

## Architecture
- Frontend: React + Tailwind + Shadcn UI (port 3000)
- Backend: FastAPI + MongoDB (port 8001)
- Object Storage: Emergent Object Storage (for profile photos & e-books)
- Notifications: Gmail SMTP (pending credentials) + WhatsApp wa.me links

## User Personas
1. Admin - Full CRUD, delete, import/export, manage all, site settings
2. Instructor - Create/edit schedules, add flight notes, mark student progress
3. Student - View schedules, view own progress and notes

## Key Design Decisions
- **Schedule Board uses Callsign** as primary student identifier, full name only for reports
- **Instructor identified by Callsign** in schedules
- Both student_callsign and student_name stored in schedule entries for reporting

## Implemented Features

### Core (Phase 1 - Complete)
- [x] JWT Auth with role-based access (admin/instructor/student)
- [x] Schedule Board (spreadsheet-style grid, Morning/Afternoon/Night sessions, 11 periods)
- [x] CRUD: Instructors, Students, Aircraft, Stages, Courses, Schedules
- [x] Import CSV/Excel + Export Excel (now includes student_callsign column)
- [x] License/Medical Expiry Notifications (30 days)
- [x] WhatsApp Share - Generate wa.me links per scheduled person

### Phase 2 Features (Complete)
- [x] Flight Notes - rating (Above Average/Average/Below Average/Unsatisfactory), stage type (Dual Visual, Solo Visual, etc.)
- [x] Announcements - Priority (normal/important/urgent) + target audience
- [x] Student Progress Tracker - Visual completion per stage with sub-stages
- [x] Stages with detailed sub-stages (PPL:52, CPL:85, IR:33, FIC:23, ME:12)
- [x] Courses for student grouping (PNB 8, PNB 9, PNB 10, etc.)

### Phase 3 Features (Complete - April 8, 2026)
- [x] **Schedule Board: Student Callsign as primary input** (nama lengkap hanya untuk laporan)
- [x] **Dropdown Remarks** with 28 specific codes grouped by category (OK, 1.x-6.x)
- [x] **Student dropdown grouped by Course/Kelas**
- [x] **Block Off/Block On** time inputs with auto-duration calculation
- [x] **Auto-progress update** when schedule remark = "OK"
- [x] **Instructor fields**: CFI Expiry, LOA Status/Expiry, Medical Expiry, Email, Duty Hours
- [x] **Student fields**: Callsign, License Owned, Medical Expiry, Email
- [x] **E-Learning page**: Upload/view e-books filtered by stage (PPL/CPL/IR/FIC/ME)
- [x] **Recap & OER page**: Monthly recap and Operational Effective Rate per aircraft
- [x] **Site Settings**: Customizable title and subtitle
- [x] **Profile photo upload** endpoint (Emergent Object Storage)
- [x] **Bulk user creation** from CSV/Excel
- [x] **Holiday management** for OER calculations

## Testing
- Iteration 3: Backend 100% (14/14), Frontend 100%
- Schedule board input bug: FIXED
- Student callsign integration: VERIFIED

## Backlog

### P1 (Next)
- Profile photo UI in Instructor/Student pages (upload button with 1:1 aspect ratio preview)
- App logo upload and display in sidebar
- Dashboard: move Announcements to top like a thread
- Email notification for Announcements (Emergent Google Auth)

### P2
- Mobile sidebar hamburger menu
- Print-friendly schedule view, PDF export
- Instructor workload analytics
- Real-time updates (WebSocket)
