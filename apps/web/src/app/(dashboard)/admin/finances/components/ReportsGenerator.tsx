'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Calendar, PieChart } from 'lucide-react';
import { usePayments, useFeeSchedules, useStudents, useSchool, useAcademicYears } from '@novaconnect/data';

interface ReportsGeneratorProps {
    schoolId: string;
    academicYearId: string;
}

const formatCurrency = (value: number) => {
    return `${Math.round(value).toLocaleString('fr-FR')} FCFA`;
};

const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
};

export function ReportsGenerator({ schoolId, academicYearId }: ReportsGeneratorProps) {
    const [generating, setGenerating] = useState<string | null>(null);

    const { data: payments = [] } = usePayments({ schoolId, academicYearId } as any);
    const { data: feeSchedules = [] } = useFeeSchedules({ schoolId, academicYearId } as any);
    const { data: students = [] } = useStudents(schoolId);
    const { school } = useSchool(schoolId);
    const { data: academicYears = [] } = useAcademicYears(schoolId);

    const currentYear = academicYears.find((y: any) => y.id === academicYearId);

    const reports = [
        {
            id: 'monthly',
            title: 'Rapport Mensuel',
            description: 'Revenus et dépenses du mois en cours',
            icon: Calendar,
            color: 'text-blue-600',
        },
        {
            id: 'annual',
            title: 'Rapport Annuel',
            description: 'Bilan financier de l\'année scolaire',
            icon: FileText,
            color: 'text-green-600',
        },
        {
            id: 'fee-type',
            title: 'Rapport par Type de Frais',
            description: 'Détail par scolarité, cantine, transport, etc.',
            icon: PieChart,
            color: 'text-purple-600',
        },
        {
            id: 'recovery',
            title: 'Rapport de Recouvrement',
            description: 'Taux de paiement par classe et niveau',
            icon: Calendar,
            color: 'text-orange-600',
        },
    ];

    const generateHTMLReport = (reportType: string) => {
        const totalCollected = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        const totalExpected = feeSchedules.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
        const collectionRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

        const currentDate = formatDate(new Date());
        const schoolName = school?.name || 'Établissement Scolaire';
        const schoolAddress = school?.address || '';
        const schoolPhone = school?.phone || '';
        const schoolEmail = school?.email || '';
        const yearName = currentYear?.name || 'Année Scolaire';

        let reportContent = '';
        let reportTitle = '';
        let reportSubtitle = '';

        switch (reportType) {
            case 'monthly':
                reportTitle = 'Rapport Mensuel des Finances';
                reportSubtitle = 'Analyse des revenus et transactions du mois';
                const currentMonth = new Date().getMonth();
                const monthlyPayments = payments.filter((p: any) => {
                    const date = new Date(p.paymentDate || p.payment_date);
                    return date.getMonth() === currentMonth;
                });
                const monthlyTotal = monthlyPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

                reportContent = `
                    <div class="summary-cards">
                        <div class="card blue">
                            <div class="card-label">Nombre de Paiements</div>
                            <div class="card-value">${monthlyPayments.length}</div>
                        </div>
                        <div class="card green">
                            <div class="card-label">Total Collecté</div>
                            <div class="card-value">${formatCurrency(monthlyTotal)}</div>
                        </div>
                        <div class="card purple">
                            <div class="card-label">Paiement Moyen</div>
                            <div class="card-value">${formatCurrency(monthlyPayments.length > 0 ? monthlyTotal / monthlyPayments.length : 0)}</div>
                        </div>
                    </div>

                    <h2>📊 Détails des Paiements</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Métrique</th>
                                <th class="text-right">Valeur</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>Transactions enregistrées</td><td class="text-right font-bold">${monthlyPayments.length}</td></tr>
                            <tr><td>Montant total collecté</td><td class="text-right font-bold text-green">${formatCurrency(monthlyTotal)}</td></tr>
                            <tr><td>Montant moyen par paiement</td><td class="text-right">${formatCurrency(monthlyPayments.length > 0 ? monthlyTotal / monthlyPayments.length : 0)}</td></tr>
                        </tbody>
                    </table>
                `;
                break;

            case 'annual':
                reportTitle = 'Rapport Annuel - Bilan Financier';
                reportSubtitle = `Exercice ${yearName}`;
                const remainingAmount = totalExpected - totalCollected;

                reportContent = `
                    <div class="summary-cards">
                        <div class="card blue">
                            <div class="card-label">Total Attendu</div>
                            <div class="card-value">${formatCurrency(totalExpected)}</div>
                        </div>
                        <div class="card green">
                            <div class="card-label">Total Collecté</div>
                            <div class="card-value">${formatCurrency(totalCollected)}</div>
                        </div>
                        <div class="card ${remainingAmount > 0 ? 'orange' : 'green'}">
                            <div class="card-label">Reste à Collecter</div>
                            <div class="card-value">${formatCurrency(remainingAmount)}</div>
                        </div>
                    </div>

                    <h2>📈 Analyse Financière</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Indicateur</th>
                                <th class="text-right">Montant / Valeur</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>💰 Montant attendu (Échéances)</td><td class="text-right font-bold">${formatCurrency(totalExpected)}</td></tr>
                            <tr><td>✅ Montant collecté</td><td class="text-right font-bold text-green">${formatCurrency(totalCollected)}</td></tr>
                            <tr><td>⏳ Reste à collecter</td><td class="text-right font-bold ${remainingAmount > 0 ? 'text-orange' : 'text-green'}">${formatCurrency(remainingAmount)}</td></tr>
                            <tr class="highlight"><td>📊 Taux de recouvrement</td><td class="text-right font-bold text-blue">${collectionRate.toFixed(0)}%</td></tr>
                            <tr><td>🧾 Nombre de paiements</td><td class="text-right">${payments.length}</td></tr>
                            <tr><td>📅 Nombre d'échéances</td><td class="text-right">${feeSchedules.length}</td></tr>
                            <tr><td>👥 Élèves concernés</td><td class="text-right">${new Set(feeSchedules.map((s: any) => s.studentId || s.student_id)).size}</td></tr>
                        </tbody>
                    </table>
                `;
                break;

            case 'fee-type':
                reportTitle = 'Rapport par Type de Frais';
                reportSubtitle = 'Répartition détaillée des frais scolaires';
                const feeTypes: any = {};
                feeSchedules.forEach((schedule: any) => {
                    const type = schedule.feeType?.name || 'Autre';
                    if (!feeTypes[type]) {
                        feeTypes[type] = { expected: 0, collected: 0, count: 0 };
                    }
                    feeTypes[type].expected += schedule.amount || 0;
                    feeTypes[type].count += 1;
                });

                payments.forEach((payment: any) => {
                    const type = payment.feeSchedule?.feeType?.name || 'Autre';
                    if (!feeTypes[type]) {
                        feeTypes[type] = { expected: 0, collected: 0, count: 0 };
                    }
                    feeTypes[type].collected += payment.amount || 0;
                });

                const totalFees = Object.values(feeTypes).reduce((sum: number, ft: any) => sum + ft.expected, 0);

                reportContent = `
                    <h2>💼 Analyse par Type de Frais</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Type de Frais</th>
                                <th class="text-right">Attendu</th>
                                <th class="text-right">Collecté</th>
                                <th class="text-right">Reste</th>
                                <th class="text-right">Taux</th>
                                <th class="text-center">% du Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(feeTypes).map(([type, data]: [string, any]) => {
                    const rate = data.expected > 0 ? ((data.collected / data.expected) * 100).toFixed(0) : '0';
                    const remaining = data.expected - data.collected;
                    const percentOfTotal = totalFees > 0 ? ((data.expected / totalFees) * 100).toFixed(0) : '0';
                    return `
                                <tr>
                                    <td class="font-semibold">${type}</td>
                                    <td class="text-right">${formatCurrency(data.expected)}</td>
                                    <td class="text-right text-green">${formatCurrency(data.collected)}</td>
                                    <td class="text-right ${remaining > 0 ? 'text-orange' : 'text-green'}">${formatCurrency(remaining)}</td>
                                    <td class="text-right font-bold">${rate}%</td>
                                    <td class="text-center"><div class="progress-bar"><div class="progress-fill" style="width: ${percentOfTotal}%"></div></div>${percentOfTotal}%</td>
                                </tr>
                            `}).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td class="font-bold">TOTAL</td>
                                <td class="text-right font-bold">${formatCurrency(totalExpected)}</td>
                                <td class="text-right font-bold text-green">${formatCurrency(totalCollected)}</td>
                                <td class="text-right font-bold">${formatCurrency(totalExpected - totalCollected)}</td>
                                <td class="text-right font-bold">${collectionRate.toFixed(0)}%</td>
                                <td class="text-center font-bold">100%</td>
                            </tr>
                        </tfoot>
                    </table>
                `;
                break;

            case 'recovery':
                reportTitle = 'Rapport de Recouvrement';
                reportSubtitle = 'Analyse du taux de participation et recouvrement';
                const studentsWithPayments = new Set(payments.map((p: any) => p.studentId || p.student_id));
                const studentsWithSchedules = new Set(feeSchedules.map((s: any) => s.studentId || s.student_id));
                const paymentRate = studentsWithSchedules.size > 0
                    ? (studentsWithPayments.size / studentsWithSchedules.size) * 100
                    : 0;

                reportContent = `
                    <div class="summary-cards">
                        <div class="card blue">
                            <div class="card-label">Élèves avec Échéances</div>
                            <div class="card-value">${studentsWithSchedules.size}</div>
                        </div>
                        <div class="card green">
                            <div class="card-label">Élèves Ayant Payé</div>
                            <div class="card-value">${studentsWithPayments.size}</div>
                        </div>
                        <div class="card ${paymentRate >= 80 ? 'green' : 'orange'}">
                            <div class="card-label">Taux de Participation</div>
                            <div class="card-value">${paymentRate.toFixed(0)}%</div>
                        </div>
                    </div>

                    <h2>📊 Indicateurs de Recouvrement</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Métrique</th>
                                <th class="text-right">Valeur</th>
                                <th class="text-right">Pourcentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>👥 Élèves avec échéances</td><td class="text-right font-bold">${studentsWithSchedules.size}</td><td class="text-right">100%</td></tr>
                            <tr><td>✅ Élèves ayant effectué un paiement</td><td class="text-right font-bold text-green">${studentsWithPayments.size}</td><td class="text-right font-bold text-green">${paymentRate.toFixed(0)}%</td></tr>
                            <tr><td>❌ Élèves sans paiement</td><td class="text-right text-orange">${studentsWithSchedules.size - studentsWithPayments.size}</td><td class="text-right text-orange">${(100 - paymentRate).toFixed(0)}%</td></tr>
                            <tr class="highlight"><td>💰 Taux de recouvrement financier</td><td class="text-right font-bold">${formatCurrency(totalCollected)}</td><td class="text-right font-bold text-blue">${collectionRate.toFixed(0)}%</td></tr>
                            <tr><td>📉 Montant restant à recouvrer</td><td class="text-right text-orange font-bold">${formatCurrency(totalExpected - totalCollected)}</td><td class="text-right">${(100 - collectionRate).toFixed(0)}%</td></tr>
                        </tbody>
                    </table>
                `;
                break;
        }

        return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>${reportTitle} - ${schoolName}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        @page {
            size: A4;
            margin: 12mm 12mm 16mm 12mm;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #1a1a2e;
            background: #ffffff;
            line-height: 1.5;
            font-size: 11.5px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        /* ── Watermark ─────────────────────────────────────────── */
        body::before {
            content: 'CONFIDENTIEL';
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-35deg);
            font-size: 80px;
            font-weight: 800;
            color: rgba(0, 0, 0, 0.025);
            letter-spacing: 15px;
            pointer-events: none;
            z-index: 0;
        }

        /* ── Header ────────────────────────────────────────────── */
        .report-header {
            position: relative;
            display: flex;
            justify-content: space-between;
            align-items: stretch;
            border-radius: 0;
            margin-bottom: 0;
            overflow: hidden;
        }

        .header-brand {
            flex: 1;
            padding: 18px 24px;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
            color: #fff;
        }

        .header-brand .school-name {
            font-size: 18px;
            font-weight: 800;
            letter-spacing: -0.3px;
            margin-bottom: 4px;
        }

        .header-brand .school-details {
            font-size: 10px;
            color: rgba(255,255,255,0.75);
            line-height: 1.6;
        }

        .header-report {
            width: 240px;
            padding: 18px 22px;
            background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
            color: #fff;
            display: flex;
            flex-direction: column;
            justify-content: center;
            text-align: right;
        }

        .header-report .report-type-label {
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            opacity: 0.7;
            margin-bottom: 4px;
        }

        .header-report .report-name {
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 3px;
        }

        .header-report .report-sub {
            font-size: 10px;
            opacity: 0.85;
        }

        /* ── Gold accent bar ───────────────────────────────────── */
        .accent-bar {
            height: 3px;
            background: linear-gradient(90deg, #b8860b 0%, #daa520 30%, #f4c542 50%, #daa520 70%, #b8860b 100%);
        }

        /* ── Metadata row ──────────────────────────────────────── */
        .meta-strip {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 20px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            font-size: 10px;
            color: #64748b;
        }

        .meta-strip .meta-item {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .meta-strip .meta-label {
            font-weight: 600;
            color: #334155;
        }

        /* ── Content area ──────────────────────────────────────── */
        .content {
            padding: 18px 20px 12px;
            position: relative;
            z-index: 1;
        }

        /* ── Summary Cards ─────────────────────────────────────── */
        .summary-cards {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin: 0 0 18px 0;
        }

        .card {
            padding: 14px 14px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid;
            position: relative;
            overflow: hidden;
        }

        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
        }

        .card.blue {
            background: #f0f7ff;
            border-color: #bfdbfe;
        }
        .card.blue::before { background: #2563eb; }

        .card.green {
            background: #f0fdf4;
            border-color: #bbf7d0;
        }
        .card.green::before { background: #16a34a; }

        .card.purple {
            background: #faf5ff;
            border-color: #e9d5ff;
        }
        .card.purple::before { background: #9333ea; }

        .card.orange {
            background: #fff7ed;
            border-color: #fed7aa;
        }
        .card.orange::before { background: #ea580c; }

        .card-label {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #64748b;
            margin-bottom: 6px;
        }

        .card-value {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.3px;
        }

        /* ── Section headings ──────────────────────────────────── */
        h2 {
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
            margin: 18px 0 10px 0;
            padding: 0 0 7px 0;
            border-bottom: 1.5px solid #e2e8f0;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        h2::after {
            content: '';
            flex: 1;
            height: 1.5px;
            background: linear-gradient(90deg, #2563eb, transparent);
            margin-left: 10px;
        }

        /* ── Tables ────────────────────────────────────────────── */
        table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin: 10px 0 16px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            overflow: hidden;
            font-size: 11px;
        }

        thead {
            background: #0f172a;
            color: #fff;
        }

        th {
            padding: 9px 14px;
            text-align: left;
            font-weight: 600;
            font-size: 9.5px;
            text-transform: uppercase;
            letter-spacing: 0.7px;
        }

        td {
            padding: 8px 14px;
            border-bottom: 1px solid #f1f5f9;
        }

        tbody tr:nth-child(even) {
            background: #f8fafc;
        }

        tbody tr:hover {
            background: #eef2ff;
        }

        tbody tr:last-child td {
            border-bottom: none;
        }

        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: 700; }
        .font-semibold { font-weight: 600; }
        .text-green { color: #15803d; }
        .text-blue { color: #1d4ed8; }
        .text-orange { color: #c2410c; }

        .highlight {
            background: #fef9c3 !important;
            font-weight: 600;
        }

        .total-row {
            background: #f1f5f9 !important;
        }

        .total-row td {
            border-top: 2px solid #0f172a;
            font-weight: 700;
            padding-top: 13px;
            padding-bottom: 13px;
        }

        tfoot {
            background: #f8fafc;
        }

        /* ── Progress bars ─────────────────────────────────────── */
        .progress-bar {
            width: 72px;
            height: 6px;
            background: #e2e8f0;
            border-radius: 3px;
            overflow: hidden;
            display: inline-block;
            margin-right: 8px;
            vertical-align: middle;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #2563eb 0%, #7c3aed 100%);
            border-radius: 3px;
        }

        /* ── Footer ────────────────────────────────────────────── */
        .report-footer {
            margin-top: 40px;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
        }

        .footer-grid {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }

        .footer-left {
            font-size: 10px;
            color: #94a3b8;
            line-height: 1.6;
        }

        .footer-brand {
            font-weight: 700;
            font-size: 12px;
            color: #1e40af;
            margin-bottom: 3px;
        }

        .footer-right {
            text-align: right;
        }

        .footer-sig {
            font-size: 10px;
            color: #64748b;
            border-top: 1px solid #cbd5e1;
            padding-top: 6px;
            min-width: 180px;
            text-align: center;
        }

        .stamp {
            display: inline-block;
            border: 2px solid #1e40af;
            border-radius: 6px;
            padding: 6px 16px;
            color: #1e40af;
            font-weight: 700;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin-top: 8px;
            opacity: 0.6;
        }

        /* ── Print adjustments ─────────────────────────────────── */
        @media print {
            body { padding: 0; }
            body::before { display: none; }
            .no-print { display: none; }
            .summary-cards { break-inside: avoid; }
            table { break-inside: avoid; }
            .report-footer { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="report-header">
        <div class="header-brand">
            <div class="school-name">${schoolName}</div>
            <div class="school-details">
                ${schoolAddress ? `${schoolAddress}<br>` : ''}
                ${schoolPhone ? `Tél : ${schoolPhone}` : ''}${schoolEmail ? ` &nbsp;|&nbsp; ${schoolEmail}` : ''}
            </div>
        </div>
        <div class="header-report">
            <div class="report-type-label">Rapport Financier</div>
            <div class="report-name">${reportTitle}</div>
            <div class="report-sub">${reportSubtitle}</div>
        </div>
    </div>
    <div class="accent-bar"></div>

    <!-- Metadata -->
    <div class="meta-strip">
        <div class="meta-item"><span class="meta-label">Année Scolaire :</span> ${yearName}</div>
        <div class="meta-item"><span class="meta-label">Date :</span> ${currentDate}</div>
        <div class="meta-item"><span class="meta-label">Réf :</span> RPT-${reportType.toUpperCase()}-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}</div>
    </div>

    <!-- Content -->
    <div class="content">
        ${reportContent}
    </div>

    <!-- Footer -->
    <div class="content">
        <div class="report-footer">
            <div class="footer-grid">
                <div class="footer-left">
                    <div class="footer-brand">NovaConnect School</div>
                    Rapport généré automatiquement le ${currentDate}<br>
                    Document à usage interne — Diffusion restreinte
                </div>
                <div class="footer-right">
                    <div class="footer-sig">Visa du Responsable Financier</div>
                    <div class="stamp">Document Officiel</div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
        `;
    };

    const generateReport = async (reportId: string) => {
        setGenerating(reportId);

        try {
            const htmlContent = generateHTMLReport(reportId);
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(htmlContent);
                printWindow.document.close();

                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                    }, 250);
                };
            } else {
                alert('Veuillez autoriser les pop-ups pour générer le rapport.');
            }
        } catch (error) {
            console.error('Erreur lors de la génération du rapport:', error);
            alert('Erreur lors de la génération du rapport');
        } finally {
            setGenerating(null);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Générateur de Rapports</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {reports.map((report) => {
                            const Icon = report.icon;
                            const isGenerating = generating === report.id;

                            return (
                                <Card key={report.id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-6">
                                        <div className="flex items-start gap-4">
                                            <div className={`p-3 rounded-lg bg-gray-50 ${report.color}`}>
                                                <Icon className="w-6 h-6" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-lg mb-1">{report.title}</h3>
                                                <p className="text-sm text-gray-600 mb-4">{report.description}</p>
                                                <Button
                                                    onClick={() => generateReport(report.id)}
                                                    disabled={isGenerating}
                                                    size="sm"
                                                    className="w-full"
                                                >
                                                    {isGenerating ? (
                                                        <>
                                                            <span className="animate-spin mr-2">⏳</span>
                                                            Génération...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Download className="w-4 h-4 mr-2" />
                                                            Générer Rapport
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-900">
                            💡 <strong>Astuce :</strong> Les rapports s'ouvriront dans une nouvelle fenêtre.
                            Utilisez <strong>Ctrl+P</strong> ou le bouton d'impression pour enregistrer en PDF.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Statistiques Rapides</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-sm text-green-600 font-medium">Total Collecté</p>
                            <p className="text-2xl font-bold text-green-700 mt-1">
                                {formatCurrency(payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0))}
                            </p>
                        </div>
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-600 font-medium">Total Attendu</p>
                            <p className="text-2xl font-bold text-blue-700 mt-1">
                                {formatCurrency(feeSchedules.reduce((sum: number, s: any) => sum + (s.amount || 0), 0))}
                            </p>
                        </div>
                        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <p className="text-sm text-purple-600 font-medium">Nombre de Paiements</p>
                            <p className="text-2xl font-bold text-purple-700 mt-1">{payments.length}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
