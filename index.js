"use strcit";

const async = require('async');
const Web3 = require("web3");
const Bip39 = require('bip39');
const HDKey = require('hdkey')

const Discord = require("discord.js");
const BigNumber = require('bignumber.js');
const Util = require('ethereumjs-util')
const Tx = require("ethereumjs-tx");
const fs = require("fs");
const readlineSync = require('readline-sync');
const crypto = require('crypto');

const Settings = require("./config.json");
const price = require("./price.js");
const Games = require("./games.js");

const ERC20ABI = [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"tokens","type":"uint256"}],"name":"approve","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"from","type":"address"},{"name":"to","type":"address"},{"name":"tokens","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"_totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"tokenOwner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"acceptOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"tokens","type":"uint256"}],"name":"transfer","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"tokens","type":"uint256"},{"name":"data","type":"bytes"}],"name":"approveAndCall","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"newOwner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"tokenAddress","type":"address"},{"name":"tokens","type":"uint256"}],"name":"transferAnyERC20Token","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"tokenOwner","type":"address"},{"name":"spender","type":"address"}],"name":"allowance","outputs":[{"name":"remaining","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_from","type":"address"},{"indexed":true,"name":"_to","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"tokens","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"tokenOwner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"tokens","type":"uint256"}],"name":"Approval","type":"event"}];

var KnownTokenList = require(Settings.tokenList || './data/tokens.json');

// load token list
var KnownTokenDecimalDivisors = {};
var KnownTokenInfo = {};

// prepare token information
const KnownTokens = KnownTokenList.map((token)=> {
  var key = token.symbol.toUpperCase();
  KnownTokenInfo[key] = token;
  // decimals divisors
  KnownTokenDecimalDivisors[key] = new BigNumber(10).pow(token.decimal);
  return token.address;
});

function prepareHDKey() {
	const mnemonic = getMnemonic(Settings.bip39words);
	const seed = Bip39.mnemonicToSeed(mnemonic, '');
	return HDKey.fromMasterSeed(seed);
}

function getHdPath(hdkey, type, userId) {
	// hdPath = "m'/44'/31102'/0'/0"
	var tmp = Settings.hdPath.split('/');
	// remove last element
	tmp.splice(4,1);
	if (!Number.isInteger(type)) {
		type = 0;
	}
	userId = parseInt(userId);
	if (userId < 0) {
		return null;
	}

	// make hdPath for user
	var path = tmp.join('/');
	return `${path}/${type}/${userId}`;
}

function _getAddress(hdkey) {
	var addressBuffer = Util.privateToAddress(hdkey._privateKey);
	return '0x' + addressBuffer.toString('hex');
}

function getAddress(type, uid) {
	if (!Number.isInteger(type)) {
		type = 0;
	}
	const hdkey = prepareHDKey();
	const hdPath = getHdPath(hdkey, type, uid); // type == 0 : external, type == 1 : internal
	const hd = hdkey.derive(hdPath);
	return _getAddress(hd);
}

function getPrivateKey(type, uid) {
	if (!Number.isInteger(type)) {
		type = 0;
	}
	const hdkey = prepareHDKey();
	const hdPath = getHdPath(hdkey, type, uid); // type == 0 : external, type == 1 : internal
	const hd = hdkey.derive(hdPath);
	return hd._privateKey;
}

async function showAdminWallet() {
	const toAddress = getAddress(0, 0);
	let balance = await web3.eth.getBalance(toAddress) / Math.pow(10, 18);
	console.log("Admin wallet = " + toAddress + ": " + balance + " " + Settings.ticker);
}

// update price every 5 min
if (Settings.priceApi) {
	setInterval(function() {
		if (Settings.priceApi == 'cmc') {
			price.getCMCPrice(Settings.cmcId || Settings.ticker);
		} else if (Settings.priceApi == 'bitz') {
			price.getBitzPrice(Settings.ticker);
		}
	}, 300000);
}

const prefix = Settings.prefix;
const bot = new Discord.Client({disableEveryone:true});

var web3 = new Web3(new Web3.providers.HttpProvider(Settings.rpchost || 'http://localhost:8545'));
bot.on('ready', ()=>{
	console.log("Bot is ready for work");
});

// show admin wallet
showAdminWallet();

