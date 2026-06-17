'use client'

import { useAuthStore } from '@/store/auth'

export function Topbar() {
  const { user, logout } = useAuthStore()
  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{user?.email}</span>
        <button
          onClick={logout}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
