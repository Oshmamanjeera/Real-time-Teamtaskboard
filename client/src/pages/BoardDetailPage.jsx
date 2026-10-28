import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Navbar } from '../components/Navbar.jsx';
import { KanbanColumn } from '../components/KanbanColumn.jsx';
import { TaskCard } from '../components/TaskCard.jsx';
import { TaskModal } from '../components/TaskModal.jsx';
import { CreateTaskModal } from '../components/CreateTaskModal.jsx';
import { BoardMembersModal } from '../components/BoardMembersModal.jsx';
import { KawaiiDecorations } from '../components/KawaiiDecorations.jsx';
import { Plus, Users, RefreshCw } from 'lucide-react';

const COLUMNS = ['to_do', 'in_progress', 'done'];

export function BoardDetailPage() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const { user, apiFetch } = useAuth();
  const { socket, joinBoard, leaveBoard, activeBoardUsers, onReconnect } = useSocket();
  const { showToast } = useToast();

  const [board, setBoard] = useState(null);
  const [members, setMembers] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active column for mobile view
  const [activeMobileColumn, setActiveMobileColumn] = useState('to_do');

  // Modals state
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createColumnTarget, setCreateColumnTarget] = useState('to_do');
  const [showMembersModal, setShowMembersModal] = useState(false);

  // Drag state
  const [activeDragTask, setActiveDragTask] = useState(null);

  // Accessibility live region announcement
  const [announcement, setAnnouncement] = useState('');

  // Ref to access current tasks in socket events without stale closures
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // Load board and tasks snapshot
  const loadBoardSnapshot = useCallback(async () => {
    try {
      const [boardData, tasksData] = await Promise.all([
        apiFetch(`/api/boards/${boardId}`),
        apiFetch(`/api/tasks?boardId=${boardId}`),
      ]);

      setBoard(boardData.board);
      setMembers(boardData.members);
      setUserRole(boardData.board.role);
      setTasks(tasksData.tasks || []);
    } catch (err) {
      if (err.status === 403) {
        showToast({ message: 'You do not have access to this board', type: 'error' });
        navigate('/boards');
      } else {
        showToast({ message: err.message || 'Failed to load board', type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  }, [boardId, apiFetch, navigate, showToast]);

  useEffect(() => {
    loadBoardSnapshot();
  }, [loadBoardSnapshot]);

  // Socket room join & live event synchronization
  useEffect(() => {
    joinBoard(boardId);

    // On reconnect, refetch snapshot (Requirement 4.10)
    const cleanupReconnect = onReconnect(() => {
      console.log('Socket reconnected, refetching board snapshot...');
      loadBoardSnapshot();
    });

    if (!socket) return;

    // Handler: task:created
    const handleTaskCreated = ({ task }) => {
      if (!task || task.board_id !== boardId) return;
      setTasks((prev) => {
        // Prevent duplicate
        if (prev.some((t) => t.id === task.id)) return prev;
        return [...prev, task];
      });
      setAnnouncement(`New task added: ${task.title}`);
    };

    // Handler: task:updated (Requirement 4.5: ignore if version <= existing version)
    const handleTaskUpdated = ({ task }) => {
      if (!task || task.board_id !== boardId) return;
      setTasks((prev) => {
        const existing = prev.find((t) => t.id === task.id);
        if (existing && existing.version >= task.version) {
          // Ignore stale or out-of-order event
          return prev;
        }
        if (!existing) {
          return [...prev, task];
        }
        return prev.map((t) => (t.id === task.id ? task : t));
      });
      // Also update selected modal task if open
      setSelectedTask((prev) => (prev && prev.id === task.id ? task : prev));
      setAnnouncement(`Task updated: ${task.title}`);
    };

    // Handler: task:deleted
    const handleTaskDeleted = ({ taskId, version }) => {
      setTasks((prev) => {
        const existing = prev.find((t) => t.id === taskId);
        if (existing && existing.version > version) {
          return prev; // Ignore stale delete
        }
        return prev.filter((t) => t.id !== taskId);
      });
      setSelectedTask((prev) => (prev && prev.id === taskId ? null : prev));
      setAnnouncement('A task was deleted');
    };

    // Handler: comment:created
    const handleCommentCreated = ({ taskId }) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, comment_count: (t.comment_count || 0) + 1 } : t
        )
      );
    };

    socket.on('task:created', handleTaskCreated);
    socket.on('task:updated', handleTaskUpdated);
    socket.on('task:deleted', handleTaskDeleted);
    socket.on('comment:created', handleCommentCreated);

    return () => {
      leaveBoard(boardId);
      cleanupReconnect();
      socket.off('task:created', handleTaskCreated);
      socket.off('task:updated', handleTaskUpdated);
      socket.off('task:deleted', handleTaskDeleted);
      socket.off('comment:created', handleCommentCreated);
    };
  }, [boardId, socket, joinBoard, leaveBoard, loadBoardSnapshot, onReconnect]);

  // Configure DND sensors with long-press / touch support
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before drag begins
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms hold required so touch scrolling is NOT hijacked
        tolerance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Drag Start
  const handleDragStart = (event) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveDragTask(task);
      setAnnouncement(`Picked up task ${task.title}`);
    }
  };

  // Drag End: Optimistic Update + Atomic Server Mutation
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragTask(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const sourceTask = tasks.find((t) => t.id === activeId);
    if (!sourceTask) return;

    // Determine target column and target position
    let targetStatus = sourceTask.status;
    let targetIndex = -1;

    // If dropped over a column container directly
    if (COLUMNS.includes(overId)) {
      targetStatus = overId;
      const columnTasks = tasks.filter((t) => t.status === targetStatus && t.id !== activeId);
      targetIndex = columnTasks.length; // placed at bottom
    } else {
      // Dropped over another task
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        targetStatus = overTask.status;
        const columnTasks = tasks.filter((t) => t.status === targetStatus && t.id !== activeId);
        const overIndex = columnTasks.findIndex((t) => t.id === overId);
        targetIndex = overIndex >= 0 ? overIndex : columnTasks.length;
      }
    }

    const columnTasksBeforeMove = tasks
      .filter((t) => t.status === targetStatus && t.id !== activeId)
      .sort((a, b) => a.position - b.position);

    // Compute fractional position
    let newPosition;
    if (columnTasksBeforeMove.length === 0) {
      newPosition = 1000.0;
    } else if (targetIndex <= 0) {
      newPosition = columnTasksBeforeMove[0].position - 1000.0;
    } else if (targetIndex >= columnTasksBeforeMove.length) {
      newPosition = columnTasksBeforeMove[columnTasksBeforeMove.length - 1].position + 1000.0;
    } else {
      const prevPos = columnTasksBeforeMove[targetIndex - 1].position;
      const nextPos = columnTasksBeforeMove[targetIndex].position;
      newPosition = (prevPos + nextPos) / 2.0;
    }

    // Check if nothing changed
    if (sourceTask.status === targetStatus && Math.abs(sourceTask.position - newPosition) < 0.01) {
      return;
    }

    // --- OPTIMISTIC UPDATE ---
    const snapshotBeforeMutation = [...tasks];
    const optimisticTask = {
      ...sourceTask,
      status: targetStatus,
      position: newPosition,
    };

    setTasks((prev) => prev.map((t) => (t.id === activeId ? optimisticTask : t)));
    setAnnouncement(`Moved task ${sourceTask.title} to ${targetStatus}`);

    // Call server with expectedVersion
    try {
      const res = await apiFetch(`/api/tasks/${activeId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          expectedVersion: sourceTask.version,
          status: targetStatus,
          position: newPosition,
        }),
      });

      // Update state with confirmed version from server
      setTasks((prev) => prev.map((t) => (t.id === activeId ? res.task : t)));
    } catch (err) {
      // --- ROLLBACK ON CONFLICT OR ERROR (Section 4.6) ---
      setTasks(snapshotBeforeMutation);

      if (err.status === 409) {
        showToast({
          message: 'Someone updated this task first, so your change was not applied.',
          type: 'conflict',
        });
        setAnnouncement('Conflict detected: Task rolled back to server state.');
        // If server sent back currentTask, update with it
        if (err.data?.currentTask) {
          setTasks((prev) =>
            prev.map((t) => (t.id === activeId ? err.data.currentTask : t))
          );
        }
      } else if (err.status === 403) {
        showToast({
          message: 'You do not have permission to move this task.',
          type: 'error',
        });
        setAnnouncement('Action forbidden: Task move rolled back.');
      } else if (err.status === 410) {
        showToast({
          message: 'This task has already been deleted!',
          type: 'conflict',
        });
        setTasks((prev) => prev.filter((t) => t.id !== activeId));
      } else {
        showToast({
          message: err.message || 'Failed to move task. Rolled back.',
          type: 'error',
        });
      }
    }
  };

  // Task Update (from Modal)
  const handleUpdateTask = async (taskId, updates) => {
    const res = await apiFetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });

    setTasks((prev) => prev.map((t) => (t.id === taskId ? res.task : t)));
    setSelectedTask(res.task);
    return res.task;
  };

  // Task Delete (from Modal)
  const handleDeleteTask = async (taskId, expectedVersion) => {
    await apiFetch(`/api/tasks/${taskId}`, {
      method: 'DELETE',
      body: JSON.stringify({ expectedVersion }),
    });

    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedTask(null);
  };

  // Task Create
  const handleCreateTask = async (taskPayload) => {
    const res = await apiFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(taskPayload),
    });

    setTasks((prev) => {
      if (prev.some((t) => t.id === res.task.id)) return prev;
      return [...prev, res.task];
    });
    return res.task;
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex flex-col justify-center items-center p-4">
        <div className="animate-spin text-3xl mb-3">🌸</div>
        <p className="font-heading text-sm font-bold text-[#7A5A50]">
          Loading your dreamy task board...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col relative select-none">
      <KawaiiDecorations />

      {/* Screen Reader ARIA Live Region for accessibility */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {announcement}
      </div>

      <Navbar
        board={board}
        userRole={userRole}
        onOpenMembers={() => setShowMembersModal(true)}
        onOpenCreateTask={() => {
          setCreateColumnTarget('to_do');
          setShowCreateModal(true);
        }}
      />

      {/* Subheader: Board Info & Active Presence Avatars */}
      <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 z-10">
        <div className="flex items-center gap-2">
          {board?.description && (
            <span className="text-xs text-[#5B6475] hidden md:inline truncate max-w-md">
              {board.description}
            </span>
          )}
        </div>

        {/* Presence Avatars: Teammates live on this board */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-bold text-[#7A5A50]/70 hidden min-[540px]:inline">
            Viewing now:
          </span>
          <div className="flex items-center -space-x-2 overflow-hidden">
            {activeBoardUsers.length === 0 ? (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] text-[#7A5A50] ring-2 ring-white shadow-xs"
                style={{ backgroundColor: user?.avatar_color || '#F7CADA' }}
                title={`You (${user?.name})`}
              >
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            ) : (
              activeBoardUsers.map((u, i) => (
                <div
                  key={u.socketId || i}
                  className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] text-[#7A5A50] ring-2 ring-white shadow-xs select-none"
                  style={{ backgroundColor: u.avatarColor || '#F7CADA' }}
                  title={`${u.name} (${u.role})`}
                >
                  {u.name?.charAt(0).toUpperCase()}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Mobile Column Switcher (Tab Segmented Bar for < 768px) */}
      <div className="md:hidden px-3 sm:px-6 mb-2 z-10">
        <div className="flex p-1 rounded-3xl bg-[#F8F8FB] border border-[#BFD7F3] shadow-inner-soft">
          {COLUMNS.map((colKey) => {
            const count = tasks.filter((t) => t.status === colKey).length;
            const labels = {
              to_do: '☁️ To Do',
              in_progress: '🍯 In Progress',
              done: '🌸 Done',
            };
            const isActive = activeMobileColumn === colKey;

            return (
              <button
                key={colKey}
                type="button"
                onClick={() => setActiveMobileColumn(colKey)}
                className={`flex-1 py-2 text-xs font-bold rounded-2xl transition-all flex items-center justify-center gap-1.5 kawaii-focus ${
                  isActive
                    ? 'bg-white text-[#7A5A50] shadow-sm font-extrabold'
                    : 'text-[#5B6475] hover:text-[#7A5A50]'
                }`}
              >
                <span>{labels[colKey]}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#DCEBFA] text-[#4E5868]">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Kanban Board with DndContext */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-2 pb-24 md:pb-8 z-10 flex flex-col">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Responsive Layout:
              Mobile (<768px): shows only the active tab column.
              Tablet (768px - 1024px): shows 2-3 columns with smooth overflow or grid.
              Desktop (>1024px): shows all 3 columns simultaneously.
          */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-start">
            {COLUMNS.map((colKey) => {
              const colTasks = tasks
                .filter((t) => t.status === colKey)
                .sort((a, b) => a.position - b.position);

              return (
                <div
                  key={colKey}
                  className={`h-full ${
                    activeMobileColumn !== colKey ? 'hidden md:block' : 'block'
                  }`}
                >
                  <KanbanColumn
                    status={colKey}
                    tasks={colTasks}
                    userRole={userRole}
                    currentUserId={user?.id}
                    onTaskClick={(task) => setSelectedTask(task)}
                    onAddTask={(st) => {
                      setCreateColumnTarget(st);
                      setShowCreateModal(true);
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Drag Overlay clone */}
          <DragOverlay dropAnimation={{ duration: 250, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
            {activeDragTask ? (
              <TaskCard task={activeDragTask} canEdit={true} isOverlay={true} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      {/* Floating Action Button (+) for Mobile */}
      {userRole !== 'viewer' && (
        <button
          type="button"
          onClick={() => {
            setCreateColumnTarget(activeMobileColumn);
            setShowCreateModal(true);
          }}
          className="md:hidden fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#8FA8E8] hover:bg-[#7F98D8] text-white shadow-kawaii-hover flex items-center justify-center active:scale-90 transition-transform kawaii-focus"
          aria-label="Add new task"
          title="Add new task"
        >
          <Plus className="w-7 h-7" />
        </button>
      )}

      {/* Task Details & Comments Modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          userRole={userRole}
          members={members}
          onClose={() => setSelectedTask(null)}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
        />
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <CreateTaskModal
          boardId={boardId}
          initialStatus={createColumnTarget}
          members={members}
          onClose={() => setShowCreateModal(false)}
          onCreateTask={handleCreateTask}
        />
      )}

      {/* Board Members & Invite Code Modal */}
      {showMembersModal && (
        <BoardMembersModal
          board={board}
          members={members}
          userRole={userRole}
          onClose={() => setShowMembersModal(false)}
          onRefreshMembers={loadBoardSnapshot}
        />
      )}
    </div>
  );
}

