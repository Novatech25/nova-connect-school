"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  generateStudentCardPDF,
  generateMultipleStudentCardsPDF,
  downloadStudentCardPDF,
} from "@/lib/studentCardPdfGenerator";
import { getSupabaseClient } from "@novaconnect/data";

interface GenerateCardData {
  studentId: string;
  templateId?: string;
  regenerate?: boolean;
}

interface GenerateBatchData {
  schoolId: string;
  studentIds: string[];
  templateId?: string;
}

interface CardResponse {
  success: boolean;
  card: {
    id: string;
    qr_code_data: string;
    qr_code_signature: string;
    issue_date?: string;
  };
  student: {
    first_name: string;
    last_name: string;
    matricule?: string;
    photo_url?: string;
    class_id?: string;
    date_of_birth?: string;
    gender?: string;
    address?: string;
    city?: string;
  };
  school: {
    name: string;
    logo_url?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
  };
  studentClass?: {
    id?: string;
    name: string;
    level?: string;
  };
  template?: {
    layout_config?: any;
    logo_url?: string;
  };
  qrData: string;
  signature: string;
  message?: string;
}

/**
 * Récupère le token d'accès Supabase
 * Essaye d'abord getSession(), puis fallback sur localStorage
 */
async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabaseClient();

  // Essayer de récupérer la session via Supabase
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    console.log("Token récupéré via getSession()");
    return session.access_token;
  }

  // Fallback: chercher dans localStorage
  if (typeof window !== 'undefined') {
    // Chercher la clé sb-*-auth-token
    const storageKeys = Object.keys(window.localStorage);
    const supabaseKey = storageKeys.find((key) =>
      key.startsWith('sb-') && key.endsWith('-auth-token')
    );

    if (supabaseKey) {
      try {
        const raw = window.localStorage.getItem(supabaseKey);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed?.access_token) {
          console.log("Token récupéré via localStorage");
          return parsed.access_token;
        }
      } catch (e) {
        console.error("Erreur parsing token localStorage:", e);
      }
    }

    // Essayer offline_auth_tokens
    const rawTokens = window.localStorage.getItem('offline_auth_tokens');
    if (rawTokens) {
      try {
        const parsed = JSON.parse(rawTokens);
        if (parsed?.access_token) {
          console.log("Token récupéré via offline_auth_tokens");
          return parsed.access_token;
        }
      } catch (e) {
        console.error("Erreur parsing offline tokens:", e);
      }
    }
  }

  return null;
}

/**
 * Résout les infos de classe à partir de la réponse de l'Edge Function
 */
function resolveClassInfo(result: CardResponse): { name: string; level: string } | undefined {
  let studentClassData = result.studentClass;
  if (Array.isArray(studentClassData)) {
    studentClassData = studentClassData[0];
  }
  if (studentClassData) {
    return {
      name: studentClassData.name,
      level: studentClassData.level || ''
    };
  }
  return undefined;
}

/**
 * Fallback: récupère les infos de classe via Supabase si l'Edge Function ne les a pas retournées
 */
async function resolveClassInfoFallback(classId: string): Promise<{ name: string; level: string } | undefined> {
  const supabase = getSupabaseClient();
  const { data: classData } = await supabase
    .from('classes')
    .select('name, level:levels(name)')
    .eq('id', classId)
    .single();
  if (classData) {
    return {
      name: classData.name,
      level: classData.level?.name || ''
    };
  }
  return undefined;
}

/**
 * Hook pour générer une carte étudiant avec PDF côté client
 */
