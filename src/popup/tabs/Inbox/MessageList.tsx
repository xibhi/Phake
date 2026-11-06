import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  RotateCw,
  Copy,
  Check,
  Mail,
  Paperclip,
  Trash2,
  Inbox as InboxIcon,
} from 'lucide-react';
import { MailboxAccount, MailMessageSummary } from '../../../lib/types';
import { Card } from '../../components/Card';
import { SectionHeader } from '../../components/SectionHeader';

interface MessageListProps {
  mailbox: MailboxAccount;
  messages: MailMessageSummary[];
  isLoading: boolean;
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onSelectMessage: (msg: MailMessageSummary) => void;
  onDeleteMailbox: (id: string) => Promise<void>;
}

export const MessageList: React.FC<MessageListProps> = ({
  mailbox,
  messages,
  isLoading,
  onBack,
  onRefresh,
  onSelectMessage,
  onDeleteMailbox,
}) => {
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Poll for new messages every 6 seconds while open and fetch once on open
  useEffect(() => {
    onRefresh();
    const interval = setInterval(() => {
      onRefresh();
    }, 6000);
    return () => clearInterval(interval);
  }, [mailbox.id]);

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(mailbox.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDelete = () => {
    onDeleteMailbox(mailbox.id);
  };

  return (
    <div className="flex flex-col gap-card-gap p-4 animate-fade-in">
      {/* Top Navigation & Actions */}
      <div className="flex items-center justify-between pb-1">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[13px] font-medium text-[#8E8E93] hover:text-white transition-colors focus:outline-none cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Inboxes</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onRefresh()}
            disabled={isLoading}
            className="w-7 h-7 rounded-full bg-[#48484C] hover:bg-[#58585C] border border-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors focus:outline-none cursor-pointer shadow-sm"
            title="Refresh"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-7 h-7 rounded-full bg-[#48484C] hover:bg-red-500/20 border border-white/20 flex items-center justify-center text-white/80 hover:text-red-400 transition-colors focus:outline-none cursor-pointer shadow-sm"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mailbox Header Card */}
      <Card className="p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <div className="w-8 h-8 rounded-full bg-[#48484C] border border-white/20 flex items-center justify-center shrink-0 shadow-sm">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13.5px] font-bold text-white truncate font-mono">
              {mailbox.address}
            </span>
            <span className="text-[10.5px] text-[#8E8E93] mt-0.5">
              Auto-polling every 6s
            </span>
          </div>
        </div>

        <button
          onClick={handleCopyAddress}
          className="px-3 py-1 rounded-full bg-[#48484C] border border-white/20 hover:bg-[#58585C] text-white text-[11.5px] font-medium transition-colors shrink-0 flex items-center gap-1 cursor-pointer shadow-sm"
          title="Copy Address"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </Card>

      {/* Messages List */}
      <div>
        <SectionHeader
          title={`Messages (${messages.length})`}
        />

        {messages.length === 0 ? (
          <Card className="p-6 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-full bg-[#48484C] border border-white/20 flex items-center justify-center mb-2.5 shadow-sm">
              <InboxIcon className="w-5 h-5 text-white/70" />
            </div>
            <span className="text-[13.5px] font-semibold text-white">
              No messages
            </span>
            <p className="text-[11.5px] text-[#8E8E93] max-w-[240px] mt-1 leading-relaxed">
              Waiting for incoming emails.
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-white/5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => onSelectMessage(msg)}
                className="flex flex-col py-row-py px-row-px hover:bg-white/[0.04] active:opacity-80 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[11.5px] mb-0.5">
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    {!msg.seen && (
                      <span className="w-2 h-2 rounded-full bg-white shrink-0 shadow-[0_0_6px_rgba(255,255,255,0.7)]" />
                    )}
                    <span
                      className={`truncate ${
                        !msg.seen ? 'font-bold text-white' : 'font-medium text-[#8E8E93]'
                      }`}
                    >
                      {msg.from.name || msg.from.address}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[#8E8E93] text-[10.5px] shrink-0">
                    {msg.hasAttachments && <Paperclip className="w-3 h-3 text-[#8E8E93]" />}
                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <span
                  className={`text-[13.5px] truncate ${
                    !msg.seen ? 'font-bold text-white' : 'font-medium text-white/90'
                  }`}
                >
                  {msg.subject || '(No subject)'}
                </span>

                <span className="text-[11px] text-[#8E8E93] truncate mt-0.5">
                  {msg.intro || 'Click to view body'}
                </span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
};
