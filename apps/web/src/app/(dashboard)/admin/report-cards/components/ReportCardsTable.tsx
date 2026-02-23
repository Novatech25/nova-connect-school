'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useReportCardSignedUrl } from '@novaconnect/data';
import { MoreHorizontal, Eye, Download, CheckCircle } from 'lucide-react';
import type { ReportCard } from '@novaconnect/core';

interface ReportCardsTableProps {
  reportCards: ReportCard[];
  isLoading: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  generated: 'Soumis',
  published: 'Publié',
  archived: 'Archivé',
};

const STATUS_STYLES: Record<
  string,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  draft: { variant: 'secondary' },
  generated: { variant: 'outline', className: 'border-amber-500 text-amber-600' },
  published: { variant: 'outline', className: 'border-emerald-500 text-emerald-600' },
  archived: { variant: 'destructive' },
};

const PAYMENT_LABELS: Record<string, string> = {
  ok: 'OK',
  blocked: 'Bloqué',
  warning: 'Attention',
};

const PAYMENT_STYLES: Record<
  string,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  ok: { variant: 'outline', className: 'border-emerald-500 text-emerald-600' },
  blocked: { variant: 'destructive' },
  warning: { variant: 'outline', className: 'border-amber-500 text-amber-600' },
};

export function ReportCardsTable({ reportCards, isLoading }: ReportCardsTableProps) {
  const { toast } = useToast();
  const getSignedUrl = useReportCardSignedUrl();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  if (reportCards.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Aucun bulletin trouvé. Configurez les filtres et générez des bulletins.
      </div>
    );
  }

  const handleDownload = async (card: ReportCard) => {
    if (!card.pdfUrl) return;
    setDownloadingId(card.id);
    try {
      const result = await getSignedUrl.mutateAsync(card.id);
      window.open(result.signedUrl, '_blank', 'noopener');
      toast({
        title: 'Téléchargement prêt',
        description: 'Le bulletin PDF s’ouvre dans un nouvel onglet.',
      });
    } catch (error: any) {
      toast({
        title: 'Téléchargement impossible',
        description: error?.message || 'Le PDF est indisponible pour le moment.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const style = STATUS_STYLES[status] || { variant: 'default' as const };
    return (
      <Badge variant={style.variant} className={style.className}>
        {STATUS_LABELS[status] || status}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: string, override: boolean) => {
    if (override) {
      return (
        <Badge variant="outline" className="text-orange-600 border-orange-600">
          Débloqué (override)
        </Badge>
      );
    }
    const style = PAYMENT_STYLES[status] || { variant: 'default' as const };
    return (
      <Badge variant={style.variant} className={style.className}>
        {PAYMENT_LABELS[status] || status}
      </Badge>
    );
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Élève</TableHead>
            <TableHead>Classe</TableHead>
            <TableHead>Période</TableHead>
            <TableHead>Moyenne</TableHead>
            <TableHead>Rang</TableHead>
            <TableHead>Mention</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Paiement</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reportCards.map((card) => {
            const averageValue = Number(card.overallAverage);
            const averageLabel = Number.isFinite(averageValue) ? averageValue.toFixed(2) : '--';
            const isBlocked = card.paymentStatus === 'blocked' && !card.paymentStatusOverride;
            return (
              <TableRow key={card.id}>
                <TableCell className="font-medium">
                  {card.student?.firstName} {card.student?.lastName}
                  <div className="text-xs text-muted-foreground">{card.student?.matricule}</div>
                </TableCell>
                <TableCell>{card.class?.name || '--'}</TableCell>
                <TableCell>{card.period?.name || '--'}</TableCell>
                <TableCell>
                  <span className="font-semibold">{averageLabel}/20</span>
                </TableCell>
                <TableCell>
                  {card.rankInClass ?? '--'}/{card.classSize ?? '--'}
                </TableCell>
                <TableCell>
                  {card.mention && (
                    <Badge
                      style={{
                        backgroundColor: card.mentionColor || '#6366f1',
                        color: 'white',
                      }}
                    >
                      {card.mention}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{getStatusBadge(card.status)}</TableCell>
                <TableCell>
                  {getPaymentStatusBadge(card.paymentStatus, card.paymentStatusOverride)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Ouvrir le menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/report-cards/${card.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          Voir détails
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!card.pdfUrl || isBlocked || downloadingId === card.id}
                        onClick={() => handleDownload(card)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {isBlocked
                          ? 'PDF bloqué'
                          : downloadingId === card.id
                            ? 'Préparation...'
                            : 'Télécharger PDF'}
                      </DropdownMenuItem>
                      {card.status !== 'published' && (
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/report-cards/${card.id}`}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Voir détails & publier
                          </Link>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
