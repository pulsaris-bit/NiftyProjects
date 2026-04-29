/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Mail, Camera, Check, LogOut, Lock, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { User as UserType } from '../types';
import { authService } from '../lib/authService';

interface ProfileModalProps {
  user: UserType;
  onClose: () => void;
  onUpdate: (user: UserType) => void;
  onLogout?: () => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}

export function ProfileModal({ user, onClose, onUpdate, onLogout, showNotification }: ProfileModalProps) {
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [loading, setLoading] = useState(false);
  
  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await authService.updateProfile({ name, avatar });
      onUpdate(updated);
      if (showNotification) showNotification('Profiel bijgewerkt');
      onClose();
    } catch (error: any) {
      if (showNotification) showNotification(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      if (showNotification) showNotification('Wachtwoorden komen niet overeen', 'error');
      return;
    }
    if (newPassword.length < 6) {
      if (showNotification) showNotification('Nieuw wachtwoord moet minimaal 6 tekens zijn', 'error');
      return;
    }

    setPasswordLoading(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      if (showNotification) showNotification('Wachtwoord succesvol gewijzigd');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
    } catch (error: any) {
      if (showNotification) showNotification(error.message, 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm my-auto border border-gray-100 max-h-[90vh] flex flex-col"
      >
        <div className="p-8 overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between mb-6 sticky top-0 bg-white z-10 pb-2">
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
                  <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
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
                  <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
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
              {loading ? 'Laden...' : 'Profiel Bijwerken'}
            </button>
          </form>

          {/* Password Change Section */}
          <div className="mt-8 pt-8 border-t border-gray-100">
            <button 
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="w-full flex items-center justify-between group"
            >
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Wachtwoord wijzigen</h3>
              {showPasswordSection ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            <AnimatePresence>
              {showPasswordSection && (
                <motion.form 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  onSubmit={handleChangePassword}
                  className="space-y-4 pt-4 overflow-hidden"
                >
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Huidig Wachtwoord</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type={showCurrentPass ? 'text' : 'password'}
                        required
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-12 text-sm outline-none focus:border-[var(--color-accent)] transition-all"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Nieuw Wachtwoord</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type={showNewPass ? 'text' : 'password'}
                        required
                        minLength={6}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-12 text-sm outline-none focus:border-[var(--color-accent)] transition-all"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Bevestig Wachtwoord</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="password"
                        required
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-sm outline-none focus:border-[var(--color-accent)] transition-all"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={passwordLoading}
                    className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2"
                  >
                    {passwordLoading ? 'Wijzigen...' : 'Wachtwoord Updaten'}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {onLogout && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <button 
                onClick={onLogout}
                className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 transition-all flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Log uit
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
