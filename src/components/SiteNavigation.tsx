import { Link, useLocation } from "react-router-dom";
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
    navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import React from "react";
import { Wrench, Zap, Thermometer, Home } from "lucide-react";

const trades = [
    {
        title: "Plumbers",
        href: "/plumbers",
        description: "24/7 answering for emergency leaks and dispatch.",
        icon: Wrench,
    },
    {
        title: "HVAC",
        href: "/hvac",
        description: "Book tune-ups and capture emergency failures.",
        icon: Thermometer,
    },
    {
        title: "Electricians",
        href: "/electricians",
        description: "Safety-focused intake for sparkies and residential.",
        icon: Zap,
    },
    {
        title: "Roofing",
        href: "/roofing",
        description: "Capture storm leads and qualify insurance jobs.",
        icon: Home,
    },
];

export const SiteNavigation = () => {
    const location = useLocation();

    return (
        <NavigationMenu viewportClassName="right-0 left-auto origin-top-right justify-end">
            <NavigationMenuList>
                {/* TRADES MEGA MENU */}
                <NavigationMenuItem>
                    <NavigationMenuTrigger className="text-sm font-semibold text-foreground hover:text-primary bg-transparent hover:bg-transparent focus:bg-transparent data-[active]:bg-transparent data-[state=open]:bg-transparent px-3 h-auto py-2">
                        Trades
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                        <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                            {trades.map((trade) => (
                                <ListItem
                                    key={trade.title}
                                    title={trade.title}
                                    href={trade.href}
                                    icon={trade.icon}
                                >
                                    {trade.description}
                                </ListItem>
                            ))}
                        </ul>
                    </NavigationMenuContent>
                </NavigationMenuItem>

                {/* PRICING */}
                <NavigationMenuItem>
                    <Link to="/pricing">
                        <NavigationMenuLink
                            className={cn(
                                navigationMenuTriggerStyle(),
                                "text-sm font-semibold text-foreground hover:text-primary bg-transparent hover:bg-transparent focus:bg-transparent px-3 h-auto py-2 cursor-pointer",
                                location.pathname === "/pricing" && "text-primary"
                            )}
                        >
                            Pricing
                        </NavigationMenuLink>
                    </Link>
                </NavigationMenuItem>

                {/* THE DIFFERENCE */}
                <NavigationMenuItem>
                    <Link to="/difference">
                        <NavigationMenuLink
                            className={cn(
                                navigationMenuTriggerStyle(),
                                "text-sm font-semibold text-foreground hover:text-primary bg-transparent hover:bg-transparent focus:bg-transparent px-3 h-auto py-2 cursor-pointer",
                                location.pathname === "/difference" && "text-primary"
                            )}
                        >
                            The Difference
                        </NavigationMenuLink>
                    </Link>
                </NavigationMenuItem>

                {/* FIELD GUIDES */}
                <NavigationMenuItem>
                    <Link to="/resources">
                        <NavigationMenuLink
                            className={cn(
                                navigationMenuTriggerStyle(),
                                "text-sm font-semibold text-foreground hover:text-primary bg-transparent hover:bg-transparent focus:bg-transparent px-3 h-auto py-2 cursor-pointer",
                                location.pathname.startsWith("/resources") && "text-primary"
                            )}
                        >
                            Field Guides
                        </NavigationMenuLink>
                    </Link>
                </NavigationMenuItem>

            </NavigationMenuList>
        </NavigationMenu>
    );
};

const ListItem = React.forwardRef<
    React.ElementRef<"a">,
    React.ComponentPropsWithoutRef<"a"> & { icon: React.ElementType }
>(({ className, title, children, icon: Icon, ...props }, ref) => {
    return (
        <li>
            <NavigationMenuLink asChild>
                <Link
                    ref={ref as any}
                    to={props.href || "#"}
                    className={cn(
                        "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                        className
                    )}
                    {...props}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                            <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="text-sm font-semibold leading-none">{title}</div>
                    </div>
                    <p className="line-clamp-2 text-sm leading-snug text-muted-foreground pl-10">
                        {children}
                    </p>
                </Link>
            </NavigationMenuLink>
        </li>
    );
});
ListItem.displayName = "ListItem";
