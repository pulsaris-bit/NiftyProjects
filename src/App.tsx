/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  List, 
  Plus, 
  PlusCircle,
  Settings, 
  Layers, 
  Search, 
  ChevronRight,
  MoreHorizontal,
  Layout,
  ListTodo,
  Settings2,
  Inbox,
  Calendar,
  AlertCircle,
  Flag,
  CheckCircle2,
  Clock,
  Briefcase,
  Trash2,
  Edit2,
  GripVertical,
  Menu,
  X,
  ZoomIn,
  ZoomOut,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Link as LinkIcon,
  FileText,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  DndContext, 
  DragEndEvent, 
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  useDraggable, 
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  rectIntersection,
  closestCorners,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, Status, Priority, Space, User } from './types';
import { authService } from './lib/authService';
import { AuthModal } from './components/AuthModal';
import { ProfileModal } from './components/ProfileModal';
import { LogOut } from 'lucide-react';

// Mock initial data
const DEFAULT_COLUMNS = ['Te doen', 'Bezig', 'Klaar'];

const INITIAL_SPACES: Space[] = [
  { id: 'space-1', name: 'Product Branding', icon: 'Layers', color: '#7b68ee', emoji: '🎨', columns: DEFAULT_COLUMNS },
  { id: 'space-2', name: 'Web Ontwikkeling', icon: 'Briefcase', color: '#fbbf24', emoji: '💻', columns: DEFAULT_COLUMNS },
  { id: 'space-3', name: 'Marketing', icon: 'Flag', color: '#10b981', emoji: '📈', columns: DEFAULT_COLUMNS },
];

