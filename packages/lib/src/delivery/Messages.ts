import { ethers } from 'ethers';
import stringify from 'safe-stable-stringify';

import { formatAddress } from '../external-apis/InjectedWeb3API';
import { EncryptionEnvelop, Postmark, DeliveryInformation } from '../messaging';
import {
    decryptAsymmetric,
    encryptAsymmetric,
    EncryptedPayload,
    KeyPair,
    sign,
} from '../crypto';
import { sha256 } from '../shared/sha256';
import { getConversationId } from '../storage/Storage';
import { checkToken, Session } from './Session';
import { log } from '../shared/log';

export interface Acknoledgment {
    contactAddress: string;
    messageDeliveryServiceTimestamp: number;
}

// fetch new messages
export async function getMessages(
    loadMessages: (
        conversationId: string,
        offset: number,
        size: number,
    ) => Promise<EncryptionEnvelop[]>,
    encryptionKeyPair: KeyPair,
    accountAddress: string,
    contactAddress: string,
) {
    const account = formatAddress(accountAddress);
    const contact = formatAddress(contactAddress);
    const conversationId = getConversationId(contact, account);

    const receivedMessages: EncryptionEnvelop[] = await loadMessages(
        conversationId,
        0,
        50,
    );

    const envelopContainers = await Promise.all(
        receivedMessages.map(async (envelop) => ({
            to: formatAddress(
                JSON.parse(
                    await decryptAsymmetric(
                        encryptionKeyPair,
                        JSON.parse(envelop.deliveryInformation),
                    ),
                ).to,
            ),
            envelop,
        })),
    );

    return envelopContainers
        .filter((envelopContainer) => envelopContainer.to === account)
        .map((envelopContainer) => envelopContainer.envelop);
}

// buffer message until delivery and sync acknoledgment
export async function incomingMessage(
    { envelop, token }: { envelop: EncryptionEnvelop; token: string },
    signingKeyPair: KeyPair,
    encryptionKeyPair: KeyPair,
    sizeLimit: number,
    getSession: (accountAddress: string) => Promise<Session | null>,
    storeNewMessage: (
        conversationId: string,
        envelop: EncryptionEnvelop,
    ) => Promise<void>,
    send: (socketId: string, envelop: EncryptionEnvelop) => void,
): Promise<void> {
    if (messageIsToLarge(envelop, sizeLimit)) {
        throw Error('Message is too large');
    }

    const deliveryInformation: DeliveryInformation = JSON.parse(
        await decryptAsymmetric(
            encryptionKeyPair,
            JSON.parse(envelop.deliveryInformation),
        ),
    );

    const conversationId = getConversationId(
        deliveryInformation.from,
        deliveryInformation.to,
    );

    const tokenIsValid = await checkToken(
        getSession,
        deliveryInformation.from,
        token,
    );
    if (!tokenIsValid) {
        //Token is invalid
        throw Error('Token check failed');
    }

    const receiverSession = await getSession(deliveryInformation.to);
    if (receiverSession === null) {
        throw Error('unknown session');
    }

    const receiverEncryptionKey =
        receiverSession?.signedUserProfile.profile.publicEncryptionKey;

    const envelopWithPostmark: EncryptionEnvelop = {
        ...envelop,
        postmark: stringify(
            await addPostmark(
                envelop,
                receiverEncryptionKey,
                signingKeyPair.privateKey,
            ),
        ),
    };
    await storeNewMessage(conversationId, envelopWithPostmark);

    if (receiverSession?.socketId) {
        //Client is already connect to the delivery service and the message can be dispatched
        send(receiverSession.socketId, envelopWithPostmark);
    }
}

function messageIsToLarge(
    envelop: EncryptionEnvelop,
    sizeLimit: number,
): boolean {
    return Buffer.byteLength(JSON.stringify(envelop), 'utf-8') > sizeLimit;
}

async function addPostmark(
    { message }: EncryptionEnvelop,
    receiverEncryptionKey: string,
    deliveryServiceSigningKey: string,
): Promise<EncryptedPayload> {
    const postmarkWithoutSig: Omit<Postmark, 'signature'> = {
        messageHash: ethers.utils.hashMessage(stringify(message)),
        incommingTimestamp: new Date().getTime(),
    };

    const signature = await signPostmark(
        postmarkWithoutSig,
        deliveryServiceSigningKey,
    );

    //Encrypte the signed Postmark and return the ciphertext
    const { ciphertext, nonce, ephemPublicKey } = await encryptAsymmetric(
        receiverEncryptionKey,
        stringify({ ...postmarkWithoutSig, signature })!,
    );

    return {
        nonce,
        ciphertext,
        ephemPublicKey,
    };
}

function signPostmark(
    p: Omit<Postmark, 'signature'>,
    signingKey: string,
): Promise<string> {
    const postmarkHash = sha256(stringify(p));
    return sign(signingKey, postmarkHash);
}
