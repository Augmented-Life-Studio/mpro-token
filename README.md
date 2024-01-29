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
npx hardhat --network bsc-testnet deploy --tags JAKANTToken
npx hardhat --network mumbai deploy --tags JAKANTToken
```

2. Set the "trusted remotes" (ie: your contracts) so each of them can receive messages from one another, and `only` one another.

```shell
npx hardhat --network bsc-testnet setTrustedRemote --target-network mumbai --contract JAKANTToken
npx hardhat --network mumbai setTrustedRemote --target-network bsc-testnet --contract JAKANTToken
```

3. Set the "minDstGas" required on the destination chain.

```shell
npx hardhat --network bsc-testnet setMinDstGas --packet-type 0 --target-network mumbai --contract JAKANTToken --min-gas 100000
npx hardhat --network mumbai setMinDstGas --packet-type 0 --target-network bsc-testnet --contract JAKANTToken --min-gas 100000
```

4. Send tokens from one chain to another.

```shell
npx hardhat --network bsc-testnet oftSendTokens --target-network mumbai --qty 10 --contract JAKANTToken
```



