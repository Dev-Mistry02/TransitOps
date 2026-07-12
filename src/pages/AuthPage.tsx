import { useState } from 'react';
import { Bus, Mail, Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck, Gauge, TrendingUp } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { ROLE_LABELS, ROLE_DESCRIPTIONS, ALL_ROLES } from '../lib/utils';
import { Spinner } from '../components/ui';
import { type Role } from '../lib/supabase';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('fleet_manager');
  // Role type imported from supabase
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        toast('Welcome back!', 'success');
      } else {
        await signUp(email, password, fullName, role);
        toast('Account created! Please sign in.', 'success');
        setMode('signin');
        setPassword('');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = async (demoRole: Role) => {
    const demoEmail = `demo.${demoRole}@transitops.com`;
    const demoPass = 'demo123456';
    setLoading(true);
    try {
      try {
        await signIn(demoEmail, demoPass);
        toast('Signed in with demo account', 'success');
      } catch {
        // First time: create the demo account, which auto-signs-in
        await signUp(demoEmail, demoPass, `Demo ${ROLE_LABELS[demoRole]}`, demoRole);
        toast('Demo account created & signed in', 'success');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Demo sign-in failed';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-sky-50 to-blue-100 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-800" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 text-white">
            <div className="h-11 w-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
              <Bus className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">TransitOps AI</h1>
              <p className="text-xs text-sky-100">Fleet Intelligence Platform</p>
            </div>
          </div>
        </div>
        <div className="relative z-10 text-white max-w-md">
          <h2 className="text-4xl font-bold leading-tight mb-4">Command your fleet with intelligence.</h2>
          <p className="text-sky-100 text-lg mb-8">Real-time fleet operations, analytics, and cost management — all in one premium dashboard.</p>
          <div className="space-y-3">
            {[
              { icon: Gauge, text: 'Live fleet utilization & KPI tracking' },
              { icon: ShieldCheck, text: 'Role-based access for every team member' },
              { icon: TrendingUp, text: 'Operational cost & ROI analytics' },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3 text-sky-50">
                <div className="h-9 w-9 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
                  <f.icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 text-sky-200 text-xs">© 2026 TransitOps AI. All rights reserved.</div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center shadow-lg">
              <Bus className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">TransitOps AI</h1>
              <p className="text-xs text-slate-500">Fleet Intelligence Platform</p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
              {mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {mode === 'signin' ? 'Enter your credentials to access the dashboard' : 'Join TransitOps AI and start managing your fleet'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="glass-label">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Smith" className="glass-input pl-10" />
                  </div>
                </div>
              )}
              <div>
                <label className="glass-label">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="glass-input pl-10" />
                </div>
              </div>
              <div>
                <label className="glass-label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type={showPassword ? 'text' : 'password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="glass-input pl-10 pr-10" />
                  <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {mode === 'signup' && (
                <div>
                  <label className="glass-label">Role</label>
                  <div className="grid grid-cols-1 gap-2">
                    {ALL_ROLES.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`text-left rounded-lg border px-3 py-2.5 transition ${
                          role === r
                            ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/30'
                            : 'border-slate-300/70 dark:border-slate-600/60 bg-white/50 dark:bg-slate-800/40 hover:border-slate-400'
                        }`}
                      >
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{ROLE_LABELS[r]}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{ROLE_DESCRIPTIONS[r]}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <Spinner className="h-4 w-4" /> : <>{mode === 'signin' ? 'Sign In' : 'Create Account'} <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>

            <div className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} className="font-semibold text-sky-600 dark:text-sky-400 hover:underline">
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </div>
          </div>

          {mode === 'signin' && (
            <div className="mt-4 glass-panel rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Quick Demo Access</p>
              <div className="flex flex-wrap gap-2">
                {ALL_ROLES.map((r) => (
                  <button
                    key={r}
                    onClick={() => fillDemo(r)}
                    className="rounded-lg border border-slate-300/70 dark:border-slate-600/60 bg-white/50 dark:bg-slate-800/40 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-sky-400 hover:text-sky-600 dark:hover:text-sky-400 transition"
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">Demo accounts are created on first use. If a role is missing, sign up with that role first.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
