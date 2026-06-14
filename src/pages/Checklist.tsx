import { useState, useEffect } from 'react';
import { generateId, generateMemorialId, formatDate, calculateProgress, storageGet, storageSet, classNames, readFileAsDataURL } from '@/utils';
import './Checklist.css';

interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

interface Goal {
  id: string;
  title: string;
  description: string;
  subTasks: SubTask[];
  createdAt: string;
}

interface KanbanTask {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

type KanbanStatus = 'todo' | 'inProgress' | 'done';

interface Memorial {
  id: string;
  memorialNumber: string;
  name: string;
  date: string;
  description: string;
  photo?: string;
  createdAt: string;
}

const priorityConfig = {
  low: { label: '低', color: '#10b981', bg: 'bg-emerald-500/10' },
  medium: { label: '中', color: '#f59e0b', bg: 'bg-amber-500/10' },
  high: { label: '高', color: '#ef4444', bg: 'bg-red-500/10' },
};

const statusConfig: Record<KanbanStatus, { label: string; color: string; bg: string }> = {
  todo: { label: '待办', color: '#6b7280', bg: 'bg-gray-500/10' },
  inProgress: { label: '进行中', color: '#3b82f6', bg: 'bg-blue-500/10' },
  done: { label: '已完成', color: '#10b981', bg: 'bg-emerald-500/10' },
};

export default function Checklist() {
  const [activeTab, setActiveTab] = useState<'goals' | 'kanban' | 'memorials'>('goals');

  const [goals, setGoals] = useState<Goal[]>(() => storageGet('goals', []));
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: '', description: '', subTaskTitle: '' });

  const [kanbanTasks, setKanbanTasks] = useState<Record<KanbanStatus, KanbanTask[]>>(() =>
    storageGet('kanbanTasks', { todo: [], inProgress: [], done: [] })
  );
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' as 'low' | 'medium' | 'high', status: 'todo' as KanbanStatus });
  const [draggedTask, setDraggedTask] = useState<{ task: KanbanTask; fromStatus: KanbanStatus } | null>(null);

  const [memorials, setMemorials] = useState<Memorial[]>(() => storageGet('memorials', []));
  const [showMemorialModal, setShowMemorialModal] = useState(false);
  const [newMemorial, setNewMemorial] = useState({ name: '', date: formatDate(new Date()), description: '', photo: '' });

  useEffect(() => {
    storageSet('goals', goals);
  }, [goals]);

  useEffect(() => {
    storageSet('kanbanTasks', kanbanTasks);
  }, [kanbanTasks]);

  useEffect(() => {
    storageSet('memorials', memorials);
  }, [memorials]);

  const addGoal = () => {
    if (!newGoal.title.trim()) return;
    const goal: Goal = {
      id: generateId(),
      title: newGoal.title,
      description: newGoal.description,
      subTasks: newGoal.subTaskTitle.trim()
        ? [{ id: generateId(), title: newGoal.subTaskTitle, completed: false, createdAt: new Date().toISOString() }]
        : [],
      createdAt: new Date().toISOString(),
    };
    setGoals([goal, ...goals]);
    setNewGoal({ title: '', description: '', subTaskTitle: '' });
    setShowGoalModal(false);
  };

  const addSubTask = (goalId: string, title: string) => {
    if (!title.trim()) return;
    setGoals(goals.map(g => {
      if (g.id !== goalId) return g;
      return {
        ...g,
        subTasks: [...g.subTasks, { id: generateId(), title, completed: false, createdAt: new Date().toISOString() }],
      };
    }));
  };

  const toggleSubTask = (goalId: string, subTaskId: string) => {
    setGoals(goals.map(g => {
      if (g.id !== goalId) return g;
      return {
        ...g,
        subTasks: g.subTasks.map(st => st.id === subTaskId ? { ...st, completed: !st.completed } : st),
      };
    }));
  };

  const removeSubTask = (goalId: string, subTaskId: string) => {
    setGoals(goals.map(g => {
      if (g.id !== goalId) return g;
      return { ...g, subTasks: g.subTasks.filter(st => st.id !== subTaskId) };
    }));
  };

  const removeGoal = (goalId: string) => {
    setGoals(goals.filter(g => g.id !== goalId));
  };

  const addKanbanTask = () => {
    if (!newTask.title.trim()) return;
    const task: KanbanTask = {
      id: generateId(),
      title: newTask.title,
      description: newTask.description,
      priority: newTask.priority,
      createdAt: new Date().toISOString(),
    };
    setKanbanTasks({
      ...kanbanTasks,
      [newTask.status]: [...kanbanTasks[newTask.status], task],
    });
    setNewTask({ title: '', description: '', priority: 'medium', status: 'todo' });
    setShowTaskModal(false);
  };

  const handleDragStart = (task: KanbanTask, status: KanbanStatus) => {
    setDraggedTask({ task, fromStatus: status });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (toStatus: KanbanStatus) => {
    if (!draggedTask) return;
    const { task, fromStatus } = draggedTask;
    if (fromStatus === toStatus) {
      setDraggedTask(null);
      return;
    }
    setKanbanTasks({
      ...kanbanTasks,
      [fromStatus]: kanbanTasks[fromStatus].filter(t => t.id !== task.id),
      [toStatus]: [...kanbanTasks[toStatus], task],
    });
    setDraggedTask(null);
  };

  const removeKanbanTask = (status: KanbanStatus, taskId: string) => {
    setKanbanTasks({
      ...kanbanTasks,
      [status]: kanbanTasks[status].filter(t => t.id !== taskId),
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataURL(file);
    setNewMemorial({ ...newMemorial, photo: dataUrl });
  };

  const addMemorial = () => {
    if (!newMemorial.name.trim()) return;
    const memorial: Memorial = {
      id: generateId(),
      memorialNumber: generateMemorialId(),
      name: newMemorial.name,
      date: newMemorial.date,
      description: newMemorial.description,
      photo: newMemorial.photo,
      createdAt: new Date().toISOString(),
    };
    setMemorials([memorial, ...memorials]);
    setNewMemorial({ name: '', date: formatDate(new Date()), description: '', photo: '' });
    setShowMemorialModal(false);
  };

  const removeMemorial = (id: string) => {
    setMemorials(memorials.filter(m => m.id !== id));
  };

  const tabs = [
    { key: 'goals', label: '共同目标', icon: '🎯' },
    { key: 'kanban', label: '任务看板', icon: '📋' },
    { key: 'memorials', label: '纪念物', icon: '🏆' },
  ];

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-rose-50 via-white to-violet-50">
      <div className="px-8 py-6 border-b border-gray-200/50 bg-white/60 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-500 to-violet-500 bg-clip-text text-transparent">
              清单板
            </h1>
            <p className="text-sm text-gray-500 mt-1">记录我们共同的目标和每一个值得纪念的瞬间</p>
          </div>
          <button
            onClick={() => {
              if (activeTab === 'goals') setShowGoalModal(true);
              else if (activeTab === 'kanban') setShowTaskModal(true);
              else setShowMemorialModal(true);
            }}
            className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-violet-500 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-rose-500/25 transition-all duration-300 flex items-center gap-2"
          >
            <span className="text-lg">+</span>
            <span>
              {activeTab === 'goals' ? '新建目标' : activeTab === 'kanban' ? '新建任务' : '添加纪念物'}
            </span>
          </button>
        </div>

        <div className="flex gap-2 mt-5">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={classNames(
                'px-5 py-2.5 rounded-xl font-medium transition-all duration-300 flex items-center gap-2',
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-rose-500 to-violet-500 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {activeTab === 'goals' && (
          <div className="space-y-6">
            {goals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <span className="text-6xl mb-4">🎯</span>
                <p className="text-lg">还没有共同目标</p>
                <p className="text-sm">点击右上角新建第一个目标吧</p>
              </div>
            ) : (
              goals.map(goal => {
                const progress = calculateProgress(
                  goal.subTasks.filter(st => st.completed).length,
                  goal.subTasks.length
                );
                return (
                  <div key={goal.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-800">{goal.title}</h3>
                        {goal.description && <p className="text-sm text-gray-500 mt-1">{goal.description}</p>}
                      </div>
                      <button
                        onClick={() => removeGoal(goal.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        🗑️
                      </button>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-600">进度</span>
                        <span className="font-semibold text-violet-600">{progress}%</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-rose-400 to-violet-500 rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {goal.subTasks.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {goal.subTasks.map(subTask => (
                          <div
                            key={subTask.id}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl group hover:bg-gray-100 transition-colors"
                          >
                            <button
                              onClick={() => toggleSubTask(goal.id, subTask.id)}
                              className={classNames(
                                'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0',
                                subTask.completed
                                  ? 'bg-gradient-to-r from-rose-500 to-violet-500 border-transparent'
                                  : 'border-gray-300 hover:border-violet-400'
                              )}
                            >
                              {subTask.completed && <span className="text-white text-xs">✓</span>}
                            </button>
                            <span className={classNames(
                              'flex-1 text-sm',
                              subTask.completed ? 'text-gray-400 line-through' : 'text-gray-700'
                            )}>
                              {subTask.title}
                            </span>
                            <button
                              onClick={() => removeSubTask(goal.id, subTask.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="添加子任务..."
                        className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-violet-400 focus:bg-white transition-all"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            addSubTask(goal.id, e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'kanban' && (
          <div className="grid grid-cols-3 gap-6 h-full">
            {(Object.keys(statusConfig) as KanbanStatus[]).map(status => (
              <div
                key={status}
                className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100 flex flex-col"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(status)}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${statusConfig[status].bg}`} style={{ backgroundColor: statusConfig[status].color }} />
                    <h3 className="font-semibold text-gray-700">{statusConfig[status].label}</h3>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                      {kanbanTasks[status].length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-auto">
                  {kanbanTasks[status].length === 0 ? (
                    <div className="py-10 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
                      拖拽任务到这里
                    </div>
                  ) : (
                    kanbanTasks[status].map(task => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => handleDragStart(task, status)}
                        className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-move hover:shadow-md transition-all group"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-gray-800 text-sm">{task.title}</h4>
                          <button
                            onClick={() => removeKanbanTask(status, task.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                          >
                            ✕
                          </button>
                        </div>
                        {task.description && (
                          <p className="text-sm text-gray-500 mb-3 line-clamp-2">{task.description}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className={classNames(
                            'px-2.5 py-1 text-xs rounded-full font-medium',
                            priorityConfig[task.priority].bg
                          )} style={{ color: priorityConfig[task.priority].color }}>
                            {priorityConfig[task.priority].label}优先级
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDate(task.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'memorials' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {memorials.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                <span className="text-6xl mb-4">🏆</span>
                <p className="text-lg">还没有纪念物</p>
                <p className="text-sm">点击右上角添加第一个纪念物吧</p>
              </div>
            ) : (
              memorials.map(memorial => (
                <div key={memorial.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-all group">
                  {memorial.photo ? (
                    <div className="aspect-video bg-gray-100 overflow-hidden">
                      <img src={memorial.photo} alt={memorial.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-rose-100 to-violet-100 flex items-center justify-center">
                      <span className="text-5xl">💝</span>
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="inline-block px-2.5 py-1 bg-gradient-to-r from-rose-500/10 to-violet-500/10 text-violet-600 text-xs font-medium rounded-lg mb-2">
                          {memorial.memorialNumber}
                        </span>
                        <h3 className="font-semibold text-gray-800">{memorial.name}</h3>
                      </div>
                      <button
                        onClick={() => removeMemorial(memorial.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        🗑️
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">{memorial.date}</p>
                    {memorial.description && (
                      <p className="text-sm text-gray-600 line-clamp-3">{memorial.description}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showGoalModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-gray-800 mb-5">新建共同目标</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">目标标题</label>
                <input
                  type="text"
                  value={newGoal.title}
                  onChange={e => setNewGoal({ ...newGoal, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-400 focus:bg-white transition-all"
                  placeholder="比如：一起去看海"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">描述（可选）</label>
                <textarea
                  value={newGoal.description}
                  onChange={e => setNewGoal({ ...newGoal, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-400 focus:bg-white transition-all resize-none"
                  rows={3}
                  placeholder="详细描述一下这个目标..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">第一个子任务（可选）</label>
                <input
                  type="text"
                  value={newGoal.subTaskTitle}
                  onChange={e => setNewGoal({ ...newGoal, subTaskTitle: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-400 focus:bg-white transition-all"
                  placeholder="拆分一个小目标"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGoalModal(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={addGoal}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-violet-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {showTaskModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-gray-800 mb-5">新建任务</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">任务标题</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-400 focus:bg-white transition-all"
                  placeholder="做什么？"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">描述（可选）</label>
                <textarea
                  value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-400 focus:bg-white transition-all resize-none"
                  rows={3}
                  placeholder="详细描述..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">优先级</label>
                  <select
                    value={newTask.priority}
                    onChange={e => setNewTask({ ...newTask, priority: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-400 focus:bg-white transition-all"
                  >
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">状态</label>
                  <select
                    value={newTask.status}
                    onChange={e => setNewTask({ ...newTask, status: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-400 focus:bg-white transition-all"
                  >
                    <option value="todo">待办</option>
                    <option value="inProgress">进行中</option>
                    <option value="done">已完成</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTaskModal(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={addKanbanTask}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-violet-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {showMemorialModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-5">添加纪念物</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">纪念物名称</label>
                <input
                  type="text"
                  value={newMemorial.name}
                  onChange={e => setNewMemorial({ ...newMemorial, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-400 focus:bg-white transition-all"
                  placeholder="第一次一起看的电影票根"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">日期</label>
                <input
                  type="date"
                  value={newMemorial.date}
                  onChange={e => setNewMemorial({ ...newMemorial, date: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-400 focus:bg-white transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">描述</label>
                <textarea
                  value={newMemorial.description}
                  onChange={e => setNewMemorial({ ...newMemorial, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-400 focus:bg-white transition-all resize-none"
                  rows={3}
                  placeholder="记录这个纪念物背后的故事..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">照片（可选）</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-violet-400 transition-colors cursor-pointer">
                  {newMemorial.photo ? (
                    <div className="relative">
                      <img src={newMemorial.photo} alt="预览" className="max-h-40 mx-auto rounded-lg" />
                      <button
                        onClick={() => setNewMemorial({ ...newMemorial, photo: '' })}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                      <div className="text-gray-400">
                        <span className="text-3xl block mb-2">📷</span>
                        <span className="text-sm">点击上传照片</span>
                      </div>
                    </label>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowMemorialModal(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={addMemorial}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-violet-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
