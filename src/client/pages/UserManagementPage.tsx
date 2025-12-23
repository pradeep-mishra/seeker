// src/client/pages/UserManagementPage.tsx
import {
  ArrowLeft,
  Key,
  Plus,
  Shield,
  Trash2,
  User as UserIcon,
  Users
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { ConfirmDialog, Dialog } from "../components/common/Dialog";
import { Input } from "../components/common/Input";
import { toast } from "../components/common/Toast";
import { usersApi, type User } from "../lib/api";
import { useAuthStore } from "../stores/authStore";

export default function UserManagementPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();

  // Users list state
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Create user dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createUsername, setCreateUsername] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createIsAdmin, setCreateIsAdmin] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Reset password dialog state
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetUserId, setResetUserId] = useState("");
  const [resetUsername, setResetUsername] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState("");

  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState("");
  const [deleteUsername, setDeleteUsername] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Redirect if not admin
  useEffect(() => {
    if (!currentUser?.isAdmin) {
      navigate("/");
      toast.error("Access denied. Admin privileges required.");
    }
  }, [currentUser, navigate]);

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const { users: userList } = await usersApi.list();
      setUsers(userList);
    } catch (error) {
      toast.error("Failed to load users");
      console.error("Failed to load users:", error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");

    if (!createUsername.trim()) {
      setCreateError("Username is required");
      return;
    }

    if (createUsername.length < 3) {
      setCreateError("Username must be at least 3 characters");
      return;
    }

    if (!createPassword) {
      setCreateError("Password is required");
      return;
    }

    if (createPassword.length < 6) {
      setCreateError("Password must be at least 6 characters");
      return;
    }

    setIsCreating(true);
    try {
      const result = await usersApi.create(
        createUsername.trim(),
        createPassword,
        createIsAdmin
      );

      if (result.success) {
        toast.success(`User "${createUsername}" created successfully`);
        setShowCreateDialog(false);
        setCreateUsername("");
        setCreatePassword("");
        setCreateIsAdmin(false);
        loadUsers();
      } else {
        setCreateError("Failed to create user");
      }
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Failed to create user"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");

    if (!resetPassword) {
      setResetError("Password is required");
      return;
    }

    if (resetPassword.length < 6) {
      setResetError("Password must be at least 6 characters");
      return;
    }

    setIsResetting(true);
    try {
      const result = await usersApi.resetPassword(resetUserId, resetPassword);

      if (result.success) {
        toast.success(`Password reset for "${resetUsername}"`);
        setShowResetDialog(false);
        setResetUserId("");
        setResetUsername("");
        setResetPassword("");
      } else {
        setResetError("Failed to reset password");
      }
    } catch (error) {
      setResetError(
        error instanceof Error ? error.message : "Failed to reset password"
      );
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteUser = async () => {
    setIsDeleting(true);
    try {
      const result = await usersApi.delete(deleteUserId);

      if (result.success) {
        toast.success(`User "${deleteUsername}" deleted`);
        setShowDeleteDialog(false);
        setDeleteUserId("");
        setDeleteUsername("");
        loadUsers();
      } else {
        toast.error("Failed to delete user");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete user"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const openResetDialog = (user: User) => {
    setResetUserId(user.id);
    setResetUsername(user.username);
    setResetPassword("");
    setResetError("");
    setShowResetDialog(true);
  };

  const openDeleteDialog = (user: User) => {
    setDeleteUserId(user.id);
    setDeleteUsername(user.username);
    setShowDeleteDialog(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  // Don't render if not admin (will redirect)
  if (!currentUser?.isAdmin) {
    return null;
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg hover:bg-surface-hover transition-colors">
            <ArrowLeft className="h-5 w-5 text-content-secondary" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-content">User Management</h1>
            <p className="text-content-secondary">
              Manage users and permissions
            </p>
          </div>
          <Button
            onClick={() => {
              setCreateUsername("");
              setCreatePassword("");
              setCreateIsAdmin(false);
              setCreateError("");
              setShowCreateDialog(true);
            }}
            leftIcon={<Plus className="h-4 w-4" />}>
            Create User
          </Button>
        </div>

        {/* Users list */}
        <section>
          <h2 className="text-lg font-semibold text-content mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Users ({users.length})
          </h2>

          <div className="bg-surface border border-border rounded-lg divide-y divide-border">
            {isLoadingUsers ? (
              <div className="p-8 text-center">
                <div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full mx-auto" />
              </div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-content-secondary">
                No users found
              </div>
            ) : (
              users.map((user) => {
                const isSelf = user.id === currentUser?.id;

                return (
                  <div
                    key={user.id}
                    className="flex items-start gap-4 p-4 hover:bg-surface-hover transition-colors">
                    {/* Avatar */}
                    <div className="p-3 rounded-lg bg-surface-secondary">
                      <UserIcon className="h-5 w-5 text-content-secondary" />
                    </div>

                    {/* User info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-content">
                          {user.username}
                        </p>
                        {user.isAdmin && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent">
                            <Shield className="h-3 w-3" />
                            Admin
                          </span>
                        )}
                        {isSelf && (
                          <span className="text-xs text-content-tertiary">
                            (You)
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-content-secondary">
                        Created {formatDate(user.createdAt)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openResetDialog(user)}
                        className="p-2 text-content-secondary hover:text-content hover:bg-surface-secondary rounded-lg transition-colors"
                        title="Reset Password">
                        <Key className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openDeleteDialog(user)}
                        disabled={isSelf}
                        className="p-2 text-content-secondary hover:text-error hover:bg-error-surface rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={
                          isSelf ? "Cannot delete yourself" : "Delete User"
                        }>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Create User Dialog */}
      <Dialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        title="Create New User"
        size="sm">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            label="Username"
            value={createUsername}
            onChange={(e) => setCreateUsername(e.target.value)}
            placeholder="Enter username"
            autoFocus
            hint="Minimum 3 characters"
          />

          <Input
            label="Password"
            type="password"
            value={createPassword}
            onChange={(e) => setCreatePassword(e.target.value)}
            placeholder="Enter password"
            hint="Minimum 6 characters"
          />

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="create-admin"
              checked={createIsAdmin}
              onChange={(e) => setCreateIsAdmin(e.target.checked)}
              className="w-4 h-4 rounded border-border text-accent focus:ring-2 focus:ring-accent focus:ring-offset-0"
            />
            <label
              htmlFor="create-admin"
              className="text-sm font-medium text-content flex items-center gap-2">
              <Shield className="h-4 w-4 text-content-secondary" />
              Administrator privileges
            </label>
          </div>

          {createError && <p className="text-sm text-error">{createError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isCreating}>
              Create User
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog
        isOpen={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        title={`Reset Password for "${resetUsername}"`}
        size="sm">
        <form onSubmit={handleResetPassword} className="space-y-4">
          <Input
            label="New Password"
            type="password"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            placeholder="Enter new password"
            autoFocus
            hint="Minimum 6 characters"
          />

          {resetError && <p className="text-sm text-error">{resetError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowResetDialog(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isResetting}>
              Reset Password
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteUser}
        title="Delete User"
        message={`Are you sure you want to delete "${deleteUsername}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
