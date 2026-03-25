import React, { useState, useEffect } from 'react';
import { Icons, CATEGORY_LABELS } from '../constants';
import { Task, MissedTask, Blocker, TaskCategory, DailyWorkUpdate, User, ProjectTask, ProjectTaskStatus } from '../types';
import { storageService } from '../services/storageService';
import { parseTimeInput, formatTimeDisplay, toDecimalHours } from '../services/timeUtils';

interface WorkUpdateFormProps {
  user: User;
  onSubmit: (update: DailyWorkUpdate) => Promise<void>;
  onCancel: () => void;
  initialDate?: string;
}

interface TaskForm extends Task {
  timeInput: string;
  isMissed?: boolean;
  missedReason?: string;
}

const WorkUpdateForm: React.FC<WorkUpdateFormProps> = ({ user, onSubmit, onCancel, initialDate }) => {
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [tasks, setTasks] = useState<TaskForm[]>([]);
  const [missedTasks, setMissedTasks] = useState<MissedTask[]>([]);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [productivityScore, setProductivityScore] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [existingUpdate, setExistingUpdate] = useState<DailyWorkUpdate | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);

  useEffect(() => {
    storageService.getTasksByUser(user.id).then(setProjectTasks);
    checkExistingUpdate();
  }, [user.id, date]);

  const checkExistingUpdate = async () => {
    const update = await storageService.getUpdateByDate(user.id, date);
    setExistingUpdate(update);
    if (update) {
      // If it exists, populate the form and set read-only if not today
      setTasks(update.tasks.map(t => ({ ...t, timeInput: formatTimeDisplay(t.timeSpent * 60) } as TaskForm)));
      setMissedTasks(update.missedTasks);
      setBlockers(update.blockers);
      setProductivityScore(update.productivityScore);
      setIsReadOnly(date !== new Date().toISOString().split('T')[0] && user.role !== 'ADMIN');
    } else {
      setIsReadOnly(false);
      // Don't reset everything if user is just switching dates to check, 
      // but maybe we should reset to defaults if no update exists?
      // Actually, the current logic for generating scheduled tasks is in an effect below.
    }
  };

  useEffect(() => {
    if (!projectTasks.length) return;
    
    const scheduled = projectTasks.filter(pt => 
       pt.status !== ProjectTaskStatus.COMPLETED &&
       pt.startDate <= date && 
       pt.endDate >= date
    );
    
    setTasks(prev => {
       // If we have an existing update, don't auto-generate from project tasks
       if (existingUpdate) return prev;

       const manual = prev.filter(t => !t.isScheduled);
       const newScheduled = scheduled.map(pt => {
           const existing = prev.find(p => p.projectTaskId === pt.id && p.isScheduled);
           if (existing) return existing;
           
           return {
               id: Math.random().toString(36).substr(2, 9),
               description: `[${pt.client}] ${pt.title}`,
               timeSpent: 0,
               timeInput: '',
               category: TaskCategory.HPA,
               projectTaskId: pt.id,
               isScheduled: true,
               estimatedTimeAtLogDate: pt.timeEstimate,
               variance: -pt.timeEstimate,
               statusAtSubmission: pt.status,
               isMissed: false,
               missedReason: ''
           };
       });
       return [...newScheduled, ...manual];
    });
  }, [projectTasks, date]);

  const totalTime = tasks.reduce((acc, t) => acc + (Number(t.timeSpent) || 0), 0);
  const totalHours = Math.floor(totalTime);
  const totalMinutes = Math.round((totalTime - totalHours) * 60);

  const scheduledTasks = tasks.filter(t => t.isScheduled);
  const manualTasks = tasks.filter(t => !t.isScheduled);
  const activeScheduledTasks = scheduledTasks.filter(t => !t.isMissed);

  const totalScheduledEst = activeScheduledTasks.reduce((acc, t) => acc + (t.estimatedTimeAtLogDate || 0), 0);
  const totalScheduledActual = activeScheduledTasks.reduce((acc, t) => acc + (t.timeSpent || 0), 0);
  const totalScheduledVariance = totalScheduledActual - totalScheduledEst;

  const addTask = () => {
    setTasks([...tasks, {
      id: Math.random().toString(36).substr(2, 9),
      description: '',
      timeSpent: 0,
      timeInput: '',
      category: TaskCategory.HPA,
      projectTaskId: '',
      isScheduled: false
    }]);
  };

  const updateTask = (id: string, field: keyof TaskForm, value: any) => {
    if (isReadOnly) return;
    setTasks(tasks.map(t => {
      if (t.id !== id) return t;

      const updatedTask = { ...t, [field]: value };

      if (field === 'timeInput') {
        const totalMinutes = parseTimeInput(value);
        updatedTask.timeSpent = toDecimalHours(totalMinutes);
        
        if (updatedTask.isScheduled && updatedTask.estimatedTimeAtLogDate !== undefined) {
             updatedTask.variance = updatedTask.timeSpent - updatedTask.estimatedTimeAtLogDate;
        }
      }

      if (field === 'isMissed' && value === true) {
        updatedTask.timeInput = '';
        updatedTask.timeSpent = 0;
      }

      return updatedTask;
    }));
  };

  const removeTask = (id: string) => setTasks(tasks.filter(t => t.id !== id));
  
  const addMissedTask = () => setMissedTasks([...missedTasks, { id: Math.random().toString(36).substr(2, 9), description: '', reason: '', projectTaskId: '' }]);
  const updateMissedTask = (id: string, field: keyof MissedTask, value: string) => setMissedTasks(missedTasks.map(m => m.id === id ? { ...m, [field]: value } : m));
  const removeMissedTask = (id: string) => setMissedTasks(missedTasks.filter(m => m.id !== id));

  const addBlocker = () => setBlockers([...blockers, { id: Math.random().toString(36).substr(2, 9), description: '', reason: '' }]);
  const updateBlocker = (id: string, field: keyof Blocker, value: string) => setBlockers(blockers.map(b => b.id === id ? { ...b, [field]: value } : b));
  const removeBlocker = (id: string) => setBlockers(blockers.filter(b => b.id !== id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualTasks.some(t => !t.description || t.timeSpent <= 0)) {
      alert('Please fill in all details for your manual tasks.');
      return;
    }

    setIsSubmitting(true);
    const finalTasks: Task[] = [];
    const finalMissed = [...missedTasks];
    
    tasks.forEach(({ timeInput, isMissed, missedReason, ...t }) => {
        if (isMissed) {
             finalMissed.push({
                  id: Math.random().toString(36).substr(2, 9),
                  description: t.description,
                  reason: missedReason || 'Missed scheduled task',
                  projectTaskId: t.projectTaskId
             });
        } else {
             finalTasks.push(t as Task);
        }
    });

    const update: DailyWorkUpdate = {
      id: Math.random().toString(36).substr(2, 9),
      userId: user.id,
      userName: user.name,
      date,
      month: date.substring(0, 7),
      tasks: finalTasks,
      missedTasks: finalMissed,
      blockers,
      productivityScore,
      totalTime,
      submittedAt: new Date().toISOString()
    };

    try {
      await onSubmit(update);
    } catch (error) {
      console.error("Error submitting update:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col items-center p-4 md:p-10 overflow-hidden">
        <form onSubmit={handleSubmit} className="bg-bg border border-border w-full max-w-[1200px] flex flex-col h-full shadow-2xl relative">
            {/* Header */}
            <header className="p-6 border-b border-border flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-xl font-black uppercase text-white tracking-widest">Daily Work Log</h2>
                    <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mt-1">Record Time & Progress</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex bg-muted border border-border px-3 py-1.5 rounded-sm items-center gap-2">
                        <Icons.Calendar className="w-3.5 h-3.5 text-gray-500" />
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="bg-transparent border-none outline-none text-xs text-white font-bold uppercase tracking-widest cursor-pointer"
                            required
                        />
                    </div>
                    <button type="button" onClick={onCancel} className="text-gray-500 hover:text-white transition-colors">
                        <Icons.X className="w-5 h-5"/>
                    </button>
                </div>
            </header>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                
                {/* 1. Scheduled Work Table */}
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                            <span className="w-5 h-5 bg-accent/20 text-accent flex items-center justify-center rounded-sm">1</span> 
                            Scheduled Work
                        </h3>
                    </div>
                    
                    <div className="border border-border bg-muted/20 rounded-sm">
                        {/* Table Header */}
                        <div className="grid grid-cols-[1fr_80px_100px_100px_120px] gap-4 px-4 py-2 border-b border-border bg-muted/50 text-[9px] font-black uppercase tracking-widest text-gray-500">
                            <div>Task</div>
                            <div className="text-center">Est. / Var.</div>
                            <div className="text-center">Log Time</div>
                            <div>Update Status</div>
                            <div className="text-right">Action</div>
                        </div>

                        {/* Table Body */}
                        {scheduledTasks.length === 0 ? (
                            <div className="p-8 text-center text-[10px] uppercase font-bold tracking-[0.2em] text-gray-600">No scheduled tasks for this date.</div>
                        ) : (
                            <div className="divide-y divide-border/50">
                                {scheduledTasks.map(task => (
                                    <div key={task.id} className="grid grid-cols-[auto_1fr] md:grid-cols-[1fr_80px_100px_100px_120px] gap-4 px-4 py-3 items-center group transition-colors">
                                        
                                        {/* Task Name */}
                                        <div className="col-span-1 md:col-span-1 min-w-0 pr-4">
                                            <div className="flex items-start gap-2">
                                                <input 
                                                    type="checkbox" 
                                                    checked={task.isMissed}
                                                    onChange={(e) => updateTask(task.id, 'isMissed', e.target.checked)}
                                                    className="mt-1 accent-red-500 cursor-pointer w-3.5 h-3.5"
                                                    title="Mark Missed"
                                                />
                                                <div className="min-w-0">
                                                    <p className={`text-xs font-bold uppercase truncate transition-opacity ${task.isMissed ? 'line-through opacity-40' : 'text-white'}`}>{task.description}</p>
                                                    {task.isMissed && (
                                                        <input
                                                            type="text"
                                                            placeholder="Reason for missing..."
                                                            value={task.missedReason || ''}
                                                            onChange={(e) => updateTask(task.id, 'missedReason', e.target.value)}
                                                            className="mt-1 w-full bg-bg border border-red-500/30 p-1.5 text-[10px] text-white outline-none focus:border-red-500"
                                                            required={task.isMissed}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Show controls only if not missed */}
                                        {!task.isMissed ? (
                                            <>
                                                <div className="hidden md:flex flex-col items-center justify-center">
                                                    <span className="text-[10px] uppercase font-bold text-gray-400">{task.estimatedTimeAtLogDate?.toFixed(1)}h</span>
                                                    <span className={`text-[9px] uppercase font-black tracking-widest ${(task.variance || 0) > 0 ? 'text-red-500' : (task.variance || 0) < 0 ? 'text-green-500' : 'text-gray-500'}`}>
                                                        Var: {(task.variance || 0) > 0 ? '+' : ''}{(task.variance || 0).toFixed(1)}h
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1 justify-center">
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. 1.5h, 30m"
                                                        value={task.timeInput}
                                                        onChange={(e) => updateTask(task.id, 'timeInput', e.target.value)}
                                                        disabled={isReadOnly}
                                                        className="w-24 bg-bg border border-border p-1.5 text-center text-xs font-bold outline-none focus:border-accent rounded-sm uppercase tracking-tighter"
                                                    />
                                                </div>
                                                <div>
                                                    <select
                                                        value={task.statusAtSubmission}
                                                        onChange={(e) => {
                                                            updateTask(task.id, 'statusAtSubmission', e.target.value);
                                                            const projectTaskToUpdate = projectTasks.find(p => p.id === task.projectTaskId);
                                                            if (projectTaskToUpdate) {
                                                                storageService.saveTask({ ...projectTaskToUpdate, status: e.target.value as ProjectTaskStatus });
                                                                setProjectTasks(projectTasks.map(p => p.id === task.projectTaskId ? { ...p, status: e.target.value as ProjectTaskStatus } : p));
                                                            }
                                                        }}
                                                        className="w-full bg-bg border border-border p-1.5 outline-none text-[9px] font-black uppercase tracking-widest text-gray-400 focus:border-accent cursor-pointer rounded-sm"
                                                    >
                                                        <option value={ProjectTaskStatus.NOT_STARTED}>Not Started</option>
                                                        <option value={ProjectTaskStatus.IN_PROGRESS}>In Progress</option>
                                                        <option value={ProjectTaskStatus.COMPLETED}>Completed</option>
                                                    </select>
                                                </div>
                                                <div className="text-right">
                                                    <button type="button" onClick={() => updateTask(task.id, 'isMissed', true)} className="text-[9px] font-black uppercase text-red-500/50 hover:text-red-500 tracking-widest transition-colors">Mark Missed</button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="hidden md:block col-span-4 text-center">
                                                <span className="text-[10px] uppercase font-black tracking-widest text-red-500/50 block">Marked as missed</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* 2. Unplanned Work */}
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                            <span className="w-5 h-5 bg-gray-800 text-white flex items-center justify-center rounded-sm">2</span> 
                            Unplanned Work
                        </h3>
                        <button type="button" onClick={addTask} className="text-[10px] font-black uppercase text-accent tracking-widest flex items-center gap-1 hover:opacity-80 transition-opacity p-1 bg-accent/10 rounded-sm px-2">
                            <Icons.Plus className="w-3 h-3" /> Add Task
                        </button>
                    </div>

                    <div className="border border-border bg-muted/20 rounded-sm">
                        <div className="grid grid-cols-[1fr_150px_100px_40px] gap-4 px-4 py-2 border-b border-border bg-muted/50 text-[9px] font-black uppercase tracking-widest text-gray-500">
                            <div>Description</div>
                            <div>Category</div>
                            <div className="text-center">Log Time</div>
                            <div></div>
                        </div>

                        {manualTasks.length === 0 ? (
                            <div className="p-8 text-center text-[10px] uppercase font-bold tracking-[0.2em] text-gray-600">No unplanned work logged.</div>
                        ) : (
                            <div className="divide-y divide-border/50">
                                {manualTasks.map((task) => (
                                    <div key={task.id} className="grid grid-cols-[1fr_150px_100px_40px] gap-4 px-4 py-2 bg-bg items-center">
                                        <div>
                                            <input
                                                type="text"
                                                className="w-full bg-muted border border-border p-1.5 focus:border-accent outline-none text-xs font-bold text-white rounded-sm"
                                                value={task.description}
                                                onChange={(e) => updateTask(task.id, 'description', e.target.value)}
                                                placeholder="What did you work on?"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <select
                                                value={task.category}
                                                onChange={(e) => updateTask(task.id, 'category', e.target.value as TaskCategory)}
                                                className="w-full bg-muted border border-border p-1.5 focus:border-accent outline-none text-[9px] font-black uppercase text-gray-400 rounded-sm cursor-pointer"
                                                required
                                            >
                                                {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                                                    <option key={val} value={val}>{label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-1 justify-center">
                                            <input
                                                type="text"
                                                placeholder="e.g. 1h 20m"
                                                value={task.timeInput}
                                                onChange={(e) => updateTask(task.id, 'timeInput', e.target.value)}
                                                disabled={isReadOnly}
                                                className="w-24 bg-muted border border-border p-1.5 text-center text-xs font-bold outline-none focus:border-accent rounded-sm uppercase tracking-tighter"
                                                required
                                            />
                                        </div>
                                        <div className="flex justify-end">
                                            <button type="button" onClick={() => removeTask(task.id)} className="text-gray-600 hover:text-red-500 transition-colors p-1">
                                                <Icons.Trash className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* 3. Missed (Other) & Blockers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Missed */}
                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                                <span className="w-5 h-5 bg-gray-800 text-gray-500 flex items-center justify-center rounded-sm">3</span> 
                                Other Missed
                            </h3>
                            <button type="button" onClick={addMissedTask} className="text-[9px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-1 hover:text-white transition-colors">
                                <Icons.Plus className="w-3 h-3" /> Add
                            </button>
                        </div>
                        <div className="space-y-2">
                            {missedTasks.map((m) => (
                                <div key={m.id} className="flex gap-2 items-start">
                                    <div className="flex-1 space-y-2">
                                        <input
                                            type="text" placeholder="What was missed?" value={m.description}
                                            onChange={(e) => updateMissedTask(m.id, 'description', e.target.value)}
                                            className="w-full bg-muted/50 border border-border p-1.5 text-xs text-white focus:border-accent outline-none rounded-sm"
                                        />
                                        <input
                                            type="text" placeholder="Reason..." value={m.reason}
                                            onChange={(e) => updateMissedTask(m.id, 'reason', e.target.value)}
                                            className="w-full bg-muted/50 border border-border p-1.5 text-[10px] text-gray-400 focus:border-accent outline-none rounded-sm font-bold uppercase tracking-widest"
                                        />
                                    </div>
                                    <button type="button" onClick={() => removeMissedTask(m.id)} className="text-gray-600 hover:text-red-500 mt-1.5">
                                        <Icons.Trash className="w-4 h-4"/>
                                    </button>
                                </div>
                            ))}
                            {missedTasks.length === 0 && <div className="text-[9px] uppercase font-bold tracking-widest text-gray-600 p-3 bg-muted/20 border border-dashed border-border text-center rounded-sm">No other missed tasks</div>}
                        </div>
                    </section>

                    {/* Blockers */}
                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                                <span className="w-5 h-5 bg-gray-800 text-gray-500 flex items-center justify-center rounded-sm">4</span> 
                                Blockers
                            </h3>
                            <button type="button" onClick={addBlocker} className="text-[9px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-1 hover:text-white transition-colors">
                                <Icons.Plus className="w-3 h-3" /> Add
                            </button>
                        </div>
                        <div className="space-y-2">
                            {blockers.map((b) => (
                                <div key={b.id} className="flex gap-2 items-start">
                                    <div className="flex-1 space-y-2">
                                        <input
                                            type="text" placeholder="Blocker description..." value={b.description}
                                            onChange={(e) => updateBlocker(b.id, 'description', e.target.value)}
                                            className="w-full bg-muted/50 border border-border p-1.5 text-xs text-white focus:border-accent outline-none rounded-sm"
                                        />
                                        <input
                                            type="text" placeholder="Root cause / Impact..." value={b.reason}
                                            onChange={(e) => updateBlocker(b.id, 'reason', e.target.value)}
                                            className="w-full bg-muted/50 border border-border p-1.5 text-[10px] text-gray-400 focus:border-accent outline-none rounded-sm font-bold uppercase tracking-widest"
                                        />
                                    </div>
                                    <button type="button" onClick={() => removeBlocker(b.id)} className="text-gray-600 hover:text-red-500 mt-1.5">
                                        <Icons.Trash className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {blockers.length === 0 && <div className="text-[9px] uppercase font-bold tracking-widest text-gray-600 p-3 bg-muted/20 border border-dashed border-border text-center rounded-sm">No blockers faced</div>}
                        </div>
                    </section>
                </div>
            </div>

            {/* Footer / Submission Area Component Fixed at Bottom */}
            <footer className="bg-muted border-t border-border p-6 shrink-0 flex flex-col md:flex-row justify-between items-center gap-6">
                
                {/* Score Input */}
                <div className="flex items-center gap-6 w-full md:w-auto">
                    <div className="w-48">
                        <label className="block text-[10px] uppercase font-black tracking-[0.2em] text-gray-500 mb-2">Productivity Score</label>
                        <input
                            type="range" min="1" max="10" value={productivityScore}
                            onChange={(e) => setProductivityScore(parseInt(e.target.value))}
                            className="w-full accent-accent h-1 bg-border rounded-full appearance-none flex items-center cursor-pointer"
                        />
                    </div>
                    <div className="text-4xl font-black text-accent w-12 text-right">{productivityScore}</div>
                </div>

                {/* Summaries */}
                <div className="flex items-center gap-6 divide-x divide-border w-full md:w-auto overflow-x-auto text-center md:text-left">
                    <div className="px-2">
                        <p className="text-[8px] uppercase tracking-[0.2em] text-gray-500 mb-1 font-bold">Planned Hrs</p>
                        <p className="text-lg font-black text-gray-300">{totalScheduledEst.toFixed(1)}h</p>
                    </div>
                    <div className="pl-6">
                        <p className="text-[8px] uppercase tracking-[0.2em] text-gray-500 mb-1 font-bold">Act. Sched Hrs</p>
                        <p className="text-lg font-black text-white">{totalScheduledActual.toFixed(1)}h</p>
                    </div>
                    <div className="pl-6">
                        <p className="text-[8px] uppercase tracking-[0.2em] text-gray-500 mb-1 font-bold">Variance</p>
                        <p className={`text-lg font-black ${totalScheduledVariance > 0 ? 'text-red-500' : totalScheduledVariance < 0 ? 'text-green-500' : 'text-gray-400'}`}>
                            {totalScheduledVariance > 0 ? '+' : ''}{totalScheduledVariance.toFixed(1)}h
                        </p>
                    </div>
                    <div className="pl-6">
                        <p className="text-[8px] uppercase tracking-[0.2em] text-accent mb-1 font-black">Total Logged</p>
                        <p className="text-lg font-black text-accent">{totalHours}h {totalMinutes}m</p>
                    </div>
                </div>

                {/* Submit button */}
                <div className="flex gap-4 w-full md:w-auto mt-4 md:mt-0">
                    <button type="button" onClick={onCancel} className="flex-1 md:flex-none px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors bg-bg border border-border rounded-sm">
                        Close
                    </button>
                    {!isReadOnly && (
                        <button 
                            type="submit" 
                            disabled={isSubmitting || (!!existingUpdate && date !== new Date().toISOString().split('T')[0])} 
                            className="flex-1 md:flex-none bg-accent text-black px-10 py-3 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white transition-colors disabled:opacity-50 rounded-sm"
                        >
                            {isSubmitting ? 'Submitting...' : existingUpdate ? 'Update Log' : 'Submit Log'}
                        </button>
                    )}
                    {isReadOnly && (
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 bg-muted px-4 py-3 border border-border">
                           LOCKED / VIEW ONLY
                        </div>
                    )}
                </div>
            </footer>
        </form>
    </div>
  );
};

export default WorkUpdateForm;
