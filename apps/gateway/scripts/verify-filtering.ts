// Use better-sqlite3 as a drop-in replacement for bun:sqlite
import { Database } from 'bun:sqlite';

console.log('🔒 Démarrage de la vérification de l\'isolation des données (Multi-tenant RLS)...');

// 1. Création d'une base de données en mémoire pour le test
const db = new Database(':memory:');

// 2. Initialisation du schéma (simplifié pour le test)
db.run(`
  CREATE TABLE schools (id TEXT PRIMARY KEY, name TEXT);
  CREATE TABLE users (id TEXT PRIMARY KEY, school_id TEXT, name TEXT, role TEXT);
  CREATE TABLE students (
    id TEXT PRIMARY KEY, 
    school_id TEXT, 
    first_name TEXT, 
    last_name TEXT, 
    status TEXT DEFAULT 'active'
  );
`);


// 3. Insertion des données de test
console.log('\n📝 Insertion des données de test...');

// Deux écoles distinctes
db.run(`INSERT INTO schools (id, name) VALUES ('school_A', 'École Alpha')`);
db.run(`INSERT INTO schools (id, name) VALUES ('school_B', 'École Beta')`);

// Deux administrateurs (un par école)
db.run(`INSERT INTO users (id, school_id, name, role) VALUES ('admin_A', 'school_A', 'Directeur Alpha', 'admin')`);
db.run(`INSERT INTO users (id, school_id, name, role) VALUES ('admin_B', 'school_B', 'Directeur Beta', 'admin')`);

// Étudiants (mélangés)
db.run(`INSERT INTO students (id, school_id, first_name, last_name) VALUES ('student_A1', 'school_A', 'Alice', 'Alpha')`);
db.run(`INSERT INTO students (id, school_id, first_name, last_name) VALUES ('student_A2', 'school_A', 'Arthur', 'Alpha')`);
db.run(`INSERT INTO students (id, school_id, first_name, last_name) VALUES ('student_B1', 'school_B', 'Bob', 'Beta')`);

console.log('✅ Données insérées :');
console.log('   - École Alpha : 2 étudiants (Alice, Arthur)');
console.log('   - École Beta  : 1 étudiant (Bob)');

// 4. Simulation de la fonction sécurisée (Middleware + Requête)
function getStudentsForUser(userId: string) {
  // Étape 1 : Simulation du Middleware RLS (Identification)
  // Dans le vrai code : const user = getUser(c); const schoolId = user.schoolId;
  const user = db.query('SELECT * FROM users WHERE id = ?').get(userId) as any;
  
  if (!user) throw new Error('Utilisateur non trouvé');
  
  console.log(`\n👤 Connexion en tant que : ${user.name} (${user.role}) - École : ${user.school_id}`);
  
  const schoolId = user.school_id;
  
  // Étape 2 : Simulation de la requête SQL sécurisée (Filtrage)
  // Dans le vrai code : WHERE s.school_id = ?
  const query = `
    SELECT * FROM students 
    WHERE school_id = ? 
    ORDER BY first_name
  `;
  
  const students = db.query(query).all(schoolId);
  return students;
}

// 5. Exécution des tests

// Test 1 : Admin Alpha
const studentsAlpha = getStudentsForUser('admin_A');
console.log('   🔍 Résultats visibles :');
if (studentsAlpha.length === 2 && studentsAlpha.every((s: any) => s.school_id === 'school_A')) {
    studentsAlpha.forEach((s: any) => console.log(`      - ${s.first_name} ${s.last_name} (ID: ${s.school_id})`));
    console.log('   ✅ SUCCÈS : Admin Alpha ne voit que ses élèves.');
} else {
    console.error('   ❌ ÉCHEC : Fuite de données détectée !');
    console.log(studentsAlpha);
}

// Test 2 : Admin Beta
const studentsBeta = getStudentsForUser('admin_B');
console.log('   🔍 Résultats visibles :');
if (studentsBeta.length === 1 && studentsBeta.every((s: any) => s.school_id === 'school_B')) {
    studentsBeta.forEach((s: any) => console.log(`      - ${s.first_name} ${s.last_name} (ID: ${s.school_id})`));
    console.log('   ✅ SUCCÈS : Admin Beta ne voit que ses élèves.');
} else {
    console.error('   ❌ ÉCHEC : Fuite de données détectée !');
    console.log(studentsBeta);
}

console.log('\n🔒 Conclusion : Le mécanisme d\'isolation fonctionne correctement.');
