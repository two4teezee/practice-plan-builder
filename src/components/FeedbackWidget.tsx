'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import { createFeedback } from '@/lib/db';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/Button';

interface FeedbackWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

type SendState = 'idle' | 'sending' | 'sent' | 'error';

export function FeedbackWidget({ isOpen, onClose }: FeedbackWidgetProps) {
  const { profile, user } = useAuth();
  const [message, setMessage] = useState('');
  const [state, setState] = useState<SendState>('idle');
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, []);

  const handleClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setMessage('');
    setState('idle');
    onClose();
  };

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || state === 'sending' || state === 'sent') {
      return;
    }

    setState('sending');
    try {
      await createFeedback(trimmed, {
        fullName: profile?.fullName || '',
        userId: user?.id,
      });
      setState('sent');
      closeTimerRef.current = setTimeout(() => {
        handleClose();
      }, 7000);
    } catch {
      setState('error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)]">
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
            <MessageSquare className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            Feedback
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close feedback"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {state === 'sent' ? (
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Thanks for the feedback! This window will close in a few seconds.
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Share a feature request or bug report.
              </p>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Type your feedback..."
                rows={4}
                className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              {state === 'error' && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  Failed to send feedback. Please try again.
                </p>
              )}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!message.trim() || state === 'sending'}
                >
                  <Send className="w-4 h-4" />
                  {state === 'sending' ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
