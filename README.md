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
npx hardhat --network base deploy --tags MPRORemote
npx hardhat --network arbitrum deploy --tags MPRORemote
npx hardhat --network bsc deploy --tags MPRORemote
npx hardhat --network polygon deploy --tags MPRORemote
```

2. Set the "trusted remotes" (ie: your contracts) so each of them can receive messages from one another, and `only` one another.

```shell
npx hardhat --network ethereum setPeer --target-network arbitrum --local-contract MPRO --remote-contract MPROLight
npx hardhat --network ethereum setPeer --target-network bsc --local-contract MPRO --remote-contract MPROLight
npx hardhat --network ethereum setPeer --target-network polygon --local-contract MPRO --remote-contract MPROLight
npx hardhat --network ethereum setPeer --target-network base --local-contract MPRO --remote-contract MPROLight

npx hardhat --network bsc setPeer --target-network ethereum --local-contract MPROLight --remote-contract MPRO
npx hardhat --network bsc setPeer --target-network arbitrum --local-contract MPROLight --remote-contract MPROLight
npx hardhat --network bsc setPeer --target-network polygon --local-contract MPROLight --remote-contract MPROLight

npx hardhat --network polygon setPeer --target-network ethereum --local-contract MPROLight --remote-contract MPRO
npx hardhat --network polygon setPeer --target-network arbitrum --local-contract MPROLight --remote-contract MPROLight
npx hardhat --network polygon setPeer --target-network bsc --local-contract MPROLight --remote-contract MPROLight

npx hardhat --network arbitrum setPeer --target-network ethereum --local-contract MPROLight --remote-contract MPRO
npx hardhat --network arbitrum setPeer --target-network polygon --local-contract MPROLight --remote-contract MPROLight
npx hardhat --network arbitrum setPeer --target-network bsc --local-contract MPROLight --remote-contract MPROLight
npx hardhat --network arbitrum setPeer --target-network base --local-contract MPROLight --remote-contract MPROLight

npx hardhat --network base setPeer --target-network ethereum --local-contract MPROLight --remote-contract MPRO
npx hardhat --network base setPeer --target-network polygon --local-contract MPROLight --remote-contract MPROLight
npx hardhat --network base setPeer --target-network bsc --local-contract MPROLight --remote-contract MPROLight
npx hardhat --network base setPeer --target-network arbitrum --local-contract MPROLight --remote-contract MPROLight
```

4. Send tokens from one chain to another.

```shell
npx hardhat --network base oftSendTokens --target-network arbitrum --qty 1 --local-contract MPRO --remote-contract MPROLight --from-address 0x --to-address 0x
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
npx hardhat --network base deploy --tags MPRORemote
npx hardhat --network base deploy --tags MPRORemote
```
```shell
npx hardhat --network ethereum setPeer --target-network arbitrum --local-contract MPRO --remote-contract MPROLight
npx hardhat --network arbitrum setPeer --target-network ethereum --local-contract MPROLight --remote-contract MPRO
npx hardhat --network base setPeer --target-network ethereum --local-contract MPROLight --remote-contract MPRO
```
<!-- VESTING DEPLOYMENT -->

```shell
npx hardhat --network ethereum deploy --tags VestingSeed
npx hardhat --network ethereum deploy --tags PrivateRoundVesting
npx hardhat --network ethereum deploy --tags FoundationVesting
npx hardhat --network ethereum deploy --tags AdvisiorsVesting
npx hardhat --network ethereum deploy --tags MarketingVesting
npx hardhat --network ethereum deploy --tags AirdropVestingOne
npx hardhat --network ethereum deploy --tags AirdropVestingTwo
npx hardhat --network base-sepolia deploy --tags TestVesting
npx hardhat --network base deploy --tags MPROAutoStake
```

<!-- GETTING BENEFICIARIES -->

```shell
npx hardhat --network ethereum getBeneficiaries --contract VestingSeed
npx hardhat --network ethereum getBeneficiaries --contract PrivateRoundVesting
npx hardhat --network ethereum getBeneficiaries --contract FoundationVesting
npx hardhat --network ethereum getBeneficiaries --contract AdvisiorsVesting
npx hardhat --network ethereum getBeneficiaries --contract MarketingVesting
npx hardhat --network ethereum getBeneficiaries --contract AirdropVestingOne
npx hardhat --network ethereum getBeneficiaries --contract AirdropVestingTwo

npx hardhat --network base getContractInfo
npx hardhat --network base updateReward

npx hardhat --network ethereum distributeReward --cycle-id "e43d2ccd-e5f3-4c94-bb16-0c8e8dae84f2" --amount "266630190360000000000000"

npx hardhat --network base updateStakers --cycle-id "40290c88-cc2c-496b-a992-4a18e3ef934c"

npx hardhat --network ethereum setDistributor
npx hardhat --network base setUpdater
```
