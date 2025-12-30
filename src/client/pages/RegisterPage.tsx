import { ArrowLeft, FolderSearch, Lock, User } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import { useAuthStore } from "../stores/authStore";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    const result = await register(username, password);
    if (!result.success) {
      setError(result.error || "Registration failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-4">
            <FolderSearch className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-content">Seeker</h1>
          <p className="text-content-secondary mt-1">
            Home Server File Browser
          </p>
        </div>

        {/* Register form */}
        <div className="bg-surface rounded-lg shadow-medium p-6 border border-border">
          <div className="flex items-center gap-2 mb-6">
            <Link
              to="/login"
              className="p-1 rounded hover:bg-surface-hover transition-colors">
              <ArrowLeft className="h-5 w-5 text-content-tertiary" />
            </Link>
            <h2 className="text-lg font-semibold text-content">
              Create Account
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              leftIcon={<User className="h-4 w-4" />}
              autoFocus
              autoComplete="username"
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a password"
              leftIcon={<Lock className="h-4 w-4" />}
              autoComplete="new-password"
            />

            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              leftIcon={<Lock className="h-4 w-4" />}
              autoComplete="new-password"
            />

            {error && (
              <div className="p-3 rounded bg-error-surface text-error text-sm">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Create Account
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-content-tertiary text-sm mt-6">
          Seeker v1.0.0
        </p>
      </div>
    </div>
  );
}
