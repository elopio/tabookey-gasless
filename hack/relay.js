const getAccounts = require('./accounts');
const utils = require('./utils');
const constants = require('./constants');

const RelayHub = artifacts.require('./RelayHub.sol');
const MetaCoin = artifacts.require('./MetaCoin.sol');

let accounts;
let relayHub;
let metaCoin;

async function main() {

  // Retrieve accounts.
  accounts = await getAccounts(web3);

  // Retrieve deployed contracts.
  relayHub = await RelayHub.deployed();
  metaCoin = await MetaCoin.deployed();

  // Retrieve relay info.
  const relay_info = await relayHub.relays(accounts.relay);

  // Retrieve the user's current nonce.
  const user_nonce = await relayHub.nonces(accounts.user_1);
  console.log(`Current user nonce: ${user_nonce}`);

  // Produce a signed message with the intent of calling the mint() function.
  console.log(`====== Creating User's signed message ======`);
  const encodedCall = metaCoin.contract.methods.mint().encodeABI();
  // const relay_prefix = Buffer.from('rlx:').toString('hex');
  // console.log(`  relay_prefix: ${relay_prefix}`);
  const user_msg_hashed = utils.getTransactionHash(
    web3,
    accounts.user_1, 
    metaCoin.address, 
    encodedCall, 
    relay_info.transaction_fee, 
    constants.PARAMS.gasPrice, 
    constants.PARAMS.gas, 
    user_nonce, 
    relayHub.address, 
    accounts.relay
  );
  console.log(`user_msg_hashed: ${user_msg_hashed}`);
  const user_msg_signed = await utils.getTransactionSignature(web3, accounts.user_1, user_msg_hashed);
  console.log(`user_msg_signed: ${user_msg_signed}`);

  // Call can_relay.
  console.log(`====== Checking if transaction can be relayed ======`);
  const can_relay = await relayHub.can_relay(
    accounts.relay,
    accounts.user_1,
    metaCoin.address,
    encodedCall,
    relay_info.transaction_fee,
    constants.PARAMS.gasPrice,
    constants.PARAMS.gas,
    user_nonce,
    user_msg_signed
  );
  console.log(`Can relay transaction: ${can_relay}`);
  if(can_relay.toString() !== '0') {
    throw new Error('Cant relay!');
  }

  // Relay the transaction.
  console.log(`====== Relaying transaction ======`);
  const args = [
    accounts.user_1,
    metaCoin.address,
    encodedCall,
    parseInt(relay_info.transaction_fee.toString(), 10),
    constants.PARAMS.gasPrice,
    constants.PARAMS.gas,
    parseInt(user_nonce.toString(), 10),
    user_msg_signed
  ];
  utils.traceArgs(args);
  const params = {
    ...constants.PARAMS,
    gas: 6000000,
    from: accounts.relay
  };
  console.log(`params: `, params);
  const result = await relayHub.relay(...args, params);
  const log_relayed = result.logs[0];
  const args_relayed = log_relayed.args;
  console.log(`Relayed: `, args_relayed);

  // Verify user_1 balance.
  const user_1_balance = await metaCoin.getBalance(accounts.user_1);
  console.log(`User 1 META balance: ${user_1_balance}`);
}

// Required by `truffle exec`.
module.exports = function(callback) {
  main()
    .then(() => callback())
    .catch(err => { 
      console.log(`Error:`, err);
      callback(err) 
    });
};
