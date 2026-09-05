"use client";

import { type CSSProperties, type ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CircleCheck,
  FileText,
  House,
  Layers3,
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
import { authClient } from "@/lib/auth/client";
import type { Actor } from "@/lib/domain/_types/domain";

const navigation = [
  {
    label: "Workspace",
    items: [
      { title: "Overview", href: "/dashboard", icon: House },
      { title: "Quotations", href: "/quotations", icon: FileText },
      { title: "Approvals", href: "/approvals", icon: ShieldCheck },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Fulfillment", href: "/fulfillment", icon: PackageCheck },
      { title: "Subscriptions", href: "/subscriptions", icon: RefreshCw },
      { title: "Invoices", href: "/invoices", icon: Receipt },
      { title: "Customer health", href: "/health", icon: Activity },
    ],
  },
  {
    label: "Management",
    items: [
      { title: "Reports", href: "/reports", icon: BarChart3 },
      { title: "Product catalog", href: "/catalog", icon: Boxes },
      { title: "Settings", href: "/settings", icon: Settings2 },
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
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <Badge className="size-9 rounded-xl p-2">
                <Layers3 className="size-5!" />
              </Badge>
              <span className="text-lg font-semibold tracking-tight text-foreground">
                DealFlow360
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navigation.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items
                  .filter(
                    (item) =>
                      item.href !== "/settings" || ["admin", "manager"].includes(actor.role),
                  )
                  .map((item) => (
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
        ))}
      </SidebarContent>
      <SidebarFooter className="gap-3 p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/portal" />}>
              <ArrowUpRight />
              <span>Customer portal</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
          <Badge variant="outline" className="ml-auto gap-1.5">
            <CircleCheck className="text-primary" />
            Local workspace
          </Badge>
        </header>
        <div className="@container/main flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