function sendCoins(type, fromId, toId, val, unit, text, message, name) {
	var users = getJson('data/users.json');

	console.log("sendCoins >> fromId = " + fromId + " / toId = " + toId);
	if (typeof fromId === 'number') {
		let toAddress;
		if (typeof toId === 'number') {
			toAddress = getAddress(type, toId);
		} else {
			// normal address
			toAddress = toId;
		}
		console.log("sendCoins >> toId = " + toId + " / toAddress = " + toAddress);

		sendRawTransaction(type, fromId, toAddress, val, unit, text, message, function(err, rawTx, sendAllWei) {
			if (err) {
				message.channel.send("Fail to send to " + name);
				return;
			}

			web3.eth.sendSignedTransaction(rawTx, function(err, hash) {
				if (err) {
					message.channel.send("Fail to send to " + name + ": " + err);
					return;
				}
				message.channel.send(":tada: <@" + message.author.id + "> sent **" + val + "** " + unit + " tip.\nTX hash: `" + hash + "`");
				if (typeof name != "undefined") {
					let toUser = bot.users.find('username', name);
					if (toUser) {
						if (sendAllWei) {
							// val = total - gas
							val = sendAllWei / 1e18;
						}
						toUser.send(":tada: Hi, you are lucky! <@" + message.author.id + "> sent **" + val + "** " + unit + " tip to you.\nTX hash: `" + hash + "`");
					} else {
						message.author.send("Check TX hash: `" + hash + "`");
					}
				}
			});
		});
	}
}

function getTokenBalance(address, unit, message) {
	if (!KnownTokenInfo[unit]) {
		return;
	}

	const tokenAddress = KnownTokenInfo[unit].address;
	var token = new web3.eth.Contract(ERC20ABI, tokenAddress, {from: address });
	var data = token.methods.balanceOf(address).call(function(err, balance) {
		if (err) {
			message.author.send("Fail to get " + unit + " token balance.");
			return;
		}
		console.log("balance = ", balance);
		var value = new BigNumber(balance).dividedBy(KnownTokenDecimalDivisors[unit]);
		message.channel.send(`Current ${unit} balance for \`${address}\`: **${value}** ${unit}`);
	});
}

