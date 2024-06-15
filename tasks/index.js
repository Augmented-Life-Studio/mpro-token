//
task(
	'setPeer',
	'setTrustedRemote(chainId, sourceAddr) to enable inbound/outbound messages with your other contracts',
	require('./setTrustedRemote'),
)
	.addParam('targetNetwork', 'the target network to set as a trusted remote')
	.addOptionalParam(
		'localContract',
		'Name of local contract if the names are different',
	)
	.addOptionalParam(
		'remoteContract',
		'Name of remote contract if the names are different',
	)
	.addOptionalParam('contract', 'If both contracts are the same name')

//
task(
	'oftSendTokens',
	'send tokens to another chain',
	require('./oftSendTokens'),
)
	.addParam('fromAddress', 'address to send tokens from')
	.addParam('toAddress', 'address to send tokens to')
	.addParam('qty', 'qty of tokens to send')
	.addParam(
		'targetNetwork',
		'the target network to let this instance receive messages from',
	)
	.addOptionalParam(
		'localContract',
		'Name of local contract if the names are different',
	)
	.addOptionalParam(
		'remoteContract',
		'Name of remote contract if the names are different',
	)
	.addOptionalParam('contract', 'If both contracts are the same name')
//
task(
	'getBeneficiaries',
	'getting befeficiaries by owner',
	require('./getBeneficiaries'),
).addParam('contract', 'contract to get from')

task('setLister', 'getting befeficiaries by owner', require('./setLister'))

task('getContractInfo', 'getting contract info', require('./getContractInfo'))

task('updateReward', 'update reward', require('./updateReward'))

task('updateStakers', 'update stakers', require('./updateStakers')).addParam(
	'cycleId',
	'cycleID to update',
)

task(
	'distributeReward',
	'Distriute reward to base',
	require('./distributeReward'),
)
	.addParam('cycleId', 'cycleID to update')
	.addParam('amount', 'Reward amount')
