import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard.jsx';
import { KumoMascot } from './KumoMascot.jsx';
import { Plus } from 'lucide-react';

const COLUMN_CONFIGS = {
  to_do: {
    title: 'To Do',
    icon: '☁️',
    tilt: '-rotate-1',
    gradient: 'from-[#DCEBFA] to-[#BFD7F3]',
    borderColor: 'border-[#BFD7F3]',
    badgeBg: 'bg-white/80 text-[#4E5868]',
    emptyExpression: 'sleepy',
    emptyText: 'Nothing here yet ~ Take it easy!',
  },
  in_progress: {
    title: 'In Progress',
    icon: '🍯',
    tilt: 'rotate-1',
    gradient: 'from-[#FFF3C4] to-[#FEEBB0]',
    borderColor: 'border-[#FFD966]',
    badgeBg: 'bg-white/80 text-[#7A5A50]',
    emptyExpression: 'thinking',
    emptyText: 'No active tasks! Ready for the next adventure? ✨',
  },
  done: {
    title: 'Done',
    icon: '🌸',
    tilt: '-rotate-1',
    gradient: 'from-[#FDF0F5] to-[#F7CADA]',
    borderColor: 'border-[#F7CADA]',
    badgeBg: 'bg-white/80 text-[#7A5A50]',
    emptyExpression: 'celebrating',
    emptyText: 'All caught up! Yay! 🎉',
  },
};

export function KanbanColumn({
  status,
  tasks = [],
  userRole,
  currentUserId,
  onTaskClick,
  onAddTask,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { status },
  });

  const config = COLUMN_CONFIGS[status] || COLUMN_CONFIGS.to_do;
  const taskIds = tasks.map((t) => t.id);

  // Check if current user can edit a task
  const canEditTask = (task) => {
    if (userRole === 'admin') return true;
    if (userRole === 'member') {
      return task.created_by === currentUserId || task.assignee_id === currentUserId;
    }
    return false; // viewer
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col flex-1 min-w-[280px] max-w-full rounded-4xl bg-[#F8F8FB]/80 border-2 transition-all p-3 sm:p-4 ${
        isOver
          ? 'border-[#8FA8E8] bg-[#E5EDFD]/40 ring-4 ring-[#8FA8E8]/20 shadow-kawaii-hover'
          : 'border-transparent shadow-sm'
      }`}
    >
      {/* Ribbon Column Header */}
      <div
        className={`rounded-3xl p-3.5 mb-3.5 shadow-sm border bg-gradient-to-r ${config.gradient} ${config.borderColor} ${config.tilt} transform transition-transform hover:rotate-0 duration-200 select-none flex items-center justify-between`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">
            {config.icon}
          </span>
          <h3 className="font-heading text-sm sm:text-base font-extrabold text-[#7A5A50] tracking-tight">
            {config.title}
          </h3>
          <span
            className={`text-xs font-black px-2 py-0.5 rounded-full shadow-xs ${config.badgeBg}`}
            aria-label={`${tasks.length} tasks in ${config.title}`}
          >
            {tasks.length}
          </span>
        </div>

        {userRole !== 'viewer' && onAddTask && (
          <button
            type="button"
            onClick={() => onAddTask(status)}
            className="w-7 h-7 rounded-full bg-white/90 hover:bg-white text-[#7A5A50] flex items-center justify-center shadow-xs hover:scale-110 active:scale-95 transition-all kawaii-focus"
            title={`Add task to ${config.title}`}
            aria-label={`Add task to ${config.title}`}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Task List / Drop Zone */}
      <div className="flex-1 flex flex-col gap-3 min-h-[160px]">
        {tasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none rounded-3xl border-2 border-dashed border-[#BFD7F3]/60 bg-white/50">
            <KumoMascot expression={config.emptyExpression} size={70} className="mb-2" />
            <p className="text-xs sm:text-sm font-semibold text-[#5B6475] max-w-[200px] leading-relaxed">
              {config.emptyText}
            </p>
          </div>
        ) : (
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                canEdit={canEditTask(task)}
                onClick={() => onTaskClick?.(task)}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
}

