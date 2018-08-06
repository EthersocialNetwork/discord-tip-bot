"use strcit";

const Web3 = require("web3");
const Bip39 = require('bip39');
const HDKey = require('hdkey')

const Discord = require("discord.js");
const BigNumber = require('bignumber.js');
const Util = require('ethereumjs-util')
const Tx = require("ethereumjs-tx");
const fs = require("fs");
const Settings = require("./config.json");
const price = require("./price.js");

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
	if (type !== 0 || type !== 1) {
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

function getAddress(hdkey) {
	//console.log(hd);
	var addressBuffer = Util.privateToAddress(hdkey._privateKey);
	return '0x' + addressBuffer.toString('hex');
}

async function showAdminWallet() {
	const hdkey = prepareHDKey();
	const toHdPath = getHdPath(hdkey, 0, 0); // type == 0 : external, type == 1 : internal
	const toHd = hdkey.derive(toHdPath);
	const toAddress = getAddress(toHd);
	let balance = await web3.eth.getBalance(toAddress) / Math.pow(10, 18);
	console.log("Admin wallet = " + toAddress + ": " + balance + " " + Settings.ticker);
}

// update price every 5 min
setInterval(price,300000);

const prefix = Settings.prefix;
const bot = new Discord.Client({disableEveryone:true});

var web3 = new Web3();

web3.setProvider(new web3.providers.HttpProvider(Settings.rpchost || 'http://localhost:8545'));
bot.on('ready', ()=>{
	console.log("Bot is ready for work");
});

// show admin wallet
showAdminWallet();

function sendCoins(fromId, toId, value, unit, message, name) {
	var users = getJson('data/users.json');

	if (typeof fromId === 'number') {
		let toAddress;
		if (typeof toId === 'number') {
			const hdkey = prepareHDKey();
			const toHdPath = getHdPath(hdkey, 0, toId); // type == 0 : external, type == 1 : internal
			const toHd = hdkey.derive(toHdPath);
			toAddress = getAddress(toHd);
		} else {
			// normal address
			toAddress = toId;
		}
		console.log("sendCoins >> toId = " + toId + " / toAddress = " + toAddress);

		sendRawTransaction(fromId, toAddress, value, unit, message, function(err, rawTx) {
			if (err) {
				message.channel.send("Fail to send to " + name);
				return;
			}

			web3.eth.sendSignedTransaction(rawTx, function(err, hash) {
				if (err) {
					message.channel.send("Fail to send to " + name + ": " + err);
					return;
				}
				message.channel.send("Tip was sent.\nCheck TX hash: " + Settings.blockExplorerTx + hash);
				if (typeof name != "undefined") {
					let toUser = bot.users.find('username', name);
					if (toUser) {
						toUser.send("Hi " + toUser.username + ", you are lucky.\nCheck TX hash: " + Settings.blockExplorerTx + hash);
					} else {
						message.author.send("Check TX hash: " + Settings.blockExplorerTx + hash);
					}
				}
			});
		});
	}

	//web3.eth.sendTransaction({
	//    from: Settings.address,
	//    to: address,
	//    gas: web3.utils.toHex(120000),
	//    value: value
	//})
	//.on('transactionHash', function(hash) {
	//	// sent pm with their tx
	//	// recive latest array
	//	if (name != 1) {
	//		let author = bot.users.find('username',name);
	//		author.send("Hi "+name+" , you are lucky man.\n Check hash: " + Settings.blockExplorerTx + hash);
	//	} else {
	//		message.channel.send("Tip was sent. \n Check hash: " + Settings.blockExplorerTx + hash)
	//	}
	//
	//
	//})
	//.on('error', console.error);
}

function getTokenBalance(address, unit, message) {
	if (!KnownTokenInfo[unit]) {
		return;
	}

	const tokenAddress = KnownTokenInfo[unit].address;
	var token = new web3.eth.Contract(ERC20ABI, tokenAddress, {from: address });
	var data = token.methods.balanceOf(address).call(function(err, balance) {
		if (err) {
			message.author.send("Failt to get " + unit + " token balance.");
			return;
		}
		var value = new BigNumber(balance).dividedBy(KnownTokenDecimalDivisors[unit]);
		message.channel.send(`Current ${unit} balance for \`${address}\`: **${value}** ${unit}`);
	});
}

function sendRawTransaction(fromId, to, value, unit, message, callback) {
	const hdkey = prepareHDKey();
	const hdPath = getHdPath(hdkey, 0, fromId); // type == 0 : external, type == 1 : internal
	const hd = hdkey.derive(hdPath);
	let address = getAddress(hd);

	console.log("hdPath = " + hdPath + " / fromAddress = " + address);

	let data = '0x';
	let gasLimit = "0x015f90";
	if (KnownTokenInfo[unit]) {
		gasLimit = "0x250CA";
		const tokenAddress = KnownTokenInfo[unit].address;
		var token = new web3.eth.Contract(ERC20ABI, tokenAddress, {from: address });
		data = token.methods.transfer(to, value).encodeABI();
		to = tokenAddress;
		value = "0x0";
	}

	const txParams = {
		gasPrice: "0x0861c46800",
		gasLimit,
		to,
		value: value,
		data,
		chainId: Settings.chainId
	};

	web3.eth.getTransactionCount(address, function(err, nonce) {
		if (err) {
			callback(err, null);
		}
		console.log('nonce = ', nonce);
		txParams.nonce = nonce;

		const tx = new Tx(txParams);
		tx.sign(hd._privateKey);
		const serializedTx = tx.serialize();

		var ret = tx.verifySignature();
		if (ret) {
			console.log('verifySignature() = ', ret);
			let checkAddress = '0x' + tx.getSenderAddress().toString('hex');
			if (address == checkAddress) {
				console.log("rawTx = " + serializedTx.toString('hex'));
				callback(null, "0x" + serializedTx.toString('hex'));
			} else {
				callback({error: true, message: 'FAIL to verify'}, null);
			}
		} else {
			console.log('FAIL to verify');
			callback({error: true, message: 'FAIL to verify'}, null);
		}
	});
}

function raining(amount,message) {
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
	var weiAmount = camount * Math.pow(10, 18);

	message.channel.send("It just **rained** on **" + Object.keys(latest).length + "** users. Check pm's." );

	function rainSend(addresses) {
		for (const address of Object.keys(addresses)) {
			let name = addresses[address];
			//sendCoins(address, weiAmount, message, name);
			// FIXME
			sendCoins(fromId, toId, weiAmount, message, username);
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

function getMnemonic(path) {
	let mnemonic = fs.readFileSync(path);
	let decoded = mnemonic.toString();
	return decoded.trim().split(/\s+/g).join(' ');
}

bot.on('message',async message => {
	// Not admins cannot use bot in general channel
	if (message.channel.name === 'general' && !message.member.hasPermission('ADMINISTRATOR')) return;
	if (message.author.bot) return;
	if (message.channel.type === "dm") return;

	var message = message;
	let args = message.content.split(' ');

	if (message.content.startsWith(prefix + "withdraw ")) {
		let author = message.author.id;

		let address = args[1];
		let amount = Number(args[2]);
		let unit = args[3] || Settings.ticker;

		if (unit !== Settings.ticker) {
			// check valid token name
			if (!KnownTokenInfo[unit]) {
				// not found. default ticker
				unit = Settings.etherUnit;
			}
		}

		// if use wrong amount (string or something)
		if (!amount) {
			return message.channel.send("Error - you've entered wrong amount.");
		}
		if (amount > Settings.etherMax) {
			return message.channel.send("Error - too much amount of " + unit + ".");
		}

		let weiAmount = amount * Math.pow(10, 18);
		let data = getJson('data/users.json');
		if (data[author] && web3.utils.isAddress(address)) {
			var id = data[author].uid;
			message.channel.send("You are trying to withdraw " + amount + " " + unit + " to `" + address + "`");

			sendCoins(id, address, weiAmount, unit, message, address);
		} else {
			message.channel.send("You are not registered.");
		}
	}

	if (message.content.startsWith(prefix + "send ")) {
		let author = message.author.id;
		let users = getJson('data/users.json');
		let fromId, toId;
		if (!message.member.hasPermission('ADMINISTRATOR')) {
			if (users[author]) {
				fromId = users[author].uid;
			} else {
				return message.channel.send("You are not registered user.");
			}
		} else {
			fromId = users[author].uid;
		}
		let username = args[1];
		let amount = Number(args[2]);
		let unit = args[3] || Settings.ticker;

		if (unit !== Settings.ticker) {
			// check valid token name
			if (!KnownTokenInfo[unit]) {
				// not found. default ticker
				unit = Settings.etherUnit;
			}
		}

		// if use wrong amount (string or something)
		if (!amount || amount > Settings.etherMax) return message.channel.send("Error - you've entered wrong amount.");

		var msg;
		if (web3.utils.isAddress(username)) {
			// address itself.
			toId = username;
			msg = "You are trying to send " + amount + " " + unit + " to `" + username + "`";
		} else {
			let toUser;
			if (username[0] == '<' &&username[1] == '@') {
				let userId = username.substr(2, username.length - 3);
				console.log("userId = " + userId);
				toUser = bot.users.find('id', userId);
			} else {
				toUser = bot.users.find('username', username);
			}
			if (toUser && users[toUser.id]) {
				toId = users[toUser.id].uid;
				console.log("toId = " + toId);
				username = toUser.username;
			} else {
				return message.channel.send("@" + username + " is not registered user.");
			}
			msg = "You are trying to send " + amount + " " + unit + " to <@" + toUser.id + ">";
		}

		let weiAmount = amount * Math.pow(10, 18);
		message.channel.send(msg);

		sendCoins(fromId, toId, weiAmount, unit, message, username);
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

	if (message.content.startsWith(prefix + "balance")) {
		let price = getJson('data/usdprice.txt');
		let author = message.author.id;
		let address = args[1];
		let unit = args[2] || Settings.ticker;

		// /balance DDT => show balanceOf DDT token
		if (!web3.utils.isAddress(address)) {
			unit = address;
			address = null;
		}

		if (address == null) {
			// show registered address balance
			let data = getJson('data/users.json');
			if (data[author]) {
				var user = data[author];
				const hdkey = prepareHDKey();
				const hdPath = getHdPath(hdkey, 0, user.uid); // type == 0 : external, type == 1 : internal
				const hd = hdkey.derive(hdPath);
				let address = getAddress(hd);

				web3.eth.getBalance(address, (error,result) => {
					if (!error) {
						let balance = (result/Math.pow(10, 18)).toFixed(3);
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

				if (unit != Settings.etherUnit) {
					getTokenBalance(address, unit, message);
				}
			}
		} else if (web3.utils.isAddress(address)) {
			web3.eth.getBalance(address, (error,result) => {
				if (!error) {
					var balance = (result / Math.pow(10, 18)).toFixed(3);
					if (balance == 0) {
						message.channel.send(`This balance empty, it has: **${balance}** ${Settings.ticker}. Address: ${Settings.blockExplorerAddr}${address}.`);
					} else {
						message.channel.send(`Balance is **${balance}** ${Settings.ticker}. Address: ${Settings.blockExplorerAddr}${address}.`);
					}
				} else {
					message.channel.send("Oops, some problem occured with your address.");
				}
			});
		} else {
			message.channel.send("Wrong address, try another one.");
		}
	}

	if (message.content.startsWith(prefix + "getaddress")) {
		let users = getJson('data/users.json');
		let address;

		let unit = args[1] || Settings.ticker;
		if (users['@admin']) {
			let adminId = users['@admin'].uid;

			const hdkey = prepareHDKey();
			const hdPath = getHdPath(hdkey, 0, adminId); // type == 0 : external, type == 1 : internal
			const hd = hdkey.derive(hdPath);
			address = getAddress(hd);
		} else {
			address = Settings.address;
		}
		let balance = await web3.eth.getBalance(address) / Math.pow(10, 18);
		message.channel.send("Bot address is " + Settings.blockExplorerAddr + address + " with: **" + Number(balance).toFixed(3) + "** " + Settings.ticker + ".");

		if (unit != Settings.etherUnit) {
			getTokenBalance(address, unit, message);
		}
	}

	if (message.content.startsWith(prefix+"register")) {
		var author = message.author.id;

		if (true) {
			var data = getJson('data/users.json');
			var current = data["@id"];
			if (!Object.keys(data).includes(author)) {
				var newId = current + 1;
				data[author] = { uid: newId, name: message.author.username };
				data["@id"] = newId;

				const hdkey = prepareHDKey();
				const hdPath = getHdPath(hdkey, 0, newId); // type == 0 : external, type == 1 : internal
				const hd = hdkey.derive(hdPath);
				let address = getAddress(hd);

				message.channel.send("<@" + message.author.id + "> registred. your address is `" + address + "`");
				fs.writeFile(Settings.path, JSON.stringify(data, null, 2), (err) => {
					if (err) throw err;
					console.log('users.json file has been saved.');
				});
			} else {
				var user = data[author];
				const hdkey = prepareHDKey();
				const hdPath = getHdPath(hdkey, 0, newId); // type == 0 : external, type == 1 : internal
				const hd = hdkey.derive(hdPath);
				let address = getAddress(hd);

				message.channel.send("You have already registered. your address is `" + address + "`");
			}
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

	if (message.content == prefix + "list") {
		var data = getJson('data/users.json');
		message.channel.send("Total registered users is **" + Object.keys(data).length + "**.");
	}

	if (message.content == prefix + "checkRegister") {
		let author = message.author.id;
		let data = getJson('data/users.json');
		if (Object.keys(data).includes(author)) {
			message.channel.send("<@"+author + "> already registered.");
		} else {
			message.channel.send("You are not in the list, use **" + prefix + register + "** command first.");
		}
	}

	if (message.content === prefix + "help") {
		message.channel.send(Settings.botName + " commands:\n"+
			"**" + prefix + "balance** *<address>* - show " + Settings.ticker + " balance on the following address.\n" +
			"**" + prefix + "balance** - show " + Settings.ticker + " balance of yours. \n" +
			//"**"+prefix+"sendToAddress** *<address>* *<amount>* - send " + Settings.ticker + " to the following address (Admin Only)\n"+
			"**" + prefix + "send** *<name|address>* *<amount>* send " + Settings.ticker + " to the following user/address\n" +
			"**" + prefix + "withdraw** *<address>* *<amount>* withdraw " + Settings.ticker + " to the following address\n" +
			//"**"+prefix+"rain** *<amount>* - send " + Settings.ticker + " to all registered and online address's (Admin Only).\n"+
			//"**"+prefix+"coming** *<amount>* *<numOfHrs>* - rain will be after N hours (Admin Only). \n"+
			"**" + prefix + "getaddress** - shows fund address so everyone can fund it.\n" +
			//"**"+prefix+"register** *<address>*  - saves user address and name to db. \n"+
			"**" + prefix + "register** - register user to db.\n" +
			"**" + prefix + "checkRegister** - find whether you're registered or not.\n" +
			"**" + prefix + "list** - shows number of registered users.");
	}
})


bot.login(Settings.token);
