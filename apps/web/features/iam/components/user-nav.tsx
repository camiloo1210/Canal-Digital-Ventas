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
import { StoreViewer } from '@/features/store/queries/store-viewer.query';

interface UserNavProps {
  viewer: StoreViewer;
  redirectTo?: string;
  labels: {
    login: string;
    createAccount: string;
    logout: string;
    dashboard: string;
    settings: string;
  };
}

export function UserNav({ viewer, redirectTo = '/', labels }: UserNavProps): React.JSX.Element {
  if (!viewer.isAuthenticated) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium">
        <DropdownMenu>
          <DropdownMenuTrigger render={<button className="flex items-center gap-2 px-2 py-1 outline-none text-muted-foreground hover:text-foreground transition-colors" />}>
             🌐 Lang
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" sideOffset={4}>
            <LocaleSwitcher />
          </DropdownMenuContent>
        </DropdownMenu>

        <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors px-2 py-1">
          {labels.login}
        </Link>
        <Link href="/register" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 transition-colors">
          {labels.createAccount}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger render={<button className="flex items-center gap-2 outline-none rounded-full focus-visible:ring-2 focus-visible:ring-ring ml-2" />}>
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
            <input type="hidden" name="redirectTo" value={redirectTo} />
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
    </div>
  );
}
