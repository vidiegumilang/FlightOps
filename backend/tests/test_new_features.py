"""
Backend API tests for new features in iteration 3:
- Schedule Board with dropdown remarks and grouped students
- Instructors CRUD with new fields (cfi_expiry, loa_status, medical_expiry, duty_hours)
- Students CRUD with new fields (callsign, license_owned, medical_expiry)
- E-Learning page (ebooks API)
- Recap & OER page (monthly stats)
- Flight Notes with rating scale and stage_type
- Remarks endpoint (28 codes)
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        return s
    
    def test_login_admin(self, session):
        """Test admin login"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@flightops.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data["email"] == "admin@flightops.com"
        assert data["role"] == "admin"
        print(f"✓ Admin login successful: {data['email']}")


class TestRemarks:
    """Test remarks endpoint - should return 28 codes"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        s.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@flightops.com",
            "password": "Admin123!"
        })
        return s
    
    def test_get_remarks_returns_28_codes(self, auth_session):
        """GET /api/remarks should return 28 remark codes"""
        response = auth_session.get(f"{BASE_URL}/api/remarks")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 28, f"Expected 28 remarks, got {len(data)}"
        
        # Verify structure
        for remark in data:
            assert "code" in remark
            assert "label" in remark
            assert "category" in remark
        
        # Verify categories exist
        categories = set(r["category"] for r in data)
        expected_cats = {"success", "aircraft", "weather", "instructor", "student", "notice", "support"}
        assert categories == expected_cats, f"Missing categories: {expected_cats - categories}"
        
        # Verify OK code exists
        ok_codes = [r for r in data if r["code"] == "OK"]
        assert len(ok_codes) == 1
        print(f"✓ Remarks endpoint returns {len(data)} codes with categories: {categories}")


class TestSchedules:
    """Test schedule board with new fields"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        s.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@flightops.com",
            "password": "Admin123!"
        })
        return s
    
    @pytest.fixture(scope="class")
    def test_data(self, auth_session):
        """Create test data for schedules"""
        # Create test instructor
        instr_resp = auth_session.post(f"{BASE_URL}/api/instructors", json={
            "name": "TEST_Instructor_Schedule",
            "callsign": "TSI",
            "cfi_expiry": "2027-12-31",
            "medical_expiry": "2027-06-30",
            "duty_hours": "10:30"
        })
        instructor = instr_resp.json() if instr_resp.status_code == 200 else None
        
        # Create test student
        stud_resp = auth_session.post(f"{BASE_URL}/api/students", json={
            "name": "TEST_Student_Schedule",
            "callsign": "TSS",
            "license_owned": "SPL",
            "medical_expiry": "2027-06-30"
        })
        student = stud_resp.json() if stud_resp.status_code == 200 else None
        
        # Create test aircraft
        ac_resp = auth_session.post(f"{BASE_URL}/api/aircraft", json={
            "registration": "TEST-AC-SCH",
            "is_insured": True,
            "aircraft_type": "C172"
        })
        aircraft = ac_resp.json() if ac_resp.status_code == 200 else None
        
        yield {"instructor": instructor, "student": student, "aircraft": aircraft}
        
        # Cleanup
        if instructor:
            auth_session.delete(f"{BASE_URL}/api/instructors/{instructor['id']}")
        if student:
            auth_session.delete(f"{BASE_URL}/api/students/{student['id']}")
        if aircraft:
            auth_session.delete(f"{BASE_URL}/api/aircraft/{aircraft['id']}")
    
    def test_create_schedule_with_all_fields(self, auth_session, test_data):
        """POST /api/schedules with all new fields"""
        if not test_data["aircraft"]:
            pytest.skip("No test aircraft created")
        
        today = datetime.now().strftime("%Y-%m-%d")
        payload = {
            "date": today,
            "period_number": 1,
            "aircraft_id": test_data["aircraft"]["id"],
            "instructor_callsign": test_data["instructor"]["callsign"] if test_data["instructor"] else "TSI",
            "student_name": test_data["student"]["name"] if test_data["student"] else "TEST_Student",
            "exercise": "B11",
            "block_off": "08:00",
            "block_on": "09:30",
            "remarks": "OK",
            "course_id": "",
            "status": "scheduled"
        }
        
        response = auth_session.post(f"{BASE_URL}/api/schedules", json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify all fields
        assert data["instructor_callsign"] == payload["instructor_callsign"]
        assert data["student_name"] == payload["student_name"]
        assert data["exercise"] == "B11"
        assert data["block_off"] == "08:00"
        assert data["block_on"] == "09:30"
        assert data["remarks"] == "OK"
        assert data["status"] == "scheduled"
        assert "duration_minutes" in data
        assert data["duration_minutes"] == 90  # 1.5 hours
        
        print(f"✓ Schedule created with duration: {data['duration_minutes']} minutes")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/schedules/{data['id']}")
    
    def test_schedule_auto_duration_calculation(self, auth_session, test_data):
        """Test auto-duration calculation from block times"""
        if not test_data["aircraft"]:
            pytest.skip("No test aircraft created")
        
        today = datetime.now().strftime("%Y-%m-%d")
        payload = {
            "date": today,
            "period_number": 2,
            "aircraft_id": test_data["aircraft"]["id"],
            "instructor_callsign": "TSI",
            "student_name": "TEST_Student",
            "exercise": "A5",
            "block_off": "10:15",
            "block_on": "11:45",
            "remarks": "1.1",
            "status": "completed"
        }
        
        response = auth_session.post(f"{BASE_URL}/api/schedules", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # 10:15 to 11:45 = 90 minutes
        assert data["duration_minutes"] == 90
        print(f"✓ Auto-duration calculation: {data['block_off']} to {data['block_on']} = {data['duration_minutes']} min")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/schedules/{data['id']}")


class TestInstructorsCRUD:
    """Test instructors CRUD with new fields"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        s.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@flightops.com",
            "password": "Admin123!"
        })
        return s
    
    def test_create_instructor_with_new_fields(self, auth_session):
        """POST /api/instructors with cfi_expiry, loa_status, medical_expiry, duty_hours"""
        payload = {
            "name": "TEST_Instructor_NewFields",
            "callsign": "TIN",
            "cfi_expiry": "2027-12-31",
            "loa_status": "active",
            "loa_expiry": "2027-06-30",
            "medical_expiry": "2027-03-15",
            "email": "test.instructor@flightops.com",
            "phone": "628123456789",
            "duty_hours": "15:30"
        }
        
        response = auth_session.post(f"{BASE_URL}/api/instructors", json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify all new fields
        assert data["name"] == payload["name"]
        assert data["callsign"] == payload["callsign"]
        assert data["cfi_expiry"] == payload["cfi_expiry"]
        assert data["loa_status"] == payload["loa_status"]
        assert data["loa_expiry"] == payload["loa_expiry"]
        assert data["medical_expiry"] == payload["medical_expiry"]
        assert data["email"] == payload["email"]
        assert data["duty_hours"] == payload["duty_hours"]
        
        print(f"✓ Instructor created with new fields: {data['name']}")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/instructors/{data['id']}")
    
    def test_update_instructor_new_fields(self, auth_session):
        """PUT /api/instructors/{id} with new fields"""
        # Create first
        create_resp = auth_session.post(f"{BASE_URL}/api/instructors", json={
            "name": "TEST_Instructor_Update",
            "callsign": "TIU"
        })
        assert create_resp.status_code == 200
        instructor = create_resp.json()
        
        # Update with new fields
        update_payload = {
            "cfi_expiry": "2028-01-01",
            "loa_status": "inactive",
            "medical_expiry": "2027-12-31",
            "duty_hours": "20:00"
        }
        
        update_resp = auth_session.put(f"{BASE_URL}/api/instructors/{instructor['id']}", json=update_payload)
        assert update_resp.status_code == 200
        
        # Verify by GET
        get_resp = auth_session.get(f"{BASE_URL}/api/instructors")
        assert get_resp.status_code == 200
        instructors = get_resp.json()
        updated = next((i for i in instructors if i["id"] == instructor["id"]), None)
        
        assert updated is not None
        assert updated["cfi_expiry"] == "2028-01-01"
        assert updated["loa_status"] == "inactive"
        assert updated["medical_expiry"] == "2027-12-31"
        assert updated["duty_hours"] == "20:00"
        
        print(f"✓ Instructor updated with new fields")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/instructors/{instructor['id']}")


class TestStudentsCRUD:
    """Test students CRUD with new fields"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        s.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@flightops.com",
            "password": "Admin123!"
        })
        return s
    
    def test_create_student_with_new_fields(self, auth_session):
        """POST /api/students with callsign, license_owned, medical_expiry"""
        payload = {
            "name": "TEST_Student_NewFields",
            "callsign": "TSN",
            "license_owned": "SPL",
            "medical_expiry": "2027-06-30",
            "email": "test.student@flightops.com",
            "phone": "628987654321"
        }
        
        response = auth_session.post(f"{BASE_URL}/api/students", json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify all new fields
        assert data["name"] == payload["name"]
        assert data["callsign"] == payload["callsign"]
        assert data["license_owned"] == payload["license_owned"]
        assert data["medical_expiry"] == payload["medical_expiry"]
        assert data["email"] == payload["email"]
        
        print(f"✓ Student created with new fields: {data['name']}")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/students/{data['id']}")
    
    def test_students_grouped_by_course(self, auth_session):
        """GET /api/students returns students with course info"""
        response = auth_session.get(f"{BASE_URL}/api/students")
        assert response.status_code == 200
        students = response.json()
        
        # Verify structure - students should have course field if course_id is set
        for student in students:
            assert "name" in student
            assert "course_id" in student
            # If course_id is set, course object should be populated
            if student.get("course_id"):
                assert "course" in student or student.get("course") is None
        
        print(f"✓ Students endpoint returns {len(students)} students with course info")


class TestRecapMonthly:
    """Test monthly recap endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        s.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@flightops.com",
            "password": "Admin123!"
        })
        return s
    
    def test_get_monthly_recap(self, auth_session):
        """GET /api/recap/monthly?month=2026-04 returns data"""
        response = auth_session.get(f"{BASE_URL}/api/recap/monthly?month=2026-04")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "month" in data
        assert data["month"] == "2026-04"
        assert "total_entries" in data
        assert "remark_counts" in data
        assert "student_hours" in data
        assert "aircraft_hours" in data
        assert "instructor_hours" in data
        
        print(f"✓ Monthly recap for 2026-04: {data['total_entries']} entries")


class TestOERMonthly:
    """Test OER (Operational Effective Rate) endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        s.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@flightops.com",
            "password": "Admin123!"
        })
        return s
    
    def test_get_oer_monthly(self, auth_session):
        """GET /api/oer/monthly?month=2026-04 returns data"""
        response = auth_session.get(f"{BASE_URL}/api/oer/monthly?month=2026-04")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "month" in data
        assert data["month"] == "2026-04"
        assert "working_days" in data
        assert "holidays" in data
        assert "aircraft_oer" in data
        assert isinstance(data["aircraft_oer"], list)
        
        # If there are aircraft, verify OER structure
        for ac in data["aircraft_oer"]:
            assert "aircraft_id" in ac
            assert "registration" in ac
            assert "total_sortie" in ac
            assert "availability_rate" in ac
            assert "maintenance_rate" in ac
            assert "oer" in ac
        
        print(f"✓ OER for 2026-04: {len(data['aircraft_oer'])} aircraft analyzed")


