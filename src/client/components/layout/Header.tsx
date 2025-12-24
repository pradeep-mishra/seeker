// src/client/components/layout/Header.tsx
import {
  ArrowUpDown,
  ChevronDown,
  CircleUserRound,
  FolderSearch,
  Grid,
  LayoutGrid,
  List,
  LogOut,
  Menu,
  Search,
  Settings,
  Upload,
  Users
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useFileUpload } from "../../lib/useFileUpload";
import { useAuthStore } from "../../stores/authStore";
import { useFileStore } from "../../stores/fileStore";
import { useUIStore } from "../../stores/uiStore";

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAuthenticated } = useAuthStore();
  const {
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    sortOrder,
    toggleSortOrder,
    toggleSidebar
  } = useUIStore();
  const { currentPath } = useFileStore();

  // Check if we're on the browse page
  const isBrowsePage =
    location.pathname === "/" || location.pathname.startsWith("/browse");

  const [searchQuery, setSearchQuery] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFiles } = useFileUpload();

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setShowUserMenu(false);
      }
      if (
        sortMenuRef.current &&
        !sortMenuRef.current.contains(e.target as Node)
      ) {
        setShowSortMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement search
    console.log("Search:", searchQuery);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const viewModeIcons = {
    list: <List className="h-4 w-4" />,
    thumbnail: <Grid className="h-4 w-4" />,
    card: <LayoutGrid className="h-4 w-4" />
  };

  const sortOptions = [
    { value: "name", label: "Name" },
    { value: "date", label: "Date Modified" },
    { value: "size", label: "Size" },
    { value: "type", label: "Type" }
  ];

  return (
    <header className="h-14 flex items-center gap-4 px-4 border-b border-border bg-surface shrink-0">
      {/* Left section */}
      <div className="flex items-center gap-2">
        {/* Menu toggle */}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded hover:bg-surface-hover transition-colors"
          aria-label="Toggle sidebar">
          <Menu className="h-5 w-5 text-content-secondary" />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <FolderSearch className="h-5 w-5 text-accent" />
          <span className="font-semibold text-content hidden sm:inline">
            Seeker
          </span>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search - only on browse page */}
      {isBrowsePage && (
        <form onSubmit={handleSearch} className="hidden md:flex items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-content-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-64 h-9 pl-9 pr-3 rounded-lg border border-border bg-surface-secondary text-sm
                placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-border-focus"
            />
          </div>
        </form>
      )}

      {/* View mode toggle - only on browse page */}
      {isBrowsePage && (
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          {(["list", "thumbnail", "card"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`p-2 transition-colors ${
                viewMode === mode
                  ? "bg-accent text-content-inverse"
                  : "hover:bg-surface-hover text-content-secondary"
              }`}
              aria-label={`${mode} view`}>
              {viewModeIcons[mode]}
            </button>
          ))}
        </div>
      )}

      {/* Sort dropdown - only on browse page. {TODO} */}
      {isBrowsePage && false && (
        <div className="relative" ref={sortMenuRef}>
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-surface-hover transition-colors text-sm">
            <ArrowUpDown className="h-4 w-4 text-content-secondary" />
            <span className="hidden lg:inline text-content-secondary">
              {sortOptions.find((o) => o.value === sortBy)?.label}
            </span>
            <ChevronDown className="h-4 w-4 text-content-tertiary" />
          </button>

          {showSortMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border rounded-lg shadow-elevated z-50">
              <div className="py-1">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      if (sortBy === option.value) {
                        toggleSortOrder();
                      } else {
                        setSortBy(option.value as typeof sortBy);
                      }
                      setShowSortMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-surface-hover transition-colors ${
                      sortBy === option.value ? "text-accent" : "text-content"
                    }`}>
                    {option.label}
                    {sortBy === option.value && (
                      <span className="text-xs text-content-tertiary">
                        {sortOrder === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload button - only on browse page */}
      {isBrowsePage && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) {
                uploadFiles(files);
              }
              // Reset input so same file can be selected again
              e.target.value = "";
            }}
          />
          <button
            className="flex items-center gap-2 px-4 py-2 bg-accent text-content-inverse rounded-md hover:bg-accent-hover transition-colors text-sm font-medium"
            onClick={() => {
              fileInputRef.current?.click();
            }}>
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Upload</span>
          </button>
        </>
      )}

      {/* User menu */}
      <div className="relative" ref={userMenuRef}>
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-hover transition-colors">
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.username}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <CircleUserRound
                className="h-7 w-7 text-accent"
                strokeWidth={1.5}
              />
            )}
          </div>
        </button>

        {showUserMenu && (
          <div className="absolute right-0 top-full mt-1 w-56 bg-surface border border-border rounded-lg shadow-elevated z-50">
            {/* User info */}
            <div className="px-4 py-3 border-b border-border">
              <p className="font-medium text-content">{user?.username}</p>
              <p className="text-sm text-content-tertiary">
                {user?.isAdmin ? "Administrator" : "User"}
              </p>
            </div>

            {/* Menu items */}
            <div className="py-1">
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  navigate("/settings");
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-content hover:bg-surface-hover transition-colors">
                <Settings className="h-4 w-4 text-content-secondary" />
                Settings
              </button>

              {user?.isAdmin && (
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate("/users");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-content hover:bg-surface-hover transition-colors">
                  <Users className="h-4 w-4 text-content-secondary" />
                  User Management
                </button>
              )}
            </div>

            {/* Logout */}
            <div className="border-t border-border py-1">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-error hover:bg-error-surface transition-colors">
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
