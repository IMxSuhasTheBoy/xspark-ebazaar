"use client";

import Link from "next/link";
import { useState } from "react";
import { MenuIcon } from "lucide-react";
// import { Poppins } from "next/font/google";
import { usePathname } from "next/navigation";

import { useQuery } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

import { NavbarSidebar } from "./navbar-sidebar";

// const poppins = Poppins({
//   subsets: ["latin"],
//   weight: ["700"],
// });

interface NavbarItemProps {
  href: string;
  isActive?: boolean;
  children: React.ReactNode;
}

const NavbarItem = ({ href, isActive, children }: NavbarItemProps) => {
  return (
    <Button
      asChild
      variant="outline"
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "hover:border-primary dark:hover:border-primary dark:text-foreground rounded-full border-transparent bg-transparent px-3.5 text-lg hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent",
        isActive &&
          "bg-black text-white hover:bg-black hover:text-white dark:bg-white dark:text-black dark:hover:bg-white",
      )}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
};

const navbarItems = [
  {
    href: "/",
    children: "Home",
  },
  {
    href: "/about",
    children: "About",
  },
  {
    href: "/features",
    children: "Features",
  },
  {
    href: "/pricing",
    children: "Pricing",
  },
  {
    href: "/contact",
    children: "Contact",
  },
];

const buttonStyles = {
  signin:
    "bg-secondary dark:bg-background h-full rounded-none border-0 border-l border-transparent px-12 text-lg text-black transition-colors hover:border-l-black hover:bg-amber-400 dark:border-none dark:text-white dark:hover:bg-amber-400 dark:hover:text-black",
  signup:
    "dark:bg-primary bg-foreground h-full rounded-none border-0 px-12 text-lg text-white transition-colors hover:bg-amber-400 hover:text-black dark:text-black dark:hover:bg-amber-400",
};

export const Navbar = () => {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const trpc = useTRPC();
  const session = useQuery(trpc.auth.session.queryOptions());

  return (
    <nav className="dark:bg-background bg-secondary flex h-20 justify-between border-b border-b-black font-medium">
      <Link href="/" className="flex items-center pl-6">
        <span className={cn("text-4xl font-semibold")}>........</span>
      </Link>

      <NavbarSidebar
        items={navbarItems}
        pathname={pathname}
        open={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
      />

      <div className="hidden items-center gap-4 lg:flex">
        {navbarItems.map((item) => (
          <NavbarItem
            key={item.href}
            href={item.href}
            isActive={item.href === pathname}
          >
            {item.children}
          </NavbarItem>
        ))}
      </div>

      {session.data?.user ? (
        <div className="hidden items-center lg:flex">
          <div className="mr-4">
            <ThemeToggle />
          </div>
          <Button asChild className={cn(buttonStyles.signup)}>
            <Link href="/admin">Dashboard</Link>
          </Button>
        </div>
      ) : (
        <div className="hidden items-center lg:flex">
          <div className="mr-4">
            <ThemeToggle />
          </div>
          <Button
            asChild
            variant="secondary"
            className={cn(buttonStyles.signin)}
          >
            <Link prefetch href="/sign-in">
              Log in
            </Link>
          </Button>

          <Button asChild className={cn(buttonStyles.signup)}>
            <Link prefetch href="/sign-up">
              Start selling
            </Link>
          </Button>
        </div>
      )}

      <div className="flex items-center justify-center lg:hidden">
        <Button
          variant="ghost"
          size="lg"
          className="hover:bg-ring/30 m-1 size-18 border-transparent bg-transparent"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={isSidebarOpen}
        >
          <MenuIcon className="size-6" />
        </Button>
      </div>
    </nav>
  );
};
