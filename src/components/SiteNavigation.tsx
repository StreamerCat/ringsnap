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
import { topLevelNavItems, tradeNavItems } from "@/components/siteNavConfig";

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
                            {tradeNavItems.map((trade) => (
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
                {topLevelNavItems.map((item) => {
                    const isActive = item.href === "/resources"
                        ? location.pathname.startsWith("/resources")
                        : location.pathname === item.href;

                    return (
                        <NavigationMenuItem key={item.href}>
                            <Link to={item.href}>
                                <NavigationMenuLink
                                    className={cn(
                                        navigationMenuTriggerStyle(),
                                        "text-sm font-semibold text-foreground hover:text-primary bg-transparent hover:bg-transparent focus:bg-transparent px-3 h-auto py-2 cursor-pointer",
                                        isActive && "text-primary"
                                    )}
                                >
                                    {item.label}
                                </NavigationMenuLink>
                            </Link>
                        </NavigationMenuItem>
                    );
                })}

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
