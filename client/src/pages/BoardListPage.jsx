import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Navbar } from '../components/Navbar.jsx';
import { LockScreenHeader } from '../components/LockScreenHeader.jsx';
import { KumoMascot } from '../components/KumoMascot.jsx';
import { KawaiiDecorations } from '../components/KawaiiDecorations.jsx';
import { Plus, UserPlus, ArrowRight, Sparkles, Layout } from 'lucide-react';

export function BoardListPage() {
  const { user, apiFetch } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const loadBoards = async () => {
    try {
      const data = await apiFetch('/api/boards');
      setBoards(data.boards || []);
    } catch (err) {
      showToast({ message: err.message || 'Failed to load boards', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoards();
  }, []);

  const handleCreateBoard = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const res = await apiFetch('/api/boards', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
        }),
      });

      showToast({ message: 'Board created! Welcome, Admin! 👑', type: 'success' });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
      navigate(`/boards/${res.board.id}`);
    } catch (err) {
      showToast({ message: err.message || 'Failed to create board', type: 'error' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinBoard = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim() || isJoining) return;

    setIsJoining(true);
    try {
      const res = await apiFetch('/api/boards/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode: inviteCode.trim() }),
      });

      showToast({ message: res.message || 'Joined board! 🌸', type: 'success' });
      setShowJoinModal(false);
      setInviteCode('');
      navigate(`/boards/${res.board.id}`);
    } catch (err) {
      showToast({ message: err.message || 'Invalid invite code', type: 'error' });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col relative">
      <KawaiiDecorations />
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 z-10">
        <LockScreenHeader userName={user?.name} />

        {/* Action Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 mb-8">
          <div>
            <h2 className="font-heading text-xl sm:text-2xl font-extrabold text-[#7A5A50] tracking-tight">
              My Task Boards
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-[#5B6475] mt-0.5">
              Select a board or collaborate with an invite code ✨
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setShowJoinModal(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FFF3C4] hover:bg-[#FEEBB0] text-[#7A5A50] font-bold text-xs sm:text-sm border border-[#FFD966] shadow-sm transition-all active:scale-95 kawaii-focus"
            >
              <UserPlus className="w-4 h-4" />
              <span>Join with Code</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#8FA8E8] hover:bg-[#7F98D8] text-white font-bold text-xs sm:text-sm shadow-kawaii active:scale-95 transition-all kawaii-focus"
            >
              <Plus className="w-4 h-4" />
              <span>New Board</span>
            </button>
          </div>
        </div>

        {/* Board Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white/80 rounded-4xl p-6 border border-[#BFD7F3]/60 shadow-sm animate-pulse h-44"
              />
            ))}
          </div>
        ) : boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-white/70 backdrop-blur-sm rounded-4xl border border-[#BFD7F3] shadow-kawaii max-w-lg mx-auto mt-6">
            <KumoMascot expression="thinking" size={110} className="mb-3" />
            <h3 className="font-heading text-lg font-bold text-[#7A5A50]">
              No boards found!
            </h3>
            <p className="text-xs sm:text-sm text-[#5B6475] mt-1 max-w-xs leading-relaxed">
              Create your very first pastel task board or ask a teammate for their invite code ~
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 rounded-2xl bg-[#8FA8E8] text-white font-bold text-xs shadow-kawaii hover:bg-[#7F98D8] transition-all kawaii-focus"
              >
                Create Board
              </button>
              <button
                type="button"
                onClick={() => setShowJoinModal(true)}
                className="px-4 py-2 rounded-2xl bg-[#FFF3C4] border border-[#FFD966] text-[#7A5A50] font-bold text-xs hover:bg-[#FEEBB0] transition-all kawaii-focus"
              >
                Join with Code
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {boards.map((board) => (
              <Link
                key={board.id}
                to={`/boards/${board.id}`}
                className="group relative bg-white rounded-4xl border border-[#BFD7F3] p-5 sm:p-6 shadow-kawaii hover:shadow-kawaii-hover transition-all duration-200 flex flex-col justify-between hover:-translate-y-1 kawaii-focus"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full capitalize ${
                        board.role === 'admin'
                          ? 'bg-[#FFF3C4] text-[#7A5A50] border border-[#FFD966]'
                          : board.role === 'member'
                          ? 'bg-[#DCEBFA] text-[#4E5868] border border-[#BFD7F3]'
                          : 'bg-[#FDF0F5] text-[#7A5A50] border border-[#F7CADA]'
                      }`}
                    >
                      {board.role}
                    </span>

                    <span className="text-[10px] font-mono font-bold text-[#7A5A50]/60 bg-[#F8F8FB] px-2 py-0.5 rounded-lg border border-[#BFD7F3]/60">
                      Code: {board.invite_code}
                    </span>
                  </div>

                  <h3 className="font-heading text-base sm:text-lg font-bold text-[#7A5A50] group-hover:text-[#8FA8E8] transition-colors line-clamp-1">
                    {board.title}
                  </h3>

                  {board.description && (
                    <p className="mt-1 text-xs text-[#5B6475] line-clamp-2 leading-relaxed">
                      {board.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-[#F8F8FB] flex items-center justify-between text-xs text-[#5B6475] font-semibold">
                  <div className="flex items-center gap-3">
                    <span>{board.task_count || 0} tasks</span>
                    <span>•</span>
                    <span>{board.member_count || 1} members</span>
                  </div>

                  <span className="text-[#8FA8E8] font-bold group-hover:translate-x-1 transition-transform inline-flex items-center">
                    Open <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Modal: Create Board */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#7A5A50]/20 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-4xl border border-[#BFD7F3] shadow-kawaii-hover p-6">
            <h3 className="font-heading text-lg font-bold text-[#7A5A50] mb-4">
              🌸 Create a Dream Board
            </h3>
            <form onSubmit={handleCreateBoard} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#7A5A50] mb-1">
                  Board Title *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Kawaii Launch Team ✨"
                  className="w-full px-4 py-2 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3] text-sm font-semibold text-[#7A5A50] focus:bg-white kawaii-focus"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7A5A50] mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What is this board for?"
                  className="w-full px-4 py-2 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3] text-xs sm:text-sm text-[#4E5868] focus:bg-white kawaii-focus resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-2xl text-xs font-bold text-[#7A5A50] hover:bg-[#F8F8FB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim() || isCreating}
                  className="px-5 py-2 rounded-2xl bg-[#8FA8E8] text-white text-xs font-bold shadow-kawaii hover:bg-[#7F98D8] disabled:opacity-60"
                >
                  {isCreating ? 'Creating...' : 'Create Board'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Join Board */}
      {showJoinModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#7A5A50]/20 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm bg-white rounded-4xl border border-[#BFD7F3] shadow-kawaii-hover p-6">
            <h3 className="font-heading text-lg font-bold text-[#7A5A50] mb-2">
              💌 Join a Board
            </h3>
            <p className="text-xs text-[#5B6475] mb-4">
              Enter the 8-character invite code shared by the board admin:
            </p>
            <form onSubmit={handleJoinBoard} className="space-y-4">
              <div>
                <input
                  type="text"
                  required
                  autoFocus
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="e.g. KAWAII2026"
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3] text-sm font-mono font-bold tracking-widest text-center text-[#7A5A50] focus:bg-white kawaii-focus"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 rounded-2xl text-xs font-bold text-[#7A5A50] hover:bg-[#F8F8FB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!inviteCode.trim() || isJoining}
                  className="px-5 py-2 rounded-2xl bg-[#FFF3C4] border border-[#FFD966] text-[#7A5A50] text-xs font-bold shadow-sm hover:bg-[#FEEBB0] disabled:opacity-60"
                >
                  {isJoining ? 'Joining...' : 'Join Board'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

