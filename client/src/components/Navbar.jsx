import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { KumoMascot } from './KumoMascot.jsx';
import { LogOut, LayoutGrid, Users, Plus, Sparkles } from 'lucide-react';

export function Navbar({ board, onOpenMembers, onOpenCreateTask, userRole }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-30 bg-[#F8F8FB]/90 backdrop-blur-md border-b border-[#BFD7F3]/60 px-3 sm:px-6 py-2.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Brand / Mascot */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/boards"
            className="flex items-center gap-2 group kawaii-focus rounded-2xl p-1"
            title="Go to all boards"
          >
            <KumoMascot expression="happy" size={38} className="group-hover:rotate-6 transition-transform" />
            <div className="hidden min-[420px]:block">
              <span className="font-heading text-base sm:text-lg font-bold text-[#7A5A50] tracking-tight">
                Kawaii Board
              </span>
              <span className="block text-[10px] sm:text-xs font-semibold text-[#8FA8E8] -mt-1">
                Real-Time Kanban ✨
              </span>
            </div>
          </Link>

          {/* Board Breadcrumb / Title if inside a board */}
          {board && (
            <div className="flex items-center gap-1.5 ml-1 sm:ml-4 pl-2 sm:pl-4 border-l border-[#BFD7F3]/80">
              <span className="font-heading text-xs sm:text-sm font-bold text-[#7A5A50] truncate max-w-[120px] sm:max-w-[200px]">
                {board.title}
              </span>
              {userRole && (
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full capitalize ${
                    userRole === 'admin'
                      ? 'bg-[#FFF3C4] text-[#7A5A50] border border-[#FFD966]'
                      : userRole === 'member'
                      ? 'bg-[#DCEBFA] text-[#4E5868] border border-[#BFD7F3]'
                      : 'bg-[#FDF0F5] text-[#7A5A50] border border-[#F7CADA]'
                  }`}
                >
                  {userRole}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions and User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {board && userRole !== 'viewer' && onOpenCreateTask && (
            <button
              type="button"
              onClick={onOpenCreateTask}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#8FA8E8] hover:bg-[#7F98D8] text-white font-bold text-xs sm:text-sm shadow-sm hover:shadow-kawaii transition-all active:scale-95 kawaii-focus"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </button>
          )}

          {board && onOpenMembers && (
            <button
              type="button"
              onClick={onOpenMembers}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#FFF3C4] hover:bg-[#FEEBB0] text-[#7A5A50] font-bold text-xs sm:text-sm border border-[#FFD966] shadow-sm transition-all active:scale-95 kawaii-focus"
              title="View members and invite code"
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#7A5A50]" />
              <span className="hidden sm:inline">Members</span>
            </button>
          )}

          <Link
            to="/boards"
            className="p-2 rounded-2xl text-[#7A5A50] hover:bg-[#DCEBFA]/60 transition-colors kawaii-focus"
            title="All Boards"
          >
            <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>

          {/* User Avatar with Pastel Ring */}
          {user && (
            <div
              className="flex items-center gap-2 pl-1 sm:pl-2"
              title={`Logged in as ${user.name} (${user.email})`}
            >
              <div
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs text-[#7A5A50] ring-2 ring-[#8FA8E8] shadow-sm select-none"
                style={{ backgroundColor: user.avatar_color || '#F7CADA' }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-2xl text-[#7A5A50] hover:bg-[#FDF0F5] transition-colors kawaii-focus"
            title="Log Out"
            aria-label="Log out"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}

