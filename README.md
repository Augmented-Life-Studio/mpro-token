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
npx hardhat --network goerli deploy --tags MPROSource
npx hardhat --network bsc-testnet deploy --tags MPRORemote
```

2. Set the "trusted remotes" (ie: your contracts) so each of them can receive messages from one another, and `only` one another.

```shell
npx hardhat --network bsc-testnet setTrustedRemote --target-network goerli --contract MPROLight
npx hardhat --network goerli setTrustedRemote --target-network bsc-testnet --contract MPRO
```

3. Set the "minDstGas" required on the destination chain.

```shell
npx hardhat --network bsc-testnet setMinDstGas --packet-type 0 --target-network goerli --contract MPROLight --min-gas 100000
npx hardhat --network goerli setMinDstGas --packet-type 0 --target-network bsc-testnet --contract MPRO --min-gas 100000
```

4. Send tokens from one chain to another.

```shell
npx hardhat --network goerli oftSendTokens --target-network bsc-testnet --qty 1 --contract MPRO
```



