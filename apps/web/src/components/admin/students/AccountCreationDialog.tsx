'use client';

import { useState } from 'react';
import {
  UserPlus,
  Mail,
  Lock,
  Check,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCreateUserAccount } from '@novaconnect/data';

interface AccountCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentData?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    schoolId: string;
  };
  parentsData?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    schoolId: string;
  }>;
}

export function AccountCreationDialog({
  open,
  onOpenChange,
  studentData,
  parentsData = [],
}: AccountCreationDialogProps) {
  const { toast } = useToast();
  const createUserAccount = useCreateUserAccount();

  const [activeTab, setActiveTab] = useState<'student' | 'parent'>('student');
  const [showPassword, setShowPassword] = useState(false);

  // Student account form
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [createStudentAccount, setCreateStudentAccount] = useState(false);
  const [studentAccountCreated, setStudentAccountCreated] = useState(false);
  const [studentCredentials, setStudentCredentials] = useState<{ email: string; password: string } | null>(null);

  // Parent account forms (one per parent)
  const [parentAccounts, setParentAccounts] = useState<
    Array<{ parentId: string; email: string; password: string; create: boolean }>
  >([]);

  // Initialize forms when dialog opens
  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (!open) return;

    // Reset state
    setStudentAccountCreated(false);
    setStudentCredentials(null);
    setActiveTab('student');

    // Initialize student email if available
    if (studentData?.email) {
      setStudentEmail(studentData.email);
    }

    // Initialize parent forms
    const parentForms = parentsData.map((parent) => ({
      parentId: parent.id,
      email: parent.email || '',
      password: '',
      create: false,
    }));
    setParentAccounts(parentForms);
  };

  // Generate random password
  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
    const password = Array.from({ length: 16 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    return password;
  };

  // Generate password for student
  const handleGenerateStudentPassword = () => {
    setStudentPassword(generatePassword());
  };

  // Generate password for a parent
  const handleGenerateParentPassword = (index: number) => {
    const newParentAccounts = [...parentAccounts];
    newParentAccounts[index].password = generatePassword();
    setParentAccounts(newParentAccounts);
  };

  // Copy credentials to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copié',
      description: 'Les identifiants ont été copiés dans le presse-papiers',
    });
  };

  // Create student user account
  const handleCreateStudentAccount = async () => {
    if (!studentData) return;

    if (!studentEmail || !studentEmail.includes('@')) {
      toast({
        title: 'Erreur',
        description: 'Veuillez entrer une adresse email valide',
        variant: 'destructive',
      });
      return;
    }

    if (!studentPassword || studentPassword.length < 8) {
      toast({
        title: 'Erreur',
        description: 'Le mot de passe doit contenir au moins 8 caractères',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await createUserAccount.mutateAsync({
        email: studentEmail,
        password: studentPassword,
        firstName: studentData.firstName,
        lastName: studentData.lastName,
        role: 'student',
        schoolId: studentData.schoolId,
        linkedStudentId: studentData.id,
      });

      setStudentCredentials({
        email: studentEmail,
        password: studentPassword,
      });
      setStudentAccountCreated(true);
      setCreateStudentAccount(false);

      toast({
        title: 'Compte créé',
        description: 'Le compte étudiant a été créé avec succès',
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer le compte étudiant',
        variant: 'destructive',
      });
    }
  };

  // Create parent user account
  const handleCreateParentAccount = async (index: number) => {
    const parentFormData = parentAccounts[index];
    const parentData = parentsData?.[index];

    if (!parentData) return;

    if (!parentFormData.email || !parentFormData.email.includes('@')) {
      toast({
        title: 'Erreur',
        description: 'Veuillez entrer une adresse email valide',
        variant: 'destructive',
      });
      return;
    }

    if (!parentFormData.password || parentFormData.password.length < 8) {
      toast({
        title: 'Erreur',
        description: 'Le mot de passe doit contenir au moins 8 caractères',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createUserAccount.mutateAsync({
        email: parentFormData.email,
        password: parentFormData.password,
        firstName: parentData.firstName,
        lastName: parentData.lastName,
        role: 'parent',
        schoolId: parentData.schoolId,
        linkedParentId: parentData.id,
      });

      // Update parent account state
      const newParentAccounts = [...parentAccounts];
      newParentAccounts[index].created = true;
      newParentAccounts[index].credentials = {
        email: parentFormData.email,
        password: parentFormData.password,
      };
      setParentAccounts(newParentAccounts);

      toast({
        title: 'Compte créé',
        description: `Le compte parent de ${parentData.firstName} ${parentData.lastName} a été créé avec succès`,
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer le compte parent',
        variant: 'destructive',
      });
    }
  };

  const hasParentsWithoutEmail = parentsData.some((p) => !p.email);
  const parentCount = parentsData.length;
  const createdParentCount = parentAccounts.filter((p) => p.created).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Création de comptes utilisateurs
          </DialogTitle>
          <DialogDescription>
            Créez des comptes de connexion pour l'étudiant et ses parents afin qu'ils puissent accéder au portail.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="student" className="flex items-center gap-2">
              Étudiant
              {studentAccountCreated && (
                <Badge variant="secondary" className="ml-1">
                  <Check className="h-3 w-3" />
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="parent" className="flex items-center gap-2" disabled={parentCount === 0}>
              Parents ({parentCount})
              {createdParentCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {createdParentCount}/{parentCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Student Account Tab */}
          <div className="mt-4 space-y-4">
            {activeTab === 'student' && (
              <>
                {studentAccountCreated ? (
                                          <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-green-900">Compte créé avec succès !</p>
                        <p className="text-sm text-green-700">
                          L'étudiant peut maintenant se connecter avec ses identifiants
                        </p>
                      </div>
                    </div>

                    {studentCredentials && (
                      <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-orange-900 flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            Identifiants de connexion
                          </h4>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(`Email: ${studentCredentials.email}\nMot de passe: ${studentCredentials.password}`)}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copier tout
                          </Button>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between pb-2 border-b border-orange-200">
                            <span className="text-orange-700">Email:</span>
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-white px-2 py-1 rounded font-mono">
                                {studentCredentials.email}
                              </code>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => copyToClipboard(studentCredentials.email)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-orange-700">Mot de passe:</span>
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-white px-2 py-1 rounded font-mono">
                                {showPassword ? studentCredentials.password : '•'.repeat(16)}
                              </code>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => copyToClipboard(studentCredentials.password)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 p-3 bg-white rounded border border-orange-200">
                          <p className="text-xs text-orange-800">
                            <strong>Important:</strong> Sauvegardez ces identifiants de manière sécurisée.
                            Partagez-les avec l'étudiant via un canal sécurisé (email chiffré, SMS, etc.).
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Information:</strong> Créer un compte utilisateur permettra à l'étudiant
                        de se connecter au portail étudiant pour consulter ses notes, emplois du temps,
                        devoirs, etc.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="studentEmail">Email de connexion *</Label>
                        <Input
                          id="studentEmail"
                          type="email"
                          placeholder="etudiant@exemple.com"
                          value={studentEmail}
                          onChange={(e) => setStudentEmail(e.target.value)}
                          disabled={createStudentAccount}
                        />
                      </div>

                      <div>
                        <Label htmlFor="studentPassword">Mot de passe *</Label>
                        <div className="flex gap-2">
                          <Input
                            id="studentPassword"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Au moins 8 caractères"
                            value={studentPassword}
                            onChange={(e) => setStudentPassword(e.target.value)}
                            disabled={createStudentAccount}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={createStudentAccount}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleGenerateStudentPassword}
                            disabled={createStudentAccount}
                          >
                            Générer
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="createStudentAccount"
                          checked={createStudentAccount}
                          onCheckedChange={setCreateStudentAccount}
                          disabled={!studentEmail || !studentPassword || createStudentAccount}
                        />
                        <Label
                          htmlFor="createStudentAccount"
                          className="text-sm font-normal cursor-pointer"
                        >
                          Créer le compte utilisateur maintenant
                        </Label>
                      </div>
                    </div>

                    {createStudentAccount && (
                      <Button
                        onClick={handleCreateStudentAccount}
                        disabled={createUserAccount.isPending}
                        className="w-full"
                      >
                        {createUserAccount.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Création en cours...
                          </>
                        ) : (
                          <>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Créer le compte
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Parent Accounts Tab */}
            {activeTab === 'parent' && (
              <>
                {parentCount === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Aucun parent associé à cet étudiant</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {hasParentsWithoutEmail && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          <strong>Attention:</strong> Certains parents n'ont pas d'adresse email renseignée.
                          Veuillez entrer un email pour créer leur compte.
                        </p>
                      </div>
                    )}

                    {parentsData.map((parent, index) => {
                      const formData = parentAccounts[index] || {
                        parentId: parent.id,
                        email: parent.email || '',
                        password: '',
                        create: false,
                      };

                      const isCreated = formData.created;

                      return (
                        <div
                          key={parent.id}
                          className={`p-4 border rounded-lg ${
                            isCreated
                              ? 'bg-green-50 border-green-200'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-gray-900">
                                {parent.firstName} {parent.lastName}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {parent.email || 'Email non renseigné'}
                              </p>
                            </div>
                            {isCreated && (
                              <Badge variant="secondary" className="bg-green-600 text-white">
                                <Check className="h-3 w-3 mr-1" />
                                Créé
                              </Badge>
                            )}
                          </div>

                          {isCreated ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-700">Email:</span>
                                <div className="flex items-center gap-2">
                                  <code className="text-xs bg-white px-2 py-1 rounded font-mono">
                                    {formData.credentials?.email}
                                  </code>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={() => copyToClipboard(formData.credentials?.email || '')}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-700">Mot de passe:</span>
                                <div className="flex items-center gap-2">
                                  <code className="text-xs bg-white px-2 py-1 rounded font-mono">
                                    {formData.credentials?.password || ''}
                                  </code>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={() =>
                                      copyToClipboard(formData.credentials?.password || '')
                                    }
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div>
                                <Label>Email de connexion *</Label>
                                <Input
                                  type="email"
                                  placeholder="parent@exemple.com"
                                  value={formData.email}
                                  onChange={(e) => {
                                    const newParentAccounts = [...parentAccounts];
                                    if (!newParentAccounts[index]) {
                                      newParentAccounts[index] = {
                                        parentId: parent.id,
                                        email: e.target.value,
                                        password: '',
                                        create: false,
                                      };
                                    } else {
                                      newParentAccounts[index].email = e.target.value;
                                    }
                                    setParentAccounts(newParentAccounts);
                                  }}
                                />
                              </div>

                              <div>
                                <Label>Mot de passe *</Label>
                                <div className="flex gap-2">
                                  <Input
                                    type="password"
                                    placeholder="Au moins 8 caractères"
                                    value={formData.password}
                                    onChange={(e) => {
                                      const newParentAccounts = [...parentAccounts];
                                      newParentAccounts[index].password = e.target.value;
                                      setParentAccounts(newParentAccounts);
                                    }}
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleGenerateParentPassword(index)}
                                  >
                                    Générer
                                  </Button>
                                </div>
                              </div>

                              <Button
                                onClick={() => handleCreateParentAccount(index)}
                                disabled={
                                  !formData.email ||
                                  !formData.password ||
                                  formData.password.length < 8 ||
                                  createUserAccount.isPending
                                }
                                className="w-full"
                                size="sm"
                              >
                                {createUserAccount.isPending ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Création...
                                  </>
                                ) : (
                                  <>
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Créer le compte
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </Tabs>

        <DialogFooter className="flex justify-between">
          <div className="text-xs text-gray-500">
            {studentAccountCreated && createdParentCount > 0
              ? `${createdParentCount + 1} compte(s) créé(s)`
              : studentAccountCreated
              ? '1 compte créé'
              : ''}
          </div>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
