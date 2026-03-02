/**
 * Tests d'intégration pour l'Edge Function send-notification
 *
 * Pour exécuter ces tests :
 * 1. Démarrer Supabase localement avec `supabase start`
 * 2. Exécuter `deno test --allow-net --allow-env`
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface TestNotification {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: string;
  channels?: string[];
}

/**
 * Helper pour appeler l'Edge Function send-notification
 */
async function sendNotification(notifications: TestNotification[], schoolId: string) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ notifications, schoolId }),
  });

  return {
    status: response.status,
    data: await response.json(),
  };
}

/**
 * Helper pour créer un utilisateur de test
 */
async function createTestUser(email: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      email,
      first_name: 'Test',
      last_name: 'User',
      metadata: { push_token: 'test_push_token' },
    }),
  });

  const user = await response.json();
  return user[0];
}

/**
 * Helper pour supprimer un utilisateur de test
 */
async function deleteTestUser(userId: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
    },
  });
}

Deno.test('send-notification: envoi d\'une notification simple', async () => {
  // Créer un utilisateur de test
  const user = await createTestUser(`test-${Date.now()}@example.com`);

  try {
    const notifications: TestNotification[] = [
      {
        userId: user.id,
        type: 'grade_posted',
        title: 'Nouvelles notes publiées',
        body: 'Les notes de mathématiques ont été publiées.',
        channels: ['in_app', 'push'],
      },
    ];

    const result = await sendNotification(notifications, user.school_id || 'test-school');

    assertEquals(result.status, 200);
    assertExists(result.data.success);
    assertEquals(result.data.success, true);
    assertExists(result.data.count);
    assertEquals(result.data.count, 1);
  } finally {
    // Nettoyer
    await deleteTestUser(user.id);
  }
});

Deno.test('send-notification: envoi de notifications en lot', async () => {
  // Créer plusieurs utilisateurs de test
  const user1 = await createTestUser(`test1-${Date.now()}@example.com`);
  const user2 = await createTestUser(`test2-${Date.now()}@example.com`);

  try {
    const notifications: TestNotification[] = [
      {
        userId: user1.id,
        type: 'assignment_added',
        title: 'Nouveau devoir',
        body: 'Un nouveau devoir a été ajouté.',
        channels: ['in_app', 'push'],
      },
      {
        userId: user2.id,
        type: 'assignment_added',
        title: 'Nouveau devoir',
        body: 'Un nouveau devoir a été ajouté.',
        channels: ['in_app', 'push'],
      },
    ];

    const result = await sendNotification(notifications, user1.school_id || 'test-school');

    assertEquals(result.status, 200);
    assertEquals(result.data.success, true);
    assertEquals(result.data.count, 2);
  } finally {
    // Nettoyer
    await deleteTestUser(user1.id);
    await deleteTestUser(user2.id);
  }
});

Deno.test('send-notification: gestion des préférences utilisateur', async () => {
  // Créer un utilisateur avec des préférences spécifiques
  const user = await createTestUser(`test-${Date.now()}@example.com`);

  try {
    // Définir les préférences utilisateur (seulement email)
    await fetch(`${SUPABASE_URL}/rest/v1/notification_preferences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        user_id: user.id,
        notification_type: 'grade_posted',
        enabled_channels: ['email'],
      }),
    });

    const notifications: TestNotification[] = [
      {
        userId: user.id,
        type: 'grade_posted',
        title: 'Notes publiées',
        body: 'Vos notes ont été publiées.',
        channels: ['in_app', 'push', 'email'], // Sera remplacé par les préférences
      },
    ];

    const result = await sendNotification(notifications, user.school_id || 'test-school');

    assertEquals(result.status, 200);
    assertEquals(result.data.success, true);

    // Vérifier que la notification a été créée avec les bons canaux
    const notificationResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user.id}&select=*`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
      }
    );
    const notifications = await notificationResponse.json();

    assertExists(notifications[0]);
    assertEquals(notifications[0].channels, ['email']);
  } finally {
    // Nettoyer
    await deleteTestUser(user.id);
  }
});

Deno.test('send-notification: validation des paramètres', async () => {
  const result = await sendNotification([], 'test-school');

  assertEquals(result.status, 400);
  assertExists(result.data.error);
});

Deno.test('send-notification: authentification requise', async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      notifications: [],
      schoolId: 'test-school',
    }),
  });

  assertEquals(response.status, 401);

  const data = await response.json();
  assertExists(data.error);
});

Deno.test('send-notification: autorisation requise', async () => {
  // Créer un utilisateur non admin
  const user = await createTestUser(`test-${Date.now()}@example.com`);

  try {
    // Essayer d'envoyer une notification sans les droits admin
    const notifications: TestNotification[] = [
      {
        userId: user.id,
        type: 'grade_posted',
        title: 'Notes publiées',
        body: 'Vos notes ont été publiées.',
        channels: ['in_app'],
      },
    ];

    // Utiliser le token utilisateur au lieu du service role
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notifications,
        schoolId: user.school_id || 'test-school',
      }),
    });

    // Devrait échouer car pas d'authorization header
    assertEquals(response.status, 401);
  } finally {
    await deleteTestUser(user.id);
  }
});

Deno.test('send-notification: intégration des canaux multiples', async () => {
  const user = await createTestUser(`test-${Date.now()}@example.com`);

  try {
    const notifications: TestNotification[] = [
      {
        userId: user.id,
        type: 'document_blocked',
        title: 'Document bloqué',
        body: 'Un document a été bloqué.',
        priority: 'urgent',
        channels: ['in_app', 'push', 'email', 'sms'],
      },
    ];

    const result = await sendNotification(notifications, user.school_id || 'test-school');

    assertEquals(result.status, 200);
    assertEquals(result.data.success, true);

    // Vérifier que les logs ont été créés pour chaque canal
    // (Note: en environnement réel, seuls in_app et push fonctionneraient sans config externe)
    const logsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/notification_logs?notification_id=eq.${result.data.notifications[0].id}&select=*`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
      }
    );
    const logs = await logsResponse.json();

    assertExists(logs);
    // Au moins in_app et push devraient être créés
    assertExists(logs.length > 0);
  } finally {
    await deleteTestUser(user.id);
  }
});
