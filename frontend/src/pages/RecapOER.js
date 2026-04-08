import { useEffect, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import api from '../utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

const REMARK_CATEGORY_LABELS = {
  OK: { label: 'Berhasil', color: 'bg-emerald-100 text-emerald-700' },
  '1': { label: 'Aircraft', color: 'bg-amber-100 text-amber-700' },
  '2': { label: 'Weather', color: 'bg-sky-100 text-sky-700' },
  '3': { label: 'Instructor', color: 'bg-purple-100 text-purple-700' },
  '4': { label: 'Student', color: 'bg-red-100 text-red-700' },
  '5': { label: 'Notice', color: 'bg-slate-100 text-slate-700' },
  '6': { label: 'Support', color: 'bg-orange-100 text-orange-700' },
};

function formatMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export default function RecapOER() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [recap, setRecap] = useState(null);
  const [oer, setOer] = useState(null);
  const [tab, setTab] = useState('recap');

  useEffect(() => { fetchData(); }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      const [recapRes, oerRes] = await Promise.all([
        api.get(`/recap/monthly?month=${month}`),
        api.get(`/oer/monthly?month=${month}`),
      ]);
      setRecap(recapRes.data);
      setOer(oerRes.data);
    } catch { toast.error('Gagal memuat data recap'); }
  };

  // Group remark counts by category
  const groupedRemarks = (() => {
    if (!recap?.remark_counts) return {};
    const groups = {};
    for (const [code, count] of Object.entries(recap.remark_counts)) {
      const cat = code === 'OK' ? 'OK' : code.split('.')[0];
      if (!groups[cat]) groups[cat] = { total: 0, items: [] };
      groups[cat].total += count;
      groups[cat].items.push({ code, count });
    }
    return groups;
  })();

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-0 md:ml-64 flex-1 p-6 md:p-8 bg-[#F8FAFC] min-h-screen">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl tracking-tight font-semibold text-[#0B192C]" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Recap & OER
            </h1>
            <p className="text-sm text-slate-500 mt-2">Rekap bulanan dan Operational Effective Rate</p>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-sm text-slate-600">Bulan:</Label>
            <Input type="month" data-testid="month-picker" value={month} onChange={e => setMonth(e.target.value)}
              className="max-w-[180px] text-sm" />
          </div>
        </div>

        {/* Tab Switch */}
        <div className="mb-6 flex gap-2">
          {[{ key: 'recap', label: 'Rekap Bulanan' }, { key: 'oer', label: 'OER Pesawat' }].map(t => (
            <button key={t.key} data-testid={`tab-${t.key}`} onClick={() => setTab(t.key)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-[#0B192C] text-white' : 'bg-white border border-slate-200 text-[#0B192C] hover:bg-slate-50'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'recap' && recap && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total Entries</p>
                  <p className="text-3xl font-bold text-[#0B192C] mt-1">{recap.total_entries}</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Students Active</p>
                  <p className="text-3xl font-bold text-[#0284C7] mt-1">{Object.keys(recap.student_hours || {}).length}</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Aircraft Used</p>
                  <p className="text-3xl font-bold text-[#7E22CE] mt-1">{Object.keys(recap.aircraft_hours || {}).length}</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Instructors Active</p>
                  <p className="text-3xl font-bold text-[#15803D] mt-1">{Object.keys(recap.instructor_hours || {}).length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Remark Recap */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-200">
                <CardTitle className="text-lg" style={{ fontFamily: 'Outfit' }}>Rekap Remarks</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(groupedRemarks).map(([cat, data]) => {
                    const info = REMARK_CATEGORY_LABELS[cat] || { label: cat, color: 'bg-slate-100 text-slate-600' };
                    return (
                      <div key={cat} className="p-3 rounded-lg border border-slate-200" data-testid={`remark-group-${cat}`}>
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={info.color}>{info.label}</Badge>
                          <span className="text-lg font-bold text-[#0B192C]">{data.total}</span>
                        </div>
                        <div className="space-y-1">
                          {data.items.map(i => (
                            <div key={i.code} className="flex justify-between text-xs text-slate-600">
                              <span>{i.code}</span><span className="font-medium">{i.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Student Hours */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-200">
                <CardTitle className="text-lg" style={{ fontFamily: 'Outfit' }}>Jam Terbang Siswa</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#0B192C] uppercase">Student</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-[#0B192C] uppercase">Flight Minutes</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-[#0B192C] uppercase">Hours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {Object.entries(recap.student_hours || {}).sort((a, b) => b[1] - a[1]).map(([name, mins]) => (
                        <tr key={name} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-sm font-medium text-[#0B192C]">{name}</td>
                          <td className="px-4 py-2.5 text-sm text-right text-slate-600">{mins} min</td>
                          <td className="px-4 py-2.5 text-sm text-right font-medium text-[#0B192C]">{formatMinutes(mins)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === 'oer' && oer && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Working Days</p>
                  <p className="text-3xl font-bold text-[#0B192C] mt-1">{oer.working_days}</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Holidays</p>
                  <p className="text-3xl font-bold text-red-600 mt-1">{oer.holidays}</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Aircraft Analyzed</p>
                  <p className="text-3xl font-bold text-[#7E22CE] mt-1">{oer.aircraft_oer?.length || 0}</p>
                </CardContent>
              </Card>
            </div>

            {/* OER Table */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-200">
                <CardTitle className="text-lg" style={{ fontFamily: 'Outfit' }}>Operational Effective Rate per Aircraft</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-[#0B192C] uppercase">A/C Reg</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-[#0B192C] uppercase">Total Sortie</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-[#0B192C] uppercase">Weather</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-[#0B192C] uppercase">A/C Issue</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-[#0B192C] uppercase">OK Flights</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-[#0B192C] uppercase">Availability</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-[#0B192C] uppercase">Maintenance</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-[#0B192C] uppercase">Optimalization</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-[#0B192C] uppercase">OER</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(oer.aircraft_oer || []).map(ac => (
                        <tr key={ac.aircraft_id} className="hover:bg-slate-50" data-testid="oer-row">
                          <td className="px-3 py-2.5 text-sm font-bold text-[#0B192C]">{ac.registration}</td>
                          <td className="px-3 py-2.5 text-sm text-center">{ac.total_sortie}</td>
                          <td className="px-3 py-2.5 text-sm text-center text-sky-600">{ac.weather_notice}</td>
                          <td className="px-3 py-2.5 text-sm text-center text-amber-600">{ac.aircraft_support}</td>
                          <td className="px-3 py-2.5 text-sm text-center text-emerald-600 font-medium">{ac.ok_flights}</td>
                          <td className="px-3 py-2.5 text-center">
                            <Badge className={ac.availability_rate >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>{ac.availability_rate}%</Badge>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <Badge className={ac.maintenance_rate >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>{ac.maintenance_rate}%</Badge>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <Badge className={ac.optimalization_rate >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>{ac.optimalization_rate}%</Badge>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`text-lg font-bold ${ac.oer >= 70 ? 'text-emerald-600' : ac.oer >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{ac.oer}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
