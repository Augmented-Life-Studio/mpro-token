# mpro-token

### Install & Run tests

```shell
yarn install
yarn test
```

## Deploy Setup

1. Add a `.env` file (to the root project directory) with your `MNEMONIC="your mnemonic"` and fund your wallet in order to deploy!
2. Follow any of the tutorials below to deploy your contract to the desired network.

1. Deploy two contracts to the different networks

```shell
npx hardhat --network bsc deploy --tags MPROToken
npx hardhat --network polygon deploy --tags MPROToken
```

2. Set the "trusted remotes" (ie: your contracts) so each of them can receive messages from one another, and `only` one another.

```shell
npx hardhat --network bsc setTrustedRemote --target-network polygon --contract MPROToken
npx hardhat --network polygon setTrustedRemote --target-network bsc --contract MPROToken
```

3. Set the "minDstGas" required on the destination chain.

```shell
npx hardhat --network bsc setMinDstGas --packet-type 0 --target-network polygon --contract MPROToken --min-gas 100000
npx hardhat --network polygon setMinDstGas --packet-type 0 --target-network bsc --contract MPROToken --min-gas 100000
```
