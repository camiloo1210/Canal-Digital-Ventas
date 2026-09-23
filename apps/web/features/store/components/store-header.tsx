'use client';

import * as React from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LogOutIcon,
  LayoutDashboardIcon,
  CircleUserRoundIcon
} from 'lucide-react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { logoutAction } from '@/features/iam/actions/logout.action';
import { StoreViewer } from '../queries/store-viewer.query';

interface StoreHeaderProps {
  viewer: StoreViewer;
  tenantSlug: string;
  labels: {
    login: string;
    createAccount: string;
    logout: string;
    dashboard: string;
    settings: string;
  };
}

export function StoreHeader({ viewer, tenantSlug, labels }: StoreHeaderProps): React.JSX.Element {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/store/${tenantSlug}`} className="font-bold text-xl capitalize">
            {tenantSlug}
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {!viewer.isAuthenticated && <LocaleSwitcher />}

          {viewer.isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={<button className="flex items-center gap-2 outline-none rounded-full focus-visible:ring-2 focus-visible:ring-ring" />}>
                  <Avatar className="size-8 rounded-full border">
                    <AvatarImage src={viewer.avatarUrl || ''} alt={viewer.displayName || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {(viewer.displayName || 'U').substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" sideOffset={4}>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="size-8">
                        <AvatarImage src={viewer.avatarUrl || ''} alt={viewer.displayName || ''} />
                        <AvatarFallback className="rounded-lg">
                          {(viewer.displayName || 'U').substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">{viewer.displayName}</span>
                        <span className="truncate text-xs text-muted-foreground">{viewer.email}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem render={<Link href="#" className="flex w-full items-center gap-2 cursor-pointer" />}>
                      <CircleUserRoundIcon className="size-4" />
                      <span>{labels.settings}</span>
                  </DropdownMenuItem>
                  {viewer.hasDashboardAccess && (
                    <DropdownMenuItem render={<Link href="/dashboard" className="flex w-full items-center gap-2 cursor-pointer" />}>
                        <LayoutDashboardIcon className="size-4" />
                        <span>{labels.dashboard}</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
                <LocaleSwitcher />
                <DropdownMenuSeparator />
                <form action={logoutAction} className="w-full">
                  <input type="hidden" name="redirectTo" value={`/store/${tenantSlug}`} />
                  <DropdownMenuItem
                    nativeButton
                    render={<button type="submit" className="flex w-full items-center gap-2 cursor-pointer" />}
                  >
                    <LogOutIcon className="size-4" />
                    <span>{labels.logout}</span>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2 text-sm font-medium">
              <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors px-2 py-1">
                {labels.login}
              </Link>
              <Link href="/register" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 transition-colors">
                {labels.createAccount}
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
