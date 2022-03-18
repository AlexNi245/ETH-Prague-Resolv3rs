import { JsonRpcProvider } from '@ethersproject/providers';
import { getAccountDisplayName } from './Account';
import { Connection } from './Web3Provider';
import { ConnectionState } from './Web3Provider';

test('get correct account display name', async () => {
    const ensNames = new Map();
    ensNames.set('0xDd36ae7F9a8E34FACf1e110c6e9d37D0dc917855', 'test1');
    expect(
        getAccountDisplayName(
            '0xDd36ae7F9a8E34FACf1e110c6e9d37D0dc917855',
            ensNames,
        ),
    ).toStrictEqual('test1');

    expect(
        getAccountDisplayName(
            '0x25A643B6e52864d0eD816F1E43c0CF49C83B8292',
            ensNames,
        ),
    ).toStrictEqual('0x25...8292');
});