"use client";

import { useState, useMemo } from "react";
import {
  useAuth,
  useStudentsWithPhotos,
  useAcademicYears,
  useLevels,
  useClasses,
} from "@novaconnect/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, User, FileText } from "lucide-react";

import { GenerateAdminDocumentsDialog } from "./components/GenerateAdminDocumentsDialog";

export default function AdminDocumentsPage() {
  const { user } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [academicYearFilter, setAcademicYearFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Filters Options
  const { data: academicYears } = useAcademicYears(user?.schoolId || "");
  const { data: levels } = useLevels(user?.schoolId || "");
  const { data: allClasses } = useClasses(
    user?.schoolId || "",
    academicYearFilter !== "all" ? academicYearFilter : undefined
  );

  // Fetch students
  const { data: students, isLoading: isLoadingStudents } = useStudentsWithPhotos(
    user?.schoolId || "",
    {
      status: statusFilter !== "all" ? statusFilter : undefined,
      classId: classFilter !== "all" ? classFilter : undefined,
    }
  );

  // Search Logic
  const filteredStudents = useMemo(() => {
    if (!students) return [];

    return students.filter((student: any) => {
      const matchesSearch =
        !searchQuery ||
        student.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.matricule?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${student.firstName} ${student.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesLevel = true;
      if (levelFilter !== "all" && student.enrollments) {
        matchesLevel = student.enrollments.some((e: any) =>
          e.class?.levelId === levelFilter
        );
      } else if (levelFilter !== "all") {
        matchesLevel = false;
      }

      let matchesClass = true;
      if (classFilter !== "all" && student.enrollments) {
        matchesClass = student.enrollments.some((e: any) =>
          e.classId === classFilter
        );
      } else if (classFilter !== "all") {
        matchesClass = false;
      }

      let matchesAcademicYear = true;
      if (academicYearFilter !== "all" && student.enrollments) {
        matchesAcademicYear = student.enrollments.some((e: any) =>
          e.academicYearId === academicYearFilter
        );
      } else if (academicYearFilter !== "all") {
        matchesAcademicYear = false;
      }

      return matchesSearch && matchesLevel && matchesClass && matchesAcademicYear;
    });
  }, [students, searchQuery, levelFilter, classFilter, academicYearFilter]);

  const openDocumentsDialog = (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-blue-900 border-b-2 border-blue-200 pb-2 flex items-center gap-3">
             <FileText className="h-8 w-8 text-blue-600" />
             Édition des Documents
          </h1>
          <p className="text-muted-foreground mt-2">
            Recherchez un élève pour générer ses relevés, bulletins ou certificats.
          </p>
        </div>
      </div>

      <Card className="border-blue-100 shadow-sm">
        <CardHeader className="bg-slate-50 border-b border-slate-100">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
              <Search className="h-4 w-4" /> Filtres de recherche
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Rechercher par nom, prénom ou matricule..."
                  className="pl-9 bg-slate-50/50 border-slate-200"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <Select
              value={academicYearFilter}
              onValueChange={(value) => {
                setAcademicYearFilter(value);
                setClassFilter("all");
                setLevelFilter("all");
              }}
            >
              <SelectTrigger className="bg-slate-50/50">
                <SelectValue placeholder="Année scolaire" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les années</SelectItem>
                {academicYears?.map((year: any) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="bg-slate-50/50">
                <SelectValue placeholder="Niveau" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les niveaux</SelectItem>
                {levels?.map((level: any) => (
                  <SelectItem key={level.id} value={level.id}>
                    {level.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="bg-slate-50/50">
                <SelectValue placeholder="Classe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les classes</SelectItem>
                {allClasses?.map((cls: any) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name} - {cls.level?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-4 mt-4">
             <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px] bg-slate-50/50">
                <SelectValue placeholder="Statut Élève" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="active">Actifs (Inscrits)</SelectItem>
                <SelectItem value="inactive">Inactifs</SelectItem>
                <SelectItem value="expelled">Exclus</SelectItem>
                <SelectItem value="dropped">Abandon</SelectItem>
              </SelectContent>
            </Select>
            
            {(searchQuery || academicYearFilter !== "all" || levelFilter !== "all" || classFilter !== "all" || statusFilter !== "active") && (
              <Button
                variant="ghost"
                className="text-slate-500 hover:text-slate-700"
                onClick={() => {
                  setSearchQuery("");
                  setAcademicYearFilter("all");
                  setLevelFilter("all");
                  setClassFilter("all");
                  setStatusFilter("active");
                }}
              >
                Réinitialiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-100 shadow-sm">
        <CardContent className="p-0">
          {isLoadingStudents ? (
            <div className="text-center py-12 text-slate-500">
               <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
               <p className="mt-4">Chargement des élèves...</p>
            </div>
          ) : !filteredStudents || filteredStudents.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <User className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              Aucun élève trouvé pour ces critères de recherche.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left p-4 font-semibold text-slate-600">Élève ({filteredStudents.length})</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Matricule</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Classe</th>
                    <th className="text-right p-4 font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student: any) => (
                     <tr key={student.id} className="border-b hover:bg-blue-50/30 transition-colors">
                       <td className="p-4">
                         <div className="flex items-center gap-3">
                           {student.photoUrl ? (
                             <img
                               src={student.photoUrl}
                               alt={student.firstName}
                               className="w-10 h-10 rounded-full object-cover border border-slate-200"
                             />
                           ) : (
                             <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                               <User className="h-5 w-5 text-slate-400" />
                             </div>
                           )}
                           <div>
                             <div className="font-semibold text-slate-800">
                               {student.firstName} {student.lastName}
                             </div>
                           </div>
                         </div>
                       </td>
                       <td className="p-4 text-slate-600 font-medium">
                           {student.matricule || "-"}
                       </td>
                       <td className="p-4">
                         {student.enrollments?.map((e: any) => (
                           <div key={e.id} className="text-sm font-medium text-slate-700">
                             {e.class?.name}
                             {e.class?.level && (
                               <span className="text-slate-500 text-xs font-normal"> ({e.class.level.name})</span>
                             )}
                           </div>
                         )) || <span className="text-slate-400 italic">Non assigné</span>}
                       </td>
                       <td className="p-4 text-right">
                          <Button
                             variant="default"
                             className="bg-blue-600 hover:bg-blue-700 shadow-sm"
                             onClick={() => openDocumentsDialog(student.id)}
                          >
                             <FileText className="h-4 w-4 mr-2" />
                             Gérer les Documents
                          </Button>
                       </td>
                     </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Modale Centralisée de Génération de Documents */}
      <GenerateAdminDocumentsDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        studentId={selectedStudentId}
        schoolId={user?.schoolId || ""}
      />
      
    </div>
  );
}
