import { Store } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export function publicLogoSource(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password)
      return url.href;
  } catch {
    return null;
  }
  return null;
}

export function StoreIdentityLogo({
  logoUrl,
  className,
}: {
  logoUrl: string | null;
  className?: string;
}): React.JSX.Element {
  return (
    <Avatar
      aria-hidden="true"
      className={cn('size-9 overflow-hidden rounded-lg after:hidden', className)}
    >
      {logoUrl && (
        <AvatarImage
          key={logoUrl}
          src={logoUrl}
          alt=""
          className="rounded-lg bg-[var(--dashboard-logo-background,#777)] object-contain p-0.5"
        />
      )}
      <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Store aria-hidden="true" className="size-4" />
      </AvatarFallback>
    </Avatar>
  );
}
