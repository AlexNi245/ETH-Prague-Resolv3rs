import axios from 'axios';
import { log } from '../log';
import { EncryptionEnvelop, Envelop, Message } from '../Messaging';
import { ApiConnection, Account, Keys, EncryptedKeys } from '../Web3Provider';

export async function submitSignedChallenge(
    challenge: string,
    signature: string,
) {
    await axios.post(
        (process.env.REACT_APP_BACKEND as string) + '/submitSignedChallenge',
        { challenge, signature },
    );
}

export async function submitKeys(
    accountAddress: string,
    encryptedKeys: Keys,
    token: string,
): Promise<void> {
    await axios.post(
        (process.env.REACT_APP_BACKEND as string) +
            '/submitKeys/' +
            accountAddress,
        { keys: encryptedKeys, token },
    );
}

export async function requestChallenge(
    account: string,
): Promise<{ challenge: string; hasEncryptionKey: boolean }> {
    return (
        await axios.post(
            (process.env.REACT_APP_BACKEND as string) +
                '/requestSignInChallenge',
            { account },
        )
    ).data;
}

export async function addContact(
    apiConnection: ApiConnection,
    contactAddress: string,
): Promise<void> {
    await axios.post(
        (process.env.REACT_APP_BACKEND as string) +
            '/addContact/' +
            (apiConnection.account as Account).address,
        { contactAddress, token: apiConnection.sessionToken },
    );
}

export async function getContacts(
    account: string,
    token: string,
): Promise<Account[]> {
    return (
        await axios.post(
            (process.env.REACT_APP_BACKEND as string) +
                '/getContacts/' +
                account,
            { token },
        )
    ).data;
}

export async function submitMessage(
    apiConnection: ApiConnection,
    envelop: Envelop | EncryptionEnvelop,
): Promise<void> {
    if (apiConnection.socket) {
        log(`Submitting message`);
        apiConnection.socket.emit('submitMessage', {
            envelop,
            token: apiConnection.sessionToken,
        });
    }
}

export async function getMessages(
    apiConnection: ApiConnection,
    contact: string,
): Promise<Envelop[]> {
    return (
        await axios.post(
            (process.env.REACT_APP_BACKEND as string) +
                '/getMessages/' +
                apiConnection.account.address,
            { contact, token: apiConnection.sessionToken },
        )
    ).data.messages;
}

export async function getPublicKeys(
    contact: string,
): Promise<Partial<Keys> | undefined> {
    return (
        await axios.get(
            (process.env.REACT_APP_BACKEND as string) +
                '/getPublicKeys/' +
                contact,
        )
    ).data;
}

export async function getKeys(
    accountAddress: string,
    sessionToken: string,
): Promise<EncryptedKeys | undefined> {
    return (
        await axios.post(
            (process.env.REACT_APP_BACKEND as string) +
                '/getKeys/' +
                accountAddress,
            { token: sessionToken },
        )
    ).data.keys;
}