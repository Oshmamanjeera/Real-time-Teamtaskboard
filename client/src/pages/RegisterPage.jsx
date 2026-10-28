import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { KumoMascot } from '../components/KumoMascot.jsx';
import { LockScreenHeader } from '../components/LockScreenHeader.jsx';
import { KawaiiDecorations } from '../components/KawaiiDecorations.jsx';
import { ArrowRight } from 'lucide-react';

const AVATAR_COLORS = [
  '#F7CADA', // Blush Pink
  '#8FA8E8', // Periwinkle
  '#FFF3C4', // Butter Cream
  '#BFD7F3', // Sky Blue
  '#FFD966', // Star Yellow
  '#D2F1DF', // Soft Mint
];

export function RegisterPage() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password || isSubmitting) return;

    if (password.length < 6) {
      showToast({ message: 'Password must be at least 6 characters!', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email, password, name, selectedColor);
      showToast({ message: 'Welcome to the team! ✨ (˶ᵔ ᵕ ᵔ˶)', type: 'success' });
      navigate('/boards');
    } catch (err) {
      showToast({ message: err.message || 'Registration failed', type: 'error' });
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
            <KumoMascot expression="celebrating" size={90} className="mb-2" />
            <h2 className="font-heading text-xl sm:text-2xl font-extrabold text-[#7A5A50]">
              Create an Account
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-[#5B6475] mt-1">
              Join your team's dreamy task universe! 🌸
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#7A5A50] mb-1">
                Your Cute Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sakura Mochi"
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3] text-sm font-semibold text-[#7A5A50] focus:bg-white kawaii-focus"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#7A5A50] mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mochi@kawaii.local"
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
                placeholder="At least 6 characters..."
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F8F8FB] border border-[#BFD7F3] text-sm font-semibold text-[#7A5A50] focus:bg-white kawaii-focus"
              />
            </div>

            {/* Avatar Color Picker */}
            <div>
              <label className="block text-xs font-bold text-[#7A5A50] mb-1.5">
                Choose Your Pastel Avatar Ring
              </label>
              <div className="flex items-center justify-between gap-2 px-1">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    style={{ backgroundColor: color }}
                    className={`w-8 h-8 rounded-full border-2 transition-transform active:scale-90 ${
                      selectedColor === color
                        ? 'border-[#7A5A50] scale-110 shadow-xs ring-2 ring-[#8FA8E8]/60'
                        : 'border-white hover:scale-105'
                    }`}
                    aria-label={`Select avatar color ${color}`}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-2xl bg-[#8FA8E8] hover:bg-[#7F98D8] text-white font-bold text-sm shadow-kawaii active:scale-95 transition-all flex items-center justify-center gap-2 kawaii-focus disabled:opacity-60"
            >
              <span>{isSubmitting ? 'Creating account...' : 'Get Started'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="mt-6 text-center text-xs font-semibold text-[#5B6475]">
            Already have an account?{' '}
            <Link to="/login" className="text-[#8FA8E8] hover:text-[#7A5A50] font-bold underline kawaii-focus rounded-lg">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

