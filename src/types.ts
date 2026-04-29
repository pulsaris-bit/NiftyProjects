/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Status = string;
export type Priority = 'Laag' | 'Gemiddeld' | 'Hoog' | 'Urgent';

export interface Attachment {
  id: string;
  name: string;
  url: string;
}

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: Priority;
  spaceId: string;
  dueDate?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  attachments?: Attachment[];
  link?: string;
  subtasks?: SubTask[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface Space {
  id: string;
  userId?: string;
  name: string;
  icon: string;
  color: string;
  emoji?: string;
  columns?: string[];
  isShared?: boolean;
}
