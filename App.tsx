
import React, { useState, useEffect, useCallback } from 'react';
import { AuthState, User, UserRole, DailyWorkUpdate, ProjectTask, TaskFolder, FolderType, FolderVisibility } from './types';
import { storageService } from './services/storageService';
import { generateMonthlyReport } from './services/geminiService';
import Layout from './components/Layout';
import WorkUpdateForm from './components/WorkUpdateForm';
import AdminDashboard from './components/AdminDashboard';
import UserManagement from './components/UserManagement';
import TaskSystem from './components/TaskSystem';
import { Icons, ACCENT_COLOR } from './constants';
import logo from './logo.png';
import { seedDummyData } from './services/seeder';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({ user: null, isAuthenticated: false });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'logs' | 'tasks'>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [updates, setUpdates] = useState<DailyWorkUpdate[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [isNewUpdateOpen, setIsNewUpdateOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [createAdminForm, setCreateAdminForm] = useState({ name: '', email: '', password: '' }); // New state for admin creation
  const [loginError, setLoginError] = useState('');
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false); // Toggle for create admin view
  const [isLoading, setIsLoading] = useState(false); // Global loading state for async operations
  const [folders, setFolders] = useState<TaskFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [taskView, setTaskView] = useState<'MY_TASKS' | 'FOLDER' | 'ADMIN'>('MY_TASKS');
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  // Initial load
  useEffect(() => {
    storageService.init();
    const storedAuth = localStorage.getItem('myntmore_auth');
    if (storedAuth) {
      setAuth(JSON.parse(storedAuth));
    }
    refreshData();
  }, []);

  const refreshData = useCallback(async () => {
    const [fetchedUsers, fetchedUpdates, fetchedTasks] = await Promise.all([
      storageService.getUsers(),
      storageService.getUpdates(),
      storageService.getTasks()
    ]);
    setUsers(fetchedUsers);
    setUpdates(fetchedUpdates);
    setProjectTasks(fetchedTasks);
  }, []);

  const refreshFolders = useCallback(async () => {
    if (auth.isAuthenticated && auth.user) {
      const fetchedFolders = await storageService.getFolders(auth.user.id, auth.user.role === UserRole.ADMIN);
      setFolders(fetchedFolders || []);
    }
  }, [auth]);

  useEffect(() => {
    refreshFolders();
  }, [auth.isAuthenticated, auth.user, refreshFolders]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError('');
    try {
      const allUsers = await storageService.getUsers();
      const user = allUsers.find(u => u.email === loginForm.email && u.password === loginForm.password);

      if (user) {
        if (!user.isActive) {
          setLoginError('Account is disabled. Contact admin.');
          return;
        }

        // Role verification
        if (loginView === 'ADMIN' && user.role !== UserRole.ADMIN) {
          setLoginError('Access Denied: Not an authorized administrator account.');
          return;
        }

        if (loginView === 'TEAM' && user.role !== UserRole.USER) {
          if (user.role === UserRole.ADMIN) {
            setLoginError('Please use the Admin Portal for administrator accounts.');
            return;
          }
        }

        const newAuth = { user, isAuthenticated: true };
        setAuth(newAuth);
        localStorage.setItem('myntmore_auth', JSON.stringify(newAuth));
        setLoginError('');
      } else {
        setLoginError('Invalid credentials.');
      }
    } catch (error) {
      console.error(error);
      setLoginError('Failed to connect to the server.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Create Admin
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError('');
    try {
      const newAdmin: User = {
        id: Math.random().toString(36).substr(2, 9), // Or let Supabase handle IDs if using Auth, but we are using custom table
        name: createAdminForm.name,
        email: createAdminForm.email,
        password: createAdminForm.password,
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: new Date().toISOString()
      };

      await storageService.saveUser(newAdmin);
      await refreshData();
      setIsCreatingAdmin(false);
      setLoginForm({ email: createAdminForm.email, password: createAdminForm.password });
      setLoginError('Admin account created. Please log in.');
      setCreateAdminForm({ name: '', email: '', password: '' });
    } catch (error: any) {
      console.error(error);
      const errorMessage = error?.message || '';
      if (errorMessage.includes('unique constraint') || errorMessage.includes('already exists')) {
        setLoginError('Account already exists with this email. Please back to login.');
      } else {
        setLoginError(`Failed to create admin account: ${errorMessage || 'Check your connection.'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };


  const handleLogout = () => {
    setAuth({ user: null, isAuthenticated: false });
    localStorage.removeItem('myntmore_auth');
    setActiveTab('dashboard');
  };

  const handleSubmitUpdate = async (update: DailyWorkUpdate) => {
    const success = await storageService.saveUpdate(update);
    if (success) {
      await refreshData();
      setIsNewUpdateOpen(false);
    } else {
      alert("Error: You have already submitted an update for this date.");
    }
  };

  const handleAddUser = async (userPart: Partial<User>) => {
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: userPart.name || 'Unknown',
      email: userPart.email || '',
      password: userPart.password || 'Temporary123',
      role: userPart.role || UserRole.USER,
      jobRole: userPart.jobRole || '',
      isActive: true,
      createdAt: new Date().toISOString()
    };
    await storageService.saveUser(newUser);
    await refreshData();
  };

  const handleUpdateUser = async (user: User) => {
    await storageService.saveUser(user);
    await refreshData();
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Are you sure? This will delete all user data.')) {
      await storageService.deleteUser(userId);
      await refreshData();
    }
  };

  const handleGenerateReport = async (userId: string, month: string) => {
    const user = users.find(u => u.id === userId);
    // Needed to fetch fresh updates potentially or filter from state
    const userUpdates = updates.filter(up => up.userId === userId && up.month === month);
    if (!user || userUpdates.length === 0) {
      throw new Error("No data for this user in selected month.");
    }
    return await generateMonthlyReport(userUpdates, user.name, month, projectTasks);
  };

  const [loginView, setLoginView] = useState<'SELECT' | 'ADMIN' | 'TEAM'>('SELECT');

  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-12">
          <div className="text-center flex flex-col items-center">
            <img src={logo} alt="Myntmore" className="logo-main h-16 mb-4 w-auto" />
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold">Internal Work Tracker</p>
          </div>

          {loginView === 'SELECT' ? (
            <div className="space-y-4">
              <button
                onClick={() => setLoginView('TEAM')}
                className="w-full bg-muted border border-border p-6 text-left hover:border-accent transition-all group"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black uppercase text-white mb-1 group-hover:text-accent transition-colors">Team Member</h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Log Daily Updates</p>
                  </div>
                  <Icons.ArrowRight className="text-gray-600 group-hover:text-accent transition-colors" />
                </div>
              </button>

              <button
                onClick={() => setLoginView('ADMIN')}
                className="w-full bg-muted border border-border p-6 text-left hover:border-accent transition-all group"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black uppercase text-white mb-1 group-hover:text-accent transition-colors">Administrator</h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Manage Users & Reports</p>
                  </div>
                  <Icons.ArrowRight className="text-gray-600 group-hover:text-accent transition-colors" />
                </div>
              </button>
            </div>
          ) : isCreatingAdmin ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-8">
                <button
                  onClick={() => {
                    setIsCreatingAdmin(false);
                    setLoginError('');
                  }}
                  className="text-gray-500 hover:text-white text-xs uppercase font-bold tracking-widest flex items-center transition-colors"
                >
                  <Icons.ArrowLeft className="mr-2 w-4 h-4" /> Back to Login
                </button>
                <span className="text-accent text-xs uppercase font-black tracking-widest border border-accent/20 px-3 py-1 rounded-full">
                  Create Admin
                </span>
              </div>

              <form onSubmit={handleCreateAdmin} className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-bold">Full Name</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-muted border border-border p-4 text-white outline-none focus:border-accent transition-colors font-medium"
                    value={createAdminForm.name}
                    onChange={(e) => setCreateAdminForm({ ...createAdminForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-bold">Corporate Email</label>
                  <input
                    type="email"
                    required
                    className="w-full bg-muted border border-border p-4 text-white outline-none focus:border-accent transition-colors font-medium"
                    value={createAdminForm.email}
                    onChange={(e) => setCreateAdminForm({ ...createAdminForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-bold">Password</label>
                  <input
                    type="password"
                    required
                    className="w-full bg-muted border border-border p-4 text-white outline-none focus:border-accent transition-colors font-medium"
                    value={createAdminForm.password}
                    onChange={(e) => setCreateAdminForm({ ...createAdminForm, password: e.target.value })}
                  />
                </div>

                {loginError && <p className="text-red-500 text-xs font-bold uppercase text-center bg-red-500/10 p-3 border border-red-500/20">{loginError}</p>}

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full p-5 font-black uppercase tracking-[0.2em] text-xs transition-colors ${isLoading ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-accent text-black hover:bg-white'
                    }`}
                >
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-8">
                <button
                  onClick={() => {
                    setLoginView('SELECT');
                    setLoginError('');
                    setLoginForm({ email: '', password: '' });
                  }}
                  className="text-gray-500 hover:text-white text-xs uppercase font-bold tracking-widest flex items-center transition-colors"
                >
                  <Icons.ArrowLeft className="mr-2 w-4 h-4" /> Back
                </button>
                <span className="text-accent text-xs uppercase font-black tracking-widest border border-accent/20 px-3 py-1 rounded-full">
                  {loginView === 'ADMIN' ? 'Admin Portal' : 'Team Portal'}
                </span>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-bold">Corporate Email</label>
                  <input
                    type="email"
                    required
                    className="w-full bg-muted border border-border p-4 text-white outline-none focus:border-accent transition-colors font-medium"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-bold">Password</label>
                  <input
                    type="password"
                    required
                    className="w-full bg-muted border border-border p-4 text-white outline-none focus:border-accent transition-colors font-medium"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  />
                </div>

                {loginError && <p className="text-red-500 text-xs font-bold uppercase text-center bg-red-500/10 p-3 border border-red-500/20">{loginError}</p>}

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full p-5 font-black uppercase tracking-[0.2em] text-xs transition-colors ${isLoading ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-accent text-black hover:bg-white'
                    }`}
                >
                  {isLoading ? 'Processing...' : (loginView === 'ADMIN' ? 'Access Admin Dashboard' : 'Access Workspace')}
                </button>
              </form>

              {loginView === 'ADMIN' && (
                <div className="text-center mt-4">
                  <button
                    onClick={() => setIsCreatingAdmin(true)}
                    className="text-gray-500 hover:text-accent text-[10px] uppercase font-bold tracking-widest transition-colors underline decoration-dotted"
                  >
                    Create Admin Account
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-border pt-8 text-center">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest leading-relaxed">
              Authorized access only. All activities are logged for auditing purposes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout
      user={auth.user}
      onLogout={handleLogout}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      folders={folders}
      activeFolderId={activeFolderId}
      onFolderSelect={(folderId, view) => {
        setActiveFolderId(folderId);
        setTaskView(view);
      }}
      onCreateFolder={() => setIsFolderModalOpen(true)}
    >
      {isNewUpdateOpen ? (
        <WorkUpdateForm
          user={auth.user!}
          onSubmit={handleSubmitUpdate}
          onCancel={() => setIsNewUpdateOpen(false)}
        />
      ) : activeTab === 'dashboard' ? (
        <div className="space-y-12">
          {auth.user?.role === UserRole.ADMIN ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-accent/10 border border-accent/20 p-4 rounded-lg mb-4">
                <div>
                  <h3 className="text-accent font-black uppercase text-xs tracking-widest">Admin Actions</h3>
                  <p className="text-[10px] text-gray-500 uppercase font-bold mt-1">Initialize system with dummy data for 8 users</p>
                </div>
                <button
                  onClick={async () => {
                    if (window.confirm("This will seed dummy data for 8 users. Continue?")) {
                      setIsLoading(true);
                      await seedDummyData();
                      await refreshData();
                      setIsLoading(false);
                    }
                  }}
                  className="bg-accent text-black px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-white transition-colors"
                >
                  Seed System Data
                </button>
              </div>
              <AdminDashboard
                users={users}
                updates={updates}
                onGenerateReport={handleGenerateReport}
                onViewDetails={(userId) => {
                  // Future: Detailed drill-down view
                  console.log('Viewing details for', userId);
                }}
              />
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex justify-between items-end border-b border-border pb-8">
                <div>
                  <h2 className="text-4xl font-black uppercase tracking-tighter text-white">Your Logs</h2>
                  <div className="flex items-center mt-2">
                    <p className="text-gray-500">Welcome back, {auth.user?.name}.</p>
                    {auth.user?.jobRole && (
                      <span className="ml-3 text-[10px] uppercase font-bold tracking-widest text-accent border border-accent/30 px-2 py-0.5 rounded-full">
                        {auth.user.jobRole}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setIsNewUpdateOpen(true)}
                  className="bg-accent text-black px-10 py-4 text-xs font-black uppercase tracking-widest hover:bg-white transition-colors flex items-center"
                >
                  <Icons.Plus /> <span className="ml-2">Submit Daily Update</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {updates
                  .filter(u => u.userId === auth.user?.id)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(log => (
                    <div key={log.id} className="bg-muted p-6 border border-border group hover:border-accent transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">{log.date}</p>
                          <h4 className="text-lg font-black uppercase tracking-tight">{log.tasks.length} Tasks Completed</h4>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-accent">{log.totalTime}h</p>
                          <p className="text-[10px] text-gray-500 uppercase font-bold">Score: {log.productivityScore}/10</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {log.tasks.slice(0, 3).map(t => (
                          <span key={t.id} className="text-[10px] uppercase font-bold px-2 py-1 bg-bg border border-border">
                            {t.description.length > 20 ? t.description.substring(0, 20) + '...' : t.description}
                          </span>
                        ))}
                        {log.tasks.length > 3 && <span className="text-[10px] text-gray-500 font-bold">+{log.tasks.length - 3} more</span>}
                      </div>
                    </div>
                  ))}

                {updates.filter(u => u.userId === auth.user?.id).length === 0 && (
                  <div className="py-20 text-center border-2 border-dashed border-border">
                    <p className="text-gray-500 uppercase tracking-widest text-sm font-bold">No logs found. Start by submitting your first update.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'users' ? (
        <UserManagement
          users={users}
          onAddUser={handleAddUser}
          onUpdateUser={handleUpdateUser}
          onDeleteUser={handleDeleteUser}
        />
      ) : activeTab === 'tasks' ? (
        <TaskSystem
          user={auth.user!}
          users={users}
          folders={folders}
          activeFolderId={activeFolderId}
          view={taskView}
          onRefreshFolders={refreshFolders}
        />
      ) : null}

      {isFolderModalOpen && (
        <FolderModal
            isOpen={isFolderModalOpen}
            onClose={() => setIsFolderModalOpen(false)}
            onSave={async (folderData: any) => {
                const folderId = Math.random().toString(36).substr(2, 9);
                await storageService.saveFolder({
                    ...folderData,
                    id: folderId,
                    ownerId: auth.user!.id,
                    type: auth.user!.role === UserRole.ADMIN ? FolderType.ADMIN : FolderType.USER,
                    createdAt: new Date().toISOString()
                } as TaskFolder);
                setIsFolderModalOpen(false);
                refreshFolders();
            }}
            users={users}
            isAdmin={auth.user?.role === UserRole.ADMIN}
        />
       )}
    </Layout>
  );
};

const FolderModal = ({ isOpen, onClose, onSave, users, isAdmin }: any) => {
    const [formData, setFormData] = useState({
        name: '',
        visibility: FolderVisibility.PUBLIC,
        accessibleUserIds: [] as string[]
    });

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-bg border border-border w-full max-w-md flex flex-col">
                <div className="p-6 border-b border-border flex justify-between items-center">
                    <h3 className="text-xl font-black uppercase text-white">Create Repository</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white"><Icons.X /></button>
                </div>
                <div className="p-8 space-y-6">
                    <div>
                        <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-black">Folder Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-muted border border-border p-3 text-white outline-none focus:border-accent font-bold"
                            placeholder="PROJECT X"
                        />
                    </div>
                    {isAdmin && (
                        <div>
                            <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-black">Visibility Control</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[FolderVisibility.PUBLIC, FolderVisibility.PRIVATE, FolderVisibility.SELECTIVE].map(v => (
                                    <button
                                        key={v}
                                        onClick={() => setFormData({ ...formData, visibility: v })}
                                        className={`p-2 text-[8px] font-black uppercase tracking-tighter border ${formData.visibility === v ? 'bg-accent text-black border-accent' : 'bg-muted border-border text-gray-500'}`}
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {isAdmin && formData.visibility === FolderVisibility.SELECTIVE && (
                        <div>
                            <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-black">Grant Access</label>
                            <div className="max-h-32 overflow-y-auto border border-border bg-muted p-2 space-y-1">
                                {users.map((u: User) => (
                                    <label key={u.id} className="flex items-center gap-2 text-[10px] uppercase font-bold text-gray-400 p-1 hover:bg-bg cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.accessibleUserIds.includes(u.id)}
                                            onChange={e => {
                                                const ids = e.target.checked
                                                    ? [...formData.accessibleUserIds, u.id]
                                                    : formData.accessibleUserIds.filter(id => id !== u.id);
                                                setFormData({ ...formData, accessibleUserIds: ids });
                                            }}
                                            className="accent-accent"
                                        />
                                        {u.name}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-6 border-t border-border flex justify-end gap-4 bg-muted/30">
                    <button onClick={onClose} className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors">Cancel</button>
                    <button
                        onClick={() => onSave(formData)}
                        className="bg-accent text-black px-10 py-3 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white transition-colors"
                    >
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
};

export default App;
