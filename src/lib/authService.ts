/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User } from '../types';

const API_BASE = '/api';
const TOKEN_KEY = 'niftyprojects_token';
const USER_KEY = 'niftyprojects_user';

export const authService = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  getSession(): User | null {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  },

  async signup(email: string, name: string, password: string, avatar?: string): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password, avatar })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  },

  async login(email: string, password: string): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  async updateProfile(updates: Partial<User>): Promise<User> {
    // This would require a specific API route for updating users
    // For now we simulate or use the existing update logic if added to server
    const user = this.getSession();
    if (!user) throw new Error('Niet ingelogd');
    
    // In a real app we'd call PUT /api/users/me
    return { ...user, ...updates }; 
  }
};
