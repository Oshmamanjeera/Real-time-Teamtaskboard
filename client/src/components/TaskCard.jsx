import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MessageCircle, Calendar, ShieldAlert } from 'lucide-react';

const PRIORITY_STYLES = {
  urgent: {
    bg: 'bg-[#F7CADA]',
    border: 'border-[#F2AEC5]',
    text: 'text-[#7A5A50]',
    label: 'Urgent',
  },
  high: {
    bg: 'bg-[#FFF3C4]',
    border: 'border-[#FFD966]',
    text: 'text-[#7A5A50]',
    label: 'High',
  },
  medium: {
    bg: 'bg-[#DCEBFA]',
    border: 'border-[#BFD7F3]',
    text: 'text-[#4E5868]',
    label: 'Medium',
  },
  low: {
    bg: 'bg-[#D2F1DF]',
    border: 'border-[#A3E7BD]',
    text: 'text-[#4E5868]',
    label: 'Low',
  },
};

export function TaskCard({ task, canEdit, onClick, isOverlay = false }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: !canEdit,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const priorityInfo = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;

  const formattedDate = task.due_date
    ? new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative bg-white border border-[#BFD7F3]/80 rounded-3xl p-3.5 sm:p-4 shadow-kawaii hover:shadow-kawaii-hover transition-all duration-200 select-none ${
        isOverlay ? 'shadow-2xl scale-105 rotate-2 cursor-grabbing z-50 ring-4 ring-[#8FA8E8]/50' : ''
      }`}
    >
      {/* Top row: Priority & Drag Handle */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border shadow-xs ${priorityInfo.bg} ${priorityInfo.border} ${priorityInfo.text}`}
        >
          {priorityInfo.label}
        </span>

        <div className="flex items-center gap-1">
          {/* Version badge for concurrency transparency */}
          <span
            className="text-[10px] font-bold text-[#7A5A50]/60 bg-[#F8F8FB] border border-[#BFD7F3]/60 px-1.5 py-0.5 rounded-md"
            title={`Task version ${task.version}`}
          >
            v{task.version}
          </span>

          {canEdit ? (
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="p-1 rounded-xl text-[#7A5A50]/40 hover:text-[#7A5A50] hover:bg-[#DCEBFA]/50 cursor-grab active:cursor-grabbing transition-colors touch-none kawaii-focus"
              title="Drag to reorder or move"
              aria-label={`Drag task ${task.title}`}
            >
              <GripVertical className="w-4 h-4" />
            </button>
          ) : (
            <span
              className="text-[#7A5A50]/40 p-1"
              title="View-only: You do not have permission to move this task"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      </div>

      {/* Title & Description Clickable Area */}
      <div
        onClick={onClick}
        className="cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
        aria-label={`View details for ${task.title}`}
      >
        <h4 className="font-heading text-sm sm:text-base font-bold text-[#7A5A50] group-hover:text-[#8FA8E8] transition-colors leading-snug line-clamp-2">
          {task.title}
        </h4>

        {task.description && (
          <p className="mt-1 text-xs text-[#5B6475] line-clamp-2 leading-relaxed font-normal">
            {task.description}
          </p>
        )}
      </div>

      {/* Bottom meta: Due Date, Comments, Assignee */}
      <div className="mt-3 pt-2.5 border-t border-[#F8F8FB] flex items-center justify-between text-xs text-[#5B6475]">
        <div className="flex items-center gap-2">
          {formattedDate && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7A5A50] bg-[#FFF3C4]/60 border border-[#FFD966]/60 px-2 py-0.5 rounded-lg"
              title={`Due date: ${formattedDate}`}
            >
              <Calendar className="w-3 h-3 text-[#7A5A50]" />
              {formattedDate}
            </span>
          )}

          {task.comment_count > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8FA8E8] hover:text-[#7A5A50]"
              title={`${task.comment_count} comments`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {task.comment_count}
            </span>
          )}
        </div>

        {/* Assignee Avatar */}
        {task.assignee_name ? (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-[#7A5A50] ring-2 ring-[#8FA8E8]/70 shadow-xs select-none"
            style={{ backgroundColor: task.assignee_avatar || '#F7CADA' }}
            title={`Assigned to ${task.assignee_name}`}
          >
            {task.assignee_name.charAt(0).toUpperCase()}
          </div>
        ) : (
          <span className="text-[10px] italic text-[#5B6475]/60">Unassigned</span>
        )}
      </div>
    </div>
  );
}

