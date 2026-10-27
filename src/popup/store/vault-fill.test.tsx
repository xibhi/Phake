import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useStore } from './useStore';
import { storage } from '../../lib/storage';
import { UnlockVault } from '../tabs/Vault/UnlockVault';
import { FillerTab } from '../tabs/Filler/FillerTab';
import { VaultEntry, MailboxAccount, PageAnalysisResult } from '../../lib/types';

describe('Vault Creation & Fill Persistence, Auto-Reset, and Eye Button', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await storage.clearAllData();
    useStore.setState({
      isVaultInitialized: false,
      isVaultUnlocked: false,
      masterPasswordSession: null,
      vaultEntries: [],
      mailboxes: [],
      pendingVaultEntries: [],
      pendingMailboxes: [],
      pendingFillAfterAuth: false,
      fillSuccess: false,
      fillError: null,
      activeTab: 'filler',
      generatedFields: [
        { id: 'f1', label: 'Email', type: 'email', value: 'alice_temp@mail.tm', selector: '#email' },
        { id: 'f2', label: 'Password', type: 'password', value: 'SecretP@ss123!', selector: '#password' },
        { id: 'f3', label: 'Username', type: 'username', value: 'alice99', selector: '#username' },
      ],
      pageAnalysis: {
        url: 'https://example.com/signup',
        hostname: 'example.com',
        title: 'Example Signup',
        fields: [{ selector: '#email', type: 'email', value: '' }],
        formCount: 1,
        timestamp: Date.now(),
      } as PageAnalysisResult,
    });
  });

  it('1. captures generated details to pending vault entries and pending mailboxes when fill is attempted before vault creation', async () => {
    const store = useStore.getState();
    expect(store.isVaultInitialized).toBe(false);

    // Attempt executeFill while vault is not initialized
    const fillResult = await store.executeFill();
    expect(fillResult).toBe(false);

    // State should have switched to vault tab with pendingFillAfterAuth
    const updatedStore = useStore.getState();
    expect(updatedStore.pendingFillAfterAuth).toBe(true);
    expect(updatedStore.activeTab).toBe('vault');

    // Pending entries should contain the generated credential
    expect(updatedStore.pendingVaultEntries.length).toBe(1);
    expect(updatedStore.pendingVaultEntries[0].hostname).toBe('example.com');
    expect(updatedStore.pendingVaultEntries[0].primaryIdentifier).toBe('alice_temp@mail.tm');
    expect(updatedStore.pendingVaultEntries[0].password).toBe('SecretP@ss123!');
    expect(updatedStore.pendingVaultEntries[0].fields['Email']).toBe('alice_temp@mail.tm');

    // Storage should also have the pending entry
    const savedPending = await storage.getPendingVaultEntries();
    expect(savedPending.length).toBe(1);
    expect(savedPending[0].primaryIdentifier).toBe('alice_temp@mail.tm');

    // Pending mailboxes should also have the mailbox account
    expect(updatedStore.pendingMailboxes.length).toBe(1);
    expect(updatedStore.pendingMailboxes[0].address).toBe('alice_temp@mail.tm');
  });

  it('2. merges pending entries and mailboxes into vault during setupVault', async () => {
    const store = useStore.getState();
    await store.executeFill();

    // Now user sets up the vault with password & recovery key
    const setupSuccess = await store.setupVault('MyMasterPass123!', '1234-5678-9012-3456-7890-1234');
    expect(setupSuccess).toBe(true);

    const afterSetupStore = useStore.getState();
    expect(afterSetupStore.isVaultInitialized).toBe(true);
    expect(afterSetupStore.isVaultUnlocked).toBe(true);

    // The vault entries should now contain the credential filled before vault creation!
    expect(afterSetupStore.vaultEntries.length).toBe(1);
    expect(afterSetupStore.vaultEntries[0].primaryIdentifier).toBe('alice_temp@mail.tm');
    expect(afterSetupStore.vaultEntries[0].hostname).toBe('example.com');

    // Pending entries buffer should be cleared
    expect(afterSetupStore.pendingVaultEntries.length).toBe(0);
    const storedPending = await storage.getPendingVaultEntries();
    expect(storedPending.length).toBe(0);

    // Mailboxes should contain the mailbox account
    expect(afterSetupStore.mailboxes.length).toBe(1);
    expect(afterSetupStore.mailboxes[0].address).toBe('alice_temp@mail.tm');
  });

  it('3. resets fillSuccess back to false after 2.5 seconds', async () => {
    vi.useFakeTimers();

    render(<FillerTab />);

    act(() => {
      useStore.setState({ fillSuccess: true });
    });

    expect(useStore.getState().fillSuccess).toBe(true);

    // Fast-forward by 2400ms (not yet expired)
    act(() => {
      vi.advanceTimersByTime(2400);
    });
    expect(useStore.getState().fillSuccess).toBe(true);

    // Fast-forward past 2500ms
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(useStore.getState().fillSuccess).toBe(false);

    vi.useRealTimers();
  });

  it('4. provides eye buttons to toggle password visibility in UnlockVault and recovery modal', () => {
    render(
      <UnlockVault
        onUnlock={vi.fn()}
        onReset={vi.fn()}
        error={null}
      />
    );

    // 1. Check Master Password field visibility toggle
    const passwordInput = screen.getByPlaceholderText('Enter master password...') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    // Click Master Password eye button
    const eyeButtons = screen.getAllByRole('button');
    const masterPasswordEyeBtn = eyeButtons.find((btn) => btn.querySelector('svg'));
    expect(masterPasswordEyeBtn).toBeDefined();

    fireEvent.click(masterPasswordEyeBtn!);
    expect(passwordInput.type).toBe('text');

    fireEvent.click(masterPasswordEyeBtn!);
    expect(passwordInput.type).toBe('password');

    // 2. Open Forgot Password modal
    const forgotPasswordBtn = screen.getByText('Forgot password?');
    fireEvent.click(forgotPasswordBtn);

    // Recovery inputs should appear
    const newPasswordInput = screen.getByPlaceholderText('At least 8 characters...') as HTMLInputElement;
    const confirmPasswordInput = screen.getByPlaceholderText('Re-enter password...') as HTMLInputElement;
    expect(newPasswordInput.type).toBe('password');
    expect(confirmPasswordInput.type).toBe('password');

    // Find the eye buttons in the modal
    const newPassEyeBtn = newPasswordInput.parentElement?.querySelector('button');
    expect(newPassEyeBtn).toBeDefined();
    fireEvent.click(newPassEyeBtn!);
    expect(newPasswordInput.type).toBe('text');
    fireEvent.click(newPassEyeBtn!);
    expect(newPasswordInput.type).toBe('password');

    // Toggle confirm password
    const confirmPassEyeBtn = confirmPasswordInput.parentElement?.querySelector('button');
    expect(confirmPassEyeBtn).toBeDefined();
    fireEvent.click(confirmPassEyeBtn!);
    expect(confirmPasswordInput.type).toBe('text');
    fireEvent.click(confirmPassEyeBtn!);
    expect(confirmPasswordInput.type).toBe('password');
  });
});
