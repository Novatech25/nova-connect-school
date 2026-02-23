'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TestParentLogin() {
  const [email, setEmail] = useState('fadiala@gmail.com')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('Fadiala')
  const [lastName, setLastName] = useState('Parent')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testCreateParent = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/parents/create-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          schoolId: 'YOUR_SCHOOL_ID_HERE', // ← REPLACE THIS
          studentId: 'YOUR_STUDENT_ID_HERE', // ← REPLACE THIS
          relationship: 'Parent',
          phone: '0000000',
          isPrimaryContact: true,
          isEmergencyContact: true,
        }),
      })

      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const testLogin = async () => {
    setLoading(true)
    setResult(null)

    try {
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001'
      const response = await fetch(`${GATEWAY_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const testCheckUser = async () => {
    setLoading(true)
    setResult(null)

    try {
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001'
      const response = await fetch(
        `${GATEWAY_URL}/api/users/check-email?email=${encodeURIComponent(email)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Test Création/Connexion Parent</h1>

        <Card>
          <CardHeader>
            <CardTitle>Formulaire de Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Mot de passe</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Prénom</label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nom</label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={testCreateParent} disabled={loading}>
                {loading ? 'Création...' : 'Créer Parent'}
              </Button>
              <Button onClick={testLogin} disabled={loading} variant="outline">
                {loading ? 'Test...' : 'Tester Connexion'}
              </Button>
              <Button onClick={testCheckUser} disabled={loading} variant="secondary">
                {loading ? 'Test...' : 'Vérifier Email'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Résultat</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96 text-sm">
                {JSON.stringify(result, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              1. Remplacez <code>YOUR_SCHOOL_ID_HERE</code> et <code>YOUR_STUDENT_ID_HERE</code>{' '}
              dans le code ci-dessus
            </p>
            <p>
              2. Pour trouver l'ID de l'école, allez dans les paramètres ou regardez l'URL de la
              page admin
            </p>
            <p>
              3. Pour trouver l'ID de l'élève, allez dans la page des élèves et copiez l'ID depuis
              l'URL
            </p>
            <p>4. Cliquez sur "Créer Parent" pour créer un nouveau compte</p>
            <p>5. Cliquez sur "Tester Connexion" pour tester la connexion avec le Gateway</p>
            <p>6. Cliquez sur "Vérifier Email" pour voir si l'email existe dans la base</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
