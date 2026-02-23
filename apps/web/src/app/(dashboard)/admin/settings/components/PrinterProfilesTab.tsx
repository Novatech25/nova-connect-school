'use client';

import { useState } from 'react';
import { Button } from '@novaconnect/ui/components/button';
import { Card } from '@novaconnect/ui/components/card';
import { Input } from '@novaconnect/ui/components/input';
import { Select } from '@novaconnect/ui/components/select';
import { Switch } from '@novaconnect/ui/components/switch';
import { usePrinterProfiles } from '@novaconnect/data';
import { useAuth } from '@novaconnect/core/hooks/useAuth';

export function PrinterProfilesTab() {
  const { user } = useAuth();
  const { data: profiles, isLoading } = usePrinterProfiles(user.school_id!);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Profils d'impression</h2>
        <Button onClick={() => setIsCreating(true)}>
          Nouveau profil
        </Button>
      </div>

      <div className="grid gap-4">
        {profiles.map((profile) => (
          <Card key={profile.id} className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{profile.profile_name}</h3>
                <p className="text-sm text-muted-foreground">
                  Type: {profile.profile_type}
                </p>
                {profile.is_default && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                    Par défaut
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Modifier</Button>
                <Button variant="destructive" size="sm">Supprimer</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Dialog for creating/editing profiles */}
    </div>
  );
}
