
import React from 'react';
import { APP_NAME, Icons } from '../constants';
import { User, UserRole, TaskFolder, FolderVisibility } from '../types';

import logo from '../logo.png';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
  children: React.ReactNode;
  activeTab?: 'dashboard' | 'users' | 'logs' | 'tasks';
  onTabChange?: (tab: 'dashboard' | 'users' | 'logs' | 'tasks') => void;
  folders?: TaskFolder[];
  activeFolderId?: string | null;
  onFolderSelect?: (folderId: string | null, view: 'MY_TASKS' | 'FOLDER' | 'ADMIN') => void;
  onCreateFolder?: () => void;
  activeView?: 'LIST' | 'MY_TASKS' | 'ADMIN';
  onViewChange?: (view: 'LIST' | 'MY_TASKS' | 'ADMIN') => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  user, onLogout, children, activeTab, onTabChange, 
  folders = [], activeFolderId, onFolderSelect, onCreateFolder,
  activeView, onViewChange
}) => {
  return (
    <div className="flex h-screen w-screen bg-bg text-primary overflow-hidden">
      
      {/* LEFT SIDEBAR (clickup style) */}
      {user && (
        <aside className="w-[280px] h-full border-r border-border bg-muted/20 flex flex-col flex-shrink-0 relative z-20">
          <div className="p-4 border-b border-border mb-2">
            <img src={logo} alt={APP_NAME} className="h-8 w-auto mb-6" />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-accent text-black flex items-center justify-center font-black text-sm">
                {user.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black truncate">{user.name}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest truncate">{user.role}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar py-2 px-3 space-y-6">
            
            {/* CORE NAVIGATION */}
            <div className="space-y-1">
              <button
                onClick={() => {
                  onTabChange?.('dashboard');
                  onFolderSelect?.(null, 'MY_TASKS');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold transition-all rounded ${activeTab === 'dashboard' ? 'bg-accent/10 border border-accent/20 text-accent' : 'text-gray-400 hover:bg-muted/50 hover:text-white'}`}
              >
                <Icons.Home className="w-4 h-4" /> Home
              </button>
              
              <button
                onClick={() => {
                  onTabChange?.('tasks');
                  onFolderSelect?.(null, 'MY_TASKS');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold transition-all rounded ${activeTab === 'tasks' && !activeFolderId ? 'bg-accent/10 border border-accent/20 text-accent' : 'text-gray-400 hover:bg-muted/50 hover:text-white'}`}
              >
                <Icons.Check className="w-4 h-4" /> My Tasks
              </button>

              {user.role === UserRole.ADMIN && (
                <>
                  <button
                    onClick={() => {
                      onTabChange?.('tasks');
                      onFolderSelect?.(null, 'ADMIN');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold transition-all rounded ${activeTab === 'tasks' && activeFolderId === null ? 'text-gray-400 hover:bg-muted/50 hover:text-white' : 'text-gray-400 hover:bg-muted/50 hover:text-white'}`}
                  >
                    <Icons.List className="w-4 h-4" /> All Tasks (Admin)
                  </button>
                  <button
                    onClick={() => onTabChange?.('users')}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold transition-all rounded ${activeTab === 'users' ? 'bg-accent/10 border border-accent/20 text-accent' : 'text-gray-400 hover:bg-muted/50 hover:text-white'}`}
                  >
                    <Icons.Settings className="w-4 h-4" /> User Management
                  </button>
                </>
              )}
            </div>

            {/* SPACES / FOLDERS */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-3 mb-2 group">
                <h3 className="text-[10px] uppercase font-black tracking-widest text-gray-500 group-hover:text-gray-400 transition-colors">Spaces</h3>
                <button
                  onClick={() => {
                     onTabChange?.('tasks');
                     onCreateFolder?.();
                  }}
                  className="text-gray-500 hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
                  title="New Folder"
                >
                  <Icons.Plus className="w-3 h-3" />
                </button>
              </div>

              <button
                onClick={() => {
                  onTabChange?.('tasks');
                  onFolderSelect?.('UNASSIGNED', 'FOLDER');
                }}
                className={`w-full flex items-center gap-3 px-3 py-1.5 text-xs font-bold transition-all rounded ${activeFolderId === 'UNASSIGNED' ? 'bg-white/10 text-white border border-white/10' : 'text-gray-400 hover:bg-muted/50 hover:text-white'}`}
              >
                <Icons.Folder className="w-3.5 h-3.5" /> Unassigned Works
              </button>

              {folders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => {
                    onTabChange?.('tasks');
                    onFolderSelect?.(folder.id, 'FOLDER');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-bold transition-all rounded group ${activeFolderId === folder.id ? 'bg-white/10 text-white border border-white/10' : 'text-gray-400 hover:bg-muted/50 hover:text-white'}`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icons.Folder className="w-3.5 h-3.5 text-gray-500 group-hover:text-accent" /> 
                    <span className="truncate">{folder.name}</span>
                  </div>
                  {folder.visibility === FolderVisibility.PRIVATE && <Icons.Shield className="w-3 h-3 flex-shrink-0 opacity-50" />}
                </button>
              ))}
            </div>

          </div>

          <div className="p-4 border-t border-border">
            <button
               onClick={onLogout}
               className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[10px] uppercase font-bold tracking-widest text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-all"
            >
               <Icons.LogOut className="w-3 h-3" /> Logout
            </button>
          </div>
        </aside>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full bg-bg relative overflow-hidden">
        
        {/* TOP BAR OR GLOBAL SEARCH/BREADCRUMBS */}
        {user && (
          <header className="h-14 border-b border-border bg-bg/95 flex items-center justify-between px-6 flex-shrink-0 relative z-10">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
               <span>Myntmore</span>
               <Icons.ChevronRight className="w-3 h-3 text-border" />
               <span className="text-white">
                 {activeTab === 'dashboard' ? 'Home' : 
                  activeTab === 'users' ? 'Admin Panel' : 
                  activeTab === 'tasks' ? (
                     activeFolderId === 'UNASSIGNED' ? 'Unassigned Works' :
                     activeFolderId ? folders.find(f => f.id === activeFolderId)?.name || 'Folder' :
                     activeView === 'MY_TASKS' ? 'My Tasks' : 'All Tasks'
                  ) : 'Workspace'}
               </span>
            </div>

            {/* View Switcher (Fix 5) */}
            {activeTab === 'tasks' && (
              <div className="flex bg-muted/50 p-1 rounded-sm border border-border">
                <button
                  onClick={() => onViewChange?.('LIST')}
                  className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all ${activeView === 'LIST' || activeView === 'ADMIN' ? 'bg-accent text-black' : 'text-gray-500 hover:text-white'}`}
                >
                  List View
                </button>
                <button
                  onClick={() => onViewChange?.('MY_TASKS')}
                  className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all ${activeView === 'MY_TASKS' ? 'bg-accent text-black' : 'text-gray-500 hover:text-white'}`}
                >
                  My Tasks
                </button>
              </div>
            )}
            <div className="flex items-center gap-4">
              <div className="bg-muted border border-border px-3 py-1.5 rounded flex items-center gap-2 text-gray-500 w-64 opacity-50 hover:opacity-100 cursor-not-allowed transition-opacity">
                <Icons.Search className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Search (Coming Soon)</span>
              </div>
            </div>
          </header>
        )}

        <main className="flex-1 overflow-y-auto custom-scrollbar relative">
           {children}
        </main>
        
      </div>
    </div>
  );
};

export default Layout;

