import { headers } from 'next/headers';
import VerifyQr from './VerifyQr';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SearchParams = {
  id?: string | string[];
  studentId?: string | string[];
  periodId?: string | string[];
};

function getBaseUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_PUBLIC_URL;
  if (appUrl) {
    return appUrl.replace(/\/$/, '');
  }
  const headerList = headers();
  const host = headerList.get('x-forwarded-host') || headerList.get('host');
  const proto = headerList.get('x-forwarded-proto') || 'http';
  if (host) {
    return `${proto}://${host}`;
  }
  return 'http://localhost:3001';
}

export default async function VerifyReportCardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const rawId = Array.isArray(searchParams.id)
    ? searchParams.id[0]
    : searchParams.id;
  const rawStudentId = Array.isArray(searchParams.studentId)
    ? searchParams.studentId[0]
    : searchParams.studentId;
  const rawPeriodId = Array.isArray(searchParams.periodId)
    ? searchParams.periodId[0]
    : searchParams.periodId;

  if (!rawId && (!rawStudentId || !rawPeriodId)) {
    return (
      <div className="min-h-screen bg-white px-6 py-16">
        <div className="mx-auto max-w-xl rounded-xl border border-gray-200 p-6">
          <h1 className="text-xl font-semibold text-gray-900">
            Verification du bulletin
          </h1>
          <p className="mt-4 text-sm text-gray-600">
            Lien invalide : identifiant manquant.
          </p>
        </div>
      </div>
    );
  }

  const baseUrl = getBaseUrl();
  const query = rawId
    ? `id=${encodeURIComponent(rawId)}`
    : `studentId=${encodeURIComponent(rawStudentId || '')}&periodId=${encodeURIComponent(
        rawPeriodId || ''
      )}`;

  let data: any = null;
  try {
    const response = await fetch(`${baseUrl}/api/verify-report-card?${query}`, {
      cache: 'no-store',
    });
    data = await response.json().catch(() => null);
  } catch (error) {
    return (
      <div className="min-h-screen bg-white px-6 py-16">
        <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-900">
            Verification du bulletin
          </h1>
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
  const reportCard = data?.reportCard;
  const status = reportCard?.status || 'unknown';
  const statusLabel =
    status === 'published'
      ? 'Publie'
      : status === 'generated'
        ? 'Soumis'
        : status === 'draft'
          ? 'Brouillon'
          : status === 'archived'
            ? 'Archive'
            : status;

  const school = reportCard?.school;
  const student = reportCard?.student;
  const classInfo = reportCard?.class;
  const period = reportCard?.period;
  const verifiedAt = data?.verifiedAt ? new Date(data.verifiedAt) : null;
  const verifyUrl = `${baseUrl}/verify-report-card?${query}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 overflow-hidden rounded-full border border-white/20 bg-white/10">
              {school?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={school.logo_url}
                  alt="Logo ecole"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white/70">
                  LOGO
                </div>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-white/60">
                Verification officielle
              </p>
              <h1 className="text-2xl font-semibold">
                Bulletin scolaire
              </h1>
            </div>
          </div>

          <div
            className={`inline-flex items-center rounded-full px-4 py-1 text-xs font-semibold ${
              success ? 'bg-emerald-400/20 text-emerald-200' : 'bg-rose-400/20 text-rose-200'
            }`}
          >
            {success ? 'Bulletin valide' : 'Bulletin invalide'}
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-white/60">Ecole</p>
                <p className="text-lg font-semibold">
                  {school?.name || 'N/A'}
                </p>
              </div>
              {reportCard?.status === 'published' && (
                <div className="rounded-full border border-emerald-300/40 bg-emerald-400/15 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-100">
                  Publie
                </div>
              )}
            </div>

            {success ? (
              <div className="mt-5 space-y-3 text-sm text-white/80">
                {school?.address && (
                  <div>
                    <span className="font-semibold text-white/90">Adresse:</span>{' '}
                    {[school.address, school.city, school.country]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                )}
                {(school?.phone || school?.email) && (
                  <div>
                    <span className="font-semibold text-white/90">Contact:</span>{' '}
                    {[school.phone, school.email].filter(Boolean).join(' | ')}
                  </div>
                )}
                {student && (
                  <div>
                    <span className="font-semibold text-white/90">Eleve:</span>{' '}
                    {student.first_name} {student.last_name}
                  </div>
                )}
                {student?.matricule && (
                  <div>
                    <span className="font-semibold text-white/90">Matricule:</span>{' '}
                    {student.matricule}
                  </div>
                )}
                {classInfo?.name && (
                  <div>
                    <span className="font-semibold text-white/90">Classe:</span>{' '}
                    {classInfo.name}
                  </div>
                )}
                {period?.name && (
                  <div>
                    <span className="font-semibold text-white/90">Periode:</span>{' '}
                    {period.name}
                  </div>
                )}
                {reportCard?.overall_average !== undefined && (
                  <div>
                    <span className="font-semibold text-white/90">Moyenne:</span>{' '}
                    {Number(reportCard.overall_average).toFixed(2)}/20
                  </div>
                )}
                {reportCard?.mention && (
                  <div>
                    <span className="font-semibold text-white/90">Mention:</span>{' '}
                    {reportCard.mention}
                  </div>
                )}
                <div>
                  <span className="font-semibold text-white/90">Statut:</span> {statusLabel}
                </div>
                <div>
                  <span className="font-semibold text-white/90">Genere le:</span>{' '}
                  {reportCard?.generated_at
                    ? new Date(reportCard.generated_at).toLocaleDateString()
                    : 'N/A'}
                </div>
                {reportCard?.published_at && (
                  <div>
                    <span className="font-semibold text-white/90">Publie le:</span>{' '}
                    {new Date(reportCard.published_at).toLocaleDateString()}
                  </div>
                )}
                {verifiedAt && (
                  <div className="text-xs text-white/60">
                    Verifie le {verifiedAt.toLocaleString()}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 text-sm text-white/70">
                {data?.message || 'Verification impossible.'}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center justify-center">
            <VerifyQr value={verifyUrl} />
          </div>
        </div>

        <p className="mt-6 text-xs text-white/40">
          NovaConnectSchool - verification officielle des bulletins.
        </p>
      </div>
    </div>
  );
}
