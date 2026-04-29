/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, Camera, X, AlertCircle, Loader2 } from 'lucide-react';
import { authService } from '../lib/authService';
import { User as UserType } from '../types';

interface AuthModalProps {
  onSuccess: (user: UserType) => void;
}

export function AuthModal({ onSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let user: UserType;
      if (isLogin) {
        user = await authService.login(email, password);
      } else {
        if (!name.trim()) throw new Error('Naam is verplicht');
        user = await authService.signup(email, name, password);
      }
      onSuccess(user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col md:flex-row bg-[var(--color-bg)] overflow-hidden">
      {/* Brand Side (Visible on Desktop) */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 bg-[var(--color-sidebar)] relative items-center justify-center p-12 overflow-hidden">
        {/* Abstract background elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[var(--color-accent)] opacity-10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[var(--color-accent)] opacity-20 blur-[100px]" />
        
        <div className="relative z-10 max-w-lg text-center lg:text-left">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-4 mb-8 justify-center lg:justify-start"
          >
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent)] flex items-center justify-center shadow-2xl shadow-orange-900/40 transform -rotate-6">
              <Camera className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white tracking-tight">NiftyProjects</h1>
              <p className="text-[var(--color-sidebar-text-muted)] font-medium">Blijf georganiseerd, werk slimmer.</p>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            <h2 className="text-5xl lg:text-7xl font-bold text-white leading-tight tracking-tighter">
              Manage al je <span className="text-[var(--color-accent)]">projecten</span> op één plek.
            </h2>
            <p className="text-xl text-[var(--color-sidebar-text-muted)] leading-relaxed max-w-md mx-auto lg:mx-0">
              De ultieme workflow voor teams en individuen die meer gedaan willen krijgen zonder de chaos.
            </p>
          </motion.div>
        </div>

        {/* Decorative dots/grid maybe? */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      </div>

      {/* Form Side */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 lg:p-24 relative overflow-y-auto">
        {/* Mobile Logo */}
        <div className="md:hidden absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)] flex items-center justify-center shadow-xl shadow-orange-500/20">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-[var(--color-text-main)] italic">Nifty.</span>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          <div className="mb-10 text-center md:text-left">
            <h2 className="text-3xl font-bold text-[var(--color-text-main)] mb-2">
              {isLogin ? 'Welkom terug' : 'Nieuw account'}
            </h2>
            <p className="text-[var(--color-text-sub)]">
              {isLogin ? 'Log in om verder te gaan naar je dashboard.' : 'Meld je aan en begin direct met overzicht.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <label className="text-sm font-semibold text-[var(--color-text-main)] ml-1">Volledige Naam</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-[var(--color-accent)] text-gray-400">
                      <User className="w-5 h-5" />
                    </div>
                    <input 
                      type="text" 
                      required
                      placeholder="Bas Joo"
                      className="w-full bg-white border border-gray-200 rounded-2xl py-4 pl-12 pr-4 text-[15px] outline-none focus:border-[var(--color-accent)] focus:ring-4 focus:ring-orange-500/5 transition-all shadow-sm"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--color-text-main)] ml-1">E-mailadres</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-[var(--color-accent)] text-gray-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input 
                  type="email" 
                  required
                  placeholder="naam@voorbeeld.nl"
                  className="w-full bg-white border border-gray-200 rounded-2xl py-4 pl-12 pr-4 text-[15px] outline-none focus:border-[var(--color-accent)] focus:ring-4 focus:ring-orange-500/5 transition-all shadow-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-sm font-semibold text-[var(--color-text-main)]">Wachtwoord</label>
                {isLogin && (
                  <button type="button" className="text-xs font-semibold text-[var(--color-accent)] hover:underline">
                    Wachtwoord vergeten?
                  </button>
                )}
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-[var(--color-accent)] text-gray-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  className="w-full bg-white border border-gray-200 rounded-2xl py-4 pl-12 pr-4 text-[15px] outline-none focus:border-[var(--color-accent)] focus:ring-4 focus:ring-orange-500/5 transition-all shadow-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-600 text-[13px] font-medium"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </motion.div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[var(--color-accent)] text-white rounded-2xl font-bold shadow-xl shadow-orange-950/10 hover:shadow-orange-950/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4 text-base"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Inloggen' : 'Account aanmaken')}
            </button>
          </form>

          <div className="mt-10 text-center">
            <p className="text-gray-500 text-[14px]">
              {isLogin ? 'Nog geen account?' : 'Al een account?'}
              <button 
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(null);
                }}
                className="ml-2 font-bold text-[var(--color-accent)] hover:underline"
              >
                {isLogin ? 'Registreer gratis' : 'Log hier in'}
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
