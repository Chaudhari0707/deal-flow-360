"use client";

import { type CSSProperties, type ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { BrandLogo } from "@/components/brand/brand-logo";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/features/shell/theme-toggle";
import { authClient } from "@/lib/auth/client";
import type { Actor } from "@/lib/domain/_types/domain";
import { permissions } from "@/lib/domain/permissions";
import { cn } from "@/lib/utils";

/**
 * Navigation is chrome, not content: quiet letterspaced group labels over a hairline,
 * compact type-only rows, and an active state carried by a marginal rule plus ink weight
 * rather than a filled pill. Icons are deliberately absent — spacing and type do the work.
 */
const eyebrow = "text-[0.6875rem] font-medium tracking-[0.16em] uppercase";

const navigation = [
  {
    label: "Workspace",
    items: [
      { title: "Overview", href: "/dashboard", roles: permissions.workspace },
      { title: "Quotations", href: "/quotations", roles: permissions.quotations },
      { title: "Customers", href: "/customers", roles: permissions.customers },
      { title: "Approvals", href: "/approvals", roles: permissions.approvals },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Fulfillment", href: "/fulfillment", roles: permissions.fulfillment },
      { title: "Inventory", href: "/inventory", roles: permissions.stockRead },
      { title: "Subscriptions", href: "/subscriptions", roles: permissions.subscriptions },
      { title: "Invoices", href: "/invoices", roles: permissions.invoices },
      { title: "Customer health", href: "/health", roles: permissions.health },
    ],
  },
  {
    label: "Management",
    items: [
      { title: "Reports", href: "/reports", roles: permissions.reports },
      { title: "Product catalog", href: "/catalog", roles: permissions.catalog },
      { title: "Settings", href: "/settings", roles: permissions.settings },
    ],
  },
];

function WorkspaceSidebar({ actor, pathname }: { actor: Actor; pathname: string }) {
  const { setOpenMobile } = useSidebar();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  async function signOut() {
    setPending(true);
    setError(false);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError(true);
        return;
      }
      window.location.assign("/login");
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <Sidebar variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="h-14 shrink-0 justify-center border-b border-border px-5 py-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="h-auto rounded-none p-0 hover:bg-transparent active:bg-transparent"
              render={<Link href="/dashboard" />}
            >
              <BrandLogo />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navigation.map((group) => {
          const items = group.items.filter(
            (item) => actor.role !== "customer" && item.roles.includes(actor.role),
          );
          if (!items.length) return null;
          return (
            <SidebarGroup key={group.label} className="p-0">
              <SidebarGroupLabel
                className={cn(
                  eyebrow,
                  "mx-5 mt-7 mb-1.5 h-auto rounded-none border-b border-border px-0 pb-2 text-muted-foreground",
                )}
              >
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          className={cn(
                            "relative h-8 rounded-none px-5 py-0 text-[0.8125rem] transition-colors",
                            "hover:bg-foreground/[0.035] hover:text-foreground",
                            "focus-visible:ring-inset",
                            "data-active:bg-transparent data-active:font-medium data-active:text-foreground",
                            active ? "text-foreground" : "text-muted-foreground",
                          )}
                          onClick={() => setOpenMobile(false)}
                          isActive={active}
                          render={<Link href={item.href} />}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "absolute inset-y-1 left-0 w-0.5",
                              active ? "bg-ink-accent" : "bg-transparent",
                            )}
                          />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="gap-2 px-5 pt-4 pb-6">
        <div className="flex items-center gap-3 border-t border-border pt-4">
          <div className="min-w-0 flex-1">
            <p className={cn(eyebrow, "text-muted-foreground")}>{actor.role}</p>
            <p className="mt-1 truncate text-sm font-medium text-foreground">{actor.name}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            disabled={pending}
            onClick={signOut}
          >
            <LogOut />
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-ink-risk">
            Sign out failed. Please try again.
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export function WorkspaceShell({ children, actor }: { children: ReactNode; actor: Actor }) {
  const pathname = usePathname();
  const title =
    navigation
      .flatMap((group) => group.items)
      .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.title ??
    "Workspace";
  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem" } as CSSProperties}>
      <WorkspaceSidebar actor={actor} pathname={pathname} />
      <SidebarInset className="min-w-0">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 lg:px-6">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4!" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className={cn(eyebrow, "text-foreground")}>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <div className="@container/main flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
