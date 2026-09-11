// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Forces Hardhat to compile the real Semaphore protocol contracts (not just the interface
// SemaphoreRoleGroups.sol imports) so test/SemaphoreRoleGroups.test.ts can deploy a real local
// instance via ethers.getContractFactory("Semaphore")/("SemaphoreVerifier") -- exercising real
// circuit/verifier logic instead of a hand-rolled mock (T-015).
import {Semaphore} from "@semaphore-protocol/contracts/Semaphore.sol";
import {SemaphoreVerifier} from "@semaphore-protocol/contracts/base/SemaphoreVerifier.sol";
import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";
