import { FolderSearch, Lock, User } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import { toast } from "../components/common/Toast";
import { APP_VERSION } from "../lib/version";
import { useAuthStore } from "../stores/authStore";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, isLoading } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Please enter username and password");
      return;
    }

    const result = await login(username, password);
    if (!result.success) {
      const errorMessage = result.error || "Login failed";
      setError(errorMessage);
      toast.error(errorMessage);
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

        {/* Login form */}
        <div className="bg-surface rounded-lg shadow-medium p-6 border border-border">
          <h2 className="text-lg font-semibold text-content mb-6">Sign in</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              leftIcon={<User className="h-4 w-4" />}
              autoFocus
              autoComplete="username"
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              leftIcon={<Lock className="h-4 w-4" />}
              autoComplete="current-password"
            />

            {error && (
              <div className="p-3 rounded bg-error-surface text-error text-sm">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Sign in
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-content-tertiary text-sm mt-6">
          Seeker v{APP_VERSION}
        </p>
      </div>
    </div>
  );
}
