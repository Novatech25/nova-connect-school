'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@novaconnect/ui/components/dialog';
import { Button } from '@novaconnect/ui/components/button';
import { Select } from '@novaconnect/ui/components/select';
import { Checkbox } from '@novaconnect/ui/components/checkbox';
import { useGeneratePaymentReceipt } from '@novaconnect/data';
import { usePrinterProfiles } from '@novaconnect/data';
import { useAuth } from '@novaconnect/core/hooks/useAuth';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string;
}

export function GenerateReceiptDialog({ open, onOpenChange, paymentId }: Props) {
  const { user } = useAuth();
  const { data: profiles } = usePrinterProfiles(user?.school_id!);
  const generateReceipt = useGeneratePaymentReceipt();

  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [autoSend, setAutoSend] = useState(false);
  const [sendChannels, setSendChannels] = useState<string[]>([]);

  const handleGenerate = async () => {
    await generateReceipt.mutateAsync({
      paymentId,
      printerProfileId: selectedProfile || undefined,
      autoSend,
      sendChannels,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Générer le reçu</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Profil d'impression</label>
            <Select
              value={selectedProfile}
              onValueChange={setSelectedProfile}
            >
              <option value="">Par défaut</option>
              {profiles?.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.profile_name} ({profile.profile_type})
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="auto-send"
              checked={autoSend}
              onCheckedChange={(checked) => setAutoSend(checked as boolean)}
            />
            <label htmlFor="auto-send" className="text-sm">
              Envoyer automatiquement
            </label>
          </div>

          {autoSend && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Canaux d'envoi</label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="email"
                    checked={sendChannels.includes('email')}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSendChannels([...sendChannels, 'email']);
                      } else {
                        setSendChannels(sendChannels.filter(c => c !== 'email'));
                      }
                    }}
                  />
                  <label htmlFor="email" className="text-sm">Email</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="whatsapp"
                    checked={sendChannels.includes('whatsapp')}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSendChannels([...sendChannels, 'whatsapp']);
                      } else {
                        setSendChannels(sendChannels.filter(c => c !== 'whatsapp'));
                      }
                    }}
                  />
                  <label htmlFor="whatsapp" className="text-sm">WhatsApp</label>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={handleGenerate} disabled={generateReceipt.isPending}>
              {generateReceipt.isPending ? 'Génération...' : 'Générer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
