'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { useAuthContext } from '@novaconnect/data/providers';
import { SchoolInfoTab } from './components/SchoolInfoTab';
import { AcademicYearsTab } from './components/AcademicYearsTab';
import { LevelsTab } from './components/LevelsTab';
import { ClassesTab } from './components/ClassesTab';
import { SubjectCategoriesTab } from './components/SubjectCategoriesTab';
import { SubjectsTab } from './components/SubjectsTab';
import { PeriodsTab } from './components/PeriodsTab';
import { GradingScalesTab } from './components/GradingScalesTab';
import { CampusesTab } from './components/CampusesTab';
import { RoomsTab } from './components/RoomsTab';
import { TeacherAssignmentsTab } from './components/TeacherAssignmentsTab';
import { GpsConfigTab } from './components/GpsConfigTab';
import { QrConfigTab } from './components/QrConfigTab';
import { PaymentConfigTab } from './components/PaymentConfigTab';
import { AttendanceFusionTab } from './components/AttendanceFusionTab';
import { ImportConfigTab } from './components/ImportConfigTab';
import { CanteenConfigTab } from './components/CanteenConfigTab';
import { RoomAssignmentConfigTab } from './components/RoomAssignmentConfigTab';

  export default function SchoolSettingsPage() {
  const { profile, user } = useAuthContext();
  const schoolId =
    profile?.school?.id ??
    profile?.school_id ??
    user?.schoolId ??
    (user as any)?.school_id;
  if (!schoolId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Paramètres de l'école</h1>
          <p className="text-gray-600 mt-2">
            Configuration complète de votre établissement
          </p>
        </div>
        <Card className="p-6">
          <p className="text-red-600">Impossible de charger l'ID de l'école. Veuillez vous reconnecter.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Paramètres de l'école</h1>
        <p className="text-gray-600 mt-2">
          Configuration complète de votre établissement
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="flex flex-wrap gap-2 w-full h-auto">
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="academic-years">Années</TabsTrigger>
          <TabsTrigger value="levels">Niveaux</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="subject-categories">Unités d'Enseignement</TabsTrigger>
          <TabsTrigger value="subjects">Matières</TabsTrigger>
          <TabsTrigger value="periods">Périodes</TabsTrigger>
          <TabsTrigger value="grading">Barèmes</TabsTrigger>
          <TabsTrigger value="campuses">Campus</TabsTrigger>
          <TabsTrigger value="rooms">Salles</TabsTrigger>
          <TabsTrigger value="room-assignment">Attrib. Salles</TabsTrigger>
          <TabsTrigger value="assignments">Affectations</TabsTrigger>
          <TabsTrigger value="gps">GPS</TabsTrigger>
          <TabsTrigger value="qr">QR Code</TabsTrigger>
          <TabsTrigger value="fusion">Fusion</TabsTrigger>
          <TabsTrigger value="payments">Paiements</TabsTrigger>
          <TabsTrigger value="imports">Imports</TabsTrigger>
          <TabsTrigger value="canteen">Cantine</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <SchoolInfoTab schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="academic-years">
          <AcademicYearsTab schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="levels">
          <LevelsTab schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="classes">
          <ClassesTab schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="subject-categories">
          <SubjectCategoriesTab schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="subjects">
          <SubjectsTab schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="periods">
          <PeriodsTab schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="grading">
          <GradingScalesTab schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="campuses">
          <CampusesTab schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="rooms">
          <RoomsTab schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="assignments">
          <TeacherAssignmentsTab schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="room-assignment">
          <RoomAssignmentConfigTab schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="gps">
          <GpsConfigTab schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="qr">
          <QrConfigTab schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="fusion">
          <AttendanceFusionTab schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentConfigTab schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="imports">
          <ImportConfigTab schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="canteen">
          <CanteenConfigTab schoolId={schoolId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}





