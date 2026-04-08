import { useEffect, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import api, { formatApiErrorDetail } from '../utils/api';
import { Plus, Trash2, MessageSquare } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const RATING_COLORS = {
  'above_average': 'bg-green-100 text-green-700',
  'average': 'bg-blue-100 text-blue-700',
  'below_average': 'bg-yellow-100 text-yellow-700',
  'unsatisfactory': 'bg-red-100 text-red-700',
};

const RATING_LABELS = {
  'above_average': 'Above Average',
  'average': 'Average',
  'below_average': 'Below Average',
  'unsatisfactory': 'Unsatisfactory',
};

const STAGE_TYPES = [
  'Dual Visual', 'Solo Visual', 'Dual Instrument', 'Solo Instrument',
  'Dual Night', 'Solo Night', 'Dual Cross Country', 'Solo Cross Country',
  'Simulator', 'Check Ride',
];

export default function FlightNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [students, setStudents] = useState([]);
  const [stages, setStages] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterStudent, setFilterStudent] = useState('all');
  const [formData, setFormData] = useState({
    student_id: '', student_name: '', exercise: '', stage_name: '', stage_type: '', note: '', rating: '', date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => { fetchData(); }, [filterStudent]);

  const fetchData = async () => {
    try {
      const params = filterStudent !== 'all' ? `?student_id=${filterStudent}` : '';
      const [notesRes, studentsRes, stagesRes] = await Promise.all([
        api.get(`/flight-notes${params}`), api.get('/students'), api.get('/stages'),
      ]);
      setNotes(notesRes.data);
      setStudents(studentsRes.data);
      setStages(stagesRes.data);
    } catch (err) { console.error(err); }
  };

  const handleStudentChange = (studentId) => {
    const student = students.find(s => s.id === studentId);
    setFormData({ ...formData, student_id: studentId, student_name: student?.name || '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/flight-notes', formData);
      toast.success('Flight note added');
      setIsDialogOpen(false);
      fetchData();
      setFormData({ student_id: '', student_name: '', exercise: '', stage_name: '', stage_type: '', note: '', rating: '', date: new Date().toISOString().split('T')[0] });
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    try { await api.delete(`/flight-notes/${id}`); toast.success('Deleted'); fetchData(); } catch { toast.error('Delete failed'); }
  };

  const canWrite = user?.role === 'admin' || user?.role === 'instructor';

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-0 md:ml-64 flex-1 p-6 md:p-8 bg-[#F8FAFC] min-h-screen">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl tracking-tight font-semibold text-[#0B192C]" style={{ fontFamily: 'Outfit, sans-serif' }}>Flight Notes</h1>
            <p className="text-sm text-slate-500 mt-2">Instructor comments after flight stages</p>
          </div>
          {canWrite && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="add-note-button" className="bg-[#F4A261] text-white hover:bg-[#E78A43] rounded-lg px-4 py-2 font-medium shadow-sm">
                  <Plus size={18} className="mr-2" />Add Note
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Add Flight Note</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3 mt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Student</Label>
                      <Select value={formData.student_id} onValueChange={handleStudentChange}>
                        <SelectTrigger data-testid="note-student-select" className="mt-1"><SelectValue placeholder="Select student" /></SelectTrigger>
                        <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Date</Label>
                      <Input data-testid="note-date-input" type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="mt-1" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Stage</Label>
                      <Select value={formData.stage_name} onValueChange={v => setFormData({ ...formData, stage_name: v })}>
                        <SelectTrigger data-testid="note-stage-select" className="mt-1"><SelectValue placeholder="Select stage" /></SelectTrigger>
                        <SelectContent>{stages.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Exercise</Label>
                      <Input data-testid="note-exercise-input" value={formData.exercise} onChange={e => setFormData({ ...formData, exercise: e.target.value })} className="mt-1" placeholder="e.g. A5, B11" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Rating</Label>
                    <Select value={formData.rating} onValueChange={v => setFormData({ ...formData, rating: v })}>
                      <SelectTrigger data-testid="note-rating-select" className="mt-1"><SelectValue placeholder="Pilih rating" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="above_average">Above Average</SelectItem>
                        <SelectItem value="average">Average</SelectItem>
                        <SelectItem value="below_average">Below Average</SelectItem>
                        <SelectItem value="unsatisfactory">Unsatisfactory</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Tipe Stage</Label>
                    <Select value={formData.stage_type} onValueChange={v => setFormData({ ...formData, stage_type: v })}>
                      <SelectTrigger data-testid="note-stage-type-select" className="mt-1"><SelectValue placeholder="Pilih tipe" /></SelectTrigger>
                      <SelectContent>
                        {STAGE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Notes / Comments</Label>
                    <Textarea data-testid="note-content-input" value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} className="mt-1" rows={4} placeholder="Write instructor comments here..." required />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button type="button" onClick={() => setIsDialogOpen(false)} className="flex-1 border border-slate-200 text-[#0B192C] hover:bg-slate-50 bg-white">Cancel</Button>
                    <Button type="submit" data-testid="note-submit-button" disabled={loading} className="flex-1 bg-[#F4A261] text-white hover:bg-[#E78A43]">{loading ? 'Saving...' : 'Save Note'}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="mb-4">
          <Label className="text-xs text-slate-500 mb-1 block">Filter by Student</Label>
          <Select value={filterStudent} onValueChange={setFilterStudent}>
            <SelectTrigger data-testid="filter-student-select" className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Students</SelectItem>
              {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {notes.length === 0 ? (
            <Card className="border-slate-200 shadow-sm"><CardContent className="p-8 text-center text-slate-500">No flight notes found</CardContent></Card>
          ) : notes.map(note => (
            <Card key={note.id} className="border-slate-200 shadow-sm" data-testid="flight-note-card">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#F4A261]/10 rounded-lg mt-0.5"><MessageSquare size={18} className="text-[#F4A261]" /></div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[#0B192C]">{note.student_name}</span>
                        <Badge className="bg-slate-100 text-slate-600 text-xs">{note.stage_name} - {note.exercise}</Badge>
                        {note.stage_type && <Badge className="bg-indigo-100 text-indigo-700 text-xs">{note.stage_type}</Badge>}
                        {note.rating && <Badge className={`text-xs ${RATING_COLORS[note.rating] || 'bg-slate-100 text-slate-600'}`}>{RATING_LABELS[note.rating] || note.rating}</Badge>}
                      </div>
                      <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{note.note}</p>
                      <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                        <span>By: {note.instructor_name}</span>
                        <span>{note.date}</span>
                      </div>
                    </div>
                  </div>
                  {canWrite && (
                    <button onClick={() => handleDelete(note.id)} data-testid="delete-note-button" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
