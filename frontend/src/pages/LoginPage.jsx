import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ userID: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Guard against double-submit / re-render loops
  const submittingRef = useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Prevent re-entry if already in-flight
    if (submittingRef.current || loading) return;
    submittingRef.current = true;
    setError('');
    setLoading(true);
    try {
      const user = await login(form.userID.trim(), form.password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate('/dashboard', { replace: true });
      // Use replace:true so the login page is removed from history stack,
      // preventing the back-button loop that triggered infinite redirects.
      
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please try again.';
      toast.error(msg);
      setError(msg);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1e40af 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      position: 'relative', overflow: 'hidden',
    }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute', borderRadius: '50%',
          background: `rgba(255,255,255,${0.02 + i * 0.01})`,
          width: `${160 + i * 80}px`, height: `${160 + i * 80}px`,
          top: `${12 + i * 14}%`, left: `${4 + i * 10}%`, pointerEvents: 'none',
        }} />
      ))}

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{ width: 100, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 5px' }}>
            <img 
              src="/poj-logo.png"   
              alt="POJM"
              style={{ width: 100, height: 100, objectFit: 'contain' }}
            />
          </div>
          <h1 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 800 }}>VBS Management</h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.845rem', marginTop: 4 }}>Presence of Jesus Ministry</p>
        </div>

        <div style={{ background: 'white', borderRadius: 24, padding: 30, boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: 5 }}>Sign In</h2>
          <p style={{ fontSize: '0.845rem', color: '#64748b', marginBottom: 22 }}>Enter your credentials to access the system</p>

          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 10, padding: '11px 14px', marginBottom: 18, fontSize: '0.845rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚠️ {error}
            </div>
          )}

          {/* Use onSubmit on form — avoids duplicate calls from button clicks */}
          <form onSubmit={handleSubmit} autoComplete="on">
            <div className="form-group">
              <label className="form-label">Username <span className="required">*</span></label>
              <input className="form-input" type="text" placeholder="Enter your username"
                value={form.userID} onChange={e => setForm({ ...form, userID: e.target.value })}
                required autoComplete="username" autoFocus disabled={loading} />
            </div>

            <div className="form-group">
              <label className="form-label">Password <span className="required">*</span></label>
              <div style={{ position: 'relative' }}>
                <input className="form-input" type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  required style={{ paddingRight: 44 }} autoComplete="current-password" disabled={loading} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}>
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full"
              style={{ justifyContent: 'center', height: 44, fontSize: '0.92rem', marginTop: 6 }}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center', marginTop: 18, lineHeight: 1.5 }}>
            This system is for authorized personnel only.<br />Contact admin for access.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
