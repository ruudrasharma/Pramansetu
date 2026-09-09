import { expect } from "chai";
import { ethers } from "hardhat";

describe("ECDSASignatureVerifier", function () {
  let verifier: any;

  beforeEach(async function () {
    const Verifier = await ethers.getContractFactory("ECDSASignatureVerifier");
    verifier = await Verifier.deploy();
  });

  it("should verify a valid signature", async function () {
    const wallet = ethers.Wallet.createRandom();
    
    // The message we want to sign
    const message = "Hello Praman Setu";
    const messageHash = ethers.keccak256(ethers.toUtf8Bytes(message));
    
    // signMessage automatically prefixes with "\x19Ethereum Signed Message:\n" + length
    // and then hashes it, exactly matching `MessageHashUtils.toEthSignedMessageHash`
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    // wallet.signingKey.publicKey returns a hex string starting with 0x04 followed by 64 bytes
    // We slice off '0x04' (4 chars) to get the 64-byte uncompressed public key
    const pubKeyHex = "0x" + wallet.signingKey.publicKey.slice(4);
    
    const result = await verifier.verify(messageHash, signature, pubKeyHex, "ES256K");
    expect(result).to.be.true;
  });

  it("should reject an invalid signature", async function () {
    const wallet = ethers.Wallet.createRandom();
    const wrongWallet = ethers.Wallet.createRandom();

    const messageHash = ethers.keccak256(ethers.toUtf8Bytes("Test"));
    // Sign with wrong wallet
    const signature = await wrongWallet.signMessage(ethers.getBytes(messageHash));

    const pubKeyHex = "0x" + wallet.signingKey.publicKey.slice(4);
    
    const result = await verifier.verify(messageHash, signature, pubKeyHex, "ES256K");
    expect(result).to.be.false;
  });

  it("should revert on unsupported key type", async function () {
    const wallet = ethers.Wallet.createRandom();
    const messageHash = ethers.keccak256(ethers.toUtf8Bytes("Test"));
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));
    const pubKeyHex = "0x" + wallet.signingKey.publicKey.slice(4);
    
    await expect(
      verifier.verify(messageHash, signature, pubKeyHex, "RSA")
    ).to.be.revertedWithCustomError(verifier, "UnsupportedKeyType").withArgs("RSA");
  });

  it("should revert on invalid pubkey length", async function () {
    const wallet = ethers.Wallet.createRandom();
    const messageHash = ethers.keccak256(ethers.toUtf8Bytes("Test"));
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));
    
    // pass less than 64 bytes
    const invalidPubKeyHex = "0x12345678";
    
    await expect(
      verifier.verify(messageHash, signature, invalidPubKeyHex, "ES256K")
    ).to.be.revertedWith("invalid pubkey length");
  });
});
