'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { EllipsisVerticalIcon, LogOutIcon, StoreIcon } from 'lucide-react';
import { logoutAction } from '@/features/iam/actions/logout.action';
import { LocaleSwitcher } from '@/components/locale-switcher';

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
    tenantSlug?: string | null;
  };
}): React.JSX.Element {
  const { isMobile } = useSidebar();
  const t = useTranslations('AdminShell');
  const initials = user.name.trim().slice(0, 2).toLocaleUpperCase();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                aria-label={t('account')}
                className="min-h-12 aria-expanded:bg-muted"
              />
            }
          >
            <Avatar className="size-8 rounded-lg grayscale">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-foreground/70">{user.email}</span>
            </div>
            <EllipsisVerticalIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="size-8">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            {user.tenantSlug && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    render={
                      <Link
                        href={`/store/${user.tenantSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center gap-2 cursor-pointer"
                      />
                    }
                  >
                    <StoreIcon className="size-4" />
                    <span>{t('viewStore')}</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </>
            )}
            <LocaleSwitcher />
            <DropdownMenuSeparator />
            <form action={logoutAction} className="w-full">
              <DropdownMenuItem
                nativeButton
                render={<button type="submit" className="flex w-full items-center gap-2" />}
              >
                <LogOutIcon />
                {t('logout')}
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
