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
npx hardhat --network base updateStakers --distribution-tx "0x396fe07748ece5a0afc5b4a4dde7e9fd9797e21919e4e5b4438195f9ae2d02af" --bridge-tx "0x1bd48fadb743a0c76761ec38ba2b0d2df0a6ba82d79eaeaf6d94e7781804f658" --cycle-id "7dad1e16-d1a9-4c40-90bc-4d8617ce4aee"
```

Multiple versions of OFT

```shell

# OFT V1.1 ------------------------------------------------------------------------------------------------------------------------------------

# Set peers for V1.1 only for the first time
npx hardhat --network sepolia setTrustedRemote --target-network base-sepolia --contract OFTV1Legacy
npx hardhat --network base-sepolia setTrustedRemote --target-network sepolia --contract OFTV1Legacy

npx hardhat --network sepolia setTrustedRemote --target-network base-sepolia --local-contract OFTV1LegacyAdapter --remote-contract OFTV1LegacyReceiver
npx hardhat --network base-sepolia setTrustedRemote --target-network sepolia --local-contract OFTV1LegacyReceiver --remote-contract OFTV1LegacyAdapter

# Set min gas for V1.1 only for the first time
npx hardhat --network sepolia setMinDstGas --packet-type 0 --target-network base-sepolia --contract OFTV1Legacy --min-gas 100000
npx hardhat --network base-sepolia setMinDstGas --packet-type 0 --target-network sepolia --contract OFTV1Legacy --min-gas 100000

npx hardhat --network sepolia setMinDstGas --packet-type 0 --target-network base-sepolia --contract OFTV1LegacyAdapter --min-gas 100000
npx hardhat --network base-sepolia setMinDstGas --packet-type 0 --target-network sepolia --contract OFTV1LegacyReceiver --min-gas 100000

# Bridge OFT V1.1
npx hardhat --network sepolia oftSendLegacy --target-network base-sepolia --qty 1 --contract OFTV1Legacy
npx hardhat --network base-sepolia oftSendLegacy --target-network sepolia --qty 1 --contract OFTV1Legacy

# Bridge OFT V1.1 with adapter
npx hardhat --network sepolia oftSendLegacy --target-network base-sepolia --qty 1 --local-contract OFTV1LegacyAdapter --remote-contract OFTV1LegacyReceiver
npx hardhat --network base-sepolia oftSendLegacy --target-network sepolia --qty 1 --local-contract OFTV1LegacyReceiver --remote-contract OFTV1LegacyAdapter

# OFT V1.2 ------------------------------------------------------------------------------------------------------------------------------------

# Set peers for V1.2 only for the first time
npx hardhat --network sepolia setTrustedRemote --target-network base-sepolia --contract OFTV1
npx hardhat --network base-sepolia setTrustedRemote --target-network sepolia --contract OFTV1

npx hardhat --network sepolia setTrustedRemote --target-network base-sepolia --local-contract OFTV1Receiver --remote-contract OFTV1Adapter
npx hardhat --network base-sepolia setTrustedRemote --target-network sepolia --local-contract OFTV1Adapter --remote-contract OFTV1Receiver

# Set min gas for V1.2 only for the first time
npx hardhat --network sepolia setMinDstGas --packet-type 0 --target-network base-sepolia --contract OFTV1 --min-gas 100000
npx hardhat --network base-sepolia setMinDstGas --packet-type 0 --target-network sepolia --contract OFTV1 --min-gas 100000

npx hardhat --network sepolia setMinDstGas --packet-type 0 --target-network base-sepolia --contract OFTV1Receiver --min-gas 100000
npx hardhat --network base-sepolia setMinDstGas --packet-type 0 --target-network sepolia --contract OFTV1Adapter --min-gas 100000

# Bridge OFT V1.2
npx hardhat --network sepolia oftSendV1 --target-network base-sepolia --qty 1 --contract OFTV1
npx hardhat --network base-sepolia oftSendV1 --target-network sepolia --qty 1 --contract OFTV1

# Bridge OFT V1.2 with adapter
npx hardhat --network base-sepolia oftSendV1 --target-network sepolia --qty 1 --local-contract OFTV1Adapter --remote-contract OFTV1Receiver
npx hardhat --network sepolia oftSendV1 --target-network base-sepolia --qty 1 --local-contract OFTV1Receiver --remote-contract OFTV1Adapter

# OFT V2 ------------------------------------------------------------------------------------------------------------------------------------

# Set peers for V2 only for the first time
npx hardhat --network sepolia setPeer --target-network base-sepolia --contract OFTV2
npx hardhat --network base-sepolia setPeer --target-network sepolia --contract OFTV2

# Set peers for V2 with adapter only for the first time
npx hardhat --network sepolia setPeer --target-network base-sepolia --local-contract OFTV2Adapter --remote-contract OFTV2Receiver
npx hardhat --network base-sepolia setPeer --target-network sepolia --local-contract OFTV2Receiver --remote-contract OFTV2Adapter

# V2 bridge OFT
npx hardhat --network base-sepolia oftSendTokens --target-network sepolia --qty 1 --contract OFTV2 --from-address 0xC856f7BcB20eE58F5788620b1261082829163dc4 --to-address 0xC856f7BcB20eE58F5788620b1261082829163dc4

npx hardhat --network sepolia oftSendTokens --target-network base-sepolia --qty 1 --contract OFTV2 --from-address 0xC856f7BcB20eE58F5788620b1261082829163dc4 --to-address 0xC856f7BcB20eE58F5788620b1261082829163dc4

# V2 bridge with adapter
npx hardhat --network sepolia oftSendTokens --target-network base-sepolia --qty 1 --local-contract OFTV2Adapter --remote-contract OFTV2Receiver --from-address 0xC856f7BcB20eE58F5788620b1261082829163dc4 --to-address 0xC856f7BcB20eE58F5788620b1261082829163dc4
npx hardhat --network base-sepolia oftSendTokens --target-network sepolia --qty 1 --local-contract OFTV2Receiver --remote-contract OFTV2Adapter --from-address 0xC856f7BcB20eE58F5788620b1261082829163dc4 --to-address 0xC856f7BcB20eE58F5788620b1261082829163dc4
```
