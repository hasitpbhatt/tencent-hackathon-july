import { useCallback, useRef } from 'react';
import type { SSEEvent } from '../types';

// ── localStorage history management ──

const HISTORY_KEY = 'shipkit-history';

export interface HistoryItem {
  id: string;
  productName: string;
  timestamp: number;
}

export function getHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(id: string, productName: string) {
  const list = getHistory();
  if (list.find((h) => h.id === id)) return;
  list.unshift({ id, productName: productName.slice(0, 50), timestamp: Date.now() });
  if (list.length > 20) list.pop();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

export async function removeHistory(id: string) {
  const list = getHistory().filter((h) => h.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  try {
    await fetch('/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'makers-conversation-id': id,
      },
      body: JSON.stringify({ conversationId: id }),
    });
  } catch {}
}

// ── Hook ──

export function useSSE(onEvent: (event: SSEEvent) => void) {
  const abortRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string>('');
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  /**
   * Send one user message — either the product name (first turn) or any
   * follow-up. The server determines phase from stored history.
   */
  const send = useCallback(async (
    userMessage: string,
    locale: string,
    options?: { isFirstTurn?: boolean },
  ) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // First turn: generate a fresh conversationId, save to localStorage / URL.
    if (options?.isFirstTurn) {
      const conversationId = crypto.randomUUID();
      conversationIdRef.current = conversationId;
      saveHistory(conversationId, userMessage);
      window.history.replaceState(null, '', '?id=' + conversationId);
    }

    const cid = conversationIdRef.current;

    try {
      const res = await fetch('/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'makers-conversation-id': cid,
        },
        body: JSON.stringify({
          user_message: userMessage,
          locale,
          ...(options?.isFirstTurn ? { is_new: true } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const event: SSEEvent = JSON.parse(trimmed.slice(6));
            onEventRef.current(event);

            if (event.type === 'done') {
              return;
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      // AbortError is expected when a new request cancels the previous one
    }
  }, []);

  // Returns raw stored messages: { role, content, metadata }
  // Throws on error (non-200, empty result, network failure) so the caller can display a toast.
  const loadHistory = useCallback(async (
    targetId: string,
  ): Promise<Array<{ role: string; content: string; metadata?: Record<string, unknown> | null }>> => {
    conversationIdRef.current = targetId;
    window.history.replaceState(null, '', '?id=' + targetId);

  try {
    const res = await fetch('/history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'makers-conversation-id': targetId,
      },
      body: JSON.stringify({ conversationId: targetId }),
    });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const messages = data.messages || [];
      if (messages.length === 0) {
        throw new Error('empty');
      }
      return messages;
    } catch (err) {
      // Re-throw all errors so the caller can display the appropriate message.
      // err.message === 'empty' means the conversation has no history.
      throw err;
    }
  }, []);

  const resetConversation = useCallback(() => {
    abortRef.current?.abort();
    conversationIdRef.current = '';
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  return {
    send,
    loadHistory,
    resetConversation,
  };
}
