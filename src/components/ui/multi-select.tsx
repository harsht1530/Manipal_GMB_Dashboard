import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface MultiSelectProps {
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
    className?: string;
}

export function MultiSelect({
    options,
    selected,
    onChange,
    placeholder = "Select options...",
    className,
}: MultiSelectProps) {
    const [open, setOpen] = React.useState(false);

    const handleUnselect = (item: string) => {
        onChange(selected.filter((i) => i !== item));
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between bg-secondary border-0 hover:bg-secondary/80 min-h-[40px] h-auto px-3 py-2",
                        className
                    )}
                >
                    <div className="flex flex-wrap gap-1 items-center overflow-hidden mr-2">
                        {selected.length > 0 ? (
                            <>
                                {selected.slice(0, 2).map((item) => (
                                    <Badge
                                        variant="secondary"
                                        key={item}
                                        className="bg-background/50 hover:bg-background/80 text-foreground text-[10px] font-normal capitalize py-0 px-2 max-w-[120px] shrink-0"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleUnselect(item);
                                        }}
                                    >
                                        <span className="truncate">{item}</span>
                                        <X className="ml-1 h-3 w-3 text-muted-foreground hover:text-foreground shrink-0" />
                                    </Badge>
                                ))}
                                {selected.length > 2 && (
                                    <Badge
                                        variant="secondary"
                                        className="bg-background/50 text-foreground text-[10px] font-normal py-0 px-2 shrink-0"
                                    >
                                        +{selected.length - 2} more
                                    </Badge>
                                )}
                            </>
                        ) : (
                            <span className="text-muted-foreground text-xs">{placeholder}</span>
                        )}
                    </div>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
                <Command>
                    <CommandInput placeholder={placeholder} />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-auto">
                            {options.map((option) => (
                                <CommandItem
                                    key={option}
                                    onSelect={() => {
                                        onChange(
                                            selected.includes(option)
                                                ? selected.filter((item) => item !== option)
                                                : [...selected, option]
                                        );
                                        setOpen(true);
                                    }}
                                >
                                    <div
                                        className={cn(
                                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                            selected.includes(option)
                                                ? "bg-primary text-primary-foreground"
                                                : "opacity-50 [&_svg]:invisible"
                                        )}
                                    >
                                        <Check className={cn("h-4 w-4")} />
                                    </div>
                                    <span>{option}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
