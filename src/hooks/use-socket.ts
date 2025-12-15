import { useEffect, useRef, useState } from 'react';
import type { WsPayload, WsResponse, Comment } from '@/lib/types';
import { toast } from 'sonner'; 

interface SocketCallbacks {
  onRateSuccess?: () => void;
  onNewRating?: (newAverage: number) => void;
}

export const useFoodSocket = (
  foodId: string | null, 
  currentUserId?: string,
  callbacks?: SocketCallbacks
) => {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [liveComments, setLiveComments] = useState<Comment[]>([]);

  // Refs for closures
  const savedCallbacks = useRef(callbacks);
  const savedUserId = useRef(currentUserId);
  const activeSubscription = useRef<string | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    savedCallbacks.current = callbacks;
    savedUserId.current = currentUserId;
  }, [callbacks, currentUserId]);

  // Persistent Connection Logic
  useEffect(() => {
    const connect = () => {
      // Avoid creating multiple sockets
      if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${import.meta.env.VITE_SOCKET_URL}`;

      const socket = new WebSocket(url);
      ws.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
        
        // If we have a pending subscription, send it now
        if (activeSubscription.current) {
          socket.send(JSON.stringify({ 
            type: 'subscribe', 
            payload: { foodId: activeSubscription.current } 
          }));
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        ws.current = null;
        // Attempt reconnect in 3s
        reconnectTimeout.current = setTimeout(() => connect(), 3000);
      };

      socket.onmessage = (event) => {
        try {
          const data: WsResponse = JSON.parse(event.data);

          // Filter events not for the current food
          if ('foodId' in data && data.foodId !== activeSubscription.current) return;

          if (data.type === 'new_comment') {
            setLiveComments(prev => [{
              id: data.id,
              content: data.content,
              createdAt: data.createdAt,
              user: data.user
            }, ...prev]);
            
            if (data.user.id !== savedUserId.current) {
              toast.info(`New comment from ${data.user.username}`);
            }
          } 
          else if (data.type === 'new_rating') {
             savedCallbacks.current?.onNewRating?.(data.averageRating);
          }
          else if (data.type === 'ack') {
            if (data.status === 'error') {
              toast.error(data.message || "An error occurred");
            } else if (data.action === 'rate_food' && data.status === 'success') {
              toast.success("Rating submitted!");
              savedCallbacks.current?.onRateSuccess?.(); 
            } else if (data.action === 'submit_comment' && data.status === 'posted') {
              toast.success("Comment posted!");
            }
          }
        } catch (e) {
          console.error("WS Parse Error", e);
        }
      };
    };

    connect();

    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      ws.current?.close();
    };
  }, []);

  // Handle Food Switching (Subscription Swap)
  useEffect(() => {
    const socket = ws.current;
    
    // Unsubscribe from OLD
    if (activeSubscription.current && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'unsubscribe',
        payload: { foodId: activeSubscription.current }
      }));
    }

    // Reset State
    setLiveComments([]);
    activeSubscription.current = foodId;

    // Subscribe to NEW
    if (foodId && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'subscribe',
        payload: { foodId }
      }));
    }
  }, [foodId]);

  const sendMessage = (data: WsPayload) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    } else {
      toast.error("Not connected. Trying to reconnect...");
    }
  };

  return { isConnected, liveComments, sendMessage };
};