import React, { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { MailboxList } from './MailboxList';
import { MessageList } from './MessageList';
import { MessageDetail } from './MessageDetail';
import { SetupVault } from '../Vault/SetupVault';
import { UnlockVault } from '../Vault/UnlockVault';
import { AuthVerificationModal } from '../../components/AuthVerificationModal';

export const InboxTab: React.FC = () => {
  const isVaultInitialized = useStore((s) => s.isVaultInitialized);
  const isVaultUnlocked = useStore((s) => s.isVaultUnlocked);
  const vaultError = useStore((s) => s.vaultError);
  const setupVault = useStore((s) => s.setupVault);
  const unlockVault = useStore((s) => s.unlockVault);
  const resetVault = useStore((s) => s.resetVault);

  const mailboxes = useStore((s) => s.mailboxes);
  const selectedMailbox = useStore((s) => s.selectedMailbox);
  const messages = useStore((s) => s.messages);
  const selectedMessage = useStore((s) => s.selectedMessage);
  const isLoadingMessages = useStore((s) => s.isLoadingMessages);
  const isCreatingMailbox = useStore((s) => s.isCreatingMailbox);
  const inboxError = useStore((s) => s.inboxError);
  const createMailbox = useStore((s) => s.createMailbox);
  const deleteMailbox = useStore((s) => s.deleteMailbox);
  const selectMailbox = useStore((s) => s.selectMailbox);
  const fetchMessages = useStore((s) => s.fetchMessages);
  const selectMessage = useStore((s) => s.selectMessage);
  const deleteMessage = useStore((s) => s.deleteMessage);
  const clearInboxError = useStore((s) => s.clearInboxError);
  const loadMailboxes = useStore((s) => s.loadMailboxes);

  useEffect(() => {
    if (isVaultInitialized && isVaultUnlocked) {
      loadMailboxes();
    }
  }, [isVaultInitialized, isVaultUnlocked, loadMailboxes]);

  // Auth verification state for mailbox deletion
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; address: string } | null>(null);

  // Require Vault to be unlocked before viewing inboxes
  if (!isVaultInitialized) {
    return (
      <SetupVault
        onSetup={setupVault}
        error={vaultError}
      />
    );
  }

  if (isVaultInitialized && !isVaultUnlocked) {
    return (
      <UnlockVault
        onUnlock={unlockVault}
        onReset={resetVault}
        error={vaultError}
      />
    );
  }

  const handleCreateMailbox = async (nameTag?: string) => {
    await createMailbox(nameTag);
  };

  const handleRequestDelete = (id: string, address: string) => {
    setDeleteTarget({ id, address });
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      await deleteMailbox(deleteTarget.id);
      setDeleteTarget(null);
      await selectMailbox(null);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Non-crashing inline error banner */}
      {inboxError && (
        <div className="mx-4 mt-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{inboxError}</span>
          </div>
          <button
            onClick={clearInboxError}
            className="text-red-400 hover:text-white shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {selectedMessage ? (
        <MessageDetail
          message={selectedMessage}
          onBack={() => selectMessage(null)}
          onDelete={async (id) => {
            await deleteMessage(id);
          }}
        />
      ) : selectedMailbox ? (
        <MessageList
          mailbox={selectedMailbox}
          messages={messages}
          isLoading={isLoadingMessages}
          onBack={() => selectMailbox(null)}
          onRefresh={fetchMessages}
          onSelectMessage={(msg) => selectMessage(msg)}
          onDeleteMailbox={async (id) => {
            handleRequestDelete(id, selectedMailbox.address);
          }}
        />
      ) : (
        <MailboxList
          mailboxes={mailboxes}
          isCreating={isCreatingMailbox}
          onSelectMailbox={(mb) => selectMailbox(mb)}
          onCreateMailbox={handleCreateMailbox}
          onRequestDeleteMailbox={handleRequestDelete}
        />
      )}

      {/* Reusable Auth Verification Modal for Mailbox Deletion */}
      <AuthVerificationModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onVerified={handleConfirmDelete}
        title="Delete Mailbox"
        description={`Authorize deletion of mailbox "${deleteTarget?.address}".`}
        confirmButtonText="Delete Mailbox"
        isDestructive={true}
      />
    </div>
  );
};
