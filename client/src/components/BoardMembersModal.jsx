import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { X, Copy, Check, Shield, Trash2, UserPlus } from 'lucide-react';

export function BoardMembersModal({
  board,
  members = [],
  userRole,
  onClose,
  onRefreshMembers,
}) {
  const { user, apiFetch } = useAuth();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);

  const isAdmin = userRole === 'admin';

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(board.invite_code);
      setCopied(true);
      showToast({ message: 'Invite code copied! Send it to your teammates ✨', type: 'success' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ message: `Invite code: ${board.invite_code}`, type: 'info' });
    }
  };

  const handleRoleChange = async (targetUserId, newRole) => {
    if (!isAdmin || updatingUserId) return;
    setUpdatingUserId(targetUserId);
    try {
      await apiFetch(`/api/boards/${board.id}/members/${targetUserId}`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      showToast({ message: `Role updated to ${newRole}! 🌸`, type: 'success' });
      onRefreshMembers?.();
    } catch (err) {
      showToast({ message: err.message || 'Failed to update role', type: 'error' });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleRemoveMember = async (targetUserId, targetName) => {
    if (!isAdmin || updatingUserId) return;
    if (!window.confirm(`Are you sure you want to remove ${targetName} from the board?`)) return;

    setUpdatingUserId(targetUserId);
    try {
      await apiFetch(`/api/boards/${board.id}/members/${targetUserId}`, {
        method: 'DELETE',
      });
      showToast({ message: `${targetName} removed from board`, type: 'info' });
      onRefreshMembers?.();
    } catch (err) {
      showToast({ message: err.message || 'Failed to remove member', type: 'error' });
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#7A5A50]/20 backdrop-blur-xs animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="members-modal-title"
    >
      <div
        className="relative w-full max-w-md bg-white rounded-4xl border border-[#BFD7F3] shadow-kawaii-hover p-4 sm:p-6 my-8 max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#F8F8FB]">
          <h3 id="members-modal-title" className="font-heading text-base sm:text-lg font-bold text-[#7A5A50]">
            👥 Board Members
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

        {/* Invite Code Box */}
        <div className="mt-4 p-3.5 rounded-3xl bg-[#FFF3C4]/60 border border-[#FFD966]/60 flex items-center justify-between gap-2">
          <div>
            <span className="block text-[11px] font-bold text-[#7A5A50]/80">
              Invite Code
            </span>
            <span className="font-mono text-base font-extrabold tracking-wider text-[#7A5A50]">
              {board.invite_code}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            className="px-3 py-1.5 rounded-2xl bg-white hover:bg-[#FFFBF0] text-[#7A5A50] font-bold text-xs border border-[#FFD966] shadow-xs active:scale-95 transition-all flex items-center gap-1.5 kawaii-focus"
            title="Copy invite code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-2.5 pr-1 max-h-72">
          {members.map((m) => {
            const isSelf = m.user_id === user.id;

            return (
              <div
                key={m.user_id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3]/60"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-[#7A5A50] ring-2 ring-[#8FA8E8] shrink-0"
                    style={{ backgroundColor: m.avatar_color || '#F7CADA' }}
                  >
                    {m.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs sm:text-sm text-[#7A5A50] truncate flex items-center gap-1.5">
                      <span>{m.name}</span>
                      {isSelf && (
                        <span className="text-[10px] text-[#8FA8E8] font-bold">(You)</span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#5B6475] block truncate">
                      {m.email}
                    </span>
                  </div>
                </div>

                {/* Role dropdown or badge */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isAdmin && !isSelf ? (
                    <>
                      <select
                        value={m.role}
                        disabled={updatingUserId === m.user_id}
                        onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                        className="px-2 py-1 rounded-xl bg-white border border-[#BFD7F3] text-xs font-bold text-[#7A5A50] kawaii-focus"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.user_id, m.name)}
                        disabled={updatingUserId === m.user_id}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors kawaii-focus"
                        title="Remove member"
                        aria-label={`Remove ${m.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <span
                      className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full capitalize ${
                        m.role === 'admin'
                          ? 'bg-[#FFF3C4] text-[#7A5A50] border border-[#FFD966]'
                          : m.role === 'member'
                          ? 'bg-[#DCEBFA] text-[#4E5868] border border-[#BFD7F3]'
                          : 'bg-[#FDF0F5] text-[#7A5A50] border border-[#F7CADA]'
                      }`}
                    >
                      {m.role}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#F8F8FB] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold text-[#7A5A50] hover:bg-[#F8F8FB] transition-colors kawaii-focus"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

