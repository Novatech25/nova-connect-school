'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

interface SearchableSelectProps {
    value: string;
    onValueChange: (value: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
    emptyText?: string;
    className?: string;
}

export function SearchableSelect({
    value,
    onValueChange,
    options,
    placeholder = 'Sélectionner...',
    emptyText = 'Aucun résultat trouvé.',
    className,
}: SearchableSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');

    const selectedOption = options.find((option) => option.value === value);

    // Filter options based on search
    const filteredOptions = React.useMemo(() => {
        if (!search) return options;
        const searchLower = search.toLowerCase();
        return options.filter((option) =>
            option.label.toLowerCase().includes(searchLower)
        );
    }, [options, search]);

    const handleSelect = (optionValue: string) => {
        onValueChange(optionValue);
        setOpen(false);
        setSearch('');
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn('w-full justify-between', className)}
                >
                    {selectedOption ? selectedOption.label : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="p-0"
                align="start"
                style={{ width: 'var(--radix-popover-trigger-width)' }}
            >
                <div className="flex flex-col">
                    {/* Search input */}
                    <div className="border-b p-2">
                        <Input
                            placeholder="Rechercher..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-9"
                        />
                    </div>

                    {/* Options list */}
                    <div className="max-h-[300px] overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                            <div className="py-6 text-center text-sm text-gray-500">
                                {emptyText}
                            </div>
                        ) : (
                            <div className="p-1">
                                {filteredOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleSelect(option.value)}
                                        className={cn(
                                            'relative flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
                                            value === option.value && 'bg-accent'
                                        )}
                                    >
                                        <Check
                                            className={cn(
                                                'mr-2 h-4 w-4',
                                                value === option.value ? 'opacity-100' : 'opacity-0'
                                            )}
                                        />
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
