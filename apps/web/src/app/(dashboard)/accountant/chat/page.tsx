import { Metadata } from 'next';
import ChatClient from './ChatClient';

export const metadata: Metadata = {
  title: 'Messagerie | NovaConnect',
  description: 'Échangez avec les autres membres de l\'établissement',
};

export default function AccountantChatPage() {
  return <ChatClient />;
}
