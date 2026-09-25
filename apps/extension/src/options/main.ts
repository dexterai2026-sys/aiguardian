// Options page (docs/phase-2-plan.md, PR 14, PR 15): the mode toggle (personal/family), age
// profile, and the local, device-only encrypted personal vault
// (docs/adr/0007-local-vault-crypto-choices.md). The passphrase and decrypted vault contents live
// only in this page's memory for as long as it's open ("unlocked") - nothing is cached across page
// loads, and closing or reloading the page is itself a lock.
//
// The one exception is lib/vaultSessionCache.ts (PR 15): whenever the vault is unlocked or edited
// while family mode is on, this page also mirrors the current entries into
// chrome.storage.session, so the content scripts running on AI sites can check the AI's own
// replies against the vault too - see that file's docs for the full reasoning (why this exists,
// why it's family-mode-only, and its own auto-lock). Locking *this page's* view of the vault
// (below) deliberately does not clear that cache - it has its own independent lifetime so response
// flagging on AI sites keeps working after Settings is closed, which is the entire point of it
// existing.
export {}; // See popup/main.ts's matching comment for why.

import type { AgeProfile, Mode, VaultEntry } from "@guardian/engine-ts";
import { getAgeProfile, getMode, setAgeProfile, setMode } from "../lib/familyModeStorage.js";
import { VaultDecryptionError } from "../lib/vaultCrypto.js";
import { clearVaultSessionCache, setVaultSessionCache } from "../lib/vaultSessionCache.js";
import { getVaultBlob, loadVault, saveVault } from "../lib/vaultStorage.js";

async function initModeSection(): Promise<void> {
  const personalRadio = document.querySelector<HTMLInputElement>("#mode-personal");
  const familyRadio = document.querySelector<HTMLInputElement>("#mode-family");
  const ageProfileSelect = document.querySelector<HTMLSelectElement>("#age-profile");
  if (!personalRadio || !familyRadio || !ageProfileSelect) {
    return;
  }

  const [mode, ageProfile] = await Promise.all([getMode(), getAgeProfile()]);
  (mode === "family" ? familyRadio : personalRadio).checked = true;
  ageProfileSelect.value = ageProfile;

  const onModeChange = (): void => {
    const newMode: Mode = familyRadio.checked ? "family" : "personal";
    void setMode(newMode);
    if (newMode === "personal") {
      // Family-mode response flagging (PR 15) is the only consumer of the vault session cache -
      // switching away from family mode means nothing should still be able to read it. (Switching
      // *into* family mode while the vault happens to already be unlocked in this same page load
      // is a narrower case, covered by initVaultSection's own syncSessionCache() calls instead.)
      void clearVaultSessionCache();
    }
  };
  personalRadio.addEventListener("change", onModeChange);
  familyRadio.addEventListener("change", onModeChange);

  ageProfileSelect.addEventListener("change", () => {
    void setAgeProfile(ageProfileSelect.value as AgeProfile);
  });
}

function renderVaultEntries(listElement: HTMLUListElement, entries: VaultEntry[]): void {
  listElement.innerHTML = "";
  for (const entry of entries) {
    const item = document.createElement("li");
    item.textContent = `${entry.category}: ${entry.value} `;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "guardian-vault-remove";
    removeButton.textContent = "Remove";
    removeButton.dataset.entryId = entry.id;
    item.appendChild(removeButton);

    listElement.appendChild(item);
  }
}

function initVaultSection(): void {
  const passphraseInput = document.querySelector<HTMLInputElement>("#vault-passphrase");
  const unlockButton = document.querySelector<HTMLButtonElement>("#vault-unlock");
  const errorElement = document.querySelector<HTMLElement>("#vault-error");
  const lockedView = document.querySelector<HTMLElement>("#vault-locked");
  const unlockedView = document.querySelector<HTMLElement>("#vault-unlocked");
  const entryList = document.querySelector<HTMLUListElement>("#vault-entry-list");
  const addForm = document.querySelector<HTMLFormElement>("#vault-add-form");
  const addCategory = document.querySelector<HTMLSelectElement>("#vault-add-category");
  const addValue = document.querySelector<HTMLInputElement>("#vault-add-value");
  const lockButton = document.querySelector<HTMLButtonElement>("#vault-lock");

  if (
    !passphraseInput ||
    !unlockButton ||
    !errorElement ||
    !lockedView ||
    !unlockedView ||
    !entryList ||
    !addForm ||
    !addCategory ||
    !addValue ||
    !lockButton
  ) {
    return;
  }

  // Held only in this closure, for as long as the page stays open - never written to storage or
  // any dataset attribute. Reloading or closing this page discards it, which is the "lock".
  let unlockedPassphrase: string | null = null;
  let entries: VaultEntry[] = [];

  function showUnlocked(): void {
    lockedView!.hidden = true;
    unlockedView!.hidden = false;
    renderVaultEntries(entryList!, entries);
  }

  function showLocked(): void {
    unlockedPassphrase = null;
    entries = [];
    passphraseInput!.value = "";
    lockedView!.hidden = false;
    unlockedView!.hidden = true;
    errorElement!.hidden = true;
  }

  // Tracks the latest save so "Lock" (below) can wait for it before clearing in-memory state -
  // without this, a quick add-then-lock could clear `entries` while the previous save was still
  // in flight (PBKDF2 alone takes real time - see vaultCrypto.ts), silently discarding the edit.
  let pendingPersist: Promise<void> = Promise.resolve();

  function persist(): void {
    if (!unlockedPassphrase) {
      return;
    }
    pendingPersist = saveVault(unlockedPassphrase, { entries });
  }

  // Keeps lib/vaultSessionCache.ts (PR 15's bridge to family-mode response flagging on AI sites)
  // in sync with this page's own in-memory entries - only ever populated in family mode, so a
  // personal-mode user gets no additional exposure from this cache existing at all.
  async function syncSessionCache(): Promise<void> {
    if ((await getMode()) === "family") {
      await setVaultSessionCache(entries);
    }
  }

  unlockButton.addEventListener("click", () => {
    void (async () => {
      const passphrase = passphraseInput.value;
      if (passphrase.length === 0) {
        return;
      }
      errorElement.hidden = true;

      try {
        const blob = await getVaultBlob();
        if (blob) {
          const contents = await loadVault(passphrase);
          entries = contents?.entries ?? [];
        } else {
          // No vault exists yet - the entered passphrase creates a brand new, empty one.
          entries = [];
          await saveVault(passphrase, { entries });
        }
        unlockedPassphrase = passphrase;
        showUnlocked();
        void syncSessionCache();
      } catch (error) {
        if (error instanceof VaultDecryptionError) {
          errorElement.textContent = "Incorrect passphrase.";
          errorElement.hidden = false;
        } else {
          throw error;
        }
      }
    })();
  });

  addForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = addValue.value.trim();
    if (value.length === 0) {
      return;
    }
    entries = [
      ...entries,
      { id: crypto.randomUUID(), category: addCategory.value as VaultEntry["category"], value },
    ];
    addValue.value = "";
    renderVaultEntries(entryList, entries);
    persist();
    void syncSessionCache();
  });

  entryList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains("guardian-vault-remove")) {
      return;
    }
    const entryId = target.dataset.entryId;
    entries = entries.filter((entry) => entry.id !== entryId);
    renderVaultEntries(entryList, entries);
    persist();
    void syncSessionCache();
  });

  lockButton.addEventListener("click", () => {
    void pendingPersist.finally(showLocked);
  });
}

void initModeSection();
initVaultSection();
