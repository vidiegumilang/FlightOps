from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Header, Query
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os, logging, io, json, uuid, requests as http_requests
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import bcrypt, jwt
import pandas as pd
from openpyxl import Workbook

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")
JWT_ALGORITHM = "HS256"

# ─── Object Storage ───
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "flight-ops"
storage_key = None

def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = http_requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = http_requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    resp = http_requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# ─── Predefined Data ───
DEFAULT_PERIODS = [
    {"number": 1, "label": "1st Period", "start": "01:00", "end": "02:00", "session": "morning"},
    {"number": 2, "label": "2nd Period", "start": "02:30", "end": "03:30", "session": "morning"},
    {"number": 3, "label": "3rd Period", "start": "04:00", "end": "05:00", "session": "morning"},
    {"number": 4, "label": "REST Period", "start": "05:00", "end": "06:00", "session": "morning"},
    {"number": 5, "label": "4th Period", "start": "06:30", "end": "07:30", "session": "afternoon"},
    {"number": 6, "label": "5th Period", "start": "08:00", "end": "09:00", "session": "afternoon"},
    {"number": 7, "label": "6th Period", "start": "09:30", "end": "10:30", "session": "afternoon"},
    {"number": 8, "label": "7th Period", "start": "10:30", "end": "11:30", "session": "afternoon"},
    {"number": 9, "label": "8th Period", "start": "12:00", "end": "13:00", "session": "night"},
    {"number": 10, "label": "9th Period", "start": "13:00", "end": "14:00", "session": "night"},
    {"number": 11, "label": "10th Period", "start": "14:00", "end": "15:00", "session": "night"},
]

REMARK_OPTIONS = [
    {"code": "OK", "label": "OK - Penerbangan Berhasil", "category": "success"},
    {"code": "1.1", "label": "Aircraft Complaint", "category": "aircraft"},
    {"code": "1.2", "label": "Aircraft Inspection", "category": "aircraft"},
    {"code": "1.3", "label": "Aircraft Late for Online", "category": "aircraft"},
    {"code": "1.4", "label": "Aircraft Document", "category": "aircraft"},
    {"code": "1.5", "label": "Aircraft Test Flight", "category": "aircraft"},
    {"code": "2.1", "label": "Weather Low Visibility", "category": "weather"},
    {"code": "2.2", "label": "Weather Rain", "category": "weather"},
    {"code": "2.3", "label": "Weather Turbulence", "category": "weather"},
    {"code": "2.4", "label": "Weather Thunderstorm", "category": "weather"},
    {"code": "2.5", "label": "Weather Wind > 10 kts", "category": "weather"},
    {"code": "3.1", "label": "Instructor Tidak Datang", "category": "instructor"},
    {"code": "3.2", "label": "Instructor Terlambat", "category": "instructor"},
    {"code": "3.3", "label": "Instructor Tugas Dinas", "category": "instructor"},
    {"code": "3.4", "label": "Instructor Sakit", "category": "instructor"},
    {"code": "3.5", "label": "Instructor Medical Expired", "category": "instructor"},
    {"code": "4.1", "label": "Student Sakit", "category": "student"},
    {"code": "4.2", "label": "Student Terlambat Lapor", "category": "student"},
    {"code": "4.3", "label": "Student Tidak Siap", "category": "student"},
    {"code": "4.4", "label": "Student Duty", "category": "student"},
    {"code": "4.5", "label": "Student Tanpa Keterangan", "category": "student"},
    {"code": "4.6", "label": "Student Medical Expired", "category": "student"},
    {"code": "4.7", "label": "Student SPL Expired", "category": "student"},
    {"code": "5.1", "label": "Notice ATC", "category": "notice"},
    {"code": "5.2", "label": "Notice PRODI", "category": "notice"},
    {"code": "5.3", "label": "Notice FLOPS", "category": "notice"},
    {"code": "5.4", "label": "Notice SPT NIL", "category": "notice"},
    {"code": "6.1", "label": "Late Due to Refueler", "category": "support"},
]

