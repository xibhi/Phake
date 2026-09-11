import React, { useState } from 'react';
import {
  ChevronLeft,
  Trash2,
  Paperclip,
  Download,
  Clock,
  User,
  AlertCircle,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { MailMessageDetail } from '../../../lib/types';
import { Card } from '../../components/Card';

export const sanitizeEmailHtml = (rawHtml?: string[] | string): string => {
  if (!rawHtml) return '';
  const combined = Array.isArray(rawHtml) ? rawHtml.join('') : rawHtml;
  if (!combined.trim()) return '';

  return DOMPurify.sanitize(combined, {
    ALLOWED_TAGS: [
      'a', 'b', 'blockquote', 'br', 'caption', 'cite', 'code', 'col', 'colgroup',
      'dd', 'div', 'dl', 'dt', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr',
      'i', 'img', 'li', 'ol', 'p', 'pre', 's', 'small', 'span', 'strong', 'sub',
      'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'width', 'height', 'target', 'rel', 'colspan', 'rowspan'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'svg', 'math', 'base', 'link'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onmouseenter', 'onmouseleave', 'onchange', 'onsubmit'],
    ALLOW_DATA_ATTR: false,
    FORCE_BODY: true,
  });
};

interface MessageDetailProps {
  message: MailMessageDetail;
  onBack: () => void;
  onDelete: (id: string) => Promise<void>;
}

export const MessageDetail: React.FC<MessageDetailProps> = ({
  message,
  onBack,
  onDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirm('Delete this message permanently?')) {
      setIsDeleting(true);
      await onDelete(message.id);
    }
  };

  const htmlContent = sanitizeEmailHtml(message.html);

  return (
    <div className="flex flex-col gap-card-gap p-4 animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-1">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[13px] font-medium text-[#8E8E93] hover:text-white transition-colors focus:outline-none cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Messages</span>
        </button>

        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="w-7 h-7 rounded-full bg-white/[0.08] hover:bg-red-500/20 border border-white/10 flex items-center justify-center text-[#8E8E93] hover:text-red-400 transition-colors cursor-pointer"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Message Header Card */}
      <Card className="p-3.5 flex flex-col gap-2">
        <h2 className="text-[15px] font-bold text-white leading-snug">
          {message.subject || '(No subject)'}
        </h2>

        <div className="flex flex-col gap-1 pt-1 border-t border-white/5 text-[11.5px]">
          <div className="flex items-center justify-between text-[#8E8E93]">
            <div className="flex items-center gap-1.5 min-w-0">
              <User className="w-3 h-3 shrink-0" />
              <span className="truncate">
                <strong className="text-white">{message.from.name || message.from.address}</strong>
                {message.from.name && ` <${message.from.address}>`}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0 text-[#8E8E93]/80 text-[10.5px]">
              <Clock className="w-3 h-3" />
              <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          <div className="text-[#8E8E93]/70 text-[10.5px]">
            To: {message.to.map((t) => t.address).join(', ')}
          </div>
        </div>
      </Card>

      {/* Attachments Section */}
      {message.attachments && message.attachments.length > 0 && (
        <Card className="p-3 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
            <Paperclip className="w-3.5 h-3.5" />
            <span>Attachments ({message.attachments.length})</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {message.attachments.map((att) => (
              <a
                key={att.id}
                href={att.downloadUrl || '#'}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2 rounded-xl bg-white/[0.08] border border-white/10 hover:bg-white/[0.14] transition-colors text-[12px] text-white"
              >
                <span className="truncate pr-2">{att.filename}</span>
                <div className="flex items-center gap-1 text-[#8E8E93] shrink-0 text-[11px]">
                  <span>{(att.size / 1024).toFixed(1)} KB</span>
                  <Download className="w-3.5 h-3.5 ml-1" />
                </div>
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* Email Body Viewer */}
      <Card className="overflow-hidden min-h-[220px] flex flex-col">
        {htmlContent ? (
          <iframe
            title="Email Content"
            // SEC-03: sandbox="" (no flags) strictly isolates email rendering without scripts or same-origin privileges
            sandbox=""
            srcDoc={`
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <style>
                    html, body {
                      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                      font-size: 13.5px;
                      line-height: 1.5;
                      color: #FFFFFF;
                      background-color: transparent;
                      padding: 14px;
                      margin: 0;
                      word-break: break-word;
                    }
                    a { color: #60A5FA; }
                    img { max-width: 100%; height: auto; }
                  </style>
                </head>
                <body>${htmlContent}</body>
              </html>
            `}
            className="w-full h-[280px] border-0 bg-transparent"
          />
        ) : (
          <div className="p-4 text-[13.5px] text-white whitespace-pre-wrap leading-relaxed">
            {message.text || message.intro || 'No message content.'}
          </div>
        )}
      </Card>
    </div>
  );
};
