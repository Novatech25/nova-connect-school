import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useReportCard } from '@novaconnect/data';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Download, AlertCircle } from 'lucide-react-native';
import { useState } from 'react';

export default function ReportCardDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [showPaymentBlock, setShowPaymentBlock] = useState(false);

  const { data: reportCard, isLoading } = useReportCard(id as string);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!reportCard) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Text className="text-gray-500 text-center">Bulletin non trouvé</Text>
      </View>
    );
  }

  const subjectAverages = reportCard.subjectAverages || [];
  // Payment-based download control
  const canDownload = reportCard.paymentStatus !== 'blocked' || reportCard.paymentStatusOverride;

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-indigo-600 p-4 pt-12">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>

        <Text className="text-white text-2xl font-bold">Bulletin scolaire</Text>
        <Text className="text-indigo-200">
          {reportCard.period?.name}
        </Text>
      </View>

      <View className="p-4">
        {/* Payment Block Warning */}
        {reportCard.paymentStatus === 'blocked' && !reportCard.paymentStatusOverride && (
          <View className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <View className="flex-row items-start">
              <AlertCircle size={20} color="#dc2626" className="mr-2 mt-1" />
              <View className="flex-1">
                <Text className="text-red-800 font-semibold mb-1">
                  Accès bloqué
                </Text>
                <Text className="text-red-700 text-sm">
                  Ce bulletin n'est pas accessible en raison d'arriérés de paiement.
                  Veuillez contacter l'administration pour régulariser votre situation.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Payment Warning */}
        {reportCard.paymentStatus === 'warning' && (
          <View className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <View className="flex-row items-start">
              <AlertCircle size={20} color="#d97706" className="mr-2 mt-1" />
              <View className="flex-1">
                <Text className="text-yellow-800 font-semibold mb-1">
                  Attention
                </Text>
                <Text className="text-yellow-700 text-sm">
                  Vous avez des paiements en retard. Veuillez régulariser votre situation rapidement.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Student Information */}
        <View className="bg-white rounded-lg p-4 shadow-sm mb-4">
          <Text className="text-lg font-bold mb-3">Informations élève</Text>
          <View className="space-y-2">
            <View className="flex-row">
              <Text className="text-gray-600 w-32">Nom complet</Text>
              <Text className="flex-1 font-semibold">
                {reportCard.student?.first_name} {reportCard.student?.last_name}
              </Text>
            </View>
            <View className="flex-row">
              <Text className="text-gray-600 w-32">Matricule</Text>
              <Text className="flex-1">{reportCard.student?.matricule}</Text>
            </View>
            <View className="flex-row">
              <Text className="text-gray-600 w-32">Classe</Text>
              <Text className="flex-1">{reportCard.class?.name}</Text>
            </View>
          </View>
        </View>

        {/* Overall Statistics */}
        <View className="bg-white rounded-lg p-4 shadow-sm mb-4">
          <Text className="text-lg font-bold mb-4">Résultats</Text>

          <View className="flex-row justify-around mb-4">
            <View className="items-center">
              <Text className="text-3xl font-bold text-indigo-600">
                {reportCard.overallAverage.toFixed(2)}
              </Text>
              <Text className="text-sm text-gray-600 mt-1">Moyenne /20</Text>
            </View>

            <View className="items-center">
              <Text className="text-3xl font-bold text-green-600">
                {reportCard.rankInClass}
              </Text>
              <Text className="text-sm text-gray-600 mt-1">Rang</Text>
              <Text className="text-xs text-gray-500">
                sur {reportCard.classSize} élèves
              </Text>
            </View>
          </View>

          {reportCard.mention && (
            <View
              className="self-center px-6 py-3 rounded-lg"
              style={{ backgroundColor: reportCard.mentionColor || '#6366f1' }}
            >
              <Text className="text-white text-lg font-bold text-center">
                {reportCard.mention}
              </Text>
            </View>
          )}
        </View>

        {/* Subject Averages */}
        <View className="bg-white rounded-lg p-4 shadow-sm mb-4">
          <Text className="text-lg font-bold mb-4">Moyennes par matière</Text>

          {subjectAverages.map((subject: any, index: number) => (
            <View
              key={subject.subjectId}
              className={`flex-row justify-between items-center py-3 ${
                index < subjectAverages.length - 1 ? 'border-b border-gray-200' : ''
              }`}
            >
              <View className="flex-1">
                <Text className="font-medium">{subject.subjectName}</Text>
                <Text className="text-xs text-gray-500">Coef: {subject.coefficient}</Text>
              </View>
              <View className="bg-indigo-50 px-3 py-1 rounded">
                <Text className="font-bold text-indigo-600">
                  {subject.average.toFixed(2)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Download Button */}
        {reportCard.pdfUrl && (
          <TouchableOpacity
            onPress={() => {
              // Open PDF in browser or download
              if (reportCard.pdfUrl) {
                router.push(reportCard.pdfUrl);
              }
            }}
            disabled={!canDownload}
            className={`rounded-lg p-4 items-center ${
              canDownload ? 'bg-indigo-600' : 'bg-gray-400'
            }`}
          >
            <Download size={24} color="white" className="mb-2" />
            <Text className="text-white font-semibold">
              {canDownload ? 'Télécharger le PDF' : 'Téléchargement bloqué'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Metadata */}
        <View className="mt-4 px-2">
          <Text className="text-xs text-gray-500 text-center">
            Généré le {reportCard.generatedAt
              ? new Date(reportCard.generatedAt).toLocaleDateString()
              : '-'}
          </Text>
          {/* Payment status override badge
            DEPENDS ON: report_cards table having payment_status_override column
            TODO: Add column to report_cards table: payment_status_override BOOLEAN
          */}
        </View>
      </View>
    </ScrollView>
  );
}
