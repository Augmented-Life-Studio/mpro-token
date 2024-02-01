# mpro-token

### Install & Run tests

```shell
yarn install
yarn test
```

## Deploy Setup

1. Add a `.env` file (to the root project directory) with your `MNEMONIC="your mnemonic"` and fund your wallet in order to deploy!
2. Follow any of the tutorials below to deploy your contract to the desired network.

## Accounts setting
- In hardhat.config.js, you can set the accounts to use for deploying contracts and running tasks.
- There are named accounts (deployer, owner, vesting, helper) already set up for you. You can check them out in hardhat.config.js.
- Deployer is the account that will deploy the contracts. 
- Helper is the account that will be used to run tasks, like setting remotes etc.
IMPORTANT: helper needs to be the owner of the token contracts, so that it can set the trusted remotes.

1. Deploy two contracts to the different networks

```shell
npx hardhat --network goerli deploy --tags JAKANTSource
npx hardhat --network bsc-testnet deploy --tags JAKANTRemote
```

2. Set the "trusted remotes" (ie: your contracts) so each of them can receive messages from one another, and `only` one another.

```shell
npx hardhat --network goerli setTrustedRemote --target-network mumbai --local-contract JAKANTToken --remote-contract JAKANTTokenLight
npx hardhat --network goerli setTrustedRemote --target-network bsc-testnet --local-contract JAKANTToken --remote-contract JAKANTTokenLight

npx hardhat --network mumbai setTrustedRemote --target-network goerli --local-contract JAKANTTokenLight --remote-contract JAKANTToken
npx hardhat --network mumbai setTrustedRemote --target-network bsc-testnet --local-contract JAKANTTokenLight --remote-contract JAKANTTokenLight

npx hardhat --network bsc-testnet setTrustedRemote --target-network goerli --local-contract JAKANTTokenLight --remote-contract JAKANTToken
npx hardhat --network bsc-testnet setTrustedRemote --target-network mumbai --local-contract JAKANTTokenLight --remote-contract JAKANTTokenLight
```

3. Set the "minDstGas" required on the destination chain.

```shell
npx hardhat --network goerli setMinDstGas --packet-type 0 --target-network bsc-testnet --contract JAKANTToken --min-gas 100000
npx hardhat --network goerli setMinDstGas --packet-type 0 --target-network mumbai --contract JAKANTToken --min-gas 100000

npx hardhat --network mumbai setMinDstGas --packet-type 0 --target-network goerli --contract JAKANTTokenLight --min-gas 100000
npx hardhat --network mumbai setMinDstGas --packet-type 0 --target-network bsc-testnet --contract JAKANTTokenLight --min-gas 100000

npx hardhat --network bsc-testnet setMinDstGas --packet-type 0 --target-network goerli --contract JAKANTTokenLight --min-gas 100000
npx hardhat --network bsc-testnet setMinDstGas --packet-type 0 --target-network mumbai --contract JAKANTTokenLight --min-gas 100000
```

4. Send tokens from one chain to another.

```shell
npx hardhat --network goerli oftSendTokens --target-network bsc-testnet --qty 1000 --local-contract JAKANTToken --remote-contract JAKANTTokenLight
npx hardhat --network bsc-testnet oftSendTokens --target-network mumbai --qty 1000 --local-contract JAKANTTokenLight --remote-contract JAKANTTokenLight
npx hardhat --network mumbai oftSendTokens --target-network goerli --qty 1000 --local-contract JAKANTTokenLight --remote-contract JAKANTToken
```



