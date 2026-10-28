import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { KumoMascot } from '../components/KumoMascot.jsx';
import { LockScreenHeader } from '../components/LockScreenHeader.jsx';
import { KawaiiDecorations } from '../components/KawaiiDecorations.jsx';
import { Sparkles, ArrowRight, UserCheck } from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!email || !password || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await login(email, password);
      showToast({ message: 'Welcome back! (˶ᵔ ᵕ ᵔ˶) ✨', type: 'success' });
      navigate('/boards');
    } catch (err) {
      showToast({ message: err.message || 'Login failed', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = async (demoEmail) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setIsSubmitting(true);
    try {
      await login(demoEmail, 'Password123!');
      showToast({ message: `Logged in as ${demoEmail.split('@')[0]}! ✨`, type: 'success' });
      navigate('/boards');
    } catch (err) {
      showToast({ message: err.message || 'Quick login failed', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] flex flex-col justify-center items-center p-4">
      <KawaiiDecorations />

      <div className="w-full max-w-md z-10">
        <LockScreenHeader />

        <div className="bg-white/90 backdrop-blur-md rounded-4xl border border-[#BFD7F3] shadow-kawaii p-6 sm:p-8 mt-2">
          <div className="flex flex-col items-center text-center mb-6">
            <KumoMascot expression="happy" size={100} className="mb-2" />
            <h2 className="font-heading text-xl sm:text-2xl font-extrabold text-[#7A5A50]">
              Sign in to Dream Board
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-[#5B6475] mt-1">
              Your team's calm and cheerful Kanban space ✨
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#7A5A50] mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@kawaii.local"
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3] text-sm font-semibold text-[#7A5A50] focus:bg-white kawaii-focus"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#7A5A50] mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3] text-sm font-semibold text-[#7A5A50] focus:bg-white kawaii-focus"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-2xl bg-[#8FA8E8] hover:bg-[#7F98D8] text-white font-bold text-sm shadow-kawaii active:scale-95 transition-all flex items-center justify-center gap-2 kawaii-focus disabled:opacity-60"
            >
              <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Logins for Pair Programming & Testing */}
          <div className="mt-6 pt-5 border-t border-[#F8F8FB]">
            <span className="block text-[11px] font-bold text-[#7A5A50]/70 text-center mb-2 uppercase tracking-wider">
              Quick One-Click Demo Logins
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@kawaii.local')}
                className="py-1.5 px-2 rounded-xl bg-[#FFF3C4] hover:bg-[#FEEBB0] text-[#7A5A50] text-[11px] font-bold border border-[#FFD966] text-center transition-all kawaii-focus"
                title="Log in as Sakura Admin (Admin Role)"
              >
                👑 Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('member@kawaii.local')}
                className="py-1.5 px-2 rounded-xl bg-[#DCEBFA] hover:bg-[#CFE2F8] text-[#4E5868] text-[11px] font-bold border border-[#BFD7F3] text-center transition-all kawaii-focus"
                title="Log in as Mochi Member (Member Role)"
              >
                🍯 Member
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('viewer@kawaii.local')}
                className="py-1.5 px-2 rounded-xl bg-[#FDF0F5] hover:bg-[#FBE3ED] text-[#7A5A50] text-[11px] font-bold border border-[#F7CADA] text-center transition-all kawaii-focus"
                title="Log in as Hana Viewer (Viewer Role)"
              >
                ☁️ Viewer
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-xs font-semibold text-[#5B6475]">
            New to Kawaii Board?{' '}
            <Link to="/register" className="text-[#8FA8E8] hover:text-[#7A5A50] font-bold underline kawaii-focus rounded-lg">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

