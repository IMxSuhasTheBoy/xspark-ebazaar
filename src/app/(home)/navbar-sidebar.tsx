import Link from "next/link";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetTitle,
  SheetHeader,
  SheetContent,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";

interface NavbarItem {
  href: string;
  isActive?: boolean;
  children: React.ReactNode;
}

interface Props {
  items: NavbarItem[];
  pathname: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
const HOVER_STYLES = {
  default: "hover:border-primary hover:bg-accent dark:hover:bg-accent/10",
  signin: "hover:bg-amber-400 dark:hover:bg-secondary/80",
  signup:
    "bg-black text-white hover:bg-amber-400 hover:text-black dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90",
};

export const NavbarSidebar = ({
  items,
  open,
  pathname,
  onOpenChange,
}: Props) => {
  const handleLinkClick = () => onOpenChange(false);

  const NavLink = ({
    href,
    isActive,
    className,
    children,
  }: {
    href: string;
    isActive?: boolean;
    className?: string;
    children: React.ReactNode;
  }) => (
    <Link
      href={href}
      prefetch
      onClick={handleLinkClick}
      className={cn(
        "dark:text-foreground flex w-full items-center border-y border-transparent p-4 text-left text-base font-medium",
        className,
        isActive &&
          "dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 bg-black text-white hover:bg-black",
      )}
    >
      {children}
    </Link>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="bg-primary-foreground p-0 transition-none"
      >
        <SheetHeader className="p-4.5">
          <SheetTitle className="text-xl font-normal tracking-widest">
            Menu
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex h-full flex-col overflow-y-auto pb-2">
          {items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              isActive={item.href === pathname}
              className={HOVER_STYLES.default}
            >
              {item.children}
            </NavLink>
          ))}

          <div className="border-primary dark:border-primary-foreground flex border-y border-t">
            <div className="p-4">
              <ThemeToggle />
            </div>
            <Link
              href="/sign-in"
              //  className={HOVER_STYLES.signin}
              className="bg-primary-foreground dark:bg-primary flex w-full items-center justify-center border-0 border-l border-transparent p-4 text-base font-medium text-black hover:border-l-black hover:bg-amber-400 dark:border-0 dark:hover:bg-amber-400"
            >
              Log in
            </Link>
            <Link
              href="/sign-up"
              // className={HOVER_STYLES.signup}
              className="flex w-full items-center justify-center border-none border-transparent bg-black p-4 text-base font-medium text-white hover:bg-amber-400 hover:text-black"
            >
              Start selling
            </Link>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