function sendRawTransaction(type, fromId, to, amount, unit, text, message, cb) {
	let address = getAddress(type, fromId);

	var gasPrice = 2000000000; // 2,000,000,000 0x77359400
	// minimal gas price ?        2,100,000,000 0x4e3b29200
	// returned gas price ??     20,000,000,000
	// gasPrice: "0x0861c46800", // 0x4e3b29200 36,000,000,000
	var noNonce;
	var totalBalance;

	let wei;
	var decimals = 18;
	var divisor = Math.pow(10, decimals);
	if (unit !== Settings.etherUnit) {
		divisor = KnownTokenDecimalDivisors[unit];
	}
	if (amount <= Settings.etherMax) {
		if (typeof decimals === 'object') {
			var bamount = new BigNumber(amount);
			wei = bamount.times(divisor).toString(10);
		} else {
			wei = amount * divisor;
		}
		if (wei < Settings.etherMin * Math.pow(10, decimals)) {
			return message.channel.send("Too small amount. minimal amount is " + Settings.etherMin);
		}
	} else {
		var bn = new web3.utils.BN(amount).toString(10);
		if (decimals == 18) {
			// normal case
			wei = web3.utils(bn, "ether");
		} else {
			// decimals != 18 case
			var bamount = new BigNumber(amount);
			wei = bamount.times(divisor).toString(10);
		}
	}
	console.log('decimals = ', decimals);
	console.log('bamount = ', bamount);
	console.log('amount = ', amount);
	console.log('wei = ', wei);
	console.log('text = ', text);

	async.waterfall([
	function(callback) {
		web3.eth.getGasPrice(function(err, result) {
			if (err) {
				return callback(err);
			}
			callback(null, result);
		});
	}, function(gasprice, callback) {
		web3.eth.getBalance(address, function(err, result) {
			if (err) {
				return callback(err);
			}
			callback(null, gasprice, result);
		});
	}, function(gasprice, balance, callback) {
		web3.eth.getTransactionCount(address, "pending", function(err, nonce) {
			if (err) {
				return callback(err);
			}
			console.log('nonce = ', nonce);
			callback(null, gasprice, balance, nonce);
		});
	}], function(error, gasprice, balance, nonce) {
		if (error) {
			return callback(error);
		}
		//gasPrice = gasprice > gasPrice ? gasprice : gasPrice;
		console.log("returned gasPrice = " + gasprice);
		console.log("assume gasPrice = " + gasPrice);
		totalBalance = balance;

		let data = '0x';
		//let gasLimit = "0x5208";
		//let gasLimit = "0x015f90";
		//let gasLimit = 90000;// mist case
		let gasLimit = 21000;
		let value = wei;
		if (KnownTokenInfo[unit]) {
			gasLimit = 160000;
			const tokenAddress = KnownTokenInfo[unit].address;
			var token = new web3.eth.Contract(ERC20ABI, tokenAddress, {from: address });
			// FIXME wei to token unit FIXME
			data = token.methods.transfer(to, wei).encodeABI();
			to = tokenAddress;
			value = "0x0";
		} else {
			// coin transfer
			var sendAll = false;
			console.log("totalBalance = " + totalBalance);
			if (value == totalBalance) {
				sendAll = true;
			} else {
				var total = new BigNumber(totalBalance);
				var v = new BigNumber(value);
				var diff = total.minus(v).abs();
				if (diff.comparedTo(800000000000) < 0) {
					// almost same
					sendAll = true;
				}
			}

			// have text message?
			if (text) {
				var msg = Buffer.from(text);
				var len = msg.length;
				var gas = len * 68;
				gasLimit += gas;
				console.log('additional gaslimit for text message = ', gas, ' len = ', len);

				data = '0x' + msg.toString('hex');
			}

			if (sendAll) {
				var total = new BigNumber(totalBalance);
				var gas = gasPrice * (gasLimit + 2);
				var sendAllValue = total.minus(gas);
				// sendAllValue = totalBalance - (gasPrice * (gasLimit + 2));
				console.log("total balance = " + totalBalance);
				console.log("gasPrice = " + gasPrice);
				console.log("gasLimit = " + gasLimit);
				console.log("sendAllVal = " + sendAllValue);
				if (sendAllValue.comparedTo(0) > 0) {
					value = sendAllValue.toString(10);
				}
			}
		}

		let txParams = {
			nonce,
			gasPrice: "0x" + gasPrice.toString(16),
			gasLimit: "0x" + gasLimit.toString(16),
			to,
			value: value,
			data,
			chainId: Settings.chainId
		};

		const tx = new Tx(txParams);
		tx.sign(getPrivateKey(type, fromId));
		const serializedTx = tx.serialize();

		var ret = tx.verifySignature();
		if (ret) {
			console.log('verifySignature() = ', ret);
			let checkAddress = '0x' + tx.getSenderAddress().toString('hex');
			if (address == checkAddress) {
				console.log("rawTx = " + serializedTx.toString('hex'));
				cb(null, "0x" + serializedTx.toString('hex'), sendAll ? value : null);
			} else {
				cb({error: true, message: 'FAIL to verify'}, null);
			}
		} else {
			console.log('FAIL to verify');
			cb({error: true, message: 'FAIL to verify'}, null);
		}
	});
}

function raining(type, amount,message) {
	// registered users
	var data = getJson('data/users.json');
	// online users
	var onlineUsers = getOnline();
	// create online and register array
	var onlineAndRegister = Object.keys(data).filter(id => { return onlineUsers.indexOf(id) != -1; });
	// create object with name - address and name - values
	var latest = {};
	for (let user of onlineAndRegister) {
		if (data[user]) {
			latest[data[user]] = user;
		}
	}
	// if use wrong amount (string or something)
	var camount = amount / Object.keys(latest).length;
	var weiAmount = camount * Math.pow(10, 18); // FIXME

	message.channel.send("It just **rained** on **" + Object.keys(latest).length + "** users. Check pm's." );

	function rainSend(addresses) {
		for (const address of Object.keys(addresses)) {
			let name = addresses[address];
			//sendCoins(address, weiAmount, message, name);
			// FIXME
			sendCoins(type, fromId, toId, amount, text, message, username);
		}
	}
	// main function
	rainSend(latest);
}

// return array with names of online users
function getOnline() {
	var onlineList = [];
	var users = bot.users;
	users.keyArray().forEach((val) => {
		var id = users.get(val).id;
		var status = users.get(val).presence.status;
		if (status == "online") {
			onlineList.push(id);
		}
	});
	return onlineList;
}