DEFAULT_STAGES = {
    "PPL": {
        "description": "Private Pilot License",
        "sub_stages": [
            {"name": "Simulator Visual", "exercises": ["V1","V2","V3","V4"]},
            {"name": "Terbang Presolo", "exercises": ["A1","A2","A3","A4","A5","A6","A7","A8","A9","A10","A11","A12","A13","A14","A15","A16","A17","A18","A19","A20"]},
            {"name": "Terbang Area", "exercises": ["B1","B2","B3","B4","B5","B6","B7","B8","B9","B10","B11","B12","B13","B14","B15","B16","B17"]},
            {"name": "Terbang Instrumen Area", "exercises": ["C1","C2"]},
            {"name": "Terbang Radio Instrumen", "exercises": ["D1"]},
            {"name": "Terbang Malam", "exercises": ["E1","E2","E3"]},
            {"name": "Terbang Cross Country", "exercises": ["F1","F2","F3","F4"]},
            {"name": "Simulator Radio Instrument", "exercises": ["R1"]},
        ],
        "exercises": ["V1","V2","V3","V4","A1","A2","A3","A4","A5","A6","A7","A8","A9","A10","A11","A12","A13","A14","A15","A16","A17","A18","A19","A20","B1","B2","B3","B4","B5","B6","B7","B8","B9","B10","B11","B12","B13","B14","B15","B16","B17","C1","C2","D1","E1","E2","E3","F1","F2","F3","F4","R1"],
        "required_hours": 70
    },
    "CPL": {
        "description": "Commercial Pilot License",
        "sub_stages": [
            {"name": "Simulator Visual", "exercises": ["VC1","VC2","VC3","VC4","VC5"]},
            {"name": "Simulator Instrumen", "exercises": ["IC1","IC2","IC3","IC4","IC5","IC6","IC7","IC8","IC9","IC10"]},
            {"name": "Terbang Area", "exercises": ["BC1","BC2","BC3","BC4","BC5","BC6","BC7","BC8","BC9","BC10","BC11","BC12","BC13","BC14","BC15","BC16"]},
            {"name": "Terbang Instrumen Area", "exercises": ["CC1","CC2","CC3","CC4","CC5","CC6","CC7","CC8","CC9","CC10","CC11","CC12","CC13","CC14","CC15","CC16","CC17","CC18","CC19","CC20","CC21","CC22","CC23","CC24","CC25","CC26","CC27","CC28","CC29","CC30","CC31","CC32","CC33"]},
            {"name": "Terbang Radio Instrumen", "exercises": ["DC1","DC2","DC3","DC4","DC5"]},
            {"name": "Terbang Malam", "exercises": ["EC1","EC2","EC3","EC4","EC5"]},
            {"name": "Terbang Cross Country", "exercises": ["FC1","FC2","FC3","FC4","FC5","FC6"]},
            {"name": "Simulator Radio Instrument", "exercises": ["RC1","RC2","RC3","RC4","RC5"]},
        ],
        "exercises": ["VC1","VC2","VC3","VC4","VC5","IC1","IC2","IC3","IC4","IC5","IC6","IC7","IC8","IC9","IC10","BC1","BC2","BC3","BC4","BC5","BC6","BC7","BC8","BC9","BC10","BC11","BC12","BC13","BC14","BC15","BC16","CC1","CC2","CC3","CC4","CC5","CC6","CC7","CC8","CC9","CC10","CC11","CC12","CC13","CC14","CC15","CC16","CC17","CC18","CC19","CC20","CC21","CC22","CC23","CC24","CC25","CC26","CC27","CC28","CC29","CC30","CC31","CC32","CC33","DC1","DC2","DC3","DC4","DC5","EC1","EC2","EC3","EC4","EC5","FC1","FC2","FC3","FC4","FC5","FC6","RC1","RC2","RC3","RC4","RC5"],
        "required_hours": 120
    },
    "IR": {
        "description": "Instrument Rating",
        "sub_stages": [
            {"name": "Simulator Instrumen", "exercises": ["CI1","CI2","CI3","CI4","CI5"]},
            {"name": "Terbang Instrumen Area", "exercises": ["II1","II2","II3","II4","II5"]},
            {"name": "Terbang Radio Instrumen", "exercises": ["RI1","RI2","RI3","RI4","RI5","RI6","RI7","RI8","RI9","RI10","RI11"]},
            {"name": "Simulator Radio Instrumen", "exercises": ["DI1","DI2","DI3","DI4","DI5","DI6","DI7","DI8","DI9","DI10"]},
            {"name": "Terbang Instrumen Cross Country", "exercises": ["FI1","FI2"]},
        ],
        "exercises": ["CI1","CI2","CI3","CI4","CI5","II1","II2","II3","II4","II5","RI1","RI2","RI3","RI4","RI5","RI6","RI7","RI8","RI9","RI10","RI11","DI1","DI2","DI3","DI4","DI5","DI6","DI7","DI8","DI9","DI10","FI1","FI2"],
        "required_hours": 50
    },
    "FIC": {
        "description": "Flight Instructor Course",
        "sub_stages": [
            {"name": "Terbang Instructor", "exercises": ["FIC1","FIC2","FIC3","FIC4","FIC5","FIC6","FIC7","FIC8","FIC9","FIC10","FIC11","FIC12","FIC13","FIC14","FIC15","FIC16","FIC17","FIC18","FIC19","FIC20","FIC21","FIC22","FIC23"]},
        ],
        "exercises": ["FIC1","FIC2","FIC3","FIC4","FIC5","FIC6","FIC7","FIC8","FIC9","FIC10","FIC11","FIC12","FIC13","FIC14","FIC15","FIC16","FIC17","FIC18","FIC19","FIC20","FIC21","FIC22","FIC23"],
        "required_hours": 30
    },
    "ME": {
        "description": "Multi Engine",
        "sub_stages": [
            {"name": "Simulator Multi Engine", "exercises": ["ME1","ME2","ME5","ME8","ME11"]},
            {"name": "Terbang Multi Engine", "exercises": ["ME3","ME4","ME6","ME7","ME9","ME10","ME12"]},
        ],
        "exercises": ["ME1","ME2","ME3","ME4","ME5","ME6","ME7","ME8","ME9","ME10","ME11","ME12"],
        "required_hours": 15
    }
}

