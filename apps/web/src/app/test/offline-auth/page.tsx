'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, XCircle, Loader2, Wifi, WifiOff, Server } from 'lucide-react';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';

export default function OfflineAuthTestPage() {
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Register form state
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'school_admin',
    schoolCode: 'TEST-SCHOOL',
  });

  // Login form state
  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  });

  // Auth tokens after login
  const [authTokens, setAuthTokens] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Check Gateway status
  const checkGatewayStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${GATEWAY_URL}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      const isOk = response.ok;
      setIsOnline(isOk);
      setTestResult({
        type: 'health',
        success: isOk,
        message: isOk ? 'Gateway en ligne' : 'Gateway hors ligne',
      });
    } catch (error) {
      setIsOnline(false);
      setTestResult({
        type: 'health',
        success: false,
        message: 'Gateway inaccessible',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Test register
  const testRegister = async () => {
    setIsLoading(true);
    setTestResult(null);

    try {
      const response = await fetch(`${GATEWAY_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerData),
      });

      const result = await response.json();

      if (response.ok) {
        setTestResult({
          type: 'register',
          success: true,
          message: 'Compte créé avec succès (mode offline)',
          data: result,
        });

        // Store tokens
        setAuthTokens(result);
        setCurrentUser(result.user);
        localStorage.setItem('test_auth_tokens', JSON.stringify(result));
      } else {
        setTestResult({
          type: 'register',
          success: false,
          message: result.error || 'Erreur lors de l\'inscription',
        });
      }
    } catch (error: any) {
      setTestResult({
        type: 'register',
        success: false,
        message: error.message || 'Erreur de connexion au Gateway',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Test login
  const testLogin = async () => {
    setIsLoading(true);
    setTestResult(null);

    try {
      const response = await fetch(`${GATEWAY_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      });

      const result = await response.json();

      if (response.ok) {
        setTestResult({
          type: 'login',
          success: true,
          message: 'Connexion réussie (mode offline)',
          data: result,
        });

        // Store tokens
        setAuthTokens(result);
        setCurrentUser(result.user);
        localStorage.setItem('test_auth_tokens', JSON.stringify(result));
      } else {
        setTestResult({
          type: 'login',
          success: false,
          message: result.error || 'Erreur lors de la connexion',
        });
      }
    } catch (error: any) {
      setTestResult({
        type: 'login',
        success: false,
        message: error.message || 'Erreur de connexion au Gateway',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Test get current user
  const testGetUser = async () => {
    if (!authTokens) {
      setTestResult({
        type: 'me',
        success: false,
        message: 'Pas de tokens. Connectez-vous d\'abord.',
      });
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    try {
      const response = await fetch(`${GATEWAY_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authTokens.access_token}`,
        },
      });

      const result = await response.json();

      if (response.ok) {
        setTestResult({
          type: 'me',
          success: true,
          message: 'Utilisateur récupéré avec succès',
          data: result,
        });
        setCurrentUser(result.user);
      } else {
        setTestResult({
          type: 'me',
          success: false,
          message: result.error || 'Erreur lors de la récupération',
        });
      }
    } catch (error: any) {
      setTestResult({
        type: 'me',
        success: false,
        message: error.message || 'Erreur de connexion au Gateway',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Test logout
  const testLogout = async () => {
    if (!authTokens) {
      setTestResult({
        type: 'logout',
        success: false,
        message: 'Pas de session active.',
      });
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    try {
      const response = await fetch(`${GATEWAY_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: authTokens.refresh_token }),
      });

      if (response.ok) {
        setTestResult({
          type: 'logout',
          success: true,
          message: 'Déconnexion réussie',
        });
        setAuthTokens(null);
        setCurrentUser(null);
        localStorage.removeItem('test_auth_tokens');
      } else {
        const result = await response.json();
        setTestResult({
          type: 'logout',
          success: false,
          message: result.error || 'Erreur lors de la déconnexion',
        });
      }
    } catch (error: any) {
      setTestResult({
        type: 'logout',
        success: false,
        message: error.message || 'Erreur de connexion au Gateway',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // View local users
  const viewLocalUsers = async () => {
    setIsLoading(true);
    setTestResult(null);

    try {
      // This would require a new endpoint, for now just show message
      setTestResult({
        type: 'users',
        success: true,
        message: 'Fonctionnalité à venir: Liste des utilisateurs locaux',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div>
        <h1 className="text-3xl font-bold">Test Auth Locale Offline</h1>
        <p className="mt-2 text-gray-600">
          Interface de test pour l'authentification locale via Gateway LAN
        </p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-5 w-5 text-green-600" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-600" />
            )}
            Statut du Gateway
          </CardTitle>
          <CardDescription>
            {GATEWAY_URL}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant={isOnline ? 'success' : 'destructive'}>
              {isOnline ? 'En ligne' : 'Hors ligne'}
            </Badge>
            <Button onClick={checkGatewayStatus} disabled={isLoading} variant="outline" size="sm">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Vérifier
            </Button>
          </div>

          {currentUser && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-800">Connecté en tant que :</p>
              <p className="text-lg font-bold text-green-900">{currentUser.email}</p>
              <p className="text-sm text-green-700">Rôle : {currentUser.role}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Tabs */}
      <Tabs defaultValue="status" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="status">Statut</TabsTrigger>
          <TabsTrigger value="register">Inscription</TabsTrigger>
          <TabsTrigger value="login">Connexion</TabsTrigger>
          <TabsTrigger value="me">Utilisateur</TabsTrigger>
          <TabsTrigger value="logout">Déconnexion</TabsTrigger>
        </TabsList>

        {/* Status Tab */}
        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle>Statut Gateway</CardTitle>
              <CardDescription>
                Vérifiez la connexion avec le Gateway LAN
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm font-medium">URL du Gateway</p>
                  <code className="text-xs bg-gray-100 p-2 rounded block mt-1">{GATEWAY_URL}</code>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm font-medium">Statut</p>
                  <div className="mt-1">
                    {isOnline ? (
                      <Badge variant="success">Connecté</Badge>
                    ) : (
                      <Badge variant="destructive">Déconnecté</Badge>
                    )}
                  </div>
                </div>
              </div>
              </CardContent>
          </Card>
        </TabsContent>

        {/* Register Tab */}
        <TabsContent value="register">
          <Card>
            <CardHeader>
              <CardTitle>Test Inscription Offline</CardTitle>
              <CardDescription>
                Créer un compte sans connexion internet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="reg-email">Email</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    placeholder="test@offline.com"
                  />
                </div>
                <div>
                  <Label htmlFor="reg-password">Mot de passe</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    placeholder="•••••••••"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="reg-firstname">Prénom</Label>
                    <Input
                      id="reg-firstname"
                      value={registerData.firstName}
                      onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })}
                      placeholder="Jean"
                    />
                  </div>
                  <div>
                    <Label htmlFor="reg-lastname">Nom</Label>
                    <Input
                      id="reg-lastname"
                      value={registerData.lastName}
                      onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })}
                      placeholder="Dupont"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="reg-role">Rôle</Label>
                  <select
                    id="reg-role"
                    value={registerData.role}
                    onChange={(e) => setRegisterData({ ...registerData, role: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
                  >
                    <option value="student">Élève</option>
                    <option value="parent">Parent</option>
                    <option value="teacher">Enseignant</option>
                    <option value="school_admin">Administrateur d'école</option>
                    <option value="accountant">Comptable</option>
                    <option value="supervisor">Surveillant</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="reg-school">Code école</Label>
                  <Input
                    id="reg-school"
                    value={registerData.schoolCode}
                    onChange={(e) => setRegisterData({ ...registerData, schoolCode: e.target.value })}
                    placeholder="TEST-SCHOOL"
                  />
                </div>
                <Button onClick={testRegister} disabled={isLoading || !registerData.email || !registerData.password}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Créer le compte offline
                </Button>

                {testResult?.type === 'register' && (
                  <div className={`p-4 rounded-lg border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-start gap-2">
                      {testResult.success ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      )}
                      <div>
                        <p className={`font-medium ${testResult.success ? 'text-green-900' : 'text-red-900'}`}>
                          {testResult.message}
                        </p>
                        {testResult.data && (
                          <p className="text-sm text-gray-600 mt-1">
                            User ID: {testResult.data.user?.id?.substring(0, 20)}...
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Login Tab */}
        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>Test Connexion Offline</CardTitle>
              <CardDescription>
                Se connecter sans connexion internet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    placeholder="test@offline.com"
                  />
                </div>
                <div>
                  <Label htmlFor="login-password">Mot de passe</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    placeholder="•••••••••"
                  />
                </div>
                <Button onClick={testLogin} disabled={isLoading || !loginData.email || !loginData.password}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Se connecter offline
                </Button>

                {testResult?.type === 'login' && (
                  <div className={`p-4 rounded-lg border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-start gap-2">
                      {testResult.success ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      )}
                      <div>
                        <p className={`font-medium ${testResult.success ? 'text-green-900' : 'text-red-900'}`}>
                          {testResult.message}
                        </p>
                        {testResult.data?.user && (
                          <p className="text-sm text-gray-600 mt-1">
                            Connecté en tant que : {testResult.data.user.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Current User Tab */}
        <TabsContent value="me">
          <Card>
            <CardHeader>
              <CardTitle>Test Récupération Utilisateur</CardTitle>
              <CardDescription>
                Récupérer les infos de l'utilisateur connecté
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {authTokens ? 'Tokens stockés localement' : 'Non connecté'}
                </p>
                <Button onClick={testGetUser} disabled={isLoading || !authTokens} variant="outline" size="sm">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Récupérer les infos
                </Button>
              </div>

              {testResult?.type === 'me' && (
                <div className={`p-4 rounded-lg border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-start gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div>
                      <p className={`font-medium ${testResult.success ? 'text-green-900' : 'text-red-900'}`}>
                        {testResult.message}
                      </p>
                      {testResult.data && (
                        <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto">
                          {JSON.stringify(testResult.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logout Tab */}
        <TabsContent value="logout">
          <Card>
            <CardHeader>
              <CardTitle>Test Déconnexion</CardTitle>
              <CardDescription>
                Se déconnecter et invalider les tokens
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {authTokens ? 'Session active' : 'Aucune session active'}
                </p>
                <Button onClick={testLogout} disabled={isLoading || !authTokens} variant="destructive">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Se déconnecter
                </Button>
              </div>

              {testResult?.type === 'logout' && (
                <div className={`p-4 rounded-lg border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-start gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <p className={`font-medium ${testResult.success ? 'text-green-900' : 'text-red-900'}`}>
                      {testResult.message}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900 flex items-center gap-2">
            <Server className="h-5 w-5" />
            Fonctionnement Offline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-blue-800">
          <p>
            <strong>Architecture :</strong>
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Online</strong> : App Web → Supabase Cloud (mode normal)</li>
            <li><strong>Offline</strong> : App Web → Gateway LAN → Base locale SQLite</li>
            <li>Le Gateway détecte automatiquement la connexion et synchronise quand online</li>
            <li>Les comptes créés offline sont marqués pour sync vers Supabase</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
