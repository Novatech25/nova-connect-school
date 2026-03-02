import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSchool, useUpdateSchool } from '@novaconnect/data';
import { getSupabaseClient } from '@novaconnect/data/client';
import { toast } from 'sonner';
import { UploadCloud, Image as ImageIcon, X } from 'lucide-react';

interface SchoolInfoTabProps {
  schoolId: string;
}

export function SchoolInfoTab({ schoolId }: SchoolInfoTabProps) {
  const { school, isLoading } = useSchool(schoolId);
  const updateSchool = useUpdateSchool();

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    logo_url: '',
  });
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (school) {
      setFormData({
        name: school.name || '',
        address: school.address || '',
        phone: school.phone || '',
        email: school.email || '',
        logo_url: (school as any).logo_url || '',
      });
    }
  }, [school]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
       toast.error('Veuillez sélectionner une image (PNG, JPG, etc).');
       return;
    }
    
    // Max 2MB
    if (file.size > 2 * 1024 * 1024) {
       toast.error('L\'image ne doit pas dépasser 2 MB.');
       return;
    }

    try {
      setIsUploading(true);
      const supabase = getSupabaseClient();
      
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${schoolId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('school-assets')
        .upload(fileName, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('school-assets')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, logo_url: publicUrl }));
      toast.success('Logo téléchargé avec succès. N\'oubliez pas d\'enregistrer.');
    } catch (error: any) {
      toast.error('Erreur lors du téléchargement: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Le nom de l'établissement est requis.");
      return;
    }

    try {
      await updateSchool.mutateAsync({
        id: schoolId,
        ...formData,
      } as any);
      toast.success('Informations mises à jour avec succès.');
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la mise à jour des informations.');
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Chargement des informations...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Général</CardTitle>
        <CardDescription>
          Modifiez les coordonnées et l'identité visuelle de votre établissement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nom de l'établissement <span className="text-red-500">*</span>
              </label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ex: Lycée d'Excellence"
                required
              />
            </div>
            
            {/* Logo Upload Section */}
            <div className="pt-4 border-t">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Logo de l'établissement
              </label>
              
              <div className="flex items-center gap-6">
                <div className="flex-shrink-0 flex items-center justify-center w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                  {formData.logo_url ? (
                    <img 
                      src={formData.logo_url} 
                      alt="Logo Ecole" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                  )}
                </div>
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <Button 
                      type="button" 
                      variant="outline" 
                      disabled={isUploading}
                      className="relative overflow-hidden"
                    >
                      <UploadCloud className="h-4 w-4 mr-2" />
                      {isUploading ? 'Chargement...' : 'Parcourir'}
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        disabled={isUploading}
                      />
                    </Button>
                    
                    {formData.logo_url && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setFormData(prev => ({ ...prev, logo_url: '' }))}
                      >
                        <X className="h-4 w-4 mr-1" /> Supprimer
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Format recommandé : PNG ou JPG avec fond transparent. Taille maximale : 2 Mo.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Adresse postale
              </label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Ex: 12 Rue des Écoles, 75000 Paris"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone
                </label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Ex: +33 1 23 45 67 89"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email de contact
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Ex: contact@ecole.fr"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t flex justify-end">
            <Button type="submit" disabled={updateSchool.isPending} className="bg-blue-600 hover:bg-blue-700">
              {updateSchool.isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
