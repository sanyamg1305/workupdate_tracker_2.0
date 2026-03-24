import React, { useState, useEffect } from 'react';
import {
    ProjectTask,
    TaskFolder,
    User,
    UserRole,
    ProjectTaskStatus,
    ProjectTaskPriority,
    FolderType,
    FolderVisibility
} from '../types';
import { storageService } from '../services/storageService';
import { Icons } from '../constants';

interface TaskSystemProps {
    user: User;
    users: User[];
    folders?: TaskFolder[];
    activeFolderId?: string | null;
    view?: 'MY_TASKS' | 'FOLDER' | 'ADMIN';
    onRefreshFolders?: () => void;
}

const TaskSystem: React.FC<TaskSystemProps> = ({ user, users, folders = [], activeFolderId, view = 'MY_TASKS', onRefreshFolders }) => {
    const [tasks, setTasks] = useState<ProjectTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [user, view, activeFolderId]);

    const fetchData = async (silent: boolean = false) => {
        if (!silent) setIsLoading(true);

        const timeoutId = setTimeout(() => {
            if (!silent) setIsLoading(false);
        }, 5000);

        try {
            const isAdmin = user.role === UserRole.ADMIN;
            let fetchedTasks: ProjectTask[] = [];
            if (view === 'ADMIN' && isAdmin) {
                fetchedTasks = await storageService.getTasks();
            } else {
                fetchedTasks = await storageService.getTasksByUser(user.id);
            }
            setTasks(fetchedTasks || []);
        } catch (error) {
            console.error("Error fetching task data:", error);
            setTasks([]);
        } finally {
            clearTimeout(timeoutId);
            if (!silent) setIsLoading(false);
        }
    };

    const filteredTasks = (tasks || []).filter(task => {
        if (activeFolderId === 'UNASSIGNED') return !task.folderId && ((task.assignedUserIds || []).includes(user.id) || (task.collaboratorIds || []).includes(user.id));
        if (activeFolderId) return task.folderId === activeFolderId;
        if (view === 'MY_TASKS' && !activeFolderId) return (task.assignedUserIds || []).includes(user.id) || (task.collaboratorIds || []).includes(user.id);
        return true; 
    });

    const activeTasks = filteredTasks.filter(t => t.status !== ProjectTaskStatus.COMPLETED);
    const completedTasks = filteredTasks.filter(t => t.status === ProjectTaskStatus.COMPLETED);

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg">
            {/* Header */}
            <div className="p-6 border-b border-border flex justify-between items-center bg-bg sticky top-0 z-10">
                <div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                        {activeFolderId === 'UNASSIGNED' ? 'Unassigned Tasks' : (activeFolderId ? folders.find(f => f.id === activeFolderId)?.name : (view === 'ADMIN' ? 'All Tasks' : 'My Tasks'))}
                    </h2>
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-1">
                        {filteredTasks.length} {filteredTasks.length === 1 ? 'Task' : 'Tasks'} Total
                    </p>
                </div>
                <button
                    onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
                    className="bg-accent text-black px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-white transition-colors flex items-center gap-2 rounded-sm"
                >
                    <Icons.Plus className="w-4 h-4" /> New Task
                </button>
            </div>

            {/* List Header */}
            <div className="grid grid-cols-[1fr_120px_150px_100px_120px_60px] gap-4 px-6 py-3 border-b border-border bg-muted/30 text-[10px] uppercase font-black tracking-widest text-gray-400 sticky top-[81px] z-10">
                <div className="pl-8">Task Name</div>
                <div>Status</div>
                <div>Assignee</div>
                <div>Due Date</div>
                <div>Priority</div>
                <div className="text-right">Est.</div>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
                {isLoading ? (
                    <div className="flex items-center justify-center p-12">
                        <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-gray-500 animate-pulse">Loading Tasks...</p>
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 border-b border-dashed border-border/50">
                        <p className="text-gray-500 uppercase tracking-widest text-xs font-bold">No tasks found here.</p>
                    </div>
                ) : (
                    <div>
                        {activeTasks.map(task => (
                            <TaskRow
                                key={task.id}
                                task={task}
                                user={user}
                                users={users}
                                onEdit={() => { setEditingTask(task); setIsTaskModalOpen(true); }}
                                onRefresh={(silent) => fetchData(silent === true)}
                                expanded={expandedTaskId === task.id}
                                onToggleExpand={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                            />
                        ))}

                        {completedTasks.length > 0 && (
                            <div className="mt-8">
                                <div className="px-6 py-3 bg-muted/20 border-y border-border flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-gray-500">
                                    <Icons.Check className="w-3 h-3" /> Completed Tasks ({completedTasks.length})
                                </div>
                                {completedTasks.map(task => (
                                    <TaskRow
                                        key={task.id}
                                        task={task}
                                        user={user}
                                        users={users}
                                        onEdit={() => { setEditingTask(task); setIsTaskModalOpen(true); }}
                                        onRefresh={(silent) => fetchData(silent === true)}
                                        expanded={expandedTaskId === task.id}
                                        onToggleExpand={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Task Creation Modal */}
            {isTaskModalOpen && (
                <TaskModal
                    isOpen={isTaskModalOpen}
                    onClose={() => setIsTaskModalOpen(false)}
                    onSave={async (taskData) => {
                        const taskId = editingTask?.id || Math.random().toString(36).substr(2, 9);
                        await storageService.saveTask({
                            ...taskData,
                            id: taskId,
                            createdAt: editingTask?.createdAt || new Date().toISOString()
                        } as ProjectTask);
                        setIsTaskModalOpen(false);
                        fetchData(true);
                    }}
                    users={users}
                    currentUserId={user.id}
                    initialData={editingTask}
                    activeFolderId={activeFolderId}
                    folders={folders}
                />
            )}
        </div>
    );
};

const TaskRow = ({ task, user, users, onEdit, onRefresh, expanded, onToggleExpand }: any) => {
    const isCompleted = task.status === ProjectTaskStatus.COMPLETED;
    const [subtaskTitle, setSubtaskTitle] = useState('');

    const toggleComplete = async () => {
        const newStatus = isCompleted ? ProjectTaskStatus.IN_PROGRESS : ProjectTaskStatus.COMPLETED;
        await storageService.saveTask({ ...task, status: newStatus });
        onRefresh(true);
    };

    return (
        <div className="border-b border-border/50 group hover:bg-muted/10 transition-colors">
            {/* Main Row */}
            <div className="grid grid-cols-[1fr_120px_150px_100px_120px_60px] gap-4 px-6 py-3 items-center cursor-pointer" onClick={onToggleExpand}>
                {/* Task Name & Completion */}
                <div className="flex items-center gap-3 min-w-0 pr-4">
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleComplete(); }}
                        className={`flex-shrink-0 w-4 h-4 rounded-sm border flex items-center justify-center transition-all ${isCompleted ? 'bg-accent border-accent text-black' : 'border-gray-600 hover:border-accent block text-transparent'}`}
                    >
                        <Icons.Check className="w-3 h-3" />
                    </button>
                    <div className="flex-1 min-w-0 flex flex-col">
                        <span className={`text-sm font-bold truncate transition-colors ${isCompleted ? 'line-through text-gray-500' : 'text-white group-hover:text-accent'}`}>{task.title || 'Untitled'}</span>
                        {task.client && (
                             <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold truncate">{task.client}</span>
                        )}
                    </div>
                </div>

                {/* Status Dropdown */}
                <div onClick={e => e.stopPropagation()}>
                    <select
                        value={task.status}
                        onChange={(e) => {
                            storageService.saveTask({ ...task, status: e.target.value as ProjectTaskStatus }).then(() => onRefresh(true));
                        }}
                        className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-sm border outline-none appearance-none cursor-pointer text-center w-full
                            ${task.status === ProjectTaskStatus.COMPLETED ? 'bg-green-500/10 border-green-500/30 text-green-500' :
                              task.status === ProjectTaskStatus.IN_PROGRESS ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' : 
                              'bg-gray-500/10 border-gray-500/30 text-gray-400'
                            }
                        `}
                    >
                        <option value={ProjectTaskStatus.NOT_STARTED}>To Do</option>
                        <option value={ProjectTaskStatus.IN_PROGRESS}>In Progress</option>
                        <option value={ProjectTaskStatus.COMPLETED}>Done</option>
                    </select>
                </div>

                {/* Assignees */}
                <div className="flex items-center -space-x-1">
                    {(task.assignedUserIds || []).slice(0, 3).map((aid: any) => (
                        <div key={aid} title={users.find((u: any) => u.id === aid)?.name} className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center text-[9px] font-black text-white relative z-10 shadow-sm">
                            {users.find((u: any) => u.id === aid)?.name?.charAt(0) || '?'}
                        </div>
                    ))}
                    {(task.assignedUserIds?.length > 3) && (
                        <div className="w-6 h-6 rounded-full bg-bg border border-border flex items-center justify-center text-[9px] font-black text-gray-500 relative z-10">
                            +{task.assignedUserIds.length - 3}
                        </div>
                    )}
                </div>

                {/* Due Date */}
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                    <Icons.Calendar className="w-3 h-3 text-gray-600" />
                    {task.endDate ? new Date(task.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-'}
                </div>

                {/* Priority */}
                <div>
                     <span className={`text-[8px] font-black px-2 py-1 uppercase tracking-widest rounded-sm border ${
                            task.priority === ProjectTaskPriority.HIGH ? 'bg-red-500/10 border-red-500/30 text-red-500' :
                            task.priority === ProjectTaskPriority.MEDIUM ? 'bg-accent/10 border-accent/30 text-accent' :
                            'bg-gray-500/10 border-gray-500/30 text-gray-500'
                     }`}>
                        {task.priority === ProjectTaskPriority.HIGH ? 'Urgent' : task.priority === ProjectTaskPriority.MEDIUM ? 'Normal' : 'Low'}
                     </span>
                </div>

                {/* Estimates */}
                <div className="text-[10px] font-black text-gray-500 text-right">
                    {task.timeEstimate ? `${task.timeEstimate}h` : '-'}
                </div>
            </div>

            {/* Expanded Detail View */}
            {expanded && (
                <div className="pl-[3.25rem] pr-6 pb-6 pt-2 bg-muted/5 border-t border-border/30">
                     <div className="flex items-start justify-between gap-8">
                         <div className="flex-1 max-w-3xl">
                             <p className="text-xs text-gray-400 leading-relaxed mb-6 whitespace-pre-wrap">{task.description || 'No description provided.'}</p>
                             
                             {/* Subtasks */}
                             <div className="space-y-3">
                                 <h5 className="text-[10px] uppercase font-black tracking-widest text-gray-500 flex items-center gap-2">
                                     <Icons.List className="w-3 h-3" /> Subtasks ({task.subtasks?.length || 0})
                                 </h5>
                                 
                                 {task.subtasks?.map((sub: any) => (
                                     <div key={sub.id} className="flex items-center gap-3 group/sub">
                                         <button
                                             onClick={async () => {
                                                 const updated = task.subtasks.map((s: any) => s.id === sub.id ? { ...s, isCompleted: !s.isCompleted } : s);
                                                 await storageService.saveTask({ ...task, subtasks: updated });
                                                 onRefresh(true);
                                             }}
                                             className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${sub.isCompleted ? 'bg-accent border-accent text-black' : 'border-gray-600 hover:border-accent text-transparent'}`}
                                         >
                                             <Icons.Check className="w-2.5 h-2.5" />
                                         </button>
                                         <span className={`text-xs font-bold transition-colors ${sub.isCompleted ? 'text-gray-600 line-through' : 'text-gray-300'}`}>{sub.title}</span>
                                     </div>
                                 ))}

                                 {/* Add subtask inline */}
                                 <div className="flex items-center gap-3 mt-2">
                                     <div className="w-3.5 h-3.5 rounded-sm border border-border border-dashed flex items-center justify-center text-gray-600">
                                         <Icons.Plus className="w-2.5 h-2.5" />
                                     </div>
                                     <input
                                         type="text"
                                         value={subtaskTitle}
                                         onChange={e => setSubtaskTitle(e.target.value)}
                                         placeholder="Add subtask..."
                                         className="bg-transparent border-none outline-none text-xs text-white font-bold placeholder-gray-600 flex-1"
                                         onKeyDown={async (e) => {
                                             if (e.key === 'Enter' && subtaskTitle.trim()) {
                                                 const newSub = { id: Math.random().toString(36).substr(2, 9), title: subtaskTitle.trim(), isCompleted: false };
                                                 await storageService.saveTask({ ...task, subtasks: [...(task.subtasks || []), newSub] });
                                                 setSubtaskTitle('');
                                                 onRefresh(true);
                                             }
                                         }}
                                     />
                                 </div>
                             </div>
                         </div>

                         {/* Action Buttons */}
                         <div className="flex flex-col gap-2 min-w-[140px]">
                             <button
                                 onClick={onEdit}
                                 className="w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white bg-muted border border-border flex items-center gap-2 hover:bg-accent hover:text-black hover:border-accent transition-colors rounded-sm"
                             >
                                 <Icons.Settings className="w-3 h-3" /> Edit Task
                             </button>
                             <button
                                 onClick={async () => {
                                     if (window.confirm("Permanently delete this task?")) {
                                         await storageService.deleteTask(task.id);
                                         onRefresh(true);
                                     }
                                 }}
                                 className="w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 bg-muted/50 border border-border flex items-center gap-2 hover:bg-red-500/10 hover:text-red-500 transition-colors rounded-sm"
                             >
                                 <Icons.Trash className="w-3 h-3" /> Delete Task
                             </button>
                         </div>
                     </div>
                </div>
            )}
        </div>
    );
};

