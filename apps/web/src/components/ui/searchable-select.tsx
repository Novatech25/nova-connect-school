'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

export interface SearchableSelectOption {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    options: SearchableSelectOption[];
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    allLabel?: string;
    className?: string;
}

export function SearchableSelect({
    options,
    value,
    onValueChange,
    placeholder = 'Sélectionner...',
    searchPlaceholder = 'Rechercher...',
    emptyMessage = 'Aucun résultat',
    allLabel = 'Tous',
    className,
}: SearchableSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');

    const filteredOptions = React.useMemo(() => {
        if (!search) return options;
        const query = search.toLowerCase();
        return options.filter((option) =>
            option.label.toLowerCase().includes(query)
        );
    }, [options, search]);

    const selectedLabel = React.useMemo(() => {
        if (value === 'all') return allLabel;
        const option = options.find((opt) => opt.value === value);
        return option?.label || placeholder;
    }, [value, options, allLabel, placeholder]);

    const handleSelect = (selectedValue: string) => {
        onValueChange(selectedValue);
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
                    className={cn('w-full justify-between font-normal', className)}
                >
                    <span className="truncate">{selectedLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <div className="flex flex-col">
                    {/* Search Input */}
                    <div className="flex items-center border-b px-3 py-2">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input
                            placeholder={searchPlaceholder}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-8 border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                    </div>

                    {/* Options List */}
                    <div className="max-h-60 overflow-y-auto p-1">
                        {/* All Option */}
                        <div
                            className={cn(
                                'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                                value === 'all' && 'bg-accent'
                            )}
                            onClick={() => handleSelect('all')}
                        >
                            <Check
                                className={cn(
                                    'mr-2 h-4 w-4',
                                    value === 'all' ? 'opacity-100' : 'opacity-0'
                                )}
                            />
                            {allLabel}
                        </div>

                        {/* Filtered Options */}
                        {filteredOptions.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                {emptyMessage}
                            </div>
                        ) : (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.value}
                                    className={cn(
                                        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                                        value === option.value && 'bg-accent'
                                    )}
                                    onClick={() => handleSelect(option.value)}
                                >
                                    <Check
                                        className={cn(
                                            'mr-2 h-4 w-4',
                                            value === option.value ? 'opacity-100' : 'opacity-0'
                                        )}
                                    />
                                    {option.label}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
