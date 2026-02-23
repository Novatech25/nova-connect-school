'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface PaymentDetailsModalProps {
    payment: any | null;
    student: any | null;
    onClose: () => void;
}

const paymentMethodLabels: Record<string, string> = {
    cash: 'Espèces',
    bank_transfer: 'Virement',
    check: 'Chèque',
    mobile_money: 'Mobile Money',
    card: 'Carte',
    other: 'Autre',
};

const formatCurrency = (value?: number | null) => {
    const safeValue = typeof value === 'number' ? value : 0;
    return `${Math.round(safeValue).toLocaleString('fr-FR')} FCFA`;
};

const formatDate = (value?: string | Date | null) => {
    if (!value) return '--';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

export function PaymentDetailsModal({ payment, student, onClose }: PaymentDetailsModalProps) {
    if (!payment) return null;

    const paymentMethod = paymentMethodLabels[payment.paymentMethod || payment.payment_method] || payment.paymentMethod || payment.payment_method || 'N/A';

    return (
        <Dialog open={!!payment} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Détails du Paiement</DialogTitle>
                    <DialogDescription>
                        Référence: {payment.referenceNumber || payment.reference_number || 'N/A'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Montant principal */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
                        <p className="text-sm text-gray-600 mb-1">Montant payé</p>
                        <p className="text-3xl font-bold text-green-600">
                            {formatCurrency(payment.amount)}
                        </p>
                    </div>

                    {/* Informations de l'élève */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">Élève</p>
                            <p className="text-base font-semibold">
                                {student ? `${student.firstName} ${student.lastName}` : 'N/A'}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">Date de paiement</p>
                            <p className="text-base">
                                {formatDate(payment.paymentDate || payment.payment_date)}
                            </p>
                        </div>
                    </div>

                    {/* Méthode de paiement */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">Méthode de paiement</p>
                            <Badge variant="outline" className="mt-1">
                                {paymentMethod}
                            </Badge>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">Référence</p>
                            <p className="text-base font-mono text-sm">
                                {payment.referenceNumber || payment.reference_number || 'Aucune'}
                            </p>
                        </div>
                    </div>

                    {/* Notes/Commentaires */}
                    {(payment.notes || payment.description) && (
                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">Notes</p>
                            <p className="text-base text-gray-700 bg-gray-50 p-3 rounded">
                                {payment.notes || payment.description}
                            </p>
                        </div>
                    )}

                    {/* Informations système */}
                    <div className="border-t pt-4">
                        <p className="text-xs text-gray-400 mb-2">Informations système</p>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                            <div>
                                <span className="font-medium">ID:</span> {payment.id}
                            </div>
                            {payment.createdAt && (
                                <div>
                                    <span className="font-medium">Créé le:</span>{' '}
                                    {formatDate(payment.createdAt || payment.created_at)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