// Simplified Task Modal adapted for styling
const TaskModal = ({ isOpen, onClose, onSave, users, currentUserId, initialData, activeFolderId, folders = [] }: any) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [formData, setFormData] = useState({
        title: initialData?.title || '',
        description: initialData?.description || '',
        client: initialData?.client || '',
        assignedUserIds: initialData?.assignedUserIds || (currentUserId ? [currentUserId] : []),
        primaryOwnerId: initialData?.primaryOwnerId || currentUserId || null,
        collaboratorIds: initialData?.collaboratorIds || [],
        isCollaborative: initialData?.isCollaborative || false,
        folderId: initialData?.folderId || activeFolderId || null,
        startDate: initialData?.startDate || new Date().toISOString().split('T')[0],
        endDate: initialData?.endDate || new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
        timeEstimate: initialData?.timeEstimate || 4,
        status: initialData?.status || ProjectTaskStatus.NOT_STARTED,
        priority: initialData?.priority || ProjectTaskPriority.MEDIUM,
        subtasks: initialData?.subtasks || []
    });

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-bg border border-border w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                    <h3 className="text-xl font-black uppercase tracking-tight text-white">{initialData ? 'Edit Task Specification' : 'New Task Specification'}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><Icons.X /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                    {/* ... Same modal forms as previous but fully themed ... */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-black">Task Title</label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                className="w-full bg-muted border border-border p-3 text-white outline-none focus:border-accent font-bold rounded-sm"
                                placeholder="E.g. Database Migration"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-black">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="w-full bg-muted border border-border p-3 text-white outline-none focus:border-accent h-24 resize-none rounded-sm"
                                placeholder="Provide detailed context..."
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-black">Client / Project Code</label>
                            <input
                                type="text"
                                value={formData.client}
                                onChange={e => setFormData({ ...formData, client: e.target.value })}
                                className="w-full bg-muted border border-border p-3 text-white outline-none focus:border-accent font-bold uppercase rounded-sm"
                                placeholder="INT-001"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-black">Space / Folder</label>
                            <select
                                value={formData.folderId || 'UNASSIGNED'}
                                onChange={e => setFormData({ ...formData, folderId: e.target.value === 'UNASSIGNED' ? null : e.target.value })}
                                className="w-full bg-muted border border-border p-3 text-white outline-none focus:border-accent font-bold uppercase rounded-sm appearance-none cursor-pointer"
                            >
                                <option value="UNASSIGNED">-- Unassigned --</option>
                                {folders.map((f: any) => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-black">Primary Owner</label>
                            <select
                                value={formData.primaryOwnerId || ''}
                                onChange={e => setFormData({ ...formData, primaryOwnerId: e.target.value || null })}
                                className="w-full bg-muted border border-border p-3 text-white outline-none focus:border-accent font-bold uppercase rounded-sm cursor-pointer"
                            >
                                <option value="">-- None --</option>
                                {users.map((u: User) => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                        
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-black">Select Assigned Users</label>
                            <div className="max-h-32 overflow-y-auto p-2 bg-muted border border-border rounded-sm custom-scrollbar">
                                {users.map((u: User) => (
                                    <label key={u.id} className="flex items-center gap-2 p-1.5 hover:bg-bg cursor-pointer transition-colors group">
                                        <input
                                            type={formData.isCollaborative ? "checkbox" : "radio"}
                                            name="assignedUser"
                                            checked={formData.assignedUserIds.includes(u.id)}
                                            onChange={e => {
                                                if (formData.isCollaborative) {
                                                    const ids = e.target.checked
                                                        ? [...formData.assignedUserIds, u.id]
                                                        : formData.assignedUserIds.filter((id: string) => id !== u.id);
                                                    setFormData({ ...formData, assignedUserIds: ids });
                                                } else {
                                                    setFormData({ ...formData, assignedUserIds: [u.id] });
                                                }
                                            }}
                                            className="accent-accent w-3 h-3 cursor-pointer"
                                        />
                                        <span className="text-xs font-bold text-gray-400 group-hover:text-white">{u.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="col-span-2">
                             <div className="flex items-center justify-between p-4 bg-muted border border-border rounded-sm">
                                 <div>
                                     <h4 className="text-[10px] font-black uppercase tracking-widest text-white mt-0">Collaborative Delivery</h4>
                                     <p className="text-[10px] text-gray-500 font-bold tracking-wide mt-1">Allow multiple members to be assigned to this task simultaneously.</p>
                                 </div>
                                 <button
                                     onClick={() => {
                                         const willBeCollab = !formData.isCollaborative;
                                         setFormData({ 
                                             ...formData, 
                                             isCollaborative: willBeCollab, 
                                             collaboratorIds: willBeCollab ? formData.collaboratorIds : [],
                                             assignedUserIds: !willBeCollab && formData.assignedUserIds.length > 1 ? [formData.assignedUserIds[0]] : formData.assignedUserIds
                                         });
                                     }}
                                     className={`w-10 h-5 rounded-full transition-colors relative ${formData.isCollaborative ? 'bg-accent' : 'bg-gray-700'}`}
                                 >
                                     <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${formData.isCollaborative ? 'right-0.5' : 'left-0.5'}`} />
                                 </button>
                             </div>
                        </div>

                        {formData.isCollaborative && (
                            <div className="col-span-2">
                                <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-black">Add Additional Contributors</label>
                                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-muted border border-border rounded-sm custom-scrollbar">
                                    {users.filter((u: User) => !formData.assignedUserIds.includes(u.id)).map((u: User) => (
                                        <label key={u.id} className="flex items-center gap-2 p-1.5 hover:bg-bg cursor-pointer transition-colors group">
                                            <input
                                                type="checkbox"
                                                checked={formData.collaboratorIds.includes(u.id)}
                                                onChange={e => {
                                                    const ids = e.target.checked
                                                        ? [...formData.collaboratorIds, u.id]
                                                        : formData.collaboratorIds.filter((id: string) => id !== u.id);
                                                    setFormData({ ...formData, collaboratorIds: ids });
                                                }}
                                                className="accent-accent w-3 h-3 cursor-pointer"
                                            />
                                            <span className="text-[10px] font-bold text-gray-400 group-hover:text-white uppercase">{u.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div>
                             <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-black">Target Date</label>
                             <input
                                 type="date"
                                 value={formData.endDate}
                                 onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                 className="w-full bg-muted border border-border p-3 text-white outline-none focus:border-accent font-bold rounded-sm tracking-wider"
                             />
                        </div>
                        <div>
                              <div className="flex gap-4">
                                  <div className="flex-1">
                                    <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-black">Est. (Hours)</label>
                                    <input
                                        type="number"
                                        value={formData.timeEstimate}
                                        onChange={e => setFormData({ ...formData, timeEstimate: Number(e.target.value) })}
                                        className="w-full bg-muted border border-border p-3 text-white outline-none focus:border-accent font-bold rounded-sm text-center"
                                        min="0"
                                        step="0.5"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-black">Priority</label>
                                    <select
                                        value={formData.priority}
                                        onChange={e => setFormData({ ...formData, priority: e.target.value })}
                                        className="w-full bg-muted border border-border p-3 text-white outline-none focus:border-accent font-bold uppercase rounded-sm cursor-pointer"
                                    >
                                        <option value={ProjectTaskPriority.LOW}>Low</option>
                                        <option value={ProjectTaskPriority.MEDIUM}>Normal</option>
                                        <option value={ProjectTaskPriority.HIGH}>Urgent</option>
                                    </select>
                                  </div>
                              </div>
                        </div>

                    </div>
                </div>
                <div className="p-6 border-t border-border flex justify-end gap-4 bg-muted/30">
                    <button onClick={onClose} className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors">Cancel</button>
                    <button
                        disabled={isSubmitting}
                        onClick={async () => {
                            if (formData.assignedUserIds.length === 0) {
                                alert("Please select an assignee.");
                                return;
                            }
                            setIsSubmitting(true);
                            try {
                                await onSave(formData);
                            } finally {
                                setIsSubmitting(false);
                            }
                        }}
                        className="bg-accent text-black px-10 py-3 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white transition-colors disabled:opacity-50 rounded-sm"
                    >
                        {isSubmitting ? 'Saving...' : (initialData ? 'Update Task' : 'Create Task')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskSystem;
