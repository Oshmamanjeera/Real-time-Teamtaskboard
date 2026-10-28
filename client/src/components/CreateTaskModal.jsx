import React, { useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { X, Tag, AlertTriangle, User, Calendar } from 'lucide-react';

export function CreateTaskModal({
  boardId,
  initialStatus = 'to_do',
  members = [],
  onClose,
  onCreateTask,
}) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState(initialStatus);
  const [priority, setPriority] = useState('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate unique clientMutationId for idempotent task creation
  const [clientMutationId] = useState(() => {
    return 'mutation_' + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onCreateTask({
        boardId,
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        clientMutationId,
      });

      showToast({ message: 'Task created! ✨', type: 'success' });
      onClose();
    } catch (err) {
      showToast({ message: err.message || 'Failed to create task', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#7A5A50]/20 backdrop-blur-xs animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-task-title"
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-4xl border border-[#BFD7F3] shadow-kawaii-hover p-4 sm:p-6 my-8 max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#F8F8FB]">
          <h3 id="create-task-title" className="font-heading text-base sm:text-lg font-bold text-[#7A5A50]">
            🌸 Create New Task
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#7A5A50]/60 hover:text-[#7A5A50] hover:bg-[#DCEBFA]/50 rounded-2xl transition-colors kawaii-focus"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-[#7A5A50] mb-1">
              Title <span className="text-[#F7CADA]">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3] text-sm sm:text-base font-bold text-[#7A5A50] focus:bg-white kawaii-focus"
              placeholder="What needs to be done? ✨"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-[#7A5A50] mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3] text-xs sm:text-sm text-[#4E5868] focus:bg-white kawaii-focus resize-none leading-relaxed"
              placeholder="Add details, links, or notes..."
            />
          </div>

          {/* Grid Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Column Status */}
            <div>
              <label className="block text-xs font-bold text-[#7A5A50] mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#8FA8E8]" />
                Column
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3] text-xs sm:text-sm font-semibold text-[#7A5A50] kawaii-focus"
              >
                <option value="to_do">☁️ To Do</option>
                <option value="in_progress">🍯 In Progress</option>
                <option value="done">🌸 Done</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-bold text-[#7A5A50] mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[#FFD966]" />
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3] text-xs sm:text-sm font-semibold text-[#7A5A50] kawaii-focus"
              >
                <option value="low">🌱 Low</option>
                <option value="medium">☁️ Medium</option>
                <option value="high">⭐ High</option>
                <option value="urgent">🎀 Urgent</option>
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label className="block text-xs font-bold text-[#7A5A50] mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#8FA8E8]" />
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3] text-xs sm:text-sm font-semibold text-[#7A5A50] kawaii-focus"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs font-bold text-[#7A5A50] mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#F7CADA]" />
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3] text-xs sm:text-sm font-semibold text-[#7A5A50] kawaii-focus"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#F8F8FB] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold text-[#7A5A50] hover:bg-[#F8F8FB] transition-colors kawaii-focus"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="px-5 py-2 rounded-2xl bg-[#8FA8E8] hover:bg-[#7F98D8] text-white text-xs sm:text-sm font-bold shadow-kawaii active:scale-95 transition-all kawaii-focus disabled:opacity-60"
            >
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

