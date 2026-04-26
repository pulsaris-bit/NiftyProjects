/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Mail, Camera, Check } from 'lucide-react';
import { User as UserType } from '../types';
import { authService } from '../lib/authService';

interface ProfileModalProps {
  user: UserType;
  onClose: () => void;
  onUpdate: (user: UserType) => void;
}

export function ProfileModal({ user, onClose, onUpdate }: ProfileModalProps) {
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = authService.updateProfile({ name, avatar });
      onUpdate(updated);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100"
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Profiel Instellingen</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <img 
                  src={avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`}
                  className="w-24 h-24 rounded-full border-4 border-orange-50 shadow-lg object-cover"
                  alt="Avatar preview"
                />
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-all">
                  <Camera className="w-6 h-6 text-white" />
                  <input 
                    type="text" 
                    className="hidden" 
                    placeholder="URL voor avatar..."
                    onChange={(e) => {
                      const url = prompt('Voer de URL van je nieuwe avatar in:');
                      if (url) setAvatar(url);
                    }}
                  />
                </label>
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
                Klik op de foto om de URL aan te passen
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Naam</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1-2 text-gray-400" />
                  <input 
                    type="text" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-sm outline-none focus:border-[var(--color-accent)] transition-all"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Avatar URL (Optioneel)</label>
                <input 
                  type="text" 
                  placeholder="https://example.com/avatar.png"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm outline-none focus:border-[var(--color-accent)] transition-all"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">E-mail</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1-2 text-gray-400" />
                  <input 
                    type="email" 
                    disabled
                    className="w-full bg-gray-100 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-sm text-gray-500 cursor-not-allowed"
                    value={user.email}
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[var(--color-accent)] text-white rounded-xl font-bold shadow-lg shadow-orange-100 hover:shadow-orange-200 transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Laden...' : 'Opslaan'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