const INITIAL_TASKS: Task[] = [
  { 
    id: 'task-1', 
    title: 'Design system onderzoek', 
    description: 'Onderzoek doen naar concurrerende design systems.', 
    status: 'Bezig', 
    priority: 'Hoog', 
    spaceId: 'space-1', 
    dueDate: '2024-05-10',
    createdAt: new Date().toISOString() 
  },
  { 
    id: 'task-2', 
    title: 'Gebruikersinterview voorbereiding', 
    description: 'Script afronden voor de gebruikersinterviews.', 
    status: 'Te doen', 
    priority: 'Gemiddeld', 
    spaceId: 'space-1', 
    dueDate: '2024-05-12',
    createdAt: new Date().toISOString() 
  },
  { 
    id: 'task-3', 
    title: 'Auth flow implementeren', 
    description: 'Firebase auth koppelen aan de frontend.', 
    status: 'Klaar', 
    priority: 'Urgent', 
    spaceId: 'space-2', 
    dueDate: '2024-05-08',
    createdAt: new Date().toISOString() 
  },
];

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [spaces, setSpaces] = useState<Space[]>(INITIAL_SPACES);
  const [activeSpaceId, setActiveSpaceId] = useState<string>('space-1');
  const [view, setView] = useState<'board' | 'list'>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('niftyprojects_sidebar_width');
    return saved ? parseInt(saved, 10) : 280;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  
  const [currentUser, setCurrentUser] = useState<User | null>(() => authService.getSession());
  const [showAuthModal, setShowAuthModal] = useState(!authService.getSession());
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  const [isAddingSpace, setIsAddingSpace] = useState(false);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceEmoji, setNewSpaceEmoji] = useState('📁');
  
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = useMemo(() => tasks.find(t => t.id === selectedTaskId), [tasks, selectedTaskId]);

  // Load initial data from API
  useEffect(() => {
    async function loadData() {
      if (!currentUser) {
        setTasks([]);
        setSpaces(INITIAL_SPACES);
        return;
      }
      const token = authService.getToken();
      if (!token) return;

      try {
        const [spacesRes, tasksRes] = await Promise.all([
          fetch('/api/spaces', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/tasks', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (spacesRes.ok) {
          const fetchedSpaces = await spacesRes.json();
          if (fetchedSpaces.length > 0) {
            setSpaces(fetchedSpaces);
            setActiveSpaceId(fetchedSpaces[0].id);
          }
        }
        if (tasksRes.ok) {
          const fetchedTasks = await tasksRes.json();
          // The server now returns parsed objects for subtasks and attachments
          const normalizedTasks = fetchedTasks.map((t: any) => ({
            ...t,
            subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
            attachments: Array.isArray(t.attachments) ? t.attachments : []
          }));
          setTasks(normalizedTasks);
        }
      } catch (error) {
        console.error('Fout bij laden van data:', error);
      }
    }
    loadData();
  }, [currentUser]);

  useEffect(() => {
    if (isResizing) {
      const handleMouseMove = (e: MouseEvent) => {
        const newWidth = Math.min(Math.max(220, e.clientX), 450);
        setSidebarWidth(newWidth);
      };
      const handleMouseUp = () => {
        setIsResizing(false);
        localStorage.setItem('niftyprojects_sidebar_width', sidebarWidth.toString());
      };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, sidebarWidth]);

  const activeSpace = useMemo(() => {
    const space = spaces.find(s => s.id === activeSpaceId);
    if (space) return space;
    
    // Fallback for special views
    const specialNames: Record<string, string> = {
      'overview': 'Overzicht',
      'my-tasks': 'Mijn Taken',
      'inbox': 'Inbox'
    };
    
    return {
      id: activeSpaceId,
      name: specialNames[activeSpaceId] || 'Overzicht',
      emoji: '💠',
      icon: 'Layout',
      color: 'var(--color-accent)',
      columns: DEFAULT_COLUMNS
    } as Space;
  }, [activeSpaceId, spaces]);

  const filteredTasks = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const baseFilter = (t: Task) => 
      t.title.toLowerCase().includes(query) || 
      t.description.toLowerCase().includes(query);

    if (activeSpaceId === 'inbox') {
      return tasks.filter(t => baseFilter(t) && t.status === 'Te doen');
    }
    if (activeSpaceId === 'my-tasks' || activeSpaceId === 'overview') {
      return tasks.filter(t => baseFilter(t));
    }

    return tasks.filter(t => t.spaceId === activeSpaceId && baseFilter(t));
  }, [tasks, activeSpaceId, searchQuery]);

  const addTask = React.useCallback(async () => {
    if (!newTaskTitle.trim()) return;
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: newTaskTitle,
      description: '',
      status: 'Te doen',
      priority: 'Laag',
      spaceId: ['overview', 'my-tasks', 'inbox'].includes(activeSpaceId) ? (spaces[0]?.id || 'space-1') : activeSpaceId,
      createdAt: new Date().toISOString()
    };

    try {
      const token = authService.getToken();
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newTask)
      });
      setTasks(prev => [newTask, ...prev]);
      setNewTaskTitle('');
    } catch (error) {
      console.error('Fout bij opslaan taak:', error);
    }
  }, [newTaskTitle, activeSpaceId, spaces]);

  const updateTaskStatus = React.useCallback(async (taskId: string, newStatus: Status) => {
    try {
      const token = authService.getToken();
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (error) {
      console.error('Fout bij bijwerken status:', error);
    }
  }, []);

  const updateTaskPriority = React.useCallback(async (taskId: string, newPriority: Priority) => {
    try {
      const token = authService.getToken();
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ priority: newPriority })
      });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority: newPriority } : t));
    } catch (error) {
      console.error('Fout bij bijwerken prioriteit:', error);
    }
  }, []);

  const updateTaskDetails = React.useCallback(async (taskId: string, updates: Partial<Task>) => {
    try {
      const token = authService.getToken();
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updates)
      });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    } catch (error) {
      console.error('Fout bij bijwerken details:', error);
    }
  }, []);

  const addSpace = React.useCallback(async (name: string, emoji: string) => {
    if (!name.trim()) return;
    const newSpace: Space = {
      id: `space-${Date.now()}`,
      name: name,
      emoji: emoji,
      icon: 'Layers',
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      columns: DEFAULT_COLUMNS
    };

    try {
      const token = authService.getToken();
      await fetch('/api/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newSpace)
      });
      setSpaces(prev => [...prev, newSpace]);
      setActiveSpaceId(newSpace.id);
    } catch (error) {
      console.error('Fout bij toevoegen space:', error);
    }
  }, []);

  const updateSpace = React.useCallback(async (id: string, name: string, emoji: string) => {
    try {
      const token = authService.getToken();
      await fetch(`/api/spaces/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, emoji })
      });
      setSpaces(prev => prev.map(s => s.id === id ? { ...s, name, emoji } : s));
    } catch (error) {
      console.error('Fout bij bijwerken space:', error);
    }
  }, []);

  const deleteSpace = React.useCallback(async (id: string) => {
    if (spaces.length <= 1) {
      alert('Je moet minimaal één ruimte overhouden.');
      return;
    }
    if (confirm('Weet je zeker dat je deze ruimte en alle bijbehorende taken wilt verwijderen?')) {
      try {
        const token = authService.getToken();
        await fetch(`/api/spaces/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setSpaces(prev => prev.filter(s => s.id !== id));
        if (activeSpaceId === id) {
          setActiveSpaceId(spaces.find(s => s.id !== id)?.id || '');
        }
      } catch (error) {
        console.error('Fout bij verwijderen space:', error);
      }
    }
  }, [spaces, activeSpaceId]);

  const handleOpenSpaceModal = React.useCallback((space?: Space) => {
    if (space) {
      setEditingSpaceId(space.id);
      setNewSpaceName(space.name);
      setNewSpaceEmoji(space.emoji || '📁');
    } else {
      setEditingSpaceId(null);
      setNewSpaceName('');
      setNewSpaceEmoji('📁');
    }
    setIsAddingSpace(true);
  }, []);

  const addColumn = React.useCallback(async (name: string) => {
    if (!name.trim()) return;
    const currentSpace = spaces.find(s => s.id === activeSpaceId);
    if (!currentSpace) return;
    
    const updatedColumns = [...(currentSpace.columns || DEFAULT_COLUMNS), name];
    
    try {
      const token = authService.getToken();
      await fetch(`/api/spaces/${activeSpaceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ columns: updatedColumns })
      });
      setSpaces(prev => prev.map(s => s.id === activeSpaceId ? { ...s, columns: updatedColumns } : s));
      setNewColumnName('');
      setIsAddingColumn(false);
    } catch (error) {
      console.error('Fout bij toevoegen kolom:', error);
    }
  }, [activeSpaceId, spaces]);

  const removeColumn = React.useCallback(async (columnName: string) => {
    const currentActiveSpace = spaces.find(s => s.id === activeSpaceId);
    if (!currentActiveSpace) return;
    
    const updatedColumns = (currentActiveSpace.columns || DEFAULT_COLUMNS).filter(c => c !== columnName);
    
    try {
      const token = authService.getToken();
      await fetch(`/api/spaces/${activeSpaceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ columns: updatedColumns })
      });
      
      setSpaces(prev => prev.map(s => s.id === activeSpaceId ? { ...s, columns: updatedColumns } : s));
      setTasks(prev => {
        const fallbackStatus = updatedColumns[0] || 'Te doen';
        return prev.map(t => t.status === columnName && t.spaceId === activeSpaceId ? { ...t, status: fallbackStatus } : t);
      });
    } catch (error) {
      console.error('Fout bij verwijderen kolom:', error);
    }
  }, [activeSpaceId, spaces]);

  const renameColumn = React.useCallback(async (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    const currentSpace = spaces.find(s => s.id === activeSpaceId);
    if (!currentSpace) return;
    
    const updatedColumns = (currentSpace.columns || DEFAULT_COLUMNS).map(c => c === oldName ? newName : c);
    
    try {
      const token = authService.getToken();
      await fetch(`/api/spaces/${activeSpaceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ columns: updatedColumns })
      });
      
      setSpaces(prev => prev.map(s => s.id === activeSpaceId ? { ...s, columns: updatedColumns } : s));
      setTasks(prev => prev.map(t => t.status === oldName && t.spaceId === activeSpaceId ? { ...t, status: newName } : t));
    } catch (error) {
      console.error('Fout bij hernoemen kolom:', error);
    }
  }, [activeSpaceId, spaces]);

  const reorderColumns = React.useCallback(async (newColumns: string[]) => {
    try {
      const token = authService.getToken();
      await fetch(`/api/spaces/${activeSpaceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ columns: newColumns })
      });
      setSpaces(prev => prev.map(s => s.id === activeSpaceId ? { ...s, columns: newColumns } : s));
    } catch (error) {
      console.error('Fout bij herschikken kolommen:', error);
    }
  }, [activeSpaceId]);

  const deleteTask = React.useCallback(async (taskId: string) => {
    if (confirm('Weet je zeker dat je deze taak wilt verwijderen?')) {
      try {
        const token = authService.getToken();
        await fetch(`/api/tasks/${taskId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setTasks(prev => prev.filter(t => t.id !== taskId));
      } catch (error) {
        console.error('Fout bij verwijderen taak:', error);
      }
    }
  }, []);

  const renameTask = React.useCallback(async (taskId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      const token = authService.getToken();
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: newTitle })
      });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, title: newTitle } : t));
    } catch (error) {
      console.error('Fout bij hernoemen taak:', error);
    }
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setShowAuthModal(false);
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setShowAuthModal(true);
  };

  if (showAuthModal) {
    return <AuthModal onSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen w-full bg-[var(--color-surface-bg)] overflow-hidden relative">
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside 
        style={{ 
          width: isSidebarCollapsed 
            ? (window.innerWidth >= 1024 ? 72 : 280) 
            : (window.innerWidth >= 1024 ? sidebarWidth : 280) 
        }}
        className={`
          fixed inset-y-0 left-0 z-[70] bg-[var(--color-sidebar)] border-r border-[#38342f] flex flex-col lg:relative lg:translate-x-0 
          ${isResizing ? '' : 'transition-all duration-300'}
          ${isSidebarCollapsed ? 'p-4 lg:pt-6 items-center' : 'p-6 lg:pt-6'}
          ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className={`flex items-center justify-between mb-10 shrink-0 w-full ${isSidebarCollapsed ? 'flex-col gap-4' : ''}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="bg-[var(--color-accent)] p-2 rounded-xl shadow-lg shadow-orange-900/20 rotate-[5deg] shrink-0">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            {!isSidebarCollapsed && (
              <h1 className="text-xl font-bold text-[var(--color-sidebar-text)] tracking-tight truncate font-sans">NiftyProjects</h1>
            )}
          </div>
          {!isSidebarCollapsed && (
            <button 
              onClick={() => setIsMobileSidebarOpen(false)}
              className="lg:hidden p-2 text-[var(--color-sidebar-text-muted)] hover:text-[var(--color-sidebar-text)]"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Search Field */}
        {!isSidebarCollapsed && (
          <div className="mb-6 relative group">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-sidebar-text-muted)]" />
            <input 
              type="text" 
              placeholder="Zoeken..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-[13px] text-[var(--color-sidebar-text)] outline-none transition-all focus:border-[var(--color-accent)] focus:bg-white/10 placeholder:text-[var(--color-sidebar-text-muted)]"
            />
          </div>
        )}

        <nav className={`flex-1 space-y-8 overflow-y-auto custom-scrollbar-sidebar pb-4 w-full ${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
          <div className="space-y-4 w-full">
            {!isSidebarCollapsed && <p className="text-[11px] font-bold text-[var(--color-sidebar-text-muted)] uppercase tracking-wider px-0">Menu</p>}
            <div className={`space-y-1 w-full ${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
              {[
                { label: 'Overzicht', key: 'overview', icon: Layout },
                { label: 'Mijn Taken', key: 'my-tasks', icon: ListTodo },
                { label: 'Inbox', key: 'inbox', icon: Inbox }
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    setActiveSpaceId(item.key);
                    if (window.innerWidth < 1024) setIsMobileSidebarOpen(false);
                  }}
                  className={`flex items-center rounded-xl transition-all cursor-pointer ${
                    isSidebarCollapsed ? 'justify-center w-10 h-10' : 'w-full gap-3 py-2 px-3 text-sm'
                  } ${
                    activeSpaceId === item.key 
                      ? 'text-white font-semibold bg-[var(--color-accent)] shadow-lg shadow-orange-900/20' 
                      : 'text-[var(--color-sidebar-text-muted)] hover:text-[var(--color-sidebar-text)] hover:bg-white/5'
                  }`}
                  title={isSidebarCollapsed ? item.label : ''}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  {!isSidebarCollapsed && item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 w-full">
            {!isSidebarCollapsed && (
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-[var(--color-sidebar-text-muted)] uppercase tracking-wider px-0">Ruimtes</p>
                <button 
                  onClick={() => handleOpenSpaceModal()}
                  className="text-[var(--color-sidebar-text-muted)] hover:text-[var(--color-sidebar-text)] p-0.5 rounded hover:bg-white/5 transition-all outline-none"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className={`space-y-1 overflow-y-auto max-h-[40vh] custom-scrollbar w-full ${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
              {spaces.map(space => (
                <div 
                  key={space.id} 
                  onClick={() => {
                    setActiveSpaceId(space.id);
                    if (window.innerWidth < 1024) setIsMobileSidebarOpen(false);
                  }}
                  className={`group relative flex items-center rounded-xl transition-all cursor-pointer ${
                    isSidebarCollapsed ? 'justify-center w-10 h-10' : 'w-full gap-3 py-2 px-3 text-sm'
                  } ${
                    activeSpaceId === space.id 
                      ? 'text-[var(--color-sidebar-text)] font-semibold bg-white/10 shadow-sm' 
                      : 'text-[var(--color-sidebar-text-muted)] hover:text-[var(--color-sidebar-text)] hover:bg-white/5'
                  }`}
                  title={isSidebarCollapsed ? space.name : ''}
                >
                  <div className={`${isSidebarCollapsed ? '' : 'w-5'} flex items-center justify-center text-base`}>
                    {space.emoji || '📁'}
                  </div>
                  {!isSidebarCollapsed && <span className="truncate flex-1 text-left">{space.name}</span>}
                  
                  {!isSidebarCollapsed && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSpaceModal(space);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all outline-none"
                    >
                      <Settings className="w-3 h-3 text-[var(--color-sidebar-text)]" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </nav>

        <div className={`mt-auto pt-4 border-t border-white/10 w-full flex ${isSidebarCollapsed ? 'flex-col items-center gap-4' : 'items-center justify-between'}`}>
          <div 
            onClick={() => setIsEditingProfile(true)}
            className={`flex items-center gap-3 cursor-pointer group/profile ${isSidebarCollapsed ? 'flex-col' : 'flex-1 min-w-0'}`}
          >
            {currentUser?.avatar ? (
              <img 
                src={currentUser.avatar} 
                className="w-8 h-8 rounded-full border-2 border-white/20 shadow-sm group-hover/profile:border-[var(--color-accent)] transition-all"
                alt={currentUser.name}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-400 to-rose-400 border-2 border-white/20 flex items-center justify-center text-[10px] font-bold text-white shadow-sm transition-all group-hover/profile:border-[var(--color-accent)]">
                {currentUser?.name?.substring(0, 2).toUpperCase() || '??'}
              </div>
            )}
            {!isSidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-[12px] font-bold text-[var(--color-sidebar-text)] truncate group-hover/profile:text-[var(--color-accent)] transition-colors">{currentUser?.name}</span>
                <span className="text-[10px] text-[var(--color-sidebar-text-muted)] truncate">{currentUser?.email}</span>
              </div>
            )}
          </div>
          <div className={`flex items-center ${isSidebarCollapsed ? 'flex-col gap-2' : 'gap-1'}`}>
            {!isSidebarCollapsed && (
              <button 
                onClick={handleLogout}
                className="p-2 text-[var(--color-sidebar-text-muted)] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                title="Uitloggen"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 text-[var(--color-sidebar-text-muted)] hover:text-[var(--color-sidebar-text)] hover:bg-white/5 rounded-lg transition-all"
              title={isSidebarCollapsed ? "Toon sidebar" : "Verberg sidebar"}
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Resize Handle */}
        {!isSidebarCollapsed && (
          <div 
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
            className="hidden lg:block absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--color-accent)]/50 transition-colors z-[80]"
            title="Sleept om breedte aan te passen"
          />
        )}
      </aside>

      {/* Modal for adding/editing space */}
      <AnimatePresence>
        {isEditingProfile && currentUser && (
          <ProfileModal 
            user={currentUser} 
            onClose={() => setIsEditingProfile(false)} 
            onUpdate={setCurrentUser}
          />
        )}
        {isAddingSpace && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsAddingSpace(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-[var(--color-border)]"
            >
              <div className="p-8">
                <h2 className="text-xl font-bold text-[var(--color-text-main)] mb-1">
                  {editingSpaceId ? 'Ruimte Wijzigen' : 'Nieuwe Ruimte'}
                </h2>
                <p className="text-sm text-[var(--color-text-sub)] mb-8">
                  {editingSpaceId ? 'Pas de naam en het icoon van je ruimte aan.' : 'Creëer een aparte plek voor je team of projecten.'}
                </p>
                
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-16">
                      <label className="text-[11px] font-bold text-[var(--color-text-sub)] uppercase tracking-wider block mb-2 text-center">Icoon</label>
                      <div className="relative">
                        <input 
                          type="text" 
                          maxLength={2}
                          className="w-full aspect-square bg-gray-50 border border-[var(--color-border)] rounded-xl text-2xl text-center outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-orange-100 transition-all cursor-pointer"
                          value={newSpaceEmoji}
                          onChange={(e) => setNewSpaceEmoji(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-[11px] font-bold text-[var(--color-text-sub)] uppercase tracking-wider block mb-2">Naam van de ruimte</label>
                      <input 
                        autoFocus
                        type="text" 
                        placeholder="bijv. Marketing, Productie..." 
                        className="w-full bg-gray-50 border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-orange-100 transition-all font-medium"
                        value={newSpaceName}
                        onChange={(e) => setNewSpaceName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newSpaceName.trim()) {
                            if (editingSpaceId) {
                              updateSpace(editingSpaceId, newSpaceName, newSpaceEmoji);
                            } else {
                              addSpace(newSpaceName, newSpaceEmoji);
                            }
                            setIsAddingSpace(false);
                            setNewSpaceName('');
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-6 gap-2">
                    {['🎨', '💻', '📈', '🚀', '🧠', '📁', '🏠', '📅', '🔐', '🍕', '🏃', '🔔'].map(e => (
                      <button
                        key={e}
                        onClick={() => setNewSpaceEmoji(e)}
                        className={`aspect-square flex items-center justify-center rounded-lg border transition-all text-xl ${newSpaceEmoji === e ? 'bg-orange-50 border-[var(--color-accent)]' : 'bg-gray-50 border-gray-100 hover:border-gray-300'}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 px-8 py-5 flex flex-col sm:flex-row-reverse gap-3">
                <button 
                  onClick={() => {
                    if (newSpaceName.trim()) {
                      if (editingSpaceId) {
                        updateSpace(editingSpaceId, newSpaceName, newSpaceEmoji);
                      } else {
                        addSpace(newSpaceName, newSpaceEmoji);
                      }
                      setIsAddingSpace(false);
                      setNewSpaceName('');
                      setNewSpaceEmoji('📁');
                    }
                  }}
                  disabled={!newSpaceName.trim()}
                  className="bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-orange-200 hover:opacity-90 transition-all disabled:opacity-50 disabled:shadow-none"
                >
                  {editingSpaceId ? 'Wijzigingen Opslaan' : 'Ruimte Aanmaken'}
                </button>
                <button 
                  onClick={() => {
                    setIsAddingSpace(false);
                    setNewSpaceName('');
                    setNewSpaceEmoji('📁');
                  }}
                  className="px-6 py-3 text-sm font-semibold text-[var(--color-text-sub)] hover:text-[var(--color-text-main)] transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-[var(--color-bg)] overflow-hidden w-full">
        {/* Header */}
        <header className="bg-white border-b border-[var(--color-border)] px-4 lg:px-8 py-2 lg:h-[64px] flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-8">
          {/* Mobile Header Top Row */}
          <div className="flex items-center justify-between w-full lg:hidden">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-1.5 text-[var(--color-text-main)] hover:bg-gray-100 rounded-lg"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="text-[14px] text-[var(--color-text-main)] truncate font-bold">
                {activeSpace.name}
              </div>
            </div>
          </div>

          {/* Left Group: Breadcrumb + View Switcher + Add Column */}
          <div className="flex items-center gap-3 lg:gap-6 flex-1 min-w-0">
            {/* Desktop Sidebar Expand Button (Shown when sidebar is fixed but collapsed elsewhere) */}
            {isSidebarCollapsed && (
              <button 
                onClick={() => setIsSidebarCollapsed(false)}
                className="hidden lg:flex p-2 text-[var(--color-text-sub)] hover:text-[var(--color-text-main)] hover:bg-gray-100 rounded-lg transition-all"
                title="Toon sidebar"
              >
                <PanelLeftOpen className="w-6 h-6" />
              </button>
            )}

            <div className="flex items-center gap-2">
              {/* View Switcher */}
              <div className="flex bg-gray-50 p-1 rounded-lg border border-[var(--color-border)] shadow-sm w-fit shrink-0">
                <button 
                  onClick={() => setView('board')}
                  className={`flex items-center justify-center gap-2 px-3 sm:px-5 py-1 rounded-md text-[12px] sm:text-[13px] font-semibold transition-all ${
                    view === 'board' ? 'bg-white shadow-sm border border-[var(--color-border)] text-[var(--color-accent)]' : 'text-[var(--color-text-sub)] hover:text-[var(--color-text-main)]'
                  }`}
                >
                  Bord
                </button>
                <button 
                  onClick={() => setView('list')}
                  className={`flex items-center justify-center gap-2 px-3 sm:px-5 py-1 rounded-md text-[12px] sm:text-[13px] font-semibold transition-all ${
                    view === 'list' ? 'bg-white shadow-sm border border-[var(--color-border)] text-[var(--color-accent)]' : 'text-[var(--color-text-sub)] hover:text-[var(--color-text-main)]'
                  }`}
                >
                  Lijst
                </button>
              </div>

              {/* Nieuwe categorie button (Moved here) */}
              <div className="relative">
                <button 
                  onClick={() => setIsAddingColumn(true)}
                  className="p-1.5 text-[var(--color-text-sub)] hover:text-[var(--color-text-main)] hover:bg-gray-100 rounded-lg transition-all border border-transparent hover:border-[var(--color-border)]"
                  title="Nieuwe categorie toevoegen"
                >
                  <PlusCircle className="w-5 h-5 sm:w-6 s-6" />
                </button>
                  
                  <AnimatePresence>
                    {isAddingColumn && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-[var(--color-border)] z-50 p-4"
                      >
                        <p className="text-xs font-bold text-[var(--color-text-sub)] uppercase tracking-wider mb-3">Nieuwe categorie</p>
                        <input 
                          autoFocus
                          type="text"
                          placeholder="Naam bijv. 'Wachten'..."
                          className="w-full bg-gray-50 border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-[var(--color-accent)]"
                          value={newColumnName}
                          onChange={(e) => setNewColumnName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addColumn(newColumnName)}
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setIsAddingColumn(false)}
                            className="flex-1 px-3 py-1.5 text-xs font-semibold text-[var(--color-text-sub)] hover:bg-gray-50 rounded"
                          >
                            Annuleren
                          </button>
                          <button 
                            onClick={() => addColumn(newColumnName)}
                            className="flex-1 px-3 py-1.5 text-xs font-bold bg-[var(--color-accent)] text-white rounded"
                          >
                            Toevoegen
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)] px-3 py-1.5 mr-2">
              <ZoomOut className="w-3.5 h-3.5 text-[var(--color-text-sub)]" />
              <div className="flex flex-col gap-1">
                <input 
                  type="range"
                  min="50"
                  max="150"
                  step="5"
                  value={zoomLevel}
                  onChange={(e) => setZoomLevel(parseInt(e.target.value))}
                  className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                />
                <div className="flex justify-between text-[9px] font-bold text-[var(--color-text-sub)] uppercase tracking-tighter">
                  <span>50%</span>
                  <span>150%</span>
                </div>
              </div>
              <ZoomIn className="w-3.5 h-3.5 text-[var(--color-text-sub)]" />
              <span className="text-[11px] font-bold text-[var(--color-accent)] w-9 text-right ml-1">
                {zoomLevel}%
              </span>
            </div>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-auto p-4 lg:p-8 font-sans custom-scrollbar" style={{ zoom: zoomLevel / 100 }}>
          <div className="mb-8 p-4 bg-white rounded-2xl shadow-sm border border-[var(--color-border)] flex items-center gap-4 transition-all focus-within:ring-4 focus-within:ring-orange-50 focus-within:border-[var(--color-accent)]">
            <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-[var(--color-accent)] shrink-0">
              <Plus className="w-5 h-5" />
            </div>
            <input 
              type="text" 
              placeholder="Snel een nieuwe taak toevoegen... (Druk op Enter)"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
              className="flex-1 text-sm border-none focus:ring-0 p-0 outline-none text-[var(--color-text-main)] font-medium placeholder:text-gray-400"
            />
            {newTaskTitle.trim() && (
              <button 
                onClick={addTask}
                className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-100 hover:opacity-90 transition-all shrink-0"
              >
                Toevoegen
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {view === 'board' ? (
              <BoardView 
                key="board" 
                tasks={filteredTasks}
                allTasks={tasks} 
                setTasks={setTasks}
                activeSpaceId={activeSpaceId}
                searchQuery={searchQuery}
                columns={activeSpace.columns || DEFAULT_COLUMNS}
                onStatusChange={updateTaskStatus} 
                onPriorityChange={updateTaskPriority}
                onRemoveColumn={removeColumn}
                onRenameColumn={renameColumn}
                onReorderColumns={reorderColumns}
                onRenameTask={renameTask}
                onDeleteTask={deleteTask}
                onOpenTaskDetails={setSelectedTaskId}
              />
            ) : (
              <ListView 
                key="list" 
                tasks={filteredTasks} 
                onStatusChange={updateTaskStatus}
                onPriorityChange={updateTaskPriority}
                onRenameTask={renameTask}
                onDeleteTask={deleteTask}
                onOpenTaskDetails={setSelectedTaskId}
              />
            )}
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {selectedTask && (
          <TaskModal 
            task={selectedTask}
            onClose={() => setSelectedTaskId(null)}
            onUpdate={(updates: Partial<Task>) => selectedTaskId && updateTaskDetails(selectedTaskId, updates)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components
function BoardView({ tasks, allTasks, setTasks, activeSpaceId, searchQuery, columns, onStatusChange, onPriorityChange, onRemoveColumn, onRenameColumn, onReorderColumns, onRenameTask, onDeleteTask, onOpenTaskDetails }: { tasks: Task[], allTasks: Task[], setTasks: React.Dispatch<React.SetStateAction<Task[]>>, activeSpaceId: string, searchQuery: string, columns: string[], onStatusChange: (id: string, s: Status) => void, onPriorityChange: (id: string, p: Priority) => void, onRemoveColumn: (name: string) => void, onRenameColumn: (old: string, newName: string) => void, onReorderColumns: (cols: string[]) => void, onRenameTask: (id: string, title: string) => void, onDeleteTask: (id: string) => void, onOpenTaskDetails: (id: string) => void, key?: string }) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const statuses = columns;
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = allTasks.find(t => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeTask = allTasks.find(t => t.id === activeId);
    if (!activeTask) return;

    const isOverAStatus = statuses.includes(overId as Status);
    const overTask = allTasks.find(t => t.id === overId);
    const overStatus = isOverAStatus ? (overId as Status) : overTask?.status;

    if (overStatus && activeTask.status !== overStatus) {
      setTasks(prev => {
        const activeIndex = prev.findIndex(t => t.id === activeId);
        const newTasks = [...prev];
        newTasks[activeIndex] = { ...activeTask, status: overStatus };
        
        if (overTask) {
          const overIndex = prev.findIndex(t => t.id === overId);
          return arrayMove(newTasks, activeIndex, overIndex);
        }
        
        return newTasks;
      });
      // Save status change to backend
      onStatusChange(activeId as string, overStatus as Status);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    
    if (!over) return;

    if (active.data.current?.type === 'Column') {
      const activeIndex = statuses.indexOf(active.id as string);
      const overIndex = statuses.indexOf(over.id as string);
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        onReorderColumns(arrayMove(statuses, activeIndex, overIndex));
      }
      return;
    }

    if (active.id !== over.id) {
      setTasks(prev => {
        const activeIndex = prev.findIndex(t => t.id === active.id);
        const overIndex = prev.findIndex(t => t.id === over.id);
        if (activeIndex !== -1 && overIndex !== -1) {
          return arrayMove(prev, activeIndex, overIndex);
        }
        return prev;
      });
    }
  };

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.4',
        },
      },
    }),
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className="flex flex-col lg:flex-row gap-4 lg:h-full items-start lg:overflow-x-auto pb-32 custom-scrollbar scroll-smooth">
        <SortableContext 
          items={statuses} 
          strategy={isMobile ? verticalListSortingStrategy : horizontalListSortingStrategy}
        >
          {statuses.map(status => {
            const columnTasks = tasks.filter(t => t.status === status);
            return (
              <SortableColumn 
                key={status} 
                status={status} 
                taskCount={columnTasks.length}
                onRemove={() => onRemoveColumn(status)}
                onRename={(newName) => onRenameColumn(status, newName)}
              >
                <SortableContext 
                  items={columnTasks.map(t => t.id)} 
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-3 lg:gap-4 min-h-[200px]">
                    {columnTasks.map(task => (
                      <SortableTaskCard 
                        key={task.id} 
                        task={task} 
                        onStatusChange={onStatusChange} 
                        onPriorityChange={onPriorityChange} 
                        onRenameTask={onRenameTask}
                        onDeleteTask={onDeleteTask}
                        onOpenTaskDetails={onOpenTaskDetails}
                      />
                    ))}
                  </div>
                </SortableContext>
              </SortableColumn>
            );
          })}
        </SortableContext>
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeTask ? (
          <div className="w-[280px] cursor-grabbing">
            <TaskCard task={activeTask} onStatusChange={() => {}} onPriorityChange={() => {}} isGhost />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

const SortableColumn = React.memo(function SortableColumn({ status, taskCount, children, onRemove, onRename }: { status: Status, taskCount: number, children: React.ReactNode, onRemove: () => void, onRename: (name: string) => void, key?: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: status,
    data: {
      type: 'Column',
    }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(status);

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`w-full lg:flex-1 lg:min-w-[280px] lg:max-w-[320px] flex flex-col gap-4 p-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-column-bg)] transition-all ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      <div className="flex items-center justify-between px-1 py-1">
        <div className="flex items-center gap-2 flex-1">
          <div {...listeners} {...attributes} className="cursor-grab text-[var(--color-text-sub)] hover:text-[var(--color-text-main)] active:cursor-grabbing transition-colors">
            <GripVertical className="w-3.5 h-3.5" />
          </div>
          {isEditing ? (
            <input 
              autoFocus
              className="text-sm font-semibold bg-white border border-[var(--color-accent)] rounded px-1 outline-none w-full"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => {
                onRename(editName);
                setIsEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onRename(editName);
                  setIsEditing(false);
                }
                if (e.key === 'Escape') {
                  setEditName(status);
                  setIsEditing(false);
                }
              }}
            />
          ) : (
            <h3 className="text-sm font-semibold text-[var(--color-text-main)] flex items-center gap-2 truncate">
              {status}
              <span className="bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full text-[10px] font-bold">
                {taskCount}
              </span>
            </h3>
          )}
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-[var(--color-text-sub)] hover:text-[var(--color-text-main)] hover:bg-gray-100 p-1 rounded transition-all"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute right-0 mt-1 w-40 bg-white border border-[var(--color-border)] rounded-lg shadow-xl z-50 py-1 overflow-hidden"
                >
                  <button 
                    onClick={() => {
                      setIsEditing(true);
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--color-text-sub)] hover:bg-gray-50 hover:text-[var(--color-text-main)] transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Hernoemen
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm(`Weet je zeker dat je de categorie "${status}" wilt verwijderen?`)) {
                        onRemove();
                      }
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Verwijderen
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
      {children}
    </div>
  );
});

const SortableTaskCard = React.memo(function SortableTaskCard({ task, onStatusChange, onPriorityChange, onRenameTask, onDeleteTask, onOpenTaskDetails }: { task: Task, onStatusChange: (id: string, s: Status) => void, onPriorityChange: (id: string, p: Priority) => void, onRenameTask: (id: string, title: string) => void, onDeleteTask: (id: string) => void, onOpenTaskDetails?: (id: string) => void, key?: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
    }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      {...listeners} 
      {...attributes}
      className={`${isDragging ? 'opacity-30' : ''} touch-none`}
    >
      <TaskCard 
        task={task} 
        onStatusChange={onStatusChange} 
        onPriorityChange={onPriorityChange} 
        onRename={onRenameTask}
        onDelete={onDeleteTask}
        onOpenDetails={onOpenTaskDetails}
      />
    </div>
  );
});

const TaskCard = React.memo(function TaskCard({ task, onStatusChange, onPriorityChange, onRename, onDelete, onOpenDetails, isGhost }: { task: Task, onStatusChange: (id: string, s: Status) => void, onPriorityChange: (id: string, p: Priority) => void, onRename?: (id: string, title: string) => void, onDelete?: (id: string) => void, onOpenDetails?: (id: string) => void, isGhost?: boolean }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);

  return (
    <motion.div 
      layout={!isGhost}
      onClick={() => !isEditing && onOpenDetails?.(task.id)}
      className={`p-4 bg-white rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-[var(--color-border)] group hover:shadow-md transition-shadow cursor-pointer active:cursor-grabbing flex flex-col gap-3 relative ${isGhost ? 'rotate-2 shadow-xl ring-2 ring-[var(--color-accent)] border-transparent' : ''}`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1">
          {isEditing ? (
            <input 
              autoFocus
              className="text-sm font-medium text-[var(--color-text-main)] bg-gray-50 border border-[var(--color-accent)] rounded px-1 outline-none w-full"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => {
                onRename?.(task.id, editTitle);
                setIsEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onRename?.(task.id, editTitle);
                  setIsEditing(false);
                }
                if (e.key === 'Escape') {
                  setEditTitle(task.title);
                  setIsEditing(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h4 className="text-sm font-medium text-[var(--color-text-main)] leading-relaxed">
              {task.title}
            </h4>
          )}
        </div>
        
        {!isGhost && (
          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
              className="opacity-0 group-hover:opacity-100 text-[var(--color-text-sub)] hover:text-[var(--color-text-main)] p-1 rounded hover:bg-gray-100 transition-all"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            
            <AnimatePresence>
              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); }} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute right-0 mt-1 w-40 bg-white border border-[var(--color-border)] rounded-lg shadow-xl z-50 py-1 overflow-hidden"
                  >
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsEditing(true); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--color-text-sub)] hover:bg-gray-50 hover:text-[var(--color-text-main)] transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      Titel wijzigen
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete?.(task.id); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Verwijderen
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
        <div className="flex items-center justify-between mt-1">
        <PriorityMenu current={task.priority} onSelect={(p) => onPriorityChange(task.id, p)} />
        <div className="flex items-center gap-2">
          <StatusMenu current={task.status} onSelect={(s) => onStatusChange(task.id, s)} />
          <SubtaskProgress task={task} />
        </div>
      </div>
    </motion.div>
  );
});

function ListView({ tasks, onStatusChange, onPriorityChange, onRenameTask, onDeleteTask, onOpenTaskDetails }: { tasks: Task[], onStatusChange: (id: string, s: Status) => void, onPriorityChange: (id: string, p: Priority) => void, onRenameTask: (id: string, title: string) => void, onDeleteTask: (id: string) => void, onOpenTaskDetails: (id: string) => void, key?: string }) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[var(--color-border)]">
      <div className="overflow-x-auto pb-32">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-gray-50 border-b border-[var(--color-border)] text-[var(--color-text-sub)] font-semibold text-[11px] uppercase tracking-wider">
              <th className="px-6 py-4">Taaknaam</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Prioriteit</th>
              <th className="px-6 py-4">Vervaldatum</th>
              <th className="px-6 py-4 w-10 text-right pr-10">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {tasks.map(task => (
              <tr 
                key={task.id} 
                onClick={() => onOpenTaskDetails(task.id)}
                className="hover:bg-gray-50 transition-colors group cursor-pointer"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3 text-sm font-medium text-[var(--color-text-main)]">
                    {editingId === task.id ? (
                      <input 
                        autoFocus
                        className="text-sm font-medium text-[var(--color-text-main)] bg-white border border-[var(--color-accent)] rounded px-2 py-1 outline-none w-full shadow-sm"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => {
                          onRenameTask(task.id, editTitle);
                          setEditingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onRenameTask(task.id, editTitle);
                            setEditingId(null);
                          }
                          if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        {task.title}
                        <SubtaskProgress task={task} />
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <StatusMenu current={task.status} onSelect={(s) => onStatusChange(task.id, s)} />
                </td>
                <td className="px-6 py-4">
                  <PriorityMenu current={task.priority} onSelect={(p) => onPriorityChange(task.id, p)} />
                </td>
                <td className="px-6 py-4 text-xs text-[var(--color-text-sub)]">
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                </td>
                <td className="px-6 py-4 text-right pr-6 relative">
                  <button 
                    onClick={() => setMenuOpenId(menuOpenId === task.id ? null : task.id)}
                    className="text-[var(--color-text-sub)] hover:text-[var(--color-text-main)] p-1 rounded hover:bg-gray-100 transition-all"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  
                  <AnimatePresence>
                    {menuOpenId === task.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpenId(null)} />
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute right-6 mt-1 w-40 bg-white border border-[var(--color-border)] rounded-lg shadow-xl z-50 py-1 overflow-hidden text-left"
                        >
                          <button 
                            onClick={() => {
                              setEditTitle(task.title);
                              setEditingId(task.id);
                              setMenuOpenId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--color-text-sub)] hover:bg-gray-50 hover:text-[var(--color-text-main)] transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                            Naam wijzigen
                          </button>
                          <button 
                            onClick={() => {
                              onDeleteTask(task.id);
                              setMenuOpenId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            Verwijderen
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-[var(--color-text-sub)] text-[13px] italic">
                  Geen taken gevonden in deze ruimte.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const PRIORITY_STYLES: Record<Priority, string> = {
  'Laag': 'bg-gray-200 text-gray-600',
  'Gemiddeld': 'bg-[#fde68a] text-[#d97706]',
  'Hoog': 'bg-[#fecaca] text-[#ef4444]',
  'Urgent': 'bg-red-500 text-white'
};

const STATUS_COLORS: Record<Status, string> = {
  'Te doen': 'bg-gray-100 text-gray-600',
  'Bezig': 'bg-blue-100 text-blue-600',
  'Klaar': 'bg-emerald-100 text-emerald-600'
};

function SubtaskProgress({ task }: { task: Task }) {
  if (!Array.isArray(task.subtasks) || task.subtasks.length === 0) return null;
  
  const completed = task.subtasks.filter(st => st && st.completed).length;
  const total = task.subtasks.length;
  
  return (
    <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-sub)] bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 shrink-0">
      <ListTodo className="w-2.5 h-2.5" />
      <span className="font-medium">{completed}/{total}</span>
    </div>
  );
}

const PriorityMenu = React.memo(function PriorityMenu({ current, onSelect }: { current: Priority, onSelect: (p: Priority) => void }) {
  const [open, setOpen] = useState(false);
  const priorities: Priority[] = ['Laag', 'Gemiddeld', 'Hoog', 'Urgent'];

  return (
    <div className="relative">
      <button 
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide transition-all hover:opacity-80 cursor-pointer ${PRIORITY_STYLES[current] || 'bg-gray-100 text-gray-500'}`}
      >
        {current}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-[100]" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -5 }}
              className="absolute top-full left-0 mt-1 w-32 bg-white rounded-md shadow-xl border border-[var(--color-border)] z-[110] py-1 overflow-hidden"
            >
              {priorities.map(p => (
                <button
                  key={p}
                  onClick={(e) => { e.stopPropagation(); onSelect(p); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-[11px] font-semibold hover:bg-gray-50 flex items-center gap-2 ${p === current ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-sub)]'}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${(PRIORITY_STYLES[p] || 'bg-gray-400').split(' ')[0]}`} />
                  {p}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
});

const StatusMenu = React.memo(function StatusMenu({ current, onSelect }: { current: Status, onSelect: (s: Status) => void }) {
  const [open, setOpen] = useState(false);
  const statuses: Status[] = ['Te doen', 'Bezig', 'Klaar'];

  return (
    <div className="relative">
      <button 
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`flex items-center gap-1.5 rounded font-bold transition-colors text-[10px] px-1.5 py-0.5 ${STATUS_COLORS[current] || 'bg-gray-100 text-gray-500'} uppercase tracking-wider`}
      >
        {current}
        <ChevronRight className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-[100]" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -5 }}
              className="absolute top-full left-0 mt-1 w-32 bg-white rounded-md shadow-xl border border-[var(--color-border)] z-[110] py-1 overflow-hidden"
            >
              {statuses.map(s => (
                <button
                  key={s}
                  onClick={(e) => { e.stopPropagation(); onSelect(s); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-[11px] font-semibold hover:bg-gray-50 flex items-center gap-2 ${s === current ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-sub)]'}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${(STATUS_COLORS[s] || 'bg-gray-400').split(' ')[0]}`} />
                  {s}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
});


function TaskModal({ task, onClose, onUpdate }: { task: Task, onClose: () => void, onUpdate: (updates: Partial<Task>) => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${PRIORITY_STYLES[task.priority] || 'bg-gray-100 text-gray-600'}`}>
              {task.priority}
            </div>
            <h2 className="text-xl font-semibold text-[var(--color-text-main)] truncate max-w-2xl">{task.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-[var(--color-text-sub)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="space-y-12">
            {/* Row 1: Description & Subtasks (50/50 split for maximum width) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-10">
                {/* Description */}
                <section>
                  <label className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-sub)] uppercase tracking-wider mb-3">
                    <FileText className="w-3.5 h-3.5" />
                    Beschrijving
                  </label>
                  <textarea 
                    className="w-full h-64 p-4 bg-gray-50 border border-[var(--color-border)] rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none text-sm transition-all resize-none leading-relaxed"
                    placeholder="Voeg een gedetailleerde beschrijving toe..."
                    value={task.description || ''}
                    onChange={(e) => onUpdate({ description: e.target.value })}
                  />
                </section>

                {/* Link */}
                <section>
                  <label className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-sub)] uppercase tracking-wider mb-3">
                    <LinkIcon className="w-3.5 h-3.5" />
                    Link (URL)
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      className="flex-1 p-3 bg-gray-50 border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none text-sm transition-all"
                      placeholder="https://example.com"
                      value={task.link || ''}
                      onChange={(e) => onUpdate({ link: e.target.value })}
                    />
                    {task.link && (
                      <a 
                        href={task.link.startsWith('http') ? task.link : `https://${task.link}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl hover:bg-gray-100 transition-all text-[var(--color-accent)]"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                </section>
              </div>

              <div className="space-y-10">
                {/* Subtasks */}
                <section>
                  <label className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-sub)] uppercase tracking-wider mb-3">
                    <ListTodo className="w-3.5 h-3.5" />
                    Takenlijst
                  </label>
                  <div className="space-y-2">
                    {(Array.isArray(task.subtasks) ? task.subtasks : []).map((sub) => {
                      if (!sub || typeof sub !== 'object') return null;
                      return (
                        <div key={sub.id} className="flex items-center gap-3 p-3 bg-gray-50 border border-[var(--color-border)] rounded-xl group transition-all hover:bg-white shadow-sm border-transparent hover:border-[var(--color-border)]">
                          <button 
                            onClick={() => {
                              const updated = (task.subtasks || []).map(s => s && s.id === sub.id ? { ...s, completed: !s.completed } : s);
                              onUpdate({ subtasks: updated });
                            }}
                            className={`flex-shrink-0 transition-colors ${sub.completed ? 'text-emerald-500' : 'text-gray-300 hover:text-gray-400'}`}
                          >
                            {sub.completed ? <CheckCircle2 className="w-6 h-6" /> : <div className="w-6 h-6 rounded-full border-2 border-current" />}
                          </button>
                          <input 
                            type="text"
                            placeholder="Titel subtaak..."
                            value={sub.title || ''}
                            onChange={(e) => {
                              const updated = (task.subtasks || []).map(s => s && s.id === sub.id ? { ...s, title: e.target.value } : s);
                              onUpdate({ subtasks: updated });
                            }}
                            className={`flex-1 bg-transparent border-none outline-none text-base transition-all ${sub.completed ? 'text-gray-400 line-through' : 'text-[var(--color-text-main)]'}`}
                          />
                          <button 
                            onClick={() => {
                              onUpdate({ subtasks: (task.subtasks || []).filter(s => s && s.id !== sub.id) });
                            }}
                            className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 text-red-500 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                    <button 
                      onClick={() => {
                        onUpdate({ 
                          subtasks: [...(Array.isArray(task.subtasks) ? task.subtasks : []), { id: `sub-${Date.now()}`, title: '', completed: false }] 
                        });
                      }}
                      className="w-full p-4 border-2 border-dashed border-[var(--color-border)] rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-[var(--color-text-sub)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all bg-white/40 group"
                    >
                      <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      Taak toevoegen aan lijst
                    </button>
                  </div>
                </section>
              </div>
            </div>

            {/* Row 2: Attachments & Meta Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-10 border-t border-[var(--color-border)]">
              <div>
                {/* Attachments */}
                <section>
                  <label className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-sub)] uppercase tracking-wider mb-3">
                    <Paperclip className="w-3.5 h-3.5" />
                    Bijlagen
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(task.attachments || []).map((att) => (
                      <div key={att.id} className="flex items-center justify-between p-4 bg-gray-50 border border-[var(--color-border)] rounded-xl group transition-all hover:bg-white shadow-sm border-transparent hover:border-[var(--color-border)]">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-[var(--color-text-sub)]">
                            <Paperclip className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-medium text-[var(--color-text-main)] truncate">{att.name}</span>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onUpdate({ attachments: (task.attachments || []).filter(a => a.id !== att.id) }); }}
                          className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 text-red-500 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => {
                        const name = prompt('Bestandsnaam:');
                        if (name) {
                          onUpdate({ 
                            attachments: [...(task.attachments || []), { id: `att-${Date.now()}`, name, url: '#' }] 
                          });
                        }
                      }}
                      className="p-4 border-2 border-dashed border-[var(--color-border)] rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-[var(--color-text-sub)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all bg-white/40"
                    >
                      <Plus className="w-5 h-5" />
                      Bijlage
                    </button>
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                {/* Meta Info */}
                <section>
                  <label className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-sub)] uppercase tracking-wider mb-4">
                    <Settings2 className="w-3.5 h-3.5" />
                    Eigenschappen
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-gray-50 p-6 rounded-2xl border border-[var(--color-border)] shadow-inner">
                    <div>
                      <span className="block text-[10px] font-bold text-[var(--color-text-sub)] uppercase tracking-widest mb-2">Status</span>
                      <StatusMenu current={task.status} onSelect={(s) => onUpdate({ status: s })} />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-[var(--color-text-sub)] uppercase tracking-widest mb-2">Prioriteit</span>
                      <PriorityMenu current={task.priority} onSelect={(p) => onUpdate({ priority: p })} />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-[var(--color-text-sub)] uppercase tracking-widest mb-2">Aangemaakt</span>
                      <div className="flex items-center gap-2 text-sm text-[var(--color-text-main)] h-[38px] px-3 bg-white/60 rounded-xl border border-[var(--color-border)]">
                        <Clock className="w-4 h-4 text-[var(--color-text-sub)]" />
                        {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : '—'}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
