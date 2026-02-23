'use client';

import { useEffect, useState } from "react";
import { getSupabaseClient } from "../client";
import { useQueryClient } from "@tanstack/react-query";
import type { Notification } from "@novaconnect/core";
import { snakeToCamelKeys } from "../helpers";

export function useRealtimeNotifications(userId: string) {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!userId) return;

    // S'abonner aux nouvelles notifications
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("New notification received:", payload);
          const notification = snakeToCamelKeys(payload.new) as Notification;

          // Invalider les queries pour rafraîchir les données
          queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
          queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count", userId] });

          // Optionnel : afficher une notification système (web)
          if (typeof window !== "undefined" && "Notification" in window) {
            if (Notification.permission === "granted") {
              new Notification(notification.title, {
                body: notification.body,
                icon: "/icon.png",
                tag: notification.id,
              });
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("Notification updated:", payload);
          queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
          queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count", userId] });
        }
      )
      .subscribe((status) => {
        console.log("Realtime subscription status:", status);
        setIsSubscribed(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
      setIsSubscribed(false);
    };
  }, [userId, supabase, queryClient]);

  return { isSubscribed };
}
