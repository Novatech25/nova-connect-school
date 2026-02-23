import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCreateGrade, useSubmitGrade } from '@novaconnect/data';

export default function GradeEntryPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createGrade = useCreateGrade();
  const submitGrade = useSubmitGrade();

  const [formData, setFormData] = useState({
    studentId: '',
    classId: '',
    subjectId: '',
    periodId: '',
    academicYearId: '',
    schoolId: '',
    gradeType: 'homework',
    title: '',
    score: '',
    maxScore: '20',
    coefficient: '1',
    comments: '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveDraft = async () => {
    // Validation - all required fields must be present
    if (!formData.schoolId || !formData.academicYearId || !formData.classId || !formData.subjectId || !formData.periodId || !formData.studentId || !formData.title || !formData.score) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires (Classe, Matière, Période, Élève, Titre, Note)');
      return;
    }

    const scoreNum = parseFloat(formData.score);
    const maxScoreNum = parseFloat(formData.maxScore);

    if (scoreNum > maxScoreNum) {
      Alert.alert('Erreur', 'La note ne peut pas être supérieure à la note maximale');
      return;
    }

    try {
      const grade = await createGrade.mutateAsync({
        ...formData,
        score: scoreNum,
        maxScore: maxScoreNum,
        coefficient: parseFloat(formData.coefficient),
        weight: 1,
      });

      Alert.alert('Succès', 'Brouillon enregistré avec succès');

      // Reset form
      setFormData({
        studentId: '',
        classId: '',
        subjectId: '',
        periodId: '',
        academicYearId: '',
        schoolId: '',
        gradeType: 'homework',
        title: '',
        score: '',
        maxScore: '20',
        coefficient: '1',
        comments: '',
      });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'enregistrer la note');
    }
  };

  const handleSubmit = async () => {
    // Validation - all required fields must be present
    if (!formData.schoolId || !formData.academicYearId || !formData.classId || !formData.subjectId || !formData.periodId || !formData.studentId || !formData.title || !formData.score) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires (Classe, Matière, Période, Élève, Titre, Note)');
      return;
    }

    const scoreNum = parseFloat(formData.score);
    const maxScoreNum = parseFloat(formData.maxScore);

    if (scoreNum > maxScoreNum) {
      Alert.alert('Erreur', 'La note ne peut pas être supérieure à la note maximale');
      return;
    }

    setIsSubmitting(true);
    try {
      const grade = await createGrade.mutateAsync({
        ...formData,
        score: scoreNum,
        maxScore: maxScoreNum,
        coefficient: parseFloat(formData.coefficient),
        weight: 1,
      });

      await submitGrade.mutateAsync({ id: grade.id });

      Alert.alert('Succès', 'Note soumise pour validation', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de soumettre la note');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Saisie de Note</Text>
        <Text style={styles.subtitle}>Enregistrez une note pour un élève</Text>
      </View>

      <View style={styles.content}>
        {/* School ID */}
        <View style={styles.field}>
          <Text style={styles.label}>École *</Text>
          <TextInput
            style={styles.input}
            placeholder="ID de l'école"
            value={formData.schoolId}
            onChangeText={(v) => handleInputChange('schoolId', v)}
          />
        </View>

        {/* Academic Year */}
        <View style={styles.field}>
          <Text style={styles.label}>Année Scolaire *</Text>
          <TextInput
            style={styles.input}
            placeholder="ID de l'année scolaire"
            value={formData.academicYearId}
            onChangeText={(v) => handleInputChange('academicYearId', v)}
          />
        </View>

        {/* Period */}
        <View style={styles.field}>
          <Text style={styles.label}>Période *</Text>
          <TextInput
            style={styles.input}
            placeholder="ID de la période (trimestre)"
            value={formData.periodId}
            onChangeText={(v) => handleInputChange('periodId', v)}
          />
        </View>

        {/* Class Selection */}
        <View style={styles.field}>
          <Text style={styles.label}>Classe *</Text>
          <TextInput
            style={styles.input}
            placeholder="Sélectionnez une classe"
            value={formData.classId}
            onChangeText={(v) => handleInputChange('classId', v)}
          />
        </View>

        {/* Subject Selection */}
        <View style={styles.field}>
          <Text style={styles.label}>Matière *</Text>
          <TextInput
            style={styles.input}
            placeholder="Sélectionnez une matière"
            value={formData.subjectId}
            onChangeText={(v) => handleInputChange('subjectId', v)}
          />
        </View>

        {/* Student Selection */}
        <View style={styles.field}>
          <Text style={styles.label}>Élève *</Text>
          <TextInput
            style={styles.input}
            placeholder="Sélectionnez un élève"
            value={formData.studentId}
            onChangeText={(v) => handleInputChange('studentId', v)}
          />
        </View>

        {/* Grade Type */}
        <View style={styles.field}>
          <Text style={styles.label}>Type de Note *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Devoir, Examen"
            value={formData.gradeType}
            onChangeText={(v) => handleInputChange('gradeType', v)}
          />
        </View>

        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.label}>Titre *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Devoir maison n°1"
            value={formData.title}
            onChangeText={(v) => handleInputChange('title', v)}
          />
        </View>

        {/* Score and Max Score */}
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Note *</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="15"
              value={formData.score}
              onChangeText={(v) => handleInputChange('score', v)}
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Max</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="20"
              value={formData.maxScore}
              onChangeText={(v) => handleInputChange('maxScore', v)}
            />
          </View>
        </View>

        {/* Coefficient */}
        <View style={styles.field}>
          <Text style={styles.label}>Coefficient</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="1"
            value={formData.coefficient}
            onChangeText={(v) => handleInputChange('coefficient', v)}
          />
        </View>

        {/* Comments */}
        <View style={styles.field}>
          <Text style={styles.label}>Commentaires</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Observations..."
            value={formData.comments}
            onChangeText={(v) => handleInputChange('comments', v)}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleSaveDraft}
            disabled={createGrade.isPending}
          >
            <Text style={styles.buttonSecondaryText}>Enregistrer Brouillon</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.buttonPrimaryText}>
              {isSubmitting ? 'Soumission...' : 'Soumettre'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#3b82f6',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    padding: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  actions: {
    marginTop: 24,
    gap: 12,
  },
  button: {
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#3b82f6',
  },
  buttonPrimaryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  buttonSecondaryText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
});