function getJson(path) {
	return JSON.parse(fs.readFileSync(path));
}

function decryptMnemonic(encrypted_file) {
	if (typeof decryptMnemonic.decrypted !== 'undefined') {
		return decryptMnemonic.decrypted;
	}
	const message = 'Please enter password: ';
	const options = {
		hideEchoBack: true,
		mask: '*'
	};

	const passwd = readlineSync.question(message, options);

	let encrypted = fs.readFileSync(encrypted_file);
	encrypted = encrypted.toString().replace(/\n/g, "");
	encrypted = new Buffer(encrypted, 'base64');
	encrypted = encrypted.toString('base64');

	const decipher = crypto.createDecipher('aes-256-cbc', passwd);
	decipher.setAutoPadding(false);
	let decrypted = decipher.update(encrypted, 'base64', 'utf8');
	decrypted += decipher.final('utf8');

	// XXX workaround
	var fixed = decrypted.replace(//g, '');
	decryptMnemonic.decrypted = fixed;

	return fixed;
}

function getMnemonic(path) {
	var decoded;
	if (path.match(/\.enc$/)) {
		decoded = decryptMnemonic(path);
	} else {
		var mnemonics = fs.readFileSync(path);
		decoded = mnemonics.toString();
	}
	return decoded.trim().split(/\s+/g).join(' ');
}

function getRegisterUserInfo(user) {
	let users = getJson('data/users.json');
	if (users[user.id]) {
		return users[user.id];
	}
	return null;
}

async function register(type, id, message) {
	if (!Number.isInteger(type)) {
		type = 0;
	}
	var data = getJson('data/users.json');
	var current = data["@id"];
	var user = bot.users.find('id', id);
	if (!user) {
		message.channel.send("<@" + id + "> user not found");
		return null;
	}
	if (!data[id]) {
		var newId = current + 1;
		data[id] = { uid: newId, name: user.username };
		data["@id"] = newId;

		let address = getAddress(type, newId);

		await fs.writeFileSync(Settings.path, JSON.stringify(data, null, 2), (err) => {
			if (err) throw err;
			console.log("newId = " + newId);
			console.log('users.json file has been saved.');
			message.channel.send("<@" + id + "> registred. address is `" + address + "`");
		});
		return newId;
	} else {
		var user = data[id];
		let address = getAddress(type, user.uid);

		message.channel.send("<@" + id + "> is already registered. address is `" + address + "`");
		return user.uid;
	}
}

function getUser(username, bot) {
	let user;
	if (username[0] == '<' && username[1] == '@') {
		let id;
		if (username[2] == '!') {
			id = username.substr(3, username.length - 4);
		} else {
			id = username.substr(2, username.length - 3);
		}
		console.log("userId = " + id + " " + username);
		user = bot.users.find('id', id);
	} else {
		user = bot.users.find('username', username);
	}
	return user;
}

var prefixPrefix = prefix[0];
var allCommands = ['balance', 'getaddress', 'tx', 'send', 'withdraw', 'register', 'checkRegister', 'list', 'help', 'bet', 'tokens'];
var dmCommands = ['balance', 'getaddress', 'tx', 'help'];

var allowedCommands = allCommands.map(function(cmd) { return prefix + cmd; });
var allowedDmCommands = allCommands.map(function(cmd) { return prefix + cmd; });

bot.on('message',async message => {
	if (message.author.bot) return; // ignore bot authors

	let args = message.content.split(/[ ]+/);
	let hasCommandPrefix = args[0] && args[0].startsWith(prefix);
	if (hasCommandPrefix && args[0] === prefix) {
		args.shift();
		args[0] = prefix + args[0];
	}
	if (Settings.simpleCommand && !hasCommandPrefix && args[0] && args[0].startsWith(prefixPrefix)) {
		args[0] = prefix + args[0].substr(1);
		hasCommandPrefix = true;
	}

	if (!hasCommandPrefix) {
		return;
	}
	if (allowedCommands.indexOf(args[0]) < 0) {
		return;
	}

	// Not admins cannot use bot in general channel
	if (message.channel.name === 'general' &&
			args[0].indexOf(allowedCommands) > -1 && !message.member.hasPermission('ADMINISTRATOR')) {
		return message.channel.send("Sorry, you have no permission to use `" + args[0] + "` command at the #genernal channel.");
	}

	var message = message;
	var internalType = 0;

	if (message.channel.type === "dm" &&
			args[0].indexOf(allowedCommands) > -1 && args[0].indexOf(allowedDmCommands) === -1) {
		return message.channel.send("Sorry, You are not allowed to use `" + args[0] + "` command.");
	}

	if ((args[0] == prefix + "withdraw") && args[1]) {
		let author = message.author.id;

		let address = args[1];
		let amount = Number(args[2]);
		let unit, text;
		if (args[3]) {
			// check valid token name
			if (args[3] == Settings.ticker || KnownTokenInfo[args[3]]) {
				unit = args[3];
				args.shift();
			} else {
				unit = Settings.etherUnit;
			}
		} else {
			unit = Settings.etherUnit;
		}
		// check additional message
		if (args[3]) {
			var remains = args.slice(3);
			text = remains.join(' ');
			text = text.replace(/%20/g, ' ');
			text = text.replace(/\\n/g, "\n");
		}

		// if use wrong amount (string or something)
		if (!amount) {
			return message.channel.send("Error - you've entered wrong amount.");
		}
		if (unit === Settings.etherUnit) {
			if (amount > Settings.etherMax) {
				return message.channel.send("Error - too much amount of " + unit + ".");
			}
		} else {
			if (amount > Settings.etherMax * 100) {
				return message.channel.send("Error - too much amount of " + unit + ".");
			}
		}

		let data = getJson('data/users.json');
		if (data[author] && web3.utils.isAddress(address)) {
			var id = data[author].uid;
			message.channel.send("You are trying to withdraw " + amount + " " + unit + " to `" + address + "`");

			sendCoins(internalType, id, address, amount, unit, text, message, address);
		} else {
			message.channel.send("You are not registered.");
		}
	}

	// mini games
	if ((args[0] == prefix + "bet") && args[1]) {
		let author = message.author.id;
		let users = getJson('data/users.json');
		let fromId, toId;

		console.log(args[0], args[1]);
		let test = args[2] === 'test' ? true : false;

		let userSide = args[1].toLowerCase();
		if (userSide === 'dice') {
			let totalBot = 0;
			let totalUser = 0;
			while (totalBot == totalUser) {
				let botDice = Games.dice();
				let userDice = Games.dice();
				totalBot += botDice;
				totalUser += userDice;
			}
			let botName = "@" + Settings.botName;
			let tmp = bot.users.find('username', Settings.botName);
			if (tmp) {
				botName = "<@" + tmp.id + ">";
			}
			let msg = "**You**: " + totalUser + "\n" + botName + ": " + totalBot + "\n\n";
			if (totalUser > totalBot) {
				return message.channel.send(msg + ":trophy: **<@" + author + "> WIN** :game_die:");
			} else {
				return message.channel.send(msg + "**" + botName + " WINS** :game_die:");
			}
		} else if (userSide == "even" || userSide == "odd") {
			let botSide = Games.evenOdd();
			let msg = "";
			if (botSide == "even") {
				msg = ":two:\n\n";
			} else {
				msg = ":one:\n\n";
			}
			let botName = "@" + Settings.botName;
			let tmp = bot.users.find('username', Settings.botName);
			if (tmp) {
				botName = "<@" + tmp.id + ">";
			}
			if (userSide === botSide) {
				return message.channel.send(msg + ":trophy: **<@" + author + "> WIN**");
			} else {
				return message.channel.send(msg + "**" + botName + " WINS**");
			}
		} else if (userSide == "red" || userSide == "black") {
			let botSide = Games.redBlack();
			let msg = "";
			if (botSide == "red") {
				msg = ":hearts:          RED          :diamonds:\n\n";
			} else {
				msg = ":spades:          BLACK          :clubs:\n\n";
			}
			let botName = "@" + Settings.botName;
			let tmp = bot.users.find('username', Settings.botName);
			if (tmp) {
				botName = "<@" + tmp.id + ">";
			}
			if (userSide === botSide) {
				return message.channel.send(msg + ":trophy: **<@" + author + "> WIN**");
			} else {
				return message.channel.send(msg + "**" + botName + " WINS**");
			}
		}
	}

	if ((args[0] == prefix + "send") && args[1] && args[2]) {
		let author = message.author.id;
		let users = getJson('data/users.json');
		let fromId, toId;

		let username = args[1];
		let amount = args[2];
		let unit, text;
		if (args[3]) {
			// check valid token name
			if (args[3] == Settings.ticker || KnownTokenInfo[args[3]]) {
				unit = args[3];
				args.shift();
			} else {
				unit = Settings.etherUnit;
			}
		}

		if (args[3]) {
			// check additional message
			var remains = args.splice(3);
			text = remains.join(' ');
			text = text.replace(/%20/g, ' ');
			text = text.replace(/\\n/g, "\n");
		} else {
			unit = Settings.etherUnit;
		}

		let isAdmin = message.member && message.member.hasPermission('ADMINISTRATOR');

		if (!isAdmin) {
			if (users[author]) {
				fromId = users[author].uid;
			} else if (message.channel.type !== 'dm' && Settings.autoRegister) {
				return register(internalType, author, message);
			} else {
				return message.channel.send("You are not registered user.");
			}
			amount = Number(amount);
		} else {
			if (Settings.adminWallet) {
				if (Settings.adminWallet == '@me') {
					fromId = users[author].uid;
				} else if (users[Settings.adminWallet]) {
					fromId = users[Settings.adminWallet].uid;
				}
			}
			if (!fromId) {
				fromId = users[author].uid;
			}

			if (amount.indexOf('@') > 0) {
				// admin user can extract others wallet.
				// /send @foobar 10.11@foo
				var val, at;
				if (amount.indexOf('<@') > 0) {
					val = amount.substr(0, amount.indexOf('<@'));
					at = amount.substr(amount.indexOf('<@'));
					at = at.substr(2, at.length - 3);
				} else {
					val = amount.substr(0, amount.indexOf('@'));
					at = amount.substr(amount.indexOf('@') + 1);
				}
				console.log('amount = ' + amount + " / fromId = " + fromId);
				console.log('val = ' + val + " / at = " + at);

				// special case, @admin wallet, @fund wallet
				if (at == 'admin' && users['@admin']) {
					fromId = users['@admin'].uid;
				} else if (at == 'fund' && users['@fund']) {
					fromId = users['@admin'].uid;
				} else if (at == 'me' && users[author]) {
					fromId = users[author].uid;
				} else if (at) {
					var by;
					// seek others wallet
					if (at.match(/^[0-9]+$/)) {
						by = bot.users.find('id', at);
					} else {
						by = bot.users.find('username', at);
					}
					if (users[by.id]) {
						fromId = users[by.id].uid;
					} else {
						return message.channel.send(`User <@${by.id}> not found.`);
					}
				}
				amount = Number(val);
			} else {
				amount = Number(amount);
			}
		}

		// if use wrong amount (string or something)
		if (!amount) return message.channel.send("Error - you've entered wrong amount.");

		if (unit === Settings.etherUnit) {
			if (amount > Settings.etherMax) {
				return message.channel.send("Error - too much amount of " + unit + ".");
			}
		} else {
			if (amount > Settings.etherMax * 100) {
				return message.channel.send("Error - too much amount of " + unit + ".");
			}
		}

		var msg;
		if (web3.utils.isAddress(username)) {
			// address itself.
			toId = username;
			msg = "You are trying to send " + amount + " " + unit + " to `" + username + "`";
		} else {
			let toUser = getUser(username, bot);
			if (toUser && !toUser.bot) {
				if (!users[toUser.id] && message.channel.type !== 'dm' && Settings.autoRegister) {
					toId = await register(internalType, toUser.id, message);
					username = toUser.username;
				}
				if (!toId && users[toUser.id]) {
					toId = users[toUser.id].uid;
					console.log("toId = " + toId);
					username = toUser.username;
				} else if (!toId) {
					return message.channel.send(username + " is not registered user.");
				}
			} else if (toUser && toUser.bot) {
				return message.channel.send(":broken_heart: You can't send to bot.");
			} else {
				return message.channel.send(":broken_heart: " + username + " is not found.");
			}
			msg = "You are trying to send " + amount + " " + unit + " to <@" + toUser.id + ">";
		}

		message.channel.send(msg);

		sendCoins(internalType, fromId, toId, amount, unit, text, message, username);
	}

	if (args[0] == prefix + "tokens") {
		var tokenInfo = KnownTokenList.map((token)=> {
			var sym = token.symbol.toUpperCase();
			var addr = token.address;
			return `**${sym}**: address: \`${addr}\``;
		});
		return message.channel.send("Known Token list\n" + tokenInfo.join("\n"));
	}

	if (message.content.startsWith(prefix + "Xrain")) {
		if (!message.member.hasPermission('ADMINISTRATOR')) {
			return message.channel.send("You cannot use '" + prefix + "rain' command");
		}
		var amount = Number(args[1]);
		if (!amount) return message.channel.send("Error - you've entered wrong amount");
		// main func
		raining(amount,message);
	}

	if (message.content.startsWith(prefix + "Xcoming ")) {
		if (!message.member.hasPermission('ADMINISTRATOR')) {
			return message.channel.send("You cannot use '" + prefix + "rain' command");
		} 
		let amount = Number(args[1]);
		//if use wrong amount (string or something)
		if (!amount) return message.channel.send("Error - you've entered wrong amount");
		let time = Number(args[2])*3600000;
		if (!time) return message.channel.send("Please, set hours correctly");
		 // 1 hour = 3 600 000 milliseconds
		message.channel.send("Raining will be after **" + args[2] + "** hours.");

		// main func
		setTimeout(function() {
			raining(amount,message);
		},time);
	}

	if (args[0] == prefix + "balance") {
		let author = message.author.id;
		let address, unit;
		let hasArg = args[1] ? true : false;

		// /balance : show my balance
		// /balance DDT => show balanceOf() DDT token
		while (args[1]) {
			if (!address && web3.utils.isAddress(args[1])) {
				address = args[1];
			} else if (!unit && (KnownTokenInfo[args[1]] || args[1] == Settings.ticker)) {
				unit = args[1];
			} else if (!address) {
				var user = getUser(args[1], bot);
				if (user) {
					var i = getRegisterUserInfo(user);
					if (i) {
						address = getAddress(internalType, i.uid);
					}
				} else if (!unit) {
					return message.channel.send("not recognized argument `" + args[1] + "`.");
				}
			} else {
				return message.channel.send("not recognized argument `" + args[1] + "`.");
			}

			args.shift();
		}

		if (hasArg && !address && !unit) {
			return message.channel.send("unable to find adddress for " + args[1] + ".");
		}

		if (address == null) {
			// show registered address balance
			let data = getJson('data/users.json');
			if (data[author]) {
				var user = data[author];
				let address = getAddress(internalType, user.uid);

				web3.eth.getBalance(address, (error,result) => {
					if (!error) {
						let balance = (result/Math.pow(10, 18)).toFixed(6);
						let icon = ':trophy:';
						if (balance == 0) {
							icon = ':hatching_chick:';
						} else if (balance < 100) {
							icon = ':hatched_chick:';
						} else if (balance < 500) {
							icon = ':baby_chick:';
						} else if (balance < 1000) {
							icon = ':bird:';
						} else if (balance < 2000) {
							icon = ':medal:';
						} else if (balance < 5000) {
							icon = ':trophy:';
						} else if (balance < 10000) {
							icon = ':third_place:';
						} else if (balance < 20000) {
							icon = ':second_place:';
						} else if (balance < 30000) {
							icon = ':first_place:';
						}

						message.channel.send(`${icon} Current balance for <@${message.author.id}>: **${balance}** ${Settings.ticker}. Your address is \`${address}\``);
					}
				});

				if (unit && unit != Settings.etherUnit) {
					getTokenBalance(address, unit, message);
				}
			}
		} else if (web3.utils.isAddress(address)) {
			web3.eth.getBalance(address, (error,result) => {
				if (!error) {
					var balance = (result / Math.pow(10, 18)).toFixed(3);
					if (balance == 0) {
						message.channel.send(`This balance empty, it has: **${balance}** ${Settings.ticker}. Address: \`${address}\`.`);
					} else {
						message.channel.send(`Balance is **${balance}** ${Settings.ticker}. Address: \`${address}\`.`);
					}
				} else {
					message.channel.send("Oops, some problem occured with your address.");
				}
			});

			if (unit && unit != Settings.etherUnit) {
				getTokenBalance(address, unit, message);
			}
		} else {
			message.channel.send("Wrong address, try another one.");
		}
	}

	if (args[0] == prefix + "getaddress") {
		let users = getJson('data/users.json');
		let address;

		let unit = args[1] || Settings.ticker;
		if (users['@admin']) {
			let adminId = users['@admin'].uid;

			address = getAddress(internalType, adminId);
		} else {
			address = Settings.address;
		}
		let balance = await web3.eth.getBalance(address) / Math.pow(10, 18);
		message.channel.send("Bot address is `" + address + "` with: **" + Number(balance).toFixed(3) + "** " + Settings.ticker + ".");

		if (unit != Settings.etherUnit) {
			getTokenBalance(address, unit, message);
		}
	}

	if (args[0] == prefix+"register") {
		var author = message.author.id;

		if (true) {
			register(internalType, author, message);
		}
		//var address = args[1];
		//if (web3.utils.isAddress(args[1])) {
		//	var data = getJson('data/users.json');
		//	if (!Object.values(data).includes(address) && !Object.keys(data).includes(author)) {
		//		data[author] = address;
		//		message.channel.send("@" + author + " registered new address: " + address);
		//
		//		fs.writeFile(Settings.path, JSON.stringify(data), (err) => {
		//		  if (err) throw err;
		//		  console.log('The file has been saved.');
		//		});
		//
		//	} else {
		//		message.channel.send("You have already registered.");
		//	}
		//} else {
		//	message.channel.send("@" + author + " tried to register wrong address. Try another one. Correct format is **/register 0xAddress**");
		//}
	}

	if (args[0] == prefix + "list") {
		var data = getJson('data/users.json');
		message.channel.send("Total registered users is **" + Object.keys(data).length + "**.");
	}

	if (args[0] == prefix + "tx" && args[1]) {
		let txhash = args[1];
		web3.eth.getTransaction(txhash, function(err, tx) {
			if (err) {
				console.log(err);
				message.channel.send("Fail to get tx: " + err);
				return;
			}
			let icon = ':ok_hand:';
			if (!tx.blockNumber) {
				icon = ':sleeping:';
			}
			var str = tx.input;
			var msg = "";
			if (str != '0x') {
				var txt = str.replace(/^0x/, '');
				txt = Buffer.from(txt, 'hex');
				str = txt.toString();
				msg = `\ndata: \`${str}\``;
			}
			message.channel.send(`${icon} - TX \`${tx.hash}\`, from: \`${tx.from}\`, to: \`${tx.to}\` at blockNumber \`${tx.blockNumber}\`.${msg}`);
		});
	}

	if (args[0] == prefix + "checkRegister") {
		let author = message.author.id;
		let data = getJson('data/users.json');
		if (Object.keys(data).includes(author)) {
			message.channel.send("<@"+author + "> already registered.");
		} else {
			message.channel.send("You are not in the list, use **" + prefix + register + "** command first.");
		}
	}

	if (args[0] === prefix + "help") {
		var space = '';
		if (prefix.length > 1) {
			space = ' ';
		}
		message.channel.send(Settings.botName + " commands:\n"+
			"**" + prefix + space + "balance** *<address>* - show " + Settings.ticker + " balance on the following address.\n" +
			"**" + prefix + space + "balance** - show " + Settings.ticker + " balance of yours. \n" +
			"**" + prefix + space + "tx** - show *<txhash>*. \n" +
			//"**"+prefix+"sendToAddress** *<address>* *<amount>* - send " + Settings.ticker + " to the following address (Admin Only)\n"+
			"**" + prefix + space + "send** *<name|address>* *<amount>* send " + Settings.ticker + " to the following user/address\n" +
			"**" + prefix + space + "withdraw** *<address>* *<amount>* withdraw " + Settings.ticker + " to the following address\n" +
			//"**"+prefix+"rain** *<amount>* - send " + Settings.ticker + " to all registered and online address's (Admin Only).\n"+
			//"**"+prefix+"coming** *<amount>* *<numOfHrs>* - rain will be after N hours (Admin Only). \n"+
			"**" + prefix + space + "getaddress** - shows fund address so everyone can fund it.\n" +
			//"**"+prefix+"register** *<address>*  - saves user address and name to db. \n"+
			"**" + prefix + space + "register** - register user to db.\n" +
			"**" + prefix + space + "checkRegister** - find whether you're registered or not.\n" +
			"**" + prefix + space + "tokens** - shows available token list.\n" +
			"**" + prefix + space + "list** - shows number of registered users.");
	}
})


bot.login(Settings.token);
