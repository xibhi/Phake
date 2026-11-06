import React, { useState } from 'react';
import { Mail, Plus, ChevronRight, Trash2, Loader2, Search, Tag } from 'lucide-react';
import { MailboxAccount } from '../../../lib/types';
import { Card } from '../../components/Card';
import { SectionHeader } from '../../components/SectionHeader';
import { Modal } from '../../components/Modal';
import { useStore } from '../../store/useStore';

interface MailboxListProps {
  mailboxes: MailboxAccount[];
  isCreating: boolean;
  onSelectMailbox: (mailbox: MailboxAccount) => void;
  onCreateMailbox: (nameTag?: string) => Promise<void>;
  onRequestDeleteMailbox: (id: string, address: string) => void;
}

export const MailboxList: React.FC<MailboxListProps> = ({
  mailboxes,
  isCreating,
  onSelectMailbox,
  onCreateMailbox,
  onRequestDeleteMailbox,
}) => {
  const mailboxSearchQuery = useStore((s) => s.mailboxSearchQuery);
  const setMailboxSearchQuery = useStore((s) => s.setMailboxSearchQuery);
  const vaultEntries = useStore((s) => s.vaultEntries);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newInboxName, setNewInboxName] = useState('');

  const handleDeleteClick = (e: React.MouseEvent, id: string, address: string) => {
    e.stopPropagation();
    onRequestDeleteMailbox(id, address);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInboxName.trim()) return;
    await onCreateMailbox(newInboxName.trim());
    setNewInboxName('');
    setIsCreateModalOpen(false);
  };

  const getMailboxTags = (mb: MailboxAccount) => {
    const matchedEntry = vaultEntries.find((e) =>
      Object.values(e.fields || {}).some((v) => v.toLowerCase() === mb.address.toLowerCase()) ||
      e.primaryIdentifier.toLowerCase() === mb.address.toLowerCase()
    );
    const nameTag = mb.nameTag || matchedEntry?.primaryIdentifier;
    const hostname = mb.associatedHostname || matchedEntry?.hostname;
    return { nameTag, hostname };
  };

  const filteredMailboxes = mailboxes.filter((mb) => {
    const q = mailboxSearchQuery.toLowerCase().trim();
    if (!q) return true;
    const { nameTag, hostname } = getMailboxTags(mb);
    const addr = (mb.address || '').toLowerCase();
    const host = (hostname || '').toLowerCase();
    const tag = (nameTag || '').toLowerCase();
    return addr.includes(q) || host.includes(q) || tag.includes(q);
  });

  return (
    <div className="flex flex-col gap-card-gap p-4 animate-fade-in">
      {/* Top Header with Create Action */}
      <div className="flex items-center justify-between">
        <SectionHeader title="Inboxes" className="!mb-0" />
        <button
          onClick={() => {
            setNewInboxName('');
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black font-semibold text-[11.5px] hover:bg-neutral-200 active:scale-95 transition-all shadow-sm cursor-pointer"
          title="New Inbox"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>New Inbox</span>
        </button>
      </div>

      {/* Search Input Bar matching Vault */}
      <div className="relative flex items-center">
        <Search className="w-4 h-4 absolute left-3.5 text-white/60 pointer-events-none" />
        <input
          type="text"
          value={mailboxSearchQuery}
          onChange={(e) => setMailboxSearchQuery(e.target.value)}
          placeholder="Search inboxes..."
          className="w-full bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 hover:border-white/30 focus:border-white/50 text-white text-[13px] rounded-xl pl-9 pr-3 py-2 focus:outline-none transition-colors placeholder:text-white/60 shadow-sm"
        />
      </div>

      {/* Mailboxes List */}
      <div>
        <SectionHeader title={`Inboxes (${filteredMailboxes.length})`} />

        {filteredMailboxes.length === 0 ? (
          <Card className="p-6 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-full bg-[#48484C] border border-white/20 flex items-center justify-center mb-2.5 shadow-sm">
              <Mail className="w-5 h-5 text-white/70" />
            </div>
            <span className="text-[13.5px] font-semibold text-white">
              {mailboxSearchQuery ? 'No matches' : 'No inboxes'}
            </span>
            <p className="text-[11.5px] text-[#8E8E93] max-w-[250px] mt-1 leading-relaxed">
              {mailboxSearchQuery
                ? 'Try a different search term.'
                : 'Create an inbox or fill a form.'}
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-white/5">
            {filteredMailboxes.map((mb) => {
              const { nameTag, hostname } = getMailboxTags(mb);
              return (
                <div
                  key={mb.id}
                  onClick={() => onSelectMailbox(mb)}
                  className="flex items-center justify-between py-row-py px-row-px hover:bg-white/[0.04] active:opacity-80 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2 flex-1">
                    <div className="w-8 h-8 rounded-full bg-[#48484C] border border-white/20 flex items-center justify-center shrink-0 shadow-sm">
                      <Mail className="w-4 h-4 text-white group-hover:scale-105 transition-transform" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[13px] font-bold text-white truncate font-mono">
                        {mb.address}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {nameTag && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#525258] border border-white/25 text-white font-semibold truncate max-w-[130px] shadow-sm">
                            {nameTag}
                          </span>
                        )}
                        {hostname && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#48484C] border border-white/20 text-white/80 truncate max-w-[120px] shadow-sm">
                            {hostname}
                          </span>
                        )}
                        <span className="text-[10px] text-[#8E8E93]">
                          {new Date(mb.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {mb.unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-white text-black text-[10px] font-bold">
                        {mb.unreadCount} new
                      </span>
                    )}
                    <button
                      onClick={(e) => handleDeleteClick(e, mb.id, mb.address)}
                      className="w-7 h-7 rounded-full bg-[#48484C] border border-white/20 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center text-white/80 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer shadow-sm"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-[#8E8E93] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>

      {/* Create New Inbox Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="New Inbox"
      >
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-3">
          <p className="text-[12px] text-[#8E8E93] leading-relaxed">
            Add a name tag to identify this inbox.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#8E8E93] flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-white/70" />
              <span>Name / Tag</span>
            </label>
            <input
              type="text"
              value={newInboxName}
              onChange={(e) => setNewInboxName(e.target.value)}
              placeholder="e.g. Work, Shopping"
              autoFocus
              required
              className="w-full bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 text-white text-[13px] rounded-xl px-3 py-2 focus:outline-none transition-colors shadow-sm placeholder:text-white/50"
            />
          </div>

          <div className="flex gap-2 pt-1.5">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="flex-1 h-9 rounded-xl bg-[#48484C] hover:bg-[#58585C] border border-white/20 text-white/80 hover:text-white text-[13px] font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !newInboxName.trim()}
              className="flex-1 h-9 rounded-xl bg-white text-black hover:bg-neutral-200 text-[13px] font-bold transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{isCreating ? 'Creating...' : 'Create'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
