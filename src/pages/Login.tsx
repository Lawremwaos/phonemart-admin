import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useShop } from "../context/ShopContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useShop();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await login(email, password);
      if (success) {
        navigate("/");
      } else {
        setError("Invalid email or password");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(79,122,101,0.24),transparent),radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(184,149,103,0.14),transparent)]"
        aria-hidden
      />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--pm-accent)] to-[var(--pm-accent-strong)] text-lg font-black text-white shadow-lg shadow-[rgba(79,122,101,0.3)]">
            PM
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--pm-ink)]">PHONEMART</h1>
          <p className="mt-1 text-sm font-medium text-[var(--pm-ink-soft)]">Sign in to the admin workspace</p>
        </div>

        <div className="rounded-2xl border border-[var(--pm-border)] bg-[color-mix(in_srgb,var(--pm-surface)_92%,transparent_8%)] p-8 shadow-xl shadow-slate-900/5 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[var(--pm-ink-soft)]">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pm-input px-3.5 py-2.5 placeholder:text-[var(--pm-ink-soft)]"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[var(--pm-ink-soft)]">
                Password
              </label>
              <div className="relative flex items-center">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pm-input px-3.5 py-2.5 pr-16 placeholder:text-[var(--pm-ink-soft)]"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--pm-ink-soft)] hover:bg-[var(--pm-surface-soft)] hover:text-[var(--pm-ink)]"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-gradient-to-r from-[var(--pm-accent)] to-[var(--pm-accent-strong)] py-3 font-semibold text-white shadow-md shadow-[rgba(79,122,101,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-8 border-t border-[var(--pm-border)] pt-6">
            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--pm-ink-soft)]">Demo</p>
            <div className="space-y-1.5 text-center text-xs text-[var(--pm-ink-soft)]">
              <p>
                <span className="font-semibold text-[var(--pm-ink)]">Admin</span> — admin@phonemart.com / admin123
              </p>
              <p>
                <span className="font-semibold text-[var(--pm-ink)]">Technician</span> — tech1@phonemart.com / tech123
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
