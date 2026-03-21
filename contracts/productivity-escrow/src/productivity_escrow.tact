import "@stdlib/deploy";
import "@stdlib/ownable";

// Messages

message CreateChallenge {
    beneficiary: Address;
    challengeId: String;
    totalCheckpoints: Int as uint32;
    endDate: Int as uint64;
    unlisted: Bool;
}

message AddFunds {
    challengeIdx: Int as uint32;
}

message ClaimCheckpoint {
    challengeIdx: Int as uint32;
    checkpointIndex: Int as uint32;
    signature: Slice;
}

message RefundUnclaimed {
    challengeIdx: Int as uint32;
}

// On-chain challenge record
struct ChallengeData {
    sponsor: Address;
    beneficiary: Address;
    challengeId: String;
    totalDeposit: Int as coins;
    totalCheckpoints: Int as uint32;
    amountPerCheckpoint: Int as coins;
    claimedCount: Int as uint32;
    endDate: Int as uint64;
    createdAt: Int as uint64;
    active: Bool;
    unlisted: Bool;
}

contract ProductivityEscrow with Deployable, Ownable {
    owner: Address;
    verifierPublicKey: Int as uint256;
    challengeCount: Int as uint32 = 0;

    challenges: map<Int, ChallengeData>;
    // Claimed checkpoints keyed by: hash(challengeIdx ++ checkpointIdx)
    claimedCheckpoints: map<Int, Bool>;
    // Sponsor contributions keyed by: hash(challengeIdx ++ sponsorAddress)
    sponsorContributions: map<Int, Int>;

    feeWalletA: Address;
    feeWalletB: Address;

    init(owner: Address, verifierPublicKey: Int, feeWalletA: Address, feeWalletB: Address) {
        self.owner = owner;
        self.verifierPublicKey = verifierPublicKey;
        self.feeWalletA = feeWalletA;
        self.feeWalletB = feeWalletB;
    }

    // Sponsor creates and funds a challenge by sending TON with this message.
    // challengeId is a human-readable label (e.g. GITHUB:COMMIT:5).
    // The contract assigns a unique sequential index.
    receive(msg: CreateChallenge) {
        let ctx: Context = context();
        require(ctx.value > ton("0.05"), "Insufficient deposit. Must send TON to fund the challenge.");
        require(msg.totalCheckpoints > 0, "Must have at least 1 checkpoint");
        require(msg.endDate > now(), "End date must be in the future");

        let deposit: Int = ctx.value - ton("0.05");
        let amountPerCheckpoint: Int = deposit / msg.totalCheckpoints;
        require(amountPerCheckpoint > 0, "Deposit too small for checkpoint count");

        let idx: Int = self.challengeCount;

        self.challenges.set(idx, ChallengeData{
            sponsor: ctx.sender,
            beneficiary: msg.beneficiary,
            challengeId: msg.challengeId,
            totalDeposit: deposit,
            totalCheckpoints: msg.totalCheckpoints,
            amountPerCheckpoint: amountPerCheckpoint,
            claimedCount: 0,
            endDate: msg.endDate,
            createdAt: now(),
            active: true,
            unlisted: msg.unlisted
        });

        // Track initial sponsor contribution
        let contribKey: Int = beginCell()
            .storeUint(idx, 32)
            .storeAddress(ctx.sender)
            .endCell()
            .hash();
        self.sponsorContributions.set(contribKey, deposit);

        self.challengeCount = idx + 1;
    }

    // Anyone can add funds to an active challenge.
    receive(msg: AddFunds) {
        let ctx: Context = context();

        let challenge: ChallengeData? = self.challenges.get(msg.challengeIdx);
        require(challenge != null, "Challenge not found");
        let cd: ChallengeData = challenge!!;

        require(cd.active, "Challenge is not active");
        require(now() <= cd.endDate, "Challenge has expired");
        require(ctx.value > ton("0.01"), "Must send more than 0.01 TON");

        let addedDeposit: Int = ctx.value - ton("0.01");
        let newTotalDeposit: Int = cd.totalDeposit + addedDeposit;
        let newAmountPerCheckpoint: Int = newTotalDeposit / cd.totalCheckpoints;

        self.challenges.set(msg.challengeIdx, ChallengeData{
            sponsor: cd.sponsor,
            beneficiary: cd.beneficiary,
            challengeId: cd.challengeId,
            totalDeposit: newTotalDeposit,
            totalCheckpoints: cd.totalCheckpoints,
            amountPerCheckpoint: newAmountPerCheckpoint,
            claimedCount: cd.claimedCount,
            endDate: cd.endDate,
            createdAt: cd.createdAt,
            active: cd.active,
            unlisted: cd.unlisted
        });

        // Track this sponsor's contribution (accumulate)
        let contribKey: Int = beginCell()
            .storeUint(msg.challengeIdx, 32)
            .storeAddress(ctx.sender)
            .endCell()
            .hash();
        let existing: Int? = self.sponsorContributions.get(contribKey);
        let prev: Int = 0;
        if (existing != null) {
            prev = existing!!;
        }
        self.sponsorContributions.set(contribKey, prev + addedDeposit);
    }

    // Beneficiary claims a checkpoint with a backend-signed proof.
    // Uses challengeIdx (sequential index) for unambiguous lookup.
    receive(msg: ClaimCheckpoint) {
        let ctx: Context = context();

        let challenge: ChallengeData? = self.challenges.get(msg.challengeIdx);
        require(challenge != null, "Challenge not found");
        let cd: ChallengeData = challenge!!;

        require(cd.active, "Challenge is not active");
        require(ctx.sender == cd.beneficiary, "Only beneficiary can claim");
        require(now() > cd.endDate, "Challenge has not ended yet");
        require(msg.checkpointIndex < cd.totalCheckpoints, "Invalid checkpoint index");

        // Collision-free claim key
        let claimKey: Int = beginCell()
            .storeUint(msg.challengeIdx, 32)
            .storeUint(msg.checkpointIndex, 32)
            .endCell()
            .hash();
        require(self.claimedCheckpoints.get(claimKey) == null, "Checkpoint already claimed");

        // Verify backend signature over: challengeIdx + checkpointIndex + beneficiary
        let dataHash: Int = beginCell()
            .storeUint(msg.challengeIdx, 32)
            .storeUint(msg.checkpointIndex, 32)
            .storeAddress(cd.beneficiary)
            .endCell()
            .hash();

        require(checkSignature(dataHash, msg.signature, self.verifierPublicKey), "Invalid signature");

        // Mark claimed
        self.claimedCheckpoints.set(claimKey, true);
        let newClaimedCount: Int = cd.claimedCount + 1;

        let updatedActive: Bool = newClaimedCount < cd.totalCheckpoints;
        self.challenges.set(msg.challengeIdx, ChallengeData{
            sponsor: cd.sponsor,
            beneficiary: cd.beneficiary,
            challengeId: cd.challengeId,
            totalDeposit: cd.totalDeposit,
            totalCheckpoints: cd.totalCheckpoints,
            amountPerCheckpoint: cd.amountPerCheckpoint,
            claimedCount: newClaimedCount,
            endDate: cd.endDate,
            createdAt: cd.createdAt,
            active: updatedActive,
            unlisted: cd.unlisted
        });

        send(SendParameters{
            to: cd.beneficiary,
            value: cd.amountPerCheckpoint,
            mode: SendPayGasSeparately,
            body: "Checkpoint reward".asComment()
        });
    }

    // Sponsor refunds unclaimed amount after challenge ends.
    // For sponsored challenges (sponsor != beneficiary): refund goes to sponsor.
    // For personal challenges (sponsor == beneficiary): 20% to feeWalletA, 80% to feeWalletB.
    receive(msg: RefundUnclaimed) {
        let ctx: Context = context();

        let challenge: ChallengeData? = self.challenges.get(msg.challengeIdx);
        require(challenge != null, "Challenge not found");
        let cd: ChallengeData = challenge!!;

        require(ctx.sender == cd.sponsor, "Only sponsor can refund");
        require(now() > cd.endDate, "Challenge has not ended yet");
        require(cd.active, "Challenge already closed");

        let unclaimedCheckpoints: Int = cd.totalCheckpoints - cd.claimedCount;
        let refundAmount: Int = unclaimedCheckpoints * cd.amountPerCheckpoint;

        self.challenges.set(msg.challengeIdx, ChallengeData{
            sponsor: cd.sponsor,
            beneficiary: cd.beneficiary,
            challengeId: cd.challengeId,
            totalDeposit: cd.totalDeposit,
            totalCheckpoints: cd.totalCheckpoints,
            amountPerCheckpoint: cd.amountPerCheckpoint,
            claimedCount: cd.claimedCount,
            endDate: cd.endDate,
            createdAt: cd.createdAt,
            active: false,
            unlisted: cd.unlisted
        });

        if (refundAmount > 0) {
            if (cd.sponsor == cd.beneficiary) {
                // Personal challenge: split to fee wallets (20% A, 80% B)
                let amountA: Int = refundAmount * 20 / 100;
                let amountB: Int = refundAmount - amountA;
                if (amountA > 0) {
                    send(SendParameters{
                        to: self.feeWalletA,
                        value: amountA,
                        mode: SendPayGasSeparately,
                        body: "Personal challenge fee".asComment()
                    });
                }
                if (amountB > 0) {
                    send(SendParameters{
                        to: self.feeWalletB,
                        value: amountB,
                        mode: SendPayGasSeparately,
                        body: "Personal challenge fee".asComment()
                    });
                }
            } else {
                // Sponsored challenge: refund to sponsor
                send(SendParameters{
                    to: cd.sponsor,
                    value: refundAmount,
                    mode: SendPayGasSeparately,
                    body: "Unclaimed refund".asComment()
                });
            }
        }
    }

    // Getters

    get fun challengeCount(): Int {
        return self.challengeCount;
    }

    get fun challenge(idx: Int): ChallengeData? {
        return self.challenges.get(idx);
    }

    get fun isCheckpointClaimed(challengeIdx: Int, checkpointIdx: Int): Bool {
        let claimKey: Int = beginCell()
            .storeUint(challengeIdx, 32)
            .storeUint(checkpointIdx, 32)
            .endCell()
            .hash();
        return self.claimedCheckpoints.get(claimKey) != null;
    }

    get fun sponsorContribution(challengeIdx: Int, sponsor: Address): Int {
        let contribKey: Int = beginCell()
            .storeUint(challengeIdx, 32)
            .storeAddress(sponsor)
            .endCell()
            .hash();
        let val: Int? = self.sponsorContributions.get(contribKey);
        if (val != null) {
            return val!!;
        }
        return 0;
    }

    get fun verifierPublicKey(): Int {
        return self.verifierPublicKey;
    }
}
