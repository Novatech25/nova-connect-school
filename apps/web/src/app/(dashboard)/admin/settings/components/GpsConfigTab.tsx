'use client';

import { useEffect, useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Loader2 } from 'lucide-react';
import { useSchoolSettings, useUpdateSchoolSettings } from '@novaconnect/data';
import { gpsConfigSchema, type GpsConfig } from '@novaconnect/core/schemas';
import { useToast } from '@/hooks/use-toast';

export function GpsConfigTab({ schoolId }: { schoolId: string }) {
  const { data: settings, isLoading } = useSchoolSettings(schoolId);
  const updateMutation = useUpdateSchoolSettings();
  const { toast } = useToast();

  const form = useForm<GpsConfig>({
    resolver: zodResolver(gpsConfigSchema),
    defaultValues: {
      latitude: 0,
      longitude: 0,
      radiusMeters: 200,
      requireWifiLan: false,
      wifiSsid: '',
    },
  });

  useEffect(() => {
    if (settings?.gps) {
      form.reset(settings.gps);
    }
  }, [settings, form]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          form.setValue('latitude', position.coords.latitude);
          form.setValue('longitude', position.coords.longitude);
          toast({ title: "Position obtenue avec succès" });
        },
        (error) => {
          toast({
            title: "Erreur",
            description: "Impossible d'obtenir votre position",
            variant: "destructive"
          });
        }
      );
    } else {
      toast({
        title: "Erreur",
        description: "La géolocalisation n'est pas supportée par ce navigateur",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (data: GpsConfig) => {
    try {
      await updateMutation.mutateAsync({
        schoolId,
        settings: { gps: data },
      });
      toast({ title: "Configuration GPS mise à jour avec succès" });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  const requireWifiLan = form.watch('requireWifiLan');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Configuration GPS
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude *</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" placeholder="Ex: 48.8566" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude *</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" placeholder="Ex: 2.3522" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="button" variant="outline" onClick={getCurrentLocation}>
              <MapPin className="mr-2 h-4 w-4" />
              Obtenir ma position actuelle
            </Button>

            <FormField
              control={form.control}
              name="radiusMeters"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rayon de détection (mètres) *</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="requireWifiLan"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Exiger connexion WiFi/LAN en plus du GPS</FormLabel>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {requireWifiLan && (
              <FormField
                control={form.control}
                name="wifiSsid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom du réseau WiFi (SSID)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Ecole-WiFi" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
                disabled={updateMutation.isPending}
              >
                Réinitialiser
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
