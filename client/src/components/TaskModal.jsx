import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  X,
  Trash2,
  Send,
  MessageCircle,
  Calendar,
  AlertTriangle,
  Clock,
  User,
  Tag,
} from 'lucide-react';

export function TaskModal({
  task,
  userRole,
  members = [],
  onClose,
  onUpdateTask,
  onDeleteTask,
}) {
  const { user, apiFetch } = useAuth();
  const { showToast } = useToast();

  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState(task?.status || 'to_do');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id || '');
  const [dueDate, setDueDate] = useState(
    task?.due_date ? new Date(task.due_date).toISOString().slice(0, 10) : ''
  );

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Check edit permission
  const canEdit =
    userRole === 'admin' ||
    (userRole === 'member' &&
      (task?.created_by === user?.id || task?.assignee_id === user?.id));

  // Check delete permission (only creator or admin)
  const canDelete =
    userRole === 'admin' ||
    (userRole === 'member' && task?.created_by === user?.id);

  // Fetch comments
  useEffect(() => {
    if (!task?.id) return;
    async function loadComments() {
      try {
        const data = await apiFetch(`/api/tasks/${task.id}/comments`);
        setComments(data.comments || []);
      } catch (err) {
        console.error('Failed to load comments:', err);
      }
    }
    loadComments();
  }, [task?.id, apiFetch]);

  // Handle Save Task Edits
  const handleSave = async (e) => {
    e?.preventDefault();
    if (!canEdit || isSaving) return;

    if (!title.trim()) {
      showToast({ message: 'Task title cannot be empty! ☁️', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const updates = {
        expectedVersion: task.version,
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assigneeId: assigneeId || 'UNASSIGN',
        dueDate: dueDate ? new Date(dueDate).toISOString() : 'CLEAR',
      };

      await onUpdateTask(task.id, updates);
      showToast({ message: 'Task updated successfully! ✨', type: 'success' });
      onClose();
    } catch (err) {
      if (err.status === 409) {
        showToast({
          message: 'Someone updated this task first, so your change was not applied.',
          type: 'conflict',
        });
        onClose();
      } else {
        showToast({ message: err.message || 'Failed to update task', type: 'error' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete
  const handleDelete = async () => {
    if (!canDelete) return;
    if (!window.confirm(`Are you sure you want to delete "${task.title}"?`)) return;

    try {
      await onDeleteTask(task.id, task.version);
      showToast({ message: 'Task deleted! 🌸', type: 'info' });
      onClose();
    } catch (err) {
      if (err.status === 409 || err.status === 410) {
        showToast({
          message: 'Someone updated or deleted this task first!',
          type: 'conflict',
        });
        onClose();
      } else {
        showToast({ message: err.message || 'Failed to delete task', type: 'error' });
      }
    }
  };

  // Handle Add Comment
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmittingComment || userRole === 'viewer') return;

    setIsSubmittingComment(true);
    try {
      const res = await apiFetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: newComment.trim() }),
      });
      setComments((prev) => [...prev, res.comment]);
      setNewComment('');
      showToast({ message: 'Comment added! 💬', type: 'success' });
    } catch (err) {
      showToast({ message: err.message || 'Failed to post comment', type: 'error' });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#7A5A50]/20 backdrop-blur-xs animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-dialog-title"
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-4xl border border-[#BFD7F3] shadow-kawaii-hover p-4 sm:p-6 my-8 max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#F8F8FB]">
          <div className="flex items-center gap-2">
            <span className="font-heading text-xs sm:text-sm font-bold text-[#8FA8E8] bg-[#E5EDFD] px-2.5 py-1 rounded-full">
              Task v{task.version}
            </span>
            {!canEdit && (
              <span className="text-xs font-semibold text-[#7A5A50] bg-[#FFF3C4] px-2.5 py-1 rounded-full border border-[#FFD966]">
                View Only
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-2 text-[#7A5A50]/60 hover:text-red-500 hover:bg-[#FDF0F5] rounded-2xl transition-colors kawaii-focus"
                title="Delete task"
                aria-label="Delete task"
              >
                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-[#7A5A50]/60 hover:text-[#7A5A50] hover:bg-[#DCEBFA]/50 rounded-2xl transition-colors kawaii-focus"
              title="Close modal"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Title */}
          <div>
            <label id="task-dialog-title" className="block text-xs font-bold text-[#7A5A50] mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              disabled={!canEdit}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3] text-sm sm:text-base font-bold text-[#7A5A50] focus:bg-white kawaii-focus disabled:opacity-80"
              placeholder="Task title..."
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
              disabled={!canEdit}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3] text-xs sm:text-sm text-[#4E5868] focus:bg-white kawaii-focus disabled:opacity-80 resize-none leading-relaxed"
              placeholder="Add more details about this task..."
            />
          </div>

          {/* Grid Settings: Status, Priority, Assignee, Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Status */}
            <div>
              <label className="block text-xs font-bold text-[#7A5A50] mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#8FA8E8]" />
                Column Status
              </label>
              <select
                value={status}
                disabled={!canEdit}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3] text-xs sm:text-sm font-semibold text-[#7A5A50] kawaii-focus disabled:opacity-80"
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
                disabled={!canEdit}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3] text-xs sm:text-sm font-semibold text-[#7A5A50] kawaii-focus disabled:opacity-80"
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
                disabled={!canEdit}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3] text-xs sm:text-sm font-semibold text-[#7A5A50] kawaii-focus disabled:opacity-80"
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
                disabled={!canEdit}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3] text-xs sm:text-sm font-semibold text-[#7A5A50] kawaii-focus disabled:opacity-80"
              />
            </div>
          </div>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-[#5B6475] pt-2 border-t border-[#F8F8FB]">
            <span>Created by: <strong className="text-[#7A5A50]">{task.creator_name || 'Team member'}</strong></span>
            {task.created_at && (
              <span>Created on: {new Date(task.created_at).toLocaleDateString()}</span>
            )}
          </div>

          {/* Comments Section */}
          <div className="pt-4 border-t border-[#F8F8FB]">
            <h5 className="font-heading text-xs sm:text-sm font-bold text-[#7A5A50] mb-3 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-[#8FA8E8]" />
              Comments ({comments.length})
            </h5>

            {/* Comments list */}
            <div className="space-y-2.5 max-h-48 overflow-y-auto mb-3 pr-1">
              {comments.length === 0 ? (
                <p className="text-xs text-[#5B6475] italic">No comments yet ~ Be the first to cheer!</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="p-2.5 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3]/60 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] text-[#7A5A50]"
                          style={{ backgroundColor: c.user_avatar || '#F7CADA' }}
                        >
                          {c.user_name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-[#7A5A50]">{c.user_name}</span>
                      </div>
                      <span className="text-[10px] text-[#5B6475]">
                        {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[#4E5868] whitespace-pre-wrap pl-6">{c.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment input */}
            {userRole !== 'viewer' ? (
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a sweet comment..."
                  className="flex-1 px-3.5 py-2 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3] text-xs sm:text-sm text-[#4E5868] focus:bg-white kawaii-focus"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || isSubmittingComment}
                  className="px-3.5 py-2 rounded-2xl bg-[#8FA8E8] text-white font-bold text-xs hover:bg-[#7F98D8] disabled:opacity-50 transition-all flex items-center gap-1.5 kawaii-focus"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Post</span>
                </button>
              </form>
            ) : (
              <p className="text-[11px] text-[#5B6475] italic bg-[#F8F8FB] p-2 rounded-xl text-center">
                Viewers cannot post comments
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#F8F8FB] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold text-[#7A5A50] hover:bg-[#F8F8FB] transition-colors kawaii-focus"
          >
            {canEdit ? 'Cancel' : 'Close'}
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 rounded-2xl bg-[#8FA8E8] hover:bg-[#7F98D8] text-white text-xs sm:text-sm font-bold shadow-kawaii active:scale-95 transition-all kawaii-focus disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

