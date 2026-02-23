'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Check } from 'lucide-react';

interface School {
    id: string;
    name: string;
}

interface SchoolSelectorProps {
    schools: School[];
    selectedSchoolId: string | null;
    onSchoolChange: (schoolId: string | null) => void;
    isSuperAdmin: boolean;
}

export function SchoolSelector({
    schools,
    selectedSchoolId,
    onSchoolChange,
    isSuperAdmin,
}: SchoolSelectorProps) {
    if (!isSuperAdmin) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Sélection École
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <button
                        onClick={() => onSchoolChange(null)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${selectedSchoolId === null
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                    >
                        <span className="font-medium">Toutes les écoles</span>
                        {selectedSchoolId === null && (
                            <Check className="h-5 w-5 text-blue-500" />
                        )}
                    </button>

                    {schools.map((school) => (
                        <button
                            key={school.id}
                            onClick={() => onSchoolChange(school.id)}
                            className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${selectedSchoolId === school.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <span className="font-medium">{school.name}</span>
                            {selectedSchoolId === school.id && (
                                <Check className="h-5 w-5 text-blue-500" />
                            )}
                        </button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
