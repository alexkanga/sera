"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Shield,
  Key,
  ScrollText,
  UserCircle,
  Lock,
  LogOut,
  Bell,
  ChevronUp,
  Building2,
  Network,
  LayoutGrid,
  Target,
  BookOpen,
  FileCheck,
  ClipboardList,
  BarChart3,
} from "lucide-react";

import { useAppStore, type AppSection } from "@/stores/app-store";
import { DashboardSection } from "@/components/sections/dashboard-section";
import { UsersSection } from "@/components/sections/users-section";
import { RolesSection } from "@/components/sections/roles-section";
import { PermissionsSection } from "@/components/sections/permissions-section";
import { AuditLogsSection } from "@/components/sections/audit-logs-section";
import { ProfileSection } from "@/components/sections/profile-section";
import { ChangePasswordSection } from "@/components/sections/change-password-section";
import { DirectionsSection } from "@/components/sections/directions-section";
import { UnitsSection } from "@/components/sections/units-section";
import { OrgOverviewSection } from "@/components/sections/org-overview-section";
import { StrategicAxesSection } from "@/components/sections/strategic-axes-section";
import { AcbfDomainsSection } from "@/components/sections/acbf-domains-section";
import { AcbfDeliverablesSection } from "@/components/sections/acbf-deliverables-section";
import { ActivitiesSection } from "@/components/sections/activities-section";
import { PtaConsolideSection } from "@/components/sections/pta-consolide-section";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarSeparator,
  SidebarTrigger,
  SidebarRail,
} from "@/components/ui/sidebar";