export function useGenerateStudentCardClient() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: GenerateCardData): Promise<CardResponse> => {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error("Non authentifié - Veuillez vous reconnecter");
      }

      console.log("Envoi requête avec token:", accessToken.substring(0, 20) + "...");

      const response = await fetch("/api/proxy/generate-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Erreur lors de la génération");
      }

      return response.json();
    },
    onSuccess: async (data) => {
      if (!data.success) {
        toast({
          title: "Erreur",
          description: data.message || "Échec de la génération",
          variant: "destructive",
        });
        return;
      }

      try {
        // Normaliser school (peut être tableau)
        let schoolData = data.school;
        if (Array.isArray(schoolData)) {
          schoolData = schoolData[0];
        }

        // Mettre à jour data.school avec l'objet normalisé
        data.school = schoolData || data.school;

        // Résoudre classInfo
        let classInfo = resolveClassInfo(data);
        if (!classInfo && data.student.class_id) {
          classInfo = await resolveClassInfoFallback(data.student.class_id);
        }

        // Générer le PDF côté client avec les infos de classe
        console.log('Generating PDF with classInfo:', classInfo);
        const pdfBlob = await generateStudentCardPDF(data, classInfo);

        // Télécharger le PDF
        const filename = `carte-${data.student.matricule || data.student.last_name}-${data.student.first_name}.pdf`;
        downloadStudentCardPDF(pdfBlob, filename);

        toast({
          title: "Carte générée",
          description: `Carte de ${data.student.first_name} ${data.student.last_name} téléchargée`,
        });

        // Rafraîchir les données
        queryClient.invalidateQueries({ queryKey: ["student_cards"] });
      } catch (error: any) {
        console.error("Erreur génération PDF:", error);
        toast({
          title: "Carte créée",
          description:
            "Données enregistrées mais erreur lors de la génération du PDF",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error?.message || "Échec de la génération",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook pour générer plusieurs cartes avec PDF multi-cartes A4
 * - Si 1 seule carte → PDF individuel format carte
 * - Si plusieurs cartes → PDF A4 avec grille 2×5 (10 cartes/page)
 */
export function useGenerateStudentCardsBatchClient() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: GenerateBatchData) => {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error("Non authentifié - Veuillez vous reconnecter");
      }

      const results: any[] = [];
      const successfulCards: { data: CardResponse; classInfo?: { name: string; level: string } }[] = [];

      for (const studentId of data.studentIds) {
        try {
          const response = await fetch("/api/proxy/generate-card", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              studentId,
              templateId: data.templateId,
            }),
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            results.push({
              studentId,
              success: false,
              error: error.error || `HTTP ${response.status}`,
            });
            continue;
          }

          const result = await response.json();

          if (result.success) {
            // Normaliser school
            let schoolData = result.school;
            if (Array.isArray(schoolData)) {
              schoolData = schoolData[0];
            }
            result.school = schoolData || result.school;

            // Résoudre classInfo
            let classInfo = resolveClassInfo(result);
            if (!classInfo && result.student.class_id) {
              classInfo = await resolveClassInfoFallback(result.student.class_id);
            }

            successfulCards.push({ data: result, classInfo });
            results.push({
              studentId,
              success: true,
              data: result,
            });
          } else {
            results.push({
              studentId,
              success: false,
              error: result.message || "Échec",
            });
          }
        } catch (error: any) {
          results.push({
            studentId,
            success: false,
            error: error.message || "Erreur inconnue",
          });
        }
      }

      // Générer le PDF
      if (successfulCards.length > 0) {
        try {
          let pdfBlob: Blob;
          let filename: string;

          if (successfulCards.length === 1) {
            // Une seule carte → format carte individuelle
            const entry = successfulCards[0];
            if (!entry) throw new Error("Erreur inattendue: données de carte manquantes");

            pdfBlob = await generateStudentCardPDF(entry.data, entry.classInfo);
            const s = entry.data.student;
            filename = `carte-${s.matricule || s.last_name}-${s.first_name}.pdf`;
          } else {
            // Plusieurs cartes → PDF A4 multi-cartes
            pdfBlob = await generateMultipleStudentCardsPDF(successfulCards);
            filename = `cartes-scolaires-${successfulCards.length}-eleves.pdf`;
          }

          downloadStudentCardPDF(pdfBlob, filename);
        } catch (pdfError: any) {
          console.error("Erreur génération PDF multi-cartes:", pdfError);
          results.push({
            studentId: 'batch-pdf',
            success: false,
            error: `Erreur PDF: ${pdfError.message}`,
          });
        }
      }

      return results;
    },
    onSuccess: (results: any[]) => {
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      toast({
        title: "Génération terminée",
        description: `${successful} carte(s) générée(s)${failed > 0 ? `, ${failed} échec(s)` : ''} — PDF téléchargé`,
        variant: failed > successful ? "destructive" : "default",
      });

      queryClient.invalidateQueries({ queryKey: ["student_cards"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error?.message || "Échec de la génération",
        variant: "destructive",
      });
    },
  });
}
