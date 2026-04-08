import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '../components/Sidebar';
import api, { formatApiErrorDetail } from '../utils/api';
import { Download, Plus, ChevronLeft, ChevronRight, Save, Share2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

const STAGE_COLORS = {
  PPL: { bg: '#E0F2FE', text: '#0284C7' },
  CPL: { bg: '#FFEDD5', text: '#C2410C' },
  IR:  { bg: '#F3E8FF', text: '#7E22CE' },
  FIC: { bg: '#DCFCE7', text: '#15803D' },
  ME:  { bg: '#FEE2E2', text: '#B91C1C' },
};

function getExerciseStage(exercise) {
  if (!exercise) return null;
  const ex = exercise.toUpperCase();
  if (ex.startsWith('ME')) return 'ME';
  if (ex.startsWith('FIC')) return 'FIC';
  if (ex.startsWith('V') && !ex.startsWith('VC')) return 'PPL';
  if (ex.startsWith('VC') || ex.startsWith('IC') || ex.startsWith('BC') || ex.startsWith('DC') || ex.startsWith('EC') || ex.startsWith('FC') || ex.startsWith('RC')) return 'CPL';
  if (ex.startsWith('CI') || ex.startsWith('II') || ex.startsWith('RI') || ex.startsWith('DI') || ex.startsWith('FI')) return 'IR';
  if (ex.startsWith('A') || ex.startsWith('B') || ex.startsWith('C') || ex.startsWith('D') || ex.startsWith('E') || ex.startsWith('F') || ex.startsWith('R')) return 'PPL';
  return null;
}

export default function ScheduleBoard() {
  const [schedules, setSchedules] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [aircraft, setAircraft] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [remarkOptions, setRemarkOptions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [cellDialog, setCellDialog] = useState(null);
  const [waDialog, setWaDialog] = useState(null);
  const [cellForm, setCellForm] = useState({
    instructor_callsign: '', student_callsign: '', student_name: '', exercise: '',
    block_off: '', block_on: '', remarks: '', course_id: '', status: 'scheduled'
  });

  const formatDateDisplay = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const navigateDate = (dir) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + dir);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const fetchAll = useCallback(async () => {
    try {
      const [schRes, perRes, acRes, instrRes, studRes, courseRes, rmkRes] = await Promise.all([
        api.get(`/schedules?date=${selectedDate}`),
        api.get('/periods'),
        api.get('/aircraft'),
        api.get('/instructors'),
        api.get('/students'),
        api.get('/courses'),
        api.get('/remarks'),
      ]);
      setSchedules(schRes.data);
      setPeriods(perRes.data);
      setAircraft(acRes.data.filter(a => a.is_insured));
      setInstructors(instrRes.data);
      setStudents(studRes.data);
      setCourses(courseRes.data);
      setRemarkOptions(rmkRes.data);
    } catch (err) {
      console.error(err);
    }
  }, [selectedDate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getCellData = (aircraftId, periodNum) => {
    return schedules.find(s => s.aircraft_id === aircraftId && s.period_number === periodNum);
  };

  const openCellDialog = (ac, period) => {
    const existing = getCellData(ac.id, period.number);
    setCellDialog({ aircraft: ac, period, existing });
    setCellForm({
      instructor_callsign: existing?.instructor_callsign || '',
      student_callsign: existing?.student_callsign || '',
      student_name: existing?.student_name || '',
      exercise: existing?.exercise || '',
      block_off: existing?.block_off || '',
      block_on: existing?.block_on || '',
      remarks: existing?.remarks || '',
      course_id: existing?.course_id || '',
      status: existing?.status || 'scheduled',
    });
  };

  const saveCellData = async () => {
    if (!cellDialog) return;
    try {
      const payload = { ...cellForm, remarks: cellForm.remarks === '__empty__' ? '' : cellForm.remarks };
      if (cellDialog.existing) {
        await api.put(`/schedules/${cellDialog.existing.id}`, payload);
      } else {
        await api.post('/schedules', {
          date: selectedDate,
          period_number: cellDialog.period.number,
          aircraft_id: cellDialog.aircraft.id,
          ...payload,
        });
      }
      toast.success('Schedule saved');
      setCellDialog(null);
      fetchAll();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const deleteCellData = async () => {
    if (!cellDialog?.existing) return;
    try {
      await api.delete(`/schedules/${cellDialog.existing.id}`);
      toast.success('Entry deleted');
      setCellDialog(null);
      fetchAll();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get(`/export/schedules?date=${selectedDate}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `flight_schedule_${selectedDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Exported successfully');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const handleWhatsAppShare = async () => {
    try {
      const { data } = await api.get(`/share/whatsapp/${selectedDate}`);
      setWaDialog(data);
    } catch (err) {
      toast.error('Failed to load WhatsApp links');
    }
  };

  // Group students by course for dropdown - use callsign as value
  const studentsByCourse = (() => {
    const courseMap = {};
    const noCourse = [];
    const courseNames = {};
    for (const c of courses) courseNames[c.id] = c.name;
    for (const s of students) {
      if (!s.name && !s.callsign) continue;
      const item = { ...s, displayLabel: s.callsign ? `${s.callsign} (${s.name})` : s.name, selectValue: s.callsign || s.name };
      if (s.course_id && courseNames[s.course_id]) {
        if (!courseMap[s.course_id]) courseMap[s.course_id] = [];
        courseMap[s.course_id].push(item);
      } else {
        noCourse.push(item);
      }
    }
    const groups = [];
    for (const [cid, studs] of Object.entries(courseMap)) {
      groups.push({ label: courseNames[cid], students: studs });
    }
    if (noCourse.length > 0) groups.push({ label: 'Tanpa Kelas', students: noCourse });
    return groups;
  })();

  // Group remark options by category
  const remarksByCategory = (() => {
    const cats = {};
    for (const r of remarkOptions) {
      const cat = r.category || 'other';
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(r);
    }
    return cats;
  })();

  const CATEGORY_LABELS = {
    success: 'Berhasil', aircraft: 'Aircraft (1.x)', weather: 'Weather (2.x)',
    instructor: 'Instructor (3.x)', student: 'Student (4.x)',
    notice: 'Notice (5.x)', support: 'Support (6.x)', other: 'Lainnya'
  };
  // Summary stats
  const totalFlights = schedules.filter(s => s.student_callsign || s.student_name).length;

  // Calculate duration display from block times
  const calcDurationDisplay = (blockOff, blockOn) => {
    if (!blockOff || !blockOn) return '';
    try {
      const [oh, om] = blockOff.split(':').map(Number);
      const [nh, nm] = blockOn.split(':').map(Number);
      let diff = (nh * 60 + nm) - (oh * 60 + om);
      if (diff < 0) diff += 24 * 60;
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      return `${h}h${m > 0 ? m + 'm' : ''}`;
    } catch { return ''; }
  };
  const usedAircraft = new Set(schedules.filter(s => s.student_callsign || s.student_name).map(s => s.aircraft_id)).size;

  // Split periods into 3 sessions
  const morningPeriods = periods.filter(p => p.number >= 1 && p.number <= 4);   // 1st - REST
  const afternoonPeriods = periods.filter(p => p.number >= 5 && p.number <= 8); // 4th - 7th
  const nightPeriods = periods.filter(p => p.number >= 9 && p.number <= 11);    // 8th - 10th

  const renderCell = (ac, period) => {
    const data = getCellData(ac.id, period.number);
    const stage = getExerciseStage(data?.exercise);
    const colors = stage ? STAGE_COLORS[stage] : null;

    return (
      <td key={`${ac.id}-${period.number}`}
        onClick={() => openCellDialog(ac, period)}
        data-testid={`cell-${ac.registration}-${period.number}`}
        className="border border-slate-200 px-1.5 py-1 text-xs cursor-pointer hover:bg-[#F4A261]/10 transition-colors min-w-[110px] max-w-[130px] relative"
        style={(data?.student_callsign || data?.student_name) ? { backgroundColor: colors?.bg || '#f1f5f9' } : {}}>
        {(data?.student_callsign || data?.student_name) ? (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1">
              <span className="font-bold" style={{ color: colors?.text || '#0B192C' }}>{data.instructor_callsign || '-'}</span>
            </div>
            <div className="font-medium text-[#0B192C] truncate">{data.student_callsign || data.student_name}</div>
            {data.exercise && (
              <Badge className="text-[10px] px-1 py-0" style={{ backgroundColor: colors?.bg, color: colors?.text, border: `1px solid ${colors?.text}30` }}>
                {data.exercise}
              </Badge>
            )}
            {(data.block_off || data.block_on) && (
              <div className="text-[10px] text-slate-500">
                {data.block_off} - {data.block_on}
                {data.duration_minutes > 0 && <span className="ml-1 font-medium text-emerald-600">({calcDurationDisplay(data.block_off, data.block_on)})</span>}
              </div>
            )}
            {data.remarks && (
              <div className={`text-[10px] font-medium ${data.remarks === 'OK' ? 'text-emerald-600' : 'text-red-600'}`}>{data.remarks}</div>
            )}
          </div>
        ) : (
          <div className="h-8 flex items-center justify-center">
            <Plus size={12} className="text-slate-300" />
          </div>
        )}
      </td>
    );
  };

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-0 md:ml-64 flex-1 p-4 md:p-6 bg-[#F8FAFC] min-h-screen">
        {/* Header */}
        <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl tracking-tight font-semibold text-[#0B192C]" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Schedule Board
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleWhatsAppShare} data-testid="whatsapp-share-button"
              className="border border-green-200 text-green-700 hover:bg-green-50 bg-white rounded-lg px-3 py-2 text-sm font-medium">
              <Share2 size={16} className="mr-1.5" />WhatsApp
            </Button>
            <Button onClick={handleExport} data-testid="export-schedules-button"
              className="border border-slate-200 text-[#0B192C] hover:bg-slate-50 bg-white rounded-lg px-3 py-2 text-sm font-medium">
              <Download size={16} className="mr-1.5" />Export
            </Button>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="mb-4 flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
          <button onClick={() => navigateDate(-1)} data-testid="prev-date-button" className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft size={20} className="text-[#0B192C]" />
          </button>
          <div className="flex-1 text-center">
            <h2 className="text-lg font-semibold text-[#0B192C]" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {formatDateDisplay(selectedDate)}
            </h2>
          </div>
          <button onClick={() => navigateDate(1)} data-testid="next-date-button" className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronRight size={20} className="text-[#0B192C]" />
          </button>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            data-testid="date-picker-input" className="max-w-[160px] text-sm" />
        </div>

        {/* Summary Stats Bar */}
        <div className="mb-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total Flights', value: totalFlights, color: '#0284C7' },
            { label: 'Aircraft Used', value: usedAircraft, color: '#7E22CE' },
            { label: 'Aircraft Available', value: aircraft.length, color: '#15803D' },
            { label: 'Sortie Available', value: aircraft.length * periods.length, color: '#C2410C' },
            { label: 'Periods', value: periods.length, color: '#0B192C' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{s.label}</p>
              <p className="text-2xl font-bold mt-0.5" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Schedule Grid - Morning */}
        {aircraft.length > 0 && morningPeriods.length > 0 && (
          <div className="mb-4 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-[#0B192C] text-white px-4 py-2 flex items-center">
              <span className="text-sm font-semibold" style={{ fontFamily: 'Outfit' }}>Morning Session</span>
              <span className="ml-auto text-xs text-slate-300">{morningPeriods[0]?.start} - {morningPeriods[morningPeriods.length-1]?.end} UTC</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-[#0B192C] sticky left-0 bg-slate-50 z-10 min-w-[100px]">
                      A/C REG
                    </th>
                    {morningPeriods.map(p => (
                      <th key={p.number} className="border border-slate-200 px-2 py-2 text-center text-[10px] font-semibold text-[#0B192C] min-w-[110px]">
                        <div>{p.label}</div>
                        <div className="text-[9px] text-slate-400 font-normal">{p.start} - {p.end} UTC</div>
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-slate-50/50">
                    <th className="border border-slate-200 px-3 py-1 text-left text-[10px] text-slate-500 sticky left-0 bg-slate-50/50 z-10"></th>
                    {morningPeriods.map(p => (
                      <th key={p.number} className="border border-slate-200 px-1 py-1 text-center text-[9px] text-slate-400">
                        F.I / Student / EXC
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aircraft.map(ac => (
                    <tr key={ac.id} className="hover:bg-slate-50/30">
                      <td className="border border-slate-200 px-3 py-2 text-xs font-bold text-[#0B192C] sticky left-0 bg-white z-10 whitespace-nowrap">
                        {ac.registration}
                        <div className="text-[10px] font-normal text-slate-400">{ac.aircraft_type}</div>
                      </td>
                      {morningPeriods.map(p => renderCell(ac, p))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Schedule Grid - Afternoon */}
        {aircraft.length > 0 && afternoonPeriods.length > 0 && (
          <div className="mb-4 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-[#F4A261] text-white px-4 py-2 flex items-center">
              <span className="text-sm font-semibold" style={{ fontFamily: 'Outfit' }}>Afternoon Session</span>
              <span className="ml-auto text-xs text-white/80">{afternoonPeriods[0]?.start} - {afternoonPeriods[afternoonPeriods.length-1]?.end} UTC</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-[#0B192C] sticky left-0 bg-slate-50 z-10 min-w-[100px]">
                      A/C REG
                    </th>
                    {afternoonPeriods.map(p => (
                      <th key={p.number} className="border border-slate-200 px-2 py-2 text-center text-[10px] font-semibold text-[#0B192C] min-w-[110px]">
                        <div>{p.label}</div>
                        <div className="text-[9px] text-slate-400 font-normal">{p.start} - {p.end} UTC</div>
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-slate-50/50">
                    <th className="border border-slate-200 px-3 py-1 text-left text-[10px] text-slate-500 sticky left-0 bg-slate-50/50 z-10"></th>
                    {afternoonPeriods.map(p => (
                      <th key={p.number} className="border border-slate-200 px-1 py-1 text-center text-[9px] text-slate-400">
                        F.I / Student / EXC
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aircraft.map(ac => (
                    <tr key={ac.id} className="hover:bg-slate-50/30">
                      <td className="border border-slate-200 px-3 py-2 text-xs font-bold text-[#0B192C] sticky left-0 bg-white z-10 whitespace-nowrap">
                        {ac.registration}
                        <div className="text-[10px] font-normal text-slate-400">{ac.aircraft_type}</div>
                      </td>
                      {afternoonPeriods.map(p => renderCell(ac, p))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Schedule Grid - Night (Optional) */}
        {aircraft.length > 0 && nightPeriods.length > 0 && (
          <div className="mb-4 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-[#1A2B4C] text-white px-4 py-2 flex items-center">
              <span className="text-sm font-semibold" style={{ fontFamily: 'Outfit' }}>Night Session (Optional)</span>
              <span className="ml-auto text-xs text-slate-300">{nightPeriods[0]?.start} - {nightPeriods[nightPeriods.length-1]?.end} UTC</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-[#0B192C] sticky left-0 bg-slate-50 z-10 min-w-[100px]">
                      A/C REG
                    </th>
                    {nightPeriods.map(p => (
                      <th key={p.number} className="border border-slate-200 px-2 py-2 text-center text-[10px] font-semibold text-[#0B192C] min-w-[110px]">
                        <div>{p.label}</div>
                        <div className="text-[9px] text-slate-400 font-normal">{p.start} - {p.end} UTC</div>
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-slate-50/50">
                    <th className="border border-slate-200 px-3 py-1 text-left text-[10px] text-slate-500 sticky left-0 bg-slate-50/50 z-10"></th>
                    {nightPeriods.map(p => (
                      <th key={p.number} className="border border-slate-200 px-1 py-1 text-center text-[9px] text-slate-400">
                        F.I / Student / EXC
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aircraft.map(ac => (
                    <tr key={ac.id} className="hover:bg-slate-50/30">
                      <td className="border border-slate-200 px-3 py-2 text-xs font-bold text-[#0B192C] sticky left-0 bg-white z-10 whitespace-nowrap">
                        {ac.registration}
                        <div className="text-[10px] font-normal text-slate-400">{ac.aircraft_type}</div>
                      </td>
                      {nightPeriods.map(p => renderCell(ac, p))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {aircraft.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
            <p className="text-slate-500 text-sm">No insured aircraft found. Add aircraft in the Aircraft page first.</p>
          </div>
        )}

        {/* FI Available Summary */}
        {instructors.length > 0 && (
          <div className="mb-4 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-[#0B192C] text-white px-4 py-2">
              <span className="text-sm font-semibold" style={{ fontFamily: 'Outfit' }}>FI Available</span>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {instructors.map(fi => (
                <div key={fi.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                  <span className="font-bold text-sm text-[#0B192C]">{fi.callsign}</span>
                  <span className="text-xs text-slate-500">{fi.duty_hours || '0:00'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cell Edit Dialog */}
        <Dialog open={!!cellDialog} onOpenChange={open => !open && setCellDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: 'Outfit' }}>
                {cellDialog?.aircraft?.registration} - {cellDialog?.period?.label}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">F.I (Callsign)</Label>
                  <Select value={cellForm.instructor_callsign} onValueChange={v => setCellForm({ ...cellForm, instructor_callsign: v })}>
                    <SelectTrigger data-testid="cell-fi-select" className="mt-1 text-sm"><SelectValue placeholder="Select FI" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-">- (Solo)</SelectItem>
                      {instructors.map(fi => (
                        <SelectItem key={fi.id} value={fi.callsign}>{fi.callsign} - {fi.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Student (Callsign)</Label>
                  <Select value={cellForm.student_callsign} onValueChange={v => {
                    const st = students.find(s => (s.callsign || s.name) === v);
                    setCellForm({ ...cellForm, student_callsign: v, student_name: st?.name || '', course_id: st?.course_id || cellForm.course_id });
                  }}>
                    <SelectTrigger data-testid="cell-student-select" className="mt-1 text-sm"><SelectValue placeholder="Pilih Siswa" /></SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {studentsByCourse.map((group, gi) => (
                        <SelectGroup key={gi}>
                          <SelectLabel className="text-xs text-slate-500">{group.label}</SelectLabel>
                          {group.students.map(st => (
                            <SelectItem key={st.id} value={st.selectValue}>{st.displayLabel}</SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Exercise (EXC)</Label>
                  <Input data-testid="cell-exercise-input" value={cellForm.exercise} onChange={e => setCellForm({ ...cellForm, exercise: e.target.value })}
                    className="mt-1 text-sm" placeholder="e.g. B11, CC8" />
                </div>
                <div>
                  <Label className="text-xs">Course</Label>
                  <Select value={cellForm.course_id} onValueChange={v => setCellForm({ ...cellForm, course_id: v })}>
                    <SelectTrigger data-testid="cell-course-select" className="mt-1 text-sm"><SelectValue placeholder="Auto / Select" /></SelectTrigger>
                    <SelectContent>
                      {courses.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Block Off</Label>
                  <Input data-testid="cell-blockoff-input" type="time" value={cellForm.block_off} onChange={e => setCellForm({ ...cellForm, block_off: e.target.value })} className="mt-1 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Block On</Label>
                  <Input data-testid="cell-blockon-input" type="time" value={cellForm.block_on} onChange={e => setCellForm({ ...cellForm, block_on: e.target.value })} className="mt-1 text-sm" />
                </div>
              </div>
              {cellForm.block_off && cellForm.block_on && (
                <div className="text-xs text-emerald-600 font-medium px-1">
                  Durasi: {calcDurationDisplay(cellForm.block_off, cellForm.block_on)}
                </div>
              )}
              <div>
                <Label className="text-xs">Remarks</Label>
                <Select value={cellForm.remarks} onValueChange={v => setCellForm({ ...cellForm, remarks: v })}>
                  <SelectTrigger data-testid="cell-remarks-select" className="mt-1 text-sm"><SelectValue placeholder="Pilih Remarks" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="__empty__">- Kosong -</SelectItem>
                    {Object.entries(remarksByCategory).map(([cat, items]) => (
                      <SelectGroup key={cat}>
                        <SelectLabel className="text-xs text-slate-500">{CATEGORY_LABELS[cat] || cat}</SelectLabel>
                        {items.map(r => (
                          <SelectItem key={r.code} value={r.code}>{r.code} - {r.label}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={cellForm.status} onValueChange={v => setCellForm({ ...cellForm, status: v })}>
                  <SelectTrigger data-testid="cell-status-select" className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-2">
                {cellDialog?.existing && (
                  <Button onClick={deleteCellData} data-testid="cell-delete-button"
                    className="bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm px-3">Delete</Button>
                )}
                <Button onClick={() => setCellDialog(null)} className="flex-1 border border-slate-200 text-[#0B192C] hover:bg-slate-50 bg-white rounded-lg text-sm">Cancel</Button>
                <Button onClick={saveCellData} data-testid="cell-save-button"
                  className="flex-1 bg-[#F4A261] text-white hover:bg-[#E78A43] rounded-lg text-sm">
                  <Save size={14} className="mr-1.5" />Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* WhatsApp Share Dialog */}
        <Dialog open={!!waDialog} onOpenChange={open => !open && setWaDialog(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: 'Outfit' }}>Share Schedule via WhatsApp - {waDialog?.date}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-3">
              {waDialog?.links?.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No scheduled flights for this date</p>
              ) : waDialog?.links?.map((link, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className={link.type === 'student' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>{link.type}</Badge>
                      <span className="font-medium text-sm text-[#0B192C]">{link.name}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{link.phone || 'No phone number'}</p>
                  </div>
                  {link.wa_link ? (
                    <a href={link.wa_link} target="_blank" rel="noopener noreferrer" data-testid={`wa-link-${link.name}`}
                      className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 transition-colors">
                      Send
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">No phone</span>
                  )}
                </div>
              ))}
              <div className="pt-2">
                <Button onClick={() => setWaDialog(null)} className="w-full border border-slate-200 text-[#0B192C] hover:bg-slate-50 bg-white rounded-lg text-sm">Close</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
