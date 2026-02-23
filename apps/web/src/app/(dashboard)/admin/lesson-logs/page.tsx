import { Metadata } from 'next';
import LessonLogsClient from './LessonLogsClient';

export const metadata: Metadata = {
  title: 'Validation des séances | NovaConnect',
  description: 'Valider les séances enregistrées par les enseignants',
};

export default function AdminLessonLogsPage() {
  return <LessonLogsClient />;
}
