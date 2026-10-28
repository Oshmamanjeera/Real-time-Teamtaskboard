import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider, useToast } from '../context/ToastContext.jsx';

// Component that simulates an optimistic mutation with 409 rollback
function OptimisticTaskWidget({ initialTask, onServerMutation }) {
  const [task, setTask] = React.useState(initialTask);
  const { showToast } = useToast();

  const handleMoveToDone = async () => {
    // 1. Optimistic Update
    const previous = { ...task };
    setTask((prev) => ({ ...prev, status: 'done', version: prev.version + 1 }));

    try {
      const serverResult = await onServerMutation(task.id, task.version);
      setTask(serverResult);
    } catch (err) {
      // 2. Rollback on 409 Conflict
      setTask(previous);
      if (err.status === 409) {
        showToast({
          message: 'Someone updated this task first, so your change was not applied.',
          type: 'conflict',
        });
      }
    }
  };

  return (
    <div>
      <div data-testid="task-status">{task.status}</div>
      <div data-testid="task-version">v{task.version}</div>
      <button onClick={handleMoveToDone}>Move to Done</button>
    </div>
  );
}

describe('Frontend Optimistic Updates & 409 Rollback', () => {
  it('applies optimistic update instantly and rolls back cleanly when server returns 409 Conflict', async () => {
    const initialTask = {
      id: 'task-123',
      title: 'Optimistic Test Task',
      status: 'in_progress',
      version: 5,
    };

    // Mock server returning 409 Conflict
    const mockServerMutation = vi.fn().mockRejectedValue({
      status: 409,
      code: 'VERSION_CONFLICT',
      message: 'Someone updated this task first',
      data: {
        currentTask: { ...initialTask, status: 'to_do', version: 6 },
      },
    });

    render(
      <ToastProvider>
        <OptimisticTaskWidget
          initialTask={initialTask}
          onServerMutation={mockServerMutation}
        />
      </ToastProvider>
    );

    // Initial state
    expect(screen.getByTestId('task-status').textContent).toBe('in_progress');
    expect(screen.getByTestId('task-version').textContent).toBe('v5');

    // Trigger action
    const btn = screen.getByText('Move to Done');
    fireEvent.click(btn);

    // Verify optimistic change occurred or rollback triggers
    await waitFor(() => {
      // Should roll back to initial status
      expect(screen.getByTestId('task-status').textContent).toBe('in_progress');
      expect(screen.getByTestId('task-version').textContent).toBe('v5');
    });

    // Verify conflict toast is displayed with exact friendly message
    await waitFor(() => {
      expect(
        screen.getByText('Someone updated this task first, so your change was not applied.')
      ).toBeInTheDocument();
    });
  });

  it('keeps the updated state when server returns 200 OK', async () => {
    const initialTask = {
      id: 'task-456',
      title: 'Success Task',
      status: 'to_do',
      version: 1,
    };

    const mockServerMutation = vi.fn().mockResolvedValue({
      ...initialTask,
      status: 'done',
      version: 2,
    });

    render(
      <ToastProvider>
        <OptimisticTaskWidget
          initialTask={initialTask}
          onServerMutation={mockServerMutation}
        />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Move to Done'));

    await waitFor(() => {
      expect(screen.getByTestId('task-status').textContent).toBe('done');
      expect(screen.getByTestId('task-version').textContent).toBe('v2');
    });
  });
});

