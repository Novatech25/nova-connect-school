import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, TextInput, TouchableOpacity, Text, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { getConversationMessages, sendMessage, markMessagesAsRead, uploadAttachment } from '@novaconnect/data';
import { useRealtimeChat } from '@novaconnect/data';
import { useAuth } from '@novaconnect/core';
import { Ionicons } from '@expo/vector-icons';

export default function ChatConversationScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ['chat-messages', id],
    queryFn: () => getConversationMessages(id as string),
  });

  const { isSubscribed } = useRealtimeChat(id as string);

  const sendMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: (data) => {
      setMessageText('');
      setPendingMessageId(data.id);
      queryClient.invalidateQueries({ queryKey: ['chat-messages', id] });
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    },
  });

  useEffect(() => {
    if (id) {
      markMessagesAsRead(id as string);
    }
  }, [id]);

  const handleSend = () => {
    if (!messageText.trim()) return;

    sendMutation.mutate({
      conversationId: id as string,
      content: messageText,
    });
  };

  const handleAttach = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];

      // First send a message if there's text, then attach the file
      let messageId = pendingMessageId;

      if (messageText.trim()) {
        // Send message with text first
        sendMutation.mutate(
          {
            conversationId: id as string,
            content: messageText,
          },
          {
            onSuccess: (data) => {
              setPendingMessageId(data.id);
              uploadFileToMessage(data.id, file);
            },
          }
        );
      } else if (messageId) {
        // Attach to existing pending message
        uploadFileToMessage(messageId, file);
      } else {
        Alert.alert('Erreur', 'Veuillez envoyer un message d\'abord');
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner le fichier');
    }
  };

  const uploadFileToMessage = async (messageId: string, file: DocumentPicker.DocumentAsset) => {
    setIsUploading(true);
    try {
      // Convert the file URI to a File object
      const response = await fetch(file.uri);
      const blob = await response.blob();
      const fileObj = new File([blob], file.name || 'attachment', { type: file.mimeType || 'application/octet-stream' });

      await uploadAttachment(messageId, fileObj);
      Alert.alert('Succès', 'Fichier attaché avec succès');
      queryClient.invalidateQueries({ queryKey: ['chat-messages', id] });
    } catch (error) {
      console.error('Error uploading attachment:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer le fichier');
    } finally {
      setIsUploading(false);
      setPendingMessageId(null);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isOwnMessage = item.sender_id === user?.id;

    return (
      <View
        className={`flex-row ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-3`}
      >
        <View
          className={`max-w-[75%] rounded-lg p-3 ${
            isOwnMessage
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-900'
          }`}
        >
          {!isOwnMessage && (
            <Text className="text-xs font-semibold mb-1 opacity-70">
              {item.sender?.first_name} {item.sender?.last_name}
            </Text>
          )}
          <Text className={isOwnMessage ? 'text-white' : 'text-gray-900'}>
            {item.content}
          </Text>
          {item.attachments && item.attachments.length > 0 && (
            <View className="mt-2">
              {item.attachments.map((attachment: any) => (
                <View key={attachment.id} className="bg-white bg-opacity-20 rounded p-2 mb-1">
                  <Text className="text-xs underline">{attachment.file_name}</Text>
                  <Text className="text-xs opacity-70">
                    {(attachment.file_size / 1024).toFixed(2)} KB
                  </Text>
                </View>
              ))}
            </View>
          )}
          <View className={`flex-row items-center mt-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
            <Text className={`text-xs ${isOwnMessage ? 'text-blue-100' : 'text-gray-500'}`}>
              {new Date(item.sent_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {item.edited_at && (
              <Text className={`text-xs ml-1 ${isOwnMessage ? 'text-blue-100' : 'text-gray-500'}`}>
                (modifié)
              </Text>
            )}
            {item.status === 'read' && (
              <Ionicons name="checkmark-done" size={14} color={isOwnMessage ? '#fff' : '#666'} style={{ marginLeft: 4 }} />
            )}
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#0000ff" />
        <Text className="mt-2">Chargement des messages...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View className="flex-1 p-4">
        {isSubscribed && (
          <View className="bg-green-100 rounded-lg p-2 mb-2">
            <Text className="text-green-800 text-xs text-center">
              Synchronisation en temps réel activée
            </Text>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={{ paddingBottom: 10 }}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center">
              <Text className="text-gray-500">Aucun message pour le moment</Text>
            </View>
          }
        />
      </View>

      <View className="border-t border-gray-200 p-3 bg-white flex-row items-center">
        <TouchableOpacity onPress={handleAttach} disabled={isUploading} className="p-2 mr-2">
          <Ionicons name="attach" size={24} color={isUploading ? '#999' : '#666'} />
        </TouchableOpacity>
        {isUploading && (
          <View className="mr-2">
            <ActivityIndicator size="small" color="#0000ff" />
          </View>
        )}
        <TextInput
          className="flex-1 bg-gray-100 rounded-full px-4 py-2 mr-2 max-h-32"
          placeholder="Écrivez votre message..."
          value={messageText}
          onChangeText={setMessageText}
          multiline
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!messageText.trim() || sendMutation.isPending || isUploading}
          className={`p-2 rounded-full ${
            messageText.trim() && !sendMutation.isPending && !isUploading
              ? 'bg-blue-500'
              : 'bg-gray-300'
          }`}
        >
          <Ionicons
            name="send"
            size={24}
            color={messageText.trim() && !sendMutation.isPending && !isUploading ? '#fff' : '#999'}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
