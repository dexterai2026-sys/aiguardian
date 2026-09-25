import { describe, expect, it } from "vitest";
import { decryptVault, encryptVault, VaultDecryptionError } from "./vaultCrypto.js";

describe("encryptVault / decryptVault", () => {
  it("round-trips plaintext through encryption and decryption with the right passphrase", async () => {
    const blob = await encryptVault("correct horse battery staple", '{"entries":[]}');
    const decrypted = await decryptVault("correct horse battery staple", blob);
    expect(decrypted).toBe('{"entries":[]}');
  });

  it("throws VaultDecryptionError for the wrong passphrase", async () => {
    const blob = await encryptVault("correct horse battery staple", '{"entries":[]}');
    await expect(decryptVault("wrong passphrase", blob)).rejects.toThrow(VaultDecryptionError);
  });

  it("throws VaultDecryptionError for tampered ciphertext (AES-GCM authentication)", async () => {
    const blob = await encryptVault("correct horse battery staple", '{"entries":[]}');
    const tampered = { ...blob, ciphertext: blob.ciphertext.slice(0, -4) + "abcd" };
    await expect(decryptVault("correct horse battery staple", tampered)).rejects.toThrow(
      VaultDecryptionError,
    );
  });

  it("never stores the passphrase itself in the encrypted blob", async () => {
    const passphrase = "a very specific and identifiable passphrase";
    const blob = await encryptVault(passphrase, '{"entries":[]}');
    const serialized = JSON.stringify(blob);
    expect(serialized).not.toContain(passphrase);
  });

  it("uses a fresh salt and IV on every call, even for identical input", async () => {
    const first = await encryptVault("same passphrase", "same plaintext");
    const second = await encryptVault("same passphrase", "same plaintext");
    expect(first.salt).not.toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("round-trips realistic vault JSON, including non-ASCII text", async () => {
    const plaintext = JSON.stringify({
      entries: [{ id: "1", category: "pii.name", value: "José Müller" }],
    });
    const blob = await encryptVault("passphrase", plaintext);
    await expect(decryptVault("passphrase", blob)).resolves.toBe(plaintext);
  });
});
