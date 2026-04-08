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

export default function Instructors() {
  const { user } = useAuth();
  const [instructors, setInstructors] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    name: '', callsign: '', cfi_expiry: '', loa_status: '', loa_expiry: '',
    medical_expiry: '', email: '', phone: '', duty_hours: '0:00',
  });

  useEffect(() => {
    fetchInstructors();
  }, []);

  const fetchInstructors = async () => {
    try {
      const { data } = await api.get('/instructors');
      setInstructors(data);
    } catch (error) {
      console.error('Error fetching instructors:', error);
      toast.error('Failed to load instructors');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingId) {
        await api.put(`/instructors/${editingId}`, formData);
        toast.success('Instructor updated successfully');
      } else {
        await api.post('/instructors', formData);
        toast.success('Instructor created successfully');
      }
      setIsDialogOpen(false);
      fetchInstructors();
      resetForm();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this instructor?')) return;

    try {
      await api.delete(`/instructors/${id}`);
      toast.success('Instructor deleted successfully');
      fetchInstructors();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail));
    }
  };

  const handleEdit = (instructor) => {
    setEditingId(instructor.id);
    setFormData({
      name: instructor.name || '', callsign: instructor.callsign || '',
      cfi_expiry: instructor.cfi_expiry || '', loa_status: instructor.loa_status || '',
      loa_expiry: instructor.loa_expiry || '', medical_expiry: instructor.medical_expiry || '',
      email: instructor.email || '', phone: instructor.phone || '',
      duty_hours: instructor.duty_hours || '0:00',
    });
    setIsDialogOpen(true);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post('/import/instructors', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Instructors imported successfully');
      setIsImportDialogOpen(false);
      fetchInstructors();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail));
    }
  };

  const resetForm = () => {
    setFormData({ name: '', callsign: '', cfi_expiry: '', loa_status: '', loa_expiry: '', medical_expiry: '', email: '', phone: '', duty_hours: '0:00' });
    setEditingId(null);
  };

  const canEdit = user?.role === 'admin' || user?.role === 'instructor';
  const canDelete = user?.role === 'admin';

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-0 md:ml-64 flex-1 p-6 md:p-8 bg-[#F8FAFC] min-h-screen">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1
              className="text-4xl tracking-tight font-semibold text-[#0B192C]"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              Instructors
            </h1>
            <p className="text-sm text-slate-500 mt-2">Manage flight instructors and their licenses</p>
          </div>

          <div className="flex gap-3">
            {canEdit && (
              <>
                <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      data-testid="import-instructors-button"
                      className="border border-slate-200 text-[#0B192C] hover:bg-slate-50 bg-white transition-colors rounded-lg px-4 py-2 font-medium"
                    >
                      <Upload size={18} className="mr-2" />
                      Import CSV
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Import Instructors from CSV/Excel</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <p className="text-sm text-slate-600">
                        Upload an Excel file with columns: <strong>name</strong>, <strong>callsign</strong>,{' '}
                        <strong>license_expiry</strong>
                      </p>
                      <Input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        data-testid="import-file-input"
                        onChange={handleImport}
                        className="cursor-pointer"
                      />
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog
                  open={isDialogOpen}
                  onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) resetForm();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      data-testid="add-instructor-button"
                      className="bg-[#F4A261] text-white hover:bg-[#E78A43] transition-colors rounded-lg px-4 py-2 font-medium shadow-sm"
                    >
                      <Plus size={18} className="mr-2" />
                      Add Instructor
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingId ? 'Edit Instructor' : 'Create New Instructor'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-3 mt-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Nama</Label>
                          <Input data-testid="instructor-name-input" value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })} required className="mt-1" placeholder="Nama lengkap" />
                        </div>
                        <div>
                          <Label className="text-xs">Callsign</Label>
                          <Input data-testid="instructor-callsign-input" value={formData.callsign}
                            onChange={e => setFormData({ ...formData, callsign: e.target.value })} required className="mt-1" placeholder="e.g. RA" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">CFI Expiry</Label>
                          <Input type="date" data-testid="instructor-cfi-input" value={formData.cfi_expiry}
                            onChange={e => setFormData({ ...formData, cfi_expiry: e.target.value })} className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Medical Expiry</Label>
                          <Input type="date" data-testid="instructor-medical-input" value={formData.medical_expiry}
                            onChange={e => setFormData({ ...formData, medical_expiry: e.target.value })} className="mt-1" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">LOA Status</Label>
                          <Select value={formData.loa_status} onValueChange={v => setFormData({ ...formData, loa_status: v })}>
                            <SelectTrigger data-testid="instructor-loa-status" className="mt-1"><SelectValue placeholder="Pilih" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                              <SelectItem value="expired">Expired</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">LOA Expiry</Label>
                          <Input type="date" data-testid="instructor-loa-expiry-input" value={formData.loa_expiry}
                            onChange={e => setFormData({ ...formData, loa_expiry: e.target.value })} className="mt-1" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Email</Label>
                          <Input type="email" data-testid="instructor-email-input" value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })} className="mt-1" placeholder="email@domain.com" />
                        </div>
                        <div>
                          <Label className="text-xs">Phone (WhatsApp)</Label>
                          <Input data-testid="instructor-phone-input" value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })} className="mt-1" placeholder="628xxxxx" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Duty Hours</Label>
                        <Input data-testid="instructor-duty-hours-input" value={formData.duty_hours}
                          onChange={e => setFormData({ ...formData, duty_hours: e.target.value })} className="mt-1" placeholder="0:00" />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <Button type="button" onClick={() => setIsDialogOpen(false)} className="flex-1 border border-slate-200 text-[#0B192C] hover:bg-slate-50 bg-white">Cancel</Button>
                        <Button type="submit" data-testid="instructor-submit-button" disabled={loading} className="flex-1 bg-[#F4A261] text-white hover:bg-[#E78A43]">
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
            <CardTitle className="text-xl font-medium text-[#0B192C]" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Instructor List
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#0B192C] uppercase tracking-wider">Nama</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#0B192C] uppercase tracking-wider">Callsign</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#0B192C] uppercase tracking-wider">CFI Exp</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#0B192C] uppercase tracking-wider">LOA</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#0B192C] uppercase tracking-wider">Medical Exp</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#0B192C] uppercase tracking-wider">Duty Hrs</th>
                    {(canEdit || canDelete) && <th className="px-4 py-3 text-right text-xs font-semibold text-[#0B192C] uppercase tracking-wider">Actions</th>}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {instructors.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">No instructors found</td></tr>
                  ) : instructors.map(instructor => (
                    <tr key={instructor.id} className="hover:bg-slate-50 transition-colors" data-testid="instructor-row">
                      <td className="px-4 py-3 text-sm text-[#0B192C] font-medium">{instructor.name}</td>
                      <td className="px-4 py-3"><Badge className="bg-[#E0F2FE] text-[#0284C7]">{instructor.callsign}</Badge></td>
                      <td className="px-4 py-3 text-sm text-[#0B192C]">{instructor.cfi_expiry || '-'}</td>
                      <td className="px-4 py-3">
                        <Badge className={instructor.loa_status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                          {instructor.loa_status || '-'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#0B192C]">{instructor.medical_expiry || '-'}</td>
                      <td className="px-4 py-3 text-sm text-[#0B192C]">{instructor.duty_hours || '0:00'}</td>
                      {(canEdit || canDelete) && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {canEdit && <button onClick={() => handleEdit(instructor)} data-testid="edit-instructor-button" className="p-2 text-[#F4A261] hover:bg-slate-100 rounded-lg"><Edit size={16} /></button>}
                            {canDelete && <button onClick={() => handleDelete(instructor.id)} data-testid="delete-instructor-button" className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>}
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