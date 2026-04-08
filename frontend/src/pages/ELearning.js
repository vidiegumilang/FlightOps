import { useEffect, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import api, { formatApiErrorDetail } from '../utils/api';
import { Upload, Trash2, FileText, Download } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const STAGE_TABS = ['ALL', 'PPL', 'CPL', 'IR', 'FIC', 'ME'];
const STAGE_COLORS = {
  PPL: 'bg-sky-100 text-sky-700', CPL: 'bg-orange-100 text-orange-700',
  IR: 'bg-purple-100 text-purple-700', FIC: 'bg-green-100 text-green-700',
  ME: 'bg-red-100 text-red-700',
};

export default function ELearning() {
  const { user } = useAuth();
  const [ebooks, setEbooks] = useState([]);
  const [activeStage, setActiveStage] = useState('ALL');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: '', stage: 'PPL', description: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { fetchEbooks(); }, []);

  const fetchEbooks = async () => {
    try {
      const { data } = await api.get('/ebooks');
      setEbooks(data);
    } catch { toast.error('Gagal memuat e-books'); }
  };

  const handleUpload = async () => {
    if (!selectedFile) { toast.error('Pilih file terlebih dahulu'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('title', uploadForm.title || selectedFile.name);
      fd.append('stage', uploadForm.stage);
      fd.append('description', uploadForm.description);
      await api.post('/ebooks', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('E-book berhasil diupload');
      setUploadOpen(false);
      setSelectedFile(null);
      setUploadForm({ title: '', stage: 'PPL', description: '' });
      fetchEbooks();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally { setUploading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus e-book ini?')) return;
    try {
      await api.delete(`/ebooks/${id}`);
      toast.success('E-book dihapus');
      fetchEbooks();
    } catch { toast.error('Gagal menghapus'); }
  };

  const handleView = async (ebook) => {
    try {
      const resp = await api.get(`/files/${ebook.storage_path}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([resp.data], { type: ebook.content_type }));
      window.open(url, '_blank');
    } catch { toast.error('Gagal membuka file'); }
  };

  const filtered = activeStage === 'ALL' ? ebooks : ebooks.filter(e => e.stage === activeStage);
  const canManage = user?.role === 'admin' || user?.role === 'instructor';

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-0 md:ml-64 flex-1 p-6 md:p-8 bg-[#F8FAFC] min-h-screen">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl tracking-tight font-semibold text-[#0B192C]" style={{ fontFamily: 'Outfit, sans-serif' }}>E-Learning</h1>
            <p className="text-sm text-slate-500 mt-2">Materi dan e-book pelatihan penerbangan</p>
          </div>
          {canManage && (
            <Button data-testid="upload-ebook-button" onClick={() => setUploadOpen(true)}
              className="bg-[#F4A261] text-white hover:bg-[#E78A43] rounded-lg px-4 py-2 font-medium shadow-sm">
              <Upload size={18} className="mr-2" />Upload E-Book
            </Button>
          )}
        </div>

        {/* Stage Tabs */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {STAGE_TABS.map(s => (
            <button key={s} data-testid={`stage-tab-${s}`} onClick={() => setActiveStage(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeStage === s ? 'bg-[#0B192C] text-white' : 'bg-white border border-slate-200 text-[#0B192C] hover:bg-slate-50'}`}>
              {s} {s !== 'ALL' && <span className="ml-1 text-xs opacity-70">({ebooks.filter(e => e.stage === s).length})</span>}
            </button>
          ))}
        </div>

        {/* E-Book Grid */}
        {filtered.length === 0 ? (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-12 text-center">
              <FileText size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">Belum ada e-book{activeStage !== 'ALL' ? ` untuk ${activeStage}` : ''}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(ebook => (
              <Card key={ebook.id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow" data-testid="ebook-card">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Badge className={STAGE_COLORS[ebook.stage] || 'bg-slate-100 text-slate-700'}>{ebook.stage}</Badge>
                      <CardTitle className="text-base mt-2 text-[#0B192C]" style={{ fontFamily: 'Outfit' }}>{ebook.title}</CardTitle>
                    </div>
                    {canManage && (
                      <button onClick={() => handleDelete(ebook.id)} data-testid="delete-ebook-button"
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {ebook.description && <p className="text-sm text-slate-500 mb-3">{ebook.description}</p>}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{ebook.original_filename}</span>
                    <Button onClick={() => handleView(ebook)} data-testid="view-ebook-button"
                      className="text-xs bg-[#0B192C] text-white hover:bg-[#1A2B4C] rounded-lg px-3 py-1.5">
                      <Download size={12} className="mr-1" />Buka
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Upload Dialog */}
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle style={{ fontFamily: 'Outfit' }}>Upload E-Book</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-3">
              <div>
                <Label className="text-xs">File</Label>
                <Input type="file" data-testid="ebook-file-input" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                  onChange={e => setSelectedFile(e.target.files[0])} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Judul</Label>
                <Input data-testid="ebook-title-input" value={uploadForm.title}
                  onChange={e => setUploadForm({ ...uploadForm, title: e.target.value })} className="mt-1" placeholder="Judul materi" />
              </div>
              <div>
                <Label className="text-xs">Stage</Label>
                <Select value={uploadForm.stage} onValueChange={v => setUploadForm({ ...uploadForm, stage: v })}>
                  <SelectTrigger data-testid="ebook-stage-select" className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['PPL','CPL','IR','FIC','ME'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Deskripsi</Label>
                <Input data-testid="ebook-desc-input" value={uploadForm.description}
                  onChange={e => setUploadForm({ ...uploadForm, description: e.target.value })} className="mt-1" placeholder="Deskripsi singkat" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => setUploadOpen(false)} className="flex-1 border border-slate-200 text-[#0B192C] hover:bg-slate-50 bg-white rounded-lg">Batal</Button>
                <Button onClick={handleUpload} disabled={uploading} data-testid="ebook-upload-submit"
                  className="flex-1 bg-[#F4A261] text-white hover:bg-[#E78A43] rounded-lg">
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