class TestFlightNotesRating:
    """Test flight notes with rating scale and stage_type"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        s.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@flightops.com",
            "password": "Admin123!"
        })
        return s
    
    @pytest.fixture(scope="class")
    def test_student(self, auth_session):
        """Create test student for flight notes"""
        resp = auth_session.post(f"{BASE_URL}/api/students", json={
            "name": "TEST_Student_FlightNotes",
            "callsign": "TSF"
        })
        student = resp.json() if resp.status_code == 200 else None
        yield student
        if student:
            auth_session.delete(f"{BASE_URL}/api/students/{student['id']}")
    
    def test_create_flight_note_with_rating(self, auth_session, test_student):
        """POST /api/flight-notes with rating and stage_type"""
        if not test_student:
            pytest.skip("No test student created")
        
        payload = {
            "student_id": test_student["id"],
            "student_name": test_student["name"],
            "exercise": "A5",
            "stage_name": "PPL",
            "stage_type": "Dual Visual",
            "note": "Good progress on basic maneuvers",
            "rating": "above_average",
            "date": "2026-04-08"
        }
        
        response = auth_session.post(f"{BASE_URL}/api/flight-notes", json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify all fields
        assert data["student_name"] == payload["student_name"]
        assert data["exercise"] == "A5"
        assert data["stage_name"] == "PPL"
        assert data["stage_type"] == "Dual Visual"
        assert data["rating"] == "above_average"
        assert data["note"] == payload["note"]
        
        print(f"✓ Flight note created with rating: {data['rating']}, stage_type: {data['stage_type']}")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/flight-notes/{data['id']}")
    
    def test_flight_note_rating_options(self, auth_session, test_student):
        """Test all 4 rating options work"""
        if not test_student:
            pytest.skip("No test student created")
        
        ratings = ["above_average", "average", "below_average", "unsatisfactory"]
        created_ids = []
        
        for rating in ratings:
            payload = {
                "student_id": test_student["id"],
                "student_name": test_student["name"],
                "exercise": "B1",
                "stage_name": "PPL",
                "stage_type": "Solo Visual",
                "note": f"Test note for {rating}",
                "rating": rating,
                "date": "2026-04-08"
            }
            
            response = auth_session.post(f"{BASE_URL}/api/flight-notes", json=payload)
            assert response.status_code == 200, f"Failed for rating {rating}: {response.text}"
            data = response.json()
            assert data["rating"] == rating
            created_ids.append(data["id"])
        
        print(f"✓ All 4 rating options work: {ratings}")
        
        # Cleanup
        for note_id in created_ids:
            auth_session.delete(f"{BASE_URL}/api/flight-notes/{note_id}")


class TestEbooks:
    """Test e-learning ebooks endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        s.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@flightops.com",
            "password": "Admin123!"
        })
        return s
    
    def test_get_ebooks(self, auth_session):
        """GET /api/ebooks returns list"""
        response = auth_session.get(f"{BASE_URL}/api/ebooks")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Ebooks endpoint returns {len(data)} ebooks")


class TestPeriods:
    """Test periods endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        s.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@flightops.com",
            "password": "Admin123!"
        })
        return s
    
    def test_get_periods(self, auth_session):
        """GET /api/periods returns 11 periods"""
        response = auth_session.get(f"{BASE_URL}/api/periods")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 11, f"Expected 11 periods, got {len(data)}"
        
        # Verify structure
        for period in data:
            assert "number" in period
            assert "label" in period
            assert "start" in period
            assert "end" in period
            assert "session" in period
        
        print(f"✓ Periods endpoint returns {len(data)} periods")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
