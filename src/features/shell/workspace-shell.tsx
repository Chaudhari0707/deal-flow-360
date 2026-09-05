"use client";

import { type CSSProperties, type ReactNode, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Boxes,
  CircleCheck,
  FileText,
  House,
  LogOut,
  PackageCheck,
  Receipt,
  RefreshCw,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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

const navigation = [
  {
    label: "Workspace",
    items: [
      {
        title: "Overview",
        href: "/dashboard",
        icon: House,
        roles: permissions.workspace,
      },
      { title: "Quotations", href: "/quotations", icon: FileText, roles: permissions.quotations },
      { title: "Customers", href: "/customers", icon: Boxes, roles: permissions.customers },
      { title: "Approvals", href: "/approvals", icon: ShieldCheck, roles: permissions.approvals },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        title: "Fulfillment",
        href: "/fulfillment",
        icon: PackageCheck,
        roles: permissions.fulfillment,
      },
      {
        title: "Subscriptions",
        href: "/subscriptions",
        icon: RefreshCw,
        roles: permissions.subscriptions,
      },
      { title: "Invoices", href: "/invoices", icon: Receipt, roles: permissions.invoices },
      { title: "Customer health", href: "/health", icon: Activity, roles: permissions.health },
    ],
  },
  {
    label: "Management",
    items: [
      {
        title: "Reports",
        href: "/reports",
        icon: BarChart3,
        roles: permissions.reports,
      },
      { title: "Product catalog", href: "/catalog", icon: Boxes, roles: permissions.catalog },
      { title: "Settings", href: "/settings", icon: Settings2, roles: permissions.settings },
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
    <Sidebar variant="inset" collapsible="offcanvas">
      <SidebarHeader className="px-4 py-5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="h-14 hover:bg-transparent"
              render={<Link href="/dashboard" />}
            >
              <Image
                src="/logo.png"
                alt="DealFlow360"
                width={180}
                height={60}
                className="h-10 w-auto object-contain"
                priority
              />
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
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        className="h-10 data-active:bg-primary/15 data-active:text-foreground"
                        onClick={() => setOpenMobile(false)}
                        isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                        render={<Link href={item.href} />}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="gap-3 p-4">
        <Separator />
        <div className="flex items-center gap-2.5">
          <Avatar>
            <AvatarFallback className="bg-primary/20 text-foreground">
              {actor.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{actor.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{actor.role}</p>
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
          <p role="alert" className="text-xs text-destructive">
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
        <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4 lg:px-6">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4!" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Badge variant="outline" className="hidden gap-1.5 sm:flex">
              <CircleCheck className="text-primary" />
              Local workspace
            </Badge>
          </div>
        </header>
        <div className="@container/main flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
