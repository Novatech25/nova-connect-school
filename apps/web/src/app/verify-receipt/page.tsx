import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = {
  token?: string | string[];
};

function getBaseUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_PUBLIC_URL;
  if (appUrl) {
    return appUrl.replace(/\/$/, "");
  }
  const headerList = headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") || "http";
  if (host) {
    return `${proto}://${host}`;
  }
  return "http://localhost:3001";
}

export default async function VerifyReceiptPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const rawToken = Array.isArray(searchParams.token)
    ? searchParams.token[0]
    : searchParams.token;

  if (!rawToken) {
    return (
      <div className="min-h-screen bg-white px-6 py-16">
        <div className="mx-auto max-w-xl rounded-xl border border-gray-200 p-6">
          <h1 className="text-xl font-semibold text-gray-900">Verification du recu</h1>
          <p className="mt-4 text-sm text-gray-600">Lien invalide : token manquant.</p>
        </div>
      </div>
    );
  }

  const baseUrl = getBaseUrl();
  let data: any = null;
  try {
    const response = await fetch(
      `${baseUrl}/api/verify-receipt?token=${encodeURIComponent(rawToken)}`,
      { cache: "no-store" }
    );
    data = await response.json().catch(() => null);
  } catch (error) {
    return (
      <div className="min-h-screen bg-white px-6 py-16">
        <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-900">Verification du recu</h1>
          <p className="mt-3 text-sm text-red-700">
            Echec de connexion au serveur de verification.
          </p>
          <p className="mt-2 text-xs text-red-600">
            Verifie que l'application tourne bien sur {baseUrl}.
          </p>
        </div>
      </div>
    );
  }

  const success = data?.success === true;
  const status = data?.receipt?.status || "unknown";
  const details = data?.receipt?.details || {};
  const isCancelled = status === "cancelled";

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Verification du recu</h1>
        <p className="mt-2 text-sm text-gray-500">
          Resultat de la verification en ligne.
        </p>

        <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 p-6">
          <div
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              success ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {success ? (isCancelled ? "Recu annule" : "Recu valide") : "Recu invalide"}
          </div>

          {success ? (
            <div className="mt-4 space-y-2 text-sm text-gray-700">
              <div>
                <span className="font-semibold">Numero:</span>{" "}
                {data?.receipt?.receipt_number || "N/A"}
              </div>
              <div>
                <span className="font-semibold">Ecole:</span>{" "}
                {details?.school_name || data?.receipt?.school_id || "N/A"}
              </div>
              {details?.student_name && (
                <div>
                  <span className="font-semibold">Eleve:</span> {details.student_name}
                </div>
              )}
              {details?.student_matricule && (
                <div>
                  <span className="font-semibold">Matricule:</span> {details.student_matricule}
                </div>
              )}
              {details?.teacher_name && (
                <div>
                  <span className="font-semibold">Enseignant:</span> {details.teacher_name}
                </div>
              )}
              {details?.amount !== undefined && (
                <div>
                  <span className="font-semibold">Montant:</span> {details.amount} FCFA
                </div>
              )}
              {details?.payment_date && (
                <div>
                  <span className="font-semibold">Date:</span> {details.payment_date}
                </div>
              )}
              {details?.fee_type && (
                <div>
                  <span className="font-semibold">Frais:</span> {details.fee_type}
                </div>
              )}
              {details?.period && (
                <div>
                  <span className="font-semibold">Periode:</span> {details.period}
                </div>
              )}
              <div>
                <span className="font-semibold">Statut:</span>{" "}
                {isCancelled ? "ANNULE" : status}
              </div>
              <div>
                <span className="font-semibold">Type:</span> {data?.receipt?.type || "N/A"}
              </div>
              {data?.receipt?.short_code && (
                <div>
                  <span className="font-semibold">Code:</span> {data.receipt.short_code}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-600">
              {data?.message || "Verification impossible."}
            </div>
          )}
        </div>

        <p className="mt-6 text-xs text-gray-400">
          NovaConnectSchool - verification officielle des recus.
        </p>
      </div>
    </div>
  );
}
