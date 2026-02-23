"use client";

import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAuth,
  useStudentCards,
  useStudentCardStatistics,
  useDownloadStudentCardPdf,
  useRevokeStudentCard,
  useStudentsWithPhotos,
  useAcademicYears,
  useLevels,
  useClasses,
} from "@novaconnect/data";
import { useGenerateStudentCardsBatchClient } from "@/hooks/useGenerateStudentCardClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { UploadPhotoDialog } from "@/components/student-cards/UploadPhotoDialog";
import { Download, IdCard, RefreshCw, Search, Camera, User } from "lucide-react";
import { format } from "date-fns";

export default function StudentCardsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [academicYearFilter, setAcademicYearFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  
  // État pour le dialogue d'upload photo
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedStudentForPhoto, setSelectedStudentForPhoto] = useState<{id: string, name: string} | null>(null);

  // Fetch all filter options
  const { data: academicYears } = useAcademicYears(user?.schoolId || "");
  const { data: levels } = useLevels(user?.schoolId || "");
  const { data: allClasses } = useClasses(
    user?.schoolId || "",
    academicYearFilter || undefined
  );

  // Fetch students with filters and photos
  const { data: students, isLoading: isLoadingStudents, refetchPhotos } = useStudentsWithPhotos(
    user?.schoolId || "",
    {
      status: statusFilter !== "all" ? statusFilter : undefined,
      classId: classFilter || undefined,
    }
  );

  // Get existing cards
  const { data: cards } = useStudentCards(user?.schoolId || "", {
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const { data: statistics } = useStudentCardStatistics(user?.schoolId || "");

  const generateBatch = useGenerateStudentCardsBatchClient();
  const downloadPdf = useDownloadStudentCardPdf();
  const revokeCard = useRevokeStudentCard();

  // Filter students based on search query and filters
  const filteredStudents = useMemo(() => {
    if (!students) return [];

    return students.filter((student: any) => {
      const matchesSearch =
        !searchQuery ||
        student.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.matricule?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${student.firstName} ${student.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());

      // Filter by level (if selected)
      let matchesLevel = true;
      if (levelFilter !== "all" && student.enrollments) {
        matchesLevel = student.enrollments.some((e: any) =>
          e.class?.levelId === levelFilter
        );
      } else if (levelFilter !== "all") {
        matchesLevel = false;
      }

      // Filter by class (if selected)
      let matchesClass = true;
      if (classFilter !== "all" && student.enrollments) {
        matchesClass = student.enrollments.some((e: any) =>
          e.classId === classFilter
        );
      } else if (classFilter !== "all") {
        matchesClass = false;
      }

      // Filter by academic year (if selected)
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

  // Check if a student is selected
  const isStudentSelected = (studentId: string) => selectedStudentIds.includes(studentId);

  // Check if all filtered students are selected
  const areAllSelected = filteredStudents.length > 0 &&
    filteredStudents.every((s: any) => selectedStudentIds.includes(s.id));

  // Toggle select all
  const toggleSelectAll = () => {
    if (areAllSelected) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map((s: any) => s.id));
    }
  };

  // Toggle select individual student
  const toggleSelectStudent = (studentId: string) => {
    if (isStudentSelected(studentId)) {
      setSelectedStudentIds(prev => prev.filter(id => id !== studentId));
    } else {
      setSelectedStudentIds(prev => [...prev, studentId]);
    }
  };

  // Handle batch generation
  const handleGenerateBatch = async (studentIds?: string[]) => {
    const idsToGenerate = studentIds || selectedStudentIds;

    if (idsToGenerate.length === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner au moins un élève",
        variant: "destructive",
      });
      return;
    }

    // La génération PDF est maintenant gérée côté client dans le hook
    await generateBatch.mutateAsync({
      schoolId: user?.schoolId || "",
      studentIds: idsToGenerate,
    });

    // Clear selection after generation
    if (!studentIds) {
      setSelectedStudentIds([]);
    }
  };

  // Get card for a student
  const getStudentCard = (studentId: string) => {
    return cards?.find((c: any) => c.studentId === studentId);
  };

  const handleDownload = async (cardId: string) => {
    try {
      const result = await downloadPdf.mutateAsync(cardId);

      if (result.signedUrl) {
        window.open(result.signedUrl, "_blank");
      }

      toast({
        title: "Téléchargement",
        description: "Carte téléchargée avec succès",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Échec du téléchargement",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      expired: "secondary",
      revoked: "destructive",
      lost: "outline",
    };

    const labels: Record<string, string> = {
      active: "Active",
      expired: "Expirée",
      revoked: "Révoquée",
      lost: "Perdue",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cartes Scolaires</h1>
          <p className="text-muted-foreground">
            Gérer les cartes scolaires des élèves
          </p>
        </div>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total cartes</CardTitle>
              <IdCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Actives</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{statistics.active}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expirées</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{statistics.expired}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Révoquées</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{statistics.revoked}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {/* Search */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, prénom ou matricule..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Academic Year Filter */}
            <Select
              value={academicYearFilter}
              onValueChange={(value) => {
                setAcademicYearFilter(value);
                setClassFilter("all"); // Reset class filter when academic year changes
                setLevelFilter("all"); // Reset level filter
              }}
            >
              <SelectTrigger>
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

            {/* Level Filter */}
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger>
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

            {/* Class Filter */}
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger>
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

          {/* Additional filters row */}
          <div className="flex gap-4 mt-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Statut de carte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">Actives</SelectItem>
                <SelectItem value="expired">Expirées</SelectItem>
                <SelectItem value="revoked">Révoquées</SelectItem>
                <SelectItem value="lost">Perdues</SelectItem>
              </SelectContent>
            </Select>

            {(searchQuery || academicYearFilter !== "all" || levelFilter !== "all" || classFilter !== "all" || statusFilter !== "all") && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setAcademicYearFilter("all");
                  setLevelFilter("all");
                  setClassFilter("all");
                  setStatusFilter("all");
                  setSelectedStudentIds([]);
                }}
              >
                Réinitialiser les filtres
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Students Table with Batch Generation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Liste des élèves</CardTitle>
            <div className="flex gap-2">
              {selectedStudentIds.length > 0 && (
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  {selectedStudentIds.length} sélectionné(s)
                </Badge>
              )}
              <Button
                onClick={() => handleGenerateBatch()}
                disabled={selectedStudentIds.length === 0 || generateBatch.isPending}
              >
                <IdCard className="mr-2 h-4 w-4" />
                Générer {selectedStudentIds.length > 0 ? `(${selectedStudentIds.length})` : ""}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingStudents ? (
            <div className="text-center py-8">Chargement...</div>
          ) : !filteredStudents || filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun élève trouvé
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 w-12">
                      <Checkbox
                        checked={areAllSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Tout sélectionner"
                      />
                    </th>
                    <th className="text-left p-4">Élève</th>
                    <th className="text-left p-4">Matricule</th>
                    <th className="text-left p-4">Classe</th>
                    <th className="text-left p-4">Statut carte</th>
                    <th className="text-left p-4">Date d&apos;émission</th>
                    <th className="text-left p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student: any) => {
                    const card = getStudentCard(student.id);
                    return (
                      <tr key={student.id} className="border-b hover:bg-muted/50">
                        <td className="p-4">
                          <Checkbox
                            checked={isStudentSelected(student.id)}
                            onCheckedChange={() => toggleSelectStudent(student.id)}
                            aria-label={`Sélectionner ${student.firstName} ${student.lastName}`}
                          />
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {student.photoUrl ? (
                              <img
                                src={student.photoUrl}
                                alt={student.firstName}
                                className="w-10 h-10 rounded-full object-cover border"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border">
                                <User className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <div className="font-medium">
                                {student.firstName} {student.lastName}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {student.enrollments?.map((e: any) => e.class?.name).join(", ") || "-"}
                              </div>
                              {!student.photoUrl && (
                                <div className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                                  <Camera className="h-3 w-3" />
                                  Photo manquante
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">{student.matricule || "-"}</td>
                        <td className="p-4">
                          {student.enrollments?.map((e: any) => (
                            <div key={e.id} className="text-sm">
                              {e.class?.name}
                              {e.class?.level && (
                                <span className="text-muted-foreground"> ({e.class.level.name})</span>
                              )}
                            </div>
                          )) || "-"}
                        </td>
                        <td className="p-4">
                          {card ? getStatusBadge(card.status) : (
                            <Badge variant="outline">Non générée</Badge>
                          )}
                        </td>
                        <td className="p-4">
                          {card ? format(new Date(card.issueDate), "dd/MM/yyyy") : "-"}
                        </td>
                        <td className="p-4">
                          <div className="flex gap-1">
                            {/* Bouton Ajouter Photo si pas de photo */}
                            {!student.photoUrl && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => {
                                  setSelectedStudentForPhoto({
                                    id: student.id,
                                    name: `${student.firstName} ${student.lastName}`
                                  });
                                  setUploadDialogOpen(true);
                                }}
                                title="Ajouter une photo"
                              >
                                <Camera className="h-4 w-4" />
                              </Button>
                            )}
                            
                            {card ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDownload(card.id)}
                                  disabled={!card.pdfUrl || card.status === "revoked"}
                                  title="Télécharger PDF"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleGenerateBatch([student.id])}
                                  disabled={generateBatch.isPending}
                                  title="Régénérer la carte"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleGenerateBatch([student.id])}
                                disabled={generateBatch.isPending || !student.photoUrl}
                                title={student.photoUrl ? "Générer la carte" : "Photo requise pour générer"}
                              >
                                <IdCard className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Dialogue d'upload de photo */}
      <UploadPhotoDialog
        studentId={selectedStudentForPhoto?.id || ""}
        studentName={selectedStudentForPhoto?.name || ""}
        isOpen={uploadDialogOpen}
        onClose={() => {
          setUploadDialogOpen(false);
          setSelectedStudentForPhoto(null);
        }}
        onSuccess={() => {
          // Rafraîchir la liste des élèves pour voir la nouvelle photo
          queryClient.invalidateQueries({ queryKey: ["students"] });
          refetchPhotos();
          toast({
            title: "Photo ajoutée",
            description: "Vous pouvez maintenant générer la carte scolaire",
          });
        }}
      />
    </div>
  );
}
