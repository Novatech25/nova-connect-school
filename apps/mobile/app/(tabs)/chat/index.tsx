import React from 'react';
import { View, FlatList, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useChatConversations } from '@novaconnect/data';
import { useAuth } from '@novaconnect/core';

export default function ChatListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: conversations, isLoading } = useChatConversations(user?.id || '');

  const renderConversation = ({ item }: { item: any }) => (
    <TouchableOpacity
      onPress={() => router.push(`/chat/${item.id}`)}
      className="p-4 border-b border-gray-200"
    >
      <Text className="font-semibold text-lg">{item.title}</Text>
      {item.last_message && item.last_message.content && (
        <Text className="text-gray-600 mt-1" numberOfLines={1}>
          {item.last_message.content}
        </Text>
      )}
      <Text className="text-gray-400 text-sm mt-1">
        {new Date(item.updated_at).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0000ff" />
        <Text className="mt-2">Chargement...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center p-8">
            <Text className="text-gray-500">Aucune conversation</Text>
          </View>
        }
      />
    </View>
  );
}
