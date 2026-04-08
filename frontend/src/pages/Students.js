import { useEffect, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import api, { formatApiErrorDetail } from '../utils/api';
import { Plus, Upload, Trash2, Edit } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

export default function Students() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', callsign: '', license_owned: '', course_id: '', medical_expiry: '', email: '', phone: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [studRes, courseRes] = await Promise.all([api.get('/students'), api.get('/courses')]);
      setStudents(studRes.data);
      setCourses(courseRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await api.put(`/students/${editingId}`, formData);
        toast.success('Student updated');
      } else {
        await api.post('/students', formData);
        toast.success('Student created');
      }
      setIsDialogOpen(false);
      fetchData();
      resetForm();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this student?')) return;
    try {
      await api.delete(`/students/${id}`);
      toast.success('Student deleted');
      fetchData();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail));
    }
  };

  const handleEdit = (student) => {
    setEditingId(student.id);
    setFormData({
      name: student.name || '', callsign: student.callsign || '', license_owned: student.license_owned || '',
      course_id: student.course_id || '', medical_expiry: student.medical_expiry || '',
      email: student.email || '', phone: student.phone || '',
    });
    setIsDialogOpen(true);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await api.post('/import/students', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Students imported');
      setIsImportDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail));
    }
  };

  const resetForm = () => { setFormData({ name: '', callsign: '', license_owned: '', course_id: '', medical_expiry: '', email: '', phone: '' }); setEditingId(null); };

  const canEdit = user?.role === 'admin' || user?.role === 'instructor';
  const canDelete = user?.role === 'admin';

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-0 md:ml-64 flex-1 p-6 md:p-8 bg-[#F8FAFC] min-h-screen">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl tracking-tight font-semibold text-[#0B192C]" style={{ fontFamily: 'Outfit, sans-serif' }}>Students</h1>
            <p className="text-sm text-slate-500 mt-2">Manage student pilots and their licenses</p>
          </div>
          <div className="flex gap-3">
            {canEdit && (
              <>
                <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="import-students-button" className="border border-slate-200 text-[#0B192C] hover:bg-slate-50 bg-white rounded-lg px-4 py-2 font-medium">
                      <Upload size={18} className="mr-2" />Import
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Import Students</DialogTitle></DialogHeader>
                    <div className="space-y-4 mt-4">
                      <p className="text-sm text-slate-600">Upload Excel/CSV with columns: <strong>name</strong>, <strong>license_expiry</strong>, <strong>course</strong></p>
                      <Input type="file" accept=".xlsx,.xls,.csv" data-testid="import-file-input" onChange={handleImport} />
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
                  <DialogTrigger asChild>
                    <Button data-testid="add-student-button" className="bg-[#F4A261] text-white hover:bg-[#E78A43] rounded-lg px-4 py-2 font-medium shadow-sm">
                      <Plus size={18} className="mr-2" />Add Student
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{editingId ? 'Edit Student' : 'Create New Student'}</DialogTitle></DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-3 mt-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Nama</Label>
                          <Input data-testid="student-name-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required className="mt-1" placeholder="Nama siswa" />
                        </div>
                        <div>
                          <Label className="text-xs">Callsign</Label>
                          <Input data-testid="student-callsign-input" value={formData.callsign} onChange={e => setFormData({ ...formData, callsign: e.target.value })} className="mt-1" placeholder="e.g. STD-01" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">License Owned</Label>
                          <Input data-testid="student-license-input" value={formData.license_owned} onChange={e => setFormData({ ...formData, license_owned: e.target.value })} className="mt-1" placeholder="SPL / PPL" />
                        </div>
                        <div>
                          <Label className="text-xs">Course</Label>
                          <Select value={formData.course_id} onValueChange={v => setFormData({ ...formData, course_id: v === 'none' ? '' : v })}>
                            <SelectTrigger data-testid="student-course-select" className="mt-1"><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Tanpa kelas</SelectItem>
                              {courses.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Medical Expiry</Label>
                          <Input data-testid="student-medical-input" type="date" value={formData.medical_expiry} onChange={e => setFormData({ ...formData, medical_expiry: e.target.value })} className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Email</Label>
                          <Input data-testid="student-email-input" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="mt-1" placeholder="email@domain.com" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Phone (WhatsApp)</Label>
                        <Input data-testid="student-phone-input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="mt-1" placeholder="628xxxxx" />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <Button type="button" onClick={() => setIsDialogOpen(false)} className="flex-1 border border-slate-200 text-[#0B192C] hover:bg-slate-50 bg-white">Cancel</Button>
                        <Button type="submit" data-testid="student-submit-button" disabled={loading} className="flex-1 bg-[#F4A261] text-white hover:bg-[#E78A43]">
                          {loading ? 'Saving...' : editingId ? 'Update' : 'Create'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-xl font-medium text-[#0B192C]" style={{ fontFamily: 'Outfit, sans-serif' }}>Student List</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#0B192C] uppercase tracking-wider">Nama</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#0B192C] uppercase tracking-wider">Course</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#0B192C] uppercase tracking-wider">License</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#0B192C] uppercase tracking-wider">Medical Exp</th>
                    {(canEdit || canDelete) && <th className="px-4 py-3 text-right text-xs font-semibold text-[#0B192C] uppercase tracking-wider">Actions</th>}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {students.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No students found</td></tr>
                  ) : students.map(student => (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors" data-testid="student-row">
                      <td className="px-4 py-3 text-sm text-[#0B192C] font-medium">{student.name}</td>
                      <td className="px-4 py-3">
                        {student.course ? <Badge className="bg-[#FFEDD5] text-[#C2410C]">{student.course.name}</Badge> : <span className="text-xs text-slate-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#0B192C]">{student.license_owned || '-'}</td>
                      <td className="px-4 py-3 text-sm text-[#0B192C]">{student.medical_expiry || '-'}</td>
                      {(canEdit || canDelete) && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {canEdit && <button onClick={() => handleEdit(student)} data-testid="edit-student-button" className="p-2 text-[#F4A261] hover:bg-slate-100 rounded-lg"><Edit size={16} /></button>}
                            {canDelete && <button onClick={() => handleDelete(student.id)} data-testid="delete-student-button" className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
