# Checklist RLS (Row-Level Security)

## Prérequis

Avant de déployer en production, vérifiez que tous les points de cette checklist sont validés.

## ✔ Tables avec RLS Activé

- [ ] **schools** - RLS activé (`ALTER TABLE schools ENABLE ROW LEVEL SECURITY`)
  - [ ] Policy: `super_admin_full_access` - Accès complet super admin
  - [ ] Policy: `school_admin_own_school` - Accès école admin
  - [ ] Aucun `USING (true)` sans justification

- [ ] **users** - RLS activé
  - [ ] Policy: `super_admin_all_users` - Super admin voit tous utilisateurs
  - [ ] Policy: `school_admin_school_users` - Admin voit utilisateurs de son école
  - [ ] Policy: `users_own_profile` - Utilisateur voit son propre profil
  - [ ] Aucune fuite de données inter-écoles

- [ ] **user_roles** - RLS activé
  - [ ] Policy: `super_admin_all_roles` - Accès complet
  - [ ] Policy: `users_own_roles` - Utilisateur voit ses propres rôles
  - [ ] Policy: `school_admin_school_roles` - Admin voit rôles de son école

- [ ] **grades** - RLS activé
  - [ ] Policy: `teachers_assigned_classes` - Prof voit classes assignées
  - [ ] Policy: `students_own_grades` - Élève voit ses notes publiées uniquement
  - [ ] Policy: `parents_children_grades` - Parent voit notes enfants publiées
  - [ ] Policy: `school_admin_all_grades` - Admin voit toutes notes de son école
  - [ ] **Critique**: Notes draft non visibles aux élèves/parents

- [ ] **payments** - RLS activé
  - [ ] Policy: `accountant_full_access` - Comptable accès complet
  - [ ] Policy: `students_own_payments` - Élève voit ses paiements uniquement
  - [ ] Policy: `parents_children_payments` - Parent voit paiements enfants
  - [ ] Policy: `school_admin_all_payments` - Admin voit tous paiements école

- [ ] **payment_installments** - RLS activé
  - [ ] Mêmes policies que `payments`
  - [ ] **Sécurité**: Montants et soldes protégés

- [ ] **attendance_records** - RLS activé
  - [ ] Policy: `teachers_assigned_classes` - Prof voit présence classes assignées
  - [ ] Policy: `students_own_attendance` - Élève voit sa présence
  - [ ] Policy: `parents_children_attendance` - Parent voit présence enfants
  - [ ] Policy: `school_admin_all_attendance` - Admin voit toute présence école

- [ ] **attendance_sessions** - RLS activé
  - [ ] Policy: `teachers_can_create` - Prof peut créer sessions ses classes
  - [ ] Policy: `school_admin_all_sessions` - Admin voit toutes sessions

- [ ] **report_cards** - RLS activé
  - [ ] Policy: `students_own_report_cards` - Élève voit ses bulletins
  - [ ] Policy: `parents_children_report_cards` - Parent voit bulletins enfants
  - [ ] Policy: `school_admin_all_report_cards` - Admin voit tous bulletins

- [ ] **payroll_entries** - RLS activé
  - [ ] Policy: `teachers_own_payroll` - Prof voit sa paie uniquement
  - [ ] Policy: `accountant_full_access` - Comptable accès complet
  - [ ] Policy: `school_admin_all_payroll` - Admin voit toute paie

- [ ] **audit_logs** - RLS activé
  - [ ] Policy: `super_admin_all_logs` - Super admin voit tous logs
  - [ ] Policy: `school_admin_school_logs` - Admin voit logs de son école
  - [ ] **Important**: Logs immuables (pas de UPDATE/DELETE via RLS)

## Helpers RLS

- [ ] Fonction `get_current_user_school_id()` créée et testée
- [ ] Fonction `is_super_admin()` créée et testée
- [ ] Fonction `has_permission(required_role)` créée et testée
- [ ] Helpers utilisés dans toutes les policies (pas de duplication de logique)

## Tests par Rôle

### Super Admin
- [ ] Peut CRUD toutes écoles
- [ ] Peut voir tous utilisateurs (toutes écoles)
- [ ] Peut voir tous logs audit
- [ ] Peut gérer licences
- [ ] A accès au monitoring global

### School Admin
- [ ] Peut CRUD son école uniquement
- [ ] Peut voir utilisateurs de son école uniquement
- [ ] Ne peut PAS voir autres écoles
- [ ] Peut valider notes/présence de son école
- [ ] Peut gérer paiements de son école

### Teacher
- [ ] Peut voir classes assignées uniquement
- [ ] Peut marquer présence classes assignées
- [ ] Peut saisir notes classes assignées
- [ ] Peut voir sa paie uniquement
- [ ] Ne peut PAS voir données autres classes

### Student
- [ ] Peut voir ses données uniquement
- [ ] Peut voir notes publiées uniquement (pas draft)
- [ ] Peut voir sa présence
- [ ] Peut voir ses paiements
- [ ] Ne peut PAS voir données autres étudiants

### Parent
- [ ] Peut voir données de ses enfants uniquement
- [ ] Peut voir notes publiées enfants
- [ ] Peut voir présence enfants
- [ ] Peut voir paiements enfants
- [ ] Peut basculer entre enfants
- [ ] Ne peut PAS voir données autres élèves

### Accountant
- [ ] Peut gérer paiements école
- [ ] Peut voir tous paiements école
- [ ] Peut générer rapports financiers
- [ ] Ne peut PAS modifier notes/présence

## Vérifications Sécurité

- [ ] Aucune policy avec `USING (true)` sans justification documentée
- [ ] Aucune fuite de données inter-écoles testée
- [ ] Service role key jamais exposé côté client
- [ ] Anon key utilisé côté client uniquement
- [ ] RLS policies testées avec utilisateurs de chaque rôle
- [ ] Test injection SQL tenté sur toutes les queries

## Outils de Vérification

### Supabase CLI
```bash
# Vérifier RLS activé sur table
supabase db inspect --table schools

# Voir toutes policies d'une table
supabase db inspect --policies schools
```

### Tests Automatisés
```bash
# Exécuter tests de sécurité RLS
pnpm test:rls
```

### Tests Manuels
1. Se connecter en tant que school_admin école A
2. Tenter d'accéder aux données de l'école B
3. Vérifier que l'accès est refusé (403 Forbidden)
4. Répéter pour chaque rôle et table sensible

## Validation Finale

- [ ] Tous les points de cette checklist sont validés
- [ ] Tests manuels effectués par 2 personnes différentes
- [ ] Revue de code par un senior developer
- [ ] Documentation à jour
- [ ] Tests automatisés passants (CI green)

## Fréquence de Vérification

- **Avant chaque mise en production**: Checklist complète
- **Après chaque modification RLS**: Tests manuels
- **Trimestriellement**: Audit de sécurité complet
- **Annuellement**: Pénétration testing

## Contact

En cas de doute sur une policy RLS:
- Documenter la question dans `docs/security/rls-questions.md`
- Ouvrir une issue GitHub avec le label `security`
- Contacter le lead technique

## Ressources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [OWASP Access Control Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html)
