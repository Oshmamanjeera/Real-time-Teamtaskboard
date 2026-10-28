import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TaskCard } from '../components/TaskCard.jsx';

describe('Frontend Permission Rendering', () => {
  const sampleTask = {
    id: 'task-abc',
    title: 'Audit WCAG AA Contrast',
    description: 'Ensure 4.5:1 contrast against pastel surfaces',
    status: 'to_do',
    priority: 'urgent',
    version: 3,
    created_by: 'user-admin',
    assignee_id: 'user-admin',
    assignee_name: 'Sakura Admin',
    assignee_avatar: '#F7CADA',
    comment_count: 2,
  };

  it('renders drag handle when canEdit is true', () => {
    render(
      <TaskCard
        task={sampleTask}
        canEdit={true}
        onClick={() => {}}
      />
    );

    expect(screen.getByTitle('Drag to reorder or move')).toBeInTheDocument();
    expect(screen.getByText('Audit WCAG AA Contrast')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('hides drag handle and renders view-only badge when canEdit is false (Viewer)', () => {
    render(
      <TaskCard
        task={sampleTask}
        canEdit={false}
        onClick={() => {}}
      />
    );

    expect(screen.queryByTitle('Drag to reorder or move')).not.toBeInTheDocument();
    expect(
      screen.getByTitle('View-only: You do not have permission to move this task')
    ).toBeInTheDocument();
  });
});

