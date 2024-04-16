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
npx hardhat --network ethereum deploy --tags MPROSource
npx hardhat --network arbitrum deploy --tags MPRORemote
npx hardhat --network bsc deploy --tags MPRORemote
npx hardhat --network polygon deploy --tags MPRORemote
```

2. Set the "trusted remotes" (ie: your contracts) so each of them can receive messages from one another, and `only` one another.

```shell
npx hardhat --network ethereum setPeer --target-network arbitrum --local-contract MPRO --remote-contract MPROLight
npx hardhat --network ethereum setPeer --target-network bsc --local-contract MPRO --remote-contract MPROLight
npx hardhat --network ethereum setPeer --target-network polygon --local-contract MPRO --remote-contract MPROLight

npx hardhat --network bsc setPeer --target-network ethereum --local-contract MPROLight --remote-contract MPRO
npx hardhat --network bsc setPeer --target-network arbitrum --local-contract MPROLight --remote-contract MPROLight
npx hardhat --network bsc setPeer --target-network polygon --local-contract MPROLight --remote-contract MPROLight

npx hardhat --network polygon setPeer --target-network ethereum --local-contract MPROLight --remote-contract MPRO
npx hardhat --network polygon setPeer --target-network arbitrum --local-contract MPROLight --remote-contract MPROLight
npx hardhat --network polygon setPeer --target-network bsc --local-contract MPROLight --remote-contract MPROLight

npx hardhat --network arbitrum setPeer --target-network ethereum --local-contract MPROLight --remote-contract MPRO
npx hardhat --network arbitrum setPeer --target-network polygon --local-contract MPROLight --remote-contract MPROLight
npx hardhat --network arbitrum setPeer --target-network bsc --local-contract MPROLight --remote-contract MPROLight
```

4. Send tokens from one chain to another.

```shell
npx hardhat --network ethereum oftSendTokens --target-network bsc --qty 1 --local-contract MPRO --remote-contract MPROLight --from-address 0x --to-address 0x
npx hardhat --network ethereum oftSendTokens --target-network polygon --qty 1 --local-contract MPRO --remote-contract MPROLight --from-address 0x --to-address 0x
npx hardhat --network ethereum oftSendTokens --target-network arbitrum --qty 1 --local-contract MPRO --remote-contract MPROLight --from-address 0x --to-address 0x

npx hardhat --network bsc oftSendTokens --target-network ethereum --qty 1 --local-contract MPROLight --remote-contract MPRO --from-address 0x --to-address 0x
npx hardhat --network bsc oftSendTokens --target-network polygon --qty 1 --local-contract MPROLight --remote-contract MPROLight --from-address 0x --to-address 0x
npx hardhat --network bsc oftSendTokens --target-network arbitrum --qty 1 --local-contract MPROLight --remote-contract MPROLight --from-address 0x --to-address 0x

npx hardhat --network polygon oftSendTokens --target-network ethereum --qty 1 --local-contract MPROLight --remote-contract MPRO --from-address 0x --to-address 0x
npx hardhat --network polygon oftSendTokens --target-network bsc --qty 1 --local-contract MPROLight --remote-contract MPROLight --from-address 0x --to-address 0x
npx hardhat --network polygon oftSendTokens --target-network arbitrum --qty 1 --local-contract MPROLight --remote-contract MPROLight --from-address 0x --to-address 0x

npx hardhat --network arbitrum oftSendTokens --target-network ethereum --qty 1 --local-contract MPROLight --remote-contract MPRO --from-address 0x --to-address 0x
npx hardhat --network arbitrum oftSendTokens --target-network polygon --qty 1 --local-contract MPROLight --remote-contract MPROLight --from-address 0x --to-address 0x
npx hardhat --network arbitrum oftSendTokens --target-network arbitrum --qty 1 --local-contract MPROLight --remote-contract MPROLight --from-address 0x --to-address 0x
```

Short contracts description:

- MPRO: Main contract that holds the tokens and is responsible for minting and burning.
- MPROLight: Contract that is used to send tokens to other chains. It is a light version of the MPRO contract, with only the necessary functions to send tokens without mint function.

- MPROMasterDistributor: Contract that is used to distribute tokens to the users. It is responsible for distributing them to the users. Also cointains whitelist, blocklist and burn rate for the users.
- MPROMasterDistributorLight: Contract that manages whitelist, blocklist and burn rate for the users. 


<!-- PROD DEPLOY ON Ethereum and Arbitrum -->
```shell
npx hardhat --network ethereum deploy --tags MPROSource
npx hardhat --network arbitrum deploy --tags MPRORemote
```
```shell
npx hardhat --network ethereum setPeer --target-network arbitrum --local-contract MPRO --remote-contract MPROLight
npx hardhat --network arbitrum setPeer --target-network ethereum --local-contract MPROLight --remote-contract MPRO
```
```shell
npx hardhat --network ethereum setMinDstGas --packet-type 0 --target-network arbitrum --contract MPRO --min-gas 100000
npx hardhat --network arbitrum setMinDstGas --packet-type 0 --target-network ethereum --contract MPROLight --min-gas 100000
```