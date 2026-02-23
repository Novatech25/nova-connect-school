import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth, useReportCards } from '@novaconnect/data';
import { useRouter } from 'expo-router';
import { useState } from 'react';

export default function ReportCardsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  // Get student ID if user is student, or children IDs if parent
  const [studentId, setStudentId] = useState<string | undefined>(
    user?.role === 'student' ? user.studentId : undefined
  );

  const { data: reportCards, isLoading } = useReportCards(user?.schoolId || '', {
    studentId,
  });

  const renderReportCard = ({ item }: any) => (
    <TouchableOpacity
      onPress={() => router.push(`/report-cards/${item.id}`)}
      className="mb-4"
    >
      <View className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <Text className="text-lg font-semibold">
              {item.period.name}
            </Text>
            <Text className="text-sm text-gray-600">
              {item.class.name}
            </Text>
            <Text className="text-2xl font-bold mt-2 text-indigo-600">
              {item.overallAverage.toFixed(2)}/20
            </Text>
            {item.mention && (
              <View
                className="self-start px-3 py-1 rounded mt-2"
                style={{ backgroundColor: item.mentionColor || '#6366f1' }}
              >
                <Text className="text-white text-sm font-medium">{item.mention}</Text>
              </View>
            )}
          </View>
          <View className="items-end">
            <Text className="text-sm text-gray-600">
              Rang: {item.rankInClass}/{item.classSize}
            </Text>
            <View
              className={`px-2 py-1 rounded mt-2 ${
                item.status === 'published'
                  ? 'bg-green-100'
                  : 'bg-yellow-100'
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  item.status === 'published'
                    ? 'text-green-800'
                    : 'text-yellow-800'
                }`}
              >
                {item.status}
              </Text>
            </View>

            {/* Payment status indicator
              DEPENDS ON: report_cards table having payment_status and payment_status_override columns
              TODO: Add columns to report_cards table: payment_status TEXT, payment_status_override BOOLEAN
              TODO: Update generate_report_card_data() to include payment status from checkPaymentStatus()
            */}
            {item.paymentStatus === 'blocked' && !item.paymentStatusOverride && (
              <View className="mt-2 bg-red-100 px-2 py-1 rounded">
                <Text className="text-xs text-red-800 font-medium">
                  ⚠️ Accès bloqué - Arriérés de paiement
                </Text>
              </View>
            )}
            {item.paymentStatus === 'warning' && (
              <View className="mt-2 bg-yellow-100 px-2 py-1 rounded">
                <Text className="text-xs text-yellow-800 font-medium">
                  ⚠️ Attention - Paiements en retard
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#6366f1" />
        <Text className="mt-4 text-gray-600">Chargement des bulletins...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 p-4">
      <Text className="text-2xl font-bold mb-4">Mes bulletins</Text>

      {reportCards && reportCards.length > 0 ? (
        <FlatList
          data={reportCards}
          renderItem={renderReportCard}
          keyExtractor={(item) => item.id}
          refreshing={isLoading}
        />
      ) : (
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-500 text-center">
            Aucun bulletin disponible pour le moment.
          </Text>
        </View>
      )}
    </View>
  );
}