# ─── Helpers ───
def get_jwt_secret(): return os.environ["JWT_SECRET"]
def hash_password(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
def verify_password(p, h): return bcrypt.checkpw(p.encode(), h.encode())
def make_id(): return str(ObjectId())
def clean_doc(d):
    if d and "_id" in d: del d["_id"]
    return d

def create_access_token(uid, email):
    return jwt.encode({"sub": uid, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=60), "type": "access"}, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(uid):
    return jwt.encode({"sub": uid, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookies(resp, at, rt):
    resp.set_cookie(key="access_token", value=at, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    resp.set_cookie(key="refresh_token", value=rt, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

async def get_current_user(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        ah = request.headers.get("Authorization", "")
        if ah.startswith("Bearer "): token = ah[7:]
    if not token: raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access": raise HTTPException(401, "Invalid token")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user: raise HTTPException(401, "User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError: raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError: raise HTTPException(401, "Invalid token")

def calc_duration_minutes(block_off, block_on):
    """Calculate flight duration in minutes from HH:MM strings."""
    if not block_off or not block_on: return 0
    try:
        off_h, off_m = map(int, block_off.split(":"))
        on_h, on_m = map(int, block_on.split(":"))
        off_total = off_h * 60 + off_m
        on_total = on_h * 60 + on_m
        if on_total < off_total: on_total += 24 * 60
        return on_total - off_total
    except: return 0

# ─── Pydantic Models ───
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "student"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class InstructorCreate(BaseModel):
    name: str
    callsign: str
    cfi_expiry: Optional[str] = ""
    loa_status: Optional[str] = ""
    loa_expiry: Optional[str] = ""
    medical_expiry: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    duty_hours: Optional[str] = "0:00"

class InstructorUpdate(BaseModel):
    name: Optional[str] = None
    callsign: Optional[str] = None
    cfi_expiry: Optional[str] = None
    loa_status: Optional[str] = None
    loa_expiry: Optional[str] = None
    medical_expiry: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    duty_hours: Optional[str] = None

class StudentCreate(BaseModel):
    name: str
    callsign: Optional[str] = ""
    license_owned: Optional[str] = ""
    course_id: Optional[str] = ""
    medical_expiry: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    callsign: Optional[str] = None
    license_owned: Optional[str] = None
    course_id: Optional[str] = None
    medical_expiry: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

class AircraftCreate(BaseModel):
    registration: str
    total_hours: str = "0:00"
    status_hours: float = 0
    is_insured: bool = True
    aircraft_type: str = ""
    remarks: str = ""

class AircraftUpdate(BaseModel):
    registration: Optional[str] = None
    total_hours: Optional[str] = None
    status_hours: Optional[float] = None
    is_insured: Optional[bool] = None
    aircraft_type: Optional[str] = None
    remarks: Optional[str] = None

class StageCreate(BaseModel):
    name: str
    description: Optional[str] = None
    exercises: Optional[List[str]] = None
    sub_stages: Optional[list] = None
    required_hours: Optional[float] = None

class StageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    exercises: Optional[List[str]] = None
    sub_stages: Optional[list] = None
    required_hours: Optional[float] = None

class CourseCreate(BaseModel):
    name: str
    description: Optional[str] = None

class CourseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ScheduleEntryCreate(BaseModel):
    date: str
    period_number: int
    aircraft_id: str
    instructor_callsign: str = ""
    student_callsign: str = ""
    student_name: str = ""
    exercise: str = ""
    block_off: str = ""
    block_on: str = ""
    remarks: str = ""
    course_id: str = ""
    status: str = "scheduled"

class ScheduleEntryUpdate(BaseModel):
    instructor_callsign: Optional[str] = None
    student_callsign: Optional[str] = None
    student_name: Optional[str] = None
    exercise: Optional[str] = None
    block_off: Optional[str] = None
    block_on: Optional[str] = None
    remarks: Optional[str] = None
    course_id: Optional[str] = None
    status: Optional[str] = None

class FlightNoteCreate(BaseModel):
    student_id: str
    student_name: str
    exercise: str
    stage_name: str
    stage_type: str = ""
    note: str
    rating: Optional[str] = ""
    items: Optional[list] = None
    date: str

class FlightNoteUpdate(BaseModel):
    note: Optional[str] = None
    rating: Optional[str] = None
    items: Optional[list] = None

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    priority: str = "normal"
    target_role: str = "all"

class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    priority: Optional[str] = None
    target_role: Optional[str] = None

class ProgressCreate(BaseModel):
    student_id: str
    stage_name: str
    exercise: str
    completed_date: str
    instructor_callsign: str = ""
    remarks: str = ""

class SiteSettingsUpdate(BaseModel):
    site_title: Optional[str] = None
    site_subtitle: Optional[str] = None

class EmailNotificationRequest(BaseModel):
    to_email: str
    subject: str
    body: str

class BulkUserCreate(BaseModel):
    role: str = "student"

# ──────────── AUTH ────────────
@api_router.post("/auth/register")
async def register(data: UserRegister, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}): raise HTTPException(400, "Email already registered")
    result = await db.users.insert_one({"email": email, "password_hash": hash_password(data.password), "name": data.name, "role": data.role, "created_at": datetime.now(timezone.utc).isoformat()})
    uid = str(result.inserted_id)
    set_auth_cookies(response, create_access_token(uid, email), create_refresh_token(uid))
    return {"id": uid, "email": email, "name": data.name, "role": data.role}

@api_router.post("/auth/login")
async def login(creds: UserLogin, response: Response):
    email = creds.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(creds.password, user["password_hash"]): raise HTTPException(401, "Invalid credentials")
    uid = str(user["_id"])
    set_auth_cookies(response, create_access_token(uid, email), create_refresh_token(uid))
    return {"id": uid, "email": user["email"], "name": user["name"], "role": user["role"]}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def get_me(u: dict = Depends(get_current_user)): return u

@api_router.get("/auth/users")
async def get_users(u: dict = Depends(get_current_user)):
    if u["role"] != "admin": raise HTTPException(403, "Admin only")
    users = await db.users.find({}, {"password_hash": 0}).to_list(5000)
    for x in users: x["_id"] = str(x["_id"])
    return users

@api_router.post("/auth/bulk-create")
async def bulk_create_users(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin": raise HTTPException(403, "Admin only")
    contents = await file.read()
    try: df = pd.read_excel(io.BytesIO(contents))
    except: df = pd.read_csv(io.BytesIO(contents))
    created = []
    for _, row in df.iterrows():
        name = str(row.get("name", ""))
        email = str(row.get("email", "")).lower().strip()
        role = str(row.get("role", "student")).lower()
        if not name or not email: continue
        if await db.users.find_one({"email": email}): continue
        pw = name.replace(" ", "") + "2026"
        await db.users.insert_one({"email": email, "password_hash": hash_password(pw), "name": name, "role": role, "created_at": datetime.now(timezone.utc).isoformat()})
        created.append({"name": name, "email": email, "role": role, "password": pw})
    return {"created": created, "count": len(created)}

# ──────────── SITE SETTINGS ────────────
@api_router.get("/settings")
async def get_settings(u: dict = Depends(get_current_user)):
    s = await db.site_settings.find_one({}, {"_id": 0})
    return s or {"site_title": "Operating Certificate 91-026", "site_subtitle": "PPI Curug", "logo_path": ""}

@api_router.put("/settings")
async def update_settings(data: SiteSettingsUpdate, u: dict = Depends(get_current_user)):
    if u["role"] != "admin": raise HTTPException(403, "Admin only")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    await db.site_settings.update_one({}, {"$set": update}, upsert=True)
    return {"message": "Settings updated"}

@api_router.post("/settings/logo")
async def upload_logo(file: UploadFile = File(...), u: dict = Depends(get_current_user)):
    if u["role"] != "admin": raise HTTPException(403, "Admin only")
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    path = f"{APP_NAME}/logo/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = put_object(path, data, file.content_type or "image/png")
    await db.site_settings.update_one({}, {"$set": {"logo_path": result["path"]}}, upsert=True)
    return {"path": result["path"]}

@api_router.get("/files/{path:path}")
async def serve_file(path: str, u: dict = Depends(get_current_user)):
    data, ct = get_object(path)
    return Response(content=data, media_type=ct)

# ──────────── UPLOAD PROFILE PHOTO ────────────
@api_router.post("/upload/profile-photo")
async def upload_profile_photo(file: UploadFile = File(...), entity_type: str = "instructor", entity_id: str = "", u: dict = Depends(get_current_user)):
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    path = f"{APP_NAME}/profiles/{entity_type}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = put_object(path, data, file.content_type or "image/png")
    collection = db.instructors if entity_type == "instructor" else db.students
    await collection.update_one({"id": entity_id}, {"$set": {"photo_path": result["path"]}})
    return {"path": result["path"]}

# ──────────── INSTRUCTORS ────────────
@api_router.get("/instructors")
async def get_instructors(u: dict = Depends(get_current_user)):
    return await db.instructors.find({}, {"_id": 0}).to_list(1000)

@api_router.post("/instructors")
async def create_instructor(data: InstructorCreate, u: dict = Depends(get_current_user)):
    doc = data.model_dump(); doc["id"] = make_id(); doc["photo_path"] = ""; doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.instructors.insert_one(doc); return clean_doc(doc)

@api_router.put("/instructors/{iid}")
async def update_instructor(iid: str, data: InstructorUpdate, u: dict = Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update: raise HTTPException(400, "No data")
    r = await db.instructors.update_one({"id": iid}, {"$set": update})
    if r.matched_count == 0: raise HTTPException(404, "Not found")
    return {"message": "Updated"}

@api_router.delete("/instructors/{iid}")
async def delete_instructor(iid: str, u: dict = Depends(get_current_user)):
    r = await db.instructors.delete_one({"id": iid})
    if r.deleted_count == 0: raise HTTPException(404, "Not found")
    return {"message": "Deleted"}

# ──────────── STUDENTS ────────────
@api_router.get("/students")
async def get_students(u: dict = Depends(get_current_user)):
    students = await db.students.find({}, {"_id": 0}).to_list(1000)
    courses_list = await db.courses.find({}, {"_id": 0}).to_list(1000)
    cm = {c["id"]: c for c in courses_list}
    for s in students:
        if s.get("course_id"): s["course"] = cm.get(s["course_id"])
    return students

@api_router.post("/students")
async def create_student(data: StudentCreate, u: dict = Depends(get_current_user)):
    doc = data.model_dump(); doc["id"] = make_id(); doc["photo_path"] = ""; doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.students.insert_one(doc); return clean_doc(doc)

@api_router.put("/students/{sid}")
async def update_student(sid: str, data: StudentUpdate, u: dict = Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update: raise HTTPException(400, "No data")
    r = await db.students.update_one({"id": sid}, {"$set": update})
    if r.matched_count == 0: raise HTTPException(404, "Not found")
    return {"message": "Updated"}

@api_router.delete("/students/{sid}")
async def delete_student(sid: str, u: dict = Depends(get_current_user)):
    r = await db.students.delete_one({"id": sid})
    if r.deleted_count == 0: raise HTTPException(404, "Not found")
    return {"message": "Deleted"}

# ──────────── AIRCRAFT ────────────
@api_router.get("/aircraft")
async def get_aircraft(u: dict = Depends(get_current_user)): return await db.aircraft.find({}, {"_id": 0}).to_list(1000)

@api_router.post("/aircraft")
async def create_aircraft(data: AircraftCreate, u: dict = Depends(get_current_user)):
    doc = data.model_dump(); doc["id"] = make_id(); doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.aircraft.insert_one(doc); return clean_doc(doc)

@api_router.put("/aircraft/{aid}")
async def update_aircraft(aid: str, data: AircraftUpdate, u: dict = Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update: raise HTTPException(400, "No data")
    r = await db.aircraft.update_one({"id": aid}, {"$set": update})
    if r.matched_count == 0: raise HTTPException(404, "Not found")
    return {"message": "Updated"}

@api_router.delete("/aircraft/{aid}")
async def delete_aircraft(aid: str, u: dict = Depends(get_current_user)):
    r = await db.aircraft.delete_one({"id": aid})
    if r.deleted_count == 0: raise HTTPException(404, "Not found")
    return {"message": "Deleted"}

# ──────────── STAGES ────────────
@api_router.get("/stages")
async def get_stages(u: dict = Depends(get_current_user)): return await db.stages.find({}, {"_id": 0}).to_list(1000)

@api_router.post("/stages")
async def create_stage(data: StageCreate, u: dict = Depends(get_current_user)):
    doc = data.model_dump(); doc["id"] = make_id(); doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.stages.insert_one(doc); return clean_doc(doc)

@api_router.put("/stages/{sid}")
async def update_stage(sid: str, data: StageUpdate, u: dict = Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update: raise HTTPException(400, "No data")
    r = await db.stages.update_one({"id": sid}, {"$set": update})
    if r.matched_count == 0: raise HTTPException(404, "Not found")
    return {"message": "Updated"}

@api_router.delete("/stages/{sid}")
async def delete_stage(sid: str, u: dict = Depends(get_current_user)):
    r = await db.stages.delete_one({"id": sid})
    if r.deleted_count == 0: raise HTTPException(404, "Not found")
    return {"message": "Deleted"}

# ──────────── COURSES ────────────
@api_router.get("/courses")
async def get_courses(u: dict = Depends(get_current_user)):
    courses = await db.courses.find({}, {"_id": 0}).to_list(1000)
    all_students = await db.students.find({}, {"_id": 0}).to_list(5000)
    sbc = {}
    for s in all_students:
        cid = s.get("course_id")
        if cid: sbc.setdefault(cid, []).append(s)
    for c in courses: c["students"] = sbc.get(c["id"], [])
    return courses

@api_router.post("/courses")
async def create_course(data: CourseCreate, u: dict = Depends(get_current_user)):
    doc = data.model_dump(); doc["id"] = make_id(); doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.courses.insert_one(doc); return clean_doc(doc)

@api_router.put("/courses/{cid}")
async def update_course(cid: str, data: CourseUpdate, u: dict = Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update: raise HTTPException(400, "No data")
    r = await db.courses.update_one({"id": cid}, {"$set": update})
    if r.matched_count == 0: raise HTTPException(404, "Not found")
    return {"message": "Updated"}

@api_router.delete("/courses/{cid}")
async def delete_course(cid: str, u: dict = Depends(get_current_user)):
    r = await db.courses.delete_one({"id": cid})
    if r.deleted_count == 0: raise HTTPException(404, "Not found")
    return {"message": "Deleted"}

# ──────────── PERIODS & REMARKS ────────────
@api_router.get("/periods")
async def get_periods(u: dict = Depends(get_current_user)): return DEFAULT_PERIODS

@api_router.get("/remarks")
async def get_remarks(u: dict = Depends(get_current_user)): return REMARK_OPTIONS

# ──────────── SCHEDULES ────────────
@api_router.get("/schedules")
async def get_schedules(date: Optional[str] = None, u: dict = Depends(get_current_user)):
    q = {"date": date} if date else {}
    return await db.schedule_entries.find(q, {"_id": 0}).to_list(5000)

@api_router.post("/schedules")
async def create_schedule(data: ScheduleEntryCreate, u: dict = Depends(get_current_user)):
    doc = data.model_dump()
    doc["id"] = make_id()
    doc["duration_minutes"] = calc_duration_minutes(doc.get("block_off",""), doc.get("block_on",""))
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    # Auto-resolve student_name from callsign if not provided
    if doc.get("student_callsign") and not doc.get("student_name"):
        student = await db.students.find_one({"callsign": doc["student_callsign"]}, {"_id": 0})
        if student:
            doc["student_name"] = student.get("name", "")
    await db.schedule_entries.insert_one(doc)
    # Auto-update progress if remark is OK
    if doc.get("remarks") == "OK" and doc.get("student_callsign") and doc.get("exercise"):
        student = await db.students.find_one({"callsign": doc["student_callsign"]}, {"_id": 0})
        if student:
            existing = await db.student_progress.find_one({"student_id": student["id"], "exercise": doc["exercise"]})
            if not existing:
                await db.student_progress.insert_one({"id": make_id(), "student_id": student["id"], "stage_name": "", "exercise": doc["exercise"], "completed_date": doc["date"], "instructor_callsign": doc.get("instructor_callsign",""), "remarks": "Auto from schedule", "marked_by": "system", "created_at": datetime.now(timezone.utc).isoformat()})
    return clean_doc(doc)

@api_router.put("/schedules/{eid}")
async def update_schedule(eid: str, data: ScheduleEntryUpdate, u: dict = Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if "block_off" in update or "block_on" in update:
        entry = await db.schedule_entries.find_one({"id": eid}, {"_id": 0})
        bo = update.get("block_off", entry.get("block_off","") if entry else "")
        bn = update.get("block_on", entry.get("block_on","") if entry else "")
        update["duration_minutes"] = calc_duration_minutes(bo, bn)
    if not update: raise HTTPException(400, "No data")
    r = await db.schedule_entries.update_one({"id": eid}, {"$set": update})
    if r.matched_count == 0: raise HTTPException(404, "Not found")
    # Auto progress if remark changed to OK
    if update.get("remarks") == "OK":
        entry = await db.schedule_entries.find_one({"id": eid}, {"_id": 0})
        if entry and entry.get("student_callsign") and entry.get("exercise"):
            student = await db.students.find_one({"callsign": entry["student_callsign"]}, {"_id": 0})
            if student:
                existing = await db.student_progress.find_one({"student_id": student["id"], "exercise": entry["exercise"]})
                if not existing:
                    await db.student_progress.insert_one({"id": make_id(), "student_id": student["id"], "stage_name": "", "exercise": entry["exercise"], "completed_date": entry["date"], "instructor_callsign": entry.get("instructor_callsign",""), "remarks": "Auto from schedule", "marked_by": "system", "created_at": datetime.now(timezone.utc).isoformat()})
    return {"message": "Updated"}

@api_router.delete("/schedules/{eid}")
async def delete_schedule(eid: str, u: dict = Depends(get_current_user)):
    r = await db.schedule_entries.delete_one({"id": eid})
    if r.deleted_count == 0: raise HTTPException(404, "Not found")
    return {"message": "Deleted"}

# ──────────── MONTHLY RECAP ────────────
@api_router.get("/recap/monthly")
async def get_monthly_recap(month: str, u: dict = Depends(get_current_user)):
    """month format: YYYY-MM"""
    entries = await db.schedule_entries.find({"date": {"$regex": f"^{month}"}}, {"_id": 0}).to_list(10000)
    # Remark recap
    remark_counts = {}
    for e in entries:
        rmk = e.get("remarks", "")
        if rmk: remark_counts[rmk] = remark_counts.get(rmk, 0) + 1
    # Student hours
    student_hours = {}
    for e in entries:
        sc = e.get("student_callsign", "") or e.get("student_name", "")
        dur = e.get("duration_minutes", 0)
        if sc and dur: student_hours[sc] = student_hours.get(sc, 0) + dur
    # Aircraft hours
    aircraft_hours = {}
    for e in entries:
        aid = e.get("aircraft_id", "")
        dur = e.get("duration_minutes", 0)
        if aid and dur: aircraft_hours[aid] = aircraft_hours.get(aid, 0) + dur
    # Instructor hours
    instructor_hours = {}
    for e in entries:
        ic = e.get("instructor_callsign", "")
        dur = e.get("duration_minutes", 0)
        if ic and dur: instructor_hours[ic] = instructor_hours.get(ic, 0) + dur
    return {"month": month, "total_entries": len(entries), "remark_counts": remark_counts, "student_hours": student_hours, "aircraft_hours": aircraft_hours, "instructor_hours": instructor_hours}

# ──────────── OER CALCULATION ────────────
@api_router.get("/oer/monthly")
async def get_oer(month: str, u: dict = Depends(get_current_user)):
    """Operational Effective Rate per aircraft per month."""
    entries = await db.schedule_entries.find({"date": {"$regex": f"^{month}"}}, {"_id": 0}).to_list(10000)
    aircraft_list = await db.aircraft.find({"is_insured": True}, {"_id": 0}).to_list(100)
    holidays = await db.holidays.find({"month": month}, {"_id": 0}).to_list(100)
    holiday_dates = set(h["date"] for h in holidays)

    # Count working days
    import calendar
    y, m = int(month.split("-")[0]), int(month.split("-")[1])
    total_days = calendar.monthrange(y, m)[1]
    working_days = total_days - len(holiday_dates)
    periods_per_day = len(DEFAULT_PERIODS)

    results = []
    for ac in aircraft_list:
        ac_entries = [e for e in entries if e.get("aircraft_id") == ac["id"]]
        total_sortie = working_days * periods_per_day
        weather_notice = sum(1 for e in ac_entries if e.get("remarks","") in ["2.1","2.2","2.3","2.4","2.5","5.1"])
        aircraft_support = sum(1 for e in ac_entries if e.get("remarks","") in ["1.1","1.2","1.3","1.4","1.5","6.1"])
        ok_flights = sum(1 for e in ac_entries if e.get("remarks","") == "OK")
        hr_issues = sum(1 for e in ac_entries if e.get("remarks","") in ["3.1","3.2","3.3","3.4","3.5","4.1","4.2","4.3","4.4","4.5","4.6","4.7"])
        sortie_bersih = total_sortie - weather_notice if total_sortie > weather_notice else 1
        availability = (total_sortie - weather_notice) / total_sortie * 100 if total_sortie > 0 else 0
        maintenance = (sortie_bersih - aircraft_support) / sortie_bersih * 100 if sortie_bersih > 0 else 0
        optimalization = (ok_flights + hr_issues) / ok_flights * 100 if ok_flights > 0 else 0
        oer = availability * maintenance * optimalization / 10000 if availability > 0 and maintenance > 0 else 0
        results.append({"aircraft_id": ac["id"], "registration": ac["registration"], "total_sortie": total_sortie, "weather_notice": weather_notice, "sortie_bersih": sortie_bersih, "aircraft_support": aircraft_support, "ok_flights": ok_flights, "hr_issues": hr_issues, "availability_rate": round(availability, 2), "maintenance_rate": round(maintenance, 2), "optimalization_rate": round(optimalization, 2), "oer": round(oer, 2)})
    return {"month": month, "working_days": working_days, "holidays": len(holiday_dates), "aircraft_oer": results}

@api_router.post("/holidays")
async def set_holidays(holidays: List[str], month: str, u: dict = Depends(get_current_user)):
    if u["role"] != "admin": raise HTTPException(403, "Admin only")
    await db.holidays.delete_many({"month": month})
    for d in holidays:
        await db.holidays.insert_one({"date": d, "month": month})
    return {"message": f"Set {len(holidays)} holidays for {month}"}

@api_router.get("/holidays")
async def get_holidays(month: str, u: dict = Depends(get_current_user)):
    return await db.holidays.find({"month": month}, {"_id": 0}).to_list(100)

# ──────────── FLIGHT NOTES ────────────
@api_router.get("/flight-notes")
async def get_flight_notes(student_id: Optional[str] = None, u: dict = Depends(get_current_user)):
    q = {}
    if u["role"] == "student":
        q["student_name"] = u.get("name", "")
    elif u["role"] == "instructor":
        if student_id: q["student_id"] = student_id
        else: q["instructor_name"] = u.get("name", "")
    elif student_id:
        q["student_id"] = student_id
    return await db.flight_notes.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api_router.post("/flight-notes")
async def create_flight_note(data: FlightNoteCreate, u: dict = Depends(get_current_user)):
    if u["role"] not in ["admin", "instructor"]: raise HTTPException(403, "Not authorized")
    doc = data.model_dump(); doc["id"] = make_id(); doc["instructor_id"] = u.get("_id",""); doc["instructor_name"] = u.get("name",""); doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.flight_notes.insert_one(doc); return clean_doc(doc)

@api_router.put("/flight-notes/{nid}")
async def update_flight_note(nid: str, data: FlightNoteUpdate, u: dict = Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update: raise HTTPException(400, "No data")
    r = await db.flight_notes.update_one({"id": nid}, {"$set": update})
    if r.matched_count == 0: raise HTTPException(404, "Not found")
    return {"message": "Updated"}

@api_router.delete("/flight-notes/{nid}")
async def delete_flight_note(nid: str, u: dict = Depends(get_current_user)):
    r = await db.flight_notes.delete_one({"id": nid})
    if r.deleted_count == 0: raise HTTPException(404, "Not found")
    return {"message": "Deleted"}

# ──────────── ANNOUNCEMENTS ────────────
@api_router.get("/announcements")
async def get_announcements(u: dict = Depends(get_current_user)):
    return await db.announcements.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)

@api_router.post("/announcements")
async def create_announcement(data: AnnouncementCreate, u: dict = Depends(get_current_user)):
    if u["role"] not in ["admin", "instructor"]: raise HTTPException(403, "Not authorized")
    doc = data.model_dump(); doc["id"] = make_id(); doc["author_name"] = u.get("name",""); doc["author_role"] = u.get("role",""); doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.announcements.insert_one(doc); return clean_doc(doc)

@api_router.put("/announcements/{aid}")
async def update_announcement(aid: str, data: AnnouncementUpdate, u: dict = Depends(get_current_user)):
    if u["role"] not in ["admin", "instructor"]: raise HTTPException(403, "Not authorized")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update: raise HTTPException(400, "No data")
    r = await db.announcements.update_one({"id": aid}, {"$set": update})
    if r.matched_count == 0: raise HTTPException(404, "Not found")
    return {"message": "Updated"}

@api_router.delete("/announcements/{aid}")
async def delete_announcement(aid: str, u: dict = Depends(get_current_user)):
    if u["role"] not in ["admin", "instructor"]: raise HTTPException(403, "Not authorized")
    r = await db.announcements.delete_one({"id": aid})
    if r.deleted_count == 0: raise HTTPException(404, "Not found")
    return {"message": "Deleted"}

# ──────────── PROGRESS ────────────
@api_router.get("/progress/{student_id}")
async def get_progress(student_id: str, u: dict = Depends(get_current_user)):
    return await db.student_progress.find({"student_id": student_id}, {"_id": 0}).to_list(5000)

@api_router.post("/progress")
async def create_progress(data: ProgressCreate, u: dict = Depends(get_current_user)):
    existing = await db.student_progress.find_one({"student_id": data.student_id, "exercise": data.exercise})
    if existing: raise HTTPException(400, "Already completed")
    doc = data.model_dump(); doc["id"] = make_id(); doc["marked_by"] = u.get("name",""); doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.student_progress.insert_one(doc); return clean_doc(doc)

@api_router.delete("/progress/{pid}")
async def delete_progress(pid: str, u: dict = Depends(get_current_user)):
    r = await db.student_progress.delete_one({"id": pid})
    if r.deleted_count == 0: raise HTTPException(404, "Not found")
    return {"message": "Deleted"}

# ──────────── WHATSAPP & EMAIL ────────────
@api_router.get("/share/whatsapp/{date}")
async def get_whatsapp_links(date: str, u: dict = Depends(get_current_user)):
    entries = await db.schedule_entries.find({"date": date}, {"_id": 0}).to_list(5000)
    if not entries: return {"links": [], "date": date}
    ac_map = {a["id"]: a.get("registration","") for a in await db.aircraft.find({}, {"_id": 0}).to_list(100)}
    student_phones = {}
    student_names = {}
    for s in await db.students.find({}, {"_id": 0}).to_list(1000):
        cs = s.get("callsign", "")
        if cs:
            student_phones[cs] = s.get("phone", "")
            student_names[cs] = s.get("name", cs)
        student_phones[s.get("name", "")] = s.get("phone", "")
    instructor_phones = {i["callsign"]: i.get("phone","") for i in await db.instructors.find({}, {"_id": 0}).to_list(1000)}
    ss, iis = {}, {}
    for e in entries:
        sc = e.get("student_callsign", "") or e.get("student_name", "")
        sn_full = e.get("student_name", "") or student_names.get(sc, sc)
        ic, ac_reg = e.get("instructor_callsign",""), ac_map.get(e.get("aircraft_id",""),"")
        line = f"- Period {e.get('period_number','')}: {ac_reg} | EXC: {e.get('exercise','')}"
        if sc: ss.setdefault(sc, {"flights": [], "full_name": sn_full})["flights"].append(f"{line} | FI: {ic}")
        if ic: iis.setdefault(ic, []).append(f"{line} | Student: {sc}")
    links = []
    for sc, info in ss.items():
        phone = student_phones.get(sc, "")
        display = f"{sc} ({info['full_name']})" if info['full_name'] and info['full_name'] != sc else sc
        msg = f"*Flight Schedule - {date}*\nHi {display},\n\n" + "\n".join(info["flights"])
        wa = f"https://wa.me/{phone}?text={msg.replace(' ','%20').replace(chr(10),'%0A')}" if phone else ""
        links.append({"type": "student", "name": display, "phone": phone, "message": msg, "wa_link": wa})
    for ic, flights in iis.items():
        phone = instructor_phones.get(ic, "")
        msg = f"*Flight Schedule - {date}*\nHi {ic},\n\n" + "\n".join(flights)
        wa = f"https://wa.me/{phone}?text={msg.replace(' ','%20').replace(chr(10),'%0A')}" if phone else ""
        links.append({"type": "instructor", "name": ic, "phone": phone, "message": msg, "wa_link": wa})
    return {"links": links, "date": date}

@api_router.post("/notifications/send-email")
async def send_email(data: EmailNotificationRequest, u: dict = Depends(get_current_user)):
    if u["role"] not in ["admin","instructor"]: raise HTTPException(403)
    gu = os.environ.get("GMAIL_USER",""); gp = os.environ.get("GMAIL_APP_PASSWORD","")
    if not gu or not gp: raise HTTPException(503, "Gmail not configured")
    import smtplib; from email.mime.text import MIMEText; from email.mime.multipart import MIMEMultipart
    try:
        msg = MIMEMultipart(); msg["From"] = gu; msg["To"] = data.to_email; msg["Subject"] = data.subject
        msg.attach(MIMEText(data.body, "html"))
        s = smtplib.SMTP("smtp.gmail.com", 587); s.starttls(); s.login(gu, gp); s.sendmail(gu, data.to_email, msg.as_string()); s.quit()
        return {"message": "Sent"}
    except Exception as e: raise HTTPException(500, f"Failed: {str(e)}")

# ──────────── IMPORT ────────────
@api_router.post("/import/instructors")
async def import_instructors(file: UploadFile = File(...), u: dict = Depends(get_current_user)):
    contents = await file.read()
    try: df = pd.read_excel(io.BytesIO(contents))
    except: df = pd.read_csv(io.BytesIO(contents))
    c = 0
    for _, row in df.iterrows():
        doc = {"id": make_id(), "name": str(row.get("name","")), "callsign": str(row.get("callsign","")), "cfi_expiry": str(row.get("cfi_expiry",row.get("license_expiry",""))), "loa_status": str(row.get("loa_status","")), "loa_expiry": str(row.get("loa_expiry","")), "medical_expiry": str(row.get("medical_expiry","")), "email": str(row.get("email","")), "phone": str(row.get("phone","")), "duty_hours": str(row.get("duty_hours","0:00")), "photo_path": "", "created_at": datetime.now(timezone.utc).isoformat()}
        await db.instructors.insert_one(doc); c += 1
    return {"message": f"Imported {c} instructors"}

@api_router.post("/import/students")
async def import_students(file: UploadFile = File(...), u: dict = Depends(get_current_user)):
    contents = await file.read()
    try: df = pd.read_excel(io.BytesIO(contents))
    except: df = pd.read_csv(io.BytesIO(contents))
    c = 0
    for _, row in df.iterrows():
        course_name = str(row.get("course",""))
        course_id = ""
        if course_name:
            course = await db.courses.find_one({"name": course_name})
            if course: course_id = course.get("id","")
        doc = {"id": make_id(), "name": str(row.get("name","")), "callsign": str(row.get("callsign","")), "license_owned": str(row.get("license_owned","")), "course_id": course_id, "medical_expiry": str(row.get("medical_expiry",row.get("license_expiry",""))), "email": str(row.get("email","")), "phone": str(row.get("phone","")), "photo_path": "", "created_at": datetime.now(timezone.utc).isoformat()}
        await db.students.insert_one(doc); c += 1
    return {"message": f"Imported {c} students"}

@api_router.post("/import/aircraft")
async def import_aircraft(file: UploadFile = File(...), u: dict = Depends(get_current_user)):
    contents = await file.read()
    try: df = pd.read_excel(io.BytesIO(contents))
    except: df = pd.read_csv(io.BytesIO(contents))
    c = 0
    for _, row in df.iterrows():
        doc = {"id": make_id(), "registration": str(row.get("registration","")), "total_hours": str(row.get("total_hours","0:00")), "status_hours": float(row.get("status_hours",0)), "is_insured": bool(row.get("is_insured",True)), "aircraft_type": str(row.get("aircraft_type","")), "remarks": str(row.get("remarks","")), "created_at": datetime.now(timezone.utc).isoformat()}
        await db.aircraft.insert_one(doc); c += 1
    return {"message": f"Imported {c} aircraft"}

# ──────────── NOTIFICATIONS ────────────
@api_router.get("/notifications/expiring-licenses")
async def get_expiring(u: dict = Depends(get_current_user)):
    nm = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")
    ei = [i for i in await db.instructors.find({}, {"_id": 0}).to_list(1000) if any(i.get(f,"") and i[f] <= nm for f in ["cfi_expiry","loa_expiry","medical_expiry"])]
    es = [s for s in await db.students.find({}, {"_id": 0}).to_list(1000) if s.get("medical_expiry","") and s["medical_expiry"] <= nm]
    return {"instructors": ei, "students": es, "total": len(ei) + len(es)}

# ──────────── EXPORT ────────────
@api_router.get("/export/schedules")
async def export_schedules(date: Optional[str] = None, u: dict = Depends(get_current_user)):
    q = {"date": date} if date else {}
    entries = await db.schedule_entries.find(q, {"_id": 0}).to_list(5000)
    wb = Workbook(); ws = wb.active; ws.title = "Schedules"
    ws.append(["Date","Period","Aircraft","Instructor","Student Callsign","Student Name","Exercise","Block Off","Block On","Duration(min)","Remarks","Status"])
    for e in entries: ws.append([e.get("date",""),e.get("period_number",""),e.get("aircraft_id",""),e.get("instructor_callsign",""),e.get("student_callsign",""),e.get("student_name",""),e.get("exercise",""),e.get("block_off",""),e.get("block_on",""),e.get("duration_minutes",0),e.get("remarks",""),e.get("status","")])
    out = io.BytesIO(); wb.save(out); out.seek(0)
    return StreamingResponse(out, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=schedules.xlsx"})

# ──────────── E-LEARNING ────────────
@api_router.get("/ebooks")
async def get_ebooks(u: dict = Depends(get_current_user)):
    return await db.ebooks.find({}, {"_id": 0}).to_list(1000)

@api_router.post("/ebooks")
async def upload_ebook(file: UploadFile = File(...), title: str = "", stage: str = "", description: str = "", u: dict = Depends(get_current_user)):
    if u["role"] not in ["admin","instructor"]: raise HTTPException(403)
    ext = file.filename.split(".")[-1] if "." in file.filename else "pdf"
    path = f"{APP_NAME}/ebooks/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = put_object(path, data, file.content_type or "application/pdf")
    doc = {"id": make_id(), "title": title or file.filename, "stage": stage, "description": description, "storage_path": result["path"], "original_filename": file.filename, "content_type": file.content_type, "size": result.get("size",0), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.ebooks.insert_one(doc)
    return clean_doc(doc)

@api_router.delete("/ebooks/{eid}")
async def delete_ebook(eid: str, u: dict = Depends(get_current_user)):
    if u["role"] not in ["admin","instructor"]: raise HTTPException(403)
    r = await db.ebooks.delete_one({"id": eid})
    if r.deleted_count == 0: raise HTTPException(404)
    return {"message": "Deleted"}

# ──────────── STARTUP ────────────
@app.on_event("startup")
async def startup_event():
    admin_email = os.environ.get("ADMIN_EMAIL","admin@flightops.com")
    admin_pw = os.environ.get("ADMIN_PASSWORD","Admin123!")
    existing = await db.users.find_one({"email": admin_email})
    if not existing: await db.users.insert_one({"email": admin_email, "password_hash": hash_password(admin_pw), "name": "Admin", "role": "admin", "created_at": datetime.now(timezone.utc).isoformat()})
    elif not verify_password(admin_pw, existing["password_hash"]): await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pw)}})
    # Indexes
    for col in ["users"]: await db[col].create_index("email", unique=True)
    for col in ["instructors","students","aircraft","stages","courses","schedule_entries","flight_notes","announcements","student_progress","ebooks"]: await db[col].create_index("id", unique=True)
    await db.schedule_entries.create_index([("date",1),("period_number",1),("aircraft_id",1)])
    await db.student_progress.create_index([("student_id",1),("exercise",1)])
    # Seed stages
    for name, info in DEFAULT_STAGES.items():
        existing = await db.stages.find_one({"name": name})
        if not existing: await db.stages.insert_one({"id": make_id(), "name": name, "description": info["description"], "exercises": info["exercises"], "sub_stages": info.get("sub_stages",[]), "required_hours": info.get("required_hours",0), "created_at": datetime.now(timezone.utc).isoformat()})
        else: await db.stages.update_one({"name": name}, {"$set": {"exercises": info["exercises"], "sub_stages": info.get("sub_stages",[]), "required_hours": info.get("required_hours",0)}})
    # Seed settings
    if not await db.site_settings.find_one({}):
        await db.site_settings.insert_one({"site_title": "Operating Certificate 91-026", "site_subtitle": "PPI Curug", "logo_path": ""})
    # Init storage
    try: init_storage(); logging.info("Storage initialized")
    except Exception as e: logging.error(f"Storage init: {e}")
    # Creds
    Path("/app/memory").mkdir(exist_ok=True)
    with open("/app/memory/test_credentials.md","w") as f:
        f.write(f"# Test Credentials\n\n## Admin\n- Email: {admin_email}\n- Password: {admin_pw}\n- Role: admin\n")

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
logging.basicConfig(level=logging.INFO)

@app.on_event("shutdown")
async def shutdown(): client.close()