// Navigation items for Module 1
const navItems: {
  section: AppSection;
  label: string;
  icon: React.ElementType;
}[] = [
  { section: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { section: "users", label: "Utilisateurs", icon: Users },
  { section: "roles", label: "Rôles", icon: Shield },
  { section: "permissions", label: "Permissions", icon: Key },
  { section: "audit-logs", label: "Journal d'audit", icon: ScrollText },
];

// Navigation items for Module 2
const orgItems: {
  section: AppSection;
  label: string;
  icon: React.ElementType;
}[] = [
  { section: "org-overview", label: "Vue organisationnelle", icon: LayoutGrid },
  { section: "directions", label: "Directions", icon: Building2 },
  { section: "units", label: "Unités", icon: Network },
];

// Navigation items for Module 3
const strategyItems: {
  section: AppSection;
  label: string;
  icon: React.ElementType;
}[] = [
  { section: "strategic-axes", label: "Axes stratégiques", icon: Target },
];

// Navigation items for Module 4
const acbfItems: {
  section: AppSection;
  label: string;
  icon: React.ElementType;
}[] = [
  { section: "acbf-domains", label: "Domaines ACBF", icon: BookOpen },
  { section: "acbf-deliverables", label: "Livrables ACBF", icon: FileCheck },
];

// Navigation items for Module 5
const ptaItems: {
  section: AppSection;
  label: string;
  icon: React.ElementType;
}[] = [
  { section: "activities", label: "Mes activités PTA", icon: ClipboardList },
];

// Navigation items for Module 6
const consolideItems: {
  section: AppSection;
  label: string;
  icon: React.ElementType;
}[] = [
  { section: "pta-consolide", label: "PTA consolidé", icon: BarChart3 },
];

const accountItems: {
  section: AppSection;
  label: string;
  icon: React.ElementType;
}[] = [
  { section: "profile", label: "Mon profil", icon: UserCircle },
  { section: "change-password", label: "Changer mot de passe", icon: Lock },
];

// Section renderer
function SectionContent({ section }: { section: AppSection }) {
  switch (section) {
    case "dashboard":
      return <DashboardSection />;
    case "users":
      return <UsersSection />;
    case "roles":
      return <RolesSection />;
    case "permissions":
      return <PermissionsSection />;
    case "audit-logs":
      return <AuditLogsSection />;
    case "directions":
      return <DirectionsSection />;
    case "units":
      return <UnitsSection />;
    case "org-overview":
      return <OrgOverviewSection />;
    case "strategic-axes":
      return <StrategicAxesSection />;
    case "acbf-domains":
      return <AcbfDomainsSection />;
    case "acbf-deliverables":
      return <AcbfDeliverablesSection />;
    case "activities":
      return <ActivitiesSection />;
    case "pta-consolide":
      return <PtaConsolideSection />;
    case "profile":
      return <ProfileSection />;
    case "change-password":
      return <ChangePasswordSection />;
    default:
      return <DashboardSection />;
  }
}

// Get section title for the header
function getSectionTitle(section: AppSection): string {
  const item = [...navItems, ...orgItems, ...strategyItems, ...acbfItems, ...ptaItems, ...consolideItems, ...accountItems].find((i) => i.section === section);
  return item?.label ?? "Tableau de bord";
}

// Helper to get initials from name
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { currentSection, setCurrentSection } = useAppStore();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Show loading while checking auth
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Chargement...
          </p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!session) {
    return null;
  }

  const userName = session.user.name || "Utilisateur";
  const userRole = session.user.roles?.[0]?.name || "Aucun rôle";
  const userAvatar = session.user.avatar;

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <SidebarProvider>
      {/* ===== SIDEBAR ===== */}
      <Sidebar side="left" variant="sidebar" collapsible="icon">
        {/* Sidebar Header — Branding */}
        <SidebarHeader className="border-b border-slate-200 dark:border-slate-700">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className="hover:bg-emerald-50 dark:hover:bg-emerald-950"
                onClick={() => setCurrentSection("dashboard")}
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <LayoutDashboard className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-bold text-emerald-700 dark:text-emerald-400">
                    AAEA
                  </span>
                  <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                    Pilotage 360
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        {/* Sidebar Content — Navigation */}
        <SidebarContent>
          {/* Main Navigation Group */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Module 1 — Administration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.section}>
                    <SidebarMenuButton
                      isActive={currentSection === item.section}
                      onClick={() => setCurrentSection(item.section)}
                      tooltip={item.label}
                      className={
                        currentSection === item.section
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 dark:hover:bg-emerald-900"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                      }
                    >
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          {/* Module 2 — Organisation */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Module 2 — Organisation
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {orgItems.map((item) => (
                  <SidebarMenuItem key={item.section}>
                    <SidebarMenuButton
                      isActive={currentSection === item.section}
                      onClick={() => setCurrentSection(item.section)}
                      tooltip={item.label}
                      className={
                        currentSection === item.section
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 dark:hover:bg-emerald-900"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                      }
                    >
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          {/* Module 3 — Stratégie */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Module 3 — Stratégie
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {strategyItems.map((item) => (
                  <SidebarMenuItem key={item.section}>
                    <SidebarMenuButton
                      isActive={currentSection === item.section}
                      onClick={() => setCurrentSection(item.section)}
                      tooltip={item.label}
                      className={
                        currentSection === item.section
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 dark:hover:bg-emerald-900"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                      }
                    >
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          {/* Module 4 — ACBF */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Module 4 — ACBF
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {acbfItems.map((item) => (
                  <SidebarMenuItem key={item.section}>
                    <SidebarMenuButton
                      isActive={currentSection === item.section}
                      onClick={() => setCurrentSection(item.section)}
                      tooltip={item.label}
                      className={
                        currentSection === item.section
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 dark:hover:bg-emerald-900"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                      }
                    >
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          {/* Module 5 — PTA */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Module 5 — PTA
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ptaItems.map((item) => (
                  <SidebarMenuItem key={item.section}>
                    <SidebarMenuButton
                      isActive={currentSection === item.section}
                      onClick={() => setCurrentSection(item.section)}
                      tooltip={item.label}
                      className={
                        currentSection === item.section
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 dark:hover:bg-emerald-900"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                      }
                    >
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          {/* Module 6 — PTA Consolidé */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Module 6 — Consolidé
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {consolideItems.map((item) => (
                  <SidebarMenuItem key={item.section}>
                    <SidebarMenuButton
                      isActive={currentSection === item.section}
                      onClick={() => setCurrentSection(item.section)}
                      tooltip={item.label}
                      className={
                        currentSection === item.section
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 dark:hover:bg-emerald-900"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                      }
                    >
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          {/* Account Group */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Mon compte
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {accountItems.map((item) => (
                  <SidebarMenuItem key={item.section}>
                    <SidebarMenuButton
                      isActive={currentSection === item.section}
                      onClick={() => setCurrentSection(item.section)}
                      tooltip={item.label}
                      className={
                        currentSection === item.section
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 dark:hover:bg-emerald-900"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                      }
                    >
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

                {/* Déconnexion button */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={handleLogout}
                    tooltip="Déconnexion"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
                  >
                    <LogOut className="size-4" />
                    <span>Déconnexion</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Sidebar Footer — User Info */}
        <SidebarFooter className="border-t border-slate-200 dark:border-slate-700">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={userAvatar ?? undefined} alt={userName} />
                      <AvatarFallback className="rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400 text-xs font-semibold">
                        {getInitials(userName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{userName}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {userRole}
                      </span>
                    </div>
                    <ChevronUp className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="top"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuItem
                    onClick={() => setCurrentSection("profile")}
                    className="cursor-pointer"
                  >
                    <UserCircle className="mr-2 h-4 w-4" />
                    Mon profil
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setCurrentSection("change-password")}
                    className="cursor-pointer"
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    Changer mot de passe
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* ===== MAIN CONTENT ===== */}
      <SidebarInset>
        {/* Top Header */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4">
          {/* Mobile menu trigger */}
          <SidebarTrigger className="-ml-1 md:hidden" />

          {/* Sidebar toggle on desktop */}
          <SidebarTrigger className="hidden md:flex" />

          <Separator orientation="vertical" className="mr-2 h-4" />

          {/* Breadcrumb / Section title */}
          <div className="flex-1 flex items-center gap-2">
            <h1 className="text-sm font-semibold text-slate-900 dark:text-white">
              {getSectionTitle(currentSection)}
            </h1>
            <Badge
              variant="secondary"
              className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400 text-[10px] px-1.5 py-0"
            >
              {["pta-consolide"].includes(currentSection) ? "Module 6" : ["activities"].includes(currentSection) ? "Module 5" : ["acbf-domains", "acbf-deliverables"].includes(currentSection) ? "Module 4" : ["strategic-axes"].includes(currentSection) ? "Module 3" : ["directions", "units", "org-overview"].includes(currentSection) ? "Module 2" : "Module 1"}
            </Badge>
          </div>

          {/* Notification Bell */}
          <Button variant="ghost" size="icon" className="relative h-9 w-9">
            <Bell className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500" />
            <span className="sr-only">Notifications</span>
          </Button>

          {/* User Avatar in header (mobile-friendly) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={userAvatar ?? undefined} alt={userName} />
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400 text-xs font-semibold">
                    {getInitials(userName)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <div className="flex flex-col space-y-1 p-2">
                <p className="text-sm font-medium leading-none">{userName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {session.user.email}
                </p>
                <p className="text-xs leading-none text-emerald-600 dark:text-emerald-400 mt-1">
                  {userRole}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setCurrentSection("profile")}
                className="cursor-pointer"
              >
                <UserCircle className="mr-2 h-4 w-4" />
                Mon profil
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setCurrentSection("change-password")}
                className="cursor-pointer"
              >
                <Lock className="mr-2 h-4 w-4" />
                Changer mot de passe
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col min-h-0">
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <SectionContent section={currentSection} />
          </main>

          {/* Sticky Footer */}
          <footer className="mt-auto border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 dark:text-slate-500">
              <p>&copy; {new Date().getFullYear()} AAEA — African Water and Sanitation Association</p>
              <p>AAEA Pilotage 360 — Modules 1, 2, 3, 4, 5 &amp; 6</p>
            </div>
          </footer>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
