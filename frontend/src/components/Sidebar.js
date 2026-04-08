import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Home, Calendar, Users, UserCheck, Plane, Layers, LogOut, BookOpen, MessageSquare, Megaphone, BarChart3, GraduationCap, PieChart } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../utils/api';

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState(0);

  useEffect(() => {
    api.get('/notifications/expiring-licenses').then(({ data }) => setNotifications(data.total || 0)).catch(() => {});
  }, []);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const menuItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/schedules', icon: Calendar, label: 'Schedule Board' },
    { path: '/instructors', icon: UserCheck, label: 'Instructors' },
    { path: '/students', icon: Users, label: 'Students' },
    { path: '/aircraft', icon: Plane, label: 'Aircraft' },
    { path: '/stages', icon: Layers, label: 'Stages' },
    { path: '/courses', icon: BookOpen, label: 'Courses' },
    { path: '/flight-notes', icon: MessageSquare, label: 'Flight Notes' },
    { path: '/announcements', icon: Megaphone, label: 'Announcements' },
    { path: '/progress', icon: BarChart3, label: 'Progress' },
    { path: '/e-learning', icon: GraduationCap, label: 'E-Learning' },
    { path: '/recap', icon: PieChart, label: 'Recap & OER' },
  ];

  return (
    <div className="w-64 bg-[#0B192C] text-white hidden md:flex flex-col h-screen fixed border-r border-[#1A2B4C] z-50">
      <div className="p-6 border-b border-[#1A2B4C]">
        <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>Flight Ops</h1>
        <p className="text-xs text-slate-400 mt-1">Training Management</p>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link key={item.path} to={item.path} data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-[#F4A261] text-white' : 'text-slate-300 hover:bg-[#1A2B4C] hover:text-white'}`}>
              <Icon size={18} />
              <span className="text-sm font-medium">{item.label}</span>
              {item.label === 'Dashboard' && notifications > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{notifications}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-[#1A2B4C]">
        <div className="mb-3 px-4 py-2 bg-[#1A2B4C] rounded-lg">
          <p className="text-sm font-medium">{user?.name}</p>
          <p className="text-xs text-slate-400">{user?.role}</p>
        </div>
        <button onClick={handleLogout} data-testid="logout-button"
          className="flex items-center gap-3 px-4 py-2 w-full rounded-lg text-slate-300 hover:bg-[#1A2B4C] hover:text-white transition-colors">
          <LogOut size={18} /><span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};
